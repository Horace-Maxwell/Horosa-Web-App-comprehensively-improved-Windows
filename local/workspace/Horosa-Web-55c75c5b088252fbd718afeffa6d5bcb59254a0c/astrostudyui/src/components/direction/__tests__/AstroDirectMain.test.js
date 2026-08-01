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

import { AstroDirectMain, } from '../AstroDirectMain';
import { saveModuleAISnapshot, } from '../../../utils/moduleAiSnapshot';

function buildFields(){
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

describe('AstroDirectMain primary direction sync', ()=>{
	test('defaults invalid sub tab keys to primarydirect on entry', ()=>{
		const instance = new AstroDirectMain({
			currentSubTab: 'not-a-direction-tab',
		});

		expect(instance.state.currentTab).toBe('primarydirect');
	});

	test('primary direction calculate updates fields and uses direct pd fetch', ()=>{
		const dispatch = jest.fn();
		const chartObj = buildChartObj();
		const fields = buildFields();
		const instance = new AstroDirectMain({
			dispatch,
			chartObj,
			fields,
		});
		instance.requestPrimaryDirectionRows = jest.fn();

		instance.applyPrimaryDirectionConfig('horosa_legacy', 'Ptolemy');

		expect(dispatch).toHaveBeenCalledWith({
			type: 'app/save',
			payload: {
				pdMethod: 'horosa_legacy',
				pdTimeKey: 'Ptolemy',
				pdYears: 100,
				pdtype: 0,
				pdDirect: 1,
				// 0/1 数字编码(原布尔混编:PD 链下游 `x === 0 ? 0 : 1` 惯例会把 false 错判成 1)
				pdConverse: 0,
				pdAntiscia: 0,
				pdTerms: 0,
				// P0-2 有意扩展:平行双开关恒写(默认 0)
				pdParallel: 0,
				pdRaptParallel: 0,
			},
		});
		expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: 'astro/save',
			payload: expect.objectContaining({
				fields: expect.any(Object),
			}),
		}));
		expect(dispatch.mock.calls.find(([action])=>action.type === 'astro/fetchByFields')).toBeUndefined();
		expect(instance.requestPrimaryDirectionRows).toHaveBeenCalledWith(expect.objectContaining({
			chartObj,
			pdMethod: 'horosa_legacy',
			pdTimeKey: 'Ptolemy',
			fields: expect.any(Object),
			runHook: true,
		}));
	});

	test('primary direction AI snapshot keeps Pars Fortuna rows in Alchabitius mode', ()=>{
		const chartObj = buildChartObj();
		chartObj.params = {
			...chartObj.params,
			pdMethod: 'core_alchabitius',
			pdTimeKey: 'Ptolemy',
			showPdBounds: 1,
		};
		chartObj.predictives = {
			primaryDirection: [
				[12.5, 'N_Pars Fortuna_0', 'N_Mars_0', '', '2040-01-01 00:00:00'],
				[13.5, 'N_Sun_0', 'N_Pars Fortuna_0', '', '2041-01-01 00:00:00'],
				[14.5, 'N_Sun_0', 'N_South Node_0', '', '2042-01-01 00:00:00'],
			],
		};
		const instance = new AstroDirectMain({
			chartObj,
			fields: buildFields(),
		});

		const text = instance.savePrimaryDirectSnapshot();

		expect(text).toContain('| 12度30分 | 福点 | 火 | 2040-01-01 00:00:00 |');
		expect(text).toContain('| 13度30分 | 日 | 福点 | 2041-01-01 00:00:00 |');
		expect(text).not.toContain('2042-01-01 00:00:00');
		expect(saveModuleAISnapshot).toHaveBeenCalledWith('primarydirect', expect.stringContaining('福点'), expect.objectContaining({
			pdMethod: 'core_alchabitius',
			pdTimeKey: 'Ptolemy',
			showPdBounds: 1,
		}));
	});

	// 防回归：方位法/时间换算的快照显示名须走共享 label 字典（覆盖全部方位法与钥匙）。
	// 历史 bug：primaryDirectionMethodText 只识别 horosa_legacy、其余一律回退 'Alchabitius'，
	// 选用 Placidus / Regiomontanus / Meridian 等会在 AI 导出、挂载里被误标为 Alchabitius。
	test('primary direction snapshot shows the real method/key labels + full config (non-core)', ()=>{
		const chartObj = buildChartObj();
		chartObj.params = {
			...chartObj.params,
			pdMethod: 'placidus',
			pdTimeKey: 'Naibod',
			pdtype: 1,
			pdDirect: 1,
			pdConverse: 1,
			pdAntiscia: 1,
			pdTerms: 1,
			showPdBounds: 1,
		};
		chartObj.predictives = {
			primaryDirection: [
				[12.5, 'N_Sun_0', 'N_Mars_0', '', '2040-01-01 00:00:00'],
			],
		};
		const instance = new AstroDirectMain({
			chartObj,
			fields: buildFields(),
		});

		const text = instance.savePrimaryDirectSnapshot();

		// 方位法不再被误标 Alchabitius。
		expect(text).toContain('推运方法：Placidus（半弧）');
		expect(text).not.toContain('推运方法：Alchabitius');
		// 时间换算走真实 label。
		expect(text).toContain('度数换算：Naibod');
		// In Mundo / 顺逆 / 映点 / 界 全配置如实显示。
		expect(text).toContain('方向类型：世俗（In Mundo）');
		expect(text).toContain('向运方向：顺向 Direct + 逆向 Converse');
		expect(text).toContain('映点迫星：是');
		expect(text).toContain('界迫星：是');
	});

	// 防回归：宿命点(Vertex)应星行须以中文词条渲染(白名单/词条任一缺失都会让行被滤掉或显示原始 id)。
	test('vertex significator rows render as 宿命点 in the snapshot', ()=>{
		const chartObj = buildChartObj();
		chartObj.params = {
			...chartObj.params,
			pdMethod: 'core_alchabitius',
			pdTimeKey: 'Ptolemy',
			showPdBounds: 1,
		};
		chartObj.predictives = {
			primaryDirection: [
				[15.25, 'D_Sun_60', 'N_Vertex_0', 'Z', '2041-06-01 00:00:00'],
				[-23.5, 'N_Moon_0', 'N_Vertex_0', 'Z', '2049-01-01 00:00:00'],
			],
		};
		const instance = new AstroDirectMain({
			chartObj,
			fields: buildFields(),
		});

		const text = instance.savePrimaryDirectSnapshot();

		// 应星列渲染为中文词条而非原始 'Vertex'/'N_Vertex_0'。
		expect(text).toContain('宿命点');
		expect(text).not.toContain('N_Vertex_0');
		// 行没有被 core 白名单过滤掉(两行都在)。
		expect(text).toContain('2041-06-01 00:00:00');
		expect(text).toContain('2049-01-01 00:00:00');
	});
});
