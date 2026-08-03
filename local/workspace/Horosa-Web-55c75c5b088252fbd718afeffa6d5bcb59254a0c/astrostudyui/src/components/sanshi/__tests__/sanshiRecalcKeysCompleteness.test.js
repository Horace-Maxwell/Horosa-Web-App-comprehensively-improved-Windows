// 三式合一 SANSHI_RECALC_OPTION_KEYS 白名单完备性锁(L3,2026-08 死开关审计 DS-P1)。
// 病灶范式:onOptionChange 产生的键若不在 Set 里且无专门处理分支,改值后盘面纹丝不动
// (「改了不重算」型死开关;先例=始击坐标三式合一缺档)。
// 判据(照 recordFieldsRestore 四要件):
//   ① 产生面/登记面全部机械提取(剥注释),不手抄清单;
//   ② 每个集合带最小数量守卫(正则漂移致提取塌缩时必红,防假绿);
//   ③ 豁免必须带成文理由,且理由里的「专门处理路径」要在源码里有代码级锚点;
//   ④ 双向:产生⊆登记∪豁免(防漏登) + 登记⊆产生(防僵尸登记) + 登记∩豁免=∅。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..', 'SanShiUnitedMain.js');
const raw = fs.readFileSync(SRC, 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const code = strip(raw);

// —— 产生面:onOptionChange('key', ...) 全部字面量键 ——
const produced = Array.from(new Set(
	Array.from(code.matchAll(/onOptionChange\(\s*'([a-zA-Z0-9_]+)'/g)).map((m) => m[1])
)).sort();

// —— 登记面:SANSHI_RECALC_OPTION_KEYS Set 字面量 ——
const setMatch = code.match(/SANSHI_RECALC_OPTION_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
const registered = setMatch
	? Array.from(new Set(Array.from(setMatch[1].matchAll(/'([a-zA-Z0-9_]+)'/g)).map((m) => m[1]))).sort()
	: [];

// —— 豁免表:每键一条理由 + 一个源码锚点(锚点消失=专门处理路径被删=豁免失效,判红) ——
const EXEMPT = {
	after23NewDay: {
		why: '子正换日界:onOptionChange 内专门分支 prefetch 农历/节气种子,hasPlotted 时显式 refreshAll(force) 真重算,不走 Set 通道',
		anchor: "key === 'after23NewDay' || key === 'lateZiHourUseNextDay'",
	},
	lateZiHourUseNextDay: {
		why: '晚子时干次日:与 after23NewDay 同一专门分支(prefetch + refreshAll(force))',
		anchor: "key === 'after23NewDay' || key === 'lateZiHourUseNextDay'",
	},
	timeAlg: {
		why: '真太阳时算法:onTimeAlgChange 包装 —— 清 panCache/taiyiCache/lastRecalcSignature/lastKey 后走 onFieldsChange 字段通道重取重算',
		anchor: 'onTimeAlgChange(val){',
	},
	sex: {
		why: '性别:onGenderChange 包装 —— 同步 gender field 走字段通道重算(遁甲阴盘/太乙性别相关口径由字段链触发)',
		anchor: 'onGenderChange(val){',
	},
	mode: {
		why: '排盘模式(合参/单式):仅影响布局与兜底快照段名,不改任何子盘计算输入',
		anchor: "onOptionChange('mode'",
	},
};

describe('三式合一重算白名单完备性(L3)', () => {
	it('提取自证:产生面 ≥ 25 键、登记面 ≥ 20 键(正则漂移塌缩必红)', () => {
		expect(produced.length).toBeGreaterThanOrEqual(25);
		expect(registered.length).toBeGreaterThanOrEqual(20);
	});

	it('产生 ⊆ 登记 ∪ 豁免(漏登键 = 「改了不重算」死开关,当场判红)', () => {
		const covered = new Set([...registered, ...Object.keys(EXEMPT)]);
		expect(produced.filter((k) => !covered.has(k))).toEqual([]);
	});

	it('登记 ⊆ 产生(僵尸登记:Set 里挂着 UI 已不再产生的键也判红)', () => {
		const producedSet = new Set(produced);
		expect(registered.filter((k) => !producedSet.has(k))).toEqual([]);
	});

	it('登记 ∩ 豁免 = ∅(一个键不能既走 Set 又挂豁免,语义只许一种)', () => {
		const reg = new Set(registered);
		expect(Object.keys(EXEMPT).filter((k) => reg.has(k))).toEqual([]);
	});

	Object.keys(EXEMPT).forEach((k) => {
		it(`豁免 ${k}:理由成文且专门处理路径的代码锚点在位`, () => {
			expect(EXEMPT[k].why.length).toBeGreaterThan(10);
			expect(code.includes(EXEMPT[k].anchor)).toBe(true);
		});
	});

	it('Set 消费点在位(hasPlotted 时命中即 refreshAll 真重算)', () => {
		expect(/SANSHI_RECALC_OPTION_KEYS\.has\(key\)/.test(code)).toBe(true);
	});
});
