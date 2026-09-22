// 目标任务运行器(P2)合同:假流两轮→判官 done;预算 1 轮→failed:预算;暂停→paused+aborted;纠偏→下一轮 user 带 [用户纠偏];判官坏 JSON×2→waiting;门未开→failed;判官解析。
import { startGoalTask, steerGoalTask, createGoalTask, parseJudge, buildJudgePrompt, buildGoalPrompt, buildHeadlessSystemPrompt, headlessLayerExtras, droppedLayersNote, snapshotTechniqueOptionOverrides, CACHE_BP, GOAL_JUDGE_TAG, GOAL_STEER_PREFIX, __resetGoalRunnerForTests } from '../aiAgent/goalRunner';
import { PERSONA_KEY } from '../aiChat/persona';
import { getTask, __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { listNotices } from '../aiAgent/tasks/noticeStore';
import { __resetTaskRegistryForTests, controllerOf } from '../aiAgent/tasks/taskRegistry';
import { clearStore, AI_ANALYSIS_STORES, listConversationMessages } from '../aiAnalysisStore';
import { setAgentEnabled, setGoalEnabled } from '../aiAgent/prefs';
import { recordToolCapability } from '../aiAgent/caps';

const profile = { id: 'p1', name: 'P', providerType: 'openai', protocolFamily: 'openai', baseUrl: 'http://x', apiKey: 'k', providerOptions: {} };
const resolved = { profile, model: 'm' };
// 假流:每次调用按脚本回一段正文(可带 usage);judge 按脚本回 JSON 文本
function fakeStream(replies){
	let i = 0;
	return jest.fn(async (values, handlers)=>{
		const r = replies[Math.min(i, replies.length - 1)]; i += 1;
		if(r && r.hang){ await r.hang; }
		handlers.onEvent({ type: 'delta', json: { delta: r.text || '回复' } });
		handlers.onEvent({ type: 'usage', json: { input_tokens: 30, output_tokens: 12 } });
		handlers.onEvent({ type: 'done', json: { finish_reason: 'stop' } });
	});
}
function fakeJudge(verdicts){
	let i = 0;
	return jest.fn(async ()=>{ const v = verdicts[Math.min(i, verdicts.length - 1)]; i += 1; return { Result: { content: typeof v === 'string' ? v : JSON.stringify(v) } }; });
}

beforeEach(async ()=>{
	window.localStorage.clear(); __resetGoalRunnerForTests(); __resetTaskRegistryForTests(); __resetTaskCacheForTests();
	await clearStore(AI_ANALYSIS_STORES.agentTasks); await clearStore(AI_ANALYSIS_STORES.agentNotices); await clearStore(AI_ANALYSIS_STORES.conversations); await clearStore(AI_ANALYSIS_STORES.messages);
	setAgentEnabled(true); setGoalEnabled(true); recordToolCapability('p1', 'm', true);
});

describe('[Q-402① 裁决 2026-09-18] 判官调用计入预算', ()=>{
	it('判官短调用 → spent.calls +1 / wallMs 累加 / usage 可计价则费用累加(与执行轮分开计)', async ()=>{
		const t = await createGoalTask({ goal: 'G', budget: { maxTurns: 5 } }, { sourceCid: null, techniques: [] });
		const stream = fakeStream([{ text: 'A' }, { text: 'B' }]);
		let i = 0; const verdicts = [{ status: 'continue' }, { status: 'done' }];
		const judge = jest.fn(async ()=>{ const v = verdicts[Math.min(i, verdicts.length - 1)]; i += 1; await new Promise((r)=>setTimeout(r, 5)); return { Result: { content: JSON.stringify(v), usage: { input_tokens: 40, output_tokens: 8 } } }; });
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: judge });
		expect(out.status).toBe('done');
		expect(judge).toHaveBeenCalledTimes(2);
		// 执行轮 2 次(流无工具调用 → calls 0)+ 判官 2 次 = calls 2;判官时长 ≥ 2×5ms 计入 wallMs
		expect(out.spent.calls).toBe(2);
		expect(out.spent.wallMs).toBeGreaterThanOrEqual(10);
	});
});

