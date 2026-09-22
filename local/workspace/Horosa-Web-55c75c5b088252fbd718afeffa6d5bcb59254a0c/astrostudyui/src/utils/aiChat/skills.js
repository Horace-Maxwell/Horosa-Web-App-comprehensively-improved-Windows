// AI 助手·技能包(A3;借鉴 Claude Code Skills / Cursor):把「用哪些技法 + 口径 + 输出格式 + 提示词模板 + 参数」打成一个包,一键使用、可导出分享。
// 数据形状:技能包 = 组合(bundles 记录)附加 skill 字段,零新 store;内置技能不落库(BUILTIN_SKILLS,id 以 builtin: 开头)。
// 纪律:本文件纯函数零副作用(导入/导出只做形状与版本判定,写库由调用方);模板只做 {{name}} 替换,不执行任何表达式。
import { triggerConflicts } from './commands';

export const SKILL_VERSION = 1;
export const SKILL_REQUIRES = ['chart', 'timepoint', 'two-charts', 'any'];
export const SKILL_FILE_FORMAT = 'horosa-skill';
export const SKILL_FILE_EXT = '.horosa-skill.json';
import { SKILL_MAX_TRIGGERS, SKILL_MAX_TEMPLATE, SKILL_MAX_SYSTEM_PROMPT } from './skillLimits';
export { SKILL_MAX_TRIGGERS, SKILL_MAX_TEMPLATE, SKILL_MAX_SYSTEM_PROMPT };

function cleanList(list, max){ return Array.from(new Set((Array.isArray(list) ? list : []).map((x)=>`${x == null ? '' : x}`.trim()).filter(Boolean))).slice(0, max || 64); }

export function normalizeArgsSpec(list){
	return (Array.isArray(list) ? list : []).map((a)=>{
		if(!a || typeof a !== 'object'){ return null; }
		const name = `${a.name || ''}`.trim().replace(/[^A-Za-z0-9_一-龥]/g, '');
		if(!name){ return null; }
		return { name, label: `${a.label || name}`.slice(0, 40), default: a.default === undefined || a.default === null ? '' : `${a.default}`.slice(0, 200) };
	}).filter(Boolean).slice(0, 6);
}

