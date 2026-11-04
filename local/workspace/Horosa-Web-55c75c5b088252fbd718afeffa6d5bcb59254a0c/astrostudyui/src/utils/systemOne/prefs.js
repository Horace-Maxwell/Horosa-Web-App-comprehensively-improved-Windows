// 决策层(TypeSafe System One / Jev)· 开关与变更事件(单源)。
// 总开关缺省关 = 与现状逐字节相同:凡接缝都写成 `pointOn(id) ? await decide(id, …) : null`,关路径连一个 await 都不多。
// 铁律:①总开关只认字符串 '1';②每个接入点各有分开关(off / on / shadow;缺省 off),影子只记一致率不改行为;
//       ③分开关开着也要过「有档案」与「该点在当前模型号上校准通过」两道,任一不过 = 走原路径;
//       ④本模块零 IO 依赖(档案住 IndexedDB,由 integrations/systemOne.js 在读 / 存 / 删档案时把「有无档案」同步进内存缓存)。
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove, safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../safeStorage';

export const SYSTEMONE_ENABLED_KEY = 'horosa.ai.systemone.enabled';
export const SYSTEMONE_POINTS_KEY = 'horosa.ai.systemone.points.v1';
export const SYSTEMONE_THRESHOLDS_KEY = 'horosa.ai.systemone.thresholds.v1';
export const SYSTEMONE_CALIBRATION_KEY = 'horosa.ai.systemone.calibration.v1';
export const SYSTEMONE_STATS_KEY = 'horosa.ai.systemone.stats.v1';
export const SYSTEMONE_DISCLOSURE_KEY = 'horosa.ai.systemone.disclosure.v1';
export const SYSTEMONE_PREFS_EVENT = 'horosa:systemone-prefs-changed';
export const POINT_MODES = ['off', 'on', 'shadow'];

let profilePresent = null;   // null = 未知(还没读过 IndexedDB);true / false = integrations 层同步进来的事实

export function isSystemOneEnabled(){
	return safeLocalStorageGet(SYSTEMONE_ENABLED_KEY) === '1';
}

function emit(detail){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(SYSTEMONE_PREFS_EVENT, { detail: detail || {} }));
		}
	}catch(e){ /* noop */ }
}

export function setSystemOneEnabled(on){
	safeLocalStorageSet(SYSTEMONE_ENABLED_KEY, on ? '1' : '0');
	emit({ key: 'enabled', enabled: isSystemOneEnabled() });
	return isSystemOneEnabled();
}

export function readPointModes(){
	const raw = safeJsonParseFromStorage(SYSTEMONE_POINTS_KEY);
	const out = {};
	if(raw && typeof raw === 'object' && !Array.isArray(raw)){
		Object.keys(raw).forEach((k)=>{ if(POINT_MODES.indexOf(raw[k]) >= 0){ out[k] = raw[k]; } });
	}
	return out;
}

export function getPointMode(pointId){
	const m = readPointModes()[`${pointId}`];
	return POINT_MODES.indexOf(m) >= 0 ? m : 'off';
}

export function setPointMode(pointId, mode){
	const id = `${pointId || ''}`.trim();
	if(!id){ return 'off'; }
	const next = readPointModes();
	if(POINT_MODES.indexOf(mode) < 0 || mode === 'off'){ delete next[id]; }else{ next[id] = mode; }
	// 表空 = 删键(备份面 / 重载判据都按「键在不在」;不留一个 {} 占位)
	try{ if(Object.keys(next).length){ safeJsonStringifyToStorage(SYSTEMONE_POINTS_KEY, next); }else{ safeLocalStorageRemove(SYSTEMONE_POINTS_KEY); } }catch(e){ /* 配额 */ }
	emit({ key: 'points', pointId: id, mode: getPointMode(id) });
	return getPointMode(id);
}

// 阈值:每点一张小表(缺省值在各点定义里;这里只存用户改过的键)
export function readThresholds(pointId){
	const raw = safeJsonParseFromStorage(SYSTEMONE_THRESHOLDS_KEY);
	const all = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
	const t = all[`${pointId}`];
	return t && typeof t === 'object' && !Array.isArray(t) ? { ...t } : {};
}

