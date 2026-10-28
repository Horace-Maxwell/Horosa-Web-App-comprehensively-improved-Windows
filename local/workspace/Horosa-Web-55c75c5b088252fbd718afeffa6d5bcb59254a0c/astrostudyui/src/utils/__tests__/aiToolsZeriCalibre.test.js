// AI 择日搜索的扫描口径与择日宿主同一构参:紫微读你的紫微设置(与紫微择日宿主 ziweiZeriScanOptions 同一函数),
// 八字读八字页的南半球月令 / 命宫起法;回包 calibre 写明所用口径。缺省设置时与旧口径逐盘相同。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { setAgentEnabled } from '../aiAgent/prefs';
import { loadZeriSchool } from '../aiTools/zeriSchools';
import { currentZiweiSettings } from '../ziweiRecordSettings';
import { ziweiEngineFromSettings, computeZiweiScanPan } from '../../divination/zeri/ziweiZeriScanEngine';
import { ziweiZeriScanOptions, ziweiZeriFullDefaultOptions, ziweiZeriDefaultOptions } from '../../components/zeri/ZiweiZeriMain';

const ctx = ()=>({ origin: 'mcp', requestId: 'turnZC:0:c1', dispatch: jest.fn() });
beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	setAgentEnabled(true);
});

describe('紫微', ()=>{
	test('口径 = 紫微择日宿主同一构参(读紫微设置)', async ()=>{
		window.localStorage.setItem('ziweiYearBoundary', 'lichun');
		window.localStorage.setItem('ziweiSanPan', 'ren');
		window.localStorage.setItem('ziweiHuoling', 'nanpai');
		const sch = await loadZeriSchool('ziwei');
		const o = sch.defaults();
		expect(o).toEqual(ziweiZeriScanOptions(ziweiZeriFullDefaultOptions(), ziweiEngineFromSettings(currentZiweiSettings())));
		expect([o.yearBoundary, o.sanPan, o.huoling]).toEqual(['lichun', 'ren', 'nanpai']);
		const r = await runTool('search_zeri', { school: 'ziwei', start: '2026-03-01', end: '2026-03-01', place: '北京', conditions: { type: 'wuxing_ju', params: { values: ['2', '3', '4', '5', '6'] } } }, ctx());
		expect(r.ok).toBe(true);
		['定年界线', '火铃起宫', '三盘'].forEach((w)=>expect(r.data.calibre).toContain(w));
		const e = await runTool('explain_zeri', { school: 'ziwei', time: '2026-03-01 10:00', place: '北京', conditions: { type: 'wuxing_ju', params: { values: ['2'] } } }, ctx());
		expect(e.data.calibre).toBe(r.data.calibre);
	});
	test('紫微设置全缺省:回包写明全缺省,扫描口径与旧缺省逐盘相同', async ()=>{
		const sch = await loadZeriSchool('ziwei');
		const geo = { zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9, ad: 1 };
		[['2026-02-05', '10:30:00'], ['2026-06-18', '23:30:00']].forEach(([d, t])=>{
			expect(JSON.stringify(computeZiweiScanPan(geo, sch.defaults(), d, t))).toBe(JSON.stringify(computeZiweiScanPan(geo, ziweiZeriDefaultOptions(), d, t)));
		});
		expect(sch.calibreOf(sch.defaults())).toContain('全缺省');
	});
});

describe('八字', ()=>{
	test('口径带八字页的南半球月令 / 命宫起法;回包写明', async ()=>{
		window.localStorage.setItem('baziopt', JSON.stringify({ southMonth: 'chong', minggongMethod: 'shufa' }));
		const sch = await loadZeriSchool('bazi');
		const o = sch.defaults();
		expect([o.southMonth, o.minggongMethod]).toEqual(['chong', 'shufa']);
		const r = await runTool('search_zeri', { school: 'bazi', start: '2026-03-01', end: '2026-03-03', place: '北京', conditions: { type: 'day_ganzhi', params: { values: ['甲'] } } }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.calibre).toContain('南半球月令对冲');
		expect(r.data.calibre).toContain('命宫子平数法');
	});
	test('八字页没设:出厂值', async ()=>{
		const sch = await loadZeriSchool('bazi');
		const o = sch.defaults();
		expect([o.southMonth, o.minggongMethod]).toEqual(['none', 'tongxing']);
		expect(sch.calibreOf(o)).toContain('全缺省');
	});
});

