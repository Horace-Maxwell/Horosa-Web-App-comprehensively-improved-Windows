// [Q-020/M-25] 挂载缓存「口径签名」单源:全局古典排盘参数(classicalChartGlobals 非默认键)+ 判读全局仓 + 日界/晚子时全局偏好
// 的稳定序列化短哈希。两层缓存(源层 context_cache / 技法层模块快照)写入时打签,命中时比对:
// 改过「星盘设置」全局口径或日界偏好后,旧签名的缓存不再直喂(此前只比 updatedAt / 出生签名,只能靠手动清缓存)。
// 只读全局仓,不碰页面态;页面局部覆盖不进签名(签名只回答「全局口径自存档以来变没变」)。
import { getClassicalChartGlobals, CLASSICAL_GLOBAL_DEFAULTS } from './classicalChartGlobals';
import { divinationJudgeOverrides } from './divinationJudgeGlobals';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from './dayBoundary';

export const MOUNT_CALIBRE_SIGNATURE_VERSION = 1;

function stableJson(obj){
	if(!obj || typeof obj !== 'object'){ return `${obj}`; }
	return JSON.stringify(Object.keys(obj).sort().reduce((acc, k)=>{ acc[k] = obj[k]; return acc; }, {}));
}

function hash32(str){
	let h = 2166136261;
	for(let i = 0; i < str.length; i++){
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h.toString(16).padStart(8, '0');
}

// 非默认的全局古典键(默认值不进签名:用户从未改过的键与出厂态同签)。
function nonDefaultClassicalGlobals(){
	let g = null;
	try{ g = getClassicalChartGlobals(); }catch(_e){ g = null; }
	const out = {};
	if(!g || typeof g !== 'object'){ return out; }
	Object.keys(g).forEach((k)=>{
		const v = g[k];
		if(v === undefined || v === null || v === ''){ return; }
		if(CLASSICAL_GLOBAL_DEFAULTS && Object.prototype.hasOwnProperty.call(CLASSICAL_GLOBAL_DEFAULTS, k) && `${CLASSICAL_GLOBAL_DEFAULTS[k]}` === `${v}`){ return; }
		out[k] = v;
	});
	return out;
}

export function mountCalibreSignature(){
	let judge = {};
	try{ judge = divinationJudgeOverrides() || {}; }catch(_e){ judge = {}; }
	let a23 = 1;
	let lz = 1;
	try{ a23 = defaultAfter23NewDay(); }catch(_e){ a23 = 1; }
	try{ lz = defaultLateZiHourUseNextDay(); }catch(_e){ lz = 1; }
	const body = `${MOUNT_CALIBRE_SIGNATURE_VERSION}|${stableJson(nonDefaultClassicalGlobals())}|${stableJson(judge)}|${a23}|${lz}`;
	return `v${MOUNT_CALIBRE_SIGNATURE_VERSION}:${hash32(body)}`;
}
