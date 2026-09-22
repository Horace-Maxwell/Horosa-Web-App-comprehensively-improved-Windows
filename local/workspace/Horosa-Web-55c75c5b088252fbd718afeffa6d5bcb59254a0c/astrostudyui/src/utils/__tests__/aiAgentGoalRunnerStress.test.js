// [D1] 目标任务运行器·压测二轮(先红后绿)。合同/判别向量:
//   G1 连续 429 两轮 → failed(reason 含「连续出错」)且 error 级通知恰 1 条(不刷屏)、判官一次都不问。
//   G2 出错轮后成功轮必须把 consecutiveErrors 归零(错-对-错-对 四轮仍能 done),否则第 3 轮就被误判「连续出错」。
//   G3 流 stall 后由看门狗以 error 事件收场 = 出错轮(不能把空正文当成功稿落 done)。
//   G4/G5/G6 预算四维里的 calls / costUsd / wallMs 三维:已花超预算时起跑即停,且一个请求都不发。
//   G7 🔴 startGoalTask 幂等:同一任务在 waiting(等审批)期间被二次 start,不得起第二个循环。
//   G8 🔴 requestApproval 超时:到点 resolve(false) 并把待审条目撤台(现在永不超时 = 任务永远挂在 waiting)。
//   G9 无头轮里抛出的非流异常必须留痕:任务落 failed 且 result.reason 带原因,不静默吞、不把异常抛给调用方。
//   G10 🔴 判官短调用必须带 signal(用户停止后判官请求还在跑 = 花钱且回来还会改任务)。
//   G11 🔴 刷新后恢复:interrupted → running → done,且请求体里不得混进上一次中断留下的孤儿正文
//        (aiAnalysisStore.ORPHAN_STREAMING_CONTENT「已停止生成…」),否则模型以为自己上轮被打断。
// 纪律:只用产品 API 落键(safeStorage 拒未登记裸键);deps 注入假流/假判官,零真出站。
import { startGoalTask, judgeGoal, createGoalTask, isGoalLoopRunning, __resetGoalRunnerForTests } from '../aiAgent/goalRunner';
import { createTask, getTask, patchTask, __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { listNotices } from '../aiAgent/tasks/noticeStore';
import { __resetTaskRegistryForTests } from '../aiAgent/tasks/taskRegistry';
import { requestApproval, listPendingApprovals, __resetApprovalsForTests } from '../aiAgent/approvals';
import { clearStore, AI_ANALYSIS_STORES, putStoreRecord, listConversationMessages, ORPHAN_STREAMING_CONTENT, __resetInFlightMessagesForTests } from '../aiAnalysisStore';
import { setAgentEnabled, setGoalEnabled } from '../aiAgent/prefs';
import { recordToolCapability } from '../aiAgent/caps';
import { fakeStreamScript, fakeJudgeScript, delay } from './helpers/agentFakes';

const profile = { id: 'p1', name: 'P', providerType: 'openai', protocolFamily: 'openai', baseUrl: 'http://x', apiKey: 'k', providerOptions: {} };
const resolved = { profile, model: 'm' };

// 判官调用里带上的中止信号可能落在请求体顶层或第二个 options 参数上(修法未定),两处都认。
function signalOfChatCall(call){
	const body = call && call[0];
	const opts = call && call[1];
	return (opts && opts.signal) || (body && body.signal) || (body && body.providerOptions && body.providerOptions.signal) || null;
}

beforeEach(async ()=>{
	window.localStorage.clear();
	__resetGoalRunnerForTests(); __resetTaskRegistryForTests(); __resetTaskCacheForTests(); __resetApprovalsForTests(); __resetInFlightMessagesForTests();
	await clearStore(AI_ANALYSIS_STORES.agentTasks); await clearStore(AI_ANALYSIS_STORES.agentNotices);
	await clearStore(AI_ANALYSIS_STORES.conversations); await clearStore(AI_ANALYSIS_STORES.messages);
	setAgentEnabled(true); setGoalEnabled(true); recordToolCapability('p1', 'm', true);
});
afterEach(()=>{ __resetApprovalsForTests(); __resetGoalRunnerForTests(); });

describe('D1 · 目标循环的失败路', ()=>{
	it('G1 连续 429 两轮 → failed「连续出错」;error 通知恰 1;判官一次不问', async ()=>{
		const t = await createGoalTask({ goal: '建两个人', autoStart: false });
		const stream = fakeStreamScript([[{ http429: 1 }], [{ http429: 1 }]]);
		const judge = fakeJudgeScript([{ status: 'done' }]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: judge });
		expect(out.status).toBe('failed');
		expect(out.result.reason).toContain('连续出错');
		expect(out.result.reason).toContain('429');
		expect(stream).toHaveBeenCalledTimes(2);
		expect(judge).not.toHaveBeenCalled();
		const errors = (await listNotices()).filter((n)=>n.level === 'error' && n.taskId === t.id);
		expect(errors.length).toBe(1);
		expect(out.log.filter((l)=>l.text.indexOf('轮出错') >= 0).length).toBe(2);
	});

	it('G2 错-对-错-对:成功轮把 consecutiveErrors 归零,第 4 轮仍能 done(spent.turns=4)', async ()=>{
		const t = await createGoalTask({ goal: 'G', autoStart: false });
		const stream = fakeStreamScript([[{ http500: 1 }], [{ text: '第 2 轮做了 A' }], [{ http500: 1 }], [{ text: '已达成' }]]);
		const judge = fakeJudgeScript([{ status: 'continue', reason: '还差 B' }, { status: 'done', reason: '都做完了' }]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: judge });
		expect(out.status).toBe('done');
		expect(out.spent.turns).toBe(4);
		expect(stream).toHaveBeenCalledTimes(4);
		expect(judge).toHaveBeenCalledTimes(2);   // 只有成功轮才问判官
	});

	it('G3 stall 后看门狗 error 收场 = 出错轮:不落「成功稿」,连两次即 failed', async ()=>{
		const t = await createGoalTask({ goal: 'G', autoStart: false });
		const watchdog = '上游长时间无数据,已中止(看门狗)';
		const stream = fakeStreamScript([[{ stall: 30 }, { http500: { message: watchdog } }], [{ stall: 30 }, { http500: { message: watchdog } }]]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: fakeJudgeScript([{ status: 'done' }]) });
		expect(out.status).toBe('failed');
		expect(out.result.reason).toContain(watchdog);
		const msgs = await listConversationMessages(out.conversationId);
		const assistants = msgs.filter((m)=>m.role === 'assistant');
		expect(assistants.length).toBe(2);
		assistants.forEach((m)=>{
			expect(m.streamStatus).toBe('error');
			expect(`${m.content || ''}`).toBe('');   // 空正文的出错轮不得伪装成「模型未返回可用内容」的成功稿
		});
	});
});

