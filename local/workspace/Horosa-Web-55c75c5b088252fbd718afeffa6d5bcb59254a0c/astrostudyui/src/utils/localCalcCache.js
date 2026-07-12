// 存储分层治理(FL 级事故后改造):派生缓存从 localStorage 迁 IndexedDB。
// 旧方案把逐月农历/节气结果写 localStorage(仅条目数上限、无字节账),数月累积 3.6MB
// 后顶死 origin 级 5MB 配额 → 全 App 一切 setItem 抛 QuotaExceededError,页页炸错误卡。
// 现方案:读路径不变(全走内存镜像);落盘换 idbCacheStore(磁盘级配额+字节预算+LRU);
// 首启迁移器把 localStorage 里的历史 horosa.localcalc.* 全部搬走并删除(含 v1 尸键),
// 老设备装新版第一次启动即自动痊愈。IndexedDB 不可用时自动降级纯内存,缓存 miss=多算一次。
import { idbScheduleWrite, idbGetAllByPrefix } from './idbCacheStore';
import { safeLocalStorageRemove } from './safeStorage';
const LOCAL_CALC_PREFIX = 'horosa.localcalc.';
const NONG_LI_NS = 'horosa.localcalc.nongli.v1';
const JIE_QI_NS = 'horosa.localcalc.jieqi.v2';
const JIE_QI_YEAR_NS = 'horosa.localcalc.jieqiYear.v2';
const BIRTH_GANZI_NS = 'horosa.localcalc.birthGanzhi.v1';
const LIURENG_RUNYEAR_NS = 'horosa.localcalc.liureng.runyear.v1';
const MAX_NONG_LI = 512;
const MAX_JIE_QI = 256;
const MAX_JIE_QI_YEAR = 128;
const MAX_BIRTH_GANZI = 256;
const MAX_LIURENG_RUNYEAR = 256;

let nongliMem = {};
let jieqiMem = {};
let jieqiYearMem = {};
let birthGanzhiMem = {};
let liurengRunyearMem = {};
let loaded = false;

function canUseLocalStorage(){
	return typeof window !== 'undefined' && window.localStorage;
}

function toStr(v){
	return v === undefined || v === null ? '' : `${v}`;
}

function toKeyPart(key, value){
	if(key === 'jieqis'){
		if(Array.isArray(value)){
			return value.map((item)=>toStr(item)).filter((item)=>item).join(',');
		}
		return toStr(value);
	}
	return toStr(value);
}

function buildKey(params, keys){
	return keys.map((k)=>toKeyPart(k, params && params[k])).join('|');
}

const MEM_BY_NS = {};

function parseInto(target, raw){
	if(!raw){
		return;
	}
	try{
		const parsed = JSON.parse(raw);
		if(parsed && typeof parsed === 'object'){
			// 内存里已有的条目(预载窗口内新写的)比磁盘旧值新,不覆盖。
			Object.keys(parsed).forEach((k)=>{
				if(!(k in target)){
					target[k] = parsed[k];
				}
			});
		}
	}catch(e){ /* 损坏即弃,缓存可再生 */ }
}

// 首启迁移器(幂等):把 localStorage 里的历史 horosa.localcalc.* 全部搬进 IndexedDB 并删除
// ——含现行五键与一切旧版尸键(如 jieqiYear.v1)。老设备装新版首启即释放 localStorage 配额。
function migrateLegacyLocalStorage(){
	if(!canUseLocalStorage()){
		return;
	}
	try{
		const legacy = [];
		for(let i = 0; i < window.localStorage.length; i++){
			const k = window.localStorage.key(i);
			if(k && k.indexOf(LOCAL_CALC_PREFIX) === 0){
				legacy.push(k);
			}
		}
		legacy.forEach((k)=>{
			const raw = window.localStorage.getItem(k);
			const mem = MEM_BY_NS[k];
			if(mem){
				parseInto(mem, raw);
				saveNS(k, mem);
			}
			safeLocalStorageRemove(k);
		});
	}catch(e){ /* 迁移失败不影响使用,下次启动重试 */ }
}

