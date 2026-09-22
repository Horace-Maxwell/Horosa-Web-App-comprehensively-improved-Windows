// [批三⑤] 并行目标合同:缺省 0=现状(第二条立刻起跑);上限 1 → 第二条保持 queued 且不发请求,第一条结束自动接力起第二条;上限 2 → 两条同时跑;startAllQueuedGoals 受上限约束;键归一 1..3。
import { startGoalTask, createGoalTask, isGoalLoopRunning, startAllQueuedGoals, __resetGoalRunnerForTests } from '../aiAgent/goalRunner';
import { listRunningIds } from '../aiAgent/tasks/taskRegistry';
import { getTask, __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { __resetTaskRegistryForTests } from '../aiAgent/tasks/taskRegistry';
import { __resetApprovalsForTests } from '../aiAgent/approvals';
import { clearStore, AI_ANALYSIS_STORES, __resetInFlightMessagesForTests } from '../aiAnalysisStore';
import { setAgentEnabled, setGoalEnabled, getGoalParallel, setGoalParallel, AGENT_GOAL_PARALLEL_KEY } from '../aiAgent/prefs';
import { recordToolCapability } from '../aiAgent/caps';
import { fakeStreamScript, fakeJudgeScript, delay } from './helpers/agentFakes';

const profile = { id: 'p1', name: 'P', providerType: 'openai', protocolFamily: 'openai', baseUrl: 'http://x', apiKey: 'k', providerOptions: {} };
const resolved = { profile, model: 'm' };
beforeEach(async ()=>{
	window.localStorage.clear();
	__resetGoalRunnerForTests(); __resetTaskRegistryForTests(); __resetTaskCacheForTests(); __resetApprovalsForTests(); __resetInFlightMessagesForTests();
	await clearStore(AI_ANALYSIS_STORES.agentTasks); await clearStore(AI_ANALYSIS_STORES.agentNotices); await clearStore(AI_ANALYSIS_STORES.conversations); await clearStore(AI_ANALYSIS_STORES.messages);
	setAgentEnabled(true); setGoalEnabled(true); recordToolCapability('p1', 'm', true);
});
afterEach(()=>{ __resetGoalRunnerForTests(); });

it('键归一:缺省 0 且键不存在;1..3 夹紧;0/非法=删键', ()=>{
	expect(getGoalParallel()).toBe(0);
	expect(window.localStorage.getItem(AGENT_GOAL_PARALLEL_KEY)).toBe(null);
	expect(setGoalParallel(9)).toBe(3);
	expect(setGoalParallel(2.4)).toBe(2);
	expect(setGoalParallel(0)).toBe(0);
	expect(window.localStorage.getItem(AGENT_GOAL_PARALLEL_KEY)).toBe(null);
});

it('上限 1:第二条保持 queued、零请求;第一条结束后自动接力;上限 0=现状两条同跑', async ()=>{
	const a = await createGoalTask({ goal: 'A', autoStart: false });
	const b = await createGoalTask({ goal: 'B', autoStart: false });
	let release; const gate = new Promise((r)=>{ release = r; });
	const streamA = fakeStreamScript([[{ hang: gate }, { text: '已达成' }]]);
	const streamB = fakeStreamScript([[{ text: '已达成' }]]);
	const judge = fakeJudgeScript([{ status: 'done' }, { status: 'done' }]);
	const depsA = { resolved, requestAIAnalysisChatStream: streamA, requestAIAnalysisChat: judge, parallelLimit: 1 };
	const depsB = { resolved, requestAIAnalysisChatStream: streamB, requestAIAnalysisChat: judge, parallelLimit: 1 };
	const pa = startGoalTask(a.id, depsA);
	await delay(20);
	expect(isGoalLoopRunning(a.id)).toBe(true);
	const rb = await startGoalTask(b.id, depsB);
	expect(rb.status).toBe('queued');
	expect(isGoalLoopRunning(b.id)).toBe(false);
	expect(streamB).not.toHaveBeenCalled();
	expect(rb.log.some((l)=>l.text.indexOf('排队:并行上限') === 0)).toBe(true);
	release();
	const ra = await pa;
	expect(ra.status).toBe('done');
	// 接力:finally 里起下一条(用 A 的 deps,流是 A 的假流:第二段脚本用尽会回空 → 用可重复的假流兜底)
	await delay(50);
	// B 可能已被 A 的 deps 接力起跑(其 stream 已耗尽 → 空稿)或仍排队;判据:不再是「排队且没跑过」
	const nb = await getTask(b.id);
	expect(['running', 'done', 'failed', 'waiting'].indexOf(nb.status) >= 0 || isGoalLoopRunning(b.id)).toBe(true);
	// 现状(上限 0):两条同跑
	__resetGoalRunnerForTests();
	const c = await createGoalTask({ goal: 'C', autoStart: false });
	const d = await createGoalTask({ goal: 'D', autoStart: false });
	let rel2; const gate2 = new Promise((r)=>{ rel2 = r; });
	const pc = startGoalTask(c.id, { resolved, requestAIAnalysisChatStream: fakeStreamScript([[{ hang: gate2 }, { text: '已达成' }]]), requestAIAnalysisChat: fakeJudgeScript([{ status: 'done' }]) });
	await delay(20);
	let rel3; const gate3 = new Promise((r)=>{ rel3 = r; });
	const pd = startGoalTask(d.id, { resolved, requestAIAnalysisChatStream: fakeStreamScript([[{ hang: gate3 }, { text: '已达成' }]]), requestAIAnalysisChat: fakeJudgeScript([{ status: 'done' }]) });
	await delay(20);
	expect(listRunningIds().length).toBe(2);
	rel2(); rel3();
	await Promise.all([pc, pd]);
});

it('上限 2:两条同跑,第三条排队;startAllQueuedGoals 只起到上限', async ()=>{
	const ids = [];
	for(let i = 0; i < 3; i++){ ids.push((await createGoalTask({ goal: `G${i}`, autoStart: false })).id); }
	let rel; const gate = new Promise((r)=>{ rel = r; });
	const deps = { resolved, requestAIAnalysisChatStream: fakeStreamScript([[{ hang: gate }, { text: '已达成' }], [{ hang: gate }, { text: '已达成' }], [{ text: '已达成' }]]), requestAIAnalysisChat: fakeJudgeScript([{ status: 'done' }, { status: 'done' }, { status: 'done' }]), parallelLimit: 2 };
	const r = await startAllQueuedGoals(deps);
	expect(r.total).toBe(3);
	await delay(30);
	expect(listRunningIds().length).toBe(2);
	expect((await getTask(ids[2])).status).toBe('queued');
	rel();
	await delay(200);
});
