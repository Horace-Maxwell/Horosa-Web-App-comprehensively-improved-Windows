// 择日结果行「概览」浮窗所画的盘 ≡ 扫描判定的那一盘(行为合同)。
// 只看导入名的登记表查不出「浮窗另拼一份起盘参数」(曾在紫微浮窗写死「子初换日」:全局 24 点换日时 23 点那行浮窗与扫描不同盘)。
// 这里真渲染每家浮窗卡,截下交给盘组件的数据,与同一时刻 computeXxxScanPan 的结果比关键字段;
// 矩阵 = 宿主缺省选项(+ 六壬页面口径的非缺省值)× 两种全局日界 × 23:30 / 正午。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';

const mockCaptured = {};
const mockKeep = (name)=>(props)=>{ mockCaptured[name] = props; return null; };
jest.mock('../../../components/ziwei/ZiWeiChart', ()=>({ __esModule: true, default: (p)=>mockKeep('ziwei')(p) }));
jest.mock('../../../components/cntradition/PaiBaZi', ()=>({ __esModule: true, default: (p)=>mockKeep('bazi')(p) }));
jest.mock('../../../components/taiyi/TaiyiBoardSvg', ()=>({ __esModule: true, default: (p)=>mockKeep('taiyi')(p) }));
jest.mock('../../../components/lrzhan/LiuRengChart', ()=>({ __esModule: true, default: (p)=>mockKeep('liureng')(p) }));
jest.mock('../../../components/sanshi/SanshiUnitedBoard', ()=>({ __esModule: true, default: (p)=>mockKeep('sanshi')(p) }));
jest.mock('../../../components/guolao/GuoLaoMoiraWheel', ()=>({ __esModule: true, default: (p)=>mockKeep('qizheng')(p) }));
jest.mock('../../../components/astro/IndiaSouthChart', ()=>({ __esModule: true, default: (p)=>mockKeep('india')(p) }));
jest.mock('../../../components/calendar/HuangLiDayCard', ()=>({ __esModule: true, default: (p)=>mockKeep('huangli')(p) }));
jest.mock('../../../services/rules', ()=>({ ziweirulesCached: jest.fn(async ()=>({ Result: {} })) }));
const mockChartCalls = [];
const mockGodsCalls = [];
let mockChartFor = ()=>null;
jest.mock('../../../services/astro', ()=>({ fetchChart: jest.fn(async (p)=>{ mockChartCalls.push(p); return { Result: mockChartFor(p) }; }) }));
jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn(async (url, opt)=>{ const b = JSON.parse(opt.body); mockGodsCalls.push(b); return { Result: { liureng: { nongli: { dayGanZi: '甲子' } } } }; }) }));

/* eslint-disable import/first */
import ZeriMiniPanPopup from '../../../components/zeri/ZeriMiniPanPopup';
import HuangliDayPopup from '../../../components/zeri/HuangliDayPopup';
import { computeZiweiScanPan } from '../ziweiZeriScanEngine';
import { computeBaziScanPan } from '../baziZeriScanEngine';
import { computeTaiyiScanPan } from '../taiyiZeriScanEngine';
import { computeLiurengScanPan } from '../liurengZeriScanEngine';
import { buildLrChartLite } from '../liurengLocal';
import { splitSanshiOptions } from '../sanshiOptionSplit';
import { buildHuangliDay } from '../../../components/calendar/huangliDay';
import { ziweiZeriDefaultOptions } from '../../../components/zeri/ZiweiZeriMain';
import { baziZeriDefaultOptions } from '../../../components/zeri/BaziZeriMain';
import { taiyiZeriDefaultOptions } from '../../../components/zeri/TaiyiZeriMain';
import { liurengZeriDefaultOptions } from '../../../components/zeri/LiurengZeriMain';
import { sanshiZeriDefaultOptions } from '../../../components/zeri/SanshiZeriMain';
import { buildLiuRengLayout, buildKeData, buildSanChuanData } from '../../../components/lrzhan/LiuRengMain';
import * as AstroConst from '../../../constants/AstroConst';
import * as LRConst from '../../../components/liureng/LRConst';
/* eslint-enable import/first */

global.React = React;
jest.setTimeout(60000);
const GEO = { zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9, ad: 1, pos: '北京' };
// 宿主 buildGeoParams 的产物(扫描与宿主「概览」都吃它;浮窗卡拿到的是冻结地点原样)
const hostGeo = (o)=>({ zone: GEO.zone, lon: GEO.lon, lat: GEO.lat, gpsLon: GEO.gpsLon, gpsLat: GEO.gpsLat, ad: 1, gender: (o && o.gender !== undefined) ? o.gender : 1 });
const BOUNDARIES = ['after23', 'after24'];
const TIMES = [['2026-03-10', '23:30'], ['2026-03-11', '12:00']];
const MATRIX = [];
BOUNDARIES.forEach((b)=>TIMES.forEach(([d, t])=>MATRIX.push([b, d, t])));
const setBoundary = (b)=>{ window.localStorage.setItem('globalSetup', JSON.stringify({ dayBoundary: b })); };

