// 真 SpaceTimePanel(25 个技法宿主的共享左栏):双击键入 → 宿主 onTimeChange 收到 {time, ad:1, confirmed:true};
// 以新值重渲后单击弹窗,编辑器显示新年份(弹窗子树随键入态卸载重挂,无陈旧草稿);提示与内联行仍在。
jest.mock('../../amap/GeoCoordModal', ()=>({ __esModule: true, default: (props)=>props.children || null }));
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import DateTime from '../DateTime';
import SpaceTimePanel from '../SpaceTimePanel';

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const setInput = (el, v)=>{ const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 80)); }); };
function mkFields(dt){
	return {
		date: { value: dt.clone() }, time: { value: dt.clone() }, ad: { value: dt.ad }, zone: { value: dt.zone },
		pos: { value: '北京' }, lon: { value: '116e24' }, lat: { value: '39n54' }, gpsLon: { value: 116.4 }, gpsLat: { value: 39.9 },
	};
}
const base = ()=>{ const d = new DateTime({ ad: 1, zone: '+08:00', year: 1990, month: 5, date: 18, hour: 10, minute: 0, second: 0 }); d.calcJdn(); return d; };

let host;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; });

describe('SpaceTimePanel 双击快捷录入', ()=>{
	it('双击键入 14 位 → onTimeChange({time, ad:1, confirmed:true}),时区沿用 fields.zone,无 step', ()=>{
		const spy = jest.fn();
		act(()=>{ ReactDOM.render(<SpaceTimePanel fields={mkFields(base())} onTimeChange={spy} />, host); });
		expect(host.querySelector('.horosa-field-hint').textContent).toBe('当地时间');
		expect(host.querySelector('.horosa-time-adjust-inline')).toBeTruthy();
		const btn = host.querySelector('[data-quick-time-trigger="1"]');
		expect(btn.textContent).toContain('1990-05-18 10:00:00');
		act(()=>{ btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); });
		const inp = host.querySelector('[data-quick-time-input="1"]');
		expect(inp).toBeTruthy();
		act(()=>{ setInput(inp, '20061004095801'); });
		expect(spy).toHaveBeenCalledTimes(1);
		const arg = spy.mock.calls[0][0];
		expect(arg.confirmed).toBe(true); expect(arg.ad).toBe(1); expect(arg.step).toBe(undefined);
		expect(arg.time.format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 09:58:01');
		expect(arg.time.zone).toBe('+08:00');
		expect(host.querySelector('[data-quick-time-trigger="1"]')).toBeTruthy();
	});
	it('宿主按新值重渲后单击:弹窗编辑器年份=新年份(无陈旧草稿);单击本身不进键入态', async ()=>{
		const spy = jest.fn();
		act(()=>{ ReactDOM.render(<SpaceTimePanel fields={mkFields(base())} onTimeChange={spy} />, host); });
		const btn0 = host.querySelector('[data-quick-time-trigger="1"]');
		act(()=>{ btn0.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); });
		act(()=>{ setInput(host.querySelector('[data-quick-time-input="1"]'), '20061004095801'); });
		const nd = spy.mock.calls[0][0].time;
		act(()=>{ ReactDOM.render(<SpaceTimePanel fields={mkFields(nd)} onTimeChange={spy} />, host); });
		const btn = host.querySelector('[data-quick-time-trigger="1"]');
		expect(btn.textContent).toContain('2006-10-04 09:58:01');
		act(()=>{ btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
		await flush();
		const pop = document.body.querySelector('.horosa-time-popover');
		expect(pop).toBeTruthy();
		const year = pop.querySelector('.ant-input-number input');
		expect(year && year.value).toBe('2006');
		expect(host.querySelector('[data-quick-time-input="1"]')).toBe(null);
	});
});
