// 外部智能体桥·两道调度 / 取消 / 进度 / 输出结构:
//   共享道(只读面 + 只读工具)并发 ≤3、同名工具一个一个来;独占道(写入 + 界面类)严格串行;两道互不等待。
//   壳转来的取消:排队中 ⇒ 出队永不执行;在跑 ⇒ 中止信号、不再回包;审批中 ⇒ 待审撤台。
//   progress:true 的调用:工具拿到 ctx.progress,回传强制递增且节流;声明了 outputSchema 的工具成功必带 structuredContent。
import { bindMcpBridge, handleAgentToolRequest, cancelAgentToolRequest, __bridgeLanesForTests, __resetMcpBridgeForTests, SHARED_CONCURRENCY, MCP_TEXT_HARD_LIMIT } from '../aiAgent/mcpBridge';
import { setAgentEnabled, AGENT_ENABLED_KEY, setExternalPolicy } from '../aiAgent/prefs';
import { registerTool, __resetToolsForTests } from '../aiTools/registry';
import { registerBuiltinTools } from '../aiTools';
import { __resetLedgerForTests } from '../aiTools/ledger';
import * as approvals from '../aiAgent/approvals';
import * as desktop from '../aiAnalysisDesktop';

const flush = ()=>new Promise((r)=>setTimeout(r, 0));
async function until(pred, n = 300){ for(let i = 0; i < n && !pred(); i++){ await flush(); } }   // eslint-disable-line no-await-in-loop

// 可控工具:每次调用登记一个「门」,测试按需放行
const gates = [];
function gated(name, level, category, extra){
	return { name, level, category, undoKind: 'none', description: name, inputSchema: { type: 'object', additionalProperties: true }, ...(extra || {}),
		run: (args, ctx)=>new Promise((resolve)=>{ const g = { name, args, ctx, started: true, release: (v)=>resolve(v || { ok: true, data: { name } }) }; gates.push(g); if(ctx && ctx.signal){ ctx.signal.addEventListener('abort', ()=>{ g.aborted = true; resolve({ ok: false, code: 'E_ABORTED', message: 'aborted' }); }, { once: true }); } }) };
}
let invoke;
function results(){ return invoke.mock.calls.filter((c)=>c[0] === 'agent_tool_result_command').map((c)=>c[1]); }
function progressCalls(){ return invoke.mock.calls.filter((c)=>c[0] === 'agent_tool_progress_command').map((c)=>c[1]); }
const call = (id, name, extraParams)=>window.__horosaAgentTool({ id, method: 'tools/call', params: { name, arguments: {}, ...(extraParams || {}) }, sessionId: 's1' });
const startedNames = ()=>gates.map((g)=>g.name);

beforeEach(async ()=>{
	window.localStorage.clear();
	jest.restoreAllMocks();
	__resetMcpBridgeForTests(); __resetToolsForTests(); __resetLedgerForTests(); approvals.__resetApprovalsForTests();
	gates.length = 0;
	registerBuiltinTools();
	registerTool(gated('slow_read', 'read', 'query'));
	registerTool(gated('other_read', 'read', 'query'));
	registerTool(gated('third_read', 'read', 'query'));
	registerTool(gated('fourth_read', 'read', 'query'));
	registerTool(gated('write_one', 'additive', 'records'));
	registerTool(gated('write_two', 'additive', 'records'));
	registerTool(gated('shaped_read', 'read', 'query', { outputSchema: { type: 'object', required: ['blob'], properties: { blob: { type: 'string' } } } }));
	jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
	invoke = jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue({});
	window.localStorage.setItem(AGENT_ENABLED_KEY, '1');
	setAgentEnabled(true);
	bindMcpBridge();
	await until(()=>false, 10);   // 让目录载入完成(按级别分道要用)
});
afterEach(()=>{ setAgentEnabled(false); __resetMcpBridgeForTests(); });

