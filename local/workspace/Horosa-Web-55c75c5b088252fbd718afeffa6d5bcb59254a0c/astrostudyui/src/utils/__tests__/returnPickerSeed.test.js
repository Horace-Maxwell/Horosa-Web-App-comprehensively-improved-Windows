// 返照 / 流年三页与无头推运的目标时刻初值单源:今年 + 出生月日时分(公元前 / 五位年出生不拼出错年)。
import fs from 'fs';
import path from 'path';
import DateTime from '../../components/comp/DateTime';
import { returnPickerSeed } from '../returnPickerSeed';
import { addCivilYears } from '../dateStrSafe';

describe('returnPickerSeed', ()=>{
	const thisYear = new DateTime().year;
	test.each([
		['-0003-03-10 12:00:00', 3, 10, '12:00:00'],
		['0050-03-10 08:05', 3, 10, '08:05:00'],
		['12000-01-01 06:30:15', 1, 1, '06:30:15'],
		['1990-03-10 12:00', 3, 10, '12:00:00'],
		['-12998/11/02 23:59:59', 11, 2, '23:59:59'],
	])('%s → 今年 %i 月 %i 日 %s', (birth, m, d, hms)=>{
		const s = returnPickerSeed(birth);
		expect(s.ad).toBe(1);
		expect(s.year).toBe(thisYear);
		expect(s.month).toBe(m);
		expect(s.date).toBe(d);
		expect(s.format('HH:mm:ss')).toBe(hms);
		expect(Math.abs(s.jdn - s.clone().calcJdn())).toBeLessThan(1e-9);
	});
	test('2 月 29 日出生、今年平年 → 3 月 1 日(与 addCivilYears 同一规则);今年闰年 → 2 月 29 日', ()=>{
		const at = (y)=>new DateTime({ ad: 1, year: y, month: 6, date: 1, hour: 0, minute: 0, second: 0 });
		const s = returnPickerSeed('2000-02-29 10:00:00', at(2026));
		expect([s.year, s.month, s.date]).toEqual([2026, 3, 1]);
		expect(addCivilYears('2000-02-29', 26)).toBe('2026-03-01');
		expect(s.format('YYYY-MM-DD HH:mm')).toBe('2026-03-01 10:00');
		const l = returnPickerSeed('2000-02-29 10:00:00', at(2028));
		expect([l.year, l.month, l.date]).toEqual([2028, 2, 29]);
		// 1500 年(儒略闰年)出生:2100 年(格里平年)落 3 月 1 日
		const j = returnPickerSeed('1500-02-29 10:00:00', at(2100));
		expect([j.month, j.date]).toEqual([3, 1]);
	});
	test('不可解析 → 此刻', ()=>{
		const s = returnPickerSeed('');
		expect(s.year).toBe(thisYear);
	});
	test('三页与无头推运都走同一函数(不再按前 4 位切出生串)', ()=>{
		const root = path.join(__dirname, '..', '..');
		['components/astro/AstroSolarReturn.js', 'components/astro/AstroLunarReturn.js', 'components/astro/AstroGivenYear.js', 'utils/aiAnalysisContext/regenPredictive.js'].forEach((rel)=>{
			const src = fs.readFileSync(path.join(root, rel), 'utf8');
			expect(src).toMatch(/returnPickerSeed\(/);
			expect(src).not.toMatch(/\.substr\(4\)/);
		});
	});
});
