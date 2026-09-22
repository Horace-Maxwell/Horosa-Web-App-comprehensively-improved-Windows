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

// [Q-291 裁决 2026-09-18] 闰月归月:月系星(左辅右弼 / 天刑天姚等)与斗君随所选归月规则与命身同移(《全书》「闰月作下月」、
//   《宣微》十五分界;典籍与主流传本皆「生月一经认定,命身与月系同移」,与内核 resolveLeapMonth 的 palaceMonth===starMonth 同口径);
//   仅「命身下月·月系上月」(split_star_month,存疑变体)月系留本月。修前:月系星恒用 monthInt → 缺省档闰月十六日后生者
//   命身归下月而月系星仍按本月布(本组前三例红);非闰月与归本月的档位字节不变。
const Q291_STAR_FIELDS = ['starsMain', 'starsAssist', 'starsEvil', 'starsOthersGood', 'starsOthersBad', 'starsSmall'];
function findHouseOf(chart, starName){
	for(let i = 0; i < 12; i++){
		for(const f of Q291_STAR_FIELDS){ if((chart.houses[i][f] || []).some((s)=>s.name === starName)){ return i; } }
	}
	return -1;
}
describe('[Q-291] 闰月归月:月系星 / 斗君随归月规则(仅 split_star_month 留本月)', ()=>{
	const b = { yearGan: '甲', yearZi: '子', leap: true, monthInt: 4, dayInt: 20, timeZi: '子', male: true };
	const plain4 = assembleNatalChart({ ...b, leap: false, monthInt: 4 });
	const plain5 = assembleNatalChart({ ...b, leap: false, monthInt: 5 });
	const MONTH_STARS = ['左辅', '右弼', '天刑', '天姚', '天巫', '天月', '阴煞', '解神'];
	const sameMonthStars = (c, ref)=>{ MONTH_STARS.forEach((s)=>{ expect(`${s}@${findHouseOf(c, s)}`).toBe(`${s}@${findHouseOf(ref, s)}`); }); expect(c.doujun).toBe(ref.doujun); };
	// 判别向量:四月盘与五月盘的月系星确不同(否则本组断言无区分力)
	test('判别向量:非闰四月盘 vs 五月盘 月系星与斗君不同', ()=>{
		expect(findHouseOf(plain4, '左辅')).not.toBe(findHouseOf(plain5, '左辅'));
		expect(plain4.doujun).not.toBe(plain5.doujun);
	});
	test('缺省 mid_split 二十日 ⇒ 归五月:命身与月系星 / 斗君皆按五月(≡非闰五月盘)', ()=>{
		const c = assembleNatalChart({ ...b, leapMonth: 'mid_split' });
		expect(c.lifeHouseIndex).toBe(plain5.lifeHouseIndex);
		sameMonthStars(c, plain5);
	});
	test('next ⇒ 五月;split_days(30 天月二十日)⇒ 五月;solar_term 过节 ⇒ 五月 —— 命身与月系同移', ()=>{
		sameMonthStars(assembleNatalChart({ ...b, leapMonth: 'next' }), plain5);
		sameMonthStars(assembleNatalChart({ ...b, leapMonth: 'split_days', monthDays: 30 }), plain5);
		sameMonthStars(assembleNatalChart({ ...b, leapMonth: 'solar_term', passedNextJie: true }), plain5);
	});
	test('归本月的档位字节不变:prev / mid_split 十五日 / solar_term 未过节 ⇒ 月系星按四月', ()=>{
		sameMonthStars(assembleNatalChart({ ...b, leapMonth: 'prev' }), plain4);
		sameMonthStars(assembleNatalChart({ ...b, dayInt: 15, leapMonth: 'mid_split' }), plain4);
		sameMonthStars(assembleNatalChart({ ...b, leapMonth: 'solar_term', passedNextJie: false }), plain4);
	});
	test('split_star_month(存疑变体):命身归五月、月系星与斗君仍按四月', ()=>{
		const c = assembleNatalChart({ ...b, leapMonth: 'split_star_month' });
		expect(c.lifeHouseIndex).toBe(plain5.lifeHouseIndex);
		sameMonthStars(c, plain4);
	});
	test('闰十二月二十日 mid_split ⇒ 归正月:月系星按正月布(不取「十三月」)', ()=>{
		const c = assembleNatalChart({ ...b, monthInt: 12, leapMonth: 'mid_split' });
		const plain1 = assembleNatalChart({ ...b, leap: false, monthInt: 1 });
		sameMonthStars(c, plain1);
		let n = 0; for(let i = 0; i < 12; i++){ n += (c.houses[i].starsMain || []).length; }
		expect(n).toBe(14);
	});
	test('非闰月:六档月系星逐字相同', ()=>{
		const ref = assembleNatalChart({ ...b, leap: false });
		['mid_split', 'next', 'prev', 'split_days', 'solar_term', 'split_star_month'].forEach((lm)=>{
			sameMonthStars(assembleNatalChart({ ...b, leap: false, leapMonth: lm, passedNextJie: true }), ref);
		});
	});
});
