// [Q-311/T-292] 工具箱「日期计算」目标日期改 JDN 加减(与反向拨目标同源):跨 1582 改历段不少算、公元前闰年不判错、小数天数取整。
import { dateCalcTarget } from '../DateCalc';
import DateTime from '../../comp/DateTime';

global.React = require('react');

function dt(ad, y, m, d){ return new DateTime({ ad, year: y, month: m, date: d, hour: 10, minute: 30, second: 0, zone: '+08:00' }); }
const ymd = (x)=>`${x.ad < 0 ? '-' : ''}${x.year}-${String(x.month).padStart(2, '0')}-${String(x.date).padStart(2, '0')}`;

describe('dateCalcTarget', () => {
	it('① 跨 1582-10-05…14 改历段:1582-10-01 +20 = 1582-10-31(旧逐月加法得 10-21)', () => {
		expect(ymd(dateCalcTarget(dt(1, 1582, 10, 1), 20))).toBe('1582-10-31');
		expect(ymd(dateCalcTarget(dt(1, 1582, 10, 4), 1))).toBe('1582-10-15');
		expect(ymd(dateCalcTarget(dt(1, 1582, 10, 15), -1))).toBe('1582-10-04');
	});
	it('② 公元前闰年按天文年(公元前 1 年=天文 0 年为闰):公元前1年-02-28 +1 = 02-29;公元前 4 年(天文 -3)非闰', () => {
		expect(ymd(dateCalcTarget(dt(-1, 1, 2, 28), 1))).toBe('-1-02-29');
		expect(ymd(dateCalcTarget(dt(-1, 4, 2, 28), 1))).toBe('-4-03-01');
	});
	it('③ 正反同源:目标 JDN − 起始 JDN 再加回得同一目标(反向拨目标不被改写);④ 小数天数取整;时分秒/时区保留', () => {
		const a = dt(1, 1990, 5, 18);
		const target = dt(1, 2026, 9, 17);
		const delta = target.getOnlyDateNum() - a.getOnlyDateNum();
		expect(ymd(dateCalcTarget(a, delta))).toBe('2026-09-17');
		const t = dateCalcTarget(a, 1.5);
		expect(ymd(t)).toBe('1990-05-19');
		expect([t.hour, t.minute, t.second, t.zone]).toEqual([10, 30, 0, '+08:00']);
		expect(ymd(dateCalcTarget(dt(1, 2024, 3, 1), -1))).toBe('2024-02-29');
		expect(ymd(dateCalcTarget(dt(1, 2023, 3, 1), -1))).toBe('2023-02-28');
	});
});
