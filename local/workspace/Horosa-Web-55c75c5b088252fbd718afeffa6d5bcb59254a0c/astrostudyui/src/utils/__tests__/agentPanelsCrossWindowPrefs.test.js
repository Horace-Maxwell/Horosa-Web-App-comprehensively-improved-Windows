// [AR-32·2026-09-17] 进阶页五处开关此前 useState(()=>isXxx()) 只在挂载时读一次:另一窗口改了键(storage 事件 → prefs 重发
// AGENT_PREFS_EVENT)本窗口显示仍陈旧,行为却按实时键判 → 显示与行为不一致。合同:偏好事件到来 → 各面板重读自己的键。
// 判别向量:直接写键(绕过 setter,不触发本窗口 emit)→ 派偏好事件 → 开关 aria-checked 翻转;不派事件 → 仍是旧值(证明是订阅在起作用)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { setAgentEnabled, AGENT_PREFS_EVENT, isGoalEnabled, isSchedulerEnabled, isOrchestrateEnabled, isAutomationEnabled, isWebSearchEnabled, isWebFetchEnabled, isHeadlessEnabled, isExternalToolsEnabled } from '../aiAgent/prefs';

jest.mock('../aiAnalysisDesktop', ()=>({
	...jest.requireActual('../aiAnalysisDesktop'),
	isDesktopBridgeAvailable: ()=>true,
	desktopMcpClientList: jest.fn(async ()=>({ available: true, value: [] })),
	desktopMcpServerStatus: jest.fn(async ()=>({ available: true, value: { enabled: false, listening: false } })),
	desktopNotifyHookStatus: jest.fn(async ()=>({ available: false })),
}));
jest.mock('../../integrations/webSearch', ()=>({
	...jest.requireActual('../../integrations/webSearch'),
	getActiveSearchProfile: jest.fn(async ()=>null),
}));

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ for(let i = 0; i < 3; i++){ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); } };
let host;
beforeEach(()=>{ window.localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

const checkedOf = (sel)=>{ const el = host.querySelector(sel); return el ? el.getAttribute('aria-checked') : null; };
// 模拟「另一窗口写了键」:直接写 localStorage(本窗口 setter 会 emit,这里绕开),再派本窗口收到的偏好事件
const otherWindowWrites = async (key, value)=>{
	window.localStorage.setItem(key, value);
	await flush();
	// 事件未到 → 面板仍显示旧值(订阅才是修复面,不是轮询)
};
// 产品路径:另一窗口 storage 事件 → bindCrossWindowPrefs 经 emit() 重发**完整快照**(无 detail 时订阅方自算);detail:{} 不是产品会发的形状(会把 enabled 读成 false 折叠整卡)
const prefsEventArrives = async ()=>{ await act(async ()=>{ window.dispatchEvent(new CustomEvent(AGENT_PREFS_EVENT)); }); await flush(); };

test('🔴 行动能力卡三子开关(目标 / 定时 / 编排):键在别处变 → 事件到 → 显示跟上', async ()=>{
	setAgentEnabled(true);
	const AgentAbilityPanel = require('../../components/aianalysis/AgentAbilityPanel').default;
	await act(async ()=>{ ReactDOM.render(<AgentAbilityPanel />, host); });
	await flush();
	expect(checkedOf('[data-goal-switch="1"]')).toBe('false');
	await otherWindowWrites('horosa.ai.tasks.goal.enabled', '1');
	await otherWindowWrites('horosa.ai.tasks.scheduler.enabled', '1');
	await otherWindowWrites('horosa.ai.orchestrate.enabled', '1');
	expect(isGoalEnabled() && isSchedulerEnabled() && isOrchestrateEnabled()).toBe(true);   // 行为面已按实时键
	expect(checkedOf('[data-goal-switch="1"]')).toBe('false');                                   // 显示面仍旧值(事件未到)
	await prefsEventArrives();
	expect(checkedOf('[data-goal-switch="1"]')).toBe('true');
	expect(checkedOf('[data-scheduler-switch="1"]')).toBe('true');
	expect(checkedOf('[data-orchestrate-switch="1"]')).toBe('true');
});

test('🔴 自动规则 / 联网检索 + 网页读取 / 外部服务器 / 无头出口 四面板同款', async ()=>{
	setAgentEnabled(true);
	const AutomationRulesPanel = require('../../components/aianalysis/AutomationRulesPanel').default;
	const WebSearchPanel = require('../../components/aianalysis/WebSearchPanel').default;
	const ExternalServersPanel = require('../../components/aianalysis/ExternalServersPanel').default;
	const ExternalAgentPanel = require('../../components/aianalysis/ExternalAgentPanel').default;
	await act(async ()=>{ ReactDOM.render(<div><AutomationRulesPanel /><WebSearchPanel /><ExternalServersPanel /><ExternalAgentPanel /></div>, host); });
	await flush();
	expect(checkedOf('[data-automation-switch="1"]')).toBe('false');
	expect(checkedOf('[data-web-search-switch="1"]')).toBe('false');
	expect(checkedOf('[data-external-tools-switch="1"]')).toBe('false');
	expect(checkedOf('[data-headless-switch="1"]')).toBe('false');
	await otherWindowWrites('horosa.ai.automation.enabled', '1');
	await otherWindowWrites('horosa.ai.tools.webSearch.enabled', '1');
	await otherWindowWrites('horosa.ai.tools.webFetch.enabled', '1');
	await otherWindowWrites('horosa.ai.tools.external.enabled', '1');
	await otherWindowWrites('horosa.ai.tools.headless.enabled', '1');
	expect(isAutomationEnabled() && isWebSearchEnabled() && isWebFetchEnabled() && isExternalToolsEnabled() && isHeadlessEnabled()).toBe(true);
	expect(checkedOf('[data-automation-switch="1"]')).toBe('false');
	await prefsEventArrives();
	expect(checkedOf('[data-automation-switch="1"]')).toBe('true');
	expect(checkedOf('[data-web-search-switch="1"]')).toBe('true');
	expect(checkedOf('[data-web-fetch-switch="1"]')).toBe('true');
	expect(checkedOf('[data-external-tools-switch="1"]')).toBe('true');
	expect(checkedOf('[data-headless-switch="1"]')).toBe('true');
});
