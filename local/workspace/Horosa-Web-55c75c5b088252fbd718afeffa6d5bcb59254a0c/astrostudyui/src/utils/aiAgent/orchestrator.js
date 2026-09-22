// AI 助手·多技法编排子代理(C7;借鉴 Roo Code 编排模式 / Claude Code 子代理):复杂问题 → 规划(拆成 ≤4 个「技法 × 子问题」)→ 每个子任务一个**只读**子 Turn
// (只挂该技法层、≤3 轮、零写入)→ 综合成一份回答并确定性渲染「分歧标注」。本文件纯控制流:限额 / strict schema / 提示词 / 解析 / 只读注册表视图 /
// runOrchestration(IO 全注入,零副作用);零新工具零新错误码(只读视图拒写复用 E_APPROVAL_DENIED);子开关 horosa.ai.orchestrate.enabled 由页面判。
import * as defaultRegistry from '../aiTools/registry';
import { registerBuiltinTools } from '../aiTools';
import { readOnlyRegistryView as sharedReadOnlyRegistryView } from './readOnlyRegistry';

export const ORCH_LIMITS = Object.freeze({ MAX_SUBTASKS: 4, SUB_MAX_ROUNDS: 3, SUB_MAX_ADDITIVE: 0, PARALLEL: 3 });
export const ORCH_PLAN_TAG = '【多技法规划】';
export const ORCH_SYNTH_TAG = '【多技法综合】';
export const ORCH_SUBTASK_TAG = '【子任务】';
export const ORCH_DISAGREE_TITLE = '分歧标注';
export const ORCH_CONFIDENCE = ['high', 'medium', 'low'];

export const PLAN_SCHEMA = {
	type: 'object', additionalProperties: false, required: ['subtasks', 'note'],
	properties: {
		subtasks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['technique', 'question', 'why'], properties: { technique: { type: 'string' }, question: { type: 'string' }, why: { type: 'string' } } } },
		note: { type: 'string' },
	},
};
export const SYNTH_SCHEMA = {
	type: 'object', additionalProperties: false, required: ['answer', 'disagreements', 'confidence'],
	properties: {
		answer: { type: 'string' },
		// 扁平行(同一 topic 几家主张就几行):嵌套 positions 会超 SCHEMA_MAX_DEPTH=5 被降级成 json_object;parseSynthesis 两种形态都收并按 topic 归组
		disagreements: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['topic', 'technique', 'claim', 'basis', 'note'], properties: {
			topic: { type: 'string' }, technique: { type: 'string' }, claim: { type: 'string' }, basis: { type: 'string' }, note: { type: 'string' },
		} } },
		confidence: { type: 'string', enum: ORCH_CONFIDENCE },
	},
};

