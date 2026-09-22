// 「按任务用模型」整宽表格合同(批四):表头七格;六槽 × 五控件的「跟随/已覆盖」格标记随键变;行级重置一键清两键;方案工具条另存/删除;
// 表格随卡身宽退化为堆叠(ResizeObserver)。锚点 data-model-route/-route-thinking/-effort/-temperature/-max-tokens/-route-profile-* 一个不动。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ChatModelRoutesPanel, { ROUTE_GRID_STACK_BELOW } from '../../components/aianalysis/chat/ChatModelRoutesPanel';
import { ROUTE_SLOTS, MODEL_ROUTES_KEY, ROUTE_OPTIONS_KEY, ROUTE_PROFILES_KEY, writeModelRoutes, writeRouteOptions, readRouteProfiles } from '../aiModelRouting';

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
const profiles = [{ id: 'p1', name: '甲', enabled: true, chatModelIds: ['m1', 'm2'] }];
const setInput = (el, v)=>{ const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };

describe('路由表格', ()=>{
	let host; const realRO = global.ResizeObserver;
	beforeEach(()=>{ window.localStorage.clear(); FakeResizeObserver.instances = []; delete global.ResizeObserver; host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); global.ResizeObserver = realRO; });

	test('表头七格;六槽 × 五格全为「跟随」;六个行重置全禁用;未量宽=grid;打开不写三把键', ()=>{
		act(()=>{ ReactDOM.render(<ChatModelRoutesPanel providerProfiles={profiles} />, host); });
		const head = host.querySelectorAll('[data-route-grid-head="1"] > span');
		expect(head.length).toBe(7);
		expect(Array.from(head).slice(0, 6).map((s)=>s.textContent)).toEqual(['任务槽', '模型', '思考档', '推理档', '温度', '输出上限']);
		expect(host.querySelectorAll('[data-route-cell="inherit"]').length).toBe(ROUTE_SLOTS.length * 5);
		expect(host.querySelectorAll('[data-route-cell="set"]').length).toBe(0);
		const resets = host.querySelectorAll('[data-route-row-reset]');
		expect(resets.length).toBe(ROUTE_SLOTS.length);
		resets.forEach((b)=>expect(b.disabled).toBe(true));
		expect(host.querySelector('[data-route-grid="1"]').getAttribute('data-layout')).toBe('grid');
		['data-model-route', 'data-route-thinking', 'data-route-effort', 'data-route-temperature', 'data-route-max-tokens'].forEach((a)=>expect(host.querySelectorAll(`[${a}]`).length).toBe(ROUTE_SLOTS.length));
		expect(window.localStorage.getItem(MODEL_ROUTES_KEY)).toBe(null);
		expect(window.localStorage.getItem(ROUTE_OPTIONS_KEY)).toBe(null);
		expect(window.localStorage.getItem(ROUTE_PROFILES_KEY)).toBe(null);
	});

	test('🔴 已覆盖格带 set 标记;行重置一键清两键并回到全跟随', ()=>{
		act(()=>{ ReactDOM.render(<ChatModelRoutesPanel providerProfiles={profiles} />, host); });
		act(()=>{ writeModelRoutes({ final: 'p1::m1' }); writeRouteOptions({ final: { temperature: 0.3 }, judge: { thinking: 'high' } }); });
		expect(host.querySelectorAll('[data-route-cell="set"]').length).toBe(3);
		expect(host.querySelector('[data-route-row="final"] [data-route-col="model"]').getAttribute('data-route-cell')).toBe('set');
		expect(host.querySelector('[data-route-row="final"] [data-route-col="temperature"]').getAttribute('data-route-cell')).toBe('set');
		expect(host.querySelector('[data-route-row="judge"] [data-route-col="thinking"]').getAttribute('data-route-cell')).toBe('set');
		expect(host.querySelector('[data-route-row-reset="final"]').disabled).toBe(false);
		expect(host.querySelector('[data-route-row-reset="review"]').disabled).toBe(true);
		act(()=>{ host.querySelector('[data-route-row-reset="final"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(host.querySelectorAll('[data-route-cell="set"]').length).toBe(1);   // 只剩 judge 的思考档
		expect(window.localStorage.getItem(MODEL_ROUTES_KEY)).toBe(null);
		expect(JSON.parse(window.localStorage.getItem(ROUTE_OPTIONS_KEY))).toEqual({ judge: { thinking: 'high' } });
		act(()=>{ host.querySelector('[data-route-row-reset="judge"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(window.localStorage.getItem(ROUTE_OPTIONS_KEY)).toBe(null);
		expect(host.querySelector('[data-model-routes-panel]').getAttribute('data-active')).toBe('0');
	});

	test('方案工具条:另存为 → active;删除 → 清 active(当前设置不动)', ()=>{
		act(()=>{ ReactDOM.render(<ChatModelRoutesPanel providerProfiles={profiles} />, host); });
		act(()=>{ writeRouteOptions({ final: { maxTokens: 555 } }); });
		const name = host.querySelector('[data-route-profile-name="1"]');
		const save = host.querySelector('[data-route-profile-save="1"]');
		expect(save.disabled).toBe(true);
		act(()=>{ setInput(name, '方案甲'); });
		expect(host.querySelector('[data-route-profile-save="1"]').disabled).toBe(false);
		act(()=>{ host.querySelector('[data-route-profile-save="1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(readRouteProfiles().active).toBe('方案甲');
		expect(host.querySelector('[data-model-routes-panel]').getAttribute('data-route-profile-active')).toBe('方案甲');
		expect(host.querySelector('[data-route-profile-dirty="1"]')).toBe(null);
		act(()=>{ writeRouteOptions({ final: { maxTokens: 999 } }); });
		expect(host.querySelector('[data-route-profile-dirty="1"]')).toBeTruthy();
		act(()=>{ host.querySelector('[data-route-profile-remove="1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(readRouteProfiles().active).toBe('');
		expect(JSON.parse(window.localStorage.getItem(ROUTE_OPTIONS_KEY))).toEqual({ final: { maxTokens: 999 } });
	});

	test(`ResizeObserver:卡身 < ${ROUTE_GRID_STACK_BELOW} → stack;回宽 → grid`, ()=>{
		global.ResizeObserver = FakeResizeObserver;
		act(()=>{ ReactDOM.render(<ChatModelRoutesPanel providerProfiles={profiles} />, host); });
		const grid = host.querySelector('[data-route-grid="1"]');
		const ro = FakeResizeObserver.instances.find((x)=>x.el === grid);
		expect(ro).toBeTruthy();
		act(()=>{ ro.fire(600); });
		expect(grid.getAttribute('data-layout')).toBe('stack');
		act(()=>{ ro.fire(1000); });
		expect(grid.getAttribute('data-layout')).toBe('grid');
	});
});
