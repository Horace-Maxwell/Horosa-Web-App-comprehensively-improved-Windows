// 六爻卦辞离线兜底缓存(请求卦辞成功即缓存;网络层失败读缓存 —— 离线 / 后端未起仍有卦辞)。
//
// 按**单卦**存:'horosa.guadesc.cache.v2.<六爻串>',六十四卦各一把(注册表 maxEntries: 64),本卦 / 变卦 / 互卦读时拼。
// 此前按三卦组合存('horosa.guadesc.cache.<本>|<变>|<互>',组合空间 64³),每起一卦、换一爻就多一把、从不修剪,
// 常用六爻的用户几百次起卦就以 MB 计,而配额自愈清单里又没有它 —— 写满后设置与记录都写不进。
// 旧组合键:第一次写入时整族清掉(读不到旧键只是离线时少一份兜底,下一次在线就补上)。
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safeStorage';

export const GUA_DESC_CACHE_PREFIX = 'horosa.guadesc.cache.';
const SINGLE_PREFIX = `${GUA_DESC_CACHE_PREFIX}v2.`;
export const GUA_DESC_CACHE_MAX_ENTRIES = 64;
const GUA_ID_RE = /^[01]{6}$/;

let legacyPruned = false;

function singleKey(id){
	return `${SINGLE_PREFIX}${id}`;
}

// 本族里不是「合法单卦键」的一律清掉(旧版三卦组合键 / 手改出来的杂键);返回清掉几把。永不抛
export function pruneGuaDescCache(){
	let n = 0;
	try{
		if(typeof window === 'undefined' || !window.localStorage){ return 0; }
		const doomed = [];
		for(let i = 0; i < window.localStorage.length; i++){
			const k = window.localStorage.key(i);
			if(!k || k.indexOf(GUA_DESC_CACHE_PREFIX) !== 0){ continue; }
			const id = k.indexOf(SINGLE_PREFIX) === 0 ? k.slice(SINGLE_PREFIX.length) : null;
			if(!(id && GUA_ID_RE.test(id))){ doomed.push(k); }
		}
		doomed.forEach((k)=>{ safeLocalStorageRemove(k); n++; });
	}catch(e){ /* 尽力而为 */ }
	return n;
}

// desc:{ guaOrg, guaRes, guaMiddle } 各为该卦卦辞对象;ids:{ guaOrg, guaRes, guaMiddle } 各为六爻串
export function writeGuaDescCache(ids, desc){
	if(!ids || !desc){ return; }
	if(!legacyPruned){
		legacyPruned = true;
		pruneGuaDescCache();
	}
	['guaOrg', 'guaRes', 'guaMiddle'].forEach((slot)=>{
		const id = ids[slot];
		const v = desc[slot];
		if(!GUA_ID_RE.test(`${id || ''}`) || v === undefined || v === null){ return; }
		let text = null;
		try{ text = JSON.stringify(v); }catch(e){ text = null; }
		if(!text){ return; }
		const key = singleKey(id);
		if(safeLocalStorageGet(key) === text){ return; }   // 同一卦卦辞不变:不重复写
		safeLocalStorageSet(key, text);
	});
}

// 三卦都有缓存才返回 { guaOrg, guaRes, guaMiddle };缺任何一卦 → null(与此前「整组缓存」同一语义)
export function readGuaDescCache(ids){
	if(!ids){ return null; }
	const out = {};
	const slots = ['guaOrg', 'guaRes', 'guaMiddle'];
	for(let i = 0; i < slots.length; i++){
		const id = ids[slots[i]];
		if(!GUA_ID_RE.test(`${id || ''}`)){ return null; }
		const raw = safeLocalStorageGet(singleKey(id));
		if(!raw){ return null; }
		try{ out[slots[i]] = JSON.parse(raw); }catch(e){ return null; }
	}
	return out;
}

export function __resetGuaDescCacheForTest(){
	legacyPruned = false;
}
