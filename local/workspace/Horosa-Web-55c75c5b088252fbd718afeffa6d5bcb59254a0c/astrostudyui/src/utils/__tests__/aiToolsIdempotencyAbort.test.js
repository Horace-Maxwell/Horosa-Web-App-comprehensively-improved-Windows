// 写入类工具:调用方已取消 / 超时 → 不开始执行(零写入);客户端带幂等键重试 → 不重复写(同参回放第一次的结果,参数不同则拒)。
// 外部客户端经本机桥(_meta.idempotencyKey)与直接调注册表两条路都锁。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests, listActions } from '../aiTools/ledger';
import { setAgentEnabled, setExternalPolicy } from '../aiAgent/prefs';
import { listLocalCharts } from '../localcharts';
import * as registry from '../aiTools/registry';
import { handleAgentToolRequest, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { listPendingApprovals, resolveApproval, __resetApprovalsForTests } from '../aiAgent/approvals';
import { undoAction } from '../aiTools/ledger';
import { normalizeIdempotencyKey, IDEMPOTENCY_KEY_MAX } from '../aiTools/idempotencyKey';
import fs from 'fs';
import path from 'path';

const args = (name)=>({ name, birth: '1990-01-01 08:00', gender: 'male', place: '北京', selectAsAnalysisSource: false });
const ctx = (extra)=>({ origin: 'mcp', requestId: `r-${Math.random()}`, clientName: 'probe', dispatch: jest.fn(), ...(extra || {}) });
const count = (name)=>listLocalCharts({ includeArchived: true }).filter((r)=>r.name === name).length;

beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); __resetApprovalsForTests(); __resetMcpBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	setAgentEnabled(true);
});

describe('写入类看中止信号', ()=>{
	it('🔴 信号已中止 → E_CANCELLED,零写入、账本不留占位', async ()=>{
		const ac = new AbortController(); ac.abort();
		const r = await runTool('create_chart_record', args('中止甲'), ctx({ signal: ac.signal }));
		expect(r.ok).toBe(false); expect(r.code).toBe('E_CANCELLED');
		expect(count('中止甲')).toBe(0);
		expect((listActions() || []).length).toBe(0);
	});
	it('读级工具不受影响(中止信号只挡写入)', async ()=>{
		const ac = new AbortController(); ac.abort();
		expect((await runTool('list_records', {}, ctx({ signal: ac.signal }))).ok).toBe(true);
	});
});

describe('幂等键', ()=>{
	it('🔴 同键同参重试:只建一张档案,第二次回放第一次的结果(replayed)', async ()=>{
		const a = await runTool('create_chart_record', args('幂等甲'), ctx({ idempotencyKey: 'k-1' }));
		const b = await runTool('create_chart_record', args('幂等甲'), ctx({ idempotencyKey: 'k-1' }));
		expect(a.ok).toBe(true); expect(b.ok).toBe(true);
		expect(b.replayed).toBe(true); expect(b.data.cid).toBe(a.data.cid);
		expect(count('幂等甲')).toBe(1);
		expect(listActions().filter((x)=>x.tool === 'create_chart_record').length).toBe(1);
	});
	it('🔴 同键并发:等同一次,不写两张', async ()=>{
		const [a, b] = await Promise.all([runTool('create_chart_record', args('幂等乙'), ctx({ idempotencyKey: 'k-2' })), runTool('create_chart_record', args('幂等乙'), ctx({ idempotencyKey: 'k-2' }))]);
		expect(a.data.cid).toBe(b.data.cid);
		expect(count('幂等乙')).toBe(1);
	});
	it('同键不同参 → E_IDEMPOTENCY_CONFLICT 不执行;换键照常执行;第一次失败的不留', async ()=>{
		await runTool('create_chart_record', args('幂等丙'), ctx({ idempotencyKey: 'k-3' }));
		const c = await runTool('create_chart_record', args('幂等丁'), ctx({ idempotencyKey: 'k-3' }));
		expect(c.code).toBe('E_IDEMPOTENCY_CONFLICT'); expect(count('幂等丁')).toBe(0);
		// 换一个键 = 另一次请求(不回放)
		const other = await runTool('create_chart_record', args('幂等戊'), ctx({ idempotencyKey: 'k-3b' }));
		expect(other.ok).toBe(true); expect(other.replayed).toBeUndefined(); expect(count('幂等戊')).toBe(1);
		const ac = new AbortController(); ac.abort();
		expect((await runTool('create_chart_record', args('幂等己'), ctx({ idempotencyKey: 'k-4', signal: ac.signal }))).code).toBe('E_CANCELLED');
		const retry = await runTool('create_chart_record', args('幂等己'), ctx({ idempotencyKey: 'k-4' }));
		expect(retry.ok).toBe(true); expect(retry.replayed).toBeUndefined(); expect(count('幂等己')).toBe(1);
	});
	it('🔴 经本机桥:tools/call 的 _meta.idempotencyKey 生效,回包标 replayed', async ()=>{
		setExternalPolicy({ approval: 'auto' });
		const call = (id)=>handleAgentToolRequest({ id, method: 'tools/call', clientName: 'probe', params: { name: 'create_chart_record', arguments: args('桥幂等'), _meta: { idempotencyKey: 'bridge-1' } } }, registry);
		const r1 = await call(1);
		const r2 = await call(2);
		expect(r1.result.isError).toBe(false); expect(r2.result.isError).toBe(false);
		expect(JSON.parse(r2.result.content[0].text).replayed).toBe(true);
		expect(count('桥幂等')).toBe(1);
	});
});

