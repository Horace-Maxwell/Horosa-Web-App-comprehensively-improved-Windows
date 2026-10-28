// AI 助手·新建目标任务(P2):模型可把长活拆成一个目标任务交给运行器自己一轮轮做;只「建」不「删」,撤销走账本(cancel-task,只许还没开始跑的)。
// 子开关 horosa.ai.tasks.goal.enabled 关=不进 manifest、调用即 E_TOOL_DISABLED(总开关之下再一道门)。
import { GUIDE, RECORD_ID_PATTERN } from './_shared';
import { isGoalEnabled } from '../../aiAgent/prefs';
// 🔴 不得静态 import goalRunner:goalRunner → runtime → aiTools/index → 本文件 成环,目录数组会拿到未初始化的 default(注册即炸);run 时惰性载入
import { ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES } from '../../aiAnalysisContext';

export default {
	name: 'create_goal_task',
	level: 'additive',
	category: 'tasks',
	undoKind: 'cancel-task',
	enabled: ()=>isGoalEnabled(),
	timeoutMs: 15000,
	description: `新建一个目标任务:给定一句话目标(可带完成判据/预算/挂载命盘/技法),任务中心会一轮一轮自动推进直到达成、卡住或预算用完,每轮结束自检。适合「把名单里的人都建档并各起一份快照」这类多步长活;本轮对话内能一步做完的事不要建任务。${GUIDE}:用户明确要求「交给后台/自动完成/做完通知我」时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['goal'],
		properties: {
			goal: { type: 'string', minLength: 1, maxLength: 2000, description: '一句话目标(能判断做完没有)' },
			successCriteria: { type: 'string', maxLength: 1000, description: '完成判据(可选)' },
			budget: { type: 'object', additionalProperties: false, properties: {
				maxTurns: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
				maxCalls: { type: 'integer', minimum: 1, maximum: 200, default: 64 },
				maxCostUsd: { type: 'number', minimum: 0.1, maximum: 50, default: 2 },
				maxWallMinutes: { type: 'integer', minimum: 1, maximum: 120, default: 20 },
			} },
			sourceCid: { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80, description: '挂载的命盘/事盘 cid(可选)' },
			techniques: { type: 'array', maxItems: 6, items: { type: 'string', enum: Array.from(new Set(ANALYSIS_CHART_TECHNIQUES.concat(ANALYSIS_CASE_TECHNIQUES))) } },
			autoStart: { type: 'boolean', default: true, description: '建好立刻开跑(缺省是);false=只排队,用户在任务中心点开始。外部客户端建的一律只排队、此项不生效' },
		},
	},
	async run(args, ctx){
		const { createGoalTask } = await import('../../aiAgent/goalRunner');
		// 外部客户端建的目标任务一律只排队、不自动开跑:要用户在任务中心点「开始」—— 否则建好即跑,撤销(只对未开始的有效)来不及
		const external = !!(ctx && ctx.origin === 'mcp');
		const autoStart = !external && args.autoStart !== false;
		// 创建时快照模型:运行时把本 Turn 的档案::模型放在 ctx.modelSelection(缺席 ⇒ snapshotModelSelection 回落 UI 当前选择)
		const task = await createGoalTask({ goal: args.goal, successCriteria: args.successCriteria, budget: args.budget, sourceCid: args.sourceCid, techniques: args.techniques, autoStart, awaitingUserStart: external, origin: ctx && ctx.origin ? ctx.origin : 'in-app', aiOrigin: { requestId: ctx && ctx.requestId, clientName: ctx && ctx.clientName }, modelSelection: ctx && ctx.modelSelection ? `${ctx.modelSelection}` : undefined, techniqueOptionOverrides: ctx && ctx.techniqueOptionOverrides ? ctx.techniqueOptionOverrides : undefined });
		return {
			ok: true,
			data: { taskId: task.id, status: task.status, title: task.title, budget: task.budget, autoStart, ...(external ? { awaitingUserStart: true } : {}) },
			undo: { kind: 'cancel-task', payload: { taskId: task.id } },
			summary: `目标任务「${task.title}」已${autoStart ? '开始' : '排队'}(预算 ${task.budget.maxTurns} 轮/${task.budget.maxCalls} 次/$${task.budget.maxCostUsd}/${task.budget.maxWallMinutes} 分钟)`,
			...(external ? { message: `目标任务「${task.title}」已排队:外部客户端建的任务不会自动开跑,需用户在星阙任务中心点「开始」;开始前可撤销` } : {}),
			assumptions: external
				? ['外部客户端建的任务只排队、不自动开跑,需用户在任务中心点「开始」;开始前可在动作记录里撤销']
				: ['任务在后台逐轮推进,进度与结果在任务中心;撤销只对还没开始跑的任务有效'],
		};
	},
};
