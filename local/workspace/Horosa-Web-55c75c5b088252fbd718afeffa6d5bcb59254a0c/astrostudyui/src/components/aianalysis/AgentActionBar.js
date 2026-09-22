// AI 助手·动作条(借鉴 Codex 的 Item 列表):一个 assistant 气泡下方,按轮列出模型发起的工具动作——
// 状态图标 · 中文标签 · 摘要 · 「撤销」(仅写入类且已完成;撤销只能用户点按钮,AI 无任何软删路径) ·
// 审批档下的「允许/跳过」· 反问(ask_user)的作答行 · 展开参数/结果。总开关关时只读折叠(历史留痕仍可撤销)。
import React from 'react';
import { listUiTrail, undoUiTrail, subscribeUiTrail } from '../../utils/aiAgent/uiTrail';
import { Button, Tag, Input, message } from 'antd';
import { undoAction } from '../../utils/aiTools/ledger';
import { getErrorMeta } from '../../utils/aiTools/errorCodes';
import { isAgentEnabled, subscribeAgentPrefs, getToolPolicy, setToolPolicy } from '../../utils/aiAgent/prefs';
import { listPendingApprovals, resolveApproval, resolveApprovalsByName, subscribeApprovals } from '../../utils/aiAgent/approvals';
import { allowToolForSession } from '../../utils/aiAgent/sessionAllow';
import { listPendingElicitations, resolveElicitation, declineElicitation, subscribeElicitations } from '../../utils/aiAgent/elicitations';
import styles from './AgentActionBar.less';
import { AGENT_TOOL_LABELS, toolLabel } from '../../utils/aiTools/labels';
import AgentDiffPreview from './AgentDiffPreview';

// 标签单源在 utils/aiTools/labels.js(面板「按工具名放行·禁用」同用);这里保留同名导出以免既有引用断链
export { AGENT_TOOL_LABELS };
const STATUS_ICON = { running: '◌', completed: '✓', failed: '✕', skipped: '–', undone: '↶' };

function labelOf(name){ return toolLabel(name); }

function safeJson(v){
	try{ return typeof v === 'string' ? v : JSON.stringify(v, null, 1); }catch(e){ return `${v}`; }
}

export function markResultUndone(trace, actionId){
	if(!trace || !Array.isArray(trace.rounds)){ return trace; }
	return {
		...trace,
		rounds: trace.rounds.map((r)=>({ ...r, results: (r.results || []).map((x)=>(x.undo && x.undo.actionId === actionId ? { ...x, status: 'undone', undone: true } : x)) })),
	};
}

// 撤销失败文案:一律取错误码单一真源的 userText;表里没有的码(如运行时内部码)才用兜底
export function undoFailText(code){
	const meta = getErrorMeta(code);
	if(meta && meta.userText){ return meta.userText; }
	if(code === 'E_UNDO_ALREADY'){ return '该动作已撤销过'; }
	return `撤销未生效(${code || '未知'})`;
}

