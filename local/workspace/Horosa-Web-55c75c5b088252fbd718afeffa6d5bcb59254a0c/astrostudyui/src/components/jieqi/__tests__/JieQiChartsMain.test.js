import { getReusableJieqiChart } from '../jieqiChartReuse';

describe('JieQiChartsMain chart reuse guard', ()=>{
	test('reuses only charts that match the current zodiacal and house-system options', ()=>{
		const matchingChart = {
			params: {
				zodiacal: 0,
				hsys: 0,
				doubingSu28: 0,
				birth: '2026-03-20 22:46:09',
			},
		};
		const result = {
			jieqi24: [
				{
					jieqi: '春分',
					time: '2026-03-20 22:46:09',
				},
			],
			charts: {
				春分: matchingChart,
			},
		};

		expect(getReusableJieqiChart(result, '春分', {
			zodiacal: 0,
			hsys: 0,
			doubingSu28: 0,
		})).toBe(matchingChart);

		expect(getReusableJieqiChart(result, '春分', {
			zodiacal: 1,
			hsys: 0,
			doubingSu28: 0,
		})).toBeNull();

		expect(getReusableJieqiChart(result, '春分', {
			zodiacal: 0,
			hsys: 3,
			doubingSu28: 0,
		})).toBeNull();
	});
});
