// 决策层 · 线格式(单源):组请求、验上限、解析回体并归一成同一形状;价格常数只住这里。
// 回体形状(官方 API 参考 2026-09-22 核对):
//   { model, answers:{ name: {type:'noul', noul:p} | {type:'choice', choice, probabilities:{opt:p}, confidence}
//                              | {type:'score', score, probabilities:{'0':p,…}, legend:{'0':'…'}, confidence} }, usage:{input_tokens, output_tokens} }
//   noul 不带 confidence → 自定义 |2p−1|;score 的 probabilities / legend 键是**层级下标字符串**,归一成 levels 数组。
import { validateQuestions, estimateTokens } from './questions';

export const SYSTEMONE_ENDPOINT_PATH = '/v1/systemone';
export const SYSTEMONE_DEFAULT_BASE_URL = 'https://api.typesafe.ai';
export const SYSTEMONE_DEFAULT_MODEL = 'jev-latest';
export const SYSTEMONE_MODEL_ALIASES = ['jev-latest', 'jev-preview'];
export const SYSTEMONE_LIMITS = Object.freeze({
	requestMaxTokens: 64000,          // 每请求 64k token
	stateAndQuestionMaxTokens: 32000, // state + 最长一问 ≤ 32k
	choiceMax: 255,
	scoreMin: 2,
	scoreMax: 10,
	batchMax: 16,                     // Java 批量上限(有界线程池)
	batchConcurrency: 4,
	itemMaxBytes: 512 * 1024,         // 单项序列化上限(与 Java 同值)
});
// 价格(官方公布):输入 $0.042 / 百万 token,输出免费
export const SYSTEMONE_PRICE_USD_PER_MTOK_INPUT = 0.042;
export const SYSTEMONE_PRICE_USD_PER_MTOK_OUTPUT = 0;

export function normalizeModelName(model){
	const m = `${model || ''}`.trim();
	if(!m){ return SYSTEMONE_DEFAULT_MODEL; }
	return /^jev-[a-z0-9.-]+$/i.test(m) ? m : SYSTEMONE_DEFAULT_MODEL;
}

// 组一次请求;失败回 { ok:false, reason }(调用方永不抛)
export function buildRequest({ state, questions, model }){
	if(state === undefined || state === null){ return { ok: false, reason: 'state 为空' }; }
	const vq = validateQuestions(questions);
	if(!vq.ok){ return { ok: false, reason: vq.reason }; }
	const stateTokens = estimateTokens(state);
	let longest = 0;
	let total = 0;
	Object.keys(questions).forEach((k)=>{ const t = estimateTokens(questions[k]); longest = Math.max(longest, t); total += t; });
	if(stateTokens + longest > SYSTEMONE_LIMITS.stateAndQuestionMaxTokens){ return { ok: false, reason: 'state + 最长一问超过 32k token' }; }
	if(stateTokens + total > SYSTEMONE_LIMITS.requestMaxTokens){ return { ok: false, reason: '整次请求超过 64k token' }; }
	const request = { state, model: normalizeModelName(model), questions };
	let bytes = 0;
	try{ bytes = JSON.stringify(request).length; }catch(e){ return { ok: false, reason: 'state 不可序列化' }; }
	if(bytes > SYSTEMONE_LIMITS.itemMaxBytes){ return { ok: false, reason: '单项序列化超过 512 KB' }; }
	return { ok: true, request, estimatedInputTokens: stateTokens + total };
}

function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
function clamp01(n){ return n === null ? null : Math.max(0, Math.min(1, n)); }
function probMap(raw){
	const out = {};
	if(raw && typeof raw === 'object' && !Array.isArray(raw)){
		Object.keys(raw).forEach((k)=>{ const p = clamp01(num(raw[k])); if(p !== null){ out[k] = p; } });
	}
	return out;
}

