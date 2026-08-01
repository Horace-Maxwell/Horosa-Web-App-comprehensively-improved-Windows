import {
	getProviderDefaultChatModels,
	getProviderDefaultEmbeddingModels,
	getProviderDisplayName,
	getProviderPreset,
	getProviderProtocolFamily,
	isOpenAiFamily,
	isReasoningModel,
	isOpenAIReasoningModel,
	maxTokensKeyForModel,
	splitProviderModels,
	applyThinkingLevel,
	effectiveMaxTokensForModel,
	THINKING_LEVELS,
} from '../aiAnalysisProviders';

describe('aiAnalysisProviders', ()=>{
	test('deepseek preset exposes expected defaults', ()=>{
		const preset = getProviderPreset('deepseek');
		expect(preset.baseUrl).toBe('https://api.deepseek.com');
		expect(getProviderDisplayName('deepseek')).toBe('DeepSeek');
		expect(getProviderProtocolFamily('deepseek')).toBe('openai-compatible');
		// [C3] 2026-07 现役目录:v4 直连置顶,chat/reasoner 别名暂留兼容(官方 2026-07-24 弃用)。
		expect(getProviderDefaultChatModels('deepseek')).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner']);
		expect(getProviderDefaultEmbeddingModels('deepseek')).toEqual([]);
	});

	test('moonshot preset exposes expected defaults', ()=>{
		const preset = getProviderPreset('moonshot');
		expect(preset.baseUrl).toBe('https://api.moonshot.cn/v1');
		// 2026-06 官方现行模型(kimi-k2-* preview 系列 2026-05-25 停服,旧默认即「测试连接」400 来源)。
		expect(getProviderDefaultChatModels('moonshot')).toEqual(['kimi-k2.6', 'kimi-k2.5']);
	});

	test('kimi-k 系输出预算覆盖整个代际(Windows #47:勿写死 k2 单代)', ()=>{
		// k2/k3/k4… 全是思考模型:思考 token 计入 max_tokens,预算须翻倍加余量(封顶 16384)。
		expect(effectiveMaxTokensForModel('kimi-k2.6', 2048)).toBe(8048);
		expect(effectiveMaxTokensForModel('kimi-k3', 2048)).toBe(8048);
		expect(effectiveMaxTokensForModel('kimi-k4-code', 2048)).toBe(8048);
		// 非 k+数字 代号(moonshot-v1/kimi-latest)不是思考档口径 → 原值直返。
		expect(effectiveMaxTokensForModel('kimi-latest', 2048)).toBe(2048);
		expect(effectiveMaxTokensForModel('moonshot-v1-32k', 2048)).toBe(2048);
	});

	test('gemini preset exposes chat models distinct from embedding models', ()=>{
		const preset = getProviderPreset('gemini');
		expect(preset.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
		expect(getProviderProtocolFamily('gemini')).toBe('gemini');
		// [C3] 3.x 现役置顶;2.5 官方 2026-10-16 退役前暂留。
		expect(getProviderDefaultChatModels('gemini')).toEqual(['gemini-3.1-pro', 'gemini-3.5-flash', 'gemini-3-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro']);
		// text-embedding-004 已于 2026-01-14 关停,官方迁移目标 gemini-embedding-001。
		expect(getProviderDefaultEmbeddingModels('gemini')).toEqual(['gemini-embedding-001']);
	});

	test('splitProviderModels separates embedding-like ids', ()=>{
		expect(splitProviderModels(['deepseek-chat', 'text-embedding-3-small', 'bge-large-zh'], 'deepseek')).toEqual({
			models: ['deepseek-chat', 'text-embedding-3-small', 'bge-large-zh'],
			chatModels: ['deepseek-chat'],
			embeddingModels: ['text-embedding-3-small', 'bge-large-zh'],
		});
	});

	test('isReasoningModel detects deepseek-reasoner / r1 / openai reasoning series', ()=>{
		// #16:reasoner 必须被识别为推理模型 → 前端不发 temperature、后端不带采样参数。
		expect(isReasoningModel('deepseek-reasoner')).toBe(true);
		expect(isReasoningModel('openrouter/deepseek/deepseek-r1')).toBe(true);
		expect(isReasoningModel('o1-mini')).toBe(true);
		expect(isReasoningModel('gpt-5')).toBe(true);
		expect(isReasoningModel('deepseek-chat')).toBe(false);
		expect(isReasoningModel('gpt-4o')).toBe(false);
	});

	test('THINKING_LEVELS 含新增高档 xhigh/max', ()=>{
		expect(THINKING_LEVELS.map((t)=>t.value)).toEqual(['off', 'low', 'medium', 'high', 'xhigh', 'max']);
	});

	test('applyThinkingLevel: off 原样返回', ()=>{
		expect(applyThinkingLevel({ a: 1 }, 'off', 'anthropic', 'claude-3-opus')).toEqual({ a: 1 });
	});

	test('applyThinkingLevel: OpenAI reasoning_effort 把 xhigh/max 封顶为 high', ()=>{
		expect(applyThinkingLevel({}, 'xhigh', 'openai', 'gpt-5').reasoning_effort).toBe('high');
		expect(applyThinkingLevel({}, 'max', 'openai', 'gpt-5').reasoning_effort).toBe('high');
		expect(applyThinkingLevel({}, 'medium', 'openai', 'gpt-5').reasoning_effort).toBe('medium');
	});

	test('applyThinkingLevel: Anthropic budget_tokens 受 max_tokens 约束（防 400）', ()=>{
		expect(applyThinkingLevel({}, 'high', 'anthropic', 'claude-3-opus').thinking.budget_tokens).toBe(16000);
		expect(applyThinkingLevel({}, 'max', 'anthropic', 'claude-3-opus', 8000).thinking.budget_tokens).toBe(7488);
		expect(applyThinkingLevel({}, 'high', 'anthropic', 'claude-3-opus', 1000).thinking).toBeUndefined();
	});

	test('applyThinkingLevel: Gemini 写入 generationConfig.thinkingConfig.thinkingBudget + includeThoughts', ()=>{
		const cfg = applyThinkingLevel({}, 'max', 'gemini', 'gemini-2.5-pro').generationConfig.thinkingConfig;
		expect(cfg.thinkingBudget).toBe(32768);
		// #54-G：includeThoughts=true 才让 Gemini 回流思维链(thought part);缺它则预算照烧但 UI 无思考过程。
		expect(cfg.includeThoughts).toBe(true);
	});

	test('isOpenAiFamily: openai-compatible 也算 OpenAI 家族（预设实际取值就是它；曾因 === "openai" 永假致 stop/惩罚/JSON 模式静默失效）', ()=>{
		expect(isOpenAiFamily('openai')).toBe(true);
		expect(isOpenAiFamily('openai-compatible')).toBe(true);
		expect(isOpenAiFamily(getProviderProtocolFamily('openai'))).toBe(true);
		expect(isOpenAiFamily(getProviderProtocolFamily('deepseek'))).toBe(true);
		expect(isOpenAiFamily('anthropic')).toBe(false);
		expect(isOpenAiFamily('gemini')).toBe(false);
		expect(isOpenAiFamily('ollama')).toBe(false);
		expect(isOpenAiFamily('')).toBe(false);
		expect(isOpenAiFamily(null)).toBe(false);
	});

	test('applyThinkingLevel: reasoning_effort 覆盖与 isReasoningModel 同口径（曾漏 gpt-5.5/gpt-6/7、o6/7 致思考档静默失效）', ()=>{
		for(const m of ['gpt-5.5', 'gpt-6', 'gpt-7', 'o6', 'o7-mini', 'openrouter/openai/gpt-6']){
			expect(applyThinkingLevel({}, 'high', 'openai', m).reasoning_effort).toBe('high');
		}
		// 非 OpenAI 推理系不带 reasoning_effort（gpt-4o 非推理；deepseek-reasoner 无该参数,友好降级）
		expect(applyThinkingLevel({}, 'high', 'openai', 'gpt-4o').reasoning_effort).toBeUndefined();
		expect(applyThinkingLevel({}, 'high', 'deepseek', 'deepseek-reasoner').reasoning_effort).toBeUndefined();
	});
});

// [E2] 思考预算自定义数值档
describe('[E2] applyThinkingLevel custom 数值档', () => {
	const { applyThinkingLevel } = require('../aiAnalysisProviders');
	test("custom:<n> → anthropic budget_tokens=clamp 值;maxTokens 保护仍生效", () => {
		const o = applyThinkingLevel({}, 'custom:12000', 'anthropic', 'claude-sonnet-5', 32000);
		expect(o.thinking).toEqual({ type: 'enabled', budget_tokens: 12000 });
		// clamp 上限
		const hi = applyThinkingLevel({}, 'custom:99999999', 'anthropic', 'claude-sonnet-5', 200000);
		expect(hi.thinking.budget_tokens).toBe(65536);
		// clamp 下限
		const lo = applyThinkingLevel({}, 'custom:1', 'anthropic', 'claude-sonnet-5', 32000);
		expect(lo.thinking.budget_tokens).toBe(1024);
	});
	test('custom 数值折 effort 档(OpenAI reasoning_effort);非法值滚 medium 不抛', () => {
		const hi = applyThinkingLevel({}, 'custom:20000', 'openai', 'gpt-5.2', 32000);
		expect(hi.reasoning_effort).toBe('high'); // xhigh 封顶 high
		const lo = applyThinkingLevel({}, 'custom:2048', 'openai', 'gpt-5.2', 32000);
		expect(lo.reasoning_effort).toBe('low');
		const bad = applyThinkingLevel({}, 'custom:abc', 'anthropic', 'claude-sonnet-5', 32000);
		expect(bad.thinking.budget_tokens).toBe(8192); // 落回 medium(正则不匹配)
	});
	test('负锚:既有枚举档行为字节不变', () => {
		const o = applyThinkingLevel({}, 'high', 'anthropic', 'claude-sonnet-5', 32000);
		expect(o.thinking.budget_tokens).toBe(16000);
		expect(applyThinkingLevel({}, 'off', 'anthropic', 'x', 32000)).toEqual({});
	});
});

// 🔴 #54 输出预算键单一真值源：前后端两套判据曾各自「正确」却对不上通道，
// 前端按协议家族选键把裸 max_tokens 塞进 providerOptions → gpt-5.x 恒 400。
describe('[#54] maxTokensKeyForModel 代际单源', ()=>{
	test('OpenAI 新代（gpt-5/6/7 与 o 系）→ max_completion_tokens', ()=>{
		['gpt-5.5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-6', 'gpt-7-mini', 'o1', 'o3-pro', 'o4-mini'].forEach((m)=>{
			expect(isOpenAIReasoningModel(m)).toBe(true);
			expect(maxTokensKeyForModel('openai', m)).toBe('max_completion_tokens');
		});
		// openrouter 之类的 vendor 前缀须剥后再判
		expect(maxTokensKeyForModel('openai', 'openrouter/openai/gpt-6')).toBe('max_completion_tokens');
	});

	test('老代 OpenAI 与非 OpenAI 推理模型 → 仍 max_tokens（勿误伤）', ()=>{
		['gpt-4.1', 'gpt-4o', 'deepseek-reasoner', 'deepseek-v4-pro', 'qwen-max', 'kimi-k3'].forEach((m)=>{
			expect(isOpenAIReasoningModel(m)).toBe(false);
			expect(maxTokensKeyForModel('openai', m)).toBe('max_tokens');
		});
	});

	test('其余协议家族键名不受模型代际影响', ()=>{
		expect(maxTokensKeyForModel('anthropic', 'gpt-5.5')).toBe('max_tokens');
		expect(maxTokensKeyForModel('gemini', 'gpt-5.5')).toBe('maxOutputTokens');
		expect(maxTokensKeyForModel('ollama', 'gpt-5.5')).toBe('num_predict');
	});

	test('接线锁：聊天链（与报告链，若本仓有）都必须走本单源，不许再手写键名分支', ()=>{
		const fs = require('fs');
		const path = require('path');
		const SRC = path.resolve(__dirname, '..', '..');
		const strip = (s)=>s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
		// 报告链属可选模块，并非每个构建都包含——存在才验，缺失不算红。
		const rpPath = path.join(SRC, 'utils/reportPipeline.js');
		if(fs.existsSync(rpPath)){
			expect(strip(fs.readFileSync(rpPath, 'utf8')).includes('maxTokensKeyForModel(protoFamily, model)')).toBe(true);
		}
		const am = strip(fs.readFileSync(path.join(SRC, 'components/aianalysis/AIAnalysisMain.js'), 'utf8'));
		expect(am.includes('maxTokensKeyForModel(protoFamily, model)')).toBe(true);
		// 手写键名分支必须绝迹（曾按协议家族四分支写死 → 新代 OpenAI 恒 400）
		expect(/protoFamily === 'anthropic'\s*\)\s*\{\s*chatProviderOptions\.max_tokens/.test(am)).toBe(false);
	});
});
