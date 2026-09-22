// [压测二轮·D6·P1/P2] 上下文策略快照冻结:一个 Turn 只在创建时读一次策略,流中途改设置绝不改写已发出请求的前缀形状;
// 目标任务跨轮的稳定层指纹(usage.prompt.stableHash)不因中途改策略而变(否则上游前缀缓存整条作废)。
import { createAgentTurn, readAgentContextPolicy, DEFAULT_AGENT_CONTEXT_POLICY } from '../aiAgent/runtime';
import { runHeadlessTurn } from '../aiAgent/goalRunner';
import { writeContextPolicy, clearContextPolicy, readContextPolicy } from '../aiChatHistory';
import { setAgentEnabled } from '../aiAgent/prefs';

jest.mock('../../services/aianalysis', ()=>({
	requestAIAnalysisChat: jest.fn(),
	requestAIAnalysisChatStream: jest.fn(),
}));

const tick = ()=>new Promise((r)=>setTimeout(r, 0));

function fakeRegistry(){
	const def = { name: 'list_records', level: 'read', category: 'records', origin: 'builtin', undoKind: 'none', cacheable: true, inputSchema: { type: 'object', additionalProperties: false, properties: { kind: { type: 'string' } } } };
	const runTool = jest.fn(async ()=>({ ok: true, data: { rows: [1, 2] }, summary: '两条' }));
	return {
		runTool,
		getTool: (n)=>(n === 'list_records' ? def : null),
		exportToolManifest: ()=>[{ name: 'list_records', level: 'read', description: 'd', inputSchema: def.inputSchema }],
	};
}

async function driveRounds(agent, n){
	for(let i = 0; i < n; i++){
		agent.beginRound();
		agent.onEvent({ type: 'tool_call', json: { id: `call-${i}`, name: 'list_records', arguments: '{"kind":"all"}' } });
		agent.onEvent({ type: 'done', json: { finish_reason: 'tool_calls' } });
		// eslint-disable-next-line no-await-in-loop
		await agent.settleRound();
	}
	agent.beginRound();
	agent.onEvent({ type: 'delta', json: { delta: '收口' } });
	agent.onEvent({ type: 'done', json: { finish_reason: 'stop' } });
	await agent.settleRound();
}

const resultsOf = (agent)=>agent.trace().rounds.reduce((acc, r)=>acc.concat(r.results || []), []);

beforeEach(()=>{
	window.localStorage.clear();
	jest.restoreAllMocks();
	jest.spyOn(console, 'warn').mockImplementation(()=>{});
	clearContextPolicy();
	setAgentEnabled(true);
});

describe('P1 一个 Turn 一份策略快照', ()=>{
	it('P1 createAgentTurn 之后再 writeContextPolicy({dedupSameCall:true}):本 Turn 三轮同参 read 全部 completed、零 dedup', async ()=>{
		expect(readAgentContextPolicy().dedupSameCall).toBe(DEFAULT_AGENT_CONTEXT_POLICY.dedupSameCall);
		const reg = fakeRegistry();
		const agent = createAgentTurn({ registry: reg, profileId: 'p1', model: 'm1' });
		expect(agent.mode).toBe('native');
		// Turn 开始后才改策略:本 Turn 不受影响(冻结快照)
		expect(writeContextPolicy({ dedupSameCall: true }).dedupSameCall).toBe(true);
		expect(readContextPolicy().dedupSameCall).toBe(true);
		await driveRounds(agent, 3);
		const results = resultsOf(agent);
		expect(results.length).toBe(3);
		expect(results.map((r)=>r.status)).toEqual(['completed', 'completed', 'completed']);
		expect(results.every((r)=>r.dedupOf === undefined)).toBe(true);
		expect(reg.runTool).toHaveBeenCalledTimes(3);
	});

	it('P1b 判别力:策略先写、再开 Turn → 同参去重确实生效(说明上一条不是「去重坏了」)', async ()=>{
		writeContextPolicy({ dedupSameCall: true });
		const reg = fakeRegistry();
		const agent = createAgentTurn({ registry: reg, profileId: 'p1', model: 'm1' });
		await driveRounds(agent, 3);
		const results = resultsOf(agent);
		expect(results.length).toBe(3);
		expect(results[0].dedupOf).toBeUndefined();
		expect(results[1].dedupOf).toBe('call-0');
		expect(results[2].dedupOf).toBe('call-0');
		expect(reg.runTool).toHaveBeenCalledTimes(1);
	});
});

describe('P2 目标任务跨轮稳定层指纹', ()=>{
	it('P2 两轮之间改上下文策略 → usage.prompt.stableHash 不变(稳定层前缀逐字相同,上游缓存不断)', async ()=>{
		const stored = [];
		const deps = {
			requestAIAnalysisChatStream: async (values, handlers)=>{
				handlers.onEvent({ type: 'delta', json: { delta: '好' } });
				handlers.onEvent({ type: 'usage', json: { input_tokens: 100, output_tokens: 20 } });
				handlers.onEvent({ type: 'done', json: {} });
			},
			saveConversationMessage: async (m)=>{ const rec = { id: m.id || `msg-${stored.length}`, ...m }; stored.push(rec); return rec; },
			listConversationMessages: async ()=>stored.filter((m)=>m.streamStatus === 'done'),
		};
		const profile = { providerType: 'openai', apiKey: 'k', baseUrl: 'http://x', providerOptions: {} };
		const args = { profile, model: 'm1', conversationId: 'conv-1', source: null, techniqueKeys: [], systemPrompt: '【口径】固定系统提示,逐字不变。', origin: 'goal', taskId: 't1', deps };
		const one = await runHeadlessTurn({ ...args, userText: '第 1 轮' });
		expect(one.usage.prompt.stableHash).toBeTruthy();
		// 两轮之间用户在设置里换了上下文策略(窗口模式 + 折叠 + 去重)
		writeContextPolicy({ historyMode: 'window', traceTurnsFull: 0, traceTurnsFolded: 4, dedupSameCall: true });
		const two = await runHeadlessTurn({ ...args, userText: '第 2 轮' });
		expect(two.usage.prompt.stableHash).toBe(one.usage.prompt.stableHash);
		expect(two.usage.prompt.stableChars).toBe(one.usage.prompt.stableChars);
		await tick();
	});
});
