// [进阶审计 D1] 短调用消费方的单源 providerOptionsForSlot:槽空 = 今日字节(applyThinkingLevel({...providerOptions}, 'off'));
// 设了槽档/槽参才施加;推理模型不发温度、reasoning_effort 仅 OpenAI 家族;缺 profile/model 原样返回不抛。
import { providerOptionsForSlot, providerOptionsForRoute, writeRouteOptions, clearRouteOptions, readRouteOptions, ROUTE_SLOTS } from '../aiModelRouting';
import { applyThinkingLevel } from '../aiAnalysisProviders';

const pOpenai = { id: 'p1', providerType: 'openai', providerOptions: { top_p: 0.9 } };
const pAnthropic = { id: 'p2', providerType: 'anthropic', providerOptions: {} };

beforeEach(()=>{ window.localStorage.clear(); });

it('🔴 槽空 ⇒ 与今日字节相同:六槽皆等于 applyThinkingLevel({...providerOptions}, "off"),且无 thinking/temperature/max_tokens/reasoning_effort', ()=>{
	ROUTE_SLOTS.forEach((slot)=>{
		const got = providerOptionsForSlot(slot, pOpenai, 'gpt-4o', { applyThinkingLevel });
		expect(got).toEqual(applyThinkingLevel({ ...pOpenai.providerOptions }, 'off', 'openai', 'gpt-4o'));
		expect(got).toEqual({ top_p: 0.9 });
		['thinking', 'temperature', 'max_tokens', 'reasoning_effort'].forEach((k)=>expect(got[k]).toBeUndefined());
		const a = providerOptionsForSlot(slot, pAnthropic, 'claude-x', { applyThinkingLevel });
		expect(a).toEqual({});
	});
	// 不改入参档案对象
	expect(pOpenai.providerOptions).toEqual({ top_p: 0.9 });
});

it('judge 槽 temperature 0.3 / maxTokens 555 ⇒ 键在;其它槽不受影响;清键后回今日字节', ()=>{
	writeRouteOptions({ judge: { temperature: 0.3, maxTokens: 555 } });
	expect(providerOptionsForSlot('judge', pOpenai, 'gpt-4o', { applyThinkingLevel })).toEqual({ top_p: 0.9, temperature: 0.3, max_tokens: 555 });
	expect(providerOptionsForSlot('review', pOpenai, 'gpt-4o', { applyThinkingLevel })).toEqual({ top_p: 0.9 });
	clearRouteOptions();
	expect(providerOptionsForSlot('judge', pOpenai, 'gpt-4o', { applyThinkingLevel })).toEqual({ top_p: 0.9 });
});

it('anthropic 槽档 high ⇒ thinking 预算与全局档 high 同值;baseThinking low + 槽档 off ⇒ 思考键剥掉;仅 baseThinking low ⇒ 思考键在', ()=>{
	writeRouteOptions({ review: { thinking: 'high' } });
	const got = providerOptionsForSlot('review', pAnthropic, 'claude-x', { applyThinkingLevel });
	expect(got.thinking).toEqual(applyThinkingLevel({}, 'high', 'anthropic', 'claude-x').thinking);
	expect(got.thinking.budget_tokens).toBeGreaterThan(0);
	writeRouteOptions({ review: { thinking: 'off' } });
	const got2 = providerOptionsForSlot('review', pAnthropic, 'claude-x', { applyThinkingLevel, baseThinking: 'low' });
	expect(got2.thinking).toBeUndefined();
	clearRouteOptions();
	const got3 = providerOptionsForSlot('review', pAnthropic, 'claude-x', { applyThinkingLevel, baseThinking: 'low' });
	expect(got3.thinking).toBeDefined();
});

it('推理模型:温度省略、reasoning_effort 仅 OpenAI 家族;输出上限写 max_completion_tokens(不写 max_tokens);非推理模型温度照发且无 reasoning_effort', ()=>{
	writeRouteOptions({ planner: { temperature: 0.7, reasoningEffort: 'high', maxTokens: 999 } });
	const o = providerOptionsForSlot('planner', pOpenai, 'o3-mini', { applyThinkingLevel });
	expect(o.temperature).toBeUndefined();
	expect(o.reasoning_effort).toBe('high');
	// [D7] o 系不收 max_tokens(400 unsupported_parameter):槽上限必须落 max_completion_tokens
	expect(o.max_completion_tokens).toBe(999);
	expect(o.max_tokens).toBeUndefined();
	const a = providerOptionsForSlot('planner', pAnthropic, 'claude-x', { applyThinkingLevel });
	expect(a.temperature).toBe(0.7);
	expect(a.reasoning_effort).toBeUndefined();
	expect(a.max_tokens).toBe(999);
});

