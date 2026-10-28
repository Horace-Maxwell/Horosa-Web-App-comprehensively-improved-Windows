// 无头模式的模型接口档案(只给终端人工命令 ./horosa ai 与环境变量档案用;由 build.js 与 entry.js 一起打进运行时):
//   · 新建档案的缺省值与桌面「新建接口」表单缺省同源(PROVIDER_PRESETS:地址、超时、Anthropic 版本与上限、Ollama 参数);
//   · 列出时只给「密钥有没有」,密钥本身永不出这层;
//   · 连通测试走与对话同一条后端代理(只发一句、要一个字的回答)。
import { PROVIDER_PRESETS, getProviderPreset, getProviderProtocolFamily, cleanProviderBaseUrl } from '../src/utils/aiAnalysisProviders';
import { requestAIAnalysisChat } from '../src/services/aianalysis';

export const PROVIDER_TYPES = Object.keys(PROVIDER_PRESETS);

// 环境变量里常见的各家密钥名(HOROSA_AI_API_KEY 优先;这里是没给它时的后备)
export const PROVIDER_KEY_ENVS = Object.freeze({
	openai: ['OPENAI_API_KEY'], deepseek: ['DEEPSEEK_API_KEY'], anthropic: ['ANTHROPIC_API_KEY'], gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
	openrouter: ['OPENROUTER_API_KEY'], ollama: [], moonshot: ['MOONSHOT_API_KEY'], zhipu: ['ZHIPUAI_API_KEY', 'ZHIPU_API_KEY'],
	siliconflow: ['SILICONFLOW_API_KEY'], groq: ['GROQ_API_KEY'], xai: ['XAI_API_KEY'], custom: [],
});

function presetProviderOptions(providerType){
	const preset = getProviderPreset(providerType);
	const o = { requestTimeoutMs: preset.requestTimeoutMs || 120000 };
	if(providerType === 'anthropic'){
		o.apiVersion = preset.anthropicApiVersion || '2023-06-01';
		if(preset.anthropicMaxTokens){ o.max_tokens = Number(preset.anthropicMaxTokens); }
	}
	if(providerType === 'ollama'){
		o.keep_alive = preset.ollamaKeepAlive || '5m';
		[['num_ctx', preset.ollamaNumCtx], ['num_predict', preset.ollamaNumPredict], ['top_k', preset.ollamaTopK], ['top_p', preset.ollamaTopP], ['repeat_penalty', preset.ollamaRepeatPenalty]]
			.forEach(([k, v])=>{ if(v !== undefined && v !== ''){ o[k] = Number(v); } });
	}
	return o;
}

// 新档案(进存储层前的形状;存储层补齐其余字段并把密钥加密落盘)
export function newProviderProfile(spec){
	const s = spec || {};
	const providerType = `${s.providerType || ''}`.trim().toLowerCase();
	if(!PROVIDER_PRESETS[providerType]){ throw new Error(`不认识的接口类型 ${s.providerType}(可选:${PROVIDER_TYPES.join(' / ')})`); }
	const preset = getProviderPreset(providerType);
	const models = (Array.isArray(s.models) ? s.models : `${s.models || s.model || ''}`.split(/[\s,，]+/)).map((m)=>`${m}`.trim()).filter(Boolean);
	const chat = models.length ? models : (preset.defaultChatModels || []).slice();
	if(!chat.length){ throw new Error(`${preset.label} 没有预设模型:用 --model 指定(如 --model llama3.1)`); }
	const baseUrl = cleanProviderBaseUrl(s.baseUrl) || preset.baseUrl;
	if(!baseUrl){ throw new Error('自定义兼容接口要给地址:--base-url https://…/v1'); }
	const now = new Date().toISOString();
	return {
		id: s.id || `headless-${providerType}-${Date.now().toString(36)}`,
		name: `${s.name || ''}`.trim() || preset.label,
		providerType,
		protocolFamily: getProviderProtocolFamily(providerType),
		apiKey: `${s.apiKey || ''}`.trim(),
		baseUrl,
		manualModels: chat.slice(),
		chatModelIds: chat.slice(),
		embeddingModelIds: [],
		availableModels: chat.slice(),
		enabled: true,
		providerOptions: presetProviderOptions(providerType),
		healthStatus: 'unknown',
		lastDiagnostics: null,
		createdAt: now,
		updatedAt: now,
	};
}

// 对外展示(终端 / 管理口):密钥只报状态
export function redactProfile(p, extra){
	const key = p.apiKeyDecryptFailed ? 'undecryptable' : (`${p.apiKey || ''}`.trim() ? 'set' : 'missing');
	return {
		id: p.id, name: p.name, providerType: p.providerType, baseUrl: p.baseUrl, enabled: p.enabled !== false,
		models: (p.chatModelIds && p.chatModelIds.length ? p.chatModelIds : p.manualModels) || [], key, ...(extra || {}),
	};
}

// 连通测试:与对话同一条后端代理;只要求回一个词,超时 30 秒
export async function pingProvider(profile, model, timeoutMs){
	const t0 = Date.now();
	try{
		const rsp = await requestAIAnalysisChat({
			providerType: profile.providerType, apiKey: profile.apiKey, baseUrl: profile.baseUrl, model,
			providerOptions: { ...(profile.providerOptions || {}), requestTimeoutMs: Number(timeoutMs) > 0 ? Number(timeoutMs) : 30000 },
			messages: [{ role: 'system', content: '连通测试:只回复 OK 两个字母,不要别的。' }, { role: 'user', content: 'ping' }],
		});
		const result = rsp && rsp.Result ? rsp.Result : null;
		const content = result && result.content ? `${result.content}`.trim() : '';
		const errText = rsp && !result ? `${(rsp.ErrorMsg || rsp.message || rsp.Result || '') || '没有回包'}` : '';
		return content ? { ok: true, ms: Date.now() - t0, content: content.slice(0, 200), model } : { ok: false, ms: Date.now() - t0, error: errText || '模型没有返回内容', model };
	}catch(e){
		return { ok: false, ms: Date.now() - t0, error: `${e && e.message ? e.message : e}`.slice(0, 300), model };
	}
}
