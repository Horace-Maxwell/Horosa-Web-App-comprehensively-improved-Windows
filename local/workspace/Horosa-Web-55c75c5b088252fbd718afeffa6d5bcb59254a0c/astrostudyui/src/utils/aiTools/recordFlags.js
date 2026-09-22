// [批五] 记录旗标类工具(星标 / 置顶 / 加标签)的共用内核:只增不删——每件都是给已存记录加一个可撤销的标记,
// 不刷新 updateTime(与账本「手工改过」判据兼容)。撤销走账本新 undoKind 'restore-record-flag':
// 撤销前比对当前值 === 写后值(用户已手工改过 → E_UNDO_RECORD_CHANGED,不覆盖用户意图)。
import { getLocalChart, flagLocalChart, pinLocalChart, setLocalChartTags } from '../localcharts';
import { getLocalCase, flagLocalCase, pinLocalCase, setLocalCaseTags } from '../localcases';
import { parseGroupTags } from '../localRecordStore';
import { registerUndoHandler } from './ledger';

export const RECORD_FLAG_UNDO_KIND = 'restore-record-flag';
export const RECORD_TAG_MAX = 20;

export function findRecord(recordId){
	const c = getLocalChart(recordId);
	if(c){ return { store: 'chart', rec: c, title: c.name || recordId }; }
	const k = getLocalCase(recordId);
	if(k){ return { store: 'case', rec: k, title: k.event || recordId }; }
	return null;
}

export function readFlag(store, rec, field){
	if(field === 'starred'){ return !!(rec && rec.starred); }
	if(field === 'pinTier'){ return rec && (rec.pinTier === 1 || rec.pinTier === -1) ? rec.pinTier : 0; }
	if(field === 'tags'){ return parseGroupTags(rec ? rec.group : null); }
	return undefined;
}

export function writeFlag(store, cid, field, value){
	if(field === 'starred'){ return store === 'case' ? flagLocalCase(cid, 'starred', !!value) : flagLocalChart(cid, 'starred', !!value); }
	if(field === 'pinTier'){ return store === 'case' ? pinLocalCase(cid, value) : pinLocalChart(cid, value); }
	if(field === 'tags'){ return store === 'case' ? setLocalCaseTags(cid, value) : setLocalChartTags(cid, value); }
	return null;
}

function sameValue(a, b){
	if(Array.isArray(a) || Array.isArray(b)){ return JSON.stringify(a || []) === JSON.stringify(b || []); }
	return a === b;
}

// 账本撤销处理器:payload { store, cid, field, before, after }
function undoRecordFlag(action, undo){
	const p = (undo && undo.payload) || {};
	const found = findRecord(p.cid);
	if(!found || found.store !== p.store){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE', message: '记录已不存在' }; }
	const cur = readFlag(found.store, found.rec, p.field);
	if(!sameValue(cur, p.after)){ return { ok: false, code: 'E_UNDO_RECORD_CHANGED', message: '该标记在助手写入后已被改过,不自动撤销' }; }
	writeFlag(found.store, p.cid, p.field, p.before);
	return { ok: true, data: { cid: p.cid, field: p.field, restoredTo: p.before } };
}

let registered = false;
export function ensureRecordFlagUndo(){
	if(registered){ return; }
	registered = true;
	registerUndoHandler(RECORD_FLAG_UNDO_KIND, undoRecordFlag);
}
ensureRecordFlagUndo();

export function flagUndo(store, cid, field, before, after){
	return { kind: RECORD_FLAG_UNDO_KIND, payload: { store, cid, field, before, after } };
}
