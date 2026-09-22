// [Q-495/T-457] 天象日期的历法归属:`modern_date` 同一列混着两种历法,显示层此前一律标「公历」。
//   · 带 julian_date 的条目 —— modern_date 由儒略日换算,是真格里历;
//   · 不带 julian_date 且在 1582-10-15 之前 —— modern_date 就是史料所载的儒略历日期。
// 1582-10-15 之后两历同值,仍标公历。本套件锁「按来源标注」这条判据(改前一律「公历」= 红)。
import { celestialCalendarKind, celestialCalendarLabel, celestialDateWithCalendar, resolveChartDate } from '../xuanshiDate';

describe('天象日期历法归属', () => {
	const gregorianByJD = { modern_date: '767-08-14', modern_date_disp: '767-08-14', julian_date: '767-08-10' };
	const julianAsRecorded = { modern_date: '1054-07-04', modern_date_disp: '1054-07-04' };
	const afterReform = { modern_date: '1604-10-09', modern_date_disp: '1604-10-09' };

	it('带儒略日 → 格里历(标公历)', () => {
		expect(celestialCalendarKind(gregorianByJD)).toBe('gregorian');
		expect(celestialCalendarLabel(gregorianByJD)).toBe('公历');
	});

	it('不带儒略日且在改历之前 → 儒略历(不得再标公历)', () => {
		expect(celestialCalendarKind(julianAsRecorded)).toBe('julian');
		expect(celestialCalendarLabel(julianAsRecorded)).toBe('儒略历');
	});

	it('改历之后两历同值 → 仍标公历', () => {
		expect(celestialCalendarLabel(afterReform)).toBe('公历');
	});

	it('无日期 → 空标签、空显示串', () => {
		expect(celestialCalendarLabel({})).toBe('');
		expect(celestialDateWithCalendar({})).toBe('');
		expect(celestialDateWithCalendar(null)).toBe('');
	});

	it('显示串两形:括注式与前缀式', () => {
		expect(celestialDateWithCalendar(julianAsRecorded)).toBe('1054-07-04（儒略历）');
		expect(celestialDateWithCalendar(julianAsRecorded, { prefix: true })).toBe('儒略历 1054-07-04');
		expect(celestialDateWithCalendar(gregorianByJD, { prefix: true })).toBe('公历 767-08-14');
	});
});

// [Q-487/T-449] 「排此日」须看 modern_precision:库内 modern_date 一律是完整串,月级/年级/年段只是合成日。

describe('排此日 · 近似日期不得冒充精确日', () => {
	it('判别向量 TWCHRON-00206:precision=year, modern_date -0014-01-30 → 按 -14-01-01、标「约」', () => {
		const rd = resolveChartDate({ modern_date: '-0014-01-30', modern_date_disp: '前14年', modern_precision: 'year' });
		expect(rd).toBeTruthy();
		expect(rd.exact).toBe(false);
		expect(rd.md).toBe('-14-01-01');
		expect(rd.disp).toMatch(/^约 /);
		expect(rd.precision).toBe('year');
	});

	it('月级:保留合成日起盘,但显示只到月且带「约」', () => {
		const rd = resolveChartDate({ modern_date: '1054-07-04', modern_date_disp: '1054-07-04', modern_precision: 'month' });
		expect(rd.exact).toBe(false);
		expect(rd.disp).toBe('约 1054-07');
		expect(rd.md).toBe('1054-07-04');
	});

	it('年段(interval):按起始年 1 月 1 日', () => {
		const rd = resolveChartDate({ modern_date: '0767-03-02', modern_date_disp: '767-03-02', modern_precision: 'interval' });
		expect(rd.exact).toBe(false);
		expect(rd.md).toBe('767-01-01');
	});

	it('日级(缺省/day):仍精确;改历前带儒略日者按儒略日起盘', () => {
		const a = resolveChartDate({ modern_date: '1604-10-09', modern_date_disp: '1604-10-09', modern_precision: 'day' });
		expect(a.exact).toBe(true);
		const b = resolveChartDate({ modern_date: '767-08-14', modern_date_disp: '767-08-14', julian_date: '767-08-10' });
		expect(b.exact).toBe(true);
		expect(b.calendar).toBe('julian');
		expect(b.md).toBe('767-08-10');
	});
});
