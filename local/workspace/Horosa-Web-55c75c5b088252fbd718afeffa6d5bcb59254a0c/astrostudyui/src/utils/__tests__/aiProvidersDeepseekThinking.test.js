// [D66] DeepSeek v4 思考开关:off ⇒ thinking:{type:'disabled'}(此前 off 什么都不发 = 关不掉思考,真模型把 max_tokens 吃光正文为空);
// 非 off ⇒ enabled;旧别名(deepseek-chat / deepseek-reasoner)与其它家族字节零变化。
import { applyThinkingLevel, isDeepseekV4Model, thinkingLevelEffects } from '../aiAnalysisProviders';

test('🔴 deepseek-v4-flash:off ⇒ disabled;high ⇒ enabled;原有键保留', ()=>{
	expect(applyThinkingLevel({ max_tokens: 800 }, 'off', 'deepseek', 'deepseek-v4-flash')).toEqual({ max_tokens: 800, thinking: { type: 'disabled' } });
	expect(applyThinkingLevel({}, 'high', 'deepseek', 'deepseek-v4-pro')).toEqual({ thinking: { type: 'enabled' } });
	expect(applyThinkingLevel({}, 'off', 'openai', 'deepseek-v4-flash')).toEqual({ thinking: { type: 'disabled' } });   // OpenAI 兼容档下按模型名识别
	expect(isDeepseekV4Model('deepseek-v4-flash', 'openai')).toBe(true);
	expect(isDeepseekV4Model('deepseek-v5-x', 'deepseek')).toBe(true);
	// [2026-09-11] 官方新名(无 v4 字样):deepseek 供应商下按 v4 系认;非 deepseek 供应商(转发商)不认新名
	expect(isDeepseekV4Model('deepseek-flash', 'deepseek')).toBe(true);
	expect(isDeepseekV4Model('deepseek-pro', 'deepseek')).toBe(true);
	expect(isDeepseekV4Model('deepseek-flash-expires-on-1001', 'deepseek')).toBe(true);
	expect(isDeepseekV4Model('deepseek-flash', 'openai')).toBe(false);
	expect(applyThinkingLevel({}, 'off', 'deepseek', 'deepseek-flash')).toEqual({ thinking: { type: 'disabled' } });
	expect(applyThinkingLevel({}, 'medium', 'deepseek', 'deepseek-flash')).toEqual({ thinking: { type: 'enabled' } });
});

test('零回归:旧别名与其它家族 off 字节恒等,非 off 不带 thinking 键', ()=>{
	['deepseek-chat', 'deepseek-reasoner', 'gpt-4o', 'claude-3', 'mock-model'].forEach((m)=>{
		expect(applyThinkingLevel({ a: 1 }, 'off', m.startsWith('deepseek') ? 'deepseek' : 'openai', m)).toEqual({ a: 1 });
	});
	expect(applyThinkingLevel({}, 'medium', 'deepseek', 'deepseek-chat')).toEqual({});
	expect(applyThinkingLevel({}, 'medium', 'openai', 'gpt-4o')).toEqual({});
	expect(isDeepseekV4Model('deepseek-chat', 'deepseek')).toBe(false);
});

