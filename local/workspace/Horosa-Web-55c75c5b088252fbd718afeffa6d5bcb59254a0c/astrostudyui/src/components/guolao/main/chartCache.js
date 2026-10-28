// 七政四余页 · 排盘请求与缓存:缓存上限与二十八宿口径常量、内存缓存 / 在途请求、参数规范化、缓存键、带缓存的排盘请求。
// 只被 components/guolao/GuoLaoChartMain.js 与同目录 main/ 下的兄弟模块引用。
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../../utils/dayBoundary';
import { responseCacheable } from '../../../utils/resultEnvelope';
import * as Constants from '../../../utils/constants';
import request from '../../../utils/request';
import { normalizeGuolaoLifeMode } from '../GuoLaoChartStyle';
import { clonePlain, hasGuolaoRiseSetFields } from './aspectsNodeMode';
import { toSlashDate } from '../../../utils/dateStrSafe';
import { registerProcessCache } from '../../../utils/processCacheRegistry';

const GUOLAO_CACHE_MAX = 96;
export const GUOLAO_SU28_CACHE_REV = 'guolao_moira_su28_v9_eqtropical7';
export const GUOLAO_SU28_MODE_ZHENG_SIDEREAL = 4;
export const GUOLAO_SU28_MODE_GUFA_LICHENG = 6;   // WP-D 授时历古法立成(推变黄道·古法不等宫)
export const GUOLAO_SU28_MODE_EQUATORIAL_TROPICAL = 7;   // 额外档 赤道回归制·元明(固定古度宿界·春分/牛前冬至锚)
export const GUOLAO_SU28_MODE_EQUATORIAL_TROPICAL_LIVE = 8;   // 赤道回归·实时(宿宽=盘历元距星真赤经·同款回归锚)
export const guolaoMem = new Map();
const guolaoInflight = new Map();
registerProcessCache('guolao.chart', ()=>{ guolaoMem.clear(); guolaoInflight.clear(); });   // 同参复用上次结果:登记清空函数(只供审计仪器取样前清空)

export function pushCache(map, key, val, max = GUOLAO_CACHE_MAX){
	if(!map || !key || val === undefined || val === null){
		return;
	}
	if(map.has(key)){
		map.delete(key);
	}
	map.set(key, val);
	if(map.size > max){
		const first = map.keys().next().value;
		if(first){
			map.delete(first);
		}
	}
}

function normalizeDateText(val){
	const raw = `${val || ''}`.trim();
	if(!raw){
		return '';
	}
	const one = raw.indexOf(' ') >= 0 ? raw.split(' ')[0] : raw;
	return toSlashDate(one);
}

function normalizeTimeText(val){
	const raw = `${val || ''}`.trim();
	if(!raw){
		return '';
	}
	const one = raw.indexOf(' ') >= 0 ? raw.split(' ')[1] : raw;
	if(/^\d{2}:\d{2}$/.test(one)){
		return `${one}:00`;
	}
	return one;
}

function normalizeNumText(val, defVal = 0){
	const num = Number(val);
	if(!Number.isFinite(num)){
		return `${defVal}`;
	}
	return `${num}`;
}

function normalizeGpsText(val){
	const num = Number(val);
	if(!Number.isFinite(num)){
		return '';
	}
	return `${Math.round(num * 1000000) / 1000000}`;
}