// 「每次确认」档下的幂等:判定在限流与审批之前(registry.peekIdempotent,与 runTool 同一份)
describe('幂等键 × 外部每次确认档', ()=>{
	const flush = ()=>new Promise((r)=>setTimeout(r, 0));
	const call = (id, a, key)=>handleAgentToolRequest({ id, method: 'tools/call', clientName: 'probe', params: { name: 'create_chart_record', arguments: a, _meta: { idempotencyKey: key } } }, registry);
	// 跑到落定;期间审批台出现的条目按 decide 落定(true 允许 / false 跳过),回 { body, approvals }
	async function settle(p, decide){
		let approvals = 0;
		let done = false;
		p.then(()=>{ done = true; });
		for(let i = 0; i < 400 && !done; i++){
			await flush();   // eslint-disable-line no-await-in-loop
			const pend = listPendingApprovals('mcp:probe');
			if(pend.length){ approvals += pend.length; pend.forEach((x)=>resolveApproval(x.callId, decide, 'mcp:probe')); }
		}
		const r = await p;
		return { body: JSON.parse(r.result.content[0].text), approvals };
	}
	beforeEach(()=>{ setExternalPolicy({ approval: 'on-request' }); });
	it('🔴 同键同参重试:零审批条目、回放第一次结果(replayed),档案只有一张', async ()=>{
		const a1 = await settle(call(1, args('审批幂等甲'), 'oa-1'), true);
		expect(a1.approvals).toBe(1); expect(a1.body.ok).toBe(true);
		const a2 = await settle(call(2, args('审批幂等甲'), 'oa-1'), false);   // 即便弹了也点跳过:不该弹
		expect(a2.approvals).toBe(0); expect(a2.body.ok).toBe(true); expect(a2.body.replayed).toBe(true);
		expect(a2.body.data.cid).toBe(a1.body.data.cid);
		expect(count('审批幂等甲')).toBe(1);
	});
	it('🔴 同键异参:零审批条目、直接冲突', async ()=>{
		await settle(call(1, args('审批幂等乙'), 'oa-2'), true);
		const r = await settle(call(2, args('审批幂等丙'), 'oa-2'), true);
		expect(r.approvals).toBe(0); expect(r.body.code).toBe('E_IDEMPOTENCY_CONFLICT'); expect(count('审批幂等丙')).toBe(0);
	});
	it('用户跳过第一次 → 不留记录:同键重试照常再弹审批', async ()=>{
		const r1 = await settle(call(1, args('审批幂等丁'), 'oa-3'), false);
		expect(r1.approvals).toBe(1); expect(r1.body.code).toBe('E_USER_SKIPPED'); expect(count('审批幂等丁')).toBe(0);
		const r2 = await settle(call(2, args('审批幂等丁'), 'oa-3'), true);
		expect(r2.approvals).toBe(1); expect(r2.body.ok).toBe(true); expect(r2.body.replayed).toBeUndefined(); expect(count('审批幂等丁')).toBe(1);
	});
	it('🔴 重试不计写入额度:每小时写入上限 1 时,同键回放照常回放、换键的新写入才被限', async ()=>{
		setExternalPolicy({ approval: 'auto', maxAdditivePerHour: 1 });
		const r1 = await settle(call(1, args('额度甲'), 'q-1'), true);
		expect(r1.body.ok).toBe(true);
		const r2 = await settle(call(2, args('额度甲'), 'q-1'), true);
		expect(r2.body.replayed).toBe(true);
		const r3 = await settle(call(3, args('额度乙'), 'q-2'), true);
		expect(r3.body.code).toBe('E_LIMIT');
	});
	it('🔴 第一次写入已在账本撤销:同键重试回 E_IDEMPOTENCY_UNDONE,不回放「成功」也不重写', async ()=>{
		setExternalPolicy({ approval: 'auto' });
		const r1 = await settle(call(1, args('撤销幂等'), 'u-1'), true);
		expect(undoAction(r1.body.undo.actionId).ok).toBe(true);
		expect(count('撤销幂等')).toBe(0);   // 已移进回收站
		const before = listLocalCharts({ includeArchived: true }).length;
		const r2 = await settle(call(2, args('撤销幂等'), 'u-1'), true);
		expect(r2.approvals).toBe(0); expect(r2.body.ok).toBe(false); expect(r2.body.code).toBe('E_IDEMPOTENCY_UNDONE');
		expect(listLocalCharts({ includeArchived: true }).length).toBe(before); expect(count('撤销幂等')).toBe(0);   // 没有重写
		// 直接调注册表同口径
		expect((await runTool('create_chart_record', args('撤销幂等'), ctx({ idempotencyKey: 'u-1' }))).code).toBe('E_IDEMPOTENCY_UNDONE');
	});
});

