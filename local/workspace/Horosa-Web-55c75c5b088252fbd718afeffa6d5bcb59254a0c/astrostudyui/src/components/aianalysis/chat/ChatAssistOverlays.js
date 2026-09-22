// 对话交互增强的浮层宿主(状态详情 / 旁问面板 / 回退确认 / 命主工作区抽屉 / 计划卡 / 继续对话 / 诊断 / 压缩摘要 统一挂在这里;技能包编辑器住 SkillPackPanel 卡内)。
// 全部浮层关闭时渲染 null,页面 DOM 与缺席本组件时逐字节相同。
import React from 'react';
import { Modal, Button } from 'antd';
import SideQuestionPanel from './SideQuestionPanel';
import RewindConfirmModal from './RewindConfirmModal';
import SubjectWorkspaceDrawer from './SubjectWorkspaceDrawer';
import PlanCard from './PlanCard';
import DoctorPanel from './DoctorPanel';
import { Switch } from 'antd';

// [批二⑪] /resume:最近 5 个对话 + 「启动时自动继续上次」开关(缺省关;打开浮层不写键,只在拨开关时写)
function ResumePanel({ resume }){
	const r = resume || {};
	if(!r.open){ return null; }
	const items = Array.isArray(r.items) ? r.items : [];
	return (
		<Modal title="继续上次对话" open visible onCancel={r.onClose} footer={null} width={460}>
			<div data-resume-panel="1" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
				<label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<Switch size="small" checked={!!r.pref} data-resume-pref="1" onChange={(v)=>{ if(typeof r.onTogglePref === 'function'){ r.onTogglePref(!!v); } }} />
					<span>启动时自动继续上次对话</span>
				</label>
				{items.length ? items.map((c)=>(
					<div key={c.id} data-resume-item={c.id} data-active={r.activeId === c.id ? '1' : '0'} onClick={()=>{ if(typeof r.onOpen === 'function'){ r.onOpen(c); } }}
						style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: r.activeId === c.id ? 'var(--horosa-surface-2, rgba(127,127,127,0.12))' : 'transparent' }}>
						<span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || '(未命名对话)'}{c.sourceRef && c.sourceRef.title ? <span style={{ color: 'var(--horosa-text-soft, #8a8f99)' }}> · {c.sourceRef.title}</span> : null}</span>
						<span style={{ flex: '0 0 auto', color: 'var(--horosa-text-soft, #8a8f99)' }}>{`${c.updatedAt || c.createdAt || ''}`.slice(0, 16).replace('T', ' ')}</span>
					</div>
				)) : <div style={{ color: 'var(--horosa-text-soft, #8a8f99)' }}>还没有对话</div>}
			</div>
		</Modal>
	);
}

// [A3] /status:展开本会话状态(与状态栏同一口径的数字)
function StatusDetail({ statusDetail }){
	const sd = statusDetail || {};
	if(!sd.open){ return null; }
	const s = sd.session || {};
	const rows = [
		['模型', sd.model || '—'],
		['行动能力', sd.agentState ? (sd.agentState.enabled ? `开 · 审批 ${sd.agentState.approval}` : '关') : '—'],
		['本会话轮数', `${s.turns || 0}`],
		['本会话费用', s.costUsd != null ? `$${Number(s.costUsd).toFixed(4)}` : '—'],
		['缓存命中', s.lastCachePct != null ? `${s.lastCachePct}%` : '—'],
		['上下文占用', sd.contextPct != null ? `≈${sd.contextPct}%` : '—'],
		['策略预设', sd.presetName || '—'],
		['挂载', sd.clip ? `${sd.clip.totalKept} 字 / 预算 ${sd.clip.maxChars}${sd.clip.clippedCount ? ` · 裁剪 ${sd.clip.clippedCount}` : ''}` : '—'],
		['压缩', sd.compact && sd.compact.summary ? `已压缩 ${sd.compact.coveredCount || 0} 条(摘要 ${`${sd.compact.summary}`.length} 字;状态栏「查看」可读全文)` : '未压缩'],
	];
	return (
		<Modal title="本会话状态" open visible onCancel={sd.onClose} footer={null} width={420}>
			<div data-status-detail="1" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
				{rows.map(([k, v])=>(<div key={k} style={{ display: 'flex', gap: 10 }}><span style={{ flex: '0 0 96px', color: 'var(--horosa-text-soft, #8a8f99)' }}>{k}</span><span>{v}</span></div>))}
			</div>
		</Modal>
	);
}

