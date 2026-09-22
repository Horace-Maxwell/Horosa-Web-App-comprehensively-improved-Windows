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
		// 2026-09-11 真模型实测:官方 /models 已改列 deepseek-flash(去掉 v4 字样)+ deepseek-v4-pro,故把新名放首位。
		defaultChatModels: ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'],
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

// [Q-323] temperature 的**上限按接口家族**分:Anthropic Messages API 是 0..1,OpenAI / Gemini / Ollama 是 0..2。
// 参数浮层滑杆、报告采样、路由槽此前一律按 0..2 钳,拨到 >1 的档发给 Anthropic 必 400 —— 只靠「自愈剥参重发」
// 兜住(每请求最多 2 轮),等于白付一次往返且用户设的值被整个丢掉。单源在此,三处入口共用。
export const TEMPERATURE_MAX_DEFAULT = 2;
export const TEMPERATURE_MAX_BY_FAMILY = { anthropic: 1 };
export function temperatureMaxForFamily(protocolFamily){
	const pf = `${protocolFamily || ''}`.trim().toLowerCase();
	return Object.prototype.hasOwnProperty.call(TEMPERATURE_MAX_BY_FAMILY, pf) ? TEMPERATURE_MAX_BY_FAMILY[pf] : TEMPERATURE_MAX_DEFAULT;
}
// 非有限值原样返回(null/undefined = 未拨 = 不下发,不得被钳成 0)
export function clampTemperatureForFamily(temperature, protocolFamily){
	const n = Number(temperature);
	if(temperature === null || temperature === undefined || temperature === '' || !Number.isFinite(n)){ return temperature; }
	const max = temperatureMaxForFamily(protocolFamily);
	return n < 0 ? 0 : (n > max ? max : n);
}

// [Q-045] 参数浮层五类参数的**单源**施加:温度(按家族夹逼)· top_p · 停止序列 · 频率/存在惩罚 · JSON 模式。
// 主发送与三条旁路(多模型候选 / 按审阅重写 / 旁问)共用 —— 此前三处各写一小段,只套了「思考档 + 温度 + top_p」,
// 停止序列、两惩罚、JSON 模式在这三条路上全是死的(浮层里拨了,请求体里没有)。
// withJsonMode=false:调用方自己要挂 response_format(结构化审阅 / 判官)时不让 JSON 模式来抢这把键。
export function applyChatParams(opts, params){
	const p = params || {};
	const o = { ...(opts || {}) };
	const profile = p.profile || null;
	const model = p.model || '';
	const family = p.protocolFamily || (profile && (profile.protocolFamily || getProviderProtocolFamily(profile.providerType))) || 'openai-compatible';
	const reasoning = isReasoningModel(model);
	if(!reasoning && p.temperature !== null && p.temperature !== undefined){ o.temperature = clampTemperatureForFamily(p.temperature, family); }
	// 推理型号的 top_p 在出口被剥,不写进请求体(与浮层置灰同口径)
	if(!reasoning && p.topP !== null && p.topP !== undefined){ o.top_p = p.topP; }
	const stopList = `${p.stopSequences || ''}`.split(/[\n,，]/g).map((x)=>x.trim()).filter(Boolean);
	if(stopList.length){
		if(family === 'anthropic'){ o.stop_sequences = stopList; }
		else{ o.stop = stopList; }
	}
	if(isOpenAiFamily(family) && !reasoning){
		if(typeof p.frequencyPenalty === 'number'){ o.frequency_penalty = p.frequencyPenalty; }
		if(typeof p.presencePenalty === 'number'){ o.presence_penalty = p.presencePenalty; }
	}
	if(p.jsonMode && p.withJsonMode !== false && (isOpenAiFamily(family) || family === 'gemini')){
		o.response_format = { type: 'json_object' };
	}
	return o;
}

