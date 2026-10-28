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

	test('🔴 事件已不认识 / 事件为空的规则:照列、标「不会触发」,编辑与启停不可用(只能删);启用计数不算它们', async ()=>{
		const { putStoreRecord, AI_ANALYSIS_STORES } = require('../aiAnalysisStore');
		await putStoreRecord(AI_ANALYSIS_STORES.automationRules, { id: 'o1', name: '旧事件规则', event: 'no.such.event', enabled: true, actions: [{ type: 'select-source' }, { type: 'no-such-action' }] }, 'rule');
		await putStoreRecord(AI_ANALYSIS_STORES.automationRules, { id: 'o2', name: '空事件规则', event: '', enabled: true, actions: [{ type: 'select-source' }] }, 'rule');
		const statuses = [];
		await act(async ()=>{ ReactDOM.render(<AutomationRulesPanel onStatus={(st)=>statuses.push(st)} />, host); await new Promise((r)=>setTimeout(r, 0)); });
		await flush();
		click(host.querySelector('[data-automation-switch="1"]')); await flush();
		const rows = Array.from(host.querySelectorAll('.ant-table-row'));
		expect(rows.length).toBe(2);
		rows.forEach((row)=>{
			expect(row.textContent).toContain('不会触发');
			expect(row.querySelector('[data-rule-edit]').disabled).toBe(true);
			expect(row.querySelector('[data-rule-toggle]').disabled).toBe(true);
			expect(row.querySelector('[data-rule-delete]').disabled).toBe(false);
		});
		// 只写中文说明,不在表格里露原始事件名(放悬停提示)
		expect(host.textContent).toContain('(此版本没有的事件,不会触发,可删)');
		expect(host.textContent).not.toContain('no.such.event');
		expect(host.textContent).not.toContain('(空)(此版本');
		expect(Array.from(host.querySelectorAll('[data-rule-orphan-event="1"]')).map((n)=>n.getAttribute('title')).sort()).toEqual(['(空)', 'no.such.event']);
		expect(statuses[statuses.length - 1].text).toBe('0/2 条启用');
		// 此版本没有的动作同样只写中文说明,原始动作名放悬停提示
		expect(host.textContent).not.toContain('no-such-action');
		const oa = host.querySelector('[data-rule-orphan-action="1"]');
		expect([oa && oa.textContent, oa && oa.getAttribute('title')]).toEqual(['把这个档设为当前分析源、(此版本没有的动作)', 'no-such-action']);
		for(const row of rows){ click(row.querySelector('[data-rule-delete]')); await flush(); await flush(); }
		expect((await listRules()).length).toBe(0);
		click(host.querySelector('[data-automation-switch="1"]')); await flush();
	});
});
