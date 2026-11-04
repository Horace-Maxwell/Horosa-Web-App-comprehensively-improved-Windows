// 决策层 · 三种类型化问题的构造器与校验(noul 是否题 / choice 单选 / score 有序分级)。
// 写法纪律:一问只判一件事;判据写成对比式(true 像什么 / false 像什么;每个选项 what / not_for / examples);
// 指令与判据用英文(模型对英文最准),state 里的用户原文保持中文不翻译;state 字段用反引号路径指名(如 `question`)。
export const CHOICE_MAX = 255;
export const SCORE_MIN = 2;
export const SCORE_MAX = 10;
export const INSTRUCTION_MAX_CHARS = 4000;

function isTextLike(v){
	return (typeof v === 'string' && v.trim().length > 0) || (v && typeof v === 'object');
}

// 是否题:criteria 可缺;给了就必须 true / false 两侧都有(只写一侧 = 模型只见一半判据)
export function noul(instructions, criteria){
	const q = { type: 'noul', instructions };
	if(criteria && typeof criteria === 'object'){
		q.criteria = { true: criteria.true, false: criteria.false };
	}
	return q;
}

// 单选:criteria = { 选项名: 说明 | { what, not_for, examples } | null },≤ 255 项
export function choice(instructions, criteria){
	return { type: 'choice', instructions, criteria: criteria && typeof criteria === 'object' ? { ...criteria } : {} };
}

// 有序分级:levels = 2..10 级,每级字符串或 { summary, signals }
export function score(instructions, levels){
	return { type: 'score', instructions, criteria: Array.isArray(levels) ? levels.slice() : [] };
}

export function validateQuestion(q){
	if(!q || typeof q !== 'object'){ return { ok: false, reason: 'question 不是对象' }; }
	if(!isTextLike(q.instructions)){ return { ok: false, reason: 'instructions 为空' }; }
	if(typeof q.instructions === 'string' && q.instructions.length > INSTRUCTION_MAX_CHARS){ return { ok: false, reason: 'instructions 过长' }; }
	if(q.type === 'noul'){
		if(q.criteria !== undefined){
			if(!q.criteria || typeof q.criteria !== 'object'){ return { ok: false, reason: 'noul.criteria 不是对象' }; }
			if(!isTextLike(q.criteria.true) || !isTextLike(q.criteria.false)){ return { ok: false, reason: 'noul.criteria 须同时给 true / false' }; }
		}
		return { ok: true };
	}
	if(q.type === 'choice'){
		const keys = q.criteria && typeof q.criteria === 'object' ? Object.keys(q.criteria) : [];
		if(keys.length < 2){ return { ok: false, reason: 'choice 至少两个选项' }; }
		if(keys.length > CHOICE_MAX){ return { ok: false, reason: `choice 超过 ${CHOICE_MAX} 项` }; }
		if(keys.some((k)=>!k.trim())){ return { ok: false, reason: 'choice 选项名为空' }; }
		return { ok: true };
	}
	if(q.type === 'score'){
		const levels = q.criteria;
		if(!Array.isArray(levels)){ return { ok: false, reason: 'score.criteria 不是数组' }; }
		if(levels.length < SCORE_MIN || levels.length > SCORE_MAX){ return { ok: false, reason: `score 须 ${SCORE_MIN}–${SCORE_MAX} 级` }; }
		if(levels.some((l)=>!isTextLike(l))){ return { ok: false, reason: 'score 某一级为空' }; }
		return { ok: true };
	}
	return { ok: false, reason: `未知问题类型 ${q.type}` };
}

export function validateQuestions(questions){
	if(!questions || typeof questions !== 'object' || Array.isArray(questions)){ return { ok: false, reason: 'questions 不是映射' }; }
	const names = Object.keys(questions);
	if(!names.length){ return { ok: false, reason: 'questions 为空' }; }
	for(let i = 0; i < names.length; i += 1){
		const r = validateQuestion(questions[names[i]]);
		if(!r.ok){ return { ok: false, reason: `${names[i]}: ${r.reason}` }; }
	}
	return { ok: true };
}

// token 粗估(单源;上限校验与用量估算同用):中文按每字约 1 token、其它按每 4 字符 1 token,JSON 结构字符按 4:1
export function estimateTokens(value){
	let text = '';
	try{ text = typeof value === 'string' ? value : JSON.stringify(value === undefined ? null : value); }catch(e){ text = `${value}`; }
	let cjk = 0;
	for(let i = 0; i < text.length; i += 1){
		const c = text.charCodeAt(i);
		if(c >= 0x2E80){ cjk += 1; }
	}
	return Math.ceil(cjk + (text.length - cjk) / 4);
}
