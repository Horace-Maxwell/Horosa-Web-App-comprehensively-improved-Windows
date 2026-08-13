// 地占 · 四链同步锁:AI 导出 / 导出设置 / AI 分析挂载 / 命盘事盘储存管理。
//
// 🔴 本仓反复栽的一类:新增选项或新增段之后,四链里漏改一处 ——
//    导出段名与 builder 段头不一致 → 该段永远导不出;
//    挂载齿轮没登记 → AI 复算出的是默认盘,与界面两样;
//    事盘存写不对称 → 载回是另一副判读。
//    故此处把四链的**双向一致**逐条钉死,任何一处漏改即红。
jest.mock('../../../utils/moduleAiSnapshot', () => ({
	saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(),
}));

import { buildGeomancySnapshotText } from '../GeomancyMain';
import { AI_EXPORT_PRESET_SECTIONS, getAIExportDefaultOffSet } from '../../../utils/aiExport';
import { TECHNIQUE_SETTINGS_SCHEMA } from '../../../utils/techniqueMountSettings';
import LIVE from './fixtures/geomancyLiveResults.json';

const PRESET = AI_EXPORT_PRESET_SECTIONS.geomancy || [];
const heads = (txt) => (txt.match(/^\[(.+?)\]$/gm) || []).map((x) => x.slice(1, -1));

describe('地占 · 链一:AI 导出段清单 ⇄ 快照段头 双向一致', () => {
	test('preset 段名不重复、且十六段齐(六新段 + 真实星历段在册)', () => {
		expect(new Set(PRESET).size).toBe(PRESET.length);
		['判定', '法庭三角', '有效性判断', '解读技法', '盾面得地', '元素与寻源', '成败与福灵点',
			'转宫派生', '定局落星·甲', '定局落星·乙', '定局落星·真实星历', '行星地占盘',
			'十二宫·图形入宫', '十六图形', '图形释义', '边界声明'].forEach((k) => expect(PRESET).toContain(k));
	});

	test('凡快照产出之段头,必在 preset 内(否则该段永远导不出)', () => {
		['european_classical', 'book_pchart', 'book_angular', 'book_gd', 'book_numbers',
			'sikidy', 'hakata', 'ifa', 'names_arabic', 'parity_houses12'].forEach((k) => {
			const txt = buildGeomancySnapshotText(LIVE[k]);
			const hs = heads(txt);
			expect(hs.length).toBeGreaterThan(0);
			hs.forEach((h) => expect(PRESET).toContain(h));
		});
	});

	test('🔴 preset 内每一段都能被某样本真产出 —— 零空登记(登了导不出即死段)', () => {
		const produced = new Set();
		Object.keys(LIVE).forEach((k) => heads(buildGeomancySnapshotText(LIVE[k])).forEach((h) => produced.add(h)));
		// 白名单为空:凡登记之段必有样本作证(转宫派生与落星乙由 book_turn_bytwelves 覆盖)
		expect(PRESET.filter((s) => !produced.has(s))).toEqual([]);
	});

	test('结构对照模式只产边界声明,绝不产判读段(越界即红)', () => {
		const hs = heads(buildGeomancySnapshotText(LIVE.ifa));
		expect(hs).toContain('边界声明');
		['判定', '解读技法', '法庭三角', '成败与福灵点', '盾面得地'].forEach((k) => expect(hs).not.toContain(k));
	});
});

describe('地占 · 链二:AI 导出设置(默认关段)', () => {
	test('默认关段只有「图形释义」一项,六新段皆逐盘事实故默认开', () => {
		const off = [...(getAIExportDefaultOffSet('geomancy') || [])];
		expect(off).toEqual(['图形释义']);
		['法庭三角', '有效性判断', '盾面得地', '元素与寻源', '成败与福灵点', '行星地占盘']
			.forEach((k) => expect(off).not.toContain(k));
	});
	test('默认关段名须在 preset 内(否则设置面勾不到)', () => {
		[...(getAIExportDefaultOffSet('geomancy') || [])].forEach((k) => expect(PRESET).toContain(k));
	});
	test('preset 注册表内确有 geomancy 一项(导出面据此列技法)', () => {
		expect(Object.keys(AI_EXPORT_PRESET_SECTIONS)).toContain('geomancy');
		expect(PRESET.length).toBeGreaterThanOrEqual(15);
	});
});