it('缺 profile/model ⇒ 原样返回不抛;显式 routeOptions 优先于存储;不传 applyThinkingLevel 也只返回档案 providerOptions 副本', ()=>{
	expect(providerOptionsForSlot('judge', null, 'm', { applyThinkingLevel })).toEqual({});
	expect(providerOptionsForSlot('judge', pOpenai, '', { applyThinkingLevel })).toEqual({ top_p: 0.9 });
	writeRouteOptions({ judge: { maxTokens: 555 } });
	expect(providerOptionsForSlot('judge', pOpenai, 'gpt-4o', { applyThinkingLevel, routeOptions: { judge: { maxTokens: 5 } } }).max_tokens).toBe(5);
	const noFn = providerOptionsForSlot('judge', pOpenai, 'gpt-4o');
	expect(noFn.max_tokens).toBe(555);
	expect(noFn.top_p).toBe(0.9);
});

// [进阶审计 D7] 输出上限键按「协议家族 × 模型代际」单源:此前一律写 max_tokens → 聊天路径为推理模型预注入的
// max_completion_tokens(兜底 10096)压过槽值,路由表「输出上限」对 o 系 / gemini / ollama 从未生效(端到端用例 S105 实抓)。
it('🔴 [D7] 槽上限写家族正确键并清掉其它输出键:o 系底带 max_completion_tokens 兜底 → 槽 999 覆盖之;gemini → maxOutputTokens;ollama → num_predict;anthropic/普通 openai → max_tokens', ()=>{
	writeRouteOptions({ toolRounds: { maxTokens: 999 } });
	const base = { top_p: 0.9, max_completion_tokens: 10096 };   // 聊天路径对推理模型的兜底注入(effectiveMaxTokensForModel(model, 4096))
	const o = providerOptionsForRoute({ profile: pOpenai, model: 'o3-mini', routed: false, slot: 'toolRounds' }, base, { profile: pOpenai, model: 'o3-mini', thinkingLevel: 'off', applyThinkingLevel, routeOptions: readRouteOptions() });
	expect(o.max_completion_tokens).toBe(999);
	expect(o.max_tokens).toBeUndefined();
	expect(o.top_p).toBe(0.9);
	const pGemini = { id: 'p3', providerType: 'gemini', providerOptions: {} };
	const g = providerOptionsForSlot('toolRounds', pGemini, 'gemini-2.5-pro', { applyThinkingLevel });
	expect(g.maxOutputTokens).toBe(999);
	expect(g.max_tokens).toBeUndefined();
	const pOllama = { id: 'p4', providerType: 'ollama', providerOptions: {} };
	const l = providerOptionsForSlot('toolRounds', pOllama, 'qwen3:8b', { applyThinkingLevel });
	expect(l.num_predict).toBe(999);
	expect(l.max_tokens).toBeUndefined();
	expect(providerOptionsForSlot('toolRounds', pAnthropic, 'claude-x', { applyThinkingLevel }).max_tokens).toBe(999);
	expect(providerOptionsForSlot('toolRounds', pOpenai, 'gpt-4o', { applyThinkingLevel }).max_tokens).toBe(999);
	expect(providerOptionsForSlot('toolRounds', pOpenai, 'gpt-4o', { applyThinkingLevel }).max_completion_tokens).toBeUndefined();
	clearRouteOptions();
});

describe('[Q-399 裁决 2026-09-18] 推理档判据与对话页同源', ()=>{
	it('reasoningEffort 只对 OpenAI o / gpt-5+ 代际写 reasoning_effort;deepseek-reasoner / *-r1 走 openai 家族也不写', ()=>{
		const { applySlotParams } = require('../aiModelRouting');
		const so = { reasoningEffort: 'high' };
		expect(applySlotParams({}, so, 'openai', 'gpt-5').reasoning_effort).toBe('high');
		expect(applySlotParams({}, so, 'openai', 'o3-mini').reasoning_effort).toBe('high');
		expect(applySlotParams({}, so, 'openai', 'deepseek-reasoner').reasoning_effort).toBeUndefined();
		expect(applySlotParams({}, so, 'openai', 'qwen-r1').reasoning_effort).toBeUndefined();
		expect(applySlotParams({}, so, 'anthropic', 'gpt-5').reasoning_effort).toBeUndefined();
	});
});
