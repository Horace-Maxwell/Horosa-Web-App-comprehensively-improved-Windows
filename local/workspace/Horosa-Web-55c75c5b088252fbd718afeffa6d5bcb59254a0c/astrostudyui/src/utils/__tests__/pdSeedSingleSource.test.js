// 主限法方法 / 时间钥匙:新盘种子是唯一来源 —— 全局设置(globalSetup)里的旧值一次性并入种子、之后 app 状态只跟随种子,
// 启动 / 登录不再拿它盖盘上的值;主限盘栏「计算」也记种子;AI 只读这两项(不能绕过「AI 改动不记新盘缺省」)。
jest.mock('../astroAiSnapshot', ()=>({ ...jest.requireActual('../astroAiSnapshot'), saveAstroAISnapshot: jest.fn() }));
const seeds = require('../newChartSeeds');
const { SUPPORTED_PD_METHODS, SUPPORTED_PD_TIME_KEYS, DEFAULT_PD_METHOD, DEFAULT_PD_TIME_KEY } = require('../primaryDirectionSync');
const altMethod = SUPPORTED_PD_METHODS.find((m)=>m !== DEFAULT_PD_METHOD);
const altKey = SUPPORTED_PD_TIME_KEYS.find((k)=>k !== DEFAULT_PD_TIME_KEY);

beforeEach(()=>{ window.localStorage.clear(); seeds.__resetNewChartSeedsForTest(); });

test('🔴 全局设置里的旧值并入种子一次;种子已有的不动', ()=>{
	window.localStorage.setItem('globalSetup', JSON.stringify({ pdMethod: altMethod, pdTimeKey: altKey }));
	expect(seeds.newChartSeedValue('pdMethod')).toBe(altMethod);
	expect(seeds.newChartSeedValue('pdTimeKey')).toBe(altKey);
	seeds.recordNewChartSeeds({ pdMethod: DEFAULT_PD_METHOD });
	window.localStorage.setItem('globalSetup', JSON.stringify({ pdMethod: altMethod }));
	expect(seeds.newChartSeedValue('pdMethod')).toBe(DEFAULT_PD_METHOD);   // 并入只一次
});

test('🔴 启动读全局设置:app 的两项跟随种子(不是全局设置里的旧值)', ()=>{
	seeds.recordNewChartSeeds({ pdMethod: altMethod });
	window.localStorage.setItem('globalSetup', JSON.stringify({ pdMethod: DEFAULT_PD_METHOD, pdTimeKey: altKey, chartStyle: 0 }));
	const app = require('../../models/app').default;
	const gen = app.effects.checkUser.call(app, { payload: {} }, { call: ()=>null, put: (a)=>a, select: ()=>({ astro: { fields: {} }, app: {} }) });
	const first = gen.next().value;
	expect(first.type).toBe('save');
	expect(first.payload.pdMethod).toBe(altMethod);
	expect(first.payload.pdTimeKey).toBe(seeds.newChartSeedValue('pdTimeKey'));
});

test('🔴 AI 只读主限法两项(读出新命盘缺省;写入被拒)', ()=>{
	seeds.recordNewChartSeeds({ pdMethod: altMethod });
	const facets = require('../aiTools/settingsFacets');
	expect(facets.APP_PREF_DERIVED_KEYS).toEqual(expect.arrayContaining(['pdMethod', 'pdTimeKey']));
	expect(facets.appPrefSpec().map((s)=>s.key)).not.toContain('pdMethod');
	const d = facets.describeFacet('app');
	const it = d.items.find((x)=>x.key === 'pdMethod');
	expect(it.settable).toBe(false);
	expect(it.current).toBe(altMethod);
	const v = facets.validateFacetValues('app', null, { pdMethod: DEFAULT_PD_METHOD });
	expect(v.ok).toBe(false);
});

test('🔴 主限盘栏「计算」记种子', async ()=>{
	const req = require('../request');
	const spy = jest.spyOn(req, 'default').mockImplementation(async ()=>({ Result: { pd: [] } }));
	try{
		require('../../models/astro');
		const { fieldsSchemaBaseline } = require('../recordFieldsRestore');
		const Chart = require('../../components/astro/AstroPrimaryDirectionChart').default;
		const dispatched = [];
		const inst = Object.create(Chart.prototype);
		const fields = fieldsSchemaBaseline();
		inst.props = { dispatch: (a)=>dispatched.push(a), fields, value: { chart: { objects: [] }, params: { birth: '1990-01-01 08:00:00', lat: '31n14', lon: '121e28', zone: '+08:00' } } };
		inst.state = {};
		inst.requestSeq = 0;
		inst.getSelectedPdMethod = ()=>altMethod;
		inst.getTablePdTimeKey = ()=>altKey;
		inst.buildChartRequestParams = ()=>({ pdtype: 0, showPdBounds: 1 });
		await inst.requestChartRefresh();
		expect(dispatched.some((a)=>a.type === 'app/save')).toBe(true);
		expect(seeds.newChartSeedValue('pdMethod')).toBe(altMethod);
		expect(seeds.newChartSeedValue('pdTimeKey')).toBe(altKey);
	}finally{ spy.mockRestore(); }
});