// 反问作答行:text=输入框+提交;choice/confirm=逐项按钮;都可「拒绝」。data-* 供 自动化驱动器机读
function ElicitationRow({ elicit }){
	const [text, setText] = React.useState('');
	const isText = elicit.inputType === 'text';
	return (
		<div className={styles.detail} data-agent-elicitation="1" data-call-id={elicit.callId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
			<div>{elicit.question}</div>
			{isText ? (
				<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
					<Input size="small" data-role="answer" placeholder={elicit.placeholder || '请输入'} value={text} onChange={(e)=>setText(e.target.value)} onPressEnter={()=>{ if(text.trim()){ resolveElicitation(elicit.callId, { answer: text.trim() }, elicit.messageKey); } }} style={{ maxWidth: 320 }} />
					<Button size="small" type="primary" data-role="submit" disabled={!text.trim()} onClick={()=>resolveElicitation(elicit.callId, { answer: text.trim() }, elicit.messageKey)}>提交</Button>
					<Button size="small" data-role="decline" onClick={()=>declineElicitation(elicit.callId, elicit.messageKey)}>拒绝</Button>
				</div>
			) : (
				<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
					{(elicit.options || []).map((opt)=>(
						<Button key={opt} size="small" data-role="choice" onClick={()=>resolveElicitation(elicit.callId, { answer: opt, choice: opt }, elicit.messageKey)}>{opt}</Button>
					))}
					<Button size="small" data-role="decline" onClick={()=>declineElicitation(elicit.callId, elicit.messageKey)}>拒绝</Button>
				</div>
			)}
		</div>
	);
}

export default function AgentActionBar({ trace, messageId, streaming, onTraceChange, onUndone }){
	const [open, setOpen] = React.useState(true);
	const [expanded, setExpanded] = React.useState({});
	const [enabled, setEnabled] = React.useState(()=>isAgentEnabled());
	const [pendingTick, setPendingTick] = React.useState(0);
	React.useEffect(()=>subscribeAgentPrefs((d)=>setEnabled(!!(d && d.enabled))), []);
	React.useEffect(()=>subscribeApprovals(()=>setPendingTick((n)=>n + 1)), []);
	React.useEffect(()=>subscribeElicitations(()=>setPendingTick((n)=>n + 1)), []);
	// [批五] 界面操作轨迹(导航/合盘配对,不进账本):只列本 Turn 的,每条可「回到上一页 / 上一对」
	const [trailTick, setTrailTick] = React.useState(0);
	React.useEffect(()=>subscribeUiTrail(()=>setTrailTick((n)=>n + 1)), []);
	const uiTrail = trace && trace.turnId ? listUiTrail({ turnId: trace.turnId }) : [];
	const rounds = trace && Array.isArray(trace.rounds) ? trace.rounds : [];
	const results = [];
	rounds.forEach((r, ri)=>{ (r.results || []).forEach((x)=>results.push({ ...x, roundIndex: ri, roundText: r.text, roundModel: r.model || '' })); });
	// [C4] 按任务用模型:各轮模型不止一种时,轮头带模型徽章(全同=不显示,零变化)
	const roundModels = Array.from(new Set(rounds.map((r)=>r.model || '').filter(Boolean)));
	const showRoundModel = roundModels.length > 1;
	if(!results.length){ return null; }
	const pending = listPendingApprovals(messageId);
	const pendingIds = new Set(pending.map((p)=>p.callId));
	const pendingById = {};
	pending.forEach((p)=>{ pendingById[p.callId] = p; });
	const elicits = listPendingElicitations(messageId);
	const doneCount = results.filter((x)=>x.status === 'completed').length;
	const failCount = results.filter((x)=>x.status === 'failed').length;

	function handleUndo(x){
		const r = undoAction(x.undo.actionId);
		if(!r.ok){
			message.warning(undoFailText(r.code));
			return;
		}
		message.success('已撤销');
		if(typeof onTraceChange === 'function'){ onTraceChange(markResultUndone(trace, x.undo.actionId)); }
		if(typeof onUndone === 'function'){ try{ onUndone(r); }catch(e){ /* noop */ } }
	}

	return (
		<div className={styles.bar} data-agent-action-bar="1" data-pending-tick={pendingTick}>
			{trace && Array.isArray(trace.todos) && trace.todos.length ? (
				<div data-agent-todos="1" data-todos-done={trace.todos.filter((t)=>t.status === 'done').length} data-todos-total={trace.todos.length} style={{ padding: '4px 8px 2px', fontSize: 12, lineHeight: 1.7 }}>
					<div style={{ color: 'var(--horosa-text-soft, #8a8f99)' }}>进度 {trace.todos.filter((t)=>t.status === 'done').length}/{trace.todos.length}</div>
					{trace.todos.map((t, i)=>(<div key={i} data-todo-status={t.status} style={{ display: 'flex', gap: 6, textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.65 : 1 }}><span>{t.status === 'done' ? '☑' : (t.status === 'doing' ? '◔' : '☐')}</span><span>{t.text}</span></div>))}
				</div>
			) : null}
			{uiTrail.length ? (
				<div data-agent-ui-trail="1" data-trail-tick={trailTick} style={{ padding: '4px 8px 2px', fontSize: 12, lineHeight: 1.7 }}>
					{uiTrail.map((t)=>(
						<div key={t.id} data-agent-ui-trail-item={t.kind} data-undone={t.undone ? '1' : '0'} style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: t.undone ? 0.55 : 1 }}>
							<span style={{ flex: '1 1 auto' }}>{t.label}{t.undone ? '(已回退)' : ''}</span>
							{t.canUndo ? <Button size="small" data-agent-ui-undo="1" onClick={()=>{ const r = undoUiTrail(t.id); if(!r.ok){ message.warning('回退未生效'); } }}>{t.kind === 'pair' ? '回到上一对' : '回到上一页'}</Button> : null}
						</div>
					))}
				</div>
			) : null}
			<div className={styles.head} onClick={()=>setOpen((v)=>!v)}>
				<span>助手动作 {results.length} 项 · 完成 {doneCount}{failCount ? ` · 失败 ${failCount}` : ''}{trace && trace.mode === 'text' ? ' · 围栏模式' : ''}{!enabled ? ' · 行动能力已关闭(只读)' : ''}</span>
				<span>{open ? '收起' : '展开'}</span>
			</div>
			{open ? (
				<div className={styles.rows}>
					{results.map((x, i)=>{
						const key = `${x.callId || i}`;
						const cls = x.status === 'undone' ? styles.undone : (x.status === 'failed' ? styles.failed : (x.status === 'running' ? styles.running : ''));
						const showRoundText = i === 0 || results[i - 1].roundIndex !== x.roundIndex;
						const canUndo = x.status === 'completed' && x.undo && x.undo.actionId && x.undo.kind && x.undo.kind !== 'none';
						const awaiting = pendingIds.has(x.callId);
						const elicit = elicits.find((e)=>e.callId === x.callId);
						return (
							<React.Fragment key={key}>
								{showRoundText && showRoundModel && x.roundModel ? <Tag style={{ margin: '0 0 2px 0', fontSize: 11 }} data-round-model={x.roundModel}>{x.roundModel}</Tag> : null}
								{showRoundText && x.roundText && rounds.length > 1 ? <div className={styles.roundText}>{`${x.roundText}`.slice(0, 200)}</div> : null}
								<div className={`${styles.row} ${cls}`}>
									<span className={styles.icon}>{STATUS_ICON[x.status] || '·'}</span>
									<span className={styles.label}>{labelOf(x.name)}</span>
									<span className={styles.summary} title={x.summary}>{awaiting ? '等待你确认…' : (elicit ? '等待你作答…' : (x.summary || ''))}</span>
									<span className={styles.actions}>
										{x.level === 'read' ? <Tag style={{ margin: 0 }}>只读</Tag> : null}
										{x.ledgerLost ? <Tag color="warning" data-agent-ledger-lost="1" style={{ margin: 0 }} title="动作已执行,但账本提交失败(本机存储可能已满),这一条不可撤销">账本未记录·不可撤销</Tag> : null}
										{awaiting ? (
											<>
												<Button size="small" type="primary" data-approval-scope="once" onClick={()=>resolveApproval(x.callId, true, messageId)}>允许</Button>
												{/* [D70·2026-09-09] 四钮一律以本气泡的 messageId 落定:trace 条目(x)没有 messageKey 字段,此前从 trace 条目上取不存在的 messageKey 字段(恒 undefined)走「按 id/按名落定全部同名」旧路径,后台任务与外部客户端的同名待审被对话页一键静默批准(D23 回潮);待审列表本就按 messageId 取,故 messageId 即本键 */}
													{/* [P1·2026-09-08] 对标「Yes, and don't ask again」:会话档=内存放行集(刷新即清);永久档=写进「按工具名放行」名单(进阶页可见可撤)+ 同时进会话放行集(本 Turn 的策略快照在创建时已读死,不进会话集则同轮后续同名写入仍会各问一次 —— 端到端用例 S164 实抓) */}
												<Button size="small" data-approval-scope="session" title="允许,且本对话内该工具不再逐次确认(只对当前对话生效;刷新即清)" onClick={()=>{ allowToolForSession(x.name); resolveApprovalsByName(x.name, true, messageId); }}>本会话不再问</Button>
												<Button size="small" data-approval-scope="always" title="允许,并把该工具加入「进阶 → 行动能力 → 按工具名放行」名单(可随时移除)" onClick={()=>{ const cur = getToolPolicy(); if(cur.allow.indexOf(x.name) < 0){ setToolPolicy({ allow: cur.allow.concat([x.name]) }); } allowToolForSession(x.name); resolveApprovalsByName(x.name, true, messageId); }}>永久放行</Button>
												<Button size="small" data-approval-scope="skip" onClick={()=>resolveApproval(x.callId, false, messageId)}>跳过</Button>
											</>
										) : null}
										{canUndo && !streaming ? <Button size="small" danger onClick={()=>handleUndo(x)}>撤销</Button> : null}
										<Button size="small" type="link" onClick={()=>setExpanded((prev)=>({ ...prev, [key]: !prev[key] }))}>{expanded[key] ? '收起' : '详情'}</Button>
									</span>
								</div>
								{awaiting && pendingById[x.callId] && pendingById[x.callId].preview ? <AgentDiffPreview preview={pendingById[x.callId].preview} /> : null}
								{elicit ? <ElicitationRow elicit={elicit} /> : null}
								{expanded[key] ? (
									<div className={styles.detail}>{`参数: ${safeJson(x.args)}\n结果: ${safeJson(x.content)}`}</div>
								) : null}
							</React.Fragment>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
