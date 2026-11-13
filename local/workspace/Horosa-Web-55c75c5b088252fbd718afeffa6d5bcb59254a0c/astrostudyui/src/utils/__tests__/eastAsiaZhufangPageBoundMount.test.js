// 东亚 / 诸方:挂载齿轮缺省 = 页面保存值,AI 无头重算记录缺键时也按同一份补(fillPageBoundDefaults)。
// 此前只有齿轮读页面值、重算写死出厂值:诸方页把玛雅历关联常数改 584285 → 换一张没开过诸方页的盘挂「诸方杂术」,
// 齿轮显示 584285、快照写 584283;齿轮里选 584285 等于基线被剪掉,仍出 584283。东亚藏干表 / 合卦规则同病。
var mockBodies = [];
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async (url, opts) => { try{ mockBodies.push({ url: `${url}`.replace(/^https?:\/\/[^/]+/, ''), body: JSON.parse(opts.body) }); }catch(e){ /* 非 JSON 体 */ } return { Result: {} }; }) }));
jest.mock('../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: {
	chart: { objects: [{ id: 'Sun', lon: 57.3, house: 'House10' }, { id: 'Moon', lon: 201.2, house: 'House3' }], stars: [] },
	lots: [], params: { birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n38', lon: '118e27' }, predictives: {},
} })) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), clearModuleAISnapshot: jest.fn() }));
import { ZHUFANG_PAGE_SETTINGS } from '../zhufangArts';
import { EAST_ASIA_PAGE_SETTINGS } from '../eastAsiaSnapshot';
import { effectiveMountBaseline, pruneOptionsToNonDefault, fillPageBoundDefaults, getTechniqueSettingsSchema } from '../techniqueMountSettings';
import { regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';

const REC = { cid: 'ea', name: '东亚', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 };

beforeEach(()=>{ window.localStorage.clear(); mockBodies = []; });

describe('诸方:页面改值 → 无头快照同值', ()=>{
	test('没存过页面值时与出厂默认逐字相同', async ()=>{
		const text = await regenerateChartTechniqueSnapshot({ ...REC }, 'zhufang');
		expect(text).toContain('关联常数 584283');
		const body = mockBodies.find((b)=>b.url.indexOf('/astroextra/zhufang') >= 0).body;
		expect(body.hdTrueNode).toBe(1);
		expect(body.spiritQuadrant).toBe(1);
	});
	test('页面存 584285 / 平交点 / 象限 2 → 齿轮基线、补值、快照、请求体都跟着走', async ()=>{
		ZHUFANG_PAGE_SETTINGS.save({ mayanCorrelation: 584285, hdTrueNode: false, spiritQuadrant: 2 });
		const base = effectiveMountBaseline('zhufang', {});
		expect(base.mayanCorrelation).toBe(584285);
		expect(base.hdTrueNode).toBe('mean');
		expect(base.spiritQuadrant).toBe(2);
		expect(fillPageBoundDefaults('zhufang', {}).mayanCorrelation).toBe(584285);
		// 记录里已有的值优先
		expect(fillPageBoundDefaults('zhufang', { mayanCorrelation: 584286 }).mayanCorrelation).toBe(584286);
		const text = await regenerateChartTechniqueSnapshot({ ...REC }, 'zhufang');
		expect(text).toContain('关联常数 584285');
		const body = mockBodies.find((b)=>b.url.indexOf('/astroextra/zhufang') >= 0).body;
		expect(body.hdTrueNode).toBe(0);
		expect(body.spiritQuadrant).toBe(2);
	});
	test('齿轮选 584285(= 页面基线,被剪掉)仍出 584285;齿轮选出厂 584283 保留覆盖', async ()=>{
		ZHUFANG_PAGE_SETTINGS.save({ mayanCorrelation: 584285 });
		const base = effectiveMountBaseline('zhufang', {});
		const pruned = pruneOptionsToNonDefault('zhufang', { mayanCorrelation: 584285 }, base);
		expect(pruned).toEqual({});
		expect(await regenerateChartTechniqueSnapshot({ ...REC, ...pruned }, 'zhufang')).toContain('关联常数 584285');
		const keep = pruneOptionsToNonDefault('zhufang', { mayanCorrelation: 584283 }, base);
		expect(keep).toEqual({ mayanCorrelation: 584283 });
		expect(await regenerateChartTechniqueSnapshot({ ...REC, ...keep }, 'zhufang')).toContain('关联常数 584283');
	});
});

describe('东亚:页面改值 → 无头快照同值', ()=>{
	test('页面存「恒合上卦」→ 快照合卦规则跟着走;记录里已有值优先', async ()=>{
		expect(await regenerateChartTechniqueSnapshot({ ...REC }, 'dongya')).toContain('合卦规则:地平上合上卦、地平下合下卦');
		EAST_ASIA_PAGE_SETTINGS.save({ ichingMerge: 'upper', fenyeVersion: 'fajue' });
		expect(effectiveMountBaseline('dongya', {}).dongyaIchingMerge).toBe('upper');
		expect(fillPageBoundDefaults('dongya', {}).dongyaFenyeVersion).toBe('fajue');
		expect(await regenerateChartTechniqueSnapshot({ ...REC }, 'dongya')).toContain('合卦规则:恒合上卦');
		expect(await regenerateChartTechniqueSnapshot({ ...REC, dongyaIchingMerge: 'lower' }, 'dongya')).toContain('合卦规则:恒合下卦');
	});
	test('五个口径字段都带 pageStoreBound(缺省跟页面走的机械标记);东亚流年是挂载专用输入,页面不记住,不跟页面', ()=>{
		const PAGE_UNBOUND = ['dongyaFlowYear'];
		expect(getTechniqueSettingsSchema('dongya').fields.find((f)=>f.name === 'dongyaFlowYear')).toMatchObject({ type: 'number', default: '', blankFollowsBaseline: true });
		['zhufang', 'dongya'].forEach((key)=>{
			getTechniqueSettingsSchema(key).fields.filter((f)=>PAGE_UNBOUND.indexOf(f.name) < 0).forEach((f)=>{
				expect([key, f.name, !!f.pageStoreBound, typeof f.globalCurrent]).toEqual([key, f.name, true, 'function']);
			});
		});
	});
	test('其它技法原样返回(同一引用)', ()=>{
		const rec = { a: 1 };
		expect(fillPageBoundDefaults('bazi', rec)).toBe(rec);
	});
});
