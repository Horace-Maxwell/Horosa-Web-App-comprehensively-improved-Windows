// 决策层 · 纯内存环形日志(最近 200 次:点 / 答案摘要 / 置信度 / 是否回落 / 与启发式是否分歧 / 耗时 / 模型)+ 累计用量。
// 铁律:不存 state 原文(用户提问、资料片段、工具参数都不进日志);答案只留 ≤ 80 字的摘要串。累计次数与估算花费存一个已登记的键(本机)。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage, safeLocalStorageRemove } from '../safeStorage';
import { SYSTEMONE_STATS_KEY } from './prefs';
import { estimateCostUsd } from './wire';

export const DECISION_LOG_MAX = 200;
export const SYSTEMONE_LOG_EVENT = 'horosa:systemone-log-changed';
export const VALUE_SUMMARY_MAX = 80;

let ring = [];

function summarize(value){
	let s = '';
	try{ s = typeof value === 'string' ? value : JSON.stringify(value === undefined ? null : value); }catch(e){ s = `${value}`; }
	return s.length > VALUE_SUMMARY_MAX ? `${s.slice(0, VALUE_SUMMARY_MAX)}…` : s;
}

function emit(){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(SYSTEMONE_LOG_EVENT));
		}
	}catch(e){ /* noop */ }
}

// entry: { pointId, source:'systemone'|'fallback'|'shadow', value, heuristic, confidence, agree, latencyMs, model, reason }
export function recordDecision(entry){
	const e = entry || {};
	const row = {
		at: new Date().toISOString(),
		pointId: `${e.pointId || ''}`,
		source: `${e.source || ''}`,
		value: summarize(e.value),
		heuristic: e.heuristic === undefined ? '' : summarize(e.heuristic),
		confidence: Number.isFinite(Number(e.confidence)) ? Number(e.confidence) : null,
		agree: e.agree === undefined || e.agree === null ? null : !!e.agree,
		latencyMs: Number.isFinite(Number(e.latencyMs)) ? Math.round(Number(e.latencyMs)) : null,
		model: `${e.model || ''}`,
		reason: `${e.reason || ''}`,
	};
	ring.push(row);
	if(ring.length > DECISION_LOG_MAX){ ring.splice(0, ring.length - DECISION_LOG_MAX); }
	emit();
	return row;
}

export function listDecisions(){
	return ring.slice().reverse();
}

export function clearDecisions(){
	ring = [];
	emit();
}

// 一致率(影子与分歧统计用):按点汇总 { total, agreed, disagreed, fallback }
export function agreementByPoint(){
	const out = {};
	ring.forEach((r)=>{
		const o = out[r.pointId] || (out[r.pointId] = { total: 0, agreed: 0, disagreed: 0, fallback: 0 });
		o.total += 1;
		if(r.source === 'fallback'){ o.fallback += 1; }
		if(r.agree === true){ o.agreed += 1; }
		if(r.agree === false){ o.disagreed += 1; }
	});
	return out;
}

const EMPTY_STATS = { calls: 0, batches: 0, items: 0, errors: 0, inputTokens: 0, outputTokens: 0, estCostUsd: 0, lastAt: null, lastModel: '' };

export function readStats(){
	const raw = safeJsonParseFromStorage(SYSTEMONE_STATS_KEY);
	const out = { ...EMPTY_STATS };
	if(raw && typeof raw === 'object'){
		Object.keys(EMPTY_STATS).forEach((k)=>{
			if(k === 'lastAt' || k === 'lastModel'){ out[k] = raw[k] === undefined || raw[k] === null ? EMPTY_STATS[k] : `${raw[k]}`; return; }
			const n = Number(raw[k]);
			out[k] = Number.isFinite(n) ? n : 0;
		});
	}
	return out;
}

// usage: { items, inputTokens, outputTokens, model, error, batch }
export function addUsage(usage){
	const u = usage || {};
	const cur = readStats();
	cur.calls += 1;
	if(u.batch){ cur.batches += 1; }
	cur.items += Math.max(0, Number(u.items) || 0);
	if(u.error){ cur.errors += 1; }
	const inTok = Math.max(0, Number(u.inputTokens) || 0);
	const outTok = Math.max(0, Number(u.outputTokens) || 0);
	cur.inputTokens += inTok;
	cur.outputTokens += outTok;
	cur.estCostUsd += estimateCostUsd({ inputTokens: inTok, outputTokens: outTok });
	cur.lastAt = new Date().toISOString();
	if(u.model){ cur.lastModel = `${u.model}`; }
	try{ safeJsonStringifyToStorage(SYSTEMONE_STATS_KEY, cur); }catch(e){ /* 配额 */ }
	emit();
	return cur;
}

export function resetStats(){
	try{ safeLocalStorageRemove(SYSTEMONE_STATS_KEY); }catch(e){ /* noop */ }
	emit();
	return readStats();
}

export function subscribeSystemOneLog(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>fn();
	window.addEventListener(SYSTEMONE_LOG_EVENT, h);
	return ()=>window.removeEventListener(SYSTEMONE_LOG_EVENT, h);
}

export function __resetSystemOneLogForTest(){
	ring = [];
	try{ safeLocalStorageRemove(SYSTEMONE_STATS_KEY); }catch(e){ /* noop */ }
}
