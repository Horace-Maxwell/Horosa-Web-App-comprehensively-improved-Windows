import fs from 'fs';
import path from 'path';
import { CHART_DETAIL_DEFAULTS, CHART_DETAIL_OPTIONS, CHART_DETAIL_SETTINGS, CHART_DETAIL_TABLES, buildChartDetailsText, chartDetailFields, chartDetailRequestFields, detailPairs, detailPointList, detailPointName } from '../chartDetails';

const sample = {
	accidental: { geniture: 'Mars', rows: [{ planet: 'Sun', sum: -3 }, { planet: 'Mars', sum: 9 }] },
	temperament: { name: '粘液', warm: -2, moist: 7 },
	dispositors: { final: null, rows: [] },
	persian: [{ planet: 'Sun', sum: 7 }],
	sunPhases: [{ planet: 'Mercury', phaseName: '东方焦伤' }],
	sect: [{ planet: 'Sun', hayz: true, ex: false }, { planet: 'Mars', hayz: false, ex: true }],
	receptions: [{ type: 1, name: '守护互容', a: 'Sun', b: 'Mars' }, { type: 8, name: '同主', a: 'Moon', b: 'Venus' }],
	topics: [{ topic: '灵魂', winners: ['Sun', 'Moon'] }],
	hyleg: [{ label: '托勒密', hyleg: 'Pars Fortuna', alcocoden: 'Venus' }, { label: '奥马尔', hyleg: null, alcocoden: null }],
	eminence: [{ test: '福点主入本座', hit: true }, { test: '灵点主入本座', hit: false }],
	considerations: [{ test: '月亮空亡', hit: false }],
	slavery: [{ test: '金、木在果宫', planets: ['Venus'] }, { test: '太阳在果宫', planets: [] }],
	hellenistic: { predominator: 'Asc', triplicity: ['Sun', 'Jupiter', 'Saturn'], oversight: 'Mars' },
	patterns: [{ name: '大三角', corners: [['Sun', 'Venus'], ['Moon'], ['Mars']] }],
};

