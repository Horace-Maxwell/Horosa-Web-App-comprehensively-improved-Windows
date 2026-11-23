// 辅盘七张派生盘的无头复算(辅盘页没出过这张盘时,AI 挂载与外部智能体拿到的一直是 missing;
// 先补了变换盘 / 黄道制,后补十三分 / 十二分 / 调波 / 龙盘 / 重置盘并让带参数的三张能按参数取)。
import fs from 'fs';
import path from 'path';
import { transformRequestOptions, DERIVED_LAB_HEADLESS_KEYS, derivedParamsFor, sameDerivedParams } from '../aiAnalysisContext/derivedLabsHeadless';
import { harmonicSnapshotLines, draconicSnapshotLines, relocationSnapshotSpecialty, clampHarmonic } from '../derivedAstroLabs';
import { transformKindDef } from '../transformCharts';

describe('变换盘 / 黄道制无头复算', ()=>{
	test('只发这种变换真正用到的选项(与辅盘页同口径)', ()=>{
		const settings = { kind: 'superimposed', planet: 'Moon', shift: true, house: 4, variant: 'classic' };
		expect(transformRequestOptions(settings, transformKindDef('superimposed'))).toEqual({ transformKind: 'superimposed', transformPlanet: 'Moon', transformShift: 1 });
		expect(transformRequestOptions({ ...settings, kind: 'inverted' }, transformKindDef('inverted'))).toEqual({ transformKind: 'inverted', transformVariant: 'classic' });
		// 与辅盘页 requestOptions 同一条规则(防两处各写一份后漂移)
		const lab = fs.readFileSync(path.resolve(__dirname, '../../components/auxchart/AstroTransformLab.js'), 'utf8');
		['transformPlanet = planet', 'transformShift = shift ? 1 : 0', 'transformHouse = house', 'transformVariant = variant'].forEach((s)=>expect(lab).toContain(s));
	});
	test('页面快照不匹配时 techniqueContext 走无头复算,正文与页面同一个构建函数', ()=>{
		expect(DERIVED_LAB_HEADLESS_KEYS).toEqual(['hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation', 'transformchart', 'zodiacsystems']);
		const ctx = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/techniqueContext.js'), 'utf8');
		expect(ctx).toContain('if(!single.available && allowHeadless && DERIVED_LAB_HEADLESS_KEYS.indexOf(key) >= 0 && source.record){');
		expect(ctx).toContain('await buildDerivedLabHeadless(source.record, key)');
		const hl = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/derivedLabsHeadless.js'), 'utf8');
		expect(hl).toContain('m.das.derivedAstroSnapshotText(');
		const das = fs.readFileSync(path.resolve(__dirname, '../derivedAstroSnapshot.js'), 'utf8');
		expect(das).toContain('saveModuleAISnapshotLazy(moduleKey, ()=>derivedAstroSnapshotText(rawChart, fields, specialtyLines)');
	});
});

// 每次发送 / 预览都会建上下文:无头结果要缓存(键含辅盘页这一项的设置),同一键并发共用一个在途请求
describe('变换盘 / 黄道制无头复算 · 缓存', ()=>{
	const { buildDerivedLabHeadless } = require('../aiAnalysisContext/derivedLabsHeadless');
	const { __resetRegeneratedSnapshotCacheForTests } = require('../aiAnalysisContext/snapshotMatch');
	const chartParamsMod = require('../aiAnalysisContext/chartParams');
	const requestMod = require('../request');
	const { ZODIAC_PAGE_SETTINGS, ZODIAC_VERSIONS } = require('../transformCharts');
	const RECORD = { birth: '1990-01-01 08:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', name: '甲' };
	let natalSpy; let reqSpy;
	beforeEach(()=>{
		__resetRegeneratedSnapshotCacheForTests();
		window.localStorage.clear();
		natalSpy = jest.spyOn(chartParamsMod, 'fetchChartResultForRecord').mockResolvedValue({ params: { date: '1990/01/01', time: '08:00:00', zone: '+08:00', lat: '31n14', lon: '121e28' } });
		reqSpy = jest.spyOn(requestMod, 'default').mockImplementation((url, opts)=>Promise.resolve({ Result: { version: JSON.parse(opts.body).zodiacVersion, galacticCenter: 266.8, rows: [{ id: 'Sun', lon: 280.1, versions: {} }] } }));
	});
	afterEach(()=>{ natalSpy.mockRestore(); reqSpy.mockRestore(); });

	test('同一份记录 + 同一设置:只请求一次;并发的共用在途请求', async ()=>{
		const [a, b] = await Promise.all([buildDerivedLabHeadless(RECORD, 'zodiacsystems'), buildDerivedLabHeadless(RECORD, 'zodiacsystems')]);
		expect(a).toContain('[黄道制]');
		expect(b).toBe(a);
		expect(await buildDerivedLabHeadless(RECORD, 'zodiacsystems')).toBe(a);
		expect(reqSpy).toHaveBeenCalledTimes(1);
	});

	test('辅盘页换了黄道版本 / 换了一份记录 → 重算', async ()=>{
		await buildDerivedLabHeadless(RECORD, 'zodiacsystems');
		const other = ZODIAC_VERSIONS.map((v)=>v.value).find((v)=>v !== ZODIAC_PAGE_SETTINGS.load().version);
		ZODIAC_PAGE_SETTINGS.save({ version: other });
		await buildDerivedLabHeadless(RECORD, 'zodiacsystems');
		expect(reqSpy).toHaveBeenCalledTimes(2);
		expect(JSON.parse(reqSpy.mock.calls[1][1].body).zodiacVersion).toBe(other);
		await buildDerivedLabHeadless({ ...RECORD, name: '乙', birth: '1991-01-01 08:00:00' }, 'zodiacsystems');
		expect(reqSpy).toHaveBeenCalledTimes(3);
	});

	test('取不到不记账', async ()=>{
		reqSpy.mockImplementation(()=>Promise.reject(new Error('down')));
		expect(await buildDerivedLabHeadless(RECORD, 'zodiacsystems')).toBe('');
		expect(await buildDerivedLabHeadless(RECORD, 'zodiacsystems')).toBe('');
		expect(reqSpy).toHaveBeenCalledTimes(2);
	});
});

