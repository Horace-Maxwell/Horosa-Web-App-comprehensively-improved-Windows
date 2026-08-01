// WP-8 晚子时双盘 + WP-9 闰月变体 golden。
import { assembleNatalChart, calcZiwei } from '../ZiweiCalc';

describe('WP-9 闰月变体(leapMonth 路由)', ()=>{
	// day<=15 的闰月生:mid_split 命身用本月、split_star_month/next 用下月 → lifeHouseIndex 不同。
	const base = { yearGan: '癸', yearZi: '卯', dayInt: 10, timeZi: '午', male: true, monthInt: 2, leap: true };
	test('split_star_month:命身归下月(≡next),与 mid_split(day<=15 归本月)不同', ()=>{
		const midSplit = assembleNatalChart({ ...base, leapMonth: 'mid_split' });
		const splitStar = assembleNatalChart({ ...base, leapMonth: 'split_star_month' });
		const nextOpt = assembleNatalChart({ ...base, leapMonth: 'next' });
		expect(splitStar.lifeHouseIndex).not.toBe(midSplit.lifeHouseIndex);
		expect(splitStar.lifeHouseIndex).toBe(nextOpt.lifeHouseIndex);   // 命身下月≡整月归下月
	});
	test('split_days:标准月半点15/16,day<=15 ≡ mid_split', ()=>{
		const midSplit = assembleNatalChart({ ...base, leapMonth: 'mid_split' });
		const splitDays = assembleNatalChart({ ...base, leapMonth: 'split_days' });
		expect(splitDays.lifeHouseIndex).toBe(midSplit.lifeHouseIndex);
		// day>=16:split_days 归下月
		const midSplit16 = assembleNatalChart({ ...base, dayInt: 20, leapMonth: 'mid_split' });
		const splitDays16 = assembleNatalChart({ ...base, dayInt: 20, leapMonth: 'split_days' });
		expect(splitDays16.lifeHouseIndex).toBe(midSplit16.lifeHouseIndex);
	});
	test('新选项均产出合法盘(14 主星齐)', ()=>{
		['split_days', 'split_star_month'].forEach((lm)=>{
			const c = assembleNatalChart({ ...base, leapMonth: lm });
			let n = 0; for(let i = 0; i < 12; i++){ n += (c.houses[i].starsMain || []).length; }
			expect(n).toBe(14);
		});
	});
});

describe('WP-8 晚子时双盘(calcZiwei dual)', ()=>{
	const birth23 = { date: '1988-06-15', time: '23:30', zone: 8, lon: 120, lat: 30, gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
	const birthNoon = { date: '1988-06-15', time: '12:30', zone: 8, lon: 120, lat: 30, gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };
	test('23时生:dual 挂 dualAlt,当日盘/次日盘紫微位或命宫不同', ()=>{
		const c = calcZiwei(birth23, { lateZi: 'dual' });
		expect(c.dualAlt).toBeTruthy();
		expect(c.dualLabels).toEqual(['当日盘', '次日盘']);
		const differ = c.ziweiIndex !== c.dualAlt.ziweiIndex || c.lifeHouseIndex !== c.dualAlt.lifeHouseIndex;
		expect(differ).toBe(true);
	});
	test('非23时生:dual 退化为单盘(不挂 dualAlt)', ()=>{
		const c = calcZiwei(birthNoon, { lateZi: 'dual' });
		expect(c.dualAlt).toBeUndefined();
	});
	test('当日盘=primary 且为合法盘', ()=>{
		const c = calcZiwei(birth23, { lateZi: 'dual' });
		let n = 0; for(let i = 0; i < 12; i++){ n += (c.houses[i].starsMain || []).length; }
		expect(n).toBe(14);
	});
});
