// [R5 N2] 技法使用频次(设备本地)—— 预载序 / 空闲预热序按「这台机器上谁最常用」动态化。
//
// 病根:chunk 预载(pages/index.js startIdlePreload)、引擎空闲预热(idleWarmQueue ENGINE_WARM_IMPORTS)、
// 排盘后数据预热(dataWarmTasks 登记序)都是写死的「全体用户首点概率序」;一个天天只用六壬的用户,
// 六壬引擎排在第 5 位、六壬 chunk 排在 hot 档第 10 位,首点前的空闲窗口先花在他从不点的技法上。
// 修法:切页即计数(localStorage `horosa.perf.techUsage.v1`,horosa.perf.* 前缀已在存储键登记表为设备本地、不备份),
// 三条队列出队前按计数降序稳定排序 —— 没记录的项保持原声明序(全新安装 = 与旧序逐项相同,零行为差)。
// 只改后台预载 / 预热的先后,不改任何业务路径;kill-switch:localStorage `horosa.perf.usageOrderedPreload` = '0'。
import { flagEnabled } from './perfFlags';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safeStorage';

export const TECH_USAGE_KEY = 'horosa.perf.techUsage.v1';
const MAX_KEYS = 64;

export function usageOrderedPreloadEnabled(){
	return flagEnabled('horosa.perf.usageOrderedPreload');
}

/** 读计数表 {navKey: count};坏数据 / 无存储 → {}。(读写一律走 safeStorage 封装层,同全站存储纪律) */
export function readTechniqueUsage(){
	try{
		const raw = safeLocalStorageGet(TECH_USAGE_KEY);
		if(!raw){ return {}; }
		const o = JSON.parse(raw);
		if(!o || typeof o !== 'object' || Array.isArray(o)){ return {}; }
		const out = {};
		Object.keys(o).forEach((k)=>{ const n = Number(o[k]); if(k && Number.isFinite(n) && n > 0){ out[k] = Math.floor(n); } });
		return out;
	}catch(e){ return {}; }
}

/** 切页计数(navKey = 导航键);键数超上限时丢计数最少的;写失败静默(配额满 / 隐私模式)。 */
export function recordTechniqueVisit(navKey){
	if(!navKey || typeof navKey !== 'string'){ return; }
	try{
		const o = readTechniqueUsage();
		o[navKey] = (o[navKey] || 0) + 1;
		const keys = Object.keys(o);
		if(keys.length > MAX_KEYS){
			keys.sort((a, b)=>o[a] - o[b]).slice(0, keys.length - MAX_KEYS).forEach((k)=>{ delete o[k]; });
		}
		safeLocalStorageSet(TECH_USAGE_KEY, JSON.stringify(o));
	}catch(e){ /* 静默 */ }
}

/**
 * 按使用频次稳定排序:计数高的在前;计数相同 / 无计数的保持传入顺序(传入顺序 = 原声明序 / 档位序)。
 * 开关关 → 原样返回副本(逐项同旧序)。
 * @param {Array} items
 * @param {(item:any)=>string|null} keyOf 取该项的导航键(取不到 = 视作无计数)
 * @param {object} [usage] 测试注入;缺省读存储
 */
export function orderByUsage(items, keyOf, usage){
	const list = Array.isArray(items) ? items.slice() : [];
	if(!usageOrderedPreloadEnabled()){ return list; }
	const u = usage && typeof usage === 'object' ? usage : readTechniqueUsage();
	return list
		.map((it, i)=>{ let k = null; try{ k = keyOf ? keyOf(it) : null; }catch(e){ k = null; } return { it, i, c: (k && Number(u[k])) || 0 }; })
		.sort((a, b)=>(b.c - a.c) || (a.i - b.i))
		.map((x)=>x.it);
}

export function __resetTechniqueUsageForTest(){
	safeLocalStorageRemove(TECH_USAGE_KEY);
}
