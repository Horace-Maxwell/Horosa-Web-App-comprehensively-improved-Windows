// Shared idempotent-POST cache + in-flight de-duplication for technique services.
//
// 提速但零降级:本工具只对**确定性纯计算**端点(相同 params 必产相同结果、无副作用、无随机/无"当前时刻"依赖)
// 做「同参复用 + 在途合并」。命中返回的是后端对**同一 params** 会返回结果的**深拷贝**——与直连请求逐值等价,
// 只会更快、不会不同。不同 params → 不同 key → 重新请求。
//
// 严禁用于:① LLM/AI 分析(要新鲜);② 卜卦/六爻等**带随机起卦**或依赖"现在时刻"的端点(会把随机/时变结果钉死=降级);
// ③ 任何有写库副作用的端点。是否确定性由调用方负责确认后才接入。
//
// 用法:把 `request(url,{body:JSON.stringify(values),...opts})` 换成
//       `cachedPost(url, values, opts, { ns: 'predictive' })`。

import request from '../utils/request';

const DEFAULT_MAX = 96;

// 每个 namespace(通常=端点)各自一套 LRU + inflight,互不串扰。
const registry = new Map();

function clonePlain(obj){
	if(obj === undefined || obj === null){
		return obj;
	}
	try{
		return JSON.parse(JSON.stringify(obj));
	}catch(e){
		return obj;
	}
}

function pushCache(map, key, val, max){
	if(!key || val === undefined || val === null){
		return;
	}
	if(map.has(key)){
		map.delete(key);
	}
	map.set(key, val);
	if(map.size > max){
		const first = map.keys().next().value;
		if(first !== undefined){
			map.delete(first);
		}
	}
}

function buildKey(values){
	try{
		return JSON.stringify(values || {});
	}catch(e){
		return '';
	}
}

function storeFor(ns, max){
	let s = registry.get(ns);
	if(!s){
		s = { mem: new Map(), inflight: new Map(), max: max || DEFAULT_MAX };
		registry.set(ns, s);
	}
	return s;
}

// 确定性纯计算 POST + 同参去重 + LRU 结果缓存。
// cacheOptions: { ns?: string(默认=url), max?: number, enabled?: boolean,
//                 key?: string —— 显式缓存键(PERF-R10 horosa_moira_stable_key_v1:body 里携带
//                 非确定性字段[随机 chartId 等]时,调用方以「决定响应的最小参数集」自供键,
//                 否则同参永不命中 = 缓存退化) }
// requestOptions.cache === false 也可临时关闭缓存(与 astro.js fetchChart 行为一致)。
export function cachedPost(url, values, requestOptions, cacheOptions){
	const opts = requestOptions || {};
	const cfg = cacheOptions || {};
	const ns = cfg.ns || url;
	const store = storeFor(ns, cfg.max);
	const disableCache = opts.cache === false || cfg.enabled === false;
	const key = disableCache ? '' : (cfg.key !== undefined && cfg.key !== null ? `${cfg.key}` : buildKey(values));
	if(key && store.mem.has(key)){
		return Promise.resolve(clonePlain(store.mem.get(key)));
	}
	if(key && store.inflight.has(key)){
		return store.inflight.get(key).then((rsp)=>clonePlain(rsp));
	}
	const req = request(url, {
		body: JSON.stringify(values),
		...opts,
	}).then((rsp)=>{
		// 只缓存"看起来成功"的响应;后端错误(rsp.err / 非0码视端点而定)不进缓存,避免把瞬时失败钉死。
		if(key && rsp && !rsp.err){
			pushCache(store.mem, key, clonePlain(rsp), store.max);
		}
		return rsp;
	}).finally(()=>{
		if(key){
			store.inflight.delete(key);
		}
	});
	if(key){
		store.inflight.set(key, req);
	}
	return req.then((rsp)=>clonePlain(rsp));
}

// [horosa_guolao_render_slice_v1] 同步窥探:某 ns 下给定 key 当前是否已有缓存果(不含在途)。
// 只用于「命中路径合并中间 setState」类调度决策 —— 窥探为真随后真取必命中(mem 只被 LRU 逐出,
// 同一同步段内不会);窥探为假走旧路径 = 恒安全。不返回值本体,零拷贝成本。
export function peekCachedPost(ns, key){
	const s = registry.get(ns);
	return !!(s && key && s.mem.has(`${key}`));
}

// 测试/失效用:清空某 ns 或全部缓存(技法切换/数据变更若需主动失效可调用;默认 LRU 自然淘汰)。
export function clearRequestCache(ns){
	if(ns){
		const s = registry.get(ns);
		if(s){
			s.mem.clear();
			s.inflight.clear();
		}
		return;
	}
	registry.forEach((s)=>{
		s.mem.clear();
		s.inflight.clear();
	});
}
