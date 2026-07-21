import request from '../utils/request';
import { ServerRoot } from '../utils/constants';

// 3D 星盘多中心引擎(WS-2):POST /chart3d/state(Java Chart3DController 白名单转发
// Python astrostudy/chart3d.py)。响应 schema 与 chart3d.state() 精确对齐:
//   { center, jd, eps, includeMoon,
//     bodies: [{id, lon, lat, dist, speed, ra, decl}],          // 数组;中心体自身不在场
//     orbits: { id: {closed, periodDays, samples:[{lon,lat,dist}]} },
//     aspects: [{a, b, aspect, orb, applying}] }
// 失败形态:{ err: 'param error' }(HTTP 200,Python 兜底),调用方须查 rsp.err。

// /chart3d/state 是幂等纯计算(无写库):照 fetchChart 形态给内存缓存 + 在途合流,
// 来回切换中心秒回;各消费方拿独立副本(换系动画会就地读写 state,绝不共享引用)。
const STATE_CACHE_MAX = 48;
const stateMem = new Map();
const stateInflight = new Map();

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
	if(map.size > STATE_CACHE_MAX){
		const first = map.keys().next().value;
		if(first){
			map.delete(first);
		}
	}
}

function buildStateKey(values){
	try{
		return JSON.stringify(values || {});
	}catch(e){
		return '';
	}
}

export function fetchChart3DState(values, requestOptions){
	const opts = requestOptions || {};
	const disableCache = opts.cache === false;
	const key = disableCache ? '' : buildStateKey(values);
	if(key && stateMem.has(key)){
		return Promise.resolve(clonePlain(stateMem.get(key)));
	}
	if(key && stateInflight.has(key)){
		return stateInflight.get(key).then((rsp)=>clonePlain(rsp));
	}
	const req = request(`${ServerRoot}/chart3d/state`, {
		// 与 fetchChart 同族的连接被拒退避(覆盖本地服务重启窗口);切中心是即时交互,
		// 退避档比排盘短 —— 失败快回 UI(调用方 message.warning 且回落地心)。
		retry: { retries: 3, backoff: [400, 800, 1600] },
		body: JSON.stringify(values),
		...opts,
	}).then((rsp)=>{
		if(key && rsp && !rsp.err){
			pushCache(stateMem, key, clonePlain(rsp));
		}
		return rsp;
	}).finally(()=>{
		if(key){
			stateInflight.delete(key);
		}
	});
	if(key){
		stateInflight.set(key, req);
	}
	return req;
}
