// AI 助手·反问等待台合同:挂起/作答/拒绝/超时/停止(abort)/按消息键清空/事件通知;绝不永久挂起。
import {
	requestElicitation, resolveElicitation, declineElicitation, listPendingElicitations, subscribeElicitations,
	AGENT_ELICITATION_EVENT, ELICIT_DEFAULT_TIMEOUT_MS, ELICIT_MAX_TIMEOUT_MS, __resetElicitationsForTests,
} from '../aiAgent/elicitations';

beforeEach(()=>{ jest.useFakeTimers(); __resetElicitationsForTests(); });
afterEach(()=>{ jest.useRealTimers(); });

describe('反问等待台', ()=>{
	it('挂起后可列出(按消息键过滤,形状固定);作答 → resolve {answer,choice};列表清空', async ()=>{
		const p = requestElicitation('msg-1', { callId: 'c1', question: '出生时辰?', inputType: 'text', placeholder: 'HH:MM', name: 'ask_user' });
		const p2 = requestElicitation('msg-2', { callId: 'c2', question: '口径?', inputType: 'choice', options: ['整宫', '普拉西德'] });
		expect(listPendingElicitations('msg-1')).toEqual([expect.objectContaining({ callId: 'c1', question: '出生时辰?', inputType: 'text', options: [], placeholder: 'HH:MM', messageKey: 'msg-1' })]);
		expect(listPendingElicitations().length).toBe(2);
		expect(resolveElicitation('c1', { answer: '08:00' })).toBe(true);
		expect(resolveElicitation('c1', { answer: 'again' })).toBe(false);   // 二次作答无效
		await expect(p).resolves.toEqual({ answer: '08:00', choice: undefined });
		expect(resolveElicitation('c2', { answer: '整宫', choice: '整宫' })).toBe(true);
		await expect(p2).resolves.toEqual({ answer: '整宫', choice: '整宫' });
		expect(listPendingElicitations().length).toBe(0);
	});
	it('字符串作答 = answer;拒绝 → {declined:true};未知 callId 返回 false', async ()=>{
		const p = requestElicitation('m', { callId: 'c3', question: 'q' });
		expect(resolveElicitation('c3', '答案')).toBe(true);
		await expect(p).resolves.toEqual({ answer: '答案', choice: undefined });
		const p4 = requestElicitation('m', { callId: 'c4', question: 'q' });
		expect(declineElicitation('c4')).toBe(true);
		await expect(p4).resolves.toEqual({ declined: true });
		expect(declineElicitation('nope')).toBe(false);
	});
	it('超时 → {timeout:true};timeoutMs 封顶 ELICIT_MAX_TIMEOUT_MS;缺省 ELICIT_DEFAULT_TIMEOUT_MS', async ()=>{
		const p = requestElicitation('m', { callId: 'c5', question: 'q', timeoutMs: 1000 });
		jest.advanceTimersByTime(999);
		expect(listPendingElicitations().length).toBe(1);
		jest.advanceTimersByTime(1);
		await expect(p).resolves.toEqual({ timeout: true });
		const pd = requestElicitation('m', { callId: 'c6', question: 'q' });
		jest.advanceTimersByTime(ELICIT_DEFAULT_TIMEOUT_MS - 1);
		expect(listPendingElicitations().length).toBe(1);
		jest.advanceTimersByTime(1);
		await expect(pd).resolves.toEqual({ timeout: true });
		const pm = requestElicitation('m', { callId: 'c7', question: 'q', timeoutMs: ELICIT_MAX_TIMEOUT_MS * 10 });
		jest.advanceTimersByTime(ELICIT_MAX_TIMEOUT_MS);
		await expect(pm).resolves.toEqual({ timeout: true });
	});
	it('🔴 用户停止(abort signal) → {declined:true,aborted:true};已 aborted 的信号立即解开', async ()=>{
		const ac = new AbortController();
		const p = requestElicitation('m', { callId: 'c8', question: 'q', signal: ac.signal });
		ac.abort();
		await expect(p).resolves.toEqual({ declined: true, aborted: true });
		const ac2 = new AbortController(); ac2.abort();
		const p2 = requestElicitation('m', { callId: 'c9', question: 'q', signal: ac2.signal });
		await expect(p2).resolves.toEqual({ declined: true, aborted: true });
		expect(listPendingElicitations().length).toBe(0);
	});
	it('逐条拒绝只解开该条;事件在挂起/解开时各派发一次(D19:按消息键清空的死导出已删,收口只走 abort 信号与逐条拒绝)', async ()=>{
		const fn = jest.fn();
		const off = subscribeElicitations(fn);
		const a = requestElicitation('A', { callId: 'a1', question: 'q' });
		const b = requestElicitation('B', { callId: 'b1', question: 'q' });
		expect(fn).toHaveBeenCalledTimes(2);
		expect(declineElicitation('a1')).toBe(true);
		await expect(a).resolves.toEqual({ declined: true });
		expect(listPendingElicitations().map((x)=>x.callId)).toEqual(['b1']);
		expect(declineElicitation('b1')).toBe(true);
		await expect(b).resolves.toEqual({ declined: true });
		expect(fn).toHaveBeenCalledTimes(4);
		off();
		requestElicitation('C', { callId: 'c1', question: 'q' });
		expect(fn).toHaveBeenCalledTimes(4);
		expect(typeof AGENT_ELICITATION_EVENT).toBe('string');
	});
	it('归一化:question 截 500、options 截 8 且转字符串、inputType 非法回 text、无 callId 自动生成', ()=>{
		requestElicitation('m', { question: 'x'.repeat(600), inputType: 'weird', options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
		const [e] = listPendingElicitations('m');
		expect(e.question.length).toBe(500);
		expect(e.inputType).toBe('text');
		expect(e.options).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
		expect(e.callId).toMatch(/^elicit-/);
	});
});
