// [2026-09-11] 任务中心第二入口合同:进阶页「打开任务中心」两枚按钮与斜杠命令 /任务 都派发 horosa:task-center;
// TaskCenterBell 收到事件即打开抽屉(即便行动能力关/零任务时铃铛本不渲染,也因事件强制出现)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import TaskCenterBell, { openTaskCenter, TASK_CENTER_EVENT } from '../../components/aianalysis/TaskCenterBell';

jest.mock('../../components/aianalysis/TaskCenterPanel', ()=>function TaskCenterPanelMock({ open }){ return open ? <div data-task-center-panel="mock">panel</div> : null; });

let host;
beforeEach(()=>{ window.localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });
const flush = ()=>new Promise((r)=>setTimeout(r, 20));

it('🔴 缺省(行动关、零任务)铃铛不渲染;openTaskCenter() 派发事件 → 铃铛出现且抽屉打开;detail.open=false 关闭', async ()=>{
	await act(async ()=>{ ReactDOM.render(<TaskCenterBell />, host); await flush(); });
	expect(host.querySelector('[data-task-center-bell]')).toBe(null);
	expect(TASK_CENTER_EVENT).toBe('horosa:task-center');
	await act(async ()=>{ expect(openTaskCenter()).toBe(true); await flush(); });
	expect(host.querySelector('[data-task-center-bell]')).not.toBe(null);
	expect(host.querySelector('[data-task-center-panel="mock"]')).not.toBe(null);
	await act(async ()=>{ window.dispatchEvent(new CustomEvent(TASK_CENTER_EVENT, { detail: { open: false } })); await flush(); });
	expect(host.querySelector('[data-task-center-panel="mock"]')).toBe(null);
});

it('🔴 行动能力卡两枚按钮 data-open-task-center=goal|scheduler 都调 openTaskCenter(源码锚;登记表 agent.openTaskCenter instances 2)', ()=>{
	const fs = require('fs'); const path = require('path');
	const src = fs.readFileSync(path.resolve(__dirname, '..', '..', 'components', 'aianalysis', 'AgentAbilityPanel.js'), 'utf8');
	expect((src.match(/data-open-task-center="goal"/g) || []).length).toBe(1);
	expect((src.match(/data-open-task-center="scheduler"/g) || []).length).toBe(1);
	expect((src.match(/openTaskCenter\(\)/g) || []).length).toBe(2);
	const reg = require('../../components/aianalysis/chat/advancedControls.registry.json');
	const ctrl = reg.controls.find((c)=>c.id === 'agent.openTaskCenter');
	expect(ctrl).toEqual(expect.objectContaining({ anchor: 'data-open-task-center', instances: 2, kind: 'button' }));
	expect(ctrl.consumers).toContain('components/aianalysis/TaskCenterBell.js#openTaskCenter');
});