// [Q-327 裁决 2026-09-18] 网关转发的前缀名(openrouter `deepseek/deepseek-v4-flash`、siliconflow `deepseek-ai/DeepSeek-V4-Pro`)此前不被识别
//   → 思考档对它们静默失效(关不掉思考);且各网关不认官方 thinking:{type} 字段:OpenRouter 只认 reasoning:{enabled,effort},
//   SiliconFlow 用 enable_thinking / thinking_budget。修前:前三条 isDeepseekV4Model 为 false、请求体不带任何思考字段(红)。
test('[Q-327] 剥厂商前缀识别 v4 系:deepseek/ 与 deepseek-ai/ 前缀视同官方档;非 deepseek 厂商前缀的新名不认', ()=>{
	expect(isDeepseekV4Model('deepseek/deepseek-v4-flash', 'openrouter')).toBe(true);
	expect(isDeepseekV4Model('deepseek-ai/DeepSeek-V4-Pro', 'siliconflow')).toBe(true);
	expect(isDeepseekV4Model('deepseek/deepseek-flash', 'openrouter')).toBe(true);
	expect(isDeepseekV4Model('openrouter/deepseek/deepseek-v4-flash', 'custom')).toBe(true);
	expect(isDeepseekV4Model('qwen/qwen3-235b', 'openrouter')).toBe(false);
	expect(isDeepseekV4Model('other/deepseek-flash', 'openrouter')).toBe(false);
	expect(isDeepseekV4Model('deepseek/deepseek-chat', 'openrouter')).toBe(false);
	expect(isDeepseekV4Model('deepseek-flash', 'openrouter')).toBe(false);   // 无前缀新名只在 deepseek 官方档认(零回归)
});
test('[Q-327] 字段形态按网关:openrouter ⇒ reasoning:{enabled,effort};siliconflow ⇒ enable_thinking / thinking_budget;官方 / openai 兼容 / custom ⇒ thinking:{type}', ()=>{
	expect(applyThinkingLevel({ max_tokens: 800 }, 'off', 'openrouter', 'deepseek/deepseek-v4-flash')).toEqual({ max_tokens: 800, reasoning: { enabled: false } });
	expect(applyThinkingLevel({}, 'high', 'openrouter', 'deepseek/deepseek-v4-flash')).toEqual({ reasoning: { enabled: true, effort: 'high' } });
	expect(applyThinkingLevel({}, 'max', 'openrouter', 'deepseek/deepseek-v4-pro')).toEqual({ reasoning: { enabled: true, effort: 'high' } });
	expect(applyThinkingLevel({}, 'medium', 'openrouter', 'deepseek/deepseek-v4-pro').reasoning.effort).toBe('medium');
	expect(applyThinkingLevel({}, 'custom:3000', 'openrouter', 'deepseek/deepseek-v4-pro').reasoning.effort).toBe('low');
	expect(applyThinkingLevel({ a: 1 }, 'off', 'siliconflow', 'deepseek-ai/DeepSeek-V4-Flash')).toEqual({ a: 1, enable_thinking: false });
	expect(applyThinkingLevel({}, 'low', 'siliconflow', 'deepseek-ai/DeepSeek-V4-Flash')).toEqual({ enable_thinking: true, thinking_budget: 2048 });
	expect(applyThinkingLevel({}, 'max', 'siliconflow', 'deepseek-ai/DeepSeek-V4-Flash').thinking_budget).toBe(32768);
	expect(applyThinkingLevel({}, 'custom:100', 'siliconflow', 'deepseek-ai/DeepSeek-V4-Flash').thinking_budget).toBe(1024);
	// 关档不残留开档预算键
	expect(applyThinkingLevel({ thinking_budget: 4096 }, 'off', 'siliconflow', 'deepseek-ai/DeepSeek-V4-Flash')).toEqual({ enable_thinking: false });
	// 官方 / openai 兼容 / custom:形态不变
	expect(applyThinkingLevel({}, 'off', 'deepseek', 'deepseek-v4-flash')).toEqual({ thinking: { type: 'disabled' } });
	expect(applyThinkingLevel({}, 'high', 'custom', 'deepseek/deepseek-v4-flash')).toEqual({ thinking: { type: 'enabled' } });
	expect(applyThinkingLevel({}, 'off', 'openai', 'deepseek/deepseek-v4-flash')).toEqual({ thinking: { type: 'disabled' } });
	// 网关上的非 DeepSeek 模型:零变化
	expect(applyThinkingLevel({ a: 1 }, 'off', 'openrouter', 'openai/gpt-4o')).toEqual({ a: 1 });
	expect(applyThinkingLevel({ a: 1 }, 'high', 'siliconflow', 'Qwen/Qwen3-32B')).toEqual({ a: 1 });
});
test('[Q-327] 思考档可用性探针(Q-044)认得网关字段:openrouter / siliconflow 的关与开不判「无差异」', ()=>{
	const or = thinkingLevelEffects('openrouter', 'deepseek/deepseek-v4-flash', {});
	const by = (arr)=>Object.fromEntries(arr.map((x)=>[x.value, x.sameAs]));
	expect(by(or).off).toBe('');
	expect(by(or).high).toBe('');
	expect(by(or).xhigh).toBe('high');   // effort 封顶 high ⇒ 与 high 等同(置灰并注明)
	const sf = thinkingLevelEffects('siliconflow', 'deepseek-ai/DeepSeek-V4-Flash', {});
	expect(by(sf).off).toBe('');
	expect(by(sf).low).toBe('');
	expect(by(sf).high).toBe('');
});
