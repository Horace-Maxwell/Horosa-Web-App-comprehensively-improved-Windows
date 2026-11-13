// 重置盘的「盘面细节」「古典格局」按重置后地点算,进同一份快照(此前派生盘快照不产这两段,挂载里勾了也是空;
// 导出另按本命出生地补一份,与重置盘的宫位 / 四轴对不上)。
// 行为口径:①出盘即存(这一刻起读到的就是这张盘,两段取回后补写);②同一口径两段只取一次;
// ③盘面细节各项 / 恒星轨 / 空亡古典义改了 → 按新口径重取重存;④导出前补算会等两段取齐;
// ⑤补上本命星座断语的盘按回包复用同一个对象(盘面组件按引用判重画)。
import fs from 'fs';
import path from 'path';

jest.mock('../request', ()=>({ __esModule: true, default: jest.fn() }));
jest.mock('../derivedAstroSnapshot', ()=>({ saveDerivedAstroSnapshot: jest.fn() }));

const request = require('../request').default;
const { saveDerivedAstroSnapshot } = require('../derivedAstroSnapshot');
const { CHART_DETAIL_SETTINGS, CHART_DETAIL_SETTINGS_EVENT, notifyChartDetailSettingsChanged } = require('../chartDetails');
const { prepareModuleSnapshot } = require('../moduleSnapshotRefresh');
const AstroRelocationLab = require('../../components/auxchart/AstroRelocationLab').default;

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

const NATAL = {
	params: { date: '1990/01/01', time: '08:00:00', zone: '+08:00', lat: '31n14', lon: '121e28' },
	predict: { PlanetSign: { Sun: ['太阳在摩羯'] } },
	chart: { objects: [] },
};
const RELOC_CHART = { chart: { objects: [] }, params: { lat: '40n00' } };

function lab(){
	const inst = new AstroRelocationLab({ value: NATAL, fields: {} });
	inst.setState = (patch, cb)=>{ inst.state = { ...inst.state, ...(typeof patch === 'function' ? patch(inst.state) : patch) }; if(cb){ cb(); } };
	inst.forceUpdate = ()=>{};
	return inst;
}

// 按 URL 回包;chartdetails 回包随调用次数变(看重取后是不是新口径)
function routeRequests(){
	const calls = { relocation: 0, chartdetails: 0, analysis: 0 };
	request.mockImplementation((url, opts)=>{
		const body = JSON.parse(opts.body);
		if(url.endsWith('/astroextra/relocation')){ calls.relocation += 1; return Promise.resolve({ Result: { chart: RELOC_CHART } }); }
		if(url.endsWith('/astroextra/chartdetails')){ calls.chartdetails += 1; return Promise.resolve({ Result: { __lat: body.lat, __n: calls.chartdetails } }); }
		if(url.endsWith('/astroextra/analysis')){ calls.analysis += 1; return Promise.resolve({ Result: {} }); }
		return Promise.resolve({});
	});
	return calls;
}

jest.mock('../chartDetails', ()=>{
	const actual = jest.requireActual('../chartDetails');
	return { ...actual, buildChartDetailsText: (r)=>(r && r.__n ? `[盘面细节]\n第${r.__n}次 纬${r.__lat}` : '') };
});
jest.mock('../astroAiSnapshot', ()=>({ buildClassicalAnalysisSection: ()=>'[古典格局]\n格局行' }));

const lastSnapshotText = ()=>{
	const calls = saveDerivedAstroSnapshot.mock.calls;
	const [, , , lines] = calls[calls.length - 1];
	return lines()[0];
};

beforeEach(()=>{
	request.mockReset();
	saveDerivedAstroSnapshot.mockReset();
	window.localStorage.clear();
});

