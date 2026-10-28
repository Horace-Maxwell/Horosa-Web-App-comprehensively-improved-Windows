// 择日存案的时间地点 = 所见那张盘:内嵌页在请求过了代次校验、确定上屏时记下实际所用的 fields(hook.getPlottedFields),
// 宿主存案优先取它(内嵌页自己重排 / 宿主改了工作台没重排 / 覆盖层里没确定的草稿都不再让两者不一致);
// 点选那一拍的冻结口径在 setState 之前就置好(太乙 / 七政与另外五个宿主同律)
import { plottedFieldsOf } from '../zeriCaseRestore';
import DateTime from '../../comp/DateTime';

const fs = require('fs');
const path = require('path');
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读
const read = (rel)=>readSource(path.join(__dirname, '..', '..', rel));

test('plottedFieldsOf:取得到且有时刻才用,否则回落宿主自己的重建', ()=>{
	const f = { date: { value: new DateTime() } };
	expect(plottedFieldsOf({ getPlottedFields: ()=>f })).toBe(f);
	expect(plottedFieldsOf({ getPlottedFields: ()=>null })).toBeNull();
	expect(plottedFieldsOf({ getPlottedFields: ()=>({ lon: { value: 'x' } }) })).toBeNull();
	expect(plottedFieldsOf({ getPlottedFields: ()=>{ throw new Error('x'); } })).toBeNull();
	expect(plottedFieldsOf({})).toBeNull();
	expect(plottedFieldsOf(null)).toBeNull();
});

test('四个内嵌页登记 getPlottedFields,并在过了请求代次校验之后才记', ()=>{
	const cases = [
		['cntradition/BaZi.js', 'seq !== this.baziReqSeq', 'this._plottedFields = fields;'],
		['ziwei/ZiWeiMain.js', 'seq !== this._zwReqSeq', 'this._plottedFields = fields;'],
		['guolao/GuoLaoChartMain.js', 'seq !== this.qizhengKinReqSeq', 'this._plottedFields = plotFields;'],
		['astro/IndiaChart.js', 'seq !== this._chartReqSeq', 'this._plottedFields = sourceFields || null;'],
	];
	cases.forEach(([f, guard, set])=>{
		const src = read(f);
		expect([f, src.includes('this.props.hook.getPlottedFields = ')]).toEqual([f, true]);
		const g = src.indexOf(guard);
		const i = src.indexOf(set, g);
		expect([f, g > 0 && i > g]).toEqual([f, true]);
	});
	// 七政普通档:本命盘过了 bundleSeq 才记;取不到本命盘(画的是回落旧盘)不记
	expect(read('guolao/GuoLaoChartMain.js')).toContain('if(natalRaw && !natalFailed){ this._plottedFields = plotFields; }');
	expect(read('astro/IndiaChartMain.js')).toContain('this.props.hook.getPlottedFields = ()=>{');
});

test('四个宿主存案优先取所见那张盘', ()=>{
	[['zeri/BaziZeriMain.js', 'baziHook'], ['zeri/ZiweiZeriMain.js', 'ziweiHook'], ['zeri/QizhengZeriMain.js', 'qizhengHook'], ['zeri/IndiaZeriMain.js', 'indiaHook']].forEach(([f, h])=>{
		const src = read(f);
		expect([f, src.includes(`const plotted = plottedFieldsOf(this.${h});`) && src.includes('fields: plotted || ') && src.includes('zeri: buildZeriCasePayload(this, plotted)')]).toEqual([f, true]);
	});
});

describe('太乙 / 七政点选:这一次渲染就按冻结值建备忘', ()=>{
	const mkHost = (Main)=>{
		const h = Object.create(Main.prototype);
		h.state = { pickText: '2026-01-01 00:00:00', geo: { zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9 }, options: { sex: 1 }, embedPatch: {}, embedRev: 0, searchOpen: true };
		h._scanGeo = { zone: '+08:00', lon: '121e28', lat: '31n14', gpsLon: 121.47, gpsLat: 31.23 };   // 扫描时的地点(之后工作台改成了北京)
		h._scanOptions = { sex: 1 };
		h.rendered = [];
		h.setState = function(p, cb){ this.state = { ...this.state, ...p }; this.rendered.push(this.buildFieldsMemo()); if(cb){ cb(); } };   // 渲染那一拍取备忘
		return h;
	};
	test('太乙:渲染那一拍就是冻结地点;回调交给内嵌页的是同一份', async ()=>{
		const TaiyiZeriMain = require('../TaiyiZeriMain').default;
		const h = mkHost(TaiyiZeriMain);
		let given = null;
		h.taiyiHook = { fun: (f)=>{ given = f; }, applyOptions: ()=>Promise.resolve() };
		h.onPickInterval({ start: '2026-02-02 10:00', pick: '2026-02-02 10:30' });
		await Promise.resolve(); await Promise.resolve();
		expect(h.rendered[0].lon.value).toBe('121e28');
		expect(given).toBe(h.rendered[0]);
	});
	test('七政:渲染那一拍就是冻结地点', ()=>{
		const QizhengZeriMain = require('../QizhengZeriMain').default;
		const h = mkHost(QizhengZeriMain);
		h.requestChartAndPlot = ()=>{};
		h.onPickInterval({ start: '2026-02-02 10:00', pick: '2026-02-02 10:30' });
		expect(h.rendered[0].lon.value).toBe('121e28');
	});
});

test('印占默认视图:所见那张盘 = 主盘请求实际所用的 fields;分盘组网格打开时取当前分盘格', ()=>{
	const IndiaChartMain = require('../../astro/IndiaChartMain').default;
	const hook = {};
	const inst = new IndiaChartMain({ hook, fields: {} });
	const F = { date: { value: new DateTime() }, chartnum: { value: 9 } };
	inst._plottedMainFields = F;
	inst.state = { ...inst.state, vargaSetOpen: false };
	const got = hook.getPlottedFields();
	expect(got.date).toBe(F.date);
	expect(got).not.toHaveProperty('chartnum');
	const G = { date: { value: new DateTime() } };
	inst.state = { ...inst.state, vargaSetOpen: true, currentTab: 'Natal', hook: { ...(inst.state.hook || {}), Natal: { getPlottedFields: ()=>G } } };
	expect(hook.getPlottedFields().date).toBe(G.date);
	const src = read('astro/IndiaChartMain.js');
	expect(src).toContain('if(dashaChartObj){ this._plottedMainFields = sourceFields; }');
});
