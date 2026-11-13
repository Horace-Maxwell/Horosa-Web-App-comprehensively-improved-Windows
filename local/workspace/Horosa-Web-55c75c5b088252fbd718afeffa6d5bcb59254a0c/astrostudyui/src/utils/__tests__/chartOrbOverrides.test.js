// 容许度(逐星表 orbs / 整体倍率 orbScale)跨层接入合同。
// 病理:容许度存在随盘字段里,不在古典全局仓;合盘 / 量化盘 / 节气盘 / 主限法 / 骰子盘 / 卜卦择日世俗壳
// 各自手写构参,漏带 → 用户在「容许度设置」里调了,主盘的相位变、别的盘还是默认容许度。
// 三层都要通:①前端每个构参点带 ②Java 白名单收 ③Python 拷进每盘 data 并回显。任何一层丢键都是静默的。
// 合同:单源助手的取舍 + 三层源码锚。
import fs from 'fs';
import path from 'path';
import {
	CHART_ORB_KEYS, chartOrbOverrides, chartOrbOverridesFromFields, chartOrbOverridesFromPlain,
	chartOrbSignature, pruneStaleClassicalParams, classicalBackendOverrides,
} from '../classicalChartGlobals';
const { readSource } = require('./helpers/sourceSet');

const UI_ROOT = path.resolve(__dirname, '..', '..');
const REPO_WEB = path.resolve(UI_ROOT, '..', '..');
const read = (rel) => readSource(path.resolve(UI_ROOT, rel));
const readRepo = (rel) => fs.readFileSync(path.resolve(REPO_WEB, rel), 'utf8');

describe('chartOrbOverrides(单源助手):默认不发,非默认才发', () => {
	it('键集固定为 orbs / orbScale', () => {
		expect(CHART_ORB_KEYS).toEqual(['orbs', 'orbScale']);
	});
	it('空 / 默认 / 脏值恒返回 {} —— 请求体与缓存键零回归', () => {
		expect(chartOrbOverridesFromPlain(undefined)).toEqual({});
		expect(chartOrbOverridesFromPlain({})).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbScale: 1 })).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbScale: '1' })).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbScale: '' })).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbScale: null })).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbScale: 0 })).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbScale: -2 })).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbScale: 'abc' })).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbs: {} })).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbs: null })).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbs: [1, 2] })).toEqual({});
		expect(chartOrbOverridesFromPlain({ orbs: 'not-an-object' })).toEqual({});
	});
	it('非默认照发:倍率转数字,逐星表原样', () => {
		expect(chartOrbOverridesFromPlain({ orbScale: 1.5 })).toEqual({ orbScale: 1.5 });
		expect(chartOrbOverridesFromPlain({ orbScale: '0.5' })).toEqual({ orbScale: 0.5 });
		const orbs = { Sun: 12, Moon: 10 };
		expect(chartOrbOverridesFromPlain({ orbs, orbScale: 2 })).toEqual({ orbs, orbScale: 2 });
	});
	it('从表单字段读({ value })与从平铺对象读同一结果', () => {
		const fields = { orbs: { value: { Sun: 9 } }, orbScale: { value: 1.25 } };
		expect(chartOrbOverridesFromFields(fields)).toEqual({ orbs: { Sun: 9 }, orbScale: 1.25 });
		expect(chartOrbOverridesFromFields(undefined)).toEqual({});
		expect(chartOrbOverridesFromFields({ orbScale: {} })).toEqual({});
	});
	it('取值函数抛错不外泄', () => {
		expect(chartOrbOverrides(() => { throw new Error('x'); })).toEqual({});
	});
	it('签名与逐星表键序无关,倍率变则签名变', () => {
		const a = chartOrbSignature({ orbs: { Sun: 9, Moon: 8 }, orbScale: 2 });
		const b = chartOrbSignature({ orbs: { Moon: 8, Sun: 9 }, orbScale: 2 });
		expect(a).toBe(b);
		expect(chartOrbSignature({ orbScale: 2 })).not.toBe(chartOrbSignature({ orbScale: 1.5 }));
		expect(chartOrbSignature(undefined)).toBe('{}');
		expect(chartOrbSignature({})).toBe('{}');
	});
	it('改回默认后,旧参数包里粘着的容许度被清掉', () => {
		const merged = { date: '2000-01-01', orbs: { Sun: 9 }, orbScale: 2 };
		pruneStaleClassicalParams(merged, { date: '2000-01-01' });
		expect(merged).toEqual({ date: '2000-01-01' });
		const kept = { orbScale: 2 };
		pruneStaleClassicalParams(kept, { orbScale: 2 });
		expect(kept).toEqual({ orbScale: 2 });
	});
	it('容许度不进古典全局口径的输出(那份输出还被 AI 口径短语 / 快照签名 / 存档比对整份消费)', () => {
		const out = classicalBackendOverrides((k) => ({ orbs: { Sun: 9 }, orbScale: 2 }[k]));
		expect(out.orbs).toBeUndefined();
		expect(out.orbScale).toBeUndefined();
	});
});

