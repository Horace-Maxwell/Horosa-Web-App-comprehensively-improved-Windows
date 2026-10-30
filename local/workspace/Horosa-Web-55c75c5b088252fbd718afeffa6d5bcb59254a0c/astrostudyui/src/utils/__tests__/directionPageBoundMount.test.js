// 星运族口径单源:AI 挂载齿轮的现状默认 = 星运页保存值,AI 重算缺键时回落同一份。
// 此前齿轮基线与重算都只认出厂默认 —— 页面把界推运发放点改成天顶,AI 分析 / 报告仍按上升算。
var mockBodies = [];
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async (url, opts) => { try{ mockBodies.push({ url: `${url}`.replace(/^https?:\/\/[^/]+/, ''), body: JSON.parse(opts.body) }); }catch(e){ /* 非 JSON 体 */ } return { Result: {} }; }) }));
jest.mock('../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: { chart: { objects: [], stars: [] }, lots: [], params: { birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n38', lon: '118e27' }, predictives: {} } })) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), clearModuleAISnapshot: jest.fn() }));
import { DIRECTION_PAGE_SETTINGS } from '../directionPageSettings';
import {
	DIRECTION_PAGE_BOUND_FIELDS, getTechniqueSettingsSchema, getTechniqueSettingsCurrentDefaults, effectiveMountBaseline,
	pruneOptionsToNonDefault, fillPageBoundDefaults, mountFieldOptions,
} from '../techniqueMountSettings';
import { regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';

const REC = { cid: 'dir', name: '星运', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 };
const fieldOf = (key, name)=>getTechniqueSettingsSchema(key).fields.find((f)=>f.name === name);

beforeEach(()=>{ window.localStorage.clear(); mockBodies = []; });

describe('星运族齿轮跟随星运页保存值', ()=>{
	test('映射表每一项:齿轮字段在、页面字段在、页面值域都是齿轮可选的档', ()=>{
		const pageDefaults = DIRECTION_PAGE_SETTINGS.load();
		Object.keys(DIRECTION_PAGE_BOUND_FIELDS).forEach((key)=>{
			Object.keys(DIRECTION_PAGE_BOUND_FIELDS[key]).forEach((name)=>{
				const f = fieldOf(key, name);
				const pageKey = DIRECTION_PAGE_BOUND_FIELDS[key][name];
				expect(f).toBeTruthy();
				expect(f.pageBoundKey).toBe(pageKey);
				expect(Object.prototype.hasOwnProperty.call(pageDefaults, pageKey)).toBe(true);
				// 未保存时 = 出厂默认(与改动前逐字相同)
				const cur = getTechniqueSettingsCurrentDefaults(key)[name];
				expect(cur).toEqual(f.type === 'switch' ? (pageDefaults[pageKey] ? 1 : 0) : pageDefaults[pageKey]);
				expect(cur).toEqual(f.default);
				if(Array.isArray(f.options) && f.type !== 'switch'){
					const vals = mountFieldOptions(f, {}, cur).map((o)=>`${o.value}`);
					expect(vals).toContain(`${cur}`);
				}
			});
		});
	});

	test('页面保存值 → 齿轮基线;记录里已有的值优先;等于页面值的覆盖被剪掉,出厂值的覆盖保留', ()=>{
		DIRECTION_PAGE_SETTINGS.save({ distReleaser: 'MC', apMethod: 'equal5', balbillusStartPlanet: 'Moon', ys129Order: 'chaldean', nodeRetrograde: true, minorVariant: 'sidereal', decennialOrderType: 'chaldean', keypointsMode: 'body' });
		expect(effectiveMountBaseline('distributions', {}).distReleaser).toBe('MC');
		expect(effectiveMountBaseline('distributions', { distReleaser: 'Asc' }).distReleaser).toBe('Asc');
		expect(effectiveMountBaseline('agepoint', {}).apMethod).toBe('equal5');
		expect(effectiveMountBaseline('balbillus', {}).startPlanet).toBe('Moon');
		expect(effectiveMountBaseline('yearsystem129', {}).ys129Order).toBe('chaldean');
		expect(effectiveMountBaseline('profection', {}).nodeRetrograde).toBe(1);
		expect(effectiveMountBaseline('vedicprog', {}).minorVariant).toBe('sidereal');
		expect(effectiveMountBaseline('decennials', {}).orderType).toBe('chaldean');
		expect(effectiveMountBaseline('keypoints', {}).mode).toBe('body');
		const base = effectiveMountBaseline('distributions', {});
		expect(pruneOptionsToNonDefault('distributions', { distReleaser: 'MC' }, base)).toEqual({});
		expect(pruneOptionsToNonDefault('distributions', { distReleaser: 'Asc' }, base)).toEqual({ distReleaser: 'Asc' });
		expect(fillPageBoundDefaults('distributions', {}).distReleaser).toBe('MC');
		expect(fillPageBoundDefaults('distributions', { distReleaser: 'Asc' }).distReleaser).toBe('Asc');
		// 不在映射表的技法原样返回
		const rec = { a: 1 };
		expect(fillPageBoundDefaults('bazi', rec)).toBe(rec);
	});

	test('🔴 AI 重算请求带上页面口径(界推运发放点 / 年龄推进点推进方式 / 小限交点逆移)', async ()=>{
		DIRECTION_PAGE_SETTINGS.save({ distReleaser: 'MC', apMethod: 'equal5', nodeRetrograde: true });
		await regenerateChartTechniqueSnapshot({ ...REC }, 'distributions');
		const d = mockBodies.find((b)=>b.url.indexOf('/predict/dist') >= 0);
		expect(d && d.body.distReleaser).toBe('MC');
		mockBodies = [];
		await regenerateChartTechniqueSnapshot({ ...REC }, 'agepoint');
		const a = mockBodies.find((b)=>b.url.indexOf('/predict/agepoint') >= 0);
		expect(a && a.body.apMethod).toBe('equal5');
		mockBodies = [];
		await regenerateChartTechniqueSnapshot({ ...REC, distReleaser: 'Asc' }, 'distributions');
		const d2 = mockBodies.find((b)=>b.url.indexOf('/predict/dist') >= 0);
		expect(d2 && d2.body.distReleaser === 'MC').toBe(false);
	});
});