describe('盘面细节设置', ()=>{
	test('三十张表,键与后端结果对得上', ()=>{
		expect(CHART_DETAIL_TABLES).toHaveLength(30);
		CHART_DETAIL_TABLES.forEach((item)=>{ expect(item.label && item.note).toBeTruthy(); });
		const py = fs.readFileSync(path.resolve(__dirname, '../../../../astropy/astrostudy/chart_details.py'), 'utf8');
		CHART_DETAIL_TABLES.forEach((item)=>{ expect(py).toContain(`'${item.value}':`); });
	});

	test('受孕期与危机日进快照', ()=>{
		const text = buildChartDetailsText({ persian: [], fertility: { elongation: 12.5, rows: [{ datetime: '2026-01-18 11:50:14', male: true }] },
			crisis: { moon: 10, rows: [{ arc: 45, datetime: '1975-02-14 16:06:45', critical: false }, { arc: 90, datetime: '1975-02-18 08:16:33', critical: true }] } });
		expect(text).toContain('受孕期(日月角距 12.50°):2026-01-18 11:50:14 男');
		expect(text).toContain('90° 1975-02-18 08:16:33(危机)');
	});

	test('缺省不带任何参数,缓存键与旧请求一致', ()=>{
		expect(chartDetailRequestFields({ detailFaces: CHART_DETAIL_DEFAULTS.faces, detailVariant: CHART_DETAIL_DEFAULTS.variant })).toEqual({});
		expect(chartDetailRequestFields(null)).toEqual({});
	});

	test('改了选项才发', ()=>{
		expect(chartDetailRequestFields({ detailFaces: 'element', detailVariant: 'classic' })).toEqual({ detailFaces: 'element', variant: 'classic' });
	});

	test('设置件的取值都在选项表里', ()=>{
		const s = CHART_DETAIL_SETTINGS.load();
		expect(CHART_DETAIL_OPTIONS.faces.map((item)=>item.value)).toContain(s.detailFaces);
		expect(CHART_DETAIL_OPTIONS.variant.map((item)=>item.value)).toContain(s.detailVariant);
		expect(CHART_DETAIL_TABLES.map((item)=>item.value)).toContain(s.detailTable);
	});

	test('只显示这张表受影响的选项', ()=>{
		expect(chartDetailFields('topics')).toEqual(['faces', 'variant']);
		expect(chartDetailFields('persian')).toEqual(['faces']);
		expect(chartDetailFields('sect')).toEqual(['variant']);
		expect(chartDetailFields('sunPhases')).toEqual([]);
		expect(chartDetailFields('nope')).toEqual([]);
	});

	test('Java 白名单放行面的算法、经典档与续表三个选项', ()=>{
		const java = fs.readFileSync(path.resolve(__dirname, '../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java'), 'utf8');
		const block = java.match(/OPTIONAL_KEYS = new String\[\] \{([\s\S]*?)\};/)[1];
		['detailFaces', 'variant', 'lunarMethod', 'mundoSystem', 'midpointCoord'].forEach((key)=>{ expect(block).toContain(`"${key}"`); });
	});

	test('续表选项:缺省不发,改了才发,选项全集与后端一致', ()=>{
		expect(chartDetailRequestFields({ detailLunar: 'traditional', detailMundo: 'proportional', detailMidpoint: 'ecliptic' })).toEqual({});
		expect(chartDetailRequestFields({ detailLunar: 'centered', detailMundo: 'koch', detailMidpoint: 'ra' })).toEqual({ lunarMethod: 'centered', mundoSystem: 'koch', midpointCoord: 'ra' });
		const py = fs.readFileSync(path.resolve(__dirname, '../../../../astropy/astrostudy/chart_details_more.py'), 'utf8');
		CHART_DETAIL_OPTIONS.lunar.forEach((item)=>{ expect(py).toContain(`'${item.value}'`); });
		CHART_DETAIL_OPTIONS.mundo.filter((item)=>item.value !== 'proportional').forEach((item)=>{ expect(py).toContain(`'${item.value}': b'`); });
		CHART_DETAIL_OPTIONS.midpoint.forEach((item)=>{ expect(py).toContain(`'${item.value}'`); });
		expect(chartDetailFields('lunarDays')).toEqual(['lunar']);
		// 经典档会把交点换成真交点,受交点影响的表也显示「算法」选项
		expect(chartDetailFields('inMundo')).toEqual(['mundo', 'variant']);
		expect(chartDetailFields('midpoints')).toEqual(['midpoint', 'variant']);
		['bindhu', 'cuspAspects', 'starAspects', 'perfections'].forEach((t)=>{ expect(chartDetailFields(t)).toContain('variant'); });
	});

	test('续表进快照:出生所在月亮日、成相、世俗相位、恒星相位、AstroDynes', ()=>{
		const text = buildChartDetailsText({ persian: [],
			lunarDays: { method: 'centered', rows: [{ day: 1, phase: '朔', start: 'a', end: 'b', current: true }] },
			perfections: [{ a: 'Sun', b: 'Moon', aspect: 0, datetime: '1975-02-10 21:16:51', applying: true }, { a: 'Jupiter', b: 'Saturn', aspect: 120, datetime: '1987-05-23 04:25:38', applying: false }],
			inMundo: { system: 'koch', aspects: [{ a: 'Sun', b: 'Mars', aspect: 90, orb: 1.234 }] },
			starAspects: [{ planet: 'Moon', star: 'Regulus', aspect: 180, orb: 0.38 }],
			astrodynes: { rows: [{ planet: 'Sun', power: 30, harmony: 4 }, { planet: 'Moon', power: 10, harmony: -2 }] },
		});
		expect(text).toContain('月亮日(朔居中):出生在第 1 日(朔),a 至 b');
		expect(text).toContain('成相表:日合月 1975-02-10、木拱土 1987-05-23(离相后下一轮)');
		expect(text).toContain('世俗相位(Koch):日刑火(差 1.23°)');
		expect(text).toContain('恒星相位:月冲狮心轩辕十四(0.38°)');
		expect(text).toContain('AstroDynes 力量:日 30.0(75.0%)、月 10.0(25.0%)');
	});
});

