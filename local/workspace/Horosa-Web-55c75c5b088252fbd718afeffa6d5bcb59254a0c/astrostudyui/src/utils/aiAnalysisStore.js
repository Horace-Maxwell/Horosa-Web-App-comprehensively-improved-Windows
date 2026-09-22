import { safeLocalStorageSet } from './safeStorage';
import {
	getProviderDefaultChatModels,
	getProviderDefaultEmbeddingModels,
	getProviderDisplayName,
	getProviderProtocolFamily,
} from './aiAnalysisProviders';
import { contextCachePruneEnabled } from './perfFlags';
import { encryptSecretText, decryptSecretText, isEncryptedSecret, canEncryptSecrets } from './secureKeyStore';

// [P1-S1] 备份排除集:context_cache 是「按源+模式」的派生缓存(挂载快照原文,单库可达数十 MB),
// 命中判据是 sourceUpdatedAt,换机/恢复后按需重建即可——入包只会让备份体积暴涨且恢复后立刻失效。
// 消费方:AI 工作区导出/恢复(AIAnalysisMain)、统一备份(unifiedBackup);两处共用本集合。
export const AI_ANALYSIS_SCHEMA_VERSION = 5;

export const AI_ANALYSIS_STORES = {
	providerProfiles: 'provider_profiles',
	materials: 'materials',
	materialFolders: 'material_folders',
	tagGroups: 'tag_groups',
	materialChunks: 'material_chunks',
	materialEmbeddings: 'material_embeddings',
	templates: 'templates',
	templateVersions: 'template_versions',
	bundles: 'bundles',
	conversations: 'conversations',
	messages: 'messages',
	contextCache: 'context_cache',
	workspaceMeta: 'workspace_meta',
	// [P1 任务中心] 任务实体/通知/自动规则/集成档案(联网检索等第三方 key;apiKey 与 provider_profiles 同一加密钩)
	agentTasks: 'agent_tasks',
	agentNotices: 'agent_notices',
	automationRules: 'automation_rules',
	integrationProfiles: 'integration_profiles',
	reportTemplates: 'report_templates',
	reportInstances: 'report_instances',
};

export const AI_BACKUP_EXCLUDED_STORES = Object.freeze([AI_ANALYSIS_STORES.contextCache]);

const DB_NAME = 'horosa.ai.analysis.v1';
// 5→6:不建新表,只在既有 store 上幂等补建二级索引(EXTRA_INDEXES:messages.conversationId 等),
// 让「按会话读消息 / 按会话删消息」走索引,不再全表 getAll 后 filter(消息累积到万级后的主线程冻结点)。
// 🔴 升版是发布级动作:旧构建打开 v6 库会 VersionError(经 openDb 失败路径落内存回退,AI 模块可用
// 但数据暂不可见)——必须与版本号同车发布,不得热改。
// 6→7:新建 agent_tasks / agent_notices / automation_rules / integration_profiles 四 store(onupgradeneeded 按 AI_ANALYSIS_STORES 自动补建,
// 零迁移;二级索引见 EXTRA_INDEXES)。🔴 升版是发布级动作:与版本号同车,不得热改(旧构建打开新库=内存回退)。
const DB_VERSION = 7;
export const AI_ANALYSIS_DB_VERSION = DB_VERSION;
const UI_PREF_KEY = 'horosa.ai.analysis.ui.v3';
const MEMORY_DB = new Map();

// 二级索引表(store 名 → [索引名, keyPath] 列表):ensureIndexes 在基础三索引之后按本表幂等补建。
// 字段来源:messages.conversationId/createdAt(saveConversationMessage)、material_chunks.materialId
// (aiAnalysisRag 切块)、material_embeddings.materialId(aiAnalysisRag 向量落库)、
// template_versions.templateId(ensureTemplateVersion)。migrateRecord 对缺失字段一律补 null,
// null 不是合法索引键,此类记录只是不进索引,不会报错。
export const EXTRA_INDEXES = {
	[AI_ANALYSIS_STORES.messages]: [
		['conversationId', 'conversationId'],
		['conversationCreated', ['conversationId', 'createdAt']],
	],
	[AI_ANALYSIS_STORES.materialChunks]: [['materialId', 'materialId']],
	[AI_ANALYSIS_STORES.materialEmbeddings]: [['materialId', 'materialId']],
	[AI_ANALYSIS_STORES.templateVersions]: [['templateId', 'templateId']],
	[AI_ANALYSIS_STORES.agentTasks]: [['status', 'status'], ['kind', 'kind'], ['nextRunAt', 'nextRunAt']],
	[AI_ANALYSIS_STORES.agentNotices]: [['createdAt', 'createdAt']],
	[AI_ANALYSIS_STORES.automationRules]: [['event', 'event']],
	[AI_ANALYSIS_STORES.integrationProfiles]: [['kind', 'kind']],
};

// IndexedDB 访问计数(只统计真实 IndexedDB 路径,内存回退不计)。排查「读消息为何仍全表扫」时,
// 控制台置 localStorage['horosa.debug.idbStats']='1' 后刷新,即可从 window.__horosaIdbStats 读实时值。
const IDB_STATS = { getAll: 0, indexGetAll: 0, indexCursor: 0, cursorDelete: 0, put: 0, delete: 0, fallback: 0 };

export function getIdbStatsForDebug(){
	return { ...IDB_STATS };
}

export function __resetIdbStatsForTests(){
	Object.keys(IDB_STATS).forEach((k)=>{ IDB_STATS[k] = 0; });
}

try{
	if(typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('horosa.debug.idbStats') === '1'){
		window.__horosaIdbStats = IDB_STATS;
		// 规模探针用的只读/维护钩(同一个 debug 开关):让页面外的度量脚本能调到真函数,
		// 而不是自己直写 IndexedDB —— 直写绕过应用写路径,量到的东西跟线上行为无关。
		window.__horosaAiStoreDebug = {
			prune: pruneContextCache, count: countStoreRecords, clear: clearStore, stats: getIdbStatsForDebug,
			// [M7] 任务表裁剪走真函数(惰性载入任务层,避免存储层反向吃进任务模块)
			pruneTasks: (o)=>import('./aiAgent/tasks/taskStore').then((m)=>m.pruneTasks(o)),
		};
	}
}catch(e){
	// 调试钩子缺席无害
}

Object.keys(AI_ANALYSIS_STORES).forEach((key)=>{
	MEMORY_DB.set(AI_ANALYSIS_STORES[key], new Map());
});

let openDbPromise = null;
let upgradeBlockedWarned = false;

function randomStr(len = 8){
	const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
	let txt = '';
	for(let i=0; i<len; i++){
		txt += chars[Math.floor(Math.random() * chars.length)];
	}
	return txt;
}

function canUseIndexedDb(){
	try{
		return typeof window !== 'undefined' && !!window.indexedDB;
	}catch(e){
		return false;
	}
}

