// 单行时间文本(天文馆时间行同款)·快捷数字录入:单击走宿主 onClick 不变、双击键入、输满提交、Esc 取消、innerRef 两态同根、越界保旧值
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import DateTime from '../DateTime';
import { QuickTimeText } from '../QuickTimeField';

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const setInput = (el, v)=>{ const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
const key = (el, k)=>{ const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
const base = ()=>{ const d = new DateTime({ ad: 1, zone: '+08:00', year: 2025, month: 1, date: 1, hour: 12, minute: 0, second: 0 }); d.calcJdn(); return d; };

let host;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; });

function mount(extra = {}){
	const spy = jest.fn(); const bad = jest.fn(); const click = jest.fn(); const ref = React.createRef();
	act(()=>{ ReactDOM.render(<QuickTimeText innerRef={ref} className="planetarium-time-display" role="button" value={base()} onClick={click} onQuickCommit={spy} onInvalid={bad} {...extra}>2025-01-01 12:00:00</QuickTimeText>, host); });
	return { spy, bad, click, ref };
}
const trigger = ()=>host.querySelector('[data-quick-time-trigger="1"]');
const input = ()=>host.querySelector('[data-quick-time-input="1"]');
const dbl = ()=>act(()=>{ trigger().dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); });

describe('QuickTimeText', ()=>{
	it('非键入态:宿主 className/role/ref 原样,单击走宿主 onClick,文字照显', ()=>{
		const { click, ref } = mount();
		const el = trigger();
		expect(el.tagName).toBe('DIV');
		expect(el.className).toContain('planetarium-time-display');
		expect(el.className).toContain('horosa-quick-time-text');
		expect(el.getAttribute('role')).toBe('button');
		expect(el.textContent).toBe('2025-01-01 12:00:00');
		expect(ref.current).toBe(el);
		act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
		expect(click).toHaveBeenCalledTimes(1);
		expect(input()).toBe(null);
	});
	it('双击:同一根元素变键入态(ref 不变),输满 14 位提交并回到文字态', ()=>{
		const { spy, ref } = mount();
		const rootBefore = ref.current;
		dbl();
		expect(trigger()).toBe(null);
		expect(input()).toBeTruthy();
		expect(ref.current).toBe(rootBefore);
		expect(ref.current.className).toContain('is-editing');
		act(()=>{ setInput(input(), '20061004095801'); });
		expect(spy).toHaveBeenCalledTimes(1);
		const dt = spy.mock.calls[0][0];
		expect([dt.ad, dt.year, dt.month, dt.date, dt.hour, dt.minute, dt.second, dt.zone]).toEqual([1, 2006, 10, 4, 9, 58, 1, '+08:00']);
		expect(input()).toBe(null);
		expect(trigger()).toBeTruthy();
		expect(ref.current).toBe(rootBefore);
	});
	it('8 位 + 回车提交为当日零点;Esc 取消不提交;越界报错且仍在键入态', ()=>{
		const { spy, bad } = mount();
		dbl();
		act(()=>{ setInput(input(), '19991231'); });
		act(()=>{ key(input(), 'Enter'); });
		expect(spy).toHaveBeenCalledTimes(1);
		const dt = spy.mock.calls[0][0];
		expect([dt.year, dt.month, dt.date, dt.hour, dt.minute, dt.second]).toEqual([1999, 12, 31, 0, 0, 0]);
		dbl();
		act(()=>{ setInput(input(), '2006'); });
		act(()=>{ key(input(), 'Escape'); });
		expect(spy).toHaveBeenCalledTimes(1);
		expect(input()).toBe(null);
		dbl();
		act(()=>{ setInput(input(), '20061304'); });
		act(()=>{ key(input(), 'Enter'); });
		expect(bad).toHaveBeenCalledTimes(1);
		expect(bad.mock.calls[0][0]).toContain('月份');
		expect(input()).toBeTruthy();
		expect(spy).toHaveBeenCalledTimes(1);
	});
	it('as="span" + text 属性也可用;空白失焦取消', ()=>{
		const spy = jest.fn();
		act(()=>{ ReactDOM.render(<QuickTimeText as="span" text="2025-01-01" value={base()} onQuickCommit={spy} />, host); });
		expect(trigger().tagName).toBe('SPAN');
		expect(trigger().textContent).toBe('2025-01-01');
		dbl();
		expect(document.activeElement).toBe(input());
		act(()=>{ input().blur(); });
		expect(input()).toBe(null);
		expect(spy).not.toHaveBeenCalled();
	});
});
