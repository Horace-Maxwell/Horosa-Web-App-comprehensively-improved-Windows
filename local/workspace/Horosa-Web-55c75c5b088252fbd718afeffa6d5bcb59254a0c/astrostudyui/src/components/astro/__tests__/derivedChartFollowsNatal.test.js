// 派生盘只与它出自的那张命盘配对(行为):换盘以后新派生盘在途、或者取失败,盘面不许再画上一位命主的派生盘;
// 同一位命主只改设置时仍是「旧盘留存 + 更新中」。取失败后同一张盘允许重试。
import { natalSourceKey, pickKeyedDerived } from '../../../utils/derivedChartSource';
import { isChartObjSameNatal } from '../../guolao/main/chartCache';

global.React = require('react');

jest.mock('../../../services/astro', () => ({ __esModule: true, fetchChart: jest.fn() }));
jest.mock('../../../utils/request', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../utils/moduleAiSnapshot', () => ({
	__esModule: true,
	saveModuleAISnapshot: jest.fn(),
	saveModuleAISnapshotLazy: jest.fn(),
}));

const { fetchChart } = require('../../../services/astro');
const request = require('../../../utils/request').default;
const Constants = require('../../../utils/constants');

const flush = ()=>new Promise((r)=>setTimeout(r, 0));
function chartOf(birth, lat, lon, extra){
	return { params: { birth, zone: '+08:00', lat, lon, hsys: 1, zodiacal: 0, ...(extra || {}) }, chart: { objects: [], houses: [] } };
}
function deferred(){
	let resolve; let reject;
	const promise = new Promise((a, b)=>{ resolve = a; reject = b; });
	return { promise, resolve, reject };
}
// 不走构造函数:只要方法与 state,setState 同步合并
function fakeInstance(Cls, props, state){
	const inst = Object.create(Cls.prototype);
	inst.props = props;
	inst.state = { ...(state || {}) };
	inst.unmounted = false;
	inst._mounted = true;
	inst.setState = (u, cb)=>{
		const patch = typeof u === 'function' ? u(inst.state) : u;
		inst.state = { ...inst.state, ...patch };
		if(cb){ cb(); }
	};
	inst.snapshotMeta = ()=>({});
	return inst;
}

const A = chartOf('1990-03-15 08:30:00', '39n54', '116e23');
const B = chartOf('1975-11-02 21:10:00', '31n14', '121e28');

describe('来源键单源', ()=>{
	test('盘对象与派生请求里的本命段算出同一个键;设置不进键;换人换键', ()=>{
		expect(natalSourceKey(A)).toBe('1990-03-15|08:30:00|+08:00|116e23|39n54');
		expect(natalSourceKey({ date: '1990-03-15', time: '08:30:00', zone: '+08:00', lon: '116e23', lat: '39n54', hsys: 0, datetime: '2026-01-01 00:00' })).toBe(natalSourceKey(A));
		expect(natalSourceKey(chartOf('1990-03-15 08:30:00', '39n54', '116e23', { hsys: 0, zodiacal: 1 }))).toBe(natalSourceKey(A));
		expect(natalSourceKey(B)).not.toBe(natalSourceKey(A));
		expect(natalSourceKey(null)).toBe('');
		expect(natalSourceKey({ params: {} })).toBe('');
	});
	test('pickKeyedDerived:键一致才给派生值,空键永不匹配', ()=>{
		expect(pickKeyedDerived('d', 'k', 'k', 'f')).toBe('d');
		expect(pickKeyedDerived('d', 'k', 'x', 'f')).toBe('f');
		expect(pickKeyedDerived('d', '', '', 'f')).toBe('f');
		expect(pickKeyedDerived(null, 'k', 'k', 'f')).toBe('f');
		expect(pickKeyedDerived('d', 'k', 'x')).toBe(null);
	});
	test('七政:同一位命主(只改设置)可留用旧盘,换人不可', ()=>{
		const old = { params: { date: '1990-03-15', time: '08:30:00', zone: '+08:00', lon: '116e23', lat: '39n54', hsys: 0, zodiacal: 0 } };
		expect(isChartObjSameNatal(old, { ...old.params, zodiacal: 1, tradition: 1 })).toBe(true);
		expect(isChartObjSameNatal(old, { ...old.params, date: '1975-11-02' })).toBe(false);
		expect(isChartObjSameNatal(old, { ...old.params, lat: '31n14' })).toBe(false);
		expect(isChartObjSameNatal(null, old.params)).toBe(false);
	});
});

