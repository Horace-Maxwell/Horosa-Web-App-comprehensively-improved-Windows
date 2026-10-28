// 随盘清单缺键三方同值合同:页面载入(applyRecordToFields)/ AI 构造器(buildFieldObject)/ 挂载齿轮基线(effectiveMountBaseline)。
// 把每一项全局(古典口径仓 / 日界 / 新盘种子 / 七政本机仓 / 埃及历)都设成非缺省,拿一张带随盘代次标记、缺清单全部键的记录:
// 三方对清单里每个键必须给同一个值(缺键 = 存盘时为默认,不许沿用上一张盘、不许各回落各的全局)。
// 取值单源 = recordMissingValue;新增清单键漏了任何一方,这里逐键报红。
import '../../models/astro';   // 注册 schema 基准工厂(newEmptyFields)
import { RECORD_FIELDS_RESTORE_MANIFEST, RECORD_MISSING_IDENTITY_KEYS, applyRecordToFields, fieldsSchemaBaseline, recordMissingValue, RECORD_FIELDS_CAPTURE_MARK } from '../recordFieldsRestore';
import { buildFieldObject } from '../aiAnalysisContext/recordFields';
import { TECHNIQUE_SETTINGS_SCHEMA, getTechniqueSettingsSchema, effectiveMountBaseline, fieldCurrentDefault } from '../techniqueMountSettings';
import { setClassicalChartGlobal, CLASSICAL_GLOBAL_DEFAULTS } from '../classicalChartGlobals';
import { CLASSICAL_PARAM_SPEC } from '../classicalParamSpec';
import { recordNewChartSeeds, __resetNewChartSeedsForTest, isNewChartSeedKey } from '../newChartSeeds';
import { persistEgyptSchool } from '../../divination/data/egyptianSchools';

const PREV = '__上一张盘__';
const REC = { cid: 'local-1-x', name: 'T', birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', gpsLat: 31.23, gpsLon: 121.47, gender: 1 };
const MARKED = { ...REC, [RECORD_FIELDS_CAPTURE_MARK]: 1 };
// 出厂为空 = 取本机七政仓的键:页面字段与构造器都是空串(各自再回落本机仓),齿轮基线直接显示本机仓的值
const EMPTY_FOLLOWS_LOCAL = { guolaoAyanamsa: 'horosaGuolaoAyanamsa' };

function setAllGlobalsNonDefault(){
	window.localStorage.setItem('globalSetup', JSON.stringify({ dayBoundary: 'after24', lateZiHourMode: 'today' }));
	CLASSICAL_PARAM_SPEC.forEach((s)=>{
		const o = (s.options || []).find((x)=>x.value !== s.default);
		if(o){ setClassicalChartGlobal(s.key, o.value); }else if(s.type === 'switch'){ setClassicalChartGlobal(s.key, s.default ? 0 : 1); }
	});
	recordNewChartSeeds({ zodiacal: 1, siderealAyanamsa: 'fagan', hsys: 3, timeAlg: 1, phaseType: 1, godKeyPos: '日', doubingSu28: 2, houseStartMode: 1,
		indiaHsys: 2, indiaAyanamsa: 'raman', indiaNodeType: 'true', indiaDashaSeed: 'lagna', indiaSthiraStart: 'brahma', indiaVargaSet: '1,9',
		pdMethod: 'placidus_mundo', pdTimeKey: 'Naibod', pdtype: 1, pdProjection: 'regiomontanus', pdParallel: 1 });
	[['horosaGuolaoLifeMode', 'yumao'], ['horosaGuolaoNodeMode', 'northRahuSouthKetu'], ['horosaGuolaoTrueSolarTime', 'false'], ['horosaGuolaoNodeType', 'true'],
		['horosaGuolaoLilithType', 'true'], ['horosaGuolaoAyanamsa', 'lahiri'], ['horosaGuolaoGufaPrecess', '1'], ['horosaGuolaoEqTropicalAnchor', 'chunfen']]
		.forEach(([k, v])=>window.localStorage.setItem(k, v));
	persistEgyptSchool({ decanRuler: 'triplicity' });
}

// 上一张盘:清单每个键都是怪值(缺键若「沿用当前值」就会原样留下)
function prevFields(){
	const out = { ...fieldsSchemaBaseline() };
	RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key })=>{ out[key] = { name: [key], value: PREV }; });
	return out;
}

