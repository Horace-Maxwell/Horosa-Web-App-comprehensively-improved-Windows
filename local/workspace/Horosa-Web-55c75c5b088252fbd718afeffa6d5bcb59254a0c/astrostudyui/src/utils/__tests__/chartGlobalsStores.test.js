// chartGlobalsStores.test.js —— 两个全局参数仓哨兵：
//   classicalChartGlobals（/chart 级古典排盘参数）+ divinationJudgeGlobals（判读级半通用参数）。
// 定理：默认态 overrides 恒 {}（请求体/判读 opts 零变）;写入持久化+类型净化+损坏自愈。
import {
	CLASSICAL_GLOBAL_DEFAULTS, CLASSICAL_GLOBALS_STORAGE_KEY,
	getClassicalChartGlobals, classicalGlobalOverrides, classicalGlobalValue,
	setClassicalChartGlobal, classicalBackendOverrides, __resetClassicalGlobalsCacheForTest,
} from '../classicalChartGlobals';
import {
	DIVINATION_JUDGE_DEFAULTS, DIVINATION_JUDGE_STORAGE_KEY,
	getDivinationJudgeGlobals, divinationJudgeOverrides,
	setDivinationJudgeGlobal, __resetDivinationJudgeCacheForTest,
} from '../divinationJudgeGlobals';
import { judgeLayerOverrides } from '../judgeLayerOverrides';

function resetAll(){
	window.localStorage.removeItem(CLASSICAL_GLOBALS_STORAGE_KEY);
	window.localStorage.removeItem(DIVINATION_JUDGE_STORAGE_KEY);
	__resetClassicalGlobalsCacheForTest();
	__resetDivinationJudgeCacheForTest();
}

beforeEach(resetAll);
afterAll(resetAll);

describe('classicalChartGlobals', () => {
	test('默认态：全量=内建默认,overrides 恒空(零回归锚)', () => {
		expect(getClassicalChartGlobals()).toEqual(CLASSICAL_GLOBAL_DEFAULTS);
		expect(classicalGlobalOverrides()).toEqual({});
		expect(classicalGlobalValue('termsVariant')).toBe(0);
		expect(classicalGlobalValue('lotReversal')).toBe(1);
	});

	test('写入→读回→overrides 只含非默认键;持久化落 storage', () => {
		setClassicalChartGlobal('termsVariant', 2);
		setClassicalChartGlobal('geminiBoundEmended', 1);
		expect(classicalGlobalValue('termsVariant')).toBe(2);
		expect(classicalGlobalOverrides()).toEqual({ termsVariant: 2, geminiBoundEmended: 1 });
		// 改回默认 → overrides 收回
		setClassicalChartGlobal('geminiBoundEmended', 0);
		expect(classicalGlobalOverrides()).toEqual({ termsVariant: 2 });
		// 持久化(重置模块缓存后仍读回)
		__resetClassicalGlobalsCacheForTest();
		expect(classicalGlobalValue('termsVariant')).toBe(2);
	});

	test('类型净化：字符串数字收编为 int;未知键拒写', () => {
		setClassicalChartGlobal('leoBoundFirst', '1');
		expect(classicalGlobalValue('leoBoundFirst')).toBe(1);
		setClassicalChartGlobal('___evil___', 9);
		expect(getClassicalChartGlobals().___evil___).toBeUndefined();
	});

	test('storage 损坏自愈：烂 JSON → 回默认不抛', () => {
		window.localStorage.setItem(CLASSICAL_GLOBALS_STORAGE_KEY, '{broken');
		__resetClassicalGlobalsCacheForTest();
		expect(getClassicalChartGlobals()).toEqual(CLASSICAL_GLOBAL_DEFAULTS);
	});

	test('写入广播 horosa:classical-globals-changed(壳层热同步依赖)', () => {
		const seen = [];
		const h = (e) => seen.push(e.detail);
		window.addEventListener('horosa:classical-globals-changed', h);
		setClassicalChartGlobal('westNodeType', 'true');
		window.removeEventListener('horosa:classical-globals-changed', h);
		expect(seen).toEqual([{ key: 'westNodeType', value: 'true' }]);
	});
});

