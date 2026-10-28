jest.mock('../../../utils/helper', ()=>({
	randomStr: ()=> 'reng-chart-test',
	formatDate: jest.fn(),
}));

import RengChart from '../RengChart';

describe('RengChart runyear gender label', ()=>{
	function buildChart(gender){
		return new RengChart({
			id: 'reng-chart-test',
			chartObj: null,
			fields: null,
			tooltipId: 'tooltip-test',
			nongli: null,
			liureng: null,
			runyear: {
				year: '甲子',
				age: 38,
			},
			gender,
			zhangshengElem: '土',
			guireng: 2,
			panStyleName: '',
		});
	}

	test('shows female when gender is string 0', ()=>{
		const chart = buildChart('0');
		expect(chart.getRunYear()[2].value).toBe('女');
	});

	test('shows female when gender is number 0', ()=>{
		const chart = buildChart(0);
		expect(chart.getRunYear()[2].value).toBe('女');
	});

	test('shows male when gender is string 1', ()=>{
		const chart = buildChart('1');
		expect(chart.getRunYear()[2].value).toBe('男');
	});

	test('shows male when gender is number 1', ()=>{
		const chart = buildChart(1);
		expect(chart.getRunYear()[2].value).toBe('男');
	});

	test('simple text pan keeps the old heaven-plate branch mapping', ()=>{
		const chart = buildChart(1);
		chart.nongli = {
			dayGanZi: '壬辰',
		};
		const house = chart.getSimpleHouse({
			downZi: ['子', '丑'],
			upZi: ['申', '酉'],
			houseTianJiang: ['天后', '贵人'],
		}, '丑');
		expect(house.up).toBe('酉');
		expect(house.gan).toBe('乙');
		expect(house.jiang).toBe('贵');
	});
});
