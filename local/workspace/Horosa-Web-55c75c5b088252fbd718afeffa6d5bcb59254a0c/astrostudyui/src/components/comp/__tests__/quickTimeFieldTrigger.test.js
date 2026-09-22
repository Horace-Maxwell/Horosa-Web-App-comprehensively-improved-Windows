// 左栏时间字段·快捷数字录入:单击仍弹窗、双击键入、输满/回车/失焦提交、Esc 取消、越界拒绝、粘贴可用
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import DateTime from '../DateTime';
import { TimeFieldTrigger } from '../QuickTimeField';

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const setInput = (el, v)=>{ const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
const key = (el, k)=>{ const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 60)); }); };
const base = ()=>{ const d = new DateTime({ ad: 1, zone: '-05:00', year: 1990, month: 5, date: 18, hour: 10, minute: 0, second: 0 }); d.calcJdn(); return d; };

let host;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; });

function mount(extra = {}){
	const spy = jest.fn(); const bad = jest.fn();
	act(()=>{ ReactDOM.render(<TimeFieldTrigger value={base()} timeText="1990-05-18 10:00:00" popoverContent={<div data-test-popover="1">pop</div>} onQuickCommit={spy} onInvalid={bad} {...extra} />, host); });
	return { spy, bad };
}
const trigger = ()=>host.querySelector('[data-quick-time-trigger="1"]');
const input = ()=>host.querySelector('[data-quick-time-input="1"]');
const dbl = ()=>act(()=>{ trigger().dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); });

describe('TimeFieldTrigger', ()=>{
	it('单击:弹窗内容出现,按钮仍在(响应不变)', async ()=>{
		mount();
		expect(trigger()).toBeTruthy();
		act(()=>{ trigger().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
		await flush();
		expect(document.body.querySelector('[data-test-popover="1"]')).toBeTruthy();
		expect(trigger()).toBeTruthy();
		expect(input()).toBe(null);
	});
	it('双击:换成键入框,按钮消失;输满 14 位自动提交(值/纪元/时区正确)并回到按钮态', async ()=>{
		const { spy } = mount();
		dbl();
		expect(input()).toBeTruthy(); expect(trigger()).toBe(null);
		act(()=>{ setInput(input(), '20061004095801'); });
		expect(spy).toHaveBeenCalledTimes(1);
		const dt = spy.mock.calls[0][0];
		expect(dt.format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 09:58:01');
		expect(dt.ad).toBe(1); expect(dt.zone).toBe('-05:00');
		expect(spy.mock.calls[0][1]).toEqual(expect.objectContaining({ digits: '20061004095801', truncated: false }));
		expect(trigger()).toBeTruthy(); expect(input()).toBe(null);
	});
	it('12 位 + 回车 → 秒补 0;4 位 + 失焦 → 月日补 01', ()=>{
		const { spy } = mount();
		dbl(); act(()=>{ setInput(input(), '200610040958'); }); act(()=>{ key(input(), 'Enter'); });
		expect(spy.mock.calls[0][0].format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 09:58:00');
		dbl(); act(()=>{ setInput(input(), '2006'); }); act(()=>{ input().focus(); input().blur(); });
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy.mock.calls[1][0].format('YYYY-MM-DD HH:mm:ss')).toBe('2006-01-01 00:00:00');
	});
	it('空内容失焦 = 取消;Esc = 取消;都不提交', ()=>{
		const { spy, bad } = mount();
		dbl(); act(()=>{ input().focus(); input().blur(); });
		expect(trigger()).toBeTruthy(); expect(spy).not.toHaveBeenCalled();
		dbl(); act(()=>{ setInput(input(), '2006'); }); act(()=>{ key(input(), 'Escape'); });
		expect(trigger()).toBeTruthy(); expect(spy).not.toHaveBeenCalled(); expect(bad).not.toHaveBeenCalled();
	});
	it('越界:回车报错、留在键入态且文本保留、不提交;非数字被剥;多余位丢弃', ()=>{
		const { spy, bad } = mount();
		dbl(); act(()=>{ setInput(input(), '20061304'); }); act(()=>{ key(input(), 'Enter'); });
		expect(bad).toHaveBeenCalledTimes(1); expect(bad.mock.calls[0][0]).toContain('月份');
		expect(input()).toBeTruthy(); expect(input().value).toBe('20061304'); expect(spy).not.toHaveBeenCalled();
		act(()=>{ setInput(input(), '2006-10-04 09:58:01'); });   // 粘贴带分隔符:剥后恰 14 位 → 自动提交
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0][0].format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 09:58:01');
		dbl(); act(()=>{ setInput(input(), '200610040958010101'); });
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy.mock.calls[1][0].format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 09:58:01');
		expect(spy.mock.calls[1][1].truncated).toBe(true);
	});
	it('value 为空时用 zone 兜底;showIcon=false 不画图标', ()=>{
		const spy = jest.fn();
		act(()=>{ ReactDOM.render(<TimeFieldTrigger value={null} zone="+09:00" showIcon={false} timeText="—" popoverContent={<div />} onQuickCommit={spy} />, host); });
		expect(host.querySelector('.xq-icon')).toBe(null);
		dbl(); act(()=>{ setInput(input(), '20061004095801'); });
		expect(spy.mock.calls[0][0].zone).toBe('+09:00');
	});
});