describe('D1 · 预算四维', ()=>{
	// 已花额度来自上一次运行(暂停/中断后续跑的真实形态):起跑第一件事就是查预算,超了不发请求。
	async function seeded(budget, spent){
		return createTask({ kind: 'goal', title: 'G', spec: { goal: 'G' }, budget, spent });
	}
	it('G4 calls 超预算 → failed「预算:调用次数」,零请求', async ()=>{
		const t = await seeded({ maxCalls: 64 }, { calls: 64 });
		const stream = fakeStreamScript([[{ text: 'x' }]]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: fakeJudgeScript([{ status: 'done' }]) });
		expect(out.status).toBe('failed');
		expect(out.result.reason).toContain('预算:调用次数');
		expect(stream).not.toHaveBeenCalled();
		expect((await listNotices()).some((n)=>n.level === 'warn' && n.taskId === t.id)).toBe(true);
	});
	it('G5 costUsd 超预算 → failed「预算:费用」,零请求', async ()=>{
		const t = await seeded({ maxCostUsd: 2 }, { costUsd: 2.5 });
		const stream = fakeStreamScript([[{ text: 'x' }]]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: fakeJudgeScript([{ status: 'done' }]) });
		expect(out.status).toBe('failed');
		expect(out.result.reason).toContain('预算:费用');
		expect(stream).not.toHaveBeenCalled();
	});
	it('G6 wallMs 超预算 → failed「预算:时长」,零请求', async ()=>{
		const t = await seeded({ maxWallMinutes: 20 }, { wallMs: 20 * 60000 });
		const stream = fakeStreamScript([[{ text: 'x' }]]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: fakeJudgeScript([{ status: 'done' }]) });
		expect(out.status).toBe('failed');
		expect(out.result.reason).toContain('预算:时长');
		expect(stream).not.toHaveBeenCalled();
	});
});