describe('地占 · 链三:AI 分析挂载齿轮 ⇄ 复算入参', () => {
	const gear = TECHNIQUE_SETTINGS_SCHEMA.geomancy;

	test('齿轮为 payload 型、字段皆三态(空=随档)', () => {
		expect(gear.kind).toBe('payload');
		expect(gear.optionsPath).toBe('options');
		gear.fields.forEach((f) => {
			expect(f.default).toBe('');
			expect((f.options || [])[0].value).toBe('');
		});
	});

	test('六个判读轴齿轮齐备(含新增图形入宫、黄道第三档)', () => {
		const names = gear.fields.map((f) => f.name);
		['tradition', 'readingScope', 'zodiacSystem', 'quesitedHouse', 'turnTo', 'housePlacement']
			.forEach((n) => expect(names).toContain(n));
		const zod = gear.fields.find((f) => f.name === 'zodiacSystem');
		expect(zod.options.map((o) => o.value)).toContain('planetary_alt');
		const place = gear.fields.find((f) => f.name === 'housePlacement');
		expect(place.options.map((o) => o.value)).toEqual(['', 'sequential', 'angular', 'golden_dawn']);
	});

	test('🔴 起卦轴永不入齿轮(登了即可伪造用户没见过的卦)', () => {
		const names = gear.fields.map((f) => f.name);
		['seedMode', 'seed', 'manualSeed', 'question', 'castMethod', 'castNumbers']
			.forEach((n) => expect(names).not.toContain(n));
	});

	test('齿轮每个字段名都被复算入参真消费(否则调了没用)', () => {
		// buildGeomancySnapshotForFields 之 payload 组装源码逐名核对
		// eslint-disable-next-line global-require
		const src = require('fs').readFileSync(require.resolve('../GeomancyMain'), 'utf8');
		const seg = src.slice(src.indexOf('export async function buildGeomancySnapshotForFields'));
		gear.fields.forEach((f) => {
			expect(seg.includes(f.name)).toBe(true);
		});
	});
});

describe('地占 · 链四:命盘事盘储存 ⇄ 挂载复算同源', () => {
	test('存档 options 之键集 ⊇ 齿轮字段集(齿轮所调之轴,存档必带)', () => {
		// eslint-disable-next-line global-require
		const src = require('fs').readFileSync(require.resolve('../GeomancyMain'), 'utf8');
		const seg = src.slice(src.indexOf('clickSaveCase()'), src.indexOf('applyHistory(entry)'));
		const clean = seg.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
		TECHNIQUE_SETTINGS_SCHEMA.geomancy.fields.forEach((f) => {
			// housePlacement 随 granular 整体入账,其余为顶层键
			const ok = new RegExp(`${f.name}:`).test(clean) || /granular:/.test(clean);
			expect(ok).toBe(true);
		});
	});

	test('挂载复算读取存档全键(报数与行星盘四键不可漏,否则 AI 见的盘与界面两样)', () => {
		// eslint-disable-next-line global-require
		const src = require('fs').readFileSync(require.resolve('../GeomancyMain'), 'utf8');
		const seg = src.slice(src.indexOf('export async function buildGeomancySnapshotForFields'));
		['so.castNumbers', 'so.planetaryChart', 'so.planetaryChartZodiac',
			'so.planetaryChartNodes', 'so.planetaryChartExtras', 'so.housePlacement',
			'so.granular', 'so.turnTo', 'so.quesitedHouse'].forEach((k) => {
			expect(seg.includes(k)).toBe(true);
		});
	});
});