// 归一(纯):无 skill 字段 → null;有 → 完整形状(triggers 去 / 前缀、去重、≤4;requires 不合法回落 any)
export function normalizeSkillPack(bundle){
	const sk = bundle && bundle.skill && typeof bundle.skill === 'object' ? bundle.skill : null;
	if(!sk){ return null; }
	const version = Number.isInteger(sk.version) && sk.version >= 1 ? sk.version : 1;
	return {
		version,
		triggers: cleanList((sk.triggers || []).map((t)=>`${t || ''}`.replace(/^\//, '')), SKILL_MAX_TRIGGERS),
		requires: SKILL_REQUIRES.indexOf(sk.requires) >= 0 ? sk.requires : 'any',
		techniqueKeys: cleanList(sk.techniqueKeys, 12),
		// [Q-329① 裁决 2026-09-18] 撤 sections 字段:全仓无读取方(编辑器不写、导入保留、无消费),归一化即丢弃;老包带该键亦不再保留
		promptTemplate: `${sk.promptTemplate || ''}`.slice(0, SKILL_MAX_TEMPLATE),
		argsSpec: normalizeArgsSpec(sk.argsSpec),
		outputFormat: `${sk.outputFormat || ''}`.slice(0, 1000),
		schoolNote: `${sk.schoolNote || ''}`.slice(0, 1000),
		description: `${sk.description || ''}`.slice(0, 200),
	};
}

// 参数解析:按 argsSpec 顺序切参数原文(空白分隔;最后一个参数吃掉剩余全文);缺省值兜底;`今年` 等动态缺省在 renderSkillPrompt 里算
export function parseSkillArgs(argsSpec, argsText){
	const spec = normalizeArgsSpec(argsSpec);
	const parts = `${argsText || ''}`.trim().split(/\s+/).filter(Boolean);
	const out = {};
	spec.forEach((a, i)=>{
		const last = i === spec.length - 1;
		const v = last ? parts.slice(i).join(' ') : (parts[i] || '');
		out[a.name] = v || a.default || '';
	});
	if(!spec.length && `${argsText || ''}`.trim()){ out.args = `${argsText}`.trim(); }
	return out;
}

const DYNAMIC_DEFAULTS = {
	今年: ()=>`${new Date().getFullYear()}`,
	明年: ()=>`${new Date().getFullYear() + 1}`,
	今天: ()=>{ const d = new Date(); const p = (n)=>(n < 10 ? '0' : '') + n; return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; },
};

// 模板渲染:{{name}} → 参数值(动态缺省词 今年/明年/今天 求值);{{source}} → 命盘标题;未知占位符留空;不执行任何表达式
const hasOwn = (o, k)=>Object.prototype.hasOwnProperty.call(o, k);
export function renderSkillPrompt(skill, args, ctx){
	const sk = skill && skill.promptTemplate !== undefined ? skill : normalizeSkillPack({ skill }) || { promptTemplate: '' };
	const vars = { ...(args || {}) };
	// [J5d] 只认自有键:vars/DYNAMIC_DEFAULTS 都是普通对象,{{constructor}}/{{__proto__}} 走原型链会把构造器源码渲染进请求体
	Object.keys(vars).forEach((k)=>{ const v = `${vars[k] == null ? '' : vars[k]}`; if(hasOwn(DYNAMIC_DEFAULTS, v)){ vars[k] = DYNAMIC_DEFAULTS[v](); } });
	const c = ctx || {};
	vars.source = c.activeSource && c.activeSource.title ? `${c.activeSource.title}` : (hasOwn(vars, 'source') ? vars.source : '');
	vars.other = c.otherSource && c.otherSource.title ? `${c.otherSource.title}` : (hasOwn(vars, 'other') ? vars.other : '');
	return `${sk.promptTemplate || ''}`.replace(/\{\{\s*([A-Za-z0-9_一-龥]+)\s*\}\}/g, (m, k)=>(!hasOwn(vars, k) || vars[k] === undefined || vars[k] === null ? '' : `${vars[k]}`)).trim();
}

// 技能的会话级系统指令(稳定层):口径备注 + 输出格式;空=不注入
export function buildSkillDirective(skill){
	const sk = skill || {};
	const parts = [];
	if(sk.schoolNote){ parts.push(`【口径】${sk.schoolNote}`); }
	if(sk.outputFormat){ parts.push(`【输出格式】${sk.outputFormat}`); }
	return parts.join('\n');
}

// 内置技能(不落库;触发词即内置命令名,菜单里内置优先)
export const BUILTIN_SKILLS = [
	{ id: 'builtin:liunian', name: '流年', skill: { version: 1, triggers: ['流年'], requires: 'chart', techniqueKeys: ['bazi', 'ziwei'], argsSpec: [{ name: 'year', label: '年份', default: '今年' }],
		promptTemplate: '请结合八字与紫微斗数,分析{{source}}在 {{year}} 年的流年:整体走势、事业财运、感情家庭、健康提醒,各 2-3 条,标注依据(流年干支/流年宫位);末尾给出 {{year}} 年最需留意的一件事与一条可执行建议。',
		outputFormat: '分节小标题 + 要点式;每条要点先结论后依据;不超过 600 字。', schoolNote: '', description: '八字 + 紫微看指定年份' } },
	{ id: 'builtin:hepan', name: '合盘', skill: { version: 1, triggers: ['合盘'], requires: 'two-charts', techniqueKeys: [], argsSpec: [{ name: 'other', label: '对方', default: '' }],
		promptTemplate: '请基于下面给出的两张命盘的合盘数据,分析{{source}}与{{other}}的关系:相处模式、互补与摩擦点、长期走向,各 2-3 条并标注依据;末尾一条相处建议。',
		outputFormat: '分节小标题 + 要点式;不超过 600 字。', schoolNote: '', description: '两张命盘合看' } },
	{ id: 'builtin:brief', name: '简报', skill: { version: 1, triggers: ['简报'], requires: 'chart', techniqueKeys: ['bazi', 'ziwei'], argsSpec: [],
		promptTemplate: '请给{{source}}一页简报:命局特点(3 条)、当前大运/大限要点(2 条)、近期注意(2 条)、一句话总评;每条先结论后依据。',
		outputFormat: '一页以内,要点式,不超过 400 字。', schoolNote: '', description: '当前命盘一页简报' } },
];

// [J5c] 技能包随包带的会话系统指令封顶:一个技能包不能把每次请求的稳定层撑爆(导入/导出都截)
const clipSystemPrompt = (s)=>`${s || ''}`.slice(0, SKILL_MAX_SYSTEM_PROMPT);

// 导出:不含资料正文,只含技能字段与组合的基本设置(materialIds 只留名单);带格式头
export function exportSkillPack(bundle, materialsById){
	const sk = normalizeSkillPack(bundle);
	if(!sk){ return null; }
	const mats = (bundle.defaultMaterialIds && bundle.defaultMaterialIds.length ? bundle.defaultMaterialIds : (bundle.materialIds || [])).map((id)=>{ const m = materialsById && materialsById[id]; return { id, name: m && m.name ? `${m.name}` : '' }; });
	return { format: SKILL_FILE_FORMAT, version: 1, exportedAt: new Date().toISOString(), pack: { name: `${bundle.name || ''}`, skill: sk, defaultTechniqueKeys: bundle.defaultTechniqueKeys || [], defaultSystemPrompt: clipSystemPrompt(bundle.defaultSystemPrompt), materials: mats } };
}

// 导入判定(纯):{ ok, reason, pack, action: 'create'|'replace'|'skip', existing }
//   同名且导入版本 > 既有版本 → replace(调用方先 ensureTemplateVersion 留一版再覆盖);同名版本不高 → skip;无同名 → create
export function planSkillImport(text, existingBundles){
	let parsed = null;
	try{ parsed = JSON.parse(`${text || ''}`); }catch(e){ return { ok: false, reason: 'JSON 解析失败' }; }
	if(!parsed || parsed.format !== SKILL_FILE_FORMAT || !parsed.pack || typeof parsed.pack !== 'object'){ return { ok: false, reason: '不是技能包文件' }; }
	const pack = parsed.pack;
	const skill = normalizeSkillPack({ skill: pack.skill });
	if(!skill || !skill.triggers.length){ return { ok: false, reason: '技能包缺触发词' }; }
	const name = `${pack.name || ''}`.trim();
	if(!name){ return { ok: false, reason: '技能包缺名字' }; }
	// [J5a] 触发词撞内置命令:回 conflicts 让界面拒导入(内置命令永远优先,外来包不得顶替 /compact /流年 这类名字)
	const conflicts = triggerConflicts(skill.triggers);
	const existing = (existingBundles || []).find((b)=>b && `${b.name || ''}`.trim() === name) || null;
	if(existing){
		const cur = normalizeSkillPack(existing);
		const curVersion = cur ? cur.version : 0;
		if(skill.version > curVersion){ return { ok: true, action: 'replace', pack: { ...pack, skill }, existing, conflicts }; }
		return { ok: true, action: 'skip', pack: { ...pack, skill }, existing, conflicts, reason: `同名技能「${name}」版本 ${curVersion} 不低于导入版本 ${skill.version},未覆盖` };
	}
	return { ok: true, action: 'create', pack: { ...pack, skill }, existing: null, conflicts };
}

// 组合记录 ← 技能包(创建/覆盖时用;materials 名单不还原为 id,由用户在组合编辑器补)
export function bundleFromSkillPack(pack, base){
	const b = { ...(base || {}) };
	b.name = `${pack.name || b.name || '技能'}`;
	b.skill = normalizeSkillPack({ skill: pack.skill });
	b.defaultTechniqueKeys = cleanList(pack.defaultTechniqueKeys && pack.defaultTechniqueKeys.length ? pack.defaultTechniqueKeys : b.skill.techniqueKeys, 12);
	if(pack.defaultSystemPrompt){ b.defaultSystemPrompt = clipSystemPrompt(pack.defaultSystemPrompt); }
	return b;
}

// [Q-416 裁决 2026-09-18] 模版页组合弹窗改「默认挂载技法」时对技能包同步写 skill.techniqueKeys(纯):
// 非技能包 / 技法未变 → {}(零变化);变了 → 技能升版 + 旧版留档(≤5,与技能包编辑器同律)。此前两处各写各的 → 组合与技能技法分叉
export function syncSkillTechniqueKeys(bundle, keys, nowIso){
	const prev = normalizeSkillPack(bundle);
	if(!prev){ return {}; }
	const next = cleanList(keys, 12);
	if(next.join('\u0001') === prev.techniqueKeys.join('\u0001')){ return {}; }
	const history = (bundle && Array.isArray(bundle.skillHistory) ? bundle.skillHistory : []).concat([{ at: nowIso || new Date().toISOString(), skill: prev }]).slice(-5);
	return { skill: { ...prev, version: prev.version + 1, techniqueKeys: next }, skillHistory: history };
}

export function skillsOf(bundles){
	return (bundles || []).map((b)=>{ const sk = normalizeSkillPack(b); return sk ? { ...b, skill: sk } : null; }).filter(Boolean);
}
