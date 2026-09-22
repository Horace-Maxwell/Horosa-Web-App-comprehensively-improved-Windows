// [批五] 会话内「界面操作轨迹」:导航 / 合盘配对这类不落盘的界面动作不进持久账本(账本合同=可撤销的写入;导航跨刷新无意义),
// 只记内存环(≤ UI_TRAIL_MAX)+ 事件广播;动作条按 turnId 渲染「回到上一页」;刷新即清,零 localStorage、零数据层 import。
export const UI_TRAIL_MAX = 20;
export const UI_TRAIL_EVENT = 'horosa:agent-ui-trail';
let items = [];
let seq = 0;

function emit(){
	if(typeof window === 'undefined' || typeof window.dispatchEvent !== 'function'){ return; }
	try{ window.dispatchEvent(new CustomEvent(UI_TRAIL_EVENT, { detail: { count: items.length } })); }catch(e){ /* 旧环境无 CustomEvent:不广播,读端仍可 listUiTrail */ }
}

// { kind:'route'|'pair', label, before, after, turnId?, undo?:()=>{ok?} } → id
export function pushUiTrail(entry){
	const e = entry || {};
	seq += 1;
	const id = `ui-${Date.now().toString(36)}-${seq}`;
	items = items.concat([{ id, kind: `${e.kind || 'route'}`, label: `${e.label || ''}`.slice(0, 120), before: e.before || null, after: e.after || null, turnId: e.turnId ? `${e.turnId}` : '', at: new Date().toISOString(), undone: false, _undo: typeof e.undo === 'function' ? e.undo : null }]).slice(-UI_TRAIL_MAX);
	emit();
	return id;
}

export function listUiTrail(filter){
	const f = filter || {};
	return items.filter((x)=>!f.turnId || x.turnId === `${f.turnId}`).map(({ _undo, ...rest })=>({ ...rest, canUndo: !rest.undone && typeof _undo === 'function' }));
}

export function undoUiTrail(id){
	const it = items.find((x)=>x.id === id);
	if(!it || it.undone){ return { ok: false, code: 'E_ACTION_NOT_FOUND' }; }
	if(typeof it._undo !== 'function'){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE' }; }
	let r = null;
	try{ r = it._undo(); }catch(e){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE', message: e && e.message ? e.message : `${e}` }; }
	if(r && r.ok === false){ return { ok: false, code: r.code || 'E_UNDO_NOT_APPLICABLE', message: r.message }; }
	it.undone = true;
	emit();
	return { ok: true, id, kind: it.kind };
}

export function subscribeUiTrail(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>fn(listUiTrail());
	window.addEventListener(UI_TRAIL_EVENT, h);
	return ()=>window.removeEventListener(UI_TRAIL_EVENT, h);
}

export function __resetUiTrailForTests(){ items = []; seq = 0; }