describe('重置盘盘面细节 / 古典格局按重置地点', ()=>{
	test('出盘即存,两段取回后补写;两段都按重置经纬取', async ()=>{
		const calls = routeRequests();
		const inst = lab();
		inst._mounted = true;
		inst.state = { ...inst.state, relocLat: 40, relocLon: 116.4, isNatalPlace: false };
		const loading = inst.load();
		await loading;
		expect(calls).toEqual({ relocation: 1, chartdetails: 1, analysis: 1 });
		expect(saveDerivedAstroSnapshot).toHaveBeenCalledTimes(2);
		const first = saveDerivedAstroSnapshot.mock.calls[0][3]()[0];
		expect(first).toContain('[重置盘]');
		expect(first).not.toContain('[盘面细节]');
		const text = lastSnapshotText();
		expect(text).toContain('[盘面细节]\n第1次 纬40n00');
		expect(text).toContain('[古典格局]');
		expect(saveDerivedAstroSnapshot.mock.calls[1][0]).toBe('relocation');
		const analysisBody = JSON.parse(request.mock.calls.find(([u])=>u.endsWith('/astroextra/analysis'))[1].body);
		expect(analysisBody.lat).toBe('40n00');
		expect(analysisBody._v).toBe('cls1');
	});

	test('同一口径不重取;盘面细节改了 → 按新口径重取重存(挂载不留旧口径)', async ()=>{
		const calls = routeRequests();
		const inst = lab();
		inst._mounted = true;
		await inst.load();
		expect(calls.chartdetails).toBe(1);
		await inst.refreshRelocExtras();   // 口径没变:直接用已取到的重存,不再请求
		expect(calls.chartdetails).toBe(1);
		const cur = CHART_DETAIL_SETTINGS.load();
		CHART_DETAIL_SETTINGS.save({ detailMundo: cur.detailMundo === 'campanus' ? 'regiomontanus' : 'campanus' });
		await inst.refreshRelocExtras();
		expect(calls.chartdetails).toBe(2);
		expect(lastSnapshotText()).toContain('第2次');
	});

	test('盘面细节页改设置会广播,重置盘页据此重取', ()=>{
		const seen = [];
		const on = (e)=>seen.push(e.detail);
		window.addEventListener(CHART_DETAIL_SETTINGS_EVENT, on);
		notifyChartDetailSettingsChanged({ detailLunar: CHART_DETAIL_SETTINGS.load().detailLunar });
		window.removeEventListener(CHART_DETAIL_SETTINGS_EVENT, on);
		expect(seen.length).toBe(1);
		const details = read('components/astro/AstroChartDetails.js');
		expect(details).toMatch(/CHART_DETAIL_SETTINGS\.save\(\{ \[field\]: value \}\);\s*notifyChartDetailSettingsChanged\(\{ \[field\]: value \}\);/);
		const relocLab = read('components/auxchart/AstroRelocationLab.js');
		['window.addEventListener(CHART_DETAIL_SETTINGS_EVENT, this.handleExtrasSettingsChanged);', 'window.addEventListener(CLASSICAL_GLOBALS_EVENT, this.handleExtrasSettingsChanged);',
			'window.addEventListener(MODULE_SNAPSHOT_PREPARE_EVENT, this.handleSnapshotPrepareRequest);'].forEach((s)=>expect(relocLab).toContain(s));
	});

	test('导出前补算:口径变了就等两段按新口径取齐再读', async ()=>{
		const calls = routeRequests();
		const inst = lab();
		inst._mounted = true;
		await inst.load();
		window.addEventListener('horosa:prepare-module-snapshot', inst.handleSnapshotPrepareRequest);
		const cur = CHART_DETAIL_SETTINGS.load();
		CHART_DETAIL_SETTINGS.save({ detailVariant: cur.detailVariant === 'classic' ? 'improved' : 'classic' });
		await prepareModuleSnapshot('relocation');
		expect(calls.chartdetails).toBe(2);
		expect(lastSnapshotText()).toContain('第2次');
		await prepareModuleSnapshot('hellenastro');   // 别的槽不归它答
		expect(calls.chartdetails).toBe(2);
		window.removeEventListener('horosa:prepare-module-snapshot', inst.handleSnapshotPrepareRequest);
		// 导出读派生盘快照前先等页面补算
		const ext = read('utils/aiExport/extractors.js');
		const i = ext.indexOf('if(context && DERIVED_ASTRO_MODULE_KEYS.indexOf(context.key) >= 0){');
		expect(ext.indexOf('await prepareModuleSnapshot(context.key);', i)).toBeLessThan(ext.indexOf('getModuleCachedContent(context.key)', i));
	});

	test('两段都没取到不记账,下回再取', async ()=>{
		const calls = { chartdetails: 0 };
		request.mockImplementation((url)=>{
			if(url.endsWith('/astroextra/relocation')){ return Promise.resolve({ Result: { chart: RELOC_CHART } }); }
			if(url.endsWith('/astroextra/chartdetails')){ calls.chartdetails += 1; }
			return Promise.reject(new Error('down'));
		});
		const inst = lab();
		inst._mounted = true;
		await inst.load();
		await inst.refreshRelocExtras();
		expect(calls.chartdetails).toBe(2);
	});

	test('「可能性」借本命星座断语;同一回包复用同一个对象(不每次渲染整盘重画)', ()=>{
		const inst = lab();
		const a = inst.relocChartFor(RELOC_CHART);
		expect(a.predict.PlanetSign).toBe(NATAL.predict.PlanetSign);
		expect(inst.relocChartFor(RELOC_CHART)).toBe(a);
		expect(inst.relocChartFor({ ...RELOC_CHART })).not.toBe(a);
		const own = { ...RELOC_CHART, predict: { PlanetSign: { Sun: ['自己的'] } } };
		expect(inst.relocChartFor(own)).toBe(own);
		const relocLab = read('components/auxchart/AstroRelocationLab.js');
		expect(relocLab).toContain('const relocChart = this.relocChartFor(result.chart || null);');
		expect(relocLab).not.toMatch(/withNatalPlanetSign\(result\.chart/);
	});

	test('导出遇重置盘不再按本命出生地另补盘面细节', ()=>{
		const pipe = read('utils/aiExport/pipeline.js');
		expect(pipe).toContain("const relocated = usedExportKey === 'relocation' || (usedExportKey === 'astrochart_like' && derivedName.includes('重置'));");
		expect(pipe).toContain("const derived = relocated ? [] : await Promise.all([fetchAstroClassicalAnalysisSectionForExport(), fetchChartDetailsSectionForExport()]);");
	});

	test('变换盘不再列一个永远没内容的「可能性」段', ()=>{
		const { AI_EXPORT_PRESET_SECTIONS } = require('../aiExport/presets');
		expect(AI_EXPORT_PRESET_SECTIONS.transformchart).not.toContain('可能性');
		expect(AI_EXPORT_PRESET_SECTIONS.relocation).toContain('可能性');
	});
});
