// 任务中心 UI(P1)合同:铃铛出现条件(无任务/通知且行动能力关=不渲染;开/有通知=渲染并计角标);面板列出任务与通知、取消按钮走 cancelTask;待办列出审批与提问。
// [I5] 追加「data-* 定位面」源码锁:端到端驱动器按 data 属性点按钮(不按文案),属性名漂了=驱动器静默点不到 → 假绿。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';
import TaskCenterBell from '../../components/aianalysis/TaskCenterBell';
import TaskCenterPanel from '../../components/aianalysis/TaskCenterPanel';
import { createTask, patchTask, getTask } from '../aiAgent/tasks/taskStore';
import { pushNotice } from '../aiAgent/tasks/noticeStore';
import { clearStore, AI_ANALYSIS_STORES } from '../aiAnalysisStore';
import { setAgentEnabled } from '../aiAgent/prefs';
import { requestApproval, __resetApprovalsForTests } from '../aiAgent/approvals';
import { requestElicitation, __resetElicitationsForTests } from '../aiAgent/elicitations';

const flush = ()=>new Promise((r)=>setTimeout(r, 20));
let host;
beforeEach(async ()=>{ window.localStorage.clear(); __resetApprovalsForTests(); __resetElicitationsForTests(); await clearStore(AI_ANALYSIS_STORES.agentTasks); await clearStore(AI_ANALYSIS_STORES.agentNotices); host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

describe('TaskCenterBell', ()=>{
	it('🔴 全新状态(无任务/通知/待办,行动能力关)不渲染;行动能力开 → 渲染;有通知 → 渲染且角标计未读', async ()=>{
		await act(async ()=>{ ReactDOM.render(<TaskCenterBell />, host); await flush(); });
		expect(document.querySelector('[data-task-center-bell]')).toBe(null);
		await act(async ()=>{ setAgentEnabled(true); await flush(); });
		expect(document.querySelector('[data-task-center-bell]')).not.toBe(null);
		await act(async ()=>{ setAgentEnabled(false); await flush(); });
		expect(document.querySelector('[data-task-center-bell]')).toBe(null);
		await act(async ()=>{ await pushNotice({ title: '完成', body: 'x' }, { desktop: false }); await flush(); });
		const bell = document.querySelector('[data-task-center-bell]');
		expect(bell).not.toBe(null);
		expect(bell.getAttribute('data-badge')).toBe('1');
	});
});

describe('TaskCenterPanel', ()=>{
	it('列出进行中任务(取消按钮 → cancelled)、通知(已读)、待办(审批允许/提问作答)', async ()=>{
		const t = await createTask({ kind: 'goal', title: '建两个人' }); await patchTask(t.id, { status: 'running' });
		await pushNotice({ level: 'success', title: '完成', body: '报告已生成' }, { desktop: false });
		const p = requestApproval('task:' + t.id, { callId: 'c1', name: 'create_chart_record', args: {} });
		const e = requestElicitation('mcp:codex', { callId: 'e1', question: '时辰?', inputType: 'text' });
		await act(async ()=>{ ReactDOM.render(<TaskCenterPanel open onClose={()=>{}} />, host); await flush(); await flush(); });
		const body = document.body.textContent;
		expect(body).toContain('建两个人');
		expect(body).toContain('运行中');
		expect(body).toContain('报告已生成');
		expect(document.querySelector('[data-todo="approval"]').textContent).toContain('任务');
		expect(document.querySelector('[data-todo="elicit"]').textContent).toContain('外部·codex');
		const allow = Array.from(document.querySelectorAll('[data-todo="approval"] button')).find((b)=>b.textContent.replace(/\s/g, '').indexOf('允许') >= 0);
		await act(async ()=>{ allow.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush(); });
		await expect(p).resolves.toBe(true);
		const decline = Array.from(document.querySelectorAll('[data-todo="elicit"] button')).find((b)=>b.textContent.replace(/\s/g, '').indexOf('拒绝') >= 0);
		await act(async ()=>{ decline.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush(); });
		await expect(e).resolves.toEqual({ declined: true });
		const cancel = Array.from(document.querySelectorAll('[data-task-row] button')).find((b)=>b.textContent.replace(/\s/g, '').indexOf('取消') >= 0);
		await act(async ()=>{ cancel.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush(); await flush(); });
		expect((await getTask(t.id)).status).toBe('cancelled');
		const read = Array.from(document.querySelectorAll('[data-notice-row] button')).find((b)=>b.textContent.replace(/\s/g, '').indexOf('已读') >= 0);
		await act(async ()=>{ read.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush(); await flush(); });
		expect(document.querySelector('[data-notice-row="unread"]')).toBe(null);
	});

	it('🔴 data-* 定位面:取消/目标暂停/目标继续三属性在源码里各恰一处(端到端驱动器按它点)', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '..', '..', 'components', 'aianalysis', 'TaskCenterPanel.js'), 'utf8');
		// 剥行注释:文件头的定位面说明里也写着这些属性名,不剥就把注释算成第二处(字面量哨兵×注释双向陷阱)
		const code = src.split('\n').filter((l)=>l.trim().indexOf('//') !== 0).join('\n');
		['data-task-cancel="1"', 'data-task-goal-pause="1"', 'data-task-goal-resume="1"'].forEach((anchor)=>{
			expect(code.split(anchor).length - 1).toBe(1);
		});
		// 纠偏输入沿用既有属性,不另起名
		expect(code.split('data-task-steer="1"').length - 1).toBe(1);
	});
});

describe('[复查 D33] 账本丢失监听可拆除', ()=>{
	const idx = require('../aiAgent/tasks/index');
	const { listNotices } = require('../aiAgent/tasks/noticeStore');
	it('bind → reset → bind 再派一次 ledger-lost ⇒ 只推一条通知(此前监听不拆、重复绑定重复推)', async ()=>{
		idx.__resetTaskCenterForTests();
		idx.bindTaskCenter();
		idx.__resetTaskCenterForTests();
		idx.bindTaskCenter();
		await flush();
		const before = (await listNotices()).length;
		window.dispatchEvent(new CustomEvent('horosa:agent-ledger-lost', { detail: { tool: 'create_chart_record' } }));
		await flush(); await flush();
		expect((await listNotices()).length - before).toBe(1);
		idx.__resetTaskCenterForTests();
	});
});
