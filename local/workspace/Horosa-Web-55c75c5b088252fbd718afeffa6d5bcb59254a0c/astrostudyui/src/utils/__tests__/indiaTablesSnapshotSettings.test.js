// 印占穿界表进快照 / 导出段,两张表的显示口径跨会话保留,西占 Dirah 经典档进快照,八重合 Dosha 标记与男方跟页面。
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import React from 'react';
import {
	buildTransitEventLines, setIndiaTransitSnapshot, indiaTransitSnapshotFor, indiaTransitBirthSig, __resetIndiaTransitSnapshotForTests,
	TRANSIT_SNAPSHOT_MAX_ROWS, buildExtraTableLines, buildAshtakootaLines, ashtakootaDoshas, INDIA_TABLE_SETTINGS,
	rememberAshtakootaMaleSide, pickedAshtakootaMaleSide, __resetAshtakootaMalePicksForTests,
} from '../indiaExtraTables';
import { AI_EXPORT_PRESET_SECTIONS, AI_EXPORT_SETTINGS_VERSION, __aiExportTesting__ } from '../aiExport';

jest.mock('../request', ()=>({ __esModule: true, default: jest.fn() }));

global.React = React;
const request = require('../request').default;
const { normalizeAIExportSettings } = __aiExportTesting__;
const SRC = path.resolve(__dirname, '../..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

const ROW = (i)=>({ jd: i, date: '2026-11-08', time: '10:20:30', planet: 'Mars', kind: 'sign', sign: 3, relation: 'enemy' });

function walk(node, visit){
	if(!node || typeof node !== 'object'){ return; }
	if(Array.isArray(node)){ node.forEach((n)=>walk(n, visit)); return; }
	visit(node);
	if(node.props){ walk(node.props.children, visit); }
}
function textOf(node){
	const out = [];
	const go = (n)=>{
		if(n === null || n === undefined || typeof n === 'boolean'){ return; }
		if(typeof n === 'string' || typeof n === 'number'){ out.push(`${n}`); return; }
		if(Array.isArray(n)){ n.forEach(go); return; }
		if(n.props){ go(n.props.children); }
	};
	go(node);
	return out.join('');
}

beforeEach(()=>{
	__resetIndiaTransitSnapshotForTests();
	__resetAshtakootaMalePicksForTests();
	request.mockReset();
	window.localStorage.clear();
});

describe('穿界时刻进快照', ()=>{
	const entry = (rows, extra)=>({ start: '2026/11/08', transitPlanet: 'Mars', transitKind: 'sign', transitDays: 366, ayanamsa: 'Lahiri', result: { rows, total: rows.length, ...(extra || {}) } });

	test('段头写明所选的星、事件、范围,表四列', ()=>{
		const text = buildTransitEventLines(entry([ROW(1)])).join('\n');
		expect(text).toContain('起始 2026/11/08,范围 一年,星 火星,事件 入星座;共 1 条');
		expect(text).toContain('岁差 Lahiri');
		expect(text).toContain('| 时刻 | 星 | 进入 | 座主 |');
		expect(text).toContain('| 2026-11-08 10:20 | 火 | 巨蟹 | 敌 |');
	});

	test('超过上限只收前若干条并写明;没有事件写原因;没结果不出段', ()=>{
		const many = Array.from({ length: TRANSIT_SNAPSHOT_MAX_ROWS + 50 }, (_, i)=>ROW(i));
		const lines = buildTransitEventLines(entry(many, { total: 600 }));
		expect(lines.filter((l)=>l.startsWith('| 2026')).length).toBe(TRANSIT_SNAPSHOT_MAX_ROWS);
		expect(lines[lines.length - 1]).toContain(`只列前 ${TRANSIT_SNAPSHOT_MAX_ROWS} 条(共 600 条)`);
		expect(buildTransitEventLines(entry([]))).toContain('这段时间里没有所选的穿界事件');
		expect(buildTransitEventLines(null)).toEqual([]);
		expect(buildTransitEventLines({ start: 'x' })).toEqual([]);
	});

	test('快照槽按出生时空认盘,别的盘认不上', ()=>{
		const birth = { date: '1990/01/01', time: '08:00:00', zone: '+08:00', lat: '31n14', lon: '121e28' };
		setIndiaTransitSnapshot({ birthSig: indiaTransitBirthSig(birth), ...entry([ROW(1)]) });
		expect(indiaTransitSnapshotFor(indiaTransitBirthSig(birth))).toBeTruthy();
		expect(indiaTransitSnapshotFor(indiaTransitBirthSig({ ...birth, time: '09:00:00' }))).toBe(null);
		setIndiaTransitSnapshot(null);
		expect(indiaTransitSnapshotFor(indiaTransitBirthSig(birth))).toBe(null);
	});

	test('印占页与择日内嵌盘各有一张表,互不顶掉;清空只清自己那张', ()=>{
		const main = { date: '1990/01/01', time: '08:00:00', zone: '+08:00', lat: '31n14', lon: '121e28' };
		const zeri = { ...main, date: '2026/03/01', time: '10:00:00' };
		setIndiaTransitSnapshot({ birthSig: indiaTransitBirthSig(main), ...entry([ROW(1)]) });
		setIndiaTransitSnapshot({ birthSig: indiaTransitBirthSig(zeri), ...entry([ROW(2)]), transitKind: 'pada' });
		expect(indiaTransitSnapshotFor(indiaTransitBirthSig(main)).transitKind).toBe('sign');
		expect(indiaTransitSnapshotFor(indiaTransitBirthSig(zeri)).transitKind).toBe('pada');
		setIndiaTransitSnapshot(null, indiaTransitBirthSig(zeri));
		expect(indiaTransitSnapshotFor(indiaTransitBirthSig(zeri))).toBe(null);
		expect(indiaTransitSnapshotFor(indiaTransitBirthSig(main))).toBeTruthy();
	});

	test('择日内嵌的穿界表请本宿主槽重存,不再请印占页', async ()=>{
		const IndiaTransitEvents = require('../../components/astro/indiaMain/IndiaTransitEvents').default;
		const params = { date: '2026/03/01', time: '10:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', siderealAyanamsa: 'Lahiri' };
		const seen = [];
		const onRefresh = (evt)=>seen.push(evt.detail.module);
		window.addEventListener('horosa:refresh-module-snapshot', onRefresh);
		const inst = new IndiaTransitEvents({ params, start: '2026/11/08', memo: {}, snapshotScope: 'indiazeri' });
		inst.setState = (patch)=>{ inst.state = { ...inst.state, ...patch }; };
		inst.forceUpdate = ()=>{};
		inst._mounted = true;
		request.mockResolvedValueOnce({ Result: { rows: [ROW(1)], total: 1 } });
		await inst.load();
		inst.componentDidUpdate();
		window.removeEventListener('horosa:refresh-module-snapshot', onRefresh);
		expect(seen).toContain('indiazeri');
		expect(seen).not.toContain('indiachart');
		inst.componentWillUnmount();
		expect(require('./helpers/sourceSet').readSource(path.join(SRC, 'components/astro/IndiaChartMain.js'))).toContain('memo={this.transitEventsMemo} snapshotScope={indiaSnapshotScope(this.props.techniqueScope)} />');
	});

	test('无头 / 导出补段:页面那张与所选、起始、岁差全对得上才用它,否则按所选现取', async ()=>{
		const { appendIndiaTransitSection, fieldsToParams, indiaTransitEventParams } = require('../../components/astro/IndiaChart');
		const fields = {
			date: { value: moment('1990-01-01 08:00:00') }, time: { value: moment('1990-01-01 08:00:00') }, ad: { value: 1 }, zone: { value: '+08:00' },
			lat: { value: '31n14' }, lon: { value: '121e28' }, gpsLat: { value: 31.2 }, gpsLon: { value: 121.5 }, tradition: { value: 0 },
			indiaTransitDate: { value: '2026/11/08' }, indiaTransitPlanet: { value: 'all' }, indiaTransitKind: { value: 'sign' }, indiaTransitDays: { value: 90 },
		};
		const params = indiaTransitEventParams(fieldsToParams(fields));
		const pageEntry = { birthSig: indiaTransitBirthSig(params), start: '2026/11/08', transitPlanet: 'all', transitKind: 'sign', transitDays: 90, ayanamsa: params.siderealAyanamsa, result: { rows: [ROW(1)], total: 1 } };
		setIndiaTransitSnapshot(pageEntry);
		const usePage = await appendIndiaTransitSection('[起盘信息]\na', fields);
		expect(request).not.toHaveBeenCalled();   // 齿轮缺省本身带值,也照样用页面那张
		expect(usePage).toContain('[穿界时刻]');
		expect(usePage).toContain('星 七星,事件 入星座');
		// 齿轮要的是入足:页面那张(入星座)不能顶替,按所选现取
		request.mockResolvedValueOnce({ Result: { rows: [ROW(3)], total: 1 } });
		const refetched = await appendIndiaTransitSection('[起盘信息]\na', { ...fields, indiaTransitKind: { value: 'pada' } });
		expect(request).toHaveBeenCalledTimes(1);
		expect(JSON.parse(request.mock.calls[0][1].body).transitKind).toBe('pada');
		expect(refetched).toContain('事件 入足');
		// 起始日不同也现取
		request.mockResolvedValueOnce({ Result: { rows: [ROW(4)], total: 1 } });
		await appendIndiaTransitSection('[起盘信息]\na', { ...fields, indiaTransitDate: { value: '2027/01/01' } });
		expect(request).toHaveBeenCalledTimes(2);
	});

	test('穿界表:算好写槽并请印占页重存快照;换了所选,旧表先清掉', async ()=>{
		const IndiaTransitEvents = require('../../components/astro/indiaMain/IndiaTransitEvents').default;
		const params = { date: '1990/01/01', time: '08:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', siderealAyanamsa: 'Lahiri' };
		const seen = [];
		const onRefresh = (evt)=>seen.push(evt.detail.module);
		window.addEventListener('horosa:refresh-module-snapshot', onRefresh);
		const inst = new IndiaTransitEvents({ params, start: '2026/11/08', memo: {} });
		inst.setState = (patch)=>{ inst.state = { ...inst.state, ...patch }; };
		inst.forceUpdate = ()=>{};
		inst._mounted = true;
		request.mockResolvedValueOnce({ Result: { rows: [ROW(1)], total: 1 } });
		await inst.load();
		inst.componentDidUpdate();
		const slot = indiaTransitSnapshotFor(indiaTransitBirthSig(params));
		expect(slot && slot.transitKind).toBe('sign');
		expect(buildTransitEventLines(slot).join('\n')).toContain('范围 90 天,星 七星,事件 入星座');
		expect(seen).toContain('indiachart');
		inst.state = { ...inst.state, transitKind: 'pada' };
		request.mockReturnValueOnce(new Promise(()=>{}));
		inst.componentDidUpdate();
		expect(indiaTransitSnapshotFor(indiaTransitBirthSig(params))).toBe(null);
		window.removeEventListener('horosa:refresh-module-snapshot', onRefresh);
		inst.componentWillUnmount();
	});

	test('印占快照接上了这一段,无头复算缺省也取', ()=>{
		const src = read('components/astro/IndiaChart.js');
		expect(src).toContain("ensureSection(lines, '穿界时刻', transitLines)");
		expect(src).toMatch(/fetchIndiaTransitLinesHeadless\(params, fields\)/);
		expect(src).toContain('/astroextra/transitevents');
	});

	test('页面 fields 与快照认的是同一张盘', ()=>{
		const { indiaTransitSnapshotLines, fieldsToParams, indiaTransitEventParams } = require('../../components/astro/IndiaChart');
		const fields = {
			date: { value: moment('1990-01-01 08:00:00') }, time: { value: moment('1990-01-01 08:00:00') }, ad: { value: 1 }, zone: { value: '+08:00' },
			lat: { value: '31n14' }, lon: { value: '121e28' }, gpsLat: { value: 31.2 }, gpsLon: { value: 121.5 }, tradition: { value: 0 },
		};
		const params = indiaTransitEventParams(fieldsToParams(fields));
		setIndiaTransitSnapshot({ birthSig: indiaTransitBirthSig(params), ...entry([ROW(1)]) });
		expect(indiaTransitSnapshotLines(fields).join('\n')).toContain('星 火星');
	});
});

describe('导出段', ()=>{
	test('印占 preset 有「穿界时刻」,v64 存档里自定义过印占的补上,v65 不再补', ()=>{
		expect(AI_EXPORT_PRESET_SECTIONS.indiachart).toContain('穿界时刻');
		expect(AI_EXPORT_SETTINGS_VERSION).toBeGreaterThanOrEqual(65);
		const n64 = normalizeAIExportSettings({ version: 64, sections: { indiachart: ['起盘信息'] } });
		expect(n64.sections.indiachart).toEqual(['起盘信息', '穿界时刻']);
		const n65 = normalizeAIExportSettings({ version: 65, sections: { indiachart: ['起盘信息'] } });
		expect(n65.sections.indiachart).toEqual(['起盘信息']);
		const untouched = normalizeAIExportSettings({ version: 64, sections: { ziwei: ['宫位总览'] } });
		expect(untouched.sections.indiachart).toBeUndefined();
	});
});

describe('西占 Dirah 经典档', ()=>{
	const base = { available: true, dirahWestern: [{ planet: 'Uranus', scores: { 1: 30 } }, { planet: 'Sun', scores: { 2: 20 } }] };
	test('与改进档不同的星单独列出', ()=>{
		const text = buildExtraTableLines({ ...base, dirahWesternClassic: [{ planet: 'Uranus', scores: {} }, { planet: 'Sun', scores: { 2: 20 } }] }).join('\n');
		expect(text).toContain('Dirah 西占版(经典口径');
		expect(text.split('经典口径')[1]).toContain('| 星 | 本座 |');
		expect(text.split('经典口径')[1]).toContain('| 天 |  |');
		expect(text.split('经典口径')[1]).not.toMatch(/\| 太阳/);
	});
	test('全同写一句', ()=>{
		const text = buildExtraTableLines({ ...base, dirahWesternClassic: base.dirahWestern }).join('\n');
		expect(text).toContain('Dirah 西占版(经典口径):与上表逐项相同');
	});
});

describe('两张表的显示口径跨会话保留', ()=>{
	test('空库 = 出厂值;下拉亲手改了就落盘,读回来是改过的', ()=>{
		// 同一份设置件后来又收了左栏三个纯显示开关(宿数 / 中栏盘面 / 盘面叠加),出厂值一并核对
		expect(INDIA_TABLE_SETTINGS.load()).toEqual({ yogaTableVariant: 'improved', yogaTableScope: 'hit', dirahVariant: 'improved', indiaNakshatraCount: 27, indiaStageMode: 'single', indiaOverlayBB: false, transitPlanet: 'all', transitKind: 'sign', transitDays: 90 });
		const IndiaYogaRuleTable = require('../../components/astro/indiaMain/IndiaYogaRuleTable').default;
		const IndiaExtraTables = require('../../components/astro/indiaMain/IndiaExtraTables').default;
		const onChange = jest.fn();
		const selects = [];
		const collect = (tree)=>walk(tree, (n)=>{ if(n.props && typeof n.props.onChange === 'function' && n.props.value !== undefined){ selects.push(n); } });
		collect(IndiaYogaRuleTable({ data: { rows: [], hits: 0, classicHits: 0 }, variant: 'improved', scope: 'hit', onChange }));
		selects[0].props.onChange('classic');
		selects[1].props.onChange('all');
		const extra = IndiaExtraTables({ data: { available: true, dirah: [], dirahClassic: [], dirahTypes: {}, dirahWestern: [], samaya: [], sphuta: [] }, variant: 'improved', onChange });
		walk(extra, (n)=>{ if(typeof n.type === 'function' && n.type.name === 'DirahCard'){ collect(n.type(n.props)); } });
		selects[selects.length - 1].props.onChange('classic');
		expect(onChange).toHaveBeenCalledWith({ yogaTableVariant: 'classic' });
		expect(INDIA_TABLE_SETTINGS.load()).toEqual({ yogaTableVariant: 'classic', yogaTableScope: 'all', dirahVariant: 'classic', indiaNakshatraCount: 27, indiaStageMode: 'single', indiaOverlayBB: false, transitPlanet: 'all', transitKind: 'sign', transitDays: 90 });
	});

	test('印占页构造时读保存值', ()=>{
		const { readSource } = require('./helpers/sourceSet');   // 门面 + indiaMain/ 子模块全集
		expect(readSource(path.join(SRC, 'components/astro/IndiaChartMain.js'))).toContain('...INDIA_TABLE_SETTINGS.load(),');
	});
});

describe('穿界表滚动盒不被全站摊平规则废掉', ()=>{
	test('两条印占选择器都排除了滚动盒,穿界表带这个类名', ()=>{
		const less = read('layouts/app/14-page-fixes.less');
		expect(less).toContain('.horosa-india-tabs [style*="overflow-y: auto"]:not(.horosa-india-scroll-box),');
		expect(less).toContain('.horosa-india-tabs [style*="overflow: auto"]:not(.horosa-india-scroll-box),');
		expect(less).not.toMatch(/\.horosa-india-tabs \[style\*="overflow(-y)?: auto"\],/);
		expect(read('components/astro/indiaMain/IndiaTransitEvents.js')).toContain('scrollClassName="horosa-india-scroll-box"');
	});
});

describe('八重合 Dosha', ()=>{
	const KOOTA = { rows: [{ name: 'Nadi', max: 8, score: 0, classic: 0 }], total: 20, classicTotal: 20, max: 36, maleSide: 'inner', groomSign: 0, brideSign: 0, groomNakshatra: 1, brideNakshatra: 2 };
	test('0 分标「有 Dosha」并写化解条件;快照同写,注明不改分', ()=>{
		const result = { ...KOOTA, doshas: [{ koota: 'Nadi', present: true, cancel: ['sameSignDifferentNakshatra'] }, { koota: 'Bhakoot', present: true, cancel: [] }] };
		expect(ashtakootaDoshas(result).map((d)=>d.label)).toEqual(['Nadi Dosha(脉)', 'Bhakoot Dosha(星座距)']);
		const text = buildAshtakootaLines(result).join('\n');
		expect(text).toContain('有 Nadi Dosha(脉)(该项 0 分);满足化解条件:两人月亮同座不同宿');
		expect(text).toContain('有 Bhakoot Dosha(星座距)(该项 0 分);没有满足本页列出的化解条件');
		expect(text).toContain('分数照原样');
	});
	test('两项都不为 0 写一句;老回包没有 doshas 不出这行', ()=>{
		const none = { ...KOOTA, doshas: [{ koota: 'Nadi', present: false, cancel: [] }, { koota: 'Bhakoot', present: false, cancel: [] }] };
		expect(buildAshtakootaLines(none).join('\n')).toContain('没有 Nadi / Bhakoot Dosha');
		expect(buildAshtakootaLines(KOOTA).join('\n')).not.toContain('Dosha');
	});
	test('页面卡片', ()=>{
		const AstroAshtakoota = require('../../components/relative/AstroAshtakoota').default;
		const inst = new AstroAshtakoota({ params: null });
		const card = inst.renderDoshas({ ...KOOTA, doshas: [{ koota: 'Bhakoot', present: true, cancel: ['friendlySignLords'] }] });
		const text = textOf(card);
		expect(text).toContain('有 Dosha');
		expect(text).toContain('Bhakoot Dosha(星座距)');
		expect(text).toContain('两人月亮所在座的座主互为天然之友');
		expect(inst.renderDoshas(KOOTA)).toBe(null);
	});
});

describe('八重合男方:挂载跟页面所选', ()=>{
	const recA = { birth: '1990/01/01 08:00:00', zone: '+08:00', lat: '31n14', lon: '121e28', gender: 1 };
	const recB = { birth: '1992/02/02 09:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', gender: 0 };
	const pageParams = (a, b)=>{
		const one = (r)=>{ const [date, time] = r.birth.split(' '); return { date, time, zone: r.zone, lat: r.lat, lon: r.lon }; };
		return { inner: one(a), outer: one(b) };
	};

	test('页内亲手改男方 → 同一对人(含两盘对调)挂载按所改的;改回默认 = 撤销', ()=>{
		const { pairAshtakootaMaleSide } = require('../aiAnalysisContext/pair');
		expect(pairAshtakootaMaleSide(recA, recB)).toBe('inner');
		const AstroAshtakoota = require('../../components/relative/AstroAshtakoota').default;
		const inst = new AstroAshtakoota({ params: pageParams(recA, recB), maleDefault: 'inner' });
		inst.setState = (patch)=>{ inst.state = { ...inst.state, ...patch }; };
		inst.changeMaleSide('outer');
		expect(inst.body().maleSide).toBe('outer');
		expect(pairAshtakootaMaleSide(recA, recB)).toBe('outer');
		expect(pairAshtakootaMaleSide(recB, recA)).toBe('inner');
		// 换盘再换回来:同一对照旧
		const again = new AstroAshtakoota({ params: pageParams(recA, recB), maleDefault: 'inner' });
		expect(again.maleSide()).toBe('outer');
		inst.changeMaleSide('inner');
		expect(pickedAshtakootaMaleSide(pageParams(recA, recB).inner, pageParams(recA, recB).outer)).toBe(null);
		expect(pairAshtakootaMaleSide(recA, recB)).toBe('inner');
	});

	test('别的一对不受影响', ()=>{
		const p = pageParams(recA, recB);
		rememberAshtakootaMaleSide(p.inner, p.outer, 'outer', 'inner');
		const other = pageParams(recA, { ...recB, birth: '1993/03/03 10:00:00' });
		expect(pickedAshtakootaMaleSide(other.inner, other.outer)).toBe(null);
	});

	test('挂载请求带的男方经同一出口', ()=>{
		const src = read('utils/aiAnalysisContext/pair.js');
		expect(src).toContain('maleSide: pairAshtakootaMaleSide(recordA, recordB)');
		expect(src).toMatch(/calibre, pairAshtakootaMaleSide\(recordA, recordB\)\]\.join/);
	});
});

