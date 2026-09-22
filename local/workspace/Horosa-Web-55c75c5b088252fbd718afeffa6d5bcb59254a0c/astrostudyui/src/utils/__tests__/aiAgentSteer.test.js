// [批二⑤] 插话合同:队列按助手消息 id 排队、取即清、每轮上限 3;运行时每轮开始取一次并把「[用户插话] …」附在本轮请求末尾,
// 进 trace.steers;未消费的插话不进历史;无插话 = 请求体逐字不变(零回归锚)。
import { pushSteer, takeSteer, peekSteer, steerLine, STEER_PREFIX, STEER_MAX_PER_TURN, __resetSteerForTests } from '../aiAgent/steer';
import { createAgentTurn } from '../aiAgent/runtime';
import { registerTool, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled, setAgentApprovalMode } from '../aiAgent/prefs';

const BASE = [{ role: 'system', content: 'SYS' }, { role: 'user', content: '帮我看看' }];
beforeEach(()=>{ window.localStorage.clear(); __resetSteerForTests(); __resetToolsForTests(); setAgentEnabled(true); setAgentApprovalMode('never'); });

it('队列:按 id 排队、取即清、超 3 条拒、空文本拒', ()=>{
	expect(pushSteer('m1', '  改看事业 ')).toBe(true);
	expect(pushSteer('m1', '再看感情')).toBe(true);
	expect(peekSteer('m1')).toEqual(['改看事业', '再看感情']);
	expect(pushSteer('m1', '三')).toBe(true);
	expect(pushSteer('m1', '四')).toBe(false);
	expect(STEER_MAX_PER_TURN).toBe(3);
	expect(pushSteer('m1', '   ')).toBe(false);
	expect(pushSteer('', 'x')).toBe(false);
	expect(takeSteer('m1')).toBe('改看事业;再看感情;三');
	expect(takeSteer('m1')).toBe('');
	pushSteer('m2', 'a'); takeSteer('m2'); expect(peekSteer('m2')).toEqual([]);   // 取即清(D19:clearSteer 死导出已删)
	expect(steerLine('x')).toBe(`${STEER_PREFIX} x`);
});

it('运行时:第 2 轮请求末尾多一条 [用户插话] user 消息,trace.steers 记下;第 3 轮不再重复;无插话轮与现状逐字相同', async ()=>{
	registerTool({ name: 'probe_read', level: 'read', undoKind: 'none', description: 'd', inputSchema: { type: 'object', properties: {} }, run: async ()=>({ ok: true, data: { x: 1 } }) });
	const queue = { text: '' };
	const agent = createAgentTurn({ profile: { id: 'p1' }, model: 'm', steer: ()=>{ const t = queue.text; queue.text = ''; return t; } });
	agent.beginRound();
	const m1 = agent.messagesForRound(BASE);
	expect(m1[m1.length - 1].role).toBe('user');
	expect(m1[m1.length - 1].content).toBe('帮我看看');   // 首轮无插话:末条就是用户原话
	agent.onEvent({ type: 'tool_call', json: { id: 'c1', name: 'probe_read', arguments: '{}' } });
	expect(await agent.settleRound()).toBe(true);
	// 用户在首轮工具执行期间插了一句
	queue.text = '改看事业';
	agent.beginRound();
	const m2 = agent.messagesForRound(BASE);
	const last = m2[m2.length - 1];
	expect(last).toEqual({ role: 'user', content: `${STEER_PREFIX} 改看事业` });
	expect(m2.length).toBe(m1.length + 2 + 1);   // +assistant 调用 +tool 结果 +插话
	expect(agent.trace().steers).toEqual([expect.objectContaining({ round: 1, text: '改看事业' })]);
	agent.onEvent({ type: 'tool_call', json: { id: 'c2', name: 'probe_read', arguments: '{}' } });
	expect(await agent.settleRound()).toBe(true);
	agent.beginRound();
	const m3 = agent.messagesForRound(BASE);
	expect(m3[m3.length - 1].role).toBe('tool');   // 插话取即清:第 3 轮不再附
	expect(agent.trace().steers.length).toBe(1);
});

it('steer 回调抛错或不给 → 与现状逐字相同', ()=>{
	const a = createAgentTurn({ profile: { id: 'p1' }, model: 'm', steer: ()=>{ throw new Error('x'); } });
	a.beginRound();
	const b = createAgentTurn({ profile: { id: 'p1' }, model: 'm' });
	b.beginRound();
	expect(a.messagesForRound(BASE)).toEqual(b.messagesForRound(BASE));
	expect(a.trace().steers).toEqual([]);
});