describe('前端构参点:每个自己拼请求体的盘都带容许度', () => {
	// [文件, 至少几处]。主盘走 models/astro 的 fieldsToParams;用 chartParams(chartObj) 的页由 AstroExtraCommon 统一带。
	const SITES = [
		['components/astro/AstroExtraCommon.js', 1],          // natalClassicalParams(返照 / 推运族单源)
		['components/astro/AstroRelative.js', 1],             // 合盘
		['components/astro/AstroPrimaryDirectionChart.js', 2],// 主限法盘:表格重算 + 外圈推运盘两份构参
		['components/direction/AstroDirectMain.js', 2],       // 主限法表(请求体 + 去重键)
		['components/germany/AstroMidpoint.js', 1],           // 量化盘
		['components/germany/UranianDialMain.js', 1],
		['components/germany/UranianHouseFrames.js', 1],
		['components/jieqi/JieQiChartsMain.js', 3],           // 节气盘:缓存键 / 请求体 / 构参三处
		['components/dice/DiceMain.js', 1],                   // 骰子盘
		['components/divination/DivinationChartShell.js', 1], // 卜卦 / 择日 / 世俗壳:宿主容许度变 → 壳内同步
		['components/zeri/TianxingElectionMain.js', 1],       // 天星择日浮窗盘
		['divination/engine/chartRequest.js', 1],
		['utils/babylonAiSnapshot.js', 1],
		['utils/aiAnalysisContext/regenPredictive.js', 1],
		['utils/aiAnalysisContext/primaryDirection.js', 1],   // AI 挂载的主限法盘外圈(与页面构参同律)
	];
	SITES.forEach(([rel, min]) => {
		it(`${rel} 含 ≥${min} 处容许度单源`, () => {
			const src = read(rel);
			const n = (src.match(/chartOrb(Overrides(FromFields|FromPlain)?|Signature)\(/g) || []).length;
			expect(n).toBeGreaterThanOrEqual(min);
		});
	});
	// 推运页签是懒挂载:首次点开时宿主的「换盘回调」还没接上,第一张盘用的是构造函数里的初始参数。
	// 那份初始参数不接本命盘口径 → 第一张推运盘按出厂口径算(容许度 / 界系 / 交点类型全漏),换一次盘才对上。
	['AstroProfection', 'AstroSolarArc', 'AstroSolarReturn', 'AstroLunarReturn', 'AstroGivenYear'].forEach((name) => {
		it(`${name} 首次请求就带本命盘口径(构造函数初始参数 + 换盘回调两处)`, () => {
			const src = read(`components/astro/${name}.js`);
			expect((src.match(/\.\.\.natalClassicalParams\(qryparam\)/g) || []).length).toBeGreaterThanOrEqual(2);
			const ctor = src.slice(src.indexOf('constructor('), src.indexOf('\n\trenderPlanetLabel('));
			expect(ctor.includes('...natalClassicalParams(qryparam)')).toBe(true);
		});
	});
	it('主限法盘外圈请求(buildRequestParams)带古典口径与容许度', () => {
		const src = read('components/astro/AstroPrimaryDirectionChart.js');
		const at = src.indexOf('buildRequestParams(overrideDt)');
		expect(at).toBeGreaterThan(-1);
		const body = src.slice(at, src.indexOf("direction: this.state.pdDirectionValue", at));
		expect(body.includes('...classicalBackendOverridesFromPlain(params)')).toBe(true);
		expect(body.includes('...chartOrbOverridesFromPlain(params)')).toBe(true);
	});
	it('节气盘把两键收进随盘状态键集(宿主字段 → 组件状态 → 构参)', () => {
		const src = read('components/jieqi/JieQiChartsMain.js');
		expect(src.match(/CLASSICAL_STATE_KEYS = \[[^\]]*\.\.\.CHART_ORB_KEYS\]/)).toBeTruthy();
	});
	it('chartParams / chartRequestKey 两处都带(用 chartObj 回显参数的页靠它)', () => {
		const src = read('components/astro/AstroExtraCommon.js');
		expect((src.match(/orbs: params\.orbs/g) || []).length).toBeGreaterThanOrEqual(1);
		expect((src.match(/orbScale: params\.orbScale/g) || []).length).toBeGreaterThanOrEqual(1);
	});
	it('主盘 fieldsToParams 带,结果回显里也带', () => {
		const src = read('models/astro.js');
		expect(src.includes('orbScale')).toBe(true);
		expect(src.includes('orbs')).toBe(true);
	});
	it('天星择日扫描构参不带:扫描条件各自带容许度,引擎侧不认用户表;带了只会让「结果已过期」误亮', () => {
		const src = read('components/zeri/TianxingElectionMain.js');
		const at = src.indexOf('scanClassicalParams(scanCfg){');
		expect(at).toBeGreaterThan(-1);
		const body = src.slice(at, src.indexOf('\n\t}', at));
		expect(body.includes('chartOrb')).toBe(false);
	});
});

