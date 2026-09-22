// 多技法编排(C7)钩子合同:子开关关 → /编排 只提示零请求;开 → 规划(planner 槽 strict)→ 两个只读子 Turn(系统只挂该技法层;行动能力开时 tools 只含 read 级)→ 综合(final 槽 strict)
// → 一条 assistant 消息:content=综合稿+分歧标注、orchestration.subTurns 两份 done、无 agentTrace(子 Turn trace 不回放);用户消息带检查点;停止令子任务一起停。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { useChatAssist } from '../../components/aianalysis/chat/useChatAssist';
import { encodeModelSelection } from '../aiAnalysisProviders';
import { setAgentEnabled, setOrchestrateEnabled } from '../aiAgent/prefs';
import { recordToolCapability } from '../aiAgent/caps';
import { ORCH_PLAN_TAG, ORCH_SYNTH_TAG, ORCH_SUBTASK_TAG, ORCH_DISAGREE_TITLE } from '../aiAgent/orchestrator';

const streamCalls = [];
jest.mock('../../services/aianalysis', ()=>({
	requestAIAnalysisChatStream: jest.fn(async (values, handlers)=>{ streamCalls.push(values); const sys = values.messages[0].content; const tag = sys.indexOf('bazi') >= 0 ? '八字' : '紫微'; handlers.onEvent({ type: 'delta', json: { delta: `${tag}子回答` } }); handlers.onEvent({ type: 'usage', json: { input_tokens: 10, output_tokens: 5 } }); handlers.onEvent({ type: 'done', json: { finish_reason: 'stop' } }); }),
	requestAIAnalysisChat: jest.fn(async (values)=>{
		const sys = values.messages[0].content;
		if(sys.indexOf('【多技法规划】') === 0){ return { Result: { content: JSON.stringify({ subtasks: [{ technique: 'bazi', question: '八字看时机', why: 'a' }, { technique: 'ziwei', question: '紫微看事业宫', why: 'b' }], note: '两家并看' }) } }; }
		if(sys.indexOf('【多技法综合】') === 0){ return { Result: { content: JSON.stringify({ answer: '综合:今年宜稳', disagreements: [{ topic: '时机', positions: [{ technique: 'bazi', claim: '明年', basis: '流年' }, { technique: 'ziwei', claim: '下半年', basis: '化禄' }], note: '以八字为主' }], confidence: 'medium' }) } }; }
		return { Result: { content: '{}' } };
	}),
}));
jest.mock('../aiAnalysisStore', ()=>({ ...jest.requireActual('../aiAnalysisStore'), saveConversationMessage: jest.fn(async (m)=>({ id: m.id || `msg-${Math.random().toString(36).slice(2, 8)}`, ...m })) }));
jest.mock('../aiAgent/goalRunner', ()=>({ ...jest.requireActual('../aiAgent/goalRunner'), buildHeadlessSystemPrompt: jest.fn(async ({ techniqueKeys })=>({ systemPrompt: `【子系统】${techniqueKeys.join(',')}`, meta: { layerKeys: ['system', 'source', `technique:${techniqueKeys[0]}`] } })) }));
const { requestAIAnalysisChat } = require('../../services/aianalysis');
const { saveConversationMessage } = require('../aiAnalysisStore');

