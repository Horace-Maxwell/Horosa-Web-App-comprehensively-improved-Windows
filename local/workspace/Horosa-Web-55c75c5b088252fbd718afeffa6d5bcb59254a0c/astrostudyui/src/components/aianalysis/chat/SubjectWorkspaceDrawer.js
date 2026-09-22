// 命主工作区抽屉(A6;借鉴 ChatGPT / Claude Projects):以当前挂载的命盘/事盘为中心,纯聚合——它的对话(sourceRef.id)、记忆(subject.cid)、
// AI 做过的动作(账本里涉及该 cid 的,撤销复用 undoAction)、弱关联资料(名字含命主名)。零业务逻辑,不改任何数据。
import React from 'react';
import { Drawer, Button, Tag, message } from 'antd';
import { listMemories, subscribeMemory, toggleMemory } from '../../../utils/aiChat/memory';
import { listActions, undoAction, subscribeLedger } from '../../../utils/aiTools/ledger';

const soft = { fontSize: 12, color: 'var(--horosa-text-soft, #8a8f99)' };

// 纯聚合(可测):返回 { conversations, memories, actions, materials }
export function aggregateSubject({ source, conversations, memories, actions, materials }){
	if(!source || !source.id){ return { conversations: [], memories: [], actions: [], materials: [] }; }
	const cid = `${source.id}`;
	const title = `${source.title || ''}`.trim();
	return {
		conversations: (conversations || []).filter((c)=>c && c.sourceRef && c.sourceRef.id === cid).sort((a, b)=>`${b.updatedAt || ''}`.localeCompare(`${a.updatedAt || ''}`)),
		memories: (memories || []).filter((m)=>m && m.subject && m.subject.cid === cid),
		actions: (actions || []).filter((a)=>a && JSON.stringify({ args: a.args, undo: a.undo, summary: a.summary }).indexOf(cid) >= 0),
		materials: title ? (materials || []).filter((m)=>m && `${m.name || m.fileName || ''}`.indexOf(title) >= 0) : [],
	};
}

export default function SubjectWorkspaceDrawer({ open, source, conversations, materials, onClose, onOpenConversation }){
	const [memories, setMemories] = React.useState([]);
	const [tick, setTick] = React.useState(0);
	React.useEffect(()=>{ const load = ()=>listMemories().then(setMemories).catch(()=>setMemories([])); load(); return subscribeMemory(load); }, []);
	React.useEffect(()=>subscribeLedger(()=>setTick((n)=>n + 1)), []);
	const agg = React.useMemo(()=>aggregateSubject({ source, conversations, memories, actions: listActions(200), materials }), [source, conversations, memories, materials, tick]);
	return (
		<Drawer title={source ? `命主工作区:${source.title || ''}` : '命主工作区'} placement="right" width={520} open={!!open} visible={!!open} onClose={onClose} data-subject-workspace="1">
			{!source ? <div style={soft}>先在顶栏「选择案例」挂载一个命盘或事盘。</div> : (
				<div data-subject-workspace-body="1" style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
					<section>
						<div style={{ fontWeight: 600 }}>对话 {agg.conversations.length}</div>
						{agg.conversations.length ? agg.conversations.slice(0, 30).map((c)=>(
							<div key={c.id} data-subject-conv={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
								<span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || '未命名对话'}</span>
								<span style={soft}>{`${c.updatedAt || ''}`.slice(0, 10)}</span>
								<Button size="small" type="link" onClick={()=>{ if(typeof onOpenConversation === 'function'){ onOpenConversation(c); } }}>打开</Button>
							</div>
						)) : <div style={soft}>还没有围绕这位命主的对话。</div>}
					</section>
					<section>
						<div style={{ fontWeight: 600 }}>记忆 {agg.memories.length}</div>
						{agg.memories.length ? agg.memories.map((m)=>(
							<div key={m.id} data-subject-memory={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: m.enabled ? 1 : 0.55 }}>
								<Tag style={{ margin: 0 }}>{m.status === 'confirmed' ? '已入库' : '候选'}</Tag>
								<span style={{ flex: '1 1 auto' }}>{m.text}</span>
								{m.status === 'confirmed' ? <Button size="small" type="link" onClick={()=>toggleMemory(m.id, !m.enabled)}>{m.enabled ? '停用' : '启用'}</Button> : null}
							</div>
						)) : <div style={soft}>没有关于这位命主的记忆(进阶页「记忆」可确认候选)。</div>}
					</section>
					<section>
						<div style={{ fontWeight: 600 }}>AI 做过的动作 {agg.actions.length}</div>
						{agg.actions.length ? agg.actions.slice(0, 30).map((a)=>(
							<div key={a.id} data-subject-action={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: a.undone ? 0.55 : 1 }}>
								<Tag style={{ margin: 0 }} color={a.origin === 'mcp' ? 'gold' : undefined}>{a.origin === 'mcp' ? `外部·${a.clientName || ''}` : (a.origin || 'in-app')}</Tag>
								<span style={{ flex: '1 1 auto' }}>{a.tool}:{a.summary}</span>
								<span style={soft}>{`${a.at || ''}`.slice(5, 16).replace('T', ' ')}</span>
								{a.undone ? <Tag style={{ margin: 0 }}>已撤销</Tag> : (a.undo && a.undo.actionId ? <Button size="small" onClick={()=>{ const r = undoAction(a.undo.actionId); if(!r.ok){ message.warning(`撤销未生效(${r.code})`); } }}>撤销</Button> : null)}
							</div>
						)) : <div style={soft}>AI 没有对这位命主做过写入。</div>}
					</section>
					<section>
						<div style={{ fontWeight: 600 }}>相关资料 {agg.materials.length}</div>
						{agg.materials.length ? agg.materials.slice(0, 20).map((m)=>(<div key={m.id} data-subject-material={m.id}>{m.name || m.fileName}</div>)) : <div style={soft}>没有名字里带命主名的资料(弱关联)。</div>}
					</section>
				</div>
			)}
		</Drawer>
	);
}