describe('Java 白名单:五个出相位的入口都收两键(漏一个 = 那条链静默回默认容许度)', () => {
	const CONTROLLERS = [
		'astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java',
		'astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java',
		'astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java',
		'astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/ModernChartController.java',
		'astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/GermanyTechController.java',
	];
	CONTROLLERS.forEach((rel) => {
		it(`${path.basename(rel)} 收 orbs 与 orbScale`, () => {
			const src = readRepo(rel);
			CHART_ORB_KEYS.forEach((k) => expect(src.includes(`"${k}"`)).toBe(true));
		});
	});
});

describe('Java 白名单:关系量化(与八重合共用的那一组参数)也收两键', () => {
	// 整个文件里出现过键名不算数:同一个控制器里各入口各有自己的取参函数,关系量化这一组曾经漏放行 ——
	// 比较盘随整体倍率放缩、关系量化仍按固定 1° 判,同一对盘两处对不上
	it('getRelativeParams 的函数体里放行 orbs 与 orbScale', () => {
		const src = readRepo('astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java');
		const at = src.indexOf('getRelativeParams(){');
		expect(at).toBeGreaterThan(0);
		const body = src.slice(at, src.indexOf('\n\t}\n', at));
		expect(body).toContain('miss.inner');
		CHART_ORB_KEYS.forEach((k) => {
			expect(body.includes(`TransData.containsParam("${k}")`)).toBe(true);
			expect(body.includes(`params.put("${k}", TransData.get("${k}"))`)).toBe(true);
		});
	});
	it('引擎端:关系量化把两键拷进两张盘', () => {
		const src = readRepo('astropy/astrostudy/astroextra_parts/relative.py');
		expect(src.includes("'orbs', 'orbScale'") || (src.includes("'orbs'") && src.includes("'orbScale'"))).toBe(true);
	});
});

describe('Python:两键拷进每盘 data 并随结果回显', () => {
	it('主盘回显键集含两键(前端 chartObj.params 靠它把容许度带去别的页)', () => {
		const srv = readRepo('astropy/websrv/webchartsrv.py');
		const seg = srv.slice(srv.indexOf('_CLASSICAL_ECHO_KEYS'));
		expect(seg.slice(0, 1600).includes("'orbs', 'orbScale'")).toBe(true);
		expect(readRepo('astropy/astrostudy/helper.py').includes("'orbs', 'orbScale'")).toBe(true);
	});
	it('合盘入口把两键拷进 inner / outer(引擎从每盘 data 读)', () => {
		expect(readRepo('astropy/websrv/webmodernsrv.py').includes("'orbs', 'orbScale'")).toBe(true);
	});
	it('排盘引擎读两键', () => {
		const src = readSource(path.resolve(REPO_WEB, 'astropy/astrostudy/perchart.py'));
		expect(src.includes("data.get('orbs')")).toBe(true);
		expect(src.includes("data['orbScale']")).toBe(true);
	});
});
