// 择日载入存案后的「结果已过期」指纹:按冻结口径(存案里那次扫描的口径)算,绝不按内嵌页 / 设置单例此刻的口径现算。
// 有页面口径键的宿主(扫描口径读内嵌页或设置单例)各核三点:存案口径 = 现在 → 不亮;≠ 现在 → 亮;冻结值回写内嵌页之后 → 熄灭。
// 另核:指纹按键排序序列化(键序不同不误报)、页面口径进扫描之前存的旧存案(不带页面键)按出厂口径比、
// 源码里还原冻结口径的函数不许调 currentUiJson()、每个择日宿主的指纹都经纯函数 uiJsonOf。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
global.React = require('react');
const fs = require('fs');
const path = require('path');
const { setGlobalStore } = require('../../../utils/storageutil');
const { restoreZeriWorkbenchFromCase, canonicalJson } = require('../zeriCaseRestore');

const ZERI_DIR = path.join(__dirname, '..');
const read = (f)=>fs.readFileSync(path.join(ZERI_DIR, f), 'utf8');
const flush = async ()=>{ for(let i = 0; i < 20; i += 1){ await Promise.resolve(); } };

function mkHost(Cls){
	const h = new Cls({ dispatch: jest.fn() });
	h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
	h.replotAfterRestore = ()=>{};
	h.plotWith = ()=>{};
	return h;
}
let seq = 0;
function loadCase(scope, zeri){
	seq += 1;
	setGlobalStore({ user: { caseApplySeq: seq, appliedCaseCid: `fp-${seq}`, currentCase: {
		cid: { value: `fp-${seq}` }, updateTime: { value: 't' }, caseType: { value: scope }, sourceModule: { value: scope },
		payload: { value: JSON.stringify({ module: scope, zeri }) } } } });
}
const CFG = { startDate: '2026-03-01', endDate: '2026-03-02', startTime: '00:00', endTime: '23:59' };
const RESULTS = [{ start: '2026-03-01 10:00', end: '2026-03-01 11:00' }];
const stale = (h)=>!!(h._scanUiJson && h.currentUiJson() !== h._scanUiJson);

afterEach(()=>{ setGlobalStore({}); });

describe('紫微择日(扫描口径读紫微设置单例;点结果行不回写设置)', ()=>{
	const ZM = require('../ZiweiZeriMain');
	const { ZWEngineOptions } = require('../../ziwei/ziweiOptions');
	const saved0 = { ...ZWEngineOptions };
	afterEach(()=>{ Object.keys(ZWEngineOptions).forEach((k)=>{ ZWEngineOptions[k] = saved0[k]; }); });
	// 存下的 options = 那次扫描的 effectiveScanOptions(工作台 + 当时的设置)
	const savedUnder = (h, engine)=>({ ...h.state.options, ...ZM.ziweiZeriScanOptions(h.state.options, { ...ZWEngineOptions, ...engine }) });

	test('存案口径 = 现在的设置 → 载入后不亮过期', ()=>{
		const h = mkHost(ZM.default);
		loadCase('ziweizeri', { cfg: CFG, tree: h.state.tree, options: savedUnder(h, {}), results: RESULTS });
		expect(restoreZeriWorkbenchFromCase(h, 'ziweizeri')).toBe(true);
		expect(stale(h)).toBe(false);
	});
	test('🔴 存案按火铃南派扫、现在是三合 → 载入后亮过期;设置改回南派 → 熄灭', ()=>{
		const h = mkHost(ZM.default);
		loadCase('ziweizeri', { cfg: CFG, tree: h.state.tree, options: savedUnder(h, { huoling: 'nanpai' }), results: RESULTS });
		expect(ZWEngineOptions.huoling).toBe('sanhe');
		expect(restoreZeriWorkbenchFromCase(h, 'ziweizeri')).toBe(true);
		expect(h._scanOptions.huoling).toBe('nanpai');
		expect(stale(h)).toBe(true);
		ZWEngineOptions.huoling = 'nanpai';
		expect(stale(h)).toBe(false);
	});
	test('页面口径进扫描之前存的旧存案(不带页面键):设置是出厂值 → 不亮;设置改过 → 亮', ()=>{
		const h = mkHost(ZM.default);
		loadCase('ziweizeri', { cfg: CFG, tree: h.state.tree, options: { timeAlg: 1, gender: 1 }, results: RESULTS });
		expect(restoreZeriWorkbenchFromCase(h, 'ziweizeri')).toBe(true);
		expect(stale(h)).toBe(false);
		ZWEngineOptions.starSet = 'north18';
		expect(stale(h)).toBe(true);
	});
	test('出厂值表与紫微设置单例的出厂值逐键相同', ()=>{
		jest.isolateModules(()=>{
			const fresh = require('../../ziwei/ziweiOptions').ZWEngineOptions;
			const { ZIWEI_PAGE_FACTORY, ZIWEI_PAGE_SCAN_KEYS } = require('../../../divination/zeri/zeriPageCalibre');
			expect(Object.keys(ZIWEI_PAGE_FACTORY).sort()).toEqual([...ZIWEI_PAGE_SCAN_KEYS].sort());
			ZIWEI_PAGE_SCAN_KEYS.forEach((k)=>{ expect([k, ZIWEI_PAGE_FACTORY[k]]).toEqual([k, fresh[k]]); });
		});
	});
});

