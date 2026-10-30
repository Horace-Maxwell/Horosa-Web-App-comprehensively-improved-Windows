// 主限法「扩展」弹层全部项(应星 / 迫星扩展清单、映点、界、急动)= 新命盘缺省;载入命盘按记录还原(含顺 / 逆 / 映点 / 界),
// 上一张盘的这几项不串进下一张没存它们的盘。
jest.mock('../astroAiSnapshot', ()=>({ ...jest.requireActual('../astroAiSnapshot'), saveAstroAISnapshot: jest.fn() }));
const seeds = require('../newChartSeeds');
const { PD_SIGNIFICATOR_OPTIONS, PD_PROMISSOR_TYPE_OPTIONS } = require('../primaryDirectionSync');

const SIG = PD_SIGNIFICATOR_OPTIONS.slice(0, 2).map((o)=>o.value);
const PROM = PD_PROMISSOR_TYPE_OPTIONS.slice(0, 1).map((o)=>o.value);

beforeEach(()=>{ window.localStorage.clear(); seeds.__resetNewChartSeedsForTest(); });

function newFields(){
	const astro = require('../../models/astro').default;
	return astro.state && astro.state.fields ? require('../recordFieldsRestore').fieldsSchemaBaseline() : null;
}

test('亲手改的扩展项记成种子;新命盘按种子起(清单 / 急动在 schema 里,映点 / 界只在非缺省时新建字段)', ()=>{
	expect(seeds.newChartSeedValue('pdSignificators')).toBe(null);
	seeds.recordNewChartSeeds({ pdSignificators: SIG, pdPromissorTypes: PROM, pdAntiscia: 1, pdTerms: 1, pdRaptParallel: 1 });
	expect(seeds.newChartSeedValue('pdSignificators')).toEqual(SIG);
	expect(seeds.newChartSeedValue('pdPromissorTypes')).toEqual(PROM);
	expect(seeds.newChartSeedValue('pdRaptParallel')).toBe(1);
	const extra = seeds.newChartSeedExtraEntries();
	expect(extra.pdAntiscia).toEqual({ value: 1, name: ['pdAntiscia'] });
	expect(extra.pdTerms).toEqual({ value: 1, name: ['pdTerms'] });
	expect(extra.pdSignificators).toBeUndefined();   // schema 本有的键走 schema 初值,不另建
});

test('改回缺省 / 清空清单 = 删种子;不合法的清单不记', ()=>{
	seeds.recordNewChartSeeds({ pdSignificators: SIG, pdAntiscia: 1 });
	seeds.recordNewChartSeeds({ pdSignificators: null, pdAntiscia: 0 });
	expect(seeds.newChartSeedValue('pdSignificators')).toBe(null);
	expect(seeds.newChartSeedExtraEntries().pdAntiscia).toBeUndefined();
	seeds.recordNewChartSeeds({ pdSignificators: ['NoSuchPoint'] });
	seeds.recordNewChartSeeds({ pdPromissorTypes: [PROM[0], PROM[0]] });
	expect(seeds.newChartSeedValue('pdSignificators')).toBe(null);
	expect(seeds.newChartSeedValue('pdPromissorTypes')).toBe(null);
});

test('推运页「计算」入口把扩展项一并记种子(源码合同)', ()=>{
	const src = require('fs').readFileSync(require('path').resolve(__dirname, '../../components/direction/AstroDirectMain.js'), 'utf8');
	const i = src.indexOf('applyPrimaryDirectionConfig(pdMethod, pdTimeKey, pdYears, options){');
	const body = src.slice(i, src.indexOf('this.props.dispatch(', i));
	['pdRaptParallel', 'pdAntiscia', 'pdTerms', 'pdSignificators', 'pdPromissorTypes'].forEach((k)=>expect([k, body.indexOf(k) >= 0]).toEqual([k, true]));
});

test('载入命盘:记录里的顺 / 逆 / 映点 / 界 / 清单还原到字段;种子不播给载入的盘;上一张盘的映点 / 界不串到没存它们的盘', ()=>{
	newFields();
	const { applyRecordToFields } = require('../recordFieldsRestore');
	seeds.recordNewChartSeeds({ pdAntiscia: 1, pdSignificators: SIG });
	const prev = { pdAntiscia: { value: 1, name: ['pdAntiscia'] }, pdTerms: { value: 1, name: ['pdTerms'] }, pdSignificators: { value: SIG, name: ['pdSignificators'] } };
	const loaded = applyRecordToFields(prev, { pdDirect: 1, pdConverse: 0, pdAntiscia: 1, pdTerms: 0, pdPromissorTypes: PROM });
	expect(loaded.pdDirect.value).toBe(1);
	expect(loaded.pdConverse.value).toBe(0);
	expect(loaded.pdAntiscia.value).toBe(1);
	expect(loaded.pdTerms.value).toBe(0);
	expect(loaded.pdPromissorTypes.value).toEqual(PROM);
	expect(loaded.pdSignificators.value).toBe(null);   // 记录没存 = 存档时为缺省;种子不播
	const bare = applyRecordToFields(prev, {});
	expect(bare.pdAntiscia).toBeUndefined();   // 上一张盘的映点 / 界撤掉(不是 schema 键)
	expect(bare.pdTerms).toBeUndefined();
});

test('AI 按记录重算主限法:记录没存顺 / 逆 / 映点 / 界 = 缺省(顺逆都开、映点 / 界关),逆向不再被当成关', ()=>{
	const { buildFieldObject, fieldParams } = require('../aiAnalysisContext/recordFields');
	const rec = { cid: 'local-1-x', name: 'T', birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', gpsLat: 31.23, gpsLon: 121.47, gender: 1, fieldsCaptureGen: 1 };
	const p = fieldParams(buildFieldObject(rec));
	expect([p.pdDirect, p.pdConverse, p.pdAntiscia, p.pdTerms]).toEqual([1, 1, 0, 0]);
	const p2 = fieldParams(buildFieldObject({ ...rec, pdDirect: 1, pdConverse: 0, pdAntiscia: 1, pdTerms: 1 }));
	expect([p2.pdDirect, p2.pdConverse, p2.pdAntiscia, p2.pdTerms]).toEqual([1, 0, 1, 1]);
});
