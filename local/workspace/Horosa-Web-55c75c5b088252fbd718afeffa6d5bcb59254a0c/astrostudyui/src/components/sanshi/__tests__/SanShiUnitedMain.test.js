jest.mock('../../astro/AstroHelper', ()=>({
	splitDegree: jest.fn(),
	convertLatToStr: (value)=>`${value}`,
	convertLonToStr: (value)=>`${value}`,
}));
jest.mock('../../liureng/ChuangChart', ()=>null);
jest.mock('../../amap/GeoCoordModal', ()=>null);
jest.mock('../../astro/PlusMinusTime', ()=>null);
jest.mock('../../../utils/request', ()=>jest.fn());
jest.mock('../../../utils/moduleAiSnapshot', ()=>({
	saveModuleAISnapshot: jest.fn(),
}));
jest.mock('../../../utils/preciseCalcBridge', ()=>({
	fetchPreciseNongli: jest.fn(),
	fetchPreciseJieqiSeed: jest.fn(),
}));

import SanShiUnitedMain, { buildSanShiUnitedSnapshotText, QIMEN_OPTIONS } from '../SanShiUnitedMain';
import { calcDunJia } from '../../dunjia/DunJiaCalc';
import DateTime from '../../comp/DateTime';

function buildDateTime(text){
	const dt = new DateTime();
	dt.parse(text, 'YYYY-MM-DD HH:mm:ss');
	dt.setZone('+08:00');
	return dt;
}

function buildFields(cid, name, birth, lon, lat, gender = 1){
	const dt = buildDateTime(birth);
	return {
		cid: { value: cid },
		name: { value: name },
		date: { value: dt.clone() },
		time: { value: dt.clone() },
		ad: { value: dt.ad },
		zone: { value: '+08:00' },
		lon: { value: lon },
		lat: { value: lat },
		gpsLon: { value: lon },
		gpsLat: { value: lat },
		zodiacal: { value: 0 },
		hsys: { value: 0 },
		timeAlg: { value: 0 },
		gender: { value: gender },
	};
}

function buildChart(chartId){
	return {
		chartId,
		chart: {
			objects: [],
			nongli: {
				dayGanZi: '甲子',
				time: '甲子',
			},
		},
	};
}

function mountLike(component){
	component.setState = (patch, callback)=>{
		const nextPatch = typeof patch === 'function' ? patch(component.state, component.props) : patch;
		component.state = {
			...component.state,
			...(nextPatch || {}),
		};
		if(callback){
			callback();
		}
	};
	return component;
}