const same = (a, b)=>JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
const blank = (v)=>v === undefined || v === null || (Array.isArray(v) && !v.length);

// 齿轮里与清单键同名、覆盖写回记录平铺键的字段(record 类;七政走 recordKey)
function gearFieldsFor(key){
	const out = [];
	Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((tk)=>{
		const sc = getTechniqueSettingsSchema(tk);
		if(!sc || !Array.isArray(sc.fields)){ return; }
		sc.fields.forEach((f)=>{
			if(sc.kind === 'record' && f.name === key && !f.baselineRecordKey){ out.push({ tk, f }); }
			if(sc.kind === 'localStorage' && f.recordKey === key){ out.push({ tk, f }); }
		});
	});
	return out;
}

function diffs(record){
	const page = applyRecordToFields(prevFields(), record);
	const ai = buildFieldObject(record);
	const bad = [];
	RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key })=>{
		if(RECORD_MISSING_IDENTITY_KEYS.indexOf(key) >= 0){ return; }
		const m = recordMissingValue(record, key);
		if(m.kind === 'keep'){ return; }   // 旧记录非种子键:页面沿用当前值,不在本合同
		const pv = page[key] ? page[key].value : undefined;
		const av = ai[key] ? ai[key].value : undefined;
		if(pv === PREV){ bad.push(`${key}: 页面沿用了上一张盘`); return; }
		if(!same(pv, av)){ bad.push(`${key}: 页面 ${JSON.stringify(pv)} ≠ 构造器 ${JSON.stringify(av)}`); }
		gearFieldsFor(key).forEach(({ tk, f })=>{
			const bv = effectiveMountBaseline(tk, record)[f.name];
			let want;
			if(EMPTY_FOLLOWS_LOCAL[key] && (pv === '' || blank(pv))){
				want = window.localStorage.getItem(EMPTY_FOLLOWS_LOCAL[key]);
			}else if(blank(pv)){
				want = m.kind === 'drop' && !blank(m.value) ? m.value : fieldCurrentDefault(f);
			}else{
				want = pv;
			}
			const norm = (v)=>(typeof f.normalize === 'function' ? f.normalize(v) : (typeof f.default === 'number' && v !== '' && !blank(v) ? Number(v) : v));
			if(!same(norm(bv), norm(want))){ bad.push(`${key}: 齿轮 ${tk}.${f.name} 基线 ${JSON.stringify(bv)} ≠ ${JSON.stringify(want)}`); }
		});
	});
	return bad;
}

describe('随盘清单缺键:页面载入 = AI 构造器 = 挂载齿轮基线(单源 recordMissingValue)', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); __resetNewChartSeedsForTest(); setAllGlobalsNonDefault(); });
	afterEach(()=>{
		Object.keys(CLASSICAL_GLOBAL_DEFAULTS).forEach((k)=>setClassicalChartGlobal(k, CLASSICAL_GLOBAL_DEFAULTS[k]));
		window.localStorage.clear(); __resetNewChartSeedsForTest();
	});
	test('带随盘代次标记、缺全部清单键的记录:逐键三方同值', ()=>{
		expect(diffs(MARKED)).toEqual([]);
	});
	test('没打标记的旧记录:种子键(页面载入先复位)三方同值', ()=>{
		expect(diffs(REC)).toEqual([]);
	});
	test('合同自检:全局确实被设成了非缺省(否则三方恰好同为缺省,合同空转)', ()=>{
		expect(CLASSICAL_PARAM_SPEC.length).toBeGreaterThan(20);
		const page = applyRecordToFields(prevFields(), MARKED);
		// 种子设成了 Placidus / 恒星黄道,带标记的盘缺键仍是出厂值
		expect(page.hsys.value).toBe(1);
		expect(page.zodiacal.value).toBe(0);
		expect(isNewChartSeedKey('pdProjection')).toBe(true);
		expect(buildFieldObject(MARKED).pdProjection.value).toBe(page.pdProjection.value);
	});
	test('印占:记录带了流派、缺宫制 / 岁差 → 构造器取页面载入的值,不再按流派预设另起(页面换派才套预设)', ()=>{
		const rec = { ...MARKED, indiaSchool: 'kp' };
		const page = applyRecordToFields(prevFields(), rec);
		const ai = buildFieldObject(rec);
		expect(ai.indiaHsys.value).toBe(page.indiaHsys.value);
		expect(ai.indiaAyanamsa.value).toBe(page.indiaAyanamsa.value);
	});
});
