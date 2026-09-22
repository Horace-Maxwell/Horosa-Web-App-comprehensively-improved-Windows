// [D2] 定时任务调度器·并发与收口(先红后绿)。合同/判别向量:
//   S1 🔴 双窗口同任务只跑一次 —— 两个页面实例(各自的模块级 ticking)对同一份库同时起跳,
//        到点任务必须被抢占式地只执行一次(现在两边都抢到,同一任务跑两遍、日志两条「定时运行」)。
//   S2 🔴 一跳超时释放 ticking —— 执行体挂死时 runSchedulerTick 永不返回、ticking 永远为真,
//        此后每一跳都 busy:true = 调度器整机死锁(现在既无超时也无 AbortController)。
//   S3 catch-up 补跑只补最近一次 —— 落后 30 天的任务补跑一次后 nextRunAt 前移到将来,后续跳零执行。
//   S4 🔴 运行中取消 → 执行体收得到 abort —— 执行体拿到的 ctx 里必须有 signal,cancelTask 后立即 aborted
//        (现在 ctx 只有 { now, deps, requestApproval, requestElicitation },执行体一路跑到底)。
//   S5 🔴 patchTaskIf CAS —— 抢跑要靠「按状态比较并交换」的单事务原语,taskStore 现在没有这个出口。
// 纪律:双窗口用 helpers/agentFakes.twoTabs()(同一 fake-indexeddb + 两份隔离模块);用例只用产品 API 落键。
import { runSchedulerTick, __resetSchedulerForTests } from '../aiAgent/tasks/scheduler';
import * as taskStoreMod from '../aiAgent/tasks/taskStore';
import { createTask, getTask, cancelTask, __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { clearStore, AI_ANALYSIS_STORES } from '../aiAnalysisStore';
import { setAgentEnabled, setSchedulerEnabled } from '../aiAgent/prefs';
import { twoTabs, delay } from './helpers/agentFakes';

const DAY = 24 * 3600 * 1000;
const scheduledSpec = (over)=>({
	kind: 'scheduled', status: 'scheduled', title: '每日一问', missedPolicy: 'skip', notify: false,
	nextRunAt: new Date(Date.now() - 30000).toISOString(),
	spec: { kind: 'custom-prompt', schedule: { type: 'daily', time: '08:00' }, prompt: '今天注意什么' },
	...(over || {}),
});
const logCount = (task, needle)=>(task.log || []).filter((l)=>`${l.text || ''}`.indexOf(needle) >= 0).length;

beforeEach(async ()=>{
	window.localStorage.clear();
	__resetSchedulerForTests(); __resetTaskCacheForTests();
	delete window.__TAURI_INTERNALS__; delete window.__TAURI__;
	await clearStore(AI_ANALYSIS_STORES.agentTasks); await clearStore(AI_ANALYSIS_STORES.agentNotices);
	await clearStore(AI_ANALYSIS_STORES.conversations); await clearStore(AI_ANALYSIS_STORES.messages);
	setAgentEnabled(true); setSchedulerEnabled(true);
});
afterEach(()=>{ __resetSchedulerForTests(); });

describe('D2 · 双窗口', ()=>{
	it('🔴 S1 两个窗口同时起跳:同一到点任务只跑一次,「定时运行」日志恰 1 条', async ()=>{
		// 当前红:scheduler.js:15 的 ticking 是模块级(每个页面各一份),抢跑判据只在本进程内有效;
		// executeScheduledTask 又用 patchTask 无条件写 running(running→running 合法迁移),
		// 两个窗口都判自己抢到 → 同一定时任务被跑两遍(计划批一 #9:patchTaskIf CAS + 租约键)。
		const tabs = twoTabs();
		try{
			// 自证:两窗口是不同实例(各自的 ticking)且看得见同一份库
			expect(tabs.a.scheduler === tabs.b.scheduler).toBe(false);
			const created = await tabs.a.taskStore.createTask(scheduledSpec({ title: '双窗口' }));
			expect((await tabs.b.taskStore.getTask(created.id)).title).toBe('双窗口');
			const runner = jest.fn(async ()=>{ await delay(20); return { ok: true, summary: '跑完了' }; });
			const [ra, rb] = await Promise.all([
				tabs.a.scheduler.runSchedulerTick({ runner }),
				tabs.b.scheduler.runSchedulerTick({ runner }),
			]);
			expect(runner).toHaveBeenCalledTimes(1);
			expect(ra.ran + rb.ran).toBe(1);
			const after = await tabs.a.taskStore.getTask(created.id);
			expect(logCount(after, '定时运行')).toBe(1);
		}finally{ tabs.restore(); }
	});
});

describe('D2 · 一跳的收口', ()=>{
	it('🔴 S2 执行体挂死:一跳按超时收口并释放 ticking,后续跳不再 busy', async ()=>{
		// 当前红:scheduler.js:95 直接 await executeScheduledTask,既没有超时也没有 AbortController;
		// finally{ ticking=false } 永远等不到 → 之后每一跳都直接 { busy:true } 返回(计划批一 #9)。
		await createTask(scheduledSpec({ title: '挂死' }));
		const runner = jest.fn(()=>new Promise(()=>{}));   // 永不 settle
		const hung = runSchedulerTick({ runner, hopTimeoutMs: 60 });
		hung.catch(()=>{});
		await delay(30);
		expect(runner).toHaveBeenCalledTimes(1);   // 自证:这一跳确实进了执行体(不是 due=0 秒回)
		const first = await Promise.race([hung.then(()=>'settled'), delay(400).then(()=>'hung')]);
		expect(first).toBe('settled');
		const second = await runSchedulerTick({ runner: jest.fn(async ()=>({ ok: true, summary: 'x' })) });
		expect(second.busy).toBe(false);
	});

	it('S3 落后 30 天的 catch-up 任务只补跑一次,之后各跳零执行', async ()=>{
		const t = await createTask(scheduledSpec({ title: '补跑', missedPolicy: 'catch-up', nextRunAt: new Date(Date.now() - 30 * DAY).toISOString() }));
		const runner = jest.fn(async ()=>({ ok: true, summary: 'ran' }));
		const r1 = await runSchedulerTick({ runner });
		const r2 = await runSchedulerTick({ runner });
		const r3 = await runSchedulerTick({ runner });
		expect(r1.ran).toBe(1);
		expect(r2.ran + r3.ran).toBe(0);
		expect(runner).toHaveBeenCalledTimes(1);
		const after = await getTask(t.id);
		expect(Date.parse(after.nextRunAt)).toBeGreaterThan(Date.now());
		expect(logCount(after, '补跑')).toBe(1);
	});

	it('🔴 S4 运行中被取消:执行体的 ctx.signal 必须变成 aborted', async ()=>{
		// 当前红:scheduler.js:53 给执行体的 ctx 是 { now, deps, requestApproval, requestElicitation },
		// 没有 signal;调度器也没往 taskRegistry 登记控制器 → cancelTask 掐不动在跑的这一跳
		// (计划批一 #9 一跳 AbortController + taskKinds.js:106 透传 signal)。
		const t = await createTask(scheduledSpec({ title: '取消' }));
		let seen = null;
		const runner = jest.fn(async (task, ctx)=>{
			seen = ctx;
			await cancelTask(task.id, 'user');
			await delay(20);
			return { ok: true, summary: '取消后才回来' };
		});
		await runSchedulerTick({ runner });
		expect(runner).toHaveBeenCalledTimes(1);
		expect(Boolean(seen && seen.signal)).toBe(true);
		expect(Boolean(seen && seen.signal && seen.signal.aborted)).toBe(true);
		expect((await getTask(t.id)).status).toBe('cancelled');
	});
});

describe('D2 · CAS 原语', ()=>{
	it('🔴 S5 taskStore.patchTaskIf:按状态比较并交换,并发只有一个赢家', async ()=>{
		// 当前红:taskStore.js 只有无条件 patchTask(读-改-写两段式),没有 patchTaskIf 出口;
		// 抢跑因此只能靠进程内的布尔量(计划批一 #9)。
		// 用顶层 import 的那份(twoTabs 会 jest.resetModules,再 require 会拿到另一个世界的实例)
		expect(typeof taskStoreMod.patchTaskIf).toBe('function');
		const t = await createTask(scheduledSpec({ title: 'CAS' }));
		const [x, y] = await Promise.all([
			taskStoreMod.patchTaskIf(t.id, { status: 'running' }, { ifStatus: 'scheduled' }),
			taskStoreMod.patchTaskIf(t.id, { status: 'running' }, { ifStatus: 'scheduled' }),
		]);
		const won = [x, y].filter((r)=>r && r.ok);
		expect(won.length).toBe(1);
		expect((await getTask(t.id)).status).toBe('running');
	});
});