export function setThresholds(pointId, patch){
	const id = `${pointId || ''}`.trim();
	if(!id){ return {}; }
	const raw = safeJsonParseFromStorage(SYSTEMONE_THRESHOLDS_KEY);
	const all = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
	const cur = all[id] && typeof all[id] === 'object' ? { ...all[id] } : {};
	Object.keys(patch || {}).forEach((k)=>{
		const v = patch[k];
		if(v === null || v === undefined || v === ''){ delete cur[k]; return; }
		const n = Number(v);
		if(Number.isFinite(n)){ cur[k] = n; }
	});
	if(Object.keys(cur).length){ all[id] = cur; }else{ delete all[id]; }
	try{ if(Object.keys(all).length){ safeJsonStringifyToStorage(SYSTEMONE_THRESHOLDS_KEY, all); }else{ safeLocalStorageRemove(SYSTEMONE_THRESHOLDS_KEY); } }catch(e){ /* 配额 */ }
	emit({ key: 'thresholds', pointId: id });
	return readThresholds(id);
}

export function isDisclosureAcknowledged(){
	return safeLocalStorageGet(SYSTEMONE_DISCLOSURE_KEY) === '1';
}

export function acknowledgeDisclosure(){
	safeLocalStorageSet(SYSTEMONE_DISCLOSURE_KEY, '1');
	emit({ key: 'disclosure' });
	return true;
}

// integrations/systemOne.js 读 / 存 / 删档案后调用;pointOn 只看这份内存事实(同步、零 IO)
export function setSystemOneProfilePresent(present){
	profilePresent = present === null || present === undefined ? null : !!present;
	emit({ key: 'profile', present: profilePresent });
	return profilePresent;
}

export function isSystemOneProfilePresent(){
	return profilePresent === true;
}

// 校准通过与否由 calibration.js 决定;为避免循环 import,这里留一个可注入的判定函数(calibration.js 装载时注入;未注入 = 一律未校准)
let calibratedCheck = null;
export function __setCalibratedCheck(fn){ calibratedCheck = typeof fn === 'function' ? fn : null; }
export function isPointCalibrated(pointId){
	try{ return !!(calibratedCheck && calibratedCheck(`${pointId}`)); }catch(e){ return false; }
}

// 接缝唯一判据(同步):总开关 ∧ 分开关 = on ∧ 有档案 ∧ 该点在当前模型号上校准通过
export function pointOn(pointId){
	if(!isSystemOneEnabled()){ return false; }
	if(getPointMode(pointId) !== 'on'){ return false; }
	if(!isSystemOneProfilePresent()){ return false; }
	return isPointCalibrated(pointId);
}

// 影子:总开关 ∧ 分开关 = shadow ∧ 有档案(影子不改行为,不要求校准 —— 影子本身就是在攒校准所需的一致率)
export function pointShadow(pointId){
	if(!isSystemOneEnabled()){ return false; }
	if(getPointMode(pointId) !== 'shadow'){ return false; }
	return isSystemOneProfilePresent();
}

export function subscribeSystemOnePrefs(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = (e)=>fn(e && e.detail ? e.detail : {});
	window.addEventListener(SYSTEMONE_PREFS_EVENT, h);
	// 跨窗口:另一个窗口写了本模块的键(storage 事件只在别的窗口触发)→ 本窗口也重发;key 为空 = 整个 storage 被清
	const mine = [SYSTEMONE_ENABLED_KEY, SYSTEMONE_POINTS_KEY, SYSTEMONE_THRESHOLDS_KEY, SYSTEMONE_CALIBRATION_KEY, SYSTEMONE_DISCLOSURE_KEY];
	const sh = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || mine.indexOf(k) >= 0){ fn({ key: 'storage', storageKey: k }); } };
	window.addEventListener('storage', sh);
	return ()=>{ window.removeEventListener(SYSTEMONE_PREFS_EVENT, h); window.removeEventListener('storage', sh); };
}

export function __resetSystemOnePrefsForTest(){
	profilePresent = null;
	calibratedCheck = null;
}
