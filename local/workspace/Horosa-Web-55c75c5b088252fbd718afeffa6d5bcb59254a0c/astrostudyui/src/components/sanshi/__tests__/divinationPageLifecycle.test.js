// 奇门 / 六壬 / 太乙 / 三式合一 / 择日宿主 页面生命周期的几处直调:
//  · 卸载时反注册步进预取器(登记表实现只做 Map 读删,不抛)—— 卸载后登记表里不再留着本页的预取器;
//  · 卸载时取消空闲回调(句柄只来自 requestIdleCallback)—— 取消后句柄清空;
//  · 全局日界 / 晚子时事件:onOptionChange 在构造函数里绑定、恒为函数,监听器直接转给它。
import fs from 'fs';
import path from 'path';
import { registerStepPrefetcher, getStepPrefetcher } from '../../../utils/stepPrefetch';
import DunJiaMain from '../../dunjia/DunJiaMain';
import LiuRengMain from '../../lrzhan/LiuRengMain';
import TaiYiMain from '../../taiyi/TaiYiMain';
import SanShiUnitedMain from '../SanShiUnitedMain';
import ZeriMain from '../../zeri/ZeriMain';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const COMP = path.join(__dirname, '..', '..');
const read = (rel)=>readSource(path.join(COMP, rel));

