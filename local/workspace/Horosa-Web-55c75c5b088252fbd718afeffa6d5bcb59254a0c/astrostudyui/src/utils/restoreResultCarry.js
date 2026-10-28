// 全量恢复的结果「带过刷新」:恢复一写完就刷新页面(恢复写进去的 40 多项设置要整页重载才对齐,
// 而刷新前留着窗口 = 任何一次写入都可能拿恢复前的内存态盖回去),结果先存进 sessionStorage,刷新后再弹出来给你看。
// 同一标签页刷新后 sessionStorage 还在;读一次即删(不会每次刷新都弹)。存不进(隐私模式等)→ 返回 false,调用方退回「先弹框、关框再刷新」。
import { safeStorageSetOn } from './safeStorage';

export const RESTORE_RESULT_CARRY_KEY = 'horosa.restore.pendingResult.v1';
const MAX_AGE_MS = 10 * 60 * 1000;   // 太久以前存下的(刷新失败、之后很久才又加载)不再弹

function sessionStore(){
	try{
		if(typeof window !== 'undefined' && window.sessionStorage){ return window.sessionStorage; }
	}catch(e){ /* 访问即抛:当没有 */ }
	return null;
}

// payload:{ title, bad:[{ key, label, detail }], at }。返回是否存进去了(写后读回核对)
export function stashRestoreResult(payload){
	const ss = sessionStore();
	if(!ss){ return false; }
	try{
		const text = JSON.stringify({ ...(payload || {}), at: Date.now() });
		if(!safeStorageSetOn(ss, RESTORE_RESULT_CARRY_KEY, text)){ return false; }
		return ss.getItem(RESTORE_RESULT_CARRY_KEY) === text;
	}catch(e){
		return false;
	}
}

// 有没有带过来的结果(只看在不在,不取;启动时据此决定要不要加载结果框那一块)
export function hasCarriedRestoreResult(){
	const ss = sessionStore();
	if(!ss){ return false; }
	try{ return !!ss.getItem(RESTORE_RESULT_CARRY_KEY); }catch(e){ return false; }
}

// 取出并删掉;没有 / 坏了 / 过期 → null。永不抛
export function takeRestoreResult(){
	const ss = sessionStore();
	if(!ss){ return null; }
	let raw = null;
	try{ raw = ss.getItem(RESTORE_RESULT_CARRY_KEY); }catch(e){ raw = null; }
	if(!raw){ return null; }
	try{ ss.removeItem(RESTORE_RESULT_CARRY_KEY); }catch(e){ /* 删不掉:下面照样只认没过期的 */ }
	try{
		const o = JSON.parse(raw);
		if(!o || typeof o !== 'object'){ return null; }
		if(!(Number(o.at) > 0) || Date.now() - Number(o.at) > MAX_AGE_MS){ return null; }
		return { ...o, bad: Array.isArray(o.bad) ? o.bad.filter((r)=>r && typeof r === 'object') : [] };
	}catch(e){
		return null;
	}
}
