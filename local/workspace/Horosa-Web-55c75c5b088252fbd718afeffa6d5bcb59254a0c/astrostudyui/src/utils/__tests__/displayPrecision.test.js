// 全站数值显示精度口径:用小数写的量最多 3 位,尾零不补。
import fs from 'fs';
import path from 'path';
import { DISPLAY_MAX_DECIMALS, trimDecimals } from '../displayPrecision';

describe('trimDecimals', ()=>{
	test('最多 3 位、四舍五入、尾零不补', ()=>{
		expect(DISPLAY_MAX_DECIMALS).toBe(3);
		expect(trimDecimals(14.3414)).toBe('14.341');
		expect(trimDecimals(0.1667)).toBe('0.167');
		expect(trimDecimals(0.0833)).toBe('0.083');
		expect(trimDecimals(10.324)).toBe('10.324');
		expect(trimDecimals(92.25)).toBe('92.25');
		expect(trimDecimals(7)).toBe('7');
		expect(trimDecimals('5.13600')).toBe('5.136');
		expect(trimDecimals(-0.0001)).toBe('0');
		expect(trimDecimals(1.23456, 2)).toBe('1.23');
	});
	test('缺值回空串;不是数的原样', ()=>{
		expect(trimDecimals(null)).toBe('');
		expect(trimDecimals(undefined)).toBe('');
		expect(trimDecimals('')).toBe('');
		expect(trimDecimals('—')).toBe('—');
	});
});

describe('印占页:引擎回 4 位小数的读数在显示处收到 3 位', ()=>{
	const { readSource } = require('./helpers/sourceSet');
	const src = readSource(path.resolve(__dirname, '..', '..', 'components', 'astro', 'IndiaChartMain.js'));
	test('时轮大运起座余年、Chakra 减算比率', ()=>{
		expect(src).toContain('(余 ${trimDecimals(d.startBalanceYears)} 年)');
		expect(src).toContain("{r.chakrapata > 0 ? trimDecimals(r.chakrapata) : '—'}");
	});
});

describe('trimDecimalsNonZero:极小量不写成 0', ()=>{
	const { trimDecimalsNonZero } = require('../displayPrecision');
	it('收位后不为 0 的与 trimDecimals 相同', ()=>{
		expect(trimDecimalsNonZero(0.9833)).toBe('0.983');
		expect(trimDecimalsNonZero(13.1833)).toBe('13.183');
		expect(trimDecimalsNonZero(-0.2584)).toBe('-0.258');
		expect(trimDecimalsNonZero(0)).toBe('0');
	});
	it('不为零却收成 0 的写成界限', ()=>{
		expect(trimDecimalsNonZero(0.0001)).toBe('<0.001');
		expect(trimDecimalsNonZero(0.00001)).toBe('<0.001');
		expect(trimDecimalsNonZero(-0.0002)).toBe('>-0.001');
	});
	it('缺值 / 非数原样', ()=>{
		expect(trimDecimalsNonZero('')).toBe('');
		expect(trimDecimalsNonZero(null)).toBe('');
		expect(trimDecimalsNonZero('abc')).toBe('abc');
	});
});
