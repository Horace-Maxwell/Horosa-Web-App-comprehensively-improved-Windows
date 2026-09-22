// M-34 回归:「编辑上一条并分支」的前缀消息必须换新 id,否则 IDB 同键覆盖会把原会话的前半段搬进分支(删分支即永久丢失)。
import { buildEditBranchMessages, buildForkMessages, reusesOriginalIds } from '../aiConversationBranch';

const list = [
	{ id: 'm1', role: 'user', content: 'Q1', conversationId: 'c1' },
	{ id: 'm2', role: 'assistant', content: 'A1', conversationId: 'c1' },
	{ id: 'm3', role: 'user', content: 'Q2', conversationId: 'c1' },
	{ id: 'm4', role: 'assistant', content: 'A2', conversationId: 'c1' },
];

describe('aiConversationBranch', ()=>{
	test('编辑并分支:前缀 + 改写条全部 id:null、挂到分支会话,不沿用任何原主键', ()=>{
		const out = buildEditBranchMessages(list, 2, list[2], 'Q2 改', 'c-branch');
		expect(out.map((m)=>m.content)).toEqual(['Q1', 'A1', 'Q2 改']);
		expect(out.every((m)=>m.id === null)).toBe(true);
		expect(out.every((m)=>m.conversationId === 'c-branch' && m.branchConversationId === 'c-branch')).toBe(true);
		expect(out[2].editedFromMessageId).toBe('m3');
		expect(reusesOriginalIds(out, list)).toBe(false);
		// 原表不被改动
		expect(list[0].id).toBe('m1');
		expect(list[0].conversationId).toBe('c1');
	});
	test('判别向量:旧写法(前缀沿用原 id)必被 reusesOriginalIds 抓到', ()=>{
		const old = list.slice(0, 2).concat({ ...list[2], id: null, content: 'x', conversationId: 'c-branch' });
		expect(reusesOriginalIds(old, list)).toBe(true);
	});
	test('分支(复制到某条为止):与编辑分支同形,含该条本身', ()=>{
		const out = buildForkMessages(list, 1, 'c-branch');
		expect(out.map((m)=>m.content)).toEqual(['Q1', 'A1']);
		expect(out.every((m)=>m.id === null && m.conversationId === 'c-branch')).toBe(true);
	});
});
