// WP-5 紫白深化：日紫白(8.1.3)/时紫白(8.1.4)/紫白诀(8.9)。锚 2025-12-21=冬至且甲子日→阳遁上元一白。
// 日紫白口径：离冬至/夏至最近的甲子换遁，阳遁三甲子起一白·七赤·四绿顺行、阴遁起九紫·三碧·六白逆行，
// 遁内逐日连续；两起遁甲子隔 240 日时置闰，在中间甲午换遁（阳转阴起三碧、阴转阳起七赤）。
import { Solar } from 'lunar-javascript';
import { zibai, dayCenter, hourCenter, ZIBAI_JUE } from '../zibai';

describe('WP-5 紫白 · 日紫白（正统古法）', () => {
	test('2025-12-21（冬至·甲子日）阳遁上元一白入中', () => {
		const dc = dayCenter(2025, 12, 21);
		expect(dc.yang).toBe(true);
		expect(dc.center).toBe(1);
		expect(dc.dayGanZhi).toBe('甲子');
	});
	test('阳遁逐日顺行+1（1/15→1/16 center +1）', () => {
		const a = dayCenter(2026, 1, 15).center;
		const b = dayCenter(2026, 1, 16).center;
		expect(((b - a) % 9 + 9) % 9).toBe(1);
	});
	test('夏至后阴遁·逐日逆行', () => {
		const dc = dayCenter(2026, 7, 15);
		expect(dc.yang).toBe(false);
		const a = dayCenter(2026, 7, 15).center;
		const b = dayCenter(2026, 7, 16).center;
		expect(((a - b) % 9 + 9) % 9).toBe(1);   // 逆行
	});
});

describe('日紫白 · 三甲子起星连续（一七四 / 九三六）与闰', () => {
	test('2026-02-19 甲子 = 七赤（中元），不是年紫白序列的四绿', () => {
		const dc = dayCenter(2026, 2, 19);
		expect(dc.dayGanZhi).toBe('甲子');
		expect(dc.yang).toBe(true);
		expect(dc.center).toBe(7);
		expect(dc.yuanName).toBe('中元');
		expect(dayCenter(2026, 4, 20).center).toBe(4);   // 下元甲子四绿
	});
	test('2026-06-19 甲子（离夏至最近）阴遁起九紫；前一日阳遁末日也是九紫', () => {
		const dc = dayCenter(2026, 6, 19);
		expect(dc.dayGanZhi).toBe('甲子');
		expect(dc.yang).toBe(false);
		expect(dc.center).toBe(9);
		expect(dc.dunStart).toBe(true);
		const prev = dayCenter(2026, 6, 18);
		expect(prev.yang).toBe(true);
		expect(prev.center).toBe(9);
		expect(dayCenter(2026, 6, 21).center).toBe(7);   // 夏至当日接着逆行
	});
	test('2026-12-16 甲子阳遁起一白（冬至 12-22 前 6 日）', () => {
		const dc = dayCenter(2026, 12, 16);
		expect(dc.yang).toBe(true);
		expect(dc.center).toBe(1);
		expect(dayCenter(2026, 12, 15).center).toBe(1);
		expect(dayCenter(2026, 12, 15).yang).toBe(false);
	});
	test('2020 闰：6-20 甲午阴遁起三碧（前一日阳遁也是三碧），7-20 甲子九紫，2021-01-16 甲子阳遁一白', () => {
		const a = dayCenter(2020, 6, 20);
		expect(a.dayGanZhi).toBe('甲午');
		expect(a.yang).toBe(false);
		expect(a.center).toBe(3);
		expect(a.leap).toBe(true);
		expect(a.yuanName).toBe('闰');
		expect(dayCenter(2020, 6, 19).yang).toBe(true);
		expect(dayCenter(2020, 6, 19).center).toBe(3);
		expect(dayCenter(2020, 6, 19).leap).toBe(true);   // 前遁延出的闰尾
		const b = dayCenter(2020, 7, 20);
		expect(b.dayGanZhi).toBe('甲子');
		expect(b.center).toBe(9);
		expect(b.yuanName).toBe('上元');
		const c = dayCenter(2021, 1, 16);
		expect(c.dayGanZhi).toBe('甲子');
		expect(c.yang).toBe(true);
		expect(c.center).toBe(1);
	});
	test('2020~2029 逐日连续：遁内每日 ±1，只在换遁日与前一日同星并换向；上元甲子恒为一白/九紫', () => {
		let d = Solar.fromYmd(2020, 1, 1);
		let prev = dayCenter(2020, 1, 1);
		let switches = 0; let leaps = 0;
		const end = Solar.fromYmd(2029, 12, 31).getJulianDay();
		while (d.getJulianDay() < end) {
			d = d.next(1);
			const cur = dayCenter(d.getYear(), d.getMonth(), d.getDay());
			const diff = ((cur.center - prev.center) % 9 + 9) % 9;
			if (cur.yang !== prev.yang) {
				switches += 1;
				expect(diff).toBe(0);
				expect(cur.dunStart).toBe(true);
				if (cur.leap) { leaps += 1; expect(cur.dayGanZhi).toBe('甲午'); expect(cur.center).toBe(cur.yang ? 7 : 3); }
				else { expect(cur.dayGanZhi).toBe('甲子'); expect(cur.center).toBe(cur.yang ? 1 : 9); }
			} else {
				expect(diff).toBe(cur.yang ? 1 : 8);
			}
			if (cur.dayGanZhi === '甲子' && cur.yuanName === '上元') { expect(cur.center).toBe(cur.yang ? 1 : 9); }
			prev = cur;
		}
		expect(switches).toBe(20);   // 十年二十次换遁
		expect(leaps).toBe(1);       // 2020 那次闰
	});
	test('闰约十一二年一次：2005~2035 间换遁甲午落在 2008-12-20、2020-06-20、2031-12-20（这次闰期跨到 2032-01-19 甲子）', () => {
		const years = [];
		let d = Solar.fromYmd(2005, 1, 1);
		let prev = dayCenter(2005, 1, 1);
		const end = Solar.fromYmd(2035, 12, 31).getJulianDay();
		while (d.getJulianDay() < end) {
			d = d.next(1);
			const cur = dayCenter(d.getYear(), d.getMonth(), d.getDay());
			if (cur.yang !== prev.yang && cur.leap) { years.push(d.toYmd()); }
			prev = cur;
		}
		expect(years).toEqual(['2008-12-20', '2020-06-20', '2031-12-20']);
	});
	test('换遁甲子离至日不超过 30 日', () => {
		[[2023, 6, 21], [2023, 12, 22], [2029, 6, 21], [2029, 12, 21]].forEach(([y, m, dd]) => {
			const s = Solar.fromYmd(y, m, dd);
			let k = 0; let hit = null;
			for (k = -31; k <= 31 && !hit; k++) {
				const t = s.next(k);
				const c = dayCenter(t.getYear(), t.getMonth(), t.getDay());
				if (c.dunStart) { hit = k; }
			}
			expect(hit).not.toBeNull();
			expect(Math.abs(hit)).toBeLessThanOrEqual(30);
		});
	});
	test('古代日期也能出（公元 500 年）', () => {
		const dc = dayCenter(500, 3, 1);
		expect(dc).not.toBeNull();
		expect(dc.center).toBeGreaterThanOrEqual(1);
	});
});

