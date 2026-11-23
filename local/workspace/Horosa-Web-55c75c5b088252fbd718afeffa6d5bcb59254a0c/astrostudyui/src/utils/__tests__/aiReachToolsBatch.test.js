// 外部智能体工具面补齐(同批):玄学史天象 / 分面浏览 / 目录视图 · 合盘按段取与另两张盘 · 档案三项元数据与筛选。
jest.mock('../../services/xuanshi', ()=>{
	const mk = (name)=>jest.fn(async (p)=>({ __call: name, p }));
	return {
		fetchSearch: mk('search'), fetchFigures: mk('figures'), fetchStories: mk('stories'), fetchTechniques: mk('techniques'), fetchEvent: mk('event'), fetchFigure: mk('figure'),
		fetchTechnique: mk('technique'), fetchStory: mk('story'), fetchDynasty: mk('dynasty'), fetchCelestialTerm: mk('term'),
		fetchEvents: jest.fn(), fetchCelestial: jest.fn(), fetchCelestialEvent: jest.fn(), fetchSummary: jest.fn(), fetchDynasties: jest.fn(), fetchCelestialTerms: jest.fn(),
		fetchFacets: jest.fn(), fetchTimeline: jest.fn(), fetchDecadeOmens: jest.fn(), fetchMicrochronology: jest.fn(), fetchDaily: jest.fn(), fetchMap: jest.fn(), fetchPersonsGraph: jest.fn(),
	};
});
jest.mock('../aiAnalysisContext', ()=>{
	const real = jest.requireActual('../aiAnalysisContext');
	return { ...real, getPairSynastryText: jest.fn(), getPairChineseTexts: jest.fn(()=>({})) };
});

import * as xs from '../../services/xuanshi';
import { getPairSynastryText } from '../aiAnalysisContext';
import { searchXuanshiTool, getXuanshiItemTool, browseXuanshiTool, XUANSHI_VIEWS } from '../aiTools/tools/searchXuanshi';
import castRelative from '../aiTools/tools/castRelative';
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { RECORD_RODDEN_VALUES, RECORD_RELATION_VALUES, RECORD_RODDEN_OPTIONS, RECORD_RELATION_OPTIONS } from '../recordMetaOptions';
import { PROPOSAL_EDIT_FIELDS, PROPOSAL_FIELD_LABELS } from '../aiAgent/proposals';
import { normalizeEditIntent } from '../aiTools/tools/proposeRecord';

const fs = require('fs');
const path = require('path');

beforeEach(()=>{ jest.clearAllMocks(); window.localStorage.clear(); __resetToolsForTests(); });

