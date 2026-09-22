// 启动对账(P1):上次运行时还在 running/waiting 的任务在本次启动时已无控制器 → 标 interrupted(可从任务中心继续/取消)。
// 与 ReportPane 的孤儿报告实例逻辑同理;只改状态不改内容。
// [压测二轮·S46] 多窗口:另一个窗口正在跑(runner.owner ≠ 本窗口且心跳未过期)的任务**不**中断——
//   此前第二个窗口一开就把第一个窗口手里的定时任务标成中断,首窗口跑完写不回排期。同一标签页刷新前留下的(owner 就是本窗口)照旧中断。
//   心跳可能只是暂时新鲜(对方窗口刚死):RUNNER_STALE_MS 后再查一遍。
import { listTasks, patchTask, runnerAliveElsewhere, RUNNER_STALE_MS } from './taskStore';
import { computeNextRun } from './schedule';
import { pushNotice } from './noticeStore';
import { reportBackgroundFailure } from '../bgSink';

let recheckTimer = null;
export async function reconcileTasksOnBoot(opts){
	const o = opts || {};
	const now = Date.now();
	const stale = (await listTasks({ status: ['running', 'waiting'] })).filter((t)=>!runnerAliveElsewhere(t, now));
	if(!o.recheck && typeof setTimeout === 'function'){
		if(recheckTimer){ clearTimeout(recheckTimer); }
		recheckTimer = setTimeout(()=>{ recheckTimer = null; reconcileTasksOnBoot({ recheck: true }).catch((e)=>reportBackgroundFailure('tasks.recheck', e)); }, RUNNER_STALE_MS + 5000);
	}
	let n = 0;
	for(let i = 0; i < stale.length; i++){
		const t = stale[i];
		try{
			// [Q-294/AR-13 裁决 2026-09-18] 周期定时任务:中断后不再卡在 interrupted(此后每天都不跑,直到用户点「继续」)→
			// 自动回 scheduled 并按排期重排下一次(本次按 missedPolicy 由调度器处理),推一条「上次运行被中断」通知;一次性任务维持中断待处理。
			const nextRun = (t.kind === 'scheduled' && t.spec && t.spec.schedule) ? computeNextRun(t.spec.schedule, new Date()) : null;
			if(nextRun){
				// eslint-disable-next-line no-await-in-loop
				await patchTask(t.id, { status: 'scheduled', nextRunAt: nextRun, log: t.log.concat({ at: new Date().toISOString(), text: '应用重启时仍在运行 → 本次中断;已自动重排下一次' }) });
				// eslint-disable-next-line no-await-in-loop
				try{ await pushNotice({ level: 'warn', title: '定时任务上次运行被中断', body: `${t.title || t.id}:应用关闭 / 刷新时仍在运行,已按排期自动重排下一次`, taskId: t.id }); }catch(e){ /* noop: 通知失败不阻断 */ }
			}else{
				// eslint-disable-next-line no-await-in-loop
				await patchTask(t.id, { status: 'interrupted', log: t.log.concat({ at: new Date().toISOString(), text: '应用重启时仍在运行 → 标记中断(可继续或取消)' }) });
			}
			n += 1;
		}catch(e){ reportBackgroundFailure('tasks.reconcile-patch', e); }   // 单条失败不阻断,但留痕
	}
	return { interrupted: n };
}

export function __resetReconcileForTests(){ if(recheckTimer){ clearTimeout(recheckTimer); recheckTimer = null; } }