describe('SanShiUnitedMain chart-list synchronization', ()=>{
	beforeEach(()=>{
		jest.useFakeTimers();
	});

	afterEach(()=>{
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
		if(global.fetch && global.fetch.mockRestore){
			global.fetch.mockRestore();
		}else{
			delete global.fetch;
		}
	});

	it('replaces plotted fields and auto recalculates when a second saved chart is selected', ()=>{
		const firstFields = buildFields('chart-a', 'A', '2006-10-04 09:58:00', '119e24', '30n54', 1);
		const secondFields = buildFields('chart-b', 'B', '1988-04-20 12:20:00', '118e27', '31n38', 0);
		const component = mountLike(new SanShiUnitedMain({
			fields: firstFields,
			chartObj: buildChart('chart-a'),
			hook: {},
		}));
		component.state = {
			...component.state,
			hasPlotted: true,
			localFields: firstFields,
			plottedFields: firstFields,
			loading: false,
		};
		component.prefetchNongliForFields = jest.fn();
		component.prefetchJieqiSeedForFields = jest.fn();
		component.refreshAll = jest.fn();

		component.handleExternalFieldsSync(secondFields, buildChart('chart-b'));

		expect(component.state.localFields).toBe(secondFields);
		expect(component.state.plottedFields).toBe(secondFields);
		expect(component.state.options.sex).toBe(0);
		expect(component.state.loading).toBe(true);
		expect(component.prefetchNongliForFields).toHaveBeenCalledWith(secondFields);
		expect(component.prefetchJieqiSeedForFields).toHaveBeenCalledWith(secondFields, component.state.options);

		jest.runOnlyPendingTimers();

		expect(component.refreshAll).toHaveBeenCalledWith(secondFields, true);
	});

	it('syncs right-side input fields without auto recalculating before the first plot', ()=>{
		const firstFields = buildFields('chart-a', 'A', '2006-10-04 09:58:00', '119e24', '30n54');
		const secondFields = buildFields('chart-b', 'B', '1988-04-20 12:20:00', '118e27', '31n38');
		const component = mountLike(new SanShiUnitedMain({
			fields: firstFields,
			chartObj: buildChart('chart-a'),
			hook: {},
		}));
		component.prefetchNongliForFields = jest.fn();
		component.prefetchJieqiSeedForFields = jest.fn();
		component.refreshAll = jest.fn();

		component.handleExternalFieldsSync(secondFields, buildChart('chart-b'));
		jest.runOnlyPendingTimers();

		expect(component.state.localFields).toBe(secondFields);
		expect(component.state.plottedFields).toBe(null);
		expect(component.refreshAll).not.toHaveBeenCalled();
	});

	it('uses only the Ken qimen backend for Sanshi qimen stems', async ()=>{
		const fields = buildFields('qimen-sample', 'Qimen Sample', '1998-02-20 20:48:00', '119e19', '26n04');
		const component = mountLike(new SanShiUnitedMain({
			fields,
			chartObj: buildChart('qimen-sample'),
			hook: {},
		}));
		const nongli = {
			yearJieqi: '戊寅',
			year: '戊寅',
			monthGanZi: '甲寅',
			dayGanZi: '戊戌',
			time: '壬戌',
			jieqi: '雨水',
			jiedelta: '雨水后第1天',
			birth: '1998-02-20 20:48:00',
			month: '正月',
			day: '廿四',
			leap: false,
		};
		global.fetch = jest.fn().mockResolvedValue({
			text: jest.fn().mockResolvedValue(JSON.stringify({
				ResultCode: 0,
				Result: {
					source: 'kinqimen',
					engine: 'kinqimen',
					mode: 'hour',
					modeLabel: '时家奇门',
					selected: {
						'排盤方式': '拆補',
						'干支': '戊寅年甲寅月戊戌日壬戌时',
						'排局': '阳遁九局上元',
						'節氣': '雨水',
						'旬首': '甲寅',
						'天盤': { 震: '癸', 巽: '辛', 離: '丙', 坤: '乙', 兌: '壬', 乾: '丁', 坎: '庚', 艮: '己', 中: '戊' },
						'地盤': { 震: '丙', 巽: '乙', 離: '壬', 坤: '丁', 兌: '庚', 乾: '己', 坎: '癸', 艮: '辛', 中: '戊' },
						'門': { 震: '休', 巽: '生', 離: '傷', 坤: '杜', 兌: '景', 乾: '死', 坎: '驚', 艮: '開' },
						'星': { 震: '蓬', 巽: '任', 離: '沖', 坤: '輔', 兌: '英', 乾: '禽', 坎: '柱', 艮: '心' },
						'神': { 震: '符', 巽: '蛇', 離: '陰', 坤: '合', 兌: '虎', 乾: '玄', 坎: '地', 艮: '天' },
						'值符值使': {
							'值符星宮': ['禽', '坤'],
							'值使門宮': ['杜', '坤'],
						},
					},
				},
			})),
		});
		const pan = await component.getKinqimenDunJia(fields, nongli, {
			paiPanType: 3,
			qijuMethod: 'chaibu',
			zhiShiType: 0,
			yueJiaQiJuType: 1,
			kongMode: 'time',
			yimaMode: 'time',
			timeAlg: 1,
			shiftPalace: 0,
			fengJu: false,
			after23NewDay: 1,
		}, 1998, true);
		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(global.fetch.mock.calls[0][0]).toContain('/qimen/pan');
		expect(global.fetch.mock.calls[0][0]).not.toContain('/taiyi/');
		expect(global.fetch.mock.calls[0][0]).not.toContain('/jinkou/');
		expect(pan.source).toEqual('kinqimen');
		expect(pan.options.qimenEngineLabel).toEqual('');
		expect(pan.juText).toEqual('阳遁九局上元');
		expect(pan.tianGan).toMatchObject({
			1: '辛',
			2: '丙',
			3: '乙',
			4: '癸',
			6: '壬',
			7: '己',
			8: '庚',
			9: '丁',
		});
	});

	it('uses Ken backends for Sanshi taiyi and qimen but not liureng', async ()=>{
		const fields = buildFields('sanshi-backend', 'Sanshi Backend', '2026-05-24 15:30:00', '119e19', '26n04');
		const component = mountLike(new SanShiUnitedMain({
			fields,
			chartObj: buildChart('sanshi-backend'),
			hook: {},
		}));
		const nongli = {
			yearJieqi: '丙午',
			year: '丙午',
			monthGanZi: '癸巳',
			dayGanZi: '戊戌',
			time: '庚申',
			jieqi: '小满',
			jiedelta: '立夏后第19天',
			birth: '2026-05-24 15:29:00',
			month: '四月',
			day: '初八',
			leap: false,
		};
		global.fetch = jest.fn((url)=>{
			if(`${url}`.indexOf('/qimen/pan') >= 0){
				return Promise.resolve({
					text: jest.fn().mockResolvedValue(JSON.stringify({
						ResultCode: 0,
						Result: {
							source: 'kinqimen',
							mode: 'hour',
							modeLabel: '时家奇门',
							selected: {
								'排局': '阳遁五局上元',
								'節氣': '小满',
								'旬首': '甲寅',
								'干支': '丙午年癸巳月戊戌日庚申时',
								'天盤': { 震: '癸', 巽: '辛', 離: '丙', 坤: '乙', 兌: '壬', 乾: '丁', 坎: '庚', 艮: '己', 中: '戊' },
								'地盤': { 震: '丙', 巽: '乙', 離: '壬', 坤: '丁', 兌: '庚', 乾: '己', 坎: '癸', 艮: '辛', 中: '戊' },
								'門': { 震: '休', 巽: '生', 離: '傷', 坤: '杜', 兌: '景', 乾: '死', 坎: '驚', 艮: '開' },
								'星': { 震: '蓬', 巽: '任', 離: '沖', 坤: '輔', 兌: '英', 乾: '禽', 坎: '柱', 艮: '心' },
								'神': { 震: '符', 巽: '蛇', 離: '陰', 坤: '合', 兌: '虎', 乾: '玄', 坎: '地', 艮: '天' },
								'值符值使': {
									'值符星宮': ['禽', '坤'],
									'值使門宮': ['杜', '坤'],
								},
							},
						},
					})),
				});
			}
			if(`${url}`.indexOf('/taiyi/pan') >= 0){
				return Promise.resolve({
					text: jest.fn().mockResolvedValue(JSON.stringify({
						ResultCode: 0,
						Result: {
							source: 'kintaiyi',
							dateStr: '2026-05-24',
							timeStr: '15:30:00',
							style: 3,
							tn: 0,
							kook: { num: 5, text: '阳遁五局' },
							taiyiNum: 5,
							taiyiPalace: '中',
							ganzhi: { year: '丙午', month: '癸巳', day: '戊戌', time: '庚申' },
							palace16: [],
							options: { styleLabel: '太乙局', accumLabel: '统宗宝鉴' },
						},
					})),
				});
			}
			return Promise.reject(new Error(`unexpected fetch ${url}`));
		});
		const changed = await component.performRecalcByNongli(fields, nongli, null, '2026-05-24 15:29:00');
		expect(changed).toBe(true);
		const urls = global.fetch.mock.calls.map((call)=>`${call[0]}`);
		expect(urls.filter((url)=>url.indexOf('/qimen/pan') >= 0)).toHaveLength(1);
		expect(urls.filter((url)=>url.indexOf('/taiyi/pan') >= 0)).toHaveLength(1);
		expect(urls.some((url)=>url.indexOf('/liureng') >= 0 || url.indexOf('/reng') >= 0)).toBe(false);
		expect(component.state.dunjia.source).toBe('kinqimen');
		expect(component.state.taiyi.source).toBe('kintaiyi');
		expect(component.state.liureng).toBeTruthy();
	});
});

