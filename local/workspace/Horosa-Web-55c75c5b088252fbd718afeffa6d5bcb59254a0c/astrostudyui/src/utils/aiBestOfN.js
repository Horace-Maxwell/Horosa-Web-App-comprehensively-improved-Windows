// AI 对话·多模型对比 Best-of-N(C5;借鉴 Cursor 3.0):一问同时发给 2-4 个候选(不同模型,或同一模型四个视角)并排流式出字,判官打分选优,可采用/合并;
// 候选流**不带工具**(对比模式只回答不执行动作);采用的成为正文,其余折叠保留在 message.candidates;历史只带采用稿(historyContentOf)。
// 本文件纯函数:候选计划 / 成本估算 / 判官与合并提示词 + 严格 schema / 判官解析 / 历史内容取值。
import { estimateUsageCost, parseModelSelection } from './aiAnalysisProviders';

export const MAX_CANDIDATES = 4;
export const MIN_CANDIDATES = 2;
export const BESTOF_JUDGE_MARKER = '【多模型判官】';
export const BESTOF_MERGE_MARKER = '【多模型合并】';
export const ROLE_ANGLES = [
	{ key: 'classic', label: '经典派', directive: '以经典古法为准绳,先定格局再论细节,引用依据要明确到具体的星/宫/干支。' },
	{ key: 'modern', label: '现代派', directive: '以现代心理/生活化视角解读,把术数结论翻译成可操作的建议,少用术语。' },
	{ key: 'cautious', label: '审慎派', directive: '只说有充分依据的结论,不确定的明确标注「存疑」,宁少勿错,给出置信度。' },
	{ key: 'concise', label: '精炼派', directive: '只给最重要的三点,每点一句结论一句依据,不超过 200 字。' },
];

// 候选计划:models 模式=每个 selection 一个候选(去重、≤4);angles 模式=当前模型 × 视角(≥2)。不足 2 个 → []
export function planCandidates({ mode, selections, providerProfiles, profile, model, angles }){
	const out = [];
	if(mode === 'angles'){
		const keys = Array.isArray(angles) && angles.length ? angles : ROLE_ANGLES.slice(0, 2).map((a)=>a.key);
		keys.slice(0, MAX_CANDIDATES).forEach((k)=>{ const a = ROLE_ANGLES.find((x)=>x.key === k); if(a && profile && model){ out.push({ id: `c${out.length + 1}`, label: `${model} · ${a.label}`, profile, model, angle: a }); } });
	}else{
		const seen = new Set();
		(Array.isArray(selections) ? selections : []).forEach((sel)=>{
			if(out.length >= MAX_CANDIDATES){ return; }
			const parsed = parseModelSelection(sel) || {};
			const p = (providerProfiles || []).find((x)=>x && x.id === parsed.profileId);
			if(!p || !parsed.model){ return; }
			const key = `${p.id}::${parsed.model}`;
			if(seen.has(key)){ return; }
			seen.add(key);
			out.push({ id: `c${out.length + 1}`, label: `${p.name || p.providerType} / ${parsed.model}`, profile: p, model: parsed.model, angle: null });
		});
	}
	return out.length >= MIN_CANDIDATES ? out : [];
}

// 成本估算(按计价表;无价档 null):inputTokens 由调用方按提示词字数估(≈chars/1.6),outputTokens 按上限估
export function estimateCandidatesCost({ candidates, inputTokens, outputTokens }){
	let total = 0; let known = 0;
	const per = (candidates || []).map((c)=>{
		const r = estimateUsageCost(c.model, inputTokens || 0, outputTokens || 0);
		// 计价函数返回对象({cost,…})或数字;无价档 null
		const cost = typeof r === 'number' ? r : (r && typeof r === 'object' ? [r.cost, r.total, r.costUsd, r.usd].find((v)=>Number.isFinite(v)) : null);
		if(Number.isFinite(cost)){ total += cost; known += 1; }
		return { id: c.id, model: c.model, costUsd: Number.isFinite(cost) ? cost : null };
	});
	return { per, totalUsd: known ? total : null, known, unknown: per.length - known };
}

export const JUDGE_SCHEMA = {
	type: 'object', additionalProperties: false, required: ['best', 'ranking', 'reasons'],
	properties: {
		best: { type: 'string', description: '最佳候选 id' },
		ranking: { type: 'array', items: { type: 'string' }, description: '候选 id 由优到劣' },
		reasons: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'score', 'reason'], properties: { id: { type: 'string' }, score: { type: 'integer' }, reason: { type: 'string' } } } },
	},
};