const pA = { id: 'p1', name: 'A', providerType: 'openai', apiKey: 'k', baseUrl: 'http://x', providerOptions: {}, enabled: true, chatModelIds: ['gpt-x'] };
const flush = ()=>new Promise((r)=>setTimeout(r, 40));
let host; let api = null;
function Harness({ deps }){ api = useChatAssist(deps); return null; }
function mkDeps(extra){
	let messages = extra.messages || [];
	const deps = { prompt: '', setPrompt: jest.fn(), sending: false, bundles: [], sources: [], providerProfiles: [pA], activeProviderProfile: pA, modelSelection: encodeModelSelection('p1', 'gpt-x'), activeConversation: { id: 'conv-1' }, activeConversationId: 'conv-1', handleSend: jest.fn(),
		activeSource: { id: 'local-1', title: '张三', sourceType: 'chart', record: { name: '张三' } }, selectedTechniqueKeys: ['bazi', 'ziwei'], sessionSystemPrompt: '',
		ensureConversationRecord: jest.fn(async ()=>({ id: 'conv-1' })), buildResolvedPrompt: jest.fn(async ()=>({ systemPrompt: '' })), ...extra };
	deps.messages = messages;
	deps.setMessages = jest.fn((fn)=>{ messages = typeof fn === 'function' ? fn(messages) : fn; deps.messages = messages; });
	return deps;
}
beforeEach(()=>{ window.localStorage.clear(); streamCalls.length = 0; saveConversationMessage.mockClear(); requestAIAnalysisChat.mockClear(); host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

it('🔴 子开关关(缺省):/编排 只提示,零请求零消息', async ()=>{
	const deps = mkDeps({});
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/编排 今年适合创业吗')).toBe(true);
	await flush();
	expect(requestAIAnalysisChat).toHaveBeenCalledTimes(0);
	expect(streamCalls.length).toBe(0);
	expect(saveConversationMessage).toHaveBeenCalledTimes(0);
	expect(deps.ensureConversationRecord).toHaveBeenCalledTimes(0);
});

it('🔴 开:规划 strict → 两个只读子 Turn(系统只挂该技法层;行动能力开 → tools 只含 read 级)→ 综合 strict → content 综合稿+分歧标注;orchestration 落消息;无 agentTrace;用户消息带检查点', async ()=>{
	setOrchestrateEnabled(true); setAgentEnabled(true); recordToolCapability('p1', 'gpt-x', true);
	const deps = mkDeps({});
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/编排 今年适合创业吗')).toBe(true);
	for(let i = 0; i < 6; i += 1){ await flush(); }
	expect(deps.ensureConversationRecord).toHaveBeenCalledWith('今年适合创业吗', pA, 'gpt-x');
	// 规划 + 综合 两次非流式 strict
	expect(requestAIAnalysisChat).toHaveBeenCalledTimes(2);
	const planReq = requestAIAnalysisChat.mock.calls[0][0];
	expect(planReq.messages[0].content.indexOf(ORCH_PLAN_TAG)).toBe(0);
	expect(planReq.messages[0].content).toContain('bazi(八字)');
	expect(planReq.providerOptions.response_format.type).toBe('json_schema');
	expect(planReq.providerOptions.response_format.json_schema.name).toBe('orchestration_plan');
	const synReq = requestAIAnalysisChat.mock.calls[1][0];
	expect(synReq.messages[0].content.indexOf(ORCH_SYNTH_TAG)).toBe(0);
	expect(synReq.messages[1].content).toContain('八字子回答');
	expect(synReq.providerOptions.response_format.json_schema.name).toBe('orchestration_synthesis');
	// 两个子 Turn:各自只挂该技法层;user 是子任务提示;tools 只含 read 级
	expect(streamCalls.length).toBe(2);
	// 行动能力开 → 运行时在 system 前拼【助手行动守则】(与主线同构);末尾必须是只挂该技法层的无头 system
	const systems = streamCalls.map((v)=>v.messages[0].content).sort();
	expect(systems.map((s)=>s.slice(s.indexOf('【子系统】')))).toEqual(['【子系统】bazi', '【子系统】ziwei']);
	systems.forEach((s)=>expect(s.indexOf('【助手行动守则】')).toBe(0));
	streamCalls.forEach((v)=>{
		expect(v.messages.length).toBe(2);
		expect(v.messages[1].content.indexOf(ORCH_SUBTASK_TAG)).toBe(0);
		expect(v.messages[1].content).toContain('总问题:今年适合创业吗');
		expect(Array.isArray(v.tools) && v.tools.length > 0).toBe(true);
		expect(JSON.stringify(v.tools)).not.toMatch(/create_|set_settings|schedule_task|create_goal_task/);
	});
	const saved = saveConversationMessage.mock.calls.map((c)=>c[0]);
	expect(saved[0].role).toBe('user'); expect(saved[0].checkpoint).toBeDefined(); expect(saved[0].content).toBe('今年适合创业吗');
	const finalMsg = saved[saved.length - 1];
	expect(finalMsg.role).toBe('assistant');
	expect(finalMsg.streamStatus).toBe('done');
	expect(finalMsg.agentTrace).toBeUndefined();
	expect(finalMsg.content).toContain('综合:今年宜稳');
	expect(finalMsg.content).toContain(`## ${ORCH_DISAGREE_TITLE}`);
	expect(finalMsg.content).toContain('   - 八字:明年(依据:流年)');
	expect(finalMsg.orchestration.status).toBe('done');
	expect(finalMsg.orchestration.plan.subtasks.map((s)=>s.technique)).toEqual(['bazi', 'ziwei']);
	expect(finalMsg.orchestration.subTurns.map((s)=>s.status)).toEqual(['done', 'done']);
	expect(finalMsg.orchestration.subTurns.map((s)=>s.text).sort()).toEqual(['八字子回答', '紫微子回答']);
	expect(finalMsg.orchestration.subTurns[0].prompt).toBeUndefined();
	expect(finalMsg.orchestration.requests).toEqual({ plan: 1, subtasks: 2, synthesis: 1 });
	expect(finalMsg.orchestration.synthesis.confidence).toBe('medium');
	expect(finalMsg.usage.subTurns).toBe(2);
	expect(finalMsg.usage.input_tokens).toBe(20);
	// 面板插座:有 orchestration 才渲染
	expect(api.orchestrationPanel(finalMsg)).not.toBe(null);
	expect(api.orchestrationPanel({ id: 'x', role: 'assistant', content: 'plain' })).toBe(null);
	// 历史只带正文(子 Turn 不回放)
	const hist = api.mainline(deps.messages);
	expect(hist.map((m)=>m.role)).toEqual(['user', 'assistant']);
});

it('开但无挂载源 → 命令前置门拦下零请求;无技法选择 → 候选回落该源类型全部技法进规划提示', async ()=>{
	setOrchestrateEnabled(true);
	const deps = mkDeps({ activeSource: null });
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/编排 今年适合创业吗')).toBe(true);
	await flush();
	expect(requestAIAnalysisChat).toHaveBeenCalledTimes(0);
	act(()=>{ ReactDOM.unmountComponentAtNode(host); });
	const deps2 = mkDeps({ selectedTechniqueKeys: [] });
	act(()=>{ ReactDOM.render(<Harness deps={deps2} />, host); });
	expect(api.interceptSend('/编排 今年适合创业吗')).toBe(true);
	for(let i = 0; i < 6; i += 1){ await flush(); }
	expect(requestAIAnalysisChat.mock.calls.length).toBeGreaterThanOrEqual(1);
	const planReq = requestAIAnalysisChat.mock.calls[0][0];
	expect(planReq.messages[0].content).toContain('ziwei(');
	expect(planReq.messages[0].content).toContain('bazi(');
});

// ---- [进阶审计 D1] 规划/子任务/综合三槽参数:此前三处硬编码 applyThinkingLevel(...,'off'),写了键从不生效 ----
it('🔴 [D1] 规划槽温度进规划请求、综合走终稿槽温度、子任务槽 max_tokens 进每个子 Turn 流;槽空孪生皆无', async ()=>{
	const { writeRouteOptions } = require('../aiModelRouting');
	const arm = ()=>{ setOrchestrateEnabled(true); setAgentEnabled(true); recordToolCapability('p1', 'gpt-x', true); };
	arm();
	writeRouteOptions({ planner: { temperature: 0.4 }, subagent: { maxTokens: 777 }, final: { temperature: 0.6 } });
	let deps = mkDeps({});
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/编排 今年适合创业吗')).toBe(true);
	for(let i = 0; i < 6; i += 1){ await flush(); }
	expect(requestAIAnalysisChat.mock.calls.length).toBe(2);
	const planReq = requestAIAnalysisChat.mock.calls[0][0];
	const synReq = requestAIAnalysisChat.mock.calls[1][0];
	expect(planReq.messages[0].content.indexOf(ORCH_PLAN_TAG)).toBe(0);
	expect(synReq.messages[0].content.indexOf(ORCH_SYNTH_TAG)).toBe(0);
	expect(planReq.providerOptions.temperature).toBe(0.4);
	expect(planReq.providerOptions.max_tokens).toBeUndefined();
	expect(synReq.providerOptions.temperature).toBe(0.6);
	expect(streamCalls.length).toBeGreaterThanOrEqual(2);
	streamCalls.forEach((v)=>{ expect(v.providerOptions.max_tokens).toBe(777); expect(v.providerOptions.temperature).toBeUndefined(); });
	// 孪生:清键(重新武装开关)→ 三处皆无
	act(()=>{ ReactDOM.unmountComponentAtNode(host); });
	window.localStorage.clear(); arm();
	requestAIAnalysisChat.mockClear(); streamCalls.length = 0; saveConversationMessage.mockClear();
	deps = mkDeps({});
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/编排 今年适合创业吗')).toBe(true);
	for(let i = 0; i < 6; i += 1){ await flush(); }
	expect(requestAIAnalysisChat.mock.calls[0][0].providerOptions.temperature).toBeUndefined();
	expect(requestAIAnalysisChat.mock.calls[1][0].providerOptions.temperature).toBeUndefined();
	streamCalls.forEach((v)=>{ expect(v.providerOptions.max_tokens).toBeUndefined(); });
});
