// [进阶复查 D17 + P1·2026-09-08] 动作条:账本丢失徽标(不可撤销、无撤销钮);审批行三档钮(允许 / 本会话不再问 / 永久放行 / 跳过)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import AgentActionBar from '../../components/aianalysis/AgentActionBar';
import * as approvals from '../aiAgent/approvals';
import { isToolSessionAllowed, __resetSessionAllowForTests } from '../aiAgent/sessionAllow';
import { getToolPolicy } from '../aiAgent/prefs';

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); };
const click = (el)=>act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
function trace(results){
	return { version: 1, mode: 'native', turnId: 't1', stopReason: 'stop', steers: [], todos: [], rounds: [{ index: 0, text: '', toolCalls: results.map((r)=>({ id: r.callId, name: r.name, args: r.args || {} })), results }] };
}
const completed = (extra)=>({ callId: 'c1', name: 'create_chart_record', level: 'additive', args: { name: 'x' }, ok: true, status: 'completed', summary: '已建档', content: '{}', undo: { actionId: 'a1', kind: 'trash-record', label: '撤销建档' }, ...(extra || {}) });

describe('动作条', ()=>{
	let host;
	beforeEach(()=>{ window.localStorage.clear(); approvals.__resetApprovalsForTests(); __resetSessionAllowForTests(); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; });

	test('🔴 D17 ledgerLost:徽标在位、无撤销钮;正常写入:有撤销钮、无徽标', async ()=>{
		await act(async ()=>{ ReactDOM.render(<AgentActionBar trace={trace([completed({ undo: { actionId: 'a1', kind: 'none', label: '' }, ledgerLost: true })])} messageId="m1" streaming={false} />, host); });
		await flush();
		expect(host.querySelector('[data-agent-ledger-lost="1"]')).toBeTruthy();
		const hasUndo = ()=>Array.from(host.querySelectorAll('button')).some((b)=>(b.textContent || '').replace(/\s+/g, '').indexOf('撤销') >= 0);   // antd 两字按钮自动插空格
		expect(hasUndo()).toBe(false);
		await act(async ()=>{ ReactDOM.render(<AgentActionBar trace={trace([completed()])} messageId="m1" streaming={false} />, host); });
		await flush();
		expect(host.querySelector('[data-agent-ledger-lost="1"]')).toBe(null);
		expect(hasUndo()).toBe(true);
	});

	test('🔴 P1 审批行四钮:「本会话不再问」落定审批并写会话放行集;「永久放行」写「按工具名放行」名单;「跳过」拒', async ()=>{
		const running = (id, name)=>({ callId: id, name, level: 'additive', args: {}, ok: false, status: 'running', summary: '', content: '' });
		const p1 = approvals.requestApproval('m1', { callId: 'c1', name: 'create_chart_record', args: {} });
		const p2 = approvals.requestApproval('m1', { callId: 'c2', name: 'set_settings', args: {} });
		const p3 = approvals.requestApproval('m1', { callId: 'c3', name: 'create_case_record', args: {} });
		await act(async ()=>{ ReactDOM.render(<AgentActionBar trace={trace([running('c1', 'create_chart_record'), running('c2', 'set_settings'), running('c3', 'create_case_record')])} messageId="m1" streaming />, host); });
		await flush();
		expect(host.querySelectorAll('[data-approval-scope="session"]').length).toBe(3);
		expect(host.querySelectorAll('[data-approval-scope="always"]').length).toBe(3);
		click(host.querySelector('[data-approval-scope="session"]')); await flush();
		await expect(p1).resolves.toBe(true);
		expect(isToolSessionAllowed('create_chart_record')).toBe(true);
		expect(getToolPolicy().allow).toEqual([]);
		click(host.querySelectorAll('[data-approval-scope="always"]')[0]); await flush();   // 剩下的第一行 = c2 set_settings
		await expect(p2).resolves.toBe(true);
		expect(getToolPolicy().allow).toEqual(['set_settings']);
		expect(isToolSessionAllowed('set_settings')).toBe(true);   // 永久放行同时进会话集(本 Turn 策略快照已读死)
		click(host.querySelector('[data-approval-scope="skip"]')); await flush();
		await expect(p3).resolves.toBe(false);
		expect(approvals.listPendingApprovals('m1').length).toBe(0);
	});
});