// [Q-331/M-52] 候选正文进判官 / 合并 prompt 前的截断:此前固定 slice(0, 6000) 且**无标注** ——
//   长候选被砍掉尾部,判官照样打分、合并稿照样采用,用户看不出「后半段根本没进去」。
//   现在:① 上限按本次槽预算动态(候选越多每份越短,缺省仍 6000 字保持旧行为);② 截断处写明原长度,
//   让判官/总编知道这份是节选、别把「结论缺失」当扣分点;③ 调用方可据 candidateOverflow 提示用户。
export const BESTOF_CANDIDATE_CHAR_CAP = 6000;
export function candidateCharCap({ count, charBudget }){
	const n = Math.max(1, Number(count) || 1);
	const budget = Number(charBudget) || 0;
	if(budget <= 0){ return BESTOF_CANDIDATE_CHAR_CAP; }
	// 预算的八成分给候选(留两成给问题与指令),每份不少于 1500 字、不多于 24000 字
	return Math.max(1500, Math.min(24000, Math.floor((budget * 0.8) / n)));
}
export function clipCandidateText(text, cap){
	const t = `${text == null ? '' : text}`;
	const c = Math.max(200, Number(cap) || BESTOF_CANDIDATE_CHAR_CAP);
	if(t.length <= c){ return t; }
	return `${t.slice(0, c)}\n（本候选已截断:原文约 ${t.length} 字,此处只给前 ${c} 字;未给出的部分不代表候选没写,请勿因此扣分或臆补。）`;
}
/** 哪些候选超过了本次上限(调用方据此提示用户);回 [{id, chars, cap}] */
export function candidateOverflow(candidates, charBudget){
	const list = Array.isArray(candidates) ? candidates : [];
	const cap = candidateCharCap({ count: list.length, charBudget });
	return list.map((c)=>({ id: c && c.id, chars: `${(c && c.text) || ''}`.length, cap })).filter((x)=>x.chars > cap);
}

export function buildJudgePrompt({ question, candidates, charBudget }){
	const sys = [BESTOF_JUDGE_MARKER, '你是命理分析回答的评审。同一问题有若干候选回答,请按「依据充分、自洽 > 覆盖充分 > 表达清楚」排序并打分(1-10)。'   /* [Q-332① 裁决 2026-09-18] 判官请求不带挂载数据,判据不再写「忠于挂载数据」 */,
		`只输出一个 JSON:{"best":"候选id","ranking":["id",...],"reasons":[{"id":"id","score":1-10,"reason":"一句话"}]}。候选 id 只能取:${(candidates || []).map((c)=>c.id).join(', ')}。`].join('\n');
	const user = [`【问题】\n${`${question || ''}`.slice(0, 2000)}`].concat((candidates || []).map((c)=>`【候选 ${c.id}(${c.label})】\n${clipCandidateText(c.text, candidateCharCap({ count: (candidates || []).length, charBudget }))}`)).join('\n\n');
	return { system: sys, user };
}

export function buildMergePrompt({ question, candidates, ranking, charBudget }){
	const order = Array.isArray(ranking) && ranking.length ? ranking : (candidates || []).map((c)=>c.id);
	const sys = [BESTOF_MERGE_MARKER, '你是总编。把若干候选回答合并成一稿:以排名靠前的为主干,吸收其它候选里有依据的补充,去重、消矛盾(矛盾处以有依据者为准并注明);保持原有结构与语气,不新增候选里没有的事实。'].join('\n');
	const cap = candidateCharCap({ count: order.length, charBudget });
	const user = [`【问题】\n${`${question || ''}`.slice(0, 2000)}`].concat(order.map((id)=>{ const c = (candidates || []).find((x)=>x.id === id); return c ? `【候选 ${c.id}(${c.label})】\n${clipCandidateText(c.text, cap)}` : ''; }).filter(Boolean)).join('\n\n');
	return { system: sys, user };
}

// 判官解析:best 必须是合法 id;ranking 过滤非法/去重并补齐缺席;失败 → null(调用方回落:按完成顺序第一)
export function parseJudge(text, candidateIds){
	const ids = Array.isArray(candidateIds) ? candidateIds : [];
	let obj = null;
	const s = `${text == null ? '' : text}`.replace(/```(?:json)?/gi, '').trim();
	try{ obj = JSON.parse(s); }catch(e){ const i = s.indexOf('{'); const j = s.lastIndexOf('}'); if(i >= 0 && j > i){ try{ obj = JSON.parse(s.slice(i, j + 1)); }catch(e2){ obj = null; } } }
	if(!obj || typeof obj !== 'object'){ return null; }
	const best = ids.indexOf(`${obj.best}`) >= 0 ? `${obj.best}` : null;
	if(!best){ return null; }
	const ranking = [];
	(Array.isArray(obj.ranking) ? obj.ranking : []).forEach((x)=>{ const id = `${x}`; if(ids.indexOf(id) >= 0 && ranking.indexOf(id) < 0){ ranking.push(id); } });
	if(ranking[0] !== best){ const r = ranking.filter((x)=>x !== best); r.unshift(best); ranking.splice(0, ranking.length, ...r); }
	ids.forEach((id)=>{ if(ranking.indexOf(id) < 0){ ranking.push(id); } });
	const reasons = (Array.isArray(obj.reasons) ? obj.reasons : []).map((r)=>(r && ids.indexOf(`${r.id}`) >= 0 ? { id: `${r.id}`, score: Math.max(1, Math.min(10, Math.round(Number(r.score) || 0))), reason: `${r.reason || ''}`.slice(0, 200) } : null)).filter(Boolean);
	return { best, ranking, reasons };
}

// 历史只带采用稿:content 已是采用稿;content 空而有候选时取采用/排名第一/首个非空候选(防历史带空条)
export function historyContentOf(item){
	if(!item || typeof item !== 'object'){ return ''; }
	const content = `${item.content || ''}`;
	if(content.trim() || !Array.isArray(item.candidates) || !item.candidates.length){ return content; }
	const bo = item.bestOf || {};
	const pick = item.candidates.find((c)=>c && c.id === bo.adoptedId) || item.candidates.find((c)=>c && bo.ranking && c.id === bo.ranking[0]) || item.candidates.find((c)=>c && `${c.text || ''}`.trim());
	return pick ? `${pick.text || ''}` : content;
}