describe('divinationJudgeGlobals（2026-07 二批收缩为纯判读两键）', () => {
	test('默认态：全量=内建默认(仅两键),overrides 恒空', () => {
		expect(Object.keys(DIVINATION_JUDGE_DEFAULTS).sort()).toEqual(['antiscia', 'combustMitigateSameSign']);
		expect(getDivinationJudgeGlobals()).toEqual(DIVINATION_JUDGE_DEFAULTS);
		expect(divinationJudgeOverrides()).toEqual({});
	});

	test('写入→overrides 只含非默认;迁走的旧键(vocMode 等)白名单拒写', () => {
		setDivinationJudgeGlobal('antiscia', 0);          // → false
		setDivinationJudgeGlobal('combustMitigateSameSign', 0);
		expect(divinationJudgeOverrides()).toEqual({ antiscia: false, combustMitigateSameSign: false });
		setDivinationJudgeGlobal('vocMode', 'kenodromia');   // 已迁 classical 仓 → no-op
		setDivinationJudgeGlobal('cazimiOrb', 1);            // 同上
		expect(getDivinationJudgeGlobals().vocMode).toBeUndefined();
		expect(getDivinationJudgeGlobals().cazimiOrb).toBeUndefined();
		setDivinationJudgeGlobal('antiscia', 1);
		setDivinationJudgeGlobal('combustMitigateSameSign', 1);
		expect(divinationJudgeOverrides()).toEqual({});
	});
});

describe('迁仓与判读合并层（classical 二批九键 + judgeLayerOverrides）', () => {
	test('classical 仓新九键默认在位且 overrides 恒空(零回归锚)', () => {
		const g = getClassicalChartGlobals();
		expect(g.houseCuspAdvance).toBe(5);
		expect(g.cazimiOrb).toBe(17 / 60);
		expect(g.combustOrb).toBe(8.5);
		expect(g.underBeamsOrb).toBe(17);
		expect(g.vocMode).toBe('classic');
		expect(g.vocIncludeOuter).toBe(0);
		expect(g.fixedStarOrb).toBe(1);
		expect(g.fixedStarOrbMode).toBe('school');
		expect(g.antisciaOrb).toBe(1);
		expect(classicalGlobalOverrides()).toEqual({});
	});

	test('旧 judge 仓存量七键一次性并入 classical 仓(bool→int 净化)并固化', () => {
		window.localStorage.setItem(DIVINATION_JUDGE_STORAGE_KEY, JSON.stringify({
			vocMode: 'kenodromia', vocIncludeOuter: true, cazimiOrb: 1, fixedStarOrbMode: 'byMagnitude',
			combustMitigateSameSign: false,   // 留守键不迁
		}));
		__resetClassicalGlobalsCacheForTest();
		const g = getClassicalChartGlobals();
		expect(g.vocMode).toBe('kenodromia');
		expect(g.vocIncludeOuter).toBe(1);
		expect(g.cazimiOrb).toBe(1);
		expect(g.fixedStarOrbMode).toBe('byMagnitude');
		// 固化:迁移结果已写回 classical 存储(再 reset 后即便旧仓被清也读得到)。
		window.localStorage.removeItem(DIVINATION_JUDGE_STORAGE_KEY);
		__resetClassicalGlobalsCacheForTest();
		expect(getClassicalChartGlobals().vocMode).toBe('kenodromia');
		// 留守键不受迁移影响(judge 仓语义独立)。
		expect(getDivinationJudgeGlobals().combustMitigateSameSign).toBe(true);
	});

	test('judgeLayerOverrides = classical 判读七键 ∪ judge 两键;vocIncludeOuter 收编为 bool', () => {
		expect(judgeLayerOverrides()).toEqual({});
		setClassicalChartGlobal('vocMode', 'by_orb');
		setClassicalChartGlobal('vocIncludeOuter', 1);
		setClassicalChartGlobal('combustOrb', 8);
		setDivinationJudgeGlobal('antiscia', 0);
		expect(judgeLayerOverrides()).toEqual({ vocMode: 'by_orb', vocIncludeOuter: true, combustOrb: 8, antiscia: false });
		// 非判读键(termsVariant 等)绝不渗入判读层。
		setClassicalChartGlobal('termsVariant', 2);
		expect(judgeLayerOverrides().termsVariant).toBeUndefined();
	});

	test('classicalBackendOverrides:默认全空;非默认逐键;后端键名映射与 vocIncludeOuter 附随规则', () => {
		const from = (o) => classicalBackendOverrides((k) => o[k]);
		expect(from({})).toEqual({});
		expect(from({ houseCuspAdvance: 5, cazimiOrb: 17 / 60, fixedStarOrb: 1, antisciaOrb: 1, vocMode: 'classic' })).toEqual({});
		expect(from({ houseCuspAdvance: 3 })).toEqual({ houseCuspAdvance: 3 });
		expect(from({ houseCuspAdvance: 0 })).toEqual({ houseCuspAdvance: 0 });   // 0 是合法档,不得被 falsy 吞
		expect(from({ fixedStarOrb: 2, fixedStarOrbMode: 'byMagnitude' })).toEqual({ starOrb: 2, starOrbMode: 'byMagnitude' });
		expect(from({ vocIncludeOuter: 1 })).toEqual({});                          // 无非默认 vocMode 不附随
		expect(from({ vocMode: 'exempt4', vocIncludeOuter: 1 })).toEqual({ vocMode: 'exempt4', vocIncludeOuter: 1 });
		expect(from({ combustOrb: 8, underBeamsOrb: 15, antisciaOrb: 2 })).toEqual({ combustOrb: 8, underBeamsOrb: 15, antisciaOrb: 2 });
	});
});

