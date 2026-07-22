// [R3-A3] C 型(kentang :8899 直连)统一缓存壳 —— 此前 20 个卜类/kinastro 模块的 /pan
// 走裸 fetch:无 L1/L2/L3、无在途去重,每次时间/选项变更=全程 Python 重算(热态 ~80-300ms)。
// 本壳把 B 型(requestDedupe)同款三层缓存补给 C 型,同 body 恒同果(服务端已审计:
// 唯一 server-now 兜底=qizhengkin 缺年键,见 QIZHENGKIN_YEAR_KEYS 定点守卫;
// 荆诀/太玄 random 为 body 种子内随机=确定性,state 保存恢复)。
//
// 设计铁律:
//   · 签名兼容:cachedKentangFetch(url, fetchOpts, cfg) 与 fetchChartWithRetry 同参,
//     返回 Response 形对象({ok,status,text(),json()}),调用方解析/校验逻辑逐字节不动;
//   · 缓存存【原始 text】,命中即 JSON.parse = 天然深拷贝(零共享引用互染);
//   · 空文/坏 JSON/ResultCode≠0 一律不入缓存(PLAYBOOK 坑49);HTTP !ok 原样透传不消费 body;
//   · 键=去端口化 path + body(照 L3 先例,防端口漂移废缓存);L3 信封 rev=kt-v1|rv(版本闸);
//   · 预取纪律(纵深防御,矩阵哨兵之外再拦一道):policy!=='deterministic' 的模块
//     prefetchKentang 直接拒绝 —— 含种子模块「可缓存不可预取」在代码层锁死。
// kill-switch:horosa.perf.kentangCache(关=直通 fetchChartWithRetry,逐字节旧行为)。
import { fetchChartWithRetry } from './chartFetch';
import { idbGet, idbScheduleWrite } from './idbCacheStore';
import { kentangCacheEnabled } from './perfFlags';
import { perfBegin } from './perfMark';
import { getPerfCoverageKentang } from './perfCoverageManifest';

const L1_TTL_MS = 30 * 1000;
const L1_MAX = 80;
const L2_TTL_MS = 10 * 60 * 1000;
const L2_MAX = 48;
const L3_REV_BASE = 'kt-v1';
const L3_TTL_MS = 24 * 60 * 60 * 1000;

const inflight = new Map();  // key -> Promise<text>
const l1 = new Map();        // key -> { at, text }(插入序 LRU)
const l2 = new Map();        // key -> { at, text }(访问提升 LRU)

// qizhengkin 服务端对缺年键用 datetime.now().year 兜底(webqizhengkinsrv.py)——
// 该形态的响应依赖服务器日期,缓存会把「今年」冻住 → 缺键即不入缓存(全 20 模块唯一例外)。
const QIZHENGKIN_YEAR_KEYS = ['qizhengKinCurrentYear', 'currentYear'];

let l3RevCache = null;
function l3Rev(){
	if(l3RevCache !== null){ return l3RevCache; }
	let rev = L3_REV_BASE;
	try{
		if(typeof window !== 'undefined' && window.location){
			const rv = new URLSearchParams(window.location.search || '').get('rv');
			if(rv){ rev = `${L3_REV_BASE}|${rv}`; }
		}
	}catch(e){ /* 无 window/坏参=基础 rev */ }
	l3RevCache = rev;
	return rev;
}

function pathOf(url){
	try{
		const u = new URL(url, 'http://x');
		return u.pathname || url;
	}catch(e){ return String(url); }
}

function moduleOf(url){
	const p = pathOf(url);
	const seg = p.split('/').filter(Boolean);
	return seg.length ? seg[0] : '';
}

export function buildKentangCacheKey(url, body){
	return `kt.${pathOf(url)} ${body}`;
}

// 矩阵之外的特许模块:jieqi 是 core 服务(非 kentang 注册表)但被卜类自由时间派生
// (divinationTimeDraft.postJieqi)直连 —— 纯星历实算,确定性,享同款缓存。
const EXTRA_MODULE_POLICY = { jieqi: 'deterministic' };

