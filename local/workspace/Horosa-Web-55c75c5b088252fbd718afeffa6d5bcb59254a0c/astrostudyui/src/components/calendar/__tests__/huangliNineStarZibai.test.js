// 九星值日统一到本软件日紫白(zibai.dayCenter,风水紫白飞星 / 东亚诸术同一函数):
//   · 2000~2040 逐日:黄历九星 = dayCenter 入中星(数 / 色 / 五行 / 方位逐字同 lunar NineStar 的写法);
//   · 三个闰期窗口以外逐日与旧口径(lunar getDayNineStar)完全相同 —— 原来的非闰期结果不变;
//   · 闰期窗口里确有不同(判别力),择日「九星值日」条件按新口径判。
import { Solar } from 'lunar-javascript';
import { dayCenter } from '../../fengshui/zibai';
import { buildHuangliDay, dayNineStarOf } from '../huangliDay';
import { HUANGLI_CONDITION_TYPES } from '../../../divination/zeri/huangliZeriConditionTypes';

const NUM = '一二三四五六七八九';
const LEAP_WINDOWS = [['2008-12-20', '2009-01-18'], ['2020-06-20', '2020-07-19'], ['2031-12-20', '2032-01-18']];
const ms = (s)=>Date.parse(`${s}T00:00:00Z`);
const inLeapWindow = (t)=>LEAP_WINDOWS.some(([a, b])=>t >= ms(a) && t <= ms(b));

function eachDay(y0, y1, fn){
	for(let t = Date.UTC(y0, 0, 1); t < Date.UTC(y1 + 1, 0, 1); t += 86400000){
		const d = new Date(t);
		fn(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), t);
	}
}

describe('黄历九星值日 = 日紫白 dayCenter', ()=>{
	[[2000, 2010], [2011, 2020], [2021, 2030], [2031, 2040]].forEach(([y0, y1])=>{
		test(`${y0}~${y1} 逐日与 dayCenter 一致;闰期以外与旧口径逐日相同`, ()=>{
			const bad = []; const changedOutside = []; let leapDiff = 0;
			eachDay(y0, y1, (y, m, d, t)=>{
				const c = dayCenter(y, m, d).center;
				const ns = dayNineStarOf(y, m, d);
				if(!ns || ns.number !== NUM[c - 1] || ns.name !== `${ns.number}${ns.color}${ns.wuxing}`){ bad.push(`${y}-${m}-${d}`); }
				const old = Solar.fromYmd(y, m, d).getLunar().getDayNineStar().getNumber();
				if(inLeapWindow(t)){ if(old !== ns.number){ leapDiff += 1; } }
				else if(old !== ns.number){ changedOutside.push(`${y}-${m}-${d}`); }
			});
			expect(bad).toEqual([]);
			expect(changedOutside).toEqual([]);
			// 本段含闰期窗口的,窗口里确实改了(否则「统一」形同虚设)
			const hasWindow = LEAP_WINDOWS.some(([a])=>Number(a.slice(0, 4)) >= y0 && Number(a.slice(0, 4)) <= y1);
			if(hasWindow){ expect(leapDiff).toBeGreaterThan(10); }
		}, 120000);
	});

	test('日课卡 / 快照取的 nineStar 就是这一口径(闰期里的日子与风水同日同星)', ()=>{
		[[2008, 12, 25], [2009, 1, 10], [2020, 7, 1], [2032, 1, 5], [2024, 6, 21], [2000, 1, 1]].forEach(([y, m, d])=>{
			const day = buildHuangliDay(y, m, d, 12);
			expect(day.nineStar).toEqual(dayNineStarOf(y, m, d));
			expect(day.nineStar.number).toBe(NUM[dayCenter(y, m, d).center - 1]);
		});
		// 字形与旧版同(数 + 色 + 五行,方位卦名)
		expect(dayNineStarOf(2020, 7, 1)).toMatchObject({ name: expect.stringMatching(/^[一二三四五六七八九][白黑碧绿黄赤紫][水土木金火]$/), position: expect.stringMatching(/^[坎坤震巽中乾兑艮离]$/) });
	});

	test('择日「九星值日」条件按日紫白判(闰期日旧口径与新口径分歧处)', ()=>{
		const nine = HUANGLI_CONDITION_TYPES.nine_star;
		// 找闰期里一个新旧不同的日子
		let pick = null;
		eachDay(2020, 2020, (y, m, d, t)=>{
			if(pick || !inLeapWindow(t)){ return; }
			const old = Solar.fromYmd(y, m, d).getLunar().getDayNineStar().getNumber();
			const now = NUM[dayCenter(y, m, d).center - 1];
			if(old !== now){ pick = { y, m, d, old, now }; }
		});
		expect(pick).toBeTruthy();
		const day = buildHuangliDay(pick.y, pick.m, pick.d, 12);
		expect(nine.evaluate(day, { values: [pick.now] }).pass).toBe(true);
		expect(nine.evaluate(day, { values: [pick.old] }).pass).toBe(false);
		expect(nine.evaluate(day, { values: [pick.now] }).actual).toBe(`九星:${day.nineStar.name}`);
	});
});
