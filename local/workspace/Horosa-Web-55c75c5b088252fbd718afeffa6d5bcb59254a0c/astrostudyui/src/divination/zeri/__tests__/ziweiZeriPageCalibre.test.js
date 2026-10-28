// 紫微择日:扫描读内嵌紫微页的排盘口径(紫微设置是全局单例,内嵌页与紫微页同读)—— 扫描判的那张盘 = 页面本地引擎画的那张盘。
// 此前扫描写死 Java 兼容三键、只吃工作台,紫微页开了立春年界 / 全星集 / 人盘之类时所见 ≠ 所判。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
global.React = require('react');
const { ZWEngineOptions, collectEngineOpts, ZW_ENGINE_FORWARD_KEYS } = require('../../../components/ziwei/ziweiOptions');
const { calcZiwei, deriveSanPan } = require('../../../components/ziwei/ZiweiCalc');
const { computeZiweiScanPan, ziweiPageScanOptions } = require('../ziweiZeriScanEngine');
const { ZIWEI_PAGE_SCAN_KEYS } = require('../zeriPageCalibre');
const ZiweiZeriMain = require('../../../components/zeri/ZiweiZeriMain').default;

const GEO = { zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9, ad: 1 };
const samples = [['2026-02-03', '10:30:00'], ['2026-02-05', '23:30:00'], ['2026-06-18', '04:30:00'], ['2027-01-30', '13:30:00']];
// 页面本地引擎同一构参(ZiWeiMain 本地引擎路径:晚子时 / 定年界线 / 引擎转发键 / 命主取法,再按三盘后处理)
function pageChart(engine, d, t){
	const birth = { date: d, time: t, zone: GEO.zone, lon: GEO.lon, lat: GEO.lat, gpsLon: GEO.gpsLon, gpsLat: GEO.gpsLat, ad: 1, gender: 1 };
	const opts = { timeAlg: 1, lateZi: engine.lateZi, yearBoundary: engine.yearBoundary, ...collectEngineOpts(engine), lifeMasterBy: engine.lifeMasterBy || 'year_branch' };
	let c = calcZiwei(birth, opts);
	if(engine.sanPan && engine.sanPan !== 'tian'){ c = deriveSanPan(c, engine.sanPan); }
	return c;
}
const view = (c)=>JSON.stringify({ yg: c && c.yearGan, life: c && c.lifeHouseIndex, houses: (c && c.houses || []).map((h)=>[h.name, (h.starsMain || []).map((s)=>s.name || s).join(',')]) });

describe('扫描口径 = 紫微页口径', ()=>{
	const base = { ...ZWEngineOptions };
	afterEach(()=>{ Object.assign(ZWEngineOptions, base); });
	test.each([
		['立春年界', { yearBoundary: 'lichun' }],
		['人盘', { sanPan: 'ren' }],
		['地盘', { sanPan: 'di' }],
		['南派火铃 + 精简星集', { huoling: 'nanpai', starSet: 'north18' }],
		['命主按命宫', { lifeMasterBy: 'ming_branch' }],
		['晚子时子正换日', { lateZi: 'zi_zheng' }],
		['晚子时子初换日(安星农历随日柱进位,与页面同一规则)', { lateZi: 'zi_chu' }],
		['晚子时夜子折中', { lateZi: 'midnight_split' }],
	])('%s:扫描盘 = 页面本地引擎盘(年干 / 命宫 / 宫名 / 主星)', (_n, patch)=>{
		Object.assign(ZWEngineOptions, patch);
		samples.forEach(([d, t])=>{
			const eff = { timeAlg: 1, gender: 1, ...ziweiPageScanOptions(ZWEngineOptions) };
			expect([d, t, view(computeZiweiScanPan(GEO, eff, d, t))]).toEqual([d, t, view(pageChart(ZWEngineOptions, d, t))]);
		});
	});
	test('判别力:立春年界确实改年干(扫描若仍按正月初一,上一条必红)', ()=>{
		const d = '2026-02-05'; const t = '10:30:00';
		const a = computeZiweiScanPan(GEO, { timeAlg: 1, gender: 1, ...ziweiPageScanOptions({ ...base, yearBoundary: 'lichun' }) }, d, t);
		const b = computeZiweiScanPan(GEO, { timeAlg: 1, gender: 1, ...ziweiPageScanOptions(base) }, d, t);
		expect(a.yearGan).not.toBe(b.yearGan);
	});
	test('登记的页面键覆盖扫描引擎消费的全部引擎键', ()=>{
		ZW_ENGINE_FORWARD_KEYS.forEach((k)=>expect(ZIWEI_PAGE_SCAN_KEYS).toContain(k));
		['yearBoundary', 'lateZi', 'sanPan'].forEach((k)=>expect(ZIWEI_PAGE_SCAN_KEYS).toContain(k));
	});
});

describe('宿主', ()=>{
	const base = { ...ZWEngineOptions };
	afterEach(()=>{ Object.assign(ZWEngineOptions, base); });
	function mkHost(){
		const h = new ZiweiZeriMain({ dispatch: jest.fn() });
		h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
		return h;
	}
	test('扫描口径取紫微设置;工作台里旧方案带来的引擎键不压住页面;指纹含页面键', ()=>{
		const h = mkHost();
		h.state.options = { ...h.state.options, huoling: 'nanpai', yearBoundary: 'lichun' };   // 旧方案 / 旧存案带来的
		Object.assign(ZWEngineOptions, { huoling: 'sanhe', yearBoundary: 'lunar_1_1' });
		const eff = h.effectiveScanOptions();
		expect(eff.huoling).toBe('sanhe');
		expect(eff.yearBoundary).toBe('lunar_1_1');
		expect(eff.ziweiLunarBasis).toBe('calendar');
		const fp = h.currentUiJson();
		ZWEngineOptions.starSet = 'north18';
		expect(h.currentUiJson()).not.toBe(fp);
	});
	test('紫微设置全缺省:扫描口径与旧缺省逐盘相同(不改缺省结果)', ()=>{
		const h = mkHost();
		samples.forEach(([d, t])=>{
			expect(JSON.stringify(computeZiweiScanPan(GEO, h.effectiveScanOptions(), d, t))).toBe(JSON.stringify(computeZiweiScanPan(GEO, { timeAlg: 1, gender: 1 }, d, t)));
		});
	});
});