function nowIso(){
	return new Date().toISOString();
}

function ensureRecordId(record, prefix = 'aianalysis'){
	if(record && record.id){
		return record.id;
	}
	return `${prefix}-${Date.now()}-${randomStr(8)}`;
}

function clonePlain(obj){
	if(obj === undefined || obj === null){
		return obj;
	}
	try{
		return JSON.parse(JSON.stringify(obj));
	}catch(e){
		return obj;
	}
}

// 幂等补建索引:基础三索引(全 store)+ EXTRA_INDEXES 二级索引(按 store.name 查表)。
// 只在 onupgradeneeded 的版本变更事务里调用;indexNames.contains 判断保证重复调用零 createIndex。
export function ensureIndexes(store){
	if(!store.indexNames.contains('updatedAt')){
		store.createIndex('updatedAt', 'updatedAt', { unique: false });
	}
	if(!store.indexNames.contains('createdAt')){
		store.createIndex('createdAt', 'createdAt', { unique: false });
	}
	if(!store.indexNames.contains('schemaVersion')){
		store.createIndex('schemaVersion', 'schemaVersion', { unique: false });
	}
	const extras = EXTRA_INDEXES[store.name] || [];
	extras.forEach(([name, keyPath])=>{
		if(!store.indexNames.contains(name)){
			store.createIndex(name, keyPath, { unique: false });
		}
	});
}

// 索引名 → keyPath(内存回退径按同一 keyPath 过滤,与 IndexedDB 索引语义一致;未登记的索引名视同字段名)。
function indexKeyPath(storeName, indexName){
	const hit = (EXTRA_INDEXES[storeName] || []).find(([name])=>name === indexName);
	return hit ? hit[1] : indexName;
}

function recordIndexValue(rec, keyPath){
	if(Array.isArray(keyPath)){
		return keyPath.map((k)=>rec[k]);
	}
	return rec[keyPath];
}

function indexValueEquals(a, b){
	if(Array.isArray(a) && Array.isArray(b)){
		return a.length === b.length && a.every((v, i)=>v === b[i]);
	}
	return a === b;
}

function normalizeArray(val){
	return Array.isArray(val) ? val : [];
}

function normalizeString(val){
	return `${val || ''}`.trim();
}

export function migrateRecord(storeName, record){
	const next = {
		...(record || {}),
	};
	if(!next.id){
		next.id = ensureRecordId(record, storeName);
	}
	if(!next.createdAt){
		next.createdAt = nowIso();
	}
	if(!next.updatedAt){
		next.updatedAt = next.createdAt;
	}
	switch(storeName){
	case AI_ANALYSIS_STORES.conversations:
		next.archived = next.archived === true;
		next.favorite = next.favorite === true;
		next.branchRootId = next.branchRootId || next.id;
		next.parentConversationId = next.parentConversationId || null;
		next.lastMessageAt = next.lastMessageAt || next.updatedAt || next.createdAt;
		next.referenceIds = normalizeArray(next.referenceIds);
		break;
	case AI_ANALYSIS_STORES.messages:
		next.streamStatus = next.streamStatus || 'done';
		next.regeneratedFromMessageId = next.regeneratedFromMessageId || null;
		next.editedFromMessageId = next.editedFromMessageId || null;
		next.branchConversationId = next.branchConversationId || null;
		break;
	case AI_ANALYSIS_STORES.materials:
		next.folderId = next.folderId || null;
		next.fileName = next.fileName || next.name || '未命名资料';
		next.fileExt = next.fileExt || '';
		next.tags = normalizeArray(next.tags);
		next.tagIds = normalizeArray(next.tagIds);
		next.schools = normalizeArray(next.schools);
		next.fileHash = next.fileHash || '';
		next.textHash = next.textHash || '';
		next.originBlob = next.originBlob || '';
		next.extractMeta = next.extractMeta || {};
		next.searchText = buildMaterialSearchText(next);
		break;
	case AI_ANALYSIS_STORES.templates:
		next.format = next.format || 'text';
		next.instructionText = next.instructionText !== undefined ? next.instructionText : (next.format === 'text' ? (next.content || '') : '');
		next.jsonSchema = next.jsonSchema !== undefined ? next.jsonSchema : (next.format === 'json' ? (next.content || '{\n  \"type\": \"object\"\n}') : '');
		next.exampleInput = next.exampleInput || '{\n  \"user_prompt\": \"请分析这个案例\"\n}';
		next.exampleOutput = next.exampleOutput || (next.format === 'json' ? '{\n  \"summary\": \"示例输出\"\n}' : '这是模版预览输出。');
		next.activeVersionId = next.activeVersionId || null;
		break;
	case AI_ANALYSIS_STORES.templateVersions:
		next.templateId = next.templateId || null;
		next.versionNumber = next.versionNumber || 1;
		next.snapshot = next.snapshot || {};
		break;
	case AI_ANALYSIS_STORES.bundles:
		next.templateId = next.templateId || null;
		next.materialIds = normalizeArray(next.materialIds);
		next.defaultMaterialIds = normalizeArray(next.defaultMaterialIds).length ? normalizeArray(next.defaultMaterialIds) : normalizeArray(next.materialIds);
		next.defaultProviderProfileId = next.defaultProviderProfileId || null;
		next.defaultModel = next.defaultModel || null;
		next.defaultEmbeddingModel = next.defaultEmbeddingModel || null;
		next.defaultSystemPrompt = next.defaultSystemPrompt || '';
		next.defaultRetrievalMode = next.defaultRetrievalMode || 'auto';
		// 组合包扩展（选模板→选盘自动套：挂载技法 + 资料 + 生成设置 + 系统提示）。
		next.defaultTechniqueKeys = normalizeArray(next.defaultTechniqueKeys);
		next.defaultChatTemperature = (next.defaultChatTemperature === undefined || next.defaultChatTemperature === '') ? null : next.defaultChatTemperature;
		next.defaultChatTopP = (next.defaultChatTopP === undefined || next.defaultChatTopP === '') ? null : next.defaultChatTopP;
		next.defaultThinkingLevel = next.defaultThinkingLevel || '';
		break;
	case AI_ANALYSIS_STORES.providerProfiles:
		next.providerType = next.providerType || 'openai';
		next.protocolFamily = next.protocolFamily || getProviderProtocolFamily(next.providerType);
		next.enabled = next.enabled !== false;
		next.name = next.name || getProviderDisplayName(next.providerType);
		next.chatModelIds = normalizeArray(next.chatModelIds).length
			? normalizeArray(next.chatModelIds)
			: normalizeArray(next.availableModels || next.manualModels).length
				? normalizeArray(next.availableModels || next.manualModels)
				: getProviderDefaultChatModels(next.providerType);
		// [Q-060/AW-16] 只在**字段缺席**时补预设。此前「长度为 0 就回填」让「清空 Embedding 模型列表」永远存不下去
		// (预设非空的三家),用户关不掉向量检索。旧档没有这个字段时仍照补 = 迁移语义不变。
		next.embeddingModelIds = next.embeddingModelIds === undefined || next.embeddingModelIds === null
			? getProviderDefaultEmbeddingModels(next.providerType)
			: normalizeArray(next.embeddingModelIds);
		next.manualModels = normalizeArray(next.manualModels);
		next.availableModels = normalizeArray(next.availableModels);
		next.providerOptions = next.providerOptions || {};
		if(!next.providerOptions.requestTimeoutMs){
			next.providerOptions.requestTimeoutMs = 120000;
		}
		next.lastDiagnostics = next.lastDiagnostics || null;
		next.healthStatus = next.healthStatus || 'unknown';
		break;
	case AI_ANALYSIS_STORES.materialFolders:
		next.name = next.name || '默认文件夹';
		next.parentId = next.parentId || null;
		break;
	case AI_ANALYSIS_STORES.tagGroups:
		next.name = next.name || '默认标签组';
		next.tags = normalizeArray(next.tags);
		break;
	case AI_ANALYSIS_STORES.materialChunks:
		next.materialId = next.materialId || null;
		next.chunkIndex = next.chunkIndex || 0;
		next.content = next.content || '';
		next.startOffset = next.startOffset || 0;
		next.endOffset = next.endOffset || next.content.length;
		next.searchText = normalizeString(next.searchText || next.content).toLowerCase();
		break;
	case AI_ANALYSIS_STORES.materialEmbeddings:
		next.materialId = next.materialId || null;
		next.chunkId = next.chunkId || null;
		next.providerProfileId = next.providerProfileId || null;
		next.embeddingModel = next.embeddingModel || '';
		next.vector = normalizeArray(next.vector);
		break;
	case AI_ANALYSIS_STORES.workspaceMeta:
		next.key = next.key || next.id;
		break;
	case AI_ANALYSIS_STORES.reportTemplates:
		next.technique = next.technique || 'bazi';
		next.granularity = next.granularity || 12;
		next.name = next.name || '未命名报告模板';
		next.sections = normalizeArray(next.sections);
		next.introSection = next.introSection || null;
		next.outroSection = next.outroSection || null;
		next.version = next.version || 1;
		next.schools = normalizeArray(next.schools);
		next.readOnly = next.readOnly !== false;
		break;
	case AI_ANALYSIS_STORES.reportInstances:
		next.templateId = next.templateId || null;
		next.templateVersion = next.templateVersion || 1;
		next.caseId = next.caseId || null;
		next.caseLabel = next.caseLabel || '';
		next.caseSnapshot = next.caseSnapshot || null;
		next.technique = next.technique || 'bazi';
		next.granularity = next.granularity || 12;
		next.schools = normalizeArray(next.schools);
		next.materialIds = normalizeArray(next.materialIds);
		next.sections = next.sections && typeof next.sections === 'object' ? next.sections : {};
		next.intro = next.intro || '';
		next.outro = next.outro || '';
		next.meta = next.meta || {};
		next.title = next.title || '';
		next.status = next.status || 'pending'; // pending | running | done | failed | cancelled
		next.embedCharts = next.embedCharts !== false;
		break;
	case AI_ANALYSIS_STORES.agentTasks:
		next.status = next.status || 'queued';
		next.kind = next.kind || 'goal';
		next.origin = next.origin || 'in-app';
		next.log = normalizeArray(next.log);
		next.nextRunAt = next.nextRunAt || null;
		break;
	case AI_ANALYSIS_STORES.agentNotices:
		next.level = next.level || 'info';
		next.read = next.read === true;
		break;
	case AI_ANALYSIS_STORES.automationRules:
		next.event = next.event || '';
		next.enabled = next.enabled === true;
		next.actions = normalizeArray(next.actions);
		break;
	case AI_ANALYSIS_STORES.integrationProfiles:
		next.kind = next.kind || '';
		next.enabled = next.enabled !== false;
		break;
	default:
		break;
	}
	next.schemaVersion = AI_ANALYSIS_SCHEMA_VERSION;
	return next;
}

