import request from '../utils/request';
import { ServerRoot } from '../utils/constants';

// 主限法 3D 天球(WS-3):POST /predict/pd3d(Java PredictiveController /pd3d 白名单转发
// Python perpredict.getPrimaryDirection3D)。响应 schema 与后端精确对齐:
//   { rows:   [{i, arc, prom, sig, cat, date}],          // 与 /predict/pd 的 pdlist 逐位同源
//     points: { id: {lon, lat, ra, decl, raZ, declZ, kind} },  // 本命实点 + 虚点(映点/界/相位)
//     circles:{ sigId: {type, points?} },                 // 应星位置圈(语义型/采样折线)
//     frame:  { armc, phi, eps, epsMean, jd, pdMethod, pdTimeKey } }
// 请求体与 /predict/pd 完全同源(AstroDirectMain.buildPrimaryDirectionRequest 构造,
// 本服务不自造参数 —— 防两处构参漂移)。
// 失败形态:{ err: 'param error' }(HTTP 200,Python 兜底);经 Java 转发时外包
// { Result: {...} } 一层,此处统一剥壳,调用方拿到的恒为纯响应对象且须查 rsp.err。

// /predict/pd3d 是幂等纯计算(无写库):照 fetchChart3DState 形态给内存缓存 + 在途合流,
// 同参重进秒回;各消费方拿独立副本(引擎会就地读数,绝不共享引用)。
const PD3D_CACHE_MAX = 24;
const pd3dMem = new Map();
const pd3dInflight = new Map();

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

function pushCache(map, key, val){
	if(!key || val === undefined || val === null){
		return;
	}
	if(map.has(key)){
		map.delete(key);
	}
	map.set(key, val);
	if(map.size > PD3D_CACHE_MAX){
		const first = map.keys().next().value;
		if(first){
			map.delete(first);
		}
	}
}

function buildPd3dKey(values){
	try{
		return JSON.stringify(values || {});
	}catch(e){
		return '';
	}
}

/** 统一剥 Java TransData 的 { Result: {...} } 外壳(直连 Python :8899 时无壳,原样返回) */
function unwrapPd3dResponse(rsp){
	if(rsp && typeof rsp === 'object' && rsp.Result && typeof rsp.Result === 'object'){
		return rsp.Result;
	}
	return rsp;
}

export function fetchPd3D(values, requestOptions){
	const opts = requestOptions || {};
	const disableCache = opts.cache === false;
	const key = disableCache ? '' : buildPd3dKey(values);
	if(key && pd3dMem.has(key)){
		return Promise.resolve(clonePlain(pd3dMem.get(key)));
	}
	if(key && pd3dInflight.has(key)){
		return pd3dInflight.get(key).then((rsp)=>clonePlain(rsp));
	}
	const req = request(`${ServerRoot}/predict/pd3d`, {
		// 与 fetchChart3DState 同族的连接被拒退避(覆盖本地服务重启窗口);切行/切法是
		// 即时交互,退避档比排盘短 —— 失败快回 UI(调用方渲染错误态 + 手动重试)。
		retry: { retries: 3, backoff: [400, 800, 1600] },
		body: JSON.stringify(values),
		...opts,
	}).then((data)=>{
		const rsp = unwrapPd3dResponse(data);
		if(key && rsp && !rsp.err){
			pushCache(pd3dMem, key, clonePlain(rsp));
		}
		return rsp;
	}).finally(()=>{
		if(key){
			pd3dInflight.delete(key);
		}
	});
	if(key){
		pd3dInflight.set(key, req);
	}
	return req;
}
