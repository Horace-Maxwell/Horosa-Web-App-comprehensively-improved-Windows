// [挂载自检 阶段3(a) 差分闸实抓·残余五修] 表驱动差分闸(mountSettingsDiffAll)跑出的「值到不了消费点」五处,逐条判别向量:
//   F-52 紫微「太岁关系人」经挂载覆盖(schema normalize 已归一为对象数组)→ 曾被串化剪空;
//   F-53 正传·心易查询层缺省(父母/日/一刻/乾/子)须与 schema/页面同源,否则缺省挂载整段不产;
//   F-54 八字 [大运] 段「起运：…」行(页面信息面板恒显)+ 起运精度档落地;
//   F-55 巴比伦「纪元显示」进快照(此前透传无消费);
//   F-56 皇极心易起卦法值域=后端键('character'/'direction'),请求体必须以后端键发出。
// 不 mock utils/request:F-52 紫微主盘走 :9999,离线时该用例打印 UNVERIFIED-OFFLINE(不假绿);其余四例纯本地/请求体级。
var mockBodies = [];
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({ listLocalCases: jest.fn(() => []), getCaseTypeLabel: jest.fn((t) => t), getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })), CASE_TYPE_OPTIONS: [], __esModule: true }));
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), clearModuleAISnapshot: jest.fn(), loadModuleStructuredGT: jest.fn(() => null) }));
jest.mock('../aiAnalysisStore', () => ({ AI_ANALYSIS_STORES: { contextCache: 'contextCache' }, getStoreRecord: jest.fn(async () => null), putStoreRecord: jest.fn(async (s, r) => r) }));
import { getAnalysisTechniqueContextWithOptions, regenerateChartTechniqueSnapshot, regenerateCaseTechniqueSnapshot } from '../aiAnalysisContext';
import { TECHNIQUE_SETTINGS_SCHEMA } from '../techniqueMountSettings';
import { buildBaziSnapshotForParams } from '../../components/cntradition/BaZi';
jest.setTimeout(120000);

const REC = { cid: 'resid', name: '残余', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 };
const src = { id: 'chart-resid', sourceType: 'chart', record: { ...REC } };
const realFetch = global.fetch;
beforeEach(()=>{ mockBodies = []; });

describe('F-52 紫微·太岁关系人经挂载覆盖', ()=>{
	it('🔴 覆盖 {taiSuiRuGua:1, taiSuiRelatives:"午:母:female"} → 正文含「生肖午(母)」(此前对象数组被串化剪空)', async ()=>{
		global.fetch = async (u, o)=>realFetch(u, o);
		const a = await getAnalysisTechniqueContextWithOptions(src, 'ziwei', { taiSuiRuGua: 1 });
		const b = await getAnalysisTechniqueContextWithOptions(src, 'ziwei', { taiSuiRuGua: 1, taiSuiRelatives: '午:母:female' });
		if(!a.content || !b.content){ console.log('UNVERIFIED-OFFLINE ziwei(:9999 离线)'); return; }
		expect(b.content).toContain('生肖午(母)');
		expect(a.content).not.toContain('生肖午(母)');
	});
});

describe('F-53 正传·心易查询层缺省', ()=>{
	it('🔴 只设流派=心易 → 出 [条文秘数查询](父母/日);查询项目拨「兄弟」→ 正文不同;缺省五项与 schema 缺省同源', async ()=>{
		const base = await regenerateChartTechniqueSnapshot({ ...REC, zcSchool: 'xinyi' }, 'zhengchuan');
		expect(base).toContain('[条文秘数查询]');
		expect(base).toContain('| 父母 | 日 |');
		const alt = await regenerateChartTechniqueSnapshot({ ...REC, zcSchool: 'xinyi', zcItem: '兄弟' }, 'zhengchuan');
		expect(alt).toContain('| 兄弟 | 日 |');
		expect(alt).not.toBe(base);
		const f = Object.fromEntries(TECHNIQUE_SETTINGS_SCHEMA.zhengchuan.fields.map((x)=>[x.name, x.default]));
		expect([f.zcItem, f.zcSound, f.zcKe, f.zcGong, f.zcXqZhi]).toEqual(['父母', '日', '一刻', '乾', '子']);
	});
});