describe('SanShiUnitedMain · [Q-152/Q-153/Q-154] 六壬缓存键昼夜 / 快照课序 / 奇门本地口径路由', ()=>{
	function mockBackends(){
		global.fetch = jest.fn((url)=>{
			if(`${url}`.indexOf('/qimen/pan') >= 0){
				return Promise.resolve({
					text: jest.fn().mockResolvedValue(JSON.stringify({
						ResultCode: 0,
						Result: {
							source: 'kinqimen',
							mode: 'hour',
							modeLabel: '时家奇门',
							selected: {
								'排局': '阳遁五局上元',
								'節氣': '小满',
								'旬首': '甲寅',
								'干支': '丙午年癸巳月戊戌日庚申时',
								'天盤': { 震: '癸', 巽: '辛', 離: '丙', 坤: '乙', 兌: '壬', 乾: '丁', 坎: '庚', 艮: '己', 中: '戊' },
								'地盤': { 震: '丙', 巽: '乙', 離: '壬', 坤: '丁', 兌: '庚', 乾: '己', 坎: '癸', 艮: '辛', 中: '戊' },
								'門': { 震: '休', 巽: '生', 離: '傷', 坤: '杜', 兌: '景', 乾: '死', 坎: '驚', 艮: '開' },
								'星': { 震: '蓬', 巽: '任', 離: '沖', 坤: '輔', 兌: '英', 乾: '禽', 坎: '柱', 艮: '心' },
								'神': { 震: '符', 巽: '蛇', 離: '陰', 坤: '合', 兌: '虎', 乾: '玄', 坎: '地', 艮: '天' },
								'值符值使': { '值符星宮': ['禽', '坤'], '值使門宮': ['杜', '坤'] },
							},
						},
					})),
				});
			}
			if(`${url}`.indexOf('/taiyi/pan') >= 0){
				return Promise.resolve({
					text: jest.fn().mockResolvedValue(JSON.stringify({
						ResultCode: 0,
						Result: {
							source: 'kintaiyi', dateStr: '2026-05-24', timeStr: '15:30:00', style: 3, tn: 0,
							kook: { num: 5, text: '阳遁五局' }, taiyiNum: 5, taiyiPalace: '中',
							ganzhi: { year: '丙午', month: '癸巳', day: '戊戌', time: '庚申' }, palace16: [],
							options: { styleLabel: '太乙局', accumLabel: '统宗宝鉴' },
						},
					})),
				});
			}
			return Promise.reject(new Error(`unexpected fetch ${url}`));
		});
	}
	const NONGLI = {
		yearJieqi: '丙午', year: '丙午', monthGanZi: '癸巳', dayGanZi: '戊戌', time: '庚申', jieqi: '小满',
		jiedelta: '立夏后第19天', birth: '2026-05-24 15:29:00', month: '四月', day: '初八', leap: false,
	};
	function chartWithDiurnal(isDiurnal){
		const c = buildChart('sanshi-diurnal');
		c.chart.isDiurnal = isDiurnal;
		return c;
	}

	it('🔴 [Q-152] 六壬层缓存键含昼夜:同日同时辰跨日出/日没(chartObj.isDiurnal 翻转)不再命中旧包', async ()=>{
		const fields = buildFields('sanshi-diurnal', 'Diurnal', '2026-05-24 15:30:00', '119e19', '26n04');
		const component = mountLike(new SanShiUnitedMain({ fields, chartObj: chartWithDiurnal(true), hook: {} }));
		mockBackends();
		expect(await component.performRecalcByNongli(fields, NONGLI, null, '2026-05-24 15:29:00')).toBe(true);
		const keys1 = Object.keys(component.lrBundleCache);
		expect(keys1).toHaveLength(1);
		expect(keys1[0].split('|')[4]).toBe('true');
		component.props = { ...component.props, chartObj: chartWithDiurnal(false) };
		expect(await component.performRecalcByNongli(fields, NONGLI, null, '2026-05-24 15:29:00')).toBe(true);
		const keys2 = Object.keys(component.lrBundleCache);
		expect(keys2).toHaveLength(2);
		expect(keys2.map((k)=>k.split('|')[4]).sort()).toEqual(['false', 'true']);
		// 除昼夜段外其余键段逐段相同(只多了这一维,不改任何既有维度)
		const a = keys2[0].split('|'); const b = keys2[1].split('|');
		expect(a.length).toBe(b.length);
		a.forEach((seg, i)=>{ if(i !== 4){ expect(seg).toBe(b[i]); } });
	});

	it('🔴 [Q-153] 实时快照[大六壬]课序:一课=raw[0](日干上神)…四课=raw[3],与盘面/独立六壬页同序', ()=>{
		const raw = [['天空', '丑', '甲'], ['贵人', '未', '丑'], ['玄武', '戌', '亥'], ['太阴', '巳', '戌']];
		const fields = buildFields('sanshi-snap', 'Snap', '2026-05-24 15:30:00', '119e19', '26n04');
		const dunjia = calcDunJia(fields, NONGLI, { ...QIMEN_OPTIONS, qijuMethod: 'chaibu', timeAlg: 1 }, { year: 2026 });
		const text = buildSanShiUnitedSnapshotText({
			fields,
			options: {},
			nongli: NONGLI,
			dunjia,
			keData: { raw },
			sanChuan: { cuang: ['子', '丑', '寅'], tianJiang: ['贵人', '螣蛇', '朱雀'] },
			lrLayout: { yue: '巳', upZi: [], downZi: [], houseTianJiang: [] },
		});
		expect(text).toContain('一课：甲丑天空');
		expect(text).toContain('二课：丑未贵人');
		expect(text).toContain('三课：亥戌玄武');
		expect(text).toContain('四课：戌巳太阴');
		expect(text).not.toContain('一课：戌巳太阴');
		expect(text.indexOf('一课：')).toBeLessThan(text.indexOf('四课：'));
	});

	it('🔴 [Q-154] 时家转盘 + 七组本地口径任一非缺省 → 不再取后端(与飞盘同旁路),本地盘按所选生效;全缺省仍走后端', async ()=>{
		const fields = buildFields('sanshi-route', 'Route', '2026-05-24 15:30:00', '119e19', '26n04');
		const component = mountLike(new SanShiUnitedMain({ fields, chartObj: buildChart('sanshi-route'), hook: {} }));
		mockBackends();
		const base = { paiPanType: 3, qijuMethod: 'chaibu', school: '转盘', zhiShiType: 0, yueJiaQiJuType: 1, kongMode: 'time', yimaMode: 'time', timeAlg: 1, shiftPalace: 0, fengJu: false, after23NewDay: 1 };
		const remote = await component.getKinqimenDunJia(fields, NONGLI, base, 2026, true);
		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(remote.source).toBe('kinqimen');
		global.fetch.mockClear();
		const local = await component.getKinqimenDunJia(fields, NONGLI, { ...base, godsPreset: 'gouchen_zhuque' }, 2026, true);
		expect(global.fetch).not.toHaveBeenCalled();
		expect(local.source).not.toBe('kinqimen');
		const gods = (local.cells || []).filter((c)=>!c.isCenter).map((c)=>c.god || c.shen || '').join('');
		expect(gods).toMatch(/勾|雀/);
		expect(gods).not.toMatch(/虎|玄/);
	});
});
