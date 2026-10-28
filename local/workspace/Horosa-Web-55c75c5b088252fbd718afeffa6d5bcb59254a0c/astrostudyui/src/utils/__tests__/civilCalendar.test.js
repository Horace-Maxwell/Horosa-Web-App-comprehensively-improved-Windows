// 前端民用历法单源与计算服务 astrostudy/civil_calendar.py 逐位同口径(同一份用例表,服务侧测试读同一文件)。
const fs = require('fs');
const path = require('path');
import {
	civilJulday, civilJuldayDisplay, civilPartsFromJd, civilRevjul, civilWallMs, formatCivilDate, astroYear, displayYear,
} from '../civilCalendar';
import DateTime from '../../components/comp/DateTime';

const CASES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'civilCalendarCases.json'), 'utf8'));

describe('civilCalendar 与服务同一份用例表', ()=>{
	test.each(CASES.julday)('civilJulday(%p, %p, %p, %p) = %p', (y, m, d, h, jd)=>{
		expect(civilJulday(y, m, d, h)).toBe(jd);
	});
	test.each(CASES.parts)('civilPartsFromJd(%p)', (jd, parts)=>{
		expect(civilPartsFromJd(jd)).toEqual(parts);
	});
});

describe('切换日与纪年', ()=>{
	test('1582-10-04 的次日是 1582-10-15', ()=>{
		const jd = civilJuldayDisplay(1582, 10, 4, 12);
		expect(civilPartsFromJd(jd + 1).date).toBe('1582-10-15');
	});
	test('历史纪年:公元前 1 年的次年是公元 1 年', ()=>{
		expect(astroYear(-1)).toBe(0);
		expect(displayYear(0)).toBe(-1);
		const jd = civilJuldayDisplay(-1, 12, 31, 12);
		expect(civilPartsFromJd(jd + 1).date).toBe('0001-01-01');
		expect(formatCivilDate(astroYear(-300), 7, 5)).toBe('-0300-07-05');
	});
	test('往返:revjul(julday) 回到同一天', ()=>{
		[[-299, 12, 28], [1200, 12, 26], [1582, 10, 4], [1582, 10, 15], [1990, 3, 10], [12000, 1, 1]].forEach(([y, m, d])=>{
			const [yy, mm, dd] = civilRevjul(civilJulday(y, m, d, 12));
			expect([yy, mm, dd]).toEqual([y, m, d]);
		});
	});
});

describe('civilWallMs', ()=>{
	test('1582-10-15 以后与 Date.UTC 逐位相同', ()=>{
		[[1582, 10, 15, 0, 0, 0], [1600, 2, 29, 23, 59, 59], [1990, 3, 10, 4, 0, 0], [2026, 12, 31, 12, 30, 15], [9999, 12, 31, 23, 59, 59]].forEach(([y, m, d, h, mi, s])=>{
			expect(civilWallMs(y, m, d, h, mi, s)).toBe(Date.UTC(y, m - 1, d, h, mi, s));
		});
	});
	test('1582 以前按儒略历:1582-10-04 与 1582-10-15 只差一天', ()=>{
		expect(civilWallMs(1582, 10, 15, 0, 0, 0) - civilWallMs(1582, 10, 4, 0, 0, 0)).toBe(86400000);
	});
	test('年份 0–99 不被当成 1900 年代', ()=>{
		expect(civilWallMs(50, 1, 2, 0, 0, 0) - civilWallMs(50, 1, 1, 0, 0, 0)).toBe(86400000);
		expect(civilWallMs(50, 1, 1, 0, 0, 0)).toBeLessThan(civilWallMs(1000, 1, 1, 0, 0, 0));
	});
});

describe('与 DateTime(起盘字段)同一历法', ()=>{
	test.each([[1200, 12, 26, 1], [1500, 12, 25, 1], [300, 12, 28, -1], [1582, 10, 4, 1], [1582, 10, 15, 1], [1990, 3, 10, 1]])('%p-%p-%p ad=%p', (y, m, d, ad)=>{
		const dt = new DateTime();
		dt.ad = ad; dt.year = y; dt.month = m; dt.date = d; dt.hour = 12; dt.minute = 0; dt.second = 0; dt.zone = '+00:00';
		const jd = dt.calcJdn();
		expect(jd).toBeCloseTo(civilJuldayDisplay(ad * y, m, d, 12), 9);
		expect(civilPartsFromJd(jd).year).toBe(ad * y);
	});
});

// 整数日序(civilJdnOfYmd / civilYmdOfJdn / gregJdnOfYmd / gregYmdOfJdn)只有本模块一份实现:日期串工具 dateStrSafe 原样转出,
// 且与带时刻的儒略日换算(civilPartsFromJd)逐日一致。
describe('整数日序:单一实现、与带时刻的换算逐日一致', ()=>{
	const CC = require('../civilCalendar');
	const DS = require('../dateStrSafe');
	const { civilJdnOfYmd, civilYmdOfJdn } = CC;
	test('dateStrSafe 转出的就是这里的函数(不另写一份)', ()=>{
		['civilJdnOfYmd', 'civilYmdOfJdn', 'gregJdnOfYmd', 'gregYmdOfJdn'].forEach((k)=>{ expect([k, DS[k] === CC[k]]).toEqual([k, true]); });
		const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'dateStrSafe.js'), 'utf8');
		expect(src).not.toMatch(/\b(32045|32083|146097)\b/);   // 日序公式的常数不许在别处再写一遍
	});
	test('外推格里历往返 / 无 0 年 / 不是数', ()=>{
		expect(CC.gregJdnOfYmd(2000, 1, 1)).toBe(2451545);
		expect(CC.gregYmdOfJdn(2451545)).toEqual({ astroYear: 2000, month: 1, day: 1 });
		expect(CC.gregYmdOfJdn(CC.gregJdnOfYmd(-299, 3, 1))).toEqual({ astroYear: -299, month: 3, day: 1 });
		expect(civilJdnOfYmd(0, 1, 1)).toBeNaN();
		expect(civilJdnOfYmd('x', 1, 1)).toBeNaN();
		expect(civilYmdOfJdn(1721424)).toEqual({ year: 1, month: 1, day: 1 });
		expect(civilYmdOfJdn(1721423)).toEqual({ year: -1, month: 12, day: 31 });
	});
	const check = (jdn)=>{
		const p = civilPartsFromJd(jdn);   // jdn 是整数 = 当地正午
		expect([jdn, civilJdnOfYmd(p.year, p.month, p.day)]).toEqual([jdn, jdn]);
		expect([jdn, civilYmdOfJdn(jdn)]).toEqual([jdn, { year: p.year, month: p.month, day: p.day }]);
	};
	test('全域稀疏取样(步长 997 天)', ()=>{
		for(let j = -3026096; j <= 7857000; j += 997){ check(j); }
	});
	test('1582 切换前后、公元元年前后、千年 / 世纪闰年附近逐日', ()=>{
		[[2299100, 2299220], [1721000, 1721800], [2268900, 2269000], [2305400, 2305500], [2451500, 2451560]].forEach(([a, b])=>{
			for(let j = a; j <= b; j += 1){ check(j); }
		});
	});
});
