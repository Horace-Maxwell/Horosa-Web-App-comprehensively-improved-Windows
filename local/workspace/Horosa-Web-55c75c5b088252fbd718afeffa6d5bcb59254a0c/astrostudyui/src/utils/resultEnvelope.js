// 后端响应「业务错误」判据(单一出处):HTTP 200、ResultCode 0,却在信封顶层(rsp.err)或 Result 里(rsp.Result.err)
// 带 err —— 这是后端算不出来的回包,不是结果。凡是要「只缓存真成功」的层(请求去重 L1 / L2 / L3、技法请求 LRU、
// 按时间逐点取数的缓存)一律经这里判,不各写一份(此前去重层只排除空载荷,Result.err 照存进 24 小时持久层,重启都不自愈)。
import { ResultKey } from './constants';

export function responseHasBusinessError(rsp){
	if(!rsp || typeof rsp !== 'object'){ return false; }
	if(rsp.err){ return true; }
	const r = rsp[ResultKey];
	return !!(r && typeof r === 'object' && !Array.isArray(r) && r.err);
}

// 可以进缓存的回包:有载荷、且不是业务错误
export function responseCacheable(rsp){
	return rsp !== undefined && rsp !== null && !responseHasBusinessError(rsp);
}
