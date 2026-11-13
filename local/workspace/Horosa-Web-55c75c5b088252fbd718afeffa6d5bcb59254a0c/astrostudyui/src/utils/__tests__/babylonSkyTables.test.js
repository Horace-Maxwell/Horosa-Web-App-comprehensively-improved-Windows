// 巴比伦天象实算卡 / 快照:公元前时刻不被切坏、白夜隐现如实说明、ziqpu 间隔口径。
import fs from 'fs';
import path from 'path';
import { babylonStampMinute, babylonMonthDayMinute, babylonVisibilityNote, buildBabylonSkySection } from '../babylonAiSnapshot';

describe('时刻串按正则拆,不按位置切', ()=>{
	test('公元前带负号的年份完整保留,分钟不截半', ()=>{
		expect(babylonStampMinute('-0501-12-27 14:25:34')).toBe('-0501-12-27 14:25');
		expect(babylonMonthDayMinute('-0500-03-22 00:49:29')).toBe('03-22 00:49');
		expect(babylonStampMinute('1990-06-21 20:36:44')).toBe('1990-06-21 20:36');
		expect(babylonMonthDayMinute('1990-06-21 20:36:44')).toBe('06-21 20:36');
		expect(babylonStampMinute('12000-01-02 03:04:05')).toBe('12000-01-02 03:04');
	});
	test('认不出的串原样返回,空值给破折号', ()=>{
		expect(babylonStampMinute('x')).toBe('x');
		expect(babylonStampMinute(null)).toBe('—');
	});
	test('卡片不再按位置切时刻串', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../../components/babylon/BabylonSkyCards.js'), 'utf8');
		expect(src).not.toMatch(/\.slice\(\s*(0|5)\s*,\s*16\s*\)/);
	});
});

describe('出生时可见与高纬推迟', ()=>{
	test('偕日现象决定的:照常写', ()=>{
		expect(babylonVisibilityNote({ visible: true, since: '1990-01-23 08:00:23', twilight: 0 })).toBe('出生时可见(自 1990-01-23 08:00)');
	});
	test('出生前最后一次始见 / 末见是高纬推迟的:如实写明,并写出本窗口推迟了几次', ()=>{
		const text = babylonVisibilityNote({ visible: false, since: '1989-05-15 22:29:47', twilight: 4, visibleByTwilight: true });
		expect(text).toContain('出生时不可见(自 1989-05-15 22:29');
		expect(text).toContain('这一次因高纬夏夜天光推迟到离日 40° 以外');
		expect(text).toContain('本窗口有 4 次始见 / 末见因高纬夏夜天光推迟');
		expect(text).not.toContain('不是合日');
	});
	test('极圈与算不出', ()=>{
		expect(babylonVisibilityNote({ polar: true })).toBe('纬度超过 65°,只列合、冲、留');
		expect(babylonVisibilityNote({ visible: null })).toBe('出生时可见度未算出');
	});
	test('快照与页面同一句', ()=>{
		const sky = { paths: [{ id: 'Sun', decl: 23.4, path: 'Enlil', margin: 6.4 }], phenomena: [
			{ id: 'Mars', visible: false, since: '1989-05-15 22:29:47', twilight: 4, visibleByTwilight: true, events: [{ kind: 'opposition', date: '1988-09-28 05:30:46', state: 'last' }] },
		] };
		const text = buildBabylonSkySection(sky).join('\n');
		expect(text).toContain('火 出生时不可见(自 1989-05-15 22:29;');
		expect(text).toContain('本窗口有 4 次');
		expect(text).toContain('标「高纬推迟」');
	});
});

describe('ziqpu 间隔口径', ()=>{
	test('古、今两个数都是「与上一星」的间隔(后端 civ = 本星赤经 − 上一星赤经),界面说明不写「到下一星」', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../../components/babylon/BabylonSkyCards.js'), 'utf8');
		expect(src).not.toContain('到下一星');
		expect(src).toContain('距上一星 古/今');
		const py = fs.readFileSync(path.resolve(__dirname, '../../../../astropy/astrostudy/babylon_tables.py'), 'utf8');
		expect(py).toMatch(/row\['civ'\] = \(row\['ra'\] - prev\['ra'\]\) % 360\.0/);
	});
});
