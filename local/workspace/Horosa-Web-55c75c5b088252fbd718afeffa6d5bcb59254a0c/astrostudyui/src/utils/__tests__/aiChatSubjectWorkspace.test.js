// 命主工作区(A6)聚合合同:按当前源 cid 聚合对话(sourceRef.id)/记忆(subject.cid)/账本动作(涉及该 cid)/资料(名字含命主名,弱关联);无源 → 全空;与各处数据同一份不改写。
import { aggregateSubject } from '../../components/aianalysis/chat/SubjectWorkspaceDrawer';

it('🔴 聚合:对话按 sourceRef、记忆按 subject.cid、动作按含 cid、资料按名字含标题;无源全空;对话按 updatedAt 降序', ()=>{
	const source = { id: 'local-1', title: '张三' };
	const conversations = [{ id: 'c1', title: 'a', sourceRef: { id: 'local-1' }, updatedAt: '2026-09-01' }, { id: 'c2', title: 'b', sourceRef: { id: 'local-2' } }, { id: 'c3', title: 'c', sourceRef: { id: 'local-1' }, updatedAt: '2026-09-05' }];
	const memories = [{ id: 'aimem:1', subject: { type: 'chart', cid: 'local-1' }, text: 'x' }, { id: 'aimem:2', subject: { type: 'user' }, text: 'y' }];
	const actions = [{ id: 'a1', tool: 'create_chart_record', summary: '建档', undo: { actionId: 'a1', payload: { cid: 'local-1' } } }, { id: 'a2', tool: 'set_settings', summary: '改设置', args: { facet: 'chart' } }];
	const materials = [{ id: 'm1', name: '张三名单.txt' }, { id: 'm2', name: '其它.txt' }];
	const agg = aggregateSubject({ source, conversations, memories, actions, materials });
	expect(agg.conversations.map((c)=>c.id)).toEqual(['c3', 'c1']);
	expect(agg.memories.map((m)=>m.id)).toEqual(['aimem:1']);
	expect(agg.actions.map((a)=>a.id)).toEqual(['a1']);
	expect(agg.materials.map((m)=>m.id)).toEqual(['m1']);
	expect(aggregateSubject({ source: null, conversations, memories, actions, materials })).toEqual({ conversations: [], memories: [], actions: [], materials: [] });
});