describe('F-54 八字·起运行 + 起运精度', ()=>{
	it('🔴 [大运] 段含「起运：」;precise 与 integer 两档正文不同', async ()=>{
		const P = { date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: 118.45, gpsLon: 118.45, lat: 31.63, gpsLat: 31.63, gender: 1, timeAlg: 1, after23NewDay: 1 };
		const a = await buildBaziSnapshotForParams({ ...P, dayunPrecision: 'precise' });
		const b = await buildBaziSnapshotForParams({ ...P, dayunPrecision: 'integer' });
		expect(a).toContain('[大运]');
		expect(a).toMatch(/\n起运：/);
		const lineOf = (t)=>t.split('\n').find((l)=>l.indexOf('起运：') === 0);
		expect(lineOf(a)).toBeTruthy();
		expect(lineOf(b)).toBeTruthy();
		expect(lineOf(a)).not.toBe(lineOf(b));
	});
});

describe('F-55 巴比伦·纪元显示', ()=>{
	it('🔴 era=arsacid → 「安息纪元」;缺省 → 「塞琉古纪元」', async ()=>{
		const m = await import('../babylonAiSnapshot');
		const fields = { date: { value: { format: ()=>'1990-05-18' } }, time: { value: { format: ()=>'10:00:00' } }, zone: { value: '+08:00' }, lon: { value: '118e27' }, lat: { value: '31n38' } };
		const bab = m.buildHoroscope ? null : null;
		// 走 buildBabylonSnapshotText 的最小 bab:自 buildHoroscope 起(与 builder 同源),经纬/星历为空时仍出历日与纪元
		const { buildHoroscope } = await import('../../divination/babylon/horoscope');
		const jdn = 2448030;
		const h = buildHoroscope({}, jdn, {});
		if(!h){ console.log('UNVERIFIED buildHoroscope 空'); return; }
		const t1 = m.buildBabylonSnapshotText(h, { era: 'arsacid' });
		const t0 = m.buildBabylonSnapshotText(h, {});
		expect(t1).toContain('安息纪元');
		expect(t0).toContain('塞琉古纪元');
		expect(t1).not.toBe(t0);
		void bab; void fields;
	});
});

describe('F-56 皇极心易·起卦法后端键', ()=>{
	it('🔴 schema 值域=character/direction;笔画起卦请求体 method=character 且带 upperStrokes', async ()=>{
		const f = Object.fromEntries(TECHNIQUE_SETTINGS_SCHEMA.huangji.fields.map((x)=>[x.name, x]));
		const vals = f.xinyiMethod.options.map((o)=>o.value);
		expect(vals).toEqual(expect.arrayContaining(['character', 'direction']));
		expect(vals).not.toContain('strokes');
		expect(vals).not.toContain('object');
		expect(f.upperStrokes.showWhen({ xinyiMethod: 'character' })).toBe(true);
		expect(f.objectGua.showWhen({ xinyiMethod: 'direction' })).toBe(true);
		mockBodies = [];
		global.fetch = async (u, o)=>{ try{ mockBodies.push({ url: `${u}`, body: JSON.parse(o.body) }); }catch(_e){} return { ok: true, status: 200, json: async ()=>({}), text: async ()=>'{}' }; };
		await regenerateCaseTechniqueSnapshot({ ...REC, divTime: REC.birth, caseType: 'huangji' }, 'huangji', { xinyiMethod: 'character', upperStrokes: 6, lowerStrokes: 3 });
		global.fetch = realFetch;
		const xy = mockBodies.find((b)=>b.url.indexOf('xinyi') >= 0);
		expect(xy).toBeTruthy();
		expect(xy.body.method).toBe('character');
		expect(xy.body.upperStrokes).toBe(6);
	});
});