export function buildMaterialSearchText(material){
	const item = material || {};
	return [
		item.name,
		item.fileName,
		normalizeArray(item.tags).join(' '),
		item.extractedText,
		item.mimeType,
		item.fileExt,
	].join(' ').toLowerCase();
}

// 版本变更事务体:缺的 store 建表,已有的 store 经升级事务取句柄,全部过 ensureIndexes 幂等补索引。
// db = IDBDatabase,tx = onupgradeneeded 时的 versionchange 事务(req.transaction)。
function applySchemaUpgrade(db, tx){
	Object.keys(AI_ANALYSIS_STORES).forEach((key)=>{
		const storeName = AI_ANALYSIS_STORES[key];
		let store = null;
		if(!db.objectStoreNames.contains(storeName)){
			store = db.createObjectStore(storeName, { keyPath: 'id' });
		}else{
			store = tx.objectStore(storeName);
		}
		ensureIndexes(store);
	});
}

export function __applySchemaUpgradeForTests(db, tx){
	return applySchemaUpgrade(db, tx);
}

function openDb(){
	if(!canUseIndexedDb()){
		return Promise.resolve(null);
	}
	if(openDbPromise){
		return openDbPromise;
	}
	openDbPromise = new Promise((resolve, reject)=>{
		const req = window.indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = ()=>{
			applySchemaUpgrade(req.result, req.transaction);
		};
		req.onblocked = ()=>{
			// 另一实例/页签仍握着旧版本连接,升版事务在等它关闭;只提示一次,不刷屏
			if(!upgradeBlockedWarned){
				upgradeBlockedWarned = true;
				console.warn('[aiAnalysisStore] IndexedDB 升版被旧连接阻塞,等待其关闭后继续');
			}
		};
		req.onsuccess = ()=>{
			const db = req.result;
			// 别处发起更高版本升级时本连接主动让位并清掉缓存句柄,下次访问重新 open(失败则落内存回退)
			db.onversionchange = ()=>{
				db.close();
				openDbPromise = null;
			};
			resolve(db);
		};
		req.onerror = ()=>{
			reject(req.error);
		};
	});
	return openDbPromise.catch((err)=>{
		// [D61] 打不开 IndexedDB(典型:同名库被更新版本升过 → VersionError)此前静默落内存回退,工作区显示为空无解释;
		//   现记健康态 + 派 DOM 事件,主页顶部横幅告知「内存模式 / 由更新版本创建」
		markStoreDegraded(err);
		openDbPromise = Promise.resolve(null);
		return openDbPromise;
	});
}

