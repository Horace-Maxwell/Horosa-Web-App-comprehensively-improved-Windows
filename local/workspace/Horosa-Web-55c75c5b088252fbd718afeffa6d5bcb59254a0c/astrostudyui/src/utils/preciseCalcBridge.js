import request from './request';
import { ServerRoot, ResultKey } from './constants';
import {
	getNongliLocalCache,
	setNongliLocalCache,
	getJieqiYearLocalCache,
	setJieqiYearLocalCache,
	getJieqiSeedLocalCache,
	setJieqiSeedLocalCache,
} from './localCalcCache';
import { buildLocalBaziResult } from './baziLunarLocal';
import { buildLocalJieqiYearSeed } from './localNongliAdapter';
import { neighborPrefetchEnabled } from './perfFlags';

const NONG_LI_KEYS = ['date', 'time', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon', 'ad', 'gender', 'after23NewDay', 'lateZiHourUseNextDay', 'timeAlg'];
const JIE_QI_SEED_KEYS = ['year', 'ad', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon', 'timeAlg', 'jieqis', 'seedOnly'];
const JIE_QI_YEAR_KEYS = ['year', 'ad', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon', 'timeAlg', 'hsys', 'zodiacal', 'doubingSu28', 'jieqis', 'seedOnly', 'needBazi', 'needCharts', 'after23NewDay', 'lateZiHourUseNextDay'];
const MAX_CACHE_SIZE = 192;
// 全 24 节气精确交节时刻种子。大雪/芒种:时家置闰(buildYinyangdunMap);冬至/夏至:日家60日块定半年/至甲子;
//   其余 20:茅山布局(qimenJuNameMaoshan 须任意节气的精确交节时刻,否则非锚点节气退拆补)。
//   后端 /jieqi/year 与本地 buildLocalJieqiYearSeed 本就一次算齐 24,扩列零额外请求、不影响速度。
const DEFAULT_SEED_TERMS = [
	'立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
	'立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
];
const PRECISE_REQ_TIMEOUT_MS = 45000;

const nongliMem = new Map();
const nongliInflight = new Map();
const jieqiYearMem = new Map();
const jieqiYearInflight = new Map();
const jieqiSeedMem = new Map();
const jieqiSeedInflight = new Map();

function safe(v, d = ''){
	return v === undefined || v === null ? d : `${v}`;
}

function parseZoneHour(zone){
	const text = safe(zone).trim();
	if(!text){
		return null;
	}
	const mStd = text.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
	if(mStd){
		const sign = mStd[1] === '-' ? -1 : 1;
		const hh = parseInt(mStd[2], 10);
		const mm = parseInt(mStd[3] || '0', 10);
		if(!Number.isNaN(hh) && !Number.isNaN(mm)){
			return sign * (hh + mm / 60);
		}
	}
	const mUtc = text.match(/^(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i);
	if(mUtc){
		const sign = mUtc[1] === '-' ? -1 : 1;
		const hh = parseInt(mUtc[2], 10);
		const mm = parseInt(mUtc[3] || '0', 10);
		if(!Number.isNaN(hh) && !Number.isNaN(mm)){
			return sign * (hh + mm / 60);
		}
	}
	const mCn = text.match(/^([东西])\s*(\d{1,2})(?:[:：]?(\d{1,2}))?\s*区?$/);
	if(mCn){
		const sign = mCn[1] === '西' ? -1 : 1;
		const hh = parseInt(mCn[2], 10);
		const mm = parseInt(mCn[3] || '0', 10);
		if(!Number.isNaN(hh) && !Number.isNaN(mm)){
			return sign * (hh + mm / 60);
		}
	}
	const numeric = Number(text);
	if(Number.isFinite(numeric)){
		return numeric;
	}
	return null;
}

function formatZoneHour(hour){
	if(hour === null || hour === undefined || Number.isNaN(hour)){
		return '+08:00';
	}
	const sign = hour < 0 ? '-' : '+';
	const abs = Math.abs(hour);
	let hh = Math.floor(abs);
	let mm = Math.round((abs - hh) * 60);
	if(mm >= 60){
		hh += 1;
		mm -= 60;
	}
	return `${sign}${`${hh}`.padStart(2, '0')}:${`${mm}`.padStart(2, '0')}`;
}

function normalizeZone(zone, fallback = '+08:00'){
	const parsed = parseZoneHour(zone);
	if(parsed !== null && !Number.isNaN(parsed)){
		return formatZoneHour(parsed);
	}
	const fb = parseZoneHour(fallback);
	return formatZoneHour((fb !== null && !Number.isNaN(fb)) ? fb : 8);
}

function normalizeAd(ad, date){
	const text = safe(ad).trim().toUpperCase();
	if(text === 'BC' || text === 'BCE'){
		return -1;
	}
	if(text === 'AD' || text === 'CE'){
		return 1;
	}
	if(text){
		const n = parseInt(text, 10);
		if(!Number.isNaN(n) && n !== 0){
			return n > 0 ? 1 : -1;
		}
	}
	const dateText = safe(date).trim();
	return dateText.startsWith('-') ? -1 : 1;
}

function normalizeBit(value, def = 0){
	if(value === undefined || value === null || value === ''){
		return def === 1 ? 1 : 0;
	}
	if(value === true){
		return 1;
	}
	if(value === false){
		return 0;
	}
	const text = safe(value).trim().toLowerCase();
	if(text === '1' || text === 'true' || text === 'yes'){
		return 1;
	}
	return 0;
}

function normalizeNongliParams(params){
	const src = params || {};
	return {
		...src,
		zone: normalizeZone(src.zone, '+08:00'),
		ad: normalizeAd(src.ad, src.date),
		timeAlg: normalizeBit(src.timeAlg, 0),
		after23NewDay: normalizeBit(src.after23NewDay, 0),
		// v2.2.1: 默认 1 = 跟现行 lunar.js Exact 行为一致(用次日干起子时);=0 才是新行为(用今日干起子时)。
		lateZiHourUseNextDay: normalizeBit(src.lateZiHourUseNextDay, 1),
	};
}

function normalizeJieqiParams(params){
	const src = params || {};
	return {
		...src,
		zone: normalizeZone(src.zone, '+08:00'),
		ad: normalizeAd(src.ad),
		timeAlg: normalizeBit(src.timeAlg, 0),
	};
}

function pushCache(cacheMap, key, val){
	if(!key || val === undefined || val === null){
		return;
	}
	if(cacheMap.has(key)){
		cacheMap.delete(key);
	}
	cacheMap.set(key, val);
	if(cacheMap.size > MAX_CACHE_SIZE){
		const first = cacheMap.keys().next().value;
		if(first){
			cacheMap.delete(first);
		}
	}
}

function buildKey(params, keys){
	return keys.map((k)=>{
		if(k === 'jieqis'){
			const list = params && Array.isArray(params.jieqis) ? params.jieqis : [];
			return list.join(',');
		}
		return safe(params && params[k]);
	}).join('|');
}

function toDateKey(time){
	const txt = safe(time);
	if(!txt){
		return '';
	}
	const date = txt.split(' ')[0] || '';
	return date.replace(/-/g, '');
}

function normalizeDayGanzhi(entry){
	if(entry && entry.dayGanzhi){
		return safe(entry.dayGanzhi);
	}
	if(entry && entry.dayGanZhi){
		return safe(entry.dayGanZhi);
	}
	const bazi = entry && entry.bazi ? entry.bazi : null;
	const four = bazi && bazi.fourColumns ? bazi.fourColumns : null;
	const day = four && four.day ? four.day : null;
	return safe((day && (day.ganzi || day.ganZhi)) || '');
}

function jieqiFromText(text){
	const source = safe(text);
	const after = source.indexOf('后第');
	if(after > 0){
		return source.substring(0, after);
	}
	const before = source.indexOf('前第');
	if(before > 0){
		return source.substring(0, before);
	}
	return source.length >= 2 ? source.substring(0, 2) : '';
}

function buildLocalNongliFallback(params){
	try{
		const local = buildLocalBaziResult(params || {});
		const bazi = local && local.bazi ? local.bazi : null;
		const nongli = bazi && bazi.nongli ? bazi.nongli : null;
		const four = bazi && bazi.fourColumns ? bazi.fourColumns : {};
		if(!bazi || !nongli){
			return null;
		}
		const result = {
			...nongli,
			bazi,
			yearGanZi: safe(four.year && four.year.ganzi),
			yearJieqi: safe(four.year && four.year.ganzi),
			monthGanZi: safe(four.month && four.month.ganzi),
			dayGanZi: safe(four.day && four.day.ganzi),
			time: safe(four.time && four.time.ganzi),
			timeGanZi: safe(four.time && four.time.ganzi),
			local: true,
		};
		if(!result.jieqi){
			result.jieqi = jieqiFromText(result.jiedelta);
		}
		// [Q-202/T-145] 与后端 /nongli/time 同形:year=干支年(本地 buildNongli 的 year 是汉字数字)、monthInt/dayInt=农历数字月日
		// (六爻 genTimeGua/buildTimeGua 读这三键;此前回落形态 year 汉字→支序 -1、月日 undefined → NaN 抛错/返回 null)。
		result.year = result.yearGanZi || result.year;
		if(result.monthInt === undefined || result.monthInt === null){ result.monthInt = nongli.monthNum != null ? nongli.monthNum : (result.monthNum != null ? result.monthNum : undefined); }
		if(result.dayInt === undefined || result.dayInt === null){ result.dayInt = nongli.dayNum != null ? nongli.dayNum : (result.dayNum != null ? result.dayNum : undefined); }
		return result;
	}catch(e){
		return null;
	}
}

function buildLocalJieqiYearFallback(params){
	const year = parseInt(safe(params && params.year), 10);
	if(!year || Number.isNaN(year)){
		return null;
	}
	const seed = buildLocalJieqiYearSeed(year, params && params.zone);
	if(!seed){
		return null;
	}
	const jieqi24 = Object.keys(seed).map((term)=>({
		jieqi: term,
		time: safe(seed[term] && seed[term].time),
		bazi: {
			fourColumns: {
				day: {
					ganzi: safe(seed[term] && seed[term].dayGanzhi),
				},
			},
		},
	}));
	return {
		year,
		jieqi24,
		local: true,
	};
}

function fillJieqiDayGanzhiFromLocal(result, params){
	if(!result || !Array.isArray(result.jieqi24)){
		return result;
	}
	const year = parseInt(safe((params && params.year) || result.year), 10);
	if(!year || Number.isNaN(year)){
		return result;
	}
	let localSeed = null;
	const getLocalDayGanzhi = (term)=>{
		if(!localSeed){
			localSeed = buildLocalJieqiYearSeed(year, params && params.zone);
		}
		return safe(localSeed && localSeed[term] && localSeed[term].dayGanzhi);
	};
	let changed = false;
	const jieqi24 = result.jieqi24.map((entry)=>{
		const term = safe(entry && entry.jieqi);
		if(!term || normalizeDayGanzhi(entry)){
			return entry;
		}
		const localDay = getLocalDayGanzhi(term);
		if(!localDay){
			return entry;
		}
		changed = true;
		return {
			...(entry || {}),
			dayGanzhi: localDay,
			bazi: {
				...((entry && entry.bazi) || {}),
				fourColumns: {
					...(((entry && entry.bazi && entry.bazi.fourColumns) || {})),
					day: {
						...(((entry && entry.bazi && entry.bazi.fourColumns && entry.bazi.fourColumns.day) || {})),
						ganzi: localDay,
					},
				},
			},
		};
	});
	return changed ? { ...result, jieqi24, localDayGanzhiFilled: true } : result;
}

function normalizeSeedTerms(params){
	const terms = params && Array.isArray(params.jieqis) ? params.jieqis : DEFAULT_SEED_TERMS;
	const uniq = [];
	terms.forEach((term)=>{
		const t = safe(term);
		if(t && uniq.indexOf(t) < 0){
			uniq.push(t);
		}
	});
	if(!uniq.length){
		return [...DEFAULT_SEED_TERMS];
	}
	return uniq;
}

function buildJieqiSeedRequestParams(params){
	const terms = normalizeSeedTerms(params);
	return {
		...(params || {}),
		jieqis: terms,
		seedOnly: true,
	};
}

function hasSeedTerms(seed, terms){
	if(!seed || !Array.isArray(terms) || !terms.length){
		return false;
	}
	for(let i=0; i<terms.length; i++){
		if(!seed[terms[i]]){
			return false;
		}
	}
	return true;
}

export async function fetchPreciseNongli(params){
	const reqParams = normalizeNongliParams(params);
	const key = buildKey(reqParams, NONG_LI_KEYS);
	if(key && nongliMem.has(key)){
		return nongliMem.get(key);
	}
	const localHit = getNongliLocalCache(reqParams);
	if(localHit){
		if(key){
			pushCache(nongliMem, key, localHit);
		}
		return localHit;
	}
	if(key && nongliInflight.has(key)){
		return nongliInflight.get(key);
	}
	const req = (async()=>{
		try{
			const rsp = await request(`${ServerRoot}/nongli/time`, {
				body: JSON.stringify(reqParams),
				silent: true,
				timeoutMs: PRECISE_REQ_TIMEOUT_MS,
			});
			const result = rsp && rsp[ResultKey] ? rsp[ResultKey] : null;
			if(result){
				pushCache(nongliMem, key, result);
				setNongliLocalCache(reqParams, result);
				return result;
			}
			// 软失败:后端返非 0 码 / 网络抖动会让 request 返回 undefined(不抛异常),
			// 原本写在下面 catch 里的本地兜底永不触发 → 奇门/太乙离线即空、改经纬度(缓存未命中)即暴露。
			// 故对 !result 的软失败也走一次本地兜底,与 /liureng/gods 行为对齐。
			const softFallback = buildLocalNongliFallback(reqParams);
			if(softFallback){
				pushCache(nongliMem, key, softFallback);
				setNongliLocalCache(reqParams, softFallback);
			}
			return softFallback;
		}catch(e){
			const fallback = buildLocalNongliFallback(reqParams);
			if(fallback){
				pushCache(nongliMem, key, fallback);
				setNongliLocalCache(reqParams, fallback);
			}
			return fallback;
		}
	})().finally(()=>{
		if(key){
			nongliInflight.delete(key);
		}
	});
	if(key){
		nongliInflight.set(key, req);
	}
	return req;
}

export async function fetchPreciseJieqiYear(params){
	const reqParams = normalizeJieqiParams(params);
	const key = buildKey(reqParams, JIE_QI_YEAR_KEYS);
	if(key && jieqiYearMem.has(key)){
		return jieqiYearMem.get(key);
	}
	const localHit = getJieqiYearLocalCache(reqParams);
	if(localHit){
		if(key){
			pushCache(jieqiYearMem, key, localHit);
		}
		return localHit;
	}
	if(key && jieqiYearInflight.has(key)){
		return jieqiYearInflight.get(key);
	}
	const req = (async()=>{
		try{
			const rsp = await request(`${ServerRoot}/jieqi/year`, {
				body: JSON.stringify(reqParams),
				silent: true,
				timeoutMs: PRECISE_REQ_TIMEOUT_MS,
			});
			const result = rsp && rsp[ResultKey] ? rsp[ResultKey] : null;
			if(result){
				const filledResult = fillJieqiDayGanzhiFromLocal(result, reqParams);
				pushCache(jieqiYearMem, key, filledResult);
				setJieqiYearLocalCache(reqParams, filledResult);
			}
			return result ? fillJieqiDayGanzhiFromLocal(result, reqParams) : result;
		}catch(e){
			const fallback = localHit || buildLocalJieqiYearFallback(reqParams);
			if(fallback){
				pushCache(jieqiYearMem, key, fallback);
				setJieqiYearLocalCache(reqParams, fallback);
			}
			return fallback || null;
		}
	})().finally(()=>{
		if(key){
			jieqiYearInflight.delete(key);
		}
	});
	if(key){
		jieqiYearInflight.set(key, req);
	}
	return req;
}

// PERF-R8 P3(邻位预取):分至图年份步进的 year±1 静默预取 —— 只在「当前年已取到」之后
// 由调用方(JieQiChartsMain)显式触发(用户已进入分至页=已表达意图;重端点 /jieqi/year
// 因此不进排盘后的默认预热组)。同参仅换 year,经 fetchPreciseJieqiYear 自身的
// L1/localStorage/inflight 三层幂等;顺序发(+1 先,步进多为前进)→ 任意时刻在途邻位 ≤1。
// generation 门控:连点步进时旧邻位任务自动失格,绝无预取风暴。
// 闸 horosa.perf.neighborPrefetch(默认开);失败静默,绝不影响业务。
let jieqiNeighborGeneration = 0;
export function prefetchJieqiYearNeighbors(params){
	try{
		if(!neighborPrefetchEnabled()){ return; }
		const base = normalizeJieqiParams(params);
		const year = parseInt(base.year, 10);
		if(!Number.isFinite(year)){ return; }
		const gen = ++jieqiNeighborGeneration;
		const fire = (y)=>{
			if(gen !== jieqiNeighborGeneration){ return Promise.resolve(null); }
			return fetchPreciseJieqiYear({ ...base, year: `${y}` }).catch(()=>null);
		};
		// 250ms 让当前年的渲染先行;随后顺序预取 +1、-1。
		setTimeout(()=>{ fire(year + 1).then(()=>fire(year - 1)); }, 250);
	}catch(e){ /* 预取失败静默 */ }
}

export async function fetchPreciseJieqiSeed(params){
	const reqParams = buildJieqiSeedRequestParams(normalizeJieqiParams(params));
	const requiredTerms = reqParams.jieqis;
	const key = buildKey(reqParams, JIE_QI_SEED_KEYS);
	if(key && jieqiSeedMem.has(key)){
		const memHit = jieqiSeedMem.get(key);
		if(hasSeedTerms(memHit, requiredTerms)){
			return memHit;
		}
	}
	const localHit = getJieqiSeedLocalCache(reqParams);
	if(hasSeedTerms(localHit, requiredTerms)){
		if(key){
			pushCache(jieqiSeedMem, key, localHit);
		}
		return localHit;
	}
	if(key && jieqiSeedInflight.has(key)){
		return jieqiSeedInflight.get(key);
	}
	const req = (async()=>{
		const yearRes = await fetchPreciseJieqiYear(reqParams);
		if(!yearRes || !Array.isArray(yearRes.jieqi24)){
			return null;
		}
		const seed = {};
		yearRes.jieqi24.forEach((entry)=>{
			const term = safe(entry && entry.jieqi);
			if(!term){
				return;
			}
			const time = safe(entry && entry.time);
			seed[term] = {
				term,
				time,
				dateKey: toDateKey(time),
				dayGanzhi: normalizeDayGanzhi(entry),
			};
		});
		const result = Object.keys(seed).length ? seed : null;
		if(result && hasSeedTerms(result, requiredTerms)){
			pushCache(jieqiSeedMem, key, result);
			setJieqiSeedLocalCache(reqParams, result);
			return result;
		}
		return null;
	})().finally(()=>{
		if(key){
			jieqiSeedInflight.delete(key);
		}
	});
	if(key){
		jieqiSeedInflight.set(key, req);
	}
	return req;
}
