// 日期串安全解析金标:BC 负号与五位年全域可逆(全年份域审计 4B/4C 大类的根治件)。
import { parseDateParts, formatSignedDate, parseYearFromDateStr } from '../dateStrSafe';

describe('dateStrSafe(BC/五位年安全解析)', () => {
	test('BC 串解析(裸 split 会撕成年 NaN/月 100)', () => {
		expect(parseDateParts('-7040-07-19')).toEqual({ year: -7040, month: 7, day: 19 });
		expect(parseDateParts('-100-05-12')).toEqual({ year: -100, month: 5, day: 12 });
		expect(parseDateParts('-1-01-01')).toEqual({ year: -1, month: 1, day: 1 });
	});
	test('五位年与常规年', () => {
		expect(parseDateParts('16799-12-29')).toEqual({ year: 16799, month: 12, day: 29 });
		expect(parseDateParts('2026-07-19')).toEqual({ year: 2026, month: 7, day: 19 });
		expect(parseDateParts('0100-01-05')).toEqual({ year: 100, month: 1, day: 5 });
	});
	test('斜杠与含时间尾巴', () => {
		expect(parseDateParts('7040/07/19')).toEqual({ year: 7040, month: 7, day: 19 });
		expect(parseDateParts('-3040-07-19 17:23:00')).toEqual({ year: -3040, month: 7, day: 19 });
	});
	test('parse↔format 可逆(EXTREME 抽样)', () => {
		for(const [y, m, d] of [[-12999, 4, 24], [-7040, 7, 19], [-1, 1, 1], [1, 1, 1], [1582, 10, 15], [9999, 12, 31], [16799, 12, 29]]){
			const s = formatSignedDate(y, m, d);
			expect(parseDateParts(s)).toEqual({ year: y, month: m, day: d });
		}
	});
	test('parseYearFromDateStr 替代 substr(0,4) 全家', () => {
		expect(parseYearFromDateStr('-7040-07-19')).toBe(-7040);
		expect(parseYearFromDateStr('16799-01-02')).toBe(16799);
		expect(Number.isNaN(parseYearFromDateStr('garbage'))).toBe(true);
	});
});
