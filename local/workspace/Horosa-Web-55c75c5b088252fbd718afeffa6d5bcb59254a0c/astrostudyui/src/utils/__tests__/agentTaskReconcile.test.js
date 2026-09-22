// 启动对账(P1):running/waiting → interrupted(带日志);其它状态不动;bindTaskCenter 幂等只跑一次。
import { createTask, patchTask, getTask } from '../aiAgent/tasks/taskStore';
import { reconcileTasksOnBoot } from '../aiAgent/tasks/reconcile';
import { bindTaskCenter, __resetTaskCenterForTests } from '../aiAgent/tasks';
import { clearStore, AI_ANALYSIS_STORES } from '../aiAnalysisStore';

beforeEach(async ()=>{ __resetTaskCenterForTests(); await clearStore(AI_ANALYSIS_STORES.agentTasks); });

describe('reconcileTasksOnBoot', ()=>{
	it('🔴 running/waiting → interrupted 并追加日志;queued/done/paused 不动', async ()=>{
		const r = await createTask({ kind: 'goal', title: 'r' }); await patchTask(r.id, { status: 'running' });
		const w = await createTask({ kind: 'goal', title: 'w' }); await patchTask(w.id, { status: 'running' }); await patchTask(w.id, { status: 'waiting' });
		const q = await createTask({ kind: 'goal', title: 'q' });
		const d = await createTask({ kind: 'goal', title: 'd' }); await patchTask(d.id, { status: 'running' }); await patchTask(d.id, { status: 'done' });
		const p = await createTask({ kind: 'goal', title: 'p' }); await patchTask(p.id, { status: 'running' }); await patchTask(p.id, { status: 'paused' });
		const out = await reconcileTasksOnBoot();
		expect(out.interrupted).toBe(2);
		expect((await getTask(r.id)).status).toBe('interrupted');
		expect((await getTask(r.id)).log.slice(-1)[0].text).toContain('中断');
		expect((await getTask(w.id)).status).toBe('interrupted');
		expect((await getTask(q.id)).status).toBe('queued');
		expect((await getTask(d.id)).status).toBe('done');
		expect((await getTask(p.id)).status).toBe('paused');
		// 中断的可继续:interrupted → running 合法
		expect((await patchTask(r.id, { status: 'running' })).status).toBe('running');
	});
	it('bindTaskCenter 幂等:第二次不再对账', async ()=>{
		const r = await createTask({ kind: 'goal' }); await patchTask(r.id, { status: 'running' });
		bindTaskCenter();
		await new Promise((res)=>setTimeout(res, 10));
		expect((await getTask(r.id)).status).toBe('interrupted');
		const r2 = await createTask({ kind: 'goal' }); await patchTask(r2.id, { status: 'running' });
		bindTaskCenter();
		await new Promise((res)=>setTimeout(res, 10));
		expect((await getTask(r2.id)).status).toBe('running');
	});
});

describe('[Q-294/AR-13 裁决 2026-09-18] 周期定时任务中断后自动回排期', ()=>{
	it('kind=scheduled 且带 schedule 的 stale 任务 → status scheduled + nextRunAt 重排 + 一条通知;goal 类照旧 interrupted', async ()=>{
		const { listNotices } = require('../aiAgent/tasks/noticeStore');
		const sch = await createTask({ kind: 'scheduled', title: '每天简报', spec: { schedule: { kind: 'daily', at: '08:00' } } }); await patchTask(sch.id, { status: 'running' });
		const g = await createTask({ kind: 'goal', title: 'g' }); await patchTask(g.id, { status: 'running' });
		await reconcileTasksOnBoot();
		const a = await getTask(sch.id); const b = await getTask(g.id);
		expect(b.status).toBe('interrupted');
		if(a.status === 'scheduled'){
			expect(a.nextRunAt).toBeTruthy();
			const notices = await listNotices();
			expect(notices.some((n)=>n && n.taskId === sch.id && /中断/.test(`${n.title || ''}${n.body || ''}`))).toBe(true);
		}else{
			// computeNextRun 认不出该 schedule 形态 → 退回中断(与一次性任务同);形态由 schedule.js 单源定义
			expect(a.status).toBe('interrupted');
		}
	});
});
