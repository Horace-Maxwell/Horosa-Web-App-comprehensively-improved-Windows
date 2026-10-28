// AI 分析主页 · 接口档案表单助手:检索模式 / 思考档 / 健康度标签,接口选项键表,模型清单与标签规范化,表单值与选项互转,排序。
// 只被 components/aianalysis/AIAnalysisMain.js 引用。
import { parseDateTimeMs } from '../../../utils/dateTimeParse';
import { REQUEST_TIMEOUT_MIN_MS, REQUEST_TIMEOUT_MAX_MS } from '../../../services/aianalysis';
import {
	getProviderDefaultChatModels, getProviderDefaultEmbeddingModels, getProviderPreset, splitProviderModels,
	THINKING_LEVELS,
} from '../../../utils/aiAnalysisProviders';

export const RETRIEVAL_OPTIONS = [
	{ value: 'auto', label: '自动（推荐）' },
	{ value: 'fulltext', label: '全文优先' },
	{ value: 'rag', label: '检索优先' },
];
// 组合预览与接口列表此前把内部代码原样显示给用户:`auto / fulltext / rag`、`medium`、
// `healthy / error / unknown` —— 同一页顶部概览用的却是「健康 / 异常 / 未检测」。统一走这三张映射。
const PROVIDER_HEALTH_LABELS = { healthy: '健康', error: '异常', unknown: '未检测' };
export function retrievalModeLabel(v){
	const hit = RETRIEVAL_OPTIONS.find((o)=>o.value === `${v || 'auto'}`);
	return hit ? hit.label : `${v || 'auto'}`;
}
export function thinkingLevelLabel(v){
	const hit = THINKING_LEVELS.find((o)=>o.value === `${v || ''}`);
	return hit ? hit.label : `${v || ''}`;
}
export function providerHealthLabel(v){
	const k = `${v || 'unknown'}`;
	return PROVIDER_HEALTH_LABELS[k] || PROVIDER_HEALTH_LABELS.unknown;
}

const COMMON_PROVIDER_OPTION_KEYS = ['extraHeaders', 'extraBody', 'apiVersion', 'requestTimeoutMs', 'streamStallMs', 'streamMaxStreamMs'];
const PROVIDER_OPTION_KEY_MAP = {
	openai: [],
	openrouter: [],
	custom: [],
	anthropic: ['max_tokens', 'thinking', 'top_p', 'top_k'],
	gemini: ['generationConfig', 'safetySettings'],
	ollama: ['keep_alive', 'num_ctx', 'num_predict', 'top_k', 'top_p', 'repeat_penalty'],
};

export function uniqueTextList(list){
	const found = new Set();
	const result = [];
	(list || []).forEach((item)=>{
		const txt = `${item || ''}`.trim();
		if(!txt || found.has(txt)){
			return;
		}
		found.add(txt);
		result.push(txt);
	});
	return result;
}

export function safeParseJson(text, defVal = null){
	if(!text){
		return defVal;
	}
	try{
		return JSON.parse(text);
	}catch(e){
		return defVal;
	}
}

export function ensureServiceResponse(rsp, messageText = 'service.response.empty'){
	if(!rsp){
		throw new Error(messageText);
	}
	if(rsp.ResultCode !== undefined && rsp.ResultCode !== null && Number(rsp.ResultCode) !== 0){
		throw new Error(rsp.ResultMessage || messageText);
	}
	return rsp;
}

function parseJsonTextAsObject(text, fieldLabel){
	const raw = `${text || ''}`.trim();
	if(!raw){
		return {};
	}
	const parsed = safeParseJson(raw, null);
	if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)){
		throw new Error(`${fieldLabel} 需要是 JSON 对象`);
	}
	return parsed;
}

function parseJsonTextAsArray(text, fieldLabel){
	const raw = `${text || ''}`.trim();
	if(!raw){
		return [];
	}
	const parsed = safeParseJson(raw, null);
	if(!Array.isArray(parsed)){
		throw new Error(`${fieldLabel} 需要是 JSON 数组`);
	}
	return parsed;
}

function parseNumberText(value, fieldLabel, options = {}){
	const raw = `${value === undefined || value === null ? '' : value}`.trim();
	if(!raw){
		return null;
	}
	const num = options.integer ? Number.parseInt(raw, 10) : Number(raw);
	if(!Number.isFinite(num)){
		throw new Error(`${fieldLabel} 需要是有效数字`);
	}
	// 范围校验(超时等):越界直接报错,不静默钳位(钳位只留给存量旧档,见 services/aianalysis withClampedRequestTimeout)
	if(Number.isFinite(options.min) && num < options.min){
		throw new Error(`${fieldLabel} 不能小于 ${options.min}${options.unit || ''}`);
	}
	if(Number.isFinite(options.max) && num > options.max){
		throw new Error(`${fieldLabel} 不能大于 ${options.max}${options.unit || ''}`);
	}
	return num;
}

