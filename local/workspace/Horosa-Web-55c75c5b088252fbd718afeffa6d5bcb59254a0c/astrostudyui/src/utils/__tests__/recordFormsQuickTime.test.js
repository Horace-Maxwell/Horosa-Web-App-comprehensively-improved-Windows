// 三张表单的「快捷输入」行:位置(选择器行之后、时区栏之前)、初始空白、输满自动回填上方时间(时区不变)、标签改名、Esc 只清空
jest.mock('../../components/amap/GeoCoordModal', ()=>({ __esModule: true, default: (props)=>props.children || null }));
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import DateTime from '../../components/comp/DateTime';
import ChartData from '../../components/user/ChartData';
import CaseData from '../../components/user/CaseData';
import ChartFormData from '../../components/comp/ChartFormData';

// jest 走经典 JSX 运行时:表单子件(LatInput/LonInput/EditableTags/DstZoneIndicator…)按应用的自动运行时写法不引 React,
// 渲染测试里给一个全局 React 即可(生产构建=自动运行时,零影响;既有说明见 tongshuSnapshot.test.js 头注释)。
global.React = React;

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const setInput = (el, v)=>{ const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
const v = (x)=>({ value: x });
const dt0 = ()=>{ const d = new DateTime({ ad: 1, zone: '+08:00', year: 1991, month: 4, date: 17, hour: 0, minute: 25, second: 0 }); d.calcJdn(); return d; };
const chartFields = ()=>({ cid: v(''), name: v(''), gender: v(0), pos: v('北京'), lat: v('39n54'), lon: v('116e24'), gpsLat: v(39.9), gpsLon: v(116.4), birth: v(dt0()), zone: v('+08:00'), memo: v(''), group: v(''), relation: v(''), rodden: v(''), sourceNote: v(''), tags: v([]) });
const caseFields = ()=>({ cid: v(''), event: v(''), memo: v(''), caseType: v('liuyao'), sourceModule: v(''), pos: v('涿州市'), lat: v('39n29'), lon: v('115e58'), gpsLat: v(39.48), gpsLon: v(115.97), divTime: v(dt0()), zone: v('+08:00'), gender: v(0), group: v(''), tags: v([]) });

let host;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; });

function quickRow(){ return host.querySelector('[data-quick-time-form="1"]'); }
function quickInput(){ return quickRow().querySelector('input'); }

describe('记录表单·快捷输入', ()=>{
	it('添加星盘:行位于出生时间选择器之后、时区栏之前;初始空;输满回填 birth,时区不变,选择器年份跟着变,文本保留', ()=>{
		const ref = React.createRef();
		act(()=>{ ReactDOM.render(<ChartData ref={ref} fields={chartFields()} okTitle="提交" returnTitle="返回列表" onOk={()=>{}} onReturn={()=>{}} />, host); });
		const row = quickRow(); expect(row).toBeTruthy();
		expect(row.previousElementSibling.textContent).toContain('出生时间：');
		expect(row.nextElementSibling.querySelector('.horosa-dst-indicator')).toBeTruthy();
		expect(quickInput().value).toBe('');
		act(()=>{ setInput(quickInput(), '20061004095801'); });
		const f = ref.current.state.fields;
		expect(f.birth.value.format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 09:58:01');
		expect(f.birth.value.ad).toBe(1);
		expect(f.zone.value).toBe('+08:00');
		expect(row.previousElementSibling.querySelector('.ant-input-number input').value).toBe('2006');
		expect(quickInput().value).toBe('20061004095801');
		// Esc:清空本行、不冒泡(preventDefault)
		const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		act(()=>{ quickInput().dispatchEvent(esc); });
		expect(esc.defaultPrevented).toBe(true);
		expect(quickInput().value).toBe('');
		expect(ref.current.state.fields.birth.value.format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 09:58:01');
	});
	it('添加起课:标签「起课时间：」(无「起课事件：」);12 位 + 回车回填 divTime(秒补 0)', ()=>{
		const ref = React.createRef();
		act(()=>{ ReactDOM.render(<CaseData ref={ref} fields={caseFields()} okTitle="提交" returnTitle="返回列表" onOk={()=>{}} onReturn={()=>{}} />, host); });
		expect(host.textContent.indexOf('起课时间：')).toBeGreaterThanOrEqual(0);
		expect(host.textContent.indexOf('起课事件：')).toBe(-1);
		const row = quickRow(); expect(row).toBeTruthy();
		expect(row.previousElementSibling.textContent).toContain('起课时间：');
		act(()=>{ setInput(quickInput(), '200610040958'); });
		act(()=>{ quickInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
		expect(ref.current.state.fields.divTime.value.format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 09:58:00');
		expect(ref.current.state.fields.zone.value).toBe('+08:00');
	});
	it('修改参数表单:quickBirth 经 changeBirth 双写 date/time(实例级)', ()=>{
		const fields = { date: v(dt0()), time: v(dt0()), zone: v('+08:00'), gpsLat: v(39.9), gpsLon: v(116.4), pos: v('北京'), lat: v('39n54'), lon: v('116e24') };
		const inst = new ChartFormData({ fields, needDate: true });
		inst.setState = (patch)=>{ inst.state = { ...inst.state, ...patch }; };
		const nd = new DateTime({ ad: 1, zone: '+08:00', year: 2006, month: 10, date: 4, hour: 9, minute: 58, second: 1 }); nd.calcJdn();
		inst.quickBirth(nd);
		expect(inst.state.fields.date.value.format('YYYY-MM-DD HH:mm:ss')).toBe('2006-10-04 09:58:01');
		expect(inst.state.fields.time.value.format('HH:mm:ss')).toBe('09:58:01');
		expect(inst.state.fields.zone.value).toBe('+08:00');
	});
});
