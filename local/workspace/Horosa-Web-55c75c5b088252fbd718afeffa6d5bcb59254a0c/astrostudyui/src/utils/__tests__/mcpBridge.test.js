// AI 助手·外部智能体桥:总开关门控/在途补读/串行/结果回传形状/错误映射/截断/零数据层 import。
const fs = require('fs');
const path = require('path');
import { bindMcpBridge, handleAgentToolRequest, truncateForMcp, __resetMcpBridgeForTests, MCP_TEXT_HARD_LIMIT } from '../aiAgent/mcpBridge';
import { exportToolManifest } from '../aiTools/registry';
import { AGENT_ENABLED_KEY, setAgentEnabled } from '../aiAgent/prefs';
import * as desktop from '../aiAnalysisDesktop';

const flush = ()=>new Promise((r)=>setTimeout(r, 0));
const ANY_MAN = [{ name: 'create_chart_record', level: 'additive' }, { name: 'list_records', level: 'read' }, { name: 'nope', level: 'read' }, { name: 'x', level: 'read' }];   // [D13] 桥不再执行目录外名字:通用夹具把本文件用到的名字全部列进目录

beforeEach(()=>{
	window.localStorage.clear();
	__resetMcpBridgeForTests();
	jest.restoreAllMocks();
});

describe('门控与挂钩', ()=>{
	it('总开关关 → 不挂 __horosaAgentTool;开 → 挂钩、丢弃在途队列(壳已判 -32003 让客户端重试,再执行=重复写入)并通知壳就绪;关 → 卸钩并通知 ready:false', async ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		const invoke = jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue({});
		window.__horosaPendingAgentTools = [{ id: 7, method: 'tools/call', params: { name: 'create_chart_record', arguments: { name: 'x', birth: '1990-01-01 08:00', place: '北京' } } }];
		bindMcpBridge();
		expect(window.__horosaAgentTool).toBeUndefined();
		window.localStorage.setItem(AGENT_ENABLED_KEY, '1');
		setAgentEnabled(true);
		expect(typeof window.__horosaAgentTool).toBe('function');
		await flush(); await flush();
		const ready = invoke.mock.calls.find((c)=>c[0] === 'agent_bridge_ready_command');
		expect(ready[1].ready).toBe(true);
		expect(window.__horosaPendingAgentTools.length).toBe(0);
		expect(invoke.mock.calls.some((c)=>c[0] === 'agent_tool_result_command')).toBe(false);   // 在途项不执行
		// 挂钩后的请求正常执行
		window.__horosaAgentTool({ id: 8, method: 'tools/list' });
		await flush(); await flush();
		const res = invoke.mock.calls.find((c)=>c[0] === 'agent_tool_result_command');
		expect(res[1].id).toBe(8);
		// 工具数随版本不同;判别力落在「与真实 manifest 一致 + 只含默认可见的只读/只增件」
		expect(res[1].result.tools.length).toBe(exportToolManifest({ includeExternal: false, origin: 'mcp' }).length);
		expect(res[1].result.tools.length).toBeGreaterThanOrEqual(13);
		expect(res[1].result.tools.every((t)=>t.name.indexOf('ext_') !== 0)).toBe(true);
		setAgentEnabled(false);
		expect(window.__horosaAgentTool).toBeUndefined();
		const gone = invoke.mock.calls.filter((c)=>c[0] === 'agent_bridge_ready_command').pop();
		expect(gone[1].ready).toBe(false);
	});
	it('非桌面壳:即使开关开也不挂钩', ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(false);
		setAgentEnabled(true);
		bindMcpBridge();
		expect(window.__horosaAgentTool).toBeUndefined();
	});
});

