// 「进阶」页控件登记表 reveal 合同:登记表里每一条控件,按其 reveal 步骤把所属面板真渲染到锚点可见(展开折叠/切页签/开模态/
// 选下拉/播种数据/桌面桥 mock),断言锚点数量 ≥ 登记的 instances;再断言「打开整页不写任何登记的 localStorage 存储键」。
// 登记表本身的机械核对(源码锚 ⊆ 登记、消费方符号在、用例 id 在、棘轮)由 scripts/check_adv_controls_registry.js 承担(preflight [261]);
// 这里补的是「登记的锚在真渲染里真的能到达」这一层(锚写在从不渲染的分支里 = 假登记)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { listAdvancedControls } from '../../components/aianalysis/chat/advancedControls';
import AdvancedPane from '../../components/aianalysis/chat/AdvancedPane';
import ChatContextPolicyPanel from '../../components/aianalysis/chat/ChatContextPolicyPanel';
import ChatModelRoutesPanel from '../../components/aianalysis/chat/ChatModelRoutesPanel';
import BestOfPanel from '../../components/aianalysis/chat/BestOfPanel';
import PersonaMemoryPanel from '../../components/aianalysis/chat/PersonaMemoryPanel';
import SkillPackPanel from '../../components/aianalysis/chat/SkillPackPanel';
import AgentAbilityPanel from '../../components/aianalysis/AgentAbilityPanel';
import ExternalAgentPanel from '../../components/aianalysis/ExternalAgentPanel';
import ExternalServersPanel from '../../components/aianalysis/ExternalServersPanel';
import WebSearchPanel from '../../components/aianalysis/WebSearchPanel';
import AutomationRulesPanel from '../../components/aianalysis/AutomationRulesPanel';
import ActionLedgerPanel from '../../components/aianalysis/ActionLedgerPanel';
import { setAgentEnabled, setExternalToolsEnabled, setWebSearchEnabled } from '../aiAgent/prefs';
import { writeModelRoutes, saveRouteProfile } from '../aiModelRouting';
import { writePersonaLayer } from '../aiChat/personaLayers';
import { addCandidates, saveMemory } from '../aiChat/memory';
import { saveRule } from '../aiAgent/automation/ruleStore';
import { appendAction, __resetLedgerForTests } from '../aiTools/ledger';
import { clearStore, AI_ANALYSIS_STORES } from '../aiAnalysisStore';

