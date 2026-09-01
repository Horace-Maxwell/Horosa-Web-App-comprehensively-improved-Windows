import { ResultKey } from '../utils/constants';
import { buildKentangEndpoint } from '../integrations/kentang/serviceRoot';
import { cachedKentangFetch } from '../utils/kentangCache';

// 天星择日·征象搜索(POST /electionscan/scan,直连 :8899)。
// 与 qizhengelection 同为「挂在主 chart 服务上的非 kentang 引擎」,但**不做 Java 回退**:
// Java 侧无此路由,回退必 404 只会把真错误(本地服务未起)伪装成参数错——失败就明说。
// 缓存:cachedKentangFetch 三层(同参确定性;ResultCode≠0 不入缓存);取消:透传 AbortSignal。


// [C3 压检实抓 2026-08-30] 远端扫描的结构化错误码 → 用户话。此前 span_too_large 的英文
// 工程串("span 123.0d exceeds 93.0d; split the request")直接顶在结果区,违反全站中文标准。
// 只译**结构化已知码**;未知码保留原文(排障要看得到真错误,宁生勿瞒)。
function humanizeScanError(payload, fallback){
	const code = payload && payload.err;
	if(code === 'span_too_large'){
		const m2 = /([\d.]+)d exceeds ([\d.]+)d/.exec((payload && payload.detail) || '');
		const got = m2 ? Math.round(parseFloat(m2[1])) : null;
		const cap = m2 ? Math.round(parseFloat(m2[2])) : 93;
		return `时间范围${got ? ` ${got} 天` : ''}超过单次扫描上限 ${cap} 天——请缩短范围,或分段搜索`;
	}
	const detail = payload && payload.detail ? `${payload.err || ''}: ${payload.detail}` : (payload && payload.err) || '';
	return detail || fallback;
}

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
		const err = new Error(humanizeScanError(payload, 'electionscan.fetch.failed(本地计算服务未运行?)'));
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


// [Z7] 七政择日·征象扫描(端点 /qizhengelectionscan;算法 astropy qizheng_election_scan,
// 判定表与前端 guolaoData 同源[guolao_const 成对],与天星 electionscan 同形薄壳)。
export async function fetchQizhengElectionScan(values, options){
	const opts = options || {};
	const response = await cachedKentangFetch(buildKentangEndpoint('qizhengelectionscan', 'scan'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=UTF-8' },
		body: JSON.stringify(values || {}),
		signal: opts.signal,
	});
	const text = await response.text();
	const rsp = text ? JSON.parse(text) : null;
	if(!rsp || rsp.ResultCode !== 0){
		const payload = rsp && rsp[ResultKey];
		const err = new Error(humanizeScanError(payload, 'qizhengelectionscan.fetch.failed(本地计算服务未运行?)'));
		err.scanError = payload || null;
		throw err;
	}
	return rsp[ResultKey];
}

export async function fetchQizhengElectionExplain(values, options){
	const opts = options || {};
	const response = await cachedKentangFetch(buildKentangEndpoint('qizhengelectionscan', 'explain'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=UTF-8' },
		body: JSON.stringify(values || {}),
		signal: opts.signal,
	});
	const text = await response.text();
	const rsp = text ? JSON.parse(text) : null;
	if(!rsp || rsp.ResultCode !== 0){
		throw new Error('qizhengelectionscan.explain.failed');
	}
	return rsp[ResultKey];
}


// [Z8] 印度择日·征象扫描(端点 /indiaelectionscan;算法 astropy india_election_scan)。
export async function fetchIndiaElectionScan(values, options){
	const opts = options || {};
	const response = await cachedKentangFetch(buildKentangEndpoint('indiaelectionscan', 'scan'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=UTF-8' },
		body: JSON.stringify(values || {}),
		signal: opts.signal,
	});
	const text = await response.text();
	const rsp = text ? JSON.parse(text) : null;
	if(!rsp || rsp.ResultCode !== 0){
		const payload = rsp && rsp[ResultKey];
		const err = new Error(humanizeScanError(payload, 'indiaelectionscan.fetch.failed(本地计算服务未运行?)'));
		err.scanError = payload || null;
		throw err;
	}
	return rsp[ResultKey];
}

export async function fetchIndiaElectionExplain(values, options){
	const opts = options || {};
	const response = await cachedKentangFetch(buildKentangEndpoint('indiaelectionscan', 'explain'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=UTF-8' },
		body: JSON.stringify(values || {}),
		signal: opts.signal,
	});
	const text = await response.text();
	const rsp = text ? JSON.parse(text) : null;
	if(!rsp || rsp.ResultCode !== 0){
		throw new Error('indiaelectionscan.explain.failed');
	}
	return rsp[ResultKey];
}