// 调波 / 龙盘 / 重置盘带参数:此刻要的参数与页面出图时记的参数比,对不上就现算(不拿上一次出的那张顶替)
describe('派生盘参数:此刻要的 vs 页面快照记的', ()=>{
	test('调波数:没设 = 9;夹取整数 1-360;坏值回 9', ()=>{
		expect(derivedParamsFor('harmonic', {})).toEqual({ harmonic: 9 });
		expect(derivedParamsFor('harmonic', { harmonic: 7 })).toEqual({ harmonic: 7 });
		expect(derivedParamsFor('harmonic', { harmonic: '999' })).toEqual({ harmonic: 360 });
		expect(derivedParamsFor('harmonic', { harmonic: 'x' })).toEqual({ harmonic: 9 });
		expect(clampHarmonic('2.5')).toBe(2);
	});
	test('龙盘宫位口径:记录上设了用记录的,没设用辅盘页保存值,都没有 = 整宫;不认的值不算设了', ()=>{
		expect(derivedParamsFor('draconic', {}, '')).toEqual({ draconicHouses: 'whole' });
		expect(derivedParamsFor('draconic', {}, 'shift')).toEqual({ draconicHouses: 'shift' });
		expect(derivedParamsFor('draconic', { draconicHouses: 'whole' }, 'shift')).toEqual({ draconicHouses: 'whole' });
		expect(derivedParamsFor('draconic', { draconicHouses: 'bogus' }, 'shift')).toEqual({ draconicHouses: 'shift' });
	});
	test('重置地点:经纬成对且在范围内才算给了(四位小数);只给一个 / 越界 / 空串 = 没给', ()=>{
		expect(derivedParamsFor('relocation', { relocLat: 40.71284, relocLon: -74.006 })).toEqual({ relocLat: 40.7128, relocLon: -74.006 });
		expect(derivedParamsFor('relocation', { relocLat: 40.7 })).toBeNull();
		expect(derivedParamsFor('relocation', { relocLat: '', relocLon: '' })).toBeNull();
		expect(derivedParamsFor('relocation', { relocLat: 95, relocLon: 10 })).toBeNull();
		expect(derivedParamsFor('relocation', { relocLat: 0, relocLon: 0 })).toEqual({ relocLat: 0, relocLon: 0 });
	});
	test('不带参数的键回 null', ()=>{
		['hellenastro', 'dwadasamsa', 'transformchart', 'zodiacsystems', 'astrochart'].forEach((k)=>expect(derivedParamsFor(k, { harmonic: 7 })).toBeNull());
	});
	test('比对:没有要比的 = 同;页面快照没记参数 = 不同;逐键相等才同', ()=>{
		expect(sameDerivedParams(undefined, null)).toBe(true);
		expect(sameDerivedParams(undefined, { harmonic: 9 })).toBe(false);
		expect(sameDerivedParams({ harmonic: 9 }, { harmonic: 9 })).toBe(true);
		expect(sameDerivedParams({ harmonic: 7 }, { harmonic: 9 })).toBe(false);
		expect(sameDerivedParams({ relocLat: 40.7128, relocLon: -74.006 }, { relocLat: 40.7128, relocLon: -74.006 })).toBe(true);
		expect(sameDerivedParams({ relocLat: 40.7128, relocLon: 121 }, { relocLat: 40.7128, relocLon: -74.006 })).toBe(false);
	});
});

