// 记录迁移(旧版字段补齐)、资料检索文本与库升版
// 从 aiAnalysisStore.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { getProviderProtocolFamily, getProviderDisplayName, getProviderDefaultChatModels, getProviderDefaultEmbeddingModels } from '../aiAnalysisProviders';
import { ensureRecordId, nowIso, normalizeArray, normalizeString, ensureIndexes } from './records';
import { AI_ANALYSIS_STORES, AI_ANALYSIS_SCHEMA_VERSION } from './schema';

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
		// 只在**字段缺席**时补预设。此前「长度为 0 就回填」让「清空 Embedding 模型列表」永远存不下去
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
export function applySchemaUpgrade(db, tx){
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
