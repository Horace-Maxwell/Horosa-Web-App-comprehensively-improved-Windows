// AI 助手·内容类提案模版 / 技能包 / 个人口径是星阙 AI 系统指令的一部分,AI 只能提议,
// 挂到任务中心等用户采纳(采纳才写入,可撤销采纳);与档案提案同一套 proposals.js。工具只新建提案,不 import 采纳 / 拒绝 / 撤销。
import { addProposal } from '../../aiAgent/proposals';
import { AI_ANALYSIS_STORES, listStoreRecords } from '../../aiAnalysisStore';
import { normalizeSkillPack, SKILL_REQUIRES } from '../../aiChat/skills';
import { SKILL_MAX_TEMPLATE, SKILL_MAX_TRIGGERS } from '../../aiChat/skillLimits';
import { triggerConflicts } from '../../aiChat/commands';
import { readPersona, PERSONA_TEXT_MAX } from '../../aiChat/persona';
import { GUIDE } from './_shared';

const OUT = { type: 'object', required: ['proposalId', 'status'], properties: { proposalId: { type: ['string', 'null'] }, status: { type: 'string' } } };
const pending = (r, what)=>({ ok: true, data: { proposalId: r.proposal.id, status: 'pending' }, summary: `提案 · ${what}`, message: `已提交提案(${what}),等待用户在星阙任务中心采纳(提案 ${r.proposal.id})`, undo: { kind: 'none' } });
const meta = (ctx)=>({ origin: (ctx && ctx.origin) || 'in-app', client: ctx && ctx.clientName });

export const proposeTemplateTool = {
	name: 'propose_template',
	level: 'additive',
	category: 'records',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: OUT,
	description: `提议新建一个 AI 分析模版(文字型:名称 + 指令正文):挂到任务中心等用户采纳,采纳后可撤销。${GUIDE}:用户说「把这套写法存成模版」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['name', 'instructionText'], properties: {
		name: { type: 'string', minLength: 1, maxLength: 60 },
		instructionText: { type: 'string', minLength: 1, maxLength: 8000 },
		reason: { type: 'string', maxLength: 500 },
	} },
	preview(args){ return { title: `提议新建模版:${args.name}`, before: '', after: `${`${args.instructionText || ''}`.slice(0, 300)}\n(只挂提案,采纳前不写入)` }; },
	async run(args, ctx){
		const r = addProposal({ kind: 'template-new', title: `${args.name}`.trim(), changes: { name: `${args.name}`.trim(), instructionText: `${args.instructionText}`.trim() }, reason: args.reason || '', ...meta(ctx) });
		return r.ok ? pending(r, `新建模版「${args.name}」`) : { ok: false, code: r.code, message: r.message };
	},
};

export const proposeSkillPackTool = {
	name: 'propose_skill_pack',
	level: 'additive',
	category: 'records',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: OUT,
	description: `提议新建一个技能包(斜杠触发词 + 提示词模板,可用 {{参数名}}、{{source}}):挂到任务中心等用户采纳,采纳后可撤销;触发词不能与内置命令或已有技能撞。${GUIDE}:用户说「做个 /xx 命令」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['name', 'triggers', 'promptTemplate'], properties: {
		name: { type: 'string', minLength: 1, maxLength: 60 },
		triggers: { type: 'array', minItems: 1, maxItems: SKILL_MAX_TRIGGERS, items: { type: 'string', minLength: 1, maxLength: 20 } },
		promptTemplate: { type: 'string', minLength: 1, maxLength: SKILL_MAX_TEMPLATE },
		requires: { type: 'string', enum: SKILL_REQUIRES, default: 'any', description: 'chart 命盘 / timepoint 起课时间 / two-charts 两张命盘 / any 任意' },
		techniqueKeys: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 40 } },
		description: { type: 'string', maxLength: 200 },
		reason: { type: 'string', maxLength: 500 },
	} },
	preview(args){ return { title: `提议新建技能包:${args.name}`, before: '', after: `触发词:${(args.triggers || []).map((t)=>`/${`${t}`.replace(/^\//, '')}`).join(' ')}\n${`${args.promptTemplate || ''}`.slice(0, 300)}\n(只挂提案,采纳前不写入)` }; },
	async run(args, ctx){
		const skill = normalizeSkillPack({ skill: { version: 1, triggers: args.triggers, requires: args.requires || 'any', techniqueKeys: args.techniqueKeys || [], promptTemplate: args.promptTemplate, argsSpec: [], outputFormat: '', schoolNote: '', description: args.description || '' } });
		if(!skill || !skill.triggers.length){ return { ok: false, code: 'E_ARGS_INVALID', message: '至少一个触发词' }; }
		const conflicts = triggerConflicts(skill.triggers);
		if(conflicts.length){ return { ok: false, code: 'E_ARGS_INVALID', message: `触发词与内置命令冲突:${conflicts.join('、')}` }; }
		let bundles = [];
		try{ bundles = await listStoreRecords(AI_ANALYSIS_STORES.bundles); }catch(e){ bundles = []; }
		const dup = (bundles || []).find((b)=>b && b.skill && (b.skill.triggers || []).some((t)=>skill.triggers.indexOf(`${t}`.replace(/^\//, '')) >= 0));
		if(dup){ return { ok: false, code: 'E_ARGS_INVALID', message: `触发词已被技能「${dup.name}」使用` }; }
		const r = addProposal({ kind: 'skill-new', title: `${args.name}`.trim(), changes: { name: `${args.name}`.trim(), skill }, reason: args.reason || '', ...meta(ctx) });
		return r.ok ? pending(r, `新建技能包「${args.name}」`) : { ok: false, code: r.code, message: r.message };
	},
};

function personaUnchanged(){ return { ok: true, data: { proposalId: null, status: 'unchanged', changed: false }, summary: '个人口径无变化', message: '给的口径与现在的一致,没有产生提案' }; }
export const proposePersonaTextTool = {
	name: 'propose_persona_text',
	level: 'additive',
	category: 'records',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: OUT,
	description: `提议改写「个人口径」整段文字(流派偏好、术语习惯等;会进入之后每一轮对话):挂到任务中心等用户采纳,采纳后可撤销。只改文字,不动启用开关。${GUIDE}:用户说「把我的口径改成…」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['text'], properties: {
		text: { type: 'string', maxLength: PERSONA_TEXT_MAX, description: '新的口径全文(整段替换)' },
		reason: { type: 'string', maxLength: 500 },
	} },
	noChange(args){ return `${readPersona().text || ''}` === `${args.text || ''}` ? personaUnchanged() : null; },
	preview(args){ return { title: '提议改写个人口径', before: `${readPersona().text || ''}`.slice(0, 300), after: `${`${args.text || ''}`.slice(0, 300)}\n(只挂提案,采纳前不写入)` }; },
	async run(args, ctx){
		const cur = `${readPersona().text || ''}`;
		if(cur === `${args.text || ''}`){ return personaUnchanged(); }
		const r = addProposal({ kind: 'persona-text', title: '个人口径', changes: { text: `${args.text || ''}` }, before: { text: cur }, reason: args.reason || '', ...meta(ctx) });
		return r.ok ? pending(r, '改写个人口径') : { ok: false, code: r.code, message: r.message };
	},
};