function parseJsonLoose(text){
	const s = `${text == null ? '' : text}`.replace(/```(?:json)?/gi, '').trim();
	try{ return JSON.parse(s); }catch(e){ const i = s.indexOf('{'); const j = s.lastIndexOf('}'); if(i >= 0 && j > i){ try{ return JSON.parse(s.slice(i, j + 1)); }catch(e2){ return null; } } return null; }
}
function normTechniques(techniques){
	return (techniques || []).map((t)=>(typeof t === 'string' ? { key: t, label: t } : (t && t.key ? { key: `${t.key}`, label: `${t.label || t.key}` } : null))).filter(Boolean);
}

// 规划提示词:可用技法只能从候选里选;最多 MAX_SUBTASKS;同技法不重复
export function buildPlanPrompt({ question, techniques, maxSubtasks }){
	const max = Math.max(1, Math.min(ORCH_LIMITS.MAX_SUBTASKS, Number(maxSubtasks) || ORCH_LIMITS.MAX_SUBTASKS));
	const list = normTechniques(techniques).map((t)=>`${t.key}(${t.label})`).join('、');
	return {
		system: [ORCH_PLAN_TAG, '你是命理分析的规划者。把用户的问题拆给最合适的技法并行分析:每个子任务 = 一个技法 + 该技法要回答的具体子问题(question)+ 为什么该技法适合(why)。',
			`可用技法(technique 只能从中选,写 key):${list}。`, `最多 ${max} 个子任务;同一技法不重复;问题简单时可只拆 1 个;子问题要具体到该技法能直接作答。`,
			'只输出一个 JSON:{"subtasks":[{"technique":"key","question":"…","why":"…"}],"note":"一句话说明拆法"}。'].join('\n'),
		user: `【问题】\n${`${question || ''}`.slice(0, 2000)}`,
	};
}
// 子任务用户消息:只依据本技法、只读
export function buildSubtaskPrompt({ question, overallQuestion, label, technique }){
	return [`${ORCH_SUBTASK_TAG}${label || technique}`, `总问题:${`${overallQuestion || ''}`.slice(0, 2000)}`, `本技法要回答的子问题:${`${question || ''}`.slice(0, 500)}`,
		'只依据本技法的排盘数据作答,先给判断再给依据;不要越界谈其它技法;这是只读分析,不要执行任何写入动作。'].join('\n');
}
// 综合提示词:分点综合 + 分歧如实标注 + 置信度
export function buildSynthesisPrompt({ question, results }){
	const parts = (results || []).map((r)=>`### ${r.label || r.technique}(${r.technique})\n子问题:${r.question || ''}\n${`${r.text || ''}`.slice(0, 6000)}`);
	return {
		system: [ORCH_SYNTH_TAG, '你是多技法综合者。把各技法子回答综合成一份面向用户的回答(answer:分点、先结论后依据、保留各技法的关键依据,不要提到「子任务」「综合」等过程词);',
			'各家结论不一致之处如实列入 disagreements:每行 = 一个分歧点(topic)下某一技法(technique)的主张(claim)与依据(basis),同一分歧点有几家主张就写几行(topic 相同),note=如何取舍或提示;没有分歧则 []。',
			'confidence:各家一致且依据充分=high;有分歧但可取舍=medium;依据薄弱或互相矛盾=low。',
			'只输出一个 JSON:{"answer":"…","disagreements":[{"topic":"分歧点","technique":"key","claim":"主张","basis":"依据","note":"取舍"}],"confidence":"high|medium|low"}。'].join('\n'),
		user: `【问题】\n${`${question || ''}`.slice(0, 2000)}\n\n【各技法子回答】\n${parts.join('\n\n')}`,
	};
}

export function parsePlan(text, allowedKeys, limits){
	const lim = { ...ORCH_LIMITS, ...(limits || {}) };
	const obj = parseJsonLoose(text);
	if(!obj || typeof obj !== 'object' || !Array.isArray(obj.subtasks)){ return null; }
	const allow = new Set((allowedKeys || []).map((k)=>`${k}`));
	const seen = new Set(); const subtasks = [];
	obj.subtasks.forEach((s)=>{
		if(!s || typeof s !== 'object'){ return; }
		const technique = `${s.technique || ''}`.trim(); const question = `${s.question || ''}`.trim().slice(0, 500);
		if(!allow.has(technique) || !question || seen.has(technique)){ return; }
		seen.add(technique); subtasks.push({ technique, question, why: `${s.why || ''}`.trim().slice(0, 300) });
	});
	if(!subtasks.length){ return null; }
	return { subtasks: subtasks.slice(0, Math.max(1, lim.MAX_SUBTASKS)), note: `${obj.note || ''}`.trim().slice(0, 300), fallback: false };
}
export function fallbackPlan({ question, techniques, limits }){
	const lim = { ...ORCH_LIMITS, ...(limits || {}) };
	const keys = Array.from(new Set(normTechniques(techniques).map((t)=>t.key)));
	return { subtasks: keys.slice(0, Math.max(1, lim.MAX_SUBTASKS)).map((technique)=>({ technique, question: `${question || ''}`.slice(0, 500), why: '规划不可用,按技法各自作答' })), note: '规划不可用:各技法各答同一问题', fallback: true };
}
export function parseSynthesis(text){
	const obj = parseJsonLoose(text);
	if(!obj || typeof obj !== 'object'){ return null; }
	const answer = `${obj.answer || ''}`.trim();
	if(!answer){ return null; }
	// 两种形态都收:扁平行 {topic,technique,claim,basis,note}(strict schema 形态,按 topic 归组)/ 嵌套 {topic,positions:[…],note}
	const groups = new Map();
	const pos = (p)=>(p && typeof p === 'object' && `${p.claim || ''}`.trim() ? { technique: `${p.technique || ''}`.trim(), claim: `${p.claim}`.trim().slice(0, 300), basis: `${p.basis || ''}`.trim().slice(0, 300) } : null);
	(Array.isArray(obj.disagreements) ? obj.disagreements : []).forEach((d)=>{
		if(!d || typeof d !== 'object'){ return; }
		const topic = `${d.topic || ''}`.trim().slice(0, 120);
		if(!topic){ return; }
		const positions = Array.isArray(d.positions) ? d.positions.map(pos).filter(Boolean) : [pos(d)].filter(Boolean);
		if(!positions.length){ return; }
		const g = groups.get(topic) || { topic, positions: [], note: '' };
		g.positions.push(...positions);
		const note = `${d.note || ''}`.trim().slice(0, 300); if(note){ g.note = note; }
		groups.set(topic, g);
	});
	const disagreements = Array.from(groups.values()).slice(0, 8);
	const confidence = ORCH_CONFIDENCE.indexOf(obj.confidence) >= 0 ? obj.confidence : 'medium';
	return { answer, disagreements, confidence, fallback: false };
}
export function fallbackSynthesis(results){
	const ok = (results || []).filter((r)=>r && `${r.text || ''}`.trim());
	return { answer: ok.map((r)=>`### ${r.label || r.technique}\n${`${r.text}`.trim()}`).join('\n\n'), disagreements: [], confidence: 'low', fallback: true };
}
// 分歧标注:确定性渲染(模型只给结构,版式由代码定)
export function renderDisagreements(synth, labelOf){
	const list = synth && Array.isArray(synth.disagreements) ? synth.disagreements : [];
	if(!list.length){ return ''; }
	const lab = typeof labelOf === 'function' ? labelOf : (k)=>k;
	const lines = [`## ${ORCH_DISAGREE_TITLE}`];
	list.forEach((d, i)=>{
		lines.push(`${i + 1}. **${d.topic}**`);
		d.positions.forEach((p)=>{ lines.push(`   - ${lab(p.technique)}:${p.claim}${p.basis ? `(依据:${p.basis})` : ''}`); });
		if(d.note){ lines.push(`   - 取舍:${d.note}`); }
	});
	return lines.join('\n');
}
export function composeContent(synth, labelOf){
	const body = `${synth && synth.answer ? synth.answer : ''}`.trim();
	const dis = renderDisagreements(synth, labelOf);
	return dis ? `${body}\n\n${dis}` : body;
}

// 只读注册表视图([D79] 单源在 aiAgent/readOnlyRegistry.js;这里保留同名导出以免既有引用断链):manifest 只露 read 级;取/跑 additive 一律拒(复用 E_APPROVAL_DENIED)
export function readOnlyRegistryView(registry){
	return sharedReadOnlyRegistryView(registry, { denyMessage: (name)=>`子任务只读:拒绝执行 ${name}` });
}

// 默认绑定:内置工具目录的只读视图(工具面只住 aiAgent/**;对话交互增强目录 components/aianalysis/chat/** 永不 import 注册表——preflight [246] 负锚)
export function defaultReadOnlyRegistry(){
	try{ registerBuiltinTools(); }catch(e){ /* 幂等 */ }
	return readOnlyRegistryView(defaultRegistry);
}

async function runPool(items, limit, fn){
	const out = new Array(items.length); let next = 0;
	const n = Math.max(1, Math.min(Number(limit) || 1, items.length));
	const workers = Array.from({ length: n }, async ()=>{ while(next < items.length){ const i = next; next += 1; out[i] = await fn(items[i], i); } });
	await Promise.all(workers);
	return out;
}

// 编排主控:io.plan({system,user})→text;io.runSubtask({index,technique,label,question,prompt})→{text,trace,usage,error,status,…};io.synthesize({system,user})→text
// 规划坏/抛 → 各技法各答同一问题;综合坏/抛 → 按技法拼接;只 1 份子回答 → 不再花综合一跑;signal 中止 → status aborted;SUB_MAX_ADDITIVE 恒 0 不可覆盖
export async function runOrchestration({ question, techniques, io, limits, signal, onProgress }){
	const lim = { ...ORCH_LIMITS, ...(limits || {}), SUB_MAX_ADDITIVE: 0 };
	const progress = (ev)=>{ if(typeof onProgress === 'function'){ try{ onProgress(ev); }catch(e){ /* 进度回调不反噬 */ } } };
	const list = normTechniques(techniques);
	const labelOf = (k)=>{ const t = list.find((x)=>x.key === k); return t ? t.label : k; };
	const aborted = ()=>!!(signal && signal.aborted);
	const requests = { plan: 0, subtasks: 0, synthesis: 0 };
	if(!list.length){ return { plan: null, subTurns: [], synthesis: null, content: '', status: 'error', error: '没有可用技法', requests }; }
	let plan = null; let planError = null;
	try{ requests.plan += 1; const txt = await io.plan(buildPlanPrompt({ question, techniques: list, maxSubtasks: lim.MAX_SUBTASKS })); plan = parsePlan(txt, list.map((t)=>t.key), lim); if(!plan){ planError = 'unparseable'; } }
	catch(e){ planError = e && e.message ? `${e.message}` : 'plan_failed'; }
	if(!plan){ plan = { ...fallbackPlan({ question, techniques: list, limits: lim }), error: planError }; }
	progress({ stage: 'planned', plan });
	if(aborted()){ return { plan, subTurns: [], synthesis: null, content: '', status: 'aborted', requests }; }
	const subTurns = await runPool(plan.subtasks, lim.PARALLEL, async (st, index)=>{
		const base = { index, technique: st.technique, label: labelOf(st.technique), question: st.question, prompt: buildSubtaskPrompt({ question: st.question, overallQuestion: question, label: labelOf(st.technique), technique: st.technique }) };
		if(aborted()){ return { ...base, text: '', status: 'aborted', error: null }; }
		requests.subtasks += 1;
		let r;
		try{ r = await io.runSubtask(base); }catch(e){ r = { text: '', error: e && e.message ? `${e.message}` : 'subtask_failed', status: 'error' }; }
		const text = `${(r && r.text) || ''}`;
		const out = { ...base, ...(r || {}), text, status: (r && r.status) || (text.trim() ? 'done' : 'error') };
		progress({ stage: 'subtask', index, result: out });
		return out;
	});
	if(aborted()){ return { plan, subTurns, synthesis: null, content: '', status: 'aborted', requests }; }
	const ok = subTurns.filter((r)=>r.status === 'done' && r.text.trim());
	if(!ok.length){ return { plan, subTurns, synthesis: null, content: '', status: 'error', error: '各技法子任务都没有产出', requests }; }
	let synthesis = null;
	if(ok.length === 1){ synthesis = { answer: ok[0].text.trim(), disagreements: [], confidence: 'medium', fallback: false, single: true }; }
	else{
		try{ requests.synthesis += 1; const txt = await io.synthesize(buildSynthesisPrompt({ question, results: ok })); synthesis = parseSynthesis(txt); }catch(e){ synthesis = null; }
		if(aborted()){ return { plan, subTurns, synthesis: null, content: '', status: 'aborted', requests }; }   // [Q-294/AR-05②] 综合阶段点停止不落 done
		if(!synthesis){ synthesis = fallbackSynthesis(ok); }
	}
	progress({ stage: 'synthesized', synthesis });
	return { plan, subTurns, synthesis, content: composeContent(synthesis, labelOf), status: 'done', requests };
}
