// pages/index.js changeCond 显式白名单完备性锁(L3,2026-08 死开关审计 DS-P1)。
// changeCond 是命组 8 处挂载组件(Astro/GuoLao/India/Aux/Finance/3D/LineChart…)的总闸:
// 「不在白名单登记的键会被静默丢弃」(源码 :522 自陈)—— 漏登键 = 组件发了、闸口吞了、
// 用户改了没反应的死开关(先例:古典参数五批三层断链)。
// 范式四要件:机械提取/最小数量守卫/豁免带理由/双向检查;另加两条本闸特有形态锁。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..', '..', 'pages', 'index.js');
const MAIN = path.resolve(__dirname, '..', '..', 'components', 'astro', 'AstroChartMain.js');
const SELECTOR = path.resolve(__dirname, '..', '..', 'components', 'astro', 'ChartDisplaySelector.js');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function bodyOf(code, marker){
	const i = code.indexOf(marker);
	if(i < 0){ return ''; }
	const j = code.indexOf('{', i);
	let depth = 0;
	for(let k = j; k < code.length; k++){
		if(code[k] === '{'){ depth++; }
		else if(code[k] === '}'){ depth--; if(depth === 0){ return code.slice(j, k + 1); } }
	}
	return '';
}

// 🔴 先在原文定位切体、再对体剥注释:整文件先剥会被字符串里的 `//` 剥断行殃及后文 marker
//    (八字侧 genParams 实测踩过)。体内配对大括号以原文为准。
const pageRaw = fs.readFileSync(SRC, 'utf8');
const changeCondBody = strip(bodyOf(pageRaw, 'function changeCond(values)'));

// ① 登记面:changeCond 体内读到的 values.X 顶层键
const whitelistKeys = Array.from(new Set(
	Array.from(changeCondBody.matchAll(/\bvalues\.([a-zA-Z_][a-zA-Z0-9_]*)/g)).map((m) => m[1])
)).sort();

// ② 高危产生面:AstroChartMain 古典预设束(五批三层断链事故的正是这条通道)。
//    两种真实产生形态:对象字面量键 + 后置属性赋值(change.tm = tm; change.ad = …; change.zone = …)。
const mainCode = strip(fs.readFileSync(MAIN, 'utf8'));
const changeObjBody = bodyOf(mainCode, 'const change = {');
const presetKeys = Array.from(new Set(
	Array.from(changeObjBody.matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/gm)).map((m) => m[1])
		.concat(Array.from(mainCode.matchAll(/\bchange\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g)).map((m) => m[1]))
)).sort();

// 预设束豁免:changeCond 不读顶层键、但随别的键连带生效的
const PRESET_EXEMPT = {
	ad: '随 tm 连带:changeCond 读 values.tm 的 .ad 属性(birth.ad=tm.ad),顶层 ad 键系冗余发送、闸口不读也无害',
	zone: '随 tm 连带:changeCond 读 values.tm 的 .zone 属性,顶层 zone 键同 ad 属冗余发送',
};

describe('changeCond 白名单完备性(L3)', () => {
	it('提取自证:changeCond 函数体切到了、白名单 ≥ 14 键、预设束 ≥ 10 键', () => {
		expect(changeCondBody.length).toBeGreaterThan(800);
		expect(whitelistKeys.length).toBeGreaterThanOrEqual(14);
		expect(presetKeys.length).toBeGreaterThanOrEqual(10);
	});

	it('白名单全集回归锁(增删键必红,新增产生键须同步来此登记;date/time/ad/zone 是 values.tm.* 属性,不在顶层)', () => {
		expect(whitelistKeys).toEqual([
			'confirmed', 'gpsLat', 'gpsLon', 'hsys', 'lat', 'lon',
			'lotReversal', 'lotsDocReverse', 'nohook', 'orbs', 'pos', 'sectBuffer',
			'siderealAyanamsa', 'southchart', 'step', 'termsVariant',
			'tm', 'triplicity', 'zodiacal',
		]);
	});

	it('预设束 ⊆ 白名单 ∪ 豁免(束里发了闸口吞了 = 五批三层断链重演,判红)', () => {
		const covered = new Set([...whitelistKeys, ...Object.keys(PRESET_EXEMPT)]);
		expect(presetKeys.filter((k) => !covered.has(k))).toEqual([]);
	});

	Object.keys(PRESET_EXEMPT).forEach((k) => {
		it(`预设束豁免 ${k}:理由成文`, () => {
			expect(PRESET_EXEMPT[k].length).toBeGreaterThan(10);
		});
	});

	it('双守卫形态锁:orbs/lotsDocReverse 走 !== undefined(有意允许 null 值透传,:533 自陈)', () => {
		expect(changeCondBody.includes('values.orbs !== undefined')).toBe(true);
		expect(changeCondBody.includes('values.lotsDocReverse !== undefined')).toBe(true);
	});

	it('通道分叉锁:applyClassicalField 走 classicalChartGlobal 独立通道(有意不过 changeCond,防误统一造成回归)', () => {
		const sel = strip(fs.readFileSync(SELECTOR, 'utf8'));
		expect(sel.includes('setClassicalChartGlobal')).toBe(true);
		expect(/applyClassicalField[\s\S]{0,600}fetchByFields/.test(sel)).toBe(true);
	});
});