function modulePolicy(moduleKey){
	if(EXTRA_MODULE_POLICY[moduleKey]){ return EXTRA_MODULE_POLICY[moduleKey]; }
	try{
		const row = getPerfCoverageKentang()[moduleKey];
		return row ? row.policy : null;
	}catch(e){ return null; }
}

function payloadCacheable(moduleKey, bodyStr){
	if(moduleKey === 'qizhengkin'){
		try{
			const body = JSON.parse(bodyStr);
			if(!QIZHENGKIN_YEAR_KEYS.some((k)=>body && body[k] !== undefined && body[k] !== null && body[k] !== '')){
				return false; // 缺年键=服务端 now() 兜底形态,不缓存
			}
		}catch(e){ return false; }
	}
	// horosa_wuzhao_random_guard_v1(Windows-ahead):五兆**自动揲筮**档(mode!=='ganzhi'
	// 且 !manual)服务端走 random.randint 且 payload 无 seed —— 「同 body 恒同果」在此
	// 不成立(覆盖矩阵把 wuzhao 整体标 deterministic 是误标,组件内注释自己承认
	// 「自动揲筮无 seed,重取=随机重掷」)。缓存它 = 同一时刻重复起盘返回**钉死**的旧卦,
	// 随机起课语义被破坏。只有 干支法 / 手动折竹(manualSplits 全量入 body)可缓存。
	// 在唯一缓存层拦,比在每个调用点拦更不可能漏;预取侧无需另拦 —— 未入缓存的预取
	// 只是一次被丢弃的请求,下一次真点照常重掷。
	if(moduleKey === 'wuzhao'){
		try{
			const body = JSON.parse(bodyStr);
			if(!body || (body.mode !== 'ganzhi' && !body.manual)){
				return false;
			}
		}catch(e){ return false; }
	}
	return true;
}

// 响应文本合法才可入缓存:非空 + 可解析 + ResultCode(若有)为 0 + 无 err 字段
// (xuanshi/jieqi 系 jsonpickle 原始 dict 用 {err:...} 表错,无 ResultCode 包裹)。
function textCacheable(text){
	if(typeof text !== 'string' || !text){ return false; }
	try{
		const obj = JSON.parse(text);
		if(!obj || typeof obj !== 'object'){ return false; }
		if(obj.ResultCode !== undefined && obj.ResultCode !== 0){ return false; }
		if(obj.err){ return false; }
		return true;
	}catch(e){ return false; }
}

function lruPut(map, key, text, max){
	if(map.has(key)){ map.delete(key); }
	map.set(key, { at: Date.now(), text });
	while(map.size > max){
		const oldest = map.keys().next().value;
		map.delete(oldest);
	}
}

function lruGet(map, key, ttl){
	const row = map.get(key);
	if(!row){ return undefined; }
	if((Date.now() - row.at) > ttl){
		map.delete(key);
		return undefined;
	}
	// 访问提升(L2 语义;L1 短窗提升无害)
	map.delete(key);
	map.set(key, row);
	return row.text;
}

async function l3Get(key){
	try{
		const raw = await idbGet(key);
		if(typeof raw !== 'string' || !raw){ return undefined; }
		const row = JSON.parse(raw);
		if(row && row.rev === l3Rev() && typeof row.at === 'number'
			&& (Date.now() - row.at) <= L3_TTL_MS
			&& typeof row.text === 'string' && row.text){
			return row.text;
		}
	}catch(e){ /* IDB 坏/无=miss,零正确性影响 */ }
	return undefined;
}

function l3Put(key, text){
	try{
		const at = Date.now();
		idbScheduleWrite(key, ()=>{
			try{ return JSON.stringify({ rev: l3Rev(), at, text }); }
			catch(e){ return null; }
		});
	}catch(e){ /* 写失败=下次重算 */ }
}

function syntheticResponse(text, source){
	return {
		ok: true,
		status: 200,
		__horosaKtSource: source,   // 'l1'|'l2'|'l3'|'net'|'inflight'(观测/测试用)
		text: async ()=>text,
		json: async ()=>JSON.parse(text),
	};
}

function storeAll(key, text){
	lruPut(l1, key, text, L1_MAX);
	lruPut(l2, key, text, L2_MAX);
	l3Put(key, text);
}