// 归一一个答案 → { kind, value, probabilities, confidence, legend?, levels? };形状不认得 → null
export function normalizeAnswer(raw){
	if(!raw || typeof raw !== 'object'){ return null; }
	if(raw.type === 'noul' || (raw.noul !== undefined && raw.type === undefined)){
		const p = clamp01(num(raw.noul));
		if(p === null){ return null; }
		return { kind: 'noul', value: p, probabilities: { true: p, false: 1 - p }, confidence: Math.abs(2 * p - 1) };
	}
	if(raw.type === 'choice'){
		const probabilities = probMap(raw.probabilities);
		let value = typeof raw.choice === 'string' ? raw.choice : '';
		if(!value){
			// 回体缺 choice(防御):取概率最高的选项
			const keys = Object.keys(probabilities);
			if(!keys.length){ return null; }
			value = keys.reduce((best, k)=>(probabilities[k] > probabilities[best] ? k : best), keys[0]);
		}
		let confidence = clamp01(num(raw.confidence));
		if(confidence === null){
			// 缺 confidence(防御):三选项近似 (n·pmax − 1)/(n − 1)
			const keys = Object.keys(probabilities);
			const n = keys.length;
			const pmax = keys.length ? Math.max(...keys.map((k)=>probabilities[k])) : 0;
			confidence = n > 1 ? clamp01((n * pmax - 1) / (n - 1)) : pmax;
		}
		return { kind: 'choice', value, probabilities, confidence };
	}
	if(raw.type === 'score'){
		const value = num(raw.score);
		const probabilities = probMap(raw.probabilities);
		const legend = raw.legend && typeof raw.legend === 'object' && !Array.isArray(raw.legend) ? { ...raw.legend } : {};
		const idx = Object.keys(probabilities).map((k)=>Number(k)).filter((k)=>Number.isFinite(k)).sort((a, b)=>a - b);
		const levels = idx.map((i)=>({ index: i, label: legend[`${i}`] !== undefined ? `${legend[`${i}`]}` : '', p: probabilities[`${i}`] }));
		if(value === null && !levels.length){ return null; }
		let confidence = clamp01(num(raw.confidence));
		if(confidence === null){
			const pmax = levels.length ? Math.max(...levels.map((l)=>l.p)) : 0;
			const n = levels.length;
			confidence = n > 1 ? clamp01((n * pmax - 1) / (n - 1)) : pmax;
		}
		// 回体缺 score(防御):按概率加权
		const scoreValue = value !== null ? value : levels.reduce((s, l)=>s + l.index * l.p, 0);
		return { kind: 'score', value: scoreValue, probabilities, legend, levels, confidence };
	}
	return null;
}

// 归一整份回体;任何缺项都不抛,只回 { ok:false, reason }
export function normalizeResponse(raw){
	if(!raw || typeof raw !== 'object'){ return { ok: false, reason: 'invalid' }; }
	const answersRaw = raw.answers;
	if(!answersRaw || typeof answersRaw !== 'object' || Array.isArray(answersRaw)){ return { ok: false, reason: 'invalid' }; }
	const answers = {};
	Object.keys(answersRaw).forEach((name)=>{ const a = normalizeAnswer(answersRaw[name]); if(a){ answers[name] = a; } });
	if(!Object.keys(answers).length){ return { ok: false, reason: 'invalid' }; }
	const usageRaw = raw.usage && typeof raw.usage === 'object' ? raw.usage : {};
	const usage = { inputTokens: Math.max(0, Math.floor(num(usageRaw.input_tokens) || 0)), outputTokens: Math.max(0, Math.floor(num(usageRaw.output_tokens) || 0)) };
	return { ok: true, model: `${raw.model || ''}`, answers, usage };
}

export function estimateCostUsd(usage){
	const inTok = usage && Number.isFinite(Number(usage.inputTokens)) ? Number(usage.inputTokens) : 0;
	const outTok = usage && Number.isFinite(Number(usage.outputTokens)) ? Number(usage.outputTokens) : 0;
	return (inTok * SYSTEMONE_PRICE_USD_PER_MTOK_INPUT + outTok * SYSTEMONE_PRICE_USD_PER_MTOK_OUTPUT) / 1e6;
}