describe('卸载时反注册步进预取器', ()=>{
	const cases = [
		['dunjia', DunJiaMain, '_dunjiaStepPrefetcher', {}],
		['liureng', LiuRengMain, '_liurengStepPrefetcher', {}],
		['taiyi', TaiYiMain, '_taiyiStepPrefetcher', {}],
		['sanshiunited', SanShiUnitedMain, '_sanshiStepPrefetcher', { cancelPendingRecalc: ()=>{} }],
	];
	test.each(cases)('%s:卸载后登记表清空、句柄置空', (key, Page, slot, stubs)=>{
		const fn = ()=>[];
		registerStepPrefetcher(key, fn);
		const host = Object.assign(Object.create(Page.prototype), { props: {}, state: {}, [slot]: fn }, stubs);
		host.componentWillUnmount();
		expect(getStepPrefetcher(key)).toBeUndefined();
		expect(host[slot]).toBe(null);
		expect(host.unmounted).toBe(true);
	});

	test('源码:四页卸载处直调反注册,不再外包 try', ()=>{
		['dunjia/DunJiaMain.js', 'lrzhan/LiuRengMain.js', 'taiyi/TaiYiMain.js', 'sanshi/SanShiUnitedMain.js'].forEach((rel)=>{
			const src = read(rel);
			expect(src).toMatch(/\n\t\t\tunregisterStepPrefetcher\('[a-z]+', this\._[a-z]+StepPrefetcher\);\n/);
			expect(src).not.toMatch(/try\{\s*unregisterStepPrefetcher/);
		});
	});
});

describe('卸载时取消空闲回调', ()=>{
	let saved;
	beforeEach(()=>{ saved = global.cancelIdleCallback; global.cancelIdleCallback = jest.fn(); });
	afterEach(()=>{ global.cancelIdleCallback = saved; });

	test('择日主页:取消预渲染空闲回调并清空句柄', ()=>{
		const host = Object.assign(Object.create(ZeriMain.prototype), { props: {}, state: {}, zeriPrerenderIdle: 7, zeriPrerenderTimer: null });
		host.componentWillUnmount();
		expect(global.cancelIdleCallback).toHaveBeenCalledWith(7);
		expect(host.zeriPrerenderIdle).toBe(null);
	});

	test('三式合一:卸载时取消快照空闲回调并清空句柄', ()=>{
		const host = Object.assign(Object.create(SanShiUnitedMain.prototype), { props: {}, state: {}, pendingSnapshotIdle: 9, cancelPendingRecalc: ()=>{} });
		host.componentWillUnmount();
		expect(global.cancelIdleCallback).toHaveBeenCalledWith(9);
		expect(host.pendingSnapshotIdle).toBe(null);
	});

	test('源码:三处取消空闲回调都是直调', ()=>{
		const ss = read('sanshi/SanShiUnitedMain.js');
		const zm = read('zeri/ZeriMain.js');
		expect(ss.split('cancelIdleCallback(this.pendingSnapshotIdle);').length - 1).toBe(2);
		expect(zm).toContain('cancelIdleCallback(this.zeriPrerenderIdle);');
		[ss, zm].forEach((src)=>{ expect(src).not.toMatch(/try\{\s*cancelIdleCallback/); });
	});
});

describe('全局日界 / 晚子时事件转给 onOptionChange', ()=>{
	const STOP = new Error('stop-after-listeners');
	// 监听器注册之后的第一步换成抛 STOP,只跑到注册完为止(不起盘、不发请求)。
	const cases = [
		['奇门', DunJiaMain, { restoreOptionsFromCurrentCase: ()=>{ throw STOP; } }],
		['太乙', TaiYiMain, { ensureBoardObserver: ()=>{ throw STOP; } }],
		['三式合一', SanShiUnitedMain, { restoreOptionsFromCurrentCase: ()=>{}, handleWindowResize: ()=>{ throw STOP; } }],
	];
	test.each(cases)('%s:onOptionChange 原型上是函数、构造时绑定', (name, Page)=>{
		expect(typeof Page.prototype.onOptionChange).toBe('function');
	});
	test.each(cases)('%s:日界 / 晚子时只转 0 / 1,左栏改过就不转', (name, Page, stubs)=>{
		const listeners = {};
		const spy = jest.spyOn(window, 'addEventListener').mockImplementation((type, fn)=>{ listeners[type] = fn; });
		const host = Object.assign(Object.create(Page.prototype), { props: {}, state: {} }, stubs);
		host.onOptionChange = jest.fn();
		try{
			expect(()=>host.componentDidMount()).toThrow(STOP);
		}finally{
			spy.mockRestore();
		}
		const day = listeners['horosa:day-boundary-changed'];
		const late = listeners['horosa:late-zi-hour-mode-changed'];
		day({ detail: { after23NewDay: 1 } });
		late({ detail: { lateZiHourUseNextDay: 0 } });
		day({ detail: { after23NewDay: 2 } });
		day(null);
		expect(host.onOptionChange.mock.calls).toEqual([
			['after23NewDay', 1, { fromGlobal: true }],
			['lateZiHourUseNextDay', 0, { fromGlobal: true }],
		]);
		// 左栏亲手改过(锁记下当时的盘身份):同一张盘 / 同一课里全局事件不转
		const { lockDayBoundary } = require('../../../utils/dayBoundaryLock');
		const storageutil = require('../../../utils/storageutil');
		storageutil.setGlobalStore({ astro: { chartEpoch: 1 }, user: {} });
		lockDayBoundary(host, 'after23');
		lockDayBoundary(host, 'lateZi');
		day({ detail: { after23NewDay: 0 } });
		late({ detail: { lateZiHourUseNextDay: 1 } });
		expect(host.onOptionChange).toHaveBeenCalledTimes(2);
		// 换了一张盘:锁不算数,全局事件照常转
		storageutil.setGlobalStore({ astro: { chartEpoch: 2 }, user: {} });
		day({ detail: { after23NewDay: 0 } });
		expect(host.onOptionChange).toHaveBeenCalledTimes(3);
		storageutil.setGlobalStore({});
	});
	test('源码:三页构造函数绑定 onOptionChange,监听器里不再判它是不是函数', ()=>{
		['dunjia/DunJiaMain.js', 'taiyi/TaiYiMain.js', 'sanshi/SanShiUnitedMain.js'].forEach((rel)=>{
			const src = read(rel);
			expect(src).toContain('this.onOptionChange = this.onOptionChange.bind(this);');
			expect(src).not.toContain("typeof this.onOptionChange === 'function'");
			expect(src.split('if(v === 0 || v === 1){').length - 1).toBe(2);
		});
	});
});
