// 「进阶」页合同:①插座迁移——两处插座字面各恰一处且都在 renderAdvancedPane 里,设置页不再渲染它们;
// ②页签 advanced 紧随 settings;③各设置卡改用统一外壳后 data-* 根属性一个不丢(测试与 自动化驱动器靠它们定位);④外壳/编排组件 jsdom 可渲染。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';
import { AdvCard, AdvRow, AdvSwitchRow, AdvStatus } from '../../components/aianalysis/chat/AdvCard';
import AdvancedPane from '../../components/aianalysis/chat/AdvancedPane';
import ChatModelRoutesPanel from '../../components/aianalysis/chat/ChatModelRoutesPanel';
import BestOfPanel from '../../components/aianalysis/chat/BestOfPanel';
import SkillPackPanel from '../../components/aianalysis/chat/SkillPackPanel';
import ChatContextPolicyPanel from '../../components/aianalysis/chat/ChatContextPolicyPanel';

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
const strip = (t)=>t.split('\n').map((l)=>l.replace(/\/\/.*$/, '')).join('\n');
function fnBody(src, name){
	const i = src.indexOf(`function ${name}(`);
	expect(i).toBeGreaterThan(0);
	const j = src.indexOf('\n\tfunction ', i + 10);
	return src.slice(i, j > 0 ? j : undefined);
}

describe('进阶页 · 插座迁移与页签(源码结构锁)', ()=>{
	const main = strip(read('components/aianalysis/AIAnalysisMain.js'));
	test('🔴 两处插座字面各恰一处,且都在 renderAdvancedPane 内;设置页不再含它们', ()=>{
		expect((main.match(/\{chatAssist\.settingsPanels\}/g) || []).length).toBe(1);
		expect((main.match(/<AgentAbilityPanel \/>/g) || []).length).toBe(1);
		const adv = fnBody(main, 'renderAdvancedPane');
		expect(adv).toContain('{chatAssist.settingsPanels}');
		expect(adv).toContain('<AgentAbilityPanel />');
		expect(adv).toMatch(/<AdvancedPane(\s[^>]*)?>/);   // [Q-294·AR-19] 外壳带 personaInjecting 属性
		const settings = fnBody(main, 'renderSettingsPane');
		expect(settings).not.toContain('chatAssist.settingsPanels');
		expect(settings).not.toContain('<AgentAbilityPanel');
		expect(settings).toContain("setInnerTab('advanced')");
	});
	test('页签 advanced 紧随 settings;TabPane 渲染 renderAdvancedPane', ()=>{
		const tabs = main.slice(main.indexOf('const SECONDARY_TABS = ['), main.indexOf('];', main.indexOf('const SECONDARY_TABS = [')));
		const keys = (tabs.match(/key: '([a-z]+)'/g) || []).map((k)=>k.replace(/key: '|'/g, ''));
		expect(keys.indexOf('advanced')).toBe(keys.indexOf('settings') + 1);
		expect(main).toContain('key="advanced"');
		expect(main).toMatch(/key="advanced">\s*<div className=\{styles\.pane\}>\{renderAdvancedPane\(\)\}<\/div>/);
		// 页签下标与数组一致:进阶用的下标恰指向 advanced
		const m = /SECONDARY_TABS\[(\d+)\]\.icon\}进阶/.exec(main);
		expect(m).toBeTruthy();
		expect(keys[Number(m[1])]).toBe('advanced');
	});
});

