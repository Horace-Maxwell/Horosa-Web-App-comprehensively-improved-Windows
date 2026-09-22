// 任务中心铃铛(P1):右下角悬浮按钮,角标=未读通知数 + 活动任务数。
// 出现条件:有任务/通知,或行动能力开启——全新安装首次打开界面零变化。点开 → TaskCenterPanel 抽屉。
// [2026-09-11] 第二入口:斜杠命令 /任务 与进阶页「打开任务中心」按钮派发 window 事件 horosa:task-center {open:true} → 直接打开抽屉(铃铛随之出现)。
import React from 'react';
import { Badge, Button, Tooltip } from 'antd';
import { listTasks, subscribeTasks, unreadCount, subscribeNotices, listNotices } from '../../utils/aiAgent/tasks';
import { isAgentEnabled, subscribeAgentPrefs } from '../../utils/aiAgent/prefs';
import { listPendingApprovals, subscribeApprovals } from '../../utils/aiAgent/approvals';
import { listPendingElicitations, subscribeElicitations } from '../../utils/aiAgent/elicitations';
import TaskCenterPanel from './TaskCenterPanel';

export const ACTIVE_TASK_STATUSES = ['queued', 'scheduled', 'running', 'paused', 'waiting', 'interrupted'];
export const TASK_CENTER_EVENT = 'horosa:task-center';
export function openTaskCenter(){ try{ window.dispatchEvent(new CustomEvent(TASK_CENTER_EVENT, { detail: { open: true } })); return true; }catch(e){ return false; } }

export default function TaskCenterBell(){
	const [open, setOpen] = React.useState(false);
	const [counts, setCounts] = React.useState({ tasks: 0, active: 0, unread: 0, notices: 0, todo: 0 });
	const [agentOn, setAgentOn] = React.useState(()=>isAgentEnabled());
	const refresh = React.useCallback(()=>{
		Promise.all([listTasks(), listNotices({ limit: 1 }), unreadCount()]).then(([tasks, notices, unread])=>{
			const todo = listPendingApprovals().length + listPendingElicitations().length;
			setCounts({ tasks: tasks.length, active: tasks.filter((t)=>ACTIVE_TASK_STATUSES.indexOf(t.status) >= 0).length, unread, notices: notices.length, todo });
		}).catch(()=>{});
	}, []);
	React.useEffect(()=>{ refresh(); }, [refresh]);
	React.useEffect(()=>subscribeTasks(refresh), [refresh]);
	React.useEffect(()=>subscribeNotices(refresh), [refresh]);
	React.useEffect(()=>subscribeApprovals(refresh), [refresh]);
	React.useEffect(()=>subscribeElicitations(refresh), [refresh]);
	React.useEffect(()=>subscribeAgentPrefs((d)=>setAgentOn(!!(d && d.enabled))), []);
	const [forced, setForced] = React.useState(false);
	React.useEffect(()=>{
		const onOpen = (e)=>{ const want = !(e && e.detail && e.detail.open === false); if(want){ setForced(true); setOpen(true); refresh(); } else { setOpen(false); } };
		window.addEventListener(TASK_CENTER_EVENT, onOpen);
		return ()=>window.removeEventListener(TASK_CENTER_EVENT, onOpen);
	}, [refresh]);
	const shouldShow = forced || agentOn || counts.tasks > 0 || counts.notices > 0 || counts.todo > 0;
	if(!shouldShow){ return null; }
	const badge = counts.unread + counts.active + counts.todo;
	return (
		<>
			<div data-task-center-bell="1" data-badge={badge} style={{ position: 'fixed', right: 18, bottom: 64, zIndex: 900 }}>
				<Tooltip title={`任务中心:进行中 ${counts.active} · 待办 ${counts.todo} · 未读 ${counts.unread}`} placement="left">
					<Badge count={badge} size="small" overflowCount={99}>
						<Button shape="circle" size="large" onClick={()=>setOpen(true)} aria-label="任务中心">🔔</Button>
					</Badge>
				</Tooltip>
			</div>
			<TaskCenterPanel open={open} onClose={()=>setOpen(false)} />
		</>
	);
}
