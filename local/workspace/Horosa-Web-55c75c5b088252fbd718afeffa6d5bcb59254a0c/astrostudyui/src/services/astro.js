import request from '../utils/request';
import { ServerRoot } from '../utils/constants';
import { chartCloneLiteEnabled } from '../utils/perfFlags';

// R4-B6:96 → 192。步进预取每 settle 最多灌数条 /chart,加上技法族的自有预取,
// 96 条在「连点步进 + 来回拨」下会把用户刚看过的盘挤出去(命中率反降)。容量是纯内存
// (单盘 JSON 量级 ~数十 KB,192 条上限仍在个位 MB),翻倍换稳定命中。
const CHART_CACHE_MAX = 192;
const chartMem = new Map();
const chartInflight = new Map();

function clonePlain(obj){
	if(obj === undefined || obj === null){
		return obj;
	}
	// WP-H 拷贝减层:structuredClone 比 JSON 往返快数倍。/chart 响应是网络来的纯 JSON
	// (无 undefined 属性/函数/循环引用),两种克隆结果【严格等价】——只快不同。
	// ⚠️ 绝不能改成「冻结共享引用」:fetchByFields 会就地写 Result.chartId/params.name,
	//    冻结即炸;各消费方拿的必须是可写的私有副本(此为既有契约,不动)。
	if(chartCloneLiteEnabled() && typeof structuredClone === 'function'){
		try{
			return structuredClone(obj);
		}catch(e){
			// 落回 JSON(结果等价,只是慢)
		}
	}
	try{
		return JSON.parse(JSON.stringify(obj));
	}catch(e){
		return obj;
	}
}

function pushCache(map, key, val){
	if(!key || val === undefined || val === null){
		return;
	}
	if(map.has(key)){
		map.delete(key);
	}
	map.set(key, val);
	if(map.size > CHART_CACHE_MAX){
		const first = map.keys().next().value;
		if(first){
			map.delete(first);
		}
	}
}

function buildChartKey(values){
	try{
		return JSON.stringify(values || {});
	}catch(e){
		return '';
	}
}

// R4-B6(纯观测):chartMem 命中时打 cache-hit mark —— DevTools Performance 面板可直接
// 分辨「命中即时」与「真算」两类路径。失败静默,零行为影响。
function markChartCacheHit(){
	try{
		if(typeof performance !== 'undefined' && performance.mark){
			performance.mark('horosa:chart:cache-hit');
		}
	}catch(e){ /* observation only */ }
}

export function fetchChart(values, requestOptions){
	const opts = requestOptions || {};
	const disableCache = opts.cache === false;
	const key = disableCache ? '' : buildChartKey(values);
	if(key && chartMem.has(key)){
		markChartCacheHit();
		return Promise.resolve(clonePlain(chartMem.get(key)));
	}
	// [R4-B5b] 带 AbortController signal 的请求不入在途共享:A 被 abort 会连坐搭车的 B。
	// 缓存读(上)与成功响应写缓存(下,pushCache 用 key)照常——被 abort 的 promise reject,
	// 走不到 then,不会污染 chartMem。
	const shareKey = opts.signal ? '' : key;
	if(shareKey && chartInflight.has(shareKey)){
		return chartInflight.get(shareKey).then((rsp)=>clonePlain(rsp));
	}
	const req = request(`${ServerRoot}/chart`, {
		// 排盘是幂等纯计算(后端无写库 ChartController),对「本地服务未就绪/重启窗口」做透明退避重试:
		// 仅在连接被拒(后端不可达,见 fetchWithRetryConnRefused)时退避重试,HTTP 4xx/5xx 不重试、原样返回。
		// 否则慢启动或服务重启瞬间第一次连接失败就硬弹「排盘失败:本地服务未就绪」(Win issue #14 同因,前端 Mac/Win 共享)。
		// caller 的 opts.retry 可覆盖(如某些场景想关重试)。
		// Mac #12 (2026-06-07): 从 6 retries / ~12s 扩到 10 retries / ~30s — 覆盖慢机器首次启动 35-56s 解压窗口。
		// 累计退避: 0.4+0.8+1.2+2+3+4+4+5+5+5 = 30.4s。仍是 fail-fast 网络层判定,正常连通时第一次就过零成本。
		retry: { retries: 10, backoff: [400, 800, 1200, 2000, 3000, 4000, 4000, 5000, 5000, 5000] },
		body: JSON.stringify(values),
		...opts,
	}).then((rsp)=>{
		// R4-B6(marker: chartMem_valid_only_v1):只缓存「有效盘」响应(Result.params 在)——
		// 错误信封(ResultCode!=0/服务瞬断)不进 chartMem,否则短窗内同参重试会命中缓存的
		// 过期错误(对既有路径也是净改善;确认路径 isValidChartResponse 判定不变)。
		if(key && rsp && rsp.Result && rsp.Result.params){
			pushCache(chartMem, key, clonePlain(rsp));
		}
		return rsp;
	}).finally(()=>{
		if(shareKey){
			chartInflight.delete(shareKey);
		}
	});
	if(shareKey){
		chartInflight.set(shareKey, req);
	}
	if(chartCloneLiteEnabled()){
		// WP-H 拷贝减层:miss 的【发起方】直接拿网络原件(整盘省一次全量深拷贝)——原件本就
		// 归他所有(缓存里存的是上面 pushCache 的独立克隆,绝不与之共享);同 key 的在途
		// 搭车方(chartInflight 分支)仍各拿克隆,互不串写。开关关=每方各克隆的旧行为。
		return req;
	}
	return req.then((rsp)=>clonePlain(rsp));
}

export function fetchAllowedCharts(values){
    return request(`${ServerRoot}/allowedcharts`, {
        body: JSON.stringify(values),
    });
}

// [R4] fetchFateEvents/dlTrain 已删:唯一调用方是 models/astro 里 `localOnly=true` 写死的
// 永不可达分支(登录多用户时代残留),分支收敛后此处零引用。人生事件走本地存储。

