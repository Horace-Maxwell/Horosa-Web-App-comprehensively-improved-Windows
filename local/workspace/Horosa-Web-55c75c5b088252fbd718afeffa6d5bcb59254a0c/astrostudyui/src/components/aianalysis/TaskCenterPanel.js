// 任务中心抽屉(P1):三段——进行中/历史(目标·定时等后台任务,可取消/继续)· 待办(等你批准的写入 + AI 的提问 + 外部客户端请求)· 通知(可标已读);
// 底部附动作账本(撤销=用户的权利)与桌面通知开关。所有数据经 tasks/* 与 approvals/elicitations 等待台,本组件零业务逻辑。
// data-* 定位面(测试与端到端驱动器按它点,不按按钮文案):行 data-task-row/-kind;目标任务 data-task-start/-goal-pause/-goal-resume/-steer;
//   定时任务 data-task-run-now/-pause/-resume/-schedule;通用 data-task-cancel。每个属性在本文件恰一处(taskCenterPanel.test.js 锁)。
import React from 'react';
import { Drawer, Button, Tag, Switch, Input, InputNumber, message } from 'antd';
import { listTasks, subscribeTasks, cancelTask, patchTask, listNotices, subscribeNotices, markRead, isDesktopNotifyEnabled, DESKTOP_NOTIFY_KEY, controllerOf, pushNotice, runScheduledTaskNow, pauseScheduledTask, resumeScheduledTask, describeSchedule } from '../../utils/aiAgent/tasks';
import { formatTaskTime as fmt } from '../../utils/aiAgent/tasks/scheduler';
import { listPendingApprovals, resolveApproval, subscribeApprovals } from '../../utils/aiAgent/approvals';
import AgentDiffPreview from './AgentDiffPreview';
import { listPendingElicitations, resolveElicitation, declineElicitation, subscribeElicitations } from '../../utils/aiAgent/elicitations';
import { listProposals, subscribeProposals, acceptProposal, rejectProposal, revertProposal, PROPOSAL_FIELD_LABELS } from '../../utils/aiAgent/proposals';
import { safeLocalStorageSet, safeLocalStorageRemove } from '../../utils/safeStorage';
import { toastRecordWrite } from '../../utils/recordStoreNotice';
import ActionLedgerPanel from './ActionLedgerPanel';
import GoalTaskModal from './GoalTaskModal';
import ScheduledTaskModal from './ScheduledTaskModal';
import { startGoalTask, steerGoalTask, isGoalLoopRunning, startAllQueuedGoals, approvalVerb } from '../../utils/aiAgent/goalRunner';
import { getGoalParallel, setGoalParallel, AGENT_GOAL_PARALLEL_MAX } from '../../utils/aiAgent/prefs';

export const TASK_STATUS_LABELS = { queued: '排队', scheduled: '已排期', running: '运行中', paused: '已暂停', waiting: '等待你', done: '完成', failed: '失败', cancelled: '已取消', interrupted: '中断' };
export const TASK_KIND_LABELS = { goal: '目标', scheduled: '定时', scan: '扫描' };
const soft = { fontSize: 12, color: 'var(--horosa-text-soft, #8a8f99)' };

