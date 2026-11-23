// 对话消息、上下文缓存裁剪、模板版本、工作区迁移与界面偏好
// 从 aiAnalysisStore.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { parseDateTimeMs } from '../dateTimeParse';
import { contextCachePruneEnabled } from '../perfFlags';
import { safeLocalStorageSet } from '../safeStorage';
import { nowIso, normalizeArray, randomStr } from './records';
import { readByIndex, putStoreRecord, deleteWhere, bulkPutStoreRecords, withStore, memoryStore, getStoreRecord, listStoreRecords } from './crud';
import { AI_ANALYSIS_STORES, IDB_STATS, UI_PREF_KEY } from './schema';
import { migrateRecord } from './migrate';

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
		const ta = parseDateTimeMs(a.createdAt || '') || 0;
		const tb = parseDateTimeMs(b.createdAt || '') || 0;
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
	const updatedAtMs = (rec)=>parseDateTimeMs((rec && rec.updatedAt) || '') || 0;
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
	const time = new Date(parseDateTimeMs(iso || Date.now()));
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
