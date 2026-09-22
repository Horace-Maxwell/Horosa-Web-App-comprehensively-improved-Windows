// AI 助手·动作账本面板(进阶页折叠区 / 任务中心):所有写入动作一览(含外部客户端 mcp、目标任务、定时任务、自动规则来源),
// 撤销按钮=用户的权利,这里是对话气泡之外唯一的撤销入口——外部程序经本机服务建的档在这里可见可撤。
// title 由宿主决定(进阶页折叠头已有标题 → 不传;任务中心传「助手动作账本」);≥20 条分页。
import React from 'react';
import { Button, Select, Tag, Pagination, message } from 'antd';
import { listActions, undoAction, subscribeLedger, LEDGER_MAX } from '../../utils/aiTools/ledger';
import { getErrorMeta } from '../../utils/aiTools/errorCodes';
import { advStyles as styles } from './chat/AdvCard';

export const ORIGIN_LABELS = { 'in-app': '对话', mcp: '外部客户端', goal: '目标任务', scheduled: '定时任务', automation: '自动规则' };
const ORIGIN_OPTIONS = [{ value: 'all', label: '全部来源' }].concat(Object.keys(ORIGIN_LABELS).map((k)=>({ value: k, label: ORIGIN_LABELS[k] })));
const PAGE_SIZE = 20;

function fmtAt(at){
	const d = at ? new Date(at) : null;
	if(!d || Number.isNaN(d.getTime())){ return `${at || ''}`; }
	const p = (n)=>(n < 10 ? '0' : '') + n;
	return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// [Q-294/M-109·AR-12] 缺省按账本容量全量分页(LEDGER_MAX=200;每页 20):此前缺省只列最近 50 条,同来源超 50 条时更早的外部客户端写入无处撤销
export default function ActionLedgerPanel({ limit = LEDGER_MAX, title = null }){
	const [origin, setOrigin] = React.useState('all');
	const [page, setPage] = React.useState(1);
	const [tick, setTick] = React.useState(0);
	React.useEffect(()=>subscribeLedger(()=>setTick((n)=>n + 1)), []);
	const rows = React.useMemo(()=>listActions().filter((a)=>origin === 'all' || `${a.origin || 'in-app'}` === origin).slice(0, limit), [origin, tick, limit]);
	const paged = rows.length > PAGE_SIZE ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : rows;

	function handleUndo(a){
		const r = undoAction(a.id);
		if(!r.ok){ message.warning(getErrorMeta(r.code).userText || `撤销未生效(${r.code || '未知'})`); return; }
		message.success('已撤销');
		setTick((n)=>n + 1);
	}

	return (
		<div data-action-ledger-panel="1" className={styles.subPanel}>
			<div className={styles.subhead}>
				<div className={styles.soft}>{title ? <span className={styles.subtitle}>{title} </span> : null}对话内、外部客户端与任务做过的写入动作;撤销只能在这里或气泡下由你点按钮。</div>
				<Select size="small" value={origin} data-ledger-origin="1" onChange={(v)=>{ setOrigin(v); setPage(1); }} options={ORIGIN_OPTIONS} style={{ width: 130 }} />
			</div>
			{rows.length ? (
				<div className={styles.stack}>
					{paged.map((a)=>{
						const o = `${a.origin || 'in-app'}`;
						const canUndo = !a.undone && a.undo && a.undo.kind && a.undo.kind !== 'none';
						return (
							<div key={a.id} data-ledger-row={o} className={[styles.ledgerRow, a.undone ? styles.ledgerRowDone : ''].filter(Boolean).join(' ')}>
								<span className={styles.soft}>{fmtAt(a.at)}</span>
								<Tag color={o === 'mcp' ? 'gold' : undefined} style={{ margin: 0 }} className={styles.ellipsis}>{ORIGIN_LABELS[o] || o}{a.clientName ? `·${a.clientName}` : ''}</Tag>
								<span className={styles.ellipsis} title={a.tool}>{a.tool}</span>
								<span className={styles.ellipsis} title={a.summary}>{a.summary}</span>
								{a.undone ? <Tag style={{ margin: 0 }}>已撤销</Tag> : (canUndo ? <Button size="small" danger data-ledger-undo={a.id} onClick={()=>handleUndo(a)}>撤销</Button> : <span />)}
							</div>
						);
					})}
					{rows.length > PAGE_SIZE ? <div data-ledger-pagination="1" style={{ display: 'contents' }}><Pagination size="small" simple current={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} /></div> : null}
				</div>
			) : (
				<div className={styles.soft} data-ledger-empty="1">暂无动作记录</div>
			)}
		</div>
	);
}
