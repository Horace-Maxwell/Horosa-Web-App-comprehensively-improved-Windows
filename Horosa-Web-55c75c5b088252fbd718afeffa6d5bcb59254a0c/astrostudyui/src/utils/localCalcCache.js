const NONG_LI_NS = 'horosa.localcalc.nongli.v1';
const JIE_QI_NS = 'horosa.localcalc.jieqi.v1';
// 扩大缓存以提升性能
const MAX_NONG_LI = 1024;
const MAX_JIE_QI = 512;

let nongliMem = {};
let jieqiMem = {};
let loaded = false;

function canUseLocalStorage(){
	return typeof window !== 'undefined' && window.localStorage;
}

function toStr(v){
	return v === undefined || v === null ? '' : `${v}`;
}

function buildKey(params, keys){
	return keys.map((k)=>toStr(params && params[k])).join('|');
}

function loadIfNeeded(){
	if(loaded || !canUseLocalStorage()){
		return;
	}
	loaded = true;
	try{
		const nongliRaw = window.localStorage.getItem(NONG_LI_NS);
		const jieqiRaw = window.localStorage.getItem(JIE_QI_NS);
		nongliMem = nongliRaw ? (JSON.parse(nongliRaw) || {}) : {};
		jieqiMem = jieqiRaw ? (JSON.parse(jieqiRaw) || {}) : {};
	}catch(e){
		nongliMem = {};
		jieqiMem = {};
	}
}

function saveNS(ns, data){
	if(!canUseLocalStorage()){
		return;
	}
	try{
		window.localStorage.setItem(ns, JSON.stringify(data));
	}catch(e){
		// Ignore storage quota and serialization errors; memory cache still works.
	}
}

function trimByCount(mapObj, maxCount){
	const keys = Object.keys(mapObj);
	if(keys.length <= maxCount){
		return mapObj;
	}
	keys
		.sort((a, b)=>{
			const ta = mapObj[a] && mapObj[a].ts ? mapObj[a].ts : 0;
			const tb = mapObj[b] && mapObj[b].ts ? mapObj[b].ts : 0;
			return ta - tb;
		})
		.slice(0, keys.length - maxCount)
		.forEach((k)=>{
			delete mapObj[k];
		});
	return mapObj;
}

const NONG_LI_KEYS = ['date', 'time', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon', 'ad', 'gender', 'after23NewDay'];
const JIE_QI_KEYS = ['year', 'ad', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon'];

export function getNongliLocalCache(params){
	loadIfNeeded();
	const key = buildKey(params, NONG_LI_KEYS);
	if(!key){
		return null;
	}
	const hit = nongliMem[key];
	return hit && hit.data ? hit.data : null;
}

export function setNongliLocalCache(params, data){
	if(!data){
		return;
	}
	loadIfNeeded();
	const key = buildKey(params, NONG_LI_KEYS);
	if(!key){
		return;
	}
	nongliMem[key] = { ts: Date.now(), data };
	trimByCount(nongliMem, MAX_NONG_LI);
	saveNS(NONG_LI_NS, nongliMem);
}

export function getJieqiSeedLocalCache(params){
	loadIfNeeded();
	const key = buildKey(params, JIE_QI_KEYS);
	if(!key){
		return null;
	}
	const hit = jieqiMem[key];
	return hit && hit.data ? hit.data : null;
}

export function setJieqiSeedLocalCache(params, data){
	if(!data){
		return;
	}
	loadIfNeeded();
	const key = buildKey(params, JIE_QI_KEYS);
	if(!key){
		return;
	}
	jieqiMem[key] = { ts: Date.now(), data };
	trimByCount(jieqiMem, MAX_JIE_QI);
	saveNS(JIE_QI_NS, jieqiMem);
}

