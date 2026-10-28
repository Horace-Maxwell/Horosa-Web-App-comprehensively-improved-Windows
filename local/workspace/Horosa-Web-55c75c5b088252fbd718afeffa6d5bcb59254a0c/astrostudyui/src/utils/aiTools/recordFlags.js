// 记录旗标类工具(星标 / 置顶 / 加标签)的共用内核:只增不删——每件都是给已存记录加一个可撤销的标记,
// 不刷新 updateTime(与账本「手工改过」判据兼容)。撤销走账本新 undoKind 'restore-record-flag':
// 撤销前比对当前值 === 写后值(用户已手工改过 → E_UNDO_RECORD_CHANGED,不覆盖用户意图)。
// 同一内核再管两个列表字段:journal(断事日志,只追加)/ relations(关系边,只新增);
// 一次动作改两张档案(关系边双向)时撤销载荷带 items,逐条比对全过才一起还原。
import { getLocalChart, flagLocalChart, pinLocalChart, setLocalChartTags, upsertLocalChart } from '../localcharts';
import { getLocalCase, flagLocalCase, pinLocalCase, setLocalCaseTags, upsertLocalCase } from '../localcases';
import { parseGroupTags } from '../localRecordStore';
import { recordStorePersisted, STORE_SESSION_ONLY_CHANGE_ASSUMPTION } from '../recordStoreNotice';
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
	// 列表字段原样深拷(不归一:条目上的其它键要随撤销原样回去)
	if(field === 'journal' || field === 'relations'){ return Array.isArray(rec && rec[field]) ? JSON.parse(JSON.stringify(rec[field])) : []; }
	return undefined;
}

export function writeFlag(store, cid, field, value){
	if(field === 'starred'){ return store === 'case' ? flagLocalCase(cid, 'starred', !!value) : flagLocalChart(cid, 'starred', !!value); }
	if(field === 'pinTier'){ return store === 'case' ? pinLocalCase(cid, value) : pinLocalChart(cid, value); }
	if(field === 'tags'){ return store === 'case' ? setLocalCaseTags(cid, value) : setLocalChartTags(cid, value); }
	// 列表字段:合并写本字段、保留原 updateTime(与旗标同:不算「手工改过」);存储层照常留一版历史
	if(field === 'journal' || field === 'relations'){
		const rec = store === 'case' ? getLocalCase(cid) : getLocalChart(cid);
		if(!rec){ return null; }
		const upsert = store === 'case' ? upsertLocalCase : upsertLocalChart;
		return upsert({ cid, [field]: Array.isArray(value) ? value : [], preserveUpdateTime: true, updateTime: rec.updateTime });
	}
	return null;
}

// 写成功之后的回包:本机存储只在本次运行有效 → data.persisted=false 并写进 assumptions(与建档工具同一口径);已落盘原样
export function withPersistNote(store, result){
	if(!result || !result.ok || recordStorePersisted(store)){ return result; }
	return {
		...result,
		data: { ...(result.data || {}), persisted: false },
		assumptions: [...(Array.isArray(result.assumptions) ? result.assumptions : []), STORE_SESSION_ONLY_CHANGE_ASSUMPTION],
	};
}

function sameValue(a, b){
	if(Array.isArray(a) || Array.isArray(b)){ return JSON.stringify(a || []) === JSON.stringify(b || []); }
	return a === b;
}

// 账本撤销处理器:payload { store, cid, field, before, after };或 { items:[同形状…] }(一次动作改多张档案)
function undoRecordFlag(action, undo){
	const p = (undo && undo.payload) || {};
	const items = Array.isArray(p.items) ? p.items : [p];
	if(!items.length){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE', message: '撤销载荷为空' }; }
	const found = items.map((it)=>({ it, f: findRecord(it && it.cid) }));
	if(found.some(({ it, f })=>!f || f.store !== it.store)){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE', message: '记录已不存在' }; }
	// 全部比对过才动手:任何一张在助手写入后被改过 → 一张都不还原
	if(found.some(({ it, f })=>!sameValue(readFlag(f.store, f.rec, it.field), it.after))){ return { ok: false, code: 'E_UNDO_RECORD_CHANGED', message: '该标记在助手写入后已被改过,不自动撤销' }; }
	// 逐条还原;中途写不进(配额满)→ 已还原的回到写后值,不留一半(关系边双向只还原一侧 = 单向边)
	const done = [];
	for(let i = 0; i < found.length; i++){
		const it = found[i].it;
		try{
			writeFlag(it.store, it.cid, it.field, it.before);
			done.push(it);
		}catch(e){
			done.forEach((d)=>{ try{ writeFlag(d.store, d.cid, d.field, d.after); }catch(_e){ /* 回滚失败只能如实报 */ } });
			return { ok: false, code: 'E_STORE_QUOTA', message: '本地存储空间不足,撤销没有完成(已保持原状)' };
		}
	}
	if(!Array.isArray(p.items)){ return { ok: true, data: { cid: p.cid, field: p.field, restoredTo: p.before } }; }
	return { ok: true, data: { restored: items.map((it)=>({ cid: it.cid, field: it.field })) } };
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

// 一次动作改多张档案(关系边双向):items = [{ store, cid, field, before, after }…]
export function flagUndoMulti(items){
	return { kind: RECORD_FLAG_UNDO_KIND, payload: { items: (items || []).map((it)=>({ store: it.store, cid: it.cid, field: it.field, before: it.before, after: it.after })) } };
}