describe('goalRunner', ()=>{
	it('parseJudge/buildJudgePrompt/buildGoalPrompt', ()=>{
		expect(parseJudge('前言 {"status":"done","reason":"ok","nextStep":""} 后语')).toEqual({ status: 'done', reason: 'ok', nextStep: '' });
		expect(parseJudge('{"status":"nope"}')).toBe(null);
		expect(parseJudge('not json')).toBe(null);
		expect(buildJudgePrompt({ goal: 'G', successCriteria: 'C' })).toContain(GOAL_JUDGE_TAG);
		expect(buildJudgePrompt({ goal: 'G', successCriteria: 'C' })).toContain('完成判据:C');
		expect(buildGoalPrompt({ goal: 'G' })).toContain('目标:G');
	});
	it('无头系统提示:无挂载源只有系统层;anthropic 家族稳定层后带缓存断点;meta 指纹在', async ()=>{
		const a = await buildHeadlessSystemPrompt({ source: null, techniqueKeys: [], systemPrompt: '', profile: { providerType: 'anthropic' }, model: 'claude-x' });
		expect(a.systemPrompt.endsWith(CACHE_BP)).toBe(true);
		expect(a.meta.layerKeys[0]).toBe('system');
		expect(typeof a.meta.stableHash).toBe('string');
		const o = await buildHeadlessSystemPrompt({ source: null, techniqueKeys: [], systemPrompt: '自定义规则', profile: { providerType: 'ollama' }, model: 'm' });
		expect(o.systemPrompt.indexOf(CACHE_BP)).toBe(-1);
		expect(o.systemPrompt).toContain('自定义规则');
	});
	it('🔴 [Q-285/M-100] 无头系统提示注入口径 / 会话口径 / 压缩摘要层(与对话页同开关);口径关 → 一层不注;丢层留痕句与对话页同文', async ()=>{
		window.localStorage.setItem(PERSONA_KEY, JSON.stringify({ text: '全局口径甲', enabled: true }));
		const conv = { persona: '会话口径乙', compact: { summary: '之前聊过丙', coveredCount: 3 } };
		const on = await buildHeadlessSystemPrompt({ source: null, techniqueKeys: [], systemPrompt: '', profile: { providerType: 'ollama' }, model: 'm', conversation: conv });
		expect(on.systemPrompt).toContain('全局口径甲');
		expect(on.systemPrompt).toContain('本会话口径');
		expect(on.systemPrompt).toContain('会话口径乙');
		expect(on.systemPrompt).toContain('之前聊过丙');
		expect(on.meta.layerKeys).toEqual(expect.arrayContaining(['persona', 'system']));
		expect(Array.isArray(on.meta.droppedKeys)).toBe(true);
		const extras = await headlessLayerExtras({ source: { id: 'local-1', title: '张三' }, techniqueKeys: ['bazi'], conversation: conv });
		expect(extras.map((l)=>l.key).sort()).toEqual(['compact-summary', 'persona'].sort());
		window.localStorage.setItem(PERSONA_KEY, JSON.stringify({ text: '全局口径甲', enabled: false }));
		const off = await buildHeadlessSystemPrompt({ source: null, techniqueKeys: [], systemPrompt: '', profile: { providerType: 'ollama' }, model: 'm', conversation: { compact: null } });
		expect(off.systemPrompt).not.toContain('全局口径甲');
		// 口径关 → persona / memory / compact 一层不注;system 与日界规则层是无条件基座(与对话页同)
		expect(off.meta.layerKeys).toEqual(expect.arrayContaining(['system']));
		['persona', 'memory', 'compact-summary'].forEach((k)=>expect(off.meta.layerKeys).not.toContain(k));
		expect(droppedLayersNote([{ title: '使用技法：八字' }, { key: 'memory' }])).toBe('[挂载预算不足：以下 2 层整层未纳入 —— 八字、memory。未列出的内容不代表不存在，请勿臆补；如需完整资料，请提示用户在「进阶 → 对话上下文策略 → 挂载字数预算」里调大，或减少挂载技法。]');
		expect(droppedLayersNote([])).toBe('');
	});
	it('🔴 [Q-285/M-96] 建目标任务时快照会话覆盖:只留本任务技法的对象值;空 → undefined;spec 落库可读回', async ()=>{
		expect(snapshotTechniqueOptionOverrides({ bazi: { luckMode: 'x' }, other: { b: 2 }, ziwei: 'bad', qimen: {} }, ['bazi', 'ziwei', 'qimen'])).toEqual({ bazi: { luckMode: 'x' } });
		expect(snapshotTechniqueOptionOverrides({ other: { b: 2 } }, ['bazi'])).toBeUndefined();
		expect(snapshotTechniqueOptionOverrides(null, ['bazi'])).toBeUndefined();
		const t = await createGoalTask({ goal: 'G', techniques: ['bazi'], techniqueOptionOverrides: { bazi: { luckMode: 'x' }, ziwei: { a: 1 } }, autoStart: false });
		const saved = await getTask(t.id);
		expect(saved.spec.techniqueOptionOverrides).toEqual({ bazi: { luckMode: 'x' } });
		const t2 = await createGoalTask({ goal: 'G2', techniques: ['bazi'], autoStart: false });
		expect((await getTask(t2.id)).spec.techniqueOptionOverrides).toBeUndefined();
	});
	it('🔴 两轮达成:第 1 轮判官 continue、第 2 轮 done → status done/progress 100/spent.turns 2;会话 4 条消息;完成通知', async ()=>{
		const t = await createGoalTask({ goal: '建两个人', autoStart: false });
		const stream = fakeStream([{ text: '首轮做了 A' }, { text: '已达成' }]);
		const judge = fakeJudge([{ status: 'continue', reason: '还差 B', nextStep: '做 B' }, { status: 'done', reason: '都做完了' }]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: judge });
		expect(out.status).toBe('done');
		expect(out.progress).toBe(100);
		expect(out.spent.turns).toBe(2);
		expect(out.result.reason).toBe('都做完了');
		expect(stream).toHaveBeenCalledTimes(2);
		expect(judge).toHaveBeenCalledTimes(2);
		const msgs = await listConversationMessages(out.conversationId);
		expect(msgs.map((m)=>m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
		expect(msgs[0].content).toContain('目标:建两个人');
		expect(msgs[2].content).toContain('继续');
		expect(msgs[1].usage.history.mode).toBeDefined();
		const notices = await listNotices();
		expect(notices.some((n)=>n.level === 'success' && n.taskId === t.id)).toBe(true);
		expect(out.log.some((l)=>l.text.indexOf('自检:continue') >= 0)).toBe(true);
	});
	it('🔴 预算 1 轮 + 判官 continue → failed 且 result.reason 写明「预算:轮数」', async ()=>{
		const t = await createGoalTask({ goal: 'G', budget: { maxTurns: 1 }, autoStart: false });
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: fakeStream([{ text: 'x' }]), requestAIAnalysisChat: fakeJudge([{ status: 'continue' }]) });
		expect(out.status).toBe('failed');
		expect(out.result.reason).toContain('预算:轮数');
		expect((await listNotices()).some((n)=>n.level === 'warn')).toBe(true);
	});
	it('🔴 暂停:流进行中 controllerOf(id).pause() → 本轮 aborted、任务 paused;再 startGoalTask 可继续', async ()=>{
		const t = await createGoalTask({ goal: 'G', autoStart: false });
		let release;
		const hang = new Promise((r)=>{ release = r; });
		const stream = jest.fn(async (values, handlers)=>{
			await hang;
			if(values.__second){ handlers.onEvent({ type: 'delta', json: { delta: '继续做完' } }); }
			handlers.onEvent({ type: 'done', json: { finish_reason: 'stop' } });
		});
		const p = startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: fakeJudge([{ status: 'done' }]) });
		await new Promise((r)=>setTimeout(r, 30));
		expect((await getTask(t.id)).status).toBe('running');
		expect(typeof controllerOf(t.id).pause).toBe('function'); controllerOf(t.id).pause();   // 任务中心同一条控制器(pauseGoalTask 重复实现已删)
		release();
		const out = await p;
		expect(out.status).toBe('paused');
		expect(out.spent.turns).toBe(1);
		const resumed = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: fakeStream([{ text: '继续做完' }]), requestAIAnalysisChat: fakeJudge([{ status: 'done' }]) });
		expect(resumed.status).toBe('done');
	});
	it('🔴 纠偏:起跑前记录的附在首轮目标后;运行中记录的替代下一轮「继续」并以 [用户纠偏] 开头;每条只消费一次', async ()=>{
		const t = await createGoalTask({ goal: 'G', autoStart: false });
		await steerGoalTask(t.id, '先从张三开始');
		let calls = 0;
		const stream = jest.fn(async (values, handlers)=>{
			calls += 1;
			if(calls === 1){ await steerGoalTask(t.id, '第三个人的时辰改成申时'); }   // 首轮流进行中用户纠偏
			handlers.onEvent({ type: 'delta', json: { delta: `回复${calls}` } });
			handlers.onEvent({ type: 'done', json: { finish_reason: 'stop' } });
		});
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: fakeJudge([{ status: 'continue' }, { status: 'continue' }, { status: 'done' }]) });
		const msgs = await listConversationMessages(out.conversationId);
		expect(msgs[0].content).toContain('目标:G');
		expect(msgs[0].content).toContain(`${GOAL_STEER_PREFIX} 先从张三开始`);
		expect(msgs[2].content.indexOf(GOAL_STEER_PREFIX)).toBe(0);
		expect(msgs[2].content).toContain('申时');
		expect(msgs[2].content).not.toContain('先从张三开始');
		expect(msgs[4].content).toContain('继续');
		expect(out.instructions.length).toBe(2);
		expect(out.instructions.every((i)=>i.consumed)).toBe(true);
	});
	it('🔴 判官坏 JSON 两次 → waiting + 需要你通知;总开关/子开关未开 → failed 不发请求', async ()=>{
		const t = await createGoalTask({ goal: 'G', autoStart: false });
		const stream = fakeStream([{ text: 'x' }]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: fakeJudge(['not json', '还是不是']) });
		expect(out.status).toBe('waiting');
		expect(stream).toHaveBeenCalledTimes(2);
		expect((await listNotices()).some((n)=>n.level === 'action')).toBe(true);
		setGoalEnabled(false);
		const t2 = await createGoalTask({ goal: 'G2', autoStart: false });
		const s2 = fakeStream([{ text: 'x' }]);
		const out2 = await startGoalTask(t2.id, { resolved, requestAIAnalysisChatStream: s2, requestAIAnalysisChat: fakeJudge([{ status: 'done' }]) });
		expect(out2.status).toBe('failed');
		expect(s2).not.toHaveBeenCalled();
	});
	it('🔴 [D3] judge 槽设了 → 判官用槽里的档案与模型(+槽参数),流仍用任务自身模型;槽空孪生 → 判官=任务模型且无 max_tokens', async ()=>{
		const { writeModelRoutes, writeRouteOptions } = require('../aiModelRouting');
		const { putStoreRecord } = require('../aiAnalysisStore');
		await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, { id: 'p2', name: 'J', providerType: 'openai', protocolFamily: 'openai', baseUrl: 'http://j', apiKey: 'k2', providerOptions: {}, enabled: true, chatModelIds: ['judge-m'] });
		writeModelRoutes({ judge: 'p2::judge-m' });
		writeRouteOptions({ judge: { maxTokens: 321 } });
		const t = await createGoalTask({ goal: 'G', autoStart: false });
		const stream = fakeStream([{ text: '已达成' }]);
		const judge = fakeJudge([{ status: 'done', reason: 'ok' }]);
		const out = await startGoalTask(t.id, { resolved, requestAIAnalysisChatStream: stream, requestAIAnalysisChat: judge });
		expect(out.status).toBe('done');
		expect(stream.mock.calls[0][0].model).toBe('m');
		expect(judge.mock.calls[0][0].model).toBe('judge-m');
		expect(judge.mock.calls[0][0].baseUrl).toBe('http://j');
		expect(judge.mock.calls[0][0].providerOptions.max_tokens).toBe(321);
		// 孪生:清键 → 判官=任务模型、无 max_tokens(缺省路径零 IO)
		window.localStorage.clear(); setAgentEnabled(true); setGoalEnabled(true); recordToolCapability('p1', 'm', true);
		const t2 = await createGoalTask({ goal: 'G2', autoStart: false });
		const judge2 = fakeJudge([{ status: 'done' }]);
		const out2 = await startGoalTask(t2.id, { resolved, requestAIAnalysisChatStream: fakeStream([{ text: 'x' }]), requestAIAnalysisChat: judge2 });
		expect(out2.status).toBe('done');
		expect(judge2.mock.calls[0][0].model).toBe('m');
		expect(judge2.mock.calls[0][0].providerOptions.max_tokens).toBeUndefined();
		await clearStore(AI_ANALYSIS_STORES.providerProfiles);
	});
});

describe('[复查 D27] 后台任务审批文案按级别', ()=>{
	const { approvalVerb } = require('../aiAgent/goalRunner');
	it('读级「请求执行」、写入「请求写入」(此前硬写「请求写入」)', ()=>{
		expect(approvalVerb({ name: 'web_search', level: 'read' })).toBe('请求执行');
		expect(approvalVerb({ name: 'create_chart_record', level: 'additive' })).toBe('请求写入');
		expect(approvalVerb(null)).toBe('请求写入');
	});
});
