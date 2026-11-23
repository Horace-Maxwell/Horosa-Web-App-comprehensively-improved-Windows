// 库结构:schema 版本、各 store 名、库版本号、二级索引声明与内存回退表
// 从 aiAnalysisStore.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。

// 备份排除集:context_cache 是「按源+模式」的派生缓存(挂载快照原文,单库可达数十 MB),
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
	// 任务实体/通知/自动规则/集成档案(联网检索等第三方 key;apiKey 与 provider_profiles 同一加密钩)
	agentTasks: 'agent_tasks',
	agentNotices: 'agent_notices',
	automationRules: 'automation_rules',
	integrationProfiles: 'integration_profiles',
	reportTemplates: 'report_templates',
	reportInstances: 'report_instances',
};

export const AI_BACKUP_EXCLUDED_STORES = Object.freeze([AI_ANALYSIS_STORES.contextCache]);

export const DB_NAME = 'horosa.ai.analysis.v1';
// 5→6:不建新表,只在既有 store 上幂等补建二级索引(EXTRA_INDEXES:messages.conversationId 等),
// 让「按会话读消息 / 按会话删消息」走索引,不再全表 getAll 后 filter(消息累积到万级后的主线程冻结点)。
// 🔴 升版是发布级动作:旧构建打开 v6 库会 VersionError(经 openDb 失败路径落内存回退,AI 模块可用
// 但数据暂不可见)——必须与版本号同车发布,不得热改。
// 6→7:新建 agent_tasks / agent_notices / automation_rules / integration_profiles 四 store(onupgradeneeded 按 AI_ANALYSIS_STORES 自动补建,
// 零迁移;二级索引见 EXTRA_INDEXES)。🔴 升版是发布级动作:与版本号同车,不得热改(旧构建打开新库=内存回退)。
const DB_VERSION = 7;
export const AI_ANALYSIS_DB_VERSION = DB_VERSION;
export const UI_PREF_KEY = 'horosa.ai.analysis.ui.v3';
export const MEMORY_DB = new Map();

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
export const IDB_STATS = { getAll: 0, indexGetAll: 0, indexCursor: 0, cursorDelete: 0, put: 0, delete: 0, fallback: 0 };

export function getIdbStatsForDebug(){
	return { ...IDB_STATS };
}

export function __resetIdbStatsForTests(){
	Object.keys(IDB_STATS).forEach((k)=>{ IDB_STATS[k] = 0; });
}

// [无头] 没有 IndexedDB 时的内存回退可接一个落盘钩子 globalThis.__HOROSA_HEADLESS_STORE__ = { load(name) → [[id, 记录]…] | null, save(name, entries) }:
// 只有无头运行时(Node 里跑工具层,要跨进程留住对话 / 资料 / 任务 / 接口档案)会装它;浏览器与桌面永远走 IndexedDB,不经过这里。
export function makeMemoryMap(storeName){
	const hook = typeof globalThis !== 'undefined' ? globalThis.__HOROSA_HEADLESS_STORE__ : null;
	if(!hook || typeof hook.load !== 'function' || typeof hook.save !== 'function'){ return new Map(); }
	let initial = null;
	try{ initial = hook.load(storeName); }catch(e){ initial = null; }
	const m = new Map(Array.isArray(initial) ? initial : []);
	const flush = ()=>{ try{ hook.save(storeName, Array.from(m.entries())); }catch(e){ /* 落盘失败不反噬内存态 */ } };
	const set = m.set.bind(m);
	const del = m.delete.bind(m);
	const clr = m.clear.bind(m);
	m.set = (k, v)=>{ set(k, v); flush(); return m; };
	m.delete = (k)=>{ const r = del(k); flush(); return r; };
	m.clear = ()=>{ clr(); flush(); };
	return m;
}

Object.keys(AI_ANALYSIS_STORES).forEach((key)=>{
	MEMORY_DB.set(AI_ANALYSIS_STORES[key], makeMemoryMap(AI_ANALYSIS_STORES[key]));
});
