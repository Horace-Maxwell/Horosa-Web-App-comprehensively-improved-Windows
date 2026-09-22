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
	estimateUsageCost,
} from '../aiAnalysisProviders';

// [P0-1 计量底座] 缓存计价:无缓存计量/无价档与旧公式逐位相同;anthropic 三段加权;openai 家族 (in−read)。
describe('estimateUsageCost 缓存计价', ()=>{
	test('无价档四参=三参(皆 null);有价档但无缓存计量:四参与三参 cost 逐位相同且 cacheSavings=0', ()=>{
		expect(estimateUsageCost('my-secret-model', 1000, 100)).toBe(null);
		expect(estimateUsageCost('my-secret-model', 1000, 100, { cacheRead: 500, family: 'anthropic' })).toBe(null);
		const three = estimateUsageCost('claude-sonnet-5', 1234, 567);
		const four = estimateUsageCost('claude-sonnet-5', 1234, 567, { family: 'anthropic' });
		const fourZero = estimateUsageCost('claude-sonnet-5', 1234, 567, { cacheRead: 0, cacheWrite: 0, family: 'anthropic' });
		// [Q-043] Sonnet 5 价目已按官方改为 $2/$10 per 1M(此前照抄 Sonnet 4 的 $3/$15)
		expect(three.cost).toBe((1234 / 1000) * 0.002 + (567 / 1000) * 0.010);
		expect(four.cost).toBe(three.cost);
		expect(fourZero.cost).toBe(three.cost);
		expect(three.cacheSavings).toBe(0);
		expect(four.cacheSavings).toBe(0);
		expect(three.currency).toBe('USD');
	});

	test('anthropic 家族:input 不含缓存 → in·p + read·cacheIn + write·cacheWrite;缺 cacheIn 价档按 0.1p/1.25p 兜底', ()=>{
		// [Q-043] 同上:in=0.002 / cacheIn=0.0002(0.1×in)/ cacheWrite=0.0025(1.25×in)
		const r = estimateUsageCost('claude-sonnet-5', 1000, 0, { cacheRead: 2000, cacheWrite: 500, family: 'anthropic' });
		expect(r.cost).toBeCloseTo(1 * 0.002 + 2 * 0.0002 + 0.5 * 0.0025, 10);
		// 节省 = 全价(3500 tok × p) − 实付
		expect(r.cacheSavings).toBeCloseTo(3.5 * 0.002 - r.cost, 10);
		expect(r.cacheSavings).toBeGreaterThan(0);
		// 只读缓存、无写入
		const ro = estimateUsageCost('claude-fable-5', 100, 10, { cacheRead: 9000, family: 'anthropic' });
		expect(ro.cost).toBeCloseTo(0.1 * 0.010 + 9 * 0.001 + 0.01 * 0.050, 10);
		// 未来价档无 cacheIn/cacheWrite 时按官方比例兜底(用 gpt 价档冒充 anthropic 家族只为验证兜底路径)
		const fb = estimateUsageCost('gpt-4o', 1000, 0, { cacheRead: 1000, cacheWrite: 1000, family: 'anthropic' });
		expect(fb.cost).toBeCloseTo(1 * 0.0025 + 1 * 0.00025 + 1 * 0.003125, 10);
	});

	test('openai 家族(含 DeepSeek):prompt_tokens 已含 cached → (in−read)·p + read·cacheIn;无 cacheIn 价档=不打折', ()=>{
		const ds = estimateUsageCost('deepseek-chat', 1000, 0, { cacheRead: 400, family: 'openai-compatible' });
		expect(ds.cost).toBeCloseTo(0.6 * 0.00014 + 0.4 * 0.000014, 12);
		expect(ds.cacheSavings).toBeCloseTo(0.4 * (0.00014 - 0.000014), 12);
		const oa = estimateUsageCost('gpt-4o', 1000, 0, { cacheRead: 400, family: 'openai-compatible' });
		expect(oa.cost).toBeCloseTo(1 * 0.0025, 12);   // cacheIn 缺位 → 命中部分仍按 p
		expect(oa.cacheSavings).toBe(0);
		// 家族缺位按 openai 口径(input 已含 cached);命中数超过 input 时钳住不出负值
		const clamp = estimateUsageCost('deepseek-chat', 100, 0, { cacheRead: 500 });
		expect(clamp.cost).toBeCloseTo(0.1 * 0.000014, 12);
		expect(clamp.cost).toBeGreaterThan(0);
	});
});