export const AI_STORE_DEGRADED_EVENT = 'horosa:ai-store-degraded';
const STORE_HEALTH = { degraded: false, reason: '', message: '', at: '' };
function markStoreDegraded(err){
	const name = err && err.name ? `${err.name}` : '';
	STORE_HEALTH.degraded = true;
	STORE_HEALTH.reason = name === 'VersionError' ? 'version' : 'open-failed';
	STORE_HEALTH.message = err && err.message ? `${err.message}` : name || 'IndexedDB open failed';
	STORE_HEALTH.at = nowIso();
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(AI_STORE_DEGRADED_EVENT, { detail: { ...STORE_HEALTH } }));
		}
	}catch(_e){ /* noop */ }
}
export function getAiStoreHealth(){ return { ...STORE_HEALTH }; }
export function __resetStoreHealthForTests(){ STORE_HEALTH.degraded = false; STORE_HEALTH.reason = ''; STORE_HEALTH.message = ''; STORE_HEALTH.at = ''; }

async function withStore(storeName, mode, handler){
	const db = await openDb();
	if(!db){
		// 无 IndexedDB(非浏览器 / SSR / jest)→ 内存回退。必须给 handler 传一个可用的 finish,
		// 否则 handler 内 finish(...) 会抛 "finish is not a function"(此回退此前从未生效)。
		return new Promise((resolve, reject)=>{
			const finish = (value, isError = false)=>{ if(isError){ reject(value); } else { resolve(value); } };
			try { handler(null, finish); } catch(e){ finish(e, true); }
		});
	}
	return new Promise((resolve, reject)=>{
		const tx = db.transaction(storeName, mode);
		const store = tx.objectStore(storeName);
		let settled = false;
		const finish = (value, isError = false)=>{
			if(settled){
				return;
			}
			settled = true;
			if(isError){
				reject(value);
			}else{
				resolve(value);
			}
		};
		tx.oncomplete = ()=>{
			if(!settled){
				resolve(null);
			}
		};
		tx.onerror = ()=>{
			finish(tx.error || new Error(`indexeddb.${storeName}.failed`), true);
		};
		tx.onabort = ()=>{
			finish(tx.error || new Error(`indexeddb.${storeName}.aborted`), true);
		};
		try{
			handler(store, finish);
		}catch(e){
			finish(e, true);
		}
	});
}

function memoryStore(storeName){
	if(!MEMORY_DB.has(storeName)){
		MEMORY_DB.set(storeName, new Map());
	}
	return MEMORY_DB.get(storeName);
}

// [G1] providerProfiles.apiKey 静态加密收口:所有读写都过本层——
//  · 写入:桥可用即密文落库(格式 aesgcm.v1:..),dev 无桥原样明文=零回归;
//  · 读出:密文解回明文只驻内存;解不开(换机器/钥匙串被清)→ 置空 + apiKeyDecryptFailed
//    标记(UI 提示重填),绝不让密文串流进请求头;
//  · 旧明文记录读到后台透明升级为密文(fire-and-forget,失败无害下次再试)。
// 密钥钩覆盖的 store(apiKey 字段静态加密):接口档案 + 集成档案(联网检索等第三方 key)
const SECRET_STORES = Object.freeze([AI_ANALYSIS_STORES.providerProfiles, AI_ANALYSIS_STORES.integrationProfiles]);
function isSecretStore(storeName){ return SECRET_STORES.indexOf(storeName) >= 0; }
function secretPrefixOf(storeName){ return storeName === AI_ANALYSIS_STORES.integrationProfiles ? 'integration' : 'provider'; }

// [Q-059/M-79] 「鉴权定制(额外请求头)」的值(自建网关的 Authorization / x-api-key 等令牌)与 apiKey 同走静态加密:
//   落库密文、读出解回明文只驻内存;解不开 → 置空 + extraHeadersDecryptFailed 标记(UI 提示重填)。
//   仅 provider_profiles 有 providerOptions.extraHeaders;值非字符串/空串原样。
function extraHeadersOf(rec){
	const po = rec && rec.providerOptions && typeof rec.providerOptions === 'object' ? rec.providerOptions : null;
	const eh = po && po.extraHeaders && typeof po.extraHeaders === 'object' && !Array.isArray(po.extraHeaders) ? po.extraHeaders : null;
	return eh && Object.keys(eh).length ? eh : null;
}
function withExtraHeaders(rec, eh){
	return { ...rec, providerOptions: { ...(rec.providerOptions || {}), extraHeaders: eh } };
}
async function encryptExtraHeaders(rec){
	const eh = extraHeadersOf(rec);
	if(!eh){ return rec; }
	const out = {};
	const keys = Object.keys(eh);
	for(let i = 0; i < keys.length; i++){
		const v = eh[keys[i]];
		// eslint-disable-next-line no-await-in-loop
		out[keys[i]] = (typeof v === 'string' && v) ? await encryptSecretText(v) : v;
	}
	return withExtraHeaders(rec, out);
}
async function decryptExtraHeaders(rec){
	const eh = extraHeadersOf(rec);
	if(!eh){ return { rec, hasPlainSecret: false, failed: false, kept: null };
	}
	const out = {};
	const kept = {};
	let failed = false;
	let hasPlainSecret = false;
	const keys = Object.keys(eh);
	for(let i = 0; i < keys.length; i++){
		const k = keys[i];
		const v = eh[k];
		if(typeof v !== 'string' || !v){ out[k] = v; continue; }
		if(!isEncryptedSecret(v)){ out[k] = v; hasPlainSecret = true; continue; }
		// eslint-disable-next-line no-await-in-loop
		const plain = await decryptSecretText(v);
		if(plain === null){ out[k] = ''; kept[k] = v; failed = true; }
		else{ out[k] = plain; }
	}
	return { rec: withExtraHeaders(rec, out), hasPlainSecret, failed, kept: failed ? kept : null };
}

async function decryptProfileRecord(rec, storeName = AI_ANALYSIS_STORES.providerProfiles){
	if(!rec || typeof rec !== 'object'){ return rec; }
	const stored = `${rec.apiKey || ''}`;
	const ehRes = await decryptExtraHeaders(rec);
	let out = ehRes.rec;
	if(ehRes.failed){
		// [Q-059/M-82] 解不开的密文留在内存态(不落库、不进备份),写路径未重填时原样保留
		out = { ...out, extraHeadersDecryptFailed: true, extraHeadersCipherKept: ehRes.kept };
	}
	if(!isEncryptedSecret(stored)){
		// 明文 + 可加密 → 透明升级(异步重写,不阻塞读路径;putStoreRecord 会加密);额外请求头有明文令牌同此
		if((stored || ehRes.hasPlainSecret) && await canEncryptSecrets()){
			Promise.resolve().then(()=>putStoreRecord(storeName, out, secretPrefixOf(storeName))).catch(()=>{});
		}
		return out;
	}
	const plain = await decryptSecretText(stored);
	if(plain === null){
		// [Q-059/M-82] 此前只置空 + 标记:该会话里任何写(连通性诊断写 lastDiagnostics / 打开编辑直接确定)都把
		//   空串「加密」后覆盖库里本可在下次会话解开的密文。现把原密文留在内存态 apiKeyCipherKept,写路径未重填时原样保留。
		return { ...out, apiKey: '', apiKeyDecryptFailed: true, apiKeyCipherKept: stored };
	}
	return { ...out, apiKey: plain };
}

