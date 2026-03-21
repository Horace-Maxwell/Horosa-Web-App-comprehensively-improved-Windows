import { computeSquareChartHostHeight, MIN_SQUARE_CHART_HEIGHT } from '../chartViewportLayout';

describe('chartViewportLayout', ()=>{
	test('uses the smaller of width and height after bottom gap', ()=>{
		expect(computeSquareChartHostHeight(640, 700, { bottomGap: 12 })).toBe(640);
		expect(computeSquareChartHostHeight(900, 540, { bottomGap: 20 })).toBe(520);
	});

	test('never returns lower than the minimum chart height', ()=>{
		expect(computeSquareChartHostHeight(120, 140, { bottomGap: 40 })).toBe(MIN_SQUARE_CHART_HEIGHT);
		expect(computeSquareChartHostHeight(0, 0)).toBe(MIN_SQUARE_CHART_HEIGHT);
	});
});