describe('玄学史:天象记录与分面浏览', ()=>{
	const CEL = { event_id: 'TW-1', omen: '五星', subject: '熒惑', action: '守', target: '鬼', modern_date_disp: '前95年', dynasty: '西汉', citation: '《漢書》卷二十六', modern: '荧惑停驻于舆鬼。', original: '熒惑守輿鬼。' };
	test('celestial:检索词与分面映射到接口参数;整页对齐按页取,不对齐从头取再切;卡片带出处与摘要', async ()=>{
		xs.fetchCelestial.mockResolvedValue({ events: [CEL, { ...CEL, event_id: 'TW-2' }], total: 611 });
		const r = await searchXuanshiTool.run({ kind: 'celestial', query: '荧惑', dynasty: '西汉', omen: '五星', yearFrom: -100, yearTo: -50, limit: 2, offset: 4 });
		expect(xs.fetchCelestial).toHaveBeenCalledWith({ q: '荧惑', dynasty: '西汉', omen: '五星', year_from: -100, year_to: -50, page: 3, page_size: 2 });
		expect(r.ok).toBe(true);
		expect(r.data).toMatchObject({ kind: 'celestial', total: 611, totalExact: true, offset: 4, nextOffset: 6 });
		expect(r.data.items[0]).toEqual({ kind: 'celestial_event', id: 'TW-1', title: '五星 · 熒惑 · 守 · 鬼', period: '前95年', dynasty: '西汉', citation: '《漢書》卷二十六', brief: '荧惑停驻于舆鬼。' });
		xs.fetchCelestial.mockResolvedValue({ events: [1, 2, 3, 4, 5].map((i)=>({ ...CEL, event_id: `E${i}` })), total: 9 });
		const r2 = await searchXuanshiTool.run({ kind: 'celestial', limit: 2, offset: 3 });
		expect(xs.fetchCelestial).toHaveBeenLastCalledWith({ page: 1, page_size: 5 });
		expect(r2.data.items.map((x)=>x.id)).toEqual(['E4', 'E5']);
		expect(r2.data.nextOffset).toBe(5);
	});
	test('events 不带检索词 = 按朝代 / 术数分面列出(此前检索词必填,无法「列出某朝全部」);带词照旧走检索接口', async ()=>{
		xs.fetchEvents.mockResolvedValue({ items: [{ event_id: 'XTS-1', title: '甲', dynasty: '唐', citation: 'c', modern_text: 'm' }], total: 159 });
		const r = await searchXuanshiTool.run({ kind: 'events', dynasty: '唐', technique: '相术', limit: 1 });
		expect(xs.fetchEvents).toHaveBeenCalledWith({ dynasty: '唐', technique: '相术', page: 1, page_size: 1 });
		expect(xs.fetchSearch).not.toHaveBeenCalled();
		expect(r.data).toMatchObject({ total: 159, nextOffset: 1 });
		expect(r.data.items[0]).toMatchObject({ kind: 'event', id: 'XTS-1' });
		xs.fetchSearch.mockResolvedValue({ items: [] });
		await searchXuanshiTool.run({ kind: 'events', query: '太白' });
		expect(xs.fetchSearch).toHaveBeenCalledTimes(1);
		expect(xs.fetchEvents).toHaveBeenCalledTimes(1);
	});
	test('接口失败 = 可重试码', async ()=>{
		xs.fetchCelestial.mockRejectedValue(new Error('down'));
		const r = await searchXuanshiTool.run({ kind: 'celestial', query: '彗' });
		expect(r).toMatchObject({ ok: false, code: 'E_CAST_BACKEND_FAILED', retryable: true });
	});
	test('get_xuanshi_item 认 celestial_event', async ()=>{
		xs.fetchCelestialEvent.mockResolvedValue({ event_id: 'TW-1', original: '原文' });
		const r = await getXuanshiItemTool.run({ kind: 'celestial_event', id: 'TW-1' });
		expect(xs.fetchCelestialEvent).toHaveBeenCalledWith('TW-1');
		expect(r.ok).toBe(true);
		expect(r.data.content).toContain('原文');
	});
	test('browse_xuanshi:八个目录视图各走各的接口;正文去掉页面渲染用的 HTML 副本;超长截断', async ()=>{
		const calls = { summary: xs.fetchSummary, dynasties: xs.fetchDynasties, terms: xs.fetchCelestialTerms, facets: xs.fetchFacets, timeline: xs.fetchTimeline, decade_omens: xs.fetchDecadeOmens, microchronology: xs.fetchMicrochronology, daily: xs.fetchDaily, map: xs.fetchMap, persons: xs.fetchPersonsGraph };
		expect(Object.keys(calls).sort()).toEqual([...XUANSHI_VIEWS].sort());
		for(const v of XUANSHI_VIEWS.filter((x)=>x !== 'map' && x !== 'persons')){
			calls[v].mockResolvedValue([{ name: `${v}-行`, body_md: '正文', body_html: '<p>正文</p>' }]);
			// eslint-disable-next-line no-await-in-loop
			const r = await browseXuanshiTool.run({ view: v });
			expect(calls[v]).toHaveBeenCalledTimes(1);
			expect(r.ok).toBe(true);
			expect(r.data.content).toContain(`${v}-行`);
			expect(r.data.content).not.toContain('body_html');
			expect(r.data.truncated).toBe(false);
		}
		xs.fetchMicrochronology.mockClear();
		await browseXuanshiTool.run({ view: 'microchronology', history: '宋史', omen: '流星', decade: 1080, limit: 5 });
		expect(xs.fetchMicrochronology).toHaveBeenCalledWith({ history: '宋史', omen_type: '流星', decade: 1080, limit: 5 });
		xs.fetchSummary.mockResolvedValue({ big: 'x'.repeat(5000) });
		const cut = await browseXuanshiTool.run({ view: 'summary', maxChars: 600 });
		expect(cut.data.truncated).toBe(true);
		expect(cut.data.totalChars).toBeGreaterThan(5000);
	});
});

