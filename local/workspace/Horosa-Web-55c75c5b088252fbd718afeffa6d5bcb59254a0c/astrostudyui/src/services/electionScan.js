import { ResultKey } from '../utils/constants';
import { buildKentangEndpoint } from '../integrations/kentang/serviceRoot';
import { cachedKentangFetch } from '../utils/kentangCache';

// 天星择日·征象搜索(POST /electionscan/scan,直连 :8899)。
// 与 qizhengelection 同为「挂在主 chart 服务上的非 kentang 引擎」,但**不做 Java 回退**:
// Java 侧无此路由,回退必 404 只会把真错误(本地服务未起)伪装成参数错——失败就明说。
// 缓存:cachedKentangFetch 三层(同参确定性;ResultCode≠0 不入缓存);取消:透传 AbortSignal。

export async function fetchElectionScan(values, options){
	const opts = options || {};
	const response = await cachedKentangFetch(buildKentangEndpoint('electionscan', 'scan'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=UTF-8' },
		body: JSON.stringify(values || {}),
		signal: opts.signal,
	});
	const text = await response.text();
	const rsp = text ? JSON.parse(text) : null;
	if(!rsp || rsp.ResultCode !== 0){
		const payload = rsp && rsp[ResultKey];
		const detail = payload && payload.detail ? `${payload.err || ''}: ${payload.detail}` : (payload && payload.err) || '';
		const err = new Error(detail || 'electionscan.fetch.failed(本地计算服务未运行?)');
		err.scanError = payload || null;
		throw err;
	}
	return rsp[ResultKey];
}

export async function fetchElectionConditionTypes(){
	const response = await cachedKentangFetch(buildKentangEndpoint('electionscan', 'conditiontypes'), {
		method: 'GET',
	});
	const text = await response.text();
	const rsp = text ? JSON.parse(text) : null;
	if(!rsp || rsp.ResultCode !== 0){
		throw new Error('electionscan.conditiontypes.failed');
	}
	return rsp[ResultKey];
}

// R4 单时刻逐叶判读(详情面板):pass 复用扫描求值器(引擎侧同源),actual=实测文本。
export async function fetchElectionExplain(values, options){
	const opts = options || {};
	const response = await cachedKentangFetch(buildKentangEndpoint('electionscan', 'explain'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=UTF-8' },
		body: JSON.stringify(values || {}),
		signal: opts.signal,
	});
	const text = await response.text();
	const rsp = text ? JSON.parse(text) : null;
	if(!rsp || rsp.ResultCode !== 0){
		const payload = rsp && rsp[ResultKey];
		const err = new Error((payload && payload.detail) || 'electionscan.explain.failed');
		err.scanError = payload || null;
		throw err;
	}
	return rsp[ResultKey];
}
