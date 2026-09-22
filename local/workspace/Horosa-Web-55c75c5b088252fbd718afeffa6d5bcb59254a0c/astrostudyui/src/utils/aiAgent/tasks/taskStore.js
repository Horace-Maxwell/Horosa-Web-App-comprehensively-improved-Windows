// AI 助手·任务实体(P1):目标任务/定时任务/报告作业/扫描 的统一记录,落 IndexedDB agent_tasks(随 AI 工作区备份)。
// 状态机只在本层转移(patchTask 校验合法迁移);运行控制器(取消/暂停/继续)住 taskRegistry(纯内存);
// 撤销/取消只能由用户在界面点按钮——AI 工具(create_goal_task/schedule_task)只能「建」不能「删」。
import { reportBackgroundFailure } from '../bgSink';
import { AI_ANALYSIS_STORES, putStoreRecord, getStoreRecord, listStoreRecords, updateStoreRecordIf, deleteStoreRecords, countStoreRecords } from '../../aiAnalysisStore';
import { emitAutomationEvent } from '../automation/events';
import { controllerOf, unregisterRunning, WINDOW_ID } from './taskRegistry';

export const TASK_EVENT = 'horosa:agent-tasks-changed';
export const TASK_KINDS = ['goal', 'scheduled', 'report', 'scan'];
export const TASK_STATUSES = ['queued', 'scheduled', 'running', 'paused', 'waiting', 'done', 'failed', 'cancelled', 'interrupted'];
export const TASK_TERMINAL = ['done', 'failed', 'cancelled'];
export const TASK_LOG_MAX = 200;
export const TASK_KEEP_MAX = 1000;   // [K3] 终态任务最多留这么多条(最新优先);活跃任务永不裁
// [S46] 跑任务的窗口每 RUNNER_HEARTBEAT_MS 往记录里写一次 runner.heartbeatAt;超过 RUNNER_STALE_MS 没心跳 = 那个窗口已经没了
export const RUNNER_HEARTBEAT_MS = 30 * 1000;
export const RUNNER_STALE_MS = 90 * 1000;
export function runnerStamp(){ return { owner: WINDOW_ID, heartbeatAt: nowIso() }; }
// 心跳只更新 runner 戳(不动状态);任务已不在 running/waiting 时不写
export async function heartbeatTask(id){
	const cur = await getTask(id);
	if(!cur || ['running', 'waiting'].indexOf(cur.status) < 0){ return null; }
	return patchTask(id, { runner: runnerStamp() });
}
// 记录是否由「别的、仍活着的窗口」在跑:owner 不是本窗口且心跳未过期
export function runnerAliveElsewhere(task, now){
	const r = task && task.runner;
	if(!r || !r.heartbeatAt || r.owner === WINDOW_ID){ return false; }
	const at = Date.parse(r.heartbeatAt) || 0;
	return at > 0 && ((now || Date.now()) - at) < RUNNER_STALE_MS;
}
export const TASK_SCHEMA_VERSION = 1;
export const DEFAULT_TASK_BUDGET = Object.freeze({ maxTurns: 8, maxCalls: 64, maxCostUsd: 2, maxWallMinutes: 20 });

// 合法迁移表(from → to 集合);非法迁移 patchTask 抛 E_TASK_TRANSITION
export const TASK_TRANSITIONS = Object.freeze({
	// 起跑前也可 failed(开关未开/没有可用接口配置):任务留在历史并写明原因,而不是永远排队
	queued: ['running', 'scheduled', 'failed', 'cancelled', 'interrupted'],
	scheduled: ['queued', 'running', 'paused', 'failed', 'cancelled', 'interrupted'],
	running: ['paused', 'waiting', 'done', 'failed', 'cancelled', 'interrupted', 'scheduled'],   // → scheduled:定时任务本轮跑完回排期等下次
	paused: ['running', 'queued', 'scheduled', 'failed', 'cancelled', 'interrupted'],
	waiting: ['running', 'paused', 'failed', 'cancelled', 'interrupted'],
	interrupted: ['queued', 'running', 'scheduled', 'failed', 'cancelled'],
	done: [], failed: [], cancelled: [],
});

export function canTransition(from, to){
	if(from === to){ return true; }
	return (TASK_TRANSITIONS[from] || []).indexOf(to) >= 0;
}

function emit(){
	try{ if(typeof window !== 'undefined'){ window.dispatchEvent(new CustomEvent(TASK_EVENT)); } }catch(e){ /* noop: DOM 事件派发失败不反噬 */ }
}

export function subscribeTasks(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>fn();
	window.addEventListener(TASK_EVENT, h);
	return ()=>window.removeEventListener(TASK_EVENT, h);
}

function nowIso(){ return new Date().toISOString(); }