describe('派生盘专属段:页面与无头同一份', ()=>{
	test('三张页面都从 derivedAstroLabs 取专属段,并在出盘即存时记下出图参数', ()=>{
		const lab = (f)=>fs.readFileSync(path.resolve(__dirname, '../../components/auxchart', f), 'utf8');
		expect(lab('AstroHarmonicLab.js')).toContain("()=>harmonicSnapshotLines(res, this.state.harmonic), { derivedParams: { harmonic } }");
		expect(lab('AstroDraconicLab.js')).toContain("()=>draconicSnapshotLines(res, houseMode, this.props.value), { derivedParams: { draconicHouses: houseMode } }");
		expect(lab('AstroRelocationLab.js')).toContain('()=>relocationSnapshotSpecialty(this.props.value, res.chart, relocLat, relocLon, extras)');
		expect(lab('AstroRelocationLab.js')).toContain('{ derivedParams: { relocLat: Number(relocLat), relocLon: Number(relocLon) } }');
	});
	test('调波盘段:H 数 / 位置 / 同频;没有内容回空', ()=>{
		const res = { harmonic: 7, positions: [{ id: 'Sun', natalLon: 280.123, sign: 'Aries', signlon: 0.861 }], conjunctions: [{ a: 'Sun', b: 'Moon', orb: 0.1234 }] };
		expect(harmonicSnapshotLines(res, 9)).toEqual(['[调波盘]', '调波数：H7', '日：本命黄经 280.12° → 调波 牡羊 0.86°', '同频：日 合 月（误差 0.123）']);
		expect(harmonicSnapshotLines({}, 9)).toEqual(['[调波盘]', '调波数：H9']);
	});
	test('龙盘段:交点真 / 平如实写;宫位口径两家', ()=>{
		const res = { nodeLon: 353.289, positions: [], conjunctions: [] };
		expect(draconicSnapshotLines(res, 'whole', { params: {} })).toEqual(['[龙盘]', '北交点 353.29°（平交点） → 归零白羊 0°（龙盘基准）', '宫位口径：整宫(随龙盘上升)']);
		expect(draconicSnapshotLines(res, 'shift', { params: { westNodeType: 'true' } })[1]).toContain('真交点');
		expect(draconicSnapshotLines(res, 'shift', {})[2]).toBe('宫位口径：本命宫头平移(保留分宫制)，各星落宫与本命一致');
	});
	test('重置盘段:地点 + 四角对照 + 两段附文(段间空一行)', ()=>{
		const natal = { chart: { objects: [{ id: 'Asc', sign: 'Leo', signlon: 12.345 }] } };
		const reloc = { chart: { objects: [{ id: 'Asc', sign: 'Virgo', signlon: 1 }] } };
		const out = relocationSnapshotSpecialty(natal, reloc, 40.7128, -74.006, { detailsText: '[盘面细节]\nA', classicalText: '' });
		expect(out).toHaveLength(1);
		expect(out[0]).toBe('[重置盘]\n重置地点：纬 40.7128 / 经 -74.006\n上升：本命 狮子 12.35° → 重置后 室女 1.00°\n\n[盘面细节]\nA');
	});
});

describe('调波盘无头复算按参数取', ()=>{
	const { buildDerivedLabHeadless } = require('../aiAnalysisContext/derivedLabsHeadless');
	const { __resetRegeneratedSnapshotCacheForTests } = require('../aiAnalysisContext/snapshotMatch');
	const chartParamsMod = require('../aiAnalysisContext/chartParams');
	const requestMod = require('../request');
	const RECORD = { birth: '1990-01-01 08:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', name: '甲' };
	let natalSpy; let reqSpy;
	beforeEach(()=>{
		__resetRegeneratedSnapshotCacheForTests();
		window.localStorage.clear();
		natalSpy = jest.spyOn(chartParamsMod, 'fetchChartResultForRecord').mockResolvedValue({ params: { date: '1990/01/01', time: '08:00:00', zone: '+08:00', lat: '31n14', lon: '121e28' } });
		reqSpy = jest.spyOn(requestMod, 'default').mockImplementation((url, opts)=>{ const b = JSON.parse(opts.body); return Promise.resolve({ Result: { harmonic: b.harmonic, chart: { objects: [], houses: [] }, positions: [], conjunctions: [] } }); });
	});
	afterEach(()=>{ natalSpy.mockRestore(); reqSpy.mockRestore(); });
	test('没设 = H9;记录上设 7 = H7;两者各算各的、互不串缓存', async ()=>{
		const a = await buildDerivedLabHeadless(RECORD, 'harmonic');
		const b = await buildDerivedLabHeadless({ ...RECORD, harmonic: 7 }, 'harmonic');
		expect(a).toContain('调波数：H9');
		expect(b).toContain('调波数：H7');
		expect(reqSpy.mock.calls.map((c)=>JSON.parse(c[1].body).harmonic)).toEqual([9, 7]);
		expect(reqSpy.mock.calls[0][0]).toMatch(/\/astroextra\/harmonic$/);
		expect(await buildDerivedLabHeadless({ ...RECORD, harmonic: 7 }, 'harmonic')).toBe(b);
		expect(reqSpy).toHaveBeenCalledTimes(2);
	});
});
