// 八字择日:内嵌八字页的「南半球月令 / 命宫起法」进扫描口径 —— 开始择时冻结、扫描照用、点结果行回写、方案连页面键存取。
// 此前扫描不读这两项(轻量四柱写死不对冲 + 通行版命宫):南纬 × 对冲 / 子平数法命宫时,点开的盘与扫描判的月柱 / 命宫不是同一个。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
global.React = require('react');
const { buildLocalNongliLite, buildLocalBaziResult } = require('../../../utils/baziLunarLocal');
const { computeBaziScanPan, baziScanParams } = require('../baziZeriScanEngine');
const { BAZI_PAGE_SCAN_KEYS, BAZI_PAGE_FACTORY } = require('../zeriPageCalibre');
const BaziZeriMain = require('../../../components/zeri/BaziZeriMain').default;

const SOUTH = { zone: '+10:00', lon: '151e12', lat: '33s52', gpsLon: 151.2, gpsLat: -33.87, ad: 1, gender: 1 };
const gz = (p)=>(p && (p.ganzhi || p.ganZhi)) || '';
const samples = [['2026-01-15', '10:00:00'], ['2026-04-20', '08:00:00'], ['2026-07-10', '16:00:00'], ['2026-10-05', '22:00:00']];

describe('扫描起盘 × 页面口径', ()=>{
	test('南半球对冲:扫描月柱 = 全量八字(内嵌页同链)月柱,且确实与不对冲不同', ()=>{
		let differs = 0;
		samples.forEach(([d, t])=>{
			const opts = { timeAlg: 1, southMonth: 'chong' };
			const scan = computeBaziScanPan(SOUTH, opts, d, t);
			const full = buildLocalBaziResult(baziScanParams(SOUTH, opts, d, t));
			expect([d, gz(scan.four.month)]).toEqual([d, gz(full.bazi.fourColumns.month)]);
			if(gz(scan.four.month) !== gz(computeBaziScanPan(SOUTH, { timeAlg: 1 }, d, t).four.month)){ differs += 1; }
		});
		expect(differs).toBe(samples.length);
	});
	test('子平数法命宫:扫描胎 / 命 / 身 = 全量八字', ()=>{
		samples.forEach(([d, t])=>{
			const opts = { timeAlg: 1, minggongMethod: 'shufa' };
			const scan = computeBaziScanPan(SOUTH, opts, d, t);
			const full = buildLocalBaziResult(baziScanParams(SOUTH, opts, d, t));
			['ming', 'shen'].forEach((k)=>{ expect([d, k, gz(scan.four[k])]).toEqual([d, k, gz(full.bazi.fourColumns[k])]); });
		});
		const diff = samples.filter(([d, t])=>gz(computeBaziScanPan(SOUTH, { timeAlg: 1, minggongMethod: 'shufa' }, d, t).four.ming) !== gz(computeBaziScanPan(SOUTH, { timeAlg: 1 }, d, t).four.ming));
		expect(diff.length).toBeGreaterThan(0);
	});
	test('出厂口径(none / tongxing)与不给逐盘相同(不改缺省结果;其它技法不传这两键零变化)', ()=>{
		samples.forEach(([d, t])=>{
			const base = { timeAlg: 1, date: d, time: t, ...SOUTH };
			expect(JSON.stringify(buildLocalNongliLite({ ...base, ...BAZI_PAGE_FACTORY }))).toBe(JSON.stringify(buildLocalNongliLite(base)));
		});
	});
});

describe('宿主:冻结 / 回写 / 方案', ()=>{
	function mkHost(page){
		const h = new BaziZeriMain({ dispatch: jest.fn() });
		h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
		const applied = [];
		h.baziHook = { getBaziOptions: ()=>({ ...page }), applyBaziOptions: (p)=>{ applied.push(p); Object.assign(page, p); return Promise.resolve(); }, fun: jest.fn() };
		return { h, applied, page };
	}
	test('扫描口径取内嵌页当前值;指纹含页面键(页面改了 → 结果已过期)', ()=>{
		const { h, page } = mkHost({ southMonth: 'chong', minggongMethod: 'shufa', onlyZiGanShen: true });
		const eff = h.effectiveScanOptions();
		expect(eff.southMonth).toBe('chong');
		expect(eff.minggongMethod).toBe('shufa');
		expect(eff.onlyZiGanShen).toBeUndefined();   // 只取登记的页面键
		const fp = h.currentUiJson();
		page.southMonth = 'none';
		expect(h.currentUiJson()).not.toBe(fp);
	});
	test('点结果行:按扫描冻结值回写页面键,再起盘', async ()=>{
		const { h, applied, page } = mkHost({ southMonth: 'chong', minggongMethod: 'tongxing' });
		h._scanOptions = h.effectiveScanOptions();
		page.southMonth = 'none';   // 扫描之后内嵌页又改了
		h.onPickInterval({ start: '2026-01-15 10:00', pick: '2026-01-15 10:00' });
		await Promise.resolve(); await Promise.resolve();
		expect(applied[applied.length - 1]).toEqual({ southMonth: 'chong', minggongMethod: 'tongxing' });
		expect(h.baziHook.fun).toHaveBeenCalled();
	});
	test('方案:带页面键照方案回写;旧方案一个页面键都没带 → 出厂值;单改工作台参数不碰页面', ()=>{
		const { h, applied } = mkHost({ southMonth: 'chong', minggongMethod: 'shufa' });
		h.onWorkbenchOptionsChange({ timeAlg: 1, southMonth: 'chong' }, { source: 'scheme' });
		expect(applied.pop()).toEqual({ southMonth: 'chong' });
		expect(h.state.options.southMonth).toBeUndefined();   // 页面键不住在工作台参数里
		h.onWorkbenchOptionsChange({ timeAlg: 1 }, { source: 'scheme' });
		expect(applied.pop()).toEqual(BAZI_PAGE_FACTORY);
		h.onWorkbenchOptionsChange({ timeAlg: 0 });
		expect(applied).toEqual([]);
	});
	test('登记表与出厂值键集一致', ()=>{
		expect(Object.keys(BAZI_PAGE_FACTORY).sort()).toEqual([...BAZI_PAGE_SCAN_KEYS].sort());
	});
});
