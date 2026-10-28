// 起盘 fields → 年月日时分秒 / 起盘请求参数 的拆解单一来源 utils/fieldsDateTime:
// 太乙 / 金口诀(取时与文本拆解)、五兆 / 皇极(带时区与全局日界缺省)不再各抄一份。
import fs from 'fs';
import path from 'path';
import DateTime from '../../comp/DateTime';
import { parseFieldsDateTime, parseFieldsDateTimeWithDayBoundary, parseDateTimeText } from '../../../utils/fieldsDateTime';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../../utils/dayBoundary';
import { parseDateParts } from '../../../utils/dateStrSafe';

const COMP = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(COMP, rel), 'utf8');

function dt(text){
	const d = new DateTime();
	return d.parse(text, 'YYYY-MM-DD HH:mm:ss');
}
function mkFields(text, zone){
	const v = dt(text);
	return { date: { value: v }, time: { value: v.clone() }, ...(zone ? { zone: { value: zone } } : {}) };
}

describe('fieldsDateTime', ()=>{
	test('fields 拆解:年月日时分秒 + 规范日期 / 时间串', ()=>{
		expect(parseFieldsDateTime(mkFields('2026-03-04 05:06:07'))).toEqual({
			year: 2026, month: 3, day: 4, hour: 5, minute: 6, second: 7, date: '2026-03-04', time: '05:06:07',
		});
		expect(parseFieldsDateTime(null)).toBe(null);
		expect(parseFieldsDateTime({ date: { value: dt('2026-01-01 00:00:00') } })).toBe(null);
	});

	test('带日界版:另带时区与全局日界 / 晚子时缺省;date / time 无值回 null', ()=>{
		const r = parseFieldsDateTimeWithDayBoundary(mkFields('1999-12-31 23:30:00', '+08:00'));
		expect(r).toEqual({
			year: 1999, month: 12, day: 31, hour: 23, minute: 30, second: 0, date: '1999-12-31', time: '23:30:00',
			zone: '+08:00', after23NewDay: defaultAfter23NewDay(), lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		});
		expect(parseFieldsDateTimeWithDayBoundary(mkFields('1999-12-31 23:30:00')).zone).toBe('');
		expect(parseFieldsDateTimeWithDayBoundary({ date: { value: null }, time: { value: null } })).toBe(null);
	});

	test('文本拆解:补零、秒缺省 0、年可带负号;对不上回 null', ()=>{
		expect(parseDateTimeText('2026-3-4 5:6')).toEqual({
			year: 2026, month: 3, day: 4, hour: 5, minute: 6, second: 0, date: '2026-03-04', time: '05:06:00',
		});
		expect(parseDateTimeText('-0500-01-02 03:04:05').year).toBe(-500);
		expect(parseDateTimeText('')).toBe(null);
		expect(parseDateTimeText(null)).toBe(null);
		expect(parseDateTimeText('abc')).toBe(null);
	});

	// 全年份域(历法型承诺域 BC 12998 ~ AD 16798,公元前显示年带负号、无 0 年):日期串 = 带符号年 + 数字部分补足 4 位,
	// 与 dateStrSafe.parseDateParts 往返一致。此前对带负号的年串直接补零,公元前 1–999 年拼成「0-50-07-19」一类。
	test.each([
		['-12998-03-21 08:00', -12998, '-12998-03-21'],
		['-1000-07-19 12:00', -1000, '-1000-07-19'],
		['-722-02-11 12:00', -722, '-0722-02-11'],
		['-100-07-19 12:00', -100, '-0100-07-19'],
		['-50-07-19 12:00', -50, '-0050-07-19'],
		['-0050-07-19 12:00', -50, '-0050-07-19'],
		['-10-07-19 12:00', -10, '-0010-07-19'],
		['-1-12-31 23:59', -1, '-0001-12-31'],
		['1-01-01 00:00', 1, '0001-01-01'],
		['4-02-05 00:00', 4, '0004-02-05'],
		['100-7-19 12:00', 100, '0100-07-19'],
		['2026-10-23 10:00', 2026, '2026-10-23'],
		['9999-12-31 23:59', 9999, '9999-12-31'],
		['10000-01-01 00:00', 10000, '10000-01-01'],
		['16798-12-29 12:00', 16798, '16798-12-29'],
	])('年份 %s → 日期串 %s', (text, year, date)=>{
		const r = parseDateTimeText(text);
		expect(r.year).toBe(year);
		expect(r.date).toBe(date);
		expect(r.date).not.toMatch(/^0-/);
		const back = parseDateParts(r.date);
		expect(back && back.year).toBe(year);
	});
});

describe('源码:四处调用方改从单一来源取', ()=>{
	test('太乙 / 金口诀 计算模块', ()=>{
		['taiyi/TaiYiCalc.js', 'jinkou/JinKouCalc.js'].forEach((rel)=>{
			const src = read(rel);
			expect(src).toContain("import { parseFieldsDateTime, parseDateTimeText } from '../../utils/fieldsDateTime';");
			expect(src).not.toContain('function parseFieldsDateTime(');
			expect(src).not.toContain('function parseDateTimeText(');
		});
		expect(read('taiyi/TaiYiCalc.js')).toContain('return parseDateTimeText(nongli && nongli.birth) || direct;');
	});
	test('五兆 / 皇极 / 神易数 页面', ()=>{
		['wuzhao/WuZhaoMain.js', 'huangji/HuangJiMain.js', 'shenyishu/ShenYiShuMain.js'].forEach((rel)=>{
			const src = read(rel);
			expect(src).toContain("import { parseFieldsDateTimeWithDayBoundary } from '../../utils/fieldsDateTime';");
			expect(src).not.toContain('function parseFieldsDateTime(');
			expect(src).not.toMatch(/(?<![\w$])parseFieldsDateTime\(/);
		});
	});
});