describe('六壬 / 太乙 / 七政 / 印度:工作台口径取宿主的出厂完整缺省单源(不另抄一份稀疏缺省)', ()=>{
	const geo = { zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9, ad: 1 };
	const SAMPLES = [['2026-02-05', '10:30:00'], ['2026-06-18', '23:30:00'], ['2026-09-23', '00:10:00'], ['2027-01-01', '13:00:00']];
	test('六壬:= 出厂完整缺省 + 内嵌六壬页出厂的页面口径键;逐盘与旧稀疏缺省相同', async ()=>{
		const host = require('../../components/zeri/LiurengZeriMain');
		const { LIURENG_PAGE_SETTINGS } = require('../../components/lrzhan/main/castLayout');
		const { LIURENG_PAGE_SCAN_KEYS, pickKeys } = require('../../divination/zeri/zeriPageCalibre');
		const { computeLiurengScanPan } = require('../../divination/zeri/liurengZeriScanEngine');
		const sch = await loadZeriSchool('liureng');
		expect(sch.defaults()).toEqual({ ...host.liurengZeriFullDefaultOptions(), ...pickKeys(LIURENG_PAGE_SETTINGS.defaults(), LIURENG_PAGE_SCAN_KEYS) });
		// 课体逐盘相同;只差起课覆盖的记录里多写明了出厂的昼夜阳阴归属(单母)—— 旧稀疏缺省不写、引擎按同一出厂值起课
		const bodyOf = (p)=>{ const c = { ...p }; delete c.castOverride; return JSON.stringify(c); };
		SAMPLES.forEach(([d, t])=>{
			const a = computeLiurengScanPan(geo, sch.defaults(), d, t);
			const b = computeLiurengScanPan(geo, host.liurengZeriDefaultOptions(), d, t);
			expect(bodyOf(a)).toBe(bodyOf(b));
			expect({ ...(a.castOverride || {}), yinyangSystem: undefined }).toEqual({ ...(b.castOverride || {}), yinyangSystem: undefined });
		});
	});
	test('太乙:= 出厂完整缺省 + 出厂流派;逐盘与旧稀疏缺省相同', async ()=>{
		const host = require('../../components/zeri/TaiyiZeriMain');
		const { TAIYI_PAGE_SETTINGS } = require('../../components/taiyi/TaiYiMain');
		const { computeTaiyiScanPan } = require('../../divination/zeri/taiyiZeriScanEngine');
		const sch = await loadZeriSchool('taiyi');
		const school = TAIYI_PAGE_SETTINGS.defaults().school;
		expect(sch.defaults()).toEqual({ school, ...host.taiyiZeriFullDefaultOptions() });
		SAMPLES.forEach(([d, t])=>{
			expect(JSON.stringify(computeTaiyiScanPan(geo, sch.defaults(), d, t))).toBe(JSON.stringify(computeTaiyiScanPan(geo, { school, ...host.taiyiZeriDefaultOptions() }, d, t)));
		});
	});
	test('七政 / 印度:= 宿主出厂完整缺省(含旧手抄的那几键,值不变)', async ()=>{
		const qz = await loadZeriSchool('qizheng');
		expect(qz.defaults()).toEqual(require('../../components/zeri/QizhengZeriMain').qizhengZeriFullDefaultOptions());
		expect(qz.defaults()).toMatchObject({ su28Mode: 2, nodeType: 'mean', lilithType: 'mean' });
		const ind = await loadZeriSchool('india');
		expect(ind.defaults()).toEqual(require('../../components/zeri/IndiaZeriMain').indiaZeriFullDefaultOptions());
		expect(ind.defaults()).toMatchObject({ ayanamsa: 'lahiri', nodeType: 'mean' });
	});
});
