// [D70·2026-09-09] 动作条按消息键落定必须到达组件层:trace 条目没有 messageKey 字段,此前四钮传 x.messageKey=undefined 走「按 id / 按名落定全部同名」旧路径,
//   后台目标任务与外部客户端的同名待审被对话页一键静默批准(D23 回潮;哨兵锚住字面 x.messageKey 假绿、jest 只测 approvals 模块、端到端 单键在台撞不上)。
//   判别向量:三个消息键(对话 m1 / 任务 task:t9 / 外部 mcp:codex)各挂同名同 callId 待审,动作条只落定 m1。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import AgentActionBar from '../../components/aianalysis/AgentActionBar';
import * as approvals from '../aiAgent/approvals';
import * as elicitations from '../aiAgent/elicitations';
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
const running = (id, name, level)=>({ callId: id, name, level: level || 'additive', args: {}, ok: false, status: 'running', summary: '', content: '' });
const NAME = 'create_chart_record';
const KEYS = ['m1', 'task:t9', 'mcp:codex'];
function hangThree(callId){
	const settled = {};
	let promises = [];
	act(()=>{ promises = KEYS.map((k)=>approvals.requestApproval(k, { callId, name: NAME, args: {}, level: 'additive' }).then((ok)=>{ settled[k] = ok; return ok; })); });
	return { promises, settled };
}
function pendingByKey(){ const out = {}; KEYS.forEach((k)=>{ out[k] = approvals.listPendingApprovals(k).length; }); return out; }

describe('动作条审批四钮只落定本气泡的消息键', ()=>{
	let host;
	beforeEach(()=>{ window.localStorage.clear(); approvals.__resetApprovalsForTests(); elicitations.__resetElicitationsForTests(); __resetSessionAllowForTests(); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; approvals.__resetApprovalsForTests(); elicitations.__resetElicitationsForTests(); });

	async function mount(){
		await act(async ()=>{ ReactDOM.render(<AgentActionBar trace={trace([running('c1', NAME)])} messageId="m1" streaming={true} />, host); });
		await flush();
	}

	test('🔴「本会话不再问」:只落定 m1 的同名待审,task:t9 / mcp:codex 仍在台;会话放行集写入', async ()=>{
		const { settled } = hangThree('c1');
		await mount();
		expect(pendingByKey()).toEqual({ m1: 1, 'task:t9': 1, 'mcp:codex': 1 });
		click(host.querySelector('[data-approval-scope="session"]'));
		await flush();
		expect(settled).toEqual({ m1: true });
		expect(pendingByKey()).toEqual({ m1: 0, 'task:t9': 1, 'mcp:codex': 1 });
		expect(isToolSessionAllowed(NAME)).toBe(true);
	});

	test('🔴「永久放行」:只落定 m1;allow 名单写入;别的键仍在台', async ()=>{
		const { settled } = hangThree('c1');
		await mount();
		click(host.querySelector('[data-approval-scope="always"]'));
		await flush();
		expect(settled).toEqual({ m1: true });
		expect(pendingByKey()).toEqual({ m1: 0, 'task:t9': 1, 'mcp:codex': 1 });
		expect(getToolPolicy().allow).toContain(NAME);
	});

	test('🔴「允许」与「跳过」按 callId + 本消息键落定(同 callId 的任务 / 外部条目不动)', async ()=>{
		let h = hangThree('c1');
		await mount();
		click(host.querySelector('[data-approval-scope="once"]'));
		await flush();
		expect(h.settled).toEqual({ m1: true });
		expect(pendingByKey()).toEqual({ m1: 0, 'task:t9': 1, 'mcp:codex': 1 });
		approvals.__resetApprovalsForTests();
		h = hangThree('c1');
		await act(async ()=>{ ReactDOM.render(<AgentActionBar trace={trace([running('c1', NAME)])} messageId="m1" streaming={true} />, host); });
		await flush();
		click(host.querySelector('[data-approval-scope="skip"]'));
		await flush();
		expect(h.settled).toEqual({ m1: false });
		expect(pendingByKey()).toEqual({ m1: 0, 'task:t9': 1, 'mcp:codex': 1 });
	});

	test('🔴 反问行 Enter 提交只解开本消息键的同 callId 提问(此前 Enter 路径不传 messageKey)', async ()=>{
		const got = {};
		let p1 = null; let p2 = null;
		act(()=>{
			p1 = elicitations.requestElicitation('m1', { callId: 'c1', name: 'ask_user', question: '出生时辰?', inputType: 'text' }).then((v)=>{ got.m1 = v; });
			p2 = elicitations.requestElicitation('task:t9', { callId: 'c1', name: 'ask_user', question: '出生时辰?', inputType: 'text' }).then((v)=>{ got.task = v; });
		});
		await act(async ()=>{ ReactDOM.render(<AgentActionBar trace={trace([running('c1', 'ask_user', 'read')])} messageId="m1" streaming={true} />, host); });
		await flush();
		const input = host.querySelector('[data-agent-elicitation="1"] input[data-role="answer"]');
		expect(input).toBeTruthy();
		await act(async ()=>{
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
			setter.call(input, '辰时');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await flush();
		await act(async ()=>{ input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true })); });
		await p1;
		await flush();
		expect(got.m1).toEqual({ answer: '辰时', choice: undefined });
		expect(got.task).toBeUndefined();
		expect(elicitations.listPendingElicitations('task:t9').length).toBe(1);
		act(()=>{ elicitations.declineElicitation('c1', 'task:t9'); });
		await p2;
		expect(got.task).toEqual({ declined: true });
	});
});
