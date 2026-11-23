import { IDB_STATS, getIdbStatsForDebug } from './aiAnalysisStore/schema';
import { clearStore, countStoreRecords } from './aiAnalysisStore/crud';
import { pruneContextCache } from './aiAnalysisStore/conversation';
export { AI_ANALYSIS_SCHEMA_VERSION, AI_ANALYSIS_STORES, AI_BACKUP_EXCLUDED_STORES, AI_ANALYSIS_DB_VERSION, EXTRA_INDEXES, getIdbStatsForDebug, __resetIdbStatsForTests } from './aiAnalysisStore/schema';
export { ensureIndexes } from './aiAnalysisStore/records';
export { migrateRecord, buildMaterialSearchText, __applySchemaUpgradeForTests } from './aiAnalysisStore/migrate';
export { AI_STORE_DEGRADED_EVENT, AI_STORE_RECOVERED_EVENT, AI_STORE_UNAVAILABLE_ERROR, AI_STORE_UNAVAILABLE_MESSAGE, assertAiStoreDurable, getAiStoreHealth, probeAiStoreHealth, __resetStoreHealthForTests, AI_STORE_CHANGED_EVENT } from './aiAnalysisStore/db';
export { listStoreRecordsBatched, listStoreRecords, __rawStoreRecordForTests, getStoreRecord, putStoreRecord, bulkPutStoreRecords, deleteStoreRecord, deleteWhere, readByIndex, listStoreRecordsByIndexCursor, updateStoreRecordIf, mergeStoreRecord, deleteStoreRecords, clearStore, countStoreRecords } from './aiAnalysisStore/crud';
export { ORPHAN_STREAMING_CONTENT, reconcileOrphanStreaming, listConversationMessages, saveConversationMessage, __resetInFlightMessagesForTests, __markInFlightForTests, replaceConversationMessages, CONTEXT_CACHE_MAX_ENTRIES, pruneContextCache, schedulePruneContextCache, __resetContextCachePruneForTests, ensureTemplateVersion, migrateWorkspaceData, loadUiPrefs, saveUiPrefs, buildTimestampLabel } from './aiAnalysisStore/conversation';

try{
	if(typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('horosa.debug.idbStats') === '1'){
		window.__horosaIdbStats = IDB_STATS;
		// 规模探针用的只读/维护钩(同一个 debug 开关):让页面外的度量脚本能调到真函数,
		// 而不是自己直写 IndexedDB —— 直写绕过应用写路径,量到的东西跟线上行为无关。
		window.__horosaAiStoreDebug = {
			prune: pruneContextCache, count: countStoreRecords, clear: clearStore, stats: getIdbStatsForDebug,
			// 任务表裁剪走真函数(惰性载入任务层,避免存储层反向吃进任务模块)
			pruneTasks: (o)=>import('./aiAgent/tasks/taskStore').then((m)=>m.pruneTasks(o)),
		};
	}
}catch(e){
	// 调试钩子缺席无害
}