// 同步镜像:账本撤销处理器是同步契约(undoAction 不 await),这里保留最近一次读/写的任务快照供 peekTaskSync
const taskCache = new Map();
function remember(t){ if(t && t.id){ taskCache.set(t.id, t); } return t; }
export function peekTaskSync(id){ return taskCache.get(`${id}`) || null; }
export function __resetTaskCacheForTests(){ taskCache.clear(); }
// [T2] 启动预热:把库里的任务灌进同步镜像——冷启动/刷新后账本撤销(同步契约)才不会把库里存在的任务报成 E_TASK_NOT_FOUND
export async function warmTaskCache(){
	const list = await listTasks({});
	return list.length;
}

export function normalizeTask(input){
	const t = input && typeof input === 'object' ? input : {};
	const kind = TASK_KINDS.indexOf(t.kind) >= 0 ? t.kind : 'goal';
	const status = TASK_STATUSES.indexOf(t.status) >= 0 ? t.status : 'queued';
	const budget = { ...DEFAULT_TASK_BUDGET, ...(t.budget && typeof t.budget === 'object' ? t.budget : {}) };
	return {
		...t,
		kind, status,
		title: `${t.title || ''}`.slice(0, 120) || (kind === 'goal' ? '目标任务' : (kind === 'scheduled' ? '定时任务' : (kind === 'report' ? '报告作业' : '扫描'))),
		origin: `${t.origin || 'in-app'}`,
		progress: Number.isFinite(t.progress) ? Math.max(0, Math.min(100, t.progress)) : 0,
		budget,
		spent: { turns: 0, calls: 0, costUsd: 0, wallMs: 0, ...(t.spent && typeof t.spent === 'object' ? t.spent : {}) },
		spec: t.spec && typeof t.spec === 'object' ? t.spec : {},
		instructions: Array.isArray(t.instructions) ? t.instructions.slice(-20) : [],
		result: t.result === undefined ? null : t.result,
		log: Array.isArray(t.log) ? t.log.slice(-TASK_LOG_MAX) : [],
		notify: t.notify !== false,
		nextRunAt: t.nextRunAt || null,
		lastRunAt: t.lastRunAt || null,
		missedPolicy: t.missedPolicy === 'catch-up' ? 'catch-up' : 'skip',
		conversationId: t.conversationId || null,
		taskSchema: TASK_SCHEMA_VERSION,   // 任务实体自己的版本(库级 schemaVersion 由 migrateRecord 统一写)
	};
}

export async function createTask(spec){
	const rec = normalizeTask({ ...(spec || {}), createdAt: nowIso(), updatedAt: nowIso() });
	const saved = remember(await putStoreRecord(AI_ANALYSIS_STORES.agentTasks, rec, 'task'));
	emit();
	schedulePruneTasks();   // [K3] 建一条就异步回收一次(单飞;表长 ≤ 上限时零 getAll)
	return saved;
}

// [K3] 裁剪终态任务:done/failed/cancelled 按 updatedAt 新在前只留 keep 条,活跃任务(排队/排期/运行/暂停/等待/中断)一条不动。
// 回删除条数;表长 ≤ keep 时只做一次 count(不整表读)。
export async function pruneTasks(opts){
	const keep = Math.max(0, Number(opts && opts.keep) || TASK_KEEP_MAX);
	const total = await countStoreRecords(AI_ANALYSIS_STORES.agentTasks);
	if(total <= keep){ return 0; }
	const all = (await listStoreRecords(AI_ANALYSIS_STORES.agentTasks) || []).map(normalizeTask);
	const terminal = all.filter((t)=>TASK_TERMINAL.indexOf(t.status) >= 0).sort((a, b)=>`${b.updatedAt || ''}`.localeCompare(`${a.updatedAt || ''}`));
	const extra = terminal.slice(keep);
	if(!extra.length){ return 0; }
	const n = await deleteStoreRecords(AI_ANALYSIS_STORES.agentTasks, extra.map((t)=>t.id));
	extra.forEach((t)=>taskCache.delete(t.id));
	emit();
	return n;
}
let pruneInFlight = null;
export function schedulePruneTasks(){
	if(pruneInFlight){ return pruneInFlight; }
	pruneInFlight = new Promise((resolve)=>setTimeout(resolve, 0)).then(()=>pruneTasks()).catch((e)=>{ reportBackgroundFailure('tasks.prune', e); return 0; }).then((n)=>{ pruneInFlight = null; return n; });
	return pruneInFlight;
}

export async function getTask(id){
	if(!id){ return null; }
	const rec = await getStoreRecord(AI_ANALYSIS_STORES.agentTasks, id);
	return rec ? remember(normalizeTask(rec)) : null;
}

export async function listTasks(opts){
	const o = opts || {};
	const all = (await listStoreRecords(AI_ANALYSIS_STORES.agentTasks) || []).map(normalizeTask).map(remember)
		.filter((t)=>(!o.status || (Array.isArray(o.status) ? o.status.indexOf(t.status) >= 0 : t.status === o.status)) && (!o.kind || t.kind === o.kind));
	all.sort((a, b)=>`${b.updatedAt || ''}`.localeCompare(`${a.updatedAt || ''}`));
	return typeof o.limit === 'number' ? all.slice(0, o.limit) : all;
}

