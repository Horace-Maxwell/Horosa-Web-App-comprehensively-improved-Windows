// [批二⑦] plan 形态合同:规划 system 只带目录摘要(不带 schema)/解析剔越界工具/schema 硬界/渲染文本与已批准约束不含规划标记/命令表在位/短调用标记在位。
import { buildPlanSystem, buildPlanUser, parseActionPlan, renderPlanText, approvedPlanDirective, summarizeManifest, PLAN_MAX_STEPS, PLAN_APPROVED_HEAD, ACTION_PLAN_SCHEMA } from '../aiAgent/planMode';
import { SHORT_CALL_MARKERS, shortCallSystem } from '../aiChat/shortCall';
import { BUILTIN_COMMANDS, findCommand } from '../aiChat/commands';
import { registerBuiltinTools } from '../aiTools';
import { exportToolManifest, __resetToolsForTests } from '../aiTools/registry';

const MAN = [
	{ name: 'get_current_context', level: 'read', description: '读取当前工作区。第二句不该出现', inputSchema: { type: 'object', properties: { deep: { type: 'boolean' } } } },
	{ name: 'create_chart_record', level: 'additive', description: '新建命盘', inputSchema: { type: 'object' } },
];

it('规划 system:目录摘要只含名字/读写/首句,不含 inputSchema 键;短调用标记与命令表在位', ()=>{
	const sys = buildPlanSystem(MAN);
	expect(sys).toContain('- get_current_context(读):读取当前工作区');
	expect(sys).toContain('- create_chart_record(写):新建命盘');
	expect(sys).not.toContain('第二句不该出现');
	expect(sys).not.toContain('deep');
	expect(sys).toContain(`${PLAN_MAX_STEPS}`);
	expect(SHORT_CALL_MARKERS.plan).toBe('【行动计划】');
	expect(shortCallSystem('plan', sys).startsWith('【行动计划】\n你是行动规划者')).toBe(true);
	expect(BUILTIN_COMMANDS.find((c)=>c.name === 'plan').aliases).toEqual(['计划']);
	expect(findCommand('计划', []).name).toBe('plan');
	expect(buildPlanUser('看事业', { subjectTitle: '张三', sourceType: 'chart', techniqueKeys: ['bazi', 'ziwei'] })).toBe('目标:看事业\n当前挂载:张三\n已选技法:bazi、ziwei');
});

it('parseActionPlan:围栏 JSON 可读;越界工具剔成 null 并记 dropped;args 只随合法工具保留;risks/questions 截条数', ()=>{
	const text = '```json\n' + JSON.stringify({ summary: '先读再建', steps: [
		{ purpose: '读工作区', tool: 'get_current_context', writes: false, args: { deep: true } },
		{ purpose: '删库跑路', tool: 'delete_everything', writes: true, args: { all: true } },
		{ purpose: '综合', tool: null, writes: false },
	], risks: ['a', 'b', 'c', 'd', 'e', 'f'], questions: ['q1', 'q2', 'q3', 'q4'] }) + '\n```';
	const r = parseActionPlan(text, MAN);
	expect(r.ok).toBe(true);
	expect(r.dropped).toEqual(['delete_everything']);
	expect(r.plan.steps).toEqual([
		{ purpose: '读工作区', tool: 'get_current_context', writes: false, args: { deep: true } },
		{ purpose: '删库跑路', tool: null, writes: true },
		{ purpose: '综合', tool: null, writes: false },
	]);
	expect(r.plan.risks.length).toBe(5);
	expect(r.plan.questions.length).toBe(3);
	// 判别向量:非 JSON / 空步骤 / 超条数硬截到上限而不判红
	expect(parseActionPlan('随便说说', MAN).ok).toBe(false);
	expect(parseActionPlan('{"summary":"x","steps":[]}', MAN).ok).toBe(false);
	const many = parseActionPlan(JSON.stringify({ summary: 's', steps: Array.from({ length: 30 }, (_, i)=>({ purpose: `第${i}步` })) }), MAN);
	expect(many.ok).toBe(true);
	expect(many.plan.steps.length).toBe(PLAN_MAX_STEPS);
	expect(ACTION_PLAN_SCHEMA.additionalProperties).toBe(false);
});

it('渲染:用户消息带编号步骤与工具名;已批准约束以 PLAN_APPROVED_HEAD 开头且不含规划标记字样(免得被辅助请求识别吞掉)', ()=>{
	const plan = { summary: 's', steps: [{ purpose: '读工作区', tool: 'get_current_context', writes: false }, { purpose: '建档', tool: 'create_chart_record', writes: true }], risks: [], questions: ['先确认出生时间'] };
	const txt = renderPlanText(plan, '看事业');
	expect(txt.split('\n')).toEqual(['目标:看事业', '请按下面这份已批准的计划执行:', '1. 读工作区(工具:get_current_context)', '2. 建档(工具:create_chart_record,写入)', '执行前先确认:先确认出生时间']);
	const dir = approvedPlanDirective(plan);
	expect(dir.startsWith(PLAN_APPROVED_HEAD)).toBe(true);
	expect(dir).toContain('2 步计划(其中 1 步写入)');
	expect(dir.indexOf('行动计划')).toBe(-1);
	expect(dir).toContain('ask_user');
});

it('真目录:summarizeManifest 覆盖全部内置工具且名字与 manifest 一致', ()=>{
	__resetToolsForTests(); registerBuiltinTools();
	const man = exportToolManifest();
	const sm = summarizeManifest(man);
	expect(sm.map((t)=>t.name)).toEqual(man.map((t)=>t.name));
	expect(sm.every((t)=>t.brief.length > 0 && t.brief.length <= 80)).toBe(true);
});
