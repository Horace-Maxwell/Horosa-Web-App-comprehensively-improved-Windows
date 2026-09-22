// 多技法编排面板(C7):拆解计划(技法 × 子问题 + 拆法说明)· 各子任务卡(状态/耗时/模型/子问题/子回答折叠/子 Turn 只读工具动作条)· 综合置信度;运行中可停止。
// data-orch-* 供机读;零数据层 import。
import React from 'react';
import { Button, Space, Tag, Tooltip } from 'antd';
import AgentActionBar from '../AgentActionBar';

const STATUS_LABEL = { queued: '排队', running: '生成中', done: '完成', error: '失败', aborted: '已停止' };
const STATUS_COLOR = { queued: 'default', running: 'processing', done: 'green', error: 'red', aborted: 'orange' };
const CONF_LABEL = { high: '一致·高置信', medium: '有分歧·可取舍', low: '依据薄弱' };
const CONF_COLOR = { high: 'green', medium: 'gold', low: 'volcano' };

export default function OrchestrationPanel({ item, running, onStop }){
	const [openMap, setOpenMap] = React.useState({});
	const o = item && item.orchestration;
	if(!o){ return null; }
	const subTurns = Array.isArray(o.subTurns) ? o.subTurns : [];
	const live = running && (o.status === 'planning' || o.status === 'running' || o.status === 'synthesizing');
	const stageText = o.status === 'planning' ? '正在拆解计划…' : (o.status === 'running' ? `${subTurns.filter((s)=>s.status === 'done').length}/${subTurns.length} 子任务完成` : (o.status === 'synthesizing' ? '正在综合各技法结论…' : ''));
	return (
		<div data-orch-status={o.status || ''} data-orch-subtasks={subTurns.length} style={{ marginTop: 6, border: '1px solid var(--horosa-border, #e5e5e5)', borderRadius: 6, padding: '6px 10px', background: 'var(--horosa-surface-raised, #fafafa)', fontSize: 12 }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
				<div style={{ fontWeight: 600 }}>🧩 多技法分工{o.plan && o.plan.fallback ? '(规划不可用,各技法各答)' : ''}{stageText ? ` · ${stageText}` : ''}</div>
				<Space size={4} wrap>
					{o.synthesis && o.synthesis.confidence ? <Tag style={{ marginInlineEnd: 0 }} color={CONF_COLOR[o.synthesis.confidence] || 'default'}>{CONF_LABEL[o.synthesis.confidence] || o.synthesis.confidence}{o.synthesis.fallback ? ' · 综合回落' : ''}</Tag> : null}
					{o.models && o.models.subagent ? <Tag style={{ marginInlineEnd: 0 }}>子任务 · {o.models.subagent}</Tag> : null}
					{live ? <Button size="small" onClick={onStop}>停止</Button> : null}
				</Space>
			</div>
			{o.plan && o.plan.note ? <div style={{ color: 'var(--horosa-muted, #888)', marginTop: 4 }}>拆法:{o.plan.note}</div> : null}
			{subTurns.length ? (
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, marginTop: 8 }}>
					{subTurns.map((s, i)=>{
						const open = !!openMap[i];
						const text = `${s.text || ''}`;
						return (
							<div key={i} data-orch-sub={s.technique} data-orch-sub-status={s.status || ''} style={{ border: '1px solid var(--horosa-border, #e5e5e5)', borderRadius: 6, padding: '6px 8px', background: 'var(--horosa-surface, #fff)' }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
									<Space size={4}>
										<Tag color="blue" style={{ marginInlineEnd: 0 }}>{s.label || s.technique}</Tag>
										<Tag color={STATUS_COLOR[s.status] || 'default'} style={{ marginInlineEnd: 0 }}>{STATUS_LABEL[s.status] || s.status || ''}</Tag>
									</Space>
									<span style={{ color: 'var(--horosa-muted, #888)' }}>{s.elapsedMs != null ? `${(s.elapsedMs / 1000).toFixed(1)}s` : ''}{text ? ` · ${text.length} 字` : ''}</span>
								</div>
								<div style={{ marginTop: 4, color: 'var(--horosa-text-soft, #666)' }}>{s.question}</div>
								{s.error ? <div style={{ color: 'var(--horosa-danger, #cf1322)', marginTop: 4 }}>{s.error}</div> : null}
								{text ? (
									<div style={{ marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
										{open || text.length <= 160 ? text : `${text.slice(0, 160)}…`}
										{text.length > 160 ? <Button size="small" type="link" style={{ padding: '0 4px' }} onClick={()=>setOpenMap((m)=>({ ...m, [i]: !open }))}>{open ? '收起' : '展开'}</Button> : null}
									</div>
								) : null}
								{s.trace ? <AgentActionBar trace={s.trace} messageId={`${item.id}::sub${i}`} streaming={s.status === 'running'} /> : null}
							</div>
						);
					})}
				</div>
			) : null}
			{o.synthesis && o.synthesis.disagreements && o.synthesis.disagreements.length ? (
				<Tooltip title="分歧已按各技法主张与依据列在正文末尾的「分歧标注」小节">
					<div style={{ marginTop: 6, color: 'var(--horosa-muted, #888)' }}>分歧 {o.synthesis.disagreements.length} 处 · 见正文末尾「分歧标注」</div>
				</Tooltip>
			) : null}
		</div>
	);
}
