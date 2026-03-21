import {
	getAstroParamLine,
	getHouseSystemDisplay,
	getZodiacalDisplay,
	matchesAstroChartParams,
} from '../astroParamDisplay';

describe('astroParamDisplay', ()=>{
	test('maps numeric zodiacal and house system values to readable labels', ()=>{
		expect(getZodiacalDisplay(0)).toBe('回归黄道');
		expect(getZodiacalDisplay(1, { preferDetailedSidereal: true })).toContain('恒星黄道');
		expect(getHouseSystemDisplay(0)).toBe('整宫制');
		expect(getAstroParamLine(0, 0)).toBe('回归黄道，整宫制');
	});

	test('matches chart params across numeric and string zodiacal values', ()=>{
		const chartObj = {
			params: {
				zodiacal: 'Sidereal',
				hsys: '3',
				doubingSu28: 1,
				birth: '2026-03-20 22:46:09',
			},
		};
		expect(matchesAstroChartParams(chartObj, {
			zodiacal: 1,
			hsys: 3,
			doubingSu28: 1,
			birth: '2026-03-20 22:46:09',
		})).toBe(true);
		expect(matchesAstroChartParams(chartObj, {
			zodiacal: 0,
			hsys: 3,
			doubingSu28: 1,
			birth: '2026-03-20 22:46:09',
		})).toBe(false);
	});
});