describe('玄学史地图 / 人物关系图(页面画图,这里出同一份数据的文字形态)', ()=>{
	test('地图:按事件数降序,古地名只列前 8 条并给总数;period 透传到页面同一接口', async ()=>{
		const names = Array.from({ length: 12 }, (_, i)=>`古名${i}`);
		xs.fetchMap.mockResolvedValue({ total: 2, points: [{ modern: '洛阳', ancient_names: ['洛邑'], count: 3, lng: 112.4, lat: 34.6 }, { modern: '西安', ancient_names: names, count: 9, lng: 108.9, lat: 34.3 }] });
		const r = await browseXuanshiTool.run({ view: 'map', period: '唐' });
		expect(xs.fetchMap).toHaveBeenLastCalledWith('唐');
		const d = JSON.parse(r.data.content);
		expect(d.period).toBe('唐');
		expect(d.places.map((x)=>x.place)).toEqual(['西安', '洛阳']);
		expect(d.places[0]).toMatchObject({ events: 9, ancientNameCount: 12 });
		expect(d.places[0].ancientNames).toHaveLength(8);
		expect(d.places[1].ancientNameCount).toBeUndefined();
		await browseXuanshiTool.run({ view: 'map' });
		expect(xs.fetchMap).toHaveBeenLastCalledWith(undefined);
	});
	test('人物关系:人物按共现度、关系按共现次数降序;limit / minWeight 透传为页面同一组参数', async ()=>{
		xs.fetchPersonsGraph.mockResolvedValue({ nodes: [{ id: '甲', weight: 2 }, { id: '乙', weight: 7 }], edges: [{ source: '甲', target: '乙', weight: 2 }, { source: { id: '乙' }, target: { id: '丙' }, weight: 5 }] });
		const r = await browseXuanshiTool.run({ view: 'persons', limit: 20, minWeight: 2 });
		expect(xs.fetchPersonsGraph).toHaveBeenLastCalledWith({ top_n: 20, min_weight: 2 });
		const d = JSON.parse(r.data.content);
		expect(d.persons.map((x)=>x.name)).toEqual(['乙', '甲']);
		expect(d.relations[0]).toEqual({ a: '乙', b: '丙', coOccurrence: 5 });
		await browseXuanshiTool.run({ view: 'persons' });
		expect(xs.fetchPersonsGraph).toHaveBeenLastCalledWith({ top_n: 100, min_weight: 3 });
	});
});

describe('合盘:按段取与另两张盘', ()=>{
	const WEST = ['[关系起盘信息]', '甲乙', '', '[A对B相位]', '日合月', '', '[合成图盘]', '组合盘正文', '', '[关系量化]', '契合分数：47.6', '', '[八重合]', '合计 28.5'].join('\n');
	const A = { kind: 'natal', birth: '1988-03-14 15:26', gpsLat: 31.2, gpsLon: 121.4, name: '甲' };
	const B = { kind: 'natal', birth: '1986-07-02 09:10', gpsLat: 39.9, gpsLon: 116.4, name: '乙' };
	test('回包恒带段名表;点名只取那几段;一段都没匹上回可用段名', async ()=>{
		getPairSynastryText.mockResolvedValue(WEST);
		const all = await castRelative.run({ a: A, b: B }, {});
		expect(all.ok).toBe(true);
		expect(all.data.sectionTitles).toEqual(expect.arrayContaining(['关系起盘信息', 'A对B相位', '合成图盘', '关系量化', '八重合']));
		expect(all.data.pickedSections).toBeUndefined();
		const picked = await castRelative.run({ a: A, b: B, sections: ['关系量化', '八重合'] }, {});
		expect(picked.data.content).toContain('契合分数：47.6');
		expect(picked.data.content).toContain('合计 28.5');
		expect(picked.data.content).not.toContain('组合盘正文');
		expect(picked.data.content.startsWith('【合盘】本人「甲」× 对方「乙」')).toBe(true);
		expect(picked.data.pickedSections).toEqual(['关系量化', '八重合']);
		expect(picked.data.totalChars).toBe(all.data.totalChars);
		const miss = await castRelative.run({ a: A, b: B, sections: ['不存在'] }, {});
		expect(miss).toMatchObject({ ok: false, code: 'E_SECTION_NOT_FOUND' });
		expect(miss.data.availableSections).toEqual(all.data.sectionTitles);
	});
	test('westernExtras 原样交给取数层;不带 = 不传', async ()=>{
		getPairSynastryText.mockResolvedValue(WEST);
		await castRelative.run({ a: A, b: B, westernExtras: ['timespace', 'marks'] }, {});
		expect(getPairSynastryText.mock.calls[0][2].extraCharts).toEqual(['timespace', 'marks']);
		await castRelative.run({ a: A, b: B }, {});
		expect(getPairSynastryText.mock.calls[1][2].extraCharts).toBeUndefined();
	});
	test('取数层:点名才多取时空中点盘 / 马克斯盘,并进缓存键', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/pair.js'), 'utf8');
		expect(src).toContain("const timeSpace = ex.timeSpace ? await fetchOne(3, 'TimeSpace') : '';");
		expect(src).toContain("const marks = ex.marks ? await fetchOne(4, 'Marks') : '';");
		expect(src).toContain("(extraList.length ? `#extra:${extraList.join(',')}` : '')");
	});
});

