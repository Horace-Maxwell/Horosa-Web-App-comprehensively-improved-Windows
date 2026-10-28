import { ResultKey } from '../utils/constants';
import { buildKentangEndpoint } from '../integrations/kentang/serviceRoot';
import { cachedKentangFetch } from '../utils/kentangCache';

// kentang 技法模块的 POST(单一来源):只打本机计算服务(buildKentangEndpoint 解析出的根)。
// 不再「失败就改走 ServerRoot 同名路径」:Java 后端没有任何 kentang 模块的路由,那一跳只会拿到 404 / 拦截页,
// 还把本机服务回的真实错误(参数错 / 计算错)换成「Unexpected token <」一类解析错 —— 用户看不到原因。
// 失败 → 抛错,错误信息取回包的 ResultKey(缺省「<模块>.fetch.failed」);网络错原样抛出。成功返回 ResultKey 下的结果。
// opts.cacheConfig:传给 cachedKentangFetch 的第三参(缺省 { retries: 0 };显式传 undefined = 用缓存层缺省重试)。
export async function postKentang(module, path, payload, opts){
	const o = opts || {};
	const cfg = Object.prototype.hasOwnProperty.call(o, 'cacheConfig') ? o.cacheConfig : { retries: 0 };
	const rawResponse = await cachedKentangFetch(buildKentangEndpoint(module, path), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json; charset=UTF-8',
		},
		body: JSON.stringify(payload),
	}, cfg);
	const rawText = await rawResponse.text();
	const rsp = rawText ? JSON.parse(rawText) : null;
	if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
		throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : `${module}.fetch.failed`);
	}
	return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
}
