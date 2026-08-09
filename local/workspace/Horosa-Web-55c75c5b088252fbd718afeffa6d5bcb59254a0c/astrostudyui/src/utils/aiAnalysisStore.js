import { safeLocalStorageSet } from './safeStorage';
import {
	getProviderDefaultChatModels,
	getProviderDefaultEmbeddingModels,
	getProviderDisplayName,
	getProviderProtocolFamily,
} from './aiAnalysisProviders';

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
	reportTemplates: 'report_templates',
	reportInstances: 'report_instances',
};

const DB_NAME = 'horosa.ai.analysis.v1';
const DB_VERSION = 5;
const UI_PREF_KEY = 'horosa.ai.analysis.ui.v3';
const MEMORY_DB = new Map();

Object.keys(AI_ANALYSIS_STORES).forEach((key)=>{
	MEMORY_DB.set(AI_ANALYSIS_STORES[key], new Map());
});

let openDbPromise = null;

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

function ensureIndexes(store){
	if(!store.indexNames.contains('updatedAt')){
		store.createIndex('updatedAt', 'updatedAt', { unique: false });
	}
	if(!store.indexNames.contains('createdAt')){
		store.createIndex('createdAt', 'createdAt', { unique: false });
	}
	if(!store.indexNames.contains('schemaVersion')){
		store.createIndex('schemaVersion', 'schemaVersion', { unique: false });
	}
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
		next.embeddingModelIds = normalizeArray(next.embeddingModelIds).length
			? normalizeArray(next.embeddingModelIds)
			: getProviderDefaultEmbeddingModels(next.providerType);
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
			const db = req.result;
			Object.keys(AI_ANALYSIS_STORES).forEach((key)=>{
				const storeName = AI_ANALYSIS_STORES[key];
				let store = null;
				if(!db.objectStoreNames.contains(storeName)){
					store = db.createObjectStore(storeName, { keyPath: 'id' });
				}else{
					store = req.transaction.objectStore(storeName);
				}
				ensureIndexes(store);
			});
		};
		req.onsuccess = ()=>{
			resolve(req.result);
		};
		req.onerror = ()=>{
			reject(req.error);
		};
	});
	return openDbPromise.catch(()=>{
		openDbPromise = Promise.resolve(null);
		return openDbPromise;
	});
}

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

// [首开反卡 2026-08-09] 分批游标全量读:WKWebView(Mac APP 的 WebKit)对大 value store 的一次性
// getAll 反序列化极慢且长期占住主线程(Chromium 无感 → 「preview 秒开 / APP 全页转圈很久」的引擎面根因)。
// 每批 batch 条一个独立只读事务,批间 setTimeout(0) 让出主线程 —— 总量不变,首帧与交互不再被冻。
// 返回值与 listStoreRecords 逐条同构(migrateRecord),消费方零改动。
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
	return out;
}

export async function listStoreRecords(storeName){
	return withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			const list = Array.from(memoryStore(storeName).values()).map((item)=>migrateRecord(storeName, clonePlain(item)));
			finish(list);
			return;
		}
		const req = store.getAll();
		req.onsuccess = ()=>{
			const list = (req.result || []).map((item)=>migrateRecord(storeName, item));
			finish(list);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
}

export async function getStoreRecord(storeName, id){
	return withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			const record = memoryStore(storeName).get(id);
			finish(record ? migrateRecord(storeName, clonePlain(record)) : null);
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
}

export async function putStoreRecord(storeName, record, prefix = storeName){
	const next = migrateRecord(storeName, {
		...(record || {}),
		id: ensureRecordId(record, prefix),
		updatedAt: record && record.updatedAt ? record.updatedAt : nowIso(),
	});
	return withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			memoryStore(storeName).set(next.id, clonePlain(next));
			finish(next);
			return;
		}
		const req = store.put(next);
		req.onsuccess = ()=>{
			finish(next);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
}

export async function bulkPutStoreRecords(storeName, records, prefix = storeName){
	const list = normalizeArray(records).map((item)=>migrateRecord(storeName, {
		...(item || {}),
		id: ensureRecordId(item, prefix),
	}));
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
	return withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			memoryStore(storeName).delete(id);
			finish(true);
			return;
		}
		const req = store.delete(id);
		req.onsuccess = ()=>{
			finish(true);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
}

export async function deleteWhere(storeName, predicate){
	const items = await listStoreRecords(storeName);
	const toDelete = items.filter((item)=>predicate(item));
	await Promise.all(toDelete.map((item)=>deleteStoreRecord(storeName, item.id)));
	return toDelete.length;
}

export async function listConversationMessages(conversationId){
	const list = await listStoreRecords(AI_ANALYSIS_STORES.messages);
	return list
		.filter((item)=>item.conversationId === conversationId)
		.sort((a, b)=>{
			const ta = Date.parse(a.createdAt || '') || 0;
			const tb = Date.parse(b.createdAt || '') || 0;
			return ta - tb;
		});
}

export async function saveConversationMessage(messageRecord){
	return putStoreRecord(AI_ANALYSIS_STORES.messages, {
		...(messageRecord || {}),
		id: messageRecord && messageRecord.id ? messageRecord.id : null,
		createdAt: messageRecord && messageRecord.createdAt ? messageRecord.createdAt : nowIso(),
		updatedAt: nowIso(),
	}, 'msg');
}

export async function replaceConversationMessages(conversationId, messages){
	await deleteWhere(AI_ANALYSIS_STORES.messages, (item)=>item.conversationId === conversationId);
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
