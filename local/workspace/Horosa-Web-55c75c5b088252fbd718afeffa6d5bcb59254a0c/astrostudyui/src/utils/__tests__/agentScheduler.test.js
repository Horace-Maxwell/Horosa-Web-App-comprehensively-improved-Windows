// 定时任务(P3)合同:排期纯函数(每天已过→明天/每周/每月 31→28 钳/仅一次过期 null/钟面 200 天不漂)· 错过判定四象限 · 调度一跳(缺省关零执行/到点只跑一个/
// skip 改期不跑/catch-up 补跑/once 跑完 done/执行体抛错→失败但保留下次)· 接线(壳回调存在/pending 只补最新一跳/非桌面且关=零定时器/桌面不起页面定时器)
// · 立即运行/暂停/继续 · 择日提醒(窗口内方案推通知)· 自定义提示词无头轮落「自动·」会话 · ZERI_SCHEME_KEYS 与注册表同构。
import { normalizeSchedule, computeNextRun, decideMissed, describeSchedule, buildScheduledPrompt, SCHEDULED_KINDS, MONTH_DAY_MAX } from '../aiAgent/tasks/schedule';
import { runSchedulerTick, bindSchedulerTicks, unbindSchedulerTicks, dueTasks, runScheduledTaskNow, pauseScheduledTask, resumeScheduledTask, SCHEDULER_LAST_TICK_KEY, __resetSchedulerForTests } from '../aiAgent/tasks/scheduler';
import { runScheduledTask, zeriRemindersDue, ZERI_SCHEME_KEYS, SCHEDULED_CONV_PREFIX } from '../aiAgent/tasks/taskKinds';
import { createTask, getTask, __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { listNotices } from '../aiAgent/tasks/noticeStore';
import { clearStore, AI_ANALYSIS_STORES, listStoreRecords } from '../aiAnalysisStore';
import { setAgentEnabled, setSchedulerEnabled } from '../aiAgent/prefs';
import { STORAGE_KEY_REGISTRY } from '../storageKeyRegistry';

const local = (y, m, d, hh, mm)=>new Date(y, m - 1, d, hh, mm, 0, 0);
const iso = (d)=>d.toISOString();
const flush = ()=>new Promise((r)=>setTimeout(r, 8));

beforeEach(async ()=>{
	window.localStorage.clear(); __resetSchedulerForTests(); __resetTaskCacheForTests();
	delete window.__TAURI_INTERNALS__; delete window.__TAURI__;
	await clearStore(AI_ANALYSIS_STORES.agentTasks); await clearStore(AI_ANALYSIS_STORES.agentNotices); await clearStore(AI_ANALYSIS_STORES.conversations); await clearStore(AI_ANALYSIS_STORES.messages);
});

describe('schedule 纯函数', ()=>{
	it('每天:今天时间已过 → 明天同钟面;未过 → 今天;每周:下一个该星期几;每月:31 钳 28,本月已过 → 下月 28', ()=>{
		expect(computeNextRun({ type: 'daily', time: '08:00' }, local(2026, 9, 5, 9, 0))).toBe(iso(local(2026, 9, 6, 8, 0)));
		expect(computeNextRun({ type: 'daily', time: '08:00' }, local(2026, 9, 5, 7, 59))).toBe(iso(local(2026, 9, 5, 8, 0)));
		expect(computeNextRun({ type: 'daily', time: '08:00' }, local(2026, 9, 5, 8, 0))).toBe(iso(local(2026, 9, 6, 8, 0)));   // 严格晚于
		expect(computeNextRun({ type: 'weekly', weekday: 1, time: '08:00' }, local(2026, 9, 5, 9, 0))).toBe(iso(local(2026, 9, 7, 8, 0)));   // 2026-09-05 周六 → 周一
		expect(normalizeSchedule({ type: 'monthly', day: 31, time: '08:00' }).day).toBe(MONTH_DAY_MAX);
		expect(computeNextRun({ type: 'monthly', day: 31, time: '08:00' }, local(2026, 9, 29, 0, 0))).toBe(iso(local(2026, 10, 28, 8, 0)));
		expect(computeNextRun({ type: 'monthly', day: 28, time: '08:00' }, local(2026, 2, 1, 0, 0))).toBe(iso(local(2026, 2, 28, 8, 0)));
		expect(computeNextRun({ type: 'monthly', day: 5, time: '08:00' }, local(2026, 12, 6, 0, 0))).toBe(iso(local(2027, 1, 5, 8, 0)));   // 跨年
	});
	it('仅一次:未来 → 原时刻;已过 → null;坏排期(时间格式/类型/weekday/day 越界)→ null;describe 文案', ()=>{
		const fut = local(2027, 1, 1, 10, 30);
		expect(computeNextRun({ type: 'once', at: iso(fut) }, local(2026, 9, 5, 0, 0))).toBe(iso(fut));
		expect(computeNextRun({ type: 'once', at: iso(local(2026, 1, 1, 0, 0)) }, local(2026, 9, 5, 0, 0))).toBe(null);
		expect(normalizeSchedule({ type: 'daily', time: '25:00' })).toBe(null);
		expect(normalizeSchedule({ type: 'daily', time: '8:00' })).toBe(null);
		expect(normalizeSchedule({ type: 'hourly', time: '08:00' })).toBe(null);
		expect(normalizeSchedule({ type: 'weekly', weekday: 7, time: '08:00' })).toBe(null);
		expect(normalizeSchedule({ type: 'monthly', day: 0, time: '08:00' })).toBe(null);
		expect(normalizeSchedule({ type: 'once', at: 'not a date' })).toBe(null);
		expect(describeSchedule({ type: 'daily', time: '08:00' })).toBe('每天 08:00');
		expect(describeSchedule({ type: 'weekly', weekday: 1, time: '08:00' })).toBe('每周一 08:00');
		expect(describeSchedule({ type: 'monthly', day: 31, time: '08:00' })).toBe('每月 28 日 08:00');
		expect(describeSchedule({ type: 'once', at: iso(fut) })).toBe('仅一次 2027-01-01 10:30');
		expect(describeSchedule(null)).toBe('排期无效');
	});
	it('🔴 钟面不漂:连续 200 天逐日推进,本地小时/分钟恒为排期值(夏令时切换也保钟面)', ()=>{
		let cur = local(2026, 3, 1, 0, 0);
		for(let i = 0; i < 200; i++){
			const next = new Date(computeNextRun({ type: 'daily', time: '08:30' }, cur));
			expect([next.getHours(), next.getMinutes()]).toEqual([8, 30]);
			expect(next.getTime()).toBeGreaterThan(cur.getTime());
			cur = next;
		}
	});
	it('错过判定四象限:到点(逾期≤2 心跳)→ run;逾期超容差 skip → skip / catch-up → catch-up;到点后有过心跳 → run;未到 → wait', ()=>{
		const now = local(2026, 9, 5, 9, 0);
		const base = { now, intervalMs: 60000 };
		expect(decideMissed({ ...base, nextRunAt: iso(new Date(now.getTime() - 30000)), missedPolicy: 'skip' })).toBe('run');
		expect(decideMissed({ ...base, nextRunAt: iso(new Date(now.getTime() - 30000)), missedPolicy: 'catch-up' })).toBe('run');
		expect(decideMissed({ ...base, nextRunAt: iso(new Date(now.getTime() - 3600000)), missedPolicy: 'skip' })).toBe('skip');
		expect(decideMissed({ ...base, nextRunAt: iso(new Date(now.getTime() - 3600000)), missedPolicy: 'catch-up' })).toBe('catch-up');
		expect(decideMissed({ ...base, nextRunAt: iso(new Date(now.getTime() - 3600000)), missedPolicy: 'skip', lastTickAt: now.getTime() - 120000 })).toBe('run');
		expect(decideMissed({ ...base, nextRunAt: iso(new Date(now.getTime() + 60000)), missedPolicy: 'skip' })).toBe('wait');
	});
	it('提示词模板:四类基础 kind 都有;custom 用原文,空则兜底', ()=>{
		// 四件基础 kind 的内容与顺序锁死;尾部允许按版本追加
		expect(SCHEDULED_KINDS.slice(0, 4)).toEqual(['daily-brief', 'monthly-fortune', 'custom-prompt', 'zeri-reminder']);
		expect(SCHEDULED_KINDS.length).toBeGreaterThanOrEqual(4);
		expect(buildScheduledPrompt({ kind: 'daily-brief' }, local(2026, 9, 5, 8, 0))).toContain('每日简报 2026-09-05');
		expect(buildScheduledPrompt({ kind: 'monthly-fortune' }, local(2026, 9, 5, 8, 0))).toContain('2026 年 9 月');
		expect(buildScheduledPrompt({ kind: 'custom-prompt', prompt: '今天开会要注意什么' })).toBe('今天开会要注意什么');
		expect(buildScheduledPrompt({ kind: 'custom-prompt', prompt: '  ' }, local(2026, 9, 5, 8, 0))).toContain('定时提示 2026-09-05');
		// [Q-400/M-145] 到点无挂载源(未挂 / 档案已删)→ 无命盘文案,不再写「请基于挂载的命盘」;不传 opts = 旧文案零回归
		const nb = buildScheduledPrompt({ kind: 'daily-brief' }, local(2026, 9, 5, 8, 0), { hasSource: false });
		expect(nb).toContain('未挂载命盘');
		expect(nb).not.toContain('请基于挂载的命盘');
		expect(buildScheduledPrompt({ kind: 'monthly-fortune' }, local(2026, 9, 5, 8, 0), { hasSource: false })).toContain('未挂载命盘');
		expect(buildScheduledPrompt({ kind: 'daily-brief' }, local(2026, 9, 5, 8, 0), { hasSource: true })).toContain('请基于挂载的命盘');
	});
});

async function mkScheduled(over){
	const now = new Date();
	return createTask({ kind: 'scheduled', status: 'scheduled', title: '每日一问', nextRunAt: new Date(now.getTime() - 30000).toISOString(), missedPolicy: 'skip', notify: true,
		spec: { kind: 'custom-prompt', schedule: { type: 'daily', time: '08:00' }, prompt: '今天注意什么' }, ...(over || {}) });
}

describe('scheduler 一跳', ()=>{
	it('🔴 缺省关(总开关/子开关任一关)→ 零执行:runner 不调、lastTickAt 不写、任务原样', async ()=>{
		const t = await mkScheduled();
		const runner = jest.fn(async ()=>({ ok: true, summary: 'x' }));
		expect(await runSchedulerTick({ runner })).toEqual({ enabled: false, due: 0, ran: 0, skipped: 0, busy: false });
		setAgentEnabled(true);
		expect((await runSchedulerTick({ runner })).enabled).toBe(false);
		expect(runner).not.toHaveBeenCalled();
		expect(window.localStorage.getItem(SCHEDULER_LAST_TICK_KEY)).toBe(null);
		expect((await getTask(t.id)).status).toBe('scheduled');
	});
	it('🔴 门开:到点任务跑一个(每跳只一个)→ 回 scheduled、lastRunAt/result/下次都在、日志「定时运行」、完成通知;第二跳再跑另一个', async ()=>{
		setAgentEnabled(true); setSchedulerEnabled(true);
		const a = await mkScheduled({ title: 'A' });
		const b = await mkScheduled({ title: 'B', nextRunAt: new Date(Date.now() - 20000).toISOString() });
		const runner = jest.fn(async (task)=>({ ok: true, summary: `done ${task.title}`, conversationId: 'conv-x' }));
		const r1 = await runSchedulerTick({ runner });
		expect(r1).toEqual({ enabled: true, due: 2, ran: 1, skipped: 0, busy: false });
		expect(Number(window.localStorage.getItem(SCHEDULER_LAST_TICK_KEY))).toBeGreaterThan(0);
		const ta = await getTask(a.id);
		expect(ta.status).toBe('scheduled');
		expect(ta.lastRunAt).toBeTruthy();
		expect(Date.parse(ta.nextRunAt)).toBeGreaterThan(Date.now());
		expect(ta.result).toEqual(expect.objectContaining({ ok: true, summary: 'done A', conversationId: 'conv-x' }));
		expect(ta.log.map((l)=>l.text).join('\n')).toContain('定时运行(到点)');
		expect((await getTask(b.id)).lastRunAt).toBe(null);
		const notices = await listNotices();
		expect(notices.some((n)=>n.level === 'success' && n.taskId === a.id && n.title.indexOf('定时任务完成') === 0)).toBe(true);
		const r2 = await runSchedulerTick({ runner });
		expect(r2.ran).toBe(1);
		expect((await getTask(b.id)).lastRunAt).toBeTruthy();
		expect(runner).toHaveBeenCalledTimes(2);
	});
	it('🔴 错过:skip → 不跑只改期(日志「跳过」);catch-up → 补跑(日志「补跑」);仅一次跑完 → done 无下次', async ()=>{
		setAgentEnabled(true); setSchedulerEnabled(true);
		const missed = new Date(Date.now() - 3600000).toISOString();
		const s = await mkScheduled({ title: 'S', nextRunAt: missed, missedPolicy: 'skip' });
		const runner = jest.fn(async ()=>({ ok: true, summary: 'ran' }));
		const r = await runSchedulerTick({ runner });
		expect(r.skipped).toBe(1); expect(r.ran).toBe(0);
		expect(runner).not.toHaveBeenCalled();
		const ts = await getTask(s.id);
		expect(Date.parse(ts.nextRunAt)).toBeGreaterThan(Date.now());
		expect(ts.log.map((l)=>l.text).join('\n')).toContain('跳过');
		window.localStorage.removeItem(SCHEDULER_LAST_TICK_KEY);
		const c = await createTask({ kind: 'scheduled', status: 'scheduled', title: 'C', nextRunAt: missed, missedPolicy: 'catch-up', spec: { kind: 'custom-prompt', schedule: { type: 'once', at: missed }, prompt: 'x' } });
		const r2 = await runSchedulerTick({ runner });
		expect(r2.ran).toBe(1);
		const tc = await getTask(c.id);
		expect(tc.status).toBe('done');
		expect(tc.nextRunAt).toBe(null);
		expect(tc.log.map((l)=>l.text).join('\n')).toContain('补跑');
	});
	it('执行体抛错 → 失败写进 result/日志/warn 通知,但仍保留下次(回 scheduled);运行中被取消 → 不再改状态', async ()=>{
		setAgentEnabled(true); setSchedulerEnabled(true);
		const t = await mkScheduled();
		const r = await runSchedulerTick({ runner: async ()=>{ throw new Error('boom'); } });
		expect(r.ran).toBe(1);
		const tt = await getTask(t.id);
		expect(tt.status).toBe('scheduled');
		expect(tt.result.ok).toBe(false);
		expect(tt.result.summary).toContain('boom');
		expect((await listNotices()).some((n)=>n.level === 'warn' && n.taskId === t.id)).toBe(true);
		const t2 = await mkScheduled({ title: 'cancel-mid' });
		const { cancelTask } = require('../aiAgent/tasks/taskStore');
		await runSchedulerTick({ runner: async (task)=>{ await cancelTask(task.id, 'user'); return { ok: true, summary: 'late' }; } });
		expect((await getTask(t2.id)).status).toBe('cancelled');
	});
	it('dueTasks 纯函数:只取 scheduled+scheduled 状态+到点,按到点先后', ()=>{
		const now = Date.now();
		const list = [
			{ id: 'later', kind: 'scheduled', status: 'scheduled', nextRunAt: new Date(now - 1000).toISOString() },
			{ id: 'earlier', kind: 'scheduled', status: 'scheduled', nextRunAt: new Date(now - 5000).toISOString() },
			{ id: 'future', kind: 'scheduled', status: 'scheduled', nextRunAt: new Date(now + 5000).toISOString() },
			{ id: 'paused', kind: 'scheduled', status: 'paused', nextRunAt: new Date(now - 5000).toISOString() },
			{ id: 'goal', kind: 'goal', status: 'scheduled', nextRunAt: new Date(now - 5000).toISOString() },
		];
		expect(dueTasks(list, now).map((t)=>t.id)).toEqual(['earlier', 'later']);
	});
});

describe('接线与用户按钮', ()=>{
	it('🔴 非桌面且门关:挂回调但零定时器;pending 多跳只补最新一跳;桌面壳(仅 __TAURI_INTERNALS__)门开也不起页面定时器', async ()=>{
		const spy = jest.spyOn(global, 'setInterval');
		const runner = jest.fn(async ()=>({}));
		window.__horosaPendingSchedulerTicks = [{ seq: 1 }, { seq: 2 }];
		expect(bindSchedulerTicks({ runner })).toBe(true);
		expect(typeof window.__horosaSchedulerTick).toBe('function');
		await flush();
		expect(runner).toHaveBeenCalledTimes(1);
		expect(runner.mock.calls[0][0]).toEqual({ seq: 2, pendingCount: 2 });
		expect(window.__horosaPendingSchedulerTicks.length).toBe(0);
		expect(spy).not.toHaveBeenCalled();
		window.__horosaSchedulerTick({ seq: 3 });
		await flush();
		expect(runner.mock.calls[1][0]).toEqual({ seq: 3 });
		// 壳侧投递脚本同构模拟:无回调入队且只留最新 1 条(main.rs scheduler_tick_script 的 q.length>1)
		__resetSchedulerForTests();
		const script = (p)=>`(function(){var t=${JSON.stringify(p)};if(typeof window.__horosaSchedulerTick==='function'){try{window.__horosaSchedulerTick(t);}catch(e){}}else{var q=window.__horosaPendingSchedulerTicks=window.__horosaPendingSchedulerTicks||[];q.push(t);if(q.length>1){q.splice(0,q.length-1);}}})();`;
		for(let i = 0; i < 5; i++){ window.eval(script({ seq: 10 + i })); }
		expect(window.__horosaPendingSchedulerTicks).toEqual([{ seq: 14 }]);
		// 桌面壳 + 门开:不起页面定时器(心跳来自壳)
		__resetSchedulerForTests();
		window.__TAURI_INTERNALS__ = { invoke: jest.fn(async ()=>({})) };
		setAgentEnabled(true); setSchedulerEnabled(true);
		bindSchedulerTicks({ runner });
		expect(spy).not.toHaveBeenCalled();
		// 非桌面 + 门开:兜底页面定时器(dev 用)
		__resetSchedulerForTests(); delete window.__TAURI_INTERNALS__;
		bindSchedulerTicks({ runner });
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});
	it('立即运行:门关 → E_TOOL_DISABLED;门开 → 跑(日志「手动」);暂停 → paused;继续 → scheduled 且下次按现在重算', async ()=>{
		const t = await mkScheduled();
		const runner = jest.fn(async ()=>({ ok: true, summary: 'manual ok' }));
		expect((await runScheduledTaskNow(t.id, { runner })).code).toBe('E_TOOL_DISABLED');
		setAgentEnabled(true); setSchedulerEnabled(true);
		const r = await runScheduledTaskNow(t.id, { runner });
		expect(r.ok).toBe(true);
		expect(runner).toHaveBeenCalledTimes(1);
		expect(r.task.log.map((l)=>l.text).join('\n')).toContain('定时运行(手动)');
		expect((await pauseScheduledTask(t.id)).status).toBe('paused');
		expect((await runScheduledTaskNow(t.id, { runner })).code).toBe('E_TASK_TRANSITION');
		const resumed = await resumeScheduledTask(t.id);
		expect(resumed.status).toBe('scheduled');
		expect(Date.parse(resumed.nextRunAt)).toBeGreaterThan(Date.now());
	});
});

describe('taskKinds 执行体', ()=>{
	it('择日提醒:窗口内(今天..今天+N)的方案推通知,窗口外不推;十家键与注册表同构', async ()=>{
		const now = new Date(2026, 8, 5, 9, 0);
		const ymd = (d)=>{ const p = (n)=>(n < 10 ? '0' : '') + n; return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
		const inWin = ymd(new Date(2026, 8, 8)); const outWin = ymd(new Date(2026, 8, 30)); const past = ymd(new Date(2026, 8, 1));
		const read = (key)=>(key === 'horosa.zeri.bazi.schemes.v1' ? { schemes: [{ id: 'a', name: '开业', config: { cfg: { startDate: inWin } } }, { id: 'b', name: '搬家', config: { cfg: { startDate: outWin } } }, { id: 'c', name: '旧', config: { cfg: { startDate: past } } }] } : null);
		const hits = zeriRemindersDue({ now, daysAhead: 7, read });
		expect(hits).toEqual([{ family: '八字', key: 'horosa.zeri.bazi.schemes.v1', id: 'a', name: '开业', startDate: inWin }]);
		const registered = STORAGE_KEY_REGISTRY.map((e)=>e.key).filter(Boolean);
		ZERI_SCHEME_KEYS.forEach(([, key])=>expect(registered).toContain(key));
		const t = await createTask({ kind: 'scheduled', status: 'scheduled', title: '择日提醒', spec: { kind: 'zeri-reminder', daysAhead: 7 } });
		const r = await runScheduledTask(t, { now, deps: { readStorage: read } });
		expect(r.ok).toBe(true);
		expect(r.summary).toContain('开业');
		expect((await listNotices()).some((n)=>n.title === '择日方案到期提醒' && n.body.indexOf('开业') >= 0)).toBe(true);
		const r0 = await runScheduledTask(t, { now, deps: { readStorage: ()=>null } });
		expect(r0.ok).toBe(true);
		expect(r0.summary).toContain('没有到期');
	});
	it('🔴 自定义提示词:一次无头轮落到「自动·<标题>·日期」新会话,userText=提示词,origin=scheduled,返回 conversationId;无档案 → 失败', async ()=>{
		const profile = { id: 'p1', name: 'P', providerType: 'openai', protocolFamily: 'openai', baseUrl: 'http://x', apiKey: 'k', providerOptions: {} };
		const t = await createTask({ kind: 'scheduled', status: 'scheduled', title: '每日一问', spec: { kind: 'custom-prompt', schedule: { type: 'daily', time: '08:00' }, prompt: '今天注意什么' } });
		const runHeadlessTurn = jest.fn(async (args)=>({ content: '宜静不宜动', error: null, usage: null }));
		const r = await runScheduledTask(t, { now: new Date(2026, 8, 5, 8, 0), deps: { resolved: { profile, model: 'm' }, runHeadlessTurn } });
		expect(r.ok).toBe(true);
		expect(r.summary).toBe('宜静不宜动');
		expect(runHeadlessTurn).toHaveBeenCalledTimes(1);
		const call = runHeadlessTurn.mock.calls[0][0];
		expect(call.userText).toBe('今天注意什么');
		expect(call.origin).toBe('scheduled');
		expect(call.taskId).toBe(t.id);
		expect(call.conversationId).toBe(r.conversationId);
		const convs = await listStoreRecords(AI_ANALYSIS_STORES.conversations);
		const conv = convs.find((c)=>c.id === r.conversationId);
		expect(conv.title).toBe(`${SCHEDULED_CONV_PREFIX}每日一问·2026-09-05`);
		expect(conv.meta).toEqual({ taskId: t.id, kind: 'scheduled', scheduledKind: 'custom-prompt' });
		const bad = await runScheduledTask(t, { deps: { resolveHeadlessProfile: async ()=>null } });
		expect(bad.ok).toBe(false);
		expect(bad.error).toContain('接口配置');
	});
});

// [D81] 非桌面 60 秒兜底定时器此前没有生产解绑出口(布局层卸载后仍跑)
it('🔴 [D81] unbindSchedulerTicks:拆回调 + 清兜底定时器;再 bind 可重新挂上', ()=>{
	__resetSchedulerForTests();
	const runner = jest.fn(async ()=>({ ran: 0 }));
	expect(bindSchedulerTicks({ runner })).toBe(true);
	expect(typeof window.__horosaSchedulerTick).toBe('function');
	expect(unbindSchedulerTicks()).toBe(true);
	expect(window.__horosaSchedulerTick).toBeUndefined();
	expect(unbindSchedulerTicks()).toBe(true);   // 幂等
	expect(bindSchedulerTicks({ runner })).toBe(true);
	expect(typeof window.__horosaSchedulerTick).toBe('function');
	__resetSchedulerForTests();
});
