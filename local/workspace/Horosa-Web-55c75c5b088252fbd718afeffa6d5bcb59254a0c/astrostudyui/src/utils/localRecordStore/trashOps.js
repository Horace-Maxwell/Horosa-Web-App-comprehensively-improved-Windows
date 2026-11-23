// 本地记录存储 · 回收站与删除日志的读写:读写回收站、按保留期修剪、移入 / 恢复 / 彻底删除、删除日志追加 / 撤销 / 恢复
// 从 localRecordStore.js 按职责拆出的 createLocalRecordStore 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { getLocalStorageSafe as getLocalStorage } from '../safeStorage';
import { mirrorShadowWrite } from '../shadowMirror';
import { toRecordCopy } from './recordShape';
import { DELETED_LOG_KEY, trashEntryLive } from './trashLog';

export function readTrashText({ trashKey }){
	const storage = getLocalStorage();
	if(!trashKey || !storage){ return null; }
	try{ return storage.getItem(trashKey); }catch(e){ return null; }
}

// 退回到之前读到的原串(回滚用;null = 原来没有这把键)
export function restoreTrashText({ trashKey }, text){
	const storage = getLocalStorage();
	if(!trashKey || !storage){ return; }
	try{
		if(text === null || text === undefined){
			storage.removeItem(trashKey);
		}else{
			storage.setItem(trashKey, text);
			mirrorShadowWrite(trashKey, text);
		}
	}catch(e){ /* 退不回:最坏是这条在回收站与主库各一份(健康体检会报重影,可在回收站彻底删除) */ }
}

// 30 天惰性清理 + 上限(新删在前,超限挤掉最旧)。返回 { kept, evicted }:evicted = 没过期、只因上限被挤出的条目 ——
// 它们等同永久删除,调用方先记进删除日志(与彻底删除同一口径),此前直接消失、哪里都找不回。
export function pruneTrash({ TRASH_MAX }, list){
	const now = Date.now();
	const live = list.filter((it)=>trashEntryLive(it, now));
	return { kept: live.slice(0, TRASH_MAX), evicted: live.slice(TRASH_MAX) };
}

export function listTrash({ readTrashRaw, pruneTrash, appendDeletedLog, writeTrashRaw }){
	const raw = readTrashRaw();
	const { kept, evicted } = pruneTrash(raw);
	if(kept.length !== raw.length){
		// 惰性清理:有过期才回写(零写放大);超出上限的先记进删除日志,记不进就先不清
		const logRes = evicted.length ? appendDeletedLog(evicted) : null;
		if(!logRes || logRes.ok){
			writeTrashRaw(kept);
			return kept;
		}
		return raw.filter((it)=>trashEntryLive(it, Date.now()));
	}
	return kept;
}

// 回收站现有(没过期的)条数:批量删除的确认框据此写明「超出上限的几条转入删除日志」
export function countLiveTrash({ readTrashRaw }){
	const now = Date.now();
	return readTrashRaw().filter((it)=>trashEntryLive(it, now)).length;
}

// 恢复一条已删的记录(回收站出栈 / 删除日志找回共用):库里已有同 cid 的现档(删除后又从备份导入过等)→
// 按副本恢复(新 cid、名字加「(恢复)」),不拿旧版盖掉现档;否则按原 cid 原样恢复。
export function restoreRecord({ getByCid, upsert, searchField }, rec){
	if(!rec || typeof rec !== 'object'){
		return null;
	}
	const record = { ...rec };
	delete record.deletedAt;
	if(record.cid && getByCid(record.cid)){
		return upsert(toRecordCopy(record, { titleKey: searchField || 'name', suffix: '(恢复)' }));
	}
	return upsert(record);
}

// 先恢复后出栈:upsert 抛错(quota)时 trash 原样保留,零丢失;主库只进了内存时出栈也只在内存(见 memoryTrash)。
// 恢复走 upsert 常规路径 → updateTime 刷新=浮到列表最前,用户立刻看到回来了。
export function restoreFromTrash({ readTrashRaw, restoreRecord, writeTrashRaw, dropDeletedLogEntries }, cid){
	const trash = readTrashRaw();
	const found = trash.find((it)=> it && it.cid === cid) || null;
	if(!found){
		return null;
	}
	const restored = restoreRecord(found);
	writeTrashRaw(readTrashRaw().filter((it)=> !(it && it.cid === cid)));
	// 动作时去重:删除日志里同 (库, cid)、删除时刻不晚于这条回收站条目的旧条目一并摘掉(这条已回到库里;
	// 不摘则日后再从日志找回只多一张副本)。全量恢复合并删除日志因此不必再拿「回收站里有」拦条目
	const backAsSelf = !!restored && `${restored.cid || (restored.record && restored.record.cid) || ''}` === `${cid}`;
	if(backAsSelf){ dropDeletedLogEntries((e)=>`${e.record.cid}` === `${cid}` && `${e.purgedAt || ''}` <= `${found.deletedAt || '9999'}`); }
	return restored;
}

export function undoDeletedLog(res){
	if(!res || !res.ok || !Object.prototype.hasOwnProperty.call(res, 'prev')){
		return;
	}
	const storage = getLocalStorage();
	if(!storage){ return; }
	try{
		if(res.prev === null){ storage.removeItem(DELETED_LOG_KEY); }else{ storage.setItem(DELETED_LOG_KEY, res.prev); }
	}catch(e){ /* 退不回:日志里多一条可找回的记录,无害 */ }
}