// [首开反卡 2026-08-09] 分批游标全量读:WKWebView(Mac APP 的 WebKit)对大 value store 的一次性
// getAll 反序列化极慢且长期占住主线程(Chromium 无感 → 「preview 秒开 / APP 全页转圈很久」的引擎面根因)。
// 每批 batch 条一个独立只读事务,批间 setTimeout(0) 让出主线程 —— 总量不变,首帧与交互不再被冻。
// 返回值与 listStoreRecords 逐条同构(migrateRecord + provider_profiles 自动解密),消费方零改动。
export async function listStoreRecordsBatched(storeName, options = {}){
	const batch = Math.max(1, Number(options.batch) || 15);
	const db = await openDb();
	if(!db){
		return listStoreRecords(storeName);   // 无 IndexedDB 环境走内存回退同径
	}
	const out = [];
	let lastKey = null;
	let done = false;
	while(!done){
		// eslint-disable-next-line no-await-in-loop
		const chunk = await new Promise((resolve, reject)=>{
			const tx = db.transaction(storeName, 'readonly');
			const store = tx.objectStore(storeName);
			const range = lastKey === null ? undefined : window.IDBKeyRange.lowerBound(lastKey, true);
			const req = range === undefined ? store.openCursor() : store.openCursor(range);
			const buf = [];
			req.onsuccess = ()=>{
				const cur = req.result;
				if(!cur){ resolve({ buf, end: true }); return; }
				buf.push(migrateRecord(storeName, cur.value));
				lastKey = cur.key;
				if(buf.length >= batch){ resolve({ buf, end: false }); return; }
				cur.continue();
			};
			req.onerror = ()=>{ reject(req.error); };
		}).then((r)=>{ done = r.end; return r.buf; });
		out.push(...chunk);
		if(!done){
			// eslint-disable-next-line no-await-in-loop
			await new Promise((r)=>setTimeout(r, 0));
		}
	}
	if(isSecretStore(storeName)){
		return Promise.all(out.map((rec)=>decryptProfileRecord(rec, storeName)));
	}
	return out;
}

export async function listStoreRecords(storeName){
	const list = await withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			const memList = Array.from(memoryStore(storeName).values()).map((item)=>migrateRecord(storeName, clonePlain(item)));
			finish(memList);
			return;
		}
		IDB_STATS.getAll += 1;
		const req = store.getAll();
		req.onsuccess = ()=>{
			finish((req.result || []).map((item)=>migrateRecord(storeName, item)));
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
	if(isSecretStore(storeName) && Array.isArray(list)){
		return Promise.all(list.map((rec)=>decryptProfileRecord(rec, storeName)));
	}
	return list;
}

// 测试专用:读库内原始记录(不解密),用于断言落库形态(密文/留存密文)。
export async function __rawStoreRecordForTests(storeName, id){
	return withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName).get(id);
			finish(mem ? clonePlain(mem) : null);
			return;
		}
		const req = store.get(id);
		req.onsuccess = ()=>{ finish(req.result || null); };
		req.onerror = ()=>{ finish(req.error, true); };
	});
}

export async function getStoreRecord(storeName, id){
	const record = await withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName).get(id);
			finish(mem ? migrateRecord(storeName, clonePlain(mem)) : null);
			return;
		}
		const req = store.get(id);
		req.onsuccess = ()=>{
			finish(req.result ? migrateRecord(storeName, req.result) : null);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
	if(isSecretStore(storeName) && record){
		return decryptProfileRecord(record, storeName);
	}
	return record;
}

// [2026-09-08] 库写入后的 DOM 事件(零 import 消费:本机 MCP 桥据 templates 变更推 prompts/list_changed);派发永不抛、无 DOM 环境静默
export const AI_STORE_CHANGED_EVENT = 'horosa:ai-store-changed';
// [D31] 批量写(bulkPut)/整店清空(clear)/批量删(deleteMany)/条件删(deleteWhere)各派**一次**带 ids/count 的事件:
// 此前 bulkPut 与 clear 不派(工作区恢复 = clear+bulkPut ⇒ 外部客户端 prompts 列表陈旧)、deleteMany 逐 id 派 N 次。
function notifyStoreChanged(store, id, op, extra){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(AI_STORE_CHANGED_EVENT, { detail: { store: `${store}`, id, op, ...(extra && typeof extra === 'object' ? extra : {}) } }));
		}
	}catch(e){ /* noop */ }
}

export async function putStoreRecord(storeName, record, prefix = storeName){
	const next = migrateRecord(storeName, {
		...(record || {}),
		id: ensureRecordId(record, prefix),
		updatedAt: record && record.updatedAt ? record.updatedAt : nowIso(),
	});
	let toPersist = next;
	if(isSecretStore(storeName)){
		// 内存态标记/留存密文不落库
		const { apiKeyDecryptFailed, apiKeyCipherKept, extraHeadersDecryptFailed, extraHeadersCipherKept, ...restRec } = next;
		// [Q-059/M-82] 解密失败态且未重填(仍为空串)→ 保留原密文,不用空串覆盖;重填了新 Key → 正常加密
		const cipher = (apiKeyDecryptFailed && apiKeyCipherKept && !`${next.apiKey || ''}`)
			? apiKeyCipherKept
			: await encryptSecretText(`${next.apiKey || ''}`);
		let persistRec = { ...restRec, apiKey: cipher };
		// [Q-059/M-79] 额外请求头值加密;[M-82] 解不开且未重填的头值保留原密文
		if(extraHeadersDecryptFailed && extraHeadersCipherKept && typeof extraHeadersCipherKept === 'object'){
			const eh = extraHeadersOf(persistRec);
			if(eh){
				const merged = { ...eh };
				Object.keys(extraHeadersCipherKept).forEach((k)=>{
					if(Object.prototype.hasOwnProperty.call(merged, k) && !merged[k]){ merged[k] = extraHeadersCipherKept[k]; }
				});
				persistRec = withExtraHeaders(persistRec, merged);
			}
		}
		toPersist = await encryptExtraHeaders(persistRec);
	}
	// 调用方拿到的是内存态(明文 key),UI/请求路径零改;落库的是 toPersist(桥可用时为密文)
	const r = await withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			memoryStore(storeName).set(toPersist.id, clonePlain(toPersist));
			finish(next);
			return;
		}
		IDB_STATS.put += 1;
		const req = store.put(toPersist);
		req.onsuccess = ()=>{
			finish(next);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
	notifyStoreChanged(storeName, next.id, 'put');
	return r;
}

