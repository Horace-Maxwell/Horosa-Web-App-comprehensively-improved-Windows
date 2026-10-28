// 派生表 / 派生数据只与它出自的那张命盘配对(行为):换命主以后新结果在途或取失败,页面不许再显示上一位命主的表;
// 同一位命主只改设置时仍是「旧表留存 + 更新中」。
global.React = require('react');

jest.mock('../../../utils/request', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../services/astro', () => ({ __esModule: true, fetchChart: jest.fn(() => Promise.resolve(null)) }));
jest.mock('../../../services/astroPd3d', () => ({ __esModule: true, fetchPd3D: jest.fn(), fetchPdPoles: jest.fn() }));
jest.mock('../../../utils/derivedAstroSnapshot', () => ({ __esModule: true, saveDerivedAstroSnapshot: jest.fn() }));
jest.mock('../../../utils/moduleAiSnapshot', () => ({ __esModule: true, saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn() }));

const request = require('../../../utils/request').default;
const { fetchPd3D, fetchPdPoles } = require('../../../services/astroPd3d');
const Constants = require('../../../utils/constants');

const flush = ()=>new Promise((r)=>setTimeout(r, 0));
function chartOf(birth, lat, lon, extra){
	return { params: { birth, zone: '+08:00', lat, lon, hsys: 1, zodiacal: 0, ...(extra || {}) }, chart: { objects: [], houses: [], isDiurnal: true } };
}
const A = chartOf('1990-03-15 08:30:00', '39n54', '116e23');
const A2 = chartOf('1990-03-15 08:30:00', '39n54', '116e23', { hsys: 0, zodiacal: 1 });   // 同一位命主,只改了设置
const B = chartOf('1975-11-02 21:10:00', '31n14', '121e28');

// 走真构造函数拿初始 state,只把 setState 换成同步合并
function instanceOf(Cls, props){
	const inst = new Cls(props);
	inst._mounted = true;
	inst.unmounted = false;
	inst.setState = (u, cb)=>{
		const patch = typeof u === 'function' ? u(inst.state) : u;
		inst.state = { ...inst.state, ...patch };
		if(cb){ cb(); }
	};
	return inst;
}

// [页面, 取数方法, 读法]
const LOAD_PAGES = [
	['AstroReturnTimeline', 'shownResult'], ['AstroDistributions', 'shownResult'], ['AstroEphemeris', 'shownResult'],
	['AstroAgePoint', 'shownResult'], ['AstroAnalysisLab', 'shownResult'], ['AstroJaynesProgressions', 'shownResult'],
	['AstroProgressions', 'shownResult'], ['AstroVedicProgressions', 'shownResult'], ['AstroExtraReturns', 'shownData'],
	['AstroPrenatalSyzygy', 'shownSyzygy'],
	['../auxchart/AstroHarmonicLab', 'shownResult'], ['../auxchart/AstroRelocationLab', 'shownResult'], ['../auxchart/AstroDraconicLab', 'shownResult'],
];

describe('派生表按命主来源键配对', ()=>{
	beforeEach(()=>{ request.mockReset(); });

	LOAD_PAGES.forEach(([name, reader])=>{
		test(`${name}:换人后取失败不显示上一位命主的结果;同一位命主改设置仍留旧结果`, async ()=>{
			const Cls = require(`../${name}`).default;
			const inst = instanceOf(Cls, { value: A, fields: null, height: 600 });
			const payload = { type: 'new', datetime: '1990-03-01 10:00:00', rows: [{ tag: 'A' }], returns: [], items: [] };
			request.mockImplementation(()=>Promise.resolve({ [Constants.ResultKey]: payload }));
			await inst.load();
			await flush();
			const got = inst[reader]();
			expect([name, !!got]).toEqual([name, true]);

			inst.props = { ...inst.props, value: A2 };
			expect([name, inst[reader]()]).toEqual([name, got]);

			inst.props = { ...inst.props, value: B };
			inst.state = { ...inst.state, loading: false, requestKey: '' };
			request.mockImplementation(()=>Promise.reject(new Error('offline')));
			await inst.load();
			await flush();
			expect([name, inst[reader]()]).toEqual([name, null]);
		});
	});

	test('黄道星释右栏期表:换人后取失败给空表;同一位命主改设置仍留旧表', async ()=>{
		const AstroZR = require('../AstroZR').default;
		const inst = instanceOf(AstroZR, { value: A });
		inst.scheduleDeepFetch = ()=>{};
		const p = (c)=>{ const [date, time] = c.params.birth.split(' '); return { date, time, zone: c.params.zone, lon: c.params.lon, lat: c.params.lat }; };
		const zr = [{ sign: 'Aries', level: 1 }];
		request.mockImplementationOnce(()=>Promise.resolve({ [Constants.ResultKey]: { zr } }));
		await inst.requestDirection(p(A), true);
		expect(inst.shownList()).toBe(zr);
		inst.props = { value: A2 };
		expect(inst.shownList()).toBe(zr);
		inst.props = { value: B };
		request.mockImplementationOnce(()=>Promise.reject(new Error('offline')));
		await inst.requestDirection(p(B), true);
		expect(inst.shownList()).toEqual([]);
	});

	test('主限法极点列 / 透镜坐标:换盘或改投影后不再用旧的那份', async ()=>{
		const AstroPrimaryDirection = require('../AstroPrimaryDirection').default;
		const inst = Object.create(AstroPrimaryDirection.prototype);
		inst.props = { value: A };
		inst.state = {};
		inst.setState = (u)=>{ inst.state = { ...inst.state, ...(typeof u === 'function' ? u(inst.state) : u) }; };
		inst.getAppliedPdState = ()=>({ pdProjection: 'ptolemy', pdFrame: 'alcabitius', pdtype: 0 });
		fetchPdPoles.mockImplementationOnce(()=>Promise.resolve({ poles: { Sun: 12.3 } }));
		inst.requestPdPoles();
		await flush();
		expect(inst.shownPdPolesData()).toEqual({ Sun: 12.3 });
		inst.props = { value: B };
		expect(inst.shownPdPolesData()).toBe(null);   // 此前:只要有过一份就不再取,一直显示上一张盘的极点
		inst.props = { value: A };
		inst.getAppliedPdState = ()=>({ pdProjection: 'placidus', pdFrame: 'alcabitius', pdtype: 0 });
		expect(inst.shownPdPolesData()).toBe(null);

		inst.props = { value: A, pdType: 0 };
		fetchPd3D.mockImplementationOnce(()=>Promise.resolve({ points: { Sun: { lon: 1, lat: 0, ra: 1, decl: 0 } } }));
		inst.ensureLensPoints();
		await flush();
		expect(inst.shownLensPoints()).toEqual({ Sun: { lon: 1, lat: 0, ra: 1, decl: 0 } });
		inst.props = { value: B, pdType: 0 };
		expect(inst.shownLensPoints()).toBe(null);
	});

	test('主限天球表行:换人后取失败不显示上一位命主的表行', async ()=>{
		const AstroPDSphere = require('../../astro3d/AstroPDSphere').default;
		const inst = Object.create(AstroPDSphere.prototype);
		inst.props = { value: A, buildRequest: (c)=>({ birth: c.params.birth }) };
		inst.state = { axisYears: null, rows: [] };
		inst.reqSeq = 0;
		inst.unmounted = false;
		inst.engine = { setData(){} };
		inst.setState = (u)=>{ inst.state = { ...inst.state, ...(typeof u === 'function' ? u(inst.state) : u) }; };
		const rows = [{ prom: 'Sun', sig: 'Asc' }];
		fetchPd3D.mockImplementationOnce(()=>Promise.resolve({ frame: {}, rows }));
		inst.fetchData(true);
		await flush();
		expect(inst.shownRows()).toBe(rows);
		inst.props = { ...inst.props, value: B };
		fetchPd3D.mockImplementationOnce(()=>Promise.resolve({ err: 'x' }));
		inst.fetchData(true);
		await flush();
		expect(inst.shownRows()).toEqual([]);
	});

	test('七政流年盘 / 七政四余盘:只用出自当前命主的那份', ()=>{
		const GuoLao = require('../../guolao/GuoLaoChartMain').default;
		const { natalSourceKey } = require('../../../utils/derivedChartSource');
		const inst = Object.create(GuoLao.prototype);
		const pA = { date: '1990/03/15', time: '08:30:00', zone: '+08:00', lon: '116e23', lat: '39n54' };
		const pB = { ...pA, date: '1975/11/02' };
		let cur = pA;
		inst.genParams = ()=>cur;
		inst.props = { fields: { tag: 1 } };
		const transit = { chart: {} };
		const pan = { qizheng: {} };
		inst.state = { moiraTransitChartObj: transit, moiraTransitChartObjSig: natalSourceKey(pA), qizhengKinPan: pan, qizhengKinPanSig: natalSourceKey(pA) };
		expect(inst.shownMoiraTransitChartObj()).toBe(transit);
		expect(inst.shownQizhengKinPan()).toBe(pan);
		cur = { ...pA, guolaoBodyMode: 'youjin' };   // 同一位命主改设置
		inst.props = { fields: { tag: 2 } };
		expect(inst.shownMoiraTransitChartObj()).toBe(transit);
		cur = pB;   // 换了命主
		inst.props = { fields: { tag: 3 } };
		expect(inst.shownMoiraTransitChartObj()).toBe(null);
		expect(inst.shownQizhengKinPan()).toBe(null);
	});

	test('印占回退盘:同一位命主才拿上次成功盘顶着,换了人不顶', ()=>{
		const { resolveJyotishChartObj } = require('../indiaMain/jyotishData');
		const last = { jyotish: { tag: 'A' } };
		const fields = require('../../../models/astro').default.state.fields;
		expect(!!require('../indiaMain/jyotishData').buildDashaFieldsKey(fields)).toBe(true);
		expect(resolveJyotishChartObj({ lastChartObj: last, lastChartObjSig: 'k1', activeNatalSig: 'k1' }, fields)).toBe(last);
		expect(resolveJyotishChartObj({ lastChartObj: last, lastChartObjSig: 'k1', activeNatalSig: 'k2' }, fields)).toBe(null);
	});
});
