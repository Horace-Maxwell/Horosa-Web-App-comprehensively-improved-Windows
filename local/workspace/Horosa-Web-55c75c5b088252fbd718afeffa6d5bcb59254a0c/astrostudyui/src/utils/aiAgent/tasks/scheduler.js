// AI 助手·定时任务调度器(P3;借鉴 Claude Cowork / ChatGPT 定时任务):壳侧只做 60 秒哑心跳(window.__horosaSchedulerTick),
// 调度大脑在页面——每跳:总开关+子开关都开才动 → 记 lastTickAt → 找到点任务 → 错过判定(skip/catch-up)→ 串行只跑一个(其余下一跳)。
// 缺省关=零定时器零执行;应用没开的时段不会有心跳,下次打开按任务的 missedPolicy 跳过或补跑一次(只补最近一次)。
// 🔴 不得静态 import taskKinds/goalRunner(goalRunner → runtime → aiTools/index → schedule_task 工具 → 本层 成环);跑任务时惰性载入。
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../../safeStorage';
import { isDesktopBridgeAvailable } from '../../aiAnalysisDesktop';
import { isAgentEnabled, isSchedulerEnabled } from '../prefs';
import { listTasks, getTask, patchTask, patchTaskIf, appendLog, heartbeatTask, runnerStamp, DEFAULT_TASK_BUDGET, RUNNER_HEARTBEAT_MS } from './taskStore';
import { registerRunning, unregisterRunning, WINDOW_ID } from './taskRegistry';
import { pushNotice } from './noticeStore';
import { computeNextRun, decideMissed, describeSchedule } from './schedule';
import { withTimeout } from '../withTimeout';
import { reportBackgroundFailure } from '../bgSink';

export const SCHEDULER_LAST_TICK_KEY = 'horosa.ai.tasks.scheduler.lastTickAt';   // 本机上次心跳(毫秒);device-local 不备份
export const SCHEDULER_LEASE_KEY = 'horosa.ai.tasks.scheduler.lease';   // [S1] 本机跳租约 {owner,until}:多窗口同时起跳只有租约主进执行体;device-local 不备份
export const SCHEDULER_TICK_INTERVAL_MS = 60 * 1000;
export const SCHEDULER_PENDING_MAX = 1;   // 页面未绑定期间壳侧只留最新一跳(与 main.rs scheduler_tick_script 的 q.length>1 同构)
let ticking = false;
let browserTimer = null;
// 本窗口身份 = taskRegistry.WINDOW_ID(同一标签页刷新保持;新标签页各一枚)
const TAB_ID = WINDOW_ID;

function readLease(){
	try{ const v = JSON.parse(safeLocalStorageGet(SCHEDULER_LEASE_KEY) || 'null'); return v && typeof v === 'object' ? v : null; }catch(e){ return null; }
}
// 租约:别的窗口持有且未过期 → 本跳让位(busy);否则写成自己的。租约只是少做无用功,真正的「只跑一次」由 CAS 保证。
function acquireLease(nowMs, ms){
	const cur = readLease();
	if(cur && cur.owner !== TAB_ID && Number(cur.until) > nowMs){ return false; }
	safeLocalStorageSet(SCHEDULER_LEASE_KEY, JSON.stringify({ owner: TAB_ID, until: nowMs + ms }));
	return true;
}
function releaseLease(){
	const cur = readLease();
	if(cur && cur.owner === TAB_ID){ safeLocalStorageRemove(SCHEDULER_LEASE_KEY); }
}
// [S2] 一跳预算:显式 hopTimeoutMs > 任务预算 maxWallMinutes > 缺省预算
function hopTimeoutOf(task, o){
	const explicit = Number(o && o.hopTimeoutMs);
	if(Number.isFinite(explicit) && explicit > 0){ return explicit; }
	const minutes = Number(task && task.budget && task.budget.maxWallMinutes) || DEFAULT_TASK_BUDGET.maxWallMinutes;
	return Math.max(1000, minutes * 60000);
}

