// 多模型对比卡片(C5):一个 assistant 气泡里并排 N 张候选卡(模型/视角、状态、字数、估价、「采用」);底部「判官打分」「合并为一稿」「停止」;
// 采用后折叠成一行(候选 N 份 · 采用:X),可展开重看。纯展示,动作全部回调到钩子。
import React from 'react';
import { Button, Tag } from 'antd';

const soft = { fontSize: 12, color: 'var(--horosa-text-soft, #8a8f99)' };

export default function BestOfCards({ item, onAdopt, onJudge, onMerge, onStop, busy }){
	const [expanded, setExpanded] = React.useState(false);
	const cands = Array.isArray(item && item.candidates) ? item.candidates : [];
	if(!cands.length){ return null; }
	const bo = (item && item.bestOf) || {};
	const streaming = item.streamStatus === 'streaming' || cands.some((c)=>c.status === 'streaming');
	const adopted = bo.adoptedId ? cands.find((c)=>c.id === bo.adoptedId) : null;
	const collapsed = !!bo.adoptedId && !expanded && !streaming;
	if(collapsed){
		return (
			<div data-bestof="collapsed" data-bestof-adopted={bo.adoptedId} style={{ ...soft, display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0' }}>
				<Tag style={{ margin: 0 }}>多模型 {cands.length} 份</Tag>
				<span>采用:{bo.adoptedId === 'merged' ? '合并稿' : (adopted ? adopted.label : bo.adoptedId)}{bo.judge && bo.judge.model ? ` · 判官 ${bo.judge.model}` : ''}</span>
				<Button size="small" type="link" onClick={()=>setExpanded(true)}>展开候选</Button>
			</div>
		);
	}
	const score = (id)=>{ const r = bo.judge && Array.isArray(bo.judge.reasons) ? bo.judge.reasons.find((x)=>x.id === id) : null; return r ? r.score : null; };
	return (
		<div data-bestof="cards" data-bestof-count={cands.length} style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '4px 0', '--horosa-scroll-safe-bottom': '4px' }}>{/* 候选卡正文是气泡内的小滚动框,不吃页级底栏滚动安全区(82px 底衬) */}
			<div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cands.length, 2)}, minmax(0, 1fr))`, gap: 8 }}>
				{cands.map((c)=>(
					<div key={c.id} data-bestof-card={c.id} data-bestof-status={c.status || ''} style={{ border: `1px solid ${bo.adoptedId === c.id ? 'var(--horosa-primary, #1677ff)' : 'var(--horosa-border, #e5e7eb)'}`, borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
						<div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
							<Tag style={{ margin: 0 }}>{c.id}</Tag>
							<span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.label}>{c.label}</span>
							{score(c.id) != null ? <Tag color={bo.ranking && bo.ranking[0] === c.id ? 'gold' : undefined} style={{ margin: 0 }}>{score(c.id)} 分</Tag> : null}
							<span style={soft}>{c.status === 'streaming' ? '生成中' : (c.status === 'error' ? '失败' : `${`${c.text || ''}`.length} 字`)}{c.elapsedMs ? ` · ${(c.elapsedMs / 1000).toFixed(1)}s` : ''}{c.costUsd != null ? ` · $${c.costUsd.toFixed(4)}` : ''}</span>
							{!streaming && c.status !== 'error' ? <Button size="small" type={bo.adoptedId === c.id ? 'primary' : 'default'} data-bestof-adopt={c.id} onClick={()=>onAdopt && onAdopt(c.id)}>{bo.adoptedId === c.id ? '已采用' : '采用'}</Button> : null}
						</div>
						<div style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6, maxHeight: 260, overflowY: 'auto' }}>{c.text || (c.status === 'error' ? (c.error || '出错') : '…')}</div>
					</div>
				))}
			</div>
			<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
				{streaming ? <Button size="small" danger onClick={()=>onStop && onStop()} data-bestof-stop="1">停止全部</Button> : null}
				{!streaming ? <Button size="small" onClick={()=>onJudge && onJudge()} loading={busy === 'judge'} data-bestof-judge="1">判官打分</Button> : null}
				{!streaming ? <Button size="small" onClick={()=>onMerge && onMerge()} loading={busy === 'merge'} data-bestof-merge="1">合并为一稿</Button> : null}
				{bo.adoptedId && expanded ? <Button size="small" type="link" onClick={()=>setExpanded(false)}>收起</Button> : null}
				{bo.judge && bo.judge.error ? <span style={{ ...soft, color: 'var(--horosa-warn, #d48806)' }}>判官未给出有效结果,已按完成顺序采用第一份</span> : null}
			</div>
		</div>
	);
}