jest.mock('../aiAnalysisDesktop', ()=>({
	...jest.requireActual('../aiAnalysisDesktop'),
	isDesktopBridgeAvailable: ()=>true,
	desktopMcpServerStatus: jest.fn(async ()=>({ available: true, running: true, enabled: true, url: 'http://127.0.0.1:39991/mcp', port: 39991, endpointFile: '/tmp/horosa-mcp-endpoint.json', binaryPath: '/Applications/X.app/Contents/MacOS/X' })),
	desktopMcpServerSetEnabled: jest.fn(async ()=>({ available: true })),
	desktopMcpServerRotateToken: jest.fn(async ()=>({ available: true })),
	desktopMcpServerRevealToken: jest.fn(async ()=>({ available: true, token: 't' })),
	desktopNotifyHookStatus: jest.fn(async ()=>({ available: true, enabled: true, valid: true, path: '/Users/x/bin/notify.sh' })),
	desktopNotifyHookSet: jest.fn(async ()=>({ available: true })),
	desktopNotifyHookRun: jest.fn(async ()=>({ available: true, ok: true })),
	desktopMcpClientList: jest.fn(async ()=>({ available: true, value: [{ id: 'srv1', name: '时间服务', enabled: true, connected: true, readOnlyOnly: true, allowTools: [], transport: { kind: 'http', url: 'https://example.com/mcp' } }] })),
	desktopMcpClientUpsert: jest.fn(async ()=>({ available: true })),
	desktopMcpClientRemove: jest.fn(async ()=>({ available: true })),
	desktopMcpClientConnect: jest.fn(async ()=>({ available: true, value: { tools: [] } })),
	desktopMcpClientDisconnect: jest.fn(async ()=>({ available: true })),
	desktopSetAgentEnabled: jest.fn(async ()=>({ available: true })),
	desktopSetSchedulerEnabled: jest.fn(async ()=>({ available: true })),
}));
jest.mock('../../integrations/webSearch', ()=>({
	...jest.requireActual('../../integrations/webSearch'),
	getActiveSearchProfile: jest.fn(async ()=>({ id: 'ws1', engine: 'tavily', baseUrl: '', apiKey: 'k', enabled: true })),
	saveSearchProfile: jest.fn(async ()=>({})),
	removeSearchProfile: jest.fn(async ()=>true),
	runWebSearch: jest.fn(async ()=>({ ok: true, data: { results: [] } })),
}));

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); };
const click = (el)=>act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const norm = (t)=>`${t || ''}`.replace(/\s+/g, '');
function findByText(root, selector, text){
	return Array.from(root.querySelectorAll(selector)).find((el)=>norm(el.textContent).indexOf(norm(text)) >= 0) || null;
}
async function openSelect(anchorEl){
	const sel = anchorEl.closest('.ant-select') || anchorEl;
	const target = sel.querySelector('.ant-select-selector') || sel;
	await act(async ()=>{ target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
	await flush();
}
const profiles = [{ id: 'p1', name: '甲', enabled: true, chatModelIds: ['m1', 'm2'], providerType: 'openai' }];
const activeSource = { id: 'local-1', title: '张三', sourceType: 'chart', record: { name: '张三' } };
const skillBundle = { id: 'b1', name: '事业', skill: { version: 1, triggers: ['事业'], requires: 'chart', techniqueKeys: [], sections: [], promptTemplate: '分析{{source}}', argsSpec: [], outputFormat: '', schoolNote: '', description: '' } };

// 面板工厂:按登记的 file 决定渲染哪个组件;seeds 影响 props(草稿 / 技能行)
function elementFor(file, seeds){
	switch(file){
		case 'chat/AdvancedPane.js':
		case 'chat/AdvSectionNav.js':
			return <AdvancedPane><div /></AdvancedPane>;
		case 'chat/ChatContextPolicyPanel.js': return <ChatContextPolicyPanel model="deepseek-chat" />;
		case 'chat/ChatModelRoutesPanel.js': return <ChatModelRoutesPanel providerProfiles={profiles} />;
		case 'chat/AdvCard.js':
		case 'chat/BestOfPanel.js': return <BestOfPanel providerProfiles={profiles} />;
		case 'chat/PersonaMemoryPanel.js':
			return <PersonaMemoryPanel activeSource={activeSource} activeConversation={{ id: 'conv-1', title: '对话' }} selectedTechniqueKeys={['bazi']}
				initDraft={seeds.has('persona-draft') ? { text: '## 流派偏好\n草稿', conversations: 1 } : null} onInit={()=>{}} onExtract={()=>{}} onSaveSessionPersona={()=>{}} />;
		case 'chat/SkillPackPanel.js': return <SkillPackPanel bundles={seeds.has('skill-row') ? [skillBundle] : []} materials={[]} reloadBundles={()=>{}} />;
		case 'AgentAbilityPanel.js': return <AgentAbilityPanel />;
		case 'ExternalAgentPanel.js': return <ExternalAgentPanel />;
		case 'ExternalServersPanel.js': return <ExternalServersPanel />;
		case 'WebSearchPanel.js': return <WebSearchPanel />;
		case 'AutomationRulesPanel.js': return <AutomationRulesPanel />;
		case 'ActionLedgerPanel.js': return <ActionLedgerPanel />;
		default: throw new Error(`未知面板文件 ${file}`);
	}
}

async function seed(kind){
	switch(kind){
		case 'route': writeModelRoutes({ final: 'p1::m1' }); return;
		case 'route-profile': saveRouteProfile('甲'); return;
		case 'persona-layer': writePersonaLayer('subject', activeSource.id, '只看事业'); return;
		case 'persona-draft': return;   // 走 props
		case 'skill-row': return;       // 走 props
		case 'memory-candidate': await addCandidates([{ text: '我妻子叫李四', subject: { type: 'user' } }], 'manual'); return;
		case 'memory-item': await saveMemory({ text: '常年出差', subject: { type: 'user' }, status: 'confirmed', source: 'manual' }); return;
		case 'rule-row': await saveRule({ name: '测试规则', event: 'record.saved', enabled: true, cooldownMs: 60000, match: {}, actions: [{ type: 'select-source' }] }); return;
		case 'ledger-rows': for(let i = 0; i < 25; i += 1){ appendAction({ id: `a-${i}`, origin: ['in-app', 'mcp', 'goal', 'scheduled', 'automation'][i % 5], tool: 'create_chart_record', summary: `建档 ${i}`, undo: { kind: 'restore-record-flag' } }); } return;
		case 'websearch-profile': return;  // 走 mock
		default: throw new Error(`未知 seed ${kind}`);
	}
}

async function applyReveal(host, op){
	const [name, restRaw] = [op.split(':')[0], op.slice(op.indexOf(':') + 1)];
	if(name === 'agent-on' || name === 'desktop' || name === 'pref' || name === 'seed'){ return; }   // 渲染前已处理
	if(name === 'collapse'){
		const header = findByText(host, '.ant-collapse-header', restRaw);
		if(!header){ throw new Error(`折叠头未找到: ${restRaw}`); }
		if(!header.closest('.ant-collapse-item').classList.contains('ant-collapse-item-active')){ click(header); await flush(); }
		return;
	}
	if(name === 'tab'){
		const tab = findByText(host, '.ant-tabs-tab', restRaw);
		if(!tab){ throw new Error(`页签未找到: ${restRaw}`); }
		click(tab); await flush(); return;
	}
	if(name === 'modal'){
		const el = host.querySelector(`[${restRaw}]`);
		if(!el){ throw new Error(`模态触发锚未找到: ${restRaw}`); }
		click(el); await flush(); return;
	}
	if(name === 'select'){
		const [anchor, text] = [restRaw.slice(0, restRaw.indexOf('=')), restRaw.slice(restRaw.indexOf('=') + 1)];
		const el = document.querySelector(`[${anchor}]`);
		if(!el){ throw new Error(`下拉锚未找到: ${anchor}`); }
		await openSelect(el);
		const opt = Array.from(document.querySelectorAll('.ant-select-item-option')).find((o)=>norm(o.textContent).indexOf(norm(text)) >= 0 || norm(o.getAttribute('title')).indexOf(norm(text)) >= 0);
		if(!opt){ throw new Error(`下拉选项未找到: ${text}`); }
		click(opt); await flush(); return;
	}
	if(name === 'radio'){
		const [anchor, value] = [restRaw.slice(0, restRaw.indexOf('=')), restRaw.slice(restRaw.indexOf('=') + 1)];
		const group = document.querySelector(`[${anchor}]`);
		const input = group ? group.querySelector(`input[type="radio"][value="${value}"]`) : null;
		if(!input){ throw new Error(`单选未找到: ${anchor}=${value}`); }
		click(input); await flush(); return;
	}
	if(name === 'type'){
		const [anchor, text] = [restRaw.slice(0, restRaw.indexOf('=')), restRaw.slice(restRaw.indexOf('=') + 1)];
		const el = document.querySelector(`[${anchor}]`);
		const input = el && el.tagName === 'INPUT' ? el : (el ? el.querySelector('input') : null);
		if(!input){ throw new Error(`输入锚未找到: ${anchor}`); }
		act(()=>{ const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); });
		await flush(); return;
	}
	throw new Error(`未知 reveal 操作 ${op}`);
}

const registry = listAdvancedControls();

describe('进阶页控件登记表 reveal 合同', ()=>{
	let host;
	beforeEach(async ()=>{
		window.localStorage.clear(); __resetLedgerForTests();
		await clearStore(AI_ANALYSIS_STORES.workspaceMeta); await clearStore(AI_ANALYSIS_STORES.automationRules);
		host = document.createElement('div'); document.body.appendChild(host);
	});
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; window.localStorage.clear(); });

	test('登记表非空且形状完整(id/card/file/anchor/kind/instances/reveal)', ()=>{
		expect(registry.controls.length).toBeGreaterThanOrEqual(120);
		registry.controls.forEach((c)=>{ ['id', 'card', 'file', 'anchor', 'kind'].forEach((k)=>expect(typeof c[k]).toBe('string')); expect(c.instances).toBeGreaterThanOrEqual(1); expect(Array.isArray(c.reveal)).toBe(true); });
	});

	registry.controls.forEach((c)=>{
		test(`${c.id} · [${c.anchor}] ×${c.instances} @ ${c.file}`, async ()=>{
			const reveal = c.reveal || [];
			const seeds = new Set(reveal.filter((r)=>r.indexOf('seed:') === 0).map((r)=>r.slice(5)));
			if(reveal.indexOf('agent-on') >= 0 || c.card.indexOf('adv-agent') === 0){ setAgentEnabled(true); }
			reveal.filter((r)=>r.indexOf('pref:') === 0).forEach((r)=>{ const k = r.slice(5); if(k === 'externalTools'){ setExternalToolsEnabled(true); } else if(k === 'webSearch'){ setWebSearchEnabled(true); } else { throw new Error(`未知 pref ${k}`); } });
			for(const s of seeds){ await seed(s); }
			await act(async ()=>{ ReactDOM.render(elementFor(c.file, seeds), host); await new Promise((r)=>setTimeout(r, 0)); });
			await flush();
			for(const op of reveal){ await applyReveal(host, op); }
			const found = document.querySelectorAll(`[${c.anchor}]`).length;   // 模态在 body 下的 portal 里,查全文档
			expect({ id: c.id, anchor: c.anchor, found }).toEqual({ id: c.id, anchor: c.anchor, found: expect.any(Number) });
			// M-178:恰等,不是 ≥ —— 「≥」下登记 1 处、页面长出 3 处也绿,登记表就退化成「至少有一个」的存在性断言。
			expect({ id: c.id, anchor: c.anchor, found }).toEqual({ id: c.id, anchor: c.anchor, found: c.instances });
		});
	});

	test('🔴 打开整页(六卡 + 行动能力开)不写任何登记的 localStorage 存储键', async ()=>{
		setAgentEnabled(true);
		const before = new Set(Object.keys(window.localStorage));
		await act(async ()=>{ ReactDOM.render(
			<AdvancedPane>
				{[<ChatContextPolicyPanel key="context-policy" model="deepseek-chat" />, <ChatModelRoutesPanel key="model-routes" providerProfiles={profiles} />, <SkillPackPanel key="skill-packs" bundles={[]} materials={[]} reloadBundles={()=>{}} />,
					<PersonaMemoryPanel key="persona-memory" activeSource={activeSource} activeConversation={null} onInit={()=>{}} onExtract={()=>{}} />, <BestOfPanel key="best-of" providerProfiles={profiles} />]}
				<AgentAbilityPanel />
			</AdvancedPane>, host); await new Promise((r)=>setTimeout(r, 0)); });
		await flush();
		const stores = registry.controls.map((c)=>`${c.store || ''}`).filter((s)=>s.indexOf('localStorage:') === 0).map((s)=>s.slice('localStorage:'.length).split(' ')[0]);
		const after = Object.keys(window.localStorage);
		stores.forEach((k)=>{ if(!before.has(k)){ expect({ key: k, written: after.indexOf(k) >= 0 }).toEqual({ key: k, written: false }); } });
	});
});