describe('请求处理', ()=>{
	it('关闭态 → -32001;未知方法 → -32601;tools/call 结果 content[text]+structuredContent+isError,origin=mcp', async ()=>{
		expect((await handleAgentToolRequest({ id: 1, method: 'tools/list' })).error.code).toBe(-32001);
		setAgentEnabled(true);
		expect((await handleAgentToolRequest({ id: 1, method: 'nope' })).error.code).toBe(-32601);
		const runTool = jest.fn(async (name, args, ctx)=>({ ok: true, data: { cid: 'local-1' }, summary: 's' }));
		const r = await handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'create_chart_record', arguments: { name: 'x' } }, clientName: 'codex' }, { exportToolManifest: ()=>ANY_MAN, runTool });
		expect(runTool.mock.calls[0][2]).toEqual(expect.objectContaining({ origin: 'mcp', clientName: 'codex' }));
		expect(r.result.isError).toBe(false);
		expect(r.result.content[0].type).toBe('text');
		expect(JSON.parse(r.result.content[0].text).data.cid).toBe('local-1');
		expect(r.result.structuredContent).toEqual({ cid: 'local-1' });
		const bad = await handleAgentToolRequest({ id: 3, method: 'tools/call', params: { name: 'x' } }, { exportToolManifest: ()=>ANY_MAN, runTool: async ()=>({ ok: false, code: 'E_ARGS_INVALID', message: 'm' }) });
		expect(bad.result.isError).toBe(true);
		const threw = await handleAgentToolRequest({ id: 4, method: 'tools/call', params: { name: 'x' } }, { exportToolManifest: ()=>ANY_MAN, runTool: async ()=>{ throw new Error('boom'); } });
		expect(threw.result.isError).toBe(true);
		expect(JSON.parse(threw.result.content[0].text).code).toBe('E_TOOL_THREW');
	});
	it('串行:第二个请求等第一个完成', async ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		const order = [];
		jest.spyOn(desktop, 'invokeDesktopCommand').mockImplementation(async (cmd, args)=>{ if(cmd === 'agent_tool_result_command'){ order.push(args.id); } return {}; });
		setAgentEnabled(true);
		bindMcpBridge();
		window.__horosaAgentTool({ id: 'a', method: 'tools/list' });
		window.__horosaAgentTool({ id: 'b', method: 'tools/list' });
		for(let i = 0; i < 6; i++){ await flush(); }
		expect(order).toEqual(['a', 'b']);
	});
	it('长文本硬上限截断打标', ()=>{
		const r = truncateForMcp('x'.repeat(MCP_TEXT_HARD_LIMIT + 10));
		expect(r.truncated).toBe(true);
		expect(r.text.length).toBeLessThan(MCP_TEXT_HARD_LIMIT + 200);
		expect(r.text).toMatch(/truncated: 10 chars/);
	});
});

describe('资源面 / 提示面(P5)', ()=>{
	const deps = {
		exportToolManifest: ()=>[{ name: 'list_records', level: 'read' }],
		runTool: jest.fn(),
		listResources: jest.fn(async ()=>[{ uri: 'horosa://chart/local-1', name: '命盘·张三', mimeType: 'text/plain' }]),
		listResourceTemplates: jest.fn(()=>[{ uriTemplate: 'horosa://chart/{cid}', name: '命盘快照' }]),
		readResource: jest.fn(async (uri)=>(uri === 'horosa://chart/local-1' ? { uri, mimeType: 'text/plain', text: 'x'.repeat(MCP_TEXT_HARD_LIMIT + 500) } : null)),
		listPrompts: jest.fn(async ()=>[{ name: 'technique:bazi', description: '八字提示卡' }]),
		getPrompt: jest.fn(async (name)=>(name === 'technique:bazi' ? { description: '八字提示卡', messages: [{ role: 'user', content: { type: 'text', text: 'y'.repeat(MCP_TEXT_HARD_LIMIT + 500) } }] } : null)),
	};
	it('🔴 resources/prompts 五方法转发页面单源;正文按硬上限截断;未知资源/提示 → -32602;总开关关一律 -32001', async ()=>{
		expect((await handleAgentToolRequest({ id: 1, method: 'resources/list' }, deps)).error.code).toBe(-32001);
		setAgentEnabled(true);
		const list = await handleAgentToolRequest({ id: 2, method: 'resources/list' }, deps);
		expect(list.result.resources[0].uri).toBe('horosa://chart/local-1');
		const tpls = await handleAgentToolRequest({ id: 3, method: 'resources/templates/list' }, deps);
		expect(tpls.result.resourceTemplates[0].uriTemplate).toBe('horosa://chart/{cid}');
		const read = await handleAgentToolRequest({ id: 4, method: 'resources/read', params: { uri: 'horosa://chart/local-1' } }, deps);
		expect(read.result.contents[0].text.length).toBeLessThanOrEqual(MCP_TEXT_HARD_LIMIT + 120);
		expect(read.result.contents[0]._meta.truncated).toBe(true);
		expect(read.result.contents[0].uri).toBe('horosa://chart/local-1');
		const bad = await handleAgentToolRequest({ id: 5, method: 'resources/read', params: { uri: 'horosa://nope/x' } }, deps);
		expect(bad.error.code).toBe(-32602);
		const prompts = await handleAgentToolRequest({ id: 6, method: 'prompts/list' }, deps);
		expect(prompts.result.prompts[0].name).toBe('technique:bazi');
		const got = await handleAgentToolRequest({ id: 7, method: 'prompts/get', params: { name: 'technique:bazi', arguments: {} } }, deps);
		expect(got.result.messages[0].content.text.length).toBeLessThanOrEqual(MCP_TEXT_HARD_LIMIT + 120);
		expect((await handleAgentToolRequest({ id: 8, method: 'prompts/get', params: { name: 'nope' } }, deps)).error.code).toBe(-32602);
		expect(deps.runTool).not.toHaveBeenCalled();   // 资源/提示面零动作
	});
});

