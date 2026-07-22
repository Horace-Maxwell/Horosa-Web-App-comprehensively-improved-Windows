import request from '../utils/request';
import { ServerRoot, ResultKey } from '../utils/constants';
import { buildKentangEndpoint } from '../integrations/kentang/serviceRoot';
import { fetchChartWithRetry } from '../utils/chartFetch';
import { cachedPost } from './_requestCache';

// 七政四余是确定性纯计算(同 params 必产同结果);对其加「同参复用 + 在途合并」让重开/来回切瞬时,
// 命中返回的是同一结果的深拷贝(与直连逐值等价、只更快)。不同 params → 不同 key → 重新请求。

// horosa_moira_stable_key_v1(PERF-R10 Ship5):body 里的 chartObj/transitChartObj 携带
// 每次出盘随机的 chartId(models/astro.js `Result.chartId = randomStr(8)`)⇒ 以整个 body 为键
// **同参永不命中**(缓存退化为纯开销,还要先付一次 ~420KB 的 JSON.stringify)。
// 响应由 (params, transitParams) 完备决定 —— chartObj 本身就是 params 的纯函数(黄金已证),
// 故键取双 params 签名;moira 仍在 PREFETCH_FORBIDDEN(默认过运=「此刻」),本修只救同参重放。
function stableMoiraKey(values){
	try{
		const v = values || {};
		return JSON.stringify({ params: v.params || null, transitParams: v.transitParams || null });
	}catch(e){
		return '';   // 构键失败 ⇒ 空键 = 不缓存(fail-open 到直连,绝不误共享)
	}
}

export function fetchMoiraQizhengRules(values, requestOptions){
	return cachedPost(`${ServerRoot}/qizheng/moira`, values || {}, requestOptions, {
		ns: 'qizheng/moira',
		key: stableMoiraKey(values),
	});
}

// ken 后端 /qizhengkin/pan 不走 AstroHelper 缓存层 → 这里在前端做同参去重 + LRU(48 条)。
const KIN_CACHE_MAX = 48;
const kinMem = new Map();
const kinInflight = new Map();

function kinKey(values){
	try{
		return JSON.stringify(values || {});
	}catch(e){
		return '';
	}
}

function kinClone(obj){
	if(obj === undefined || obj === null){
		return obj;
	}
	try{
		return JSON.parse(JSON.stringify(obj));
	}catch(e){
		return obj;
	}
}

async function fetchKinastroQizhengRaw(values){
	let rsp = null;
	try{
		const response = await fetchChartWithRetry(buildKentangEndpoint('qizhengkin', 'pan'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(values || {}),
		});
		const text = await response.text();
		rsp = text ? JSON.parse(text) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'qizhengkin.local.fetch.failed');
		}
	}catch(e){
		const response = await fetchChartWithRetry(`${ServerRoot}/qizhengkin/pan`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(values || {}),
		});
		const text = await response.text();
		rsp = text ? JSON.parse(text) : null;
	}
	if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
		throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'qizhengkin.fetch.failed');
	}
	return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
}

export async function fetchKinastroQizheng(values){
	const key = kinKey(values);
	if(key && kinMem.has(key)){
		return kinClone(kinMem.get(key));
	}
	if(key && kinInflight.has(key)){
		return kinClone(await kinInflight.get(key));
	}
	const p = fetchKinastroQizhengRaw(values);
	if(key){
		kinInflight.set(key, p);
	}
	try{
		const res = await p;
		if(key && res){
			if(kinMem.has(key)){
				kinMem.delete(key);
			}
			kinMem.set(key, kinClone(res));
			if(kinMem.size > KIN_CACHE_MAX){
				const first = kinMem.keys().next().value;
				if(first !== undefined){
					kinMem.delete(first);
				}
			}
		}
		return kinClone(res);
	}finally{
		if(key){
			kinInflight.delete(key);
		}
	}
}

// ── 天星择日双轮数据(/qizhengelection/pan):kentang 直连惯例 + LRU/在途去重 ──
const eleMem = new Map();
const eleInflight = new Map();
const ELE_CACHE_MAX = 32;

function eleKey(values){
	try{
		return JSON.stringify(values || {});
	}catch(e){
		return '';
	}
}

async function fetchQizhengElectionRaw(values, path = 'pan'){
	let rsp = null;
	try{
		const response = await fetchChartWithRetry(buildKentangEndpoint('qizhengelection', path), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(values || {}),
		});
		const text = await response.text();
		rsp = text ? JSON.parse(text) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'qizhengelection.local.fetch.failed');
		}
	}catch(e){
		const response = await fetchChartWithRetry(`${ServerRoot}/qizhengelection/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(values || {}),
		});
		const text = await response.text();
		rsp = text ? JSON.parse(text) : null;
	}
	if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
		throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'qizhengelection.fetch.failed');
	}
	return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
}

export async function fetchQizhengElection(values){
	const key = `pan|${eleKey(values)}`;
	if(key && eleMem.has(key)){
		return kinClone(eleMem.get(key));
	}
	if(key && eleInflight.has(key)){
		return kinClone(await eleInflight.get(key));
	}
	const p = fetchQizhengElectionRaw(values, 'pan');
	eleInflight.set(key, p);
	try{
		const res = await p;
		if(res){
			if(eleMem.has(key)){
				eleMem.delete(key);
			}
			eleMem.set(key, kinClone(res));
			if(eleMem.size > ELE_CACHE_MAX){
				const first = eleMem.keys().next().value;
				if(first !== undefined){
					eleMem.delete(first);
				}
			}
		}
		return kinClone(res);
	}finally{
		eleInflight.delete(key);
	}
}

// 搜索三件套(方位/日月食):无缓存直查
export function fetchQizhengEclipses(values){
	return fetchQizhengElectionRaw(values, 'eclipses');
}

export function fetchQizhengAzimuthSearch(values){
	return fetchQizhengElectionRaw(values, 'azimuthsearch');
}
