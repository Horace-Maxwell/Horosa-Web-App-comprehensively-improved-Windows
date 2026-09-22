// [Q-358·续 2026-09-18] 日界口径农历单一入口:一掌经 / 参评 / 正传 的农历月日随「子初换日」进位(与八字日柱、紫微同源)。
// 真机复检发现:八字页 23:30 出生「子初换日」日柱已是次日(丙申),一掌经仍按当日农历(初八)起四宫,
// 同屏分叉;且日界开关对三页是死开关(三方案完全同果)。
import fs from 'fs';
import path from 'path';
import { lunarByDayBoundary } from '../dayBoundary';
import { buildLocalBaziResult } from '../baziLunarLocal';
import { resolveLunarInput } from '../yizhangjingReport';

function baziAt(after23NewDay, time = '23:30:00'){
	return buildLocalBaziResult({
		date: '2026-09-18', time, zone: '+08:00', lon: 113.0, gpsLon: 113.0, lat: 23.0, gpsLat: 23.0,
		gender: 1, timeAlg: 1, after23NewDay, lateZiHourUseNextDay: 1,
	}).bazi;
}

describe('lunarByDayBoundary 语义', () => {
	test('无 ziwei* 键(远程农历桥 / 旧夹具)逐字回退 monthNum / dayNum / leap', () => {
		expect(lunarByDayBoundary({ monthNum: 5, dayNum: 17, leap: false })).toEqual({ monthNum: 5, dayNum: 17, leap: false, shifted: false });
		expect(lunarByDayBoundary({ monthNum: '8', dayNum: '8', isLeap: true })).toEqual({ monthNum: 8, dayNum: 8, leap: true, shifted: false });
		expect(lunarByDayBoundary(null)).toEqual({ monthNum: 0, dayNum: 0, leap: false, shifted: false });
	});
	test('有 ziwei* 键则以进位后的农历为准并标 shifted', () => {
		expect(lunarByDayBoundary({ monthNum: 8, dayNum: 8, leap: false, ziweiMonthNum: 8, ziweiDayNum: 9, ziweiLeap: false }))
			.toEqual({ monthNum: 8, dayNum: 9, leap: false, shifted: true });
		expect(lunarByDayBoundary({ monthNum: 8, dayNum: 8, leap: false, ziweiMonthNum: 8, ziweiDayNum: 8, ziweiLeap: false }).shifted).toBe(false);
	});
});

describe('真链:2026-09-18 23:30 出生', () => {
	test('子初换日(after23=1):日柱丙申(次日),农历日随之为初九;一掌经四宫入参同步', () => {
		const b = baziAt(1);
		expect(b.fourColumns.day.ganzi).toBe('丙申');
		expect(b.nongli.dayNum).toBe(8);           // 钟面历日的农历(展示用)不变
		expect(lunarByDayBoundary(b.nongli)).toMatchObject({ monthNum: 8, dayNum: 9, shifted: true });
		expect(resolveLunarInput(b).day).toBe(9);
	});
	test('24 点换日(after23=0):日柱乙未(守今),农历日初八,一掌经不进位', () => {
		const b = baziAt(0);
		expect(b.fourColumns.day.ganzi).toBe('乙未');
		expect(lunarByDayBoundary(b.nongli)).toMatchObject({ monthNum: 8, dayNum: 8, shifted: false });
		expect(resolveLunarInput(b).day).toBe(8);
	});
	test('非 23 点档(12:30)两口径完全同果(零回归)', () => {
		const a = resolveLunarInput(baziAt(1, '12:30:00'));
		const c = resolveLunarInput(baziAt(0, '12:30:00'));
		expect(a.day).toBe(8);
		expect(a).toEqual(c);
	});
});

describe('源码闸:按农历月日起数的技法只经单一入口取值', () => {
	const FILES = [
		'../yizhangjingReport.js',
		'../../components/shusuan/CanPingMain.js',
		'../../components/shusuan/ZhengChuanMain.js',
	];
	test.each(FILES)('%s 用 lunarByDayBoundary,不再直读 nl.dayNum / nl.monthNum', (rel) => {
		const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
		expect(src).toContain('lunarByDayBoundary(');
		expect(src).not.toMatch(/parseInt\(nl\.(dayNum|monthNum)/);
		expect(src).not.toMatch(/Number\(nl\.(dayNum|monthNum)/);
		expect(src).not.toMatch(/day:\s*nl\.dayNum/);
	});
});
