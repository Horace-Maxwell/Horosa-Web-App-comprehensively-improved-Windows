// horosa_kentang_result_cache_v1 —— kentang(:8899)直连端点的「同参复用 + 在途合并」LRU。
//
// 为什么单独一层:这些技法用裸 fetch/fetchChartWithRetry 直连 kentang(不经 utils/request),
// 因此拿不到 request 层的 requestDedupe/chartMem;services/qizheng.js 早已为 /qizhengkin/pan
// 手搓过一份 kinKey/kinClone/kinMem/kinInflight(cap 48)。本文件是那份实现的**逐条同款**抽取,
// 语义一字不变(LRU 上限 48、命中返回深拷贝、在途 Promise 合并、失败不入缓存),只是不再逐文件复制。
//
// 约束与 services/_requestCache.js 头部完全一致 —— 只对**确定性纯计算**端点使用:
// 相同 payload 必产相同结果、无随机、无「现在时刻」依赖、无写库副作用。
// 严禁用于:① 随机起卦/揲筮(地占随机种、荆诀蓍草分揲…… 缓存会把随机结果钉死=功能降级);
// ② AI/SSE;③ 有副作用端点。是否确定性由调用方负责确认后才接入,并须由
// utils/perfFlags.techniqueResultCacheEnabled() 闸控(关闸即逐字回到直连)。

const DEFAULT_MAX = 48;

// 每个 namespace(显式传入,**不得**由 URL 派生 —— ServerRoot 端口每次后端启动随机,
// URL 派生的 ns 会跨会话碎片化)各自一套 LRU + inflight,互不串扰。
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

function storeFor(ns, max){
	let s = registry.get(ns);
	if(!s){
		s = { mem: new Map(), inflight: new Map(), max: max || DEFAULT_MAX };
		registry.set(ns, s);
	}
	return s;
}

// 键只由**请求体**构成(调用方可加 path/serviceKey 前缀区分同 ns 内的不同子端点)。
export function kentangCacheKey(values){
	try{
		return JSON.stringify(values || {});
	}catch(e){
		return '';
	}
}

// 确定性直连调用 + 同参去重 + LRU 结果缓存。
// cacheOptions: { key?: string(默认=JSON.stringify(values)), max?: number(默认 48) }
export async function cachedKentangCall(ns, values, rawFn, cacheOptions){
	const cfg = cacheOptions || {};
	const store = storeFor(ns, cfg.max);
	const key = cfg.key !== undefined && cfg.key !== null ? `${cfg.key}` : kentangCacheKey(values);
	if(key && store.mem.has(key)){
		return clonePlain(store.mem.get(key));
	}
	if(key && store.inflight.has(key)){
		return clonePlain(await store.inflight.get(key));
	}
	const p = rawFn();
	if(key){
		store.inflight.set(key, p);
	}
	try{
		const res = await p;
		// 只缓存「拿到东西」的结果;抛错/空返回不入缓存,避免把瞬时失败钉死。
		if(key && res){
			if(store.mem.has(key)){
				store.mem.delete(key);
			}
			store.mem.set(key, clonePlain(res));
			if(store.mem.size > store.max){
				const first = store.mem.keys().next().value;
				if(first !== undefined){
					store.mem.delete(first);
				}
			}
		}
		return clonePlain(res);
	}finally{
		if(key){
			store.inflight.delete(key);
		}
	}
}

// 测试/失效用:清空某 ns 或全部缓存(默认 LRU 自然淘汰,业务侧无需主动失效)。
export function clearKentangResultCache(ns){
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
