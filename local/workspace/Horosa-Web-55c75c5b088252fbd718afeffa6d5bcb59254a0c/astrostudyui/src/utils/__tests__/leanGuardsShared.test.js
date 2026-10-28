// 多余防御写法清理的回归锁(共享件)。
// 这些写法删掉前后同一输入同一输出:被删的 try / 判空 / typeof 守着的是「不可能发生」的情形
// (console 方法永不抛、AbortController#abort 永不同步抛、被调方体内已整段 try、模块常量恒为数组/对象、
// 刚构造的对象恒为真)。这里锁两件事:
//   ① 源码里不再长回这些写法(长回来=红);
//   ② 删守卫所依赖的前提仍成立(常量形状、被调方永不抛、剥离职责归属),前提一变先在这里红。
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('日志调用不再包一层空 try(console 方法永不抛)', () => {
	const files = ['utils/request.js', 'utils/astroAiSnapshot.js', 'utils/pageScreenshot.js'];
	test.each(files)('%s', (rel) => {
		expect(read(rel)).not.toMatch(/try\s*\{\s*console\.(warn|error|info|log)\(/);
	});
	test('静默失败留痕仍在(三处:requestCore / requestRaw / requestStream)', () => {
		const src = read('utils/request.js');
		expect((src.match(/console\.warn\('\[request\] silent failure'/g) || []).length).toBe(3);
	});
});

describe('不再判 console 是否存在', () => {
	const files = ['utils/safeStorage.js', 'utils/localRecordStore.js', 'utils/baziLunarLocal.js'];
	test.each(files)('%s', (rel) => {
		expect(read(rel)).not.toMatch(/typeof console\s*!==?\s*['"]undefined['"]/);
	});
});

describe('abort() 不再包 try(按规范永不同步抛)', () => {
	test('utils/backendIdentity.js', () => {
		expect(read('utils/backendIdentity.js')).not.toMatch(/try\s*\{\s*[\w.]+\.abort\(\)\s*;?\s*\}\s*catch/);
	});
	test('对已中止的控制器再 abort 是空操作', () => {
		const c = new AbortController();
		c.abort();
		expect(() => c.abort()).not.toThrow();
		expect(c.signal.aborted).toBe(true);
	});
});

describe('被调方本身永不抛,调用方不再包 try', () => {
	const files = ['utils/newChartSeeds.js', 'utils/pageSettingsStore.js'];
	test.each(files)('%s', (rel) => {
		expect(read(rel)).not.toMatch(/try\s*\{\s*safe(LocalStorageRemove|JsonStringifyToStorage)\(/);
	});
	test('safeLocalStorageRemove / safeJsonStringifyToStorage 遇存储抛错与循环结构都不抛', () => {
		const { safeLocalStorageRemove, safeJsonStringifyToStorage } = require('../safeStorage');
		const spy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('boom'); });
		try{
			expect(() => safeLocalStorageRemove('horosa.chart.newChartSeeds.v1')).not.toThrow();
		}finally{
			spy.mockRestore();
		}
		const loop = {};
		loop.self = loop;
		expect(() => safeJsonStringifyToStorage('horosa.chart.newChartSeeds.recordMissing.v1', loop)).not.toThrow();
		expect(safeJsonStringifyToStorage('horosa.chart.newChartSeeds.recordMissing.v1', loop)).toBe(false);
	});
});

describe('布局视口变量不再给永不抛的缩放读数包 try', () => {
	test('utils/layoutViewportVars.js', () => {
		expect(read('utils/layoutViewportVars.js')).not.toMatch(/try\s*\{\s*\w+\s*=\s*(getDeclaredZoom|measureLayoutViewport)\(\)/);
	});
	test('getDeclaredZoom / measureLayoutViewport 在缺 body、zoom 非法时也不抛', () => {
		const zd = require('../zoomDomain');
		const prev = document.documentElement.style.zoom;
		document.documentElement.style.zoom = 'abc';
		try{
			expect(() => zd.getDeclaredZoom()).not.toThrow();
			expect(zd.getDeclaredZoom()).toBe(1);
			expect(() => zd.measureLayoutViewport()).not.toThrow();
		}finally{
			document.documentElement.style.zoom = prev;
		}
	});
});

describe('模块常量不再兜底(恒为数组 / 对象)', () => {
	test('巴比伦快照直接读数据常量', () => {
		const src = read('utils/babylonAiSnapshot.js');
		expect(src).not.toMatch(/\((PERIOD_RELATIONS|DATE_CONSTANTS|MONTHS|GOAL_YEAR) \|\| \[\]\)/);
		expect(src).not.toMatch(/if\((HEMEROLOGY|SAROS)\)\{/);
		expect(src).not.toMatch(/HEMEROLOGY && |EAE && |NOTES && |Array\.isArray\(LUNAR_SIX\)/);
	});
	test('巴比伦数据常量形状(删兜底的前提)', () => {
		const D = require('../../divination/data/babylonianData');
		const { MONTHS } = require('../../divination/babylon/calendar');
		['GOAL_YEAR', 'PERIOD_RELATIONS', 'DATE_CONSTANTS', 'LUNAR_SIX'].forEach((k) => {
			expect(Array.isArray(D[k])).toBe(true);
			expect(D[k].length).toBeGreaterThan(0);
		});
		expect(Array.isArray(MONTHS)).toBe(true);
		expect(D.HEMEROLOGY && typeof D.HEMEROLOGY).toBe('object');
		expect(Array.isArray(D.EAE.examples)).toBe(true);
		expect(D.SAROS && typeof D.SAROS).toBe('object');
		expect(D.NOTES && typeof D.NOTES).toBe('object');
	});
	test('一掌经神煞表 / 三分主星表 / 古典全局缺省 / 宫制与天王星族表 / 紫微单例', () => {
		expect(read('utils/yizhangjingReport.js')).not.toMatch(/SHENSHA && |SHENSHA\.rows && /);
		expect(read('utils/triplicityRulers.js')).not.toMatch(/TRIPLICITY && /);
		expect(read('utils/mountCalibreSignature.js')).not.toMatch(/CLASSICAL_GLOBAL_DEFAULTS && /);
		expect(read('utils/newChartSeeds.js')).not.toMatch(/HOUSE_SYSTEM_OPTIONS \|\| \[\]/);
		expect(read('utils/techniqueMountSettings.js')).not.toMatch(/HOUSE_SYSTEM_OPTIONS \|\| \[\]|ZWSchool && |ZWEngineOptions \?/);
		expect(read('constants/planetAvailability.js')).not.toMatch(/LIST_URANIAN \|\| \[\]/);
		expect(read('utils/baziLunarLocal.js')).not.toMatch(/NaYin && /);

		const SHENSHA = require('../data/yizhangjingShensha.json');
		expect(SHENSHA.rows && typeof SHENSHA.rows).toBe('object');
		const { TRIPLICITY } = require('../../divination/data/hellenisticData');
		expect(TRIPLICITY && typeof TRIPLICITY).toBe('object');
		const { CLASSICAL_GLOBAL_DEFAULTS } = require('../classicalChartGlobals');
		expect(CLASSICAL_GLOBAL_DEFAULTS && typeof CLASSICAL_GLOBAL_DEFAULTS).toBe('object');
		const AstroConst = require('../../constants/AstroConst');
		expect(Array.isArray(AstroConst.HOUSE_SYSTEM_OPTIONS)).toBe(true);
		expect(Array.isArray(AstroConst.LIST_URANIAN)).toBe(true);
		const { ZWSchool, NaYin } = require('../../constants/ZWConst');
		expect(ZWSchool && typeof ZWSchool).toBe('object');
		expect(NaYin && typeof NaYin).toBe('object');
		const { ZWEngineOptions } = require('../../components/ziwei/ziweiOptions');
		expect(ZWEngineOptions && typeof ZWEngineOptions).toBe('object');
	});
});

describe('请求选项:刚构造的对象不再判空,剥离只在一处', () => {
	test('request.js 不再出现 opts && opts.', () => {
		expect(read('utils/request.js')).not.toMatch(/opts && opts\./);
	});
	test('silent / disableLoading 只由 buildSignedFetchOptions 剥离', () => {
		const src = read('utils/request.js');
		expect((src.match(/delete opts\.silent;/g) || []).length).toBe(1);
		expect((src.match(/delete opts\.disableLoading;/g) || []).length).toBe(1);
	});
	test('buildSignedFetchOptions 剥掉四个传输层选项、其余原样保留且不改入参', () => {
		const { buildSignedFetchOptions } = require('../request');
		const input = { silent: true, disableLoading: true, timeoutMs: 5, retry: 1, credentials: 'omit' };
		const out = buildSignedFetchOptions(input);
		['silent', 'disableLoading', 'timeoutMs', 'retry'].forEach((k) => expect(out).not.toHaveProperty(k));
		expect(out.credentials).toBe('omit');
		expect(out.method).toBe('POST');
		expect(input.silent).toBe(true);
		expect(() => buildSignedFetchOptions(undefined)).not.toThrow();
	});
});

describe('静态导入的函数不再判 typeof', () => {
	test('utils/astroAiSnapshot.js', () => {
		expect(read('utils/astroAiSnapshot.js')).not.toMatch(/typeof AstroConst\.zodiacalDisplayText/);
		const AstroConst = require('../../constants/AstroConst');
		expect(typeof AstroConst.zodiacalDisplayText).toBe('function');
	});
});

describe('配额重试路径不再有只含注释的空分支', () => {
	test('utils/safeStorage.js', () => {
		expect(read('utils/safeStorage.js')).not.toMatch(/if\s*\([^\n]*\)\s*\{\s*(?:\/\/[^\n]*\n\s*)+\}/);
	});
});
