// 任务中心接线(P1):布局层调一次 bindTaskCenter()——启动对账(running/waiting → interrupted)。
// 首启零变化:没有任务/通知且行动能力关闭时铃铛不渲染(TaskCenterBell 自判),这里不碰 DOM。
import { reconcileTasksOnBoot } from './reconcile';
import { peekTaskSync, undoCreateTask, warmTaskCache } from './taskStore';
import { pushNotice } from './noticeStore';
import { registerUndoHandler } from '../../aiTools/ledger';
import { reportBackgroundFailure } from '../bgSink';

let bound = false;
let ledgerLostHandler = null;
export function bindTaskCenter(){
	if(bound){ return; }
	bound = true;
	// 账本撤销支 cancel-task:undoAction 是同步契约 → 用同步镜像判「还没开始跑」,通过后异步落 cancelled
	try{ registerUndoHandler('cancel-task', cancelTaskUndoHandler); }catch(e){ reportBackgroundFailure('tasks.undo-handler', e); }
	// [进阶复查 D17·2026-09-08] 账本提交失败(动作已落地、不可撤销)→ 通知中心留痕;此前 ledgerLost 全仓无人消费
	try{
		if(typeof window !== 'undefined' && typeof window.addEventListener === 'function'){
			if(ledgerLostHandler){ window.removeEventListener('horosa:agent-ledger-lost', ledgerLostHandler); }
			ledgerLostHandler = (e)=>{
				const d = e && e.detail ? e.detail : {};
				pushNotice({ level: 'warn', title: '动作已执行但未进账本', body: `${d.tool || '工具'} 的这次写入不可撤销;本机存储可能已满,请清理回收站或导出备份后再试` }).catch((e)=>reportBackgroundFailure('tasks.notice', e));
			};
			window.addEventListener('horosa:agent-ledger-lost', ledgerLostHandler);
		}
	}catch(e){ reportBackgroundFailure('tasks.ledger-lost-bind', e); }
	// [T2] 启动对账后预热同步镜像:冷启动时账本撤销(同步契约)才能看见库里的任务
	try{ reconcileTasksOnBoot().catch((e)=>reportBackgroundFailure('tasks.reconcile', e)).then(()=>warmTaskCache()).catch((e)=>reportBackgroundFailure('tasks.warm', e)); }catch(e){ reportBackgroundFailure('tasks.reconcile-start', e); }
}

// [T3] 同步镜像只是初判;真相以库为准:附 settle 承诺,undoAction 等它真落定才标 undone,失败则通知留痕(账本不标)
export function cancelTaskUndoHandler(action, undo){
	const taskId = undo && undo.payload && undo.payload.taskId ? undo.payload.taskId : (undo && undo.taskId);
	const t = peekTaskSync(taskId);
	if(!t){ return { ok: false, code: 'E_TASK_NOT_FOUND' }; }
	if(['queued', 'scheduled', 'paused'].indexOf(t.status) < 0){ return { ok: false, code: 'E_UNDO_TASK_STARTED', message: '任务已经开始,不能撤销;可在任务中心取消' }; }
	const settle = undoCreateTask(taskId).then((r)=>{
		if(r && r.ok){ return { ok: true }; }
		const code = (r && r.code) || 'E_UNDO_NOT_APPLICABLE';
		const message = code === 'E_UNDO_TASK_STARTED' ? '任务已经开始,不能撤销;可在任务中心取消' : `撤销失败:${code}`;
		pushNotice({ level: 'warn', title: '撤销未生效', body: `${t.title || taskId}:${message}`, taskId }).catch((e)=>reportBackgroundFailure('tasks.notice', e));
		return { ok: false, code, message };
	}).catch((e)=>({ ok: false, code: 'E_UNDO_NOT_APPLICABLE', message: e && e.message ? e.message : `${e}` }));
	return { ok: true, data: { taskId }, settle };
}

export function __resetTaskCenterForTests(){
	bound = false;
	// [D33] 拆掉账本丢失监听:测试里重复 bind 不再重复推通知
	if(ledgerLostHandler && typeof window !== 'undefined' && typeof window.removeEventListener === 'function'){ window.removeEventListener('horosa:agent-ledger-lost', ledgerLostHandler); }
	ledgerLostHandler = null;
}

export { patchTaskIf, warmTaskCache, pruneTasks, schedulePruneTasks, heartbeatTask, runnerStamp, runnerAliveElsewhere, TASK_KEEP_MAX, RUNNER_HEARTBEAT_MS, RUNNER_STALE_MS } from './taskStore';
export { createTask, getTask, listTasks, patchTask, appendLog, cancelTask, undoCreateTask, peekTaskSync, subscribeTasks, canTransition, TASK_KINDS, TASK_STATUSES, TASK_TERMINAL, TASK_TRANSITIONS, TASK_EVENT, DEFAULT_TASK_BUDGET } from './taskStore';
export { pushNotice, listNotices, unreadCount, markRead, trimNotices, subscribeNotices, isDesktopNotifyEnabled, allowDesktopBanner, NOTICE_EVENT, NOTICE_MAX, DESKTOP_NOTIFY_KEY, DESKTOP_BANNER_PER_MINUTE, DESKTOP_BANNER_DEDUPE_MS } from './noticeStore';
export { registerRunning, unregisterRunning, controllerOf, listRunningIds, WINDOW_ID } from './taskRegistry';
export { reconcileTasksOnBoot } from './reconcile';
export { SCHEDULE_TYPES, SCHEDULED_KINDS, SCHEDULED_KIND_LABELS, MISSED_POLICIES, normalizeSchedule, computeNextRun, decideMissed, describeSchedule, buildScheduledPrompt } from './schedule';
export { bindSchedulerTicks, unbindSchedulerTicks, runSchedulerTick, runScheduledTaskNow, pauseScheduledTask, resumeScheduledTask, dueTasks, SCHEDULER_LAST_TICK_KEY, SCHEDULER_LEASE_KEY, SCHEDULER_TICK_INTERVAL_MS } from './scheduler';
