// 西占各页:走不到的 try / 重复判空 / 逐字相同的副本 已收掉,行为逐字不变。
// 每条先用行为断言钉住「输出照旧」,再用源码断言钉住「不再长回来」。
import fs from 'fs';
import path from 'path';

jest.mock('../../../utils/request', () => jest.fn());

const request = require('../../../utils/request');
const { fmtDegree, transitOrbDefault } = require('../AstroExtraCommon');
const { setClassicalChartGlobal } = require('../../../utils/classicalChartGlobals');
const { buildReturnTimelineSnapshotText } = require('../AstroReturnTimeline');
const { buildEphemerisSnapshotText } = require('../AstroEphemeris');
const { today, methodTab } = require('../astroProgSnapshot');
const { buildChartHeightStyle } = require('../IndiaSouthChart');
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => readSource(path.join(SRC, rel));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = (rel) => strip(read(rel));

afterEach(() => { window.localStorage.clear(); request.mockReset(); });

describe('印占年盘 / 校正偏好', () => {
	test('当年取 new Date().getFullYear(),不再包一层走不到的 try', () => {
		const src = code('components/astro/IndiaChartMain.js');
		expect(src).toContain('const curY = new Date().getFullYear();');
		expect(src).not.toMatch(/try\s*\{\s*return new Date\(\)\.getFullYear\(\)/);
	});
	test('校正偏好直接走 safeLocalStorageSet(它自己兜住写盘异常)', () => {
		const src = code('components/astro/IndiaChartMain.js');
		expect(src).toContain("safeLocalStorageSet('horosa.india.rectify.prefs.v1'");
		expect(src).not.toMatch(/try\s*\{\s*safeLocalStorageSet\(/);
	});
});

describe('ResizeObserver 断开不再包 try(本类亲手 new 出来的观察器)', () => {
	const SITES = [
		['components/astro/AstroDeclinationLadder.js', 'this._hostRO.disconnect();', 1],
		['components/astro/AstroRelative.js', 'this.chartRowObserver.disconnect();', 1],
		['components/astro3d/AstroChart3D.js', 'this._hostRO.disconnect();', 1],
		['components/astro3d/AstroChartMain3D.js', 'this._sideRO.disconnect();', 2],
	];
	SITES.forEach(([rel, call, n]) => {
		test(rel, () => {
			const src = code(rel);
			expect(src.split(call).length - 1).toBe(n);
			expect(src).not.toMatch(/try\s*\{\s*this\.(_hostRO|_sideRO|chartRowObserver)\.disconnect\(\)/);
		});
	});
});

describe('相位表离相过滤 / 推运容许度默认', () => {
	test('相位表直接用顶部静态 import 的 classicalGlobalValue(不再惰性 require + try)', () => {
		const src = code('components/astro/AstroAspect.js');
		expect(src).toContain("classicalGlobalValue('aspectShowOnlyApplying') === 1");
		expect(src).toContain("Number(classicalGlobalValue('separatingOrbCap'))");
		expect(src).not.toContain("require('../../utils/classicalChartGlobals')");
	});
	test('transitOrbDefault:默认 1;全局改 3 → 3;非正数回落 1', () => {
		expect(transitOrbDefault()).toBe(1);
		setClassicalChartGlobal('transitOrb', 3);
		expect(transitOrbDefault()).toBe(3);
		setClassicalChartGlobal('transitOrb', 0);
		expect(transitOrbDefault()).toBe(1);
		setClassicalChartGlobal('transitOrb', 1);
		const src = code('components/astro/AstroExtraCommon.js');
		expect(src).toContain("import { classicalBackendOverridesFromPlain, classicalGlobalValue } from '../../utils/classicalChartGlobals';");
		expect(src).not.toContain("require('../../utils/classicalChartGlobals')");
	});
	test('流派预设同写全局仓:不再包一层 try(setClassicalChartGlobal 内部已兜底)', () => {
		const src = code('components/astro/AstroChartMain.js');
		expect(src).toContain("['termsVariant', 'triplicity', 'lotReversal', 'sectBuffer', 'lotsDocReverse'].forEach(");
		expect(src).not.toMatch(/try\s*\{\s*\['termsVariant', 'triplicity'/);
	});
});

describe('星历 / 回归轴快照的度数列直接用 fmtDegree', () => {
	const CHART = { params: { birth: '1990-01-01 12:00:00', zone: '+08:00', lat: '39n54', lon: '116e24' } };
	test('fmtDegree 自带判空(原 rtDeg 的 if(!v) 与之重复)', () => {
		[null, undefined, 0, '', false].forEach((v) => expect(fmtDegree(v)).toBe('-'));
		expect(fmtDegree({ sign: 'Aries', signlon: 12.345 })).toMatch(/12\.35°$/);
	});
	test('回归轴:缺上升 → -;有上升 → 星座 + 度', async () => {
		request.mockResolvedValue({ Result: { rows: [
			{ year: 2026, solarReturn: { datetime: '2026-01-01 10:00' }, lunarReturn: null, solarAsc: { sign: 'Leo', signlon: 3.5 }, lunarAsc: null },
		] } });
		const txt = await buildReturnTimelineSnapshotText(CHART, { startYear: 2026, count: 1 });
		const row = txt.split('\n').find((l) => l.startsWith('| 2026 |'));
		expect(row).toBe(`| 2026 | 2026-01-01 10:00 | - | ${fmtDegree({ sign: 'Leo', signlon: 3.5 })} | - |`);
	});
	test('星历:入座行的位置列 = fmtDegree(行)', async () => {
		const ing = { datetime: '2026-02-01 00:00', body: 'Sun', toSign: 'Aquarius', sign: 'Aquarius', signlon: 0.01 };
		request.mockResolvedValue({ Result: { ingresses: [ing] } });
		const txt = await buildEphemerisSnapshotText(CHART, { startDate: '2026-01-01', endDate: '2026-03-01' });
		expect(txt).toContain(`| ${fmtDegree(ing)} |`);
	});
	test('源码:不再有 ephDeg / rtDeg 包装', () => {
		expect(code('components/astro/AstroEphemeris.js')).not.toMatch(/\bephDeg\b/);
		const rt = code('components/astro/AstroReturnTimeline.js');
		expect(rt).not.toMatch(/\brtDeg\b/);
		expect(rt).not.toContain("v ? fmtDegree(v) : '-'");
	});
});

describe('合盘快照黄道名', () => {
	test('zodiacalDisplayText 恒导出,不再 typeof 判函数', () => {
		const src = code('components/astro/AstroRelative.js');
		expect(src).toContain('AstroConst.zodiacalDisplayText(zodRaw');
		expect(src).not.toContain("typeof AstroConst.zodiacalDisplayText === 'function'");
	});
});

describe('推运三页共用 today / methodTab', () => {
	test('today = 本机今日 YYYY-MM-DD;methodTab 三档名', () => {
		const d = new Date();
		const pad = (n) => `${n}`.padStart(2, '0');
		expect(today()).toBe(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
		expect(methodTab({ method: 'secondary' })).toBe('二次推运');
		expect(methodTab({ method: 'tertiary' })).toBe('三次推运');
		expect(methodTab({ method: 'minor' })).toBe('小推运');
	});
	test('三页从 astroProgSnapshot 引,不再各带一份', () => {
		['AstroJaynesProgressions.js', 'AstroProgressions.js', 'AstroVedicProgressions.js'].forEach((f) => {
			const src = code(`components/astro/${f}`);
			expect(`${f}:${/import \{[^}]*\btoday\b[^}]*\bmethodTab\b[^}]*\} from '\.\/astroProgSnapshot';/.test(src)}`).toBe(`${f}:true`);
			expect(`${f}:${/\bfunction (today|methodTab)\s*\(/.test(src)}`).toBe(`${f}:false`);
		});
		// today(zone):「今日」按本盘时区(不给 = 本机今日)
		expect(code('components/astro/astroProgSnapshot.js')).toMatch(/export function today\(zone\)/);
	});
});

describe('印盘 / 美术轮盘高度变量单一来源', () => {
	test('buildChartHeightStyle:数字补 px、字符串原样、缺省 720px', () => {
		expect(buildChartHeightStyle(640)).toEqual({ '--india-chart-height': '640px' });
		expect(buildChartHeightStyle('80vh')).toEqual({ '--india-chart-height': '80vh' });
		expect(buildChartHeightStyle()).toEqual({ '--india-chart-height': '720px' });
		expect(buildChartHeightStyle(0)).toEqual({ '--india-chart-height': '720px' });
	});
	test('北 / 东印盘与美术轮盘从 IndiaSouthChart 引,不再各带一份', () => {
		['IndiaNorthChart.js', 'IndiaEastChart.js', 'AstroWheelArtChart.js'].forEach((f) => {
			const src = code(`components/astro/${f}`);
			expect(`${f}:${/\bbuildChartHeightStyle,\n\} from '\.\/IndiaSouthChart';/.test(src)}`).toBe(`${f}:true`);
			expect(`${f}:${/function buildChartHeightStyle\s*\(/.test(src)}`).toBe(`${f}:false`);
		});
	});
});

describe('3D 文字精灵', () => {
	test('旧 TextSprite.js 全仓零 import 已删(在用的是 labelSprite.makeTextSprite)', () => {
		expect(fs.existsSync(path.join(SRC, 'components/astro3d/TextSprite.js'))).toBe(false);
		expect(code('components/astro3d/labelSprite.js')).toMatch(/export function makeTextSprite\(/);
	});
});

describe('星座中文名 signCnName 单一来源', () => {
	const { signCnName } = require('../AstroExtraCommon');
	const { SIGNS } = require('../../../divination/data/signs');
	test('与原各页内联 sn 逐值相同', () => {
		const oldSn = (s) => (SIGNS[s] && SIGNS[s].cn) || s || '-';
		[...Object.keys(SIGNS), 'NoSuch', '', null, undefined, 0].forEach((s) => expect(signCnName(s)).toBe(oldSn(s)));
	});
	test('埃及 / 十二分部 / 衍生宫三页从 AstroExtraCommon 引,不再各带一份', () => {
		['AstroEgypt.js', 'AstroDodeca.js', 'AstroDerivedHouses.js'].forEach((f) => {
			const src = code(`components/astro/${f}`);
			expect(`${f}:${/signCnName as sn \} from '\.\/AstroExtraCommon';/.test(src)}`).toBe(`${f}:true`);
			expect(`${f}:${/const sn\s*=/.test(src)}`).toBe(`${f}:false`);
		});
	});
});