async function fetchTextAndMaybeCache(url, fetchOpts, cfg, key, moduleKey, bodyStr){
	const resp = await fetchChartWithRetry(url, fetchOpts, cfg);
	if(!resp || resp.ok === false){
		return { passthrough: resp };
	}
	const text = await resp.text();
	if(textCacheable(text) && payloadCacheable(moduleKey, bodyStr)){
		storeAll(key, text);
	}
	return { text };
}

/**
 * 与 fetchChartWithRetry 同参的缓存壳。仅拦截「POST + 字符串 body + 已知模块」;
 * 其余形态(GET/无 body/未知路径)与开关关闭时,直通旧路径逐字节不变。
 */
export async function cachedKentangFetch(url, fetchOpts, cfg){
	const bodyStr = fetchOpts && typeof fetchOpts.body === 'string' ? fetchOpts.body : null;
	const moduleKey = moduleOf(url);
	if(!kentangCacheEnabled() || !bodyStr || !modulePolicy(moduleKey)){
		return fetchChartWithRetry(url, fetchOpts, cfg);
	}
	const key = buildKentangCacheKey(url, bodyStr);
	const pm = perfBegin(`kt:${moduleKey}`, 'fetch');

	const hit1 = lruGet(l1, key, L1_TTL_MS);
	if(hit1 !== undefined){ pm.computed(); return syntheticResponse(hit1, 'l1'); }
	const hit2 = lruGet(l2, key, L2_TTL_MS);
	if(hit2 !== undefined){
		lruPut(l1, key, hit2, L1_MAX);
		pm.computed();
		return syntheticResponse(hit2, 'l2');
	}
	// 在途去重:表内存的是「task 承诺」({text}|{passthrough});并发跟随者对
	// passthrough(HTTP !ok,body 未消费不可共享)各自直发一次旧路径,语义与无壳时一致。
	if(inflight.has(key)){
		try{
			const r = await inflight.get(key);
			if(r && r.text !== undefined){
				pm.computed();
				return syntheticResponse(r.text, 'inflight');
			}
		}catch(e){ /* 先行者失败,跟随者自行直发 */ }
		return fetchChartWithRetry(url, fetchOpts, cfg);
	}

	const task = (async ()=>{
		const hit3 = await l3Get(key);
		if(hit3 !== undefined){
			lruPut(l1, key, hit3, L1_MAX);
			lruPut(l2, key, hit3, L2_MAX);
			return { text: hit3, source: 'l3' };
		}
		const out = await fetchTextAndMaybeCache(url, fetchOpts, cfg, key, moduleKey, bodyStr);
		return { ...out, source: 'net' };
	})();
	inflight.set(key, task);
	task.then(
		()=>{ inflight.delete(key); },
		()=>{ inflight.delete(key); }
	);
	const r = await task;   // 异常原样上抛(与旧路径同:fetch 不可达时 fetchChartWithRetry 抛)
	pm.computed();
	if(r.passthrough !== undefined){ return r.passthrough; }
	return syntheticResponse(r.text, r.source);
}

/**
 * [A4 预取入口] 静默预取一条 /pan:仅 deterministic 模块放行(含种子/浏览型在此
 * 代码层直接拒绝 —— 矩阵哨兵之外的纵深防御);失败静默,结果只进缓存不返回。
 */
export async function prefetchKentang(url, payloadObj){
	try{
		if(!kentangCacheEnabled()){ return false; }
		const moduleKey = moduleOf(url);
		if(modulePolicy(moduleKey) !== 'deterministic'){ return false; }
		const bodyStr = JSON.stringify(payloadObj);
		const key = buildKentangCacheKey(url, bodyStr);
		if(lruGet(l1, key, L1_TTL_MS) !== undefined || lruGet(l2, key, L2_TTL_MS) !== undefined){
			return true; // 已热
		}
		const resp = await cachedKentangFetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: bodyStr,
		}, { retries: 0 });
		return !!(resp && resp.ok);
	}catch(e){
		return false; // 预取失败绝不上抛
	}
}

// 测试钩子
export function __ktCacheStateForTest(){
	return { l1, l2, inflight };
}
export function __ktCacheResetForTest(){
	l1.clear(); l2.clear(); inflight.clear(); l3RevCache = null;
}
