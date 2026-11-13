import { TRANSFORM_GROUPS, TRANSFORM_KINDS, TRANSFORM_PAGE_SETTINGS, ZODIAC_PAGE_SETTINGS, ZODIAC_VERSIONS, transformKindDef, transformSnapshotLines, zodiacSnapshotLines, zodiacVersionLabel } from '../transformCharts';
import fs from 'fs';
import path from 'path';

const ENGINE = fs.readFileSync(path.join(__dirname, '../../../../astropy/astrostudy/transform_charts.py'), 'utf8');
const ZODIAC = fs.readFileSync(path.join(__dirname, '../../../../astropy/astrostudy/zodiac_data.py'), 'utf8');

describe('变换盘选项与引擎对齐', ()=>{
	it('选项里的每种变换,引擎都认识', ()=>{
		TRANSFORM_KINDS.forEach((kind)=>expect(`${kind}: ${new RegExp(`['"]${kind}['"]`).test(ENGINE)}`).toBe(`${kind}: true`));
	});
	it('变换键不重复,每项都有名字和说明', ()=>{
		expect(new Set(TRANSFORM_KINDS).size).toBe(TRANSFORM_KINDS.length);
		TRANSFORM_GROUPS.forEach((group)=>group.kinds.forEach((item)=>{
			expect(item.label.length).toBeGreaterThan(1);
			expect(item.desc.length).toBeGreaterThan(5);
		}));
	});
	it('坏值回缺省,认不出的种类落到第一项', ()=>{
		expect(transformKindDef('nope').value).toBe(TRANSFORM_KINDS[0]);
		expect(TRANSFORM_KINDS).toContain(TRANSFORM_PAGE_SETTINGS.load().kind);
	});
	it('黄道版本和引擎数据逐项相同,名字不含外文', ()=>{
		const rows = ZODIAC.match(/^ {4}'[^']+': \{'label': '[^']+'/gm).map((line)=>line.match(/'([^']+)': \{'label': '([^']+)'/).slice(1));
		expect(rows.length).toBe(19);
		expect(ZODIAC_VERSIONS.map((item)=>[item.value, item.label]).sort()).toEqual(rows.sort());
		ZODIAC_VERSIONS.forEach((item)=>expect(/[A-Za-z]/.test(item.label)).toBe(false));
		expect(ZODIAC_VERSIONS.map((item)=>item.value)).toContain(ZODIAC_PAGE_SETTINGS.load().version);
	});
	it('版本名查不到时给空,不露内部键', ()=>{
		expect(zodiacVersionLabel('z13a')).toBe('十三星座 · 甲本');
		expect(zodiacVersionLabel('nope')).toBe('');
	});
	it('有两档的变换都带口径选项', ()=>{
		['inverted', 'sunRise', 'novien', 'nodeHouses'].forEach((kind)=>expect(transformKindDef(kind).options).toContain('variant'));
		expect(transformKindDef('antiscia').options).toBeUndefined();
	});
});

describe('快照正文', ()=>{
	const names = (id)=>({ Sun: '太阳', Moon: '月亮' }[id] || id);

	it('变换盘:段头、用到的选项、前后黄经、出黄道带;没用到的选项不写', ()=>{
		const lines = transformSnapshotLines({
			kind: 'superimposed', chart: {}, positions: [{ id: 'Sun', natalLon: 54.07, lon: 10.5 }], vertical: [{ id: 'Moon', outside: true }],
		}, { planet: 'Moon', shift: true, house: 3 }, names);
		expect(lines[0]).toBe('[变换盘]');
		expect(lines.join('\n')).toContain('基准星:月亮');
		expect(lines.join('\n')).toContain('宫位:随之旋转');
		expect(lines.join('\n')).toContain('太阳:本命黄经 54.07° → 10.50°');
		expect(lines.join('\n')).toContain('出黄道带:月亮');
		expect(lines.join('\n')).not.toContain('宫头');
		const inverted = transformSnapshotLines({ kind: 'inverted', chart: {}, positions: [] }, { planet: 'Moon', shift: true, house: 3 }, names).join('\n');
		expect(inverted).not.toContain('基准星');
		expect(inverted).not.toContain('宫位:');
	});
	it('变换盘:算不出盘时不留空段', ()=>{
		expect(transformSnapshotLines({ kind: 'persona', momentFailed: true }, {}, names)).toEqual([]);
		expect(transformSnapshotLines(null)).toEqual([]);
	});
	it('黄道制:段头、版本、落段与下次换星座;黄道外星座标明', ()=>{
		const lines = zodiacSnapshotLines({
			version: 'z13a', galacticCenter: 266.7,
			rows: [{ id: 'Sun', lon: 54.07, conName: '金牛', onZodiac: true, versions: { z13a: { sign: '金牛', deg: 0.79 } }, galactic: { sign: '狮子', deg: 27.37 } }, { id: 'Moon', lon: 200, conName: '乌鸦', onZodiac: false, versions: {} }],
			around: [{ id: 'Sun', last: { date: '1990-05-14', fromName: '白羊' }, next: { date: '1990-06-21', toName: '双子' } }],
		}, names).join('\n');
		expect(lines).toContain('[黄道制]');
		expect(lines).toContain('黄道版本:十三星座 · 甲本');
		expect(lines).toContain('太阳:回归黄经 54.07° · 金牛 0.79° · 星座 金牛 · 银河黄道 狮子 27.37°');
		expect(lines).toContain('星座 乌鸦(黄道外)');
		expect(lines).toContain('太阳 下次换星座:1990-06-21 入双子');
		expect(lines).toContain('太阳 上次换星座:1990-05-14 自白羊');
	});
});

describe('两个页面的异步守卫', ()=>{
	const read = (rel)=>fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
	['components/auxchart/AstroTransformLab.js', 'components/auxchart/AstroZodiacLab.js'].forEach((file)=>{
		it(`${file}:await 之后先比代次才写状态`, ()=>{
			const src = read(file);
			expect(src).toContain('seq !== this._loadSeq');
			expect(src).toContain('pickKeyedDerived');
		});
	});
});

describe('两个页面的失败处理', ()=>{
	const read = (rel)=>fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
	['components/auxchart/AstroTransformLab.js', 'components/auxchart/AstroZodiacLab.js'].forEach((file)=>{
		it(`${file}:请求键只在成功时写,失败清快照并到点重试`, ()=>{
			const src = read(file);
			expect(src.match(/requestKey: key/g)).toHaveLength(1);
			expect(src).toMatch(/requestKey: key, loading: false, loadError: ''/);
			expect(src).toMatch(/LOAD_RETRY_PARK_MS \+ 500/);
			expect(src).toMatch(/clearModuleAISnapshot\(/);
			expect(src).toMatch(/const \{ fields \} = this\.props;/);
		});
	});
	it('引擎说算不出时刻不用 err 键(Java 见 err 就整体抛错)', ()=>{
		expect(ENGINE).toMatch(/result\['momentFailed'\] = True/);
		expect(ENGINE).not.toMatch(/result\['err'\]/);
	});
});

describe('简繁', ()=>{
	it('后发座取皇后之发', ()=>{
		// eslint-disable-next-line global-require
		const { toHant } = require('../scriptConvert/hantConverter');
		expect(toHant('后发座')).toBe('后髮座');
		expect(toHant('然后发送')).not.toContain('后髮');
	});
});

describe('导出回落', ()=>{
	it('没出过盘时不把本命盘标成变换盘或黄道制', async ()=>{
		// eslint-disable-next-line global-require
		const { extractAstroContent } = require('../aiExport/extractors');
		await expect(extractAstroContent({ key: 'transformchart', topLabel: '辅盘' })).resolves.toBe('');
		await expect(extractAstroContent({ key: 'zodiacsystems', topLabel: '辅盘' })).resolves.toBe('');
	});
});

describe('北交宫盘给 AI 的宫头', ()=>{
	it('用真宫头,不用盘面的段头', ()=>{
		// eslint-disable-next-line global-require
		const { transformSnapshotChart } = require('../transformCharts');
		const chart = { chart: { houses: [{ id: 'House1', lon: 216.4, sign: 'Scorpio' }] }, params: {} };
		const out = transformSnapshotChart({ kind: 'nodeHouses', chart });
		expect(out.chart.houses[0].lon).toBeCloseTo(246.4);
		expect(out.chart.houses[0].sign).toBe('Sagittarius');
		expect(chart.chart.houses[0].sign).toBe('Scorpio');
		expect(transformSnapshotChart({ kind: 'inverted', chart })).toBe(chart);
	});
	it('变换盘的等宫不折叠宫主表', ()=>{
		// eslint-disable-next-line global-require
		const { resolveHouseSystem, derivedWholeSignLabelOf } = require('../wholeSignRulers');
		const chart = { chart: { hsys: 'Whole Sign', houses: [{ id: 'House1', hsysDerived: 'equalFromTransform' }] }, params: { hsys: 0 } };
		expect(resolveHouseSystem(chart, null).isAscWholeSign).toBe(false);
		expect(derivedWholeSignLabelOf(chart.chart ? { houses: chart.chart.houses } : chart)).toBe('等宫(变换后)');
	});
});

describe('宫主和黄金分割进快照', ()=>{
	it('页面有的表 AI 也读得到', ()=>{
		const lines = transformSnapshotLines({
			kind: 'vertical', chart: {}, positions: [],
			vertical: [{ id: 'Sun', outside: false, declination: 10, first: 25, second: 155 }],
			rulers: [{ house: 1, ruler: 'Mars', coRuler: 'Mars', nextRuler: null, inside: ['Sun'] }],
			golden: [{ lon: 137.51, ratio: 0.382, near: ['Moon'] }, { lon: 1, ratio: 0.618, near: [] }],
		}, {}, (id)=>id).join('\n');
		expect(lines).toContain('Sun 赤纬 10.00°:两解 25.00° / 155.00°');
		expect(lines).toContain('本命第 1 宫现代宫主:主星 Mars,共主 Mars,宫内 Sun');
		expect(lines).toContain('黄金分割点 137.51°(比例 0.382):Moon');
		expect(lines).not.toContain('1.00°');
	});
});

describe('快照写明坐标口径', ()=>{
	it('换算黄经的盘说明赤纬是本来的,整体旋转的盘不说', ()=>{
		const moved = transformSnapshotLines({ kind: 'inverted', chart: {}, positions: [], coordinatesMoved: true }, {}, (id)=>id).join('\n');
		const kept = transformSnapshotLines({ kind: 'vertical', chart: {}, positions: [], coordinatesMoved: false }, {}, (id)=>id).join('\n');
		expect(moved).not.toContain('本来的位置');
		expect(kept).toContain('本来的位置');
	});
	it('地平上下取本命的盘写明', ()=>{
		const natal = transformSnapshotLines({ kind: 'nodeHouses', chart: {}, positions: [], coordinatesMoved: true, natalHorizon: true }, {}, (id)=>id).join('\n');
		const rigid = transformSnapshotLines({ kind: 'inverted', chart: {}, positions: [], coordinatesMoved: true, natalHorizon: false }, {}, (id)=>id).join('\n');
		expect(natal).toContain('得时失时取出生时的值');
		expect(natal).not.toContain('本来的位置');
		expect(rigid).not.toContain('得时失时');
	});
	it('宫主表的逆行次主和宫头前 3° 也进快照', ()=>{
		const lines = transformSnapshotLines({
			kind: 'inverted', chart: {}, positions: [],
			rulers: [{ house: 2, ruler: 'Mars', rulerRetro: 'Pluto', coRuler: 'Venus', nearCusp: ['Moon'] }],
		}, {}, (id)=>id).join('\n');
		expect(lines).toContain('主星 Mars/Pluto逆,共主 Venus,宫头前 3° Moon');
	});
});

describe('近日点 / 远日点盘的太阳说明', ()=>{
	// 引擎取的是地球日心远日点(近日点盘)/ 近日点(远日点盘)的黄经 = 地球过近日点 / 远日点时太阳的地心黄经,与地球近日点方向相反
	it('说明写成「地球过近日点时太阳的地心黄经」,不写「地球近日点方向」', ()=>{
		expect(ENGINE).toMatch(/return row\[3 if index == 2 else 2\]\[0\]/);
		const peri = transformKindDef('perihelion');
		const aph = transformKindDef('aphelion');
		expect(peri.desc).toContain('地球过近日点那一刻太阳的地心黄经');
		expect(peri.desc).toContain('与地球近日点方向相反');
		expect(aph.desc).toContain('地球过远日点那一刻太阳的地心黄经');
		[peri, aph].forEach((d)=>expect(d.desc).not.toMatch(/太阳取地球[近远]日点方向/));
	});
});

describe('黄道制表:88 星座列头', ()=>{
	it('「星座」列标明是 88 星座(名用天文译名,如人马),免得与「本版本」列的射手混读', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../components/auxchart/AstroZodiacLab.js'), 'utf8');
		expect(src).toMatch(/key: 'conName', title: <span[^>]*>88 星座<\/span>/);
	});
});