function TaskRow({ t, onChanged }){
	const ctl = controllerOf(t.id);
	const active = ['queued', 'scheduled', 'running', 'paused', 'waiting', 'interrupted'].indexOf(t.status) >= 0;
	const [steer, setSteer] = React.useState('');
	const canStart = t.kind === 'goal' && ['queued', 'paused', 'interrupted', 'waiting'].indexOf(t.status) >= 0 && !isGoalLoopRunning(t.id);
	return (
		<div data-task-row={t.status} data-task-kind={t.kind} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0', borderBottom: '1px dashed var(--horosa-border, #e5e7eb)' }}>
		<div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
			<Tag style={{ margin: 0 }}>{TASK_KIND_LABELS[t.kind] || t.kind}</Tag>
			<span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>{t.title}</span>
			<Tag color={t.status === 'running' ? 'processing' : (t.status === 'failed' ? 'error' : (t.status === 'done' ? 'success' : (t.status === 'waiting' ? 'warning' : undefined)))} style={{ margin: 0 }}>{TASK_STATUS_LABELS[t.status] || t.status}{t.status === 'running' && t.progress ? ` ${t.progress}%` : ''}</Tag>
			<span style={soft}>{fmt(t.updatedAt)}</span>
			{t.status === 'running' && ctl && typeof ctl.pause === 'function' ? <Button size="small" data-task-goal-pause="1" onClick={()=>{ ctl.pause(); }}>暂停</Button> : null}
			{(t.status === 'paused' || t.status === 'interrupted') && ctl && typeof ctl.resume === 'function' ? <Button size="small" data-task-goal-resume="1" onClick={()=>{ ctl.resume(); }}>继续</Button> : null}
			{canStart ? <Button size="small" type="primary" data-task-start="1" onClick={()=>{ startGoalTask(t.id).catch((e)=>message.error(`启动失败:${e && e.message ? e.message : e}`)); onChanged(); }}>{t.status === 'queued' ? '开始' : '继续'}</Button> : null}
			{t.kind === 'scheduled' && t.status === 'scheduled' ? <Button size="small" data-task-run-now="1" onClick={async ()=>{ const r = await runScheduledTaskNow(t.id); if(!r.ok){ message.warning(r.code === 'E_TOOL_DISABLED' ? '请先到 进阶 →「AI 助手行动能力」打开「定时任务」开关' : (r.busy ? '另一个定时任务正在跑,稍后再试' : `未运行(${r.code})`)); } onChanged(); }}>立即运行</Button> : null}
			{t.kind === 'scheduled' && t.status === 'scheduled' ? <Button size="small" data-task-pause="1" onClick={async ()=>{ await pauseScheduledTask(t.id); onChanged(); }}>暂停</Button> : null}
			{t.kind === 'scheduled' && (t.status === 'paused' || t.status === 'interrupted') ? <Button size="small" data-task-resume="1" onClick={async ()=>{ await resumeScheduledTask(t.id); onChanged(); }}>继续</Button> : null}
			{active ? <Button size="small" danger data-task-cancel="1" onClick={async ()=>{ const r = await cancelTask(t.id, 'user'); if(!r.ok){ message.warning(`取消未生效(${r.code})`); } onChanged(); }}>取消</Button> : null}
		</div>
		{t.kind === 'scheduled' ? (
			<div style={soft} data-task-schedule="1">{describeSchedule(t.spec && t.spec.schedule)}{t.nextRunAt && t.status === 'scheduled' ? ` · 下次 ${fmt(t.nextRunAt)}` : ''}{t.lastRunAt ? ` · 上次 ${fmt(t.lastRunAt)}${t.result ? (t.result.ok ? ' ✓' : ' ✗') : ''}` : ' · 还没跑过'}{t.result && t.result.summary ? ` · ${`${t.result.summary}`.slice(0, 60)}` : ''}</div>
		) : null}
		{t.kind === 'goal' && active ? (
			<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
				<span style={soft}>{t.spent ? `轮 ${t.spent.turns}/${t.budget.maxTurns} · 调用 ${t.spent.calls}/${t.budget.maxCalls} · ${t.spent.costUnpriced ? `费用预算不可用(该模型无计价表)/$${t.budget.maxCostUsd}` : `$${(t.spent.costUsd || 0).toFixed(3)}/${t.budget.maxCostUsd}`}` : ''}{t.log && t.log.length ? ` · ${t.log[t.log.length - 1].text.slice(0, 60)}` : ''}</span>
				<Input size="small" placeholder="纠偏:下一轮按这句话调整" value={steer} onChange={(e)=>setSteer(e.target.value)} style={{ maxWidth: 240 }} data-task-steer="1"
					onPressEnter={async ()=>{ if(steer.trim()){ await steerGoalTask(t.id, steer.trim()); setSteer(''); message.success('已记录,下一轮生效'); onChanged(); } }} />
			</div>
		) : null}
		</div>
	);
}

function TodoRows({ approvals, elicits, hasOther }){
	const [answers, setAnswers] = React.useState({});
	if(!approvals.length && !elicits.length){ return hasOther ? null : <div style={soft}>暂无待办</div>; }
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
			{approvals.map((a)=>(
				<div key={a.callId} data-todo="approval" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<Tag style={{ margin: 0 }}>{a.messageKey && a.messageKey.indexOf('mcp:') === 0 ? `外部·${a.messageKey.slice(4)}` : (a.messageKey && a.messageKey.indexOf('task:') === 0 ? '任务' : '对话')}</Tag>
						<span style={{ flex: '1 1 auto' }}>{a.name} {approvalVerb(a)},等待你允许</span>
						<Button size="small" type="primary" onClick={()=>resolveApproval(a.callId, true, a.messageKey)}>允许</Button>
						<Button size="small" onClick={()=>resolveApproval(a.callId, false, a.messageKey)}>跳过</Button>
					</div>
					{/* 写前预览:外部客户端的写入同样先看「会写成什么样」再允许 */}
					{a.preview ? <div data-todo-preview="1"><AgentDiffPreview preview={a.preview} /></div> : null}
				</div>
			))}
			{elicits.map((e)=>(
				<div key={e.callId} data-todo="elicit" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
					<div><Tag style={{ margin: 0 }}>{e.messageKey && e.messageKey.indexOf('mcp:') === 0 ? `外部·${e.messageKey.slice(4)}` : '提问'}</Tag> {e.question}</div>
					{e.inputType === 'text' ? (
						<div style={{ display: 'flex', gap: 6 }}>
							<Input size="small" placeholder={e.placeholder || '请输入'} value={answers[e.callId] || ''} onChange={(ev)=>setAnswers((p)=>({ ...p, [e.callId]: ev.target.value }))} style={{ maxWidth: 260 }} />
							<Button size="small" type="primary" disabled={!(answers[e.callId] || '').trim()} onClick={()=>resolveElicitation(e.callId, { answer: (answers[e.callId] || '').trim() }, e.messageKey)}>提交</Button>
							<Button size="small" onClick={()=>declineElicitation(e.callId, e.messageKey)}>拒绝</Button>
						</div>
					) : (
						<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
							{(e.options || []).map((o)=>(<Button key={o} size="small" onClick={()=>resolveElicitation(e.callId, { answer: o, choice: o }, e.messageKey)}>{o}</Button>))}
							<Button size="small" onClick={()=>declineElicitation(e.callId, e.messageKey)}>拒绝</Button>
						</div>
					)}
				</div>
			))}
		</div>
	);
}