// 第一次还挂在审批台上、客户端就带同一个键重试:真实入口(壳 → 页面的调度队列)里写入类走独占道、严格串行,
// 第二次排在第一次之后 —— 审批台上永远只有一张卡;第一次允许后第二次直接回放(replayed),不再弹卡、不写第二张。
// 这条承诺靠独占道成立:谁把写入改成可并行,这里先红(届时幂等「在途」必须覆盖审批等待)。
describe('幂等键 × 每次确认档 × 第一次仍在审批中(经真实调度队列)', ()=>{
	const desktop = require('../aiAnalysisDesktop');
	const { bindMcpBridge } = require('../aiAgent/mcpBridge');
	const flush = ()=>new Promise((r)=>setTimeout(r, 0));
	let invoke;
	const results = ()=>invoke.mock.calls.filter((c)=>c[0] === 'agent_tool_result_command').map((c)=>c[1]);
	beforeEach(async ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		invoke = jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue({});
		setExternalPolicy({ approval: 'on-request' });
		bindMcpBridge();
		for(let i = 0; i < 10; i++){ await flush(); }   // eslint-disable-line no-await-in-loop
	});
	afterEach(()=>{ jest.restoreAllMocks(); __resetMcpBridgeForTests(); });
	it('🔴 同键同参两次并发:审批台始终只有一张卡;允许后第二次回放第一次的结果,档案只有一张', async ()=>{
		const send = (id)=>window.__horosaAgentTool({ id, method: 'tools/call', clientName: 'probe', sessionId: 's1', params: { name: 'create_chart_record', arguments: args('审批中重试'), _meta: { idempotencyKey: 'inflight-1' } } });
		send(1);
		for(let i = 0; i < 200 && !listPendingApprovals('mcp:probe').length; i++){ await flush(); }   // eslint-disable-line no-await-in-loop
		send(2);   // 第一次还在等审批
		let maxPending = 0;
		for(let i = 0; i < 50; i++){ await flush(); maxPending = Math.max(maxPending, listPendingApprovals('mcp:probe').length); }   // eslint-disable-line no-await-in-loop
		expect(maxPending).toBe(1);
		const [first] = listPendingApprovals('mcp:probe');
		resolveApproval(first.callId, true, 'mcp:probe');
		for(let i = 0; i < 400 && results().length < 2; i++){
			await flush();   // eslint-disable-line no-await-in-loop
			maxPending = Math.max(maxPending, listPendingApprovals('mcp:probe').length);
			listPendingApprovals('mcp:probe').forEach((x)=>resolveApproval(x.callId, false, 'mcp:probe'));   // 不该再有卡;有就点跳过让它显形
		}
		expect(maxPending).toBe(1);
		const bodies = results().sort((a, b)=>a.id - b.id).map((r)=>JSON.parse(r.result.content[0].text));
		expect(bodies.map((b)=>[b.ok, b.replayed === true])).toEqual([[true, false], [true, true]]);
		expect(bodies[1].data.cid).toBe(bodies[0].data.cid);
		expect(count('审批中重试')).toBe(1);
	});
});

