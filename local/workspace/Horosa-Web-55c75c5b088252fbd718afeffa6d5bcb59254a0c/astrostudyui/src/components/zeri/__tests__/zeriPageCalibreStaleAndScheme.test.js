// 择日内嵌页的页面口径键(分昼夜 / 涉害 / 太乙流派 / 三式奇门其余档,zeriPageCalibre 登记)与宿主的两处相交:
//   · 「结果已过期」:内嵌页左栏改了页面键,与改工作台参数同一套判据亮起;改回去即灭;
//   · 方案库 / 历史:存方案连页面键一起存;载入方案 = 把方案里的页面键回写内嵌页并按新口径重排,工作台参数里不留页面键。
jest.mock('../../../services/astro', ()=>({ fetchChart: jest.fn(async ()=>({ Result: null })) }));
const fs = require('fs');
const path = require('path');
const { LIURENG_PAGE_SCAN_KEYS, TAIYI_PAGE_SCAN_KEYS, SANSHI_LR_PAGE_SCAN_KEYS, SANSHI_TY_PAGE_SCAN_KEYS, schemeOptionsOf, splitPageKeys } = require('../../../divination/zeri/zeriPageCalibre');
const { QM_SEED_KEYS } = require('../../../divination/zeri/sanshiOptionSplit');

const HOSTS = {
	liureng: { file: '../LiurengZeriMain', hook: 'liurengHook', getter: 'getCastOptions', apply: 'applyCastFields', keys: LIURENG_PAGE_SCAN_KEYS, sample: { fenZhouYe: 'maoyou', seHaiMethod: 'standard', seHaiBoundary: 'both', shiRuKe: true }, wb: { guirengType: 2, yueMode: 'zhongqi' } },
	taiyi: { file: '../TaiyiZeriMain', hook: 'taiyiHook', getter: 'getOptions', apply: 'applyOptions', keys: TAIYI_PAGE_SCAN_KEYS, sample: { school: { zhuSuan: 'b' } }, wb: { tn: 0 } },
	sanshi: { file: '../SanshiZeriMain', hook: 'sanshiHook', getter: 'getOptions', apply: 'applyOptions', keys: [...QM_SEED_KEYS, ...SANSHI_LR_PAGE_SCAN_KEYS, ...SANSHI_TY_PAGE_SCAN_KEYS], sample: { fenZhouYe: 'yinshen', anGanMode: 'x', taiyiSchool: { zhuSuan: 'b' } }, wb: { guirengType: 2, paiPanType: 3 } },
};

// 宿主假体:原型方法全绑上;内嵌页 = 一份可改的 options(取值器 / 回写器都对着它)
function mkHost(name, pageInit){
	const spec = HOSTS[name];
	const Host = require(spec.file).default;
	const page = { ...(pageInit || {}) };
	const applied = [];
	const hook = {
		[spec.getter]: ()=>({ ...page }),
		[spec.apply]: (p)=>{ applied.push(p); Object.assign(page, p); return Promise.resolve(); },
		fun: jest.fn(),
	};
	if(name === 'sanshi'){ hook.getQimenOptions = ()=>({ ...page }); }
	const h = { state: { cfg: { startDate: '2026-01-01' }, geo: { zone: '+08:00' }, options: { ...spec.wb }, tree: { type: 'all', children: [] }, natal: null }, [spec.hook]: hook, unmounted: false, props: {} };
	h.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } };
	Object.getOwnPropertyNames(Host.prototype).forEach((n)=>{ if(n !== 'constructor' && typeof Host.prototype[n] === 'function'){ h[n] = Host.prototype[n].bind(h); } });
	h.replotEmbedded = jest.fn();
	return { h, page, applied, hook };
}
const flush = async ()=>{ for(let i = 0; i < 5; i += 1){ await Promise.resolve(); } };

