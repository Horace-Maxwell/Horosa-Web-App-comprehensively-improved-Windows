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
const { readSource, sourceSetFiles } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的门面按「子模块 + 门面」全集读(scripts/source-sets.json)

const SRC = path.resolve(__dirname, '..', 'SanShiUnitedMain.js');
const raw = readSource(SRC);
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const code = strip(raw);

// —— 产生面:onOptionChange('key', ...) 全部字面量键 ——
// 页面把 onOptionChange={this.onOptionChange} 原样传给的子组件(如奇门 / 三式共用的附加层控件 QimenOverlayControls)
// 在自己文件里写 onOptionChange('key', …):那些键同样由本页产生 —— 按 import 找到子组件文件一并读。
// horosa_slice_local_delegate_v1:本全集里自己定义的子组件(左栏拆出来的 SanShiInputPanel)不是「别的文件里的委托组件」——
// 它的代码已在 code 里,键照常被下面的提取读到;只有从别处 import 进来的才按 import 找文件。
const delegates = Array.from(new Set(Array.from(code.matchAll(/<([A-Z][A-Za-z0-9]*)\b[^>]*onOptionChange=\{this\.onOptionChange\}/g)).map((m) => m[1])))
	.filter((name) => !new RegExp(`class\\s+${name}\\s+extends\\b`).test(code));
expect(delegates.length).toBeGreaterThanOrEqual(2);   // 判据自证:附加层控件与十二建星两件委托组件都认得出
// 引入路径按写着它的那个文件解析(类方法拆在 main/ 下时,引入跟着用它的方法走)
const delegateFiles = delegates.map((name) => {
	const re = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*'([^']+)'`);
	const owner = sourceSetFiles(SRC).find((f) => re.test(fs.readFileSync(f, 'utf8')));
	const im = owner ? fs.readFileSync(owner, 'utf8').match(re) : null;
	return im ? path.resolve(path.dirname(owner), `${im[1]}.js`) : null;
});
expect(delegateFiles.every(Boolean)).toBe(true);   // 判据自证:每个委托组件都找得到文件
const delegateCode = delegateFiles.filter(Boolean).map((f) => strip(fs.readFileSync(f, 'utf8'))).join('\n');
const produced = Array.from(new Set(
	Array.from((code + '\n' + delegateCode).matchAll(/onOptionChange\(\s*'([a-zA-Z0-9_]+)'/g)).map((m) => m[1])
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
		why: '真太阳时算法:onTimeAlgChange 包装 —— 清 panCache/taiyiCache/lastRecalcSignature/lastKey,只写本页 localFields,已起盘时在 setState 回调里 refreshAll(force) 重算',
		anchor: 'this.refreshAll(localFields, true);',
	},
	sex: {
		why: '性别:onGenderChange 包装 —— 同步 gender field 走字段通道重算(遁甲阴盘/太乙性别相关口径由字段链触发)',
		anchor: 'onGenderChange(val){',
	},
	mode: {
		why: 'mode=命局/事局:只管「保存」去向(命盘/事盘),不改任何子盘计算输入(此前误记为「合参/单式」)',
		anchor: "onOptionChange('mode'",
	},
};

describe('三式合一重算白名单完备性(L3)', () => {
	it('原样传下去的子组件都找得到文件,且各自真产生键(子组件改名 / 挪走时这条先红)', () => {
		expect(delegates.length).toBeGreaterThanOrEqual(1);
		delegateFiles.forEach((f, i) => { expect(`${delegates[i]}:${!!f && fs.existsSync(f)}`).toBe(`${delegates[i]}:true`); });
		expect(Array.from(delegateCode.matchAll(/onOptionChange\(\s*'([a-zA-Z0-9_]+)'/g)).length).toBeGreaterThanOrEqual(4);
	});
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
