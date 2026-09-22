// 运行时·模型路由钩(C4)合同:每轮 model 进 trace(setRoundModel);requestClose 只在「无调用且未收口」时再跑恰一轮(toolChoice none)且只生效一次;
// 有调用时 requestClose 不改变正常流程;NULL_AGENT 四钩空实现;未调 requestClose 的现状路径轮数不变。
import { createAgentTurn, NULL_AGENT } from '../aiAgent/runtime';
import { registerTool, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled } from '../aiAgent/prefs';
import { recordToolCapability } from '../aiAgent/caps';
import { GUIDE } from '../aiTools/tools/_shared';

const profile = { id: 'p1', providerType: 'openai' };
function mkAgent(){
	return createAgentTurn({ profile, model: 'cheap', registry: undefined, signal: new AbortController().signal, lastUserMessage: 'q' });
}
beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); setAgentEnabled(true); recordToolCapability('p1', 'cheap', true);
	registerTool({ name: 'get_probe', level: 'read', undoKind: 'none', description: `probe ${GUIDE}`, inputSchema: { type: 'object', additionalProperties: false, properties: {} }, run: async ()=>({ ok: true, data: { x: 1 } }) });
});

describe('runtime 模型路由钩', ()=>{
	it('NULL_AGENT:setRoundModel/requestClose 空实现,isClosing false,currentCallCount 0', ()=>{
		expect(()=>NULL_AGENT.setRoundModel('m')).not.toThrow();
		expect(()=>NULL_AGENT.requestClose()).not.toThrow();
		expect(NULL_AGENT.isClosing()).toBe(false);
		expect(NULL_AGENT.currentCallCount()).toBe(0);
	});
	it('🔴 无调用 + requestClose → settleRound 再回 true 恰一次(收口轮 toolChoice none),收口轮 model 为终稿模型;trace 两轮各带 model', async ()=>{
		const agent = mkAgent();
		agent.beginRound(); agent.setRoundModel('cheap');
		agent.onEvent({ type: 'delta', json: { delta: '草稿回答' } });
		expect(agent.currentCallCount()).toBe(0);
		expect(agent.isClosing()).toBe(false);
		agent.requestClose();
		expect(await agent.settleRound()).toBe(true);
		expect(agent.isClosing()).toBe(true);
		expect(agent.toolChoice()).toBe('none');
		agent.beginRound(); agent.setRoundModel('strong');
		agent.onEvent({ type: 'delta', json: { delta: '终稿回答' } });
		agent.requestClose();   // 已收口:再请求无效
		expect(await agent.settleRound()).toBe(false);
		const t = agent.trace();
		expect(t.rounds.map((r)=>r.model)).toEqual(['cheap', 'strong']);
		expect(t.rounds.map((r)=>r.text)).toEqual(['草稿回答', '终稿回答']);
		expect(t.stopReason).toBe('stop');
	});
	it('有调用时 requestClose 不改变流程:执行调用后照常进入下一轮(不额外收口);未 requestClose 的现状=单轮结束', async ()=>{
		const agent = mkAgent();
		agent.beginRound(); agent.setRoundModel('cheap');
		agent.onEvent({ type: 'tool_call', json: { id: 'c1', name: 'get_probe', arguments: '{}' } });
		agent.onEvent({ type: 'done', json: { finish_reason: 'tool_calls' } });
		expect(agent.currentCallCount()).toBe(1);
		agent.requestClose();
		expect(await agent.settleRound()).toBe(true);
		expect(agent.isClosing()).toBe(false);
		agent.beginRound();
		agent.onEvent({ type: 'delta', json: { delta: '答' } });
		expect(await agent.settleRound()).toBe(true);   // 上一轮的 closeRequested 仍在:无调用 → 收口一轮
		agent.beginRound();
		agent.onEvent({ type: 'delta', json: { delta: '终' } });
		expect(await agent.settleRound()).toBe(false);
		expect(agent.trace().rounds.length).toBe(3);
		const plain = mkAgent();
		plain.beginRound(); plain.onEvent({ type: 'delta', json: { delta: '一轮完' } });
		expect(await plain.settleRound()).toBe(false);
		expect(plain.trace().rounds.length).toBe(1);
		expect(plain.trace().rounds[0].model).toBe('cheap');
	});
});