describe.each(Object.keys(HOSTS))('%s 择日', (name)=>{
	const spec = HOSTS[name];
	test('内嵌页改页面键 → 结果已过期(与改工作台参数同一套判据);改回去即不过期', ()=>{
		const { h, page } = mkHost(name, {});
		h._scanUiJson = h.currentUiJson();
		const k = Object.keys(spec.sample)[0];
		page[k] = spec.sample[k];
		expect(h.currentUiJson()).not.toBe(h._scanUiJson);
		delete page[k];
		expect(h.currentUiJson()).toBe(h._scanUiJson);
		// 同一套判据:改工作台参数同样过期
		h.state.options = { ...h.state.options, zz: 1 };
		expect(h.currentUiJson()).not.toBe(h._scanUiJson);
	});
	test('内嵌页口径变了的通知 → 宿主换代重渲染', ()=>{
		const { h } = mkHost(name, {});
		const before = h.state.pageCalibreRev || 0;
		h.onPageCalibreChange();
		expect(h.state.pageCalibreRev).toBe(before + 1);
	});
	test('存方案连页面键一起存;载入方案把页面键回写内嵌页并重排,工作台参数不留页面键', async ()=>{
		const a = mkHost(name, spec.sample);
		const saved = schemeOptionsOf(()=>a.h.effectiveScanOptions(), a.h.state.options);
		Object.keys(spec.sample).forEach((k)=>{ expect([k, saved[k]]).toEqual([k, spec.sample[k]]); });
		// 另一个会话:内嵌页是出厂值,载入方案(工作台照 `{ ...options, ...rec.config.options }` 调 onOptionsChange)
		const b = mkHost(name, {});
		b.h.onWorkbenchOptionsChange({ ...b.h.state.options, ...saved });
		await flush();
		expect(b.applied.length).toBe(1);
		expect(b.applied[0]).toEqual(splitPageKeys(saved, spec.keys).page);
		expect(b.h.replotEmbedded).toHaveBeenCalledTimes(1);
		spec.keys.forEach((k)=>{ expect([k, k in b.h.state.options]).toEqual([k, false]); });
		// 回写后扫描口径 = 方案存下的那一份
		expect(JSON.stringify(b.h.effectiveScanOptions())).toBe(JSON.stringify({ ...b.h.state.options, ...splitPageKeys(saved, spec.keys).page }));
		Object.keys(spec.sample).forEach((k)=>{ expect(b.h.effectiveScanOptions()[k]).toEqual(spec.sample[k]); });
	});
	test('普通工作台改参(不带页面键)不碰内嵌页', async ()=>{
		const { h, applied } = mkHost(name, {});
		h.onWorkbenchOptionsChange({ ...h.state.options, zz: 2 });
		await flush();
		expect(applied).toEqual([]);
		expect(h.state.options.zz).toBe(2);
	});
});

test('太乙旧方案(流派存在工作台参数里)按同一登记表:载入 = 回写内嵌页流派,不再压住页面', async ()=>{
	const { h, applied } = mkHost('taiyi', {});
	h.onWorkbenchOptionsChange({ tn: 1, school: { zhuSuan: 'c' } });
	await flush();
	expect(applied).toEqual([{ school: { zhuSuan: 'c' } }]);
	expect(h.state.options).toEqual({ tn: 1 });
});

describe('接线', ()=>{
	const read = (f)=>fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
	test.each([['LiurengZeriMain.js', 'LiuRengMain'], ['TaiyiZeriMain.js', 'TaiYiMain'], ['SanshiZeriMain.js', 'SanShiUnitedMain']])('%s:工作台改参走拆分、方案取扫描口径、内嵌页接通知', (f, page)=>{
		const t = read(f);
		expect(t).toContain('onOptionsChange={this.onWorkbenchOptionsChange}');
		expect(t).toContain('getSchemeOptions={()=>this.effectiveScanOptions()}');
		expect(t).toMatch(new RegExp(`<${page}\\n[\\s\\S]{0,200}onPageCalibreChange=\\{this\\.onPageCalibreChange\\}`));
		expect(t).toMatch(/return this\.uiJsonOf\(\{ \.\.\.this\.state, options: this\.effectiveScanOptions\(\) \}\);/);   // 过期指纹按扫描口径
	});
	test.each(['LiurengZeriWorkbench.js', 'TaiyiZeriWorkbench.js', 'SanshiZeriWorkbench.js'])('%s:存方案用宿主给的扫描口径', (f)=>{
		expect(read(f)).toMatch(/saveScheme\(schemeName, \{ cfg, geo, options: schemeOptionsOf\(getSchemeOptions, options\)/);
	});
	test('三个内嵌页:口径变了先通知宿主(componentDidUpdate 第一件事)', ()=>{
		const calls = [];
		const spy = ()=>calls.push(1);
		const LiuRengMain = require('../../lrzhan/LiuRengMain').default;
		const TaiYiMain = require('../../taiyi/TaiYiMain').default;
		const SanShiUnitedMain = require('../../sanshi/SanShiUnitedMain').default;
		const run = (Cls, prevState, state)=>{
			try{ Cls.prototype.componentDidUpdate.call({ props: { onPageCalibreChange: spy }, state }, { fields: null }, prevState); }catch(e){ /* 后面的逻辑在假体上跑不通,不影响:通知在最前面 */ }
		};
		run(LiuRengMain, { seHaiMethod: 'app' }, { seHaiMethod: 'standard' });
		run(LiuRengMain, { seHaiMethod: 'app' }, { seHaiMethod: 'app' });
		const o1 = { a: 1 };
		run(TaiYiMain, { options: o1 }, { options: { a: 2 } });
		run(TaiYiMain, { options: o1 }, { options: o1 });
		run(SanShiUnitedMain, { options: o1 }, { options: { a: 2 } });
		run(SanShiUnitedMain, { options: o1 }, { options: o1 });
		expect(calls.length).toBe(3);
	});
});