// [2026-09-11] 压缩摘要:状态栏「已压缩 N 条 · 查看」→ 看摘要正文(此前只有「取消」,摘要正文没有任何地方能看到);弹窗里可取消压缩
function CompactSummary({ compactView }){
	const cv = compactView || {};
	if(!cv.open){ return null; }
	const c = cv.compact || {};
	return (
		<Modal title={`对话摘要(已压缩 ${c.coveredCount || 0} 条)`} open visible onCancel={cv.onClose} width={560}
			footer={[<Button key="uncompact" danger data-compact-uncompact="1" onClick={()=>{ if(typeof cv.onUncompact === 'function'){ cv.onUncompact(); } if(typeof cv.onClose === 'function'){ cv.onClose(); } }}>取消压缩(恢复原样)</Button>, <Button key="close" type="primary" onClick={cv.onClose}>关闭</Button>]}>
			<div data-compact-summary="1" style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, lineHeight: 1.7, maxHeight: 'calc(60 * var(--horosa-lvh, 1vh))', overflowY: 'auto' }}>{c.summary || '(空)'}</div>
			<div style={{ marginTop: 8, fontSize: 11, color: 'var(--horosa-text-soft, #8a8f99)' }}>{c.model ? `摘要模型:${c.model}` : ''}{c.uptoCreatedAt ? ` · 压缩点:${`${c.uptoCreatedAt}`.slice(0, 16).replace('T', ' ')}` : ''} · 之后每轮只发「摘要 + 压缩点之后的消息」;消息本身从不删除</div>
		</Modal>
	);
}

export default function ChatAssistOverlays(props){
	const p = props || {};
	const anyOpen = (p.statusDetail && p.statusDetail.open) || (p.side && p.side.open) || (p.rewind && p.rewind.open) || (p.subject && p.subject.open) || (p.plan && p.plan.open) || (p.resume && p.resume.open) || (p.doctor && p.doctor.open) || (p.compactView && p.compactView.open);
	if(!anyOpen){ return null; }
	return (
		<React.Fragment>
			{p.statusDetail && p.statusDetail.open ? <StatusDetail statusDetail={p.statusDetail} /> : null}
			{p.compactView && p.compactView.open ? <CompactSummary compactView={p.compactView} /> : null}
			{p.side && p.side.open ? <SideQuestionPanel open initialQuestion={p.side.initialQuestion} onClose={p.side.onClose} deps={p.side.deps} mainline={p.side.mainline} onMainline={p.side.onMainline} /> : null}
			{p.rewind && p.rewind.open ? <RewindConfirmModal open plan={p.rewind.plan} busy={p.rewind.busy} onCancel={p.rewind.onCancel} onConfirm={p.rewind.onConfirm} onBranch={p.rewind.onBranch} /> : null}
			{p.subject && p.subject.open ? <SubjectWorkspaceDrawer open source={p.subject.source} conversations={p.subject.conversations} materials={p.subject.materials} onClose={p.subject.onClose} onOpenConversation={p.subject.onOpenConversation} /> : null}
			{p.plan && p.plan.open ? <PlanCard open goal={p.plan.goal} plan={p.plan.plan} dropped={p.plan.dropped} busy={p.plan.busy} onApprove={p.plan.onApprove} onEdit={p.plan.onEdit} onCancel={p.plan.onCancel} /> : null}
			{p.resume && p.resume.open ? <ResumePanel resume={p.resume} /> : null}
			{p.doctor && p.doctor.open ? <DoctorPanel open report={p.doctor.report} onClose={p.doctor.onClose} /> : null}
		</React.Fragment>
	);
}