describe('WP-5 紫白 · 时紫白（正统古法）', () => {
	test('甲子日(子日,阳遁)子时一白·丑时二黑（顺）', () => {
		expect(hourCenter(2025, 12, 21, 0).center).toBe(1);   // 子时
		expect(hourCenter(2025, 12, 21, 2).center).toBe(2);   // 丑时
		expect(hourCenter(2025, 12, 21, 0).shiZhi).toBe('子');
	});
});

describe('WP-5 紫白 · 紫白诀 + 整合', () => {
	test('紫白诀名句含二五交加/七九回禄', () => {
		expect(ZIBAI_JUE.some((j)=>j.text.indexOf('二五交加') >= 0)).toBe(true);
		expect(ZIBAI_JUE.some((j)=>j.text.indexOf('七九合辙') >= 0)).toBe(true);
	});
	test('zibai 给 date → 日/时盘齐；不给则 null（向后兼容）', () => {
		const r = zibai({ year: 2026, month: 6, date: { y: 2025, m: 12, d: 21, hour: 0 } });
		expect(r.yearPalaces).toHaveLength(9);
		expect(r.dayPalaces).toHaveLength(9);
		expect(r.hourPalaces).toHaveLength(9);
		expect(zibai({ year: 2026 }).dayPalaces).toBeNull();
	});
});

describe('时紫白顺逆看至日本身(冬后顺排夏后逆)', ()=>{
	it('冬至前几天仍逆、冬至后即顺,不跟日遁的换遁甲子', ()=>{
		expect(hourCenter(2026, 12, 17, 0).yang).toBe(false);    // 2026 冬至在 12-22
		expect(hourCenter(2026, 12, 21, 0).yang).toBe(false);
		expect(hourCenter(2000, 1, 1, 0).yang).toBe(true);       // 1999 冬至 12-22 之后
		expect(hourCenter(2026, 7, 1, 0).yang).toBe(false);      // 夏至之后
	});
});
