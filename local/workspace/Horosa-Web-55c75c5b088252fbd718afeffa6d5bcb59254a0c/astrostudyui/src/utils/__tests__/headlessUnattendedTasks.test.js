// 无头常驻服务的无人值守任务合同:
//   ① 工具面 = 只读件 + 提议件(propose_*);直接写入在注册表层拒,界面件不出现;
//   ② 审批只放行提议件;反问通道不给;
//   ③ 要调模型的任务须无头分析出口开着(择日到期提醒不调模型,不受限);
//   ④ 调度一跳(与桌面同一函数)跑到点任务:结果落库、排下一次;错过按任务策略跳过或补跑;
//   ⑤ 目标任务按无人值守 deps 起跑:模型拿到的是同一张只读 + 提议注册表,审批只放行提议,没有反问;
//   ⑥ 外部客户端建的任务在无头里提示用终端命令放行。
import { unattendedRegistry, approveProposalsOnly, unattendedModelGate, runUnattendedScheduledTask, unattendedGoalDeps, UNATTENDED_DENY_MESSAGE } from '../aiAgent/tasks/unattended';
import { runSchedulerTick, __resetSchedulerForTests, SCHEDULER_LAST_TICK_KEY } from '../aiAgent/tasks/scheduler';
import { createTask, getTask, __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { startGoalTask, createGoalTask, __resetGoalRunnerForTests } from '../aiAgent/goalRunner';
import { __resetTaskRegistryForTests } from '../aiAgent/tasks/taskRegistry';
import { clearStore, AI_ANALYSIS_STORES } from '../aiAnalysisStore';
import { setAgentEnabled, setSchedulerEnabled, setHeadlessEnabled, setGoalEnabled } from '../aiAgent/prefs';
import { registerBuiltinTools } from '../aiTools';
import { runTool, listTools } from '../aiTools/registry';
import { recordToolCapability } from '../aiAgent/caps';

const profile = { id: 'p1', name: 'P', providerType: 'openai', protocolFamily: 'openai', baseUrl: 'http://x', apiKey: 'k', providerOptions: {} };
const resolved = { profile, model: 'm' };
const local = (y, m, d, hh, mm)=>new Date(y, m - 1, d, hh, mm, 0, 0);

beforeEach(async ()=>{
	window.localStorage.clear(); __resetSchedulerForTests(); __resetTaskCacheForTests(); __resetGoalRunnerForTests(); __resetTaskRegistryForTests();
	delete globalThis.__HOROSA_HEADLESS_STORE__;
	await clearStore(AI_ANALYSIS_STORES.agentTasks); await clearStore(AI_ANALYSIS_STORES.agentNotices); await clearStore(AI_ANALYSIS_STORES.conversations); await clearStore(AI_ANALYSIS_STORES.messages);
	setAgentEnabled(true);
	registerBuiltinTools();
});
afterEach(()=>{ delete globalThis.__HOROSA_HEADLESS_STORE__; });

describe('① 工具面:只读 + 提议', ()=>{
	it('manifest 只有只读件与 propose_*;建档 / 改设置 / 建任务 / 界面件都不在;直呼写入件被拒', async ()=>{
		const reg = await unattendedRegistry();
		const names = reg.exportToolManifest({}).map((t)=>t.name);
		expect(names).toEqual(expect.arrayContaining(['list_records', 'cast_technique', 'propose_record_edit', 'propose_memory']));
		['create_chart_record', 'set_settings', 'schedule_task', 'create_goal_task', 'navigate_to_technique', 'append_record_journal'].forEach((n)=>expect(names).not.toContain(n));
		const all = listTools();
		names.forEach((n)=>{ const d = all.find((x)=>x.name === n); expect(d.level === 'read' || n.indexOf('propose_') === 0).toBe(true); });
		const r = await reg.runTool('create_chart_record', { name: 'x', birth: '2000-01-01 12:00' }, { origin: 'scheduled' });
		expect([r.ok, r.code, r.message]).toEqual([false, 'E_APPROVAL_DENIED', UNATTENDED_DENY_MESSAGE]);
	});
});

describe('② 审批与 ③ 模型门', ()=>{
	it('审批只放行提议件', async ()=>{
		expect(await approveProposalsOnly({ name: 'propose_record_edit' })).toBe(true);
		expect(await approveProposalsOnly({ name: 'create_chart_record' })).toBe(false);
		expect(await approveProposalsOnly({ name: 'web_search' })).toBe(false);
		expect(await approveProposalsOnly(null)).toBe(false);
	});
	it('出口关:调模型的任务不跑、给终端命令;择日到期提醒照跑;出口开:放行', async ()=>{
		setHeadlessEnabled(false);
		expect(unattendedModelGate({ kind: 'scheduled', spec: { kind: 'daily-brief' } })).toContain('./horosa config headless-analysis on');
		expect(unattendedModelGate({ kind: 'goal', spec: {} })).toContain('headless-analysis');
		expect(unattendedModelGate({ kind: 'scheduled', spec: { kind: 'zeri-reminder' } })).toBe(null);
		const r = await runUnattendedScheduledTask({ id: 't', kind: 'scheduled', spec: { kind: 'custom-prompt', prompt: 'x' } }, {});
		expect([r.ok, /headless-analysis/.test(r.error)]).toEqual([false, true]);
		setHeadlessEnabled(true);
		expect(unattendedModelGate({ kind: 'scheduled', spec: { kind: 'daily-brief' } })).toBe(null);
	});
});

describe('④ 调度一跳(无人值守执行体)', ()=>{
	beforeEach(()=>{ setSchedulerEnabled(true); setHeadlessEnabled(true); });
	const runnerWith = (turn)=>(t, ctx)=>runUnattendedScheduledTask(t, { ...ctx, deps: { resolved, runHeadlessTurn: turn } });

	it('到点:模型拿到只读 + 提议注册表、审批只放行提议、没有反问;结果落库并排下一次', async ()=>{
		const now = local(2026, 11, 20, 8, 0);
		const t = await createTask({ kind: 'scheduled', status: 'scheduled', title: '每日', nextRunAt: local(2026, 11, 20, 8, 0).toISOString(), missedPolicy: 'skip', spec: { kind: 'custom-prompt', prompt: '今日一句', schedule: { type: 'daily', time: '08:00' } } });
		const turn = jest.fn(async ()=>({ content: '宜静', error: null }));
		const out = await runSchedulerTick({ now, runner: runnerWith(turn) });
		expect([out.enabled, out.due, out.ran]).toEqual([true, 1, 1]);
		const a = turn.mock.calls[0][0];
		expect(a.registry && a.registry.readOnly).toBe(true);
		expect(a.requestElicitation).toBeUndefined();
		expect(await a.requestApproval({ name: 'propose_memory' })).toBe(true);
		expect(await a.requestApproval({ name: 'create_chart_record' })).toBe(false);
		const after = await getTask(t.id);
		expect(after.status).toBe('scheduled');
		expect(after.nextRunAt).toBe(local(2026, 11, 21, 8, 0).toISOString());
		expect([after.result.ok, after.result.summary]).toEqual([true, '宜静']);
	});

	it('错过(停机期间没有心跳、逾期超容差):skip 改期不跑;catch-up 补跑一次', async ()=>{
		const now = local(2026, 11, 20, 12, 0);
		window.localStorage.setItem(SCHEDULER_LAST_TICK_KEY, `${local(2026, 11, 19, 23, 0).getTime()}`);
		const due = local(2026, 11, 20, 8, 0).toISOString();
		const sk = await createTask({ kind: 'scheduled', status: 'scheduled', title: 'S', nextRunAt: due, missedPolicy: 'skip', spec: { kind: 'custom-prompt', prompt: 'a', schedule: { type: 'daily', time: '08:00' } } });
		const turn = jest.fn(async ()=>({ content: 'ok', error: null }));
		const r1 = await runSchedulerTick({ now, runner: runnerWith(turn) });
		expect([r1.skipped, r1.ran]).toEqual([1, 0]);
		expect((await getTask(sk.id)).nextRunAt).toBe(local(2026, 11, 21, 8, 0).toISOString());
		window.localStorage.setItem(SCHEDULER_LAST_TICK_KEY, `${local(2026, 11, 19, 23, 0).getTime()}`);
		const cu = await createTask({ kind: 'scheduled', status: 'scheduled', title: 'C', nextRunAt: due, missedPolicy: 'catch-up', spec: { kind: 'custom-prompt', prompt: 'b', schedule: { type: 'daily', time: '08:00' } } });
		__resetSchedulerForTests();
		const r2 = await runSchedulerTick({ now, runner: runnerWith(turn) });
		expect(r2.ran).toBe(1);
		expect((await getTask(cu.id)).result.ok).toBe(true);
	});

	it('定时任务开关关 = 一跳零动作', async ()=>{
		setSchedulerEnabled(false);
		await createTask({ kind: 'scheduled', status: 'scheduled', title: 'X', nextRunAt: local(2026, 11, 20, 8, 0).toISOString(), spec: { kind: 'custom-prompt', prompt: 'x', schedule: { type: 'daily', time: '08:00' } } });
		const turn = jest.fn();
		expect((await runSchedulerTick({ now: local(2026, 11, 20, 8, 0), runner: runnerWith(turn) })).enabled).toBe(false);
		expect(turn).not.toHaveBeenCalled();
	});
});

describe('⑤ 目标任务按无人值守 deps 起跑', ()=>{
	it('模型轮拿到同一张只读 + 提议注册表;审批只放行提议;没有反问通道', async ()=>{
		setGoalEnabled(true); setHeadlessEnabled(true); recordToolCapability('p1', 'm', true);
		const t = await createGoalTask({ goal: 'G', budget: { maxTurns: 1 } }, { sourceCid: null, techniques: [] });
		const seen = [];
		const createAgentTurn = jest.fn((o)=>{ seen.push(o); return { enabled: false, beginRound(){}, messagesForRound: (m)=>m, toolDefs: ()=>undefined, toolChoice: ()=>undefined, onEvent(){}, needsAnotherRound: ()=>false, async settleRound(){ return false; }, finish: ()=>null, trace: ()=>null }; });
		const stream = jest.fn(async (v, h)=>{ h.onEvent({ type: 'delta', json: { delta: '已达成' } }); h.onEvent({ type: 'done', json: {} }); });
		const judge = jest.fn(async ()=>({ Result: { content: JSON.stringify({ status: 'done' }) } }));
		const deps = await unattendedGoalDeps({ resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: judge, createAgentTurn });
		await startGoalTask(t.id, deps);
		expect(seen.length).toBeGreaterThan(0);
		expect(seen[0].registry).toBe(deps.registry);
		expect(seen[0].registry.readOnly).toBe(true);
		expect(seen[0].requestElicitation).toBeUndefined();
		expect(await seen[0].requestApproval({ name: 'propose_record_edit' })).toBe(true);
		expect(await seen[0].requestApproval({ name: 'create_chart_record' })).toBe(false);
	});
});

describe('⑥ 外部客户端建的任务在无头里提示终端命令放行', ()=>{
	it('schedule_task / create_goal_task 的回话带 ./horosa tasks resume|start <id>', async ()=>{
		setSchedulerEnabled(true); setGoalEnabled(true);
		globalThis.__HOROSA_HEADLESS_STORE__ = {};
		const s = await runTool('schedule_task', { kind: 'custom-prompt', prompt: 'x', schedule: { type: 'daily', time: '08:00' } }, { origin: 'mcp', requestId: 'r1' });
		expect(s.ok).toBe(true);
		expect(s.message).toContain(`./horosa tasks resume ${s.data.taskId}`);
		const g = await runTool('create_goal_task', { goal: '建档' }, { origin: 'mcp', requestId: 'r2' });
		expect(g.ok).toBe(true);
		expect(g.message).toContain(`./horosa tasks start ${g.data.taskId}`);
	});
});
