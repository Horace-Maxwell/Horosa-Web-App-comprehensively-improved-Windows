// AI 助手·写前 before→after 预览(借鉴 Claude Code 写文件前的 diff 确认):审批档「每次确认」时,待审条目下方展示
// 工具自报的预览(set_settings=设置面当前值 vs 改后值;建档=归一后的记录字段)。纯展示零副作用;无预览则不渲染。
import React from 'react';
import { diffHunks, diffSummary } from '../../utils/aiChat/textDiff';

const box = { border: '1px solid var(--horosa-border, #e3e3e8)', borderRadius: 6, padding: '6px 8px', fontSize: 12, lineHeight: 1.6, background: 'var(--horosa-bg-soft, #fafafa)', maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
const lineStyle = { eq: { color: 'var(--horosa-text-soft, #8a8f99)' }, add: { color: 'var(--horosa-success, #2f9e44)', background: 'rgba(47,158,68,0.08)' }, del: { color: 'var(--horosa-danger, #d4380d)', background: 'rgba(212,56,13,0.08)', textDecoration: 'line-through' } };
const MARK = { eq: '  ', add: '+ ', del: '- ' };

export default function AgentDiffPreview({ preview }){
	if(!preview || typeof preview !== 'object'){ return null; }
	const before = `${preview.before || ''}`;
	const after = `${preview.after || ''}`;
	if(!before && !after){ return null; }
	const sum = diffSummary(before, after);
	const rows = before ? diffHunks(before, after, 1) : after.split('\n').map((a, idx)=>({ t: 'add', a, idx }));
	return (
		<div data-agent-diff="1" data-diff-add={sum.add} data-diff-del={sum.del} style={{ margin: '4px 0 6px 22px', '--horosa-scroll-safe-bottom': '4px' }}>{/* 预览框是气泡内的小滚动框,不吃页级底栏滚动安全区(82px 底衬) */}
			<div style={{ fontSize: 12, color: 'var(--horosa-text-soft, #8a8f99)', marginBottom: 4 }}>
				{preview.title ? `${preview.title} · ` : ''}{before ? `改动预览:+${sum.add} / −${sum.del} 行` : '将写入的内容'}
			</div>
			<div style={box}>
				{rows.length ? rows.map((r)=>(<div key={r.idx} style={lineStyle[r.t] || lineStyle.eq}>{MARK[r.t] || '  '}{r.a}</div>)) : <div style={lineStyle.eq}>(无差异)</div>}
			</div>
		</div>
	);
}