describe('aiAnalysisProviders', ()=>{
	test('deepseek preset exposes expected defaults', ()=>{
		const preset = getProviderPreset('deepseek');
		expect(preset.baseUrl).toBe('https://api.deepseek.com');
		expect(getProviderDisplayName('deepseek')).toBe('DeepSeek');
		expect(getProviderProtocolFamily('deepseek')).toBe('openai-compatible');
		// [C3] 2026-07 现役目录:v4 直连置顶,chat/reasoner 别名暂留兼容(官方 2026-07-24 弃用);2026-09-11 官方 /models 改列 deepseek-flash(无 v4 字样)置首。
		expect(getProviderDefaultChatModels('deepseek')).toEqual(['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner']);
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
	test("custom:<n> → anthropic 预算族 budget_tokens=clamp 值;maxTokens 保护仍生效;自适应族折 effort", () => {
		// [Q-024] Sonnet 4.5 = 预算族(enabled+budget_tokens);Sonnet 5 = 自适应族(adaptive + effort,预算数值只折档)
		const o = applyThinkingLevel({}, 'custom:12000', 'anthropic', 'claude-sonnet-4-5', 32000);
		expect(o.thinking).toEqual({ type: 'enabled', budget_tokens: 12000 });
		// clamp 上限
		const hi = applyThinkingLevel({}, 'custom:99999999', 'anthropic', 'claude-sonnet-4-5', 200000);
		expect(hi.thinking.budget_tokens).toBe(65536);
		// clamp 下限
		const lo = applyThinkingLevel({}, 'custom:1', 'anthropic', 'claude-sonnet-4-5', 32000);
		expect(lo.thinking.budget_tokens).toBe(1024);
		const ad = applyThinkingLevel({}, 'custom:12000', 'anthropic', 'claude-sonnet-5', 32000);
		expect(ad.thinking).toEqual({ type: 'adaptive' });
		expect(ad.output_config).toEqual({ effort: 'medium' });
		expect(applyThinkingLevel({}, 'custom:20000', 'anthropic', 'claude-opus-5', 32000).output_config).toEqual({ effort: 'xhigh' });
	});
	test('custom 数值折 effort 档(OpenAI reasoning_effort);非法值滚 medium 不抛', () => {
		const hi = applyThinkingLevel({}, 'custom:20000', 'openai', 'gpt-5.2', 32000);
		expect(hi.reasoning_effort).toBe('high'); // xhigh 封顶 high
		const lo = applyThinkingLevel({}, 'custom:2048', 'openai', 'gpt-5.2', 32000);
		expect(lo.reasoning_effort).toBe('low');
		const bad = applyThinkingLevel({}, 'custom:abc', 'anthropic', 'claude-sonnet-4-5', 32000);
		expect(bad.thinking.budget_tokens).toBe(8192); // 落回 medium(正则不匹配)
	});
	test('负锚:既有枚举档行为字节不变(预算族)', () => {
		const o = applyThinkingLevel({}, 'high', 'anthropic', 'claude-sonnet-4-5', 32000);
		expect(o.thinking.budget_tokens).toBe(16000);
		expect(applyThinkingLevel({}, 'off', 'anthropic', 'x', 32000)).toEqual({});
	});
});

// [Q-024/Q-049/Q-050/Q-063] Anthropic 按型号思考形态(与 Java AIAnalysisProxyService.anthropicThinkingMode 同一张表)
describe('[Q-024] Anthropic 思考形态按型号', () => {
	const { applyThinkingLevel, anthropicThinkingMode, anthropicThinkingOffForm } = require('../aiAnalysisProviders');
	test('型号表:自适应族 vs 预算族;网关前缀取尾段;未知命名归预算族', () => {
		['claude-opus-4-7', 'claude-opus-4-8', 'claude-opus-5', 'claude-sonnet-5', 'claude-fable-5-1', 'anthropic/claude-mythos-5'].forEach((m)=>expect(anthropicThinkingMode(m)).toBe('adaptive'));
		['claude-opus-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001', 'claude-3-5-sonnet-20241022', 'claude-x', ''].forEach((m)=>expect(anthropicThinkingMode(m)).toBe('budget'));
	});
	test('开启:自适应族 adaptive+effort 且不带预算键;预算族 enabled+budget(档案上限 thinking_budget_cap 夹逼、键本身剥掉)', () => {
		const a = applyThinkingLevel({ thinking_budget_cap: 4000, top_p: 0.9 }, 'high', 'anthropic', 'claude-opus-4-8', 32000);
		expect(a.thinking).toEqual({ type: 'adaptive' });
		expect(a.output_config).toEqual({ effort: 'high' });
		expect(a.thinking_budget_cap).toBeUndefined();
		expect(a.top_p).toBe(0.9);   // 采样参数由出口(Java)按型号剥离,前端不动
		const b = applyThinkingLevel({ thinking_budget_cap: 4000 }, 'high', 'anthropic', 'claude-sonnet-4-5', 32000);
		expect(b.thinking).toEqual({ type: 'enabled', budget_tokens: 4000 });
		expect(b.thinking_budget_cap).toBeUndefined();
		// 旧档案 thinking.budget_tokens 也当上限
		expect(applyThinkingLevel({ thinking: { type: 'enabled', budget_tokens: 2048 } }, 'high', 'anthropic', 'claude-sonnet-4-5', 32000).thinking.budget_tokens).toBe(2048);
	});
	test('关闭:剥档案 thinking/output_config;Sonnet 5 / Opus 5 发 disabled;Opus 4.7-4.8 与预算族不发;Fable/Mythos 恒开 → effort low', () => {
		expect(anthropicThinkingOffForm('claude-sonnet-5')).toBe('disabled');
		expect(anthropicThinkingOffForm('claude-opus-4-8')).toBe('omit');
		expect(anthropicThinkingOffForm('claude-fable-5-1')).toBe('always');
		const legacy = { thinking: { type: 'enabled', budget_tokens: 8192 }, output_config: { effort: 'high' }, thinking_budget_cap: 8192, temperature: 0.3 };
		expect(applyThinkingLevel(legacy, 'off', 'anthropic', 'claude-sonnet-5', 32000)).toEqual({ temperature: 0.3, thinking: { type: 'disabled' } });
		expect(applyThinkingLevel(legacy, 'off', 'anthropic', 'claude-opus-4-8', 32000)).toEqual({ temperature: 0.3 });
		expect(applyThinkingLevel(legacy, 'off', 'anthropic', 'claude-haiku-4-5', 32000)).toEqual({ temperature: 0.3 });
		expect(applyThinkingLevel(legacy, 'off', 'anthropic', 'claude-fable-5-1', 32000)).toEqual({ temperature: 0.3, output_config: { effort: 'low' } });
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

describe('[Q-289 裁决 2026-09-18] 思考恒开型号的短调用余量', ()=>{
	it('Fable / Mythos 短调用上限按思考余量放大;Sonnet 5 / Opus 5(可关思考)与 Haiku 不放大', ()=>{
		const { effectiveMaxTokensForModel } = require('../aiAnalysisProviders');
		expect(effectiveMaxTokensForModel('claude-fable-5-1', 900)).toBe(6900);
		expect(effectiveMaxTokensForModel('claude-mythos-5-1', 16)).toBe(6016);
		expect(effectiveMaxTokensForModel('claude-sonnet-5', 900)).toBe(900);
		expect(effectiveMaxTokensForModel('claude-opus-5', 900)).toBe(900);
		expect(effectiveMaxTokensForModel('claude-haiku-4-5-20251001', 900)).toBe(900);
	});
});
