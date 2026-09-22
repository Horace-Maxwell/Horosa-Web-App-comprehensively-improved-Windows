import React from 'react';
import { Input as AntdInput, Modal as AntdModal } from 'antd';
import {
	Alert,
	Badge,
	Checkbox,
	Collapse,
	Dropdown,
	Empty,
	Form,
	InputNumber,
	Popconfirm,
	Popover,
	Slider,
	Space,
	Table,
	Tag,
	Tooltip,
	Typography,
	Upload,
	message,
} from 'antd';
import Mustache from 'mustache';
import moment from 'moment';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { closeStreamingInlineMd } from '../../utils/reportMarkdownNormalize';
import { createStreamFlusher } from '../../utils/aiStreamFlush';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { getLayoutViewportHeight } from '../../utils/shellZoom';   // 版面尺寸一律读布局域(壳缩放下 documentElement.client* 恒为物理域)
import { classifyQuestion, needsMountBeforeSend } from '../../utils/aiAnalysisStarterPrompts';
import { isAgentEnabled as isAgentEnabledForSendGuard } from '../../utils/aiAgent/prefs';
import { copyTextSmart } from '../../utils/clipboardText';
import { buildSoftwareHelpContext } from '../../utils/aiAnalysisHelpDocs';
// 仅引「common」子集（~50KB gzipped 含 js/ts/py/java/go/rust/sh/sql/json/yaml/xml/html/css/md/c/cpp/cs/php/rb/swift/kotlin 等），不引全语言。
import 'highlight.js/styles/atom-one-dark.css';
// LaTeX 数学公式渲染（$...$ 行内 / $$...$$ 块级）。
import styles from './AIAnalysisMain.less';
import MonacoEditor, { JSON_TEXT_RULE } from './MonacoField';   // TextArea 版 + 保存时 JSON 校验
import { renderTemplatesForSend, isImageRejectionError, JSON_MODE_INSTRUCTION } from '../../utils/aiChat/sendHelpers';
import { normalizeSkillPack, syncSkillTechniqueKeys } from '../../utils/aiChat/skills';   // 组合弹窗标技能身份 + 技法同步写技能
import XQIcon from '../xq-icons';
import TechniqueSettingsFields from './TechniqueSettingsFields';
import SectionChecklist from './SectionChecklist';
import { groupMountTechniqueOptions } from './mountTechniqueGroups';
import {
	XQButton as Button,
	XQCard as Card,
	XQCheckItem,
	XQCheckList,
	XQDatePicker,
	XQDrawer as Drawer,
	XQInput as Input,
	XQModal as Modal,
	XQSectionTitle,
	XQSelect as Select,
	XQSwitch as Switch,
	XQTabs as Tabs,
	XQToolbar,
} from '../xq-ui';
import GeoCoordModal from '../amap/GeoCoordModal';
import * as AstroHelper from '../astro/AstroHelper';
import { upsertLocalChart } from '../../utils/localcharts';
import { markFieldsCaptured } from '../../utils/recordFieldsRestore';   // [Q-256/T-219] AI 页草稿存为命盘=新记录:打随盘代次标记
import { upsertLocalCase } from '../../utils/localcases';
import { dstAwareZoneAt } from '../../utils/timezone';
// AI 助手·行动能力(总开关默认关;关=NULL_AGENT 现状路径)
import { createAgentTurn } from '../../utils/aiAgent/runtime';
import { requestApproval as requestAgentApproval } from '../../utils/aiAgent/approvals';
import { requestElicitation as requestAgentElicitation } from '../../utils/aiAgent/elicitations';
import { stripActionBlockForDisplay } from '../../utils/aiAgent/textProtocol';
import AgentActionBar from './AgentActionBar';
import AgentAbilityPanel from './AgentAbilityPanel';
import AdvancedPane from './chat/AdvancedPane';
// 对话上下文策略与真消息窗口(缺省 legacy=现状;window=历史不再双发+按模型窗口预算裁剪)
import { readContextPolicy, windowChatMessages } from '../../utils/aiChatHistory';
import { emitAutomationEvent } from '../../utils/aiAgent/automation/events';
// 对话交互增强唯一插座(斜杠/@引用/状态栏/压缩·旁问·回退/口径·记忆):钩子内按批次实装,页面只留最小 hunk
import { useChatAssist, ChatAssistOverlays } from './chat';
import ComposerAssist from './chat/ComposerAssist';
import { historyContentOf } from '../../utils/aiBestOfN';
import { useChatModels } from './chat/useChatModels';
import { buildEditBranchMessages, buildForkMessages } from '../../utils/aiConversationBranch';
import { AI_ANALYSIS_SCHEMA_VERSION, AI_ANALYSIS_STORES, AI_BACKUP_EXCLUDED_STORES, buildMaterialSearchText, buildTimestampLabel, bulkPutStoreRecords, deleteStoreRecord, clearStore, countStoreRecords, deleteWhere, ensureTemplateVersion, getStoreRecord, listConversationMessages, listStoreRecords, listStoreRecordsBatched, loadUiPrefs, migrateWorkspaceData, putStoreRecord, replaceConversationMessages, saveConversationMessage, saveUiPrefs, getAiStoreHealth, AI_STORE_DEGRADED_EVENT, updateStoreRecordIf, } from '../../utils/aiAnalysisStore';
import { isSecretStore, redactSecretRecord } from '../../utils/aiSecretStores';
import { planWorkspaceRestore, restoreWorkspaceStores, AI_BACKUP_MAX_ZIP_BYTES } from '../../utils/aiWorkspaceRestore';
import { renderRichMarkdownToHtml as renderMarkdownToHtml, highlightCodeUnder } from '../../utils/aiMarkdownRender';
import {
	AI_CONTEXT_MAX_CHARS,
	TIME_CASTABLE_DIVINATION,
	buildContextLayers,
	clipContextLayersDetailed,
	VOLATILE_LAYER_KEYS,
	hashPromptText,
	getAnalysisSourceContext,
	getAnalysisTechniqueContexts,
	listAnalysisSources,
	listAnalysisTechniqueOptions,
	listAllAnalysisTechniqueOptions,
	snapshotSourceMismatch,
} from '../../utils/aiAnalysisContext';
import {
	getTechniqueSettingsSchema,
	getTechniqueSettingsDefaults,
	isSectionsOnlyTechnique,
	hasMountSettingsFields,
	pruneOptionsToNonDefault,
	effectiveMountBaseline,
	resolveEffectiveTechniqueOptions,
	saveMountTechniqueDefaults,
	getMountTechniqueDefault,
} from '../../utils/techniqueMountSettings';
import {
	loadAIExportSettings,
	saveAIExportSettings,
	getAIExportEffectiveSectionsForTechnique,
	listAIExportTechniqueSettings,
	getSectionGroupsForTechnique,
} from '../../utils/aiExport';
import * as Constants from '../../utils/constants';
import { parseMaterialFile, isSupportedMaterialFile, MATERIAL_IMPORT_EXTENSIONS, MATERIAL_ACCEPT_ATTR, MATERIAL_BACKEND_MAX_BYTES, oversizeForBackend, describeExtractTruncation } from '../../utils/aiAnalysisMaterial';   // [Q-060/AW-18/AW-23] 导入白名单 + 抽取上限/截断标注单源
import {
	diagnoseProvider,
	fetchProviderModels,
	requestAIAnalysisChat,
	requestAIAnalysisChatStream,
	requestEmbeddingVectors,
	REQUEST_TIMEOUT_MIN_MS,
	REQUEST_TIMEOUT_MAX_MS,
} from '../../services/aianalysis';
import {
	base64ToBlob,
	blobToBase64,
	downloadTextFile,
	withUtf8Bom,   // [Q-004] 桌面保存路径也要 BOM(与浏览器下载同款)
	exportConversationBundle,
	exportConversationByFormat,
	exportWorkspaceBackupBlob,
	parseWorkspaceBackupBlob,
	saveBlobToBrowser,
	describeSaveResult,
} from '../../utils/aiAnalysisExport';
import {
	buildRetrievedContextText,
	ensureMaterialChunks,
	mergeRetrievedChunks,
	rankChunksByKeyword,
	rerankChunksWithVector,
	resolveEmbeddingTargetFromPrefs, // [D-R5] 三态解析共享化
	EMBEDDING_TARGET_NONE,           // [Q-060/AW-16]「不用向量」哨兵
	partitionMaterialsByRetrieval,
} from '../../utils/aiAnalysisRag';
import {
	filterTechniqueKeysBySource,
	getTechniqueContextMode,
} from '../../utils/aiAnalysisSelection';
import {
	isDesktopBridgeAvailable,
	openDesktopBackup,
	pickDesktopFiles,
	pickDesktopFolder,
	saveDesktopFile,
} from '../../utils/aiAnalysisDesktop';
import {
	PROVIDER_OPTIONS,
	getProviderDefaultChatModels,
	getProviderDefaultEmbeddingModels,
	getProviderDisplayName,
	getProviderPreset,
	getProviderProtocolFamily,
	isOpenAiFamily,
	splitProviderModels,
	THINKING_LEVELS,
	applyThinkingLevel,
	applyChatParams,
	anthropicThinkingMode,
	temperatureMaxForFamily,
	thinkingLevelEffects,
	estimateUsageCost,
	isReasoningModel,
	encodeModelSelection,
	parseModelSelection,
	mountCharBudgetFor,
	effectiveMaxTokensForModel,
	maxTokensKeyForModel,
} from '../../utils/aiAnalysisProviders';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';

// [Q-410] 保存结果统一提示(取消 info / 失败 error / 成功 success 带路径)
function notifySaveResult(r, okText){ const d = describeSaveResult(r, okText); (message[d.type] || message.info)(d.text); }

const { TextArea, Search } = Input;
const { Title, Text } = Typography;
const { Dragger } = Upload;
const { TabPane } = Tabs;

const SECONDARY_TABS = [
	{ key: 'analysis', label: '分析', icon: <XQIcon name="ai" /> },
	{ key: 'history', label: '历史', icon: <XQIcon name="calendar" /> },
	{ key: 'materials', label: '资料', icon: <XQIcon name="book" /> },
	{ key: 'templates', label: '模版', icon: <XQIcon name="note" /> },
	{ key: 'settings', label: '设置', icon: <XQIcon name="aiSettings" /> },
	{ key: 'advanced', label: '进阶', icon: <XQIcon name="sliders" /> },
];

const RETRIEVAL_OPTIONS = [
	{ value: 'auto', label: '自动（推荐）' },
	{ value: 'fulltext', label: '全文优先' },
	{ value: 'rag', label: '检索优先' },
];
// [Q-062/AW-36] 组合预览与接口列表此前把内部代码原样显示给用户:`auto / fulltext / rag`、`medium`、
// `healthy / error / unknown` —— 同一页顶部概览用的却是「健康 / 异常 / 未检测」。统一走这三张映射。
const PROVIDER_HEALTH_LABELS = { healthy: '健康', error: '异常', unknown: '未检测' };
function retrievalModeLabel(v){
	const hit = RETRIEVAL_OPTIONS.find((o)=>o.value === `${v || 'auto'}`);
	return hit ? hit.label : `${v || 'auto'}`;
}
function thinkingLevelLabel(v){
	const hit = THINKING_LEVELS.find((o)=>o.value === `${v || ''}`);
	return hit ? hit.label : `${v || ''}`;
}
function providerHealthLabel(v){
	const k = `${v || 'unknown'}`;
	return PROVIDER_HEALTH_LABELS[k] || PROVIDER_HEALTH_LABELS.unknown;
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// 前缀缓存断点标记:埋在 system 文本里的中性标记,与后端 AI 代理内同名常量**逐字节一致**。
// 后端按 provider 分家:anthropic 按标记切 system 数组块并打 cache_control(ephemeral);
// OpenAI 家族剥标记吃厂商自动前缀缓存;Gemini/Ollama 等剥净。改这个字面量必须两端同改,
// 否则标记会原样混进 prompt 正文。
const PROMPT_CACHE_BP = '[[__CACHE_BP__]]';

// 「一键挂载全部式法」的排除集。奇门遁甲=用户考量(不随一键带入,需手动勾选);
// 黄历/通书=历注而非式法,一键带入只会稀释上下文。抽成常量而非写死在 filter 链里:
// 逐项之间不再靠 && 串联,增删一项不必改表达式,且各构建可按自身式法集裁剪本表。
const QUICK_MOUNT_EXCLUDED_KEYS = ['qimen', 'huangli', 'tongshu'];

const COMMON_PROVIDER_OPTION_KEYS = ['extraHeaders', 'extraBody', 'apiVersion', 'requestTimeoutMs', 'streamStallMs', 'streamMaxStreamMs'];
const PROVIDER_OPTION_KEY_MAP = {
	openai: [],
	openrouter: [],
	custom: [],
	anthropic: ['max_tokens', 'thinking', 'top_p', 'top_k'],
	gemini: ['generationConfig', 'safetySettings'],
	ollama: ['keep_alive', 'num_ctx', 'num_predict', 'top_k', 'top_p', 'repeat_penalty'],
};

function uniqueTextList(list){
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

function safeParseJson(text, defVal = null){
	if(!text){
		return defVal;
	}
	try{
		return JSON.parse(text);
	}catch(e){
		return defVal;
	}
}

function ensureServiceResponse(rsp, messageText = 'service.response.empty'){
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
	// [Q-411/M-157] 范围校验(超时等):越界直接报错,不静默钳位(钳位只留给存量旧档,见 services/aianalysis withClampedRequestTimeout)
	if(Number.isFinite(options.min) && num < options.min){
		throw new Error(`${fieldLabel} 不能小于 ${options.min}${options.unit || ''}`);
	}
	if(Number.isFinite(options.max) && num > options.max){
		throw new Error(`${fieldLabel} 不能大于 ${options.max}${options.unit || ''}`);
	}
	return num;
}

function joinModelLines(models){
	return uniqueTextList(models || []).join('\n');
}

function normalizeProviderResultModels(result, providerType, usePresetFallback = true){
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

function buildProviderFormValues(profile){
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
		// [Q-063/M-65] 字段改义「思考档开启时的预算上限」:存 thinking_budget_cap(非 API 键);旧档 thinking.budget_tokens 形态读入兼容
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

function buildProviderOptionsFromForm(values){
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
	// [#77] 流式看门狗两参(毫秒;空=默认 180s/1800s;仅前端消费,后端剥离不下发上游)
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
			// [Q-063/M-65] 只记预算上限;是否思考由分析页思考档决定(关闭档不发 thinking;开启档按档位预算与本上限取小)
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

function normalizeTags(value){
	if(Array.isArray(value)){
		return uniqueTextList(value);
	}
	const raw = `${value || ''}`.trim();
	if(!raw){
		return [];
	}
	return uniqueTextList(raw.split(/[,，\n]/g));
}

function normalizeProfileModels(profile){
	if(!profile){
		return [];
	}
	return uniqueTextList([]
		.concat(profile.chatModelIds || [])
		.concat(profile.availableModels || [])
		.concat(profile.manualModels || []));
}

function normalizeProfileChatModels(profile){
	if(!profile){
		return [];
	}
	const all = normalizeProfileModels(profile);
	const embedding = new Set(splitProviderModels(all, profile.providerType).embeddingModels);
	return all.filter((model)=>!embedding.has(model));
}

function normalizeEmbeddingModels(profile){
	if(!profile){
		return [];
	}
	return uniqueTextList(profile.embeddingModelIds || []);
}

function sortByUpdatedDesc(list){
	return (list || []).slice(0).sort((a, b)=>{
		const ta = Date.parse(a.updatedAt || a.createdAt || '') || 0;
		const tb = Date.parse(b.updatedAt || b.createdAt || '') || 0;
		return tb - ta;
	});
}

function compareByName(list){
	return (list || []).slice(0).sort((a, b)=>`${a.name || ''}`.localeCompare(`${b.name || ''}`, 'zh-Hans-CN'));
}

// 错误分类：把上游异常拆成「类别 + 简短中文 + 可重试」三段，给消息底部 Alert 用。
function classifyStreamError(rawMsg){
	const txt = `${rawMsg || ''}`;
	const lower = txt.toLowerCase();
	const m = lower.match(/(?:status|http|code|error)[^\d]{0,8}(\d{3})/);
	const status = m ? parseInt(m[1], 10) : 0;
	let category = 'server';
	let hint = '请稍后重试，或检查模型/参数。';
	let retriable = true;
	if(status === 401 || status === 403 || /api[\s_-]?key|unauthor|invalid[\s_-]?key/.test(lower)){
		category = 'auth'; hint = '凭证问题——请到「设置」检查 API Key / Base URL。'; retriable = false;
	}else if(status === 429 || /rate\s*limit|too many requests|quota/.test(lower)){
		category = 'rate'; hint = '上游限流——稍候再试（建议降低并发或换模型）。'; retriable = true;
	}else if(status === 400 || /not\s*support|unsupported|invalid\s*model|invalid\s*param|response_format/.test(lower)){
		category = 'model'; hint = '参数/模型问题——检查模型选择、思考档或 JSON/停止序列等参数。'; retriable = false;
	}else if(/network|fetch|ECONN|ETIMEDOUT|timeout|aborted|disconnect/.test(lower)){
		category = 'network'; hint = '网络问题——检查 baseUrl 可达性 / 代理 / 防火墙。'; retriable = true;
	}else if(status >= 500 && status < 600){
		category = 'server'; hint = '上游服务异常——稍后重试。'; retriable = true;
	}
	return { category, status, message: txt.slice(0, 400), hint, retriable };
}

// 异步输入框 — 替代 window.prompt（Tauri/桌面壳 不支持原生 prompt）。
// 返回 Promise<string|null>：用户点「确定」返回输入值（含空串），点「取消」/关闭返回 null。
function asyncInput({ title = '请输入', defaultValue = '', placeholder = '', multiline = false, okText = '确定', cancelText = '取消', maxLength } = {}){
	return new Promise((resolve)=>{
		let current = `${defaultValue || ''}`;
		const modal = AntdModal.confirm({
			title,
			icon: null,
			okText,
			cancelText,
			centered: true,
			width: multiline ? 560 : 420,
			content: React.createElement(AntdInput.Group, { compact: false },
				multiline
					? React.createElement(AntdInput.TextArea, {
						defaultValue: current,
						placeholder,
						autoSize: { minRows: 3, maxRows: 12 },
						autoFocus: true,
						maxLength,
						onChange: (e)=>{ current = e.target.value; },
						onPressEnter: (e)=>{ if(!e.shiftKey){ e.preventDefault(); modal.destroy(); resolve(current); } },
					})
					: React.createElement(AntdInput, {
						defaultValue: current,
						placeholder,
						autoFocus: true,
						maxLength,
						onChange: (e)=>{ current = e.target.value; },
						onPressEnter: ()=>{ modal.destroy(); resolve(current); },
					})
			),
			onOk: ()=>{ resolve(current); },
			onCancel: ()=>{ resolve(null); },
		});
	});
}

// 异步确认 — 替代 window.confirm。返回 Promise<boolean>。
function asyncConfirm({ title = '确认操作？', content = '', okText = '确定', cancelText = '取消', okType = 'primary', danger = false } = {}){
	return new Promise((resolve)=>{
		AntdModal.confirm({
			title,
			content,
			okText,
			cancelText,
			centered: true,
			okType: danger ? 'danger' : okType,
			onOk: ()=>resolve(true),
			onCancel: ()=>resolve(false),
		});
	});
}

function buildConversationTitle(prompt, source){
	const trimmed = `${prompt || ''}`.trim();
	if(source && source.title){
		if(!trimmed){
			return `${source.title} 分析`;
		}
		return `${source.title} · ${trimmed.slice(0, 24)}`;
	}
	return trimmed ? trimmed.slice(0, 24) : '未命名对话';
}

// [Q-030/M-41] 压缩区判定:消息 createdAt ≤ compact.uptoCreatedAt 即在压缩摘要覆盖区内。
function compactCoversMessage(compact, msg){
	if(!compact || !compact.uptoCreatedAt || !compact.summary || !msg){ return false; }
	const t = (v)=>{ if(typeof v === 'number'){ return v; } const n = Date.parse(v || ''); return Number.isFinite(n) ? n : 0; };
	return t(msg.createdAt) <= t(compact.uptoCreatedAt);
}
function isInsideCompactRegion(conversation, msg){
	if(!conversation || !compactCoversMessage(conversation.compact, msg)){ return false; }
	message.warning('该提问已在压缩摘要之内,重答会没有用户消息可发 —— 请先用 /compact 撤销压缩再重答');
	return true;
}

function resolveReferenceItems(referenceIds, materials, bundles, templates){
	const refs = Array.isArray(referenceIds) ? referenceIds : [];
	const bundleItems = [];
	const materialItems = [];
	const templateItems = [];
	refs.forEach((id)=>{
		const text = `${id || ''}`;
		if(text.indexOf('bundle:') === 0){
			const bundle = bundles.find((item)=>item.id === text.replace('bundle:', ''));
			if(bundle){
				bundleItems.push(bundle);
				if(bundle.templateId){
					const template = templates.find((item)=>item.id === bundle.templateId);
					if(template){
						templateItems.push(template);
					}
				}
			}
			return;
		}
		if(text.indexOf('material:') === 0){
			const material = materials.find((item)=>item.id === text.replace('material:', ''));
			if(material){
				materialItems.push(material);
			}
			return;
		}
		// [Q-028/M-39] @模板 写入 template:<id>,此前唯一解析器不认 → 模板正文不进上下文、只剩模板名。
		if(text.indexOf('template:') === 0){
			const template = templates.find((item)=>item.id === text.replace('template:', ''));
			if(template){
				templateItems.push(template);
			}
		}
	});
	const bundleMaterialIds = bundleItems.flatMap((bundle)=>bundle.defaultMaterialIds && bundle.defaultMaterialIds.length ? bundle.defaultMaterialIds : (bundle.materialIds || []));
	const bundleMaterials = bundleMaterialIds.map((id)=>materials.find((item)=>item.id === id)).filter(Boolean);
	return {
		bundles: bundleItems,
		materials: uniqueById(materialItems.concat(bundleMaterials)),
		templates: uniqueById(templateItems),
		// [Q-061] 组合系统提示**只走独立层**(buildContextLayers 的 bundle-system 层)。此前这里还拼一份进
		// 「系统提示」层,加上「一键应用」写进会话规则的那份 —— 一键应用后同一段话在提示词里出现 3 次、
		// 只「加入参考」也有 2 次(白烧 token、还会被模型当成刻意强调)。
		systemPrompt: '',
	};
}

function uniqueById(list){
	const seen = new Set();
	return (list || []).filter((item)=>{
		if(!item || !item.id || seen.has(item.id)){
			return false;
		}
		seen.add(item.id);
		return true;
	});
}


function buildTemplatePreview(template){
	const sampleData = safeParseJson(template.exampleInput, {
		user_prompt: '请分析此案例',
		source_context: '这是案例前提',
		retrieved_context: '这是检索到的资料片段',
		conversation_history: '[user] 上一句问题',
		system_prompt: '系统提示',
	});
	if(template.format === 'json'){
		const schema = safeParseJson(template.jsonSchema, null);
		const output = safeParseJson(template.exampleOutput, null);
		let schemaErrors = [];
		if(schema){
			try{
				const validate = ajv.compile(schema);
				if(output){
					validate(output);
				}
				schemaErrors = validate.errors || [];
			}catch(e){
				schemaErrors = [{ message: e.message }];
			}
		}else{
			schemaErrors = [{ message: 'JSON Schema 解析失败' }];
		}
		return {
			text: JSON.stringify(output || sampleData, null, 2),
			errors: schemaErrors,
		};
	}
	// [Q-060/AW-19] 预览在 render 期间跑 Mustache,此前无 try/catch:模版里出现未闭合 / 错配的段标签
	// (照常见模板语法写的 `{{#if x}}…{{/if}}` 就会)直接抛错,冒到应用级错误边界 → **整页**换成错误卡。
	// 另:Mustache 缺省 HTML 转义,预览里 `<` `&` `"` 显示成实体 —— 预览是给人看原文的,关掉转义。
	try{
		const rendered = Mustache.render(template.instructionText || template.content || '', sampleData, {}, { escape: (v)=>`${v == null ? '' : v}` });
		return { text: rendered, errors: [] };
	}catch(e){
		return {
			text: `${template.instructionText || template.content || ''}`,
			errors: [{ message: `模版语法错误:${(e && e.message) || e}(下面显示的是未渲染的原文)` }],
		};
	}
}

function buildTemplateVersionSnapshot(values){
	return {
		format: values.format,
		instructionText: values.instructionText || '',
		jsonSchema: values.jsonSchema || '',
		exampleInput: values.exampleInput || '',
		exampleOutput: values.exampleOutput || '',
		content: values.format === 'text' ? (values.instructionText || '') : (values.jsonSchema || ''),
		name: values.name || '',
	};
}

function configureMonaco(monaco){
	if(monaco && monaco.languages && monaco.languages.json){
		monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			allowComments: false,
			schemas: [
				{
					uri: 'horosa://json-template-schema.json',
					fileMatch: ['*'],
					schema: {
						type: 'object',
						properties: {
							type: { type: 'string' },
							properties: { type: 'object' },
							required: {
								type: 'array',
								items: { type: 'string' },
							},
							additionalProperties: { type: 'boolean' },
						},
					},
				},
			],
		});
	}
}

// [B-A4] marked 全局配置/KaTeX 预渲染/富 markdown 渲染已抽至 utils/aiMarkdownRender(聊天与报告共用单一来源;净化硬化同源)。

const CONTEXT_STATUS_META = {
	ready: { text: '已就绪', color: 'green' },
	regenerated: { text: '已按盘重算', color: 'blue' },
	missing: { text: '缺失', color: 'red' },
	// [V6 复查轮] 覆盖重算失败独立态(aiAnalysisContext 闸5):无此映射会落 pending 显「待生成」,
	// 与展开后的「重算失败」emptyHint 自相矛盾且永不兑现。
	error: { text: '重算失败', color: 'volcano' },
	pending: { text: '待生成', color: 'default' },
};

function getContextStatusMeta(status){
	return CONTEXT_STATUS_META[status] || CONTEXT_STATUS_META.pending;
}

// 从挂载层的 meta 里提取出生/起盘签名，方便核对「挂的是不是这张盘」。
function buildContextSignatureText(meta){
	if(!meta || typeof meta !== 'object'){
		return '';
	}
	// 🔴 曾漏 meta.time:技法快照的 date/time 是两个字段 → 签名只到「日」,
	// 同一天不同时辰的两张盘签名一模一样(对时间确定式法尤其致命)。
	// 与 snapshotSourceMismatch 的 [date,time].join(' ') 口径一致。
	const whenPair = [meta.date, meta.time].filter(Boolean).join(' ').trim();
	// whenPair 必须最先:date+time 记录若先取 birth(常为同盘出生串)仍吃不到 time,病灶不修等于没修。
	const date = `${whenPair || meta.birth || meta.divTime || ''}`.trim();
	const zone = `${meta.zone || ''}`.trim();
	const parts = [];
	if(date){
		parts.push(date);
	}
	if(zone){
		parts.push(zone);
	}
	return parts.join(' · ');
}

function shallowEqualObject(a, b){
	if(a === b){
		return true;
	}
	const left = a && typeof a === 'object' ? a : {};
	const right = b && typeof b === 'object' ? b : {};
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if(leftKeys.length !== rightKeys.length){
		return false;
	}
	for(let i = 0; i < leftKeys.length; i += 1){
		const key = leftKeys[i];
		if(left[key] !== right[key]){
			return false;
		}
	}
	return true;
}

function sameSourceContext(left, right){
	if(left === right){
		return true;
	}
	if(!left || !right){
		return false;
	}
	return left.content === right.content
		&& left.title === right.title
		&& left.module === right.module
		&& shallowEqualObject(left.meta, right.meta);
}

function buildTechniqueLoadingState(keys, labelMap){
	return (keys || []).map((key)=>({
		key,
		title: labelMap.get(key) || key,
		module: key,
		content: '',
		available: false,
		status: 'loading',
		meta: {},
	}));
}

function mergeTechniqueState(list, nextItem, keys, labelMap){
	const currentMap = new Map((list || []).map((item)=>[item.key, item]));
	if(nextItem && nextItem.key){
		currentMap.set(nextItem.key, nextItem);
	}
	return (keys || []).map((key)=>{
		if(currentMap.has(key)){
			return currentMap.get(key);
		}
		return {
			key,
			title: labelMap.get(key) || key,
			module: key,
			content: '',
			available: false,
			status: 'loading',
			meta: {},
		};
	});
}

// 「起课时间」入口：一个合成的 source（非持久化），让用户对任一时刻即时起所有时间确定式法。
const TIMEPOINT_SOURCE_ID = 'timepoint:current';
const NATAL_SOURCE_ID = 'natal:current';

// gps 十进制经纬 → 命盘录入用的 'NNeMM'/'NNwMM' 紧凑串(供「快速起盘」抽屉地图选点回填)。
// splitDegree 对负值只把 res[0](度)取负、res[1]/res[2](分/秒)仍是正绝对值;
// 故方向按原始符号判、度分一律取绝对值。此前手抄版把分数也取负 → 西经/南纬产出畸形串「121w0-44」
// → 后端 param error、技法挂载「缺失」(用户在美西 121°W 实测命中)。
function gpsToLonLatStrings(gpsLat, gpsLng){
	function fmt(v, posDir, negDir){
		const d = AstroHelper.splitDegree(v);
		const deg = Math.abs(d[0] || 0);
		const min = Math.abs(d[1] || 0);
		const dir = (parseFloat(`${v}`) < 0) ? negDir : posDir;
		return `${deg}${dir}${min < 10 ? '0' + min : min}`;
	}
	return { lat: fmt(gpsLat, 'n', 's'), lon: fmt(gpsLng, 'e', 'w') };
}

function formatTimepointNow(){
	const d = new Date();
	const p = (n)=>`${n}`.padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// [流式渲染合帧·B] 单条助手正文的 markdown 渲染按 (content, streaming, hasTrace) 记忆化:消息列表任一状态变化
// (某条气泡流式中/审批 tick/trace 更新)不再让全部历史气泡逐条重解析 markdown——长会话下这是主线程被打满的乘数项。
const AssistantMarkdown = React.memo(function AssistantMarkdown({ content, streaming, hasTrace, className }){
	const html = React.useMemo(
		()=>renderMarkdownToHtml(streaming ? closeStreamingInlineMd(content) : (hasTrace ? stripActionBlockForDisplay(content) : content)),
		[content, streaming, hasTrace],
	);
	return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});

function AIAnalysisMain(props){
	const defaultUi = loadUiPrefs();
	// [Q-062/AW-34] 同一次 saveUiPrefs 写下的 modelSelection / referenceIds / 技法 / 会话规则都回灌了,
	// 唯独 innerTab 只写不读(注册表却说它保存「内页」)。回灌,并只认 SECONDARY_TABS 里真实存在的页签
	// (旧档存了已下线的 key 时静默落回「分析」,不会开在一个空白页)。
	const [innerTab, setInnerTab] = React.useState(()=>{
		const saved = `${(defaultUi && defaultUi.innerTab) || ''}`;
		return SECONDARY_TABS.some((t)=>t.key === saved) ? saved : 'analysis';
	});
	const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
	// [首开反卡] Wave2(资料/会话/版本)后台载入中 —— 只驱动资料/历史 pane 顶部细提示,绝不全页转圈。
	const [deepLoading, setDeepLoading] = React.useState(false);
	const [sending, setSending] = React.useState(false);
	const [sources, setSources] = React.useState([]);
	const [providerProfiles, setProviderProfiles] = React.useState([]);
	const [materials, setMaterials] = React.useState([]);
	const [materialFolders, setMaterialFolders] = React.useState([]);
	const [tagGroups, setTagGroups] = React.useState([]);
	const [templateVersions, setTemplateVersions] = React.useState([]);
	const [templates, setTemplates] = React.useState([]);
	const [bundles, setBundles] = React.useState([]);
	const [conversations, setConversations] = React.useState([]);
	const [activeConversationId, setActiveConversationId] = React.useState('');
	// v1.16-O: 对话切换 race token — 用户快速切 A→B→A 时,老 listConversationMessages 可能比新的更晚返回,会用 A 的消息覆盖 B。
	// 每次切对话 ++ token,setMessages 前核对 token 一致才写。
	const conversationLoadTokenRef = React.useRef(0);
	const [messages, setMessages] = React.useState([]);
	const [selectedSourceId, setSelectedSourceId] = React.useState('');
	const [modelSelection, setModelSelection] = React.useState(defaultUi.modelSelection || '');
	// issue #13：嵌入(向量)模型独立选择 + 聊天高级参数（全局，存 UI prefs）
	const [embeddingSelection, setEmbeddingSelection] = React.useState(defaultUi.embeddingSelection || '');
	const [chatTemperature, setChatTemperature] = React.useState(defaultUi.chatTemperature === undefined ? null : defaultUi.chatTemperature);
	const [chatTopP, setChatTopP] = React.useState(defaultUi.chatTopP === undefined ? null : defaultUi.chatTopP);
	const [thinkingLevel, setThinkingLevel] = React.useState(defaultUi.thinkingLevel || 'off');
	// 2B/2G：停止序列（四家通用，出口按家族映射）/ 频率·存在惩罚（仅 OpenAI 兼容）/ JSON 输出模式（OpenAI 兼容 + Gemini）。
	const [stopSequences, setStopSequences] = React.useState(defaultUi.stopSequences || '');
	const [frequencyPenalty, setFrequencyPenalty] = React.useState(defaultUi.frequencyPenalty === undefined ? null : defaultUi.frequencyPenalty);
	const [presencePenalty, setPresencePenalty] = React.useState(defaultUi.presencePenalty === undefined ? null : defaultUi.presencePenalty);
	const [jsonMode, setJsonMode] = React.useState(!!defaultUi.jsonMode);
	// C: 测试连接状态机——key = 当前 modelSelection 指纹。切模型/接口后 key 失配 → chip 自动回灰「点击测试」;
	// 在当前选择下测试成功/失败 → 置绿「测试成功」/ 红「测试失败」。不再读 profile.healthStatus(避免历史诊断残留绿)。
	const [connState, setConnState] = React.useState({ key: '', status: 'idle' });
	const [referenceIds, setReferenceIds] = React.useState(defaultUi.referenceIds || []);
	const [sourceContext, setSourceContext] = React.useState(null);
	const [selectedTechniqueKeys, setSelectedTechniqueKeys] = React.useState(defaultUi.selectedTechniqueKeys || []);
	// 组合包待挂载技法：套用组合时若尚未选案例，先缓存于此，待选定 source 后由 effect 取交集落入 selectedTechniqueKeys。
	const [pendingBundleTechniqueKeys, setPendingBundleTechniqueKeys] = React.useState([]);
	const [techniqueContexts, setTechniqueContexts] = React.useState([]);
	// [挂载预算] 最近一次发送的上下文裁剪账本 {byKey,dropped,stats}：预览卡「已裁剪/超预算」Tag + banner 字数用。
	const [promptClipStats, setPromptClipStats] = React.useState(null);
	const [prompt, setPrompt] = React.useState('');
	// 2F：待发送图片（多媒体输入），元素 {url: dataURL, name}；随用户消息以 images 字段发往后端（仅视觉模型有效）。
	const [pendingImages, setPendingImages] = React.useState([]);
	// [Q-041/M-52] 「未挂载案例 · 选择案例」此前打开的是**挂载抽屉**,而抽屉里根本没有案例选择器
	// (全页唯一的选择器在顶栏)—— 用户点完一脸茫然。改成直接把顶栏那个下拉打开并聚焦。
	// 注:顶栏那个下拉是 XQSelect(函数组件,未 forwardRef)——挂 ref 只会换来一条 React 警告且拿不到实例,
	// 所以这里只驱动受控的 open(实测足以把下拉展开)。
	const [sourceSelectOpen, setSourceSelectOpen] = React.useState(false);
	function focusSourceSelect(){
		try{ setSources(listAnalysisSources()); }catch(e){ /* noop */ }
		setSourceSelectOpen(true);
	}
	const imageInputRef = React.useRef(null);
	// 对话栏拖入图片高亮态。
	const [composerDragOver, setComposerDragOver] = React.useState(false);
	// 资料 pane 全区拖拽计数（防 dragLeave 误闪）：用 ref 而非函数静态，避免重渲染丢失。
	const materialDragCounterRef = React.useRef(0);
	// 组件挂载状态：异步流程末段写 state 前先看本 ref，避免 unmount 后 setState 警告。
	const isMountedRef = React.useRef(true);
	const [sessionSystemPrompt, setSessionSystemPrompt] = React.useState(defaultUi.sessionSystemPrompt || '');
	const [mountDrawerOpen, setMountDrawerOpen] = React.useState(false);
	// AI 挂载「每技法设置」：会话级覆盖 {[key]:options}（仅本次，未点「设为同类默认」不持久）。默认空 → 走默认路径。
	const [techniqueOptionOverrides, setTechniqueOptionOverrides] = React.useState({});
	// 当前打开设置抽屉的技法 key + 抽屉内编辑草稿（含 settings 段勾选即时态）。
	const [techniqueSettingsKey, setTechniqueSettingsKey] = React.useState('');
	const [techniqueSettingsDraft, setTechniqueSettingsDraft] = React.useState({});
	// 段勾选写入 aiExport 设置后用此 nonce 触发挂载重新 fetch（让卡片快照按新段刷新）。
	const [mountSettingsNonce, setMountSettingsNonce] = React.useState(0);
	const [timepointDraft, setTimepointDraft] = React.useState(()=>({
		divTime: formatTimepointNow(),
		zone: '+08:00',
		lon: Constants.DefLon,
		lat: Constants.DefLat,
		gpsLon: Constants.DefGpsLon,
		gpsLat: Constants.DefGpsLat,
		gender: 1,
		name: '',
	}));
	// B2:「命盘时间」入口——与起课时间同思路,但合成 chart 型源(record 带 birth)→ 走命盘技法,默认设置即时起命盘。
	const [natalDraft, setNatalDraft] = React.useState(()=>({
		birth: formatTimepointNow(),
		zone: '+08:00',
		lon: Constants.DefLon,
		lat: Constants.DefLat,
		gpsLon: Constants.DefGpsLon,
		gpsLat: Constants.DefGpsLat,
		gender: 1,
		name: '',
	}));
	const [historyKeyword, setHistoryKeyword] = React.useState('');
	const [historyFilter, setHistoryFilter] = React.useState({
		provider: '',
		model: '',
		sourceType: '',
		favorite: 'all',
		archived: 'active',
	});
	const [selectedHistoryIds, setSelectedHistoryIds] = React.useState([]);
	const [materialKeyword, setMaterialKeyword] = React.useState('');
	const [selectedFolderId, setSelectedFolderId] = React.useState('');
	const [materialView, setMaterialView] = React.useState(defaultUi.materialView || 'grid');
	// 组合包「预览影响」弹层。
	const [bundlePreview, setBundlePreview] = React.useState(null);
	// 资料 pane 全区拖拽态 + 上传进度（取代旧的小 Dragger 区 + window.prompt 阻塞）。
	const [materialPaneDragOver, setMaterialPaneDragOver] = React.useState(false);
	const [materialIngestQueue, setMaterialIngestQueue] = React.useState([]); // [{name, status:'parsing|importing|done|skip|error', err?}]
	// 资料 folder 管理 Drawer。
	const [folderDrawerOpen, setFolderDrawerOpen] = React.useState(false);
	const [folderDraftName, setFolderDraftName] = React.useState('');
	// Provider 列表密度切换 + 测试连接进行中态。
	const [providerListDense, setProviderListDense] = React.useState(!!defaultUi.providerListDense);
	// 模板版本 diff Modal。
	const [versionDiffState, setVersionDiffState] = React.useState(null); // {template, leftId, rightId}
	// AI 生成的示例提问缓存（sourceKey → [3 prompts]）；空 source 与失败时退化为静态。
	const [aiExamplePromptsBySource, setAiExamplePromptsBySource] = React.useState({});
	const [aiExamplesLoading, setAiExamplesLoading] = React.useState(false);
	const aiExamplesFetchKeyRef = React.useRef('');
	const [materialSort, setMaterialSort] = React.useState('updated');
	const [templateKeyword, setTemplateKeyword] = React.useState('');
	const [settingKeyword, setSettingKeyword] = React.useState('');
	const [materialModalOpen, setMaterialModalOpen] = React.useState(false);
	const [templateModalOpen, setTemplateModalOpen] = React.useState(false);
	const [bundleModalOpen, setBundleModalOpen] = React.useState(false);
	const [providerModalOpen, setProviderModalOpen] = React.useState(false);
	const [providerSwitchModalOpen, setProviderSwitchModalOpen] = React.useState(false);
	const [providerAdvancedOpen, setProviderAdvancedOpen] = React.useState(false);
	const [previewDrawerOpen, setPreviewDrawerOpen] = React.useState(false);
	const [previewTemplate, setPreviewTemplate] = React.useState(null);
	const [editingMaterial, setEditingMaterial] = React.useState(null);
	const [editingTemplate, setEditingTemplate] = React.useState(null);
	const [editingBundle, setEditingBundle] = React.useState(null);
	const [editingProvider, setEditingProvider] = React.useState(null);
	const [materialForm] = Form.useForm();
	const [templateForm] = Form.useForm();
	const [bundleForm] = Form.useForm();
	const [providerForm] = Form.useForm();
	const abortRef = React.useRef(null);
	const sendingRef = React.useRef(false);   // handleSend 同步重入闸(state 版 sending 在 commit 前是旧值)
	const streamBufferRef = React.useRef('');
	const reportLaunchRef = React.useRef(null);   // 对话栏快捷动作插座(与 useChatAssist 依赖面同形;未接线时恒 null)
	const streamReasoningBufferRef = React.useRef(''); // #16:DeepSeek reasoner 思考过程(独立于答案,仅展示/存档,绝不回灌 messages)
	const streamUsageRef = React.useRef(null); // 2A：本次流的 usage 计量(末帧到达后由 SSE usage 事件填充)
	const lastPromptMetaRef = React.useRef(null); // [P0-1] 上次 buildResolvedPrompt 的稳定层指纹与层账(随 usage.prompt 落盘;跨轮对照前缀缓存是否失效)
	const chatLogRef = React.useRef(null);
	// [Q-026/M-37][Q-027/M-38] 聊天区节点以回调 ref 落状态:首帧是落地页(messages 空)时 chatLogRef 为 null,
	// 依赖 [] 的滚动监听 / 代码复制委托永远挂不上(上滚暂停跟随、跳到最新、复制按钮全失效)。
	const [chatLogNode, setChatLogNode] = React.useState(null);
	const setChatLogEl = React.useCallback((el)=>{ chatLogRef.current = el; setChatLogNode(el || null); }, []);
	// 「自动跟随」开关：用户上滚 >40px 后置 false（暂停自动滚到底）；回到底部置 true。
	const [autoFollow, setAutoFollow] = React.useState(true);
	const backupRestoreInputRef = React.useRef(null);
	const desktopFileInputRef = React.useRef(null);
	const desktopFolderInputRef = React.useRef(null);

	const height = props.height ? props.height - 18 : (typeof document !== 'undefined' ? getLayoutViewportHeight() - 100 : 620);
	const desktopBridge = isDesktopBridgeAvailable();

	const activeConversation = React.useMemo(()=>{
		return conversations.find((item)=>item.id === activeConversationId) || null;
	}, [conversations, activeConversationId]);

	const activeSource = React.useMemo(()=>{
		if(selectedSourceId === TIMEPOINT_SOURCE_ID){
			// 合成的「起课时间」源（不持久化）：record 仅含时间 + 地点，即可驱动各式法起盘。
			return {
				id: TIMEPOINT_SOURCE_ID,
				sourceType: 'timepoint',
				title: `起课时间 · ${timepointDraft.divTime}`,
				module: 'sanshiunited',
				time: timepointDraft.divTime,
				zone: timepointDraft.zone,
				tags: [],
				snapshotStatus: 'lazy',
				updatedAt: timepointDraft.divTime,
				record: {
					divTime: timepointDraft.divTime,
					zone: timepointDraft.zone,
					lon: timepointDraft.lon,
					lat: timepointDraft.lat,
					gpsLon: timepointDraft.gpsLon,
					gpsLat: timepointDraft.gpsLat,
					gender: timepointDraft.gender,
					sourceModule: '',
				},
			};
		}
		if(selectedSourceId === NATAL_SOURCE_ID){
			// 合成的「命盘时间」源(不持久化):record 含 birth + 地点 → 走命盘技法(八字/紫微/星盘/各推运)即时起盘。
			return {
				id: NATAL_SOURCE_ID,
				sourceType: 'chart',
				title: `命盘时间 · ${natalDraft.birth}`,
				module: 'astrochart',
				time: natalDraft.birth,
				zone: natalDraft.zone,
				tags: [],
				snapshotStatus: 'lazy',
				updatedAt: natalDraft.birth,
				record: {
					birth: natalDraft.birth,
					zone: natalDraft.zone,
					lon: natalDraft.lon,
					lat: natalDraft.lat,
					gpsLon: natalDraft.gpsLon,
					gpsLat: natalDraft.gpsLat,
					gender: natalDraft.gender,
					name: natalDraft.name || '命盘时间',
				},
			};
		}
		return sources.find((item)=>item.id === selectedSourceId) || null;
	}, [sources, selectedSourceId, timepointDraft, natalDraft]);

	const sourceOptions = React.useMemo(()=>{
		const opts = sources.map((item)=>({
			value: item.id,
			label: `${item.sourceType === 'chart' ? '命盘' : '事盘'} · ${item.title}`,
			searchText: `${item.title} ${item.module || ''} ${(item.tags || []).join(' ')}`.toLowerCase(),
			item,
		}));
		opts.unshift({
			value: NATAL_SOURCE_ID,
			label: '🌐 命盘时间（此刻 / 自定义）',
			searchText: '命盘时间 本命 出生 natal 即时起盘',
			item: null,
		});
		opts.unshift({
			value: TIMEPOINT_SOURCE_ID,
			label: '⏱ 起课时间（此刻 / 自定义）',
			searchText: '起课时间 时间盘 占时 此刻 timepoint',
			item: null,
		});
		return opts;
	}, [sources]);

	const techniqueOptions = React.useMemo(()=>{
		return activeSource ? listAnalysisTechniqueOptions(activeSource) : [];
	}, [activeSource]);
	// 技法多选下拉按术数域 OptGroup 分组(仅当前可挂集内的键;未归组键落「其他」)。
	const groupedTechniqueOptions = React.useMemo(()=>{
		return groupMountTechniqueOptions(techniqueOptions);
	}, [techniqueOptions]);
	const techniqueLabelMap = React.useMemo(()=>{
		return new Map((techniqueOptions || []).map((item)=>[item.value, item.label]));
	}, [techniqueOptions]);
	const activeTechniqueKeys = React.useMemo(()=>{
		return filterTechniqueKeysBySource(activeSource, techniqueOptions, selectedTechniqueKeys);
	}, [activeSource, techniqueOptions, selectedTechniqueKeys]);
	const sourceContextMode = getTechniqueContextMode(activeTechniqueKeys);

	// 每技法的「生效覆盖」= 会话覆盖 ?? 同类默认(localStorage) ?? 空。仅收非空(有非默认项)的技法 →
	// 传给 getAnalysisTechniqueContexts 走强制重算；空 → 不进映射 → 默认路径(默认即现状)。
	// 依赖 mountSettingsNonce：点「设为同类默认/恢复默认」后重算。
	const effectiveTechniqueOptions = React.useMemo(()=>{
		// [V6-W1] 会话覆盖锚盘现状再剪(与草稿/应用同锚);同类默认(getMountTechniqueDefault)
		// 是跨盘模板,原样透传,由重算入口按各盘现状终判。
		// [Q-285/M-96] 解析逻辑收编到 resolveEffectiveTechniqueOptions(与无头入口同一函数,口径不再分叉)。
		return resolveEffectiveTechniqueOptions(activeTechniqueKeys, {
			record: activeSource && activeSource.record ? activeSource.record : null,
			sessionOverrides: techniqueOptionOverrides,
		});
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeTechniqueKeys, techniqueOptionOverrides, mountSettingsNonce, activeSource]);
	// 稳定签名,供 useEffect 依赖(对象引用每次都变,用 JSON 串避免无谓重算)。
	const effectiveTechniqueOptionsSig = React.useMemo(
		()=>JSON.stringify(effectiveTechniqueOptions),
		[effectiveTechniqueOptions]
	);

	const modelOptions = React.useMemo(()=>{
		const result = [];
		providerProfiles.forEach((profile)=>{
			if(profile.enabled === false){
				return;
			}
			normalizeProfileChatModels(profile).forEach((model)=>{
				result.push({
					value: encodeModelSelection(profile.id, model),
					label: `${profile.name || '未命名配置'} / ${model}`,
				});
			});
		});
		return result;
	}, [providerProfiles]);

	// issue #13：嵌入(向量)模型下拉——各 provider 的 embeddingModels，与聊天模型独立。
	const embeddingOptions = React.useMemo(()=>{
		const result = [];
		providerProfiles.forEach((profile)=>{
			if(profile.enabled === false){ return; }
			normalizeEmbeddingModels(profile).forEach((model)=>{
				result.push({
					value: encodeModelSelection(profile.id, model),
					label: `${profile.name || '未命名配置'} / ${model}`,
				});
			});
		});
		return result;
	}, [providerProfiles]);

	const activeProviderProfile = React.useMemo(()=>{
		const parsed = parseModelSelection(modelSelection);
		if(parsed.profileId){
			const selectedProfile = providerProfiles.find((item)=>item.id === parsed.profileId && item.enabled !== false);
			if(selectedProfile){
				return selectedProfile;
			}
		}
		return providerProfiles.find((item)=>item.enabled !== false) || null;
	}, [modelSelection, providerProfiles]);

	// [Q-322/Q-323] 参数浮层的「可拨」必须与请求体一致:
	//  · 推理型号(OpenAI o/gpt-5 系、DeepSeek reasoner、*-r1、kimi-k 系…)由 Java 出口剥掉 temperature/top_p/两惩罚 → 三格置灰;
	//  · Anthropic 自适应族(Opus 4.7 起 / Sonnet 5 / Fable / Mythos)根本不接受采样参数 → 同置灰;
	//  · 温度上限按家族取(Anthropic 0..1,其余 0..2),此前滑杆一律到 2、拨过 1 必 400。
	const paramPopover = React.useMemo(()=>{
		const model = parseModelSelection(modelSelection).model;
		const protoFamily = activeProviderProfile
			? (activeProviderProfile.protocolFamily || getProviderProtocolFamily(activeProviderProfile.providerType))
			: 'openai-compatible';
		const reasoning = isReasoningModel(model);
		const anthropicAdaptive = protoFamily === 'anthropic' && anthropicThinkingMode(model) === 'adaptive';
		return {
			model,
			protoFamily,
			reasoning,
			anthropicAdaptive,
			samplingDead: reasoning || anthropicAdaptive,
			// [Q-048⑤ 裁决 2026-09-18·维持现状+补提示] kimi-k 系:前端不入 isReasoningModel(滑杆可拨),后端出口按推理模型剥温度 / top_p(有意分治)→ 浮层明说
			kimiNote: /^kimi-k\d/i.test(`${model || ''}`.replace(/^.*\//, '')) ? 'kimi-k 系：温度 / top_p 在后端出口按推理模型剥除，此处拨动不生效' : '',
			penaltyDead: reasoning || !isOpenAiFamily(protoFamily),
			tempMax: temperatureMaxForFamily(protoFamily),
			// [Q-044] 思考档逐档自证:与更低档产出同一份请求键的档一律置灰(极高/最大对 OpenAI 系 == 高;
			// Ollama / R1 等无思考参数的模型全部 == 关闭)。此前六个档一律可选,拨了毫无差别也不提示。
			thinkingLevels: thinkingLevelEffects(
				activeProviderProfile ? activeProviderProfile.providerType : 'openai',
				model,
				(activeProviderProfile && activeProviderProfile.providerOptions) || {},
			),
		};
	}, [modelSelection, activeProviderProfile]);

	const referenceOptions = React.useMemo(()=>{
		const folderLookup = new Map(materialFolders.map((item)=>[item.id, item]));
		const bundleOptions = bundles.map((item)=>({
			value: `bundle:${item.id}`,
			label: `组合 · ${item.name}`,
		}));
		const materialOptions = materials.map((item)=>({
			value: `material:${item.id}`,
			label: `资料 · ${item.name}${item.folderId && folderLookup.get(item.folderId) ? ` / ${folderLookup.get(item.folderId).name}` : ''}`,
		}));
		// [Q-028/M-39] 参考下拉补模板项(与 @模板 引用同键 template:<id>)
		const templateOptions = (templates || []).map((item)=>({
			value: `template:${item.id}`,
			label: `模板 · ${item.name}`,
		}));
		return bundleOptions.concat(materialOptions).concat(templateOptions);
	}, [materials, bundles, materialFolders, templates]);

	const visibleMessages = React.useMemo(()=>{
		return (messages || []).filter((item)=>item && item.role !== 'system_hidden');
	}, [messages]);

	const filteredConversations = React.useMemo(()=>{
		const keyword = `${historyKeyword || ''}`.trim().toLowerCase();
		return sortByUpdatedDesc(conversations).filter((item)=>{
			if(item.archived && historyFilter.archived === 'active'){
				return false;
			}
			if(!item.archived && historyFilter.archived === 'archived'){
				return false;
			}
			if(historyFilter.favorite !== 'all'){
				const expectFavorite = historyFilter.favorite === 'favorite';
				if(Boolean(item.favorite) !== expectFavorite){
					return false;
				}
			}
			if(historyFilter.provider && `${item.providerName || item.providerType || ''}` !== historyFilter.provider){
				return false;
			}
			if(historyFilter.model && `${item.model || ''}` !== historyFilter.model){
				return false;
			}
			// [Q-414 裁决 2026-09-18] 案例类型筛选补「起课时间」与「未挂案例」(此前只有命盘 / 事盘,起课时间会话与无案例会话筛不出)
			if(historyFilter.sourceType === '__none__'){
				if(item.sourceRef && item.sourceRef.sourceType){ return false; }
			}else if(historyFilter.sourceType && `${item.sourceRef && item.sourceRef.sourceType ? item.sourceRef.sourceType : ''}` !== historyFilter.sourceType){
				return false;
			}
			if(!keyword){
				return true;
			}
			const text = [
				item.title,
				item.model,
				item.providerName,
				item.providerType,
				item.sourceRef && item.sourceRef.title,
			].join(' ').toLowerCase();
			return text.indexOf(keyword) >= 0;
		});
	}, [conversations, historyKeyword, historyFilter]);

	// [Q-060/AW-11] 勾选集只在点勾选框时由表格回调修剪 —— 改筛选 / 输关键词 / 批量归档后行从视图消失,
	// 勾选还在,批量钮照样可点并作用于**看不见的会话**(筛选结果为空时表格根本没挂载,「批量删除」依旧可点)。
	// 这里把勾选集与当前可见集取交:批量动作的作用面 = 你眼前看得见的那些。
	React.useEffect(()=>{
		const visible = new Set(filteredConversations.map((item)=>item && item.id));
		setSelectedHistoryIds((prev)=>{
			const next = (prev || []).filter((id)=>visible.has(id));
			return next.length === (prev || []).length ? prev : next;
		});
	}, [filteredConversations]);

	const filteredMaterials = React.useMemo(()=>{
		const keyword = `${materialKeyword || ''}`.trim().toLowerCase();
		let list = materials.filter((item)=>{
			if(selectedFolderId && item.folderId !== selectedFolderId){
				return false;
			}
			if(!keyword){
				return true;
			}
			return buildMaterialSearchText(item).indexOf(keyword) >= 0;
		});
		if(materialSort === 'name'){
			list = compareByName(list);
		}else if(materialSort === 'size'){
			list = list.slice(0).sort((a, b)=>(b.size || 0) - (a.size || 0));
		}else{
			list = sortByUpdatedDesc(list);
		}
		return list;
	}, [materials, materialKeyword, selectedFolderId, materialSort]);

	const filteredTemplates = React.useMemo(()=>{
		const keyword = `${templateKeyword || ''}`.trim().toLowerCase();
		const allCards = sortByUpdatedDesc(templates).map((item)=>({
			...item,
			cardType: 'template',
		})).concat(sortByUpdatedDesc(bundles).map((item)=>({
			...item,
			cardType: 'bundle',
		})));
		if(!keyword){
			return allCards;
		}
		return allCards.filter((item)=>{
			const text = [
				item.name,
				item.instructionText,
				item.jsonSchema,
				item.defaultSystemPrompt,
			].join(' ').toLowerCase();
			return text.indexOf(keyword) >= 0;
		});
	}, [templates, bundles, templateKeyword]);

	const filteredProfiles = React.useMemo(()=>{
		const keyword = `${settingKeyword || ''}`.trim().toLowerCase();
		const list = sortByUpdatedDesc(providerProfiles);
		if(!keyword){
			return list;
		}
		return list.filter((item)=>{
			const text = [
				item.name,
				item.providerType,
				normalizeProfileModels(item).join(' '),
				normalizeEmbeddingModels(item).join(' '),
				item.baseUrl,
				// [Q-059/M-79] 检索文本不含额外请求头的值(令牌位)
				JSON.stringify({ ...(item.providerOptions || {}), extraHeaders: Object.keys((item.providerOptions || {}).extraHeaders || {}) }),
			].join(' ').toLowerCase();
			return text.indexOf(keyword) >= 0;
		});
	}, [providerProfiles, settingKeyword]);

	const lockedContextItems = React.useMemo(()=>{
		const resolved = resolveReferenceItems(referenceIds, materials, bundles, templates);
		const items = [];
		if(activeSource){
			items.push({
				key: `source:${activeSource.id}`,
				title: `案例前提 · ${activeSource.title}`,
				type: activeSource.sourceType === 'chart' ? '命盘' : '事盘',
				content: sourceContext && sourceContext.content ? sourceContext.content : '',
				meta: sourceContext && sourceContext.meta ? sourceContext.meta : null,
				status: sourceContext && sourceContext.content ? 'ready' : 'pending',
				// [YF v45] 源全文也过「纳入内容」:显式全清与「读取中」分开提示。
				emptyHint: sourceContext && sourceContext.sectionsCleared
					? '该技法所有分段已在「纳入内容」中取消,案例前提未挂载任何内容;重新勾选即可恢复。'
					: '将自动读取案例快照',
			});
		}
		if(sessionSystemPrompt){
			items.push({
				key: 'session-system-prompt',
				title: '本轮系统提示',
				type: 'system',
				content: sessionSystemPrompt,
				status: 'ready',
			});
		}
		(techniqueContexts || []).forEach((item)=>{
			items.push({
				key: `technique:${item.key}`,
				title: `技法 · ${item.title || item.key}`,
				type: 'technique',
				content: item.content || '',
				meta: item.meta || null,
				status: item.status || (item.content ? 'ready' : 'missing'),
				// [YF v45] 显式全清(纳入内容一段未勾)与「快照缺失」分开提示,勿误导用户去排查排盘。
				emptyHint: item.sectionsCleared
					? '该技法所有分段已在「纳入内容」中取消,未挂载任何内容;到挂载设置重新勾选即可恢复。'
					: (item.status === 'missing'
						? '当前未找到该技法可用快照，未挂载该技法内容。'
						: (item.status === 'error'
							? '按挂载设置重算该技法快照失败，本次未挂载该技法内容;可调整设置重试或恢复默认。'
							: '正在按已存案例/命盘数据自动补生成快照。')),
			});
		});
		resolved.materials.forEach((item)=>{
			items.push({
				key: `material:${item.id}`,
				title: `资料 · ${item.name}`,
				type: item.kind || 'note',
				content: item.extractedText || '',
				status: item.extractedText ? 'ready' : 'pending',
			});
		});
		resolved.templates.forEach((item)=>{
			items.push({
				key: `template:${item.id}`,
				title: `模版 · ${item.name}`,
				type: item.format || 'text',
				content: item.instructionText || item.jsonSchema || item.content || '',
				status: 'ready',
			});
		});
		return items;
	}, [referenceIds, materials, bundles, templates, activeSource, sourceContext, sessionSystemPrompt, techniqueContexts]);

	// 挂载面板：新出现的层默认展开（否则新加技法时面板看起来是空的）；用户手动收起的保持收起。
	const [contextActiveKeys, setContextActiveKeys] = React.useState([]);
	const seenContextKeysRef = React.useRef(new Set());
	React.useEffect(()=>{
		const keys = lockedContextItems.map((item)=>item.key);
		setContextActiveKeys((prev)=>{
			const next = new Set(prev.filter((k)=>keys.includes(k)));
			keys.forEach((k)=>{
				if(!seenContextKeysRef.current.has(k)){
					next.add(k);
				}
				seenContextKeysRef.current.add(k);
			});
			return Array.from(next);
		});
	}, [lockedContextItems]);

	// [chat-assist] 对话交互增强唯一插座:缺省全部空路径(mainline 原样/promptLayerExtras {}/checkpoint undefined)=现状
	// [C4] 按任务用模型:六槽全空时 pickRound/afterRound 皆零路径(请求字节不变)
	const chatModels = useChatModels({ providerProfiles });
	const chatAssist = useChatAssist({
		prompt, setPrompt, sending, messages, visibleMessages, setMessages, activeConversation, activeConversationId, conversations, setConversations,
		activeSource, sources, setSources, materials, bundles, templates, referenceIds, setReferenceIds, selectedTechniqueKeys, setSelectedTechniqueKeys,
		selectedSourceId, setSelectedSourceId, sessionSystemPrompt, setSessionSystemPrompt, techniqueOptionOverrides, setTechniqueOptionOverrides,
		modelSelection, setModelSelection, thinkingLevel, setThinkingLevel, activeProviderProfile, providerProfiles,
		// [Q-032/M-47] 回退检查点要能把温度 / top_p 也恢复(写偏好,与滑杆同源)
		chatTemperature, chatTopP,
		setChatTemperature: (v)=>{ setChatTemperature(v); saveUiPrefs({ chatTemperature: v }); },
		setChatTopP: (v)=>{ setChatTopP(v); saveUiPrefs({ chatTopP: v }); },
		promptClipStats, lastPromptMetaRef, lockedContextItems, handleSend, handleBranchFromMessage, buildResolvedPrompt, buildResolvedPromptQuiet, applyBundle,
		stopSequences, frequencyPenalty, presencePenalty, jsonMode,   // [Q-045] 浮层五类参数下传,三条旁路与主发送共用 applyChatParams
		updateConversationMeta, openConversation, setMountDrawerOpen, focusSourceSelect, setInnerTab, reportLaunchRef,   // [Q-041] 状态栏「命主」在未挂载时聚焦顶栏案例下拉
		reloadBundles: async ()=>setBundles(await listStoreRecords(AI_ANALYSIS_STORES.bundles)),
		ensureConversationRecord,   // [C5] 多模型对比在钩子里建/续会话
	});

	// [首开反卡 2026-08-09] 双波加载:APP(WKWebView)里 materials/conversations 大库的一次性读会把
	// 首开冻成「全页转圈很久」(WebKit IDB 大 value 反序列化慢,Chromium 无感 → preview 好 APP 坏)。
	// Wave1=轻库(接口档/夹/组/模板/包,小记录)——await 完立即收 loading,首帧秒出;
	// Wave2=后台(迁移→资料分批游标→版本/会话)——绝不挡首帧,批间让出主线程,到位即填充。
	// 🔴 迁移必须在 templateVersions 读取之前(migrate 会补建版本记录,先读后迁=模板打开缺版本)。
	const loadWorkspace = React.useCallback(async (options = {})=>{
		setWorkspaceLoading(true);
		setDeepLoading(true);
		try{
			const [
				nextProfiles,
				nextFolders,
				nextTagGroups,
				nextTemplates,
				nextBundles,
			] = await Promise.all([
				listStoreRecords(AI_ANALYSIS_STORES.providerProfiles),
				listStoreRecords(AI_ANALYSIS_STORES.materialFolders),
				listStoreRecords(AI_ANALYSIS_STORES.tagGroups),
				listStoreRecords(AI_ANALYSIS_STORES.templates),
				listStoreRecords(AI_ANALYSIS_STORES.bundles),
			]);
			setProviderProfiles(sortByUpdatedDesc(nextProfiles));
			// [G1] 密文解不开(换机器/钥匙串被清)→ 提示重填,绝不带密文串发请求
			// [Q-059/M-82] 原密文在本会话内保留不覆写(未重填即照旧),卡片打「请重填」标记;额外请求头令牌同此
			if((nextProfiles || []).some((p)=>p && (p.apiKeyDecryptFailed || p.extraHeadersDecryptFailed))){
				message.warning('部分 AI 接口的 API Key 或鉴权请求头无法解密(钥匙串主密钥缺失),请到「接口设置」重新填入;未重填前原密文保留不覆盖。', 8);
			}
			setMaterialFolders(compareByName(nextFolders));
			setTagGroups(compareByName(nextTagGroups));
			setTemplates(sortByUpdatedDesc(nextTemplates));
			setBundles(sortByUpdatedDesc(nextBundles));
			setSources(listAnalysisSources());
		}catch(e){
			console.error(e);
			message.error('AI分析工作区加载失败');
		}finally{
			setWorkspaceLoading(false);
		}
		(async ()=>{
			try{
				await migrateWorkspaceData();
				const nextMaterials = await listStoreRecordsBatched(AI_ANALYSIS_STORES.materials, { batch: 12 });
				setMaterials(sortByUpdatedDesc(nextMaterials));
				const [nextTemplateVersions, nextConversations] = await Promise.all([
					listStoreRecords(AI_ANALYSIS_STORES.templateVersions),
					listStoreRecordsBatched(AI_ANALYSIS_STORES.conversations, { batch: 40 }),
				]);
				setTemplateVersions(sortByUpdatedDesc(nextTemplateVersions));
				setConversations(sortByUpdatedDesc(nextConversations));
				if(options.keepConversation && activeConversationId){
					// v1.16-O: 防 race
					const loadToken = ++conversationLoadTokenRef.current;
					const msgs = await listConversationMessages(activeConversationId);
					if(loadToken === conversationLoadTokenRef.current){
						setMessages(msgs);
					}
				}
			}catch(e){
				console.error(e);
				message.error('AI分析资料/会话载入失败');
			}finally{
				setDeepLoading(false);
			}
		})();
	}, [activeConversationId]);

	React.useEffect(()=>{
		loadWorkspace();
	}, [loadWorkspace]);

	React.useEffect(()=>{
		if(props.hook){
			props.hook.fun = ()=>{
				// horosa_panel_ready_v1:AI 分析是流式输出,没有「一次 setState 画完」的点;
				// 但 owner 要验收的那个动作(左栏切时间/改选项)在本技法上的完整语义就是
				// predictHook.fun —— 工作区按新盘重载(资料/模版/会话/挂载快照全部落 state)。
				// loadWorkspace 的 finally 里 setWorkspaceLoading(false) 是最后一次状态提交,
				// 故 await 之后即为面板落定;markPanelReady 内双 rAF 再推到下一绘制帧。
				// 流式回答的逐 token 追加**不**计入(那是模型出字速度,不属于渲染预算)。
				loadWorkspace({ keepConversation: true }).then(()=>{
					markPanelReady('aianalysis');
				}).catch(()=>{ /* 失败不记样本 */ });
			};
		}
	}, [props.hook, loadWorkspace]);

	React.useEffect(()=>{
		saveUiPrefs({
			innerTab,
			modelSelection,
			referenceIds,
			// [Q-414/M-165] 首帧 selectedSourceId 恒空 → activeTechniqueKeys=[] 曾立刻把 selectedTechniqueKeys 写空
			//   (注册表称保存「挂载勾选」,实际每次启动都丢)。无挂载源时不写该键(saveUiPrefs 合并,undefined 即保留旧值)。
			selectedTechniqueKeys: activeSource ? activeTechniqueKeys : undefined,
			sessionSystemPrompt,
		});
		if(props.dispatch){
			props.dispatch({
				type: 'astro/save',
				payload: {
					currentSubTab: innerTab,
				},
			});
		}
	}, [innerTab, modelSelection, referenceIds, activeTechniqueKeys, activeSource, sessionSystemPrompt, props.dispatch]);

	React.useEffect(()=>{
		if(!selectedSourceId){
			setSourceContext(null);
			return;
		}
		const source = sources.find((item)=>item.id === selectedSourceId);
		if(!source){
			setSourceContext(null);
			return;
		}
		let cancelled = false;
		getAnalysisSourceContext(source, {
			mode: sourceContextMode,
		}).then((ctx)=>{
			if(!cancelled){
				setSourceContext((prev)=>sameSourceContext(prev, ctx) ? prev : ctx);
			}
		}).catch(()=>{
			if(!cancelled){
				setSourceContext(null);
			}
		});
		return ()=>{
			cancelled = true;
		};
	// [YF v45] mountSettingsNonce:改「纳入内容」后源卡片(full 模式的事盘/命盘全文)也要重取——
	// getAnalysisSourceContext 已改为读出后按当下设置过滤,重取即拿到新过滤结果(缓存命中也过滤,零额外成本)。
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedSourceId, sources, sourceContextMode, mountSettingsNonce]);

	React.useEffect(()=>{
		if(!activeSource){
			// [Q-414/M-165] 无挂载源时不清勾选:activeTechniqueKeys 已按源过滤为 [](挂载/发送零影响),
			//   保留原勾选才能在重选案例后回灌(此前这里清空 + 上面 effect 写空 = 勾选每次启动都丢)。
			setTechniqueContexts([]);
			return;
		}
		const allowed = new Set(techniqueOptions.map((item)=>item.value));
		const next = selectedTechniqueKeys.filter((item)=>allowed.has(item));
		if(next.length !== selectedTechniqueKeys.length){
			setSelectedTechniqueKeys(next);
		}
	}, [activeSource, techniqueOptions, selectedTechniqueKeys]);

	// AI 生成的示例提问：只在 landing(无消息) 且有可用 Provider 时跑一次；按 (sourceId + provider + model) 缓存。
	// 失败/取消/无 provider → 静默退到静态示例。所有 setState 都通过 cancelled 守门避免组件卸载后写入。
	React.useEffect(()=>{
		const sourceKey = activeSource ? `${activeSource.sourceType}:${activeSource.id}` : 'none';
		const sel = parseModelSelection(modelSelection || '');
		const profile = activeProviderProfile;
		const provKey = profile ? `${profile.id || ''}-${sel.model || ''}` : '';
		const fetchKey = `${sourceKey}::${provKey}`;
		if(aiExamplePromptsBySource[fetchKey] || aiExamplesFetchKeyRef.current === fetchKey){
			return undefined;
		}
		if(!profile || !sel.model || !(profile.apiKey || profile.providerType === 'ollama')){
			return undefined;
		}
		// 已挂载消息时不必生成示例（用户已经在对话中）。
		if(messages.length > 0){
			return undefined;
		}
		aiExamplesFetchKeyRef.current = fetchKey;
		let cancelled = false;
		(async ()=>{
			try{
				setAiExamplesLoading(true);
				const sourceHint = activeSource
					? `当前案例：${activeSource.title}，类型=${activeSource.sourceType === 'chart' ? '命盘' : '事盘'}。`
					: '用户尚未选择案例（命盘/事盘）。';
				const sys = '你是星阙（Horosa）的占星/术数 AI 助手。根据当前案例上下文，给出 3 条用户可能想问的简短示例提问，每条 8-18 个汉字，覆盖差异化角度（如运势/格局/择时/吉凶等）。只输出 JSON 数组，例如：["...","...","..."]。不要加任何前后缀文字。';
				const usr = `${sourceHint}\n请给出 3 条示例提问。仅返回 JSON 数组。`;
				const opts = applyThinkingLevel({ ...(profile.providerOptions || {}) }, 'off', profile.providerType, sel.model);
				const rsp = await requestAIAnalysisChat({
					providerType: profile.providerType,
					apiKey: profile.apiKey,
					baseUrl: profile.baseUrl,
					model: sel.model,
					providerOptions: { ...(opts || {}), requestTimeoutMs: 20000 }, // 20s 上限，慢就不展示
					messages: [
						{ role: 'system', content: sys },
						{ role: 'user', content: usr },
					],
				});
				if(cancelled){ return; }
				const text = rsp && rsp.Result && rsp.Result.content ? `${rsp.Result.content}`.trim() : '';
				let arr = null;
				try{
					const m = text.match(/\[[\s\S]*\]/);
					if(m){ arr = JSON.parse(m[0]); }
				}catch(_){ arr = null; }
				if(Array.isArray(arr)){
					const clean = arr.map((s)=>`${s || ''}`.trim()).filter((s)=>s && s.length <= 50).slice(0, 3);
					if(clean.length >= 2){
						setAiExamplePromptsBySource((prev)=>({ ...prev, [fetchKey]: clean }));
					}
				}
			}catch(e){
				// 静默失败：保持静态示例。
			}finally{
				if(!cancelled){ setAiExamplesLoading(false); }
			}
		})();
		return ()=>{
			cancelled = true;
		};
	}, [activeSource ? `${activeSource.sourceType}:${activeSource.id}` : 'none', modelSelection, messages.length, activeProviderProfile]);

	// 组合包待挂载技法落地：选定 source 后，把 pending 技法与该 source 支持集取交集，合并入已选技法。
	React.useEffect(()=>{
		if(activeSource && pendingBundleTechniqueKeys.length){
			const allowed = new Set(techniqueOptions.map((item)=>item.value));
			const next = pendingBundleTechniqueKeys.filter((item)=>allowed.has(item));
			if(next.length){
				setSelectedTechniqueKeys((prev)=>uniqueTextList(prev.concat(next)));
			}
			setPendingBundleTechniqueKeys([]);
		}
	}, [activeSource, techniqueOptions, pendingBundleTechniqueKeys]);

	React.useEffect(()=>{
		if(!activeSource || !activeTechniqueKeys.length){
			setTechniqueContexts([]);
			return;
		}
		let cancelled = false;
		setTechniqueContexts(buildTechniqueLoadingState(activeTechniqueKeys, techniqueLabelMap));
		activeTechniqueKeys.forEach((techniqueKey)=>{
			// 该技法若有「每技法设置」覆盖 → 走强制重算；否则默认路径(默认即现状)。段过滤复用 AI导出设置(Phase 1)。
			const optsForKey = effectiveTechniqueOptions[techniqueKey];
			getAnalysisTechniqueContexts(activeSource, [techniqueKey], {
				sourceContext,
				techniqueOptions: optsForKey ? { [techniqueKey]: optsForKey } : null,
			}).then((items)=>{
				if(cancelled){
					return;
				}
				const nextItem = items && items[0]
					? items[0]
					: {
						key: techniqueKey,
						title: techniqueLabelMap.get(techniqueKey) || techniqueKey,
						module: techniqueKey,
						content: '',
						available: false,
						status: 'missing',
						meta: {},
					};
				setTechniqueContexts((prev)=>mergeTechniqueState(prev, nextItem, activeTechniqueKeys, techniqueLabelMap));
			}).catch(()=>{
				if(cancelled){
					return;
				}
				setTechniqueContexts((prev)=>mergeTechniqueState(prev, {
					key: techniqueKey,
					title: techniqueLabelMap.get(techniqueKey) || techniqueKey,
					module: techniqueKey,
					content: '',
					available: false,
					status: 'missing',
					meta: {},
				}, activeTechniqueKeys, techniqueLabelMap));
			});
		});
		return ()=>{
			cancelled = true;
		};
	// effectiveTechniqueOptionsSig / mountSettingsNonce 变更(改设置或段勾选) → 重新 fetch 让卡片快照刷新。
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeSource, activeTechniqueKeys, sourceContext, techniqueLabelMap, effectiveTechniqueOptionsSig, mountSettingsNonce]);

	React.useEffect(()=>{
		// 档案列表异步加载,首帧 modelOptions 为空:此时不能把持久化的 modelSelection 清掉——否则档案
		// 一到位就落到第一项,用户每次进页都被换成别的模型(压测实抓)。为空=尚未就绪,原样保留即可;
		// 真正「选择已失效」只在 options 就绪后判定。
		if(!modelOptions.length){
			return;
		}
		if(!modelSelection || !modelOptions.some((item)=>item.value === modelSelection)){
			setModelSelection(modelOptions[0].value);
		}
	}, [modelOptions, modelSelection]);

	React.useEffect(()=>{
		const el = chatLogRef.current;
		if(el && autoFollow){
			el.scrollTop = el.scrollHeight;
		}
	}, [visibleMessages, autoFollow]);

	// 监听用户滚动：上滚 >40px 自动暂停跟随；回到底部恢复跟随。([Q-027/M-38] 依赖聊天区节点,节点出现即挂)
	React.useEffect(()=>{
		const el = chatLogNode;
		if(!el){ return undefined; }
		const onScroll = ()=>{
			const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
			setAutoFollow(distFromBottom < 40);
		};
		el.addEventListener('scroll', onScroll, { passive: true });
		return ()=>{ el.removeEventListener('scroll', onScroll); };
	}, [chatLogNode]);

	// 跟踪组件挂载状态，供异步流程安全 setState。
	React.useEffect(()=>{
		isMountedRef.current = true;
		return ()=>{ isMountedRef.current = false; };
	}, []);

	// 代码块「复制按钮」事件委托（容器级）：点击 .xq-code-copy → 复制紧邻 <pre><code> 的纯文本。([Q-026/M-37] 随聊天区节点挂载)
	React.useEffect(()=>{
		const el = chatLogNode;
		if(!el){ return undefined; }
		const onClick = (e)=>{
			const btn = e.target && e.target.closest ? e.target.closest('.xq-code-copy') : null;
			if(!btn){ return; }
			const wrap = btn.closest('.xq-code-block');
			const code = wrap ? wrap.querySelector('pre code') : null;
			const text = code ? code.textContent || '' : '';
			if(!text){ return; }
			copyTextSmart(text).then((ok)=>{
				if(ok){
					message.success('已复制代码', 1);
					btn.classList.add('xq-code-copy--ok');
					setTimeout(()=>btn.classList.remove('xq-code-copy--ok'), 1200);
				}else{
					message.error('复制失败', 1.5);
				}
			});
		};
		el.addEventListener('click', onClick);
		return ()=>{ el.removeEventListener('click', onClick); };
	}, [chatLogNode]);

	// 代码块语法高亮：visibleMessages 变化后，对未高亮过的 <pre><code> 跑 hljs.highlightElement。
	// 流式期间也跑（每次新片段后增量补色），出错静默回退；不会改 textContent，复制功能不受影响。
	React.useEffect(()=>{
		const el = chatLogRef.current;
		if(!el){ return; }
		highlightCodeUnder(el);
	}, [visibleMessages]);

	const applyProviderPresetToForm = React.useCallback((providerType)=>{
		const preset = getProviderPreset(providerType);
		const currentValues = providerForm.getFieldsValue(true);
		// [Q-411/M-159] 换预设:用户已填的配置名不被预设名覆盖(只有空或仍是上一预设名时才换);
		//   清 Key 的同时也清「额外请求头」(鉴权定制里的令牌不该跟着换到新预设地址)。
		const prevPreset = getProviderPreset(currentValues.providerType || 'openai');
		const typedName = `${currentValues.name || ''}`.trim();
		const keepName = typedName && typedName !== prevPreset.label;
		providerForm.setFieldsValue({
			...currentValues,
			apiKey: '',
			extraHeadersText: '{}',
			providerType,
			name: keepName ? typedName : preset.label,
			baseUrl: preset.baseUrl,
			manualModels: joinModelLines(getProviderDefaultChatModels(providerType)),
			embeddingModels: joinModelLines(getProviderDefaultEmbeddingModels(providerType)),
			requestTimeoutMs: preset.requestTimeoutMs || 120000,
			anthropicApiVersion: preset.anthropicApiVersion || '2023-06-01',
			anthropicMaxTokens: preset.anthropicMaxTokens || '2048',
			anthropicThinkingBudget: preset.anthropicThinkingBudget || '',
			anthropicTopP: preset.anthropicTopP || '',
			anthropicTopK: preset.anthropicTopK || '',
			geminiGenerationConfigText: currentValues.geminiGenerationConfigText || '{}',
			geminiSafetySettingsText: currentValues.geminiSafetySettingsText || '[]',
			ollamaKeepAlive: preset.ollamaKeepAlive || '5m',
			ollamaNumCtx: preset.ollamaNumCtx || '8192',
			ollamaNumPredict: preset.ollamaNumPredict || '1024',
			ollamaTopK: preset.ollamaTopK || '40',
			ollamaTopP: preset.ollamaTopP || '0.9',
			ollamaRepeatPenalty: preset.ollamaRepeatPenalty || '1.1',
			enabled: currentValues.enabled !== false,
		});
	}, [providerForm]);

	async function startNewConversation(options = {}){
		if(abortRef.current){
			abortRef.current.abort();
		}
		setActiveConversationId('');
		setMessages([]);
		setPrompt('');
		setSelectedHistoryIds([]);
		// [Q-046/M-57] 新对话要把「上一条对话的残留」清干净:
		//  · pendingImages —— 加了图没发就点「新对话」,图会跟着新对话的第一条消息一起发出去(上一盘的图配这一盘的问);
		//  · promptClipStats —— 裁剪账横幅还挂着上一条对话的「整层未纳入」提示,新对话根本没挂那些层。
		setPendingImages([]);
		setPromptClipStats(null);
		if(options.switchTab !== false){
			setInnerTab('analysis');
		}
	}

	async function openConversation(conversation){
		if(!conversation){
			return;
		}
		if(abortRef.current){
			abortRef.current.abort();
		}
		setActiveConversationId(conversation.id);
		// [Q-060/AW-14] 合成源会话:先把当时的草稿还原回去,再选中合成 id —— 否则挂载内容用的是此刻的草稿时刻
		const _ref = conversation.sourceRef || null;
		const _draft = _ref && _ref.draft && typeof _ref.draft === 'object' ? _ref.draft : null;
		if(_draft && _ref.id === TIMEPOINT_SOURCE_ID){
			setTimepointDraft((prev)=>({ ...prev, ..._draft }));
		}else if(_draft && _ref.id === NATAL_SOURCE_ID){
			setNatalDraft((prev)=>({ ...prev, ..._draft }));
		}
		setSelectedSourceId(_ref && _ref.id ? _ref.id : '');
		setReferenceIds(conversation.referenceIds || []);
		setSelectedTechniqueKeys(conversation.techniqueKeys || []);
		if(conversation.providerProfileId && !providerProfiles.some((item)=>item.id === conversation.providerProfileId)){
			message.info('该对话原用的接口配置已删除，已切换到可用配置，请确认模型后再发送。');
		}
		setModelSelection(encodeModelSelection(conversation.providerProfileId || '', conversation.model || ''));
		setSessionSystemPrompt(conversation.systemPrompt || '');
		// v1.16-O: 防 race 切换 — 用 token check
		const loadToken = ++conversationLoadTokenRef.current;
		const msgs = await listConversationMessages(conversation.id);
		if(loadToken === conversationLoadTokenRef.current){
			setMessages(msgs);
		}
		setInnerTab('analysis');
	}

	async function ensureConversationRecord(currentPrompt, profile, model){
		const now = new Date().toISOString();
		const source = activeSource || null;
		const payload = {
			title: activeConversation ? (activeConversation.title || buildConversationTitle(currentPrompt, source)) : buildConversationTitle(currentPrompt, source),
			sourceRef: source ? {
				id: source.id,
				sourceType: source.sourceType,
				title: source.title,
				module: source.module,
				// [Q-060/AW-14]「起课时间 / 命盘时间」是合成源、不入库:只存四键的话,重开会话时挂载内容取的是
				// **当下的草稿时刻**(组件挂载那一刻或用户最近一次手改),标题与「案例」列却还是原时刻 —— 续问时
				// AI 拿到的其实是另一张盘。这里把当时的草稿一起存下,openConversation 还原它。
				draft: (source.id === TIMEPOINT_SOURCE_ID || source.id === NATAL_SOURCE_ID)
					? { ...(source.record || {}), name: (source.record && source.record.name) || '' }
					: undefined,
			} : null,
			providerProfileId: profile ? profile.id : '',
			providerName: profile ? profile.name : '',
			providerType: profile ? profile.providerType : '',
			model,
			referenceIds: referenceIds.slice(0),
			techniqueKeys: activeTechniqueKeys.slice(0),
			systemPrompt: sessionSystemPrompt,
			lastMessageAt: now,
			updatedAt: now,
			archived: activeConversation ? activeConversation.archived : false,
			favorite: activeConversation ? activeConversation.favorite : false,
			branchRootId: activeConversation ? (activeConversation.branchRootId || activeConversation.id) : null,
			parentConversationId: activeConversation ? activeConversation.parentConversationId : null,
			schemaVersion: AI_ANALYSIS_SCHEMA_VERSION,
		};
		const conversation = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
			...(activeConversation || {}),
			...payload,
			createdAt: activeConversation ? activeConversation.createdAt : now,
		}, 'conv');
		setConversations((prev)=>{
			const exists = prev.some((item)=>item.id === conversation.id);
			return sortByUpdatedDesc(exists ? prev.map((item)=>item.id === conversation.id ? conversation : item) : [conversation].concat(prev));
		});
		setActiveConversationId(conversation.id);
		return conversation;
	}

	async function ensureChunkEmbeddings(profile, embeddingModel, chunks){
		if(!profile || !embeddingModel || !(chunks || []).length){
			return chunks || [];
		}
		const allEmbeddings = await listStoreRecords(AI_ANALYSIS_STORES.materialEmbeddings);
		const enriched = [];
		const missing = [];
		(chunks || []).forEach((chunk)=>{
			const found = allEmbeddings.find((item)=>item.chunkId === chunk.id && item.providerProfileId === profile.id && item.embeddingModel === embeddingModel);
			if(found && Array.isArray(found.vector) && found.vector.length){
				enriched.push({
					...chunk,
					vector: found.vector,
				});
			}else{
				missing.push(chunk);
			}
		});
		if(missing.length){
			const rsp = await requestEmbeddingVectors({
				providerType: profile.providerType,
				apiKey: profile.apiKey,
				baseUrl: profile.baseUrl,
				model: embeddingModel,
				embeddingModel,
				providerOptions: profile.providerOptions || {},
				input: missing.map((item)=>item.content),
			});
			const vectors = rsp && rsp.Result && Array.isArray(rsp.Result.vectors) ? rsp.Result.vectors : [];
			const saved = await bulkPutStoreRecords(AI_ANALYSIS_STORES.materialEmbeddings, missing.map((chunk, idx)=>({
				id: `emb-${profile.id}-${embeddingModel}-${chunk.id}`,
				materialId: chunk.materialId,
				chunkId: chunk.id,
				providerProfileId: profile.id,
				embeddingModel,
				vector: vectors[idx] || [],
			})), 'emb');
			saved.forEach((item)=>{
				const chunk = missing.find((one)=>one.id === item.chunkId);
				if(chunk){
					enriched.push({
						...chunk,
						vector: item.vector,
					});
				}
			});
		}
		return enriched;
	}

	// issue #13：解析「嵌入(向量)模型」目标——三态向后兼容，避免老用户回归。
	// [D-R5] 逻辑平移进 aiAnalysisRag.resolveEmbeddingTargetFromPrefs(报告侧同源复用),此处仅代理。
	function resolveEmbeddingTarget(chatProfile, bundleEmbeddingModel){
		return resolveEmbeddingTargetFromPrefs({ embeddingSelection, providerProfiles, chatProfile, bundleEmbeddingModel });
	}

	async function retrieveMaterialContext(query, resolvedRefs, embeddingTarget, retrievalMode){
		// 分拣走 partitionMaterialsByRetrieval 单源:直挂/检索的档位判定只此一处,
		// 与逐项 shouldUseDirectAttach 判定逐字节等价,避免多处各判各的漂移。
		const { direct: directMaterials, rag: ragMaterials } = partitionMaterialsByRetrieval(resolvedRefs.materials || [], retrievalMode);
		if(!ragMaterials.length){
			return {
				directMaterials,
				retrievedChunks: [],
				retrievedText: '',
			};
		}
		let chunks = [];
		for(let i=0; i<ragMaterials.length; i++){
			const material = ragMaterials[i];
			try{
				const materialChunks = await ensureMaterialChunks(material);
				chunks = chunks.concat(materialChunks.map((chunk)=>({
					...chunk,
					materialName: material.name || material.fileName,   // [Q-415/M-166] 标签单源取 name(改名后与直挂层标题 / search_materials 同名);fileName 只作原始文件名
				})));
			}catch(err){
				console.warn('material chunking failed', material && material.name, err);
				message.warning(`资料「${(material && material.name) || ''}」分块失败，本次检索已跳过`);
			}
		}
		let ranked = rankChunksByKeyword(query, chunks).slice(0, 12);
		// issue #13：嵌入用「独立选择的嵌入 provider」，与聊天 provider 解耦（embeddingTarget = {profile, model}）。
		const eProfile = embeddingTarget && embeddingTarget.profile ? embeddingTarget.profile : null;
		const embeddingModel = embeddingTarget && embeddingTarget.model ? embeddingTarget.model : '';
		if(eProfile && embeddingModel && ranked.length){
			try{
				const queryEmbeddingRsp = await requestEmbeddingVectors({
					providerType: eProfile.providerType,
					apiKey: eProfile.apiKey,
					baseUrl: eProfile.baseUrl,
					model: embeddingModel,
					embeddingModel,
					providerOptions: eProfile.providerOptions || {},
					input: [query],
				});
				const queryVector = queryEmbeddingRsp && queryEmbeddingRsp.Result && Array.isArray(queryEmbeddingRsp.Result.vectors)
					? queryEmbeddingRsp.Result.vectors[0]
					: [];
				if(Array.isArray(queryVector) && queryVector.length){
					const enriched = await ensureChunkEmbeddings(eProfile, embeddingModel, ranked);
					ranked = rerankChunksWithVector(queryVector, enriched).slice(0, 6);
				}
			}catch(e){
				console.warn('embedding rerank skipped', e);
				message.warning('向量检索失败，本次仅用关键词排序');
			}
		}
		const retrievedChunks = mergeRetrievedChunks(ranked, 5200);
		return {
			directMaterials,
			retrievedChunks,
			retrievedText: buildRetrievedContextText(retrievedChunks),
		};
	}

	// [Q-060/AW-12] 写回前先重读最新记录。此前 `conversation` 是**发送那一刻**的快照,一路传进 streamReply,
	// 回复结束整条覆盖回去 —— 生成期间用户在历史页做的收藏 / 归档 / 重命名全被写回旧值。
	// 现在底用库里的最新版,只有本次 patch 的键被改写;记录已被删掉则按传入快照建回(与旧行为同)。
	async function updateConversationMeta(conversation, patch = {}){
		const base = conversation || {};
		let latest = null;
		if(base.id){
			try{ latest = await getStoreRecord(AI_ANALYSIS_STORES.conversations, base.id); }catch(e){ latest = null; }
		}
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
			...base,
			...(latest || {}),
			...(patch || {}),
			updatedAt: new Date().toISOString(),
		}, 'conv');
		setConversations((prev)=>sortByUpdatedDesc(prev.map((item)=>item.id === saved.id ? saved : item)));
		return saved;
	}

	// AI 自动起名：用一个独立的非流式微调用，让 AI 根据「用户首问 + AI 首回」总结一个 6-14 字标题。
	// 成功：覆盖 title + 置 titleAutoNamed=true；失败：退到「截首回前 16 字」兜底，仍置 titleAutoNamed=true（防再触发）。
	// 不阻塞主对话流程；组件卸载时 isMountedRef 守门防 setState 警告；重命名/再次手动改名后 titleManuallyEdited=true 永不再触发。
	async function generateAndApplyAutoTitle({ conversation, profile, model, userPrompt, aiReply }){
		const fallbackTitle = ()=>{
			const cleaned = `${aiReply || ''}`
				.replace(/^\s*[#>*\-\d\.\s]+/, '')
				.replace(/\s+/g, ' ')
				.trim();
			if(!cleaned){ return null; }
			return cleaned.length > 16 ? cleaned.slice(0, 16) + '…' : cleaned;
		};
		let titleFromAI = null;
		try{
			if(!profile || !model){ throw new Error('no_provider'); }
			const sys = '你是对话标题生成器。根据用户问题和 AI 第一次回复，给出一个 6-14 个汉字的简短中文对话标题，能让用户在历史列表里一眼看出主题。仅返回标题文本本身，不要加引号、标点结尾、序号、表情、或任何前后缀。';
			const usrText = `用户问题：${(userPrompt || '').slice(0, 600)}\n\nAI 回复（前 400 字）：${(aiReply || '').slice(0, 400)}\n\n请生成标题：`;
			const opts = applyThinkingLevel({ ...(profile.providerOptions || {}) }, 'off', profile.providerType, model);
			const rsp = await requestAIAnalysisChat({
				providerType: profile.providerType,
				apiKey: profile.apiKey,
				baseUrl: profile.baseUrl,
				model,
				providerOptions: { ...(opts || {}), requestTimeoutMs: 15000 },
				messages: [
					{ role: 'system', content: sys },
					{ role: 'user', content: usrText },
				],
			});
			const raw = rsp && rsp.Result && rsp.Result.content ? `${rsp.Result.content}` : '';
			// 清洗：去引号/换行/「标题：」/Markdown 修饰/末尾标点
			let t = raw.trim();
			t = t.replace(/^["'"「『《【\s]+|["'"」』》】\s]+$/g, '');
			t = t.replace(/^标题[:：\s]*/, '');
			t = t.replace(/^[#>*\-\d\.\s]+/, '');
			t = t.replace(/[\s\n\r]+/g, ' ').trim();
			t = t.replace(/[。.!！?？,，;；:：]+$/, '');
			if(t.length >= 4 && t.length <= 30){
				titleFromAI = t;
			}
		}catch(_){
			// 静默失败：fallback 兜底
		}
		const finalTitle = titleFromAI || fallbackTitle();
		if(!finalTitle){ return; }
		if(!isMountedRef.current){ return; }
		try{
			await updateConversationMeta(conversation, {
				title: finalTitle,
				titleAutoNamed: true,
				titleSource: titleFromAI ? 'ai' : 'fallback',
			});
		}catch(e){
			console.warn('autoTitle apply failed', e);
		}
	}

	async function streamReply({
		conversation,
		profile,
		model,
		chatMessages,
		appendAssistant = true,
		existingAssistantId = '',
		controller,   // [Q-035/M-46] 发送入口在准备阶段就建好的控制器(缺省=本函数自建,老调用点零变化)
	}) {
		const assistantMessage = await saveConversationMessage({
			id: existingAssistantId || null,
			conversationId: conversation.id,
			role: 'assistant',
			content: '',
			streamStatus: 'streaming',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		streamBufferRef.current = '';
		streamReasoningBufferRef.current = '';
		streamUsageRef.current = null;
		if(appendAssistant){
			setMessages((prev)=>{
				const exists = prev.some((item)=>item.id === assistantMessage.id);
				return exists ? prev.map((item)=>item.id === assistantMessage.id ? assistantMessage : item) : prev.concat(assistantMessage);
			});
		}else{
			setMessages((prev)=>prev.map((item)=>item.id === assistantMessage.id ? assistantMessage : item));
		}
		// [Q-035/M-46] 复用发送入口的控制器:准备阶段按下的「停止」要能传导到本次流(缺省自建=零回归)。
		const abortController = (controller && !controller.signal.aborted) ? controller : new AbortController();
		abortRef.current = abortController;
		let streamError = null;
		// [流式渲染合帧·A] 高吞吐上游每秒可推数百个 delta,逐 delta 提交状态会把主线程打满(真模型长回复实测:
		// 163s 内事件环两次停顿 85.9s/44.6s,停止钮/输入框全部失灵)。合并到 80ms 一帧落状态;末帧由 flush() 同步兜底,
		// 出错/中止/finally 里 cancel() 防止定稿后残留计时器把 'streaming' 态写回已定稿消息。
		const streamFlusher = createStreamFlusher(()=>{
			const content = streamBufferRef.current;
			const reasoning = streamReasoningBufferRef.current;
			setMessages((prev)=>prev.map((item)=>item.id === assistantMessage.id ? {
				...item,
				content,
				...(reasoning ? { reasoning } : {}),
				streamStatus: 'streaming',
				updatedAt: new Date().toISOString(),
			} : item));
		});
		// [P0-2] 真消息窗口:缺省 legacy → 原数组同引用(现状);window → 按模型窗口预算裁剪历史(末条 user 恒保留、对齐问答对)。
		// 四个发送口皆经本函数,窗口只在此处做一次;各轮请求一律消费 baseMessages。
		// [Q-287/PP-12] 总开关关=NULL_AGENT 只发正文:窗口不计工具轮回放量(此前按不会发送的回放量把历史裁得只剩几条)
		const agentReplayOn = isAgentEnabledForSendGuard();
		const { messages: baseMessages, meta: historyMeta } = windowChatMessages(chatMessages, {
			model,
			numCtx: profile && profile.providerType === 'ollama' ? Number((profile.providerOptions || {}).num_ctx) || undefined : undefined,
			policy: readContextPolicy(),
			replayTrace: agentReplayOn,
		});
		// [Q-398/M-103] 按任务用模型可能把某一轮路由到**窗口更小**的模型(工具轮常配小模型),
		//   而历史窗口只按主选模型算过一次 → 小模型那一轮收到超窗历史(上游 400 或悄悄截前文)。
		//   这里按轮模型重算一次并取「更紧的那一份」(路由模型窗口更大时不放宽,保持主选口径);同模型=同引用零开销。
		const roundWindowCache = new Map();
		const baseMessagesForRound = (rp)=>{
			if(!rp || !rp.model || rp.model === model){ return baseMessages; }
			const key = `${rp.model}`;
			if(roundWindowCache.has(key)){ return roundWindowCache.get(key); }
			let out = baseMessages;
			try{
				const w = windowChatMessages(chatMessages, {
					model: rp.model,
					numCtx: rp.profile && rp.profile.providerType === 'ollama' ? Number((rp.profile.providerOptions || {}).num_ctx) || undefined : undefined,
					policy: readContextPolicy(),
					replayTrace: agentReplayOn,
				});
				if(w && Array.isArray(w.messages) && w.messages.length < baseMessages.length){ out = w.messages; }
			}catch(e){ out = baseMessages; }
			roundWindowCache.set(key, out);
			return out;
		};
		// AI 助手·一个气泡=一个 Turn:总开关关 → NULL_AGENT(下面的 do/while 恰跑一轮,请求体无 tools,消息与旧 map 逐字段等价)
		const toolPick = chatModels.pickTool({ profile, model });
		const agent = createAgentTurn({
			profile: toolPick.profile, model: toolPick.model, signal: abortController.signal,
			lastUserMessage: (()=>{ for(let i = chatMessages.length - 1; i >= 0; i--){ const m = chatMessages[i]; if(m && m.role === 'user'){ return `${m.content || ''}`; } } return ''; })(),
			ui: { refreshSources: ()=>setSources(listAnalysisSources()), selectSource: (cid)=>setSelectedSourceId(cid) },
			onTrace: (trace)=>setMessages((prev)=>prev.map((item)=>item.id === assistantMessage.id ? { ...item, agentTrace: trace } : item)),
			requestApproval: (call)=>requestAgentApproval(assistantMessage.id, call),
			requestElicitation: (q)=>requestAgentElicitation(assistantMessage.id, q),
			steer: ()=>chatAssist.takeSteer(assistantMessage.id),   // [批二⑤] 每轮开始取一次用户插话(取即清)
			techniqueOptionOverrides,   // [Q-285/M-96] 建目标任务的工具在创建时快照本会话的每技法覆盖
		});
		// issue #13：把聊天高级参数（思考档/温度/top_p）并入 providerOptions（reasoning 模型不发 temperature）。
		const chatProviderOptions = applyThinkingLevel({ ...(profile.providerOptions || {}) }, thinkingLevel, profile.providerType, model);
		// 2B/2G：停止序列 / 频率·存在惩罚 / JSON 模式——按接口家族下发（透传由后端 buildProviderBodyOptions 完成，无需改 jar）。
		// [Q-045] 五类浮层参数改走单源 applyChatParams(与多模型候选 / 按审阅重写 / 旁问同一份实现);
		// [Q-323] 温度在其中按家族夹逼;[Q-322] 推理型号不写 top_p(出口会剥,浮层同步置灰)。
		const protoFamily = profile.protocolFamily || getProviderProtocolFamily(profile.providerType);
		Object.assign(chatProviderOptions, applyChatParams(chatProviderOptions, {
			profile, model, protocolFamily: protoFamily,
			temperature: chatTemperature, topP: chatTopP, stopSequences,
			frequencyPenalty, presencePenalty, jsonMode,
		}));
		// [C3] 聊天路径推理模型输出预算兜底:档案未显式配上限(anthropic max_tokens/ollama num_predict)
		// 时,后端默认 2048/1024 会被思考 token 吃光 → 正文空(报告侧同病根,见 effectiveMaxTokensForModel)。
		// 只在「未配」时按报告侧同一放大逻辑兜底;用户配过任何值 = 尊重原值,零覆盖。
		{
			const hasExplicitCap = chatProviderOptions.max_tokens != null
				|| chatProviderOptions.num_predict != null
				|| chatProviderOptions.maxOutputTokens != null;
			if(!hasExplicitCap && isReasoningModel(model)){
				const boosted = effectiveMaxTokensForModel(model, 4096);
				// 🔴 键名单一真值源:本兜底恰恰只对推理模型注入,而 gpt-5/6/7 正是不收
				// max_tokens 的那一代 —— 用错键=每次请求先吃一个 400。
				chatProviderOptions[maxTokensKeyForModel(protoFamily, model)] = boosted;
			}
		}
		try{
			do{
			agent.beginRound();
			if(agent.enabled){ streamBufferRef.current = ''; streamReasoningBufferRef.current = ''; streamError = null; }
			const roundPick = chatModels.pickRound({ agent, profile, model, providerOptions: chatProviderOptions, thinkingLevel });
			try{
			await requestAIAnalysisChatStream({
				providerType: roundPick.profile.providerType,
				apiKey: roundPick.profile.apiKey,
				baseUrl: roundPick.profile.baseUrl,
				model: roundPick.model,
				providerOptions: roundPick.providerOptions,
				messages: agent.messagesForRound(baseMessagesForRound(roundPick)),   // [Q-398/M-103] 按轮模型收紧历史窗口
				tools: agent.toolDefs(),
				toolChoice: agent.toolChoice(),
			}, {
				signal: abortController.signal,
				onEvent: (event)=>{
					agent.onEvent(event);
					if(event.type === 'delta'){
						if(abortController.signal.aborted){
							return;
						}
						const delta = event.json && event.json.delta ? `${event.json.delta}` : '';
						if(!delta){
							return;
						}
						streamBufferRef.current += delta;
						streamFlusher.schedule();
					}else if(event.type === 'reasoning'){
						// #16:DeepSeek reasoner 等的思维链增量。单独累计并渲染「思考过程」,让长思考期可见、不再像「卡死/空」。
						if(abortController.signal.aborted){
							return;
						}
						const r = event.json && event.json.reasoning ? `${event.json.reasoning}` : '';
						if(!r){
							return;
						}
						streamReasoningBufferRef.current += r;
						streamFlusher.schedule();
					}else if(event.type === 'usage'){
						// 2A：后端按家族解析后的统一 usage 事件 {input_tokens, output_tokens, total_tokens}。
						if(event.json && typeof event.json === 'object'){
							streamUsageRef.current = event.json;
						}
					}else if(event.type === 'error'){
						streamError = (event.json && event.json.message) ? `${event.json.message}` : (event.data || '上游服务返回错误');
					}
				},
			});
			}catch(streamEx){
				// 仅「原生模式 + 上游明确不支持 tools」被吸收并同轮降级重发;其它错误照旧上抛
				if(!agent.absorbStreamError(streamEx)){ throw streamEx; }
			}
			chatModels.afterRound({ agent, profile, model });
			}while(await agent.settleRound());
			streamFlusher.flush();
			// [Q-048① 裁决 2026-09-18·维持现状+补提示] 未被本轮消费的插话随 Turn 结束丢弃(设计如此:插话只在下一轮工具调用前生效);此前静默 → 现明说并清队列
			try{
				const leftoverSteer = chatAssist.steerPending(assistantMessage.id);
				if(leftoverSteer && leftoverSteer.length){
					chatAssist.takeSteer(assistantMessage.id);
					message.info(`本轮已结束，${leftoverSteer.length} 条插话未被消费，已丢弃（插话只在下一轮工具调用前生效；可把它作为新问题再发）`, 6);
				}
			}catch(e){ /* 提示失败不影响收尾 */ }
			const finalContent = `${streamBufferRef.current || ''}`.trim();
			// 错误不再拼进 content（破坏 markdown），改为 errorInfo 字段；content 为空时给暗灰占位。
			const resolvedContent = finalContent || (streamError ? '' : '模型未返回可用内容');
			// [D67] 上游在正文之后发 error 帧(半截回答):此前只在正文为空时才记 errorInfo ⇒ 半截当完整、错误静默吞掉;
			//   现只要有 streamError 就记 errorInfo(气泡下方照常渲染错误卡、可重试),正文非空时状态仍 done(历史/上下文照常吃)但带 partial:true
			const errorInfo = streamError ? classifyStreamError(streamError) : null;
			const partialAfterError = !!(finalContent && streamError);
			// [Q-040 裁决 2026-09-18] 图片被模型拒绝(非视觉模型)→ 把本会话历史里的图片剥离并落库(imagesStripped),
			// 否则整段对话每轮都带同一批图、持续失败;气泡里保留「已剥离」标记,换视觉模型可重新发图。
			if(streamError && isImageRejectionError(streamError)){
				const withImages = (chatMessages || []).filter((m)=>m && Array.isArray(m.images) && m.images.length);
				if(withImages.length){
					const ids = new Set(messages.filter((m)=>m && Array.isArray(m.images) && m.images.length && m.conversationId === conversation.id).map((m)=>m.id));
					for(const mid of ids){
						// eslint-disable-next-line no-await-in-loop
						try{ await updateStoreRecordIf(AI_ANALYSIS_STORES.messages, mid, ()=>true, (rec)=>({ ...rec, images: undefined, imagesStripped: true, imagesStrippedReason: `${streamError}`.slice(0, 200) })); }catch(e){ /* 落库失败只影响下次载入 */ }
					}
					setMessages((prev)=>prev.map((m)=>(ids.has(m.id) ? { ...m, images: undefined, imagesStripped: true } : m)));
					message.info('模型拒绝了图片输入，已把图片从这段对话的历史中剥离；换用视觉模型后可重新发送图片');
				}
			}
			// [P0-1/P0-2] usage 随带稳定层指纹(prompt)与历史窗口账(history):气泡 tooltip/账本按轮核对缓存命中与窗口裁剪
			const usage = streamUsageRef.current ? { ...agent.mergeUsage(streamUsageRef.current), model, providerType: profile.providerType, prompt: lastPromptMetaRef.current || undefined, history: historyMeta } : undefined;
			const saved = await saveConversationMessage({
				...assistantMessage,
				content: resolvedContent,
				reasoning: `${streamReasoningBufferRef.current || ''}`.trim() || undefined,
				streamStatus: (!finalContent && streamError) ? 'error' : ((agent.trace() && agent.trace().stopReason === 'aborted') ? 'aborted' : 'done'),
				errorInfo,
				partial: partialAfterError || undefined,
				usage,
				agentTrace: agent.trace() || undefined,
				updatedAt: new Date().toISOString(),
			});
			setMessages((prev)=>prev.map((item)=>item.id === saved.id ? saved : item));
			// [进阶审计 D10·2026-09-07] 「一轮对话结束」自动规则事件此前从未有人发出(规则弹窗里能选、引擎能听、就是没人发):助手消息落库即发
			try{ emitAutomationEvent('turn.end', { conversationId: conversation.id, messageId: saved.id, status: saved.streamStatus, hadToolCalls: !!(agent.trace() && (agent.trace().rounds || []).some((r)=>(r.results || []).length)), origin: 'in-app' }); }catch(e){ /* noop */ }
			// 首回 AI 完整后自动命名：仅落基础 meta；真正的 AI 起名通过 generateAndApplyAutoTitle 异步另发一轮微调用，
			// 完成后再更新 title。失败时再退化到「截首回 N 字」兜底（避免一直叫「未命名对话」）。
			const convNow = await updateConversationMeta(conversation, { lastMessageAt: saved.updatedAt });
			// [Q-060/AW-12] 起名判定按**库里最新**的会话记录,不按发送时的快照:生成期间用户手动改过标题
			// (titleManuallyEdited=true)时,快照里没有这个标记 → AI 起名会把手改标题盖掉。
			const convForTitle = convNow || conversation;
			if(!convForTitle.titleAutoNamed && !convForTitle.titleManuallyEdited && finalContent && finalContent.length > 4){
				// 取用户问题（messages 数组里最后一条 user 的 content）作为命名依据。
				const lastUserPrompt = (()=>{
					for(let i = chatMessages.length - 1; i >= 0; i--){
						const m = chatMessages[i];
						if(m && m.role === 'user' && m.content){ return `${m.content}`; }
					}
					return '';
				})();
				// 非阻塞触发，不 await——streamReply 不被卡住。
				generateAndApplyAutoTitle({ conversation: convForTitle, profile, model, userPrompt: lastUserPrompt, aiReply: finalContent });
			}
			return saved;
		}catch(e){
			streamFlusher.cancel();
			const aborted = e && e.name === 'AbortError';
			const failMessage = streamError || (e && e.message ? `${e.message}` : '') || '生成失败。';
			// 工具执行后上游停流/500 抛错:当前轮归档并记 stopReason='error'(运行时缺 failRound 时守卫跳过,不炸)
			if(!aborted && agent && typeof agent.failRound === 'function'){ agent.failRound(failMessage); }
			const errorInfo = aborted ? null : classifyStreamError(failMessage);
			const saved = await saveConversationMessage({
				...assistantMessage,
				content: streamBufferRef.current || (aborted ? '已停止生成。' : ''),
				reasoning: `${streamReasoningBufferRef.current || ''}`.trim() || undefined,
				streamStatus: aborted ? 'aborted' : 'error',
				errorInfo,
				agentTrace: agent.trace() || undefined,
				updatedAt: new Date().toISOString(),
			});
			setMessages((prev)=>prev.map((item)=>item.id === saved.id ? saved : item));
			if(!aborted){
				throw e;
			}
			return saved;
		}finally{
			streamFlusher.cancel();
			abortRef.current = null;
		}
	}

	// [Q-324] 本函数**会写页面态**(挂载快照 / 技法上下文 / 裁剪账 / 稳定层指纹),所以只许主发送路径调用。
	// 旁问 / 多模型对比 / 回答审阅是「借同一份 system 吃前缀缓存」的旁路,和主发送并发时会把横幅的
	// 裁剪账与 usage.prompt 指纹串台(看到的账不是本条回复的)。它们一律走下面的 buildResolvedPromptQuiet。
	async function buildResolvedPromptImpl(currentPrompt, profile, extraSystemContext, silent){
		const _policy = readContextPolicy();
		const resolvedRefs = resolveReferenceItems(referenceIds, materials, bundles, templates);
		const currentSource = activeSource || (activeConversation && activeConversation.sourceRef ? sources.find((item)=>item.id === activeConversation.sourceRef.id) : null);
		const ctx = currentSource && currentSource.record ? await getAnalysisSourceContext(currentSource, {
			mode: activeTechniqueKeys.length ? 'meta' : 'full',
		}) : sourceContext;
		// [A4] @技法段:选过段的技法只保留所选段(未选=原样引用返回,零变化)
		const resolvedTechniqueContexts = chatAssist.filterTechniqueSections(currentSource && activeTechniqueKeys.length
			? await getAnalysisTechniqueContexts(currentSource, activeTechniqueKeys, {
				sourceContext: ctx,
				// 发送给 LLM 的最终上下文也带上「每技法设置」覆盖（与预览卡一致）。
				techniqueOptions: effectiveTechniqueOptions,
			})
			: []);
		if(ctx && !silent){
			setSourceContext(ctx);
		}
		if(!silent){ setTechniqueContexts(resolvedTechniqueContexts); }
		// 「默认检索策略」属组合(bundle)的设置,故直接从本轮挂载的组合读,不另立会话态。
		// 挂了多个组合时取第一个显式非 auto 的(auto 等于不表态);都没挂/都 auto → undefined = 原长度规则。
		const bundleRetrievalMode = (resolvedRefs.bundles || [])
			.map((b)=>b && b.defaultRetrievalMode)
			.find((m)=>m === 'fulltext' || m === 'rag');
		// [Q-006] 组合的「默认 Embedding 模型」与「默认检索策略」同源取法:挂了多个组合取第一个填了的
		const bundleEmbeddingModel = (resolvedRefs.bundles || [])
			.map((b)=>`${(b && b.defaultEmbeddingModel) || ''}`.trim())
			.find(Boolean);
		const retrieval = await retrieveMaterialContext(currentPrompt, resolvedRefs, resolveEmbeddingTarget(profile, bundleEmbeddingModel), bundleRetrievalMode);
		// [Q-055① 裁决 2026-09-18] 模版变量({{user_prompt}} / {{source_context}} / {{retrieved_context}} / {{conversation_history}} / {{system_prompt}})
		// 此前从不渲染(帮助却称「预览即实发」)。发送层按约定取本轮真实值渲染;渲染失败 / 无占位符 → 原文;与预览同款关 HTML 转义。
		const renderedTemplates = renderTemplatesForSend(resolvedRefs.templates, {
			user_prompt: `${currentPrompt || ''}`,
			source_context: `${(ctx && ctx.content) || ''}`,
			retrieved_context: (()=>{ try{ return buildRetrievedContextText(retrieval.retrievedChunks || []); }catch(e){ return ''; } })(),
			conversation_history: chatAssist.mainline(visibleMessages).slice(-8).map((m)=>`[${m.role}] ${`${historyContentOf(m) || ''}`.slice(0, 600)}`).join('\n'),
			system_prompt: `${sessionSystemPrompt || ''}`,
		});
		const layers = buildContextLayers({
			sourceContext: ctx,
			techniqueContexts: resolvedTechniqueContexts,
			materials: retrieval.directMaterials.map((item)=>({
				...item,
				retrievedOnly: false,
			})),
			bundles: resolvedRefs.bundles,
			templates: renderedTemplates,   // [Q-055①] 已按本轮真实值渲染的模版副本
			retrievedChunks: retrieval.retrievedChunks,
			// [P0-2] window 模式:历史不再进 system 的「最近对话」层(空数组不产该层),只随消息数组发一份=去双发
			conversationMessages: _policy.historyMode === 'window' ? [] : chatAssist.mainline(visibleMessages),
			// [Q-061] 组合提示不再从 resolvedRefs 拼进来(它只走 bundle-system 独立层)
			// [Q-290/PP-17] 本轮附加上下文不再并进系统层(稳定前缀被单轮技能重写两次),改独立挥发层 turn-extra
			systemPrompt: sessionSystemPrompt,
			turnExtraContext: extraSystemContext,
			// [A5/A6] 压缩摘要 / 口径 / 记忆 等附加稳定层:无=空数组(零变化)
			extraLayers: chatAssist.promptLayerExtras(),
		});
		// [挂载预算] 单次裁剪消双算：同一份 layers 只过一遍 clipContextLayersDetailed（旧代码这里
		// clipContextLayers + buildPromptContext 同输入各算一遍）。fairShare 让多技法触界时
		// 公平分摊而非低序技法整层静默丢；账本 {byKey,dropped,stats} 落 state 供预览卡/banner 可见化。
		// [挂载预算] 按当前模型窗口给预算:大窗口模型解除 2 万字硬颈,Ollama 按 num_ctx
		// 实算(小窗口低于保底,防静默截断),未知模型回落 AI_CONTEXT_MAX_CHARS=零回归。
		const _selModel = parseModelSelection(modelSelection).model || '';
		const _numCtx = profile && profile.providerType === 'ollama'
			? Number((profile.providerOptions || {}).num_ctx) || undefined
			: undefined;
		// [#80] 策略里填了「挂载字数预算」就用它,没填按模型窗口实算 —— 单一入口,各调用点同源。
		const ctxCharBudget = mountCharBudgetFor(_selModel, { numCtx: _numCtx, floorChars: AI_CONTEXT_MAX_CHARS, policy: _policy });
		const clipDetail = clipContextLayersDetailed(layers, { maxChars: ctxCharBudget, fairShare: true });
		if(isMountedRef.current && !silent){
			setPromptClipStats({
				byKey: (clipDetail.stats && clipDetail.stats.byKey) || {},
				dropped: clipDetail.dropped || [],
				stats: clipDetail.stats || null,
			});
		}
		// 前缀缓存断点:挂载快照/资料/会话规则等【稳定层】在前,检索命中与近期对话【挥发层】
		// 在后,两者交界插 PROMPT_CACHE_BP。稳定层跨轮逐字节不变即命中 provider 前缀缓存——
		// 治「每轮追问都把整份命盘快照按原价重发」的成本大头;不支持的 provider 由后端剥标记 →
		// 与不分层时字节等价、零回归。
		// 裁剪输出按优先级降序时检索片段(80)排在资料全文(70)之前,并非天然「稳定在前挥发在后」:
		// 缓存家族按稳定/挥发拆分重排,非缓存家族此前直接按优先级拼 → 两类家族资料/检索次序不同;
		// 现两类家族统一「先稳定后挥发」,只差是否插断点。
		const _joinLayers = (arr)=>arr.map((item)=>`${item.title}\n${item.content}`).join('\n\n').trim();
		const _volatileKeys = VOLATILE_LAYER_KEYS;   // [Q-287/PP-07] 与裁剪引擎同一张挥发层表(单源)
		const _fam = getProviderProtocolFamily(profile && profile.providerType);
		const _stableL = clipDetail.kept.filter((item)=>!_volatileKeys[item.key]);
		const _volatileL = clipDetail.kept.filter((item)=>_volatileKeys[item.key]);
		let _sysJoined;
		const _cacheFam = _fam === 'anthropic' || _fam === 'openai-compatible';
		if(_cacheFam && _stableL.length && _volatileL.length){
			_sysJoined = [_joinLayers(_stableL), _joinLayers(_volatileL)].filter(Boolean).join(`\n\n${PROMPT_CACHE_BP}\n\n`);
		}else if(_cacheFam && _stableL.length && _policy.historyMode === 'window'){
			// [P0-2] window 模式挥发层常为空(历史已不进 system):稳定层非空即插断点,Java 侧「单段带标记」→ 单块打 cache_control
			_sysJoined = `${_joinLayers(_stableL)}\n\n${PROMPT_CACHE_BP}`;
		}else{
			// [Q-290/PP-18] 非缓存家族同样先稳定后挥发(无断点);单一家族分组时 kept 顺序不变
			_sysJoined = _joinLayers(_stableL.concat(_volatileL));
		}
		// [#80] 整层被丢弃时给模型留痕。此前被丢的层在提示词里**连标题带内容一起消失**，模型根本不知道
		//   有这么一份资料存在，只会按剩下的内容作答；丢弃只在本地 UI 留一个红 Tag。
		//   追加在缓存断点**之后**：被丢的集合逐轮会变，放进稳定前缀会打断上游前缀缓存。
		if(clipDetail.dropped && clipDetail.dropped.length){
			const _droppedNames = clipDetail.dropped
				.map((item)=>`${(item && (item.title || item.key)) || ''}`.replace(/^使用技法：/, ''))
				.filter(Boolean);
			if(_droppedNames.length){
				_sysJoined = `${_sysJoined}\n\n[挂载预算不足：以下 ${_droppedNames.length} 层整层未纳入 —— ${_droppedNames.join('、')}。未列出的内容不代表不存在，请勿臆补；如需完整资料，请提示用户在「进阶 → 对话上下文策略 → 挂载字数预算」里调大，或减少挂载技法。]`;
			}
		}
		// [P0-1] 稳定层指纹:跨轮逐字节不变才命中上游前缀缓存;挂载源/技法未变而指纹变了=某稳定层在漂(console 留痕排障)。
		{
			const _stableJoined = _joinLayers(_stableL);
			const _volatileJoined = _joinLayers(_volatileL);
			const _mountSig = `${(currentSource && currentSource.id) || selectedSourceId || ''}|${(activeTechniqueKeys || []).join(',')}`;
			const _promptMeta = {
				stableHash: hashPromptText(_stableJoined),
				stableChars: _stableJoined.length,
				volatileChars: _volatileJoined.length,
				layerKeys: clipDetail.kept.map((item)=>item.key),
				mountSig: _mountSig,
			};
			const _prev = lastPromptMetaRef.current;
			if(!silent && _prev && _prev.mountSig === _mountSig && _prev.stableHash !== _promptMeta.stableHash){
				console.warn('[ai-prompt] stable prefix changed', _prev.stableHash, _promptMeta.stableHash);
			}
			if(!silent){ lastPromptMetaRef.current = _promptMeta; }
		}
		// [Q-039 裁决 2026-09-18] JSON 输出模式:response_format 会被自愈层 / 不支持的网关剥掉,系统提示末尾同时明说「只输出 JSON」
		// (追加在缓存断点之后=挥发区,不动稳定前缀);四条发送入口同源。
		if(jsonMode){ _sysJoined = `${_sysJoined}\n\n${JSON_MODE_INSTRUCTION}`; }
		return {
			systemPrompt: _sysJoined,
			retrieval,
			clippedLayers: clipDetail.kept,
		};
	}
	// 主发送路径(含重试 / 重新生成 / 编辑并分支):照旧写页面态
	async function buildResolvedPrompt(currentPrompt, profile, extraSystemContext){
		return buildResolvedPromptImpl(currentPrompt, profile, extraSystemContext, false);
	}
	// [Q-324] 旁路专用:同一份 system(前缀逐字节同构、照吃缓存),但一个页面态都不写
	async function buildResolvedPromptQuiet(currentPrompt, profile, extraSystemContext){
		return buildResolvedPromptImpl(currentPrompt, profile, extraSystemContext, true);
	}

	// 2F：选择图片（多媒体输入）→ 读为 dataURL 暂存，随下一条消息发送。
	function handlePickImages(fileList){
		const files = Array.from(fileList || []).filter((f)=>f && /^image\//.test(f.type || ''));
		if(!files.length){
			return;
		}
		// 10MB / 张 上限：base64 编码膨胀 ~33%、conversation message 持久化进 IndexedDB 太大会卡。
		const MAX_BYTES = 10 * 1024 * 1024;
		const oversize = files.filter((f)=>f.size > MAX_BYTES);
		if(oversize.length){
			message.warning(`${oversize.length} 张图片超过 10MB，已跳过`);
		}
		const accepted = files.filter((f)=>f.size <= MAX_BYTES);
		accepted.forEach((file)=>{
			const reader = new FileReader();
			reader.onload = ()=>{
				if(!isMountedRef.current) return;
				const url = `${reader.result || ''}`;
				if(url){
					setPendingImages((prev)=>prev.concat({ url, name: file.name || 'image' }));
				}
			};
			reader.onerror = ()=>{ if(isMountedRef.current){ message.error(`图片读取失败：${file.name || '未知'}`); } };
			reader.onabort = ()=>{ /* 静默 */ };
			try{ reader.readAsDataURL(file); }catch(e){ if(isMountedRef.current){ message.error(`图片读取失败：${(e && e.message) || ''}`); } }
		});
	}

	// v1.21: 点击落地页建议问题 chip。软件类→注入帮助文档后自动发送；命/事类未挂载→弹框引导挂载；其余→正常发送。
	function handleExampleClick(txt){
		const { category, helpKey } = classifyQuestion(txt);
		if(category === 'software'){
			handleSend(txt, buildSoftwareHelpContext(helpKey));
			return;
		}
		if(category === 'case-required' && !activeSource && !isAgentEnabledForSendGuard()){
			setPrompt(txt);
			AntdModal.info({
				title: '需要先挂载案例',
				// [Q-001] 案例选择器在**顶栏**(右组),本页从来没有左栏 —— 旧文案指向一个不存在的位置
				content: '分析某个具体的命主 / 事件，需要先挂载对应案例：① 在顶栏「选择案例」里选已保存的命盘；② 或到 八字 / 紫微 等 tab 起盘后点「保存为命盘」，再回到这里在顶栏选它。挂载后 AI 才能拿到精确的盘面数据来分析。',
				okText: '我知道了',
			});
			return;
		}
		handleSend(txt);
	}

	async function handleSend(overrideText, extraSystemContext){
		// 重入闸走 ref 同步判定:state 版 `sending` 在 React commit 前仍是旧值,连点/回车+点击可双双过闸,
		// 两条流共用 streamBufferRef 互相踩缓冲(压测按构造判定)。
		if(sending || sendingRef.current){
			return;
		}
		sendingRef.current = true;
		// [D53] 闸后整段 try/finally:此前「空问题 / 需先挂载 / 未选模型 / 缺密钥」四条早退不复位门闩 ⇒ 之后每次发送都在入口被吞(按钮看着可用却永不发,首次无密钥必踩;同病)
		try{
			// overrideText 只认字符串：onClick 直挂 handleSend 这类写法会把点击事件对象塞进来，
			// 模板串化后用户消息就成了 "[object Object]"（Windows #24/#25 实锅）——非字符串一律回落输入框内容。
			const overrideStr = typeof overrideText === 'string' ? overrideText : null;
			const trimmed = `${(overrideStr != null ? overrideStr : prompt) || ''}`.trim();
			// [A3] 斜杠命令:输入框内容是命令(首字符 / 且次字符非 /)→ 交给命令面板执行,不发送;非命令零路径
			if(overrideStr == null && chatAssist.interceptSend(trimmed)){ return; }
			const sendImages = pendingImages.map((p)=>p.url).filter(Boolean);
			if(!trimmed && !sendImages.length){
				message.warning('请输入要分析的问题');
				return;
			}
			// v1.21: 手动输入「具体命/事」问题但未挂载案例 → 提醒去挂载,不盲发(AI 无盘面数据只会臆测)。
			// 软件类(带 extraSystemContext)与已挂载案例不受影响; chip 的命/事未挂载分支已在 handleExampleClick 拦截。
			if(needsMountBeforeSend({ text: trimmed, activeSource, extraSystemContext, agentEnabled: isAgentEnabledForSendGuard() })){
				AntdModal.info({
					title: '需要先挂载案例',
					content: '你问的是某个具体命主 / 事件，但当前没有挂载案例。请在顶栏「选择案例」里选已保存的命盘，或到 八字 / 紫微 等 tab 起盘后点「保存为命盘」再回来选择。挂载后 AI 才能拿到精确盘面数据来分析。',   // [Q-001] 顶栏,非左栏
					okText: '我知道了',
				});
				return;
			}
			const { profileId, model } = parseModelSelection(modelSelection);
			const profile = providerProfiles.find((item)=>item.id === profileId);
			if(!profile || !model){
				message.warning('请先选择可用模型');
				return;
			}
			if(!profile.apiKey && profile.providerType !== 'ollama'){
				message.warning('当前配置缺少 API Key，请先到设置中补全');
				return;
			}
			// [Q-048⑥ 裁决 2026-09-18·维持现状+补提示] 多模型对比 / 编排各用自己的 busy 态,不占主发送门闩(设计如此);并行两条流时明说
			if((chatAssist.bestOf && chatAssist.bestOf.busy) || (chatAssist.orchestrate && chatAssist.orchestrate.busy)){
				message.warning('多模型对比 / 编排仍在生成，本次发送会与它并行进行（互不占用发送门闩）', 5);
			}
			setSending(true);
			const sendAbort = beginSendAbort();   // [Q-035/M-46] 准备阶段即可停止
			try{
				const conversation = await ensureConversationRecord(trimmed, profile, model);
				if(prepAborted(sendAbort)){ return; }
				const promptResult = await buildResolvedPrompt(trimmed, profile, extraSystemContext);
				if(prepAborted(sendAbort)){ return; }
				const userMessage = await saveConversationMessage({
					conversationId: conversation.id,
					role: 'user',
					content: trimmed,
					images: sendImages.length ? sendImages : undefined,
					streamStatus: 'done',
					checkpoint: chatAssist.buildCheckpoint(),   // [A5] 回退用检查点(挂载/引用/技法/系统提示/模型…)
					// [Q-029/M-40] 附加上下文(软件帮助 / 技能口径 / 【合盘数据】/ 已批准计划约束)随消息落库,重答时还原,否则重答基于缺失数据
					extraSystemContext: extraSystemContext ? `${extraSystemContext}` : undefined,
				});
				setMessages((prev)=>prev.concat(userMessage));
				setPrompt('');
				setPendingImages([]);
				if(prepAborted(sendAbort)){ return; }
				await streamReply({
					conversation,
					profile,
					model,
					controller: sendAbort,
					chatMessages: [
						{
							role: 'system',
							content: promptResult.systemPrompt,
						},
					].concat(chatAssist.mainline(visibleMessages).concat(userMessage).map((item)=>({
						role: item.role,
						content: historyContentOf(item),   // [C5] 历史只带采用稿
						images: Array.isArray(item.images) && item.images.length ? item.images : undefined,
						agentTrace: item.agentTrace,
					}))),
				});
			}catch(e){
				console.error(e);
				message.error('发送分析请求失败');
			}
		}finally{
			sendingRef.current = false;
			setSending(false);
		}
	}

	function handleStopStreaming(){
		if(abortRef.current){
			abortRef.current.abort();
		}
	}

	// [Q-035/M-46] 发送 / 重答 / 重试 / 分支四个入口一按下就建控制器并挂上 abortRef:
	//   此前控制器只在 streamReply 里建,而「重算挂载快照 → 拼提示词 → 落库」这段准备期可长达数秒,
	//   期间停止钮已显示(sending=true)却点不动(abortRef 还是上一轮或 null),等准备完照样发一次请求烧 token。
	function beginSendAbort(){
		const c = new AbortController();
		abortRef.current = c;
		return c;
	}
	// 准备阶段各 await 之后调用:已被停止 → 收尾并早退(true = 调用方 return)
	function prepAborted(c){
		if(!c || !c.signal.aborted){ return false; }
		try{ message.info('已停止'); }catch(e){ /* noop */ }
		if(abortRef.current === c){ abortRef.current = null; }
		return true;
	}

	async function resetConversationDraft(options){
		await startNewConversation(options || {});
	}

	// [Q-011] silent 同义:批量删除逐条调用时只由调用方弹一条汇总
	async function handleDeleteConversation(conversationId, options){
		if(activeConversationId === conversationId && abortRef.current){
			abortRef.current.abort();
		}
		await deleteStoreRecord(AI_ANALYSIS_STORES.conversations, conversationId);
		await deleteWhere(AI_ANALYSIS_STORES.messages, (item)=>item.conversationId === conversationId, { index: 'conversationId', value: conversationId });
		setConversations((prev)=>prev.filter((item)=>item.id !== conversationId));
		setSelectedHistoryIds((prev)=>prev.filter((id)=>id !== conversationId));
		if(activeConversationId === conversationId){
			// [Q-062/AW-30] 在历史页删掉「当前打开的那条」会话时不要把用户拽回分析页(批量删除更糟:循环中途就切页)
			await resetConversationDraft({ switchTab: false });
		}
		if(!(options && options.silent)){ message.success('对话已删除'); }
	}

	async function handleDuplicateConversation(conversation){
		const copied = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
			...conversation,
			id: null,
			title: `${conversation.title || '未命名对话'}（副本）`,
			parentConversationId: conversation.id,
			branchRootId: conversation.branchRootId || conversation.id,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}, 'conv');
		const oldMessages = await listConversationMessages(conversation.id);
		await replaceConversationMessages(copied.id, oldMessages.map((item)=>({
			...item,
			id: null,
			conversationId: copied.id,
			branchConversationId: copied.id,
		})));
		setConversations((prev)=>sortByUpdatedDesc([copied].concat(prev)));
		message.success('对话已复制');
	}

	async function handleRenameConversation(conversation){
		const nextTitle = await asyncInput({ title: '重命名对话', defaultValue: conversation.title || '', placeholder: '输入新的对话标题', maxLength: 60 });
		if(nextTitle === null){
			return;
		}
		const title = `${nextTitle || ''}`.trim();
		if(!title){
			message.warning('标题不能为空');
			return;
		}
		await updateConversationMeta(conversation, { title, titleManuallyEdited: true });
		message.success('标题已更新');
	}

	async function handleToggleConversationFlag(conversation, key){
		await updateConversationMeta(conversation, {
			[key]: !conversation[key],
		});
	}

	async function handleArchiveSelected(value){
		await Promise.all(selectedHistoryIds.map(async (id)=>{
			const conversation = conversations.find((item)=>item.id === id);
			if(conversation){
				await updateConversationMeta(conversation, { archived: value });
			}
		}));
		message.success(value ? '已归档所选对话' : '已取消归档');
	}

	async function handleFavoriteSelected(value){
		await Promise.all(selectedHistoryIds.map(async (id)=>{
			const conversation = conversations.find((item)=>item.id === id);
			if(conversation){
				await updateConversationMeta(conversation, { favorite: value });
			}
		}));
		message.success(value ? '已收藏所选对话' : '已取消收藏');
	}

	async function handleBatchDeleteConversations(){
		const total = selectedHistoryIds.length;
		for(let i=0; i<total; i++){
			await handleDeleteConversation(selectedHistoryIds[i], { silent: true });   // [Q-011] 只弹一条汇总
		}
		setSelectedHistoryIds([]);
		if(total){ message.success(`已删除 ${total} 个对话`); }
	}

	// [Q-060/AW-29] withScreenshot=false:从**历史页**导出时不附页面截图 —— 截图抓的是「当前可见页」,
	// 在历史页就是那张会话列表(可能把别人的会话标题与案例名一并印进文档),与导出的这一条会话无关。
	// 分析页导出(可见的就是这条会话的消息区)照旧附图。
	async function exportConversation(conversation, format, options){
		const withScreenshot = !(options && options.withScreenshot === false);
		const msgList = await listConversationMessages(conversation.id);
		// docx 形态按「AI导出设置·附页面截图」抓当前页(AI分析页)截图入文档头;失败恒 null 不阻断。
		let pageShotOpts;
		if(format === 'docx' && withScreenshot){
			try{
				const { isAIExportScreenshotEnabled } = await import('../../utils/aiExport');
				if(isAIExportScreenshotEnabled()){
					const { capturePageScreenshotForExport } = await import('../../utils/pageScreenshot');
					const { shot } = await capturePageScreenshotForExport();
					if(shot){ pageShotOpts = { pageScreenshot: shot }; }
				}
			}catch(_){ /* 截图失败绝不阻断导出 */ }
		}
		const exported = await exportConversationByFormat(conversation, msgList, format, pageShotOpts);
		// [Q-410] 单源保存:桌面壳保存桥(取消不回落浏览器、不报成功);失败如实提示。
		notifySaveResult(await saveBlobToBrowser(exported.fileName, exported.blob), '已导出对话');
	}

	async function exportSelectedConversations(){
		const list = conversations.filter((item)=>selectedHistoryIds.includes(item.id));
		if(!list.length){
			message.warning('请先选择要导出的对话');
			return;
		}
		const blob = await exportConversationBundle(list, async (conversation)=>listConversationMessages(conversation.id));
		notifySaveResult(await saveBlobToBrowser('ai-analysis-conversations.zip', blob), `已导出 ${list.length} 个对话`);   // [Q-410]
	}

	// [P1-S1] 清理挂载上下文派生缓存:排障(疑似挂载内容陈旧)与腾空间的手动出口;存档与对话不受影响。
	async function handleClearContextCache(){
		try{
			const before = await countStoreRecords(AI_ANALYSIS_STORES.contextCache);
			await clearStore(AI_ANALYSIS_STORES.contextCache);
			message.success(`已清理 ${before} 条上下文缓存,下次挂载按当前存档重建`);
		}catch(e){
			message.error(`清理失败:${e && e.message ? e.message : e}`);
		}
	}

	async function handleExportWorkspaceBackup(){
		// [Q-412/M-160] 整段读库 + 序列化包进 try:此前只包桌面保存桥,读库失败 / 大库 JSON.stringify 超限 = 未处理 rejection 且无提示。
		try{
			await exportWorkspaceBackupInner();
		}catch(e){
			console.warn('[ai backup] export failed', e);
			message.error(`导出备份失败:${(e && e.message) || e}`);
		}
	}
	async function exportWorkspaceBackupInner(){
		const workspace = {
			snapshotVersion: AI_ANALYSIS_SCHEMA_VERSION,
			exportedAt: new Date().toISOString(),
			stores: {},
		};
		// [P1-S1] 派生缓存(context_cache)不入包:体积大,且恢复后按 sourceUpdatedAt 立刻失效、按需重建。
		const storeKeys = Object.values(AI_ANALYSIS_STORES).filter((name)=>AI_BACKUP_EXCLUDED_STORES.indexOf(name) < 0);
		for(let i=0; i<storeKeys.length; i++){
			workspace.stores[storeKeys[i]] = await listStoreRecords(storeKeys[i]);
		}
		// 🔴 [V4 敏感剥离] listStoreRecords(providerProfiles) 读端自动解密——原样入包=备份文件
		// 泄明文 API 密钥(放网盘/转发即外泄)。导出一律剥密置空;恢复端读到空 key 走既有
		// 「提示重填」语义,零额外处理。
		// [Q-052/M-63] 剥密走单源 aiSecretStores(穷举带密钥的店:接口档案 + 联网检索等集成档案),此前只剥 provider_profiles,
		// integration_profiles 的第三方 Key 以明文进 zip。
		Object.keys(workspace.stores).forEach((name)=>{
			if(isSecretStore(name) && Array.isArray(workspace.stores[name])){
				workspace.stores[name] = workspace.stores[name].map((rec)=>redactSecretRecord(rec));
			}
		});
		const blob = await exportWorkspaceBackupBlob(workspace);
		// [Q-410] 此前桌面桥失败(含用户取消)回落浏览器下载再报「备份已导出」= 取消也报成功;现单源保存如实报。
		notifySaveResult(await saveBlobToBrowser('horosa-ai-analysis-backup.zip', blob), '备份已导出');
	}

	// [D61] 库健康态:IndexedDB 打不开(VersionError = 同名库被更新版本升过)落内存回退时顶部横幅告知
	const [storeHealth, setStoreHealth] = React.useState(()=>getAiStoreHealth());
	React.useEffect(()=>{
		const onDegraded = ()=>setStoreHealth(getAiStoreHealth());
		window.addEventListener(AI_STORE_DEGRADED_EVENT, onDegraded);
		onDegraded();
		return ()=>window.removeEventListener(AI_STORE_DEGRADED_EVENT, onDegraded);
	}, []);

	async function restoreWorkspaceBackup(blob){
		// 🔴 破坏性操作三闸(曾裸奔:无确认、无校验、先删后写、异常静默):
		// ① 内容校验先行 —— manifest 能解析但没有 stores 时,旧实现会把全部 store 清空后
		//    一条不还原(全量数据丢失);② 二次确认;③ 逐 store 校验通过后才动库。
		// [D54] 只替换包内存在的数据集(缺席的一律不动)+ 恢复前快照与中途回滚 + 未来版拒 + 体积上限:此前对每个已知店 clear+bulkPut(缺则 []),
		//   一个只含单店的包能把其余二十多个店清空,且无事务无回滚。
		let payload = null;
		try{
			payload = await parseWorkspaceBackupBlob(blob, { maxBytes: AI_BACKUP_MAX_ZIP_BYTES });
		}catch(e){
			message.error(`${e && e.message}` === 'backup.too.large' ? '备份文件超过 200 MB 上限,已取消恢复 —— 现有数据未改动' : '备份内容无效(不是有效的备份包),已取消恢复 —— 现有数据未改动');
			return;
		}
		// [P1-S1] 恢复同样跳过派生缓存:旧包里的 context_cache 不覆盖本机缓存。
		const storeKeys = Object.values(AI_ANALYSIS_STORES).filter((name)=>AI_BACKUP_EXCLUDED_STORES.indexOf(name) < 0);
		const plan = planWorkspaceRestore(payload, storeKeys);
		if(!plan.ok){
			// [Q-412/M-162] 全量包无 AI 工作区段 → 指路命盘列表的全量恢复;含 aiWorkspace 段的全量包已由 plan 自动取段。
			message.error(plan.error === 'backup.version.future' ? '这份备份由更新版本创建,当前版本无法恢复 —— 现有数据未改动'
				: plan.error === 'backup.unified.no.ai' ? '这是「全量备份」包但不含 AI 工作区段:命盘 / 事盘请到「命盘列表 → 恢复全量备份」恢复;AI 工作区请用 AI 分析页导出的备份 —— 现有数据未改动'
				: '备份内容无效(缺少工作区数据),已取消恢复 —— 现有数据未改动');
			return;
		}
		const ok = await asyncConfirm({
			title: '恢复备份将替换包内的数据集',
			content: `${plan.unified ? '(识别为全量备份包,只恢复其中的 AI 工作区段;命盘 / 事盘请到「命盘列表 → 恢复全量备份」)' : ''}只替换备份包里带的 ${plan.present.length} 个数据集(共 ${plan.total} 条记录),包里没有的 ${plan.absent.length} 个数据集不动。接口档案与集成档案的密钥按 id 保留本机现值(备份包里是脱敏占位,不会清空本机 Key)。替换前会先做内存快照,中途出错自动回滚;建议先导出一份当前备份。确定继续?`,
			okText: '确认恢复',
			cancelText: '取消',
		});
		if(!ok){
			return;
		}
		try{
			await restoreWorkspaceStores(plan, { clearStore, bulkPutStoreRecords, listStoreRecords, putStoreRecord, metaStore: AI_ANALYSIS_STORES.workspaceMeta });
		}catch(e){
			console.error(e);
			message.error('恢复中途出错,已按快照回滚,现有数据未改动');
			await loadWorkspace();
			return;
		}
		// [Q-412/M-161] 恢复后当前会话可能已被替换 / 不存在:包内带会话或消息店 → 重置当前会话(避免界面仍显示旧消息);否则保留当前会话并重载其消息。
		const touchesConv = plan.present.indexOf(AI_ANALYSIS_STORES.conversations) >= 0 || plan.present.indexOf(AI_ANALYSIS_STORES.messages) >= 0;
		if(touchesConv){
			await resetConversationDraft({ switchTab: false });
			await loadWorkspace();
		}else{
			await loadWorkspace({ keepConversation: true });
		}
		message.success(`备份已恢复(${plan.present.length} 个数据集)`);
	}

	async function handleRestoreWorkspaceBackup(){
		if(desktopBridge){
			let payload;
			try{
				payload = await openDesktopBackup();
			}catch(e){
				// [Q-060/AW-24] 只有**桥调用抛错**才回退浏览器 input
				console.warn(e);
				payload = undefined;
			}
			if(payload !== undefined){
				// [Q-060/AW-24] 原生对话框点「取消」时壳回 Ok(None) → 这里是 null,是**用户取消**,不是失败。
				// 此前 null 直接落到隐藏 input 的 click(),于是取消完又弹出第二个选择框(统一备份入口早就按取消 return)。
				if(!payload || !payload.base64Data){ return; }
				await restoreWorkspaceBackup(base64ToBlob(payload.base64Data, payload.mimeType || 'application/zip'));
				return;
			}
		}
		if(backupRestoreInputRef.current){
			backupRestoreInputRef.current.value = '';
			backupRestoreInputRef.current.click();
		}
	}

	async function handleBackupRestoreInputChange(e){
		const file = e && e.target && e.target.files ? e.target.files[0] : null;
		try{
			if(file){
				await restoreWorkspaceBackup(file);
			}
		}catch(err){
			// 🔴 曾无 try/catch:非 Horosa zip 抛 backup.manifest.missing → 未捕获 rejection、
			// 无任何提示,且 value 复位被跳过导致同一文件再选不触发 change(看起来「点了没反应」)。
			message.error(`恢复失败:${(err && err.message) || '备份文件无法解析'}`);
		}finally{
			if(backupRestoreInputRef.current){
				backupRestoreInputRef.current.value = '';
			}
		}
	}

	function openMaterialEditor(material){
		setEditingMaterial(material || null);
		materialForm.setFieldsValue({
			name: material ? material.name : '',
			tags: material ? (material.tags || []).join(', ') : '',
			folderId: material ? material.folderId : undefined,
			schools: material && Array.isArray(material.schools) ? material.schools : [],
			extractedText: material ? material.extractedText : '',
		});
		setMaterialModalOpen(true);
	}

	async function saveMaterialForm(){
		const values = await materialForm.validateFields();
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.materials, {
			...(editingMaterial || {}),
			updatedAt: new Date().toISOString(),   // [Q-060/AW-25] 编辑即刷新更新时间
			name: values.name,
			fileName: editingMaterial && editingMaterial.fileName ? editingMaterial.fileName : values.name,
			kind: editingMaterial && editingMaterial.kind ? editingMaterial.kind : 'note',
			folderId: values.folderId || null,
			tags: normalizeTags(values.tags),
			// 资料可按流派标记后过滤
			schools: Array.isArray(values.schools) ? values.schools.filter((s)=>`${s||''}`.trim()) : [],
			extractedText: `${values.extractedText || ''}`.trim(),
			searchText: buildMaterialSearchText({
				...(editingMaterial || {}),
				name: values.name,
				tags: normalizeTags(values.tags),
				extractedText: `${values.extractedText || ''}`.trim(),
			}),
		}, 'material');
		// [Q-054/M-66] 正文变了就删旧切块与向量(与「替换文件」同式):切块入口只要库里有旧切块即返回 → 检索路径继续用旧文本。
		const prevText = `${(editingMaterial && editingMaterial.extractedText) || ''}`.trim();
		if(editingMaterial && editingMaterial.id && prevText !== `${values.extractedText || ''}`.trim()){
			await deleteWhere(AI_ANALYSIS_STORES.materialChunks, (item)=>item.materialId === editingMaterial.id, { index: 'materialId', value: editingMaterial.id });
			await deleteWhere(AI_ANALYSIS_STORES.materialEmbeddings, (item)=>item.materialId === editingMaterial.id, { index: 'materialId', value: editingMaterial.id });
		}
		setMaterials((prev)=>sortByUpdatedDesc(prev.some((item)=>item.id === saved.id) ? prev.map((item)=>item.id === saved.id ? saved : item) : [saved].concat(prev)));
		setMaterialModalOpen(false);
		setEditingMaterial(null);
		message.success('资料已保存');
	}

	async function saveImportedMaterial(parsed, extra = {}){
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.materials, {
			name: parsed.name,
			fileName: parsed.fileName || parsed.name,
			fileExt: parsed.fileExt || '',
			kind: parsed.kind,
			size: parsed.size || 0,
			mimeType: parsed.mimeType || '',
			fileHash: parsed.fileHash || '',
			textHash: parsed.textHash || '',
			originBlob: parsed.originBlob || '',
			tags: normalizeTags(extra.tags),
			folderId: extra.folderId || null,
			extractedText: parsed.extractedText || '',
			extractMeta: parsed.extractMeta || {},
			searchText: buildMaterialSearchText({
				...parsed,
				tags: normalizeTags(extra.tags),
			}),
			schemaVersion: AI_ANALYSIS_SCHEMA_VERSION,
		}, 'material');
		setMaterials((prev)=>sortByUpdatedDesc([saved].concat(prev.filter((item)=>item.id !== saved.id))));
		return saved;
	}

	// [Q-003] batch = 本批导入的去重台账 { seen: Map<fileHash, 已入库记录> }。
	// `materials` 是 render 期快照,`setMaterials` 在同一个批量循环里不会回灌 ⇒ 一批里的第二份同文件
	// 在 materials 里查不到重复、**静默入库**(用户拖一个目录进来,重复文件就这样悄悄翻倍)。
	// 单文件入口不传 batch = 逐字节走原路径。
	function newImportBatch(){ return { seen: new Map() }; }
	async function handleImportFileLike(fileLike, batch){
		const parsed = await parseMaterialFile(fileLike);
		const batchHit = (batch && parsed.fileHash) ? (batch.seen.get(parsed.fileHash) || null) : null;
		const duplicate = batchHit || materials.find((item)=>item.fileHash && parsed.fileHash && item.fileHash === parsed.fileHash);
		if(duplicate){
			const action = await asyncInput({
				title: '发现重复资料',
				defaultValue: 'skip',
				placeholder: '输入 keep / overwrite / skip',
				multiline: false,
			});
			if(action === 'overwrite'){
				const overwritten = await putStoreRecord(AI_ANALYSIS_STORES.materials, {
					...duplicate,
					...parsed,
					id: duplicate.id,
					name: parsed.name,
					searchText: buildMaterialSearchText(parsed),
					/* [Q-060/AW-25] 用户编辑路径显式刷新更新时间(putStoreRecord 见入参带 updatedAt 即沿用旧值 → 编辑完排序不动、时间不变) */ updatedAt: new Date().toISOString(),
				}, 'material');
				await loadWorkspace({ keepConversation: true });
				if(batch && parsed.fileHash){ batch.seen.set(parsed.fileHash, overwritten || { ...duplicate, ...parsed, id: duplicate.id }); }
				message.success(`已覆盖资料：${duplicate.name}`);
				return 'overwritten';
			}
			if(action !== 'keep'){
				message.info('已跳过重复资料');
				return 'skipped';
			}
		}
		const saved = await saveImportedMaterial(parsed);
		if(batch && parsed.fileHash){ batch.seen.set(parsed.fileHash, saved); }
		message.success(`资料已导入：${parsed.name}`);
		return 'imported';
	}

	async function importFileLikeList(fileList, options = {}){
		const all = Array.from(fileList || []).filter(Boolean);
		// [Q-060/AW-18] 与 ingestFiles 同一张白名单:浏览器目录选择忽略 accept(整目录所有文件,含 .DS_Store、图片)
		const list = all.filter((f)=>isSupportedMaterialFile(f));
		const rejected = all.length - list.length;
		if(rejected > 0){ message.warning(`已跳过 ${rejected} 个不支持的文件(只收 ${MATERIAL_IMPORT_EXTENSIONS.join(' / ')})`); }
		let count = 0;
		const batch = newImportBatch();   // [Q-003] 批内去重台账
		for(let i=0; i<list.length; i++){
			const result = await handleImportFileLike(list[i], batch);
			if(result === 'imported' || result === 'overwritten'){
				count += 1;
			}
		}
		if(count && options.successMessage){
			message.success(options.successMessage(count));
		}
		return count;
	}

	function clearFileInput(ref){
		if(ref && ref.current){
			ref.current.value = '';
		}
	}

	function openFallbackFilePicker(ref){
		if(ref && ref.current){
			ref.current.click();
			return true;
		}
		return false;
	}

	function formatImportError(prefix, error){
		const text = error && error.message ? `${error.message}` : `${error || ''}`;
		if(!text || text === 'Error'){
			return prefix;
		}
		return `${prefix}：${text}`;
	}

	async function handleUploadMaterial(file){
		try{
			await handleImportFileLike(file);
			return false;
		}catch(e){
			console.error(e);
			message.error('资料导入失败');
			return false;
		}
	}

	// 资料 folder CRUD（落 store + 局部刷状态，避免整 workspace 重载）。
	async function handleCreateFolder(){
		const name = `${folderDraftName || ''}`.trim();
		if(!name){ message.warning('请填写文件夹名称'); return; }
		try{
			const saved = await putStoreRecord(AI_ANALYSIS_STORES.materialFolders, { name }, 'mfolder');
			setMaterialFolders((prev)=>compareByName(prev.concat(saved)));
			setFolderDraftName('');
			message.success(`已新建文件夹「${saved.name}」`);
		}catch(e){ console.error(e); message.error('新建失败'); }
	}
	async function handleRenameFolder(folder){
		const nextName = await asyncInput({ title: '重命名文件夹', defaultValue: folder.name || '', placeholder: '输入新文件夹名称', maxLength: 40 });
		if(nextName === null) return;
		const name = `${nextName || ''}`.trim();
		if(!name){ message.warning('名称不能为空'); return; }
		try{
			const saved = await putStoreRecord(AI_ANALYSIS_STORES.materialFolders, { ...folder, name, updatedAt: new Date().toISOString(), }, 'mfolder');   // [Q-060/AW-25]
			setMaterialFolders((prev)=>compareByName(prev.map((it)=>it.id === saved.id ? saved : it)));
			message.success('已重命名');
		}catch(e){ console.error(e); message.error('重命名失败'); }
	}
	async function handleDeleteFolder(folder){
		const inside = materials.filter((m)=>m.folderId === folder.id);
		const ok = await asyncConfirm({
			title: `删除文件夹「${folder.name}」？`,
			content: `内含 ${inside.length} 份资料将自动移到「未分类」。`,
			okText: '删除',
			cancelText: '取消',
			danger: true,
		});
		if(!ok) return;
		try{
			// 先把资料移出，避免外键悬空。
			for(const m of inside){
				await putStoreRecord(AI_ANALYSIS_STORES.materials, { ...m, folderId: null, updatedAt: new Date().toISOString(), }, 'material');   // [Q-060/AW-25]
			}
			await deleteStoreRecord(AI_ANALYSIS_STORES.materialFolders, folder.id);
			setMaterialFolders((prev)=>prev.filter((it)=>it.id !== folder.id));
			if(inside.length){ await loadWorkspace({ keepConversation: true }); }
			if(selectedFolderId === folder.id) setSelectedFolderId('');
			message.success('已删除');
		}catch(e){ console.error(e); message.error('删除失败'); }
	}
	async function handleMoveMaterial(material, folderId){
		try{
			const saved = await putStoreRecord(AI_ANALYSIS_STORES.materials, { ...material, folderId: folderId || null, updatedAt: new Date().toISOString(), }, 'material');   // [Q-060/AW-25]
			await loadWorkspace({ keepConversation: true });
			message.success(folderId ? '已移动' : '已移到「未分类」');
			return saved;
		}catch(e){ console.error(e); message.error('移动失败'); }
	}

	// 非阻塞批量导入：用队列驱动进度条 + 对重复文件「全部跳过/全部覆盖/逐条」一次决策（不再 window.prompt 反复弹）。
	async function ingestFiles(fileList, options = {}){
		const all = Array.from(fileList || []).filter((f)=>f && f.name);
		// [Q-060/AW-18] 按同一张扩展名白名单过滤(与桌面壳层逐字同集)。此前拖拽 / 浏览器目录选择不受 accept
		// 约束,guessKind 把一切未知后缀当 txt、readAsText 直接读二进制 —— 拖一张 PNG 进来就是一份乱码资料。
		const files = all.filter((f)=>isSupportedMaterialFile(f));
		const rejected = all.filter((f)=>!isSupportedMaterialFile(f));
		if(rejected.length){
			// 不静默丢:在队列里留「类型不支持」的痕迹,2 秒后随队列一起清
			const skipQ = rejected.map((f)=>({ id: `${f.name}-skip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: f.name, size: f.size || 0, status: 'skip', err: '类型不支持' }));
			if(isMountedRef.current){ setMaterialIngestQueue((prev)=>prev.concat(skipQ)); }
			message.warning(`已跳过 ${rejected.length} 个不支持的文件(只收 ${MATERIAL_IMPORT_EXTENSIONS.join(' / ')})`);
			// [Q-413/M-163] 只清本批自己的行(此前整条队列清空 → 并发的另一批进度/报错行一起消失)
			const skipIds = new Set(skipQ.map((q)=>q.id));
			if(!files.length){ setTimeout(()=>{ if(isMountedRef.current){ setMaterialIngestQueue((prev)=>prev.filter((q)=>!skipIds.has(q.id))); } }, 2400); }
		}
		if(!files.length) return;
		// [Q-060/AW-23] 走后端抽取的 pdf/doc/docx 直接按后端 30MB 硬上限拦截:此前只有一个 50MB「仍要上传」软提示,
		// 35MB 的 PDF 一路送到后端才被 580103 拒,用户看到的是一句无解释的失败(而且整批就此中断)。
		const overBackend = files.filter((f)=>oversizeForBackend(f));
		if(overBackend.length){
			const names = overBackend.map((f)=>`${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`).join('、');
			message.warning(`以下文件超过 ${MATERIAL_BACKEND_MAX_BYTES / 1024 / 1024} MB 抽取上限,已跳过:${names}`);
		}
		const sized = files.filter((f)=>!oversizeForBackend(f));
		if(!sized.length){ return; }
		// v1.16-BB5: 大文件 OOM 守门 — > 50MB 警告(parseMaterialFile 内部用 base64,大文件可能爆内存/UI 卡死)
		const HUGE = 50 * 1024 * 1024;
		const hugeFiles = sized.filter((f)=>f.size > HUGE);
		if(hugeFiles.length){
			const list = hugeFiles.map((f)=>`${f.name} (${(f.size/1024/1024).toFixed(1)} MB)`).join('\n');
			const proceed = await new Promise((resolve)=>{
				Modal.confirm({
					title: '检测到超大文件 (> 50MB)',
					content: <div>以下文件可能解析慢或导致 UI 卡顿:<pre style={{maxHeight:120,overflow:'auto',background:'#f5f5f5',padding:8,fontSize:12}}>{list}</pre>建议先拆分或转 .txt 后再上传。仍要继续吗?</div>,
					okText: '仍要上传',
					cancelText: '取消',
					onOk: ()=>resolve(true),
					onCancel: ()=>resolve(false),
				});
			});
			if(!proceed) return;
		}
		// 初始化队列；统一过 safeSetQ 守门，组件 unmount 后绝不 setState。
		const safeSetQ = (updater)=>{ if(isMountedRef.current){ setMaterialIngestQueue(updater); } };
		const queue = sized.map((f)=>({ id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name: f.name, size: f.size || 0, status: 'parsing' }));
		safeSetQ((prev)=>prev.concat(queue));
		const dupePolicy = options.dupePolicy || 'ask'; // 'ask' | 'skip' | 'overwrite' | 'keep'
		const batchSeen = new Map();   // [Q-003] 批内已入库的 fileHash → 记录(materials 在本循环里不回灌)
		let askedAll = null; // 设置后剩余所有重复都按此处理
		let ok = 0;
		for(let i = 0; i < sized.length; i++){
			if(!isMountedRef.current){ break; } // unmount 后立刻退出循环。
			const f = sized[i];
			const qid = queue[i].id;
			try{
				safeSetQ((prev)=>prev.map((q)=>q.id === qid ? { ...q, status: 'parsing' } : q));
				const parsed = await parseMaterialFile(f);
				if(!isMountedRef.current){ break; }
				const duplicate = (parsed.fileHash ? batchSeen.get(parsed.fileHash) : null)
					|| materials.find((m)=>m.fileHash && parsed.fileHash && m.fileHash === parsed.fileHash);   // [Q-003] 先查批内台账
				let action = askedAll || (duplicate ? (dupePolicy === 'ask' ? null : dupePolicy) : 'import');
				if(duplicate && !action){
					// 异步弹层：覆盖 / 跳过 / 全部覆盖 / 全部跳过（用 asyncConfirm 不行——需要多按钮，改用自定义 Modal）。
					const decision = await new Promise((resolve)=>{
						let resolved = false;
						let modalRef = null;
						const finish = (v)=>{ if(resolved) return; resolved = true; try{ if(modalRef) modalRef.destroy(); }catch(_){} resolve(v); };
						modalRef = AntdModal.confirm({
							title: `发现重复资料「${(duplicate && duplicate.name) || '未命名'}」`,
							icon: null,
							content: '后续操作：',
							centered: true,
							width: 460,
							okText: '覆盖',
							cancelText: '跳过',
							onOk: ()=>finish('overwrite'),
							onCancel: ()=>finish('skip'),
							footer: ()=>(
								<div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
									<button onClick={()=>finish('skip')} className="ant-btn ant-btn-default">跳过</button>
									<button onClick={()=>{ askedAll = 'skip'; finish('skip'); }} className="ant-btn ant-btn-default">全部跳过</button>
									<button onClick={()=>finish('overwrite')} className="ant-btn ant-btn-primary">覆盖</button>
									<button onClick={()=>{ askedAll = 'overwrite'; finish('overwrite'); }} className="ant-btn ant-btn-primary">全部覆盖</button>
								</div>
							),
						});
					});
					if(!isMountedRef.current){ break; }
					action = decision;
				}
				safeSetQ((prev)=>prev.map((q)=>q.id === qid ? { ...q, status: 'importing' } : q));
				if(action === 'overwrite' && duplicate){
					const overwritten = await putStoreRecord(AI_ANALYSIS_STORES.materials, { ...duplicate, ...parsed, id: duplicate.id, name: parsed.name, searchText: buildMaterialSearchText(parsed), updatedAt: new Date().toISOString(), }, 'material');   // [Q-060/AW-25]
					if(parsed.fileHash){ batchSeen.set(parsed.fileHash, overwritten || { ...duplicate, ...parsed, id: duplicate.id }); }
					ok++;
				}else if(action === 'skip' && duplicate){
					safeSetQ((prev)=>prev.map((q)=>q.id === qid ? { ...q, status: 'skip' } : q));
					continue;
				}else{
					const savedMat = await saveImportedMaterial(parsed);
					if(parsed.fileHash){ batchSeen.set(parsed.fileHash, savedMat); }
					ok++;
				}
				const truncNote = describeExtractTruncation(parsed.extractMeta);   // [Q-060/AW-23]
				safeSetQ((prev)=>prev.map((q)=>q.id === qid ? { ...q, status: 'done', truncated: truncNote || '' } : q));
			}catch(e){
				console.error(e);
				safeSetQ((prev)=>prev.map((q)=>q.id === qid ? { ...q, status: 'error', err: (e && e.message) || '导入失败' } : q));
			}
		}
		if(ok && isMountedRef.current){ try{ await loadWorkspace({ keepConversation: true }); message.success(`已导入 ${ok} 份资料`); }catch(_){} }
		// 2 秒后清队列 —— [Q-413/M-163] 只清本批的行:两批并发时先完成的一批曾把整条队列清空,另一批进行中的进度与报错行消失。
		const batchIds = new Set(queue.map((q)=>q.id));
		setTimeout(()=>{ if(isMountedRef.current){ setMaterialIngestQueue((prev)=>prev.filter((q)=>!batchIds.has(q.id))); } }, 2400);
	}

	// [Q-413/M-164] 删组合/资料/模版后,已存会话记录里的 `<kind>:<id>` 引用同批清掉:此前只过滤当前 state 的
	//   referenceIds,重开旧会话原样灌回,挂载横幅按数组长度计数「📚 N 资料 / 组合」而解析时静默丢弃。
	async function pruneConversationRefs(refId){
		try{
			const list = await listStoreRecords(AI_ANALYSIS_STORES.conversations);
			const hit = (list || []).filter((c)=>c && Array.isArray(c.referenceIds) && c.referenceIds.indexOf(refId) >= 0);
			if(!hit.length){ return 0; }
			const next = hit.map((c)=>({ ...c, referenceIds: c.referenceIds.filter((x)=>x !== refId) }));
			await bulkPutStoreRecords(AI_ANALYSIS_STORES.conversations, next, 'conv');
			const byId = new Map(next.map((c)=>[c.id, c]));
			setConversations((prev)=>prev.map((c)=>byId.get(c.id) || c));
			return hit.length;
		}catch(e){
			console.error(e);
			return 0;
		}
	}

	// [Q-060/AW-17] 桌面拿到的文件转成 File 后交给 ingestFiles —— 与拖拽 / 浏览器选择共用同一套
	// 决策弹窗(跳过 / 全部跳过 / 覆盖 / 全部覆盖)、逐文件队列、白名单与超大文件确认。
	function desktopItemsToFiles(items){
		return (items || []).map((item)=>{
			const blob = base64ToBlob(item.base64Data, item.mimeType || 'application/octet-stream');
			return new File([blob], item.fileName, { type: item.mimeType || '' });
		});
	}

	async function handleDesktopFilePick(){
		let picked = null;
		try{
			// [Q-060/AW-17] 只有**桥调用本身**失败才回退浏览器选择。此前整段(含逐个导入)裹在一个 try 里:
			// 任一文件解析失败(例如超 30MB 的 PDF 被后端拒)就提示「桌面选文件暂时不可用」并弹出第二个选择框,
			// 余下文件全不导入,真实错误只进控制台。
			picked = await pickDesktopFiles();
		}catch(e){
			console.error(e);
			clearFileInput(desktopFileInputRef);
			if(openFallbackFilePicker(desktopFileInputRef)){
				message.warning('桌面选文件暂时不可用，已切换为浏览器文件选择');
				return;
			}
			message.error(formatImportError('桌面导入失败', e));
			return;
		}
		await ingestFiles(desktopItemsToFiles(picked));
	}

	async function handleDesktopFolderImport(){
		let picked = null;
		try{
			picked = await pickDesktopFolder();   // [Q-060/AW-17] 同上:catch 只管桥调用本身
		}catch(e){
			console.error(e);
			clearFileInput(desktopFolderInputRef);
			if(openFallbackFilePicker(desktopFolderInputRef)){
				message.warning('目录导入暂时不可用，已切换为浏览器目录选择');
				return;
			}
			message.error(formatImportError('目录导入失败', e));
			return;
		}
		// [Q-060/AW-17] 成功条数由 ingestFiles 按**真正入库的**数量报(此前按选中文件数报,把跳过的重复也算成功)
		await ingestFiles(desktopItemsToFiles(picked));
	}

	async function handleDesktopFileInputChange(e){
		try{
			await importFileLikeList(e && e.target ? e.target.files : [], {
				successMessage: (count)=>`已导入 ${count} 份资料`,
			});
		}catch(error){
			console.error(error);
			message.error(formatImportError('资料导入失败', error));
		}finally{
			clearFileInput(desktopFileInputRef);
		}
	}

	async function handleDesktopFolderInputChange(e){
		try{
			const count = await importFileLikeList(e && e.target ? e.target.files : [], {
				successMessage: (total)=>`已从目录导入 ${total} 份资料`,
			});
			if(!count){
				message.info('当前目录中没有可导入的资料文件');
			}
		}catch(error){
			console.error(error);
			message.error(formatImportError('目录导入失败', error));
		}finally{
			clearFileInput(desktopFolderInputRef);
		}
	}

	// [Q-011] silent:批量路径(去重 / 批删)逐条调用时不逐条弹 toast —— N 份重复就弹 N+1 条,
	// 后面的把前面的挤掉,用户只看见一串闪动。单条删除(缺省)照旧弹。
	async function deleteMaterial(materialId, options){
		await deleteStoreRecord(AI_ANALYSIS_STORES.materials, materialId);
		await deleteWhere(AI_ANALYSIS_STORES.materialChunks, (item)=>item.materialId === materialId, { index: 'materialId', value: materialId });
		await deleteWhere(AI_ANALYSIS_STORES.materialEmbeddings, (item)=>item.materialId === materialId, { index: 'materialId', value: materialId });
		setMaterials((prev)=>prev.filter((item)=>item.id !== materialId));
		setReferenceIds((prev)=>prev.filter((item)=>item !== `material:${materialId}`));
		await pruneConversationRefs(`material:${materialId}`);   // [Q-413/M-164] 会话记录里的残留引用同清
		const cleaned = await pruneBundleRefs({ materialId });   // [Q-062/AW-32]
		if(!(options && options.silent)){ message.success(cleaned ? `资料已删除（同时从 ${cleaned} 个组合里移除）` : '资料已删除'); }
	}

	async function handleReplaceMaterial(material, file){
		try{
			const parsed = await parseMaterialFile(file);
			const saved = await putStoreRecord(AI_ANALYSIS_STORES.materials, {
				...material,
				...parsed,
				updatedAt: new Date().toISOString(),
				id: material.id,
				name: material.name || parsed.name,
				folderId: material.folderId || null,
				tags: material.tags || [],
				searchText: buildMaterialSearchText({
					...material,
					...parsed,
				}),
			}, 'material');
			setMaterials((prev)=>sortByUpdatedDesc(prev.map((item)=>item.id === saved.id ? saved : item)));
			await deleteWhere(AI_ANALYSIS_STORES.materialChunks, (item)=>item.materialId === material.id, { index: 'materialId', value: material.id });
			await deleteWhere(AI_ANALYSIS_STORES.materialEmbeddings, (item)=>item.materialId === material.id, { index: 'materialId', value: material.id });
			message.success(`已替换文件：${material.name}`);
		}catch(e){
			console.error(e);
			message.error('替换文件失败');
		}
		return false;
	}

	async function exportMaterialOriginal(material){
		if(!material.originBlob){
			message.warning('这份资料没有保存原文件');
			return;
		}
		const blob = base64ToBlob(material.originBlob, material.mimeType || 'application/octet-stream');
		notifySaveResult(await saveBlobToBrowser(material.fileName || material.name || 'material.bin', blob), '已导出原文件');   // [Q-410]
	}

	// [Q-004] 与兄弟导出(原文件 / 会话 / 备份)同一路数:桌面端先走 saveDesktopFile 弹系统保存框,
	// 失败再回落浏览器下载。此前「提取文本」在桌面端直接落浏览器下载目录(用户选不了位置)。
	// BOM 在两条路上都保:浏览器路径由 downloadTextFile 的 withUtf8Bom 加,桌面路径在这里同款加
	// (少了它,Windows 记事本/Excel 打开中文提取稿是乱码)。
	async function exportMaterialText(material){
		const fileName = `${material.name || 'material'}.txt`;
		const mime = 'text/plain;charset=utf-8';
		const text = material.extractedText || '';
		// [Q-410] downloadTextFile 内部已单源(桌面壳保存桥 + BOM);取消 / 失败如实提示。
		notifySaveResult(await downloadTextFile(fileName, text, mime), '已导出提取文本');
	}

	async function dedupeMaterials(){
		const grouped = new Map();
		const duplicates = [];
		materials.forEach((item)=>{
			const key = item.fileHash || item.textHash;
			if(!key){
				return;
			}
			if(grouped.has(key)){
				duplicates.push(item);
				return;
			}
			grouped.set(key, item);
		});
		if(!duplicates.length){
			message.success('未发现重复资料');
			return;
		}
		const ok = await asyncConfirm({
			title: `检测到 ${duplicates.length} 份重复资料`,
			// [Q-010] 文案改真话:列表按 updatedAt 倒序,「首份」其实就是**最新**保存的那份
			content: '是否删除重复项？（保留最新一份，删除更早的重复）',
			okText: '删除重复项',
			cancelText: '取消',
			danger: true,
		});
		if(!ok){
			return;
		}
		for(let i=0; i<duplicates.length; i++){
			await deleteMaterial(duplicates[i].id, { silent: true });   // [Q-011] 只弹下面这条汇总
		}
		message.success(`已删除 ${duplicates.length} 份重复资料`);
	}

	function openTemplateEditor(template){
		setEditingTemplate(template || null);
		templateForm.setFieldsValue({
			name: template ? template.name : '',
			format: template ? template.format : 'text',
			instructionText: template ? (template.instructionText || template.content || '') : '',
			jsonSchema: template ? (template.jsonSchema || template.content || '{\n  \"type\": \"object\"\n}') : '{\n  \"type\": \"object\"\n}',
			exampleInput: template ? (template.exampleInput || '{\n  \"user_prompt\": \"请分析这个案例\"\n}') : '{\n  \"user_prompt\": \"请分析这个案例\"\n}',
			exampleOutput: template ? (template.exampleOutput || '{\n  \"summary\": \"示例输出\"\n}') : '{\n  \"summary\": \"示例输出\"\n}',
		});
		setTemplateModalOpen(true);
	}

	async function saveTemplateForm(){
		const values = await templateForm.validateFields();
		const snapshot = buildTemplateVersionSnapshot(values);
		if(values.format === 'json' && !safeParseJson(values.jsonSchema, null)){
			message.error('JSON Schema 解析失败');
			return;
		}
		const current = editingTemplate || {};
		let saved = await putStoreRecord(AI_ANALYSIS_STORES.templates, {
			...current,
			/* [Q-060/AW-25] 用户编辑路径显式刷新更新时间(putStoreRecord 见入参带 updatedAt 即沿用旧值 → 编辑完排序不动、时间不变) */ updatedAt: new Date().toISOString(),
			name: values.name,
			format: values.format,
			instructionText: values.instructionText || '',
			jsonSchema: values.jsonSchema || '',
			exampleInput: values.exampleInput || '',
			exampleOutput: values.exampleOutput || '',
			content: values.format === 'text' ? (values.instructionText || '') : (values.jsonSchema || ''),
		}, 'template');
		const versions = templateVersions.filter((item)=>item.templateId === saved.id);
		// [Q-062/AW-33] ① 内容一个字没改就别留版(此前每点一次保存都攒一条,版本列表被无意义的副本淹掉);
		//                ② 版本号取库内最大值 + 1(此前用 versions.length + 1:删过旧版本就会撞号)。
		const latest = versions.slice().sort((a, b)=>(Number(b.versionNumber) || 0) - (Number(a.versionNumber) || 0))[0] || null;
		const unchanged = latest && latest.snapshot && JSON.stringify(latest.snapshot) === JSON.stringify(snapshot);
		let version = latest;
		if(!unchanged){
			const maxNo = versions.reduce((mx, item)=>Math.max(mx, Number(item.versionNumber) || 0), 0);
			version = await putStoreRecord(AI_ANALYSIS_STORES.templateVersions, {
				templateId: saved.id,
				versionNumber: maxNo + 1,
				snapshot,
			}, 'tplver');
		}
		saved = await putStoreRecord(AI_ANALYSIS_STORES.templates, {
			...saved,
			activeVersionId: version ? version.id : (saved.activeVersionId || null),
			updatedAt: new Date().toISOString(),
		}, 'template');
		setTemplates((prev)=>sortByUpdatedDesc(prev.some((item)=>item.id === saved.id) ? prev.map((item)=>item.id === saved.id ? saved : item) : [saved].concat(prev)));
		if(version && !unchanged){
			setTemplateVersions((prev)=>sortByUpdatedDesc([version].concat(prev.filter((item)=>item.id !== version.id))));
		}
		setTemplateModalOpen(false);
		setEditingTemplate(null);
		message.success(unchanged ? '模版已保存（内容未变，未新增版本）' : '模版已保存');
	}

	// [Q-062/AW-32] 删掉资料 / 模版 / 接口后,组合里指向它的 id 是**悬空引用**:组合编辑器的下拉显示裸 id,
	// 「一键应用」指向已删接口时模型选择被 effect 静默回落到别的接口却仍提示「已应用组合」。删除即就地清理。
	async function pruneBundleRefs({ materialId, templateId, providerProfileId }){
		const hit = (bundles || []).filter((b)=>{
			if(!b){ return false; }
			if(materialId && ((b.materialIds || []).indexOf(materialId) >= 0 || (b.defaultMaterialIds || []).indexOf(materialId) >= 0)){ return true; }
			if(templateId && b.templateId === templateId){ return true; }
			if(providerProfileId && b.defaultProviderProfileId === providerProfileId){ return true; }
			return false;
		});
		if(!hit.length){ return 0; }
		const saved = [];
		for(let i = 0; i < hit.length; i++){
			const b = hit[i];
			const next = { ...b, updatedAt: new Date().toISOString() };
			if(materialId){
				next.materialIds = (b.materialIds || []).filter((id)=>id !== materialId);
				next.defaultMaterialIds = (b.defaultMaterialIds || []).filter((id)=>id !== materialId);
			}
			if(templateId && b.templateId === templateId){ next.templateId = null; }
			if(providerProfileId && b.defaultProviderProfileId === providerProfileId){
				next.defaultProviderProfileId = null;
				next.defaultModel = null;   // 接口没了,钉在它上面的模型名也没意义
			}
			// eslint-disable-next-line no-await-in-loop
			saved.push(await putStoreRecord(AI_ANALYSIS_STORES.bundles, next, 'bundle'));
		}
		const byId = new Map(saved.map((x)=>[x.id, x]));
		setBundles((prev)=>prev.map((x)=>byId.get(x.id) || x));
		return saved.length;
	}

	async function deleteTemplate(templateId){
		await deleteStoreRecord(AI_ANALYSIS_STORES.templates, templateId);
		await deleteWhere(AI_ANALYSIS_STORES.templateVersions, (item)=>item.templateId === templateId, { index: 'templateId', value: templateId });
		setTemplates((prev)=>prev.filter((item)=>item.id !== templateId));
		setTemplateVersions((prev)=>prev.filter((item)=>item.templateId !== templateId));
		setReferenceIds((prev)=>prev.filter((item)=>item !== `template:${templateId}`));   // [Q-062/AW-32] 本轮挂载里的引用同清
		await pruneConversationRefs(`template:${templateId}`);   // [Q-413/M-164]
		const cleaned = await pruneBundleRefs({ templateId });
		message.success(cleaned ? `模版已删除（同时从 ${cleaned} 个组合里移除）` : '模版已删除');
	}

	// [Q-062/AW-33] 回滚三修:
	//  ① 回滚本身**写一条新版本**(注「回滚自 Vn」)—— 此前直接改模版、不留痕,回滚之前的那份内容就此消失、无法再回去;
	//  ② activeVersionId 指向新写的这条(而不是被回滚的旧版),「当前版」标记才对得上;
	//  ③ **不回退名称**:名字是模版的身份,用户改了名再回滚正文,不该连名字一起倒退。
	async function rollbackTemplateVersion(template, version){
		const snapshot = version && version.snapshot ? version.snapshot : null;
		if(!snapshot){
			return;
		}
		const keepName = `${(template && template.name) || snapshot.name || ''}`;
		const restored = { ...snapshot, name: keepName };
		const versions = templateVersions.filter((item)=>item.templateId === template.id);
		const maxNo = versions.reduce((mx, item)=>Math.max(mx, Number(item.versionNumber) || 0), 0);
		const newVersion = await putStoreRecord(AI_ANALYSIS_STORES.templateVersions, {
			templateId: template.id,
			versionNumber: maxNo + 1,
			rolledBackFrom: version.versionNumber == null ? null : Number(version.versionNumber),
			note: `回滚自 V${version.versionNumber == null ? '?' : version.versionNumber}`,
			snapshot: restored,
		}, 'tplver');
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.templates, {
			...template,
			...restored,
			activeVersionId: newVersion.id,
			content: restored.content || (restored.format === 'json' ? restored.jsonSchema : restored.instructionText),
			/* [Q-060/AW-25] 用户编辑路径显式刷新更新时间 */ updatedAt: new Date().toISOString(),
		}, 'template');
		setTemplates((prev)=>sortByUpdatedDesc(prev.map((item)=>item.id === saved.id ? saved : item)));
		setTemplateVersions((prev)=>sortByUpdatedDesc([newVersion].concat(prev.filter((item)=>item.id !== newVersion.id))));
		message.success(`模版已回滚到 V${version.versionNumber == null ? '?' : version.versionNumber}（另存为 V${newVersion.versionNumber}）`);
	}

	function openBundleEditor(bundle){
		setEditingBundle(bundle || null);
		bundleForm.setFieldsValue({
			name: bundle ? bundle.name : '',
			templateId: bundle ? bundle.templateId : undefined,
			materialIds: bundle ? (bundle.defaultMaterialIds && bundle.defaultMaterialIds.length ? bundle.defaultMaterialIds : (bundle.materialIds || [])) : [],
			defaultModelSelection: bundle && bundle.defaultProviderProfileId && bundle.defaultModel
				? encodeModelSelection(bundle.defaultProviderProfileId, bundle.defaultModel)
				: undefined,
			defaultEmbeddingModel: bundle ? bundle.defaultEmbeddingModel : '',
			defaultSystemPrompt: bundle ? bundle.defaultSystemPrompt : '',
			defaultRetrievalMode: bundle ? bundle.defaultRetrievalMode || 'auto' : 'auto',
			defaultTechniqueKeys: bundle ? (bundle.defaultTechniqueKeys || []) : [],
			defaultChatTemperature: bundle && bundle.defaultChatTemperature != null ? bundle.defaultChatTemperature : null,
			defaultChatTopP: bundle && bundle.defaultChatTopP != null ? bundle.defaultChatTopP : null,
			defaultThinkingLevel: bundle ? (bundle.defaultThinkingLevel || '') : '',
		});
		setBundleModalOpen(true);
	}

	async function saveBundleForm(){
		const values = await bundleForm.validateFields();
		const parsed = parseModelSelection(values.defaultModelSelection || '');
		// [Q-416 裁决] 技能包组合:这里改的技法同步写入 skill.techniqueKeys(升版 + 留档);此前只写 defaultTechniqueKeys → 用技能时仍挂旧技法
		const skillSync = syncSkillTechniqueKeys(editingBundle, values.defaultTechniqueKeys || []);
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.bundles, {
			...(editingBundle || {}),
			...skillSync,
			/* [Q-060/AW-25] 用户编辑路径显式刷新更新时间(putStoreRecord 见入参带 updatedAt 即沿用旧值 → 编辑完排序不动、时间不变) */ updatedAt: new Date().toISOString(),
			name: values.name,
			templateId: values.templateId || null,
			materialIds: values.materialIds || [],
			defaultMaterialIds: values.materialIds || [],
			defaultProviderProfileId: parsed.profileId || null,
			defaultModel: parsed.model || null,
			defaultEmbeddingModel: values.defaultEmbeddingModel || null,
			defaultSystemPrompt: values.defaultSystemPrompt || '',
			defaultRetrievalMode: values.defaultRetrievalMode || 'auto',
			defaultTechniqueKeys: values.defaultTechniqueKeys || [],
			defaultChatTemperature: (values.defaultChatTemperature === undefined || values.defaultChatTemperature === null || values.defaultChatTemperature === '') ? null : values.defaultChatTemperature,
			defaultChatTopP: (values.defaultChatTopP === undefined || values.defaultChatTopP === null || values.defaultChatTopP === '') ? null : values.defaultChatTopP,
			defaultThinkingLevel: values.defaultThinkingLevel || '',
		}, 'bundle');
		setBundles((prev)=>sortByUpdatedDesc(prev.some((item)=>item.id === saved.id) ? prev.map((item)=>item.id === saved.id ? saved : item) : [saved].concat(prev)));
		setBundleModalOpen(false);
		setEditingBundle(null);
		message.success(skillSync.skill ? `组合已保存（技能「${saved.name}」技法已同步，v${skillSync.skill.version}）` : '组合已保存');
	}

	async function deleteBundle(bundleId){
		await deleteStoreRecord(AI_ANALYSIS_STORES.bundles, bundleId);
		setBundles((prev)=>prev.filter((item)=>item.id !== bundleId));
		setReferenceIds((prev)=>prev.filter((item)=>item !== `bundle:${bundleId}`));
		const cleaned = await pruneConversationRefs(`bundle:${bundleId}`);   // [Q-413/M-164]
		message.success(cleaned ? `组合已删除（同时从 ${cleaned} 个会话的挂载引用里移除）` : '组合已删除');
	}

	function applyBundle(bundle){
		const nextRefs = uniqueTextList(referenceIds.filter((item)=>item.indexOf('bundle:') !== 0).concat(`bundle:${bundle.id}`));
		setReferenceIds(nextRefs);
		if(bundle.defaultProviderProfileId && bundle.defaultModel){
			setModelSelection(encodeModelSelection(bundle.defaultProviderProfileId, bundle.defaultModel));
		}
		if(bundle.defaultSystemPrompt){
			setSessionSystemPrompt(bundle.defaultSystemPrompt);
		}
		// 组合包：缓存待挂载技法（待选案例后 effect 取交集落地）+ 套用生成设置。
		if(Array.isArray(bundle.defaultTechniqueKeys) && bundle.defaultTechniqueKeys.length){
			setPendingBundleTechniqueKeys(bundle.defaultTechniqueKeys.slice(0));
		}
		if(bundle.defaultChatTemperature != null){ setChatTemperature(bundle.defaultChatTemperature); saveUiPrefs({ chatTemperature: bundle.defaultChatTemperature }); }
		if(bundle.defaultChatTopP != null){ setChatTopP(bundle.defaultChatTopP); saveUiPrefs({ chatTopP: bundle.defaultChatTopP }); }
		if(bundle.defaultThinkingLevel){ setThinkingLevel(bundle.defaultThinkingLevel); saveUiPrefs({ thinkingLevel: bundle.defaultThinkingLevel }); }
		setInnerTab('analysis');
		message.success(`已应用组合：${bundle.name}`);
	}

	function openProviderEditor(profile){
		setEditingProvider(profile || null);
		providerForm.setFieldsValue(buildProviderFormValues(profile));
		setProviderAdvancedOpen(false);
		setProviderModalOpen(true);
	}

	async function saveProviderForm(){
		const checkedValues = await providerForm.validateFields();
		const values = {
			...providerForm.getFieldsValue(true),
			...checkedValues,
		};
		const providerType = values.providerType || 'openai';
		const preset = getProviderPreset(providerType);
		const providerOptions = buildProviderOptionsFromForm(values);
		const manualModels = uniqueTextList(`${values.manualModels || ''}`.split(/[\n,，]/g)).length
			? uniqueTextList(`${values.manualModels || ''}`.split(/[\n,，]/g))
			: getProviderDefaultChatModels(providerType);
		// [Q-060/AW-16] Embedding 列表允许为空:此前空表单回填预设(OpenAI / Gemini / Ollama 预设非空)
		// ⇒ 一个档案不可能「没有嵌入模型」,向量检索关不掉。清空即当真。
		const embeddingModels = uniqueTextList(`${values.embeddingModels || ''}`.split(/[\n,，]/g));
		// [Q-060/AW-16] 保存**以表单行为准**:此前把旧 availableModels(拉取结果)与表单行合并重算,
		// 用户从「聊天模型列表」删掉的 dall-e / tts 类模型每次保存都被加回来 —— 删行永远无效。
		// 表单里本来就显示着全部拉取结果(buildProviderFormValues 用 normalizeProfileModels 拼的),
		// 所以只按表单重写不会丢任何用户想留的模型。
		const normalized = normalizeProviderResultModels({
			models: [].concat(manualModels).concat(embeddingModels),
		}, providerType, true);
		const diagnosticsStillValid = !!(editingProvider && editingProvider.healthStatus
			&& `${editingProvider.apiKey || ''}`.trim() === `${values.apiKey || ''}`.trim()
			&& (`${editingProvider.baseUrl || ''}`.trim() || preset.baseUrl) === (`${values.baseUrl || ''}`.trim() || preset.baseUrl)
			&& editingProvider.providerType === providerType);
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, {
			...(editingProvider || {}),
			/* [Q-060/AW-25] 用户编辑路径显式刷新更新时间(putStoreRecord 见入参带 updatedAt 即沿用旧值 → 编辑完排序不动、时间不变) */ updatedAt: new Date().toISOString(),
			name: `${values.name || ''}`.trim() || preset.label,
			providerType,
			protocolFamily: getProviderProtocolFamily(providerType),
			apiKey: `${values.apiKey || ''}`.trim(),
			baseUrl: `${values.baseUrl || ''}`.trim() || preset.baseUrl,
			manualModels,
			chatModelIds: normalized.chatModels,
			// [Q-060/AW-16] 清空过的嵌入列表要真的空;normalizeProviderResultModels 的预设兜底只对「聊天模型」有意义
			embeddingModelIds: embeddingModels.length ? normalized.embeddingModels : [],
			availableModels: normalized.models,
			enabled: values.enabled !== false,
			providerOptions,
			// [Q-012/M-13] apiKey / baseUrl / 接口类型任一改动 → 历史诊断作废置 unknown(此前绿标残留到改错的 Key 上)
			healthStatus: diagnosticsStillValid ? editingProvider.healthStatus : 'unknown',
			// [Q-411/M-156] 同判据清 lastDiagnostics:此前 ...editingProvider 整体沿用,改成不可达地址后卡片仍显示旧地址的 DNS/TCP/HTTP 全 OK
			lastDiagnostics: diagnosticsStillValid ? (editingProvider.lastDiagnostics || null) : null,
		}, 'provider');
		setProviderProfiles((prev)=>sortByUpdatedDesc(prev.some((item)=>item.id === saved.id) ? prev.map((item)=>item.id === saved.id ? saved : item) : [saved].concat(prev)));
		setProviderModalOpen(false);
		setProviderAdvancedOpen(false);
		const wasNewProvider = !editingProvider || !editingProvider.id;
		setEditingProvider(null);
		message.success('接口配置已保存');
		// 新建接口后自动拉取模型列表（仅新建；编辑沿用既有列表，避免覆盖手填）。非阻塞、内部已 try/catch。
		// [Q-411/M-158] 条件曾是 apiKey || baseUrl(Base URL 空则回填预设 → 恒真):不填 Key 时后端不发鉴权头、上游必 401/400,
		//   「已保存」后紧跟「拉取模型列表失败」。改为有 Key 才自动拉(ollama 本地无 Key 仍自动拉;鉴权头写在额外请求头时亦自动拉)。
		const hasAuth = !!(`${saved.apiKey || ''}`.trim() || saved.providerType === 'ollama'
			|| Object.keys((saved.providerOptions && saved.providerOptions.extraHeaders) || {}).length);
		if(wasNewProvider && hasAuth){
			fetchModelsAndEmbeddings(saved);
		}
	}

	async function deleteProvider(profileId){
		await deleteStoreRecord(AI_ANALYSIS_STORES.providerProfiles, profileId);
		const remaining = providerProfiles.filter((item)=>item.id !== profileId);
		setProviderProfiles(remaining);
		if(parseModelSelection(modelSelection).profileId === profileId){
			const next = remaining.find((item)=>item.enabled !== false) || remaining[0] || null;
			setModelSelection(next ? encodeModelSelection(next.id, normalizeProfileModels(next)[0] || '') : '');
		}
		const cleaned = await pruneBundleRefs({ providerProfileId: profileId });   // [Q-062/AW-32]
		message.success(cleaned ? `接口配置已删除（同时清掉 ${cleaned} 个组合里的默认接口）` : '接口配置已删除');
	}

	function setProviderAsCurrent(profile){
		if(!profile){
			return;
		}
		// [Q-038/M-46] 未启用档案不进模型下拉(modelOptions 过滤 enabled===false)→ 此前照样提示「已切换」,
		//   而 Select 的值不在选项里,下一拍就被改回 = 提示与实际互斥。现改为拦下并指路。
		if(profile.enabled === false){
			message.warning(`「${profile.name || getProviderDisplayName(profile.providerType)}」未启用,不能设为当前;请先点「编辑」把「启用」打开`);
			return;
		}
		// [Q-038] 首模型取**聊天**模型(此前 normalizeProfileModels 含嵌入模型 → 可能选中一个不能聊天的模型)
		const models = normalizeProfileChatModels(profile);
		setModelSelection(encodeModelSelection(profile.id, models[0] || ''));
		setProviderSwitchModalOpen(false);
		message.success(`已切换到「${profile.name || getProviderDisplayName(profile.providerType)}」${models.length ? '' : '（该配置暂无对话模型，请先在编辑里补全）'}`);
	}

	async function fetchModelsAndEmbeddings(profile){
		try{
			const rsp = ensureServiceResponse(await fetchProviderModels({
				providerType: profile.providerType,
				apiKey: profile.apiKey,
				baseUrl: profile.baseUrl,
				providerOptions: profile.providerOptions || {},
			}), '拉取模型列表失败');
			const result = rsp && rsp.Result ? rsp.Result : {};
			const normalized = normalizeProviderResultModels(result, profile.providerType, false);
			const saved = await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, {
				...profile,
				updatedAt: new Date().toISOString(),
				protocolFamily: getProviderProtocolFamily(profile.providerType),
				availableModels: normalized.models,
				chatModelIds: uniqueTextList((profile.chatModelIds || []).concat(normalized.chatModels)),
				embeddingModelIds: uniqueTextList((profile.embeddingModelIds || []).concat(normalized.embeddingModels)),
			}, 'provider');
			setProviderProfiles((prev)=>sortByUpdatedDesc(prev.map((item)=>item.id === saved.id ? saved : item)));
			message.success(`已拉取 ${normalized.chatModels.length} 个聊天模型${normalized.embeddingModels.length ? `，${normalized.embeddingModels.length} 个 Embedding 模型` : ''}`);
		}catch(e){
			message.error(e && e.message ? `拉取模型列表失败：${e.message}` : '拉取模型列表失败');
		}
	}

	async function runProviderDiagnostics(profile){
		try{
			const rsp = ensureServiceResponse(await diagnoseProvider({
				providerType: profile.providerType,
				apiKey: profile.apiKey,
				baseUrl: profile.baseUrl,
				providerOptions: profile.providerOptions || {},
			}), '连接诊断失败');
			const diagnostics = rsp && rsp.Result ? rsp.Result : null;
			const saved = await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, {
				...profile,
				updatedAt: new Date().toISOString(),
				lastDiagnostics: diagnostics,
				healthStatus: diagnostics && diagnostics.healthy ? 'healthy' : 'error',
			}, 'provider');
			setProviderProfiles((prev)=>sortByUpdatedDesc(prev.map((item)=>item.id === saved.id ? saved : item)));
			if(diagnostics && diagnostics.healthy){
				message.success(`连接测试成功${diagnostics.latencyMs ? ` · ${diagnostics.latencyMs}ms` : ''}`);
			}else{
				message.warning(`连接测试完成：${diagnostics && (diagnostics.failureReason || diagnostics.errorDetail || '请检查配置')}`);
			}
		}catch(e){
			message.error(e && e.message ? `连接诊断失败：${e.message}` : '连接诊断失败');
		}
	}

	async function testProfileChat(profile, preferredModel){
		const chatModels = normalizeProfileChatModels(profile);
		const model = `${preferredModel || ''}`.trim() || chatModels[0] || '';
		if(!model){
			message.warning('该配置还没有可用的对话模型，请在「配置 API」→「聊天模型列表」中填写（如 gemini-2.5-flash），或点「拉取模型」自动获取');
			return;
		}
		// [Q-005/M-06] 指纹取**被测的**接口::模型(此前取当前选择 modelSelection → 在接口列表里测 B,
		// chip 却按当前选择 A 的键落绿/落红 = 显示「A 测试成功」而实际测的是 B)。renderConnChip 仍只在
		// 指纹 === 当前选择时显示,故测别的接口不再污染当前 chip。
		const connKey = encodeModelSelection(profile.id, model);
		setConnState({ key: connKey, status: 'testing' });
		const startMs = Date.now();
		try{
			const rsp = ensureServiceResponse(await requestAIAnalysisChat({
				providerType: profile.providerType,
				apiKey: profile.apiKey,
				baseUrl: profile.baseUrl,
				model,
				providerOptions: profile.providerOptions || {},
				messages: [
					{
						role: 'user',
						content: '请仅回复“连接成功”。',
					},
				],
			}), '测试连接失败');
			const text = rsp && rsp.Result && rsp.Result.content ? rsp.Result.content : '';
			const latencyMs = Date.now() - startMs;
			message.success(text ? `测试成功：${text.slice(0, 24)}` : '测试成功');
			setConnState({ key: connKey, status: 'healthy', latencyMs });
		}catch(e){
			// v2.2.1 (Mac #8):后端错误是 URL 编码的原始串,直接抛给用户既看不懂又吓人。
			// 解码 + 对「未登录/未配置凭据」的 401 给出可操作的提示,而不是裸 401 dump。
			let raw = e && e.message ? e.message : '';
			try{ raw = decodeURIComponent(raw); }catch(_){ /* keep raw */ }
			const latencyMs = Date.now() - startMs;
			const classified = classifyStreamError(raw);
			if(/No cookie auth credentials|need\.login|401|Unauthorized/i.test(raw)){
				message.error('未检测到有效凭据：使用内置 AI 需先登录 horosa 账号；若使用自己的供应商，请在「配置 API」中填入正确的 Key 与 Base URL 后重试。');
			}else{
				message.error(raw ? `测试连接失败：${raw.slice(0, 200)}` : '测试连接失败');
			}
			setConnState({ key: connKey, status: 'error', latencyMs, error: { ...classified, raw } });
		}
	}

	// [Q-009/M-09] 一条 assistant 消息里「已完成且未撤销」的写入动作条数(0=纯问答,无需提示)
	function countUndoableActions(msg){
		const t = msg && msg.agentTrace;
		if(!t || !Array.isArray(t.rounds)){ return 0; }
		let n = 0;
		t.rounds.forEach((r)=>{
			(r && Array.isArray(r.results) ? r.results : []).forEach((x)=>{
				if(x && x.status === 'completed' && x.undo && x.undo.actionId && !x.undone){ n += 1; }
			});
		});
		return n;
	}

	async function handleRegenerateLastReply(){
		const { profileId, model } = parseModelSelection(modelSelection || encodeModelSelection(activeConversation && activeConversation.providerProfileId, activeConversation && activeConversation.model));
		const profile = providerProfiles.find((item)=>item.id === profileId);
		if(!activeConversation || !profile || !model){
			message.warning('请先选择一段对话和模型');
			return;
		}
		const list = await listConversationMessages(activeConversation.id);
		let trimmedList = list.slice(0);
		if(trimmedList.length && trimmedList[trimmedList.length - 1].role === 'assistant'){
			// [Q-009/M-09] 被删的回复若带已完成的写入动作:删掉气泡后那几条动作的「撤销」入口就没了
			//   (账本面板仍能撤,但用户在气泡上找不到)。重生成本身不撤销任何动作 → 先说清楚再删。
			const pending = countUndoableActions(trimmedList[trimmedList.length - 1]);
			if(pending > 0){
				const go = await asyncConfirm({
					title: '这条回复里有已执行的动作',
					content: `该回复执行了 ${pending} 个可撤销的写入动作。重新生成只会删掉这条回复,**不会**撤销这些动作(仍可在「动作账本」里逐条撤销)。继续?`,
					okText: '继续重新生成',
					cancelText: '取消',
				});
				if(!go){ return; }
			}
			const removed = trimmedList.pop();
			await deleteStoreRecord(AI_ANALYSIS_STORES.messages, removed.id);
			setMessages(trimmedList);
		}
		const lastUser = [...trimmedList].reverse().find((item)=>item.role === 'user');
		if(!lastUser){
			message.warning('没有可重新生成的用户提问');
			return;
		}
		if(isInsideCompactRegion(activeConversation, lastUser)){ return; }   // [Q-030/M-41]
		if(sending || sendingRef.current){ return; }   // [Q-008/M-08] 与首发同形的重入闸
		sendingRef.current = true;
		setSending(true);
		const regenAbort = beginSendAbort();   // [Q-035/M-46]
		try{
			const promptResult = await buildResolvedPrompt(lastUser.content || '', profile, lastUser.extraSystemContext);   // [Q-029/M-40] 还原附加上下文
			if(prepAborted(regenAbort)){ return; }
			// [Q-046/M-57] 重答用的是**当前**选的接口/模型,会话记录却还写着原来那套 —— 顶栏与历史列表显示的
			// 「这条对话用的模型」和实际所发不一致(与 Q-036 编辑并分支同一类)。差了才写,没换=零写入。
			let regenConversation = activeConversation;
			if(activeConversation && (activeConversation.model !== model || activeConversation.providerProfileId !== (profile ? profile.id : ''))){
				regenConversation = await updateConversationMeta(activeConversation, {
					providerProfileId: profile ? profile.id : '',
					providerName: profile ? profile.name : '',
					providerType: profile ? profile.providerType : '',
					model,
				}) || activeConversation;
			}
			await streamReply({
				conversation: regenConversation,
				profile,
				model,
				controller: regenAbort,
				chatMessages: [
					{ role: 'system', content: promptResult.systemPrompt },
				].concat(chatAssist.mainline(trimmedList).map((item)=>({
					role: item.role,
					content: historyContentOf(item),   // [C5] 历史只带采用稿
					// 与首发路径同形:重生成/编辑分支曾丢 images → 多模态输入被静默剥离,
					// 模型对着空文本谈图(用户只觉得「重答就变傻」)。
					images: Array.isArray(item.images) && item.images.length ? item.images : undefined,
					agentTrace: item.agentTrace,
				}))),
			});
		}catch(e){
			console.error(e);
			message.error('重新生成失败');
		}finally{
			sendingRef.current = false;
			setSending(false);
		}
	}

	// A: 复制该条消息全文(copyTextSmart:桌面原生 → navigator.clipboard → execCommand 三级)。
	function handleCopyMessage(item){
		const text = item && item.content ? `${item.content}` : '';
		if(!text){ return; }
		copyTextSmart(text).then((ok)=>{
			if(ok){ message.success('已复制全文'); }
			else{ message.error('复制失败，请手动选择文本复制'); }
		});
	}

	// A: 重新生成「任意一条」AI 回复——删除该条及其之后的所有消息,以它之前最近的用户提问重答。
	// (不能像 handleRegenerateLastReply 那样硬 pop 末条,否则点中间某条会误删真正的末条。)
	async function handleRegenerateMessage(targetMessage){
		if(!targetMessage || targetMessage.role !== 'assistant'){ return; }
		const { profileId, model } = parseModelSelection(modelSelection || encodeModelSelection(activeConversation && activeConversation.providerProfileId, activeConversation && activeConversation.model));
		const profile = providerProfiles.find((item)=>item.id === profileId);
		if(!activeConversation || !profile || !model){
			message.warning('请先选择一段对话和模型');
			return;
		}
		const list = await listConversationMessages(activeConversation.id);
		const idx = list.findIndex((item)=>item.id === targetMessage.id);
		if(idx < 0){ return; }
		const keep = list.slice(0, idx);
		const removeList = list.slice(idx);
		await Promise.all(removeList.map((m)=>deleteStoreRecord(AI_ANALYSIS_STORES.messages, m.id)));
		// [Q-048⑦ 裁决 2026-09-18] 重答删掉「按审阅重写稿」后,原回答的 supersededBy 曾悬空(主线继续过滤它、批注仍写「见下方新回答」)→ 指向已删消息的标记一并清掉
		try{
			const removedIds = new Set(removeList.map((m)=>m.id));
			const dangling = (messages || []).filter((m)=>m && m.supersededBy && removedIds.has(m.supersededBy) && !removedIds.has(m.id));
			for(const dm of dangling){
				// eslint-disable-next-line no-await-in-loop
				await updateStoreRecordIf(AI_ANALYSIS_STORES.messages, dm.id, ()=>true, (rec)=>({ ...rec, supersededBy: undefined }));
			}
			if(dangling.length){ setMessages((prev)=>prev.map((m)=>(m && m.supersededBy && removedIds.has(m.supersededBy) ? { ...m, supersededBy: undefined } : m))); }
		}catch(e){ /* 清标记失败不阻断重答 */ }
		setMessages(keep);
		const lastUser = [...keep].reverse().find((item)=>item.role === 'user');
		if(!lastUser){
			message.warning('没有可重新生成的用户提问');
			return;
		}
		if(isInsideCompactRegion(activeConversation, lastUser)){ return; }   // [Q-030/M-41]
		if(sending || sendingRef.current){ return; }   // [Q-008/M-08]
		sendingRef.current = true;
		setSending(true);
		const retryAbort = beginSendAbort();   // [Q-035/M-46]
		try{
			const promptResult = await buildResolvedPrompt(lastUser.content || '', profile, lastUser.extraSystemContext);   // [Q-029/M-40]
			if(prepAborted(retryAbort)){ return; }
			await streamReply({
				conversation: activeConversation,
				profile,
				model,
				controller: retryAbort,
				chatMessages: [
					{ role: 'system', content: promptResult.systemPrompt },
				].concat(chatAssist.mainline(keep).map((item)=>({
					role: item.role,
					content: historyContentOf(item),   // [C5] 历史只带采用稿
					// 与首发路径同形:重生成/编辑分支曾丢 images → 多模态输入被静默剥离,
					// 模型对着空文本谈图(用户只觉得「重答就变傻」)。
					images: Array.isArray(item.images) && item.images.length ? item.images : undefined,
					agentTrace: item.agentTrace,
				}))),
			});
		}catch(e){
			console.error(e);
			message.error('重新生成失败');
		}finally{
			sendingRef.current = false;
			setSending(false);
		}
	}

	// B3:把「起课时间 / 命盘时间」快速草稿保存为正式 事盘 / 命盘(进案例列表复用),保存后自动选中。
	function handleSaveQuickDraftAsSource(){
		const isNatal = selectedSourceId === NATAL_SOURCE_ID;
		const draft = isNatal ? natalDraft : timepointDraft;
		try{
			let saved;
			if(isNatal){
				saved = upsertLocalChart(markFieldsCaptured({   // [Q-256/T-219]
					name: draft.name || '命盘时间',
					birth: draft.birth,
					zone: draft.zone,
					lat: draft.lat,
					lon: draft.lon,
					gpsLat: draft.gpsLat,
					gpsLon: draft.gpsLon,
					gender: draft.gender,
				}));
			}else{
				saved = upsertLocalCase({
					event: draft.name || '起课时间',
					divTime: draft.divTime,
					zone: draft.zone,
					lat: draft.lat,
					lon: draft.lon,
					gpsLat: draft.gpsLat,
					gpsLon: draft.gpsLon,
					sourceModule: 'sanshiunited',
				});
			}
			setSources(listAnalysisSources());
			if(saved && saved.cid){
				setSelectedSourceId(saved.cid);
			}
			message.success(isNatal ? '已保存为命盘并选中' : '已保存为事盘并选中');
		}catch(e){
			console.error(e);
			message.error('保存失败');
		}
	}

	// 编辑「指定」用户消息并基于此创建分支（2D：任意用户消息可编辑重发，不止最后一条）。
	async function handleEditMessageAndBranch(targetMessage){
		if(!activeConversation){
			message.warning('请先打开一段对话');
			return;
		}
		if(!targetMessage || targetMessage.role !== 'user'){
			return;
		}
		const list = await listConversationMessages(activeConversation.id);
		const targetIndex = list.findIndex((item)=>item.id === targetMessage.id);
		if(targetIndex < 0){
			message.warning('没有找到该用户消息');
			return;
		}
		const targetUser = list[targetIndex];
		const nextText = await asyncInput({ title: '编辑该用户消息并基于此分支', defaultValue: targetUser.content || '', placeholder: '修改后回车发送，或点确定', multiline: true });
		if(nextText === null){
			return;
		}
		const trimmed = `${nextText || ''}`.trim();
		if(!trimmed){
			return;
		}
		const { profileId, model } = parseModelSelection(modelSelection || encodeModelSelection(activeConversation.providerProfileId, activeConversation.model));
		const profile = providerProfiles.find((item)=>item.id === profileId);
		if(!profile || !model){
			message.warning('请先选择模型');
			return;
		}
		if(sending || sendingRef.current){ message.warning('正在生成中,请稍后再分支'); return; }   // [Q-008/M-08]
		const branchConversation = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
			...activeConversation,
			// [Q-030/M-41] 分支按分支点裁压缩:分支点(被编辑的问题)在压缩区内 → 分支不继承 compact(否则主线把编辑后的问题滤掉,请求无 user 消息)
			...(compactCoversMessage(activeConversation.compact, targetUser) ? { compact: undefined } : {}),
			// [Q-036/M-44] 分支会话记录写**本次实际所用**的接口/模型:此前继承原会话记录,而请求用的是当前选择 →
			//   openConversation 把界面改回原会话模型 = 「所见≠所发」(用户以为换了模型重问,顶栏显示的却是旧模型)。
			providerProfileId: profile.id,
			providerName: profile.name || '',
			providerType: profile.providerType,
			model,
			id: null,
			title: `${activeConversation.title || '未命名对话'}（分支）`,
			parentConversationId: activeConversation.id,
			branchRootId: activeConversation.branchRootId || activeConversation.id,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}, 'conv');
		// 🔴 前缀消息必须 id:null(与「分支」同形):沿用原 id 会被 IDB 同键覆盖搬进分支,原会话只剩编辑点之后的消息(M-34)
		const branchMessages = buildEditBranchMessages(list, targetIndex, targetUser, trimmed, branchConversation.id);
		await replaceConversationMessages(branchConversation.id, branchMessages);
		setConversations((prev)=>sortByUpdatedDesc([branchConversation].concat(prev)));
		await openConversation(branchConversation);
		sendingRef.current = true;
		setSending(true);
		const branchAbort = beginSendAbort();   // [Q-035/M-46]
		try{
			const promptResult = await buildResolvedPrompt(trimmed, profile, targetUser.extraSystemContext);   // [Q-029/M-40]
			if(prepAborted(branchAbort)){ return; }
			await streamReply({
				conversation: branchConversation,
				profile,
				model,
				controller: branchAbort,
				chatMessages: [
					{ role: 'system', content: promptResult.systemPrompt },
				].concat(chatAssist.mainline(branchMessages).map((item)=>({
					role: item.role,
					content: historyContentOf(item),   // [C5] 历史只带采用稿
					// 与首发路径同形:重生成/编辑分支曾丢 images → 多模态输入被静默剥离,
					// 模型对着空文本谈图(用户只觉得「重答就变傻」)。
					images: Array.isArray(item.images) && item.images.length ? item.images : undefined,
					agentTrace: item.agentTrace,
				}))),
			});
			message.success('已基于编辑创建分支对话');
		}catch(e){
			message.error('分支对话生成失败');
		}finally{
			sendingRef.current = false;
			setSending(false);
		}
	}

	// 「编辑上一条并分支」工具条入口：定位最后一条用户消息，委托给 handleEditMessageAndBranch。
	async function handleEditLastUserAndBranch(){
		if(!activeConversation){
			message.warning('请先打开一段对话');
			return;
		}
		const list = await listConversationMessages(activeConversation.id);
		let lastUser = null;
		for(let i=list.length - 1; i>=0; i--){
			if(list[i].role === 'user'){
				lastUser = list[i];
				break;
			}
		}
		if(!lastUser){
			message.warning('没有找到上一条用户消息');
			return;
		}
		await handleEditMessageAndBranch(lastUser);
	}

	async function handleBranchFromMessage(messageRecord){
		if(!activeConversation || !messageRecord){
			return;
		}
		const list = await listConversationMessages(activeConversation.id);
		const idx = list.findIndex((item)=>item.id === messageRecord.id);
		if(idx < 0){
			return;
		}
		const branchConversation = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
			...activeConversation,
			// [Q-030/M-41] 分支点在压缩区内 → 不继承 compact(同编辑分支)
			...(compactCoversMessage(activeConversation.compact, messageRecord) ? { compact: undefined } : {}),
			id: null,
			title: `${activeConversation.title || '未命名对话'}（分支）`,
			parentConversationId: activeConversation.id,
			branchRootId: activeConversation.branchRootId || activeConversation.id,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}, 'conv');
		const copiedMessages = buildForkMessages(list, idx, branchConversation.id);
		await replaceConversationMessages(branchConversation.id, copiedMessages);
		setConversations((prev)=>sortByUpdatedDesc([branchConversation].concat(prev)));
		await openConversation(branchConversation);
		message.success('已从该轮次创建分支');
		// [Q-048③ 裁决 2026-09-18·维持现状+补提示] 分支拷贝带 agentTrace 的气泡 → 两会话指向同一批动作账本(设计如此);明说撤销互相影响
		try{
			if((messages || []).some((m)=>m && m.agentTrace && Array.isArray(m.agentTrace.rounds) && m.agentTrace.rounds.some((rd)=>rd && Array.isArray(rd.results) && rd.results.length))){
				message.info('分支与原对话共享同一批动作账本：在任一边撤销 / 回退，另一边的气泡与写入也会受影响', 6);
			}
		}catch(e){ /* 提示失败不影响分支 */ }
	}

	function renderConnChip(){
		const profile = activeProviderProfile;
		// C: chip 只反映「当前选择」下的测试结果(connState.key === 当前 modelSelection 才算数),
		// 切模型/接口后 key 失配 → 回灰「点击测试」;不读 profile.healthStatus(那是历史诊断,会残留过期的绿)。
		const tested = (connState.key && connState.key === modelSelection) ? connState.status : 'idle';
		let toneClass = styles.connIdle;
		let text = '点击测试';
		if(!profile){
			toneClass = styles.connIdle;
			text = '未配置接口';
		}else if(tested === 'testing'){
			toneClass = styles.connIdle;
			text = '测试中…';
		}else if(tested === 'healthy'){
			toneClass = styles.connOk;
			text = connState.latencyMs ? `测试成功 · ${connState.latencyMs}ms` : '测试成功';
		}else if(tested === 'error'){
			toneClass = styles.connErr;
			text = '测试失败';
		}
		const tip = !profile ? '尚未配置接口，点击去配置' :
			tested === 'error' && connState.error ? (
				<div style={{ maxWidth: 320 }}>
					<div style={{ fontWeight: 600, marginBottom: 4 }}>{connState.error.hint}</div>
					<div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', wordBreak: 'break-word' }}>{connState.error.raw || connState.error.message}</div>
					{connState.latencyMs ? <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>耗时 {connState.latencyMs}ms</div> : null}
				</div>
			) : (tested === 'healthy' && connState.latencyMs ? `连通性测试 · ${connState.latencyMs}ms` : '点击测试与该接口的连通性');
		return (
			<Tooltip title={tip} mouseEnterDelay={0.3} placement="bottom">
				<button
					type="button"
					className={`${styles.connChip} ${toneClass}`}
					onClick={()=>{
						if(!profile){ openProviderEditor(null); return; }
						testProfileChat(profile, parseModelSelection(modelSelection).model);
					}}
				>
					<span className={styles.connDot} />
					<span>{text}</span>
				</button>
			</Tooltip>
		);
	}

	// ===== AI 挂载「每技法设置」抽屉：纳入内容(共用 AI导出 sections) + 该技法排盘/起卦设置 =====

	function openTechniqueSettings(key){
		const k = `${key || ''}`;
		if(!k){
			return;
		}
		// [V6-W1] 🔴 草稿初值 = schema 默认 叠加 **盘现状**(record 实值) 叠加 当前生效覆盖。
		// 此前只叠 schema 默认 → 抽屉打开恒显 schema 想象值(整宫制)而非盘实值(Alcabitus),
		// 用户「确认整宫制」=零变更=静默无操作(实锤二次误导)。现在:打开即见真实现状,
		// 改动=与盘的真实差异(prune 同锚盘现状)。
		const base = getTechniqueSettingsDefaults(k);
		const chartBaseline = effectiveMountBaseline(k, activeSource && activeSource.record ? activeSource.record : null);
		const session = techniqueOptionOverrides[k];
		const eff = (session && typeof session === 'object') ? session : getMountTechniqueDefault(k);
		setTechniqueSettingsKey(k);
		setTechniqueSettingsDraft({ ...base, ...chartBaseline, ...(eff || {}) });
	}

	function closeTechniqueSettings(){
		setTechniqueSettingsKey('');
		setTechniqueSettingsDraft({});
	}

	function updateTechniqueDraftField(name, value){
		setTechniqueSettingsDraft((prev)=>({ ...prev, [name]: value }));
	}

	// 「应用并重算」：把草稿(去默认后)写进会话覆盖 → 触发该技法重算(状态转「已按盘重算」)。
	function applyTechniqueSettings(){
		const k = techniqueSettingsKey;
		if(!k){
			return;
		}
		// [V6-W1] prune 锚盘现状:与该盘真实值不同的项才算覆盖(整宫制 vs 盘存 Alcabitus=真覆盖)。
		const pruned = pruneOptionsToNonDefault(k, techniqueSettingsDraft, effectiveMountBaseline(k, activeSource && activeSource.record ? activeSource.record : null));
		setTechniqueOptionOverrides((prev)=>{
			const next = { ...prev };
			if(pruned && Object.keys(pruned).length){
				next[k] = pruned;
			}else{
				delete next[k];
			}
			return next;
		});
		message.success(Object.keys(pruned).length ? '已应用并按新设置重算该技法' : '已恢复该技法默认设置');
	}

	// 「设为同类默认」：持久到 mount defaults（以后该技法默认沿用）。同时清掉会话覆盖（避免双写歧义）。
	function saveTechniqueAsDefault(){
		const k = techniqueSettingsKey;
		if(!k){
			return;
		}
		// [V6 复查轮] 🔴 三参同锚盘现状:草稿自带盘现状全量后,二参(schema 默认锚)会把盘私值
		// 全判「覆盖」写进跨盘持久模板 —— 什么都不改点「设为同类默认」= 把这张盘的黄道/岁差
		// 强加给以后所有盘。同 apply 锚:只存用户本次显式改动。
		const pruned = pruneOptionsToNonDefault(k, techniqueSettingsDraft, effectiveMountBaseline(k, activeSource && activeSource.record ? activeSource.record : null));
		saveMountTechniqueDefaults(k, pruned);
		setTechniqueOptionOverrides((prev)=>{
			const next = { ...prev };
			delete next[k];
			return next;
		});
		setMountSettingsNonce((n)=>n + 1);
		message.success(Object.keys(pruned).length ? '已设为该技法的同类默认（持久）' : '已清除该技法的同类默认');
	}

	// 「恢复默认」：删会话覆盖 + 删同类默认 + 草稿回默认 → 回现状。
	function resetTechniqueSettings(){
		const k = techniqueSettingsKey;
		if(!k){
			return;
		}
		saveMountTechniqueDefaults(k, {});
		setTechniqueOptionOverrides((prev)=>{
			const next = { ...prev };
			delete next[k];
			return next;
		});
		// [V6 复查轮] 清除覆盖后的真实生效值 = 盘现状(非 schema 想象值):草稿回落
		// defaults+盘现状,否则此刻再点「应用」会把 schema 默认误写成真覆盖。
		setTechniqueSettingsDraft({
			...getTechniqueSettingsDefaults(k),
			...effectiveMountBaseline(k, activeSource && activeSource.record ? activeSource.record : null),
		});
		setMountSettingsNonce((n)=>n + 1);
		message.success('已恢复该技法默认（设置 + 同类默认均清除）');
	}

	// ---- 纳入内容（段勾选）：读写同一份 aiExport 设置 → 与「AI导出设置」四同步 ----

	function persistAIExportSettings(mutator){
		const current = loadAIExportSettings();
		const next = mutator({
			...current,
			sections: { ...(current.sections || {}) },
			planetInfo: { ...(current.planetInfo || {}) },
			astroMeaning: { ...(current.astroMeaning || {}) },
		});
		saveAIExportSettings(next);
		// 段过滤是「显式自定义才生效」→ 改完即触发挂载重新 fetch 刷新卡片。
		setMountSettingsNonce((n)=>n + 1);
	}

	function getTechExportMeta(key){
		const list = listAIExportTechniqueSettings();
		return list.find((item)=>item.key === key) || null;
	}

	function getEffectiveSectionSelected(key){
		// 当前生效段（用户选了用选中、否则 preset）。用于复选框勾选态。
		return getAIExportEffectiveSectionsForTechnique(key, loadAIExportSettings());
	}

	function toggleSectionForTech(key, section){
		const selectedNow = getEffectiveSectionSelected(key);
		const has = selectedNow.indexOf(section) >= 0;
		const nextSel = has ? selectedNow.filter((s)=>s !== section) : selectedNow.concat([section]);
		persistAIExportSettings((draft)=>{
			draft.sections[key] = nextSel;
			return draft;
		});
	}

	function selectAllSectionsForTech(key, allOptions){
		persistAIExportSettings((draft)=>{
			draft.sections[key] = (allOptions || []).slice(0);
			return draft;
		});
	}

	function clearSectionsForTech(key){
		persistAIExportSettings((draft)=>{
			draft.sections[key] = [];
			return draft;
		});
	}

	function resetSectionsForTech(key){
		// 删该 key 的段/后天/术语自定义 → 回 preset 全段(默认即现状)。
		persistAIExportSettings((draft)=>{
			delete draft.sections[key];
			delete draft.planetInfo[key];
			delete draft.astroMeaning[key];
			return draft;
		});
	}

	function togglePlanetInfoForTech(key, field, checked){
		persistAIExportSettings((draft)=>{
			const current = draft.planetInfo[key] || { showHouse: 1, showRuler: 1 };
			draft.planetInfo[key] = {
				showHouse: current.showHouse === 1 || current.showHouse === true ? 1 : 0,
				showRuler: current.showRuler === 1 || current.showRuler === true ? 1 : 0,
			};
			draft.planetInfo[key][field] = checked ? 1 : 0;
			return draft;
		});
	}

	function toggleAstroMeaningForTech(key, checked){
		persistAIExportSettings((draft)=>{
			draft.astroMeaning[key] = { enabled: checked ? 1 : 0 };
			return draft;
		});
	}

	function renderTechniqueSettingsDrawer(){
		const key = techniqueSettingsKey;
		const open = !!key;
		const label = key ? (techniqueLabelMap.get(key) || key) : '';
		const schema = key ? getTechniqueSettingsSchema(key) : null;
		const exportMeta = key ? getTechExportMeta(key) : null;
		const sectionOptions = exportMeta ? (exportMeta.options || []) : [];
		const selectedSections = key ? getEffectiveSectionSelected(key) : [];
		const planetInfo = exportMeta ? exportMeta.planetInfo : null;
		const astroMeaning = exportMeta ? exportMeta.astroMeaning : null;
		const sectionsOnly = key ? isSectionsOnlyTechnique(key) : false;
		const hasFields = key ? hasMountSettingsFields(key) : false;
		// 字段渲染(含 group 分组/条件揭示)已抽到共用件 <TechniqueSettingsFields/>(各设置界面同源)。
		// [V6 二轮复查] 徽记计数与 apply/save 同锚盘现状:二参(schema 默认锚)时草稿含盘现状
		// 会双向误导——盘存非默认什么都不动显「已自定义」、拨到 schema 默认显「全默认」而应用落真覆盖。
		const pruned = key ? pruneOptionsToNonDefault(key, techniqueSettingsDraft, effectiveMountBaseline(key, activeSource && activeSource.record ? activeSource.record : null)) : {};
		const customizedCount = Object.keys(pruned).length;
		return (
			<Drawer
				title={label ? `${label} · 挂载设置` : '挂载设置'}
				placement="right"
				width={460}
				open={open}
				onClose={closeTechniqueSettings}
				className={styles.techSettingsDrawer}
			>
				{key ? (
					<div className={styles.techSettingsBody}>
						{/* 分区一：该技法设置（A/B/C 类可调；sectionsOnly / 空 schema 显示只读说明） */}
						<XQSectionTitle>该技法设置</XQSectionTitle>
						{sectionsOnly || !schema ? (
							<div className={styles.techSettingsReadonly}>
								{schema && schema.reason ? schema.reason : '该技法快照按已存卦象/盘面生成，挂载仅可调纳入内容、不支持重算设置。'}
							</div>
						) : !hasFields ? (
							<div className={styles.techSettingsReadonly}>
								{schema.emptyHint || '该技法按本命盘默认参数生成，挂载暂只支持内容勾选。'}
							</div>
						) : (
							<div className={styles.techSettingsFields}>
								<TechniqueSettingsFields
									schemaKey={key}
									draft={techniqueSettingsDraft}
									onChange={updateTechniqueDraftField}
								/>
								<XQToolbar compact className={styles.techSettingsActions}>
									<Button size="small" type="primary" onClick={applyTechniqueSettings}>应用并重算</Button>
									<Button size="small" onClick={saveTechniqueAsDefault}>设为同类默认</Button>
									<Button size="small" onClick={resetTechniqueSettings}>恢复默认</Button>
								</XQToolbar>
								<div className={styles.techSettingsHint}>
									{customizedCount
										? `已自定义 ${customizedCount} 项；「应用并重算」在本会话内对该技法生效（换案例仍沿用），「设为同类默认」以后该技法默认沿用。`   /* [Q-406① 裁决 2026-09-18] 文案如实:覆盖随会话,不随案例清 */
										: '全部为默认值（与现状一致）；改动后点「应用并重算」让卡片快照刷新。'}
								</div>
							</div>
						)}

						{/* 分区二：纳入内容（段勾选，写同一份 AI导出设置 → 四同步） */}
						<XQSectionTitle>纳入内容</XQSectionTitle>
						{sectionOptions.length ? (
							<React.Fragment>
								<SectionChecklist
									options={sectionOptions}
									selected={selectedSections}
									groups={getSectionGroupsForTechnique(key, sectionOptions)}
									onToggle={(sec)=>toggleSectionForTech(key, sec)}
									onSelectAll={()=>selectAllSectionsForTech(key, sectionOptions)}
									onClear={()=>clearSectionsForTech(key)}
									onReset={()=>resetSectionsForTech(key)}
									toolbarClassName={styles.techSettingsActions}
									checklistClassName={styles.techSectionChecks}
									groupTitleClassName={styles.techSettingGroupTitle}
								/>
								{exportMeta && exportMeta.supportsPlanetInfo && planetInfo ? (
									<div>
										<div className={styles.techSettingGroupTitle}>星曜后天信息</div>
										<XQCheckList columns={2}>
											<XQCheckItem compact checked={planetInfo.showHouse === 1} onClick={()=>togglePlanetInfoForTech(key, 'showHouse', planetInfo.showHouse !== 1)}>显示星曜宫位</XQCheckItem>
											<XQCheckItem compact checked={planetInfo.showRuler === 1} onClick={()=>togglePlanetInfoForTech(key, 'showRuler', planetInfo.showRuler !== 1)}>显示星曜主宰宫</XQCheckItem>
										</XQCheckList>
									</div>
								) : null}
								{exportMeta && exportMeta.supportsAstroMeaning && astroMeaning ? (
									<div>
										<div className={styles.techSettingGroupTitle}>{exportMeta.astroMeaningTitle || '注释（仅AI导出）：'}</div>
										<XQCheckItem compact checked={astroMeaning.enabled === 1} onClick={()=>toggleAstroMeaningForTech(key, astroMeaning.enabled !== 1)}>
											{exportMeta.astroMeaningCheckbox || '在对应分段输出释义'}
										</XQCheckItem>
									</div>
								) : null}
								<div className={styles.techSettingsHint}>内容勾选与「AI导出设置」同源；取消某段 → 该技法挂载卡片与导出均去掉该段（默认全选＝现状）。</div>
							</React.Fragment>
						) : (
							<div className={styles.techSettingsReadonly}>该技法暂未检测到可选分段；请先在该技法完成一次排盘后再设置。</div>
						)}
					</div>
				) : null}
			</Drawer>
		);
	}

	function renderMountDrawer(){
		return (
			<Drawer
				title="挂载设置"
				placement="right"
				width={560}
				open={mountDrawerOpen}
				onClose={()=>setMountDrawerOpen(false)}
				className={styles.mountDrawer}
			>
				{activeSource && (activeSource.sourceType === 'timepoint' || selectedSourceId === NATAL_SOURCE_ID) ? (() => {
					const isNatal = selectedSourceId === NATAL_SOURCE_ID;
					const draft = isNatal ? natalDraft : timepointDraft;
					const setDraft = isNatal ? setNatalDraft : setTimepointDraft;
					const timeKey = isNatal ? 'birth' : 'divTime';
					return (
						<div className={styles.mountSection}>
							<div className={styles.qcForm}>
									<div className={styles.qcHead}>
										<XQIcon name={isNatal ? 'ai' : 'calendar'} />
										<span>{isNatal ? '命盘时间 · 即时起命盘' : '起课时间 · 即时起式盘'}</span>
									</div>
									<div className={styles.qcRow}>
										<label className={styles.qcLabel}>时间</label>
										<Input className={styles.qcInput} value={draft[timeKey]} placeholder="YYYY-MM-DD HH:mm:ss" onChange={(e)=>setDraft((prev)=>({ ...prev, [timeKey]: e.target.value }))} />
										<Button size="small" className={styles.qcNow} onClick={()=>setDraft((prev)=>({ ...prev, [timeKey]: formatTimepointNow() }))}>此刻</Button>
									</div>
									<div className={styles.qcRow}>
										<label className={styles.qcLabel}>地点</label>
										<div className={styles.qcLocWrap}>
											<GeoCoordModal lat={draft.gpsLat} lng={draft.gpsLon} date={draft[timeKey]} onOk={(geo)=>{
												const ll = gpsToLonLatStrings(geo.gpsLat, geo.gpsLng);
												let zone = (geo.zone !== undefined && geo.zone !== null) ? geo.zone : null;
												if(!zone){
													try{
														const ds = (typeof draft[timeKey] === 'string') ? draft[timeKey].slice(0, 10) : null;
														const z = dstAwareZoneAt(geo.gpsLat, geo.gpsLng, ds);
														if(z && z.offset){ zone = z.offset; }
													}catch(e){ /* 保底用旧时区 */ }
												}
												setDraft((prev)=>({ ...prev, gpsLat: geo.gpsLat, gpsLon: geo.gpsLng, lat: ll.lat, lon: ll.lon, zone: zone || prev.zone }));
											}}>
												<Button size="small" className={styles.qcLocBtn}>📍 选择地点 · atlas</Button>
											</GeoCoordModal>
											<span className={styles.qcLocInfo}>{`${AstroHelper.formatLonDms(draft.gpsLon) || draft.lon} · ${AstroHelper.formatLatDms(draft.gpsLat) || draft.lat} · UTC${draft.zone}`}</span>
										</div>
									</div>
									<div className={styles.qcRow}>
										<label className={styles.qcLabel}>微调</label>
										<div className={styles.qcInline}>
											<Input addonBefore="经" value={draft.lon} onChange={(e)=>setDraft((prev)=>({ ...prev, lon: e.target.value }))} />
											<Input addonBefore="纬" value={draft.lat} onChange={(e)=>setDraft((prev)=>({ ...prev, lat: e.target.value }))} />
											<Input addonBefore="时区" value={draft.zone} onChange={(e)=>setDraft((prev)=>({ ...prev, zone: e.target.value }))} />
										</div>
									</div>
									<div className={styles.qcRow}>
										<label className={styles.qcLabel}>{isNatal ? '姓名' : '事由'}</label>
										<div className={styles.qcInline}>
											<Input value={draft.name} placeholder="可留空" onChange={(e)=>setDraft((prev)=>({ ...prev, name: e.target.value }))} />
											<Select value={draft.gender} style={{ minWidth: 92 }} onChange={(val)=>setDraft((prev)=>({ ...prev, gender: val }))}>
												<Select.Option value={1}>男</Select.Option>
												<Select.Option value={0}>女</Select.Option>
												<Select.Option value={-1}>未知</Select.Option>
											</Select>
										</div>
									</div>
									<div className={styles.qcActions}>
										{/* 一键挂载：含六爻(无存卦则按时间起卦,见 sixyao 时间起卦路径)；排除奇门遁甲(用户考量:奇门不随一键带入,需手动勾选)。
										    六爻不进 TIME_CASTABLE_DIVINATION(保已存事盘不被时间凭空补六爻的护栏),仅在此一键集 + sixyao。 */}
										{isNatal ? null : <Button size="small" type="primary" title="含六爻(无存卦则按时间起卦)、皇极经世、太玄、荆诀、五兆、神易数、小六壬、飞宫、小成图(时间卦)；奇门遁甲不随一键加入，需手动勾选" onClick={()=>setSelectedTechniqueKeys(listAnalysisTechniqueOptions({ sourceType: 'timepoint' }).map((o)=>o.value).filter((k)=>QUICK_MOUNT_EXCLUDED_KEYS.indexOf(k) < 0))}>一键挂载全部式法</Button>}
										<Button size="small" onClick={handleSaveQuickDraftAsSource}>{isNatal ? '保存为命盘' : '保存为事盘'}</Button>
									</div>
									<div className={styles.qcHint}>{isNatal ? '默认设置即时起命盘（八字 / 紫微 / 星盘 / 各推运），可改时间·地点·时区；保存后进入案例列表复用。' : '统摄法 / 宿占 / 世俗盘 需手动起盘后存为事盘再挂载（凭时间起会得无意义默认值，不在白名单）；其余 卜卦 / 报数 / 起例 全部式法均可按起课时间即时起盘。'}</div>
								</div>
						</div>
					);
				})() : null}
				{activeSource ? (
					<div className={styles.mountSection}>
						<div className={styles.mountSectionLabel}>使用技法</div>
						<Select
							mode="multiple"
							allowClear
							value={activeTechniqueKeys}
							placeholder={`选择${activeSource.sourceType === 'chart' ? '命盘' : '事盘'}技法`}
							style={{ width: '100%' }}
							onChange={(vals)=>setSelectedTechniqueKeys(vals || [])}
						>
							{groupedTechniqueOptions.map((group)=>(
								<Select.OptGroup key={group.title} label={group.title}>
									{group.items.map((item)=>(
										<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
									))}
								</Select.OptGroup>
							))}
						</Select>
					</div>
				) : null}
				<div className={styles.mountSection}>
					<div className={styles.mountSectionLabel}>参考组合 / 资料（多选）</div>
					<Select
						mode="multiple"
						showSearch
						allowClear
						value={referenceIds}
						placeholder="选择固定资料、组合"
						style={{ width: '100%' }}
						onChange={(vals)=>setReferenceIds(vals || [])}
					>
						{referenceOptions.map((item)=>(
							<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
						))}
					</Select>
				</div>
				<div className={styles.mountSection}>
					<div className={styles.mountSectionLabel}>本轮系统提示</div>
					<TextArea
						value={sessionSystemPrompt}
						rows={3}
						placeholder="可留空；也可由组合一键带入"
						onChange={(e)=>setSessionSystemPrompt(e.target.value)}
					/>
				</div>
				<div className={styles.mountSection}>
					<div className={styles.mountSectionLabel}>本轮挂载上下文（预览）</div>
					{lockedContextItems.length === 0 ? (
						<Empty description="还没有挂载任何前提" />
					) : (
						<Collapse
							activeKey={contextActiveKeys}
							onChange={(ks)=>setContextActiveKeys(Array.isArray(ks) ? ks : [ks])}
							className={styles.contextCollapse}
						>
							{lockedContextItems.map((item)=>{
								const statusMeta = getContextStatusMeta(item.status);
								const signature = buildContextSignatureText(item.meta);
								const techKey = item.type === 'technique' && typeof item.key === 'string' && item.key.indexOf('technique:') === 0
									? item.key.slice('technique:'.length)
									: '';
								const techCustomized = !!(techKey && effectiveTechniqueOptions[techKey] && Object.keys(effectiveTechniqueOptions[techKey]).length);
								// [挂载预算] 最近一次发送的裁剪账本按层 key 对齐（案例前提层 key 在发送层里是 'source'）。
								const clipStatKey = typeof item.key === 'string' && item.key.indexOf('source:') === 0 ? 'source' : item.key;
								const clipStat = promptClipStats && promptClipStats.byKey ? promptClipStats.byKey[clipStatKey] : null;
								return (
									<Collapse.Panel
										key={item.key}
										extra={techKey ? (
											<Tooltip title="该技法挂载设置（纳入内容 / 排盘起卦选项）">
												<Button
													size="small"
													type="text"
													className={styles.contextGearBtn}
													icon={<XQIcon name="settings" />}
													onClick={(e)=>{ e.stopPropagation(); openTechniqueSettings(techKey); }}
												>
													设置{techCustomized ? ' ·已改' : ''}
												</Button>
											</Tooltip>
										) : null}
										header={(
											<div className={styles.contextPanelHeader}>
												<span className={styles.contextPanelTitle}>{item.title}</span>
												<span className={styles.contextPanelTags}>
													<Tag>{item.type}</Tag>
													<Tag color={statusMeta.color}>{statusMeta.text}</Tag>
													{techCustomized ? <Tag color="purple">已自定义</Tag> : null}
													{item.type === 'technique' && item.content && snapshotSourceMismatch(item.meta, (activeSource && activeSource.record) || null) === 'mismatch' ? (
														<Tooltip title="快照的起盘时空与当前案例不一致(可能是旧盘/他盘残留)。不会自动重算;到该技法页面按本案例重新排盘,或在「设置」里应用重算即可刷新。">
															<Tag color="gold">快照或非本盘</Tag>
														</Tooltip>
													) : null}
													{clipStat && clipStat.dropped ? (
														<Tooltip title="最近一次发送时上下文超出预算，该层整层未纳入（已在提示词里注明「未纳入」，模型不会当它不存在）。可在「进阶 → 对话上下文策略 → 挂载字数预算」里调大，或减少挂载技法、在「设置」里精简纳入内容。">
															<Tag color="red">超预算未纳入</Tag>
														</Tooltip>
													) : null}
													{clipStat && !clipStat.dropped && clipStat.clipped ? (
														<Tooltip title="最近一次发送时上下文超出预算，该层按段边界公平裁剪后纳入（结尾注明了略去哪几段）。想要全文，可在「进阶 → 对话上下文策略 → 挂载字数预算」里调大。">
															<Tag color="orange">已裁剪 {clipStat.raw}→{clipStat.kept}字</Tag>
														</Tooltip>
													) : null}
												</span>
												{signature ? <span className={styles.contextPanelSig}>{signature}</span> : null}
											</div>
										)}
									>
										{item.content
											? <div className={styles.contextBody}>{item.content}</div>
											: <div className={styles.contextEmptyHint}>{item.emptyHint || '暂无内容'}</div>}
									</Collapse.Panel>
								);
							})}
						</Collapse>
					)}
				</div>
			</Drawer>
		);
	}

	// 挂载状态条：紧跟在 composer 上方显示，让用户随时看到「当前要发什么」。
	function renderContextBanner(){
		const tCnt = activeTechniqueKeys ? activeTechniqueKeys.length : 0;
		const refCnt = referenceIds ? referenceIds.length : 0;
		if(!activeSource){
			return (
				<div className={styles.contextBanner + ' ' + styles.contextBannerEmpty}>
					未挂载案例 · <a onClick={focusSourceSelect}>选择案例</a>{/* [Q-041] 直接开顶栏那个下拉,不再打开没有案例选择器的挂载抽屉 */}
				</div>
			);
		}
		return (
			<div className={styles.contextBanner}>
				<span className={styles.contextBannerLabel}>当前挂载：</span>
				<span className={styles.contextBannerItem} title={activeSource.title}>{activeSource.sourceType === 'chart' ? '📊' : '📋'} {activeSource.title}</span>
				{tCnt > 0 ? <span className={styles.contextBannerItem}>🧮 {tCnt} 技法</span> : null}
				{refCnt > 0 ? <span className={styles.contextBannerItem}>📚 {refCnt} 资料/组合</span> : null}
				{promptClipStats && promptClipStats.stats ? (
					<span
						className={styles.contextBannerItem}
						title={`最近一次发送给模型的上下文字数 / 预算上限（预算按当前模型的上下文窗口实算；可在「进阶 → 对话上下文策略 → 挂载字数预算」里固定）${promptClipStats.stats.droppedCount ? `；有 ${promptClipStats.stats.droppedCount} 层超预算未纳入（见挂载预览）` : ''}`}
					>
						上下文约 {promptClipStats.stats.totalKept}/{promptClipStats.stats.maxChars || AI_CONTEXT_MAX_CHARS} 字
					</span>
				) : null}
				<a className={styles.contextBannerEdit} onClick={()=>setMountDrawerOpen(true)}>编辑</a>
			</div>
		);
	}

	// 模板版本 diff：line-level Myers/LCS（小快简单实现，超过 1500 行截断）。
	function diffLines(a, b){
		const aLines = (a || '').split('\n').slice(0, 1500);
		const bLines = (b || '').split('\n').slice(0, 1500);
		const m = aLines.length, n = bLines.length;
		const dp = Array.from({ length: m + 1 }, ()=>new Uint16Array(n + 1));
		for(let i = 1; i <= m; i++){
			for(let j = 1; j <= n; j++){
				dp[i][j] = aLines[i - 1] === bLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
		const out = [];
		let i = m, j = n;
		while(i > 0 && j > 0){
			if(aLines[i - 1] === bLines[j - 1]){ out.push({ t: 'eq', a: aLines[i - 1] }); i--; j--; }
			else if(dp[i - 1][j] >= dp[i][j - 1]){ out.push({ t: 'del', a: aLines[i - 1] }); i--; }
			else { out.push({ t: 'add', a: bLines[j - 1] }); j--; }
		}
		while(i > 0){ out.push({ t: 'del', a: aLines[--i] }); }
		while(j > 0){ out.push({ t: 'add', a: bLines[--j] }); }
		return out.reverse();
	}
	function renderTemplateVersionDiff(){
		if(!versionDiffState) return null;
		const { template, leftId, rightId } = versionDiffState;
		if(!template) return <Empty description="模板已不存在" />;
		const allVs = templateVersions.filter((v)=>v.templateId === template.id).sort((a,b)=>(b.versionNumber||0)-(a.versionNumber||0));
		if(allVs.length < 2) return <Empty description="该模板版本不足两个，无法对比" />;
		const left = allVs.find((v)=>v.id === leftId) || allVs[1];
		const right = allVs.find((v)=>v.id === rightId) || allVs[0];
		const snapText = (v)=>{
			if(!v) return '';
			const s = v.snapshot || {};
			return JSON.stringify({
				format: s.format, instructionText: s.instructionText, jsonSchema: s.jsonSchema,
				exampleInput: s.exampleInput, exampleOutput: s.exampleOutput,
			}, null, 2);
		};
		const leftText = snapText(left);
		const rightText = snapText(right);
		const diff = diffLines(leftText, rightText);
		return (
			<div>
				<div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
					<span>选版本：</span>
					<Select size="small" value={leftId} style={{ width: 120 }} onChange={(v)=>setVersionDiffState((s)=>({ ...s, leftId: v }))}>
						{allVs.map((v)=><Select.Option key={v.id} value={v.id}>V{v.versionNumber}</Select.Option>)}
					</Select>
					<span style={{ color: 'var(--horosa-text-soft)' }}>→</span>
					<Select size="small" value={rightId} style={{ width: 120 }} onChange={(v)=>setVersionDiffState((s)=>({ ...s, rightId: v }))}>
						{allVs.map((v)=><Select.Option key={v.id} value={v.id}>V{v.versionNumber}</Select.Option>)}
					</Select>
					<span style={{ color: 'var(--horosa-text-soft)', fontSize: 12 }}>共 {diff.length} 行变更，增 {diff.filter((d)=>d.t==='add').length} / 删 {diff.filter((d)=>d.t==='del').length} / 同 {diff.filter((d)=>d.t==='eq').length}</span>
				</div>
				<div className={styles.templateDiffWrap}>
					<div className={styles.templateDiffCol}>
						<h4>V{(left && left.versionNumber) || '?'}</h4>
						<div className={styles.templateDiffBox}>
							{diff.filter((d)=>d.t !== 'add').map((d, i)=>(
								<div key={i} className={d.t === 'del' ? styles.templateDiffDel : ''}>{d.a || ' '}</div>
							))}
						</div>
					</div>
					<div className={styles.templateDiffCol}>
						<h4>V{(right && right.versionNumber) || '?'}</h4>
						<div className={styles.templateDiffBox}>
							{diff.filter((d)=>d.t !== 'del').map((d, i)=>(
								<div key={i} className={d.t === 'add' ? styles.templateDiffAdd : ''}>{d.a || ' '}</div>
							))}
						</div>
					</div>
				</div>
			</div>
		);
	}

	// 落地页示例提问 chip：按 source 类型动态。点击只填入 prompt，不自动发送。
	function renderLandingExamples(){
		const sourceKey = activeSource ? `${activeSource.sourceType}:${activeSource.id}` : 'none';
		const sel = parseModelSelection(modelSelection || '');
		const fetchKey = `${sourceKey}::${activeProviderProfile ? `${activeProviderProfile.id || ''}-${sel.model || ''}` : ''}`;
		const ai = aiExamplePromptsBySource[fetchKey];
		const staticExamples = activeSource && activeSource.sourceType === 'case'
			? ['这张事盘的吉凶判断', '应期与方位提示', '用神/格局分析']
			: activeSource
				? ['分析这张命盘的财运', '解读流年运势走向', '婚恋与配偶宫剖析']
				: ['先帮我说明这套AI分析的用法', '介绍一下星阙都支持哪些术数', '我想分析命盘，下一步该怎么做'];
		const examples = (ai && ai.length) ? ai : staticExamples;
		return (
			<div className={styles.landingExamples}>
				{examples.map((txt)=>(
					<Tag key={txt} className={styles.landingExampleChip} onClick={()=>handleExampleClick(txt)}>{txt}</Tag>
				))}
				{aiExamplesLoading && !ai ? (
					<span className={styles.landingExamplesHint}>AI 生成示例中…</span>
				) : (ai ? (
					<span className={styles.landingExamplesHint}>· AI 根据案例生成</span>
				) : null)}
			</div>
		);
	}

	// 主流 Chat 式气泡输入：空态居中、活动态停靠底部，两处共用同一气泡。
	function renderComposer(){
		const canSend = !sending && (!!`${prompt || ''}`.trim() || pendingImages.length > 0);
		const onDragOver = (e)=>{
			if(e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0){
				e.preventDefault();
				setComposerDragOver(true);
			}
		};
		const onDragLeave = (e)=>{
			if(e.target === e.currentTarget){ setComposerDragOver(false); }
		};
		const onDrop = (e)=>{
			e.preventDefault();
			setComposerDragOver(false);
			const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter((f)=>/^image\//.test(f.type || ''));
			if(files.length){ handlePickImages(files); }
		};
		const onPaste = (e)=>{
			const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
			const files = items.filter((it)=>it.kind === 'file' && /^image\//.test(it.type)).map((it)=>it.getAsFile()).filter(Boolean);
			if(files.length){ handlePickImages(files); /* 不阻止默认：让文本粘贴照常 */ }
		};
		return (
			<div
				className={[styles.composerBubble, composerDragOver ? styles.composerBubbleDragOver : ''].filter(Boolean).join(' ')}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
				onPaste={onPaste}
			>
				{chatAssist.statusBarNode}
				<ComposerAssist {...chatAssist.composer} />
				<TextArea
					value={prompt}
					autoSize={{ minRows: 1, maxRows: 8 }}
					bordered={false}
					className={styles.composerInput}
					placeholder="输入你的分析问题…会自动带上案例、资料、组合与模版约束（可拖拽/粘贴图片）"
					onChange={(e)=>setPrompt(e.target.value)}
					onPressEnter={(e)=>{
						if(!e.shiftKey){
							e.preventDefault();
							if(!sending){
								handleSend();
							}else if(chatAssist.canSteer){
								chatAssist.steer();   // [批二⑤] 生成中回车 = 插话
							}
						}
					}}
				/>
				{pendingImages.length ? (
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 4px' }}>
						{pendingImages.map((img, idx)=>(
							<div key={idx} style={{ position: 'relative' }}>
								<img src={img.url} alt={img.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--horosa-border, #d9d9d9)' }} />
								<span onClick={()=>setPendingImages((prev)=>prev.filter((_, i)=>i !== idx))} style={{ position: 'absolute', top: -6, right: -6, cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '50%', width: 16, height: 16, lineHeight: '16px', textAlign: 'center', fontSize: 11 }}>×</span>
							</div>
						))}
					</div>
				) : null}
				<div className={styles.composerBar}>
					<Space size={2} className={styles.composerTools}>
						<Tooltip title="新对话"><Button size="small" type="text" icon={<XQIcon name="plus" />} onClick={resetConversationDraft} /></Tooltip>
						<Tooltip title="重新生成"><Button size="small" type="text" icon={<XQIcon name="sync" />} onClick={handleRegenerateLastReply} disabled={!activeConversation || sending} /></Tooltip>
						<Tooltip title="编辑上一条并分支"><Button size="small" type="text" icon={<XQIcon name="edit" />} onClick={handleEditLastUserAndBranch} disabled={!activeConversation || sending} /></Tooltip>
						<Tooltip title="刷新案例"><Button size="small" type="text" icon={<XQIcon name="refresh" />} onClick={()=>setSources(listAnalysisSources({ force: true }))} /></Tooltip>
						<Tooltip title="添加图片（多媒体输入，仅视觉模型有效）"><Button size="small" type="text" icon={<XQIcon name="import" />} onClick={()=>{ if(imageInputRef.current){ imageInputRef.current.click(); } }} disabled={sending} /></Tooltip>
						<input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e)=>{ handlePickImages(e.target.files); e.target.value = ''; }} />
						{sending ? <Tooltip title="停止生成"><Button size="small" type="text" danger icon={<XQIcon name="stop" />} onClick={handleStopStreaming} /></Tooltip> : null}
					</Space>
					<div className={styles.composerSend}>
						<Text type="secondary" className={styles.composerHint}>Enter 发送 · Shift+Enter 换行</Text>
						<Button type="primary" shape="circle" icon={<XQIcon name="send" />} loading={sending} disabled={!canSend} onClick={()=>handleSend()} />
					</div>
				</div>
			</div>
		);
	}

	function renderAnalysisPane(){
		return (
			<div className={styles.paneShell}>
				<div className={styles.paneHeader}>
					<div className={styles.topBar}>
						<div className={styles.topGroup}>
							<Select
								showSearch
								value={modelSelection || undefined}
								placeholder="选择模型"
								className={styles.modelSelect}
								optionFilterProp="children"
								onChange={(val)=>setModelSelection(val || '')}
							>
								{modelOptions.map((item)=>(
									<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
								))}
							</Select>
							<Dropdown
								trigger={['click']}
								placement="bottomLeft"
								menu={{
									items: [
										{ key: 'edit', label: '配置当前接口' },
										{ key: 'fetch', label: '拉取模型', disabled: !activeProviderProfile },
										{ key: 'switch', label: '切换生效接口' },
										{ type: 'divider' },
										{ key: 'manage', label: '管理全部接口…' },
									],
									onClick: ({ key })=>{
										if(key === 'edit'){ openProviderEditor(activeProviderProfile || null); }
										else if(key === 'fetch'){ if(activeProviderProfile){ fetchModelsAndEmbeddings(activeProviderProfile); } }
										else if(key === 'switch'){ setProviderSwitchModalOpen(true); }
										else if(key === 'manage'){ setInnerTab('settings'); }
									},
								}}
							>
								<Button size="small" className={styles.topBtn} icon={<XQIcon name="setting" />}>配置</Button>
							</Dropdown>
							<Select
								showSearch
								allowClear
								value={embeddingSelection || undefined}
								placeholder="嵌入/向量模型（资料库检索·可选）"
								className={styles.modelSelect}
								optionFilterProp="children"
								onChange={(val)=>{ setEmbeddingSelection(val || ''); saveUiPrefs({ embeddingSelection: val || '' }); }}
							>
								{/* [Q-060/AW-16] 显式「不用向量」:清空只是「没显式选」,仍会回落接口自带的嵌入模型 */}
								<Select.Option key={EMBEDDING_TARGET_NONE} value={EMBEDDING_TARGET_NONE}>不用向量（只按关键词检索）</Select.Option>
								{embeddingOptions.map((item)=>(
									<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
								))}
							</Select>
							<Popover
								trigger="click"
								placement="bottomLeft"
								title="聊天高级参数"
								content={(
									<div style={{ width: 240 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between' }}><span>思考档</span></div>
										<Select size="small" style={{ width: '100%', marginBottom: 12 }} value={thinkingLevel}
											onChange={(v)=>{ setThinkingLevel(v); saveUiPrefs({ thinkingLevel: v }); }}>
											{/* [Q-044] 对当前模型无差异的档置灰并写明等同哪一档(判定由 applyThinkingLevel 自证) */}
											{paramPopover.thinkingLevels.map((t)=>(
												<Select.Option key={t.value} value={t.value} disabled={!!t.sameAs && t.value !== thinkingLevel}>
													<span title={t.sameAs ? `该模型上与「${(THINKING_LEVELS.find((x)=>x.value === t.sameAs) || {}).label || t.sameAs}」无差别` : undefined}>
														{t.label}{t.sameAs ? `（同「${(THINKING_LEVELS.find((x)=>x.value === t.sameAs) || {}).label || t.sameAs}」）` : ''}
													</span>
												</Select.Option>
											))}
										</Select>
										{paramPopover.anthropicAdaptive
											? <div style={{ color: 'var(--horosa-text-soft)', fontSize: 12, marginBottom: 8 }}>该 Anthropic 型号不接受采样参数(温度 / top_p / top_k 由出口剥离,用官方缺省)</div>
											: null}
										{paramPopover.reasoning
											? <div style={{ color: 'var(--horosa-text-soft)', fontSize: 12, marginBottom: 8 }}>推理模型自带思考，已隐藏 temperature</div>
											: (<div style={{ marginBottom: 8 }}>
												<div style={{ display: 'flex', justifyContent: 'space-between' }}><span>温度 temperature</span><span>{chatTemperature == null ? '默认' : <span>{chatTemperature} <a data-chat-temp-reset="1" onClick={()=>{ setChatTemperature(null); saveUiPrefs({ chatTemperature: null }); }}>恢复默认</a></span>}</span></div>
												{/* [Q-037/M-45] 拨过后可回「默认」(置 null 并写偏好;默认=不下发,由接口家族缺省) */}
												{/* [Q-323] 上限随家族:Anthropic 0..1,其余 0..2 */}
												<Slider disabled={paramPopover.anthropicAdaptive} min={0} max={paramPopover.tempMax} step={0.1} value={chatTemperature == null ? Math.min(0.7, paramPopover.tempMax) : Math.min(chatTemperature, paramPopover.tempMax)}
													onChange={(v)=>{ setChatTemperature(v); saveUiPrefs({ chatTemperature: v }); }} />
											</div>)}
										<div>
											<div style={{ display: 'flex', justifyContent: 'space-between' }}><span>top_p</span><span>{chatTopP == null ? '默认' : <span>{chatTopP} <a data-chat-topp-reset="1" onClick={()=>{ setChatTopP(null); saveUiPrefs({ chatTopP: null }); }}>恢复默认</a></span>}</span></div>
											{/* [Q-322] 推理型号 / Anthropic 自适应族的 top_p 在出口被剥,拨了不进请求体 → 置灰而不是假装可拨 */}
											<Slider disabled={paramPopover.samplingDead} min={0} max={1} step={0.05} value={chatTopP == null ? 1 : chatTopP}
												onChange={(v)=>{ setChatTopP(v); saveUiPrefs({ chatTopP: v }); }} />
											{paramPopover.samplingDead ? <div style={{ color: 'var(--horosa-text-soft)', fontSize: 11, marginTop: 2 }}>该型号不接受 top_p(出口已剥离)</div> : null}
											{paramPopover.kimiNote ? <div style={{ color: 'var(--horosa-text-soft)', fontSize: 11, marginTop: 2 }}>{paramPopover.kimiNote}</div> : null}   {/* [Q-048⑤] kimi-k 系前后端分治明说 */}
										</div>
										<div style={{ marginTop: 8 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between' }}><span>停止序列</span></div>
											<Input size="small" placeholder="逗号/换行分隔，可留空" value={stopSequences} onChange={(e)=>{ setStopSequences(e.target.value); saveUiPrefs({ stopSequences: e.target.value }); }} />
										</div>
										<div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
											{/* [Q-322] 两惩罚只在「OpenAI 兼容 且 非推理型号」时进请求体,其余一律置灰 */}
											<div style={{ flex: 1 }}><div>频率惩罚</div><InputNumber disabled={paramPopover.penaltyDead} size="small" min={-2} max={2} step={0.1} placeholder="默认" style={{ width: '100%' }} value={frequencyPenalty} onChange={(v)=>{ setFrequencyPenalty(v); saveUiPrefs({ frequencyPenalty: v }); }} /></div>
											<div style={{ flex: 1 }}><div>存在惩罚</div><InputNumber disabled={paramPopover.penaltyDead} size="small" min={-2} max={2} step={0.1} placeholder="默认" style={{ width: '100%' }} value={presencePenalty} onChange={(v)=>{ setPresencePenalty(v); saveUiPrefs({ presencePenalty: v }); }} /></div>
										</div>
										<div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>JSON 输出模式</span><Switch size="small" checked={!!jsonMode} onChange={(v)=>{ setJsonMode(v); saveUiPrefs({ jsonMode: v }); }} /></div>
										{/* [Q-007/M-08] 文案改真话:此前称三项都只对 OpenAI 兼容生效,与代码互斥 */}
										<div style={{ color: 'var(--horosa-text-soft)', fontSize: 11, marginTop: 6 }}>停止序列四家通用（Anthropic / Gemini / Ollama 由出口自动映射）；频率/存在惩罚仅 OpenAI 兼容接口；JSON 输出模式对 OpenAI 兼容与 Gemini 生效，Ollama 不支持（已自动忽略）。</div>
									</div>
								)}
							>
								<Button size="small" className={styles.topBtn} icon={<XQIcon name="setting" />}>参数</Button>
							</Popover>
						</div>
						<span className={styles.topDivider} />
						{renderConnChip()}
						<span className={styles.topDivider} />
						<div className={styles.topGroup}>
							<Select
								showSearch
								allowClear
								open={sourceSelectOpen}
								value={selectedSourceId || undefined}
								placeholder="选择案例（命盘 / 事盘）"
								onDropdownVisibleChange={(open)=>{ setSourceSelectOpen(open); if(open){ setSources(listAnalysisSources()); } }}
								className={styles.sourceSelect}
								filterOption={(input, option)=>{
									const source = sourceOptions.find((item)=>item.value === option.value);
									return source ? source.searchText.indexOf(`${input || ''}`.trim().toLowerCase()) >= 0 : false;
								}}
								onChange={(val)=>{
									const next = val || '';
									// 选中「起课时间/命盘时间」时刷新为当前时刻(此刻)——修 Win#17:之前默认用 mount(打开软件)时间而非点击时间。
									if(next === TIMEPOINT_SOURCE_ID){
										setTimepointDraft((prev)=>({ ...prev, divTime: formatTimepointNow() }));
									}else if(next === NATAL_SOURCE_ID){
										setNatalDraft((prev)=>({ ...prev, birth: formatTimepointNow() }));
									}
									setSelectedSourceId(next);
								}}
							>
								{sourceOptions.map((item)=>(
									<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
								))}
							</Select>
							{activeSource ? (
								<Select
									mode="multiple"
									allowClear
									maxTagCount="responsive"
									value={activeTechniqueKeys}
									placeholder={`选择${activeSource.sourceType === 'chart' ? '命盘' : '事盘'}技法`}
									className={styles.sourceSelect}
									onChange={(vals)=>setSelectedTechniqueKeys(vals || [])}
								>
									{groupedTechniqueOptions.map((group)=>(
										<Select.OptGroup key={group.title} label={group.title}>
											{group.items.map((item)=>(
												<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
											))}
										</Select.OptGroup>
									))}
								</Select>
							) : null}
							<Badge count={lockedContextItems.length} size="small" offset={[-2, 2]}>
								<Button size="small" className={styles.topBtn} icon={<XQIcon name="tool" />} onClick={()=>setMountDrawerOpen(true)}>挂载</Button>
							</Badge>
						</div>
					</div>
				</div>
				<div className={styles.paneBody}>
					<div className={styles.chatStage}>
						{visibleMessages.length === 0 ? (
							<div className={styles.chatLanding}>
								<div className={styles.chatLandingInner}>
									<div className={styles.chatLandingTitle}>开始你的分析</div>
									<div className={styles.chatLandingHint}>选择案例与模型，输入问题即可开始流式分析对话。</div>
									{renderLandingExamples()}
										{renderContextBanner()}
										{renderComposer()}
								</div>
							</div>
						) : (
							<React.Fragment>
								<div className={styles.chatLogShell}>
								{!autoFollow && visibleMessages.length ? (
									<Button
										className={styles.scrollToLatestBtn}
										size="small"
										shape="round"
										icon={<XQIcon name="chevronDown" />}
										onClick={()=>{
											const el = chatLogRef.current;
											if(el){ el.scrollTop = el.scrollHeight; }
											setAutoFollow(true);
										}}
									>跳到最新</Button>
								) : null}
								<div className={styles.chatLog} ref={setChatLogEl}>
									<div className={styles.chatThread}>
										{activeConversation ? (
											<div className={styles.chatThreadHead}>
												<span className={styles.chatThreadTitle}>{activeConversation.title}</span>
												{activeConversation.updatedAt ? <Text type="secondary">{buildTimestampLabel(activeConversation.updatedAt)}</Text> : null}
												<Dropdown
													trigger={['click']}
													menu={{
														items: [
															{ key: 'md', label: 'Markdown' },
															{ key: 'json', label: 'JSON' },
															{ key: 'docx', label: 'Word' },
														],
														onClick: ({ key })=>exportConversation(activeConversation, key),
													}}
												>
													<Button size="small" type="text" className={styles.chatThreadExportBtn} icon={<XQIcon name="download" />}>导出 ▾</Button>
												</Dropdown>
											</div>
										) : null}
										{visibleMessages.map((item)=>(
											<div
												key={item.id}
												className={[
													styles.messageBubble,
													item.role === 'user' ? styles.messageUser : styles.messageAssistant,
												].join(' ')}
											>
												<div className={styles.messageMetaRow}>
													<div className={styles.messageMeta}>
														{item.role === 'user' ? '你' : 'AI'}
														{item.createdAt ? ` · ${buildTimestampLabel(item.createdAt)}` : ''}
														{item.streamStatus === 'streaming' ? ' · 生成中' : ''}
														{item.streamStatus === 'aborted' ? ' · 已停止' : ''}
													</div>
													<Space size={4}>
														{item.role === 'user' ? (<Tooltip title="编辑该消息并基于此分支"><Button size="small" type="link" onClick={()=>handleEditMessageAndBranch(item)} disabled={sending}>编辑</Button></Tooltip>) : null}
														{item.role === 'user' ? (<Tooltip title="回退到此:先撤销之后 AI 做的写入,再删掉这条及之后的消息,恢复当时的挂载/技法/模型"><Button size="small" type="link" onClick={()=>chatAssist.openRewind(item)} disabled={sending} data-rewind-to={item.id}>回退</Button></Tooltip>) : null}
														<Tooltip title={sending ? '正在生成回复,先停止或等本轮结束再分支' : '从此轮次分支'}>
															{/* [Q-034/M-44] 生成中禁用:分支会切会话,此前点了静默掐断正在写的回复 */}
															<Button size="small" type="link" onClick={()=>handleBranchFromMessage(item)} disabled={sending}>分支</Button>
														</Tooltip>
													</Space>
												</div>
												{item.role === 'assistant' && item.reasoning ? (
													<Collapse
														ghost
														className={styles.reasoningCollapse}
														// 流式期间且尚无正文 → 开（让用户看到「思考中…」）；其余状态 → 默认折叠（包含「流完后」自动折）。
														// 给 key 加 streamStatus，确保从 streaming→done 切换时重挂载，触发新的 defaultActiveKey 规则。
														key={`${item.id}-${item.streamStatus || 'done'}`}
														defaultActiveKey={(item.streamStatus === 'streaming' && !item.content) ? ['r'] : []}
													>
														<Collapse.Panel
															key="r"
															header={(item.streamStatus === 'streaming' && !item.content) ? '思考中…' : '思考过程'}
															extra={(
																<Tooltip title="复制思考">
																	<Button
																		size="small"
																		type="text"
																		icon={<XQIcon name="copy" />}
																		onClick={(e)=>{
																			e.stopPropagation();
																			copyTextSmart(item.reasoning || '').then((ok)=>{
																				if(ok){ message.success('已复制思考', 1); }
																				else{ message.error('复制失败', 1.5); }
																			});
																		}}
																	/>
																</Tooltip>
															)}
														>
															<div style={{ whiteSpace: 'pre-wrap', color: 'var(--horosa-text-soft, #8a8f99)', fontSize: 12, lineHeight: 1.7 }}>{item.reasoning}</div>
														</Collapse.Panel>
													</Collapse>
												) : null}
												{item.role === 'user'
													? <div className={styles.messageText}>{item.content}{Array.isArray(item.images) && item.images.length ? (<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: item.content ? 6 : 0 }}>{item.images.map((u, i)=>(<img key={i} src={u} alt="" style={{ maxWidth: 160, maxHeight: 160, borderRadius: 4, border: "1px solid var(--horosa-border, #d9d9d9)" }} />))}</div>) : null}</div>
													: <AssistantMarkdown className={styles.markdownBody} content={item.content} streaming={item.streamStatus === 'streaming'} hasTrace={!!item.agentTrace} />}
												{chatAssist.bestOfCards(item)}
												{chatAssist.reviewNotes(item)}
												{chatAssist.orchestrationPanel(item)}
												{item.role === 'assistant' && item.agentTrace ? (
													<AgentActionBar trace={item.agentTrace} messageId={item.id} streaming={item.streamStatus === 'streaming'} onUndone={()=>setSources(listAnalysisSources())} onTraceChange={async (trace)=>{ const next = { ...item, agentTrace: trace }; setMessages((prev)=>prev.map((m)=>m.id === item.id ? next : m)); try{ await saveConversationMessage(next); }catch(e){ /* 落库失败不阻断 UI */ } }} />
												) : null}
												{item.role === 'assistant' && item.errorInfo ? (
													<Alert
														type={item.errorInfo.category === 'auth' || item.errorInfo.category === 'model' ? 'warning' : 'error'}
														showIcon
														className={styles.messageErrorAlert}
														message={<span>{item.errorInfo.hint}</span>}
														description={<div style={{ fontSize: 11, color: 'var(--horosa-text-soft)', wordBreak: 'break-word' }}>{item.errorInfo.message}</div>}
														action={item.errorInfo.retriable ? (
															<Button size="small" onClick={()=>handleRegenerateMessage(item)} disabled={sending}>重试</Button>
														) : null}
													/>
												) : null}
												{item.role === 'assistant' && item.streamStatus !== 'streaming' && item.content ? (
													<div className={styles.messageActions}>
														<Tooltip title="复制全文">
															<Button size="small" type="text" className={styles.messageActionBtn} icon={<XQIcon name="copy" />} onClick={()=>handleCopyMessage(item)} />
														</Tooltip>
														<Tooltip title="重新生成">
															<Button size="small" type="text" className={styles.messageActionBtn} icon={<XQIcon name="sync" />} onClick={()=>handleRegenerateMessage(item)} disabled={sending} />
														</Tooltip>
														<Tooltip title="审阅:优先用另一家模型对照挂载的排盘数据检查这条回答,列出错误/夸大/漏项/无据;批注可一键重写">
															<Button size="small" type="text" className={styles.messageActionBtn} icon={<XQIcon name="search" />} onClick={()=>chatAssist.review.run(item)} disabled={sending || !!chatAssist.review.busy} />
														</Tooltip>
														{item.usage && (item.usage.input_tokens || item.usage.output_tokens) ? (()=>{
															const u = item.usage;
															// [P0-1] 缓存计量入价:按接口家族分式(anthropic 的 input 不含缓存段、openai 家族已含);无缓存计量=旧公式。
															// 命中占比分母=整个提示词(anthropic 为 input+读+写,openai 家族 input 已含),两家口径同义、不会超过 100%。
															const cacheRead = Number(u.cache_read_input_tokens) || 0;
															const cacheWrite = Number(u.cache_creation_input_tokens) || 0;
															const usageFamily = getProviderProtocolFamily(u.providerType);
															const cost = estimateUsageCost(u.model, u.input_tokens, u.output_tokens, { cacheRead, cacheWrite, family: usageFamily });
															const promptTotal = (Number(u.input_tokens) || 0) + (usageFamily === 'anthropic' ? cacheRead + cacheWrite : 0);
															const cachePct = cacheRead > 0 && promptTotal > 0 ? Math.min(100, Math.round((cacheRead / promptTotal) * 100)) : 0;
															const usageNote = `${cacheRead > 0 ? ` · 缓存 ${cacheRead}(${cachePct}%)` : ''}${Number(u.rounds) > 1 ? ` · ${u.rounds} 轮` : ''}`;
															return (
																<Tooltip title={`输入 ${u.input_tokens || 0} · 输出 ${u.output_tokens || 0}${usageNote}${cost ? ` · 估算 $${cost.cost.toFixed(4)}（价目会漂移）` : ''}`}>
																	<span className={styles.messageUsage}>↑ {u.input_tokens || 0} ↓ {u.output_tokens || 0}{cost ? ` · $${cost.cost.toFixed(4)}` : ''}</span>
																</Tooltip>
															);
														})() : null}
													</div>
												) : null}
											</div>
										))}
									</div>
								</div>
								</div>
								<div className={styles.composerDock}>
									<div className={styles.chatThread}>
										{renderContextBanner()}
										{renderComposer()}
									</div>
								</div>
							</React.Fragment>
						)}
					</div>
				</div>
			</div>
		);
	}

	function renderHistoryPane(){
		const providerOptions = uniqueTextList(conversations.map((item)=>item.providerName || item.providerType).filter(Boolean));
		const modelOptionsList = uniqueTextList(conversations.map((item)=>item.model).filter(Boolean));
		return (
			<div className={styles.paneShell}>
				<div className={styles.paneHeader}>
					<div className={styles.historyTop}>
						<Search
							allowClear
							placeholder="搜索历史对话、案例名、模型"
							style={{ maxWidth: 320 }}
							value={historyKeyword}
							onChange={(e)=>setHistoryKeyword(e.target.value)}
						/>
						<Select value={historyFilter.provider || undefined} allowClear placeholder="Provider" style={{ width: 150 }} onChange={(val)=>setHistoryFilter((prev)=>({ ...prev, provider: val || '' }))}>
							{providerOptions.map((item)=><Select.Option key={item} value={item}>{item}</Select.Option>)}
						</Select>
						<Select value={historyFilter.model || undefined} allowClear placeholder="模型" style={{ width: 160 }} onChange={(val)=>setHistoryFilter((prev)=>({ ...prev, model: val || '' }))}>
							{modelOptionsList.map((item)=><Select.Option key={item} value={item}>{item}</Select.Option>)}
						</Select>
						<Select value={historyFilter.sourceType} style={{ width: 130 }} onChange={(val)=>setHistoryFilter((prev)=>({ ...prev, sourceType: val || '' }))}>
							<Select.Option value="">全部案例</Select.Option>
							<Select.Option value="chart">命盘</Select.Option>
							<Select.Option value="case">事盘</Select.Option>
							<Select.Option value="timepoint">起课时间</Select.Option>
							<Select.Option value="__none__">未挂案例</Select.Option>
						</Select>
						<Select value={historyFilter.favorite} style={{ width: 120 }} onChange={(val)=>setHistoryFilter((prev)=>({ ...prev, favorite: val }))}>
							<Select.Option value="all">全部收藏</Select.Option>
							<Select.Option value="favorite">仅收藏</Select.Option>
							<Select.Option value="normal">未收藏</Select.Option>
						</Select>
						<Select value={historyFilter.archived} style={{ width: 120 }} onChange={(val)=>setHistoryFilter((prev)=>({ ...prev, archived: val }))}>
							<Select.Option value="active">未归档</Select.Option>
							<Select.Option value="archived">已归档</Select.Option>
							<Select.Option value="all">全部</Select.Option>
						</Select>
					</div>
					<div className={styles.historyBatchBar}>
						<Space wrap>
							<Button onClick={resetConversationDraft}>新建对话</Button>
							<Button icon={<XQIcon name="export" />} onClick={exportSelectedConversations} disabled={!selectedHistoryIds.length}>批量导出</Button>
							<Button onClick={()=>handleArchiveSelected(true)} disabled={!selectedHistoryIds.length}>批量归档</Button>
							<Button onClick={()=>handleArchiveSelected(false)} disabled={!selectedHistoryIds.length}>取消归档</Button>
							<Button onClick={()=>handleFavoriteSelected(true)} disabled={!selectedHistoryIds.length}>批量收藏</Button>
							<Button onClick={()=>handleFavoriteSelected(false)} disabled={!selectedHistoryIds.length}>取消收藏</Button>
							<Popconfirm title="确定删除所选历史吗？" onConfirm={handleBatchDeleteConversations}>
								<Button danger icon={<XQIcon name="delete" />} disabled={!selectedHistoryIds.length}>批量删除</Button>
							</Popconfirm>
						</Space>
					</div>
				</div>
				<div className={styles.paneBody}>
					<div className={styles.historyTableWrap}>
						{filteredConversations.length === 0 ? (
							<div className={styles.historyEmpty}>
								<Empty description="暂无历史对话" />
							</div>
						) : (
						<Table
							rowKey="id"
							size="small"
							className={styles.historyTable}
							tableLayout="fixed"
							rowSelection={{
								selectedRowKeys: selectedHistoryIds,
								onChange: (keys)=>setSelectedHistoryIds(keys),
								columnWidth: 44,
							}}
							dataSource={filteredConversations}
							scroll={{ y: Math.max(height - 220, 320) }}
							/* [Q-057] pageSize 写死 = 受控值,「条/页」切换器点了永远弹回 15(死控件)。改 defaultPageSize 交给 antd 自管。 */
							pagination={{ defaultPageSize: 15, showSizeChanger: true, pageSizeOptions: ['10','15','30','50'], size: 'small' }}
							columns={[
								{
									title: '标题',
									dataIndex: 'title',
									ellipsis: { showTitle: true },
									render: (value, record)=>(
										<div className={styles.tableTitleCell}>
											<span className={styles.tableTitleText} title={value || '未命名对话'}>{value || '未命名对话'}</span>
											{record.favorite ? <Tag color="gold">收藏</Tag> : null}
											{record.archived ? <Tag>归档</Tag> : null}
										</div>
									),
								},
								{
									title: '案例',
									width: 180,
									ellipsis: { showTitle: true },
									render: (_, record)=>record.sourceRef && record.sourceRef.title ? record.sourceRef.title : '未绑定',
								},
								{
									title: 'Provider / 模型',
									width: 200,
									ellipsis: { showTitle: true },
									render: (_, record)=>record.providerName ? `${record.providerName} / ${record.model || ''}` : (record.model || '未设置'),
								},
								{
									title: '更新时间',
									width: 150,
									render: (_, record)=>buildTimestampLabel(record.updatedAt),
								},
								{
									title: '操作',
									width: 380,
									render: (_, record)=>(
										<Space size={4} wrap>
											<Button size="small" type="primary" onClick={()=>openConversation(record)}>打开</Button>
											<Button size="small" onClick={()=>handleRenameConversation(record)}>重命名</Button>
											<Button size="small" onClick={()=>handleDuplicateConversation(record)}>复制</Button>
											<Tooltip title={record.favorite ? '取消收藏' : '收藏'}><Button size="small" onClick={()=>handleToggleConversationFlag(record, 'favorite')} icon={<XQIcon name="star" />} /></Tooltip>
											<Button size="small" onClick={()=>handleToggleConversationFlag(record, 'archived')}>{record.archived ? '取消归档' : '归档'}</Button>
											<Dropdown
												trigger={['click']}
												menu={{
													items: [
														{ key: 'md', label: 'Markdown' },
														{ key: 'json', label: 'JSON' },
														{ key: 'docx', label: 'Word' },
													],
													onClick: ({ key })=>exportConversation(record, key, { withScreenshot: false }),   // [Q-060/AW-29] 历史页不附列表截图
												}}
											>
												<Button size="small">导出 ▾</Button>
											</Dropdown>
											<Popconfirm title="确定删除这段历史吗？" onConfirm={()=>handleDeleteConversation(record.id)}>
												<Button size="small" danger icon={<XQIcon name="delete" />} />
											</Popconfirm>
										</Space>
									),
								},
							]}
						/>
						)}
					</div>
				</div>
			</div>
		);
	}

	function renderMaterialsPane(){
		// 全 pane 拖拽：用 React ref 计数，避免 dragLeave 误闪。组件内 ref，热重载/多实例下不会乱串。
		const onDragEnter = (e)=>{
			if(e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0){
				materialDragCounterRef.current++;
				setMaterialPaneDragOver(true);
			}
		};
		const onDragOver = (e)=>{
			if(e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0){
				e.preventDefault();
				e.dataTransfer.dropEffect = 'copy';
			}
		};
		const onDragLeave = ()=>{
			materialDragCounterRef.current = Math.max(0, materialDragCounterRef.current - 1);
			if(materialDragCounterRef.current === 0){ setMaterialPaneDragOver(false); }
		};
		const onDrop = (e)=>{
			e.preventDefault();
			materialDragCounterRef.current = 0;
			setMaterialPaneDragOver(false);
			const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
			if(files.length){ ingestFiles(files); }
		};
		return (
			<div className={styles.paneShell} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
				<div className={styles.paneHeader}>
					<div className={styles.materialTop}>
						<Search
							allowClear
							placeholder="搜索资料标题、标签、全文"
							style={{ maxWidth: 360 }}
							value={materialKeyword}
							onChange={(e)=>setMaterialKeyword(e.target.value)}
						/>
						{materialFolders.length ? (
							<Select value={selectedFolderId || undefined} placeholder="全部文件夹" style={{ width: 180 }} onChange={(val)=>setSelectedFolderId(val || '')}>
								<Select.Option value="">全部文件夹</Select.Option>
								{materialFolders.map((item)=><Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>)}
							</Select>
						) : null}
						<Select value={materialSort} style={{ width: 150 }} onChange={setMaterialSort}>
							<Select.Option value="updated">按更新时间</Select.Option>
							<Select.Option value="name">按名称</Select.Option>
							<Select.Option value="size">按大小</Select.Option>
						</Select>
						<Select value={materialView} style={{ width: 110 }} onChange={(v)=>{ setMaterialView(v); saveUiPrefs({ materialView: v }); }}>
							<Select.Option value="grid">卡片视图</Select.Option>
							<Select.Option value="list">列表视图</Select.Option>
						</Select>
						<Space wrap>
							<Button icon={<XQIcon name="plus" />} type="primary" onClick={()=>openMaterialEditor(null)}>新建资料</Button>
							<Upload showUploadList={false} multiple beforeUpload={(file, fileList)=>{ /* 一次性接收整批 */ if(fileList[0] === file){ ingestFiles(fileList); } return false; }} accept={MATERIAL_ACCEPT_ATTR}>
								<Button icon={<XQIcon name="import" />}>选文件上传</Button>
							</Upload>
							<Button icon={<XQIcon name="folder" />} onClick={()=>setFolderDrawerOpen(true)}>管理文件夹</Button>
							<Button icon={<XQIcon name="sync" />} onClick={dedupeMaterials}>去重</Button>
							{desktopBridge ? <Button onClick={handleDesktopFilePick}>桌面选文件</Button> : null}
							{desktopBridge ? <Button onClick={handleDesktopFolderImport}>导入目录</Button> : null}
						</Space>
					</div>
					<div className={styles.materialHint}>
						<XQIcon name="folder" /> 把文件直接拖到本面即上传（也可点「选文件上传」）。支持 TXT / Markdown / DOC / DOCX / PDF。
					</div>
					{materialIngestQueue.length ? (
						<div className={styles.materialIngestBar}>
							{materialIngestQueue.map((q)=>(
								<Tag key={q.id} color={q.status === 'done' ? (q.truncated ? 'orange' : 'green') : q.status === 'error' ? 'red' : q.status === 'skip' ? 'default' : 'blue'}>
									{q.name} · {q.status === 'parsing' ? '解析中…' : q.status === 'importing' ? '导入中…' : q.status === 'done' ? (q.truncated ? `完成(${q.truncated})` : '完成') : q.status === 'skip' ? `已跳过${q.err ? '：' + q.err : ''}` : `失败${q.err ? '：' + q.err : ''}`}
								</Tag>
							))}
						</div>
					) : null}
				</div>
				<div className={styles.paneBody}>
					<div className={styles.materialScroll}>
						{tagGroups.length ? (
							<Card size="small" bordered={false} className={styles.tagGroupCard} title="标签组">
								<Space wrap>
									{tagGroups.map((group)=>(
										<Tag key={group.id}>{group.name}：{(group.tags || []).join('、') || '空'}</Tag>
									))}
								</Space>
							</Card>
						) : null}
						{filteredMaterials.length === 0 ? (
							<div className={styles.materialEmpty}>
								<Empty description="暂无资料" />
							</div>
						) : materialView === 'list' ? (
							<Table
								rowKey="id"
								size="small"
								tableLayout="fixed"
								dataSource={filteredMaterials}
								/* [Q-057] 同上:写死 pageSize 让「条/页」切换器变死控件 */
								pagination={{ defaultPageSize: 20, size: 'small', showSizeChanger: true, pageSizeOptions: ['10','20','50','100'] }}
								columns={[
									{ title: '名称', dataIndex: 'name', ellipsis: { showTitle: true }, render: (v)=>v || '未命名' },
									{ title: '类型', width: 90, render: (_, it)=>it.kind || 'note' },
									{ title: '文件夹', width: 140, ellipsis: true, render: (_, it)=>(it.folderId ? (materialFolders.find((folder)=>folder.id === it.folderId)?.name || '未知') : '未分类') },
									{ title: '标签', width: 160, ellipsis: true, render: (_, it)=>(it.tags || []).join('、') || '无' },
									{ title: '流派', width: 160, render: (_, it)=>(it.schools || []).length ? (it.schools || []).map((s, i)=>(<Tag key={i} color="cyan" style={{marginBottom:2}}>{s}</Tag>)) : <span style={{color:'#999'}}>通用</span> },
									{ title: '更新时间', width: 150, render: (_, it)=>buildTimestampLabel(it.updatedAt) },
									{ title: '操作', width: 380, render: (_, it)=>(
										<Space size={4} wrap>
											<Button size="small" onClick={()=>openMaterialEditor(it)} icon={<XQIcon name="edit" />} />
											<Button size="small" onClick={()=>setReferenceIds((prev)=>uniqueTextList(prev.concat(`material:${it.id}`)))}>加参考</Button>
											<Dropdown trigger={['click']} menu={{
												items: [
													{ key: '', label: '未分类' },
													...materialFolders.map((f)=>({ key: f.id, label: f.name })),
												],
												onClick: ({ key })=>handleMoveMaterial(it, key),
											}}>
												<Button size="small">移动 ▾</Button>
											</Dropdown>
											<Dropdown trigger={['click']} menu={{
												items: [
													{ key: 'orig', label: '原文件' },
													{ key: 'text', label: '提取文本' },
												],
												onClick: ({ key })=>{ if(key === 'orig') exportMaterialOriginal(it); else exportMaterialText(it); },
											}}>
												<Button size="small">导出 ▾</Button>
											</Dropdown>
											<Upload showUploadList={false} accept={MATERIAL_ACCEPT_ATTR} beforeUpload={(file)=>handleReplaceMaterial(it, file)}>
												<Button size="small">替换</Button>
											</Upload>
											<Popconfirm title="确定删除这份资料吗？" onConfirm={()=>deleteMaterial(it.id)}>
												<Button size="small" danger icon={<XQIcon name="delete" />} />
											</Popconfirm>
										</Space>
									) },
								]}
							/>
						) : (
							<div className={styles.materialGrid}>
								{filteredMaterials.map((item)=>(
								<Card key={item.id} size="small" title={item.name} bordered={false}>
									<div className={styles.cardMeta}>
										<div>类型：{item.kind || 'note'}</div>
										<div>文件夹：{item.folderId ? (materialFolders.find((folder)=>folder.id === item.folderId)?.name || '未知') : '未分类'}</div>
										<div>标签：{(item.tags || []).length ? (item.tags || []).join('、') : '无'}</div>
										<div>流派：{(item.schools || []).length ? (item.schools || []).map((s, i)=>(<Tag key={i} color="cyan" style={{marginRight:4}}>{s}</Tag>)) : '通用'}</div>
										<div>更新时间：{buildTimestampLabel(item.updatedAt)}</div>
										{/* [Q-060/AW-23] 后端抽取的截断(PDF 只抽前 N 页 / 正文按字数封顶)此前只写进 extractMeta,界面零提示 —— 大部头只入库前 500 页而用户不知 */}
										{describeExtractTruncation(item.extractMeta) ? <div><Tag color="orange">{describeExtractTruncation(item.extractMeta)}</Tag></div> : null}
									</div>
									<div className={styles.summaryBlock}>
										{(item.extractedText || '').slice(0, 300)}
										{(item.extractedText || '').length > 300 ? '...' : ''}
									</div>
									<div className={styles.cardActions}>
										<Button size="small" onClick={()=>openMaterialEditor(item)} icon={<XQIcon name="edit" />}>编辑</Button>
										<Button size="small" onClick={()=>setReferenceIds((prev)=>uniqueTextList(prev.concat(`material:${item.id}`)))}>加入参考</Button>
										<Dropdown trigger={['click']} menu={{
											items: [
												{ key: '', label: '未分类' },
												...materialFolders.map((f)=>({ key: f.id, label: f.name })),
											],
											onClick: ({ key })=>handleMoveMaterial(item, key),
										}}>
											<Button size="small">移动到 ▾</Button>
										</Dropdown>
										<Button size="small" icon={<XQIcon name="download" />} onClick={()=>exportMaterialOriginal(item)}>原文件</Button>
										<Button size="small" onClick={()=>exportMaterialText(item)}>提取文本</Button>
										<Upload showUploadList={false} accept={MATERIAL_ACCEPT_ATTR} beforeUpload={(file)=>handleReplaceMaterial(item, file)}>
											<Button size="small">替换文件</Button>
										</Upload>
										<Popconfirm title="确定删除这份资料吗？" onConfirm={()=>deleteMaterial(item.id)}>
											<Button size="small" danger icon={<XQIcon name="delete" />}>删除</Button>
										</Popconfirm>
									</div>
								</Card>
								))}
							</div>
						)}
					</div>
				</div>
			{materialPaneDragOver ? (
				<div className={styles.materialDropOverlay}>
					<div className={styles.materialDropOverlayInner}>
						<div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
						<div style={{ fontSize: 16, fontWeight: 600 }}>放下即上传</div>
						<div className={styles.materialDropOverlayHint}>支持 TXT / Markdown / DOC / DOCX / PDF</div>
					</div>
				</div>
			) : null}
			</div>
		);
	}

	function renderTemplatesPane(){
		return (
			<div className={styles.paneShell}>
				<div className={styles.paneHeader}>
					<div className={styles.templateTop}>
						<Search
							allowClear
							placeholder="搜索模版与组合"
							style={{ maxWidth: 360 }}
							value={templateKeyword}
							onChange={(e)=>setTemplateKeyword(e.target.value)}
						/>
						<Space>
							<Button icon={<XQIcon name="plus" />} type="primary" onClick={()=>openTemplateEditor(null)}>新建模版</Button>
							<Button icon={<XQIcon name="plus" />} onClick={()=>openBundleEditor(null)}>新建组合</Button>
						</Space>
					</div>
				</div>
				<div className={styles.paneBody}>
					<div className={styles.paneScroll}>
						<div className={styles.templateGrid}>
							{filteredTemplates.length === 0 ? <Empty description="暂无模版或组合" /> : filteredTemplates.map((item)=>(
						<Card
							key={`${item.cardType}-${item.id}`}
							size="small"
							title={`${item.cardType === 'template' ? '模版' : '组合'} · ${item.name}`}
							bordered={false}
						>
							{item.cardType === 'template' ? (
								<>
									<div className={styles.cardMeta}>
										<div>格式：{item.format || 'text'}</div>
										<div>版本数：{templateVersions.filter((one)=>one.templateId === item.id).length}</div>
										<div>更新时间：{buildTimestampLabel(item.updatedAt)}</div>
										{/* [Q-060/AW-23] 后端抽取的截断(PDF 只抽前 N 页 / 正文按字数封顶)此前只写进 extractMeta,界面零提示 —— 大部头只入库前 500 页而用户不知 */}
										{describeExtractTruncation(item.extractMeta) ? <div><Tag color="orange">{describeExtractTruncation(item.extractMeta)}</Tag></div> : null}
									</div>
									<div className={styles.summaryBlock}>
										{(item.instructionText || item.jsonSchema || item.content || '').slice(0, 260)}
										{(item.instructionText || item.jsonSchema || item.content || '').length > 260 ? '...' : ''}
									</div>
									<div className={styles.cardActions}>
										<Button size="small" onClick={()=>openTemplateEditor(item)} icon={<XQIcon name="edit" />}>编辑</Button>
										<Button size="small" onClick={()=>{
											setPreviewTemplate(item);
											setPreviewDrawerOpen(true);
										}}>预览</Button>
										{templateVersions.filter((v)=>v.templateId === item.id).length >= 2 ? (
											<Button size="small" onClick={()=>{
												const vs = templateVersions.filter((v)=>v.templateId === item.id).sort((a,b)=>(b.versionNumber||0)-(a.versionNumber||0));
												setVersionDiffState({ template: item, leftId: vs[1].id, rightId: vs[0].id });
											}}>版本对比</Button>
										) : null}
										<Popconfirm title="确定删除这个模版吗？" onConfirm={()=>deleteTemplate(item.id)}>
											<Button size="small" danger icon={<XQIcon name="delete" />}>删除</Button>
										</Popconfirm>
									</div>
									<div className={styles.versionList}>
										{/* [Q-062/AW-33] 标出「当前版」并显示回滚留痕;当前版没有「回滚」按钮(回滚到自己没有意义) */}
										{templateVersions.filter((one)=>one.templateId === item.id).slice(0, 5).map((version)=>(
											<div key={version.id} className={styles.versionItem}>
												<span>V{version.versionNumber}{item.activeVersionId === version.id ? <Tag color="blue" style={{ marginLeft: 6 }}>当前版</Tag> : null}</span>
												<Text type="secondary">{buildTimestampLabel(version.updatedAt)}{version.note ? ` · ${version.note}` : ''}</Text>
												{item.activeVersionId === version.id ? null : <Button size="small" type="link" onClick={()=>rollbackTemplateVersion(item, version)}>回滚</Button>}
											</div>
										))}
									</div>
								</>
							) : (
								<>
									<div className={styles.cardMeta}>
										<div>绑定资料：{Array.isArray(item.defaultMaterialIds) ? item.defaultMaterialIds.length : 0} 份</div>
										<div>默认模型：{item.defaultModel || '未设置'}</div>
										<div>更新时间：{buildTimestampLabel(item.updatedAt)}</div>
										{/* [Q-416] 标技能身份:带 skill 字段的组合同时是 AI 助手的技能包(触发词 / 版本) */}
										{(()=>{ const sk = normalizeSkillPack(item); return sk ? <div><Tag color="purple">技能包 · /{sk.triggers[0] || '?'} · v{sk.version}</Tag></div> : null; })()}
										{/* [Q-060/AW-23] 后端抽取的截断(PDF 只抽前 N 页 / 正文按字数封顶)此前只写进 extractMeta,界面零提示 —— 大部头只入库前 500 页而用户不知 */}
										{describeExtractTruncation(item.extractMeta) ? <div><Tag color="orange">{describeExtractTruncation(item.extractMeta)}</Tag></div> : null}
									</div>
									<div className={styles.summaryBlock}>
										{item.defaultSystemPrompt || '未设置默认系统提示'}
									</div>
									<div className={styles.cardActions}>
										<Button size="small" onClick={()=>openBundleEditor(item)} icon={<XQIcon name="edit" />}>编辑</Button>
										<Button size="small" onClick={()=>applyBundle(item)}>一键应用</Button>
										<Button size="small" onClick={()=>setBundlePreview(item)}>预览</Button>
										<Button size="small" onClick={()=>setReferenceIds((prev)=>uniqueTextList(prev.concat(`bundle:${item.id}`)))}>加入参考</Button>
										<Popconfirm title="确定删除这个组合吗？" onConfirm={()=>deleteBundle(item.id)}>
											<Button size="small" danger icon={<XQIcon name="delete" />}>删除</Button>
										</Popconfirm>
									</div>
								</>
							)}
						</Card>
							))}
						</div>
					</div>
				</div>
			</div>
		);
	}


	// 「进阶」页:高级能力总控。两个插座字面从设置页整体移来——设置页只剩接口配置与备份。
	function renderAdvancedPane(){
		return (
			<div className={styles.paneShell}>
				<div className={styles.paneBody}>
					<div className={styles.paneScroll}>
						<AdvancedPane personaInjecting={chatAssist.personaInjecting}>
							{chatAssist.settingsPanels}
							<AgentAbilityPanel />
						</AdvancedPane>
					</div>
				</div>
			</div>
		);
	}

	function renderSettingsPane(){
		const healthSummary = providerProfiles.reduce((acc, item)=>{
			const key = item.healthStatus === 'healthy' ? 'healthy' : item.healthStatus === 'error' ? 'error' : 'unknown';
			acc[key] += 1;
			return acc;
		}, { healthy: 0, error: 0, unknown: 0 });
		return (
			<div className={styles.paneShell}>
				<div className={styles.paneHeader}>
					<div className={styles.settingsTop}>
						<Search
							allowClear
							placeholder="搜索接口、模型、Base URL"
							style={{ maxWidth: 360 }}
							value={settingKeyword}
							onChange={(e)=>setSettingKeyword(e.target.value)}
						/>
						<Space>
							<Button icon={<XQIcon name="plus" />} type="primary" onClick={()=>openProviderEditor(null)}>新增接口配置</Button>
							<Select size="middle" value={providerListDense ? 'dense' : 'card'} style={{ width: 110 }} onChange={(v)=>{ const d = v === 'dense'; setProviderListDense(d); saveUiPrefs({ providerListDense: d }); }}>
								<Select.Option value="card">卡片视图</Select.Option>
								<Select.Option value="dense">紧凑列表</Select.Option>
							</Select>
							<Button icon={<XQIcon name="export" />} onClick={handleExportWorkspaceBackup}>导出备份</Button>
							<Button icon={<XQIcon name="import" />} onClick={handleRestoreWorkspaceBackup}>恢复备份</Button>
							<Tooltip title="清空挂载上下文的派生缓存(不影响命盘/事盘存档与对话);下次挂载按当前存档重建。">
								<Button icon={<XQIcon name="delete" />} onClick={handleClearContextCache}>清理上下文缓存</Button>
							</Tooltip>
						</Space>
					</div>
					<div className={styles.summaryBlock}>
						健康概览：健康 {healthSummary.healthy} / 异常 {healthSummary.error} / 未检测 {healthSummary.unknown}
						<span style={{ marginLeft: 12, color: 'var(--horosa-text-soft)' }}>上下文策略 · 模型路由 · 口径与记忆 · 技能包 · 行动能力 已移到</span>
						<Button type="link" size="small" style={{ padding: '0 4px' }} onClick={()=>setInnerTab('advanced')}>「进阶」页</Button>
					</div>
				</div>
				<div className={styles.paneBody}>
					<div className={styles.paneScroll}>
						{providerListDense ? (
							<Table
								rowKey="id"
								size="small"
								tableLayout="fixed"
								className={styles.providerDenseTable}
								dataSource={filteredProfiles}
								pagination={false}
								columns={[
									{ title: '配置名称', dataIndex: 'name', ellipsis: true, render: (v)=>v || '未命名配置' },
									{ title: '类型', width: 110, render: (_, it)=>getProviderDisplayName(it.providerType) },
									{ title: 'Base URL', width: 220, ellipsis: { showTitle: true }, render: (_, it)=>it.baseUrl || '默认' },
									{ title: '模型数', width: 80, render: (_, it)=>normalizeProfileChatModels(it).length },
									{ title: '状态', width: 100, render: (_, it)=><Tag color={it.healthStatus === 'healthy' ? 'green' : it.healthStatus === 'error' ? 'red' : 'default'}>{providerHealthLabel(it.healthStatus)}</Tag> },   /* [Q-062/AW-36] */
									{ title: '操作', width: 280, render: (_, it)=>(
										<Space size={4} wrap>
											<Button size="small" type="link" onClick={()=>openProviderEditor(it)}>编辑</Button>
											<Button size="small" type="link" onClick={()=>fetchModelsAndEmbeddings(it)}>拉模型</Button>
											<Button size="small" type="link" onClick={()=>testProfileChat(it)}>测试</Button>
											<Button size="small" type="link" onClick={()=>runProviderDiagnostics(it)}>诊断</Button>
											<Popconfirm title="确定删除这条接口配置吗？" onConfirm={()=>deleteProvider(it.id)}>
												<Button size="small" type="link" danger>删除</Button>
											</Popconfirm>
										</Space>
									) },
								]}
							/>
						) : (
						<div className={styles.settingsGrid}>
							{filteredProfiles.length === 0 ? <Empty description="暂无接口配置" /> : filteredProfiles.map((item)=>(
						<Card key={item.id} size="small" title={item.name || '未命名配置'} bordered={false}>
							<div className={styles.cardMeta}>
								{item.apiKeyDecryptFailed || item.extraHeadersDecryptFailed ? (
									<div><Tag color="orange">{[item.apiKeyDecryptFailed ? 'API Key' : '', item.extraHeadersDecryptFailed ? '鉴权请求头令牌' : ''].filter(Boolean).join('与')}无法解密,请重填(未重填前原密文保留)</Tag></div>
								) : null}
								<div>类型：{getProviderDisplayName(item.providerType)}</div>
								<div>协议族：{item.protocolFamily || getProviderProtocolFamily(item.providerType)}</div>
								<div>Base URL：{item.baseUrl || '默认'}</div>
								<div>聊天模型：{normalizeProfileChatModels(item).length ? normalizeProfileChatModels(item).join('、') : '未配置'}</div>
								<div>Embedding：{normalizeEmbeddingModels(item).length ? normalizeEmbeddingModels(item).join('、') : '未配置'}</div>
								<div>健康状态：<Tag color={item.healthStatus === 'healthy' ? 'green' : item.healthStatus === 'error' ? 'red' : 'default'}>{providerHealthLabel(item.healthStatus)}</Tag></div>{/* [Q-062/AW-36] */}
							</div>
							{item.lastDiagnostics ? (
								<div className={styles.summaryBlock}>
									<div>DNS：{item.lastDiagnostics.dns && item.lastDiagnostics.dns.ok ? `OK / ${item.lastDiagnostics.dns.latencyMs || 0}ms` : `失败 / ${item.lastDiagnostics.dns && item.lastDiagnostics.dns.message ? item.lastDiagnostics.dns.message : ''}`}</div>
									<div>TCP：{item.lastDiagnostics.tcp && item.lastDiagnostics.tcp.ok ? `OK / ${item.lastDiagnostics.tcp.latencyMs || 0}ms` : `失败 / ${item.lastDiagnostics.tcp && item.lastDiagnostics.tcp.message ? item.lastDiagnostics.tcp.message : ''}`}</div>
									<div>HTTP：{item.lastDiagnostics.http && item.lastDiagnostics.http.ok ? `OK / ${item.lastDiagnostics.http.latencyMs || 0}ms` : `失败 / ${item.lastDiagnostics.http && item.lastDiagnostics.http.message ? item.lastDiagnostics.http.message : ''}`}</div>
									<div>失败分类：{item.lastDiagnostics.failureReason || '无'}</div>
									<div>建议：{item.lastDiagnostics.recommendation || '无'}</div>
									<div>错误详情：{item.lastDiagnostics.errorDetail || '无'}</div>
								</div>
							) : null}
							<div className={styles.cardActions}>
								<Button size="small" onClick={()=>openProviderEditor(item)} icon={<XQIcon name="edit" />}>编辑</Button>
								<Button size="small" onClick={()=>fetchModelsAndEmbeddings(item)} icon={<XQIcon name="refresh" />}>拉取模型</Button>
								<Button size="small" onClick={()=>testProfileChat(item)}>测试连接</Button>
								<Button size="small" onClick={()=>runProviderDiagnostics(item)} icon={<XQIcon name="search" />}>连通性诊断</Button>
								<Popconfirm title="确定删除这条接口配置吗？" onConfirm={()=>deleteProvider(item.id)}>
									<Button size="small" danger icon={<XQIcon name="delete" />}>删除</Button>
								</Popconfirm>
							</div>
						</Card>
							))}
						</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	const historyColumns = [];
	void historyColumns;

	const previewResult = previewTemplate ? buildTemplatePreview(previewTemplate) : null;

	return (
		<div className={`${styles.root} horosa-aianalysis-page`}>
			{storeHealth && storeHealth.degraded ? (
				<Alert
					data-ai-store-degraded={storeHealth.reason || 'open-failed'}
					type="warning"
					showIcon
					style={{ margin: '8px 12px 0' }}
					message={storeHealth.reason === 'version' ? 'AI 工作区数据库由更新版本创建,当前版本无法打开:本次以内存模式运行,关闭即丢;升级软件后自动恢复。' : 'AI 工作区数据库打不开:本次以内存模式运行,关闭即丢(重启软件或检查磁盘/隐私设置)。'}
					description={storeHealth.message ? <span style={{ fontSize: 11, wordBreak: 'break-all' }}>{storeHealth.message}</span> : null}
				/>
			) : null}
			<input
				ref={backupRestoreInputRef}
				type="file"
				accept=".zip"
				style={{ display: 'none' }}
				onChange={handleBackupRestoreInputChange}
			/>
			<input
				ref={desktopFileInputRef}
				type="file"
				multiple
				accept={MATERIAL_ACCEPT_ATTR}
				style={{ display: 'none' }}
				onChange={handleDesktopFileInputChange}
			/>
			<input
				ref={desktopFolderInputRef}
				type="file"
				multiple
				accept={MATERIAL_ACCEPT_ATTR}
				webkitdirectory=""
				directory=""
				style={{ display: 'none' }}
				onChange={handleDesktopFolderInputChange}
			/>
			{/* [首开反卡 2026-08-09] 全页 Spin 已摘:曾以 workspaceLoading 包住整个工作区 ——
			    APP(WKWebView)里大库首读把它顶成「全页转圈很久」。现在首帧直接渲染,
			    wave2 未到位时资料/历史 pane 顶部各自细提示(deepLoading)。绝不回包全页。 */}
			{/* horosa_freeze_subtabs_v1:五个 renderXxxPane() 此前在**每次** render 都被无条件调用 ——
			    打一个字、流式回答每来一段、切任何设置,都会把「历史」「资料」「模版」「设置」四个
			    看不见的面板(含各自的列表/表单/折叠面板)整套重建一遍。函数式 children 让未激活的
			    面板连函数都不调用;已激活过的在非激活期跳过 re-render,切回时用本轮最新数据渲一帧,
			    不卸载、不重取、不丢用户已填的表单与滚动位置。
			    与上游「首开反卡」的 deepLoading 细提示相容:提示在各自 pane 内,随该 pane 一同求值。 */}
			<Tabs
					className={styles.workspaceTabs}
					tabPosition="right"
					activeKey={innerTab}
					onChange={setInnerTab}
					style={{ height: '100%', minHeight: 0 }}
				>
					<TabPane tab={<span>{SECONDARY_TABS[0].icon}分析</span>} key="analysis">
						<FreezeSubTab active={innerTab === 'analysis'}>{()=>(
						<div className={styles.pane}>{renderAnalysisPane()}</div>
					)}</FreezeSubTab>
					</TabPane>
					<TabPane tab={<span>{SECONDARY_TABS[1].icon}历史</span>} key="history">
						<FreezeSubTab active={innerTab === 'history'}>{()=>(
						<div className={styles.pane}>
							{deepLoading ? <div style={{ padding: '4px 12px', color: 'var(--horosa-text-tertiary, #999)', fontSize: 12 }}>会话记录载入中…</div> : null}
							{renderHistoryPane()}
						</div>
					)}</FreezeSubTab>
					</TabPane>
					<TabPane tab={<span>{SECONDARY_TABS[2].icon}资料</span>} key="materials">
						<FreezeSubTab active={innerTab === 'materials'}>{()=>(
						<div className={styles.pane}>
							{deepLoading ? <div style={{ padding: '4px 12px', color: 'var(--horosa-text-tertiary, #999)', fontSize: 12 }}>资料库载入中…</div> : null}
							{renderMaterialsPane()}
						</div>
					)}</FreezeSubTab>
					</TabPane>
					<TabPane tab={<span>{SECONDARY_TABS[3].icon}模版</span>} key="templates">
						<FreezeSubTab active={innerTab === 'templates'}>{()=>(
						<div className={styles.pane}>{renderTemplatesPane()}</div>
					)}</FreezeSubTab>
					</TabPane>
					<TabPane tab={<span>{SECONDARY_TABS[4].icon}设置</span>} key="settings">
						<FreezeSubTab active={innerTab === 'settings'}>{()=>(
						<div className={styles.pane}>{renderSettingsPane()}</div>
					)}</FreezeSubTab>
					</TabPane>
					<TabPane tab={<span>{SECONDARY_TABS[5].icon}进阶</span>} key="advanced">
						<div className={styles.pane}>{renderAdvancedPane()}</div>
					</TabPane>
				</Tabs>

			{renderMountDrawer()}
			{renderTechniqueSettingsDrawer()}
			<ChatAssistOverlays {...chatAssist.overlays} />

			<Modal
				title={editingMaterial ? '编辑资料' : '新建资料'}
				open={materialModalOpen}
				onOk={saveMaterialForm}
				onCancel={()=>{
					setMaterialModalOpen(false);
					setEditingMaterial(null);
				}}
			>
				<Form form={materialForm} layout="vertical">
					<Form.Item name="name" label="资料名称" rules={[{ required: true, message: '请输入资料名称' }]}>
						<Input />
					</Form.Item>
					{materialFolders.length ? (
						<Form.Item name="folderId" label="文件夹">
							<Select allowClear placeholder="不设文件夹">
								{materialFolders.map((item)=><Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>)}
							</Select>
						</Form.Item>
					) : null}
					<Form.Item name="tags" label="标签">
						<Input placeholder="支持逗号分隔" />
					</Form.Item>
					<Form.Item name="schools" label="流派" extra="可多选/自由输入；用于按流派过滤资料并注入流派提示。">
						<Select
							mode="tags"
							placeholder="如 子平派 / 盲派 / 北派飞星 等（不填 = 视为通用资料）"
							style={{ width: '100%' }}
							options={[
								{ value: '子平派', label: '子平派' },
								{ value: '盲派', label: '盲派' },
								{ value: '新派（段建业）', label: '新派（段建业）' },
								{ value: '滴天髓派', label: '滴天髓派' },
								{ value: '神峰通考派', label: '神峰通考派' },
								{ value: '北派飞星', label: '北派飞星' },
								{ value: '中州派', label: '中州派' },
								{ value: '三合派', label: '三合派' },
								{ value: '钦天四化派', label: '钦天四化派' },
							]}
						/>
					</Form.Item>
					<Form.Item name="extractedText" label="资料内容" rules={[{ required: true, message: '请输入资料内容' }]}>
						<TextArea rows={10} />
					</Form.Item>
				</Form>
			</Modal>

			<Modal
				title={editingTemplate ? '编辑模版' : '新建模版'}
				open={templateModalOpen}
				width={960}
				onOk={saveTemplateForm}
				onCancel={()=>{
					setTemplateModalOpen(false);
					setEditingTemplate(null);
				}}
			>
				<Form form={templateForm} layout="vertical">
					<Form.Item name="name" label="模版名称" rules={[{ required: true, message: '请输入模版名称' }]}>
						<Input />
					</Form.Item>
					<Form.Item name="format" label="模版格式" rules={[{ required: true, message: '请选择模版格式' }]}>
						<Select>
							<Select.Option value="text">文字</Select.Option>
							<Select.Option value="json">JSON</Select.Option>
						</Select>
					</Form.Item>
					<Form.Item shouldUpdate noStyle>
						{({ getFieldValue })=>{
							const format = getFieldValue('format');
							const body = `${getFieldValue('instructionText') || ''}\n${getFieldValue('jsonSchema') || ''}\n${getFieldValue('exampleInput') || ''}\n${getFieldValue('exampleOutput') || ''}`;
							const KNOWN_VARS = ['user_prompt', 'source_context', 'retrieved_context', 'conversation_history', 'system_prompt'];
							const usedVars = Array.from(new Set((body.match(/\{\{\s*([\w.]+)\s*\}\}/g) || []).map((m)=>m.replace(/[\{\}\s]/g, ''))));
							const unknownVars = usedVars.filter((v)=>KNOWN_VARS.indexOf(v) < 0 && v.indexOf('.') < 0);
							let schemaErr = null;
							if(format === 'json'){
								const raw = `${getFieldValue('jsonSchema') || ''}`.trim();
								if(raw){
									try{ JSON.parse(raw); }catch(e){ schemaErr = e && e.message ? e.message : '无法解析 JSON Schema'; }
								}
							}
							return (
								<div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16 }}>
									<div>
										{format === 'json' ? (
											<>
												<Form.Item name="instructionText" label="说明文字">
													<TextArea rows={3} placeholder="可选，用于说明模型应该如何输出 JSON" />
												</Form.Item>
												<Form.Item name="jsonSchema" label="JSON Schema" rules={[JSON_TEXT_RULE, { required: true, message: '请输入 JSON Schema' }]}>
													<MonacoEditor height="240px" defaultLanguage="json" beforeMount={configureMonaco} />
												</Form.Item>
												<Form.Item name="exampleInput" label="示例输入" rules={[JSON_TEXT_RULE]}>
													<MonacoEditor height="180px" defaultLanguage="json" beforeMount={configureMonaco} />
												</Form.Item>
												<Form.Item name="exampleOutput" label="示例输出" rules={[JSON_TEXT_RULE]}>
													<MonacoEditor height="180px" defaultLanguage="json" beforeMount={configureMonaco} />
												</Form.Item>
											</>
										) : (
											<>
												<Form.Item name="instructionText" label="模版内容" rules={[{ required: true, message: '请输入模版内容' }]}>
													<TextArea rows={10} placeholder="支持 {{user_prompt}} / {{source_context}} / {{retrieved_context}} / {{conversation_history}} / {{system_prompt}}" />
												</Form.Item>
												<Form.Item name="exampleInput" label="示例输入" rules={[JSON_TEXT_RULE]}>
													<MonacoEditor height="180px" defaultLanguage="json" beforeMount={configureMonaco} />
												</Form.Item>
												<Form.Item name="exampleOutput" label="示例输出">
													<TextArea rows={6} />
												</Form.Item>
											</>
										)}
									</div>
									<div>
										<div style={{ fontSize: 12, color: 'var(--horosa-text-soft)', marginBottom: 6 }}>变量推断（已用 {usedVars.length} 个）</div>
										<div className={styles.templateVarSidebar}>
											{usedVars.length === 0 ? (
												<div style={{ color: 'var(--horosa-text-soft)', fontSize: 12 }}>未检测到 {`{{变量}}`}。常用：<br />user_prompt · source_context · retrieved_context · conversation_history · system_prompt</div>
											) : usedVars.map((v)=>(
												<div key={v} className={styles.templateVarItem + ' ' + (KNOWN_VARS.indexOf(v) < 0 && v.indexOf('.') < 0 ? styles.templateVarItemMissing : '')}>
													<span>{'{{'}{v}{'}}'}</span>
													{KNOWN_VARS.indexOf(v) < 0 && v.indexOf('.') < 0 ? <Tooltip title="不在已知变量列表中——发送时可能解析不到"><span style={{ fontSize: 10 }}>?</span></Tooltip> : null}
												</div>
											))}
											{unknownVars.length ? <div style={{ marginTop: 8, fontSize: 11, color: 'var(--horosa-warning, #faad14)' }}>未知变量：{unknownVars.join(', ')}</div> : null}
										</div>
										{format === 'json' ? (
											<>
												<div style={{ marginTop: 12, fontSize: 12, color: 'var(--horosa-text-soft)' }}>JSON Schema 校验</div>
												<div className={styles.templateVarSidebar} style={{ marginTop: 6 }}>
													{schemaErr ? (
														<div style={{ color: 'var(--horosa-error, #ff4d4f)' }}>❌ {schemaErr}</div>
													) : (
														<div style={{ color: 'var(--horosa-success, #52c41a)' }}>✓ Schema 解析通过</div>
													)}
												</div>
											</>
										) : null}
									</div>
								</div>
							);
						}}
					</Form.Item>
				</Form>
			</Modal>

			<Modal
				title={bundlePreview ? `组合预览 · ${bundlePreview.name}` : ''}
				open={!!bundlePreview}
				width={560}
				footer={(
					<Space>
						<Button onClick={()=>setBundlePreview(null)}>关闭</Button>
						<Button type="primary" onClick={()=>{ applyBundle(bundlePreview); setBundlePreview(null); }}>立即应用</Button>
					</Space>
				)}
				onCancel={()=>setBundlePreview(null)}
			>
				{bundlePreview ? (()=>{
					const b = bundlePreview;
					const techs = Array.isArray(b.defaultTechniqueKeys) ? b.defaultTechniqueKeys : [];
					const mats = Array.isArray(b.defaultMaterialIds) && b.defaultMaterialIds.length ? b.defaultMaterialIds : (Array.isArray(b.materialIds) ? b.materialIds : []);
					const allowed = activeSource ? new Set(listAnalysisTechniqueOptions(activeSource).map((it)=>it.value)) : null;
					const fitTechs = allowed ? techs.filter((k)=>allowed.has(k)) : techs;
					const skipTechs = allowed ? techs.filter((k)=>!allowed.has(k)) : [];
					const matNames = mats.map((id)=>{
						const m = materials.find((x)=>x.id === id);
						return m ? m.name : `(已删除资料 ${id.slice(0,6)})`;
					});
					const techLabel = (k)=>(listAllAnalysisTechniqueOptions().find((it)=>it.value === k) || {}).label || k;
					return (
						<div>
							<p style={{ color: 'var(--horosa-text-soft)' }}>套用此组合后，将自动设置以下配置：</p>
							<ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
								<li><b>系统提示：</b>{b.defaultSystemPrompt ? <span>已设置（{(b.defaultSystemPrompt || '').slice(0, 50)}…）</span> : '不覆盖'}</li>
								<li><b>默认模型：</b>{b.defaultModel ? `${b.defaultProviderProfileId ? '指定接口·' : ''}${b.defaultModel}` : '不覆盖'}</li>
								<li><b>默认温度：</b>{b.defaultChatTemperature != null ? b.defaultChatTemperature : '不覆盖'}</li>
								<li><b>默认 top_p：</b>{b.defaultChatTopP != null ? b.defaultChatTopP : '不覆盖'}</li>
								{/* [Q-062/AW-36] 显示中文标签,不再漏内部代码 */}
								<li><b>默认思考档：</b>{b.defaultThinkingLevel ? thinkingLevelLabel(b.defaultThinkingLevel) : '不覆盖'}</li>
								<li><b>默认检索策略：</b>{retrievalModeLabel(b.defaultRetrievalMode)}</li>
								<li><b>挂载资料 ({matNames.length})：</b>{matNames.length ? matNames.join('、') : '无'}</li>
								<li><b>挂载技法 ({techs.length})：</b>
									{techs.length === 0 ? '无' : (
										<div>
											<div style={{ marginTop: 4 }}>{fitTechs.length ? <span>当前案例可挂载 {fitTechs.length} 项：{fitTechs.map(techLabel).join('、')}</span> : <span style={{ color: 'var(--horosa-text-soft)' }}>当前案例下无可挂载（待你选定支持此组的案例）</span>}</div>
											{skipTechs.length ? <div style={{ marginTop: 4, color: 'var(--horosa-text-soft)' }}>跳过 {skipTechs.length} 项（不适用当前案例类型）：{skipTechs.map(techLabel).join('、')}</div> : null}
										</div>
									)}
								</li>
							</ul>
							<p style={{ marginTop: 12, color: 'var(--horosa-text-soft)', fontSize: 12 }}>
								{activeSource ? '已选案例：' + activeSource.title : '尚未选定案例——选定后会按交集自动挂载支持的技法。'}
							</p>
						</div>
					);
				})() : null}
			</Modal>

			<Drawer
				title="管理文件夹"
				open={folderDrawerOpen}
				onClose={()=>setFolderDrawerOpen(false)}
				width={420}
			>
				<div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
					<Input value={folderDraftName} placeholder="新文件夹名称" onChange={(e)=>setFolderDraftName(e.target.value)} onPressEnter={handleCreateFolder} style={{ flex: 1 }} />
					<Button type="primary" onClick={handleCreateFolder} icon={<XQIcon name="plus" />}>新建</Button>
				</div>
				{materialFolders.length === 0 ? (
					<Empty description="还没有文件夹" />
				) : (
					<div>
						{materialFolders.map((folder)=>{
							const cnt = materials.filter((m)=>m.folderId === folder.id).length;
							return (
								<div key={folder.id} className={styles.folderRow}>
									<XQIcon name="folder" />
									<span className={styles.folderRowName}>{folder.name}</span>
									<span style={{ color: 'var(--horosa-text-soft)', fontSize: 12 }}>{cnt} 份</span>
									<Button size="small" type="link" onClick={()=>handleRenameFolder(folder)}>重命名</Button>
									<Button size="small" type="link" danger onClick={()=>handleDeleteFolder(folder)}>删除</Button>
								</div>
							);
						})}
					</div>
				)}
				<div style={{ marginTop: 14, fontSize: 12, color: 'var(--horosa-text-soft)' }}>
					资料的「移动到…」请在资料列表/卡片操作里点选。
				</div>
			</Drawer>

			<Modal
				title="模板版本对比"
				open={!!versionDiffState}
				width={960}
				footer={null}
				onCancel={()=>setVersionDiffState(null)}
			>
				{versionDiffState ? renderTemplateVersionDiff() : null}
			</Modal>

			<Modal
				title={editingBundle ? (normalizeSkillPack(editingBundle) ? '编辑组合（技能包）' : '编辑组合') : '新建组合'}
				open={bundleModalOpen}
				width={720}
				onOk={saveBundleForm}
				onCancel={()=>{
					setBundleModalOpen(false);
					setEditingBundle(null);
				}}
			>
				<Form form={bundleForm} layout="vertical">
					<Form.Item name="name" label="组合名称" rules={[{ required: true, message: '请输入组合名称' }]}>
						<Input />
					</Form.Item>
					<Form.Item name="templateId" label="绑定模版">
						<Select allowClear placeholder="可选">
							{templates.map((item)=>(
								<Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>
							))}
						</Select>
					</Form.Item>
					<Form.Item name="materialIds" label="默认资料">
						<Select mode="multiple" allowClear placeholder="可多选">
							{materials.map((item)=>(
								<Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>
							))}
						</Select>
					</Form.Item>
					<Form.Item name="defaultModelSelection" label="默认模型">
						<Select allowClear placeholder="可选">
							{modelOptions.map((item)=>(
								<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
							))}
						</Select>
					</Form.Item>
					<Form.Item name="defaultEmbeddingModel" label="默认 Embedding 模型">
						<Input placeholder="可留空" />
					</Form.Item>
					<Form.Item name="defaultSystemPrompt" label="默认系统提示词">
						<TextArea rows={5} />
					</Form.Item>
					<Form.Item name="defaultRetrievalMode" label="默认检索策略">
						<Select>
							{RETRIEVAL_OPTIONS.map((item)=><Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
						</Select>
					</Form.Item>
					<Form.Item name="defaultTechniqueKeys" label="默认挂载技法（套用后按所选案例自动挂载）"
						extra={(()=>{ const sk = normalizeSkillPack(editingBundle); return sk ? `此组合是技能包（/${sk.triggers[0] || '?'} · v${sk.version}）：保存时这里的技法同步写入技能（技能升版并留档）；触发词 / 模板等技能字段在 AI 助手「技能包」卡编辑。` : undefined; })()}
					>
						<Select mode="multiple" allowClear showSearch optionFilterProp="children" placeholder="可多选：套用组合并选定案例后自动挂载">
							{listAllAnalysisTechniqueOptions().map((item)=>(
								<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
							))}
						</Select>
					</Form.Item>
					<Form.Item label="默认生成参数（留空＝沿用当前设置、不覆盖）">
						<Space size={12} wrap>
							<span>温度</span>
							<Form.Item name="defaultChatTemperature" noStyle><InputNumber min={0} max={2} step={0.1} placeholder="不覆盖" style={{ width: 110 }} /></Form.Item>
							<span>top_p</span>
							<Form.Item name="defaultChatTopP" noStyle><InputNumber min={0} max={1} step={0.05} placeholder="不覆盖" style={{ width: 110 }} /></Form.Item>
							<span>思考档</span>
							<Form.Item name="defaultThinkingLevel" noStyle><Select allowClear placeholder="不覆盖" style={{ width: 130 }}>{THINKING_LEVELS.map((t)=><Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>)}</Select></Form.Item>
						</Space>
					</Form.Item>
				</Form>
			</Modal>

			<Modal
				title="生效 API"
				open={providerSwitchModalOpen}
				width={720}
				footer={null}
				bodyStyle={{ maxHeight: 'calc(100 * var(--horosa-lvh, 1vh) - 220px)', overflowY: 'auto' }}
				onCancel={()=>setProviderSwitchModalOpen(false)}
			>
				{providerProfiles.length ? (
					<div className={styles.providerSwitchList}>
						{providerProfiles.map((profile)=>{
							const models = normalizeProfileModels(profile);
							const isCurrent = activeProviderProfile && activeProviderProfile.id === profile.id;
							const displayName = profile.name || getProviderDisplayName(profile.providerType);
							return (
								<div
									key={profile.id}
									role="button"
									title={isCurrent ? '当前使用中' : (profile.enabled === false ? '该接口未启用,先在「编辑」里打开「启用」' : '点击设为当前')}
									style={{ cursor: (isCurrent || profile.enabled === false) ? 'default' : 'pointer' }}
									onClick={()=>{ if(!isCurrent && profile.enabled !== false){ setProviderAsCurrent(profile); } }}
									className={[
										styles.providerSwitchItem,
										isCurrent ? styles.providerSwitchItemActive : '',
									].filter(Boolean).join(' ')}
								>
									<div className={styles.providerSwitchMain}>
										<div className={styles.providerSwitchTitle}>
											<strong>{displayName}</strong>
											{isCurrent ? <Tag color="blue">当前</Tag> : null}
											{profile.enabled === false ? <Tag>未启用</Tag> : <Tag color="green">已启用</Tag>}
											{profile.apiKeyDecryptFailed ? <Tag color="orange" title="主密钥缺失,库内密文解不开;未重填前原密文保留">Key 请重填</Tag> : null}
											{profile.extraHeadersDecryptFailed ? <Tag color="orange" title="额外请求头里的令牌解不开;未重填前原密文保留">请求头令牌请重填</Tag> : null}
										</div>
										<div className={styles.providerSwitchMeta}>
											<span>类型：{getProviderDisplayName(profile.providerType)}</span>
											<span>协议族：{profile.protocolFamily || getProviderProtocolFamily(profile.providerType)}</span>
											<span>模型：{models[0] || '未配置'}</span>
										</div>
										{profile.baseUrl ? (
											<div className={styles.providerSwitchUrl}>{profile.baseUrl}</div>
										) : null}
									</div>
									<Space>
										<Button
											size="small"
											disabled={isCurrent || profile.enabled === false}
											title={profile.enabled === false ? '未启用的接口不能设为当前(先在「编辑」里打开「启用」)' : undefined}
											onClick={(e)=>{ e.stopPropagation(); setProviderAsCurrent(profile); }}
										>
											{isCurrent ? '当前' : '设为当前'}
										</Button>
										<Button
											type="primary"
											size="small"
											icon={<XQIcon name="edit" />}
											onClick={(e)=>{
												e.stopPropagation();
												setProviderSwitchModalOpen(false);
												openProviderEditor(profile);
											}}
										>
											编辑
										</Button>
									</Space>
								</div>
							);
						})}
					</div>
				) : (
					<Empty description="暂无接口配置" />
				)}
			</Modal>

			<Modal
				title={editingProvider ? '编辑接口配置' : '新增接口配置'}
				open={providerModalOpen}
				width={720}
				bodyStyle={{ maxHeight: 'calc(100 * var(--horosa-lvh, 1vh) - 220px)', overflowY: 'auto' }}
				onOk={saveProviderForm}
				onCancel={()=>{
					setProviderModalOpen(false);
					setProviderAdvancedOpen(false);
					setEditingProvider(null);
				}}
			>
				<Form
					form={providerForm}
					layout="vertical"
					onValuesChange={(changedValues)=>{
						if(changedValues.providerType){
							applyProviderPresetToForm(changedValues.providerType);
						}
					}}
				>
					<Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入配置名称' }]}>
						<Input />
					</Form.Item>
					<Form.Item name="providerType" label="供应商预设" rules={[{ required: true, message: '请选择接口类型' }]}>
						<Select>
							{PROVIDER_OPTIONS.map((item)=>(
								<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
							))}
						</Select>
					</Form.Item>
					<Form.Item shouldUpdate={(prev, cur)=>prev.providerType !== cur.providerType} noStyle>
						{({ getFieldValue })=>{
							const pt = getFieldValue('providerType') || '';
							const ph = pt === 'anthropic' ? 'sk-ant-...' :
								(pt === 'openai' || pt === 'deepseek' || pt === 'openrouter' || pt === 'groq' || pt === 'siliconflow') ? 'sk-...' :
								pt === 'ollama' ? '可留空（本地服务）' : '留空表示不设置';
							return (
								<Form.Item name="apiKey" label="API Key" extra={editingProvider && editingProvider.apiKeyDecryptFailed ? '当前 Key 密文无法解密(主密钥缺失):留空保存则原密文原样保留,填入新 Key 则覆盖。' : 'Key 只存本机(桌面版静态加密,主密钥由系统钥匙串保管),不入库、不出站;只随你的请求发给所选接口。'}>
									<AntdInput.Password
										placeholder={ph}
										autoComplete="off"
										onChange={(e)=>{
											const v = `${e.target.value || ''}`;
											const cleaned = v.replace(/[\s\n\r]+$/, '').replace(/^\s+/, '');
											if(cleaned !== v){
												// 防被粘贴 .env 时拖入的换行/空白污染。
												providerForm.setFieldsValue({ apiKey: cleaned });
											}
										}}
									/>
								</Form.Item>
							);
						}}
					</Form.Item>
					<Form.Item name="baseUrl" label="Base URL">
						<Input />
					</Form.Item>
					<Form.Item shouldUpdate noStyle>
						{({ getFieldValue })=>(
							<div className={styles.cardMeta}>
								<div>协议族：{getProviderProtocolFamily(getFieldValue('providerType') || 'openai')}</div>
							</div>
						)}
					</Form.Item>
					<div className={styles.providerAdvancedToggle}>
						<Button
							className={styles.providerAdvancedButton}
							icon={<XQIcon name="sliders" />}
							onClick={()=>setProviderAdvancedOpen((prev)=>!prev)}
						>
							{providerAdvancedOpen ? '收起高级参数' : '展开高级参数'}
						</Button>
					</div>
					{providerAdvancedOpen ? (
						<div className={styles.providerAdvancedPanel}>
							<Collapse ghost defaultActiveKey={['models']}>
								<Collapse.Panel key="models" header="模型清单 / 请求调优" forceRender>
									<Form.Item name="manualModels" label="聊天模型列表">
										<TextArea rows={4} />
									</Form.Item>
									<Form.Item name="embeddingModels" label="Embedding 模型列表">
										<TextArea rows={3} />
									</Form.Item>
									<Form.Item name="requestTimeoutMs" label="请求超时（毫秒）" extra="作用于连接与首响应头、以及非流式请求（测试连接/拉模型/取材料）；流式对话正文不受此限。范围 1000–600000（1 秒–10 分钟），前后端同一个数">
										<Input />
									</Form.Item>
									<Form.Item name="streamStallMs" label="流式空闲上限（毫秒）" extra="连续无新内容多久判卡死，空=180000（3 分钟）；深思模型经中转网关频繁报「无新内容」可调大">
										<Input placeholder="180000" />
									</Form.Item>
									<Form.Item name="streamMaxStreamMs" label="流式总时长上限（毫秒）" extra="单次生成绝对上限，空=1800000（30 分钟）；防龟速流永不收尾">
										<Input placeholder="1800000" />
									</Form.Item>
								</Collapse.Panel>
								<Collapse.Panel key="auth" header="鉴权定制（自定义请求头）" forceRender>
									<Form.Item name="extraHeadersText" label="额外请求头（JSON 对象）" extra={editingProvider && editingProvider.extraHeadersDecryptFailed ? '有头值密文无法解密(主密钥缺失):值留空保存则原密文原样保留,填入新值则覆盖。' : '值与 API Key 同样只存本机并静态加密,不进备份。'} rules={[JSON_TEXT_RULE]}>
										<MonacoEditor height="140px" defaultLanguage="json" beforeMount={configureMonaco} />
									</Form.Item>
								</Collapse.Panel>
								{/* [Q-062/AW-35] 标题改真话:这些键在后端**最先**放进请求体,与表单字段或分析页参数同名时会被后者覆盖 —— 是「补充」不是「覆盖」 */}
								<Collapse.Panel key="body" header="额外请求体字段（厂家私有参数；同名键以表单与页面参数为准）" forceRender>
									<Form.Item name="extraBodyText" label="额外请求体（JSON 对象）" rules={[JSON_TEXT_RULE]}>
										<MonacoEditor height="140px" defaultLanguage="json" beforeMount={configureMonaco} />
									</Form.Item>
									<Form.Item name="providerOptionsText" label="补充高级参数（JSON）" rules={[JSON_TEXT_RULE]}>
										<MonacoEditor height="160px" defaultLanguage="json" beforeMount={configureMonaco} />
									</Form.Item>
								</Collapse.Panel>
							</Collapse>
						</div>
					) : null}
					<Form.Item shouldUpdate noStyle>
						{({ getFieldValue })=>{
							const providerType = getFieldValue('providerType');
							if(providerType === 'anthropic'){
								return (
									<>
										<Form.Item name="anthropicApiVersion" label="Anthropic API Version" extra="这是固定的 API 版本号（不是「当前日期」）。普通用户保持默认 2023-06-01 即可，无需改动。">
											<Select
												placeholder="默认 2023-06-01"
												options={[
													{ value: '2023-06-01', label: '2023-06-01（推荐 · 默认）' },
													{ value: '2023-01-01', label: '2023-01-01（旧版）' },
												]}
											/>
										</Form.Item>
										<Form.Item name="anthropicMaxTokens" label="Anthropic max_tokens">
											<Input placeholder="如 2048" />
										</Form.Item>
										<Form.Item name="anthropicThinkingBudget" label="思考预算上限" extra="仅思考档开启时生效(预算型号 budget_tokens 与档位取小;自适应型号忽略);关闭档不发思考">
											<Input placeholder="如 8192" />
										</Form.Item>
										<Form.Item name="anthropicTopP" label="Anthropic top_p">
											<Input placeholder="如 0.9" />
										</Form.Item>
										<Form.Item name="anthropicTopK" label="Anthropic top_k">
											<Input placeholder="如 40" />
										</Form.Item>
									</>
								);
							}
							if(providerType === 'gemini'){
								return (
									<>
										<Form.Item name="geminiGenerationConfigText" label="Gemini generationConfig" rules={[JSON_TEXT_RULE]}>
											<MonacoEditor height="180px" defaultLanguage="json" beforeMount={configureMonaco} />
										</Form.Item>
										<Form.Item name="geminiSafetySettingsText" label="Gemini safetySettings" rules={[JSON_TEXT_RULE]}>
											<MonacoEditor height="180px" defaultLanguage="json" beforeMount={configureMonaco} />
										</Form.Item>
									</>
								);
							}
							if(providerType === 'ollama'){
								return (
									<>
										<Form.Item name="ollamaKeepAlive" label="Ollama keep_alive">
											<Input placeholder="如 5m" />
										</Form.Item>
										<Form.Item name="ollamaNumCtx" label="Ollama num_ctx">
											<Input placeholder="如 8192" />
										</Form.Item>
										<Form.Item name="ollamaNumPredict" label="Ollama num_predict">
											<Input placeholder="如 1024" />
										</Form.Item>
										<Form.Item name="ollamaTopK" label="Ollama top_k">
											<Input placeholder="如 40" />
										</Form.Item>
										<Form.Item name="ollamaTopP" label="Ollama top_p">
											<Input placeholder="如 0.9" />
										</Form.Item>
										<Form.Item name="ollamaRepeatPenalty" label="Ollama repeat_penalty">
											<Input placeholder="如 1.1" />
										</Form.Item>
									</>
								);
							}
							return null;
						}}
					</Form.Item>
					<Form.Item name="enabled" label="启用此配置" valuePropName="checked">
						<Switch />
					</Form.Item>
				</Form>
			</Modal>

			<Drawer
				title={previewTemplate ? `模版预览 · ${previewTemplate.name}` : '模版预览'}
				open={previewDrawerOpen}
				width={520}
				onClose={()=>{
					setPreviewDrawerOpen(false);
					setPreviewTemplate(null);
				}}
			>
				{previewTemplate && previewResult ? (
					<div>
						<div className={styles.previewMeta}>
							<Tag>{previewTemplate.format}</Tag>
							<Tag>版本 {templateVersions.filter((item)=>item.templateId === previewTemplate.id).length}</Tag>
						</div>
						<pre className={styles.previewCode}>{previewResult.text}</pre>
						{previewResult.errors && previewResult.errors.length ? (
							<div className={styles.previewErrors}>
								<Title level={5}>Schema 校验</Title>
								{previewResult.errors.map((item, idx)=>(
									<div key={idx} className={styles.errorLine}>{item.message || JSON.stringify(item)}</div>
								))}
							</div>
						) : (
							<Text type="secondary">Schema 校验通过</Text>
						)}
					</div>
				) : null}
			</Drawer>
		</div>
	);
}

// [A7·性能] 函数组件版 sCU:memo + 全 props 机械浅比(函数型恒等;开关 horosa.perf.chartSCU
// 关=恒重渲旧行为)。收益:激活态下宿主无关 dispatch 不再整树重渲 AI 页(其树极重)。
export default React.memo(AIAnalysisMain, (prevProps, nextProps)=>wrapperPropsEqual(prevProps, nextProps));