// 模型选择编码：把「接口配置 id」+「模型名」编成单一下拉值 `profileId::model`，
// 供跨接口（多 API key）的统一模型下拉用。各调用方共用同一份，避免漂移/循环依赖。
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
// 可选 cacheIn=缓存命中读价、cacheWrite=缓存写入价(同单位):缺位时 estimateUsageCost 按家族比例兜底
// (anthropic 读 0.1×in / 写 1.25×in;openai 家族读=in 即不打折),无缓存计量的请求仍走旧公式。
const MODEL_PRICING = [
	// OpenAI
	{ prefix: 'gpt-4o-mini', in: 0.00015, out: 0.0006 },
	{ prefix: 'gpt-4o', in: 0.0025, out: 0.01 },
	{ prefix: 'gpt-4-turbo', in: 0.01, out: 0.03 },
	// [Q-043/M-54] gpt-4.1 家族此前无价档 → 前缀最长匹配落到 `gpt-4`($30/$60 的初代价),费用估算高一个数量级
	{ prefix: 'gpt-4.1-nano', in: 0.0001, out: 0.0004 },
	{ prefix: 'gpt-4.1-mini', in: 0.0004, out: 0.0016 },
	{ prefix: 'gpt-4.1', in: 0.002, out: 0.008 },
	{ prefix: 'gpt-4', in: 0.03, out: 0.06 },
	{ prefix: 'gpt-3.5', in: 0.0005, out: 0.0015 },
	{ prefix: 'o3-mini', in: 0.0011, out: 0.0044 },
	{ prefix: 'o1-mini', in: 0.003, out: 0.012 },
	{ prefix: 'o1', in: 0.015, out: 0.06 },
	// Anthropic(缓存读=0.1×in / 写=1.25×in,官方比例)
	{ prefix: 'claude-3-opus', in: 0.015, out: 0.075, cacheIn: 0.0015, cacheWrite: 0.01875 },
	{ prefix: 'claude-3-5-sonnet', in: 0.003, out: 0.015, cacheIn: 0.0003, cacheWrite: 0.00375 },
	{ prefix: 'claude-3-5-haiku', in: 0.0008, out: 0.004, cacheIn: 0.00008, cacheWrite: 0.001 },
	{ prefix: 'claude-3-sonnet', in: 0.003, out: 0.015, cacheIn: 0.0003, cacheWrite: 0.00375 },
	{ prefix: 'claude-3-haiku', in: 0.00025, out: 0.00125, cacheIn: 0.00003, cacheWrite: 0.0003 },
	// Gemini
	{ prefix: 'gemini-2.5-pro', in: 0.00125, out: 0.005 },
	// [Q-043/M-54] 2.5 Flash 官方 $0.30/$2.50 per 1M(此前照抄 1.5 Flash 的 $0.075/$0.30,低了 4~8 倍)
	{ prefix: 'gemini-2.5-flash', in: 0.0003, out: 0.0025 },
	{ prefix: 'gemini-2.0-flash', in: 0.00010, out: 0.0004 },
	{ prefix: 'gemini-1.5-pro', in: 0.00125, out: 0.005 },
	{ prefix: 'gemini-1.5-flash', in: 0.000075, out: 0.0003 },
	// DeepSeek(2026-07:chat/reasoner 已是 v4-flash 别名,价随主档;缓存命中价=未命中的 1/10,官方比例)
	{ prefix: 'deepseek-v4-pro', in: 0.000435, out: 0.00087, cacheIn: 0.0000435 },
	{ prefix: 'deepseek-v4-flash', in: 0.00014, out: 0.00028, cacheIn: 0.000014 },
	// 2026-09 官方去 v4 字样的新名(deepseek-flash / deepseek-pro):价随同档
	{ prefix: 'deepseek-pro', in: 0.000435, out: 0.00087, cacheIn: 0.0000435 },
	{ prefix: 'deepseek-flash', in: 0.00014, out: 0.00028, cacheIn: 0.000014 },
	{ prefix: 'deepseek-reasoner', in: 0.00014, out: 0.00028, cacheIn: 0.000014 },
	{ prefix: 'deepseek-chat', in: 0.00014, out: 0.00028, cacheIn: 0.000014 },
	// —— 2026-07 现役代(WebSearch 校核 2026-07-19;价目会漂移,UI 恒标「估算」)——
	// Anthropic Claude 5 / 4.8 代(缓存读=0.1×in / 写=1.25×in)
	{ prefix: 'claude-fable-5', in: 0.010, out: 0.050, cacheIn: 0.001, cacheWrite: 0.0125 },
	{ prefix: 'claude-opus-4-8', in: 0.005, out: 0.025, cacheIn: 0.0005, cacheWrite: 0.00625 },
	// [Q-043/M-54] Sonnet 5 官方 $2/$10 per 1M(此前照抄 Sonnet 4 的 $3/$15)
	{ prefix: 'claude-sonnet-5', in: 0.002, out: 0.010, cacheIn: 0.0002, cacheWrite: 0.0025 },
	{ prefix: 'claude-haiku-4-5', in: 0.001, out: 0.005, cacheIn: 0.0001, cacheWrite: 0.00125 },
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

// 第四参 extra(可选){ cacheRead, cacheWrite, family }:带缓存计量时按家族分式计价——
// - anthropic:input_tokens 不含缓存部分 → in·p + read·cacheIn + write·cacheWrite;
// - 其余(openai 家族含 DeepSeek,prompt_tokens 已含 cached)→ (in−read)·p + read·cacheIn(缺价档=不打折)。
// 无 extra / 无缓存计量 / 无价档:与旧公式逐位相同。cacheSavings=相对全价的节省(可为负:写入贵于读)。
export function estimateUsageCost(model, inputTokens, outputTokens, extra){
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
	const read = extra && Number(extra.cacheRead) > 0 ? Number(extra.cacheRead) : 0;
	const write = extra && Number(extra.cacheWrite) > 0 ? Number(extra.cacheWrite) : 0;
	const p = best.in;
	let inputCost = (inT / 1000) * p;
	let cacheSavings = 0;
	if(read || write){
		const fam = `${(extra && extra.family) || ''}`.trim().toLowerCase();
		if(fam === 'anthropic'){
			const cacheIn = Number.isFinite(best.cacheIn) ? best.cacheIn : p * 0.1;
			const cacheWrite = Number.isFinite(best.cacheWrite) ? best.cacheWrite : p * 1.25;
			inputCost = (inT / 1000) * p + (read / 1000) * cacheIn + (write / 1000) * cacheWrite;
			cacheSavings = ((inT + read + write) / 1000) * p - inputCost;
		}else{
			const cacheIn = Number.isFinite(best.cacheIn) ? best.cacheIn : p;
			const hit = Math.min(read, inT);   // 命中数不可能超过 prompt 总数(上游异常值钳住,防负值)
			inputCost = ((inT - hit) / 1000) * p + (hit / 1000) * cacheIn;
			cacheSavings = (inT / 1000) * p - inputCost;
		}
	}
	const cost = inputCost + (outT / 1000) * best.out;
	return { cost, currency: 'USD', cacheSavings };
}

// reasoning 模型（自带思考、拒绝 temperature）——与后端 isOpenAIReasoningModel 同步。
// 已覆盖 OpenAI o1/o3/o4/o5/o6/o7 + gpt-5/6/7 系列 + DeepSeek reasoner / *-r1 / 通用 thinking 命名。
export function isReasoningModel(model){
	const m = ('' + (model || '')).toLowerCase();
	return /(^|\/)(gpt-?[567]|o[13-7])/.test(m) || /reasoner|-?r1\b|thinking/.test(m);
}

// OpenAI **代际**判据（窄于 isReasoningModel：只认 OpenAI 自家 o 系与 gpt-5/6/7，
// 不含 deepseek-reasoner/*-r1——后者仍用 max_tokens）。与后端 isOpenAIReasoningModel 同口径。
export function isOpenAIReasoningModel(model){
	let m = ('' + (model || '')).toLowerCase().trim();
	const slash = m.lastIndexOf('/');
	if(slash >= 0){ m = m.slice(slash + 1); }   // 剥 openrouter 之类的 vendor 前缀
	return /^(gpt-?[567]|o[13-7])/.test(m);
}

// 🔴 输出预算键单一真值源（#54）：键名由「协议家族 × 模型代际」双因子决定。
// gpt-5/6/7 与 o 系已不收 max_tokens（400 unsupported_parameter），须 max_completion_tokens。
// 此前前端只按协议家族选键、后端按代际选键却读不到前端的值 → 分层错位，裸 max_tokens 上线。
export function maxTokensKeyForModel(protoFamily, model){
	if(protoFamily === 'anthropic'){ return 'max_tokens'; }
	if(protoFamily === 'gemini'){ return 'maxOutputTokens'; }
	if(protoFamily === 'ollama'){ return 'num_predict'; }
	return isOpenAIReasoningModel(model) ? 'max_completion_tokens' : 'max_tokens';
}

// 推理模型的有效输出预算:思考 token 计入 max_tokens——上限过小会被思考吃光(finish=length、
// 正文 0 字)。给足思考余量:正文预算翻倍且至少 +6000,封顶 16384。max_tokens 是上限不是目标,
// 自然 stop 不多花钱,只防被思考截没。各调用路径共用此单源。
// [挂载预算] 现役模型上下文窗口(tokens,输入侧)。前缀/子串匹配,未知模型返回 null
// (调用方回落保底预算,行为与旧固定常量一致=零回归)。窗口值取各家公开标称。
export const MODEL_CONTEXT_WINDOWS = [
	// [Q-043/M-54] contextWindowForModel 取**数组里第一条命中**(不是最长匹配),所以细分档必须排在
	// 兜底的 `claude-` 之前;此前 claude 一律按 200K,Sonnet 5 的 1M 窗口被砍成 200K ⇒ 挂载预算凭空少一大截。
	{ match: 'claude-sonnet-5', tokens: 1000000 },
	{ match: 'claude-', tokens: 200000 },
	// [#80] gpt-6 家族(astra 等):用户实测标称 1,050,000。此前表里最新只到 gpt-5,`gpt-6-astra`
	//   对 13 条 match 全不命中 → contextWindowForModel 回 null → 挂载预算掉到地板 20000 字,
	//   四技法均分后西占只剩 4334 字(原始 26085)。放在 gpt-5 之前只为醒目,匹配是子串不依赖顺序。
	{ match: 'gpt-6', tokens: 1050000 },
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
// - 未知模型 → floorChars 保底(默认 24000 = AI_CONTEXT_MAX_CHARS 现值;两处同值但各自独立,故此处不 import 免成环);
// - Ollama 本地 → numCtx 即真窗口(优先于目录表);小窗口按实算可低于保底,防止
//   往 8k 窗口塞 2 万字被引擎静默截断(这正是本函数要治的病);
// - 大窗口模型 → 上限 capChars(默认 120000 字)封顶;
// - opts.explicitChars(用户在「对话上下文策略 → 挂载字数预算」里填的数)一律优先,只夹下限不夹顶。
//   [#80] 硬顶此前 60000:实算下**凡窗口 ≥ 约 78.9k 的模型一律恰好拿到 60000**((win−16384)×0.96 先撞顶),
//   也就是说这个顶就是当今所有主流模型的真实预算。抬到 120000 的判据:用户报障那盘四技法原始量
//   西占 26085 + 印占 26803 + 八字/紫微 ≈ 2 万 ≈ 7.3 万字,扣 15% 尾仓后 120000×0.85=102000 字 ⇒ 一个字不裁。
// 分摊:窗口 1/4(1k..16k)预留输出,余量六成给挂载层(其余给对话/检索/系统)。
export function contextCharBudgetForModel(model, opts = {}){
	// 用户显式指定 → 直接用它(不受模型窗口与 capChars 影响;下限 2000 防填 0/负数把挂载清空)
	const explicit = Number(opts.explicitChars);
	if(explicit > 0){ return Math.max(2000, Math.round(explicit)); }
	const floor = Number(opts.floorChars) > 0 ? Number(opts.floorChars) : 24000;
	const cap = Number(opts.capChars) > 0 ? Number(opts.capChars) : 120000;
	const win = Number(opts.numCtx) > 0 ? Number(opts.numCtx) : contextWindowForModel(model);
	if(!win) return floor;
	const reserveOut = Math.max(1024, Math.min(16384, Math.floor(win / 4)));
	const usable = Math.max(1024, win - reserveOut);
	const chars = Math.floor(usable * 0.6 * 1.6);
	return Math.max(2000, Math.min(cap, chars));
}

// [#80] 挂载字数预算单一入口:策略里填了就用策略的,没填就按模型窗口实算。
//   对话页 / 目标任务 / 报告页三处一律调它 —— 各自散着调 contextCharBudgetForModel 迟早漂成两套口径。
export function mountCharBudgetFor(model, opts = {}){
	const policy = opts.policy && typeof opts.policy === 'object' ? opts.policy : null;
	const explicit = policy && Number(policy.mountCharBudget) > 0 ? Number(policy.mountCharBudget) : Number(opts.explicitChars) || 0;
	return contextCharBudgetForModel(model, { numCtx: opts.numCtx, floorChars: opts.floorChars, capChars: opts.capChars, explicitChars: explicit });
}

export function effectiveMaxTokensForModel(model, maxTokens){
	const mt = Number(maxTokens) || 0;
	if(!mt) return mt;
	const m = `${model || ''}`.toLowerCase();
	// kimi-k 系(k2.x/k3.x 及后续代)是思考模型但不入 isReasoningModel(其 temperature 钳制在
	// 后端代理侧,进正则会改聊天温度行为);此处仅作「输出预算」判定,scoped 不外溢。
	// 🔴 教训(Windows #47):勿写死单一代号(曾写 ^kimi-k2,k3 一出即漏)——一律认「kimi-k+数字」。
	// [Q-289 裁决 2026-09-18] Anthropic 思考恒开型号(Fable / Mythos:关闭档只能 effort:low,思考 token 仍占 max_tokens)同享余量,
	// 否则报告短调用 16–900 的上限被思考吃光 → 空结论 / JSON 不可解析;Sonnet 5 / Opus 5 关闭档真能关思考,不放大。
	const reasoning = (!!m && isReasoningModel(m)) || /^kimi-k\d/.test(m) || anthropicThinkingOffForm(m) === 'always';
	if(reasoning){
		return Math.min(Math.max(mt * 2, mt + 6000), 16384);
	}
	return mt;
}

// 把通用「思考档」映射进 providerOptions（不破坏既有键）。
// maxTokens（可选）：Anthropic 硬约束 budget_tokens < max_tokens，传入则据此 clamp，防再触发 400。
// [D66] DeepSeek v4 系(deepseek-v4-flash/pro)有标准思考开关 thinking:{type:'enabled'|'disabled'}(真模型实测:缺省思考会把
//   max_tokens 吃光 → finish=length、正文空;reasoning_effort 对它无效)。思考档 off ⇒ 显式 disabled(否则「关思考」等于没关),
//   非 off ⇒ enabled。只认 deepseek-v4 前缀(旧别名 deepseek-chat/reasoner 不动 = 零回归)。
//   [2026-09-11 真模型实抓] 官方 /models 已把 v4-flash 改名 deepseek-flash(无 v4 字样):旧判定漏过它 → 思考档 off 不再下发
//   thinking:disabled → 判官/审阅等 JSON 短调用的 max_tokens 被 reasoning_content 吃光、正文空 → 「unparseable」/「没有返回合法 JSON」。
//   故 deepseek 供应商下 deepseek-flash / deepseek-pro(及带日期/后缀的变体)一并按 v4 系认;旧别名 chat/reasoner 仍不动。
//   [Q-327 裁决 2026-09-18] 网关转发的前缀名(openrouter `deepseek/deepseek-v4-flash`、siliconflow `deepseek-ai/DeepSeek-V4-Pro`)此前不被识别 →
//   思考档对它们静默失效(关不掉思考)。改为剥厂商前缀后识别;带 deepseek / deepseek-ai 厂商前缀者视同官方档(flash / pro 新名亦认)。
//   字段形态按网关分派(见 applyDeepseekThinking):官方与 openai 兼容档 thinking:{type};openrouter 只认 reasoning:{enabled,effort};
//   siliconflow 用 enable_thinking / thinking_budget。custom 档按官方形态(走 OpenRouter / SiliconFlow 请选对应预设)。
export function isDeepseekV4Model(model, providerType){
	const raw = `${model || ''}`.toLowerCase();
	const m = raw.replace(/^.*\//, '');
	if(/^deepseek-v4/.test(m)){ return true; }
	const vendorPrefixed = /(^|\/)deepseek(?:-ai)?\/[^/]+$/.test(raw);
	if(providerType !== 'deepseek' && !vendorPrefixed){ return false; }
	return /^deepseek-v[4-9]/.test(m) || /^deepseek-(flash|pro)(?:$|[-_.:@0-9])/.test(m);
}
// [Q-327] DeepSeek v4 思考开关按网关出字段:on=false 关、true 开;effLevel/budget 只在开档使用。
function applyDeepseekThinking(o, on, effLevel, providerType, budget){
	if(providerType === 'openrouter'){
		// OpenRouter 统一推理参数:reasoning:{enabled, effort};不认 thinking。effort 只收 low|medium|high(更高档封顶 high)。
		if(!on){ o.reasoning = { enabled: false }; return o; }
		const eff = (effLevel === 'xhigh' || effLevel === 'max') ? 'high' : ((effLevel === 'low' || effLevel === 'high') ? effLevel : 'medium');
		o.reasoning = { enabled: true, effort: eff };
		return o;
	}
	if(providerType === 'siliconflow'){
		// SiliconFlow:enable_thinking + thinking_budget(128..32768)。
		o.enable_thinking = !!on;
		if(on){ o.thinking_budget = Math.max(128, Math.min(32768, Math.round(Number(budget) || THINKING_BUDGET.medium))); }
		else{ delete o.thinking_budget; }
		return o;
	}
	o.thinking = { type: on ? 'enabled' : 'disabled' };
	return o;
}
// [Q-024/M-35/M-98] Anthropic 思考形态按型号(官方每型号表):
//   'adaptive' = Opus 4.7 起(4.7/4.8/5)、Sonnet 5、Fable 5/5.1、Mythos 5/5.1 —— thinking:{type:'adaptive'} + output_config.effort,不接受采样参数;
//   'budget'   = Haiku 4.5、Sonnet 4.x、Opus 4.6 及更早、Claude 3.x —— thinking:{type:'enabled',budget_tokens},max_tokens 须 > budget。
export function anthropicThinkingMode(model){
	const m = `${model || ''}`.toLowerCase().replace(/^.*\//, '');
	if(!m){ return 'budget'; }
	if(/^claude-(fable|mythos)/.test(m)){ return 'adaptive'; }
	const mm = /^claude-(opus|sonnet|haiku)-(\d+)(?:[-.](\d+))?/.exec(m);
	if(!mm){ return 'budget'; }
	const fam = mm[1]; const major = Number(mm[2]); const minor = mm[3] !== undefined ? Number(mm[3]) : 0;
	if(major >= 5){ return fam === 'haiku' ? 'budget' : 'adaptive'; }
	if(fam === 'opus' && major === 4 && minor >= 7){ return 'adaptive'; }
	return 'budget';
}
// 「关闭」语义(Q-050 ①):Fable/Mythos 思考恒开不可关(省略字段 + effort 最低);Opus 4.7/4.8 缺省关不发字段;
// Sonnet 5 / Opus 5 可发 disabled;预算型号不发字段。
export function anthropicThinkingOffForm(model){
	const m = `${model || ''}`.toLowerCase().replace(/^.*\//, '');
	if(/^claude-(fable|mythos)/.test(m)){ return 'always'; }
	if(anthropicThinkingMode(m) !== 'adaptive'){ return 'omit'; }
	const mm = /^claude-(opus|sonnet)-(\d+)/.exec(m);
	if(mm && Number(mm[2]) >= 5){ return 'disabled'; }
	return 'omit';   // opus 4.7 / 4.8:缺省关
}
const ANTHROPIC_EFFORT_BY_LEVEL = { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' };
function stripAnthropicThinkingKeys(o){
	delete o.thinking; delete o.output_config; delete o.thinking_budget_cap;
	return o;
}
export function applyThinkingLevel(opts, level, providerType, model, maxTokens){
	if(!level || level === 'off'){
		if(isDeepseekV4Model(model, providerType)){ return applyDeepseekThinking({ ...(opts || {}) }, false, 'off', providerType, 0); }
		if(providerType === 'anthropic'){
			// [Q-063/M-65] 关闭档一律不带档案里的 thinking(旧档 budget 形态曾在关闭档强开思考);按型号给「关闭」形态。
			const o0 = stripAnthropicThinkingKeys({ ...(opts || {}) });
			const off = anthropicThinkingOffForm(model);
			if(off === 'disabled'){ o0.thinking = { type: 'disabled' }; }
			else if(off === 'always'){ o0.output_config = { effort: 'low' }; }
			return o0;
		}
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
	if(isDeepseekV4Model(model, providerType)){ return applyDeepseekThinking(o, true, effLevel, providerType, budget); }   // [Q-327] 按网关出字段(档位 / 预算已折算)
	if(providerType === 'anthropic'){
		const profileCap = Number(o.thinking_budget_cap) || (o.thinking && Number(o.thinking.budget_tokens)) || 0;   // [Q-063] 档案预算上限
		stripAnthropicThinkingKeys(o);
		if(anthropicThinkingMode(model) === 'adaptive'){
			// [Q-024/M-35] 自适应型号:thinking:{type:'adaptive'} + output_config.effort(档位映射);预算键对其无意义
			o.thinking = { type: 'adaptive' };
			o.output_config = { effort: ANTHROPIC_EFFORT_BY_LEVEL[effLevel] || 'medium' };
			return o;
		}
		// 预算型号:budget_tokens 须 ≥1024 且 < max_tokens。输出预算太小 → 放弃思考(否则上游 400)。
		const cap = Number(maxTokens) || 0;
		if(cap && cap <= 1536){ return o; }
		if(cap){ budget = Math.max(1024, Math.min(budget, cap - 512)); }
		if(profileCap >= 1024){ budget = Math.min(budget, profileCap); }
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

// [Q-044] 思考档「哪些档对当前模型真有差别」——**由 applyThinkingLevel 自证**,不另维护一张会漂的表:
// 逐档跑一遍、只取思考相关键做指纹,指纹与前面某档相同即「无差异」,浮层据此置灰并在 title 里写明等同哪一档。
// 现实里的三类无差异:① OpenAI o/gpt-5 系的 reasoning_effort 只认 low|medium|high ⇒ 极高/最大 == 高;
// ② DeepSeek V4 系只有 enabled/disabled 两态 ⇒ 五个非关闭档彼此相同;
// ③ Ollama / DeepSeek reasoner(R1)等无标准思考参数 ⇒ 所有档都等于「关闭」(拨了完全没用,此前照样可选)。
const THINKING_EFFECT_KEYS = ['thinking', 'reasoning_effort', 'output_config', 'reasoning', 'enable_thinking', 'thinking_budget'];   // [Q-327] 含网关形态键
function thinkingEffectSignature(opts){
	const o = opts || {};
	const picked = {};
	THINKING_EFFECT_KEYS.forEach((k)=>{ if(o[k] !== undefined){ picked[k] = o[k]; } });
	const tc = o.generationConfig && o.generationConfig.thinkingConfig;
	if(tc !== undefined){ picked.thinkingConfig = tc; }
	return JSON.stringify(picked);
}
export function thinkingLevelEffects(providerType, model, baseOpts){
	const seen = new Map();
	return THINKING_LEVELS.map((lv)=>{
		let sig;
		try{ sig = thinkingEffectSignature(applyThinkingLevel({ ...(baseOpts || {}) }, lv.value, providerType, model)); }
		catch(e){ sig = `__err__${lv.value}`; }
		const first = seen.get(sig);
		if(first === undefined){ seen.set(sig, lv.value); return { ...lv, sameAs: '' }; }
		return { ...lv, sameAs: first };
	});
}

// 报告思考档的轻量持久化（localStorage）。
const THINKING_LS_KEY = 'horosa.report.thinkingLevel';
export function getPersistedThinkingLevel(){
	try{ return localStorage.getItem(THINKING_LS_KEY) || 'off'; }catch(_){ return 'off'; }
}
export function setPersistedThinkingLevel(v){
	try{ safeLocalStorageSet(THINKING_LS_KEY, v || 'off'); }catch(_){}
}

// [调试钩·gated] 真模型 A/B 驱动器在页面内直接取计价与窗口函数(webpack 打包后不可 import):
// 仅当 localStorage['horosa.debug.aiPricing']==='1' 时挂到 window;缺省零副作用。
try{
	if(typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('horosa.debug.aiPricing') === '1'){
		window.__horosaAiPricingDebug = { estimateUsageCost, contextWindowForModel, contextCharBudgetForModel, getProviderProtocolFamily };
	}
}catch(e){ /* noop */ }
