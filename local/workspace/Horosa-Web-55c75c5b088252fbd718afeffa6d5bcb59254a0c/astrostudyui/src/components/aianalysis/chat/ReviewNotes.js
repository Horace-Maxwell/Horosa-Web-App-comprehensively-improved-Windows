// 回答审阅批注(C6):批注列表(错误/夸大/漏项/无据 + 原句 + 理由 + 严重度)· 审阅模型(跨家族/同家族)· 是否对拍数据 · 程序核对条数 ·「按批注重写」「再审」;
// 重写稿气泡标「按审阅重写稿」,被替代稿标「已重写」。data-review-* 供机读;零数据层 import。
import React from 'react';
import { Button, Space, Tag, Tooltip, Alert, Spin } from 'antd';
import { REVIEW_KIND_LABELS, reviewSummaryLine } from '../../../utils/aiReview';

export const REVIEW_KIND_COLORS = { error: 'red', exaggeration: 'orange', omission: 'gold', ungrounded: 'purple' };

export default function ReviewNotes({ item, busy, rewriting, onRewrite, onRerun, onStop }){
	const [collapsed, setCollapsed] = React.useState(false);
	if(!item || item.role !== 'assistant'){ return null; }
	const rv = item.review;
	const tags = [];
	if(item.rewriteOf){ tags.push(<Tag key="rw" color="blue" data-review-rewrite-of={item.rewriteOf}>按审阅重写稿(原回答保留在上方)</Tag>); }
	if(item.supersededBy){ tags.push(<Tag key="sb" data-review-superseded-by={item.supersededBy}>已按审阅重写 → 见下方新回答;历史只带新稿</Tag>); }
	if(rewriting && item.rewriteOf && item.streamStatus === 'streaming'){ tags.push(<Button key="stop" size="small" onClick={onStop}>停止重写</Button>); }
	if(!rv && !tags.length){ return null; }
	const issues = rv && Array.isArray(rv.issues) ? rv.issues : [];
	return (
		<div data-review-status={rv ? rv.status : ''} data-review-verdict={rv && rv.verdict ? rv.verdict : ''} data-review-issues={issues.length} style={{ marginTop: 6 }}>
			{tags.length ? <div style={{ marginBottom: rv ? 6 : 0 }}><Space size={4} wrap>{tags}</Space></div> : null}
			{rv && rv.status === 'running' ? <div style={{ fontSize: 12, color: 'var(--horosa-muted, #888)' }}><Spin size="small" /> 审阅中…{rv.model ? `(${rv.model})` : ''}</div> : null}
			{rv && rv.status === 'error' ? <Alert type="warning" showIcon message={`审阅失败:${rv.error || '未知错误'}`} action={<Button size="small" onClick={onRerun} disabled={!!busy}>再审</Button>} /> : null}
			{rv && rv.status === 'done' ? (
				<div style={{ border: '1px solid var(--horosa-border, #e5e5e5)', borderRadius: 6, padding: '6px 10px', background: 'var(--horosa-surface-raised, #fafafa)' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
						<div style={{ fontSize: 12, fontWeight: 600 }}>{rv.verdict === 'ok' ? '✅ ' : '🔍 '}{reviewSummaryLine(rv)}</div>
						<Space size={4} wrap>
							{rv.model ? (
								<Tooltip title={`审阅模型:${rv.profileName ? `${rv.profileName} · ` : ''}${rv.model}(${rv.via === 'route' ? '按任务路由' : (rv.crossFamily ? '另一家族' : '同一模型')})`}>
									<Tag style={{ marginInlineEnd: 0 }}>{rv.crossFamily ? '跨家族' : '同家族'} · {rv.model}</Tag>
								</Tooltip>
							) : null}
							<Tag style={{ marginInlineEnd: 0 }} color={rv.hasData ? 'green' : 'default'}>{rv.hasData ? '已对拍排盘数据' : '未对拍数据'}</Tag>
							{rv.deterministicCount ? <Tag style={{ marginInlineEnd: 0 }} color="volcano">程序核对 {rv.deterministicCount}</Tag> : null}
							{issues.length > 0 ? <Button size="small" type="link" onClick={()=>setCollapsed((c)=>!c)}>{collapsed ? '展开批注' : '收起'}</Button> : null}
						</Space>
					</div>
					{!collapsed && issues.length > 0 ? (
						<ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
							{issues.map((it, i)=>(
								<li key={i} data-review-kind={it.kind}>
									<Tag color={REVIEW_KIND_COLORS[it.kind] || 'default'} style={{ marginInlineEnd: 4 }}>{REVIEW_KIND_LABELS[it.kind] || it.kind}{it.severity ? ` · ${'●'.repeat(Math.max(1, Math.min(3, it.severity)))}` : ''}</Tag>
									{it.quote ? <span style={{ color: 'var(--horosa-muted, #666)' }}>「{it.quote}」:</span> : null}
									<span>{it.reason}</span>
								</li>
							))}
						</ol>
					) : null}
					<div style={{ marginTop: 6 }}>
						<Space size={6} wrap>
							{issues.length > 0 && !item.supersededBy ? <Button size="small" type="primary" onClick={onRewrite} disabled={!!rewriting}>按批注重写</Button> : null}
							<Button size="small" onClick={onRerun} disabled={!!busy}>再审</Button>
						</Space>
					</div>
				</div>
			) : null}
		</div>
	);
}