export async function bulkPutStoreRecords(storeName, records, prefix = storeName){
	const list = normalizeArray(records).map((item)=>migrateRecord(storeName, {
		...(item || {}),
		id: ensureRecordId(item, prefix),
	}));
	const out = await bulkPutStoreRecordsRaw(storeName, list);
	notifyStoreChanged(storeName, null, 'bulk', { ids: list.map((x)=>x.id), count: list.length });
	return out;
}
function bulkPutStoreRecordsRaw(storeName, list){
	return withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName);
			list.forEach((item)=>{
				mem.set(item.id, clonePlain(item));
			});
			finish(list);
			return;
		}
		let pending = list.length;
		if(pending === 0){
			finish([]);
			return;
		}
		IDB_STATS.put += list.length;
		list.forEach((item)=>{
			const req = store.put(item);
			req.onsuccess = ()=>{
				pending -= 1;
				if(pending === 0){
					finish(list);
				}
			};
			req.onerror = ()=>{
				finish(req.error, true);
			};
		});
	});
}

export async function deleteStoreRecord(storeName, id){
	const r = await withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			memoryStore(storeName).delete(id);
			finish(true);
			return;
		}
		IDB_STATS.delete += 1;
		const req = store.delete(id);
		req.onsuccess = ()=>{
			finish(true);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
	notifyStoreChanged(storeName, id, 'delete');
	return r;
}

// 条件删除。hint={index,value} 且索引在位 → 单个 readwrite 事务内沿索引游标逐条 predicate 判定后
// cursor.delete()(一次事务、零全表读、零 value 全量反序列化);无 hint / 索引缺席 / 内存回退 → 原路径
// (全量读 + 逐条删)。predicate 在两条路径上都有最终否决权,hint 只是缩小候选集。
export async function deleteWhere(storeName, predicate, hint){
	const indexName = hint && hint.index ? `${hint.index}` : '';
	if(indexName){
		const viaIndex = await withStore(storeName, 'readwrite', (store, finish)=>{
			if(!store || !store.indexNames.contains(indexName)){
				if(store){
					IDB_STATS.fallback += 1;
				}
				finish(null);   // null = 本径不适用,交回原路径
				return;
			}
			let count = 0;
			const req = store.index(indexName).openCursor(window.IDBKeyRange.only(hint.value));
			req.onsuccess = ()=>{
				const cur = req.result;
				if(!cur){
					IDB_STATS.cursorDelete += count;
					finish(count);
					return;
				}
				if(predicate(migrateRecord(storeName, cur.value))){
					cur.delete();
					count += 1;
				}
				cur.continue();
			};
			req.onerror = ()=>{
				finish(req.error, true);
			};
		});
		if(viaIndex !== null){
			if(viaIndex > 0){ notifyStoreChanged(storeName, null, 'deleteWhere', { count: viaIndex }); }
			return viaIndex;
		}
	}
	const items = await listStoreRecords(storeName);
	const toDelete = items.filter((item)=>predicate(item));
	if(toDelete.length){ await deleteStoreRecords(storeName, toDelete.map((item)=>item.id)); }
	return toDelete.length;
}

// 按二级索引读整组记录(P0 热路径:消息按会话读)。返回值与 listStoreRecords 逐条同构(migrateRecord +
// provider_profiles 自动解密)。索引缺席(如升版事务被中断过的库)→ 退回 getAll+filter 并计 fallback,
// 结果不变只是慢;内存回退径按同一 keyPath 过滤。
export async function readByIndex(storeName, indexName, value){
	const keyPath = indexKeyPath(storeName, indexName);
	const matches = (rec)=>!!rec && indexValueEquals(recordIndexValue(rec, keyPath), value);
	const list = await withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			const memList = Array.from(memoryStore(storeName).values())
				.filter(matches)
				.map((item)=>migrateRecord(storeName, clonePlain(item)));
			finish(memList);
			return;
		}
		if(store.indexNames.contains(indexName)){
			IDB_STATS.indexGetAll += 1;
			const req = store.index(indexName).getAll(window.IDBKeyRange.only(value));
			req.onsuccess = ()=>{
				finish((req.result || []).map((item)=>migrateRecord(storeName, item)));
			};
			req.onerror = ()=>{
				finish(req.error, true);
			};
			return;
		}
		IDB_STATS.fallback += 1;
		IDB_STATS.getAll += 1;
		const req = store.getAll();
		req.onsuccess = ()=>{
			finish((req.result || []).filter(matches).map((item)=>migrateRecord(storeName, item)));
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
	if(isSecretStore(storeName) && Array.isArray(list)){
		return Promise.all(list.map((rec)=>decryptProfileRecord(rec, storeName)));
	}
	return list;
}

// [压测二轮·K4] 沿二级索引游标读:按索引序(direction 'next'|'prev')逐条取、predicate 过滤、limit 到手即停——
// 「取最新 20 条通知」不再整表 getAll + 全量反序列化。索引缺席 → 退回 getAll + 按 keyPath 排序(计 fallback);
// 内存回退径按 keyPath 排序同径。返回值与 listStoreRecords 逐条同构(migrateRecord + 密钥 store 自动解密)。
export async function listStoreRecordsByIndexCursor(storeName, indexName, options = {}){
	const direction = options.direction === 'prev' ? 'prev' : 'next';
	const limit = Number.isFinite(options.limit) && options.limit > 0 ? Math.floor(options.limit) : 0;
	const predicate = typeof options.predicate === 'function' ? options.predicate : null;
	const keyPath = indexKeyPath(storeName, indexName);
	const keyText = (rec)=>{ const v = recordIndexValue(rec, keyPath); return v == null ? '' : `${v}`; };
	const collect = (raws)=>{
		const sorted = raws.slice().sort((a, b)=>{ const x = keyText(a); const y = keyText(b); return x < y ? -1 : (x > y ? 1 : 0); });
		if(direction === 'prev'){ sorted.reverse(); }
		const out = [];
		for(let i = 0; i < sorted.length; i++){
			const rec = migrateRecord(storeName, sorted[i]);
			if(predicate && !predicate(rec)){ continue; }
			out.push(rec);
			if(limit && out.length >= limit){ break; }
		}
		return out;
	};
	const list = await withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			finish(collect(Array.from(memoryStore(storeName).values()).map((item)=>clonePlain(item))));
			return;
		}
		if(!store.indexNames.contains(indexName)){
			IDB_STATS.fallback += 1;
			IDB_STATS.getAll += 1;
			const req = store.getAll();
			req.onsuccess = ()=>{ finish(collect(req.result || [])); };
			req.onerror = ()=>{ finish(req.error, true); };
			return;
		}
		IDB_STATS.indexCursor += 1;
		const out = [];
		const req = store.index(indexName).openCursor(null, direction);
		req.onsuccess = ()=>{
			const cur = req.result;
			if(!cur){ finish(out); return; }
			const rec = migrateRecord(storeName, cur.value);
			if(!predicate || predicate(rec)){ out.push(rec); }
			if(limit && out.length >= limit){ finish(out); return; }
			cur.continue();
		};
		req.onerror = ()=>{ finish(req.error, true); };
	});
	if(isSecretStore(storeName) && Array.isArray(list)){
		return Promise.all(list.map((rec)=>decryptProfileRecord(rec, storeName)));
	}
	return list;
}

