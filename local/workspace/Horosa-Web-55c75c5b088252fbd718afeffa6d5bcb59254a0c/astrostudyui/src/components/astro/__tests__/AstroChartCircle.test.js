jest.mock('../../../utils/helper', ()=>({
	randomStr: ()=> 'astro-chart-circle-test',
	detectOS: ()=> 'Mac',
	distanceInCircleAbs: jest.fn(),
	creatTooltip: jest.fn(),
	setupFloatingTooltip: jest.fn(),
}));

import { resolveChartCircleDisplayMode, } from '../AstroChartCircle';

describe('AstroChartCircle display mode', ()=>{
	test('normalizes numeric zodiacal and house-system values into stable labels', ()=>{
		expect(resolveChartCircleDisplayMode({
			zodiacal: 0,
			hsys: 1,
		})).toEqual({
			zodiacal: '回归黄道',
			hsys: 'Alcabitus',
		});

		expect(resolveChartCircleDisplayMode({
			zodiacal: 'Sidereal',
			hsys: '0',
		})).toEqual({
			zodiacal: '恒星黄道',
			hsys: '整宫制',
		});
	});
});