function normalizeChartParams(input){
	const src = input || {};
	const birth = `${src.birth || ''}`.trim();
	const birthParts = birth ? birth.split(' ') : [];
	const birthDate = birthParts[0] || '';
	const birthTime = birthParts[1] || '';
	return {
		date: normalizeDateText(src.date || birthDate),
		time: normalizeTimeText(src.time || birthTime || '00:00:00'),
		ad: normalizeNumText(src.ad, 1),
		zone: `${src.zone || ''}`,
		lon: `${src.lon || ''}`,
		lat: `${src.lat || ''}`,
		gpsLon: normalizeGpsText(src.gpsLon),
		gpsLat: normalizeGpsText(src.gpsLat),
		hsys: normalizeNumText(src.hsys, 0),
		zodiacal: normalizeNumText(src.zodiacal, 0),
		tradition: normalizeNumText(src.tradition, 0),
		doubingSu28: normalizeNumText(src.doubingSu28, 0),
		guolaoZhengSidereal: normalizeNumText(src.guolaoZhengSidereal, 0),
		siderealAyanamsa: src.siderealAyanamsa ? `${src.siderealAyanamsa}` : '',   // G2 恒星制岁差进缓存键(否则切 ayan 命中旧盘)
		guolaoTrueSolarTime: (src.trueSolarTime === 'mean' || src.trueSolarTime === 'off') ? src.trueSolarTime : 'true',  // G6 报时星太阳时进缓存键
		planetaryHourMethod: (src.planetaryHourMethod === 'unequal' || src.planetaryHourMethod === 'equal24') ? src.planetaryHourMethod : 'sunrise',  // 行星时制式进缓存键(否则切制式命中旧报时星)
		guolaoNodeType: src.guolaoNodeType === 'true' ? 'true' : 'mean',      // G10 罗计交点 真/平
		guolaoLilithType: src.guolaoLilithType === 'true' ? 'true' : 'mean',  // G11 月孛远地点 真/平
		guolaoZiqiMode: 'real',  // G12 紫炁仅今法真算;'tablet'(28年立成)假档已隐藏,旧快照残留一律归一回 real
		guolaoTuibianMethod: (src.guolaoTuibianMethod === 'jintui' || src.guolaoTuibianMethod === 'huiyuan') ? src.guolaoTuibianMethod : 'jiyuan',  // WP-D 授时历古法推变法进缓存键
		guolaoGufaPrecess: (src.guolaoGufaPrecess === 1 || src.guolaoGufaPrecess === '1') ? 1 : 0,  // WP-D 古宿岁差进缓存键(否则切则命中旧盘)
		guolaoEqTropicalAnchor: src.guolaoEqTropicalAnchor === 'chunfen' ? 'chunfen' : 'dongzhi',  // 赤道回归锚点进缓存键
		guolaoBodyMode: `${src.guolaoBodyMode || 'taiyin'}`,  // G20/R3 身宫法(taiyin/youjin/地支自定);进缓存键→切则重取 moira
		guolaoLifeMode: normalizeGuolaoLifeMode(src.guolaoLifeMode),
		strongRecption: normalizeNumText(src.strongRecption, 0),
		simpleAsp: normalizeNumText(src.simpleAsp, 0),
		virtualPointReceiveAsp: normalizeNumText(src.virtualPointReceiveAsp, 0),
		predictive: normalizeNumText(src.predictive, 0),
		// v2.2.1: 两个全局开关必须进 cache key,否则切日界/晚子时后 key 不变 → 命中旧盘,刷新才生效。
		after23NewDay: normalizeNumText(src.after23NewDay, defaultAfter23NewDay()),
		lateZiHourUseNextDay: normalizeNumText(src.lateZiHourUseNextDay, defaultLateZiHourUseNextDay()),
		_su28Rev: src._su28Rev || GUOLAO_SU28_CACHE_REV,
	};
}

export function buildGuolaoKey(input){
	try{
		return JSON.stringify(normalizeChartParams(input));
	}catch(e){
		return '';
	}
}

export function isChartObjMatchParams(chartObj, params){
	if(!chartObj || !chartObj.params || !params){
		return false;
	}
	const chartKey = buildGuolaoKey(chartObj.params);
	const paramKey = buildGuolaoKey(params);
	return !!chartKey && chartKey === paramKey;
}

// 同一位命主(出生日期 · 时刻 · 时区 · 经纬度相同;设置可以不同)。取盘失败时只许留用同一位命主的旧盘,
// 换了人就不能拿上一位的盘顶着画。
const NATAL_IDENTITY_KEYS = ['date', 'time', 'zone', 'lon', 'lat'];
export function isChartObjSameNatal(chartObj, params){
	if(!chartObj || !chartObj.params || !params){
		return false;
	}
	const a = normalizeChartParams(chartObj.params);
	const b = normalizeChartParams(params);
	return !!a.date && NATAL_IDENTITY_KEYS.every((k)=>a[k] === b[k]);
}

export async function fetchGuolaoChartCached(params, options){
	const opt = options || {};
	const key = buildGuolaoKey(params);
	const disableCache = opt.cache === false;
	if(!disableCache && key && guolaoMem.has(key)){
		const cached = guolaoMem.get(key);
		if(hasGuolaoRiseSetFields(cached)){
			return clonePlain(cached);
		}
		guolaoMem.delete(key);
	}
	if(!disableCache && key && guolaoInflight.has(key)){
		const inflight = await guolaoInflight.get(key);
		return clonePlain(inflight);
	}
	const req = request(`${Constants.ServerRoot}/chart`, {
		body: JSON.stringify(params),
		silent: opt.silent !== false,
	}).then((data)=>{
		const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
		if(!disableCache && key && result && responseCacheable(data)){   // 只缓存真成功的回包(业务错误 Result.err / 顶层 err 不进缓存,判据单一出处 resultEnvelope)
			pushCache(guolaoMem, key, clonePlain(result));
		}
		return result;
	}).finally(()=>{
		if(!disableCache && key){
			guolaoInflight.delete(key);
		}
	});
	if(!disableCache && key){
		guolaoInflight.set(key, req);
	}
	const result = await req;
	return clonePlain(result);
}
