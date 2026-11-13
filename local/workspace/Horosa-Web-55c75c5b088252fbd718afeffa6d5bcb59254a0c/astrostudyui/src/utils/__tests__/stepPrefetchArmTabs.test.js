// 进页武装步进预取只给「靠全局时间步进」的页:自己管日期 / 年份 / 区间的页、没有时间轴的页不武装
// (否则每次进页白发 6 个 /chart 预取,页面一个都不用,占排盘引擎一轮)。
import { shouldArmForTab } from '../stepPrefetchArm';

describe('进页武装的页签范围', ()=>{
	test('靠全局时间步进的页:武装', ()=>{
		['astrochart', 'direction', 'bazi', 'ziwei', 'guolao', 'indiachart', 'auxchart', 'shusuan', 'mingother',
			'liureng', 'dunjia', 'taiyi', 'sanshiunited', 'astrochart3D'].forEach((k)=>{
			expect({ k, arm: shouldArmForTab(k) }).toEqual({ k, arm: true });
		});
	});
	test('随机 / 取现时 / 流式 / 浏览型 / 择日:不武装(原有)', ()=>{
		['guazhan', 'planetarium', 'aianalysis', 'astrodata', 'xuanshi', 'zeri'].forEach((k)=>{
			expect({ k, arm: shouldArmForTab(k) }).toEqual({ k, arm: false });
		});
	});
	test('自己管时间或没有时间轴的页:不武装', ()=>{
		['calendar', 'cntradition', 'fengshui', 'tarot', 'relativechart', 'jieqichart', 'cnyibu'].forEach((k)=>{
			expect({ k, arm: shouldArmForTab(k) }).toEqual({ k, arm: false });
		});
	});
	test('空键不武装', ()=>{
		expect(shouldArmForTab('')).toBe(false);
		expect(shouldArmForTab(undefined)).toBe(false);
	});
});
