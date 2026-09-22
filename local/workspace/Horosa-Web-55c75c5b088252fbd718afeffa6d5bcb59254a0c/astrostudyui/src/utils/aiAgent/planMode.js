// AI 助手·plan 形态(借鉴 Claude Code 的 plan mode):/plan <目标> → 先让模型只看「工具目录摘要」列一份行动计划(不执行任何工具)
// → 浮层给用户批准/修改/取消 → 批准后才以「已批准计划」为约束发起真正的 Turn。规划调用是非流式短调用:零工具、零落库、只由用户显式命令触发。
// 不动全局审批三档(never/on-request/read-only 字面锚不变):计划只是给这一轮加一条系统约束,工具照常走各自的审批与账本。
import Ajv from 'ajv';
import { parseShortCallJson } from '../aiChat/shortCall';

export const PLAN_MAX_STEPS = 12;
export const PLAN_STEP_TEXT_MAX = 200;
export const PLAN_SUMMARY_MAX = 300;
export const PLAN_GOAL_MAX = 2000;
export const PLAN_MANIFEST_MAX = 64;
export const PLAN_APPROVED_HEAD = '【已批准计划】';

export const ACTION_PLAN_SCHEMA = Object.freeze({
	type: 'object', additionalProperties: false, required: ['summary', 'steps'],
	properties: {
		summary: { type: 'string', minLength: 1, maxLength: PLAN_SUMMARY_MAX },
		steps: {
			type: 'array', minItems: 1, maxItems: PLAN_MAX_STEPS,
			items: {
				type: 'object', additionalProperties: false, required: ['purpose', 'tool', 'writes'],
				properties: {
					purpose: { type: 'string', minLength: 1, maxLength: PLAN_STEP_TEXT_MAX },
					tool: { type: ['string', 'null'], maxLength: 64 },
					writes: { type: 'boolean' },
					args: { type: 'object' },
				},
			},
		},
		risks: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: PLAN_STEP_TEXT_MAX } },
		questions: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: PLAN_STEP_TEXT_MAX } },
	},
});
let validator = null;
function validate(plan){
	if(!validator){ validator = new Ajv({ allErrors: false, strict: false }).compile(ACTION_PLAN_SCHEMA); }
	const ok = validator(plan);
	const e = !ok && validator.errors && validator.errors[0] ? validator.errors[0] : null;
	return { ok, detail: e ? `${e.instancePath || e.dataPath || ''} ${e.message || ''}`.trim() : '' };
}