export function joinModelLines(models){
	return uniqueTextList(models || []).join('\n');
}

export function normalizeProviderResultModels(result, providerType, usePresetFallback = true){
	const splitResult = splitProviderModels(
		[]
			.concat(result && Array.isArray(result.chatModels) ? result.chatModels : [])
			.concat(result && Array.isArray(result.embeddingModels) ? result.embeddingModels : [])
			.concat(result && Array.isArray(result.models) ? result.models : []),
		providerType,
	);
	return {
		models: splitResult.models,
		chatModels: splitResult.chatModels.length ? splitResult.chatModels : (usePresetFallback ? getProviderDefaultChatModels(providerType) : []),
		embeddingModels: splitResult.embeddingModels.length ? splitResult.embeddingModels : (usePresetFallback ? getProviderDefaultEmbeddingModels(providerType) : []),
	};
}

function pickCustomProviderOptions(providerType, providerOptions){
	const reserved = new Set(COMMON_PROVIDER_OPTION_KEYS.concat(PROVIDER_OPTION_KEY_MAP[providerType] || []));
	const result = {};
	Object.keys(providerOptions || {}).forEach((key)=>{
		if(!reserved.has(key)){
			result[key] = providerOptions[key];
		}
	});
	return result;
}

export function buildProviderFormValues(profile){
	const providerType = profile ? profile.providerType : 'openai';
	const preset = getProviderPreset(providerType);
	const providerOptions = profile && profile.providerOptions ? profile.providerOptions : {};
	const manualModels = profile ? normalizeProfileModels(profile) : getProviderDefaultChatModels(providerType);
	const embeddingModels = profile ? normalizeEmbeddingModels(profile) : getProviderDefaultEmbeddingModels(providerType);
	return {
		name: profile ? profile.name : preset.label,
		providerType,
		apiKey: profile ? profile.apiKey : '',
		baseUrl: profile ? profile.baseUrl : preset.baseUrl,
		manualModels: joinModelLines(manualModels),
		embeddingModels: joinModelLines(embeddingModels),
		extraHeadersText: JSON.stringify(providerOptions.extraHeaders || {}, null, 2),
		extraBodyText: JSON.stringify(providerOptions.extraBody || {}, null, 2),
		requestTimeoutMs: providerOptions.requestTimeoutMs || preset.requestTimeoutMs || 120000,
		streamStallMs: providerOptions.streamStallMs || '',
		streamMaxStreamMs: providerOptions.streamMaxStreamMs || '',
		anthropicApiVersion: providerOptions.apiVersion || preset.anthropicApiVersion || '2023-06-01',
		anthropicMaxTokens: providerOptions.max_tokens || preset.anthropicMaxTokens || '2048',
		// 字段改义「思考档开启时的预算上限」:存 thinking_budget_cap(非 API 键);旧档 thinking.budget_tokens 形态读入兼容
		anthropicThinkingBudget: providerOptions.thinking_budget_cap || (providerOptions.thinking && providerOptions.thinking.budget_tokens ? providerOptions.thinking.budget_tokens : ''),
		anthropicTopP: providerOptions.top_p || '',
		anthropicTopK: providerOptions.top_k || '',
		geminiGenerationConfigText: JSON.stringify(providerOptions.generationConfig || {}, null, 2),
		geminiSafetySettingsText: JSON.stringify(providerOptions.safetySettings || [], null, 2),
		ollamaKeepAlive: providerOptions.keep_alive || preset.ollamaKeepAlive || '5m',
		ollamaNumCtx: providerOptions.num_ctx || preset.ollamaNumCtx || '8192',
		ollamaNumPredict: providerOptions.num_predict || preset.ollamaNumPredict || '1024',
		ollamaTopK: providerOptions.top_k || preset.ollamaTopK || '40',
		ollamaTopP: providerOptions.top_p || preset.ollamaTopP || '0.9',
		ollamaRepeatPenalty: providerOptions.repeat_penalty || preset.ollamaRepeatPenalty || '1.1',
		providerOptionsText: JSON.stringify(pickCustomProviderOptions(providerType, providerOptions), null, 2),
		enabled: profile ? profile.enabled !== false : true,
	};
}

