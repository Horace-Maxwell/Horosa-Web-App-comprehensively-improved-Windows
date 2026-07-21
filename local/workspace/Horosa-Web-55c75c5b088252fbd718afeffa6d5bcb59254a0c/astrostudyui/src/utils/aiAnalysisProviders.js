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
		// 2026-07 现役:gpt-5.6 家族(sol/terra/luna,gpt-5.6=sol 别名)7/9 GA;5.5 仍在价表。
		defaultChatModels: ['gpt-5.6', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-4.1-mini'],
		defaultEmbeddingModels: ['text-embedding-3-small'],
		requestTimeoutMs: 120000,
	},
	deepseek: {
		label: 'DeepSeek',
		protocolFamily: 'openai-compatible',
		baseUrl: 'https://api.deepseek.com',
		// 2026-07 现役:deepseek-v4-flash/pro;deepseek-chat/reasoner 为其别名(官方 2026-07-24 弃用,暂留兼容)。
		defaultChatModels: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
	},
	anthropic: {
		label: 'Anthropic',
		protocolFamily: 'anthropic',
		baseUrl: 'https://api.anthropic.com',
		// 2026-07 现役四档(此前种子为空=新建档下拉空白):Fable 5 / Opus 4.8 / Sonnet 5 / Haiku 4.5。
		defaultChatModels: ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
		defaultEmbeddingModels: [],
		requestTimeoutMs: 120000,
		anthropicApiVersion: '2023-06-01',
		// 新建档默认 8192(旧默认 2048 对报告级长文常触截断续写):仅新档预设,已存档字段不动。
		anthropicMaxTokens: '8192',
		anthropicThinkingBudget: '',
		anthropicTopP: '',
		anthropicTopK: '',
	},
	gemini: {
		label: 'Gemini',
		protocolFamily: 'gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
		// 2026-07 现役:3.1-pro/3.5-flash/3-flash/3.1-flash-lite;2.5 官方 2026-10-16 退役,暂留。
		defaultChatModels: ['gemini-3.1-pro', 'gemini-3.5-flash', 'gemini-3-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
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
		// 新建档默认 2048(旧 1024 报告长节常截断);仅新档预设,已存档不动。
		ollamaNumPredict: '2048',
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
	// DeepSeek(2026-07:chat/reasoner 已是 v4-flash 别名,价随主档)
	{ prefix: 'deepseek-v4-pro', in: 0.000435, out: 0.00087 },
	{ prefix: 'deepseek-v4-flash', in: 0.00014, out: 0.00028 },
	{ prefix: 'deepseek-reasoner', in: 0.00014, out: 0.00028 },
	{ prefix: 'deepseek-chat', in: 0.00014, out: 0.00028 },
	// —— 2026-07 现役代(WebSearch 校核 2026-07-19;价目会漂移,UI 恒标「估算」)——
	// Anthropic Claude 5 / 4.8 代
	{ prefix: 'claude-fable-5', in: 0.010, out: 0.050 },
	{ prefix: 'claude-opus-4-8', in: 0.005, out: 0.025 },
	{ prefix: 'claude-sonnet-5', in: 0.003, out: 0.015 },
	{ prefix: 'claude-haiku-4-5', in: 0.001, out: 0.005 },
	// OpenAI gpt-5.x 代(gpt-5.6=sol 别名)
	{ prefix: 'gpt-5.6-terra', in: 0.0025, out: 0.015 },
	{ prefix: 'gpt-5.6-luna', in: 0.001, out: 0.006 },
	{ prefix: 'gpt-5.6', in: 0.005, out: 0.030 },
	{ prefix: 'gpt-5.5-pro', in: 0.030, out: 0.180 },
	{ prefix: 'gpt-5.5', in: 0.005, out: 0.030 },
	{ prefix: 'gpt-5.1', in: 0.00125, out: 0.010 },
	// Gemini 3.x 代
	{ prefix: 'gemini-3.1-pro', in: 0.002, out: 0.012 },
	{ prefix: 'gemini-3.5-flash', in: 0.0015, out: 0.009 },
	{ prefix: 'gemini-3.1-flash-lite', in: 0.00025, out: 0.0015 },
	{ prefix: 'gemini-3-flash', in: 0.0005, out: 0.003 },
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

// 推理模型的有效输出预算:思考 token 计入 max_tokens——上限过小会被思考吃光(finish=length、
// 正文 0 字)。给足思考余量:正文预算翻倍且至少 +6000,封顶 16384。max_tokens 是上限不是目标,
// 自然 stop 不多花钱,只防被思考截没。报告管线与聊天路径共用此单源。
// [挂载预算] 现役模型上下文窗口(tokens,输入侧)。前缀/子串匹配,未知模型返回 null
// (调用方回落保底预算,行为与旧固定常量一致=零回归)。窗口值取各家公开标称。
export const MODEL_CONTEXT_WINDOWS = [
	{ match: 'claude-', tokens: 200000 },
	{ match: 'gpt-5', tokens: 400000 },
	{ match: 'gpt-4.1', tokens: 1000000 },
	{ match: 'gpt-4o', tokens: 128000 },
	{ match: 'o3', tokens: 200000 },
	{ match: 'gemini-', tokens: 1048576 },
	{ match: 'deepseek', tokens: 131072 },
	{ match: 'kimi', tokens: 262144 },
	{ match: 'qwen', tokens: 131072 },
	{ match: 'glm', tokens: 131072 },
	{ match: 'llama', tokens: 131072 },
	{ match: 'mistral', tokens: 131072 },
	{ match: 'grok', tokens: 262144 },
];

export function contextWindowForModel(model){
	const m = `${model || ''}`.toLowerCase().trim();
	if(!m) return null;
	const hit = MODEL_CONTEXT_WINDOWS.find((e)=>m.indexOf(e.match) === 0 || m.indexOf(`/${e.match}`) >= 0 || m.indexOf(`:${e.match}`) >= 0 || m.indexOf(e.match) > 0);
	return hit ? hit.tokens : null;
}

// [挂载预算] 按模型窗口给出「挂载上下文字数预算」(中文密集口径 ≈1.6 字/token):
// - 未知模型 → floorChars 保底(默认 20000,与旧全局常量等值=零回归);
// - Ollama 本地 → numCtx 即真窗口(优先于目录表);小窗口按实算可低于保底,防止
//   往 8k 窗口塞 2 万字被引擎静默截断(这正是本函数要治的病);
// - 大窗口模型 → 上限 capChars(默认 60000 字)封顶,预算翻三倍但成本仍可控。
// 分摊:窗口 1/4(1k..16k)预留输出,余量六成给挂载层(其余给对话/检索/系统)。
export function contextCharBudgetForModel(model, opts = {}){
	const floor = Number(opts.floorChars) > 0 ? Number(opts.floorChars) : 20000;
	const cap = Number(opts.capChars) > 0 ? Number(opts.capChars) : 60000;
	const win = Number(opts.numCtx) > 0 ? Number(opts.numCtx) : contextWindowForModel(model);
	if(!win) return floor;
	const reserveOut = Math.max(1024, Math.min(16384, Math.floor(win / 4)));
	const usable = Math.max(1024, win - reserveOut);
	const chars = Math.floor(usable * 0.6 * 1.6);
	return Math.max(2000, Math.min(cap, chars));
}

export function effectiveMaxTokensForModel(model, maxTokens){
	const mt = Number(maxTokens) || 0;
	if(!mt) return mt;
	const m = `${model || ''}`.toLowerCase();
	// kimi-k2.x 是思考模型但不入 isReasoningModel(其 temperature 钳制在后端代理侧,
	// 进正则会改聊天温度行为);此处仅作「输出预算」判定,scoped 不外溢。
	const reasoning = (!!m && isReasoningModel(m)) || /^kimi-k2/.test(m);
	if(reasoning){
		return Math.min(Math.max(mt * 2, mt + 6000), 16384);
	}
	return mt;
}

// 把通用「思考档」映射进 providerOptions（不破坏既有键）。
// maxTokens（可选）：Anthropic 硬约束 budget_tokens < max_tokens，传入则据此 clamp，防再触发 400。
export function applyThinkingLevel(opts, level, providerType, model, maxTokens){
	if(!level || level === 'off'){
		return opts || {};
	}
	const o = { ...(opts || {}) };
	let budget = THINKING_BUDGET[level] || THINKING_BUDGET.medium;
	// [E2] 思考预算自定义数值档:'custom:<n>'(或直接数字)→ budget=clamp(1024..65536);
	// effort 类接口(OpenAI reasoning_effort)按数值折档。非法数值 → 落回 medium(不抛)。
	let effLevel = level;
	const customM = /^custom:(\d+)$/.exec(`${level}`);
	const numLevel = customM ? Number(customM[1]) : (typeof level === 'number' ? level : NaN);
	if(Number.isFinite(numLevel) && numLevel > 0){
		budget = Math.max(1024, Math.min(65536, Math.round(numLevel)));
		effLevel = budget >= 16000 ? 'xhigh' : (budget >= 6000 ? 'medium' : 'low');
	}
	if(providerType === 'anthropic'){
		// Anthropic：budget_tokens 须 ≥1024 且 < max_tokens。输出预算太小 → 放弃思考（否则上游 400）。
		const cap = Number(maxTokens) || 0;
		if(cap && cap <= 1536){ return o; }
		if(cap){ budget = Math.max(1024, Math.min(budget, cap - 512)); }
		o.thinking = { type: 'enabled', budget_tokens: budget };
	}else if(/(^|\/)(gpt-?[567]|o[13-7])/.test(('' + (model || '')).toLowerCase())){
		// OpenAI o/gpt-5+ 系（与 isReasoningModel 的 OpenAI 半边同口径；勿再收窄——曾漏 gpt-6/7、o6/7 致思考档静默失效）。
		// reasoning_effort 仅认 low|medium|high → 更高档(xhigh/max)封顶为 high;custom 数值按 effLevel 折档
		o.reasoning_effort = (effLevel === 'xhigh' || effLevel === 'max') ? 'high' : effLevel;
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
