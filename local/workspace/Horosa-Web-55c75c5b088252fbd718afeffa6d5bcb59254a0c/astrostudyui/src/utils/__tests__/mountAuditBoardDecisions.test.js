// [挂载自检·拍板项落地] F-09 占星宿度制字段改 select(单源) · F-45 印占三旗/问事随记录持久化+回填 · F-44 七政 kentang 七齿轮+无头基础键同集。
var mockBodies = [];
jest.mock('../localcharts', () => { const a = jest.requireActual('../localcharts'); return { __esModule: true, ...a, listLocalCharts: jest.fn(() => []) }; });
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), clearModuleAISnapshot: jest.fn(), loadModuleStructuredGT: jest.fn(() => null) }));
import { TECHNIQUE_SETTINGS_SCHEMA, pruneOptionsToNonDefault, effectiveMountBaseline } from '../techniqueMountSettings';
import { SU28_MODE_LABEL } from '../../components/guolao/guolaoData';
import { buildLocalChartRecord } from '../localcharts';
import { applyRecordToFields } from '../recordFieldsRestore';
import { regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';

const REC = { cid: 'bd', name: '拍板', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 };

describe('F-09 宿占 doubingSu28 = 宿度制 select([Q-020/M-22 ③] 星盘条目已撤:星盘快照零消费)', ()=>{
	it('🔴 类型 select、值域 ≡ SU28_MODE_LABEL 键集、缺省 0;拨 2(回归今宿)= 覆盖;astrochart 不再暴露', ()=>{
		const f = TECHNIQUE_SETTINGS_SCHEMA.suzhan.fields.find((x)=>x.name === 'doubingSu28');
		expect(f.type).toBe('select');
		expect(f.default).toBe(0);
		expect(f.options.map((o)=>o.value).sort((a, b)=>a - b)).toEqual(Object.keys(SU28_MODE_LABEL).map(Number).sort((a, b)=>a - b));
		expect(f.options.find((o)=>o.value === 1).label).toContain('斗柄定房法');
		expect(pruneOptionsToNonDefault('suzhan', { doubingSu28: 2 }, effectiveMountBaseline('suzhan', REC))).toEqual({ doubingSu28: 2 });
		expect(TECHNIQUE_SETTINGS_SCHEMA.astrochart.fields.find((x)=>x.name === 'doubingSu28')).toBeUndefined();
	});
});

describe('F-45 三旗/问事随记录', ()=>{
	it('🔴 存盘七键落库;载入回填到 fields;未提供不落键', ()=>{
		const rec = buildLocalChartRecord({ ...REC, indiaTripataki: 1, indiaPrashnaTime: '2026/05/15 10:12:00', indiaPrashnaNumber: 108, indiaPrashnaMatter: 'marriage', indiaPrashnaSchools: 'kp,tajika', indiaPrashnaCuspMode: 'time_placidus', indiaPrashnaPrimaryHouse: 7 });
		expect(rec.indiaTripataki).toBe(1);
		expect(rec.indiaPrashnaTime).toBe('2026/05/15 10:12:00');
		expect(rec.indiaPrashnaNumber).toBe(108);
		expect(rec.indiaPrashnaSchools).toBe('kp,tajika');
		expect(rec.indiaPrashnaPrimaryHouse).toBe(7);
		const bare = buildLocalChartRecord({ ...REC });
		expect(Object.prototype.hasOwnProperty.call(bare, 'indiaTripataki') ? bare.indiaTripataki : undefined).toBeUndefined();
		const fields = applyRecordToFields({}, rec);
		expect(fields.indiaTripataki && fields.indiaTripataki.value).toBe(1);
		expect(fields.indiaPrashnaTime && fields.indiaPrashnaTime.value).toBe('2026/05/15 10:12:00');
		expect(fields.indiaPrashnaMatter && fields.indiaPrashnaMatter.value).toBe('marriage');
	});
});

describe('F-44 七政 kentang 七齿轮 + 无头基础键', ()=>{
	const realFetch = global.fetch;
	afterEach(()=>{ global.fetch = realFetch; });
	it('🔴 request 带 qizhengKin* 七键与 after23/lateZi/gps/pos;缺省不带七键(零 churn)', async ()=>{
		mockBodies = [];
		global.fetch = async (u, o)=>{ try{ mockBodies.push({ url: `${u}`, body: JSON.parse(o.body) }); }catch(_e){} return { ok: true, status: 200, json: async ()=>({}), text: async ()=>'{}' }; };
		await regenerateChartTechniqueSnapshot({ ...REC, pos: '南京' }, 'qizhengkin');
		const base = mockBodies.find((b)=>b.url.indexOf('qizhengkin') >= 0);
		expect(base).toBeTruthy();
		expect(base.body.after23NewDay).toBeDefined();
		expect(base.body.lateZiHourUseNextDay).toBeDefined();
		expect(base.body.gpsLon).toBe(118.45);
		expect(base.body.pos).toBe('南京');
		expect(base.body.qizhengKinTransitMode).toBeUndefined();
		mockBodies = [];
		await regenerateChartTechniqueSnapshot({ ...REC, qizhengKinTransitMode: 'custom', qizhengKinTransitDate: '2026-05-15', qizhengKinTransitTime: '10:12', qizhengKinElectionalCriteria: 'marriage', qizhengKinElectionalDays: 45, qizhengKinCurrentYear: 2026 }, 'qizhengkin');
		const ov = mockBodies.find((b)=>b.url.indexOf('qizhengkin') >= 0);
		expect(ov.body.qizhengKinTransitMode).toBe('custom');
		expect(ov.body.qizhengKinTransitDate).toBe('2026-05-15');
		expect(ov.body.qizhengKinElectionalCriteria).toBe('marriage');
		expect(ov.body.qizhengKinElectionalDays).toBe(45);
		expect(ov.body.qizhengKinCurrentYear).toBe(2026);
	});
	it('schema 七齿轮登记、过运日期/时间随过运=指定时刻', ()=>{
		const f = Object.fromEntries(TECHNIQUE_SETTINGS_SCHEMA.qizhengkin.fields.map((x)=>[x.name, x]));
		expect(f.qizhengKinTransitDate.showWhen({ qizhengKinTransitMode: 'custom' })).toBe(true);
		expect(f.qizhengKinTransitDate.showWhen({ qizhengKinTransitMode: 'none' })).toBe(false);
		expect(f.qizhengKinElectionalCriteria.options.map((o)=>o.value)).toEqual(['general', 'marriage', 'travel', 'business', 'moving']);
	});
});
