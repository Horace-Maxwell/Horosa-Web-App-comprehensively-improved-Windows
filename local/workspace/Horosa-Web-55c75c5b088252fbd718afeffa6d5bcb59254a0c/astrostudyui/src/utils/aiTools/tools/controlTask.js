// AI 助手·后台任务收紧动作:只做「暂停 / 取消」两种收紧;开始 / 继续 / 立即运行属放行,仍由用户在任务中心手点。
// 目标任务(在跑的)暂停走它的控制器;定时任务(排着的)暂停走排期;取消对任何未结束的任务都可(终态,不能撤销 —— 回包写明)。
import { getTask, cancelTask, TASK_TERMINAL } from '../../aiAgent/tasks/taskStore';
import { controllerOf } from '../../aiAgent/tasks/taskRegistry';
import { pauseScheduledTask } from '../../aiAgent/tasks/scheduler';
import { GUIDE } from './_shared';

export const CONTROL_TASK_ACTIONS = ['pause', 'cancel'];

export const controlTaskTool = {
	name: 'control_task',
	level: 'additive',
	category: 'tasks',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: { type: 'object', required: ['taskId', 'action', 'status'], properties: { taskId: { type: 'string' }, action: { type: 'string' }, status: { type: 'string' }, changed: { type: 'boolean' } } },
	description: `暂停或取消一个后台任务(只做收紧:开始 / 继续 / 立即运行要用户在任务中心手点)。pause = 暂停在跑的目标任务或排着的定时任务;cancel = 取消任何未结束的任务(终态,不能撤销)。任务 id 先用 list_tasks 取。${GUIDE}:用户说「停掉 / 暂停 / 取消那个任务」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['taskId', 'action'], properties: {
		taskId: { type: 'string', minLength: 1, maxLength: 80 },
		action: { type: 'string', enum: CONTROL_TASK_ACTIONS, description: 'pause 暂停 / cancel 取消(不能撤销)' },
	} },
	async noChange(args){
		const t = await getTask(args.taskId);
		if(!t){ return null; }
		if(TASK_TERMINAL.indexOf(t.status) >= 0){ return { ok: true, data: { taskId: args.taskId, action: args.action, status: t.status, changed: false }, summary: `任务已结束(${t.status})`, message: '任务已经结束,无需操作' }; }
		if(args.action === 'pause' && (t.status === 'paused' || t.status === 'interrupted')){ return { ok: true, data: { taskId: args.taskId, action: 'pause', status: t.status, changed: false }, summary: '任务已暂停', message: '任务本来就停着' }; }
		return null;
	},
	async run(args){
		const t = await getTask(args.taskId);
		if(!t){ return { ok: false, code: 'E_TASK_NOT_FOUND', message: `没有这个任务:${`${args.taskId}`.slice(0, 80)}` }; }
		const nc = await controlTaskTool.noChange(args);
		if(nc){ return nc; }
		if(args.action === 'cancel'){
			const r = await cancelTask(args.taskId, 'AI 助手');
			if(!r.ok){ return { ok: false, code: r.code || 'E_TASK_NOT_FOUND', message: `取消没生效(${r.code})` }; }
			return { ok: true, data: { taskId: args.taskId, action: 'cancel', status: 'cancelled', changed: true }, summary: `取消任务 ${t.title || t.id}`, message: `已取消任务「${t.title || t.id}」(取消是终态,不能撤销)` };
		}
		if(t.kind === 'scheduled' && t.status === 'scheduled'){
			const saved = await pauseScheduledTask(args.taskId);
			if(!saved){ return { ok: false, code: 'E_ARGS_INVALID', message: '这个定时任务此刻不能暂停' }; }
			return { ok: true, data: { taskId: args.taskId, action: 'pause', status: 'paused', changed: true }, summary: `暂停定时任务 ${t.title || t.id}`, message: `已暂停定时任务「${t.title || t.id}」;要继续请用户在任务中心点「继续」` };
		}
		const ctl = controllerOf(args.taskId);
		if(t.status === 'running' && ctl && typeof ctl.pause === 'function'){
			try{ ctl.pause(); }catch(e){ return { ok: false, code: 'E_ARGS_INVALID', message: '暂停没生效' }; }
			return { ok: true, data: { taskId: args.taskId, action: 'pause', status: 'paused', changed: true }, summary: `暂停任务 ${t.title || t.id}`, message: `已暂停任务「${t.title || t.id}」;要继续请用户在任务中心点「继续」` };
		}
		return { ok: false, code: 'E_ARGS_INVALID', message: `任务此刻(${t.status})不能暂停:只有在跑的目标任务、排着的定时任务能暂停;要停下可用 action:cancel` };
	},
};

export default controlTaskTool;
