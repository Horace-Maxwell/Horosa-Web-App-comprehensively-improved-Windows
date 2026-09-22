// [进阶审计 D2] 外部客户端策略控件合同:键 horosa.ai.agent.external.policy.v1 此前被 mcpBridge 消费、手册有写,界面上没有任何控件可改。
// 判别向量:打开不写键 → 点只读/改上限才写键 → 恢复缺省删键;效果面:同一把键让 tools/call 的写入被拒(E_APPROVAL_DENIED)/ 超限被拒(E_LIMIT)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ExternalAgentPanel from '../../components/aianalysis/ExternalAgentPanel';
import { setAgentEnabled, getExternalPolicy, DEFAULT_EXTERNAL_POLICY, AGENT_EXTERNAL_POLICY_KEY } from '../aiAgent/prefs';
import { handleAgentToolRequest, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); };
const click = (el)=>act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
// 数字框:原生 setter + input + Enter + blur(与 自动化驱动器 setNumber 同法;信键不信 DOM)
function setNumber(input, v){
	act(()=>{
		const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
		setter.call(input, `${v}`);
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		// React 17 的 onBlur 监听的是 focusout(非 blur):两者都派,钳位在 rc-input-number 的失焦回调里
		input.dispatchEvent(new Event('blur', { bubbles: true }));
		input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
	});
}
const numberInput = (host, sel)=>{ const el = host.querySelector(sel); return el.tagName === 'INPUT' ? el : el.querySelector('input'); };
const callText = (rsp)=>JSON.parse(rsp.result.content[0].text);
const deps = ()=>({
	exportToolManifest: ()=>[
		{ name: 'list_records', level: 'read', description: 'd', inputSchema: { type: 'object' } },
		{ name: 'create_chart_record', level: 'additive', description: 'd', inputSchema: { type: 'object' } },
	],
	runTool: async (name)=>({ ok: true, data: { name } }),
});

describe('外部客户端策略控件', ()=>{
	let host;
	beforeEach(()=>{ window.localStorage.clear(); __resetMcpBridgeForTests(); setAgentEnabled(true); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; window.localStorage.clear(); });

	test('🔴 打开不写键;三控件在位且显示缺省;「恢复缺省」缺省态禁用', async ()=>{
		await act(async ()=>{ ReactDOM.render(<ExternalAgentPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		expect(window.localStorage.getItem(AGENT_EXTERNAL_POLICY_KEY)).toBe(null);
		expect(host.querySelector('[data-external-policy="1"]')).toBeTruthy();
		expect(host.querySelector('[data-external-policy-approval="1"]')).toBeTruthy();
		expect(host.querySelector('input[type="radio"][value="auto"]').checked).toBe(true);
		expect(numberInput(host, '[data-external-policy-calls="1"]').value).toBe(`${DEFAULT_EXTERNAL_POLICY.maxCallsPerMinute}`);
		expect(numberInput(host, '[data-external-policy-writes="1"]').value).toBe(`${DEFAULT_EXTERNAL_POLICY.maxAdditivePerHour}`);
		expect(host.querySelector('[data-external-policy-reset="1"]').disabled).toBe(true);
		// 无桌面桥:MCP 开关禁用但仍在位;策略块与无头出口不依赖桌面
		expect(host.querySelector('[data-mcp-server-switch="1"]')).toBeTruthy();
		expect(host.querySelector('[data-headless-switch="1"]')).toBeTruthy();
	});

	test('🔴 点只读 → 键在且 approval=read-only;改两个上限 → 键值随之;恢复缺省 → 删键回缺省', async ()=>{
		await act(async ()=>{ ReactDOM.render(<ExternalAgentPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		click(host.querySelector('input[type="radio"][value="read-only"]'));
		await flush();
		expect(getExternalPolicy().approval).toBe('read-only');
		expect(window.localStorage.getItem(AGENT_EXTERNAL_POLICY_KEY)).not.toBe(null);
		setNumber(numberInput(host, '[data-external-policy-calls="1"]'), 1);
		await flush();
		expect(getExternalPolicy().maxCallsPerMinute).toBe(1);
		setNumber(numberInput(host, '[data-external-policy-writes="1"]'), 0);
		await flush();
		expect(getExternalPolicy().maxAdditivePerHour).toBe(0);
		// 越界钳位:数字框本身在真浏览器按 max 钳位(端到端判据),jsdom 合成失焦不触发;存储层同样钳位且回灌界面
		const { setExternalPolicy } = require('../aiAgent/prefs');
		act(()=>{ setExternalPolicy({ maxCallsPerMinute: 9999 }); });
		await flush();
		expect(getExternalPolicy().maxCallsPerMinute).toBe(600);
		expect(numberInput(host, '[data-external-policy-calls="1"]').value).toBe('600');
		expect(host.querySelector('[data-external-policy-reset="1"]').disabled).toBe(false);
		click(host.querySelector('[data-external-policy-reset="1"]'));
		await flush();
		expect(window.localStorage.getItem(AGENT_EXTERNAL_POLICY_KEY)).toBe(null);
		expect(getExternalPolicy()).toEqual({ ...DEFAULT_EXTERNAL_POLICY });
		expect(host.querySelector('input[type="radio"][value="auto"]').checked).toBe(true);
		expect(host.querySelector('[data-external-policy-reset="1"]').disabled).toBe(true);
	});

	test('🔴 效果面:界面写的键约束外部 tools/call —— 只读档拒写入(E_APPROVAL_DENIED);每分钟 1 次下第二次只读调用被限流(E_LIMIT);恢复缺省后写入放行', async ()=>{
		await act(async ()=>{ ReactDOM.render(<ExternalAgentPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		click(host.querySelector('input[type="radio"][value="read-only"]'));
		await flush();
		const d = deps();
		const denied = await handleAgentToolRequest({ id: 1, method: 'tools/call', params: { name: 'create_chart_record', arguments: {} }, clientName: 'codex' }, d);
		expect(denied.ok).toBe(true);
		expect(callText(denied).code).toBe('E_APPROVAL_DENIED');
		// 上限 1 次/分钟:先复位桶再打两发只读
		__resetMcpBridgeForTests();
		setNumber(numberInput(host, '[data-external-policy-calls="1"]'), 1);
		await flush();
		expect(getExternalPolicy().maxCallsPerMinute).toBe(1);
		const first = await handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'list_records', arguments: {} }, clientName: 'codex' }, d);
		expect(callText(first).ok).toBe(true);
		const second = await handleAgentToolRequest({ id: 3, method: 'tools/call', params: { name: 'list_records', arguments: {} }, clientName: 'codex' }, d);
		expect(callText(second).code).toBe('E_LIMIT');
		// 恢复缺省 → 写入放行(全自动)
		click(host.querySelector('[data-external-policy-reset="1"]'));
		await flush();
		__resetMcpBridgeForTests();
		const allowed = await handleAgentToolRequest({ id: 4, method: 'tools/call', params: { name: 'create_chart_record', arguments: {} }, clientName: 'codex' }, d);
		expect(callText(allowed).ok).toBe(true);
	});
});
