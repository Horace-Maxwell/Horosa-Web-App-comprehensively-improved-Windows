// run_analysis 多模型对比(models)/ 审阅(reviewModel)/ 思考档 / 资料(数据围栏层)/ 模版(发送层同一套变量渲染)。
jest.mock('../aiAgent/goalRunner', ()=>({
	resolveHeadlessProfile: jest.fn(async (spec)=>({ profile: { id: 'p1', providerType: 'openai' }, model: spec && spec.modelSelection ? spec.modelSelection.split('::')[1] : 'gpt-a' })),
	runHeadlessTurn: jest.fn(async ({ model, userText })=>({ content: `${model} 答:${`${userText}`.slice(0, 12)}`, usage: { total: 3 }, trace: { rounds: [{ toolCalls: [], results: [] }] } })),
}));
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled, setHeadlessEnabled } from '../aiAgent/prefs';
import { AI_ANALYSIS_STORES, putStoreRecord } from '../aiAnalysisStore';
import { runHeadlessTurn } from '../aiAgent/goalRunner';
import { __resetHeadlessForTests } from '../aiTools/tools/runAnalysis';

const ctx = ()=>({ origin: 'mcp', requestId: 'r6b', clientName: 'codex' });
beforeEach(async ()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetHeadlessForTests();
	setAgentEnabled(true); setHeadlessEnabled(true);
	registerBuiltinTools();
	runHeadlessTurn.mockClear();
	await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, { id: 'p1', name: '主力', providerType: 'openai', apiKey: 'sk-x', chatModelIds: ['gpt-a', 'gpt-b', 'gpt-c'], enabled: true }, 'provider');
});
afterEach(()=>{ setAgentEnabled(false); setHeadlessEnabled(false); });

test('多模型对比:models 2-3 个分别作答,回 answers[];与 model 二选一;清单外的模型拒', async ()=>{
	const r = await runTool('run_analysis', { question: '今年事业如何', models: ['p1::gpt-a', 'p1::gpt-b'] }, ctx());
	expect(r.ok).toBe(true);
	expect(r.data.answers.map((a)=>a.model)).toEqual(['gpt-a', 'gpt-b']);
	expect(r.data.content).toContain('gpt-a 答');
	expect(runHeadlessTurn).toHaveBeenCalledTimes(2);
	expect((await runTool('run_analysis', { question: 'x', model: 'p1::gpt-a', models: ['p1::gpt-a', 'p1::gpt-b'] }, ctx())).code).toBe('E_ARGS_INVALID');
	expect((await runTool('run_analysis', { question: 'x', models: ['p1::gpt-a', 'p1::nope'] }, ctx())).ok).toBe(false);
});

test('审阅:另一个模型带着被审回答作材料挑错,回 review;被审回答声明「只是材料」', async ()=>{
	const r = await runTool('run_analysis', { question: '今年事业如何', reviewModel: 'p1::gpt-c' }, ctx());
	expect(r.ok).toBe(true);
	expect(r.data.review.model).toBe('gpt-c');
	const reviewCall = runHeadlessTurn.mock.calls[1][0];
	expect(reviewCall.model).toBe('gpt-c');
	expect(reviewCall.userText).toContain('只是材料');
	expect(reviewCall.userText).toContain('gpt-a 答');
	expect(reviewCall.templates).toBeUndefined();   // 模版只约束作答,不约束审阅
});

test('思考档透传;资料按 id 挂(找不到拒、无正文的说明没挂上);模版渲染 {{user_prompt}}', async ()=>{
	await putStoreRecord(AI_ANALYSIS_STORES.materials, { id: 'm1', name: '滴天髓', extractedText: '天道有寒暖' }, 'material');
	await putStoreRecord(AI_ANALYSIS_STORES.materials, { id: 'm2', name: '空资料', extractedText: '' }, 'material');
	await putStoreRecord(AI_ANALYSIS_STORES.templates, { id: 't1', name: '三段式', format: 'text', instructionText: '按三段回答:{{user_prompt}}' }, 'template');
	const r = await runTool('run_analysis', { question: '看格局', thinking: 'high', materialIds: ['m1', 'm2'], templateId: 't1' }, ctx());
	expect(r.ok).toBe(true);
	const call = runHeadlessTurn.mock.calls[0][0];
	expect(call.thinkingLevel).toBe('high');
	expect(call.materials.map((m)=>m.id)).toEqual(['m1', 'm2']);
	expect(call.templates[0].instructionText).toBe('按三段回答:看格局');
	expect(r.assumptions.join(' ')).toContain('空资料');
	expect(r.data.materials.map((m)=>m.id)).toEqual(['m1', 'm2']);
	expect((await runTool('run_analysis', { question: 'x', materialIds: ['nope'] }, ctx())).code).toBe('E_ARGS_INVALID');
	expect((await runTool('run_analysis', { question: 'x', templateId: 'nope' }, ctx())).code).toBe('E_ARGS_INVALID');
	expect((await runTool('run_analysis', { question: 'x', thinking: 'ultra' }, ctx())).ok).toBe(false);
});
