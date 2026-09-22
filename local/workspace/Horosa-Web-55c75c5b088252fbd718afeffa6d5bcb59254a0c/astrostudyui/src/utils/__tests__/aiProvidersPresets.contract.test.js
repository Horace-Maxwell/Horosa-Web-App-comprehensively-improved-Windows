// [D63] 供应商预设表驱动合同:十二家预设形状(标签/协议家族/缺省聊天模型)、计价表命中(有价目的家族缺省模型必须能估价)、
//   超时缺省为正;思考档映射对每家缺省模型不抛。此前 8 家 defaultChatModels / 11 家 embedding / 44 行价目零断言。
import { PROVIDER_PRESETS, PROVIDER_OPTIONS, getProviderPreset, getProviderDefaultChatModels, getProviderDefaultEmbeddingModels, getProviderProtocolFamily, estimateUsageCost, applyThinkingLevel, THINKING_LEVELS, isDeepseekV4Model, anthropicThinkingOffForm } from '../aiAnalysisProviders';

const FAMILIES = ['openai-compatible', 'openai', 'anthropic', 'gemini', 'ollama'];
// 有官方价目的家族:缺省首模型必须命中价目表(估价 > 0);其余(本地/中转/自定义)允许无价目
const PRICED = ['openai', 'deepseek', 'anthropic', 'gemini'];
// 自带缺省聊天模型清单的家族;中转/本地/聚合口(openrouter/ollama/zhipu/siliconflow/groq/xai/custom)由用户拉取或手填,允许为空
const WITH_DEFAULT_MODELS = ['openai', 'deepseek', 'anthropic', 'gemini', 'moonshot'];
const usdOf = (c)=>(typeof c === 'number' ? c : Number(c && (c.total !== undefined ? c.total : (c.usd !== undefined ? c.usd : (c.cost !== undefined ? c.cost : c.totalUsd)))));

it('🔴 每家预设:标签非空、协议家族在枚举内、缺省聊天模型非空、超时为正;下拉选项与预设表同键集', ()=>{
	const keys = Object.keys(PROVIDER_PRESETS);
	expect(keys.length).toBeGreaterThanOrEqual(10);
	keys.forEach((k)=>{
		const p = getProviderPreset(k);
		expect(`${p.label || ''}`.length).toBeGreaterThan(0);
		expect(FAMILIES).toContain(getProviderProtocolFamily(k));
		expect(Array.isArray(getProviderDefaultChatModels(k))).toBe(true);
		if(WITH_DEFAULT_MODELS.indexOf(k) >= 0){ expect(getProviderDefaultChatModels(k).length).toBeGreaterThan(0); }
		expect(Array.isArray(getProviderDefaultEmbeddingModels(k))).toBe(true);
		if(p.requestTimeoutMs !== undefined){ expect(p.requestTimeoutMs).toBeGreaterThan(0); }
		if(k !== 'custom' && k !== 'ollama'){ expect(`${p.baseUrl || ''}`).toMatch(/^https?:\/\//); }
	});
	expect(PROVIDER_OPTIONS.map((o)=>o.value).sort()).toEqual(keys.sort());
});

it('🔴 有价目家族的缺省首模型必须能估价(>0);缓存命中价不高于未命中', ()=>{
	PRICED.forEach((k)=>{
		const model = getProviderDefaultChatModels(k)[0];
		const cost = usdOf(estimateUsageCost(model, 1000, 1000));
		expect(cost > 0).toBe(true);
		// 缓存语义按家族:Anthropic 的 cacheRead 是额外读入的 token(叠加计价,单价打折)⇒ 比同量未命中便宜;
		// 其它家族 cacheRead ⊆ prompt(命中部分打折)⇒ 不高于全未命中
		if(k === 'anthropic'){
			const withCache = usdOf(estimateUsageCost(model, 1000, 1000, { cacheRead: 1000, family: 'anthropic' }));
			const uncached = usdOf(estimateUsageCost(model, 2000, 1000));
			expect(withCache < uncached).toBe(true);
		}else{
			const cached = usdOf(estimateUsageCost(model, 1000, 1000, { cacheRead: 1000, family: k }));
			expect(cached <= cost).toBe(true);
		}
	});
});

it('思考档映射对每家缺省首模型不抛;off 档的按家形态(DeepSeek v4 disabled / Anthropic 按型号 / 其余原样)', ()=>{
	Object.keys(PROVIDER_PRESETS).forEach((k)=>{
		const model = getProviderDefaultChatModels(k)[0] || 'model-x';
		THINKING_LEVELS.forEach((lv)=>{
			const level = typeof lv === 'string' ? lv : (lv && lv.value);
			expect(()=>applyThinkingLevel({ max_tokens: 1000 }, level, k, model, 4000)).not.toThrow();
		});
		const off = applyThinkingLevel({ a: 1 }, 'off', k, model);
		if(isDeepseekV4Model(model, k)){
			expect(off.thinking).toEqual({ type: 'disabled' });
		}else if(k === 'anthropic'){
			// [Q-050/M-55] Anthropic 关闭档按官方每型号表:Sonnet 5 / Opus 5 发 disabled;Opus 4.7-4.8 与预算族不发字段;
			//   Fable / Mythos 思考恒开不可关 → 不发 thinking、改 output_config.effort='low'。其余键原样。
			expect(off.a).toBe(1);
			const mode = anthropicThinkingOffForm(model);
			if(mode === 'disabled'){ expect(off.thinking).toEqual({ type: 'disabled' }); expect(off.output_config).toBeUndefined(); }
			else if(mode === 'always'){ expect(off.thinking).toBeUndefined(); expect(off.output_config).toEqual({ effort: 'low' }); }
			else { expect(off.thinking).toBeUndefined(); expect(off.output_config).toBeUndefined(); }
		}else{
			expect(off).toEqual({ a: 1 });
		}
		if(k === 'deepseek'){ expect(isDeepseekV4Model(model, k)).toBe(true); }   // deepseek 缺省首模型必须走思考开关(否则 JSON 短调用被思考吃光)
	});
});