// [压测二轮·S5] 单事务「比较并交换」:同一 readwrite 事务内 get → predicate → put。IndexedDB 同 store 的 readwrite 事务
// 串行执行(内存回退径同步执行),因此并发写同一条只有一个赢家。predicate(cur) 为假 → { ok:false, reason:'predicate', record:cur } 不写;
// 记录不存在 → reason:'not-found'。updater(cur) 回完整下一版(id 由本层钉死)。密钥 store 不支持(它们走加密写路径)。
export async function updateStoreRecordIf(storeName, id, predicate, updater){
	if(isSecretStore(storeName)){ throw new Error(`updateStoreRecordIf 不支持密钥 store: ${storeName}`); }
	const next = (cur)=>migrateRecord(storeName, { ...(updater(cur) || {}), id: cur.id });
	return withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName);
			const raw = mem.get(id);
			if(!raw){ finish({ ok: false, reason: 'not-found', record: null }); return; }
			const cur = migrateRecord(storeName, clonePlain(raw));
			if(!predicate(cur)){ finish({ ok: false, reason: 'predicate', record: cur }); return; }
			const rec = next(cur);
			mem.set(rec.id, clonePlain(rec));
			finish({ ok: true, record: rec });
			return;
		}
		const getReq = store.get(id);
		getReq.onsuccess = ()=>{
			if(!getReq.result){ finish({ ok: false, reason: 'not-found', record: null }); return; }
			const cur = migrateRecord(storeName, getReq.result);
			let rec = null;
			try{
				if(!predicate(cur)){ finish({ ok: false, reason: 'predicate', record: cur }); return; }
				rec = next(cur);
			}catch(e){ finish(e, true); return; }
			IDB_STATS.put += 1;
			const putReq = store.put(rec);
			putReq.onsuccess = ()=>{ finish({ ok: true, record: rec }); };
			putReq.onerror = ()=>{ finish(putReq.error, true); };
		};
		getReq.onerror = ()=>{ finish(getReq.error, true); };
	});
}

// [压测二轮·K3] 一次事务批量删(裁掉几千条终态任务不再每条一个事务);回实际提交的 id 数。内存回退同径。
export async function deleteStoreRecords(storeName, ids){
	const list = normalizeArray(ids).filter((x)=>x !== undefined && x !== null);
	if(!list.length){ return 0; }
	const r = await withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName);
			let n = 0;
			list.forEach((id)=>{ if(mem.delete(id)){ n += 1; } });
			finish(n);
			return;
		}
		IDB_STATS.delete += list.length;
		let pending = list.length;
		list.forEach((id)=>{
			const req = store.delete(id);
			req.onsuccess = ()=>{ pending -= 1; if(pending === 0){ finish(list.length); } };
			req.onerror = ()=>{ finish(req.error, true); };
		});
	});
	notifyStoreChanged(storeName, null, 'deleteMany', { ids: list.slice(), count: list.length });
	return r;
}

export async function clearStore(storeName){
	const out = await clearStoreRaw(storeName);
	notifyStoreChanged(storeName, null, 'clear');
	return out;
}
function clearStoreRaw(storeName){
	return withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			memoryStore(storeName).clear();
			finish(true);
			return;
		}
		const req = store.clear();
		req.onsuccess = ()=>{
			finish(true);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
}

export async function countStoreRecords(storeName){
	return withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			finish(memoryStore(storeName).size);
			return;
		}
		const req = store.count();
		req.onsuccess = ()=>{
			finish(req.result || 0);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
}

// 本会话仍在流式生成的消息 id(saveConversationMessage 以 streaming 落盘时登记、以终态落盘时注销)。
// 页面刷新/崩溃后集合为空 → 库里任何 streamStatus='streaming' 的消息都是孤儿(没有人会再把它写成终态),
// 载入时降级成 aborted,否则重开会话永远显示「生成中」空气泡(压测实抓)。
const inFlightMessageIds = new Set();
export const ORPHAN_STREAMING_CONTENT = '已停止生成(页面刷新或关闭时中断)。';

export function reconcileOrphanStreaming(item){
	if(!item || item.streamStatus !== 'streaming' || inFlightMessageIds.has(item.id)){
		return null;
	}
	return {
		...item,
		streamStatus: 'aborted',
		content: item.content || ORPHAN_STREAMING_CONTENT,
		updatedAt: nowIso(),
	};
}

export async function listConversationMessages(conversationId){
	if(!conversationId){
		return [];
	}
	// 按 conversationId 索引直读本会话消息(此前全表 getAll 后 filter,消息万级后主线程冻结);
	// 索引缺席时 readByIndex 内部自动回退,结果同构。
	const mine = await readByIndex(AI_ANALYSIS_STORES.messages, 'conversationId', conversationId);
	const repaired = [];
	const out = mine.map((item)=>{
		const fixed = reconcileOrphanStreaming(item);
		if(fixed){ repaired.push(fixed); return fixed; }
		return item;
	});
	// 修复结果回写(顺序写,数量极少);写失败不影响本次返回
	for(let i = 0; i < repaired.length; i++){
		try{ await putStoreRecord(AI_ANALYSIS_STORES.messages, repaired[i], 'msg'); }catch(e){ /* 只影响下次载入 */ }
	}
	return out.sort((a, b)=>{
		const ta = Date.parse(a.createdAt || '') || 0;
		const tb = Date.parse(b.createdAt || '') || 0;
		return ta - tb;
	});
}

export async function saveConversationMessage(messageRecord){
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.messages, {
		...(messageRecord || {}),
		id: messageRecord && messageRecord.id ? messageRecord.id : null,
		createdAt: messageRecord && messageRecord.createdAt ? messageRecord.createdAt : nowIso(),
		updatedAt: nowIso(),
	}, 'msg');
	if(saved && saved.id){
		if(saved.streamStatus === 'streaming'){ inFlightMessageIds.add(saved.id); }else{ inFlightMessageIds.delete(saved.id); }
	}
	return saved;
}

export function __resetInFlightMessagesForTests(){
	inFlightMessageIds.clear();
}
export function __markInFlightForTests(id){
	inFlightMessageIds.add(id);
}


export async function replaceConversationMessages(conversationId, messages){
	await deleteWhere(AI_ANALYSIS_STORES.messages, (item)=>item.conversationId === conversationId, { index: 'conversationId', value: conversationId });
	const list = normalizeArray(messages);
	if(list.length === 0){
		return [];
	}
	return bulkPutStoreRecords(AI_ANALYSIS_STORES.messages, list.map((item, idx)=>({
		...(item || {}),
		id: item && item.id ? item.id : `msg-${conversationId}-${idx}-${randomStr(6)}`,
		conversationId,
	})), 'msg');
}

