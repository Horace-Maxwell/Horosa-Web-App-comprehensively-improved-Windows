// 玄史(中国玄学史)模块取数 —— 走 kentang :8899 直连(buildKentangEndpoint),失败回退 ServerRoot。
// 后端 webxuanshisrv 返回 jsonpickle 原始 dict(无 ResultCode 包裹,错误回 {err:...})。
import { ServerRoot } from '../utils/constants';
import { buildKentangEndpoint } from '../integrations/kentang/serviceRoot';
import { cachedKentangFetch } from '../utils/kentangCache';

// horosa_kentang_result_cache_v1 —— 玄史幂等只读端点缓存。
// 原为**无上限、永不淘汰**的普通对象:玄典/名家/事件详情逐条 slug 各存一份完整正文,
// 长会话里只涨不落。改为与 services/_kentangResultCache / _requestCache 同形的有界 LRU(96 条),
// 命中/未命中语义一字不变(仍是「同 action+payload 复用同一 Promise 结果」)。
const XUANSHI_CACHE_MAX = 96;
const _requestCache = new Map();

function _cacheGet(key){
	if(!_requestCache.has(key)){ return undefined; }
	// LRU:命中即挪到队尾(最近使用),淘汰恒从队首。
	const val = _requestCache.get(key);
	_requestCache.delete(key);
	_requestCache.set(key, val);
	return val;
}

function _cacheSet(key, val){
	if(!key || val === undefined || val === null){ return; }
	if(_requestCache.has(key)){ _requestCache.delete(key); }
	_requestCache.set(key, val);
	if(_requestCache.size > XUANSHI_CACHE_MAX){
		const first = _requestCache.keys().next().value;
		if(first !== undefined){ _requestCache.delete(first); }
	}
}

async function _post(action, payload) {
	const body = JSON.stringify(payload || {});
	const headers = { 'Content-Type': 'application/json; charset=UTF-8' };
	let rsp = null;
	try {
		const r = await cachedKentangFetch(buildKentangEndpoint('xuanshi', action), { method: 'POST', headers, body }, { retries: 0 });
		const t = await r.text();
		rsp = t ? JSON.parse(t) : null;
		if (!rsp || rsp.err || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)) {
			throw new Error(rsp && rsp.err ? `${rsp.err}` : 'xuanshi.local.fetch.failed');
		}
	} catch (e) {
		const r = await cachedKentangFetch(`${ServerRoot}/xuanshi/${action}`, { method: 'POST', headers, body }, { retries: 0 });
		const t = await r.text();
		rsp = t ? JSON.parse(t) : null;
	}
	if (!rsp || rsp.err || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)) {
		throw new Error(rsp && rsp.err ? `${rsp.err}` : 'xuanshi.fetch.failed');
	}
	return rsp;
}

// 通用 POST(不缓存)
export function postXuanShi(action, payload) {
	return _post(action, payload);
}

// 幂等只读端点缓存(同 action+payload 复用)
export async function postXuanShiCached(action, payload) {
	const key = `${action}:${JSON.stringify(payload || {})}`;
	const hit = _cacheGet(key);
	if (hit) { return hit; }
	const res = await _post(action, payload);
	_cacheSet(key, res);
	return res;
}

export function clearXuanShiCache() {
	_requestCache.clear();
}

// —— 便捷端点（与 webxuanshisrv 端点一一对应）——
export const fetchSummary = () => postXuanShiCached('summary', {});
export const fetchEvents = (p) => postXuanShi('events', p);
export const fetchEvent = (event_id) => postXuanShiCached('event', { event_id });
// horosa_xuanshi_longtext_ondemand_v1:celestial / microchronology / figures / stories 四个
// 幂等只读大响应改走 memo 变体(同 action+payload 复用)——库是只读 bundle,无随机/无 now/无副作用,
// 同参恒同结果;筛选来回切、面包屑往返因此不再重复付整包传输与 JSON.parse。
// (daily / map / search / timeline 等含日期或检索语义的端点保持不缓存,不在本轮内。)
export const fetchCelestial = (p) => postXuanShiCached('celestial', p);
export const fetchCelestialEvent = (event_id) => postXuanShiCached('celestial_event', { event_id });
export const fetchDecadeOmens = (p) => postXuanShiCached('decade_omens', p || {});
export const fetchMicrochronology = (p) => postXuanShiCached('microchronology', p);
// 微年表长文本按需取回(列表被 limit 截断后的兜底路径)
export const fetchMicrochronologyDetail = (event_id) => postXuanShiCached('microchronology_detail', { event_id });
export const fetchFigures = (p) => postXuanShiCached('figures', p);
export const fetchFigure = (slug) => postXuanShiCached('figure', { slug });
export const fetchTechniques = (p) => postXuanShiCached('techniques', p || {});
export const fetchTechnique = (slug) => postXuanShiCached('technique', { slug });
export const fetchCelestialTerms = () => postXuanShiCached('celestial-terms', {});
export const fetchCelestialTerm = (slug) => postXuanShiCached('celestial-term', { slug });
export const fetchDynasties = () => postXuanShiCached('dynasties', {});
export const fetchDynasty = (slug) => postXuanShiCached('dynasty', { slug });
export const fetchStories = (p) => postXuanShiCached('stories', p || {});
export const fetchStory = (slug) => postXuanShiCached('story', { slug });
export const fetchChannels = () => postXuanShiCached('channels', {});
export const fetchMap = (period) => postXuanShi('map', { period });
export const fetchPersonsGraph = (p) => postXuanShi('persons-graph', p || {});
export const fetchTimeline = (p) => postXuanShi('timeline', p || {});
export const fetchSearch = (p) => postXuanShi('search', p);
export const fetchFacets = (p) => postXuanShi('facets', p || {});
export const fetchEventsMeta = (tradition) => postXuanShiCached('events_meta', { tradition: tradition || '' });
export const fetchDaily = (date) => postXuanShi('daily', { date });