let host;
beforeEach(()=>{ Object.keys(mockCaptured).forEach((k)=>{ delete mockCaptured[k]; }); mockChartCalls.length = 0; mockGodsCalls.length = 0; host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ ReactDOM.unmountComponentAtNode(host); host.remove(); window.localStorage.removeItem('globalSetup'); });
const render = async (el)=>{ await act(async ()=>{ ReactDOM.render(el, host); for(let i = 0; i < 6; i += 1){ await new Promise((r)=>setTimeout(r, 0)); } }); };
const popup = (tech, d, t, techOptions)=><ZeriMiniPanPopup tech={tech} row={{ start: `${d} ${t}`, pick: `${d} ${t}` }} geo={GEO} techOptions={techOptions} onClose={()=>{}} />;

describe('紫微 / 八字 / 太乙浮窗:所画的盘 = 扫描函数同一时刻的盘', ()=>{
	test.each(MATRIX)('紫微 · 全局 %s · %s %s', async (b, d, t)=>{
		setBoundary(b);
		const o = ziweiZeriDefaultOptions();
		await render(popup('ziwei', d, t, o));
		const shown = mockCaptured.ziwei && mockCaptured.ziwei.value;
		const scan = computeZiweiScanPan(hostGeo(o), o, d, `${t}:00`);
		// 安星输入(紫微农历日 / 时支 / 年干)+ 结果(紫微星宫位 / 命宫 / 五行局 / 十二宫主星)
		const key = (c)=>JSON.stringify([c.nongli && c.nongli.ziweiDayNum, c.timeZi, c.yearGan, c.ziweiIndex, c.lifeHouseIndex, c.wuxingJuText, (c.houses || []).map((h)=>(h.starsMain || []).map((x)=>(x && x.name) || x))]);
		expect(shown).toBeTruthy();
		expect([scan.nongli && scan.nongli.ziweiDayNum, scan.timeZi, scan.ziweiIndex, scan.lifeHouseIndex].every((v)=>v !== undefined && v !== null && v !== '')).toBe(true);   // 比的字段真有值(防两边全空假绿)
		expect(key(shown)).toBe(key(scan));
	});
	test.each(MATRIX)('八字 · 全局 %s · %s %s', async (b, d, t)=>{
		setBoundary(b);
		const o = baziZeriDefaultOptions();
		await render(popup('bazi', d, t, o));
		const shown = mockCaptured.bazi && mockCaptured.bazi.value;
		const scan = computeBaziScanPan(hostGeo({}), o, d, `${t}:00`);
		const col = (fc)=>['year', 'month', 'day', 'time'].map((k)=>((fc || {})[k] || {}).ganzi || ((fc || {})[k] || {}).ganZhi);
		expect(shown).toBeTruthy();
		expect(col(shown.fourColumns)).toEqual(col(scan.four));
	});
	test.each(MATRIX)('太乙 · 全局 %s · %s %s', async (b, d, t)=>{
		setBoundary(b);
		const o = taiyiZeriDefaultOptions();
		await render(popup('taiyi', d, t, o));
		const shown = mockCaptured.taiyi && mockCaptured.taiyi.pan;
		expect(shown).toBeTruthy();
		expect(JSON.stringify(shown)).toBe(JSON.stringify(computeTaiyiScanPan(GEO, o, d, `${t}:00`)));
	});
});