describe('两道调度', ()=>{
	it('🔴 只读并发到上限 3、第 4 条排队;写入走独占道不等只读;两条写入严格串行', async ()=>{
		expect(SHARED_CONCURRENCY).toBe(3);
		call(1, 'slow_read'); call(2, 'other_read'); call(3, 'third_read'); call(4, 'fourth_read');
		call(5, 'write_one'); call(6, 'write_two');
		await until(()=>gates.length >= 4);
		expect(startedNames().sort()).toEqual(['other_read', 'slow_read', 'third_read', 'write_one']);
		const lanes = __bridgeLanesForTests();
		expect(lanes.waiting.map((w)=>w.key).sort()).toEqual([4, 6]);
		// 放行一条只读 ⇒ 第 4 条只读开跑;写入二仍等写入一
		gates.find((g)=>g.name === 'other_read').release();
		await until(()=>startedNames().indexOf('fourth_read') >= 0);
		expect(startedNames().indexOf('write_two')).toBe(-1);
		gates.find((g)=>g.name === 'write_one').release();
		await until(()=>startedNames().indexOf('write_two') >= 0);
		gates.filter((g)=>!g.done).forEach((g)=>{ g.done = true; g.release(); });
		await until(()=>results().length >= 6);
		expect(results().map((r)=>r.id).sort()).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it('🔴 同名只读一个一个来,别的名字照样并发', async ()=>{
		call(11, 'slow_read'); call(12, 'slow_read'); call(13, 'other_read');
		await until(()=>gates.length >= 2);
		await flush();
		expect(startedNames()).toEqual(['slow_read', 'other_read']);
		gates[0].release();
		await until(()=>gates.length >= 3);
		expect(gates[2].name).toBe('slow_read');
		gates.slice(1).forEach((g)=>g.release());
		await until(()=>results().length >= 3);
		const order = results().map((r)=>r.id);
		expect(order.indexOf(11)).toBeLessThan(order.indexOf(12));
	});

	it('长起盘不再堵只读面:读资源 / 列提示在一条挂着的只读工具旁边照常回', async ()=>{
		call(21, 'slow_read');
		window.__horosaAgentTool({ id: 22, method: 'prompts/list', params: {} });
		window.__horosaAgentTool({ id: 23, method: 'resources/templates/list', params: {} });
		await until(()=>results().length >= 2);
		expect(results().map((r)=>r.id).sort()).toEqual([22, 23]);
		gates[0].release();
		await until(()=>results().length >= 3);
	});
});

describe('取消', ()=>{
	it('🔴 排队中的写入被取消 ⇒ 出队永不执行、不回包;独占道接着跑下一条', async ()=>{
		call(31, 'write_one'); call(32, 'write_two'); call(33, 'write_one');
		await until(()=>gates.length >= 1);
		expect(cancelAgentToolRequest(32)).toBe(true);
		expect(window.__horosaAgentToolCancel).toBeInstanceOf(Function);
		gates[0].release();
		await until(()=>gates.length >= 2);
		expect(startedNames()).toEqual(['write_one', 'write_one']);
		gates[1].release();
		await until(()=>results().length >= 2);
		await flush();
		expect(results().map((r)=>r.id)).toEqual([31, 33]);
		expect(cancelAgentToolRequest(32)).toBe(false);   // 已出队:再取消是空操作
	});

	it('🔴 在跑的调用被取消 ⇒ 工具收到中止信号、不再回包', async ()=>{
		call(41, 'slow_read');
		await until(()=>gates.length >= 1);
		window.__horosaAgentToolCancel(41);
		await until(()=>gates[0].aborted === true);
		expect(gates[0].ctx.signal.aborted).toBe(true);
		await flush(); await flush();
		expect(results().length).toBe(0);
		// 道已释放:下一条照常
		call(42, 'slow_read');
		await until(()=>gates.length >= 2);
		gates[1].release();
		await until(()=>results().length >= 1);
		expect(results()[0].id).toBe(42);
	});

	it('🔴 等审批时被取消 ⇒ 待审撤台、写入不执行(on-request 档)', async ()=>{
		setExternalPolicy({ approval: 'on-request' });
		window.__horosaAgentTool({ id: 51, method: 'tools/call', params: { name: 'write_one', arguments: {} }, clientName: 'codex', sessionId: 's1' });
		await until(()=>approvals.listPendingApprovals('mcp:codex').length === 1);
		cancelAgentToolRequest(51);
		await until(()=>approvals.listPendingApprovals('mcp:codex').length === 0);
		await flush(); await flush();
		expect(gates.length).toBe(0);
		expect(results().length).toBe(0);
	});

	it('直接调用:调用方信号已中止 ⇒ E_CANCELLED 不执行', async ()=>{
		const ac = new AbortController(); ac.abort();
		const runTool = jest.fn(async ()=>({ ok: true }));
		const r = await handleAgentToolRequest({ id: 61, method: 'tools/call', params: { name: 'list_records', arguments: {} } }, { exportToolManifest: ()=>[{ name: 'list_records', level: 'read' }], runTool }, { cancelSignal: ac.signal });
		expect(r.result.isError).toBe(true);
		expect(JSON.parse(r.result.content[0].text).code).toBe('E_CANCELLED');
		expect(runTool).not.toHaveBeenCalled();
	});
});

describe('进度', ()=>{
	it('🔴 progress:true ⇒ 工具拿到 ctx.progress;回传强制递增、≤每 250 ms 一帧、末帧补发;了结后不再发', async ()=>{
		jest.useFakeTimers();
		try{
			call(71, 'slow_read', { progress: true });
			for(let i = 0; i < 400 && gates.length < 1; i++){ await Promise.resolve(); jest.advanceTimersByTime(1); }   // eslint-disable-line no-await-in-loop
			expect(gates.length).toBe(1);
			const p = gates[0].ctx.progress;
			expect(typeof p).toBe('function');
			p(1, 3, '一'); p(2, 3, '二'); p(2, 3, '二又'); p(3, 3, '三');
			const before = progressCalls().length;
			jest.advanceTimersByTime(300);
			const all = progressCalls();
			expect(all.length).toBe(before + 1);   // 窗口内只留最后一条到点补发
			const values = all.map((v)=>v.progress);
			values.forEach((v, i)=>{ if(i){ expect(v).toBeGreaterThan(values[i - 1]); } });
			expect(all[all.length - 1].message).toBe('三');
			expect(all.every((v)=>v.id === 71)).toBe(true);
			gates[0].release();
			for(let i = 0; i < 200; i++){ await Promise.resolve(); }   // eslint-disable-line no-await-in-loop
			const n = progressCalls().length;
			p(9, 9, '迟到');
			jest.advanceTimersByTime(1000);
			expect(progressCalls().length).toBe(n);
		}finally{ jest.useRealTimers(); }
	});

	it('没要进度 ⇒ 工具 ctx 里没有 progress,也零回传', async ()=>{
		call(81, 'slow_read');
		await until(()=>gates.length >= 1);
		expect(gates[0].ctx.progress).toBeUndefined();
		gates[0].release();
		await until(()=>results().length >= 1);
		expect(progressCalls().length).toBe(0);
	});
});

describe('输出结构', ()=>{
	it('🔴 声明了 outputSchema ⇒ 成功恒带 structuredContent(正文截断也带);没声明的照旧随截断去掉', async ()=>{
		const big = 'x'.repeat(MCP_TEXT_HARD_LIMIT + 10);
		const man = [{ name: 'shaped_read', level: 'read', outputSchema: { type: 'object' } }, { name: 'plain_read', level: 'read' }];
		const runTool = async ()=>({ ok: true, data: { blob: big } });
		const a = await handleAgentToolRequest({ id: 91, method: 'tools/call', params: { name: 'shaped_read', arguments: {} } }, { exportToolManifest: ()=>man, runTool });
		expect(a.result.structuredContent).toEqual({ blob: big });
		const b = await handleAgentToolRequest({ id: 92, method: 'tools/call', params: { name: 'plain_read', arguments: {} } }, { exportToolManifest: ()=>man, runTool });
		expect(b.result.structuredContent).toBeUndefined();
		// 失败结果不带(规范只要求成功结果合规)
		const c = await handleAgentToolRequest({ id: 93, method: 'tools/call', params: { name: 'shaped_read', arguments: {} } }, { exportToolManifest: ()=>man, runTool: async ()=>({ ok: false, code: 'E_X', message: 'x', data: { blob: 'y' } }) });
		expect(c.result.isError).toBe(true);
		expect(c.result.structuredContent).toBeUndefined();
		const plain = await handleAgentToolRequest({ id: 94, method: 'tools/call', params: { name: 'plain_read', arguments: {} } }, { exportToolManifest: ()=>man, runTool: async ()=>({ ok: false, code: 'E_X', message: 'x', data: { blob: 'y' } }) });
		expect(plain.result.structuredContent).toBeUndefined();
		expect(JSON.parse(plain.result.content[0].text).data).toEqual({ blob: 'y' });
	});
});
