import { safeLocalStorageSet } from './safeStorage';
const PROVIDER_PRESET_ORDER = [
	'openai',
	'deepseek',
	'anthropic',
	'gemini',
	'openrouter',
	'ollama',
	'moonshot',
	'zhipu',
	'siliconflow',
	'groq',
	'xai',
	'custom',
];

export const PROVIDER_PRESETS = {
	openai: {
		label: 'OpenAI',
		protocolFamily: 'openai-compatible',
		baseUrl: 'https://api.openai.com/v1',
		defaultChatModels: ['gpt-4.1-mini'],
		defaultEmbeddingModels: ['text-embedding-3-small'],
		requestTimeoutMs: 120000,
	},
	deepseek: {
		label: 'DeepSeek',
		protocolFamily: 'openai-compatible',
		baseUrl: 'https://api.deepseek.com',
		defaultChatModels: ['deepseek-chat', 'deepseek-reasoner'],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
	},
	anthropic: {
		label: 'Anthropic',
		protocolFamily: 'anthropic',
		baseUrl: 'https://api.anthropic.com',
		defaultChatModels: [],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
		anthropicApiVersion: '2023-06-01',
		anthropicMaxTokens: '2048',
		anthropicThinkingBudget: '',
		anthropicTopP: '',
		anthropicTopK: '',
	},
	gemini: {
		label: 'Gemini',
		protocolFamily: 'gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
		defaultChatModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
		// text-embedding-004 已于 2026-01-14 关停,官方迁移目标 gemini-embedding-001。
		defaultEmbeddingModels: ['gemini-embedding-001'],
		requestTimeoutMs: 120000,
	},
	openrouter: {
		label: 'OpenRouter',
		protocolFamily: 'openai-compatible',
		baseUrl: 'https://openrouter.ai/api/v1',
		defaultChatModels: [],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
	},
	ollama: {
		label: 'Ollama',
		protocolFamily: 'ollama',
		baseUrl: 'http://127.0.0.1:11434/v1',
		defaultChatModels: [],
		defaultEmbeddingModels: ['bge-m3', 'nomic-embed-text'],
		requestTimeoutMs: 120000,
		ollamaKeepAlive: '5m',
		ollamaNumCtx: '8192',
		ollamaNumPredict: '1024',
		ollamaTopK: '40',
		ollamaTopP: '0.9',
		ollamaRepeatPenalty: '1.1',
	},
	moonshot: {
		label: 'Moonshot / Kimi',
		protocolFamily: 'openai-compatible',
		baseUrl: 'https://api.moonshot.cn/v1',
		// 2026-06 官方现行模型(platform.kimi.com/docs/models):kimi-k2.6/k2.5/k2.7-code + moonshot-v1-*;
		// kimi-k2-* preview 系列已于 2026-05-25 停服(旧默认 kimi-k2-turbo-preview 是「测试连接」400 的来源)。
		defaultChatModels: ['kimi-k2.6', 'kimi-k2.5'],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
	},
	zhipu: {
		label: '智谱 AI',
		protocolFamily: 'openai-compatible',
		baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
		defaultChatModels: [],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
	},
	siliconflow: {
		label: '硅基流动',
		protocolFamily: 'openai-compatible',
		baseUrl: 'https://api.siliconflow.cn/v1',
		defaultChatModels: [],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
	},
	groq: {
		label: 'Groq',
		protocolFamily: 'openai-compatible',
		baseUrl: 'https://api.groq.com/openai/v1',
		defaultChatModels: [],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
	},
	xai: {
		label: 'xAI',
		protocolFamily: 'openai-compatible',
		baseUrl: 'https://api.x.ai/v1',
		defaultChatModels: [],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
	},
	custom: {
		label: '自定义兼容接口',
		protocolFamily: 'openai-compatible',
		baseUrl: '',
		defaultChatModels: [],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
	},
};

export const PROVIDER_OPTIONS = PROVIDER_PRESET_ORDER.map((value)=>({
	value,
	label: PROVIDER_PRESETS[value].label,
}));

function uniqueTextList(list){
	const found = new Set();
	const result = [];
	(list || []).forEach((item)=>{
		const text = `${item || ''}`.trim();
		if(!text || found.has(text)){
			return;
		}
		found.add(text);
		result.push(text);
	});
	return result;
}

export function getProviderPreset(providerType = 'openai'){
	const key = `${providerType || 'openai'}`.trim().toLowerCase();
	return PROVIDER_PRESETS[key] || PROVIDER_PRESETS.openai;
}