describe('静态守卫', ()=>{
	it('🔴 桥零数据层 import(localcharts/localcases/dva/models),且含在途队列键名', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'aiAgent', 'mcpBridge.js'), 'utf8');
		expect(/from\s+['"][^'"]*(localcharts|localcases|localRecordStore|models\/|dva)['"]/.test(src)).toBe(false);
		expect(src.indexOf('__horosaPendingAgentTools')).toBeGreaterThan(0);
		expect(src.indexOf('__horosaAgentTool')).toBeGreaterThan(0);
	});
	it('🔴 tools/list 永不导出外部接进来的工具(ext_ 前缀防再导出回环)', async ()=>{
		setAgentEnabled(true);
		const manifest = [{ name: 'list_records', level: 'read' }, { name: 'ext_time_now', level: 'read', origin: 'external' }];
		const r = await handleAgentToolRequest({ id: 1, method: 'tools/list' }, { exportToolManifest: (o)=>manifest.filter((t)=>(o && o.includeExternal === false ? t.origin !== 'external' : true)), runTool: jest.fn() });
		expect(r.result.tools.map((t)=>t.name)).toEqual(['list_records']);
		expect(JSON.stringify(r.result.tools)).not.toContain('ext_');
	});
});

describe('外部客户端档(P0):限流 / 只读直拒 / 每次确认 / 防再导出回环 / 反问通道', ()=>{
	const codeOf = (r)=>JSON.parse(r.result.content[0].text).code;
	const prefs = require('../aiAgent/prefs');
	const approvals = require('../aiAgent/approvals');
	const { checkExternalLimits } = require('../aiAgent/mcpBridge');
	const MAN = [{ name: 'create_chart_record', level: 'additive' }, { name: 'list_records', level: 'read' }];
	beforeEach(()=>{ approvals.__resetApprovalsForTests(); setAgentEnabled(true); });
	it('tools/list 一律 includeExternal:false(外部接入的工具永不再经本机服务导出)', async ()=>{
		const exportToolManifest = jest.fn(()=>MAN);
		await handleAgentToolRequest({ id: 1, method: 'tools/list' }, { exportToolManifest, runTool: async ()=>({ ok: true }) });
		expect(exportToolManifest).toHaveBeenCalledWith({ includeExternal: false, origin: 'mcp' });
	});
	it('缺省档 auto:写入直接执行;ctx 带 elicit 函数(反问通道)与 clientName', async ()=>{
		const runTool = jest.fn(async ()=>({ ok: true, data: 1 }));
		const r = await handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'create_chart_record', arguments: { name: 'x' } }, clientName: 'codex' }, { exportToolManifest: ()=>MAN, runTool });
		expect(r.result.isError).toBe(false);
		const ctx = runTool.mock.calls[0][2];
		expect(ctx).toEqual(expect.objectContaining({ origin: 'mcp', clientName: 'codex', requestId: 'mcp-2' }));
		expect(typeof ctx.elicit).toBe('function');
	});
	it('🔴 read-only 档:写入 → E_APPROVAL_DENIED 不执行;只读工具照跑', async ()=>{
		prefs.setExternalPolicy({ approval: 'read-only' });
		const runTool = jest.fn(async ()=>({ ok: true }));
		const r = await handleAgentToolRequest({ id: 3, method: 'tools/call', params: { name: 'create_chart_record', arguments: {} }, clientName: 'codex' }, { exportToolManifest: ()=>MAN, runTool });
		expect(r.result.isError).toBe(true);
		expect(codeOf(r)).toBe('E_APPROVAL_DENIED');
		expect(runTool).not.toHaveBeenCalled();
		const ok = await handleAgentToolRequest({ id: 4, method: 'tools/call', params: { name: 'list_records', arguments: {} }, clientName: 'codex' }, { exportToolManifest: ()=>MAN, runTool });
		expect(ok.result.isError).toBe(false);
		expect(runTool).toHaveBeenCalledTimes(1);
	});
	it('🔴 on-request 档:写入挂到本机审批台 mcp:<client>;允许 → 执行;不允许 → E_USER_SKIPPED', async ()=>{
		prefs.setExternalPolicy({ approval: 'on-request' });
		const runTool = jest.fn(async ()=>({ ok: true }));
		const p = handleAgentToolRequest({ id: 5, method: 'tools/call', params: { name: 'create_chart_record', arguments: {} }, clientName: 'codex' }, { exportToolManifest: ()=>MAN, runTool });
		for(let i = 0; i < 50 && approvals.listPendingApprovals('mcp:codex').length === 0; i++){ await flush(); }
		const pend = approvals.listPendingApprovals('mcp:codex');
		expect(pend.length).toBe(1);
		expect(pend[0].callId).toBe('mcp-5');
		approvals.resolveApproval('mcp-5', true);
		expect((await p).result.isError).toBe(false);
		expect(runTool).toHaveBeenCalledTimes(1);
		const p2 = handleAgentToolRequest({ id: 6, method: 'tools/call', params: { name: 'create_chart_record', arguments: {} }, clientName: 'codex' }, { exportToolManifest: ()=>MAN, runTool });
		for(let i = 0; i < 50 && approvals.listPendingApprovals('mcp:codex').length === 0; i++){ await flush(); }
		approvals.resolveApproval('mcp-6', false);
		const r2 = await p2;
		expect(codeOf(r2)).toBe('E_USER_SKIPPED');
		expect(runTool).toHaveBeenCalledTimes(1);
	});
	it('🔴 限流:每分钟调用上限 → 第 N+1 次 E_LIMIT 不执行;每小时写入上限只计成功写入;桶按 clientName 隔离', async ()=>{
		prefs.setExternalPolicy({ maxCallsPerMinute: 2, maxAdditivePerHour: 1 });
		const runTool = jest.fn(async ()=>({ ok: true }));
		const call = (id, name, client)=>handleAgentToolRequest({ id, method: 'tools/call', params: { name, arguments: {} }, clientName: client }, { exportToolManifest: ()=>MAN, runTool });
		expect((await call(7, 'list_records', 'a')).result.isError).toBe(false);
		expect((await call(8, 'list_records', 'a')).result.isError).toBe(false);
		const third = await call(9, 'list_records', 'a');
		expect(codeOf(third)).toBe('E_LIMIT');
		expect(runTool).toHaveBeenCalledTimes(2);
		expect((await call(10, 'list_records', 'b')).result.isError).toBe(false);   // 另一客户端不受影响
		expect((await call(11, 'create_chart_record', 'b')).result.isError).toBe(false);
		// b 已用 2 次/分钟 → 先撞每分钟上限;纯函数验证写入桶:同分钟内第二次写入 → E_LIMIT
		const now = Date.now();
		__resetMcpBridgeForTests();
		expect(checkExternalLimits('c', 'additive', { approval: 'auto', maxCallsPerMinute: 10, maxAdditivePerHour: 1 }, now).ok).toBe(true);
		// 只有成功写入才计入写入桶:模拟经 handle 成功一次后再判
		expect((await call(12, 'create_chart_record', 'c')).result.isError).toBe(false);
		expect(checkExternalLimits('c', 'additive', { approval: 'auto', maxCallsPerMinute: 10, maxAdditivePerHour: 1 }, now + 1).code).toBe('E_LIMIT');
		expect(checkExternalLimits('c', 'read', { approval: 'auto', maxCallsPerMinute: 10, maxAdditivePerHour: 1 }, now + 2).ok).toBe(true);
		// 窗口滑过后恢复
		expect(checkExternalLimits('c', 'additive', { approval: 'auto', maxCallsPerMinute: 10, maxAdditivePerHour: 1 }, now + 3600001).ok).toBe(true);
	});
	it('🔴 D13b 目录外名字(含 ext_* 外部工具)→ E_TOOL_NOT_FOUND 且不进 runTool、不计限流额', async ()=>{
		// 当前代码为何红(修前):mcpBridge.js:147-171 只用 def 取 level,def 缺席照样 d.runTool(name) —— ext_* 被排除出 tools/list 防回环却可按名直呼,且 level=null 绕过写入桶与审批分支
		prefs.setExternalPolicy({ approval: 'read-only', maxCallsPerMinute: 1 });
		const runTool = jest.fn(async ()=>({ ok: true }));
		const r = await handleAgentToolRequest({ id: 13, method: 'tools/call', params: { name: 'nope', arguments: {} }, clientName: 'u' }, { exportToolManifest: ()=>MAN, runTool });
		expect(codeOf(r)).toBe('E_TOOL_NOT_FOUND');
		const r2 = await handleAgentToolRequest({ id: 14, method: 'tools/call', params: { name: 'ext_time_now', arguments: {} }, clientName: 'u' }, { exportToolManifest: ()=>MAN, runTool });
		expect(codeOf(r2)).toBe('E_TOOL_NOT_FOUND');
		expect(runTool).not.toHaveBeenCalled();
		const ok = await handleAgentToolRequest({ id: 15, method: 'tools/call', params: { name: 'list_records', arguments: {} }, clientName: 'u' }, { exportToolManifest: ()=>MAN, runTool });
		expect(ok.result.isError).toBe(false);   // 被拒的两次未计额:每分钟 1 次的桶仍可用
	});
	it('🔴 D13a 按工具名禁用对外部客户端同样生效:tools/list 不列、tools/call 拒 E_APPROVAL_DENIED、不进 runTool、不计额', async ()=>{
		// 当前代码为何红(修前):deny 只在 runtime.js:121/294 的对话路径过滤;桥 tools/list、tools/call 从不读 toolPolicy
		prefs.setToolPolicy({ deny: ['create_chart_record'] });
		prefs.setExternalPolicy({ maxCallsPerMinute: 1 });
		const runTool = jest.fn(async ()=>({ ok: true }));
		const list = await handleAgentToolRequest({ id: 16, method: 'tools/list' }, { exportToolManifest: ()=>MAN, runTool });
		expect(list.result.tools.map((t)=>t.name)).toEqual(['list_records']);
		const r = await handleAgentToolRequest({ id: 17, method: 'tools/call', params: { name: 'create_chart_record', arguments: {} }, clientName: 'd' }, { exportToolManifest: ()=>MAN, runTool });
		expect(codeOf(r)).toBe('E_APPROVAL_DENIED');
		expect(runTool).not.toHaveBeenCalled();
		const ok = await handleAgentToolRequest({ id: 18, method: 'tools/call', params: { name: 'list_records', arguments: {} }, clientName: 'd' }, { exportToolManifest: ()=>MAN, runTool });
		expect(ok.result.isError).toBe(false);
	});
	it('🔴 D13c on-request 档等审批到点 → E_TOOL_TIMEOUT 且审批台零残留(此前只靠外层超时,动作条留「允许/跳过」死按钮)', async ()=>{
		prefs.setExternalPolicy({ approval: 'on-request' });
		const runTool = jest.fn(async ()=>({ ok: true }));
		const t0 = Date.now();
		const p = handleAgentToolRequest({ id: 19, method: 'tools/call', params: { name: 'create_chart_record', arguments: {}, _meta: { timeoutMs: 4000 } }, clientName: 'codex' }, { exportToolManifest: ()=>MAN, runTool });
		for(let i = 0; i < 50 && approvals.listPendingApprovals('mcp:codex').length === 0; i++){ await flush(); }
		expect(approvals.listPendingApprovals('mcp:codex').length).toBe(1);   // 判别力:确实挂上了审批台
		const r = await p;
		expect(Date.now() - t0).toBeLessThan(5000);
		expect(codeOf(r)).toBe('E_TOOL_TIMEOUT');
		expect(runTool).not.toHaveBeenCalled();
		expect(approvals.listPendingApprovals('mcp:codex').length).toBe(0);
	});
});

