// 决策层 · 接入点注册表(界面卡片 / 手册表 / 评测 / 校准 / 完备性测试的单一来源)。
// 每点一条:{ id, title, group, kind, timing, shadowOnly, sends[], help, goldenId, defaultThresholds,
//            buildState(inputs), buildQuestions(inputs), interpret(answers, thresholds, inputs), fallback(inputs), isPositive?(value) }
// kind:quality(质量提升)/ precision(减少误判)/ tighten(只加严)/ suggest(界面建议)/ shadow(影子,只记一致率)
// group:chat(对话)/ agent(行动能力)/ memory(记忆)/ materials(资料检索)/ bestof(多模型)
import { CHAT_POINTS } from './points/chat';
import { AGENT_POINTS } from './points/agent';
import { MEMORY_POINTS } from './points/memory';
import { MATERIAL_POINTS } from './points/materials';
import { BESTOF_POINTS } from './points/bestof';

export const POINT_GROUPS = [
	{ key: 'chat', label: '对话' },
	{ key: 'agent', label: '行动能力' },
	{ key: 'memory', label: '记忆' },
	{ key: 'materials', label: '资料检索' },
	{ key: 'bestof', label: '多模型' },
];
export const POINT_KINDS = ['quality', 'precision', 'tighten', 'suggest', 'shadow'];
export const KIND_LABELS = { quality: '质量提升', precision: '减少误判', tighten: '只加严', suggest: '界面建议', shadow: '影子' };

const ALL = [].concat(CHAT_POINTS, AGENT_POINTS, MEMORY_POINTS, MATERIAL_POINTS, BESTOF_POINTS);

const BY_ID = {};
ALL.forEach((p)=>{ BY_ID[p.id] = p; });

export const SYSTEMONE_POINTS = ALL.slice();

export function listPoints(){
	return ALL.slice();
}

export function listPointsByGroup(group){
	return ALL.filter((p)=>p.group === group);
}

export function getPoint(id){
	return BY_ID[`${id}`] || null;
}

// 完备性(合同测试 + preflight 用):每点必须有回落、金标集 id、外发说明、帮助句、类别 / 分组合法、四个函数在
export function validatePointDefinition(p){
	const problems = [];
	if(!p || typeof p !== 'object'){ return ['不是对象']; }
	if(!/^[A-Z][0-9A-Z]*$/.test(`${p.id || ''}`)){ problems.push('id 须为大写字母 + 数字(如 A2 / D1D2)'); }
	if(!`${p.title || ''}`.trim()){ problems.push('缺 title'); }
	if(!POINT_GROUPS.some((g)=>g.key === p.group)){ problems.push(`group 非法:${p.group}`); }
	if(POINT_KINDS.indexOf(p.kind) < 0){ problems.push(`kind 非法:${p.kind}`); }
	if(p.timing !== 'interactive' && p.timing !== 'background'){ problems.push('timing 须为 interactive / background'); }
	if(p.kind === 'shadow' && p.shadowOnly !== true){ problems.push('影子点须标 shadowOnly:true'); }
	if(!Array.isArray(p.sends) || !p.sends.length || p.sends.some((s)=>!`${s}`.trim())){ problems.push('缺外发字段说明 sends[]'); }
	if(!`${p.help || ''}`.trim()){ problems.push('缺帮助句 help'); }
	if(!`${p.goldenId || ''}`.trim()){ problems.push('缺金标集 id'); }
	['buildState', 'buildQuestions', 'interpret', 'fallback'].forEach((fn)=>{ if(typeof p[fn] !== 'function'){ problems.push(`缺 ${fn}()`); } });
	if(p.defaultThresholds && typeof p.defaultThresholds !== 'object'){ problems.push('defaultThresholds 须为对象'); }
	return problems;
}