export function getProviderDisplayName(providerType = 'openai'){
	return getProviderPreset(providerType).label;
}

export function getProviderProtocolFamily(providerType = 'openai'){
	return getProviderPreset(providerType).protocolFamily;
}

// OpenAI 接口家族判定（openai 自家 + 各家 openai-compatible 网关共用 stop/penalties/response_format 等请求键）。
// 预设里 protocolFamily 实际取值是 'openai-compatible'，散落各处的 `=== 'openai'` 判断永远不成立
// （停止序列/频率·存在惩罚/JSON 模式因此静默失效）—— 一律改走本判定。
export function isOpenAiFamily(protocolFamily){
	const pf = `${protocolFamily || ''}`.trim().toLowerCase();
	return pf === 'openai' || pf === 'openai-compatible';
}

// 模型选择编码：把「接口配置 id」+「模型名」编成单一下拉值 `profileId::model`，
// 供跨接口（多 API key）的统一模型下拉用。AIAnalysisMain 与报告功能共用同一份，避免漂移/循环依赖。
export function encodeModelSelection(profileId, model){
	return `${profileId || ''}::${model || ''}`;
}

export function parseModelSelection(selection){
	const text = `${selection || ''}`;
	const idx = text.indexOf('::');
	if(idx < 0){
		return {
			profileId: '',
			model: text,
		};
	}
	return {
		profileId: text.slice(0, idx),
		model: text.slice(idx + 2),
	};
}


export function getProviderDefaultChatModels(providerType = 'openai'){
	return uniqueTextList(getProviderPreset(providerType).defaultChatModels || []);
}

export function getProviderDefaultEmbeddingModels(providerType = 'openai'){
	return uniqueTextList(getProviderPreset(providerType).defaultEmbeddingModels || []);
}

export function splitProviderModels(models, providerType = 'openai'){
	const presetEmbedding = new Set(getProviderDefaultEmbeddingModels(providerType));
	const allModels = uniqueTextList(models || []);
	const embeddingModels = allModels.filter((item)=>presetEmbedding.has(item) || /(?:^|[-_/])(embedding|embed)(?:$|[-_/])|bge|bce/i.test(item));
	const chatModels = allModels.filter((item)=>embeddingModels.indexOf(item) < 0);
	return {
		chatModels,
		embeddingModels,
		models: allModels,
	};
}

// —— issue #13：聊天高级参数（思考档 + reasoning 模型识别）——
// 思考档：关/低/中/高。前端按 provider/model 映射成各家请求参数，写进 providerOptions（后端零改）。
export const THINKING_LEVELS = [
	{ value: 'off', label: '关闭' },
	{ value: 'low', label: '低' },
	{ value: 'medium', label: '中' },
	{ value: 'high', label: '高' },
	{ value: 'xhigh', label: '极高' },
	{ value: 'max', label: '最大' },
];

const THINKING_BUDGET = { low: 2048, medium: 8192, high: 16000, xhigh: 24576, max: 32768 };

// 模型计价（USD per 1k tokens；in=输入、out=输出）。仅作粗略估算（价目会漂移，UI 上标注「估算」）。
// 命中按"模型名前缀最长匹配"。空表示不展示价格、只展示 tokens。
const MODEL_PRICING = [
	// OpenAI
	{ prefix: 'gpt-4o-mini', in: 0.00015, out: 0.0006 },
	{ prefix: 'gpt-4o', in: 0.0025, out: 0.01 },
	{ prefix: 'gpt-4-turbo', in: 0.01, out: 0.03 },
	{ prefix: 'gpt-4', in: 0.03, out: 0.06 },
	{ prefix: 'gpt-3.5', in: 0.0005, out: 0.0015 },
	{ prefix: 'o3-mini', in: 0.0011, out: 0.0044 },
	{ prefix: 'o1-mini', in: 0.003, out: 0.012 },
	{ prefix: 'o1', in: 0.015, out: 0.06 },
	// Anthropic
	{ prefix: 'claude-3-opus', in: 0.015, out: 0.075 },
	{ prefix: 'claude-3-5-sonnet', in: 0.003, out: 0.015 },
	{ prefix: 'claude-3-5-haiku', in: 0.0008, out: 0.004 },
	{ prefix: 'claude-3-sonnet', in: 0.003, out: 0.015 },
	{ prefix: 'claude-3-haiku', in: 0.00025, out: 0.00125 },
	// Gemini
	{ prefix: 'gemini-2.5-pro', in: 0.00125, out: 0.005 },
	{ prefix: 'gemini-2.5-flash', in: 0.000075, out: 0.0003 },
	{ prefix: 'gemini-2.0-flash', in: 0.00010, out: 0.0004 },
	{ prefix: 'gemini-1.5-pro', in: 0.00125, out: 0.005 },
	{ prefix: 'gemini-1.5-flash', in: 0.000075, out: 0.0003 },
	// DeepSeek
	{ prefix: 'deepseek-reasoner', in: 0.00055, out: 0.00219 },
	{ prefix: 'deepseek-chat', in: 0.00027, out: 0.0011 },
];