describe('穿界表三项跨会话保留(此前只记在组件与宿主内存里,重开软件 / 备份恢复都回到七星 · 入星座 · 90 天)', ()=>{
	test('改了落盘,读回改过的值;非法值回缺省;无头复算与页面同一份保存值', ()=>{
		const { savedTransitSelection } = require('../indiaExtraTables');
		INDIA_TABLE_SETTINGS.save({ transitPlanet: 'Moon', transitKind: 'nakshatra', transitDays: 366 });
		expect(savedTransitSelection()).toEqual({ transitPlanet: 'Moon', transitKind: 'nakshatra', transitDays: 366 });
		INDIA_TABLE_SETTINGS.save({ transitDays: 45 });
		expect(savedTransitSelection().transitDays).toBe(366);
		const fs = require('fs');
		const path = require('path');
		const comp = fs.readFileSync(path.resolve(__dirname, '../../components/astro/indiaMain/IndiaTransitEvents.js'), 'utf8');
		expect(comp).toContain('INDIA_TABLE_SETTINGS.save({ [field]: value })');
		expect(comp).toContain('...savedTransitSelection()');
		const head = fs.readFileSync(path.resolve(__dirname, '../../components/astro/IndiaChart.js'), 'utf8');
		expect(head).toContain('const saved = savedTransitSelection();');
	});
});
