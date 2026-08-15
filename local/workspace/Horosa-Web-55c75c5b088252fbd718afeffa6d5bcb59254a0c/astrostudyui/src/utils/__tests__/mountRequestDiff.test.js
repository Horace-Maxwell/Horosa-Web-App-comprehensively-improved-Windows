// 🔴 [V6-W3 闸2] 挂载请求体差分真跑闸 —— 「挂载判据必须照前端原样请求体跑」铁律的机械化
// (pdYearsMount 范式泛化到 astrochart 全齿轮)。地占战役血训:单测喂后端想要的形状、前端发手上
// 有的形状 → 单测全绿功能全死;唯一可信判据 = mock 掉 fetchChart,拨齿轮后断言**真实请求体**出现
// 对应差分。星盘实锤(整宫制被 Alcabitius 顶掉)若有此闸,首跑即红。
//
// 判据:对 astrochart schema 每个齿轮,拨「非现状值」→ getAnalysisTechniqueContextWithOptions
// 触发重算 → 尾条 /chart 请求体该键 === 拨的值。不进请求体的键(显示层/快照层消费)必须在
// NOT_IN_BODY 豁免表带理由,并退而断言拨值确实触发了重算请求(拨了没反应=死开关,照红)。
const mockFetchChartCalls = [];
jest.mock('../../services/astro', () => ({
	fetchChart: jest.fn(async (values) => {
		mockFetchChartCalls.push(values);
		return {
			Result: {
				chart: { objects: [], stars: [] },
				lots: [],
				params: {},
				predictives: { primaryDirection: [] },
			},
		};
	}),
}));
jest.mock('../../components/direction/AstroDirectMain', () => ({
	buildPrimaryDirectSnapshotText: jest.fn(() => '主限法快照(占位)'),
	buildFirdariaSnapshotText: jest.fn(() => ''),
}));
jest.mock('../localcharts', () => ({
	listLocalCharts: jest.fn(() => []),
	__esModule: true,
}));
jest.mock('../localcases', () => ({
	listLocalCases: jest.fn(() => []),
	getCaseTypeLabel: jest.fn((t) => t),
	getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })),
	__esModule: true,
}));
jest.mock('../astroAiSnapshot', () => ({
	buildAstroSnapshotContent: jest.fn(() => 'snapshot'),
	loadAstroAISnapshot: jest.fn(() => null),
}));
jest.mock('../moduleAiSnapshot', () => ({
	loadModuleAISnapshot: jest.fn(() => null),
	saveModuleAISnapshot: jest.fn(),
}));
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: {} })) }));
jest.mock('../aiAnalysisStore', () => ({
	AI_ANALYSIS_STORES: { contextCache: 'contextCache' },
	getStoreRecord: jest.fn(async () => null),
	putStoreRecord: jest.fn(async (s, r) => r),
}));

import { getAnalysisTechniqueContextWithOptions } from '../aiAnalysisContext';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';

const SOURCE = {
	id: 'chart-diff',
	sourceType: 'chart',
	record: {
		cid: 'chart-diff',
		name: '差分测试',
		birth: '1990-05-18 10:00:00',
		zone: '+08:00',
		lon: '118e27',
		lat: '31n38',
	},
};

// schema field 名 → /chart 请求体键名(经组装层名映射的登记;两侧同名则不登)。
const BODY_KEY_MAP = {
	guolaoTrueSolarTime: 'trueSolarTime',
	// classicalChartGlobals:124 名映射:前端 fixedStarOrb* → 后端 getStars 消费名 starOrb*。
	fixedStarOrb: 'starOrb',
	fixedStarOrbMode: 'starOrbMode',
};

// 伴发键:该齿轮仅在另一键同为非默认时才下发(helper 有意设计,单独发只会白扰缓存键)。
// 拨该键时并拨 extra,再断言请求体差分 —— 契约照 classicalChartGlobals:125。
const COMBO_KEYS = {
	vocIncludeOuter: { vocMode: 'by_orb' },
};

// 不进 /chart 请求体的齿轮(显示/快照层消费)——逐键带理由,且仍断言「拨值触发重算」。
const NOT_IN_BODY = {
	egypt_decanRuler: '埃及历快照段消费(egyptSchoolFromFields),不参与后端排盘',
	egypt_decanAnchor: '同上',
	egypt_decanNaming: '同上',
	egypt_starClock: '同上',
	egypt_calendarAnchor: '同上',
	egypt_petosirisMod: '同上',
	egypt_godEdition: '同上',
	useStoredOrbs: '本地开关:控制 orbs 是否从存档播入,自身不下发(orbs 键才进请求体)',
};

