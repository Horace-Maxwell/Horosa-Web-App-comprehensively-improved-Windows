// horosa_pd_request_facade_v1(Windows overlay 用例,gotcha #83④ / #114):星运页的数据层预热与步进预取
// (warmPrimaryDirection)发出的 /predict/pd 请求体,必须与页面类方法 buildPrimaryDirectionRequest 逐字段相同 ——
// 否则 requestDedupe 命不中(只是慢),更糟的是新设置在预热路径上被丢掉(此前两次:v3.6.0 丢 6 个字段 /
// v3.13.0 把 Field Plane 方向类型压成 0、整组丢掉 pdExtra 新设置)。判据取「上游新加的维度」本身:
// 方向类型 4 = Field Plane、相位侧 / 几何口径两项设置登记表的非缺省值。
jest.mock('../../astro/AstroPrimaryDirection', ()=>null);
jest.mock('../../astro/AstroPrimaryDirectionChart', ()=>null);
jest.mock('../../astro/AstroZR', ()=>null);
jest.mock('../../astro/AstroFirdaria', ()=>null);
jest.mock('../../astro/AstroSolarReturn', ()=>null);
jest.mock('../../astro/AstroLunarReturn', ()=>null);
jest.mock('../../astro/AstroGivenYear', ()=>null);
jest.mock('../../astro/AstroSolarArc', ()=>null);
jest.mock('../../astro/AstroProfection', ()=>null);
jest.mock('../../astro/AstroDecennials', ()=>null);
jest.mock('../../../utils/request', ()=>jest.fn());
jest.mock('../../../utils/moduleAiSnapshot', ()=>({
	saveModuleAISnapshot: jest.fn(),
}));
jest.mock('../../../utils/planetHouseInfo', ()=>({
	appendPlanetHouseInfoById: (text)=>text,
}));

import request from '../../../utils/request';
import { AstroDirectMain, warmPrimaryDirection } from '../AstroDirectMain';

function buildFields(extra){
	return {
		date: { name: ['date'], value: { ad: 1, zone: '+00:00' }, },
		time: { name: ['time'], value: { zone: '+00:00' }, },
		ad: { name: ['ad'], value: 1, },
		zone: { name: ['zone'], value: '+00:00', },
		lat: { name: ['lat'], value: '30N0', },
		lon: { name: ['lon'], value: '120E0', },
		gpsLat: { name: ['gpsLat'], value: '30N0', },
		gpsLon: { name: ['gpsLon'], value: '120E0', },
		hsys: { name: ['hsys'], value: 0, },
		zodiacal: { name: ['zodiacal'], value: 0, },
		tradition: { name: ['tradition'], value: 0, },
		strongRecption: { name: ['strongRecption'], value: 0, },
		simpleAsp: { name: ['simpleAsp'], value: 0, },
		virtualPointReceiveAsp: { name: ['virtualPointReceiveAsp'], value: 0, },
		doubingSu28: { name: ['doubingSu28'], value: 0, },
		predictive: { name: ['predictive'], value: 1, },
		showPdBounds: { name: ['showPdBounds'], value: 1, },
		pdtype: { name: ['pdtype'], value: 0, },
		pdMethod: { name: ['pdMethod'], value: 'core_alchabitius', },
		pdTimeKey: { name: ['pdTimeKey'], value: 'Ptolemy', },
		pdaspects: { name: ['pdaspects'], value: [0, 60, 90, 120, 180], },
		name: { name: ['name'], value: 'unit chart', },
		pos: { name: ['pos'], value: 'unit place', },
		southchart: { name: ['southchart'], value: 0, },
		cid: { name: ['cid'], value: null, },
		...(extra || {}),
	};
}

function buildChartObj(){
	return {
		params: {
			birth: '1984-01-23 00:00:00',
			zone: '+00:00',
			lat: '30N0',
			lon: '120E0',
			gpsLat: '30N0',
			gpsLon: '120E0',
			hsys: 0,
			zodiacal: 0,
			tradition: 0,
			strongRecption: 0,
			simpleAsp: 0,
			virtualPointReceiveAsp: 0,
			doubingSu28: 0,
			showPdBounds: 1,
			southchart: 0,
			pdaspects: [0, 60, 90, 120, 180],
			name: 'unit chart',
			pos: 'unit place',
		},
		predictives: {},
	};
}

async function warmBody(chartObj, fields){
	request.mockClear();
	request.mockResolvedValue({});
	await warmPrimaryDirection(chartObj, fields);
	expect(request).toHaveBeenCalledTimes(1);
	const [url, opts] = request.mock.calls[0];
	expect(url).toMatch(/\/predict\/pd$/);
	return JSON.parse(opts.body);
}

function pageBody(chartObj, fields){
	const instance = new AstroDirectMain({ chartObj, fields });
	const req = instance.buildPrimaryDirectionRequest(chartObj, {});
	expect(req).toBeTruthy();
	return JSON.parse(JSON.stringify(req));
}

describe('星运页主限预热请求 == 页面首点请求(Windows overlay)', ()=>{
	test('缺省设置:逐字段相同', async ()=>{
		const chartObj = buildChartObj();
		const fields = buildFields();
		expect(await warmBody(chartObj, fields)).toEqual(pageBody(chartObj, fields));
	});

	test('Field Plane(方向类型 4)+ 设置登记表非缺省值不在预热路径上丢失', async ()=>{
		const chartObj = buildChartObj();
		const fields = buildFields({
			pdtype: { name: ['pdtype'], value: 4, },
			pdAspectSide: { name: ['pdAspectSide'], value: 1, },
			pdGeometry: { name: ['pdGeometry'], value: 'classic', },
		});
		const warm = await warmBody(chartObj, fields);
		expect(warm).toEqual(pageBody(chartObj, fields));
		expect(warm.pdtype).toBe(4);
		expect(warm.pdAspectSide).toBe(1);
		expect(warm.pdGeometry).toBe('classic');
	});
});