describe('进阶页 · 外壳与设置卡(jsdom 渲染)', ()=>{
	let host;
	beforeEach(()=>{ window.localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

	test('AdvCard:data-* 透传到根;标题/状态/说明/动作/正文各就各位', ()=>{
		act(()=>{ ReactDOM.render(
			<AdvCard icon="sliders" title="标题甲" status={<AdvStatus on>开着</AdvStatus>} desc="说明乙" actions={<button type="button">动作丙</button>} data-probe-card="1">
				<AdvRow label="行标签" help="行说明"><span>控件</span></AdvRow>
				<AdvSwitchRow title="开关行" desc="开关说明" checked onChange={()=>{}} switchProps={{ 'data-probe-switch': '1' }} />
			</AdvCard>, host); });
		const root = host.querySelector('[data-probe-card="1"]');
		expect(root).toBeTruthy();
		expect(root.tagName).toBe('SECTION');
		expect(root.textContent).toContain('标题甲');
		expect(root.textContent).toContain('开着');
		expect(root.textContent).toContain('说明乙');
		expect(root.textContent).toContain('动作丙');
		expect(root.textContent).toContain('行标签');
		expect(root.textContent).toContain('行说明');
		expect(host.querySelector('[data-probe-switch="1"]')).toBeTruthy();
	});

	test('🔴 各设置卡根 data-* 一个不丢(改外壳不改定位面)', ()=>{
		const profiles = [{ id: 'p1', name: '甲', enabled: true, chatModelIds: ['m1', 'm2'] }];
		act(()=>{ ReactDOM.render(
			<div>
				<ChatContextPolicyPanel model="deepseek-chat" />
				<ChatModelRoutesPanel providerProfiles={profiles} />
				<BestOfPanel providerProfiles={profiles} />
				<SkillPackPanel bundles={[]} materials={[]} reloadBundles={()=>{}} />
			</div>, host); });
		expect(host.querySelector('[data-chat-context-policy-panel="1"][data-preset="window"]')).toBeTruthy();   // 缺省=窗口
		expect(host.querySelector('[data-policy-budget]')).toBeTruthy();
		expect(host.querySelector('[data-model-routes-panel="1"][data-active="0"]')).toBeTruthy();
		expect(host.querySelectorAll('[data-model-route]').length).toBe(6);
		expect(host.querySelector('[data-bestof-panel="1"]')).toBeTruthy();
		expect(host.querySelector('[data-bestof-mode="1"]')).toBeTruthy();
		expect(host.querySelector('[data-skill-pack-panel="1"]')).toBeTruthy();
		expect(host.querySelector('[data-skill-new="1"]')).toBeTruthy();
		expect(host.querySelector('[data-skill-import="1"]')).toBeTruthy();
		// 打开进阶页不写键(纪律与设置页一致)
		expect(window.localStorage.getItem('horosa.ai.chat.contextPolicy.v1')).toBe(null);
		expect(window.localStorage.getItem('horosa.ai.chat.modelRoutes.v1')).toBe(null);
	});

	test('AdvancedPane:按 key 落版位、无 key 元素落到末尾行动能力槽;hero 六枚状态胶囊(2026-09-11 +技能包)', ()=>{
		act(()=>{ ReactDOM.render(
			<AdvancedPane>
				{[<div key="skill-packs" data-slot="skills" />, <div key="context-policy" data-slot="policy" />, <div key="best-of" data-slot="bestof" />]}
				<div data-slot="agent" />
			</AdvancedPane>, host); });
		const slots = Array.from(host.querySelectorAll('[data-slot]')).map((el)=>el.getAttribute('data-slot'));
		expect(slots).toEqual(['policy', 'bestof', 'skills', 'agent']);
		expect(host.querySelector('[data-advanced-pane="1"]')).toBeTruthy();
		expect(host.querySelectorAll('[data-advanced-pills="1"] > span').length).toBe(6);
		expect(host.querySelector('[data-advanced-pills="1"]').textContent).toContain('上下文 · 窗口');
		expect(host.querySelector('[data-advanced-pills="1"]').textContent).toContain('行动能力 · 关');
		// [2026-09-11] 技能包胶囊:真值取技能包卡收到的 bundles;零自定义时显示「内置 N」
		expect(host.querySelector('[data-adv-pill="skills"]').textContent).toContain('技能包 · 内置');
		// [批四] 版式锚:导轨(六分区)/ 网格 / 未量宽时宽度档为空串(交 @media 兜底)
		expect(host.querySelector('[data-advanced-nav="1"]')).toBeTruthy();
		expect(host.querySelectorAll('[data-adv-nav]').length).toBe(6);
		expect(host.querySelector('[data-advanced-grid="1"]')).toBeTruthy();
		expect(host.querySelector('[data-advanced-pane="1"]').getAttribute('data-adv-w')).toBe('');
	});

	test('[批四] 路由表头 / 行动能力折叠区两枚版式锚在位(自动化与视觉脚本按它们定位)', ()=>{
		const profiles = [{ id: 'p1', name: '甲', enabled: true, chatModelIds: ['m1'] }];
		act(()=>{ ReactDOM.render(<ChatModelRoutesPanel providerProfiles={profiles} />, host); });
		expect(host.querySelector('[data-route-grid="1"]')).toBeTruthy();
		expect(host.querySelectorAll('[data-route-grid-head="1"] > span').length).toBe(7);
		expect(host.querySelectorAll('[data-model-route]').length).toBe(6);
		expect(read('components/aianalysis/AgentAbilityPanel.js')).toContain('data-agent-collapse="1"');
	});
});

// ---- [进阶审计 D4] hero 胶囊「模型路由」与卡内芯片同口径 ----
describe('[D4] 胶囊·模型路由口径', ()=>{
	let host;
	beforeEach(()=>{ window.localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); window.localStorage.clear(); });
	test('🔴 只设槽参数 / 只启用具名方案 也算「已设置」;清掉即回「跟随当前」(此前只看模型键)', ()=>{
		const { writeRouteOptions, clearRouteOptions, saveRouteProfile, clearActiveRouteProfile, writeModelRoutes, clearModelRoutes } = require('../aiModelRouting');
		act(()=>{ ReactDOM.render(<AdvancedPane><div data-slot="agent" /></AdvancedPane>, host); });
		const pills = ()=>host.querySelector('[data-advanced-pills="1"]').textContent;
		expect(pills()).toContain('模型路由 · 跟随当前');
		act(()=>{ writeRouteOptions({ judge: { temperature: 0.3 } }); });
		expect(pills()).toContain('模型路由 · 已设置');
		act(()=>{ clearRouteOptions(); });
		expect(pills()).toContain('模型路由 · 跟随当前');
		act(()=>{ saveRouteProfile('甲'); });
		expect(pills()).toContain('模型路由 · 已设置');
		act(()=>{ clearActiveRouteProfile(); });
		expect(pills()).toContain('模型路由 · 跟随当前');
		act(()=>{ writeModelRoutes({ final: 'p1::m1' }); });
		expect(pills()).toContain('模型路由 · 已设置');
		act(()=>{ clearModelRoutes(); });
		expect(pills()).toContain('模型路由 · 跟随当前');
	});
});
