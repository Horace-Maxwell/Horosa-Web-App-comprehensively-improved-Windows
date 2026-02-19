import request from './request';
import { ServerRoot, ResultKey } from './constants';
import {
	getNongliLocalCache,
	setNongliLocalCache,
	getJieqiSeedLocalCache,
	setJieqiSeedLocalCache,
} from './localCalcCache';

const NONG_LI_KEYS = ['date', 'time', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon', 'ad', 'gender', 'after23NewDay'];
const JIE_QI_SEED_KEYS = ['year', 'ad', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon'];
const JIE_QI_YEAR_KEYS = ['year', 'ad', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon', 'hsys', 'zodiacal', 'doubingSu28', 'jieqis'];
// 扩大缓存大小以提升性能
const MAX_CACHE_SIZE = 512;

const nongliMem = new Map();
const nongliInflight = new Map();
const jieqiYearMem = new Map();
const jieqiYearInflight = new Map();
const jieqiSeedMem = new Map();
const jieqiSeedInflight = new Map();
const warmupStamp = new Map();
const WARMUP_INTERVAL_MS = 90 * 1000;
const WARMUP_DELAY_MS = 120;

function safe(v, d = ''){
	return v === undefined || v === null ? d : `${v}`;
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
	const bazi = entry && entry.bazi ? entry.bazi : null;
	const four = bazi && bazi.fourColumns ? bazi.fourColumns : null;
	const day = four && four.day ? four.day : null;
	return safe(day && day.ganzi);
}

export async function fetchPreciseNongli(params){
	const key = buildKey(params, NONG_LI_KEYS);
	if(key && nongliMem.has(key)){
		return nongliMem.get(key);
	}
	const localHit = getNongliLocalCache(params);
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
				body: JSON.stringify(params),
				noGlobalLoading: true,
			});
			const result = rsp && rsp[ResultKey] ? rsp[ResultKey] : null;
			if(result){
				pushCache(nongliMem, key, result);
				setNongliLocalCache(params, result);
			}
			return result;
		}catch(e){
			return null;
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
	const key = buildKey(params, JIE_QI_YEAR_KEYS);
	if(key && jieqiYearMem.has(key)){
		return jieqiYearMem.get(key);
	}
	if(key && jieqiYearInflight.has(key)){
		return jieqiYearInflight.get(key);
	}
	const req = (async()=>{
		try{
			const rsp = await request(`${ServerRoot}/jieqi/year`, {
				body: JSON.stringify(params),
				noGlobalLoading: true,
			});
			const result = rsp && rsp[ResultKey] ? rsp[ResultKey] : null;
			if(result){
				pushCache(jieqiYearMem, key, result);
			}
			return result;
		}catch(e){
			return null;
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

export async function fetchPreciseJieqiSeed(params){
	const key = buildKey(params, JIE_QI_SEED_KEYS);
	if(key && jieqiSeedMem.has(key)){
		return jieqiSeedMem.get(key);
	}
	const localHit = getJieqiSeedLocalCache(params);
	if(localHit){
		if(key){
			pushCache(jieqiSeedMem, key, localHit);
		}
		return localHit;
	}
	if(key && jieqiSeedInflight.has(key)){
		return jieqiSeedInflight.get(key);
	}
	const req = (async()=>{
		const yearRes = await fetchPreciseJieqiYear(params);
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
		if(result){
			pushCache(jieqiSeedMem, key, result);
			setJieqiSeedLocalCache(params, result);
		}
		return result;
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

function normalizeWarmupParams(params){
	const now = new Date();
	const defaultDate = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
	const opt = params || {};
	return {
		date: safe(opt.date, defaultDate),
		time: safe(opt.time, '12:00:00'),
		zone: safe(opt.zone, '8'),
		lon: safe(opt.lon, '116.4074'),
		lat: safe(opt.lat, '39.9042'),
		gpsLat: safe(opt.gpsLat, ''),
		gpsLon: safe(opt.gpsLon, ''),
		ad: opt.ad === undefined || opt.ad === null ? 1 : opt.ad,
		gender: opt.gender === undefined || opt.gender === null ? 1 : opt.gender,
	};
}

function buildWarmupKey(params){
	return [
		safe(params && params.date),
		safe(params && params.time),
		safe(params && params.zone),
		safe(params && params.lon),
		safe(params && params.lat),
		safe(params && params.gpsLat),
		safe(params && params.gpsLon),
		safe(params && params.ad),
		safe(params && params.gender),
	].join('|');
}

function shouldSkipWarmup(warmupKey, intervalMs){
	if(!warmupKey){
		return false;
	}
	const prev = warmupStamp.get(warmupKey);
	const now = Date.now();
	if(prev && now - prev < intervalMs){
		return true;
	}
	warmupStamp.set(warmupKey, now);
	if(warmupStamp.size > MAX_CACHE_SIZE){
		const first = warmupStamp.keys().next().value;
		if(first){
			warmupStamp.delete(first);
		}
	}
	return false;
}

function runWhenIdle(task, delayMs){
	if(typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'){
		window.requestIdleCallback(()=>{
			task();
		}, { timeout: 1000 });
		return;
	}
	setTimeout(task, delayMs);
}

// 预热缓存：轻量且去重，避免启动阶段被预热请求淹没。
export function warmupCache(params, options){
	const opt = options || {};
	const normalized = normalizeWarmupParams(params);
	const intervalMs = Number.isFinite(opt.intervalMs) && opt.intervalMs > 0 ? opt.intervalMs : WARMUP_INTERVAL_MS;
	const warmupKey = buildWarmupKey(normalized);
	if(!opt.force && shouldSkipWarmup(warmupKey, intervalMs)){
		return;
	}
	const run = ()=>{
		const targetYear = parseInt(`${normalized.date}`.slice(0, 4), 10) || (new Date()).getFullYear();
		const nongliParams = {
			...normalized,
			after23NewDay: 0,
		};
		const jieqiParams = {
			year: `${targetYear}`,
			ad: normalized.ad,
			zone: normalized.zone,
			lon: normalized.lon,
			lat: normalized.lat,
			gpsLat: normalized.gpsLat,
			gpsLon: normalized.gpsLon,
		};
		const jobs = [
			fetchPreciseNongli(nongliParams),
			fetchPreciseJieqiSeed(jieqiParams),
		];
		if(opt.mode === 'adjacent-year'){
			jobs.push(fetchPreciseJieqiSeed({ ...jieqiParams, year: `${targetYear - 1}` }));
			jobs.push(fetchPreciseJieqiSeed({ ...jieqiParams, year: `${targetYear + 1}` }));
		}
		Promise.all(jobs.map((job)=>Promise.resolve(job).catch(()=>null))).catch(()=>null);
	};
	if(opt.immediate){
		run();
		return;
	}
	runWhenIdle(run, WARMUP_DELAY_MS);
}
