// [挂载自检 F-17] 星运族「页面≠无头」缺省对齐:①(已撤,见下)②三返照/流年无头缺省目标=当年生日时刻
// (页面 genNatalParams 同律);③主限法盘缺省时刻=首条主限日期,无则出生次日。
// [Q-175/T-115] ① 原本让 natalClassicalParams 补发 doubingSu28/guolaoLifeMode,但 Java 两端白名单
// (PredictiveController / AstroExtraController)都不收这两键 —— 发出去即被剥,四个月零效果,只是把键
// 掺进请求体与缓存键。按「不发无效键」撤销;本用例相应反过来锁「不再发」,免得哪天又被补回去。
// ⚠ F-17 记的那条分叉并未因此被修好:真要对齐须让 Java 白名单收键(会改推运页产物),属另案。
var mockBodies = [];
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async (url, opts) => { try{ mockBodies.push({ url: `${url}`.replace(/^https?:\/\/[^/]+/, ''), body: JSON.parse(opts.body) }); }catch(_e){} return { Result: {} }; }) }));
jest.mock('../../services/astro', () => ({ fetchChart: jest.fn(async (values) => { mockBodies.push({ url: '/chart(fetchChart)', body: values }); return { Result: { chart: { objects: [], stars: [] }, lots: [], params: { ...values, birth: `${values.date} ${values.time}`, zone: values.zone }, predictives: { primaryDirection: [] } } }; }) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), clearModuleAISnapshot: jest.fn(), loadModuleStructuredGT: jest.fn(() => null) }));
import { natalClassicalParams } from '../../components/astro/AstroExtraCommon';
import { defaultPdChartDateTime } from '../../components/astro/AstroPrimaryDirectionChart';
import { regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';

const REC = { cid: 'pd', name: '推运', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 };

describe('F-17 推运缺省对齐', ()=>{
	it('🔴 [Q-175] natalClassicalParams 不再发 doubingSu28/guolaoLifeMode(Java 两端白名单都不收=死键)', ()=>{
		const withVals = natalClassicalParams({ doubingSu28: 2, guolaoLifeMode: 'yumao' });
		expect(withVals.doubingSu28).toBeUndefined();
		expect(withVals.guolaoLifeMode).toBeUndefined();
		const none = natalClassicalParams({});
		expect(none.doubingSu28).toBeUndefined();
		expect(none.guolaoLifeMode).toBeUndefined();
	});
	it('🔴 三返照/流年无头缺省目标=当年生日时刻;小限/太阳弧仍=此刻', async ()=>{
		const y = new Date().getFullYear();
		for(const key of ['solarreturn', 'lunarreturn', 'givenyear']){
			mockBodies = [];
			await regenerateChartTechniqueSnapshot({ ...REC }, key);
			const req = mockBodies.find((b)=>b.url.indexOf('/predict/') >= 0);
			expect(req && req.body && req.body.datetime).toBe(`${y}-05-18 10:00`);
		}
		mockBodies = [];
		await regenerateChartTechniqueSnapshot({ ...REC }, 'profection');
		const p = mockBodies.find((b)=>b.url.indexOf('/predict/') >= 0);
		expect(p && p.body && p.body.datetime).not.toBe(`${y}-05-18 10:00`);
	});
	it('🔴 主限法盘缺省时刻:无主限行 → 出生次日(页面规则),不再是此刻', ()=>{
		const chartObj = { params: { birth: '1990-05-18 10:00:00', zone: '+08:00', date: '1990-05-18', time: '10:00:00' }, chart: {}, predictives: { primaryDirection: [] } };
		const d = defaultPdChartDateTime(chartObj);
		expect(d).toBeTruthy();
		expect(d.format('YYYY-MM-DD')).toBe('1990-05-19');
	});
});
