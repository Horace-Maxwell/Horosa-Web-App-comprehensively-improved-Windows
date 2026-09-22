// 自动规则面板合同(批四):总开关点了有用;新建规则弹窗 →「执行某工具之前」露出 data-rule-tool-name 下拉 → 选工具 + 拒绝 → 保存落库;
// 表格始终渲染(开关关也能预置规则);删除后清空。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import AutomationRulesPanel from '../../components/aianalysis/AutomationRulesPanel';
import { isAutomationEnabled } from '../aiAgent/prefs';
import { listRules, removeRule } from '../aiAgent/automation/ruleStore';

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); };
const click = (el)=>act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
async function openSelect(sel){ await act(async ()=>{ sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); await flush(); }
const pickOption = async (text)=>{ const o = Array.from(document.querySelectorAll('.ant-select-item-option')).find((x)=>x.textContent.indexOf(text) >= 0); expect(o).toBeTruthy(); click(o); await flush(); };

describe('自动规则面板', ()=>{
	let host;
	beforeEach(async ()=>{ window.localStorage.clear(); for(const r of await listRules()){ await removeRule(r.id); } host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; });

	test('🔴 开关点了有用;弹窗建「执行某工具之前 → 拒绝」规则落库;表格可见;删除清空', async ()=>{
		await act(async ()=>{ ReactDOM.render(<AutomationRulesPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		expect(host.querySelector('[data-automation-rules="1"]')).toBeTruthy();
		expect(host.querySelector('.ant-table')).toBeTruthy();
		expect(isAutomationEnabled()).toBe(false);
		click(host.querySelector('[data-automation-switch="1"]')); await flush();
		expect(isAutomationEnabled()).toBe(true);
		click(host.querySelector('[data-automation-switch="1"]')); await flush();
		expect(isAutomationEnabled()).toBe(false);
		// 新建规则
		click(Array.from(host.querySelectorAll('button')).find((b)=>(b.textContent || '').replace(/\s+/g, '') === '新建规则')); await flush();
		const modal = document.querySelector('.ant-modal');
		expect(modal).toBeTruthy();
		expect(modal.querySelector('[data-rule-tool-name="1"]')).toBe(null);
		await openSelect(modal.querySelectorAll('.ant-select-selector')[0]);
		await pickOption('执行某工具之前');
		expect(modal.querySelector('[data-rule-tool-name="1"]')).toBeTruthy();
		await openSelect(modal.querySelector('[data-rule-tool-name="1"] .ant-select-selector'));
		await pickOption('create_chart_record');
		const selectors = modal.querySelectorAll('.ant-select-selector');
		await openSelect(selectors[selectors.length - 1]);
		await pickOption('拒绝执行');
		click(Array.from(modal.querySelectorAll('.ant-modal-footer button')).find((b)=>(b.textContent || '').replace(/\s+/g, '') === '保存'));
		await flush(); await flush();
		const rules = await listRules();
		expect(rules.length).toBe(1);
		expect(rules[0].event).toBe('tool.before');
		expect(rules[0].match.toolName).toBe('create_chart_record');
		expect(rules[0].actions[0].type).toBe('deny');
		await flush();
		expect(host.querySelector('.ant-table-row')).toBeTruthy();
		click(Array.from(host.querySelectorAll('.ant-table-row button')).find((b)=>(b.textContent || '').replace(/\s+/g, '') === '删除'));
		await flush(); await flush();
		expect((await listRules()).length).toBe(0);
	});
});
