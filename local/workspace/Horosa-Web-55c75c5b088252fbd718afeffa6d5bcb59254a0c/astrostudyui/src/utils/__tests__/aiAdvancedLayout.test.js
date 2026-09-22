// 「进阶」页版式合同(批四):宽度档(ResizeObserver → data-adv-w,8px 滞回)、分区导轨(按钮式、不碰 location.hash)、胶囊跳转、
// 折叠自开事件、LESS 源码哨兵(含 / 的 grid 值必须转义;不许半像素字号)。jsdom 无 ResizeObserver/matchMedia:本文件本地 polyfill,每例后还原。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';
import AdvancedPane, { widthBand, ADV_WIDTH_BANDS } from '../../components/aianalysis/chat/AdvancedPane';
import { findScrollParent, jumpToSection, ADV_OPEN_EVENT } from '../../components/aianalysis/chat/AdvSectionNav';
import { ADV_SECTION_IDS } from '../../components/aianalysis/chat/AdvCard';
import { setAgentEnabled } from '../aiAgent/prefs';

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
class FakeResizeObserver {
	constructor(cb){ this.cb = cb; FakeResizeObserver.instances.push(this); }
	observe(el){ this.el = el; }
	disconnect(){ this.disconnected = true; }
	fire(width){ this.cb([{ target: this.el, contentRect: { width } }]); }
}
FakeResizeObserver.instances = [];
const SRC = path.resolve(__dirname, '..', '..');
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); };

function Sections(){
	return [
		<section key="context-policy" id={ADV_SECTION_IDS.context} data-adv-section={ADV_SECTION_IDS.context} data-slot="policy" />,
		<section key="best-of" id={ADV_SECTION_IDS.bestof} data-adv-section={ADV_SECTION_IDS.bestof} data-slot="bestof" />,
		<section key="model-routes" id={ADV_SECTION_IDS.routes} data-adv-section={ADV_SECTION_IDS.routes} data-slot="routes" />,
	];
}

describe('进阶页 · widthBand 纯函数', ()=>{
	test('未量到=空串;三档;滞回只在档界 ±8px 内保持上一档', ()=>{
		expect(widthBand(null, '')).toBe('');
		expect(widthBand(700, '')).toBe('narrow');
		expect(widthBand(900, '')).toBe('medium');
		expect(widthBand(1200, '')).toBe('wide');
		expect(widthBand(ADV_WIDTH_BANDS.wide - 4, 'wide')).toBe('wide');
		expect(widthBand(ADV_WIDTH_BANDS.wide - 4, '')).toBe('medium');
		expect(widthBand(ADV_WIDTH_BANDS.narrow + 4, 'narrow')).toBe('narrow');
		expect(widthBand(ADV_WIDTH_BANDS.narrow + 4, '')).toBe('medium');
		expect(widthBand(ADV_WIDTH_BANDS.wide - 20, 'wide')).toBe('medium');
	});
});

