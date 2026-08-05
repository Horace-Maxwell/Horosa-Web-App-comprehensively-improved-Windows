/**
 * 天才/天寿落宫金标(2026-08-04 双端同改)。
 *
 * 旧病:天才走 HOUSE_NAMES[11 - yearZiIdx] 宫名反查而**恒偏一位**——本仓宫名赋值是
 * idx = (lifeIdx - i) mod 12,故 HOUSE_NAMES[k] 坐落在支位 lifeIdx-k;顺行 n 宫要的是
 * k = (12-n)%12 而非 11-n。仅子年因 `if(idx>0)` 保护而恰好正确,故长期未被发现
 * (旧 golden 也未断言天才位置)。
 *
 * Java ZiWeiChart.setupTianCouCai 原为逐字同构的同源实现,已双端同改
 * (Java: (lifeHouseIndex + yearziIdx + 24) % 12 —— 与本式 144 组合逐一等价)。
 * 改 Java 后须 mvn 全链重编 jar,否则前后端分叉。
 */
import { assembleNatalChart } from '../ZiweiCalc';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STAR_FIELDS = ['starsMain', 'starsAssist', 'starsEvil', 'starsOthersGood', 'starsOthersBad', 'starsSmall'];
function findHouseOf(chart, starName){
	for(let i = 0; i < 12; i++){
		const names = STAR_FIELDS.reduce((a, f)=>a.concat((chart.houses[i][f] || []).map((s)=>s.name)), []);
		if(names.indexOf(starName) >= 0){ return i; }
	}
	return -1;
}

describe('天才/天寿落宫(命宫/身宫起子,顺数至生年支)', ()=>{
	test('① 天才 = 命宫支位 + 年支序,全 12 年支逐一等式', ()=>{
		ZHI.forEach((yz, n)=>{
			const c = assembleNatalChart({ yearGan: '甲', yearZi: yz, monthInt: 5, leap: false, dayInt: 12, timeZi: '午', male: true });
			const expected = (c.lifeHouseIndex + n) % 12;
			expect(findHouseOf(c, '天才')).toBe(expected);
		});
	});

	test('② 天寿 = 身宫支位 + 年支序(未动,作同构对照)', ()=>{
		ZHI.forEach((yz, n)=>{
			const c = assembleNatalChart({ yearGan: '乙', yearZi: yz, monthInt: 8, leap: false, dayInt: 3, timeZi: '寅', male: false });
			expect(findHouseOf(c, '天寿')).toBe((c.bodyHouseIndex + n) % 12);
		});
	});

	test('③ 反向锚:非子年时旧「11-n 宫名反查」必与正解相差一宫(防回退)', ()=>{
		// 只要有人把实现改回宫名反查,本例即红。子年(n=0)两法同解,故从 1 起。
		for(let n = 1; n < 12; n++){
			const c = assembleNatalChart({ yearGan: '丙', yearZi: ZHI[n], monthInt: 3, leap: false, dayInt: 20, timeZi: '子', male: true });
			const correct = (c.lifeHouseIndex + n) % 12;
			const oldWay = (c.lifeHouseIndex - (11 - n) % 12 + 24) % 12;   // 旧法等价式
			expect(oldWay).not.toBe(correct);          // 旧法确实偏
			expect(findHouseOf(c, '天才')).toBe(correct);
		}
	});
});

describe('天马依据(tianmaBasis)·同盘不得出现两颗马星', ()=>{
	test('④ year 档:年支系「年马」跳过,盘上只剩「天马」一颗', ()=>{
		ZHI.forEach((yz)=>{
			const c = assembleNatalChart({ yearGan: '丁', yearZi: yz, monthInt: 6, leap: false, dayInt: 8, timeZi: '申', male: true, tianmaBasis: 'year' });
			expect(findHouseOf(c, '年马')).toBe(-1);
			expect(findHouseOf(c, '天马')).toBeGreaterThanOrEqual(0);
		});
	});

	test('⑤ month 默认档:行为逐字不变(年马照旧在)', ()=>{
		ZHI.forEach((yz)=>{
			const c = assembleNatalChart({ yearGan: '丁', yearZi: yz, monthInt: 6, leap: false, dayInt: 8, timeZi: '申', male: true });
			expect(findHouseOf(c, '年马')).toBeGreaterThanOrEqual(0);
		});
	});
});
