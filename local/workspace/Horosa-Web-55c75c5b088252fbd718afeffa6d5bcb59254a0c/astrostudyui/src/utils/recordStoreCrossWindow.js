// 别的窗口改了命盘库 / 事盘库(同一本机存储的另一个窗口):本窗口当前那条跟着走(单一出处)。
// 由来:窗口 A 当前盘是 X,在窗口 B 把 X 删进回收站,回 A 点「保存 / 更新」—— A 的当前盘仍带着 X 的 cid,
// 写回去在库里重新建出 X,回收站里也还有 X(之后从回收站恢复只会多出一条「(恢复)」副本)。同理 B 里改了 X 的内容,
// A 再保存就把 B 的改动盖回去。列表本身每次读都比对原串、跟得上,只是「当前那条」不跟。
// storage 事件(只在别的窗口写时触发)→ 比对新旧两份:消失的 cid → 当前命盘脱离记录 / 当前事盘清掉(与本窗口删除同一出口);
// 内容换了的 cid → 按记录号广播 records-changed(source:'cross-window'),逐条带上改了哪些键(fieldsByCid),
// 当前载入的那条按库里新版重设:只改了置顶 / 星标 / 排序 / 备注 / 标签 / 日志 / 关联这类键 → 不重排、不推进载入代次
// (判据与本窗口同一出处 localRecordStore.recordChangeAffectsCast)。
import { emitRecordsChanged } from './recordStoreNotice';
import { recordChangedFields } from './localRecordStore';

export const RECORD_STORE_KEYS = Object.freeze({ 'horosa.localCharts.v1': 'chart', 'horosa.localCases.v1': 'case' });

function parseList(text){
	if(typeof text !== 'string' || !text){ return []; }
	try{
		const v = JSON.parse(text);
		return Array.isArray(v) ? v.filter((r)=>r && typeof r === 'object' && r.cid !== undefined && r.cid !== null) : [];
	}catch(e){ return []; }
}

// storage 事件 → { store, removed:[cid], changed:[cid], fieldsByCid:{ cid:[改了的键] } } | null
// (不是记录库的键 / 坏串读不出旧值的一律按「没变」)。纯函数,单测锁
export function recordStoreStoragePlan(evt){
	if(!evt || typeof evt.key !== 'string'){ return null; }
	const store = RECORD_STORE_KEYS[evt.key];
	if(!store){ return null; }
	const before = parseList(evt.oldValue);
	const after = parseList(evt.newValue);
	// 新值读不出(坏串 / 被清):不据此判「全删了」—— 主存坏了另有坏档链路处理
	if(evt.newValue !== null && evt.newValue !== undefined && evt.newValue !== '' && !after.length && before.length){
		try{ JSON.parse(evt.newValue); }catch(e){ return null; }
	}
	const afterMap = new Map(after.map((r)=>[`${r.cid}`, r]));
	const removed = [];
	const changed = [];
	const fieldsByCid = {};
	before.forEach((r)=>{
		const cid = `${r.cid}`;
		const n = afterMap.get(cid);
		if(!n){ removed.push(cid); return; }
		if(`${n.updateTime || ''}` !== `${r.updateTime || ''}` || JSON.stringify(n) !== JSON.stringify(r)){
			changed.push(cid);
			fieldsByCid[cid] = recordChangedFields(r, n);
		}
	});
	return { store, removed, changed, fieldsByCid };
}

// 接线(layouts 启动一次):返回解绑函数。dispatch = dva dispatch
export function bindRecordStoreCrossWindowSync(dispatch){
	if(typeof window === 'undefined' || typeof window.addEventListener !== 'function' || typeof dispatch !== 'function'){ return ()=>{}; }
	const onStorage = (evt)=>{
		let plan = null;
		try{ plan = recordStoreStoragePlan(evt); }catch(e){ plan = null; }
		if(!plan){ return; }
		try{
			if(plan.removed.length){
				dispatch({ type: plan.store === 'chart' ? 'user/detachCurrentChartIfRemoved' : 'user/clearCurrentCaseIfRemoved', payload: { cids: plan.removed } });
			}
			if(plan.changed.length || plan.removed.length){
				emitRecordsChanged({ store: plan.store, cids: plan.changed, fieldsByCid: plan.fieldsByCid, source: 'cross-window' });
			}
		}catch(e){ /* 跟不上只是当前那条没刷新,不影响存储 */ }
	};
	window.addEventListener('storage', onStorage);
	return ()=>window.removeEventListener('storage', onStorage);
}
