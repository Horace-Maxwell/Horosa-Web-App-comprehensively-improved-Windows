// [批三③] 无头出口合同:origins 合同(注册校验/目录按来源/直呼其名拒)· 缺省关不进任何目录 · 开=只在 origin:'mcp' 目录 · 只读注册表视图拒写入工具 · 内存 deps 零落库 · 在途上限 1 · 桥 tools/list 带 origin。
import { registerBuiltinTools } from '../aiTools';
import { registerTool, runTool, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled, setAgentApprovalMode, setHeadlessEnabled, AGENT_HEADLESS_KEY } from '../aiAgent/prefs';
import { readOnlyRegistryView, memoryConversationDeps, __resetHeadlessForTests, HEADLESS_INFLIGHT_MAX } from '../aiTools/tools/runAnalysis';
import * as registry from '../aiTools/registry';
import { AI_ANALYSIS_STORES, listStoreRecords, clearStore } from '../aiAnalysisStore';
import { recordToolCapability } from '../aiAgent/caps';
import { fakeStreamScript } from './helpers/agentFakes';
import { STORAGE_KEY_REGISTRY } from '../storageKeyRegistry';

const profile = { id: 'p1', name: 'P', providerType: 'openai', protocolFamily: 'openai', baseUrl: 'http://x', apiKey: 'k', providerOptions: {} };
beforeEach(async ()=>{ window.localStorage.clear(); __resetToolsForTests(); __resetHeadlessForTests(); registerBuiltinTools(); setAgentEnabled(true); setAgentApprovalMode('never'); recordToolCapability('p1', 'm', true); await clearStore(AI_ANALYSIS_STORES.conversations); await clearStore(AI_ANALYSIS_STORES.messages); });

it('origins 合同:非法值拒注册;带 origins 的工具只在其来源目录里;别的来源直呼其名 → E_TOOL_DISABLED', async ()=>{
	expect(()=>registerTool({ name: 'x_only_goal', level: 'read', origins: ['bogus'], description: '仅当用户明确要求时调用', inputSchema: { type: 'object', additionalProperties: false }, run: async ()=>({ ok: true }) })).toThrow(/origins/);
	registerTool({ name: 'x_only_goal', level: 'read', origins: ['goal'], description: '仅当用户明确要求时调用', inputSchema: { type: 'object', additionalProperties: false }, run: async ()=>({ ok: true, data: 1 }) });
	expect(exportToolManifest().some((t)=>t.name === 'x_only_goal')).toBe(false);
	expect(exportToolManifest({ origin: 'goal' }).some((t)=>t.name === 'x_only_goal')).toBe(true);
	const r = await runTool('x_only_goal', {}, { origin: 'in-app' });
	expect(r.code).toBe('E_TOOL_DISABLED');
	expect((await runTool('x_only_goal', {}, { origin: 'goal' })).ok).toBe(true);
});

it('缺省关:键不存在、任何来源目录都没有 run_analysis;开=只在 mcp 目录;页面内直呼 → E_TOOL_DISABLED', async ()=>{
	expect(window.localStorage.getItem(AGENT_HEADLESS_KEY)).toBe(null);
	expect(exportToolManifest({ origin: 'mcp' }).some((t)=>t.name === 'run_analysis')).toBe(false);
	setHeadlessEnabled(true);
	expect(exportToolManifest().some((t)=>t.name === 'run_analysis')).toBe(false);
	expect(exportToolManifest({ origin: 'mcp', includeExternal: false }).some((t)=>t.name === 'run_analysis')).toBe(true);
	expect((await runTool('run_analysis', { question: 'q' }, { origin: 'in-app' })).code).toBe('E_TOOL_DISABLED');
	expect(STORAGE_KEY_REGISTRY.some((r)=>r.key === AGENT_HEADLESS_KEY)).toBe(true);
});

it('只读视图:目录只列 read 级且不含自己;runTool 拒写入工具;内存 deps 不落库', async ()=>{
	setHeadlessEnabled(true);
	const view = readOnlyRegistryView(registry);
	const names = view.exportToolManifest().map((t)=>t.name);
	expect(names).toContain('get_current_context');
	expect(names).not.toContain('create_chart_record');
	expect(names).not.toContain('run_analysis');
	expect(view.getTool('create_chart_record')).toBe(null);
	const denied = await view.runTool('create_chart_record', { name: 'x', birth: '1990-01-01 08:00', place: '北京' }, {});
	expect(denied.code).toBe('E_APPROVAL_DENIED');
	const mem = memoryConversationDeps();
	const a = await mem.saveConversationMessage({ conversationId: 'c', role: 'user', content: 'hi' });
	await mem.saveConversationMessage({ ...a, content: 'hi2' });
	expect((await mem.listConversationMessages()).map((m)=>m.content)).toEqual(['hi2']);
});

it('经 mcp 来源跑一次:假流回文本 → 只回 content/usage/model/rounds;会话/消息零落库;在途上限 1 → 第二个并发 E_LIMIT', async ()=>{
	setHeadlessEnabled(true);
	let release; const gate = new Promise((r)=>{ release = r; });
	const stream = fakeStreamScript([[{ hang: gate }, { text: '无头答案' }]]);
	const p1 = runTool('run_analysis', { question: '今年事业如何' }, { origin: 'mcp', headlessDeps: { resolved: { profile, model: 'm' }, requestAIAnalysisChatStream: stream } });
	await new Promise((r)=>setTimeout(r, 20));
	const p2 = await runTool('run_analysis', { question: '第二个' }, { origin: 'mcp', headlessDeps: { resolved: { profile, model: 'm' }, requestAIAnalysisChatStream: stream } });
	expect(p2.code).toBe('E_LIMIT');
	expect(HEADLESS_INFLIGHT_MAX).toBe(1);
	release();
	const r1 = await p1;
	expect(r1.ok).toBe(true);
	expect(r1.data.content).toBe('无头答案');
	expect(r1.data.model).toBe('m');
	expect(r1.data.rounds).toBeGreaterThanOrEqual(1);
	expect((await listStoreRecords(AI_ANALYSIS_STORES.conversations)).length).toBe(0);
	expect((await listStoreRecords(AI_ANALYSIS_STORES.messages)).length).toBe(0);
	// 用完即释放:再来一次不再 E_LIMIT
	const r3 = await runTool('run_analysis', { question: '再问' }, { origin: 'mcp', headlessDeps: { resolved: { profile, model: 'm' }, requestAIAnalysisChatStream: fakeStreamScript([[{ text: 'ok' }]]) } });
	expect(r3.ok).toBe(true);
});