// 「非现状值」选择器:现状 = record 无值时的 schema default;从 options 挑第一个 ≠ 现状的档。
function pickNonBaseline(field){
	if(Array.isArray(field.options) && field.options.length){
		const alt = field.options.find((o)=>{
			const v = (o && typeof o === 'object') ? o.value : o;
			return `${v}` !== `${field.default}`;
		});
		if(alt !== undefined){
			return (alt && typeof alt === 'object') ? alt.value : alt;
		}
	}
	if(typeof field.default === 'number'){
		return field.default + 1;
	}
	if(field.default === true || field.default === false){
		return !field.default;
	}
	return `${field.default || ''}_alt`;
}

function lastChartFetch(){
	return mockFetchChartCalls.length ? mockFetchChartCalls[mockFetchChartCalls.length - 1] : null;
}

describe('[V6-W3 闸2] astrochart 全齿轮拨非现状值 → /chart 请求体逐键差分', ()=>{
	const schema = getTechniqueSettingsSchema('astrochart');
	const fields = (schema && schema.fields) || [];

	beforeEach(()=>{
		mockFetchChartCalls.length = 0;
	});

	it('schema 在位且齿轮非空(闸自体健康)', ()=>{
		expect(fields.length).toBeGreaterThan(20);
	});

	fields.forEach((field)=>{
		const name = field.name;
		const value = pickNonBaseline(field);
		const bodyKey = BODY_KEY_MAP[name] || name;
		const exempt = NOT_IN_BODY[name];

		it(`🔴 拨 ${name}=${JSON.stringify(value)} → ${exempt ? '触发重算(豁免:不进请求体)' : `请求体 ${bodyKey} 出现差分`}`, async ()=>{
			const ctx = await getAnalysisTechniqueContextWithOptions(SOURCE, 'astrochart', { [name]: value, ...(COMBO_KEYS[name] || {}) });
			expect(ctx).toBeTruthy();
			const req = lastChartFetch();
			// 拨非现状值必须触发重算请求 —— 「拨了没反应」= prune 误剪/merge 蒸发,即死开关。
			expect(req).toBeTruthy();
			if(!exempt){
				// 字节级差分:请求体该键 === 拨的值(条件透传键拨非默认后必然出现)。
				expect(`${req[bodyKey]}`).toBe(`${value}`);
			}
		});
	});

	it('🔴 判别例(根因A复辟即红):盘存 hsys=0(整宫制) 拨 1(=schema默认 Alcabitius) → 覆盖生效且请求体 hsys=1', async ()=>{
		// 复查轮定谳的**唯一有判别力向量**:拨的值恰等 schema 默认(1)而盘现状非默认(0)。
		// 现状锚版:baseline.hsys=0,拨 1≠0=真覆盖 → mountOverride 重算,请求体 hsys=1;
		// 退化版(prune 丢第三参/体内 baseline 分支被删):def=schema 默认=1,拨 1≡1 被剪空 →
		// 覆盖蒸发走默认路径 —— 本例双断言(覆盖态+请求体)当场红。此前「存1拨0」向量在两版
		// 都发 hsys=0,零判别力(复查轮实锤后翻转)。
		const src = { ...SOURCE, record: { ...SOURCE.record, hsys: 0 } };
		const ctx = await getAnalysisTechniqueContextWithOptions(src, 'astrochart', { hsys: 1 });
		expect(ctx).toBeTruthy();
		expect(ctx.meta && ctx.meta.mountOverride).toBe(true);
		const req = lastChartFetch();
		expect(req).toBeTruthy();
		expect(`${req.hsys}`).toBe('1');
	});

	it('🔴 用户实锤方向:盘存 hsys=1(Alcabitius) 拨 0(整宫制) → 请求体 hsys=0', async ()=>{
		const src = { ...SOURCE, record: { ...SOURCE.record, hsys: 1 } };
		const ctx = await getAnalysisTechniqueContextWithOptions(src, 'astrochart', { hsys: 0 });
		expect(ctx).toBeTruthy();
		expect(ctx.meta && ctx.meta.mountOverride).toBe(true);
		const req = lastChartFetch();
		expect(req).toBeTruthy();
		expect(`${req.hsys}`).toBe('0');
	});

	it('对照:盘存 hsys=1 拨回盘现状 1 → 不判为覆盖(语义断言,非请求计数)', async ()=>{
		// 覆盖≡盘现状被 prune 剪空 → 走默认 buildTechniqueContext(默认路径在无缓存时也可能
		// 发补生成请求,数请求次数无判别力)——直接断言返回对象不带 mountOverride 覆盖标记。
		const src = { ...SOURCE, record: { ...SOURCE.record, hsys: 1 } };
		const ctx = await getAnalysisTechniqueContextWithOptions(src, 'astrochart', { hsys: 1 });
		expect(!!(ctx && ctx.meta && ctx.meta.mountOverride)).toBe(false);
	});
});
