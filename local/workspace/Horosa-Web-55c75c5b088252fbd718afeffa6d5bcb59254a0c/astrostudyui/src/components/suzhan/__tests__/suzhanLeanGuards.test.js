// 宿占:本地偏好串的 parseInt 不会抛(拿到 NaN 也不抛),外面包的 try / catch 走不到,已去;行为逐字不变。
import fs from 'fs';
import path from 'path';

const DIR = path.resolve(__dirname, '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = (f) => strip(fs.readFileSync(path.join(DIR, f), 'utf8'));

function loadSZConst(ls){
	window.localStorage.clear();
	Object.entries(ls).forEach(([k, v]) => window.localStorage.setItem(k, v));
	jest.resetModules();
	return require('../SZConst');
}

afterEach(() => { window.localStorage.clear(); });

describe('SZConst 模块初始化读偏好', () => {
	test('盘形:无存值 → 方盘;存值按 parseInt(坏串得 NaN,与改前同)', () => {
		expect(loadSZConst({}).SZChart.shape).toBe(1);
		expect(loadSZConst({ suzhanChartShape: '0' }).SZChart.shape).toBe(0);
		expect(Number.isNaN(loadSZConst({ suzhanChartShape: 'abc' }).SZChart.shape)).toBe(true);
	});
	test('起宫:只认上升(1),其余一律八字起宫(0)', () => {
		expect(loadSZConst({}).SZChart.houseStartMode).toBe(0);
		expect(loadSZConst({ suzhanHouseStartMode: '1' }).SZChart.houseStartMode).toBe(1);
		expect(loadSZConst({ suzhanHouseStartMode: '7' }).SZChart.houseStartMode).toBe(0);
		expect(loadSZConst({ suzhanHouseStartMode: 'x' }).SZChart.houseStartMode).toBe(0);
	});
	test('源码:两段读偏好不再包 try', () => {
		const src = code('SZConst.js');
		expect(src).toContain('chartshape = parseInt(chartshape);');
		expect(src).toContain('houseStartMode = parseInt(houseStartMode, 10);');
		expect(src).not.toMatch(/try\s*\{\s*(chartshape|houseStartMode) = parseInt/);
	});
});

describe('SuZhanInput 构造期读起宫偏好', () => {
	const SuZhanInput = require('../SuZhanInput').default;
	const SZConst = require('../SZConst');
	test('存值 1 → 上升;其它值不动当前值(与改前同:catch 从来走不到)', () => {
		SZConst.SZChart.houseStartMode = 0;
		window.localStorage.setItem('suzhanHouseStartMode', '1');
		new SuZhanInput({});
		expect(SZConst.SZChart.houseStartMode).toBe(1);
		window.localStorage.setItem('suzhanHouseStartMode', 'x');
		new SuZhanInput({});
		expect(SZConst.SZChart.houseStartMode).toBe(1);
		SZConst.SZChart.houseStartMode = 0;
	});
	test('源码:不再包 try', () => {
		const src = code('SuZhanInput.js');
		expect(src).not.toMatch(/try\s*\{\s*houseStartMode = parseInt/);
		expect(src).toContain('houseStartMode = parseInt(houseStartMode, 10);');
	});
});
