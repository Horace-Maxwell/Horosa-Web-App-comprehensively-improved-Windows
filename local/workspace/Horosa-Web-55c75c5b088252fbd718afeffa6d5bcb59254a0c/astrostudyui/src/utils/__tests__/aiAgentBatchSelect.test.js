// AI 助手·批量建档抑制:同批多条建档只在批尾选中最后一条成功建档(运行时 additive 串行循环 + 外部桥串行队列)。
// 建档真落 localStorage(不 mock 内核);判别向量:开关关=逐条选中的旧行为、单条=立即选中、失败/不选项不进登记、中途停止不选。
import { createAgentTurn } from '../aiAgent/runtime';
import { AGENT_ENABLED_KEY } from '../aiAgent/prefs';
import { bindMcpBridge, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { registerBuiltinTools } from '../aiTools';
import { __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests } from '../aiTools/ledger';
import * as localcharts from '../localcharts';
import * as localcases from '../localcases';
import * as desktop from '../aiAnalysisDesktop';

const BATCH_FLAG = 'horosa.perf.agentBatchSelect';
const DEFER_NOTE = '批量建档:统一在本批结束后选中最后一条';
const BASE = [{ role: 'system', content: 'SYS' }, { role: 'user', content: '帮我把这几个人都建档' }];
const flush = async (n = 8)=>{ for(let i = 0; i < n; i++){ await new Promise((r)=>setTimeout(r, 0)); } };

// 脚本化伪流:每轮一组事件(与运行时单测同一夹具)
function mkStream(scripts){
	const calls = [];
	const request = jest.fn(async (values, handlers)=>{
		calls.push(values);
		const evs = scripts[calls.length - 1] || [{ type: 'done', json: { finish_reason: 'stop' } }];
		for(const e of evs){ handlers.onEvent(e); }
	});
	return { request, calls };
}
// 页面 do/while 的最小同构驱动
async function drive(agent, stream){
	let error = null;
	do{
		agent.beginRound();
		try{
			await stream.request({ messages: agent.messagesForRound(BASE), tools: agent.toolDefs(), toolChoice: agent.toolChoice() }, { onEvent: (e)=>agent.onEvent(e) });
		}catch(e){
			if(!agent.absorbStreamError(e)){ error = e; break; }
		}
	}while(await agent.settleRound());
	return error;
}
const tc = (id, name, args, index)=>[{ type: 'tool_call_start', json: { id, name, index } }, { type: 'tool_call', json: { id, name, index, arguments: JSON.stringify(args) } }];
const chartCall = (i, name, place, extra)=>tc(`c${i}`, 'create_chart_record', { name, birth: '1990-01-01 08:00', place, ...(extra || {}) }, i);
const DONE_CALLS = { type: 'done', json: { finish_reason: 'tool_calls' } };
const FINAL_ROUND = [{ type: 'delta', json: { delta: '都建好了' } }, { type: 'done', json: { finish_reason: 'stop' } }];
const mkUi = ()=>({ selectSource: jest.fn(), refreshSources: jest.fn() });
const fedOf = (agent)=>agent.trace().rounds[0].results.map((x)=>JSON.parse(x.content));
const cidOf = (name)=>{ const row = localcharts.listLocalCharts({}).find((r)=>r.name === name); return row ? row.cid : null; };
const hasKey = (o, k)=>Object.prototype.hasOwnProperty.call(o, k);
const mcpCreate = (id, name, place)=>({ id, method: 'tools/call', params: { name: 'create_chart_record', arguments: { name, birth: '1990-01-01 08:00', place: place || '北京' } } });

beforeEach(()=>{
	window.localStorage.clear();
	jest.restoreAllMocks();
	jest.spyOn(console, 'warn').mockImplementation(()=>{});   // 内置工具幂等重注册的覆盖提示不刷屏
	__resetToolsForTests();
	__resetLedgerForTests();
	__resetWorkspaceBridgeForTests();
	__resetMcpBridgeForTests();
	registerBuiltinTools();
	window.localStorage.setItem(AGENT_ENABLED_KEY, '1');
});
afterEach(()=>{ __resetMcpBridgeForTests(); __resetWorkspaceBridgeForTests(); });

describe('运行时:同轮多条建档', ()=>{
	it('🔴 ① 一轮 3 条 create_chart_record → refreshSources/selectSource 各恰 1 次且选中第 3 条;三条结果 selectionDeferred', async ()=>{
		const ui = mkUi();
		const dispatch = jest.fn();
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', ui, dispatch });
		const stream = mkStream([[...chartCall(1, '批一', '北京'), ...chartCall(2, '批二', '上海'), ...chartCall(3, '批三', '福州'), DONE_CALLS], FINAL_ROUND]);
		expect(await drive(agent, stream)).toBe(null);
		expect(localcharts.listLocalCharts({}).length).toBe(3);
		expect(ui.selectSource).toHaveBeenCalledTimes(1);
		expect(ui.selectSource).toHaveBeenCalledWith(cidOf('批三'));
		expect(ui.refreshSources).toHaveBeenCalledTimes(1);
		expect(ui.refreshSources.mock.invocationCallOrder[0]).toBeLessThan(ui.selectSource.mock.invocationCallOrder[0]);   // 先刷新列表再选中
		const fed = fedOf(agent);
		expect(fed.map((f)=>f.ok)).toEqual([true, true, true]);
		expect(fed.map((f)=>f.data.selectionDeferred)).toEqual([true, true, true]);
		expect(fed.map((f)=>f.data.selected)).toEqual([false, false, false]);
		expect(fed.every((f)=>f.assumptions.indexOf(DEFER_NOTE) >= 0)).toBe(true);
		expect(dispatch.mock.calls.filter((c)=>c[0].type === 'user/fetchCharts').length).toBe(3);   // 每条仍各自派发档案列表刷新
		expect(agent.trace().stopReason).toBe('stop');
	});
	it('② 第 3 条失败(地名不存在)→ 选中第 2 条;失败者不进登记', async ()=>{
		const ui = mkUi();
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', ui, dispatch: jest.fn() });
		const stream = mkStream([[...chartCall(1, '批一', '北京'), ...chartCall(2, '批二', '上海'), ...chartCall(3, '批三', '不存在的地名XYZ'), DONE_CALLS], FINAL_ROUND]);
		expect(await drive(agent, stream)).toBe(null);
		expect(localcharts.listLocalCharts({}).length).toBe(2);
		const fed = fedOf(agent);
		expect(fed[2].ok).toBe(false);
		expect(fed[2].code).toBe('E_PLACE_NOT_FOUND');
		expect(ui.selectSource).toHaveBeenCalledTimes(1);
		expect(ui.selectSource).toHaveBeenCalledWith(cidOf('批二'));
		expect(ui.refreshSources).toHaveBeenCalledTimes(1);
	});
	it('③ 单条 → 工具侧立即选中;结果无 selectionDeferred 键、无批量假设', async ()=>{
		const ui = mkUi();
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', ui, dispatch: jest.fn() });
		const stream = mkStream([[...chartCall(1, '独一', '北京'), DONE_CALLS], FINAL_ROUND]);
		expect(await drive(agent, stream)).toBe(null);
		expect(ui.selectSource).toHaveBeenCalledTimes(1);
		expect(ui.selectSource).toHaveBeenCalledWith(cidOf('独一'));
		expect(ui.refreshSources).toHaveBeenCalledTimes(1);
		const fed = fedOf(agent);
		expect(fed[0].data.selected).toBe(true);
		expect(hasKey(fed[0].data, 'selectionDeferred')).toBe(false);
		expect(fed[0].assumptions.indexOf(DEFER_NOTE)).toBe(-1);
	});
	it('④ 中途停止 → 已建的两条不选中,余下调用 E_ABORTED', async ()=>{
		const ui = mkUi();
		const ac = new AbortController();
		let created = 0;
		const dispatch = jest.fn((action)=>{ if(action && action.type === 'user/fetchCharts'){ created += 1; if(created === 2){ ac.abort(); } } });
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', ui, dispatch, signal: ac.signal });
		const stream = mkStream([[...chartCall(1, '批一', '北京'), ...chartCall(2, '批二', '上海'), ...chartCall(3, '批三', '福州'), DONE_CALLS]]);
		await drive(agent, stream);
		expect(localcharts.listLocalCharts({}).length).toBe(2);
		expect(ui.selectSource).not.toHaveBeenCalled();
		expect(ui.refreshSources).not.toHaveBeenCalled();
		expect(agent.trace().stopReason).toBe('aborted');
		const res = agent.trace().rounds[0].results;
		expect(res.find((r)=>r.callId === 'c3').code).toBe('E_ABORTED');
	});
	it('⑥ 开关 horosa.perf.agentBatchSelect=0 → 逐条 refresh+select(旧行为),零 selectionDeferred', async ()=>{
		window.localStorage.setItem(BATCH_FLAG, '0');
		const ui = mkUi();
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', ui, dispatch: jest.fn() });
		const stream = mkStream([[...chartCall(1, '批一', '北京'), ...chartCall(2, '批二', '上海'), ...chartCall(3, '批三', '福州'), DONE_CALLS], FINAL_ROUND]);
		expect(await drive(agent, stream)).toBe(null);
		expect(ui.selectSource).toHaveBeenCalledTimes(3);
		expect(ui.selectSource.mock.calls.map((c)=>c[0])).toEqual([cidOf('批一'), cidOf('批二'), cidOf('批三')]);
		expect(ui.refreshSources).toHaveBeenCalledTimes(3);
		const fed = fedOf(agent);
		expect(fed.map((f)=>f.data.selected)).toEqual([true, true, true]);
		expect(fed.some((f)=>hasKey(f.data, 'selectionDeferred'))).toBe(false);
		expect(fed.some((f)=>f.assumptions.indexOf(DEFER_NOTE) >= 0)).toBe(false);
	});
	it('⑦ 命盘+事盘混批 → 建事盘同样走登记,只选中末条(事盘 cid)', async ()=>{
		const ui = mkUi();
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', ui, dispatch: jest.fn() });
		const stream = mkStream([[...chartCall(1, '批一', '北京'), ...tc('k2', 'create_case_record', { caseType: 'qimen', place: '福州', question: '出行' }, 2), DONE_CALLS], FINAL_ROUND]);
		expect(await drive(agent, stream)).toBe(null);
		expect(localcharts.listLocalCharts({}).length).toBe(1);
		const cases = localcases.listLocalCases({});
		expect(cases.length).toBe(1);
		expect(ui.selectSource).toHaveBeenCalledTimes(1);
		expect(ui.selectSource).toHaveBeenCalledWith(cases[0].cid);
		expect(ui.refreshSources).toHaveBeenCalledTimes(1);
		const fed = fedOf(agent);
		expect(fed.map((f)=>f.data.selectionDeferred)).toEqual([true, true]);
	});
	it('⑧ 末条 selectAsAnalysisSource=false → 不登记不选中,批尾选中前一条', async ()=>{
		const ui = mkUi();
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', ui, dispatch: jest.fn() });
		const stream = mkStream([[...chartCall(1, '批一', '北京'), ...chartCall(2, '批二', '上海', { selectAsAnalysisSource: false }), DONE_CALLS], FINAL_ROUND]);
		expect(await drive(agent, stream)).toBe(null);
		expect(ui.selectSource).toHaveBeenCalledTimes(1);
		expect(ui.selectSource).toHaveBeenCalledWith(cidOf('批一'));
		const fed = fedOf(agent);
		expect(fed[0].data.selectionDeferred).toBe(true);
		expect(fed[1].data.selected).toBe(false);
		expect(hasKey(fed[1].data, 'selectionDeferred')).toBe(false);
	});
	it('⑨ ctx 合同:additive 逐条带 batch{index,total,isLast}+deferSelect,read 不带;登记后批尾恰选一次且在末条完成之后', async ()=>{
		const MANIFEST = [
			{ name: 'probe_read', level: 'read', description: 'r', inputSchema: { type: 'object', additionalProperties: false, properties: {} } },
			{ name: 'probe_add', level: 'additive', description: 'a', inputSchema: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' } } } },
		];
		const log = [];
		const seen = [];
		const runTool = jest.fn(async (name, args, ctx)=>{
			seen.push({ name, batch: ctx.batch, hasDefer: typeof ctx.deferSelect === 'function' });
			if(name === 'probe_add'){ ctx.deferSelect(`local-${args.name}`); }
			log.push(`${name}:${args.name || ''}`);
			return { ok: true, data: {} };
		});
		const reg = { exportToolManifest: ()=>MANIFEST, runTool, getTool: (n)=>MANIFEST.find((m)=>m.name === n) };
		const ui = { selectSource: jest.fn((cid)=>log.push(`select:${cid}`)), refreshSources: jest.fn(()=>log.push('refresh')) };
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, ui });
		const stream = mkStream([[...tc('r1', 'probe_read', {}, 0), ...tc('a1', 'probe_add', { name: 'x' }, 1), ...tc('a2', 'probe_add', { name: 'y' }, 2), DONE_CALLS], FINAL_ROUND]);
		expect(await drive(agent, stream)).toBe(null);
		expect(seen.find((s)=>s.name === 'probe_read')).toEqual({ name: 'probe_read', batch: undefined, hasDefer: false });
		expect(seen.filter((s)=>s.name === 'probe_add').map((s)=>s.batch)).toEqual([{ index: 0, total: 2, isLast: false }, { index: 1, total: 2, isLast: true }]);
		expect(seen.filter((s)=>s.name === 'probe_add').every((s)=>s.hasDefer)).toBe(true);
		expect(log.slice(-3)).toEqual(['probe_add:y', 'refresh', 'select:local-y']);
		expect(ui.selectSource).toHaveBeenCalledTimes(1);
	});
});