// 规划用的工具目录:惰性载入工具模块(对话交互增强目录不许直接引注册表;工具模块静态 import 运行器会成环),按 deny 剔除
export async function loadPlanManifest(deny){
	const [tools, reg] = await Promise.all([import('../aiTools'), import('../aiTools/registry')]);
	tools.registerBuiltinTools();
	const d = Array.isArray(deny) ? deny : [];
	return (reg.exportToolManifest() || []).filter((t)=>t && d.indexOf(t.name) < 0);
}
// 只读 manifest 摘要:规划者只看名字/级别/描述首句,不看 schema(省 token,也免得模型把整段参数写进计划)
export function summarizeManifest(manifest){
	return (Array.isArray(manifest) ? manifest : []).filter((t)=>t && t.name).slice(0, PLAN_MANIFEST_MAX).map((t)=>({
		name: `${t.name}`,
		level: t.level === 'additive' ? 'additive' : 'read',
		brief: `${t.description || ''}`.split(/[。\n]/)[0].slice(0, 80),
	}));
}
export function buildPlanSystem(manifest){
	const list = summarizeManifest(manifest).map((t)=>`- ${t.name}(${t.level === 'additive' ? '写' : '读'}):${t.brief}`).join('\n');
	return [
		'你是行动规划者。用户给出目标,你只输出一份 JSON 计划:不执行任何工具、不给出分析结论、不猜测排盘结果。',
		'JSON 形状:{"summary":"一句话概括","steps":[{"purpose":"这一步做什么","tool":"工具名或 null","writes":false}],"risks":["可选"],"questions":["可选:执行前必须先问用户的问题"]}',
		`约束:步骤 ≤ ${PLAN_MAX_STEPS} 条;tool 只能取下面目录里的名字(没有合适工具就填 null);会写入的步骤 writes 填 true;只输出 JSON,不要围栏、不要解释。`,
		'可用工具目录:',
		list || '(空)',
	].join('\n');
}
export function buildPlanUser(goal, ctx){
	const c = ctx || {};
	const lines = [`目标:${`${goal || ''}`.trim().slice(0, PLAN_GOAL_MAX)}`];
	if(c.subjectTitle){ lines.push(`当前挂载:${`${c.subjectTitle}`.slice(0, 80)}${c.sourceType === 'case' ? '(事盘)' : ''}`); }
	if(Array.isArray(c.techniqueKeys) && c.techniqueKeys.length){ lines.push(`已选技法:${c.techniqueKeys.slice(0, 8).join('、')}`); }
	return lines.join('\n');
}
// 解析 + 剔越界:tool 不在目录里 → 置 null 并记入 dropped(计划照常可批,只是那一步没有工具可用);超长/超条数一律硬截而不是判红
export function parseActionPlan(text, manifest){
	const obj = parseShortCallJson(text);
	if(!obj){ return { ok: false, error: 'not_json', plan: null, dropped: [] }; }
	const known = new Set(summarizeManifest(manifest).map((t)=>t.name));
	const dropped = [];
	const steps = (Array.isArray(obj.steps) ? obj.steps : []).slice(0, PLAN_MAX_STEPS).map((s)=>{
		const st = s && typeof s === 'object' && !Array.isArray(s) ? s : { purpose: `${s == null ? '' : s}` };
		const tool = st.tool == null || st.tool === '' ? null : `${st.tool}`.slice(0, 64);
		const out = { purpose: `${st.purpose || ''}`.trim().slice(0, PLAN_STEP_TEXT_MAX), tool, writes: st.writes === true };
		if(tool && !known.has(tool)){ dropped.push(tool); out.tool = null; }
		if(out.tool && st.args && typeof st.args === 'object' && !Array.isArray(st.args)){ out.args = st.args; }
		return out;
	}).filter((s)=>s.purpose);
	const plan = {
		summary: `${obj.summary || ''}`.trim().slice(0, PLAN_SUMMARY_MAX),
		steps,
		risks: (Array.isArray(obj.risks) ? obj.risks : []).slice(0, 5).map((r)=>`${r == null ? '' : r}`.trim().slice(0, PLAN_STEP_TEXT_MAX)).filter(Boolean),
		questions: (Array.isArray(obj.questions) ? obj.questions : []).slice(0, 3).map((q)=>`${q == null ? '' : q}`.trim().slice(0, PLAN_STEP_TEXT_MAX)).filter(Boolean),
	};
	if(!plan.summary && plan.steps.length){ plan.summary = plan.steps[0].purpose; }
	const v = validate(plan);
	if(!v.ok){ return { ok: false, error: 'schema', plan: null, dropped, detail: v.detail }; }
	return { ok: true, plan, dropped };
}
// 批准后发出的用户消息:目标 + 编号步骤(用户在气泡里看得见自己批了什么)
export function renderPlanText(plan, goal){
	const p = plan || { steps: [] };
	const lines = [`目标:${`${goal || ''}`.trim().slice(0, PLAN_GOAL_MAX)}`, '请按下面这份已批准的计划执行:'];
	(p.steps || []).forEach((s, i)=>{ lines.push(`${i + 1}. ${s.purpose}${s.tool ? `(工具:${s.tool}${s.writes ? ',写入' : ''})` : ''}`); });
	if(p.questions && p.questions.length){ lines.push(`执行前先确认:${p.questions.join(';')}`); }
	return lines.join('\n');
}
// 随 Turn 附加的系统约束(经 extraSystemContext 进「本轮附加上下文」挥发层,缓存断点之后;不含「行动计划」四字,免得被当成规划调用)[Q-290/PP-17]
export function approvedPlanDirective(plan){
	const n = plan && plan.steps ? plan.steps.length : 0;
	const writes = plan && plan.steps ? plan.steps.filter((s)=>s.writes).length : 0;
	return `${PLAN_APPROVED_HEAD}用户已批准用户消息里的 ${n} 步计划(其中 ${writes} 步写入)。严格按步骤执行,不得超出计划范围:不调用计划外的写入工具;写入步骤照常走审批。若执行中必须偏离计划,先用 ask_user 说明再继续。`;
}
