// 常驻状态栏(A2;借鉴 Codex /status、Claude Code /cost):输入框上方一行小芯片——
// 模型 · 审批档/行动关 · 挂载 N 字/预算 M(超预算红、裁剪橙,点击开挂载抽屉)· 本会话 $ · 缓存命中 % · 上下文≈k% · 策略预设 · 命主▸ · 已压缩 N 条(点击查看摘要;弹窗里可取消)。
// 纯展示:全部数字由钩子算好传入(computeSessionStats/estimateContextPct 与气泡同口径);data-* 供自动化机读;uiPrefs chatAssist.statusBar=false 可关。
import React from 'react';

export const PRESET_LABELS = { legacy: '现状', window: '窗口', economy: '经济', custom: '自定义' };
export const APPROVAL_LABELS = { never: '全自动', 'on-request': '每次确认', 'read-only': '只读' };

function Chip({ children, title, onClick, tone, attr }){
	const color = tone === 'danger' ? 'var(--horosa-danger, #d4380d)' : (tone === 'warn' ? 'var(--horosa-warn, #d48806)' : 'var(--horosa-text-soft, #8a8f99)');
	return (
		<span title={title} onClick={onClick} data-tone={tone || 'normal'} {...(attr || {})}
			style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 6px', height: 18, borderRadius: 9, fontSize: 11, lineHeight: '18px', color,
				border: `1px solid ${tone ? color : 'var(--horosa-border, #e5e7eb)'}`, cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
			{children}
		</span>
	);
}

export function fmtCost(costUsd){
	if(costUsd === null || costUsd === undefined || !Number.isFinite(costUsd)){ return '—'; }
	return costUsd < 0.01 ? `$${costUsd.toFixed(4)}` : `$${costUsd.toFixed(2)}`;
}

export default function ChatStatusBar({ visible = true, model, agentEnabled, approvalMode, mount, session, cachePct, contextPct, presetName, subjectTitle, onOpenMount, onOpenSubject, compact, onUncompact, onViewCompact, suggestCompact }){
	if(visible === false){ return null; }
	const m = mount || {};
	const mountTone = m.budget && m.raw > m.budget ? 'danger' : ((m.clipped || m.dropped) ? 'warn' : undefined);
	const mountState = mountTone === 'danger' ? 'over' : (mountTone === 'warn' ? 'clipped' : 'ok');
	const s = session || {};
	return (
		<div data-chat-status-bar="1" data-model={model || ''} data-approval={agentEnabled ? approvalMode || 'never' : 'off'} data-mount-chars={m.kept || 0} data-mount-budget={m.budget || 0} data-mount-state={mountState}
			data-cost={s.costUsd === null || s.costUsd === undefined ? '' : s.costUsd} data-turns={s.turns || 0} data-cache-pct={cachePct === null || cachePct === undefined ? '' : cachePct} data-context-pct={contextPct === null || contextPct === undefined ? '' : contextPct} data-preset={presetName || 'legacy'}
			style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 8px 2px' }}>
			<Chip title="当前模型">{model || '未选模型'}</Chip>
			<Chip title="AI 助手行动能力:关=只对话不动数据;开=按审批档执行写入" attr={{ 'data-chip': 'approval' }}>{agentEnabled ? `审批·${APPROVAL_LABELS[approvalMode] || approvalMode || '全自动'}` : '行动关'}</Chip>
			<Chip title={m.budget ? `挂载 ${m.kept || 0} 字 / 预算 ${m.budget} 字${m.raw && m.raw > m.budget ? `(原始 ${m.raw} 字,超预算已裁)` : ''}${m.dropped ? `,丢弃 ${m.dropped} 层` : ''};点击打开挂载抽屉` : '尚未组装提示词'} tone={mountTone} onClick={onOpenMount} attr={{ 'data-chip': 'mount' }}>
				挂载 {m.kept || 0} 字{m.budget ? ` / ${m.budget}` : ''}
			</Chip>
			<Chip title="本会话累计费用(按接口计价表;无价档=—)" attr={{ 'data-chip': 'cost' }}>本会话 {fmtCost(s.costUsd)}{s.turns ? ` · ${s.turns} 轮` : ''}</Chip>
			<Chip title="最近一轮提示词缓存命中率(前缀稳定才吃缓存)" attr={{ 'data-chip': 'cache' }}>缓存 {cachePct === null || cachePct === undefined ? '—' : `${cachePct}%`}</Chip>
			<Chip title="最近一轮提示词占模型窗口的比例(稳定层+挥发层+保留历史)" attr={{ 'data-chip': 'context' }} tone={contextPct >= 90 ? 'danger' : (contextPct >= 70 ? 'warn' : undefined)}>上下文 {contextPct === null || contextPct === undefined ? '—' : `≈${contextPct}%`}</Chip>
			<Chip title="对话上下文策略(进阶页可改)" attr={{ 'data-chip': 'preset' }}>策略·{PRESET_LABELS[presetName] || presetName || '现状'}</Chip>
			<Chip title={subjectTitle ? `当前命主/案例:${subjectTitle}` : '未挂载案例;点击选择'} onClick={onOpenSubject || onOpenMount} attr={{ 'data-chip': 'subject' }}>{subjectTitle ? `${subjectTitle} ▸` : '命主 ▸'}</Chip>
			{compact && compact.summary ? <Chip title={`已压缩 ${compact.coveredCount || 0} 条对话为摘要(之后只发摘要 + 新消息);点击查看摘要正文,可在弹窗里取消压缩恢复原样`} onClick={typeof onViewCompact === 'function' ? onViewCompact : onUncompact} attr={{ 'data-chip': 'compact', 'data-compact-count': compact.coveredCount || 0 }} tone="warn">已压缩 {compact.coveredCount || 0} 条 · {typeof onViewCompact === 'function' ? '查看' : '取消'}</Chip> : null}
			{suggestCompact ? <Chip title={`保留历史约 ${suggestCompact.tokens} token,已超过你设的提醒阈值 ${suggestCompact.threshold};点击执行 /compact(不会自动压缩;也可输入 /compact <附加要求>)`} onClick={suggestCompact.onRun} tone="warn" attr={{ 'data-chip': 'suggest-compact', 'data-suggest-compact': '1', 'data-suggest-tokens': suggestCompact.tokens == null ? '' : suggestCompact.tokens }}>建议压缩 ▸</Chip> : null}
			{suggestCompact ? <Chip title="本会话不再提醒" onClick={suggestCompact.onDismiss} attr={{ 'data-chip': 'suggest-compact-dismiss' }}>×</Chip> : null}
		</div>
	);
}