describe('黄道星释:整宫制专盘按签名配对', ()=>{
	const AstroZR = require('../AstroZR').default;
	beforeEach(()=>{ fetchChart.mockReset(); });

	test('A 成功 → 换到 B:在途期间、失败之后都画 B 的本命盘;失败后同一张盘可重试', async ()=>{
		const wsA = { chart: { tag: 'wsA' }, params: {} };
		const wsB = { chart: { tag: 'wsB' }, params: {} };
		const inst = fakeInstance(AstroZR, { value: A }, { wsChartObj: null, wsChartObjSig: null });
		fetchChart.mockImplementationOnce(()=>Promise.resolve({ [Constants.ResultKey]: wsA }));
		inst.loadWholeSignChart(A);
		await flush();
		expect(inst.wholeSignChartForDisplay()).toBe(wsA);

		// 换盘:B 的专盘在途
		const pend = deferred();
		fetchChart.mockImplementationOnce(()=>pend.promise);
		inst.props = { value: B };
		inst.loadWholeSignChart(B);
		expect(inst.wholeSignChartForDisplay()).toBe(B);   // 此前 = wsA(上一位命主的整宫盘)
		pend.reject(new Error('offline'));
		await flush();
		expect(inst.wholeSignChartForDisplay()).toBe(B);   // 此前永久停在 wsA

		// 同一张盘再触发:必须真去取(此前签名已记成 B,同签名直接跳过 = 永不重试)
		fetchChart.mockImplementationOnce(()=>Promise.resolve({ [Constants.ResultKey]: wsB }));
		inst.loadWholeSignChart(B);
		expect(fetchChart).toHaveBeenCalledTimes(3);
		await flush();
		expect(inst.wholeSignChartForDisplay()).toBe(wsB);
	});

	test('回包带 err 同样回退本命盘并允许重试', async ()=>{
		const inst = fakeInstance(AstroZR, { value: B }, { wsChartObj: null, wsChartObjSig: null });
		fetchChart.mockImplementationOnce(()=>Promise.resolve({ [Constants.ResultKey]: { err: 'x' } }));
		inst.loadWholeSignChart(B);
		await flush();
		expect(inst.wholeSignChartForDisplay()).toBe(B);
		fetchChart.mockImplementationOnce(()=>Promise.resolve(null));
		inst.loadWholeSignChart(B);
		expect(fetchChart).toHaveBeenCalledTimes(2);
	});

	test('签名不改传入的盘对象', ()=>{
		const c = chartOf('2001-01-01 01:02:03', '1n', '2e');
		const before = JSON.stringify(c);
		const inst = fakeInstance(AstroZR, { value: c }, {});
		inst.wholeSignChartSig(c);
		expect(JSON.stringify(c)).toBe(before);
	});
});

describe('推运派生盘(返照 / 太阳弧 / 小限 / 流年 / 月返):按命主来源键配对', ()=>{
	const PAGES = ['AstroSolarReturn', 'AstroSolarArc', 'AstroLunarReturn', 'AstroProfection', 'AstroGivenYear'];
	beforeEach(()=>{ request.mockReset(); });
	PAGES.forEach((name)=>{
		test(`${name}:换人后取盘失败不画上一位命主的派生盘;同一位命主改设置仍留旧盘`, async ()=>{
			const Cls = require(`../${name}`).default;
			const inst = fakeInstance(Cls, { value: A }, { dirChart: null, dirChartSig: null, params: {} });
			const paramsOf = (c)=>{ const [date, time] = c.params.birth.split(' '); return { date, time, zone: c.params.zone, lon: c.params.lon, lat: c.params.lat, datetime: '2026-05-01 10:00:00' }; };
			const resA = { chart: { aspects: [] }, dirChart: { tag: 'A' } };
			request.mockImplementationOnce(()=>Promise.resolve({ [Constants.ResultKey]: resA }));
			await inst.requestDirection(paramsOf(A));
			expect(inst.shownDirChart()).toBe(resA);

			// 同一位命主只改设置(新盘对象、同出生):旧派生盘留存
			inst.props = { value: chartOf('1990-03-15 08:30:00', '39n54', '116e23', { hsys: 0, zodiacal: 1 }) };
			expect(inst.shownDirChart()).toBe(resA);

			// 换人:请求失败 → 不再画 A 的派生盘
			inst.props = { value: B };
			request.mockImplementationOnce(()=>Promise.reject(new Error('offline')));
			await inst.requestDirection(paramsOf(B));
			expect(inst.shownDirChart()).toBe(null);
		});
	});

	test('行星弧 / 波斯向运:同上,且先发后回不覆盖', async ()=>{
		for(const name of ['AstroPlanetaryArc', 'AstroPersianDirected']){
			const Cls = require(`../${name}`).default;
			const inst = fakeInstance(Cls, { value: A }, { dirChart: null, dirChartSig: null, params: {} });
			const p = (c)=>{ const [date, time] = c.params.birth.split(' '); return { date, time, zone: c.params.zone, lon: c.params.lon, lat: c.params.lat, datetime: '2026-05-01 10:00:00' }; };
			const resA = { tag: 'A' };
			const resB = { tag: 'B' };
			const slowA = deferred();
			request.mockImplementationOnce(()=>slowA.promise);
			const first = inst.requestDirection(p(A));
			inst.props = { value: B };
			request.mockImplementationOnce(()=>Promise.resolve({ [Constants.ResultKey]: resB }));
			await inst.requestDirection(p(B));
			slowA.resolve({ [Constants.ResultKey]: resA });
			await first;
			expect([name, inst.shownDirChart()]).toEqual([name, resB]);
			inst.props = { value: A };
			expect([name, inst.shownDirChart()]).toEqual([name, null]);
		}
	});
});
