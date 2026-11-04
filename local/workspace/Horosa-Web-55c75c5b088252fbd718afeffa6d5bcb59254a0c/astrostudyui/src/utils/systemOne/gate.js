// 决策层 · 闸:decide(pointId, inputs) = 组最小 state → 调用 → 置信度三档(直接采纳 / 先确认 / 升级)→ 回落。
// 回 { source:'systemone'|'fallback', value, heuristic, probabilities, confidence, tier, model, latencyMs, reason }。
// 原启发式(point.fallback)每次都照算一遍:既作回落,也用来记「分歧」(影子与校准都靠它)。
// 接缝固定写法:`const d = pointOn('A2') ? await decide('A2', inputs, { signal }) : null;` —— 关路径零 await;本函数内部再判一次只是防御。
import { pointOn, pointShadow, readThresholds } from './prefs';
import { getPoint } from './registry';
import { callSystemOne } from './client';
import { recordDecision } from './log';

export const TIER_ACT = 'act';
export const TIER_CONFIRM = 'confirm';
export const TIER_ESCALATE = 'escalate';
export const DEFAULT_TIER_THRESHOLDS = Object.freeze({ act: 0.85, confirm: 0.6 });

export function tierOf(confidence, thresholds){
	const t = { ...DEFAULT_TIER_THRESHOLDS, ...(thresholds || {}) };
	const c = Number(confidence);
	if(!Number.isFinite(c)){ return TIER_ESCALATE; }
	if(c >= t.act){ return TIER_ACT; }
	if(c >= t.confirm){ return TIER_CONFIRM; }
	return TIER_ESCALATE;
}

export function sameValue(a, b){
	if(a === b){ return true; }
	try{ return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }catch(e){ return false; }
}

function safeFallback(point, inputs){
	try{ return typeof point.fallback === 'function' ? point.fallback(inputs) : null; }catch(e){ return null; }
}

function effectiveThresholds(point){
	return { ...DEFAULT_TIER_THRESHOLDS, ...(point.defaultThresholds || {}), ...readThresholds(point.id) };
}

async function ask(point, inputs, signal){
	let state = null;
	let questions = null;
	try{ state = point.buildState(inputs); questions = point.buildQuestions(inputs); }catch(e){ return { ok: false, reason: 'invalid' }; }
	if(state === null || state === undefined || !questions){ return { ok: false, reason: 'invalid' }; }
	return callSystemOne({ state, questions, mode: point.timing === 'interactive' ? 'interactive' : 'background', signal });
}

function interpretSafe(point, answers, thresholds, inputs){
	try{ return point.interpret(answers, thresholds, inputs) || null; }catch(e){ return null; }
}

// 正式决策:回落语义全在这里(超时 / 429 / 低置信度 / 未校准 / 模型号漂移 / 形状不认得 → 原路径)
export async function decide(pointId, inputs, { signal } = {}){
	const point = getPoint(pointId);
	const t0 = Date.now();
	if(!point){ return { source: 'fallback', value: null, heuristic: null, confidence: null, tier: TIER_ESCALATE, reason: 'unknown-point', latencyMs: 0 }; }
	const heuristic = safeFallback(point, inputs);
	if(!pointOn(pointId)){
		return { source: 'fallback', value: heuristic, heuristic, confidence: null, tier: TIER_ESCALATE, reason: 'off', latencyMs: Date.now() - t0 };
	}
	const thresholds = effectiveThresholds(point);
	const res = await ask(point, inputs, signal);
	if(!res.ok){
		recordDecision({ pointId, source: 'fallback', value: heuristic, heuristic, reason: res.reason, latencyMs: Date.now() - t0, model: res.model });
		return { source: 'fallback', value: heuristic, heuristic, confidence: null, tier: TIER_ESCALATE, reason: res.reason, latencyMs: Date.now() - t0 };
	}
	const out = interpretSafe(point, res.answers, thresholds, inputs);
	if(!out){
		recordDecision({ pointId, source: 'fallback', value: heuristic, heuristic, reason: 'interpret', latencyMs: Date.now() - t0, model: res.model });
		return { source: 'fallback', value: heuristic, heuristic, confidence: null, tier: TIER_ESCALATE, reason: 'interpret', latencyMs: Date.now() - t0 };
	}
	const tier = out.adopt === false ? TIER_ESCALATE : tierOf(out.confidence, thresholds);
	const agree = sameValue(out.value, heuristic);
	if(tier !== TIER_ACT){
		recordDecision({ pointId, source: 'fallback', value: heuristic, heuristic, confidence: out.confidence, agree, reason: `low-confidence:${tier}`, latencyMs: Date.now() - t0, model: res.model });
		return { source: 'fallback', value: heuristic, heuristic, suggested: out.value, probabilities: out.probabilities || null, confidence: out.confidence, tier, reason: 'low-confidence', model: res.model, latencyMs: Date.now() - t0 };
	}
	recordDecision({ pointId, source: 'systemone', value: out.value, heuristic, confidence: out.confidence, agree, latencyMs: Date.now() - t0, model: res.model });
	return { source: 'systemone', value: out.value, heuristic, probabilities: out.probabilities || null, confidence: out.confidence, tier, detail: out.detail, model: res.model, latencyMs: Date.now() - t0, agree };
}

// 影子:只记一致率,永不产生决策(回 null);分开关 = shadow 才发请求
export async function shadowDecide(pointId, inputs, { signal } = {}){
	const point = getPoint(pointId);
	if(!point || !pointShadow(pointId)){ return null; }
	const t0 = Date.now();
	const heuristic = safeFallback(point, inputs);
	const res = await ask(point, inputs, signal);
	if(!res.ok){
		recordDecision({ pointId, source: 'shadow', value: null, heuristic, reason: res.reason, latencyMs: Date.now() - t0, model: res.model });
		return null;
	}
	const out = interpretSafe(point, res.answers, effectiveThresholds(point), inputs);
	recordDecision({ pointId, source: 'shadow', value: out ? out.value : null, heuristic, confidence: out ? out.confidence : null, agree: out ? sameValue(out.value, heuristic) : null, latencyMs: Date.now() - t0, model: res.model, reason: out ? '' : 'interpret' });
	return null;
}