// ── 链五:真实星历盘(时地真正接入后端)──
// 起因:前端一直在发 date/time/zone/lon/lat 且注释写着「星盘按此时地起」,而后端 reading
// 压根不接 —— 时地除了时间起卦的种子之外什么也不影响。此组用例锁死「接住了」且「回落如实」。
describe('地占 · 链五:真实星历盘与时地', () => {
	test('真实盘样本:上升带度数、象限宫制不再退化、宫头逐宫有度', () => {
		const r = LIVE.book_real_ephem.reading;
		const ae = r.astroErection;
		expect(ae.asc_source).toBe('real_chart');
		expect(typeof ae.asc_lon).toBe('number');
		expect(typeof ae.asc_deg_in_sign).toBe('number');
		// 🔴 此前象限宫制**恒退化**为整宫(无宫头度数);唯真实盘能让它真正成立
		expect(ae.degenerate_to_whole_sign).toBe(false);
		expect(ae.quadrant_system).toBe('regiomontanus');
		expect(r.realChart.quadrant_system).toBe('regiomontanus');
		// 十二宫每宫皆有宫头度数,且各宫星座由宫头所在星座定(非自上升整宫顺铺)
		expect(r.houses).toHaveLength(12);
		r.houses.forEach((h) => expect(typeof h.cuspDegInSign).toBe('number'));
		expect(r.settings.real_chart_requested).toBe(true);
		expect(r.settings.real_chart_available).toBe(true);
	});

	test('真实盘之上升与仓内既有占星路径同源(度数逐位可核)', () => {
		// 2026-08-12 14:30 +08 / 116.4E 39.9N → 上升射手 7.2034°(与 flatlib 列宫制逐位一致)
		const ae = LIVE.book_real_ephem.reading.astroErection;
		expect(ae.sign).toBe('Sagittarius');
		expect(ae.asc_deg_in_sign).toBeCloseTo(7.2034, 3);
		expect(LIVE.book_real_ephem.reading.realChart.mc_lon).toBeCloseTo(174.1499, 3);
	});

	test('🔴 缺经纬即如实回落图形取法并写明,绝不静默变脸', () => {
		const r = LIVE.book_real_fallback.reading;
		expect(r.astroErection.asc_source).toBe('h1_figure');
		expect(r.astroErection.real_chart_requested).toBe(true);
		expect(r.astroErection.real_chart_unavailable).toBeTruthy();
		expect(r.settings.real_chart_available).toBe(false);
		// 回落态绝不出真实盘之键(否则界面会画一个用户没选的盘)
		expect(r.planetPlacementReal).toBeUndefined();
		expect(r.realChart).toBeUndefined();
		// 落星如实回落甲法(免 L4 档空无落星)
		expect(Object.keys(r.planetPlacement || {}).length).toBeGreaterThan(0);
	});

	test('未选此二档者:响应一个新键都不多(字节零回归之判据)', () => {
		['european_classical', 'book_pchart', 'book_angular', 'book_gd', 'book_numbers',
			'proj_astro_from_chart', 'proj_astro_bytwelves', 'proj_sequential'].forEach((k) => {
			const r = LIVE[k].reading;
			expect(r.planetPlacementReal).toBeUndefined();
			expect(r.realChart).toBeUndefined();
			expect(r.settings.real_chart_requested).toBeUndefined();
			expect(r.settings.real_chart_available).toBeUndefined();
			(r.houses || []).forEach((h) => expect(h.cuspDegInSign).toBeUndefined());
			expect(r.astroErection.asc_lon).toBeUndefined();
		});
	});

	test('快照:真实星历段如实交代非传本之法;回落态另出告诫', () => {
		const txt = buildGeomancySnapshotText(LIVE.book_real_ephem);
		expect(txt).toContain('[定局落星·真实星历]');
		expect(txt).toContain('按所问之时地起真实星历盘');
		expect(txt).toContain('列宫制');
		// 必须自陈非传本之法,否则模型会把它当传本口径引用
		expect(txt).toContain('此式非传本之法');
		const fb = buildGeomancySnapshotText(LIVE.book_real_fallback);
		expect(fb).not.toContain('[定局落星·真实星历]');
		expect(fb).toContain('已如实回落图形取法');
	});

	test('🔴 AI 复算侧必发时地 —— 不发则复算之盘与界面两样', () => {
		const src = require('fs').readFileSync(require.resolve('../GeomancyMain'), 'utf8');
		const seg = src.slice(src.indexOf('export async function buildGeomancySnapshotForFields'),
			src.indexOf('class GeomancyMain'));
		expect(seg).toContain('paramsFromFields(fields)');
		['date', 'time', 'zone', 'lon', 'lat'].forEach((k) => {
			expect(seg).toContain(`payload.${k} = gp.${k}`);
		});
		// ad 只在纪元前才发:公元后请求体与本次改动前逐字节相同
		expect(seg).toContain("Number(gp.ad) === -1");
	});

	test('两个新档位在选项表内且各带短名(闭合态不被截)', () => {
		const src = require('fs').readFileSync(require.resolve('../GeomancyMain'), 'utf8');
		expect(src).toContain("key: 'real_chart'");
		expect(src).toContain("key: 'real_ephemeris'");
		expect(src).toContain("short: '真时地'");
		expect(src).toContain("short: '真星历'");
	});
});