describe('档案三项元数据:生辰可信度 / 关系 / 资料出处', ()=>{
	test('档位单源:档案编辑表单与工具用同一份', ()=>{
		expect(RECORD_RODDEN_VALUES).toEqual(['AA', 'A', 'B', 'C', 'DD', 'X']);
		expect(RECORD_RELATION_VALUES).toEqual(['self', 'family', 'friend', 'client', 'other']);
		const form = fs.readFileSync(path.resolve(__dirname, '../../components/user/ChartData.js'), 'utf8');
		expect(form).toContain('RECORD_RODDEN_OPTIONS.map(');
		expect(form).toContain('RECORD_RELATION_OPTIONS.map(');
		expect(form).not.toContain("<Option value='AA'>");
		expect(RECORD_RODDEN_OPTIONS.find((o)=>o.value === 'AA').label).toBe('AA 出生记录');
		expect(RECORD_RELATION_OPTIONS.find((o)=>o.value === 'client').label).toBe('客户');
	});
	test('🔴 建档带三项 → 落进档案;列表回这两项并可按关系 / 可信度 / 星标筛', async ()=>{
		registerBuiltinTools();
		const ctx = { origin: 'mcp', clientName: 't' };
		const a = await runTool('create_chart_record', { name: '甲', birth: '1990-05-06 07:08', gpsLat: 39.9, gpsLon: 116.4, gender: 'male', rodden: 'AA', relation: 'client', sourceNote: ' 出生证 ' }, ctx);
		expect(a.ok).toBe(true);
		const b = await runTool('create_chart_record', { name: '乙', birth: '1991-05-06 07:08', gpsLat: 39.9, gpsLon: 116.4, gender: 'female', relation: 'family' }, ctx);
		expect(b.ok).toBe(true);
		const all = await runTool('list_records', { kind: 'chart' }, ctx);
		const byName = {}; all.data.items.forEach((it)=>{ byName[it.title] = it; });
		expect(byName['甲']).toMatchObject({ rodden: 'AA', relation: 'client' });
		expect(byName['乙'].relation).toBe('family');
		expect('rodden' in byName['乙']).toBe(false);
		expect((await runTool('list_records', { relation: 'client' }, ctx)).data.items.map((x)=>x.title)).toEqual(['甲']);
		expect((await runTool('list_records', { rodden: 'AA' }, ctx)).data.items.map((x)=>x.title)).toEqual(['甲']);
		expect((await runTool('list_records', { onlyStarred: true }, ctx)).data.total).toBe(0);
		const star = await runTool('star_record', { recordId: b.data.cid }, ctx);
		expect(star.ok).toBe(true);
		const starred = await runTool('list_records', { onlyStarred: true }, ctx);
		expect(starred.data.items.map((x)=>x.title)).toEqual(['乙']);
		expect(starred.data.items[0].starred).toBe(true);
		// 档位外的值过不了校验
		const bad = await runTool('create_chart_record', { name: '丙', birth: '1992-05-06 07:08', gpsLat: 1, gpsLon: 1, rodden: 'ZZ' }, ctx);
		expect(bad).toMatchObject({ ok: false, code: 'E_ARGS_INVALID' });
	});
	test('提案:命盘可改这三项(进白名单与标签);本来就空再清 = 没变化;事盘给了不产生变更并说明', async ()=>{
		['rodden', 'relation', 'sourceNote'].forEach((k)=>{ expect(PROPOSAL_EDIT_FIELDS.chart).toContain(k); expect(PROPOSAL_EDIT_FIELDS.case).not.toContain(k); expect(PROPOSAL_FIELD_LABELS[k]).toBeTruthy(); });
		const rec = { name: '甲', birth: '1990-05-06 07:08:00', rodden: 'AA' };
		expect((await normalizeEditIntent('chart', rec, { rodden: 'B', sourceNote: '传记' })).changes).toEqual({ rodden: 'B', sourceNote: '传记' });
		expect((await normalizeEditIntent('chart', rec, { rodden: 'AA', relation: '' })).changes).toEqual({});
		expect((await normalizeEditIntent('chart', rec, { rodden: '' })).changes).toEqual({ rodden: '' });
		const onCase = await normalizeEditIntent('case', { event: '事', divTime: '2026-01-01 08:00:00' }, { rodden: 'B' });
		expect(onCase.changes).toEqual({});
		expect(onCase.assumptions.join()).toContain('只有命盘档案有');
	});
});

describe('点名要段时不先按「纳入内容」筛', ()=>{
	test('cast_technique 带 sections → 取未筛的全文再挑;不带 → 照旧', ()=>{
		const tool = fs.readFileSync(path.resolve(__dirname, '../aiTools/tools/castTechnique.js'), 'utf8');
		expect(tool).toContain("if(Array.isArray(args.sections) && args.sections.some((x)=>`${x || ''}`.trim())){ opts.skipSectionFilter = true; }");
		const ctx = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/techniqueContext.js'), 'utf8');
		expect(ctx).toContain('options.skipSectionFilter ? context.content : applyAIExportSectionFilterToSnapshot(filterKey, context.content)');
	});
});
