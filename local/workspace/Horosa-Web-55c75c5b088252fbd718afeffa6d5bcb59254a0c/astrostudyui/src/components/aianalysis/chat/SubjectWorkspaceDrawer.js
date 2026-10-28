// 命主工作区抽屉(A6):以当前挂载的命盘/事盘为中心,纯聚合——它的对话(sourceRef.id)、记忆(subject.cid)、
// AI 做过的动作(账本里涉及该 cid 的,撤销复用 undoAction)、弱关联资料(名字含命主名)。零业务逻辑,不改任何数据。
// 另有「命主实况」一节:这张命盘发不发命主实况(与挂载预览卡同一个开关)+「编辑命主实况」(打开命盘列表里的同一份问卷)。
import React from 'react';
import { Drawer, Button, Tag, Switch, message } from 'antd';
import { listMemories, subscribeMemory, toggleMemory } from '../../../utils/aiChat/memory';
import { listActions, undoAction, subscribeLedger } from '../../../utils/aiTools/ledger';
import { setSubjectFactsEnabled } from '../../../utils/subjectFacts';
import { getLocalChart } from '../../../utils/localcharts';
import { getWorkspaceBridge } from '../../../utils/aiTools/workspaceBridge';
import { useSubjectFacts } from './useSubjectFacts';
import { datePartOf } from '../../../utils/dateStrSafe';

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

// 「编辑命主实况」:打开命盘列表「命主实况」图标的同一份问卷抽屉(按库里这条记录;dispatch 缺省取主页登记的工作区桥)
export function openSubjectFactsEditor(source, dispatch){
	const rec = source && source.sourceType === 'chart' && source.record ? source.record : null;
	if(!rec || !rec.cid){ return false; }
	let fresh = null;
	try{ fresh = getLocalChart(rec.cid); }catch(e){ fresh = null; }
	const bridge = getWorkspaceBridge();
	const send = typeof dispatch === 'function' ? dispatch : (bridge && typeof bridge.dispatch === 'function' ? bridge.dispatch : null);
	if(!send){ message.warning('暂时打不开问卷:请到命盘列表点这张盘的「命主实况」图标'); return false; }
	send({ type: 'astro/openDrawer', payload: { key: 'chartdeeplearn', record: fresh || rec } });
	return true;
}

export default function SubjectWorkspaceDrawer({ open, source, conversations, materials, onClose, onOpenConversation, dispatch }){
	const facts = useSubjectFacts(source, open);
	const [memories, setMemories] = React.useState([]);
	const [tick, setTick] = React.useState(0);
	React.useEffect(()=>{ const load = ()=>listMemories().then(setMemories).catch(()=>setMemories([])); load(); return subscribeMemory(load); }, []);
	React.useEffect(()=>subscribeLedger(()=>setTick((n)=>n + 1)), []);
	const agg = React.useMemo(()=>aggregateSubject({ source, conversations, memories, actions: listActions(200), materials }), [source, conversations, memories, materials, tick]);
	return (
		<Drawer title={source ? `命主工作区:${source.title || ''}` : '命主工作区'} placement="right" width={520} open={!!open} visible={!!open} onClose={onClose} data-subject-workspace="1">
			{!source ? <div style={soft}>先在顶栏「选择案例」挂载一个命盘或事盘。</div> : (
				<div data-subject-workspace-body="1" style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
					<section data-subject-facts-section="1">
						<div style={{ fontWeight: 600 }}>命主实况 {facts.facts.count}</div>
						{facts.cid ? (
							<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
								<span style={{ flex: '1 1 auto' }}>{facts.facts.count ? (facts.enabled ? `发给 AI:${facts.facts.count} 项` : `${facts.facts.count} 项,未发送`) : '还没有填写'}</span>
								<span style={soft}>发给 AI</span>
								<Switch size="small" checked={!!facts.enabled} data-subject-facts-switch={facts.enabled ? 'on' : 'off'} onChange={(on)=>setSubjectFactsEnabled(facts.cid, on)} />
								<Button size="small" type="link" data-subject-facts-edit="1" onClick={()=>{ if(openSubjectFactsEditor(source, dispatch) && typeof onClose === 'function'){ onClose(); } }}>编辑命主实况</Button>
							</div>
						) : <div style={soft}>只有已存档的命盘有命主实况(事盘与即时起盘没有)。</div>}
					</section>
					<section>
						<div style={{ fontWeight: 600 }}>对话 {agg.conversations.length}</div>
						{agg.conversations.length ? agg.conversations.slice(0, 30).map((c)=>(
							<div key={c.id} data-subject-conv={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
								<span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || '未命名对话'}</span>
								<span style={soft}>{datePartOf(`${c.updatedAt || ''}`)}</span>
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