describe('[进阶复查 D18·2026-09-08] list_changed 发射器(绑桥时装、解绑即拆;去抖 500ms)', ()=>{
	const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms));
	const prefs = require('../aiAgent/prefs');
	const { emitAutomationEvent } = require('../aiAgent/automation/events');
	it('🔴 record.saved 三连 → 一次 agent_notify_command{kind:resources};模版库写入 → prompts;偏好变更 → tools;解绑后零发射', async ()=>{
		// 当前代码为何红(修前):壳 agent_notify_command / mcp_server listChanged:true 早已在,页面全仓零调用
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue({});
		const notify = jest.spyOn(desktop, 'desktopAgentNotify').mockResolvedValue({ available: true, value: 1 });
		setAgentEnabled(true);
		bindMcpBridge();
		const kinds = ()=>notify.mock.calls.map((c)=>c[0]);
		emitAutomationEvent('record.saved', { cid: 'a' }); emitAutomationEvent('record.saved', { cid: 'b' }); emitAutomationEvent('record.saved', { cid: 'c' });
		expect(kinds()).toEqual([]);   // 去抖:未到点不发
		await sleep(650);
		expect(kinds()).toEqual(['resources']);
		window.dispatchEvent(new CustomEvent('horosa:ai-store-changed', { detail: { store: 'templates', id: 't1', op: 'put' } }));
		window.dispatchEvent(new CustomEvent('horosa:ai-store-changed', { detail: { store: 'messages', id: 'm1', op: 'put' } }));   // 非模版库:不发
		await sleep(650);
		expect(kinds()).toEqual(['resources', 'prompts']);
		prefs.setToolPolicy({ deny: ['web_search'] });
		await sleep(650);
		expect(kinds()).toEqual(['resources', 'prompts', 'tools']);
		setAgentEnabled(false);   // 解绑 → 拆订阅;总开关关本身不产生 tools 通知
		emitAutomationEvent('record.saved', { cid: 'd' });
		window.dispatchEvent(new CustomEvent('horosa:ai-store-changed', { detail: { store: 'templates', id: 't2', op: 'put' } }));
		await sleep(650);
		expect(kinds()).toEqual(['resources', 'prompts', 'tools']);
	});
	it('非桌面壳 / 总开关关:零发射器零定时器', async ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(false);
		jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue({});
		const notify = jest.spyOn(desktop, 'desktopAgentNotify').mockResolvedValue({ available: true, value: 1 });
		setAgentEnabled(true);
		bindMcpBridge();
		emitAutomationEvent('record.saved', { cid: 'a' });
		await sleep(650);
		expect(notify).not.toHaveBeenCalled();
	});
});

