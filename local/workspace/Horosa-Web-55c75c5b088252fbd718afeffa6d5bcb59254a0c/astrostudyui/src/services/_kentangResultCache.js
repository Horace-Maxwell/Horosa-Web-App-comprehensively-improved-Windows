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

// horosa_kentang_l3_v1(PERF-R10 Ship5):给本层追加 L3(IndexedDB)持久位 —— kentang 族走
// 裸 fetch 不经 utils/request,重启后内存 LRU 全冷,首点 30-300ms 全额重付;而这些端点与
// requestDedupe 三层同族(确定性纯计算),同样适用「跨会话同参秒回」。信封与 requestDedupe
// 的 L3 逐条同款:rev 掺 &rv=(runtime 版本,更新后整体判 miss 封陈果)、TTL 24h、
// 空/错不入;键 = `kt.<ns>|<key>`(ns 显式、与端口无关,跨会话稳定)。
// clearKentangResultCache 只清内存(语义=会话内清仓);持久层由 TTL/rev 治理。
// kill:horosa.perf.kentangL3=0 ⇒ 纯内存 LRU 旧行为,逐字节不变。
import { idbGet, idbScheduleWrite } from '../utils/idbCacheStore';
import { kentangL3Enabled } from '../utils/perfFlags';

const DEFAULT_MAX = 48;

const KT_L3_REV_BASE = 'kt-v1';
const KT_L3_TTL_MS = 24 * 60 * 60 * 1000;
let ktRevCache = null;
function ktL3Rev(){
	if(ktRevCache !== null){
		return ktRevCache;
	}
	let rev = KT_L3_REV_BASE;
	try{
		if(typeof window !== 'undefined' && window.location){
			const rv = new URLSearchParams(window.location.search || '').get('rv');
			if(rv){
				rev = `${KT_L3_REV_BASE}|${rv}`;
			}
		}
	}catch(e){ /* 无 window/坏参=基础 rev */ }
	ktRevCache = rev;
	return rev;
}
export function __resetKtL3RevForTest(){
	ktRevCache = null;
}
function ktL3Key(ns, key){
	return `kt.${ns}|${key}`;
}
async function ktL3Get(ns, key){
	if(!kentangL3Enabled()){
		return undefined;
	}
	try{
		const raw = await idbGet(ktL3Key(ns, key));
		if(typeof raw !== 'string' || !raw){
			return undefined;
		}
		const row = JSON.parse(raw);
		if(row && row.rev === ktL3Rev() && typeof row.at === 'number'
			&& (Date.now() - row.at) <= KT_L3_TTL_MS
			&& row.value !== undefined && row.value !== null){
			return row.value;
		}
	}catch(e){ /* IDB 不可用/坏档即当 miss */ }
	return undefined;
}
function ktL3Put(ns, key, value){
	if(!kentangL3Enabled() || value === undefined || value === null){
		return;
	}
	try{
		const at = Date.now();
		idbScheduleWrite(ktL3Key(ns, key), ()=>{
			try{
				return JSON.stringify({ rev: ktL3Rev(), at, value });
			}catch(e){
				return null;
			}
		});
	}catch(e){ /* 写失败=下次重算 */ }
}

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
	// horosa_kentang_l3_v1:内存 miss → 持久位(重启后的首点由 30-300ms 冷算变 ~5-15ms IDB 读);
	// 命中同时回填内存 LRU(本会话内后续走纯内存)。
	if(key){
		const persisted = await ktL3Get(ns, key);
		if(persisted !== undefined && persisted !== null){
			if(store.mem.has(key)){
				store.mem.delete(key);
			}
			store.mem.set(key, clonePlain(persisted));
			if(store.mem.size > store.max){
				const first = store.mem.keys().next().value;
				if(first !== undefined){
					store.mem.delete(first);
				}
			}
			return clonePlain(persisted);
		}
	}
	const p = rawFn();
	if(key){
		store.inflight.set(key, p);
	}
	try{
		const res = await p;
		// 只缓存「拿到东西」的结果;抛错/空返回不入缓存,避免把瞬时失败钉死。
		if(key && res){
			ktL3Put(ns, key, res);
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