describe('进阶页 · 导轨 / 宽度档 / 胶囊(jsdom 渲染)', ()=>{
	let host; const realRO = global.ResizeObserver;
	beforeEach(()=>{ window.localStorage.clear(); FakeResizeObserver.instances = []; host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); global.ResizeObserver = realRO; window.location.hash = ''; });

	test('无 ResizeObserver:data-adv-w 为空串(交 @media 兜底);导轨 6 项;胶囊 6 枚且都可跳', ()=>{
		delete global.ResizeObserver;
		act(()=>{ ReactDOM.render(<AdvancedPane>{Sections()}<div data-slot="agent" /></AdvancedPane>, host); });
		const pane = host.querySelector('[data-advanced-pane="1"]');
		expect(pane.getAttribute('data-adv-w')).toBe('');
		expect(host.querySelector('[data-advanced-nav="1"]')).toBeTruthy();
		expect(host.querySelectorAll('[data-adv-nav]').length).toBe(6);
		expect(host.querySelector('[data-advanced-grid="1"]')).toBeTruthy();
		const pills = host.querySelectorAll('[data-advanced-pills="1"] > span');
		expect(pills.length).toBe(6);
		pills.forEach((p)=>{ expect(p.getAttribute('data-adv-jump')).toBeTruthy(); expect(p.getAttribute('role')).toBe('button'); });
	});

	test('🔴 ResizeObserver:1200→wide;0(隐藏孪生)不改;700→narrow;卸载即 disconnect', ()=>{
		global.ResizeObserver = FakeResizeObserver;
		act(()=>{ ReactDOM.render(<AdvancedPane>{Sections()}<div data-slot="agent" /></AdvancedPane>, host); });
		const pane = host.querySelector('[data-advanced-pane="1"]');
		const ro = FakeResizeObserver.instances.find((x)=>x.el === pane);
		expect(ro).toBeTruthy();
		act(()=>{ ro.fire(1200); });
		expect(pane.getAttribute('data-adv-w')).toBe('wide');
		act(()=>{ ro.fire(0); });
		expect(pane.getAttribute('data-adv-w')).toBe('wide');
		act(()=>{ ro.fire(700); });
		expect(pane.getAttribute('data-adv-w')).toBe('narrow');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		expect(ro.disconnected).toBe(true);
	});

	test('🔴 导轨按钮不是链接:点「行动能力」后 location.hash 仍为空,且广播 horosa:adv-open', ()=>{
		delete global.ResizeObserver;
		const seen = [];
		const on = (e)=>seen.push(e.detail && e.detail.id);
		window.addEventListener(ADV_OPEN_EVENT, on);
		act(()=>{ ReactDOM.render(<AdvancedPane>{Sections()}<section id={ADV_SECTION_IDS.agent} data-adv-section={ADV_SECTION_IDS.agent} data-slot="agent" /></AdvancedPane>, host); });
		const btn = host.querySelector(`[data-adv-nav="${ADV_SECTION_IDS.agent}"]`);
		expect(btn.tagName).toBe('BUTTON');
		expect(host.querySelectorAll('[data-advanced-nav="1"] a[href]').length).toBe(0);
		act(()=>{ btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(window.location.hash).toBe('');
		expect(seen).toEqual([ADV_SECTION_IDS.agent]);
		expect(btn.getAttribute('aria-current')).toBe('true');
		// 胶囊同款
		const pill = host.querySelector(`[data-adv-jump="${ADV_SECTION_IDS.routes}"]`);
		act(()=>{ pill.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(seen).toEqual([ADV_SECTION_IDS.agent, ADV_SECTION_IDS.routes]);
		window.removeEventListener(ADV_OPEN_EVENT, on);
	});

	test('行动能力开 → 导轨挂 5 个子分区(11 项)', async ()=>{
		delete global.ResizeObserver;
		act(()=>{ ReactDOM.render(<AdvancedPane>{Sections()}<div data-slot="agent" /></AdvancedPane>, host); });
		await act(async ()=>{ setAgentEnabled(true); await new Promise((r)=>setTimeout(r, 0)); });
		expect(host.querySelectorAll('[data-adv-nav]').length).toBe(11);
		expect(host.querySelector(`[data-adv-nav="${ADV_SECTION_IDS.agentLedger}"]`)).toBeTruthy();
		await act(async ()=>{ setAgentEnabled(false); await new Promise((r)=>setTimeout(r, 0)); });
		expect(host.querySelectorAll('[data-adv-nav]').length).toBe(6);
		await flush();
	});

	test('findScrollParent / jumpToSection:找到 overflow-y:auto 的祖先;目标不存在回 false 不广播', ()=>{
		const sp = document.createElement('div'); sp.style.overflowY = 'auto';
		const inner = document.createElement('div'); sp.appendChild(inner); document.body.appendChild(sp);
		expect(findScrollParent(inner)).toBe(sp);
		expect(findScrollParent(document.createElement('div'))).toBe(null);
		const seen = []; const on = (e)=>seen.push(e.detail.id); window.addEventListener(ADV_OPEN_EVENT, on);
		expect(jumpToSection(sp, 'adv-nope')).toBe(false);
		expect(seen).toEqual([]);
		window.removeEventListener(ADV_OPEN_EVENT, on); sp.remove();
	});
});

describe('进阶页 · LESS 源码哨兵', ()=>{
	const less = fs.readFileSync(path.join(SRC, 'components/aianalysis/chat/advanced.less'), 'utf8');
	test('🔴 含 / 的 grid 值必须 ~"…" 转义(LESS 把 1 / -1 当除法,实测整宽卡挤进第三列)', ()=>{
		const lines = less.split('\n').filter((l)=>/grid-(column|row|area)\s*:/.test(l) && !/\/\//.test(l.split(':')[0]));
		lines.forEach((l)=>{ if(l.indexOf('/') >= 0){ expect(l).toMatch(/~"[^"]*\/[^"]*"/); } });
		expect(lines.length).toBeGreaterThan(0);
	});
	test('🔴 零半像素字号(缩放档逐档取整不一致=版面抖动)', ()=>{
		expect(less).not.toMatch(/font-size:\s*\d+\.5px/);
	});
	test('宽度档由属性选择器驱动,@media 只做兜底', ()=>{
		expect(less).toContain(".pane[data-adv-w='narrow'] .grid");
		expect(less).toContain(".pane[data-adv-w='wide'] .rail");
		expect(less).toContain('@media (max-width: 1180px)');
	});
});
