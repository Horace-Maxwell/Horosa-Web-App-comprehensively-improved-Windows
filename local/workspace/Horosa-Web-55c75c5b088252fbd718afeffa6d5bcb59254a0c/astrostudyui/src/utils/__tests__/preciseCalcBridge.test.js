import request from '../request';
import { fetchPreciseJieqiSeed } from '../preciseCalcBridge';
import { buildLocalJieqiYearSeed } from '../localNongliAdapter';

jest.mock('../request', ()=>jest.fn());

describe('preciseCalcBridge jieqi seed fallback', ()=>{
	beforeEach(()=>{
		request.mockReset();
	});

	test('fills missing jieqi day ganzhi from local calendar while preserving backend term time', async()=>{
		request.mockResolvedValue({
			Result: {
				year: 2047,
				jieqi24: [
					{
						jieqi: '大雪',
						time: '2047-12-07 13:11:06',
					},
				],
			},
		});
		const seed = await fetchPreciseJieqiSeed({
			year: '2047',
			ad: 1,
			zone: '+08:00',
			timeAlg: 1,
			jieqis: ['大雪'],
		});
		const localSeed = buildLocalJieqiYearSeed(2047, '+08:00');
		expect(seed.大雪.time).toEqual('2047-12-07 13:11:06');
		expect(seed.大雪.dayGanzhi).toEqual(localSeed.大雪.dayGanzhi);
		expect(seed.大雪.dayGanzhi).toBeTruthy();
	});

	// 后端 /jieqi/year 的冬至是本年 12 月,本地节气表的「冬至」是上年 12 月:补日柱须按交节日自身日期,
	// 不能按节气名去本地表捡(曾捡成上年那天 → 置闰至锚错、奇门本地路由 2026-11-01 由阴遁六局跑成五局)。
	test.each([
		[2025, '2025-12-21 23:03:05', '甲子'],
		[2026, '2026-12-22 04:50:14', '庚午'],
	])('%i 年冬至(本年 12 月)补的日柱按其自身日期', async(year, time, gz)=>{
		request.mockResolvedValue({ Result: { year, jieqi24: [{ jieqi: '冬至', time }, { jieqi: '大雪', time: `${year}-12-07 10:00:00` }] } });
		const seed = await fetchPreciseJieqiSeed({ year: `${year}`, ad: 1, zone: '+08:00', timeAlg: 1, jieqis: ['冬至', '大雪'] });
		expect(seed.冬至.time).toEqual(time);
		expect(seed.冬至.dayGanzhi).toEqual(gz);
		// 负孪生:本地表同名项是上年 12 月那天,日柱必然不同
		const localPrevDz = buildLocalJieqiYearSeed(year, '+08:00').冬至;
		expect(localPrevDz.time.slice(0, 4)).toEqual(`${year - 1}`);
		expect(seed.冬至.dayGanzhi).not.toEqual(localPrevDz.dayGanzhi);
	});
});