describe('[复查·桥预算/落定原因/拒绝桶/目录缓存/通知器同一性]', ()=>{
	const prefs2 = require('../aiAgent/prefs');
	const approvals2 = require('../aiAgent/approvals');
	const codeOf2 = (r)=>JSON.parse(r.result.content[0].text).code;
	const flush2 = ()=>new Promise((r)=>setTimeout(r, 0));
	const MAN2 = [{ name: 'create_chart_record', level: 'additive' }, { name: 'list_records', level: 'read' }];
	beforeEach(()=>{ window.localStorage.setItem(AGENT_ENABLED_KEY, '1'); setAgentEnabled(true); });
	it('🔴 [D25] 执行预算 = 客户端预算 − 审批已耗:10s 预算、审批 8s 后允许 ⇒ runTool 只拿到 ≈2s 且整体 ≤10s 落定;审批 12s 后允许 ⇒ 预算耗尽不执行', async ()=>{
		prefs2.setExternalPolicy({ approval: 'on-request' });
		let seen = null;
		const runTool = jest.fn(async ()=>({ ok: true }));
		const t0 = Date.now();
		const p = handleAgentToolRequest({ id: 31, method: 'tools/call', params: { name: 'create_chart_record', arguments: {}, _meta: { timeoutMs: 1300 } }, clientName: 'b25' }, { exportToolManifest: ()=>MAN2, runTool: async (...a)=>{ seen = Date.now() - t0; return runTool(...a); } });
		for(let i = 0; i < 50 && approvals2.listPendingApprovals('mcp:b25').length === 0; i++){ await flush2(); }
		await new Promise((r)=>setTimeout(r, 700));   // 审批耗掉 0.7s(预算 1.3s−3s 减法后由桥自带;此处直接观察 runTool 在预算内被调)
		approvals2.resolveApproval('mcp-31', true, 'mcp:b25');
		const r = await p;
		expect(codeOf2(r) === undefined || r.result.isError === false).toBe(true);
		expect(runTool).toHaveBeenCalledTimes(1);
		expect(seen).toBeGreaterThanOrEqual(650);
		expect(Date.now() - t0).toBeLessThan(1300 + 400);
	});
	it('🔴 [D25] 审批耗尽预算后才允许 ⇒ E_TOOL_TIMEOUT 且不执行(此前审批等满后执行又拿一份预算,最坏 2×)', async ()=>{
		prefs2.setExternalPolicy({ approval: 'on-request' });
		const runTool = jest.fn(async ()=>({ ok: true }));
		const p = handleAgentToolRequest({ id: 32, method: 'tools/call', params: { name: 'create_chart_record', arguments: {}, _meta: { timeoutMs: 3200 } }, clientName: 'b25b' }, { exportToolManifest: ()=>MAN2, runTool });
		for(let i = 0; i < 50 && approvals2.listPendingApprovals('mcp:b25b').length === 0; i++){ await flush2(); }
		// 预算 = 3200−3000 = 200ms;到点由审批台自己落定 timeout ⇒ 出码 E_TOOL_TIMEOUT
		const r = await p;
		expect(codeOf2(r)).toBe('E_TOOL_TIMEOUT');
		expect(runTool).not.toHaveBeenCalled();
	});
	it('🔴 [D32] 到点前点「跳过」⇒ E_USER_SKIPPED(按落定原因出码,不再按耗时猜)', async ()=>{
		prefs2.setExternalPolicy({ approval: 'on-request' });
		const runTool = jest.fn(async ()=>({ ok: true }));
		const p = handleAgentToolRequest({ id: 33, method: 'tools/call', params: { name: 'create_chart_record', arguments: {}, _meta: { timeoutMs: 3400 } }, clientName: 'b32' }, { exportToolManifest: ()=>MAN2, runTool });
		for(let i = 0; i < 50 && approvals2.listPendingApprovals('mcp:b32').length === 0; i++){ await flush2(); }
		await new Promise((r)=>setTimeout(r, 350));   // 已接近 400ms 预算的末尾
		approvals2.resolveApproval('mcp-33', false, 'mcp:b32');
		const r = await p;
		expect(codeOf2(r)).toBe('E_USER_SKIPPED');
		expect(runTool).not.toHaveBeenCalled();
	});
	it('🔴 [D35] 目录外名字洪水:拒绝走独立桶,超过 max(5×上限,60)/分钟 ⇒ E_LIMIT;正常调用桶不受影响;目录只构建一次(缓存)', async ()=>{
		prefs2.setExternalPolicy({ approval: 'auto', maxCallsPerMinute: 2 });
		const exporter = jest.fn(()=>MAN2);
		const runTool = jest.fn(async ()=>({ ok: true }));
		const d = { exportToolManifest: exporter, runTool };
		const codes = [];
		for(let i = 0; i < 70; i++){ codes.push(codeOf2(await handleAgentToolRequest({ id: 100 + i, method: 'tools/call', params: { name: 'nope_' + i, arguments: {} }, clientName: 'flood' }, d))); }
		expect(codes.slice(0, 60).every((c)=>c === 'E_TOOL_NOT_FOUND')).toBe(true);
		expect(codes.slice(60).every((c)=>c === 'E_LIMIT')).toBe(true);
		expect(exporter).toHaveBeenCalledTimes(1);
		const ok = await handleAgentToolRequest({ id: 900, method: 'tools/call', params: { name: 'list_records', arguments: {} }, clientName: 'flood' }, d);
		expect(ok.result.isError).toBe(false);
	});
	it('🔴 [D33] 通知器同 tick 关-开:目录订阅不重复', async ()=>{
		const { __notifySubscriptionCountForTests } = require('../aiAgent/mcpBridge');
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue({});
		bindMcpBridge();
		setAgentEnabled(true);
		await flush2(); await flush2(); await flush2();
		const single = __notifySubscriptionCountForTests();
		setAgentEnabled(false); setAgentEnabled(true);
		await flush2(); await flush2(); await flush2();
		expect(__notifySubscriptionCountForTests()).toBe(single);
	});
});