describe('六壬浮窗:按浮窗收到的底盘与起课口径起课 = 扫描所判那一课', ()=>{
	// 底盘 = 该时刻 lite 供数(太阳宫位按月将反推,昼夜取日出方程)—— 隔离后端,只验构参口径
	const liteChart = (o, d, t)=>{
		const base = buildLrChartLite(hostGeo(o), o, d, t);
		const sign = AstroConst.LIST_SIGNS[LRConst.SignZiList.indexOf(base.yue)];
		return { ...base.chartLite, objects: [{ id: AstroConst.SUN, sign }] };
	};
	const PAGE_VARIANTS = [{}, { fenZhouYe: 'maoyou' }, { seHaiMethod: 'standard' }, { seHaiMethod: 'mengzhongji' }, { shiRuKe: true }, { guirengType: 0, yinyangSystem: 'yinyang' }];
	// 采样:23:30 / 正午两个固定时刻 + 一个月里每天四个时辰(页面口径改课的时刻不密,要覆盖得到)
	const SAMPLES = [...TIMES];
	for(let day = 1; day <= 30; day += 1){ ['05:30', '11:10', '17:50', '23:30'].forEach((t)=>SAMPLES.push([`2026-01-${String(day).padStart(2, '0')}`, t])); }
	const rows = [];
	BOUNDARIES.forEach((b)=>PAGE_VARIANTS.forEach((v)=>rows.push([b, v])));
	const keyOf = (sc, layout)=>JSON.stringify([sc.name, sc.cuang, layout.guizi]);
	test.each(rows)('全局 %s · 口径 %j:每个采样时刻浮窗起课 = 扫描,且该口径确实改了部分时刻的课', async (b, variant)=>{
		setBoundary(b);
		const o = { ...liurengZeriDefaultOptions(), ...variant };
		const base = liurengZeriDefaultOptions();
		let changed = 0;
		for(const [d, t] of SAMPLES){
			mockGodsCalls.length = 0;
			mockChartFor = ()=>({ chart: liteChart(o, d, `${t}:00`) });
			await render(popup('liureng', d, t, o));
			const p = mockCaptured.liureng;
			expect(p).toBeTruthy();
			// 神将请求的日界两键 = 扫描口径
			expect([mockGodsCalls[0].after23NewDay, mockGodsCalls[0].lateZiHourUseNextDay]).toEqual([o.after23NewDay, o.lateZiHourUseNextDay]);
			const layout = buildLiuRengLayout(p.value, p.guireng, p.castOverride);
			const ke = buildKeData(layout, p.value);
			const sc = buildSanChuanData(layout, ke.raw, p.value, p.castOverride);
			const scan = computeLiurengScanPan(hostGeo(o), o, d, `${t}:00`);
			expect([d, t, keyOf(sc, layout)]).toEqual([d, t, keyOf(scan.sanChuan, scan.layout)]);
			const plain = computeLiurengScanPan(hostGeo(base), base, d, `${t}:00`);
			if(keyOf(scan.sanChuan, scan.layout) !== keyOf(plain.sanChuan, plain.layout)){ changed += 1; }
			ReactDOM.unmountComponentAtNode(host);
		}
		if(Object.keys(variant).length){ expect(changed).toBeGreaterThan(0); }
	});
});

describe('三式 / 七政 / 印度浮窗:起盘请求的口径 = 扫描口径', ()=>{
	test.each(MATRIX)('三式 · 全局 %s · %s %s:底盘日界 / 时间算法随拆分后的奇门家;六壬家起课口径带页面键', async (b, d, t)=>{
		setBoundary(b);
		const o = { ...sanshiZeriDefaultOptions(), fenZhouYe: 'maoyou', seHaiMethod: 'standard', timeAlg: 1 };
		mockChartFor = ()=>null;   // 底盘失败:只看请求口径
		await render(popup('sanshi', d, t, o));
		const q = splitSanshiOptions(o).qimen;
		expect(mockChartCalls.length).toBeGreaterThan(0);
		expect([mockChartCalls[0].after23NewDay, mockChartCalls[0].lateZiHourUseNextDay, mockChartCalls[0].nongliTimeAlg]).toEqual([q.after23NewDay, q.lateZiHourUseNextDay, 1]);
		const lr = splitSanshiOptions(o).liureng;
		expect([lr.fenZhouYe, lr.seHaiMethod]).toEqual(['maoyou', 'standard']);
		const src = fs.readFileSync(path.join(__dirname, '../../../components/zeri/ZeriMiniPanPopup.js'), 'utf8');
		expect(src).toContain('buildSanshiLiuRengCastOverride({ ...astroChart, nongli }, merged)');   // 六壬家起课口径 = 冻结的整份扫描口径
	});
	test('七政:宿度制 / 罗计 / 月孛与扫描请求同值', async ()=>{
		await render(popup('qizheng', '2026-03-10', '12:00', { su28Mode: 4, nodeType: 'true', lilithType: 'true' }));
		expect([mockChartCalls[0].doubingSu28, mockChartCalls[0].guolaoNodeType, mockChartCalls[0].guolaoLilithType]).toEqual([4, 'true', 'true']);
	});
	test('印度:恒星黄道 + 岁差制 + 交点与扫描请求同值', async ()=>{
		await render(popup('india', '2026-03-10', '12:00', { ayanamsa: 'raman', nodeType: 'true' }));
		expect([mockChartCalls[0].zodiacal, mockChartCalls[0].siderealAyanamsa, mockChartCalls[0].westNodeType]).toEqual([1, 'raman', 'true']);
	});
});

describe('奇门 / 黄历浮窗:直接用扫描同一函数', ()=>{
	test('奇门概览浮窗起局 = computeQimenScanPan', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../../components/zeri/QimenMiniBoardPopup.js'), 'utf8');
		expect(src).toMatch(/return computeQimenScanPan\(geoParams, options, seeds \|\| \{\}, m\[1\], `\$\{m\[2\]\}:00`\);/);
	});
	test('黄历日卡 = 扫描同一日课构造', async ()=>{
		await render(<HuangliDayPopup row={{ start: '2026-03-10', pick: '2026-03-10' }} onClose={()=>{}} />);
		expect(JSON.stringify(mockCaptured.huangli.day)).toBe(JSON.stringify(buildHuangliDay(2026, 3, 10)));
	});
});
