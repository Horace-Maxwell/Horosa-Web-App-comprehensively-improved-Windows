// 卜卦 / 择日盘面参数(宫制 / 黄道 / 岁差)进挂载设置:空 = 随存档 / 流派(不下发、请求逐字段同此前);
// 选了 = 存档与流派之后最后覆盖,快照首段写明本次口径(流派说明里的宫制此时不适用)。
const calls = [];
jest.mock('../../services/astro', ()=>({
	__esModule: true,
	fetchChart: jest.fn(async (values)=>{ calls.push(values); return null; }),   // 只看请求,不起盘
}));
const { regenerateHorarySnapshot, regenerateElectionSnapshot, explicitDivinationChartParams, withChartParamNote } = require('../aiAnalysisContext/regenHoraryElection');
const { flattenHoraryStored, flattenElectionStored, getTechniqueSettingsSchema } = require('../techniqueMountSettings');

const caseRecord = (payload)=>({ cid: 'c1', divTime: '2024-01-01 10:00:00', zone: '+08:00', lon: '116e24', lat: '39n54', payload: JSON.stringify(payload) });
beforeEach(()=>{ calls.length = 0; });

test('挂载 schema:卜卦 / 择日都有三键,缺省空 = 随存档', ()=>{
	['horary', 'election'].forEach((t)=>{
		const fields = (getTechniqueSettingsSchema(t) || {}).fields || [];
		['hsys', 'zodiacal', 'siderealAyanamsa'].forEach((k)=>{
			const f = fields.find((x)=>x.name === k);
			expect(`${t}.${k}:${!!f}`).toBe(`${t}.${k}:true`);
			expect(f.default).toBe('');
			expect(f.options[0].value).toBe('');
		});
	});
});

test('只认非空的三键;数值键转数', ()=>{
	expect(explicitDivinationChartParams({})).toEqual({});
	expect(explicitDivinationChartParams({ hsys: '', zodiacal: null, siderealAyanamsa: '' })).toEqual({});
	expect(explicitDivinationChartParams({ hsys: '0', zodiacal: 1, siderealAyanamsa: 'lahiri', other: 3 })).toEqual({ hsys: 0, zodiacal: 1, siderealAyanamsa: 'lahiri' });
});

test('🔴 不给 → 请求宫制随存档(零回归);给了 → 覆盖存档与流派', async ()=>{
	const payload = { extra: { horarySchool: 'classical' }, settings: { hsys: 1 } };
	await regenerateHorarySnapshot(caseRecord(payload), payload);
	expect(Number(calls[0].hsys)).toBe(1);
	await regenerateHorarySnapshot(caseRecord(payload), { ...payload, hsys: 0, zodiacal: 1, siderealAyanamsa: 'lahiri' });
	expect(Number(calls[1].hsys)).toBe(0);
	expect(Number(calls[1].zodiacal)).toBe(1);
	const ep = { extra: { westSchool: 'hellenistic' } };
	await regenerateElectionSnapshot(caseRecord(ep), { ...ep, hsys: 3 });
	expect(Number(calls[2].hsys)).toBe(3);
});

test('基线展平:存档 settings 的三键进基线,齿轮写过的顶层同名键压存档', ()=>{
	expect(flattenHoraryStored({ settings: { hsys: 0, zodiacal: 1 } })).toEqual(expect.objectContaining({ hsys: 0, zodiacal: 1 }));
	expect(flattenElectionStored({ settings: { hsys: 0 }, hsys: 3 }).hsys).toBe(3);
	expect(flattenElectionStored({}).hsys).toBeUndefined();
});

test('快照注明本次口径:只在显式给了时插在首段段头之后;没给原样', ()=>{
	const t = '[起卦信息]\n问题类别：事项\n判读流派：经典主流(Regiomontanus 宫制)';
	expect(withChartParamNote(t, {})).toBe(t);
	const out = withChartParamNote(t, { hsys: 0, zodiacal: 1, siderealAyanamsa: 'lahiri' }).split('\n');
	expect(out[0]).toBe('[起卦信息]');
	expect(out[1]).toContain('盘面参数(本次指定');
	expect(out[1]).toContain('恒星黄道');
	expect(out[1]).toContain('Lahiri');
});

test('地占另起行星地占盘四键进挂载(随档缺省);星座对应表档名与地占页同一份', ()=>{
	const { PCHART_ZODIAC_OPTIONS } = require('../../components/geomancy/geomancyOptions');
	const fields = (getTechniqueSettingsSchema('geomancy') || {}).fields || [];
	['planetaryChart', 'planetaryChartZodiac', 'planetaryChartNodes', 'planetaryChartExtras'].forEach((k)=>{
		const f = fields.find((x)=>x.name === k);
		expect(`${k}:${!!f}`).toBe(`${k}:true`);
		expect(f.default).toBe('');
	});
	const z = fields.find((x)=>x.name === 'planetaryChartZodiac');
	expect(z.options.slice(1).map((o)=>o.value)).toEqual(PCHART_ZODIAC_OPTIONS.map((o)=>o.key));
});

test('页面设置面照实说作用范围:不影响已存档案与 cast_technique', ()=>{
	const { PAGE_FACET_SCOPE_NOTE } = require('../aiTools/settingsFacets');
	expect(PAGE_FACET_SCOPE_NOTE).toContain('cast_technique');
	expect(PAGE_FACET_SCOPE_NOTE).toContain('facet=mount');
});
