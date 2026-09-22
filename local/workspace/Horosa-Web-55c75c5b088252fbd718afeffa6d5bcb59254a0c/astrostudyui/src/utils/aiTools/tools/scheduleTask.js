// AI 助手·新建定时任务(P3):模型可替用户排一个到点自动做的活(每日简报/月运/自定义提示词/择日到期提醒);只「建」不「删」,撤销走账本(cancel-task,只许还没跑过的)。
// 子开关 horosa.ai.tasks.scheduler.enabled 关=不进 manifest、调用即 E_TOOL_DISABLED;排期无下次(格式坏/仅一次已过期)→ E_SCHEDULE_INVALID。
// 🔴 只 import 纯排期函数与任务实体层(taskKinds/goalRunner 会经 runtime 绕回 aiTools/index 成环)。
import { GUIDE } from './_shared';
import { snapshotModelSelection } from '../../aiAgent/tasks/modelSnapshot';
import { isSchedulerEnabled } from '../../aiAgent/prefs';
import { ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES } from '../../aiAnalysisContext';
import { SCHEDULE_TYPES, SCHEDULED_KINDS, SCHEDULED_KIND_LABELS, MISSED_POLICIES, DAYS_AHEAD_DEFAULT, normalizeSchedule, computeNextRun, describeSchedule } from '../../aiAgent/tasks/schedule';
import { createTask } from '../../aiAgent/tasks/taskStore';

function fmt(at){
	const d = at ? new Date(at) : null;
	if(!d || Number.isNaN(d.getTime())){ return ''; }
	const p = (n)=>(n < 10 ? '0' : '') + n;
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default {
	name: 'schedule_task',
	level: 'additive',
	category: 'tasks',
	undoKind: 'cancel-task',
	enabled: ()=>isSchedulerEnabled(),
	timeoutMs: 15000,
	description: `新建一个定时任务:到点自动做并通知用户。kind=daily-brief 每日简报(建议挂载命盘;不挂则出通用天象简报)/ monthly-fortune 每月流年·月运(建议挂载命盘;不挂则出通用天象月运)/ custom-prompt 自定义提示词(需 prompt)/ zeri-reminder 择日方案到期提醒(不用 AI,提前 daysAhead 天)。schedule:daily{time} / weekly{weekday 0-6,time} / monthly{day 1-28,time} / once{at ISO 时刻}。应用没开时错过的运行按 missedPolicy 跳过或补跑一次。${GUIDE}:用户明确要求「每天/每周/每月/到时候提醒我/定时」时调用;一次性的事直接做不要排期。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['kind', 'schedule'],
		properties: {
			kind: { type: 'string', enum: SCHEDULED_KINDS, description: SCHEDULED_KINDS.map((k)=>`${k}=${SCHEDULED_KIND_LABELS[k]}`).join(' / ') },
			title: { type: 'string', maxLength: 80, description: '任务标题(缺省按类型)' },
			schedule: { type: 'object', additionalProperties: false, required: ['type'], properties: {
				type: { type: 'string', enum: SCHEDULE_TYPES },
				time: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$', description: 'HH:mm 本地时间(daily/weekly/monthly 必填)' },
				weekday: { type: 'integer', minimum: 0, maximum: 6, description: '0=周日 … 6=周六(weekly)' },
				day: { type: 'integer', minimum: 1, maximum: 31, description: '每月几号(monthly;29-31 自动钳到 28)' },
				at: { type: 'string', maxLength: 40, description: '仅一次的时刻(once;ISO 8601 或 YYYY-MM-DD HH:mm)' },
			} },
			sourceCid: { type: 'string', pattern: '^local-', maxLength: 80, description: '挂载的命盘/事盘 cid(简报/月运建议给)' },
			techniques: { type: 'array', maxItems: 6, items: { type: 'string', enum: Array.from(new Set(ANALYSIS_CHART_TECHNIQUES.concat(ANALYSIS_CASE_TECHNIQUES))) } },
			prompt: { type: 'string', maxLength: 2000, description: '自定义提示词(custom-prompt 必填)' },
			missedPolicy: { type: 'string', enum: MISSED_POLICIES, default: 'skip', description: '应用没开错过时:skip 跳过 / catch-up 下次打开补跑一次' },
			notify: { type: 'boolean', default: true, description: '完成/失败时通知' },
			daysAhead: { type: 'integer', minimum: 1, maximum: 30, default: DAYS_AHEAD_DEFAULT, description: '择日提醒提前天数(zeri-reminder)' },
		},
	},
	async run(args, ctx){
		const schedule = normalizeSchedule(args.schedule);
		const nextRunAt = schedule ? computeNextRun(schedule, new Date()) : null;
		if(!nextRunAt){ return { ok: false, code: 'E_SCHEDULE_INVALID', message: '排期不合法或已过期:daily/weekly/monthly 需 time=HH:mm(weekly 另需 weekday 0-6,monthly 另需 day 1-28);once 需未来时刻' }; }
		if(args.kind === 'custom-prompt' && !`${args.prompt || ''}`.trim()){ return { ok: false, code: 'E_ARGS_INVALID', message: 'custom-prompt 需要 prompt' }; }
		const title = `${args.title || ''}`.trim().slice(0, 80) || SCHEDULED_KIND_LABELS[args.kind] || '定时任务';
		const task = await createTask({
			kind: 'scheduled', status: 'scheduled', title, origin: ctx && ctx.origin ? ctx.origin : 'in-app', aiOrigin: { requestId: ctx && ctx.requestId, clientName: ctx && ctx.clientName },
			nextRunAt, missedPolicy: args.missedPolicy === 'catch-up' ? 'catch-up' : 'skip', notify: args.notify !== false,
			spec: { kind: args.kind, schedule, modelSelection: snapshotModelSelection(ctx && ctx.modelSelection) || undefined, sourceCid: args.sourceCid || null, techniques: Array.isArray(args.techniques) ? args.techniques.slice(0, 6) : [], prompt: `${args.prompt || ''}`.slice(0, 2000), daysAhead: args.daysAhead || DAYS_AHEAD_DEFAULT },
		});
		return {
			ok: true,
			data: { taskId: task.id, status: task.status, title: task.title, kind: args.kind, schedule: describeSchedule(schedule), nextRunAt: task.nextRunAt, missedPolicy: task.missedPolicy },
			undo: { kind: 'cancel-task', payload: { taskId: task.id } },
			summary: `定时任务「${task.title}」已排期:${describeSchedule(schedule)},下次 ${fmt(task.nextRunAt)}(错过则${task.missedPolicy === 'catch-up' ? '补跑一次' : '跳过'})`,
			assumptions: ['到点由应用心跳触发:应用没开的时段不会运行,下次打开按错过策略处理;撤销只对还没跑过的任务有效'],
		};
	},
};