export function estimateUsageCost(model, inputTokens, outputTokens){
	const m = ('' + (model || '')).toLowerCase();
	if(!m){ return null; }
	const slash = m.lastIndexOf('/');
	const bare = slash >= 0 ? m.substring(slash + 1) : m;
	let best = null;
	for(const item of MODEL_PRICING){
		if(bare.indexOf(item.prefix) === 0){
			if(!best || item.prefix.length > best.prefix.length){ best = item; }
		}
	}
	if(!best){ return null; }
	const inT = Number(inputTokens) || 0;
	const outT = Number(outputTokens) || 0;
	const cost = (inT / 1000) * best.in + (outT / 1000) * best.out;
	return { cost, currency: 'USD' };
}

// reasoning 模型（自带思考、拒绝 temperature）——与后端 isOpenAIReasoningModel 同步。
// 已覆盖 OpenAI o1/o3/o4/o5/o6/o7 + gpt-5/6/7 系列 + DeepSeek reasoner / *-r1 / 通用 thinking 命名。
export function isReasoningModel(model){
	const m = ('' + (model || '')).toLowerCase();
	return /(^|\/)(gpt-?[567]|o[13-7])/.test(m) || /reasoner|-?r1\b|thinking/.test(m);
}

// 把通用「思考档」映射进 providerOptions（不破坏既有键）。
// maxTokens（可选）：Anthropic 硬约束 budget_tokens < max_tokens，传入则据此 clamp，防再触发 400。
export function applyThinkingLevel(opts, level, providerType, model, maxTokens){
	if(!level || level === 'off'){
		return opts || {};
	}
	const o = { ...(opts || {}) };
	let budget = THINKING_BUDGET[level] || THINKING_BUDGET.medium;
	if(providerType === 'anthropic'){
		// Anthropic：budget_tokens 须 ≥1024 且 < max_tokens。输出预算太小 → 放弃思考（否则上游 400）。
		const cap = Number(maxTokens) || 0;
		if(cap && cap <= 1536){ return o; }
		if(cap){ budget = Math.max(1024, Math.min(budget, cap - 512)); }
		o.thinking = { type: 'enabled', budget_tokens: budget };
	}else if(/(^|\/)(gpt-?[567]|o[13-7])/.test(('' + (model || '')).toLowerCase())){
		// OpenAI o/gpt-5+ 系（与 isReasoningModel 的 OpenAI 半边同口径；勿再收窄——曾漏 gpt-6/7、o6/7 致思考档静默失效）。
		// reasoning_effort 仅认 low|medium|high → 更高档(xhigh/max)封顶为 high
		o.reasoning_effort = (level === 'xhigh' || level === 'max') ? 'high' : level;
	}else if(providerType === 'gemini'){
		// #54-G：includeThoughts=true 才让 Gemini 回流 thought part(思考增量)；缺它则预算照烧但思维链不出 →
		// 后端 extractGeminiThinking 恒空、UI 无「思考过程」。开思考档即请求思维摘要,与 OpenAI/Anthropic 同口径。
		o.generationConfig = { ...(o.generationConfig || {}), thinkingConfig: { thinkingBudget: budget, includeThoughts: true } };
	}
	// deepseek-reasoner(R1) / ollama 等无标准思考参数 → 不动（友好降级）。
	return o;
}

// 报告思考档的轻量持久化（localStorage）。
const THINKING_LS_KEY = 'horosa.report.thinkingLevel';
export function getPersistedThinkingLevel(){
	try{ return localStorage.getItem(THINKING_LS_KEY) || 'off'; }catch(_){ return 'off'; }
}
export function setPersistedThinkingLevel(v){
	try{ safeLocalStorageSet(THINKING_LS_KEY, v || 'off'); }catch(_){}
}