describe('八字择日(扫描口径读内嵌八字页;点结果行按冻结值回写)', ()=>{
	const BM = require('../BaziZeriMain');
	function withPage(h, page){
		h.baziHook = { getBaziOptions: ()=>({ ...page }), applyBaziOptions: (p)=>{ Object.assign(page, p); return Promise.resolve(); }, fun: ()=>{} };
		return page;
	}
	test('存案口径 = 内嵌页 → 载入后不亮', ()=>{
		const h = mkHost(BM.default);
		withPage(h, { southMonth: 'chong', minggongMethod: 'tongxing' });
		loadCase('bazizeri', { cfg: CFG, tree: h.state.tree, options: { ...h.state.options, southMonth: 'chong', minggongMethod: 'tongxing' }, results: RESULTS });
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(true);
		expect(stale(h)).toBe(false);
	});
	test('🔴 存案按南半球月令对冲扫、内嵌页是不调 → 载入后亮;点结果行回写冻结值 → 熄灭', async ()=>{
		const h = mkHost(BM.default);
		const page = withPage(h, { southMonth: 'none', minggongMethod: 'tongxing' });
		loadCase('bazizeri', { cfg: CFG, tree: h.state.tree, options: { ...h.state.options, southMonth: 'chong', minggongMethod: 'tongxing' }, results: RESULTS });
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(true);
		expect(stale(h)).toBe(true);
		h.onPickInterval(RESULTS[0]);
		await flush();
		expect(page.southMonth).toBe('chong');
		expect(stale(h)).toBe(false);
	});
	test('旧存案不带页面键:内嵌页是出厂值 → 不亮;页面改过 → 亮,点结果行回写出厂值 → 熄灭', async ()=>{
		const h = mkHost(BM.default);
		const page = withPage(h, { southMonth: 'none', minggongMethod: 'tongxing' });
		const opts = { ...h.state.options };
		delete opts.southMonth; delete opts.minggongMethod;
		loadCase('bazizeri', { cfg: CFG, tree: h.state.tree, options: opts, results: RESULTS });
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(true);
		expect(stale(h)).toBe(false);
		page.minggongMethod = 'ziping';
		expect(stale(h)).toBe(true);
		h.onPickInterval(RESULTS[0]);
		await flush();
		expect(page.minggongMethod).toBe('tongxing');
		expect(stale(h)).toBe(false);
	});
});

describe('天星择日(扫描读全局古典口径单例)', ()=>{
	test('扫描之后改了全局古典口径 → 「结果已过期」亮;改回 → 熄灭', ()=>{
		jest.isolateModules(()=>{
			const globals = { value: {} };
			jest.doMock('../../../utils/classicalChartGlobals', ()=>({ ...jest.requireActual('../../../utils/classicalChartGlobals'), getClassicalChartGlobals: ()=>({ ...globals.value }) }));
			const TM = require('../TianxingElectionMain');
			const h = new TM.default({});
			const fp0 = h.currentUiJson();
			globals.value = { westNodeType: 'true' };   // 交点取真交点:进扫描请求体的全局键
			expect(h.buildScanBase().westNodeType).toBe('true');
			expect(h.currentUiJson()).not.toBe(fp0);
			globals.value = {};
			expect(h.currentUiJson()).toBe(fp0);
			jest.dontMock('../../../utils/classicalChartGlobals');
		});
	});
});

