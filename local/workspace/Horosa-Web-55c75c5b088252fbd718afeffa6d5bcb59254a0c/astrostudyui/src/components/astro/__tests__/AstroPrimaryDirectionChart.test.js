jest.mock('../../../utils/request', ()=>jest.fn());

import request from '../../../utils/request';
import * as Constants from '../../../utils/constants';
import AstroPrimaryDirectionChart from '../AstroPrimaryDirectionChart';

function createChartProps(){
	return {
		value: {
			params: {
				birth: '2028-04-06 09:33:00',
				ad: 1,
				zone: '+08:00',
				lon: '119e19',
				lat: '26n04',
				gpsLon: 119.3167,
				gpsLat: 26.0667,
				hsys: 'P',
				zodiacal: 0,
				tradition: 0,
				showPdBounds: 1,
			},
			chart: {
				objects: [],
				houses: [],
			},
		},
		pdMethod: 'astroapp_alchabitius',
		pdTimeKey: 'Ptolemy',
	};
}

function installSyncSetState(instance){
	instance.setState = (updater, callback)=>{
		const patch = typeof updater === 'function' ? updater(instance.state, instance.props) : updater;
		instance.state = {
			...instance.state,
			...patch,
		};
		if(callback){
			callback();
		}
	};
}

describe('AstroPrimaryDirectionChart', ()=>{
	beforeEach(()=>{
		jest.clearAllMocks();
	});

	test('requestDirectedChart stores pdchart payload for rendering when backend responds normally', async ()=>{
		const dirChartPayload = {
			date: '2028-06-28 10:04:11',
			arc: 3,
			pos: {
				lon: 119.3167,
				lat: 26.0667,
			},
			chart: {
				objects: [{ id: 'Sun', sign: 'Aries' }],
				houses: [{ id: 'House1', sign: 'Aries', signlon: 0 }],
				isDiurnal: true,
			},
			lots: [],
		};
		request.mockResolvedValue({
			[Constants.ResultKey]: dirChartPayload,
		});

		const panel = new AstroPrimaryDirectionChart(createChartProps());
		installSyncSetState(panel);

		await panel.requestDirectedChart();

		expect(request).toHaveBeenCalledTimes(1);
		expect(request.mock.calls[0][0]).toBe(`${Constants.ServerRoot}/predict/pdchart`);
		expect(panel.state.dirChart).toEqual(dirChartPayload);
		const derived = panel.buildDerived();
		expect(derived.dirChart).toBeTruthy();
		expect(derived.dirChart.natalChart).toBe(panel.props.value);
		expect(Number(derived.dirChart.arc)).toBe(3);
	});

	test('requestDirectedChart clears dirChart when backend returns an error payload', async ()=>{
		request.mockResolvedValue({
			[Constants.ResultKey]: {
				err: 'param error',
			},
		});

		const panel = new AstroPrimaryDirectionChart(createChartProps());
		installSyncSetState(panel);
		panel.state.dirChart = {
			arc: 1,
			chart: { objects: [], houses: [] },
		};

		await panel.requestDirectedChart();

		expect(panel.state.dirChart).toBeNull();
	});
});