describe('盘面细节文本', ()=>{
	test('点名', ()=>{
		expect(detailPointName('Asc')).toBe('上升');
		expect(detailPointName('Syzygy')).toBe('产前朔望');
		expect(detailPointName(null)).toBe('无');
		expect(detailPointList(['Asc', 'MC'])).toBe('上升、天顶');
		expect(detailPairs([['Asc', 'MC'], 'Asc'])).toBe('上升→天顶、上升');
	});

	test('空结果不出快照', ()=>{
		[null, {}, { persian: 'x' }].forEach((d)=>{ expect(buildChartDetailsText(d)).toBe(''); });
	});

	const text = buildChartDetailsText(sample);

	test('段头和结论', ()=>{
		expect(text.startsWith('[盘面细节]\n')).toBe(true);
		expect(text).toContain('命主星：火');
		expect(text).toContain('气质：粘液(热冷 -2,湿干 +7)');
		expect(text).toContain('最终定位星：无');
		expect(text).toContain('偶然尊贵总分：日 -3、火 +9');
	});

	test('写明面和算法的口径', ()=>{
		expect(buildChartDetailsText({ ...sample, faces: 'element', variant: 'classic' })).toContain('口径：元素面 · 经典');
		expect(text).not.toContain('口径：');
	});

	test('重复的定位星只列一次', ()=>{
		const dup = buildChartDetailsText({ ...sample, slavery: [{ test: '日月定位星落或陷', planets: ['Saturn', 'Saturn'] }] });
		expect(dup).toContain('日月定位星落或陷(土)');
	});

	test('互容只列七类互容,同主同光不列', ()=>{
		expect(text).toContain('互容：守护互容 日、火');
		expect(text).not.toContain('同主');
	});

	test('判据只列成立的', ()=>{
		expect(text).toContain('名望判据成立：福点主入本座');
		expect(text).not.toContain('灵点主入本座');
		expect(text).toContain('判前考量成立：无');
		expect(text).toContain('奴役判据成立：金、木在果宫(金)');
		expect(text).not.toContain('太阳在果宫');
	});

	test('寿主与格局', ()=>{
		expect(text).toContain('托勒密 福点(寿主星 金)');
		expect(text).toContain('奥马尔 无(寿主星 无)');
		expect(text).toContain('大三角(日+金 / 月 / 火)');
	});
});

describe('盘面细节快照补的六张表', ()=>{
	it('行星关系、行星细节、度数性质、中点合星、统计、世俗缺点都写进快照', ()=>{
		const d = {
			persian: [], accidental: { rows: [] }, temperament: {}, dispositors: {},
			relations: [{ id: 1, name: '喜乐之位', items: ['Mercury'] }, { id: 6, name: '推进本性', items: [['Mars', 'Venus']] }],
			planetDetails: [{ planet: 'Sun', lon: 10, altitude: 12.34, speedMeanPct: 101, accelerating: true }, { planet: 'Mars', lon: 50.5, altitude: -3, speedMeanPct: 80, accelerating: false },
				{ planet: 'Venus', lon: 90, altitude: 5, speedMeanPct: 90, accelerating: false }],
			degrees: { points: [{ point: 'Sun', lame: true, deep: false, wells: 0, fortune: 2 }] },
			midpoints: { coord: 'ecliptic', rows: [{ a: 'Sun', b: 'Venus', midpoint: 50 }] },
			stats: { element: { fire: ['Sun'], water: ['Mars', 'Venus'] } },
			inMundo: { system: 'koch', aspects: [], missing: ['MC'] },
		};
		const text = buildChartDetailsText(d);
		expect(text).toContain('行星关系:');
		expect(text).toContain('推进本性 火→金');
		expect(text).toContain('行星细节:日 高度 12.3°');
		expect(text).toContain('残缺度');
		expect(text).toContain('火=日/金(0.50°)');
		expect(text).toContain('统计:元素 火 1、水 2');
		expect(text).toContain('世俗相位缺点:天顶');
	});
});
