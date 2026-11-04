// 决策层 · 调用层:档案 → 组请求 → 经本地 Java 转发(前端不能直连外网:CSP 只放行回环)→ 归一回体。
// 铁律:①永不向调用方抛错,只回 { ok:false, reason };②两档时限(交互 1500 ms / 后台 10000 ms);③同参在途去重 + 小 LRU;
//       ④每次回体都向校准记录报模型号(漂移即作废这次回答);⑤只记用量与日志,不记 state 原文;⑥key 只在档案里,本模块不打印它。
import { requestSystemOne } from '../../services/aianalysis';
import { getSystemOneProfile } from '../../integrations/systemOne';
import { buildRequest, normalizeResponse, SYSTEMONE_LIMITS } from './wire';
import { noteResponseModel } from './calibrationStore';
import { addUsage } from './log';
import { noul } from './questions';

export const TIMEOUT_INTERACTIVE_MS = 1500;
export const TIMEOUT_BACKGROUND_MS = 10000;
export const CLIENT_CACHE_MAX = 32;
export const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
export const REASONS = Object.freeze(['no-profile', 'invalid', 'aborted', 'timeout', 'network', 'http', 'drift', 'empty']);

const cache = new Map();      // key → { at, res }
const inflight = new Map();   // key → Promise

function timeoutFor(mode){ return mode === 'interactive' ? TIMEOUT_INTERACTIVE_MS : TIMEOUT_BACKGROUND_MS; }

function cacheGet(key){
	const hit = cache.get(key);
	if(!hit){ return null; }
	if(Date.now() - hit.at > CLIENT_CACHE_TTL_MS){ cache.delete(key); return null; }
	cache.delete(key); cache.set(key, hit);   // LRU 触碰
	return hit.res;
}

function cachePut(key, res){
	cache.set(key, { at: Date.now(), res });
	while(cache.size > CLIENT_CACHE_MAX){ cache.delete(cache.keys().next().value); }
}

function classifyError(e, signal){
	if(signal && signal.aborted){ return 'aborted'; }
	const msg = `${(e && e.message) || e || ''}`.toLowerCase();
	if(msg.indexOf('abort') >= 0 || msg.indexOf('timeout') >= 0 || msg.indexOf('timed out') >= 0){ return 'timeout'; }
	if(/^\d{3}\b/.test(msg) || msg.indexOf('systemone') >= 0){ return 'http'; }
	return 'network';
}

function unwrap(rsp){
	return rsp && typeof rsp === 'object' && rsp.Result !== undefined ? rsp.Result : rsp;
}

// 单项:{ state, questions, mode:'interactive'|'background', signal, model } → { ok, model, answers, usage, latencyMs, cached } | { ok:false, reason, latencyMs }
export async function callSystemOne({ state, questions, mode, signal, model } = {}){
	const t0 = Date.now();
	let profile = null;
	try{ profile = await getSystemOneProfile(); }catch(e){ profile = null; }
	if(!profile || !`${profile.apiKey || ''}`.trim()){ return { ok: false, reason: 'no-profile', latencyMs: Date.now() - t0 }; }
	const built = buildRequest({ state, questions, model: model || profile.model });
	if(!built.ok){ return { ok: false, reason: 'invalid', detail: built.reason, latencyMs: Date.now() - t0 }; }
	let key = '';
	try{ key = JSON.stringify(built.request); }catch(e){ key = ''; }
	if(key){
		const hit = cacheGet(key);
		if(hit){ return { ...hit, cached: true, latencyMs: Date.now() - t0 }; }
		if(inflight.has(key)){
			try{ const r = await inflight.get(key); return { ...r, latencyMs: Date.now() - t0 }; }catch(e){ /* 落到下面重发 */ }
		}
	}
	const timeoutMs = timeoutFor(mode);
	const run = (async ()=>{
		try{
			const rsp = await requestSystemOne({
				apiKey: profile.apiKey, baseUrl: `${profile.baseUrl || ''}`, model: built.request.model,
				timeoutMs, maxRetries: mode === 'interactive' ? 0 : 1,
				request: { state: built.request.state, questions: built.request.questions },
			}, { signal, timeoutMs: timeoutMs + 500 });
			const out = unwrap(rsp);
			if(out && out.ok === false){
				addUsage({ items: 1, error: true });
				return { ok: false, reason: 'http', status: out.status, code: out.code };
			}
			const norm = normalizeResponse(out);
			if(!norm.ok){ addUsage({ items: 1, error: true }); return { ok: false, reason: 'invalid' }; }
			addUsage({ items: 1, inputTokens: norm.usage.inputTokens, outputTokens: norm.usage.outputTokens, model: norm.model });
			const drift = noteResponseModel(norm.model);
			if(drift.drift){ return { ok: false, reason: 'drift', model: norm.model, calibrated: drift.calibrated }; }
			const res = { ok: true, model: norm.model, answers: norm.answers, usage: norm.usage };
			if(key){ cachePut(key, res); }
			return res;
		}catch(e){
			addUsage({ items: 1, error: true });
			return { ok: false, reason: classifyError(e, signal) };
		}finally{
			if(key){ inflight.delete(key); }
		}
	})();
	if(key){ inflight.set(key, run); }
	const r = await run;
	return { ...r, latencyMs: Date.now() - t0 };
}

