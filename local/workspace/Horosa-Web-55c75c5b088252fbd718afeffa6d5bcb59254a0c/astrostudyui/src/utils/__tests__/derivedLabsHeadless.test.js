// 变换盘 / 黄道制无头复算(审计缺口:辅盘页没出过这张盘时,AI 挂载与外部智能体拿到的一直是 missing)。
import fs from 'fs';
import path from 'path';
import { transformRequestOptions, DERIVED_LAB_HEADLESS_KEYS } from '../aiAnalysisContext/derivedLabsHeadless';
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
		expect(DERIVED_LAB_HEADLESS_KEYS).toEqual(['transformchart', 'zodiacsystems']);
		const ctx = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/techniqueContext.js'), 'utf8');
		expect(ctx).toContain('if(!single.available && DERIVED_LAB_HEADLESS_KEYS.indexOf(key) >= 0 && source.record){');
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
