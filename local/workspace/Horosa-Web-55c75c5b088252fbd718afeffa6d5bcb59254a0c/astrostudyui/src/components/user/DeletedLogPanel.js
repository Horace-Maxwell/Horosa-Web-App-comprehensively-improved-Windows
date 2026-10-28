import React from 'react';
import { Input } from 'antd';
import { safeLocalStorageGet } from '../../utils/safeStorage';
import { DELETED_LOG_KEY, DELETED_LOG_CAP } from '../../utils/localRecordStore';
import { matchesUserQuery } from '../../utils/scriptMode';

// 回收站弹窗底部的「删除日志」(命盘 / 事盘列表共用):彻底删除、清空回收站、回收站满了挤出去的记录都在这里,可以找回。
// 缺省只列最近几条;「显示全部」列出日志里本库的每一条(可按名字 / 时间搜),不再只露最近 8 条 —— 一次挤出很多条时,
// 多出来的此前在界面上看不见、也找不回。
export const DELETED_LOG_RECENT = 8;

// 删除日志里本库的条目(新删的在前);读不出来当没有
export function readDeletedLogEntries(store){
	try{
		const cur = JSON.parse(safeLocalStorageGet(DELETED_LOG_KEY) || '[]');
		return (Array.isArray(cur) ? cur : []).filter((e)=>e && e.store === store && e.record && typeof e.record === 'object');
	}catch(e){
		return [];
	}
}

// 按描述文字搜(名字、出生 / 起课时间、删除时刻都在描述里);比对经 matchesUserQuery(界面繁体时照屏幕输入繁体也能命中)
export function filterDeletedLogEntries(entries, query, describe){
	const q = `${query || ''}`.trim();
	if(!q){ return entries; }
	return entries.filter((e)=>{
		let text = '';
		try{ text = `${describe(e) || ''}`; }catch(err){ text = ''; }
		return matchesUserQuery(text, q);
	});
}

// props:store 'chart' | 'case';describe(entry) → 一行文字;onRestore(entry) 找回这一条(提示与刷新列表由列表页做)
export default function DeletedLogPanel({ store, describe, onRestore }){
	const [showAll, setShowAll] = React.useState(false);
	const [query, setQuery] = React.useState('');
	const [, setTick] = React.useState(0);
	const entries = readDeletedLogEntries(store);
	if(!entries.length){
		return null;
	}
	const shown = showAll ? filterDeletedLogEntries(entries, query, describe) : entries.slice(0, DELETED_LOG_RECENT);
	const linkStyle = { cursor: 'pointer' };
	return (
		<div data-deleted-log={store} style={{ marginTop: 12, borderTop: '1px solid rgba(128,128,128,0.2)', paddingTop: 8 }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--horosa-text-secondary)', marginBottom: 4, flexWrap: 'wrap' }}>
				<span style={{ flex: 1 }}>
					{`删除日志（彻底删除后的最后防线，这里共 ${entries.length} 条；命盘、事盘合计最多留 ${DELETED_LOG_CAP} 条，满了最早的会被挤掉）：`}
				</span>
				{entries.length > DELETED_LOG_RECENT ? (
					<a href={null} style={linkStyle} data-deleted-log-toggle="1" onClick={(evt)=>{ if(evt && evt.preventDefault){ evt.preventDefault(); } setShowAll(!showAll); }}>
						{showAll ? `只看最近 ${DELETED_LOG_RECENT} 条` : `显示全部（${entries.length} 条）`}
					</a>
				) : null}
			</div>
			{showAll ? (
				<Input
					size="small"
					allowClear
					placeholder="按名字或时间搜"
					value={query}
					onChange={(e)=>setQuery(e && e.target ? e.target.value : '')}
					style={{ marginBottom: 6 }}
				/>
			) : null}
			<div style={showAll ? { maxHeight: 260, overflowY: 'auto' } : undefined}>
				{shown.map((e, i)=>(
					<div key={`${e.record.cid}-${e.purgedAt}-${i}`} data-deleted-log-row="1" style={{ display: 'flex', alignItems: 'center', fontSize: 12, padding: '2px 0' }}>
						<span style={{ flex: 1, opacity: 0.8 }}>{describe(e)}</span>
						<a href={null} style={linkStyle} onClick={(evt)=>{
							if(evt && evt.preventDefault){ evt.preventDefault(); }
							if(typeof onRestore === 'function'){ onRestore(e); }
							setTick((t)=>t + 1);
						}}>找回</a>
					</div>
				))}
				{showAll && !shown.length ? <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)', padding: '2px 0' }}>没有搜到</div> : null}
			</div>
		</div>
	);
}