// ── context_cache 条数上限(P0-S4)──────────────────────────────────────────────────────
// 源上下文缓存每盘每模式一条,只增不减会随年月无限累积;这里按 updatedAt 最旧先裁到上限。
// 命中的记录由 aiAnalysisContext 触摸 updatedAt(24h 一次),常用盘不会因「写得早」被裁掉。
export const CONTEXT_CACHE_MAX_ENTRIES = 300;
let pruneContextCachePromise = null;
let contextCacheWriteCount = 0;

// 裁剪本体(单飞:在途时并发调用共享同一 Promise)。IDB 径:readwrite 事务内先 count,超额则沿
// updatedAt 索引的键游标(升序=最旧在前)取前 excess 个主键删除 —— 不 getAll、不反序列化 value;
// 内存径:按 updatedAt 升序删前 excess。返回删除条数。
export function pruneContextCache(options = {}){
	if(pruneContextCachePromise){
		return pruneContextCachePromise;
	}
	const max = Math.max(0, Number(options.max) || CONTEXT_CACHE_MAX_ENTRIES);
	const storeName = AI_ANALYSIS_STORES.contextCache;
	const updatedAtMs = (rec)=>Date.parse((rec && rec.updatedAt) || '') || 0;
	pruneContextCachePromise = withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName);
			const excess = mem.size - max;
			if(excess <= 0){
				finish(0);
				return;
			}
			const victims = Array.from(mem.entries())
				.sort((a, b)=>updatedAtMs(a[1]) - updatedAtMs(b[1]))
				.slice(0, excess);
			victims.forEach(([id])=>mem.delete(id));
			finish(victims.length);
			return;
		}
		const countReq = store.count();
		countReq.onerror = ()=>{
			finish(countReq.error, true);
		};
		countReq.onsuccess = ()=>{
			const excess = (countReq.result || 0) - max;
			if(excess <= 0){
				finish(0);
				return;
			}
			let deleted = 0;
			const done = ()=>{
				IDB_STATS.delete += deleted;
				finish(deleted);
			};
			if(!store.indexNames.contains('updatedAt')){
				// 索引缺席(异常库)→ 全量读后排序删,结果同构只是慢
				IDB_STATS.fallback += 1;
				IDB_STATS.getAll += 1;
				const allReq = store.getAll();
				allReq.onerror = ()=>{
					finish(allReq.error, true);
				};
				allReq.onsuccess = ()=>{
					(allReq.result || [])
						.sort((a, b)=>updatedAtMs(a) - updatedAtMs(b))
						.slice(0, excess)
						.forEach((rec)=>{
							store.delete(rec.id);
							deleted += 1;
						});
					done();
				};
				return;
			}
			const cursorReq = store.index('updatedAt').openKeyCursor();
			cursorReq.onerror = ()=>{
				finish(cursorReq.error, true);
			};
			cursorReq.onsuccess = ()=>{
				const cur = cursorReq.result;
				if(!cur){
					done();
					return;
				}
				store.delete(cur.primaryKey);
				deleted += 1;
				if(deleted >= excess){
					done();
					return;
				}
				cur.continue();
			};
		};
	}).finally(()=>{
		pruneContextCachePromise = null;
	});
	return pruneContextCachePromise;
}

// 写计数触发的裁剪调度:首次写与其后每 8 次写各发起一次 fire-and-forget 裁剪(调用方不等待)。
// 开关 horosa.perf.contextCachePrune(默认开)关闭 → 不裁剪,回到「缓存只增不减」的旧行为。
// 返回本次发起的裁剪 Promise(未发起 = null),便于测试等待;生产调用方忽略返回值。
export function schedulePruneContextCache(){
	if(!contextCachePruneEnabled()){
		return null;
	}
	contextCacheWriteCount += 1;
	if(contextCacheWriteCount !== 1 && contextCacheWriteCount % 8 !== 0){
		return null;
	}
	const pending = pruneContextCache({ max: CONTEXT_CACHE_MAX_ENTRIES });
	pending.catch(()=>{ /* 裁剪失败无害:下次写再试 */ });
	return pending;
}

export function __resetContextCachePruneForTests(){
	contextCacheWriteCount = 0;
}

export async function ensureTemplateVersion(templateRecord){
	const template = migrateRecord(AI_ANALYSIS_STORES.templates, templateRecord);
	if(template.activeVersionId){
		const existing = await getStoreRecord(AI_ANALYSIS_STORES.templateVersions, template.activeVersionId);
		if(existing){
			return {
				template,
				version: existing,
			};
		}
	}
	const versions = (await listStoreRecords(AI_ANALYSIS_STORES.templateVersions)).filter((item)=>item.templateId === template.id);
	const version = await putStoreRecord(AI_ANALYSIS_STORES.templateVersions, {
		templateId: template.id,
		versionNumber: versions.length + 1,
		snapshot: {
			format: template.format,
			instructionText: template.instructionText,
			jsonSchema: template.jsonSchema,
			exampleInput: template.exampleInput,
			exampleOutput: template.exampleOutput,
			content: template.content || '',
			name: template.name || '',
		},
	}, 'tplver');
	if(template.activeVersionId !== version.id){
		template.activeVersionId = version.id;
		await putStoreRecord(AI_ANALYSIS_STORES.templates, template, 'template');
	}
	return {
		template,
		version,
	};
}

export async function migrateWorkspaceData(){
	const templates = await listStoreRecords(AI_ANALYSIS_STORES.templates);
	const results = [];
	for(let i=0; i<templates.length; i++){
		results.push(await ensureTemplateVersion(templates[i]));
	}
	return results;
}

export function loadUiPrefs(){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return {};
		}
		const raw = window.localStorage.getItem(UI_PREF_KEY);
		return raw ? JSON.parse(raw) : {};
	}catch(e){
		return {};
	}
}

export function saveUiPrefs(next){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return next;
		}
		const merged = {
			...loadUiPrefs(),
			...(next || {}),
		};
		safeLocalStorageSet(UI_PREF_KEY, JSON.stringify(merged));
		return merged;
	}catch(e){
		// 多为本地存储配额超限:此处不静默吞掉,记录以便定位(UI 提示交由调用方)。
		console.warn('saveUiPrefs failed (localStorage quota exceeded?)', e);
		return next || {};
	}
}

export function buildTimestampLabel(iso){
	const time = new Date(iso || Date.now());
	if(Number.isNaN(time.getTime())){
		return '';
	}
	const y = time.getFullYear();
	const m = String(time.getMonth() + 1).padStart(2, '0');
	const d = String(time.getDate()).padStart(2, '0');
	const hh = String(time.getHours()).padStart(2, '0');
	const mm = String(time.getMinutes()).padStart(2, '0');
	return `${y}-${m}-${d} ${hh}:${mm}`;
}