// 批量:items = [{ state, questions }],经 Java 批量端点(≤16 项 / 批,单项失败不拖垮整批);回 { ok, results:[单项结构…], model, latencyMs }
export async function callSystemOneBatch(items, { mode, signal, model } = {}){
	const t0 = Date.now();
	const list = Array.isArray(items) ? items : [];
	if(!list.length){ return { ok: true, results: [], latencyMs: 0 }; }
	let profile = null;
	try{ profile = await getSystemOneProfile(); }catch(e){ profile = null; }
	if(!profile || !`${profile.apiKey || ''}`.trim()){ return { ok: false, reason: 'no-profile', results: list.map(()=>({ ok: false, reason: 'no-profile' })), latencyMs: Date.now() - t0 }; }
	const results = new Array(list.length);
	const built = list.map((it, i)=>{ const b = buildRequest({ state: it && it.state, questions: it && it.questions, model: model || profile.model }); if(!b.ok){ results[i] = { ok: false, reason: 'invalid', detail: b.reason }; } return b; });
	const pending = built.map((b, i)=>(b.ok ? i : -1)).filter((i)=>i >= 0);
	const timeoutMs = timeoutFor(mode || 'background');
	let seenModel = '';
	for(let off = 0; off < pending.length; off += SYSTEMONE_LIMITS.batchMax){
		if(signal && signal.aborted){ pending.slice(off).forEach((i)=>{ results[i] = { ok: false, reason: 'aborted' }; }); break; }
		const chunk = pending.slice(off, off + SYSTEMONE_LIMITS.batchMax);
		try{
			const rsp = await requestSystemOne({
				apiKey: profile.apiKey, baseUrl: `${profile.baseUrl || ''}`, model: built[chunk[0]].request.model,
				timeoutMs, maxRetries: 1, concurrency: SYSTEMONE_LIMITS.batchConcurrency,
				batch: chunk.map((i)=>({ state: built[i].request.state, questions: built[i].request.questions })),
			}, { signal, timeoutMs: timeoutMs * 2 + 1000 });
			const out = unwrap(rsp);
			const rows = out && Array.isArray(out.results) ? out.results : null;
			if(!rows){ chunk.forEach((i)=>{ results[i] = { ok: false, reason: out && out.ok === false ? 'http' : 'invalid' }; }); addUsage({ items: chunk.length, batch: true, error: true }); continue; }
			let inTok = 0; let outTok = 0;
			chunk.forEach((i, j)=>{
				const row = rows[j];
				if(!row || row.ok === false){ results[i] = { ok: false, reason: 'http', status: row && row.status, code: row && row.code }; return; }
				const norm = normalizeResponse(row);
				if(!norm.ok){ results[i] = { ok: false, reason: 'invalid' }; return; }
				inTok += norm.usage.inputTokens; outTok += norm.usage.outputTokens;
				if(norm.model){ seenModel = norm.model; }
				results[i] = { ok: true, model: norm.model, answers: norm.answers, usage: norm.usage };
			});
			addUsage({ items: chunk.length, batch: true, inputTokens: inTok, outputTokens: outTok, model: seenModel });
		}catch(e){
			const reason = classifyError(e, signal);
			chunk.forEach((i)=>{ results[i] = { ok: false, reason }; });
			addUsage({ items: chunk.length, batch: true, error: true });
			if(reason === 'aborted'){ pending.slice(off + chunk.length).forEach((i)=>{ results[i] = { ok: false, reason: 'aborted' }; }); break; }
		}
	}
	if(seenModel){
		const drift = noteResponseModel(seenModel);
		if(drift.drift){ for(let i = 0; i < results.length; i += 1){ if(results[i] && results[i].ok){ results[i] = { ok: false, reason: 'drift', model: seenModel, calibrated: drift.calibrated }; } } }
	}
	for(let i = 0; i < results.length; i += 1){ if(!results[i]){ results[i] = { ok: false, reason: 'empty' }; } }
	return { ok: results.some((r)=>r.ok), results, model: seenModel, latencyMs: Date.now() - t0 };
}

// 「测试连接」:一个最小是否题;不进缓存、不算校准。回 { ok, model, latencyMs, reason }
export async function smokeTestSystemOne({ signal } = {}){
	const r = await callSystemOne({
		state: { text: 'ping' },
		questions: { is_short: noul('Is `text` shorter than ten characters?', { true: 'fewer than ten characters', false: 'ten characters or more' }) },
		mode: 'background', signal, model: undefined,
	});
	return r.ok ? { ok: true, model: r.model, latencyMs: r.latencyMs, usage: r.usage } : { ok: false, reason: r.reason, status: r.status, code: r.code, latencyMs: r.latencyMs };
}

export function __resetSystemOneClientForTest(){
	cache.clear();
	inflight.clear();
}