describe('外部桥:串行队列', ()=>{
	function bindWithUi(ui){
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		const replies = [];
		jest.spyOn(desktop, 'invokeDesktopCommand').mockImplementation(async (cmd, args)=>{ if(cmd === 'agent_tool_result_command'){ replies.push(args); } return {}; });
		registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn(), ...(ui ? { ui } : {}) });
		bindMcpBridge();
		expect(typeof window.__horosaAgentTool).toBe('function');
		return replies;
	}
	async function drain(replies, n){
		for(let i = 0; i < 3000 && replies.length < n; i++){ await flush(2); }
		expect(replies.length).toBe(n);
	}
	it('🔴 ⑤ 连续入队 5 条建档 → 排空后 refresh/select 各 1 次且选中第 5 条;随后单条照旧立即选中', async ()=>{
		const ui = mkUi();
		const replies = bindWithUi(ui);
		for(let i = 1; i <= 5; i++){ window.__horosaAgentTool(mcpCreate(i, `桥${i}`)); }
		await drain(replies, 5);
		expect(replies.map((r)=>r.id)).toEqual([1, 2, 3, 4, 5]);
		replies.forEach((r)=>{ expect(r.ok).toBe(true); expect(r.result.isError).toBe(false); });
		expect(localcharts.listLocalCharts({}).length).toBe(5);
		expect(ui.selectSource).toHaveBeenCalledTimes(1);
		expect(ui.selectSource).toHaveBeenCalledWith(cidOf('桥5'));
		expect(ui.refreshSources).toHaveBeenCalledTimes(1);
		expect(replies.every((r)=>r.result.structuredContent.selectionDeferred === true && r.result.structuredContent.selected === false)).toBe(true);
		// 队列已空时再入队一条 → 工具侧立即选中,结果无 selectionDeferred 键
		window.__horosaAgentTool(mcpCreate(6, '桥六'));
		await drain(replies, 6);
		expect(ui.selectSource).toHaveBeenCalledTimes(2);
		expect(ui.selectSource).toHaveBeenLastCalledWith(cidOf('桥六'));
		expect(ui.refreshSources).toHaveBeenCalledTimes(2);
		expect(replies[5].result.structuredContent.selected).toBe(true);
		expect(hasKey(replies[5].result.structuredContent, 'selectionDeferred')).toBe(false);
	}, 20000);
	it('⑤b 队列末条失败 → 选中前一条成功建档;开关关 → 队列内逐条选中', async ()=>{
		const ui = mkUi();
		const replies = bindWithUi(ui);
		window.__horosaAgentTool(mcpCreate(1, '桥一'));
		window.__horosaAgentTool(mcpCreate(2, '桥二'));
		window.__horosaAgentTool(mcpCreate(3, '桥三', '不存在的地名XYZ'));
		await drain(replies, 3);
		expect(replies[2].result.isError).toBe(true);
		expect(ui.selectSource).toHaveBeenCalledTimes(1);
		expect(ui.selectSource).toHaveBeenCalledWith(cidOf('桥二'));
		window.localStorage.setItem(BATCH_FLAG, '0');
		window.__horosaAgentTool(mcpCreate(4, '桥四'));
		window.__horosaAgentTool(mcpCreate(5, '桥五'));
		await drain(replies, 5);
		expect(ui.selectSource).toHaveBeenCalledTimes(3);
		expect(ui.selectSource.mock.calls.slice(1).map((c)=>c[0])).toEqual([cidOf('桥四'), cidOf('桥五')]);
		expect(replies.slice(3).every((r)=>r.result.structuredContent.selected === true && !hasKey(r.result.structuredContent, 'selectionDeferred'))).toBe(true);
	}, 20000);
	it('⑤c 无工作区 ui → 多条建档零选中零抛错,结果不带 selectionDeferred', async ()=>{
		const replies = bindWithUi(null);
		window.__horosaAgentTool(mcpCreate(1, '桥一'));
		window.__horosaAgentTool(mcpCreate(2, '桥二'));
		await drain(replies, 2);
		replies.forEach((r)=>{ expect(r.ok).toBe(true); expect(r.result.isError).toBe(false); expect(r.result.structuredContent.selected).toBe(false); expect(hasKey(r.result.structuredContent, 'selectionDeferred')).toBe(false); });
		expect(localcharts.listLocalCharts({}).length).toBe(2);
	}, 20000);
});
