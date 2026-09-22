// 「行动能力」危险区卡合同(批四):总开关关=正文不渲染;开=五个子面板收进折叠区(缺省全收起、forceRender 五根锚全在);
// horosa:adv-open 自开对应面板;每个开关/下拉「点前读键→点后键变→点回复原」(死开关审计式),不留残键。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import AgentAbilityPanel from '../../components/aianalysis/AgentAbilityPanel';
import { setAgentEnabled, getAgentApprovalMode, getAgentApprovalCategories, getToolPolicy, isGoalEnabled, isSchedulerEnabled, isOrchestrateEnabled, AGENT_APPROVAL_CATEGORIES } from '../aiAgent/prefs';
import { ADV_OPEN_EVENT } from '../../components/aianalysis/chat/AdvSectionNav';
import { ADV_SECTION_IDS } from '../../components/aianalysis/chat/AdvCard';

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); };
const click = (el)=>act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const clickText = (root, text)=>{ const el = Array.from(root.querySelectorAll('button, .ant-collapse-header, .ant-radio-button-wrapper')).find((b)=>(b.textContent || '').replace(/\s+/g, '').indexOf(text) >= 0); expect(el).toBeTruthy(); click(el); return el; };
async function openSelect(sel){ await act(async ()=>{ sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); await flush(); }
const options = ()=>Array.from(document.querySelectorAll('.ant-select-item-option'));

describe('行动能力卡', ()=>{
	let host;
	beforeEach(()=>{ window.localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; });

	test('总开关关:根锚在位、正文不渲染(零子面板、零折叠)', ()=>{
		act(()=>{ ReactDOM.render(<AgentAbilityPanel />, host); });
		expect(host.querySelector('[data-agent-ability-panel="1"]')).toBeTruthy();
		expect(host.querySelector('[data-agent-collapse]')).toBe(null);
		expect(host.querySelectorAll('[data-approval-category]').length).toBe(0);
		expect(host.querySelector('[data-scheduler-switch="1"]')).toBe(null);
	});

	test('🔴 总开关开:折叠区五面板全收起但五根锚全在;三子开关各一;adv-open 自开「联网检索」', async ()=>{
		setAgentEnabled(true);
		await act(async ()=>{ ReactDOM.render(<AgentAbilityPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		const c = host.querySelector('[data-agent-collapse="1"]');
		expect(c).toBeTruthy();
		expect(c.querySelectorAll('.ant-collapse-item').length).toBe(5);
		expect(c.querySelectorAll('.ant-collapse-item-active').length).toBe(0);
		['[data-external-agent-panel="1"]', '[data-external-servers="1"]', '[data-web-search="1"]', '[data-automation-rules="1"]', '[data-action-ledger-panel="1"]'].forEach((s)=>expect(c.querySelector(s)).toBeTruthy());
		[ADV_SECTION_IDS.agentMcp, ADV_SECTION_IDS.agentServers, ADV_SECTION_IDS.agentWeb, ADV_SECTION_IDS.agentRules, ADV_SECTION_IDS.agentLedger].forEach((id)=>expect(c.querySelector(`[id="${id}"]`)).toBeTruthy());
		expect(host.querySelectorAll('[data-goal-switch="1"]').length).toBe(1);
		expect(host.querySelectorAll('[data-scheduler-switch="1"]').length).toBe(1);
		expect(host.querySelectorAll('[data-orchestrate-switch="1"]').length).toBe(1);
		await act(async ()=>{ window.dispatchEvent(new CustomEvent(ADV_OPEN_EVENT, { detail: { id: ADV_SECTION_IDS.agentWeb } })); await new Promise((r)=>setTimeout(r, 0)); });
		const active = c.querySelectorAll('.ant-collapse-item-active');
		expect(active.length).toBe(1);
		expect(active[0].querySelector('[data-web-search="1"]')).toBeTruthy();
		setAgentEnabled(false);
	});

	test('🔴 每个控件点了有用:审批档/三子开关/类别下拉/按工具名禁用 → 键变 → 点回复原', async ()=>{
		setAgentEnabled(true);
		await act(async ()=>{ ReactDOM.render(<AgentAbilityPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		// 审批三档(互斥组:恢复=点回原项)
		expect(getAgentApprovalMode()).toBe('never');
		click(host.querySelector('input[type="radio"][value="on-request"]'));
		expect(getAgentApprovalMode()).toBe('on-request');
		click(host.querySelector('input[type="radio"][value="never"]'));
		expect(getAgentApprovalMode()).toBe('never');
		// 三子开关
		for(const [sel, read] of [['[data-goal-switch="1"]', isGoalEnabled], ['[data-scheduler-switch="1"]', isSchedulerEnabled], ['[data-orchestrate-switch="1"]', isOrchestrateEnabled]]){
			expect(read()).toBe(false);
			click(host.querySelector(sel)); await flush();
			expect(read()).toBe(true);
			click(host.querySelector(sel)); await flush();
			expect(read()).toBe(false);
		}
		// 按类别收紧(ghost 折叠内,先展开)
		clickText(host, '按类别收紧审批'); await flush();
		expect(host.querySelectorAll('[data-approval-category]').length).toBe(AGENT_APPROVAL_CATEGORIES.length);
		expect(getAgentApprovalCategories().records || 'inherit').toBe('inherit');
		await openSelect(host.querySelector('[data-approval-category="records"] .ant-select-selector'));
		const strict = options().find((o)=>o.textContent.indexOf('每次确认') >= 0);
		expect(strict).toBeTruthy();
		click(strict); await flush();
		expect(getAgentApprovalCategories().records).toBe('on-request');
		await openSelect(host.querySelector('[data-approval-category="records"] .ant-select-selector'));
		click(options().find((o)=>o.textContent.indexOf('跟随总档') >= 0)); await flush();
		expect(getAgentApprovalCategories().records || 'inherit').toBe('inherit');
		// 按工具名禁用(多选)
		clickText(host, '按工具名放行'); await flush();
		expect(host.querySelector('[data-tool-policy="deny"]')).toBeTruthy();
		await openSelect(host.querySelector('[data-tool-policy="deny"] .ant-select-selector'));
		const opt = options().find((o)=>o.textContent.indexOf('create_chart_record') >= 0);
		expect(opt).toBeTruthy();
		click(opt); await flush();
		expect(getToolPolicy().deny).toEqual(['create_chart_record']);
		setAgentEnabled(false);
	});
});

describe('[进阶复查 D12·2026-09-08] 类别面板文案', ()=>{
	let host;
	beforeEach(()=>{ window.localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; });
	test('🔴 四个纯读类别标签写明语义;折叠头保留「按类别收紧审批」前缀并说明读类规则', async ()=>{
		setAgentEnabled(true);
		await act(async ()=>{ ReactDOM.render(<AgentAbilityPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		clickText(host, '按类别收紧审批'); await flush();
		const text = host.textContent || '';
		['查询(只读)', '外部工具(出网)', '反问 / 进度', '界面操作'].forEach((t)=>expect(text).toContain(t));
		const head = Array.from(host.querySelectorAll('.ant-collapse-header')).map((h)=>h.textContent || '').find((t)=>t.indexOf('按类别收紧审批') === 0);
		expect(head).toBeTruthy();
		expect(head).toContain('只读=外部不出网');
		expect(host.querySelectorAll('[data-approval-category]').length).toBe(AGENT_APPROVAL_CATEGORIES.length);
	});
});