function loadIfNeeded(){
	if(loaded){
		return;
	}
	loaded = true;
	MEM_BY_NS[NONG_LI_NS] = nongliMem;
	MEM_BY_NS[JIE_QI_NS] = jieqiMem;
	MEM_BY_NS[JIE_QI_YEAR_NS] = jieqiYearMem;
	MEM_BY_NS[BIRTH_GANZI_NS] = birthGanzhiMem;
	MEM_BY_NS[LIURENG_RUNYEAR_NS] = liurengRunyearMem;
	// 异步预载 IndexedDB → 内存镜像(同步路径立即返回:预载完成前 miss=现算,零正确性影响)。
	idbGetAllByPrefix(LOCAL_CALC_PREFIX).then((entries)=>{
		entries.forEach((raw, ns)=>{
			const mem = MEM_BY_NS[ns];
			if(mem){
				parseInto(mem, raw);
			}
		});
		migrateLegacyLocalStorage();
	}).catch(()=>{});
}

function saveNS(ns, data){
	// 流畅度:缓存落盘移到空闲时段(读路径全走 *Mem 内存镜像);后端=IndexedDB(字节预算+LRU)。
	idbScheduleWrite(ns, ()=>JSON.stringify(data));
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

const NONG_LI_KEYS = ['date', 'time', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon', 'ad', 'gender', 'after23NewDay', 'lateZiHourUseNextDay', 'timeAlg'];
const JIE_QI_KEYS = ['year', 'ad', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon', 'timeAlg', 'jieqis', 'seedOnly'];
// ⚠️ 必须含 jieqis + seedOnly：seedOnly 模式下只返回所请求的节气,否则按粗 key(无 jieqis)缓存会让
// 春分(先请求,只返春分)的缓存被秋分/夏至/冬至命中 → seed[其它节气]缺失 → 入宫盘「未取到入宫时刻」(顺序依赖)。
const JIE_QI_YEAR_KEYS = ['year', 'ad', 'zone', 'lon', 'lat', 'gpsLat', 'gpsLon', 'timeAlg', 'hsys', 'zodiacal', 'doubingSu28', 'needBazi', 'needCharts', 'jieqis', 'seedOnly'];

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

export function getJieqiYearLocalCache(params){
	loadIfNeeded();
	const key = buildKey(params, JIE_QI_YEAR_KEYS);
	if(!key){
		return null;
	}
	const hit = jieqiYearMem[key];
	return hit && hit.data ? hit.data : null;
}

export function setJieqiYearLocalCache(params, data){
	if(!data){
		return;
	}
	loadIfNeeded();
	const key = buildKey(params, JIE_QI_YEAR_KEYS);
	if(!key){
		return;
	}
	jieqiYearMem[key] = { ts: Date.now(), data };
	trimByCount(jieqiYearMem, MAX_JIE_QI_YEAR);
	saveNS(JIE_QI_YEAR_NS, jieqiYearMem);
}

export function getBirthGanzhiLocalCache(key){
	loadIfNeeded();
	const finalKey = toStr(key);
	if(!finalKey){
		return '';
	}
	const hit = birthGanzhiMem[finalKey];
	return hit && hit.data ? `${hit.data}` : '';
}

export function setBirthGanzhiLocalCache(key, data){
	const finalKey = toStr(key);
	const finalData = toStr(data);
	if(!finalKey || !finalData){
		return;
	}
	loadIfNeeded();
	birthGanzhiMem[finalKey] = { ts: Date.now(), data: finalData };
	trimByCount(birthGanzhiMem, MAX_BIRTH_GANZI);
	saveNS(BIRTH_GANZI_NS, birthGanzhiMem);
}

export function getLiurengRunyearLocalCache(key){
	loadIfNeeded();
	const finalKey = toStr(key);
	if(!finalKey){
		return null;
	}
	const hit = liurengRunyearMem[finalKey];
	return hit && hit.data ? hit.data : null;
}

export function setLiurengRunyearLocalCache(key, data){
	const finalKey = toStr(key);
	if(!finalKey || !data){
		return;
	}
	loadIfNeeded();
	liurengRunyearMem[finalKey] = { ts: Date.now(), data };
	trimByCount(liurengRunyearMem, MAX_LIURENG_RUNYEAR);
	saveNS(LIURENG_RUNYEAR_NS, liurengRunyearMem);
}
