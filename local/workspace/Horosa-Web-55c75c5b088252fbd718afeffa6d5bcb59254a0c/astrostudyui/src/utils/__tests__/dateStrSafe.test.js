// 日期串安全解析金标:BC 负号与五位年全域可逆(全年份域审计 4B/4C 大类的根治件)。
import { parseDateParts, formatSignedDate, parseYearFromDateStr, civilJdnOfYmd, civilYmdOfJdn, civilJdnOfDateStr, civilDateStrOfJdn, gregJdnOfYmd, gregYmdOfJdn, dateAxisTickLabel, datePartOf, toSlashDate, dateKeyOf, dateKeyOfStr, parseDateKey, dayNumOfDateKey, dateKeyOfDayNum, addCivilYears, civilDateStrOfMs, civilShiftMs } from '../dateStrSafe';
import { parseDateTimeMs } from '../dateTimeParse';
import DateTime from '../../components/comp/DateTime';

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
	test('民用历 ⇄ JDN:与 DateTime.getOnlyDateNum 逐日一致、往返可逆(全承诺域抽样 + 1582 切换 + 公元元年)', () => {
		const anchors = [[1, 1, 1, 1721424], [-1, 12, 31, 1721423], [1582, 10, 4, 2299160], [1582, 10, 15, 2299161], [2000, 1, 1, 2451545], [-4713, 1, 1, 0]];
		anchors.forEach(([y, m, d, j]) => { expect(civilJdnOfYmd(y, m, d)).toBe(j); expect(civilYmdOfJdn(j)).toEqual({ year: y, month: m, day: d }); });
		const bad = [];
		for(let j = civilJdnOfYmd(-12998, 1, 1); j <= civilJdnOfYmd(16798, 12, 31); j += 997){
			const p = civilYmdOfJdn(j);
			const dt = new DateTime({ ad: p.year < 0 ? -1 : 1, year: Math.abs(p.year), month: p.month, date: p.day, hour: 0, minute: 0, second: 0, zone: '+00:00' });
			if(dt.getOnlyDateNum() !== j || civilJdnOfDateStr(civilDateStrOfJdn(j, '/')) !== j){ bad.push(j); }
		}
		expect(bad).toEqual([]);
		expect(civilDateStrOfJdn(civilJdnOfYmd(-300, 3, 10), '/')).toBe('-0300/03/10');
		expect(Number.isNaN(civilJdnOfYmd(0, 1, 1))).toBe(true);
	});
	test('外推格里历 ⇄ JDN 往返(天文年,给 moment / Date 构造用)', () => {
		[[-12997, 3, 1], [0, 2, 29], [1, 1, 1], [1582, 10, 5], [2026, 7, 19], [16799, 12, 31]].forEach(([y, m, d]) => {
			expect(gregYmdOfJdn(gregJdnOfYmd(y, m, d))).toEqual({ astroYear: y, month: m, day: d });
		});
	});
	test('时间轴刻度:换年标 YYYY-MM、同年标 MM-DD;公元前 / 五位年不切错位', () => {
		expect(dateAxisTickLabel('2026-07-19', null)).toBe('2026-07');
		expect(dateAxisTickLabel('2026-08-19', '2026-07-19')).toBe('08-19');
		expect(dateAxisTickLabel('2027-01-02', '2026-12-19')).toBe('2027-01');
		expect(dateAxisTickLabel('-0300-03-10', null)).toBe('-0300-03');
		expect(dateAxisTickLabel('-0300-04-10', '-0300-03-10')).toBe('04-10');
		expect(dateAxisTickLabel('-0299-01-10', '-0300-12-10')).toBe('-0299-01');
		expect(dateAxisTickLabel('12000-01-01', '11999-12-01')).toBe('12000-01');
		expect(dateAxisTickLabel('12000-02-01', '12000-01-01')).toBe('02-01');
	});
	test('日期段 / 换分隔符 / 紧凑键:公元前前导负号保留,公元 1000–9999 与旧写法逐字相同', () => {
		expect(datePartOf('2026-07-19 10:30:00')).toBe('2026-07-19');
		expect(datePartOf('2026-07-19T02:30:00.000Z')).toBe('2026-07-19');
		expect(datePartOf('-0300-03-10 12:00')).toBe('-0300-03-10');
		expect(datePartOf('12000/01/01 00:00')).toBe('12000/01/01');
		expect(datePartOf('')).toBe('');
		expect(toSlashDate('2026-07-19 10:30:00')).toBe('2026/07/19 10:30:00');
		expect(toSlashDate('-0300-03-10')).toBe('-0300/03/10');
		expect(dateKeyOfStr('2026-07-19')).toBe('20260719');
		expect(dateKeyOfStr('-0300-03-10 12:00')).toBe('-03000310');
		expect(dateKeyOfStr('0300-03-10')).toBe('03000310');
		expect(dateKeyOfStr('12000-01-01')).toBe('120000101');
		expect(parseDateKey('-03000310')).toEqual({ year: -300, month: 3, day: 10 });
		expect(parseDateKey('120000101')).toEqual({ year: 12000, month: 1, day: 1 });
		expect(dateKeyOf(50, 6, 1)).toBe('00500601');
	});
	test('紧凑键 ⇄ 日序数:现代与 Date.UTC 逐值相同;1582 切换、公元元年两侧连续', () => {
		['19700101', '20260719', '19931207', '16000229', '15821015'].forEach((k) => {
			const y = +k.slice(0, 4); const m = +k.slice(4, 6); const d = +k.slice(6, 8);
			expect(dayNumOfDateKey(k)).toBe(Math.floor(Date.UTC(y, m - 1, d) / 86400000));
			expect(dateKeyOfDayNum(dayNumOfDateKey(k))).toBe(k);
		});
		expect(dayNumOfDateKey('15821015') - dayNumOfDateKey('15821004')).toBe(1);
		expect(dayNumOfDateKey('00010101') - dayNumOfDateKey('-00011231')).toBe(1);
		expect(dateKeyOfDayNum(dayNumOfDateKey('-00011231') + 1)).toBe('00010101');
		expect(dayNumOfDateKey('-03000310')).not.toBe(dayNumOfDateKey('03000310'));
	});
	test('按民用历加年 / 毫秒 ⇄ 日期串:现代与 Date 旧算法逐字相同', () => {
		expect(addCivilYears('2020-02-29', 1)).toBe('2021-03-01');
		expect(addCivilYears('2020-02-29', 4)).toBe('2024-02-29');
		expect(addCivilYears('1990-05-18', 40)).toBe('2030-05-18');
		expect(addCivilYears('-0002-03-10', 3)).toBe('0002-03-10');
		expect(addCivilYears('1500-02-29', 4)).toBe('1504-02-29');
		expect(civilDateStrOfMs(parseDateTimeMs('2026-07-19'))).toBe('2026-07-19');
		expect(civilDateStrOfMs(civilShiftMs(parseDateTimeMs('2026-07-19'), '2026-07-19') + 86400000)).toBe('2026-07-20');
		expect(civilDateStrOfMs(civilShiftMs(parseDateTimeMs('1582-10-04'), '1582-10-04') + 86400000)).toBe('1582-10-15');
		expect(civilDateStrOfMs(civilShiftMs(parseDateTimeMs('-0001-12-31'), '-0001-12-31') + 86400000)).toBe('0001-01-01');
		expect(civilDateStrOfMs(civilShiftMs(parseDateTimeMs('1500-02-28'), '1500-02-28') + 86400000)).toBe('1500-02-29');
	});
});
