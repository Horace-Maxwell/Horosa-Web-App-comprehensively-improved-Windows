// 决策层 · 校准记录的读写与「模型号钉住」(单源;无 IO 之外的依赖,client / calibration / 面板都从这里读)。
// 记录形状 { model, at, points: { [pointId]: { passed, metrics, reason } }, drift: '' | '<回体里出现的别的模型号>' }
//   · 阈值与成绩按**真实模型号**绑定(别名 jev-latest 指向会变);
//   · 回体模型号 ≠ 已校准模型号 → 记 drift:所有点视为未校准(pointOn 恒假 → 走回落),界面提示重新校准;
//   · 装载时把 isPointCalibrated 注入 prefs(prefs 不能反向 import 本模块)。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage, safeLocalStorageRemove, safeLocalStorageGet } from '../safeStorage';
import { SYSTEMONE_CALIBRATION_KEY, __setCalibratedCheck } from './prefs';

export const SYSTEMONE_CALIBRATION_EVENT = 'horosa:systemone-calibration-changed';

let cacheRaw = null;
let cacheObj = null;

function normalizeRecord(raw){
	if(!raw || typeof raw !== 'object' || Array.isArray(raw)){ return null; }
	const points = {};
	const p = raw.points && typeof raw.points === 'object' ? raw.points : {};
	Object.keys(p).forEach((id)=>{
		const r = p[id];
		if(!r || typeof r !== 'object'){ return; }
		points[id] = { passed: r.passed === true, metrics: r.metrics && typeof r.metrics === 'object' ? { ...r.metrics } : {}, reason: `${r.reason || ''}` };
	});
	return { model: `${raw.model || ''}`, at: `${raw.at || ''}`, points, drift: `${raw.drift || ''}` };
}

function emit(){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(SYSTEMONE_CALIBRATION_EVENT));
		}
	}catch(e){ /* noop */ }
}

// 读:按原串缓存(pointOn 在发送热路径上逐次调用;JSON 解析只在存储真变时做一次)
export function readCalibration(){
	let raw = null;
	try{ raw = safeLocalStorageGet(SYSTEMONE_CALIBRATION_KEY); }catch(e){ raw = null; }
	if(raw === cacheRaw){ return cacheObj; }
	cacheRaw = raw;
	cacheObj = raw ? normalizeRecord(safeJsonParseFromStorage(SYSTEMONE_CALIBRATION_KEY)) : null;
	return cacheObj;
}

export function writeCalibration(record){
	const norm = normalizeRecord(record);
	if(!norm){ return null; }
	try{ safeJsonStringifyToStorage(SYSTEMONE_CALIBRATION_KEY, norm); }catch(e){ /* 配额 */ }
	cacheRaw = null;
	emit();
	return readCalibration();
}

export function clearCalibration(){
	try{ safeLocalStorageRemove(SYSTEMONE_CALIBRATION_KEY); }catch(e){ /* noop */ }
	cacheRaw = null;
	cacheObj = null;
	emit();
}

export function calibratedModel(){
	const c = readCalibration();
	return c ? c.model : '';
}

export function isPointCalibrated(pointId){
	const c = readCalibration();
	if(!c || !c.model || c.drift){ return false; }
	const p = c.points[`${pointId}`];
	return !!(p && p.passed);
}

export function pointCalibration(pointId){
	const c = readCalibration();
	return c && c.points[`${pointId}`] ? { ...c.points[`${pointId}`], model: c.model, at: c.at, drift: c.drift } : null;
}

// 每次真实回体都报一次模型号:与已校准的不同 → 记 drift(这次回答由调用方作废走回落)
export function noteResponseModel(model){
	const m = `${model || ''}`.trim();
	const c = readCalibration();
	if(!c || !c.model || !m){ return { drift: false }; }
	if(m === c.model){ return { drift: false }; }
	if(c.drift !== m){ writeCalibration({ ...c, drift: m }); }
	return { drift: true, calibrated: c.model, seen: m };
}

export function clearDrift(){
	const c = readCalibration();
	if(c && c.drift){ writeCalibration({ ...c, drift: '' }); }
}

export function subscribeCalibration(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>fn(readCalibration());
	window.addEventListener(SYSTEMONE_CALIBRATION_EVENT, h);
	const sh = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || k === SYSTEMONE_CALIBRATION_KEY){ cacheRaw = null; fn(readCalibration()); } };
	window.addEventListener('storage', sh);
	return ()=>{ window.removeEventListener(SYSTEMONE_CALIBRATION_EVENT, h); window.removeEventListener('storage', sh); };
}

// 测试缝:直接写一份「某模型下这些点已过」的记录
export function __setCalibrationForTest(model, passedPointIds){
	const points = {};
	(passedPointIds || []).forEach((id)=>{ points[id] = { passed: true, metrics: { n: 0 }, reason: 'test' }; });
	return writeCalibration({ model, at: new Date().toISOString(), points, drift: '' });
}

export function __resetCalibrationStoreForTest(){
	cacheRaw = null;
	cacheObj = null;
	try{ safeLocalStorageRemove(SYSTEMONE_CALIBRATION_KEY); }catch(e){ /* noop */ }
	__setCalibratedCheck(isPointCalibrated);
}

// 装载即注入:prefs.pointOn 从此按本记录判「校准通过」
__setCalibratedCheck(isPointCalibrated);
