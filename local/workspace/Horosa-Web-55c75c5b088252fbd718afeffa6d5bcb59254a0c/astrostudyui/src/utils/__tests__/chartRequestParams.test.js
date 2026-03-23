import {
	buildBaseChartParamsFromFields,
	buildChartParamsFromFields,
} from '../chartRequestParams';

function buildFields(){
	const date = {
		ad: 1,
		zone: '+08:00',
		format(pattern){
			if(pattern === 'YYYY/MM/DD'){
				return '2026/03/22';
			}
			if(pattern === 'HH:mm:ss'){
				return '15:24:30';
			}
			return '';
		},
	};
	return {
		cid: { value: null },
		date: { value: date },
		time: { value: date },
		zone: { value: '+08:00' },
		lat: { value: '39N54' },
		lon: { value: '116E23' },
		gpsLat: { value: 39.9 },
		gpsLon: { value: 116.38 },
		hsys: { value: 0 },
		southchart: { value: 0 },
		zodiacal: { value: 0 },
		tradition: { value: 0 },
		doubingSu28: { value: 0 },
		strongRecption: { value: 0 },
		simpleAsp: { value: 0 },
		virtualPointReceiveAsp: { value: 0 },
		houseStartMode: { value: 0 },
		timeAlg: { value: 1 },
		phaseType: { value: 0 },
		godKeyPos: { value: '年' },
		after23NewDay: { value: 1 },
		adjustJieqi: { value: 1 },
		gender: { value: 1 },
		name: { value: '测试' },
		pos: { value: '北京' },
		group: { value: 'demo' },
		predictive: { value: 1 },
		showPdBounds: { value: 1 },
		pdtype: { value: 0 },
		pdMethod: { value: 'astroapp_alchabitius' },
		pdTimeKey: { value: 'Ptolemy' },
		pdaspects: { value: [0, 60, 90, 120, 180] },
	};
}

describe('chartRequestParams', ()=>{
	test('builds base chart params without predictive payload leakage', ()=>{
		const params = buildBaseChartParamsFromFields(buildFields());
		expect(params.date).toBe('2026/03/22');
		expect(params.time).toBe('15:24:30');
		expect(params.timeAlg).toBe(1);
		expect(params.after23NewDay).toBe(1);
		expect(params).not.toHaveProperty('predictive');
		expect(params).not.toHaveProperty('pdMethod');
		expect(params).not.toHaveProperty('pdTimeKey');
	});

	test('includes predictive payload only when explicitly requested', ()=>{
		const params = buildChartParamsFromFields(buildFields(), {
			includePredictive: true,
		});
		expect(params.predictive).toBe(1);
		expect(params.pdMethod).toBe('astroapp_alchabitius');
		expect(params.pdTimeKey).toBe('Ptolemy');
		expect(params.pdaspects).toEqual([0, 60, 90, 120, 180]);
	});
});
