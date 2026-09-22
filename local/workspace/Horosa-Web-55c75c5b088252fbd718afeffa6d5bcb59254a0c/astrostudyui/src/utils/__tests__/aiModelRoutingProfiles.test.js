// [批三②] 槽参数四键 + 具名方案合同:归一(越界剔除)/合并写(''=清键)/施加(温度不发给推理模型;effort 只发 OpenAI 系推理模型;max_tokens 落键)/方案另存·切换·删除·脏判定/上限;缺省两键不存在=现状。
import { ROUTE_OPTIONS_KEY, ROUTE_PROFILES_KEY, readRouteOptions, writeRouteOptions, providerOptionsForRoute, applySlotParams, normalizeRouteOptions, readRouteProfiles, saveRouteProfile, applyRouteProfile, removeRouteProfile, clearActiveRouteProfile, isRouteProfileDirty, listRouteProfiles, ROUTE_PROFILES_MAX, writeModelRoutes, readModelRoutes, MODEL_ROUTES_KEY } from '../aiModelRouting';
import { applyThinkingLevel } from '../aiAnalysisProviders';
import { BUILTIN_COMMANDS } from '../aiChat/commands';

beforeEach(()=>{ window.localStorage.clear(); });
const pOA = { id: 'oa', providerType: 'openai', providerOptions: {} };
const pAN = { id: 'an', providerType: 'anthropic', providerOptions: {} };

it("归一:四键各自越界剔除;合并写 ''=清键;整槽空删槽;全空删键", ()=>{
	expect(normalizeRouteOptions({ final: { thinking: 'high', reasoningEffort: 'ultra', temperature: 3, maxTokens: 0 } })).toEqual({ final: { thinking: 'high' } });
	expect(normalizeRouteOptions({ final: { temperature: '0.35', maxTokens: '4096.4', reasoningEffort: 'low' } })).toEqual({ final: { temperature: 0.35, maxTokens: 4096, reasoningEffort: 'low' } });
	writeRouteOptions({ final: { thinking: 'high', temperature: 0.2 } });
	writeRouteOptions({ final: { maxTokens: 2048 } });
	expect(readRouteOptions().final).toEqual({ thinking: 'high', temperature: 0.2, maxTokens: 2048 });
	writeRouteOptions({ final: { thinking: '', temperature: null } });
	expect(readRouteOptions().final).toEqual({ maxTokens: 2048 });
	writeRouteOptions({ final: { maxTokens: '' } });
	expect(window.localStorage.getItem(ROUTE_OPTIONS_KEY)).toBe(null);
});

it('施加:温度不发给推理模型;effort 只发 OpenAI 系推理模型;max_tokens 落键;同目标有槽参不再回原对象', ()=>{
	expect(applySlotParams({ a: 1 }, { temperature: 0.3, maxTokens: 100, reasoningEffort: 'high' }, 'openai', 'gpt-4.1')).toEqual({ a: 1, temperature: 0.3, max_tokens: 100 });
	expect(applySlotParams({}, { temperature: 0.3, reasoningEffort: 'high' }, 'openai', 'gpt-5-mini')).toEqual({ reasoning_effort: 'high' });
	expect(applySlotParams({}, { reasoningEffort: 'high', maxTokens: 9 }, 'anthropic', 'claude-x')).toEqual({ max_tokens: 9 });
	const base = { temperature: 0.7 };
	const same = { routed: false, profile: pOA, model: 'gpt-4.1', slot: 'final' };
	expect(providerOptionsForRoute(same, base, { profile: pOA, model: 'gpt-4.1', thinkingLevel: 'off', applyThinkingLevel, routeOptions: {} })).toBe(base);
	const out = providerOptionsForRoute(same, base, { profile: pOA, model: 'gpt-4.1', thinkingLevel: 'off', applyThinkingLevel, routeOptions: { final: { temperature: 0.1, maxTokens: 500 } } });
	expect(out).toEqual({ temperature: 0.1, max_tokens: 500 });
	expect(base.temperature).toBe(0.7);
	// 异目标:先思考档再槽参;通用键照带
	const routed = { routed: true, profile: pAN, model: 'claude-x', slot: 'final' };
	const r = providerOptionsForRoute(routed, { top_p: 0.9 }, { profile: pOA, model: 'gpt-4.1', thinkingLevel: 'off', applyThinkingLevel, routeOptions: { final: { thinking: 'low', maxTokens: 777 } } });
	expect(r.thinking.budget_tokens).toBe(2048);
	expect(r.max_tokens).toBe(777);
	expect(r.top_p).toBe(0.9);
});

it('方案:另存抄活键并置 active;切换抄回活键;脏判定;删除不动活键;上限;缺省键不存在;/profile 命令在位', ()=>{
	expect(window.localStorage.getItem(ROUTE_PROFILES_KEY)).toBe(null);
	expect(saveRouteProfile('')).toBe(null);
	writeModelRoutes({ final: 'oa::gpt-4.1' });
	writeRouteOptions({ final: { thinking: 'high' } });
	expect(saveRouteProfile('  强档  ').active).toBe('强档');
	expect(readRouteProfiles().profiles['强档']).toEqual({ routes: { toolRounds: '', final: 'oa::gpt-4.1', judge: '', review: '', planner: '', subagent: '' }, routeOptions: { final: { thinking: 'high' } } });
	expect(isRouteProfileDirty('强档')).toBe(false);
	writeRouteOptions({ final: { thinking: 'low' } });
	expect(isRouteProfileDirty('强档')).toBe(true);
	saveRouteProfile('省钱');   // 第二套:当前活键(low)
	expect(applyRouteProfile('强档')).toBe(true);
	expect(readRouteOptions().final.thinking).toBe('high');
	expect(readModelRoutes().final).toBe('oa::gpt-4.1');
	expect(readRouteProfiles().active).toBe('强档');
	expect(applyRouteProfile('没有')).toBe(false);
	clearActiveRouteProfile();
	expect(readRouteProfiles().active).toBe('');
	expect(readRouteOptions().final.thinking).toBe('high');   // 回到现状不动活键
	expect(removeRouteProfile('省钱')).toBe(true);
	expect(listRouteProfiles()).toEqual(['强档']);
	for(let i = 0; i < ROUTE_PROFILES_MAX + 2; i++){ saveRouteProfile(`p${i}`); }
	expect(listRouteProfiles().length).toBe(ROUTE_PROFILES_MAX);
	expect(BUILTIN_COMMANDS.find((c)=>c.name === 'profile').aliases).toEqual(['方案']);
	expect(MODEL_ROUTES_KEY).toBe('horosa.ai.chat.modelRoutes.v1');
});