describe('D1 · 幂等 / 审批 / 留痕 / 信号 / 恢复', ()=>{
	it('🔴 G7 waiting(等审批)期间二次 startGoalTask 不得起第二个循环', async ()=>{
		// 当前红:goalRunner.js:188 只按状态放行(waiting 在允许集里),没有 runningLoops 幂等短路 →
		// 第二次调用会再跑一遍 for(;;),同一任务同时两个循环各发各的流请求(计划批一 #12)。
		const t = await createGoalTask({ goal: 'G', autoStart: false });
		let release;
		const gate = new Promise((r)=>{ release = r; });
		const stream = fakeStreamScript([[{ hang: gate }, { text: '首轮' }], [{ text: '第二个循环不该存在' }]]);
		const judge = fakeJudgeScript([{ status: 'done', reason: 'ok' }]);
		const p1 = startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: judge });
		await delay(30);
		expect(stream).toHaveBeenCalledTimes(1);
		expect(isGoalLoopRunning(t.id)).toBe(true);
		// 写入审批挂起 = 任务落 waiting(running→waiting 是合法迁移);此时用户/工具再点一次「开始」
		await patchTask(t.id, { status: 'waiting' });
		const p2 = startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: judge });
		await delay(40);
		expect(stream).toHaveBeenCalledTimes(1);
		release();
		await Promise.all([p1.catch(()=>null), p2.catch(()=>null)]);
	});

	it('🔴 G8 requestApproval 超时:到点 resolve(false) 且待审条目撤台', async ()=>{
		// 当前红:approvals.js:14 的 requestApproval(messageKey, call) 只认第三方 resolve/abort,
		// 既不收 { timeoutMs },也没有任何计时器 → 无人处理的审批永远挂在台上(计划批一 #7)。
		const call = { callId: 'c-timeout-1', name: 'create_record', args: { name: '甲' } };
		const p = requestApproval('task:t1', call, { timeoutMs: 30 });
		expect(listPendingApprovals('task:t1').length).toBe(1);
		const settled = await Promise.race([p, delay(120).then(()=>'PENDING')]);
		expect(settled).toBe(false);
		expect(listPendingApprovals('task:t1')).toEqual([]);
	});

	it('G9 无头轮抛异常 → 任务 failed 且 reason 带原因,调用方不收到异常,循环登记已注销', async ()=>{
		const t = await createGoalTask({ goal: 'G', autoStart: false });
		const boom = jest.fn(async ()=>{ throw new Error('存储写入失败(夹具)'); });
		const stream = fakeStreamScript([[{ text: 'x' }]]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: fakeJudgeScript([{ status: 'done' }]), saveConversationMessage: boom });
		expect(out.status).toBe('failed');
		expect(out.result.reason).toContain('存储写入失败');
		expect(stream).not.toHaveBeenCalled();
		expect(isGoalLoopRunning(t.id)).toBe(false);
	});

	it('🔴 G10 判官短调用必须带 signal(直调 + 循环内两处)', async ()=>{
		// 当前红:goalRunner.js:134 judgeGoal 不收 signal、:138 的 chat({…}) 里没有 signal 键;
		// :248 循环调判官时也没把 loop.ac.signal 传下去 → 用户按「停止」后判官请求仍在飞(计划批一 #11)。
		const ac = new AbortController();
		const direct = jest.fn(async ()=>({ Result: { content: '{"status":"done","reason":"ok"}' } }));
		await judgeGoal({ profile, model: 'm', spec: { goal: 'G' }, lastReply: 'x', signal: ac.signal, deps: { requestAIAnalysisChat: direct } });
		expect(direct).toHaveBeenCalledTimes(1);
		expect(signalOfChatCall(direct.mock.calls[0])).toBe(ac.signal);

		const t = await createGoalTask({ goal: 'G', autoStart: false });
		const inLoop = fakeJudgeScript([{ status: 'done', reason: 'ok' }]);
		await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: fakeStreamScript([[{ text: '做完了' }]]), requestAIAnalysisChat: inLoop });
		expect(inLoop).toHaveBeenCalledTimes(1);
		const carried = signalOfChatCall(inLoop.mock.calls[0]);
		expect(carried && typeof carried.aborted === 'boolean').toBe(true);
	});

	it('🔴 G11 刷新恢复:interrupted→running→done,且请求体不含孤儿「已停止生成」正文', async ()=>{
		// 当前红:goalRunner.js:69 组历史时只滤掉 streamStatus==='streaming';而 listConversationMessages
		// 会先把刷新遗留的 streaming 孤儿修成 aborted + ORPHAN_STREAMING_CONTENT 正文 → 它照样进请求体,
		// 模型下一轮读到「已停止生成(页面刷新或关闭时中断)。」(计划批一 #20)。
		const now = new Date().toISOString();
		const conv = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
			title: '目标·G', sourceRef: null, providerProfileId: 'p1', providerName: 'P', providerType: 'openai', model: 'm',
			referenceIds: [], techniqueKeys: [], systemPrompt: '', meta: { kind: 'goal' }, lastMessageAt: now, updatedAt: now, createdAt: now, archived: false, favorite: false,
		}, 'conv');
		const t = await createTask({ kind: 'goal', status: 'interrupted', title: 'G', spec: { goal: 'G' }, conversationId: conv.id, spent: { turns: 1 } });
		// 上一次运行留下的一问一答:user 正常、assistant 停在 streaming(= 刷新时被掐断的孤儿)。
		// 直接 putStoreRecord 而不是 saveConversationMessage:后者会把 id 记进本会话 inFlight 集合,
		// 就不再被判成孤儿了(那是「同一会话仍在生成」,不是我们要复现的刷新形态)。
		await putStoreRecord(AI_ANALYSIS_STORES.messages, { conversationId: conv.id, role: 'user', content: '目标:G', streamStatus: 'done', createdAt: now, updatedAt: now }, 'msg');
		await putStoreRecord(AI_ANALYSIS_STORES.messages, { conversationId: conv.id, role: 'assistant', content: '', streamStatus: 'streaming', createdAt: now, updatedAt: now }, 'msg');

		const stream = fakeStreamScript([[{ text: '接着做完了' }]]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: fakeJudgeScript([{ status: 'done', reason: '完成' }]) });
		expect(out.status).toBe('done');
		expect(out.conversationId).toBe(conv.id);
		expect(stream).toHaveBeenCalledTimes(1);
		const sent = stream.allMessageText();
		expect(sent).not.toContain('已停止生成');
		expect(sent).not.toContain(ORPHAN_STREAMING_CONTENT);
		// 本轮新落的助手消息必须是终态(不再制造新的 streaming 孤儿)
		const msgs = await listConversationMessages(conv.id);
		expect(msgs[msgs.length - 1].streamStatus).toBe('done');
	});
});