describe('幂等键随账本落盘(页面重载 / 换进程之后)', ()=>{
	const reload = ()=>{ __resetToolsForTests(); registerBuiltinTools(); };   // 内存表清空,账本(本机存储)还在
	it('🔴 内存表清空后同键同参:按账本回放(replayed),不再建第二张;换参冲突;过了有效期照常执行', async ()=>{
		const a = await runTool('create_chart_record', args('落盘幂等'), ctx({ idempotencyKey: 'p-1' }));
		expect(a.ok).toBe(true);
		reload();
		const b = await runTool('create_chart_record', args('落盘幂等'), ctx({ idempotencyKey: 'p-1' }));
		expect(b.ok).toBe(true); expect(b.replayed).toBe(true); expect(b.data.cid).toBe(a.data.cid); expect(b.undo.actionId).toBe(a.undo.actionId);
		expect(count('落盘幂等')).toBe(1);
		reload();
		expect((await runTool('create_chart_record', args('落盘幂等乙'), ctx({ idempotencyKey: 'p-1' }))).code).toBe('E_IDEMPOTENCY_CONFLICT');
		// 账本条目过期(把时间改到 31 分钟前)= 不认
		const ledger = JSON.parse(window.localStorage.getItem('horosa.ai.agent.ledger.v1'));
		ledger.forEach((x)=>{ if(x.idem){ x.at = new Date(Date.now() - 31 * 60 * 1000).toISOString(); } });
		window.localStorage.setItem('horosa.ai.agent.ledger.v1', JSON.stringify(ledger));
		reload();
		const c = await runTool('create_chart_record', args('落盘幂等丙'), ctx({ idempotencyKey: 'p-1' }));
		expect(c.ok).toBe(true); expect(c.replayed).toBeUndefined();
	});
	it('槽按来源 | 客户端 | 工具 | 键:另一个客户端同键不回放', async ()=>{
		await runTool('create_chart_record', args('分槽甲'), ctx({ idempotencyKey: 's-1' }));
		reload();
		const other = await runTool('create_chart_record', args('分槽甲'), ctx({ idempotencyKey: 's-1', clientName: 'other' }));
		expect(other.replayed).toBeUndefined();
	});
});

describe('幂等键口径(共用用例表,桌面壳 / 无头协议层读同一份)', ()=>{
	const rows = fs.readFileSync(path.join(__dirname, 'fixtures/idempotencyKeyCases.tsv'), 'utf8').split('\n').filter((l)=>l && !l.startsWith('#')).map((l)=>l.split('\t'));
	it('用例表覆盖:空 / 空白 / 上限 / 超长 / 增补平面字', ()=>{
		expect(rows.length).toBeGreaterThanOrEqual(10);
		expect(rows.some((r)=>r[1] === 'error')).toBe(true);
		expect(rows.some((r)=>r[1] === 'none')).toBe(true);
		expect(IDEMPOTENCY_KEY_MAX).toBe(200);
	});
	it.each(rows.map((r)=>[r[2], r[0], r[1]]))('%s', (note, rawJson, exp)=>{
		const n = normalizeIdempotencyKey(JSON.parse(rawJson));
		if(exp === 'none'){ expect(n).toEqual({ key: '' }); }else if(exp === 'error'){ expect(n.error).toBe('too-long'); }else{ expect(n.key).toBe(JSON.parse(exp)); }
	});
	it('🔴 超长键不静默丢:注册表回明确的参数错,零写入', async ()=>{
		const r = await runTool('create_chart_record', args('超长键'), ctx({ idempotencyKey: '😀'.repeat(201) }));
		expect(r.ok).toBe(false); expect(r.code).toBe('E_ARGS_INVALID'); expect(count('超长键')).toBe(0);
		// 200 个 emoji(UTF-16 码元 400)按字计合法:幂等生效
		const k = '😀'.repeat(200);
		await runTool('create_chart_record', args('长键'), ctx({ idempotencyKey: k }));
		expect((await runTool('create_chart_record', args('长键'), ctx({ idempotencyKey: k }))).replayed).toBe(true);
	});
});