describe('指纹规范化与源码判据', ()=>{
	test('canonicalJson:键序不同 → 同一指纹;值不同 → 不同;undefined 键略去', ()=>{
		expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: [1, { x: 1, y: 2 }] }, b: 1 }));
		expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
		expect(canonicalJson({ a: 1, u: undefined })).toBe(canonicalJson({ a: 1 }));
	});
	test('载入存案后工作台参数键序与扫描时不同:不误报过期(印度 / 七政)', ()=>{
		[['../IndiaZeriMain', 'indiazeri'], ['../QizhengZeriMain', 'qizhengzeri']].forEach(([mod, scope])=>{
			const h = mkHost(require(mod).default);
			const fresh = h.currentUiJson();
			const reversed = {};
			Object.keys(h.state.options).reverse().forEach((k)=>{ reversed[k] = h.state.options[k]; });
			expect(h.uiJsonOf({ ...h.state, options: reversed })).toBe(fresh);
			loadCase(scope, { cfg: { ...CFG, ...h.state.cfg, startDate: CFG.startDate }, tree: h.state.tree, options: reversed, results: RESULTS });
			expect(restoreZeriWorkbenchFromCase(h, scope)).toBe(true);
			expect(stale(h)).toBe(false);
		});
	});

	const HOST_FILES = fs.readdirSync(ZERI_DIR).filter((f)=>/(ZeriMain|^TianxingElectionMain)\.js$/.test(f) && /currentUiJson\s*\(/.test(read(f)));
	const stripComments = (src)=>src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
	const methodBody = (src, name)=>{
		const m = new RegExp(`\\n\\t${name}\\s*\\([^)]*\\)\\s*\\{`).exec(src) || new RegExp(`\\nfunction ${name}\\s*\\([^)]*\\)\\s*\\{`).exec(src);
		if(!m){ return null; }
		let depth = 0;
		for(let i = m.index + m[0].length - 1; i < src.length; i += 1){
			if(src[i] === '{'){ depth += 1; }
			if(src[i] === '}'){ depth -= 1; if(depth === 0){ return src.slice(m.index, i + 1); } }
		}
		return null;
	};
	test('有过期指纹的择日宿主全数登记(十个)', ()=>{
		expect(HOST_FILES.sort()).toEqual(['BaziZeriMain.js', 'HuangliZeriMain.js', 'IndiaZeriMain.js', 'LiurengZeriMain.js', 'QimenZeriMain.js',
			'QizhengZeriMain.js', 'SanshiZeriMain.js', 'TaiyiZeriMain.js', 'TianxingElectionMain.js', 'ZiweiZeriMain.js']);
	});
	test.each(HOST_FILES)('%s:指纹经纯函数 uiJsonOf(规范化序列化),currentUiJson 只委托它', (f)=>{
		const src = stripComments(read(f));
		const ui = methodBody(src, 'uiJsonOf');
		expect(ui).toBeTruthy();
		expect(ui).toMatch(/canonicalJson\(/);
		expect(ui).not.toMatch(/this\.(state|baziHook|ziweiHook|liurengHook|taiyiHook|sanshiHook|dunjiaRef)\b/);   // 纯函数:只读形参
		const cur = methodBody(src, 'currentUiJson');
		expect(cur).toMatch(/this\.uiJsonOf\(/);
		expect(cur).not.toMatch(/JSON\.stringify\(/);
		expect(src).not.toMatch(/_scanUiJson\s*=\s*JSON\.stringify\(/);
	});
	test('还原冻结口径的函数不许调 currentUiJson()(必须按冻结形参算)', ()=>{
		[['zeriCaseRestore.js', 'restoreScanFreeze'], ['QimenZeriMain.js', 'restoreScanFreeze']].forEach(([f, fn])=>{
			const body = methodBody(stripComments(read(f)), fn);
			expect([f, !!body]).toEqual([f, true]);
			expect([f, /currentUiJson\s*\(/.test(body)]).toEqual([f, false]);
			expect([f, /(^|[^A-Za-z])(uiJsonOf|frozenUiJsonOf)\s*\(/.test(body)]).toEqual([f, true]);
		});
	});
});

test('紫微:过期提示写明本结果的排盘口径与现在的紫微设置(相同则不写)', ()=>{
	const { ziweiStaleCalibreNote, ziweiZeriScanOptions, ziweiZeriFullDefaultOptions } = require('../ZiweiZeriMain');
	const { ZWEngineOptions } = require('../../ziwei/ziweiOptions');
	const base = ziweiZeriFullDefaultOptions();
	const was = ziweiZeriScanOptions(base, { ...ZWEngineOptions, huoling: 'nanpai' });
	const now = ziweiZeriScanOptions(base, ZWEngineOptions);
	const note = ziweiStaleCalibreNote(was, now);
	expect(note).toContain('火铃');
	expect(note).toContain('现在是');
	expect(ziweiStaleCalibreNote(now, now)).toBe('');
	expect(ziweiStaleCalibreNote({ timeAlg: 1, gender: 1 }, now)).toBe('');   // 旧存案不带页面键 = 出厂口径
	const t = require('fs').readFileSync(require('path').join(__dirname, '..', 'ZiweiZeriWorkbench.js'), 'utf8');
	expect(t).toContain('{staleCalibreNote ? <div className="horosa-zeri-stale-calibre"');
});
