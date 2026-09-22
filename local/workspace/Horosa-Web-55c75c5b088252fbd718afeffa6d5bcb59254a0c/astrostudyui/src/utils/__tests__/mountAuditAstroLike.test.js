// [挂载自检 F-26·P0] 「十三分盘 / 占星地图」聚合键=辅盘页派生盘模块快照(只认本命主),不再把 12 宫本命冒充派生盘。
// 判别向量:分派改回 `key === 'astrochart' || key === 'astrochart_like'` 走 buildChartContext 即第 1/2 例红。
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: {} })) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({ listLocalCases: jest.fn(() => []), getCaseTypeLabel: jest.fn((t) => t), getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })), CASE_TYPE_OPTIONS: [], __esModule: true }));
const store = { map: {} };
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn((name) => store.map[name] || null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn() }));
jest.mock('../astroAiSnapshot', () => ({ buildAstroSnapshotContent: jest.fn(() => ''), loadAstroAISnapshot: jest.fn(() => null) }));
jest.mock('../aiAnalysisStore', () => ({ AI_ANALYSIS_STORES: { contextCache: 'contextCache' }, getStoreRecord: jest.fn(async () => null), putStoreRecord: jest.fn(async (s, r) => r) }));
import { getAnalysisTechniqueContexts, ASTRO_LIKE_DERIVED_MODULES } from '../aiAnalysisContext';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';

const SRC = { id: 'chart-a', sourceType: 'chart', record: { cid: 'a', name: 'A', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38' } };
const metaA = { date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38' };
const metaB = { date: '1985-01-02', time: '03:04:05', zone: '+08:00', lon: '116e23', lat: '39n54' };

beforeEach(()=>{ store.map = {}; });

it('🔴 有本命主的十三分盘/龙盘快照 → 正文=派生盘(带盘种提示行),不是本命盘;不属本命主的调波盘不混入', async ()=>{
	store.map.hellenastro = { module: 'hellenastro', content: '[起盘信息]\n十三分盘 甲', meta: metaA };
	store.map.draconic = { module: 'draconic', content: '[龙盘]\n交点基准 乙', meta: metaA };
	store.map.harmonic = { module: 'harmonic', content: '[调波盘]\n他人的', meta: metaB };
	const [ctx] = await getAnalysisTechniqueContexts(SRC, ['astrochart_like']);
	expect(ctx.status).toBe('ready');
	expect(ctx.content).toContain('（以下为十三分盘）');
	expect(ctx.content).toContain('十三分盘 甲');
	expect(ctx.content).toContain('（以下为龙盘）');
	expect(ctx.content).not.toContain('他人的');
	expect(ctx.meta.derivedCharts).toEqual(['hellenastro', 'draconic']);
});

it('🔴 无任何本命主派生盘快照 → missing + 引导提示(不再回落 12 宫本命)', async ()=>{
	const [none] = await getAnalysisTechniqueContexts(SRC, ['astrochart_like']);
	expect(none.status).toBe('missing');
	expect(none.content).toBe('');
	expect(none.meta.hint).toContain('辅盘页');
	store.map.relocation = { module: 'relocation', content: '[重置盘]\n别人的', meta: metaB };
	const [stale] = await getAnalysisTechniqueContexts(SRC, ['astrochart_like']);
	expect(stale.status).toBe('missing');
	expect(stale.meta.hint).toContain('不属本命主');
});

it('聚合键 schema 改只读(57 占星齿轮对它是本命请求,已撤);派生盘模块清单固定', ()=>{
	expect(getTechniqueSettingsSchema('astrochart_like').kind).toBe('sectionsOnly');
	expect(ASTRO_LIKE_DERIVED_MODULES).toEqual(['hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation']);
});

// [挂载自检 F-27] 派生盘五键独立技法键:各读本键模块快照(只认本命主),聚合键照旧并挂全部。
describe('[F-27] 派生盘五键独立技法键', ()=>{
	const { ANALYSIS_CHART_TECHNIQUES, ANALYSIS_TECHNIQUE_LABELS } = require('../aiAnalysisContext');
	it('🔴 五键登记为命盘技法(有标签、schema=sectionsOnly)', ()=>{
		['hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation'].forEach((k)=>{
			expect(ANALYSIS_CHART_TECHNIQUES).toContain(k);
			expect(ANALYSIS_TECHNIQUE_LABELS[k]).toBeTruthy();
			expect(getTechniqueSettingsSchema(k)).toMatchObject({ kind: 'sectionsOnly' });
		});
		expect(ANALYSIS_TECHNIQUE_LABELS.locastro).toBeUndefined();   // 无快照生产者,不设死键
	});
	it('🔴 单键只挂本键、只认本命主:龙盘 ready 且不含十三分盘;调波盘(他人)missing+提示;未出过盘 missing+引导', async ()=>{
		store.map.hellenastro = { module: 'hellenastro', content: '[起盘信息]\n十三分盘 甲', meta: metaA };
		store.map.draconic = { module: 'draconic', content: '[龙盘]\n交点基准 乙', meta: metaA };
		store.map.harmonic = { module: 'harmonic', content: '[调波盘]\n他人的', meta: metaB };
		const [dr, ha, re] = await getAnalysisTechniqueContexts(SRC, ['draconic', 'harmonic', 'relocation']);
		expect(dr.status).toBe('ready');
		expect(dr.content).toContain('交点基准 乙');
		expect(dr.content).not.toContain('十三分盘 甲');
		expect(dr.meta.derivedCharts).toEqual(['draconic']);
		expect(ha.status).toBe('missing');
		expect(ha.content).toBe('');
		expect(ha.meta.hint).toContain('不属本命主');
		expect(re.status).toBe('missing');
		expect(re.meta.hint).toContain('请先在辅盘页出重置盘');
	});
	it('聚合键零回归:仍并挂本命主全部派生盘;hellenastro 不再折叠进聚合键', async ()=>{
		store.map.hellenastro = { module: 'hellenastro', content: '[起盘信息]\n十三分盘 甲', meta: metaA };
		store.map.draconic = { module: 'draconic', content: '[龙盘]\n交点基准 乙', meta: metaA };
		const [agg, single] = await getAnalysisTechniqueContexts(SRC, ['astrochart_like', 'hellenastro']);
		expect(agg.meta.derivedCharts).toEqual(['hellenastro', 'draconic']);
		expect(single.key).toBe('hellenastro');
		expect(single.content).toContain('十三分盘 甲');
		expect(single.content).not.toContain('交点基准 乙');
	});
});