// 状态迁移只经这里;patch.status 非法迁移 → 抛 Error(code E_TASK_TRANSITION)
export async function patchTask(id, patch){
	const cur = await getTask(id);
	if(!cur){ const e = new Error(`任务不存在: ${id}`); e.code = 'E_TASK_NOT_FOUND'; throw e; }
	const p = patch && typeof patch === 'object' ? patch : {};
	if(p.status !== undefined && !canTransition(cur.status, p.status)){
		const e = new Error(`任务状态不能从 ${cur.status} 到 ${p.status}`); e.code = 'E_TASK_TRANSITION'; throw e;
	}
	const next = normalizeTask({ ...cur, ...p, spent: { ...cur.spent, ...(p.spent || {}) }, updatedAt: nowIso() });
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.agentTasks, next, 'task');
	return afterTaskWrite(saved, id);
}

// 写后统一收尾:同步镜像 / 终态注销控制器 / 变更事件 / [P4] done 广播一次(其它状态不发,免噪声)
function afterTaskWrite(saved, id){
	remember(saved);
	if(saved && (TASK_TERMINAL.indexOf(saved.status) >= 0 || saved.status === 'interrupted')){ unregisterRunning(id); }
	emit();
	try{ if(saved && saved.status === 'done'){ emitAutomationEvent('task.done', { taskId: saved.id, kind: saved.kind, origin: saved.origin || '' }); } }catch(e){ /* noop: 自动化事件层自吞(events.js 订阅者抛错不反噬) */ }
	return saved;
}

// [S5] 比较并交换:只有当前状态在 ifStatus 里(且迁移合法)才写,单事务内完成——两个窗口抢同一到点任务只有一个赢家。
// 回 { ok, task, reason? },不抛(抢输是正常分支不是异常)。
export async function patchTaskIf(id, patch, opts){
	const o = opts || {};
	const allowed = Array.isArray(o.ifStatus) ? o.ifStatus : (o.ifStatus ? [o.ifStatus] : []);
	const p = patch && typeof patch === 'object' ? patch : {};
	if(!id){ return { ok: false, reason: 'not-found', task: null }; }
	const r = await updateStoreRecordIf(AI_ANALYSIS_STORES.agentTasks, id,
		(raw)=>{
			const cur = normalizeTask(raw);
			if(allowed.length && allowed.indexOf(cur.status) < 0){ return false; }
			if(p.status !== undefined && !canTransition(cur.status, p.status)){ return false; }
			return true;
		},
		(raw)=>{ const cur = normalizeTask(raw); return normalizeTask({ ...cur, ...p, spent: { ...cur.spent, ...(p.spent || {}) }, updatedAt: nowIso() }); });
	if(!r || !r.ok){
		return { ok: false, reason: (r && r.reason) || 'predicate', task: r && r.record ? remember(normalizeTask(r.record)) : null };
	}
	return { ok: true, task: afterTaskWrite(normalizeTask(r.record), id) };
}

export async function appendLog(id, line){
	const cur = await getTask(id);
	if(!cur){ return null; }
	const entry = { at: nowIso(), text: `${line || ''}`.slice(0, 500) };
	const log = cur.log.concat(entry).slice(-TASK_LOG_MAX);
	return putStoreRecord(AI_ANALYSIS_STORES.agentTasks, { ...cur, log, updatedAt: nowIso() }, 'task').then((saved)=>{ remember(saved); emit(); return saved; });
}

// 取消=用户按钮:非终态皆可;运行中的先调控制器 cancel(有则),再落 cancelled
export async function cancelTask(id, reason){
	const cur = await getTask(id);
	if(!cur){ return { ok: false, code: 'E_TASK_NOT_FOUND' }; }
	if(TASK_TERMINAL.indexOf(cur.status) >= 0){ return { ok: false, code: 'E_TASK_TERMINAL', status: cur.status }; }
	const ctl = controllerOf(id);
	if(ctl && typeof ctl.cancel === 'function'){ try{ ctl.cancel(reason || 'user'); }catch(e){ /* noop: 控制器取消抛错不阻断状态落定 */ } }
	const saved = await patchTask(id, { status: 'cancelled', result: cur.result, log: cur.log.concat({ at: nowIso(), text: `已取消(${reason || '用户'})` }) });
	return { ok: true, task: saved };
}

// 撤销支(ledger undoKind:'cancel-task'):只允许还没开始跑的任务(queued/scheduled/paused),否则 E_UNDO_TASK_STARTED
export async function undoCreateTask(id){
	const cur = await getTask(id);
	if(!cur){ return { ok: false, code: 'E_TASK_NOT_FOUND' }; }
	if(['queued', 'scheduled', 'paused'].indexOf(cur.status) < 0){ return { ok: false, code: 'E_UNDO_TASK_STARTED', status: cur.status }; }
	const saved = await patchTask(id, { status: 'cancelled', log: cur.log.concat({ at: nowIso(), text: '已撤销(账本)' }) });
	return { ok: true, task: saved };
}