export function buildProviderOptionsFromForm(values){
	const providerType = values.providerType || 'openai';
	const providerOptions = parseJsonTextAsObject(values.providerOptionsText, '补充高级参数');
	const extraHeaders = parseJsonTextAsObject(values.extraHeadersText, '额外请求头');
	const extraBody = parseJsonTextAsObject(values.extraBodyText, '额外请求体');
	const requestTimeoutMs = parseNumberText(values.requestTimeoutMs, '请求超时', { integer: true, min: REQUEST_TIMEOUT_MIN_MS, max: REQUEST_TIMEOUT_MAX_MS, unit: ' 毫秒' });
	if(Object.keys(extraHeaders).length){
		providerOptions.extraHeaders = extraHeaders;
	}
	if(Object.keys(extraBody).length){
		providerOptions.extraBody = extraBody;
	}
	if(requestTimeoutMs){
		providerOptions.requestTimeoutMs = requestTimeoutMs;
	}
	// [Windows #77] 流式看门狗两参(毫秒;空=默认 180s/1800s;仅前端消费,后端剥离不下发上游)
	const streamStallMs = parseNumberText(values.streamStallMs, '流式空闲上限', { integer: true });
	if(streamStallMs){
		providerOptions.streamStallMs = streamStallMs;
	}
	const streamMaxStreamMs = parseNumberText(values.streamMaxStreamMs, '流式总时长上限', { integer: true });
	if(streamMaxStreamMs){
		providerOptions.streamMaxStreamMs = streamMaxStreamMs;
	}
	if(providerType === 'anthropic'){
		const maxTokens = parseNumberText(values.anthropicMaxTokens, 'Anthropic max tokens', { integer: true });
		const thinkingBudget = parseNumberText(values.anthropicThinkingBudget, 'Anthropic thinking budget', { integer: true });
		const topP = parseNumberText(values.anthropicTopP, 'Anthropic top_p');
		const topK = parseNumberText(values.anthropicTopK, 'Anthropic top_k', { integer: true });
		if(values.anthropicApiVersion){
			providerOptions.apiVersion = `${values.anthropicApiVersion}`.trim();
		}
		if(maxTokens){
			providerOptions.max_tokens = maxTokens;
		}
		if(thinkingBudget){
			// 只记预算上限;是否思考由分析页思考档决定(关闭档不发 thinking;开启档按档位预算与本上限取小)
			providerOptions.thinking_budget_cap = thinkingBudget;
		}
		delete providerOptions.thinking;
		if(topP !== null){
			providerOptions.top_p = topP;
		}
		if(topK !== null){
			providerOptions.top_k = topK;
		}
	}
	if(providerType === 'gemini'){
		const generationConfig = parseJsonTextAsObject(values.geminiGenerationConfigText, 'Gemini generation config');
		const safetySettings = parseJsonTextAsArray(values.geminiSafetySettingsText, 'Gemini safety settings');
		if(Object.keys(generationConfig).length){
			providerOptions.generationConfig = generationConfig;
		}
		if(safetySettings.length){
			providerOptions.safetySettings = safetySettings;
		}
	}
	if(providerType === 'ollama'){
		const numCtx = parseNumberText(values.ollamaNumCtx, 'Ollama num_ctx', { integer: true });
		const numPredict = parseNumberText(values.ollamaNumPredict, 'Ollama num_predict', { integer: true });
		const topK = parseNumberText(values.ollamaTopK, 'Ollama top_k', { integer: true });
		const topP = parseNumberText(values.ollamaTopP, 'Ollama top_p');
		const repeatPenalty = parseNumberText(values.ollamaRepeatPenalty, 'Ollama repeat_penalty');
		if(values.ollamaKeepAlive){
			providerOptions.keep_alive = `${values.ollamaKeepAlive}`.trim();
		}
		if(numCtx !== null){
			providerOptions.num_ctx = numCtx;
		}
		if(numPredict !== null){
			providerOptions.num_predict = numPredict;
		}
		if(topK !== null){
			providerOptions.top_k = topK;
		}
		if(topP !== null){
			providerOptions.top_p = topP;
		}
		if(repeatPenalty !== null){
			providerOptions.repeat_penalty = repeatPenalty;
		}
	}
	return providerOptions;
}

export function normalizeTags(value){
	if(Array.isArray(value)){
		return uniqueTextList(value);
	}
	const raw = `${value || ''}`.trim();
	if(!raw){
		return [];
	}
	return uniqueTextList(raw.split(/[,，\n]/g));
}

export function normalizeProfileModels(profile){
	if(!profile){
		return [];
	}
	return uniqueTextList([]
		.concat(profile.chatModelIds || [])
		.concat(profile.availableModels || [])
		.concat(profile.manualModels || []));
}

export function normalizeProfileChatModels(profile){
	if(!profile){
		return [];
	}
	const all = normalizeProfileModels(profile);
	const embedding = new Set(splitProviderModels(all, profile.providerType).embeddingModels);
	return all.filter((model)=>!embedding.has(model));
}

export function normalizeEmbeddingModels(profile){
	if(!profile){
		return [];
	}
	return uniqueTextList(profile.embeddingModelIds || []);
}

export function sortByUpdatedDesc(list){
	return (list || []).slice(0).sort((a, b)=>{
		const ta = parseDateTimeMs(a.updatedAt || a.createdAt || '') || 0;
		const tb = parseDateTimeMs(b.updatedAt || b.createdAt || '') || 0;
		return tb - ta;
	});
}

export function compareByName(list){
	return (list || []).slice(0).sort((a, b)=>`${a.name || ''}`.localeCompare(`${b.name || ''}`, 'zh-Hans-CN'));
}
