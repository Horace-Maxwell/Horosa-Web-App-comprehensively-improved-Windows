import React from 'react';

function makeFields(){
	return {
		date: { value: { format: ()=> '2026/03/17' } },
		time: { value: { format: ()=> '12:00:00' } },
		ad: { value: 1 },
		zone: { value: 8 },
		lat: { value: '30n00' },
		lon: { value: '120e00' },
		gpsLat: { value: 30 },
		gpsLon: { value: 120 },
		hsys: { value: 0 },
		tradition: { value: 0 },
		strongRecption: { value: 0 },
		simpleAsp: { value: 0 },
		virtualPointReceiveAsp: { value: 0 },
		name: { value: 'test' },
		pos: { value: 'test' },
	};
}

describe('India chart astro meaning forwarding', ()=>{
	beforeEach(()=>{
		jest.resetModules();
		global.React = React;
	});

	test('IndiaChart passes showAstroMeaning to AstroChartMain', ()=>{
		jest.doMock('../AstroChartMain', ()=> 'AstroChartMain');
		jest.doMock('../../../services/astro', ()=> ({
			fetchIndiaChart: jest.fn(),
		}));
		jest.doMock('../../../utils/astroAiSnapshot', ()=> ({
			buildAstroSnapshotContent: jest.fn(()=> ''),
		}));
		jest.doMock('../../../utils/moduleAiSnapshot', ()=> ({
			saveModuleAISnapshot: jest.fn(),
		}));

		const IndiaChart = require('../IndiaChart').default;
		const comp = new IndiaChart({
			fields: makeFields(),
			showAstroMeaning: 1,
			chartDisplay: [],
			planetDisplay: [],
			lotsDisplay: [],
		});

		const tree = comp.render();
		const main = tree.props.children;

		expect(main.props.showAstroMeaning).toBe(1);
	});

	test('IndiaChartMain passes showAstroMeaning to each IndiaChart pane', ()=>{
		jest.doMock('../IndiaChart', ()=> 'IndiaChart');

		const IndiaChartMain = require('../IndiaChartMain').default;
		const comp = new IndiaChartMain({
			fields: makeFields(),
			showAstroMeaning: 1,
			chartDisplay: [],
			planetDisplay: [],
			lotsDisplay: [],
		});

		const tree = comp.render();
		const tabs = tree.props.children;
		const children = tabs.props.children;
		const natalPane = children[0];
		const natalChart = natalPane.props.children;
		const otherPane = children[1][0];
		const otherChart = otherPane.props.children;

		expect(natalChart.props.showAstroMeaning).toBe(1);
		expect(otherChart.props.showAstroMeaning).toBe(1);
	});
});