// 档案提案:待采纳逐字段「原值 → 新值」+ 采纳 / 拒绝;最近处理的列状态,已采纳的可撤销采纳(落库与冲突判断都在 proposals.js)
export const PROPOSAL_STATUS_LABELS = { pending: '待采纳', accepted: '已采纳', rejected: '已拒绝', conflict: '冲突未采纳', reverted: '已撤销采纳' };
function fmtProposalVal(v){ return v === undefined || v === null || v === '' ? '(空)' : `${v}`; }
function ProposalRows({ pending, recent }){
	if(!pending.length && !recent.length){ return null; }
	// 写档案的两个动作(采纳 / 撤销采纳)按是否真落盘提示;拒绝只改提案状态,照常提示
	const act = (fn, okText, store)=>{
		const r = fn();
		if(r && r.ok){
			if(store){ toastRecordWrite(message, store, okText); }else{ message.success(okText); }
		}else{
			message.warning((r && r.message) || '未完成');
		}
	};
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
			{pending.map((p)=>(
				<div key={p.id} data-todo="proposal" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
					<div><Tag style={{ margin: 0 }}>{p.client ? `外部·${p.client}` : 'AI 提案'}</Tag> {p.kind === 'record-archive' ? `归档「${p.title}」` : `修改「${p.title}」`}</div>
					{p.kind === 'record-edit' ? Object.keys(p.changes || {}).map((k)=>(<div key={k} style={{ paddingLeft: 8 }}>{PROPOSAL_FIELD_LABELS[k] || k}:{fmtProposalVal((p.before || {})[k])} → <b>{fmtProposalVal(p.changes[k])}</b></div>)) : null}
					{p.reason ? <div style={{ ...soft, paddingLeft: 8 }}>理由:{p.reason}</div> : null}
					<div style={{ display: 'flex', gap: 6 }}>
						<Button size="small" type="primary" data-proposal-accept="1" onClick={()=>act(()=>acceptProposal(p.id), '已采纳(可在下方撤销采纳)', p.store === 'case' ? 'case' : 'chart')}>采纳</Button>
						<Button size="small" data-proposal-reject="1" onClick={()=>act(()=>rejectProposal(p.id), '已拒绝')}>拒绝</Button>
					</div>
				</div>
			))}
			{recent.length ? <div style={{ ...soft, marginTop: 2 }}>最近处理的提案</div> : null}
			{recent.map((p)=>(
				<div key={p.id} data-proposal-row={p.status} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
					<Tag style={{ margin: 0 }}>{PROPOSAL_STATUS_LABELS[p.status] || p.status}</Tag>
					<span style={{ flex: '1 1 auto' }}>{p.kind === 'record-archive' ? '归档' : '修改'}「{p.title}」{Array.isArray(p.conflictFields) && p.conflictFields.length ? `(档案已被改过:${p.conflictFields.map((k)=>PROPOSAL_FIELD_LABELS[k] || k).join('、')})` : ''}</span>
					{p.status === 'accepted' ? <Button size="small" type="link" data-proposal-revert="1" onClick={()=>act(()=>revertProposal(p.id), '已撤销采纳', p.store === 'case' ? 'case' : 'chart')}>撤销采纳</Button> : null}
				</div>
			))}
		</div>
	);
}