function fmt(at){
	const d = at ? new Date(at) : null;
	if(!d || Number.isNaN(d.getTime())){ return ''; }
	const p = (n)=>(n < 10 ? '0' : '') + n;
	return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function readLastTickAt(){
	const v = Number(safeLocalStorageGet(SCHEDULER_LAST_TICK_KEY));
	return Number.isFinite(v) && v > 0 ? v : null;
}

export function schedulerGatesOpen(){ return isAgentEnabled() && isSchedulerEnabled(); }

// 到点任务:已排期 + nextRunAt ≤ now,按到点先后排序(纯函数,便于合同测试)
export function dueTasks(tasks, now){
	const t = now instanceof Date ? now.getTime() : Number(now || Date.now());
	return (tasks || []).filter((x)=>x && x.kind === 'scheduled' && x.status === 'scheduled' && x.nextRunAt && Date.parse(x.nextRunAt) <= t)
		.sort((a, b)=>Date.parse(a.nextRunAt) - Date.parse(b.nextRunAt));
}

async function defaultRunner(task, ctx){
	const m = await import('./taskKinds');
	return m.runScheduledTask(task, ctx);
}

// 跑一个定时任务(到点/补跑/手动):scheduled → running → 回 scheduled(还有下次)| done(once)| failed(失败且无下次)
// [S1] scheduled→running 走 patchTaskIf 单事务 CAS:两个窗口抢同一到点任务只有一个赢家,抢输回 null(不跑、不记日志)。
// [S2] 一跳带超时(hopTimeoutOf):执行体挂死 → 到点按失败收口并中止它的信号,ticking 一定释放。
// [S4] 一跳一个 AbortController 登记进 taskRegistry:用户取消 → 执行体的 ctx.signal 立刻 aborted。
export async function executeScheduledTask(task, opts){
	const o = opts || {};
	const now = o.now instanceof Date ? o.now : new Date();
	const trigger = o.trigger || 'timer';
	const claim = await patchTaskIf(task.id, { status: 'running', lastRunAt: now.toISOString(), runner: runnerStamp() }, { ifStatus: ['scheduled'] });
	if(!claim.ok){ return null; }
	let t = claim.task;
	// [S46] 跳内心跳:另一窗口启动对账时据此知道这条是活的(不把它标成中断)
	const beat = setInterval(()=>{ heartbeatTask(task.id).catch((e)=>reportBackgroundFailure('scheduler.heartbeat', e)); }, RUNNER_HEARTBEAT_MS);
	await appendLog(task.id, `定时运行(${trigger === 'catch-up' ? '补跑' : (trigger === 'manual' ? '手动' : '到点')})`);
	const run = typeof o.runner === 'function' ? o.runner : defaultRunner;
	const hopMs = hopTimeoutOf(t, o);
	const ac = new AbortController();
	registerRunning(task.id, { cancel: ()=>ac.abort() });
	let result;
	try{
		result = await withTimeout(Promise.resolve().then(()=>run(t, { now, deps: o.deps, signal: ac.signal, requestApproval: o.requestApproval, requestElicitation: o.requestElicitation })), hopMs, { code: 'E_TOOL_TIMEOUT', message: `执行超时(${Math.round(hopMs / 1000)}s)` });
	}catch(e){
		if(e && e.code === 'E_TOOL_TIMEOUT'){ ac.abort(); }
		result = { ok: false, error: e && e.message ? `${e.message}` : `${e}` };
	}finally{ clearInterval(beat); unregisterRunning(task.id); }
	result = result && typeof result === 'object' ? result : { ok: false, error: '任务没有返回结果' };
	const next = computeNextRun(t.spec && t.spec.schedule, now);
	const cur = await getTask(task.id);
	if(!cur || cur.status !== 'running'){ return cur; }   // 运行中被用户取消 → 不再改状态
	const status = next ? 'scheduled' : (result.ok ? 'done' : 'failed');
	t = await patchTask(task.id, { status, nextRunAt: next, lastRunAt: now.toISOString(), result: { ok: !!result.ok, summary: `${result.summary || result.error || ''}`.slice(0, 400), conversationId: result.conversationId || null, at: now.toISOString() } });
	await appendLog(task.id, result.ok ? `完成:${`${result.summary || ''}`.slice(0, 80)}` : `失败:${`${result.error || ''}`.slice(0, 120)}`);
	if(t.notify !== false){
		await pushNotice({ level: result.ok ? 'success' : 'warn', title: `${result.ok ? '定时任务完成' : '定时任务失败'}:${t.title}`, body: `${result.summary || result.error || ''}`.slice(0, 200), taskId: t.id, link: result.conversationId ? { conversationId: result.conversationId } : undefined }, { desktop: true });
	}
	return t;
}

// 一跳:门关=零动作;记心跳;到点任务按错过策略处理;每跳只跑一个
export async function runSchedulerTick(opts){
	const o = opts || {};
	const now = o.now instanceof Date ? o.now : (o.now ? new Date(o.now) : new Date());
	const out = { enabled: false, due: 0, ran: 0, skipped: 0, busy: false };
	if(!(o.force || schedulerGatesOpen())){ return out; }
	out.enabled = true;
	if(ticking){ out.busy = true; return out; }
	// [S1] 跨窗口租约:另一窗口正在跳(且租约未过期)→ 本跳让位
	if(!acquireLease(now.getTime(), Number(o.hopTimeoutMs) > 0 ? Number(o.hopTimeoutMs) : DEFAULT_TASK_BUDGET.maxWallMinutes * 60000)){ out.busy = true; return out; }
	ticking = true;
	try{
		const lastTickAt = readLastTickAt();
		safeLocalStorageSet(SCHEDULER_LAST_TICK_KEY, `${now.getTime()}`);
		const due = dueTasks(await listTasks({ status: ['scheduled'], kind: 'scheduled' }), now);
		out.due = due.length;
		for(let i = 0; i < due.length; i++){
			const t = due[i];
			const decision = decideMissed({ nextRunAt: t.nextRunAt, now, lastTickAt, intervalMs: SCHEDULER_TICK_INTERVAL_MS, missedPolicy: t.missedPolicy });
			if(decision === 'skip'){
				const next = computeNextRun(t.spec && t.spec.schedule, now);
				// eslint-disable-next-line no-await-in-loop
				await patchTask(t.id, { nextRunAt: next, ...(next ? {} : { status: 'done', result: { ok: true, summary: '错过且不补跑(仅一次)', at: now.toISOString() } }) });
				// eslint-disable-next-line no-await-in-loop
				await appendLog(t.id, `错过 ${fmt(t.nextRunAt)} 的运行(当时应用未开),按策略跳过${next ? `,下次 ${fmt(next)}` : ''}`);
				out.skipped += 1;
				continue;
			}
			// eslint-disable-next-line no-await-in-loop
			const done = await executeScheduledTask(t, { now, trigger: decision === 'catch-up' ? 'catch-up' : 'timer', runner: o.runner, deps: o.deps, hopTimeoutMs: o.hopTimeoutMs });
			if(done === null){ continue; }   // 另一窗口抢到了这一条 → 看下一条
			out.ran += 1;
			break;
		}
	}finally{ ticking = false; releaseLease(); }
	return out;
}

// 用户在任务中心点「立即运行」:门要开;已排期/已暂停(先回排期)的才能跑
export async function runScheduledTaskNow(taskId, opts){
	if(!schedulerGatesOpen()){ return { ok: false, code: 'E_TOOL_DISABLED' }; }
	if(ticking){ return { ok: false, code: 'E_LIMIT', busy: true }; }
	const t = await getTask(taskId);
	if(!t){ return { ok: false, code: 'E_TASK_NOT_FOUND' }; }
	if(t.kind !== 'scheduled' || t.status !== 'scheduled'){ return { ok: false, code: 'E_TASK_TRANSITION', status: t.status }; }
	if(!acquireLease(Date.now(), hopTimeoutOf(t, opts))){ return { ok: false, code: 'E_LIMIT', busy: true }; }
	ticking = true;
	try{
		const done = await executeScheduledTask(t, { ...(opts || {}), trigger: 'manual' });
		if(done === null){ return { ok: false, code: 'E_TASK_TRANSITION', status: 'running', busy: true }; }   // 另一窗口已在跑
		return { ok: true, task: done };
	}
	finally{ ticking = false; releaseLease(); }
}

// 暂停/继续(用户按钮):继续时按现在重算下次(避免暂停期间的旧 nextRunAt 立刻被判「错过」)
export async function pauseScheduledTask(taskId){ const t = await getTask(taskId); if(!t || t.status !== 'scheduled'){ return null; } await appendLog(taskId, '已暂停(不再到点运行)'); return patchTask(taskId, { status: 'paused' }); }
export async function resumeScheduledTask(taskId){
	const t = await getTask(taskId);
	if(!t || ['paused', 'interrupted'].indexOf(t.status) < 0){ return null; }
	const next = computeNextRun(t.spec && t.spec.schedule, new Date());
	if(!next){ return patchTask(taskId, { status: 'done', result: { ok: true, summary: '排期已过期(仅一次)', at: new Date().toISOString() } }); }
	await appendLog(taskId, `继续:${describeSchedule(t.spec && t.spec.schedule)},下次 ${fmt(next)}`);
	return patchTask(taskId, { status: 'scheduled', nextRunAt: next });
}

// 壳→页面接线(layouts 启动一次;照 bindAutoBackupTicks):桌面壳=挂回调+补跑 pending 最新一跳;非桌面(dev/浏览器)=同样挂回调,
// 且仅当门开时用页面 60 秒定时器兜底(缺省关=零定时器)。runner 可注入(测试)。
export function bindSchedulerTicks(options){
	if(typeof window === 'undefined'){ return false; }
	const runner = options && typeof options.runner === 'function' ? options.runner : ((tick)=>runSchedulerTick({ tick }));
	try{
		window.__horosaSchedulerTick = (tick)=>{ Promise.resolve().then(()=>runner(tick)).catch((e)=>reportBackgroundFailure('scheduler.tick', e)); };
		const pending = Array.isArray(window.__horosaPendingSchedulerTicks) ? window.__horosaPendingSchedulerTicks.splice(0) : [];
		if(pending.length){ Promise.resolve().then(()=>runner({ ...pending[pending.length - 1], pendingCount: pending.length })).catch((e)=>reportBackgroundFailure('scheduler.pending', e)); }
	}catch(e){ return false; }
	if(!isDesktopBridgeAvailable() && !(options && options.browserTimer === false) && schedulerGatesOpen() && !browserTimer){
		let seq = 0;
		browserTimer = setInterval(()=>{ seq += 1; window.__horosaSchedulerTick({ seq, at: Math.floor(Date.now() / 1000), source: 'browser' }); }, SCHEDULER_TICK_INTERVAL_MS);
	}
	return true;
}

// [D81] 非桌面 60 秒兜底定时器此前没有生产解绑出口(布局层卸载后仍跑);幂等,桌面壳下只拆回调
export function unbindSchedulerTicks(){
	if(browserTimer){ clearInterval(browserTimer); browserTimer = null; }
	if(typeof window !== 'undefined'){ try{ delete window.__horosaSchedulerTick; }catch(e){ /* noop: delete 失败改赋 undefined */ window.__horosaSchedulerTick = undefined; } }
	return true;
}

export function __resetSchedulerForTests(){
	ticking = false;
	releaseLease();
	if(browserTimer){ clearInterval(browserTimer); browserTimer = null; }
	if(typeof window !== 'undefined'){ delete window.__horosaSchedulerTick; delete window.__horosaPendingSchedulerTicks; }
}
