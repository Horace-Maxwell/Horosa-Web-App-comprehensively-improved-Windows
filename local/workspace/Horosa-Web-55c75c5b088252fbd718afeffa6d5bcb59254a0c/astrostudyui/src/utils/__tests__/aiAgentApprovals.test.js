// AI 助手·审批台按消息键建表(D23/D26/D32):
//  D23 「本会话不再问 / 永久放行」按名落定只在本消息键内 —— 此前跨作用域把后台任务/外部客户端的同名待审一并静默批准;
//  D26 表键 = messageKey::callId —— 文本协议 callId 缺省 c1/c2…,目标任务与对话轮并发同 id 会互相顶掉(先到者永不落定);
//  D32 落定原因(user/timeout/abort)可读 —— 桥按原因出码,不再用「耗时 ≥ 预算」猜。
import { requestApproval, resolveApproval, resolveApprovalsByName, listPendingApprovals, approvalReasonOf, __resetApprovalsForTests } from '../aiAgent/approvals';
import { requestElicitation, resolveElicitation, declineElicitation, listPendingElicitations, __resetElicitationsForTests } from '../aiAgent/elicitations';

const flush = ()=>new Promise((r)=>setTimeout(r, 0));
const settled = (p)=>Promise.race([p.then((v)=>({ done: true, v })), flush().then(()=>({ done: false }))]);

beforeEach(()=>{ __resetApprovalsForTests(); __resetElicitationsForTests(); });

describe('[D23] 按名落定只在本消息键内', ()=>{
	it('对话键与 task:/mcp: 键各挂一条同名写入:会话钮按对话键落定 ⇒ 另两条仍 pending', async ()=>{
		const p1 = requestApproval('msg-1', { callId: 'c1', name: 'create_chart_record', args: {} });
		const p2 = requestApproval('task:t9', { callId: 'c1', name: 'create_chart_record', args: {} });
		const p3 = requestApproval('mcp:codex', { callId: 'mcp-9', name: 'create_chart_record', args: {} });
		expect(listPendingApprovals().length).toBe(3);
		const n = resolveApprovalsByName('create_chart_record', true, 'msg-1');
		expect(n).toBe(1);
		expect((await settled(p1))).toEqual({ done: true, v: true });
		expect((await settled(p2)).done).toBe(false);
		expect((await settled(p3)).done).toBe(false);
		expect(listPendingApprovals('task:t9').length).toBe(1);
		expect(listPendingApprovals('mcp:codex').length).toBe(1);
	});
	it('同键两条同名并行待审:一次会话钮两条都落定(P1 语义不变)', async ()=>{
		const p1 = requestApproval('msg-1', { callId: 'c1', name: 'create_chart_record', args: {} });
		const p2 = requestApproval('msg-1', { callId: 'c2', name: 'create_chart_record', args: {} });
		expect(resolveApprovalsByName('create_chart_record', true, 'msg-1')).toBe(2);
		expect(await p1).toBe(true); expect(await p2).toBe(true);
	});
	it('不传 messageKey(旧签名) ⇒ 跨键落定,行为与修前相同(只有测试/旧调用方会这样用)', async ()=>{
		const p1 = requestApproval('msg-1', { callId: 'c1', name: 'x', args: {} });
		const p2 = requestApproval('task:t', { callId: 'c7', name: 'x', args: {} });
		expect(resolveApprovalsByName('x', false)).toBe(2);
		expect(await p1).toBe(false); expect(await p2).toBe(false);
	});
});

describe('[D26] 表键 messageKey::callId', ()=>{
	it('两个消息键同 callId c1:各自落定、互不顶掉', async ()=>{
		const p1 = requestApproval('msg-1', { callId: 'c1', name: 'a', args: {} });
		const p2 = requestApproval('task:t9', { callId: 'c1', name: 'b', args: {} });
		expect(listPendingApprovals().length).toBe(2);
		expect(resolveApproval('c1', true, 'msg-1')).toBe(true);
		expect(await p1).toBe(true);
		expect((await settled(p2)).done).toBe(false);
		expect(resolveApproval('c1', false, 'task:t9')).toBe(true);
		expect(await p2).toBe(false);
	});
	it('abort 信号只撤本键条目;被撤条目 promise 落定 false(不再悬挂)', async ()=>{
		const ac = new AbortController();
		const p1 = requestApproval('msg-1', { callId: 'c1', name: 'a', args: {}, signal: ac.signal });
		const p2 = requestApproval('task:t9', { callId: 'c1', name: 'a', args: {} });
		ac.abort();
		expect(await p1).toBe(false);
		expect(approvalReasonOf('msg-1', 'c1')).toBe('abort');
		expect((await settled(p2)).done).toBe(false);
		expect(listPendingApprovals('task:t9').length).toBe(1);
	});
	it('反问台同纪律:两键同 callId 各自作答;拒绝只落本键', async ()=>{
		const p1 = requestElicitation('msg-1', { callId: 'q1', question: '甲?' });
		const p2 = requestElicitation('task:t9', { callId: 'q1', question: '乙?' });
		expect(listPendingElicitations().length).toBe(2);
		expect(resolveElicitation('q1', { answer: 'A' }, 'msg-1')).toBe(true);
		expect((await p1).answer).toBe('A');
		expect((await settled(p2)).done).toBe(false);
		expect(declineElicitation('q1', 'task:t9')).toBe(true);
		expect((await p2).declined).toBe(true);
		expect(listPendingElicitations().length).toBe(0);
	});
});

describe('[D32] 落定原因', ()=>{
	it('用户点允许/跳过 ⇒ user;到点 ⇒ timeout;abort ⇒ abort', async ()=>{
		jest.useFakeTimers();
		try{
			const p1 = requestApproval('mcp:codex', { callId: 'mcp-1', name: 'a', args: {} }, { timeoutMs: 1000 });
			resolveApproval('mcp-1', false, 'mcp:codex');
			expect(await p1).toBe(false);
			expect(approvalReasonOf('mcp:codex', 'mcp-1')).toBe('user');
			const p2 = requestApproval('mcp:codex', { callId: 'mcp-2', name: 'a', args: {} }, { timeoutMs: 1000 });
			jest.advanceTimersByTime(1001);
			expect(await p2).toBe(false);
			expect(approvalReasonOf('mcp:codex', 'mcp-2')).toBe('timeout');
			expect(approvalReasonOf('mcp:codex', 'nope')).toBe(null);
		}finally{ jest.useRealTimers(); }
	});
	it('到点前点「跳过」但定时器随后到点:原因仍是 user(不会被后到的定时器改写)', async ()=>{
		jest.useFakeTimers();
		try{
			const p = requestApproval('mcp:codex', { callId: 'mcp-3', name: 'a', args: {} }, { timeoutMs: 1000 });
			jest.advanceTimersByTime(999);
			resolveApproval('mcp-3', false, 'mcp:codex');
			jest.advanceTimersByTime(5);
			expect(await p).toBe(false);
			expect(approvalReasonOf('mcp:codex', 'mcp-3')).toBe('user');
		}finally{ jest.useRealTimers(); }
	});
});