export default function TaskCenterPanel({ open, onClose }){
	const [tasks, setTasks] = React.useState([]);
	const [notices, setNotices] = React.useState([]);
	const [tick, setTick] = React.useState(0);
	const [desktop, setDesktop] = React.useState(()=>isDesktopNotifyEnabled());
	const [goalOpen, setGoalOpen] = React.useState(false);
	const [goalParallel, setGoalParallelState] = React.useState(()=>getGoalParallel());   // 并行上限(0=现状)
	const [schedOpen, setSchedOpen] = React.useState(false);
	const refresh = React.useCallback(()=>{ listTasks({ limit: 100 }).then(setTasks).catch(()=>{}); listNotices({ limit: 100 }).then(setNotices).catch(()=>{}); setTick((n)=>n + 1); }, []);
	React.useEffect(()=>{ if(open){ refresh(); } }, [open, refresh]);
	React.useEffect(()=>subscribeTasks(refresh), [refresh]);
	React.useEffect(()=>subscribeNotices(refresh), [refresh]);
	React.useEffect(()=>subscribeApprovals(refresh), [refresh]);
	React.useEffect(()=>subscribeElicitations(refresh), [refresh]);
	React.useEffect(()=>subscribeProposals(refresh), [refresh]);
	const approvals = listPendingApprovals();
	const elicits = listPendingElicitations();
	const proposals = listProposals();
	const pendingProposals = proposals.filter((p)=>p.status === 'pending');
	const recentProposals = proposals.filter((p)=>p.status !== 'pending').slice(0, 8);
	const active = tasks.filter((t)=>['queued', 'scheduled', 'running', 'paused', 'waiting', 'interrupted'].indexOf(t.status) >= 0);
	const history = tasks.filter((t)=>active.indexOf(t) < 0).slice(0, 30);
	return (
		<Drawer title="任务中心" placement="right" width={520} open={open} visible={open} onClose={onClose} data-task-center-panel="1">
			<div data-task-center-panel="1" data-tick={tick} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
				<section>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<div style={{ fontWeight: 600 }}>进行中 {active.length ? `(${active.length})` : ''}</div>
						<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							<span style={soft} title="目标任务同时最多跑几条:空=现状(不限、不排队);1-3=超出的排队,前一条结束自动起下一条">并行</span>
							<InputNumber size="small" min={1} max={AGENT_GOAL_PARALLEL_MAX} placeholder="不限" value={goalParallel || undefined} style={{ width: 64 }} data-goal-parallel="1" onChange={(v)=>{ setGoalParallel(Number.isFinite(v) ? v : 0); setGoalParallelState(Number.isFinite(v) ? v : 0); }} />
							<Button size="small" data-goal-start-all="1" onClick={async ()=>{ const r = await startAllQueuedGoals(); message.info(r.total ? `已起 ${r.started}/${r.total} 条排队目标${r.started < r.total ? '(其余按并行上限接力)' : ''}` : '没有排队中的目标'); }}>全部开始</Button>
							<Button size="small" data-new-goal="1" onClick={()=>setGoalOpen(true)}>新建目标</Button>
							<Button size="small" data-new-schedule="1" onClick={()=>setSchedOpen(true)}>新建定时</Button>
						</div>
					</div>
					{active.length ? active.map((t)=>(<TaskRow key={t.id} t={t} onChanged={refresh} />)) : <div style={soft}>暂无进行中的任务。「新建目标」让 AI 自己一轮轮做完一件长活;「新建定时」到点自动做并通知你。</div>}
					{history.length ? <div style={{ marginTop: 6 }}><div style={{ ...soft, marginBottom: 2 }}>历史</div>{history.map((t)=>(<TaskRow key={t.id} t={t} onChanged={refresh} />))}</div> : null}
					<GoalTaskModal open={goalOpen} onClose={()=>setGoalOpen(false)} onCreated={refresh} />
					<ScheduledTaskModal open={schedOpen} onClose={()=>setSchedOpen(false)} onCreated={refresh} />
				</section>
				<section>
					<div style={{ fontWeight: 600 }}>待办 {(approvals.length + elicits.length + pendingProposals.length) ? `(${approvals.length + elicits.length + pendingProposals.length})` : ''}</div>
					<TodoRows approvals={approvals} elicits={elicits} hasOther={pendingProposals.length + recentProposals.length > 0} />
					<ProposalRows pending={pendingProposals} recent={recentProposals} />
				</section>
				<section>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<div style={{ fontWeight: 600 }}>通知 {notices.filter((n)=>!n.read).length ? `(${notices.filter((n)=>!n.read).length} 未读)` : ''}</div>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
							<span>桌面通知</span>
							<Switch size="small" checked={desktop} data-desktop-notify-switch="1" onChange={(on)=>{ if(on){ safeLocalStorageSet(DESKTOP_NOTIFY_KEY, '1'); }else{ safeLocalStorageRemove(DESKTOP_NOTIFY_KEY); } setDesktop(on); }} />
							<Button size="small" onClick={()=>pushNotice({ level: 'info', title: '星阙测试通知', body: '桌面通知已接通(每分钟最多 6 条,10 秒内同文只发一条)' })}>测试通知</Button>
							{notices.some((n)=>!n.read) ? <Button size="small" type="link" onClick={()=>markRead('all')}>全部已读</Button> : null}
						</div>
					</div>
					{notices.length ? notices.slice(0, 50).map((n)=>(
						<div key={n.id} data-notice-row={n.read ? 'read' : 'unread'} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '3px 0', opacity: n.read ? 0.6 : 1 }}>
							<span style={{ ...soft, flex: '0 0 74px' }}>{fmt(n.createdAt)}</span>
							<Tag color={n.level === 'error' ? 'error' : (n.level === 'warn' || n.level === 'action' ? 'warning' : (n.level === 'success' ? 'success' : undefined))} style={{ margin: 0 }}>{n.title}</Tag>
							<span style={{ flex: '1 1 auto' }}>{n.body}</span>
							{!n.read ? <Button size="small" type="link" onClick={()=>markRead(n.id)}>已读</Button> : null}
						</div>
					)) : <div style={soft}>暂无通知</div>}
				</section>
				<ActionLedgerPanel title="助手动作账本" />
			</div>
		</Drawer>
	);
}
