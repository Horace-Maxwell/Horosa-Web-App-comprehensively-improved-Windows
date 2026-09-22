// xq-ui 日期/时间/区间选择框「数字快输」:输满即换算、回车/失焦换算、按 format 切位、区间按端、越界保旧值、时间型只切时分秒
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import moment from 'moment';
import { XQDatePicker, XQTimePicker } from '../index';

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const setInput = (el, v)=>{ const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
const key = (el, k)=>{ const e = new KeyboardEvent('keydown', { key: k, keyCode: k === 'Enter' ? 13 : 0, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 30)); }); };

let host;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; });

// 受控父组件夹具:与真实宿主同形(value 存 state,onChange 回写)
class Harness extends React.Component{
	constructor(props){ super(props); this.state = { value: props.initial === undefined ? null : props.initial }; this.onChange = (v)=>{ this.props.spy(v); this.setState({ value: v }); }; }
	render(){ const { Picker, pickerProps } = this.props; return <Picker {...pickerProps} value={this.state.value} onChange={this.onChange} />; }
}
function mount(Picker, pickerProps = {}, initial){
	const spy = jest.fn(); const ref = React.createRef();
	act(()=>{ ReactDOM.render(<Harness ref={ref} Picker={Picker} pickerProps={pickerProps} spy={spy} initial={initial} />, host); });
	return { spy, ref };
}
const inputs = ()=>Array.from(host.querySelectorAll('.ant-picker input'));
const focusType = (el, v)=>{ act(()=>{ el.focus(); setInput(el, v); }); };

describe('XQDatePicker 数字快输', ()=>{
	it('日期型:键满 8 位即换算成 moment 并回填输入框文本', async ()=>{
		const { spy, ref } = mount(XQDatePicker, { size: 'small' });
		expect(host.querySelector('[data-quick-digits-host="1"]')).toBeTruthy();
		focusType(inputs()[0], '20061004');
		expect(spy).toHaveBeenCalledTimes(1);
		const m = spy.mock.calls[0][0];
		expect(moment.isMoment(m) && m.isValid()).toBe(true);
		expect(m.format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 00:00:00');
		await flush();
		expect(ref.current.state.value.format('YYYY-MM-DD')).toBe('2006-10-04');
		expect(inputs()[0].value).toBe('2006-10-04');
	});
	it('不足位 + 回车:月日补 01;越界月份不换算且保留旧值', async ()=>{
		const { spy, ref } = mount(XQDatePicker, {}, moment('2025-01-01'));
		focusType(inputs()[0], '2006');
		act(()=>{ key(inputs()[0], 'Enter'); });
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0][0].format('YYYY-MM-DD')).toBe('2006-01-01');
		await flush();
		focusType(inputs()[0], '20061304');
		act(()=>{ key(inputs()[0], 'Enter'); });
		expect(spy).toHaveBeenCalledTimes(1);
		expect(ref.current.state.value.format('YYYY-MM-DD')).toBe('2006-01-01');
	});
	it('带时间的 format(YYYY-MM-DD HH:mm):12 位切分;失焦亦换算', async ()=>{
		const { spy } = mount(XQDatePicker, { showTime: { format: 'HH:mm' }, format: 'YYYY-MM-DD HH:mm' });
		focusType(inputs()[0], '200610040958');
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0][0].format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 09:58:00');
		await flush();
		focusType(inputs()[0], '19991231');
		act(()=>{ inputs()[0].blur(); inputs()[0].dispatchEvent(new FocusEvent('blur')); });
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy.mock.calls[1][0].format('YYYY-MM-DD HH:mm')).toBe('1999-12-31 00:00');
	});
	it('非纯数字文本不接管(antd 自己按 format 解析)', ()=>{
		const { spy } = mount(XQDatePicker, {});
		focusType(inputs()[0], '2006-10-04');
		act(()=>{ key(inputs()[0], 'Enter'); });
		// antd 自己会在回车时把合法文本变成值(可能调 onChange),但绝不该由快输宿主用 8 位切法处理:两种路径结果一致
		if(spy.mock.calls.length){ expect(spy.mock.calls[0][0].format('YYYY-MM-DD')).toBe('2006-10-04'); }
	});
});

describe('XQDatePicker.RangePicker 数字快输', ()=>{
	it('按被键入的输入框改对应端,另一端保留', async ()=>{
		const { spy } = mount(XQDatePicker.RangePicker, {}, [moment('2025-01-01'), moment('2065-01-01')]);
		const ins = inputs();
		expect(ins.length).toBe(2);
		focusType(ins[1], '20301231');
		expect(spy).toHaveBeenCalledTimes(1);
		const vals = spy.mock.calls[0][0];
		expect(vals[0].format('YYYY-MM-DD')).toBe('2025-01-01');
		expect(vals[1].format('YYYY-MM-DD')).toBe('2030-12-31');
		await flush();
		focusType(inputs()[0], '2000');
		act(()=>{ key(inputs()[0], 'Enter'); });
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy.mock.calls[1][0].map((m)=>m.format('YYYY-MM-DD'))).toEqual(['2000-01-01', '2030-12-31']);
	});
	it('另一端为空时用同一天补齐(消费者不会丢弃半区间);再键另一端即覆盖', async ()=>{
		const { spy, ref } = mount(XQDatePicker.RangePicker, {}, null);
		focusType(inputs()[0], '20061004');
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0][0].map((m)=>m.format('YYYY-MM-DD'))).toEqual(['2006-10-04', '2006-10-04']);
		await flush();
		expect(inputs().map((i)=>i.value)).toEqual(['2006-10-04', '2006-10-04']);
		focusType(inputs()[1], '20301231');
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy.mock.calls[1][0].map((m)=>m.format('YYYY-MM-DD'))).toEqual(['2006-10-04', '2030-12-31']);
		await flush();
		expect(ref.current.state.value.map((m)=>m.format('YYYY-MM-DD'))).toEqual(['2006-10-04', '2030-12-31']);
	});
});

describe('XQTimePicker 数字快输', ()=>{
	it('时间型:只切时分秒(HH:mm:ss),6 位即换算;4 位 + 回车秒补 00', async ()=>{
		const { spy } = mount(XQTimePicker, {}, moment('2025-01-01 12:00:00'));
		focusType(inputs()[0], '095801');
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0][0].format('HH:mm:ss')).toBe('09:58:01');
		await flush();
		focusType(inputs()[0], '2130');
		act(()=>{ key(inputs()[0], 'Enter'); });
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy.mock.calls[1][0].format('HH:mm:ss')).toBe('21:30:00');
		focusType(inputs()[0], '2460');
		act(()=>{ key(inputs()[0], 'Enter'); });
		expect(spy).toHaveBeenCalledTimes(2);
	});
});
