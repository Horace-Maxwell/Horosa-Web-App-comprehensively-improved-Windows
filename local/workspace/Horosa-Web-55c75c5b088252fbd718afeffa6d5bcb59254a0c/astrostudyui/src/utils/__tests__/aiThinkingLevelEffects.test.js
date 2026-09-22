// [Q-044] 思考档「哪些档对当前模型真有差别」由 applyThinkingLevel 自证:
// 逐档取思考相关键做指纹,与更低档相同即 sameAs(浮层据此置灰 + title)。
import { thinkingLevelEffects, THINKING_LEVELS, applyChatParams } from '../aiAnalysisProviders';

const sameMap = (list)=>list.reduce((m, x)=>{ m[x.value] = x.sameAs; return m; }, {});

it('🔴 OpenAI o/gpt-5 系:reasoning_effort 只认 low|medium|high ⇒ 极高 / 最大 == 高', ()=>{
	const m = sameMap(thinkingLevelEffects('openai', 'gpt-5.6-sol', {}));
	expect(m.off).toBe('');
	expect(m.low).toBe('');
	expect(m.medium).toBe('');
	expect(m.high).toBe('');
	expect(m.xhigh).toBe('high');
	expect(m.max).toBe('high');
});

it('🔴 无思考参数的模型(Ollama / DeepSeek reasoner)⇒ 所有档都等于「关闭」', ()=>{
	const ollama = sameMap(thinkingLevelEffects('ollama', 'qwen2.5:14b', {}));
	THINKING_LEVELS.filter((t)=>t.value !== 'off').forEach((t)=>expect(ollama[t.value]).toBe('off'));
	const r1 = sameMap(thinkingLevelEffects('deepseek', 'deepseek-reasoner', {}));
	THINKING_LEVELS.filter((t)=>t.value !== 'off').forEach((t)=>expect(r1[t.value]).toBe('off'));
});

it('🔴 判别向量:Anthropic 自适应族与 Gemini 六档各不相同(不得被误灰)', ()=>{
	const anth = sameMap(thinkingLevelEffects('anthropic', 'claude-opus-5', {}));
	THINKING_LEVELS.forEach((t)=>expect(anth[t.value]).toBe(''));
	const gem = sameMap(thinkingLevelEffects('gemini', 'gemini-2.5-pro', {}));
	THINKING_LEVELS.forEach((t)=>expect(gem[t.value]).toBe(''));
});

// [Q-045] 浮层五类参数单源:三条旁路与主发送共用
it('🔴 applyChatParams:温度按家族夹逼 / 推理型号不发采样 / 停止序列按家族选键 / withJsonMode 可关', ()=>{
	const openai = { id: 'p', providerType: 'openai' };
	const anthropic = { id: 'p2', providerType: 'anthropic' };
	const a = applyChatParams({}, { profile: openai, model: 'gpt-4.1', temperature: 1.8, topP: 0.9, stopSequences: '停,END', frequencyPenalty: 0.5, presencePenalty: -0.5, jsonMode: true });
	expect(a).toEqual({ temperature: 1.8, top_p: 0.9, stop: ['停', 'END'], frequency_penalty: 0.5, presence_penalty: -0.5, response_format: { type: 'json_object' } });
	const b = applyChatParams({}, { profile: anthropic, model: 'claude-haiku-4-5', temperature: 1.8, stopSequences: 'END', frequencyPenalty: 0.5, jsonMode: true });
	expect(b.temperature).toBe(1);                 // Anthropic 上限 1
	expect(b.stop_sequences).toEqual(['END']);     // 家族键
	expect(b.stop).toBeUndefined();
	expect(b.frequency_penalty).toBeUndefined();   // 非 OpenAI 家族不发惩罚
	expect(b.response_format).toBeUndefined();     // JSON 模式只对 OpenAI 兼容 / Gemini
	const c = applyChatParams({}, { profile: openai, model: 'o3-deep-research', temperature: 0.2, topP: 0.5, frequencyPenalty: 1 });
	expect(c.temperature).toBeUndefined();         // 推理型号不发采样参数
	expect(c.top_p).toBeUndefined();
	expect(c.frequency_penalty).toBeUndefined();
	const d = applyChatParams({}, { profile: openai, model: 'gpt-4.1', jsonMode: true, withJsonMode: false });
	expect(d.response_format).toBeUndefined();     // 调用方自己要挂 response_format 时不抢键
});