// ── 三流派开关进单源(曾只在主盘手写下发,13宫/12分盘/合盘全部丢参) ──
describe('classicalBackendOverrides 三流派开关(lotsDocReverse/nodeExaltation/saturnExalt20)', () => {
	const { classicalBackendOverridesFromFields, classicalBackendOverridesFromPlain } = require('../classicalChartGlobals');
	it('默认关(0/undefined)一律不发', () => {
		expect(classicalBackendOverridesFromPlain({})).not.toHaveProperty('lotsDocReverse');
		const out = classicalBackendOverridesFromPlain({ lotsDocReverse: 0, nodeExaltation: '0', saturnExalt20: false });
		['lotsDocReverse', 'nodeExaltation', 'saturnExalt20'].forEach((k) => expect(out).not.toHaveProperty(k));
	});
	it('开(1/"1"/true)发 1,三键互相独立', () => {
		const out = classicalBackendOverridesFromPlain({ lotsDocReverse: 1, nodeExaltation: '1', saturnExalt20: true });
		expect(out.lotsDocReverse).toBe(1);
		expect(out.nodeExaltation).toBe(1);
		expect(out.saturnExalt20).toBe(1);
		const only = classicalBackendOverridesFromPlain({ nodeExaltation: 1 });
		expect(only).toEqual(expect.objectContaining({ nodeExaltation: 1 }));
		expect(only).not.toHaveProperty('lotsDocReverse');
		expect(only).not.toHaveProperty('saturnExalt20');
	});
	it('fields 形状(value 包装)同样生效 —— 六构参点全走此单源', () => {
		const f = { lotsDocReverse: { value: 1 }, saturnExalt20: { value: '1' } };
		const out = classicalBackendOverridesFromFields(f);
		expect(out.lotsDocReverse).toBe(1);
		expect(out.saturnExalt20).toBe(1);
	});
});
