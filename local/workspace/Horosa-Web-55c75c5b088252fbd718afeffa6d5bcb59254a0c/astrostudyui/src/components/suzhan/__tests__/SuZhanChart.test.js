const mockDraw = jest.fn();

jest.mock('../../../utils/helper', ()=>({
	randomStr: ()=> 'unit-test',
}));

jest.mock('../SZChart', ()=> jest.fn().mockImplementation(()=>({
	draw: mockDraw,
	chartDisp: 0,
	planetDisp: null,
	fields: null,
	chart: null,
})));

import SuZhanChart from '../SuZhanChart';
import * as SZConst from '../SZConst';

function makeFields({
	shape = SZConst.SZChart_Circle,
	chart = SZConst.SZChart_DunJiaChart,
	houseStartMode = SZConst.SZHouseStart_ASC,
} = {}){
	return {
		szshape: { value: shape },
		szchart: { value: chart },
		houseStartMode: { value: houseStartMode },
	};
}

function makeValue(){
	return {
		fixedStarSu28: [{ name: '角' }],
		objects: [],
	};
}

describe('SuZhanChart shape sync', ()=>{
	beforeEach(()=>{
		document.body.innerHTML = '';
		mockDraw.mockClear();
		delete global.ResizeObserver;
		SZConst.SZChart.shape = SZConst.SZChart_Square;
		SZConst.SZChart.chart = SZConst.SZChart_NoExternChart;
		SZConst.SZChart.houseStartMode = SZConst.SZHouseStart_Bazi;
	});

	test('drawChart syncs shape, chart type and house start mode from fields before draw', ()=>{
		const comp = new SuZhanChart({
			fields: makeFields(),
			value: makeValue(),
			chartDisplay: [],
			planetDisplay: [],
			active: true,
		});

		const svg = document.createElement('svg');
		svg.id = comp.state.chartid;
		Object.defineProperty(svg, 'clientWidth', { configurable: true, value: 800 });
		Object.defineProperty(svg, 'clientHeight', { configurable: true, value: 800 });
		document.body.appendChild(svg);

		comp.scheduleDrawRetry = jest.fn();

		comp.drawChart();

		expect(SZConst.SZChart.shape).toBe(SZConst.SZChart_Circle);
		expect(SZConst.SZChart.chart).toBe(SZConst.SZChart_DunJiaChart);
		expect(SZConst.SZChart.houseStartMode).toBe(SZConst.SZHouseStart_ASC);
		expect(mockDraw).toHaveBeenCalled();
	});

	test('observeChartResize only watches container layers, not svg itself', ()=>{
		const observe = jest.fn();
		const disconnect = jest.fn();
		global.ResizeObserver = jest.fn().mockImplementation((cb)=>({
			observe,
			disconnect,
			cb,
		}));

		const comp = new SuZhanChart({
			fields: makeFields(),
			value: makeValue(),
			chartDisplay: [],
			planetDisplay: [],
			active: true,
		});

		const parent = document.createElement('div');
		const wrap = document.createElement('div');
		const svg = document.createElement('svg');
		svg.id = comp.state.chartid;
		wrap.appendChild(svg);
		parent.appendChild(wrap);
		document.body.appendChild(parent);
		comp.chartWrap = wrap;

		comp.observeChartResize();

		expect(observe).toHaveBeenCalledTimes(2);
		expect(observe).toHaveBeenNthCalledWith(1, wrap);
		expect(observe).toHaveBeenNthCalledWith(2, parent);
		expect(observe).not.toHaveBeenCalledWith(svg);
	});
});
