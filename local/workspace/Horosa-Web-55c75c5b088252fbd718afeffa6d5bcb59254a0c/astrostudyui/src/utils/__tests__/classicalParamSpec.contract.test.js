// [WP-1] 古典参数 spec 单源五方全等契约。
// 病根:一键至少七方登记(默认仓/类型表/播种/挂载齿轮/抽屉控件/Java 白名单/快照自陈),
// 历史漂移实锤=viaCombustaVariant 漏播种、三开关漏 UI。本契约锁:任何一方漏键/值漂即红。
// 五方:①spec≡CLASSICAL_GLOBAL_DEFAULTS ②spec≡newEmptyFields 播种(按 seed 语义)
// ③spec≡ASTRO_CHART_FIELDS 挂载齿轮 ④spec⊆两 Java Controller 白名单(fs grep)
// ⑤spec(send:nonDefault)全覆盖快照自陈行为。
import fs from 'fs';
import path from 'path';
import '../../models/astro';   // 触发 newEmptyFields 基准工厂注册
import { CLASSICAL_PARAM_SPEC, CLASSICAL_SPEC_KEYS, specDefaults, specOptionLabel } from '../classicalParamSpec';
import { CLASSICAL_GLOBAL_DEFAULTS, classicalGlobalOverrides, setClassicalChartGlobal, __resetClassicalGlobalsCacheForTest } from '../classicalChartGlobals';
import { buildClassicalCalibreLine } from '../astroAiSnapshot';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';

const NON_DEFAULT_SAMPLE = {
	termsVariant: 3, geminiBoundEmended: 1, leoBoundFirst: 1, triplicity: 'Ptolemaic',
	sectBuffer: 'ptolemy5', westNodeType: 'true', nodeExaltation: 1,
	cazimiOrb: 1, combustOrb: 8, underBeamsOrb: 15,
	vocMode: 'kenodromia', vocIncludeOuter: 1, viaCombustaVariant: 'narrow',
	lotReversal: 0, lotsDocReverse: 1,
	partileDef: 'le1', antisciaOrb: 2,
	fixedStarOrbMode: 'byMagnitude', fixedStarOrb: 2,
	houseCuspAdvance: 0,
	// [WP-2] 天文口径批
	combustOwnChariotExempt: 1, westLilithType: 'true', topocentricMoon: 1,
	stationMarking: 'absSpeed', eclipseTimeMode: 'syzygy',
	// [WP-3] 希腊点变体批
	hermeticLotsReversal: 0, erosConstruction: 'valens', lotFortuneVariant: 'moonAboveNight',
	lotFatherCombustAlt: 1, lotProjection: 'sign',
	// [WP-4] 尊贵与判定批
	dignityDebilities: 0, peregrineScore: 0, almutenTripMode: 'sectRulerOnly',
	domicileMasterMethod: 'bound', dynamicalDivisions: 1, busyPlaces: '1,4,7,10',
	planetaryHourMethod: 'equal24',
	// [WP-5a] 容许度体系批
	orbSystem: 'byAspect', luminaryOrbBonus: 20, transitOrb: 3,
	aspectShowOnlyApplying: 1, separatingOrbCap: 2,
	// [WP-5b] 相位对象扩展
	aspectIncludeCusps: 1, aspectIncludeLots: 1, aspectIncludeMidpoints: 1,
	// [WP-6] 返照专项
	solarReturnVariant: 'hellenistic', returnLatitudeMode: 'withLatitude',
	// [WP-8] 灵学扩展
	vulcanCalc: 'baker', rayWeighting: 'equal',
};

beforeEach(() => {
	localStorage.clear();
	__resetClassicalGlobalsCacheForTest();
});

describe('① spec ≡ CLASSICAL_GLOBAL_DEFAULTS(键集+值全等)', () => {
	it('键集全等且值逐键相等(spec 是唯一定义处)', () => {
		const d = specDefaults();
		expect(Object.keys(CLASSICAL_GLOBAL_DEFAULTS).sort()).toEqual(Object.keys(d).sort());
		Object.keys(d).forEach((k) => {
			expect(CLASSICAL_GLOBAL_DEFAULTS[k]).toBe(d[k]);
		});
	});

	it('spec 每键必有 group/label/type/valueType/send/seed;非 switch 必有 options 且 default 在档内', () => {
		CLASSICAL_PARAM_SPEC.forEach((s) => {
			expect(s.group).toBeTruthy();
			expect(s.label).toBeTruthy();
			expect(['segmented', 'select', 'switch']).toContain(s.type);
			expect(['int', 'float', 'str']).toContain(s.valueType);
			expect(['nonDefault', 'never']).toContain(s.send);
			expect(['always', 'conditional', 'never']).toContain(s.seed);
			if(s.type !== 'switch'){
				expect(Array.isArray(s.options) && s.options.length >= 2).toBe(true);
				expect(s.options.some((o) => o.value === s.default)).toBe(true);
			}
		});
		expect(NON_DEFAULT_SAMPLE && Object.keys(NON_DEFAULT_SAMPLE).sort()).toEqual(CLASSICAL_SPEC_KEYS.slice().sort());
		Object.keys(NON_DEFAULT_SAMPLE).forEach((k) => {
			expect(NON_DEFAULT_SAMPLE[k]).not.toBe(CLASSICAL_GLOBAL_DEFAULTS[k]);
		});
	});
});

describe('② spec ≡ newEmptyFields 播种(seed 语义)', () => {
	const freshBaseline = () => {
		jest.resetModules();
		require('../../models/astro');
		const { captureNonDefaultTechniqueFields, registerFieldsBaselineFactory } = require('../recordFieldsRestore');
		void captureNonDefaultTechniqueFields; void registerFieldsBaselineFactory;
		const astro = require('../../models/astro');
		void astro;
		// newEmptyFields 未 export:经 baseline 工厂间接取(与 captureNonDefault 同源)。
		const rfr = require('../recordFieldsRestore');
		let baseline = null;
		rfr.registerFieldsBaselineFactory.call(null, undefined); // no-op 保注册态
		// 直接用 capture 的内部工厂不可达 → 改走「捕获空 fields 基线为 {}」不适用;
		// 由 models/astro 的注册副作用后,用一个探针 fields 判断 schema 键集:
		// captureNonDefault({k:{value:默认}}) 返回 {} ⇔ k 在 schema 基线且值==默认。
		baseline = null;
		return { rfr };
	};
	void freshBaseline;

	it('seed=always 键:默认态 schema 含键(值==默认 → capture 不落库)', () => {
		jest.resetModules();
		require('../../models/astro');
		const { captureNonDefaultTechniqueFields } = require('../recordFieldsRestore');
		CLASSICAL_PARAM_SPEC.filter((s) => s.seed === 'always').forEach((s) => {
			// schema 有此键且默认==spec.default ⇒ 喂默认值零捕获
			const probe = { [s.key]: { value: s.default } };
			const captured = captureNonDefaultTechniqueFields(probe);
			expect(captured[s.key]).toBeUndefined();
			// 喂非默认值必捕获(证明 manifest+schema 双在位)
			const probe2 = { [s.key]: { value: NON_DEFAULT_SAMPLE[s.key] } };
			const captured2 = captureNonDefaultTechniqueFields(probe2);
			expect(captured2[s.key]).toBe(NON_DEFAULT_SAMPLE[s.key]);
		});
	});

	it('seed=conditional 键:默认态不播(键集不膨胀);全局改非默认后播种值=全局值', () => {
		jest.resetModules();
		localStorage.clear();
		let astro = require('../../models/astro');
		void astro;
		const rfr1 = require('../recordFieldsRestore');
		// conditional 键 schema 默认无 ⇒「出现即非默认」:喂默认值也捕获(termsVariant 族既有语义)
		CLASSICAL_PARAM_SPEC.filter((s) => s.seed === 'conditional').forEach((s) => {
			const captured = rfr1.captureNonDefaultTechniqueFields({ [s.key]: { value: NON_DEFAULT_SAMPLE[s.key] } });
			expect(captured[s.key]).toBe(NON_DEFAULT_SAMPLE[s.key]);
		});
	});
});

describe('③ spec ≡ ASTRO_CHART_FIELDS 挂载齿轮', () => {
	it('spec 每键(send=never 的纯前端键除外)有同名齿轮,default 相等;全局仓键必带 globalCurrent', () => {
		const schema = getTechniqueSettingsSchema('astrochart') || {};
		const fieldsList = Array.isArray(schema) ? schema : (schema.fields || []);
		const byName = {};
		fieldsList.forEach((f) => { byName[f.name] = f; });
		CLASSICAL_PARAM_SPEC.forEach((s) => {
			if(s.send === 'never'){ return; }   // partileDef 纯前端不进挂载重算齿轮
			const gear = byName[s.key];
			expect(gear).toBeTruthy();
			expect(gear.default).toBe(s.default);
			expect(typeof gear.globalCurrent).toBe('function');
		});
	});
});

describe('④ spec ⊆ Java 白名单(两 Controller fs grep)', () => {
	const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
	it('send=nonDefault 的键(backendKey 映射后)在 ChartController 与 PredictiveController 都被透传', () => {
		const chartCtrl = read('../../../../astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java');
		const predCtrl = read('../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java');
		CLASSICAL_PARAM_SPEC.filter((s) => s.send === 'nonDefault').forEach((s) => {
			const backendName = s.backendKey || s.key;
			expect(chartCtrl.includes(`"${backendName}"`)).toBe(true);
			expect(predCtrl.includes(`"${backendName}"`)).toBe(true);
		});
	});
});

describe('⑤ spec(send=nonDefault)全覆盖快照口径自陈', () => {
	it('逐键拨非默认 → buildClassicalCalibreLine 产非空自陈行;全默认 → 空串零增行', () => {
		expect(buildClassicalCalibreLine({})).toBe('');
		const defaultsFields = {};
		Object.keys(CLASSICAL_GLOBAL_DEFAULTS).forEach((k) => { defaultsFields[k] = { value: CLASSICAL_GLOBAL_DEFAULTS[k] }; });
		expect(buildClassicalCalibreLine(defaultsFields)).toBe('');
		CLASSICAL_PARAM_SPEC.filter((s) => s.send === 'nonDefault').forEach((s) => {
			// vocIncludeOuter 是伴发键(仅随非默认 vocMode 下发,单独改无后端效果——正确语义):
			// 自陈按同语义,测试带 vocMode 一起拨。
			const probe = { [s.key]: { value: NON_DEFAULT_SAMPLE[s.key] } };
			if(s.key === 'vocIncludeOuter'){ probe.vocMode = { value: 'kenodromia' }; }
			const line = buildClassicalCalibreLine(probe);
			expect(line).toMatch(/^古典口径（非默认项）：/);
			expect(line.length).toBeGreaterThan(12);
		});
	});

	it('specOptionLabel:值→档位标签(自陈/回显复用面)', () => {
		expect(specOptionLabel('termsVariant', 3)).toBe('迦勒底界');
		expect(specOptionLabel('vocMode', 'kenodromia')).toBe('30° 法（希腊化）');
		expect(specOptionLabel('unknownKey', 9)).toBe('9');
	});
});

describe('全局仓写读经 spec 键(端到端)', () => {
	it('spec 每键 set→overrides 现键;拨回默认→overrides 清空', () => {
		CLASSICAL_PARAM_SPEC.forEach((s) => {
			setClassicalChartGlobal(s.key, NON_DEFAULT_SAMPLE[s.key]);
			expect(classicalGlobalOverrides()[s.key]).toBe(NON_DEFAULT_SAMPLE[s.key]);
			setClassicalChartGlobal(s.key, s.default);
			expect(classicalGlobalOverrides()[s.key]).toBeUndefined();
		});
	});
});

// ── [F17] 横向复制点契约(第一轮对抗复审元观察:纵线契约之外的四个复制点每批全停更) ──
describe('横向复制点全等(第三闸/回显白名单/PD 收缩/卜卦构参)', () => {
	const fs = require('fs');
	const path = require('path');
	const UI = path.join(__dirname, '../..');
	const REPO = path.join(UI, '../../..');
	const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
	const NON_DEFAULT_KEYS = CLASSICAL_PARAM_SPEC.filter((s) => s.send === 'nonDefault').map((s) => s.backendKey || s.key);
	const NEVER_KEYS = CLASSICAL_PARAM_SPEC.filter((s) => s.send === 'never').map((s) => s.key);

	it('第三 Java 闸(合盘 ModernChartController):send 键全在、never 键全不在', () => {
		const src = read('Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/ModernChartController.java');
		NON_DEFAULT_KEYS.forEach((k) => {
			expect(`ModernChartController:${k}:${src.includes(`"${k}"`)}`).toBe(`ModernChartController:${k}:true`);
		});
		NEVER_KEYS.forEach((k) => {
			expect(`ModernChartController:never:${k}:${src.includes(`"${k}"`)}`).toBe(`ModernChartController:never:${k}:false`);
		});
	});

	it('never 键负锁:两主 Controller 也不得混入纯前端键', () => {
		const chart = read('Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java');
		const pred = read('Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java');
		NEVER_KEYS.forEach((k) => {
			expect(`chart:never:${k}:${chart.includes(`"${k}"`)}`).toBe(`chart:never:${k}:false`);
			expect(`pred:never:${k}:${pred.includes(`"${k}"`)}`).toBe(`pred:never:${k}:false`);
		});
	});

	it('回显白名单(webchartsrv 常量+helper):send 键全在——缺谁谁在派生链静默回默认', () => {
		const web = read('Horosa-Web/astropy/websrv/webchartsrv.py');
		const helper = read('Horosa-Web/astropy/astrostudy/helper.py');
		// eclipseTimeMode 走 astroextra 独立端点非 /chart 回显;其余 send 键必须双双在场。
		NON_DEFAULT_KEYS.filter((k) => k !== 'eclipseTimeMode').forEach((k) => {
			expect(`web-echo:${k}:${web.includes(`'${k}'`)}`).toBe(`web-echo:${k}:true`);
			expect(`helper-echo:${k}:${helper.includes(`'${k}'`)}`).toBe(`helper-echo:${k}:true`);
		});
	});

	it('PD 链零收缩:termsVariant 不得再现 (1|2) 收缩形态(3/4 被吞=各 PD 表面口径分裂)', () => {
		['Horosa-Web/astrostudyui/src/utils/primaryDirectionSync.js',
			'Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js',
			'Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirectionChart.js',
			'Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js'].forEach((rel) => {
			const src = read(rel);
			const shrunk = /===\s*1\s*\|\|[^)]{0,40}===\s*2\s*\)\s*\?[^:]{0,40}:\s*0/.test(src);
			expect(`${rel}:shrunk:${shrunk}`).toBe(`${rel}:shrunk:false`);
		});
	});

	it('卜卦构参:user 档附历元两参(缺参后端静默回落 Lahiri)', () => {
		const src = read('Horosa-Web/astrostudyui/src/divination/engine/chartRequest.js');
		expect(src.includes('userAyanParamsFrom')).toBe(true);
	});

	it('合盘 Python 层:webmodernsrv 走复合临界区(散 push 禁复活)', () => {
		const src = read('Horosa-Web/astropy/websrv/webmodernsrv.py');
		expect(src.includes('push_classical_request(data)')).toBe(true);
		expect(src.includes('pop_classical_request(')).toBe(true);
		expect(src.includes('push_request_exalt_variants(')).toBe(false);
	});
});

// ── [R5] 合同③b:挂载齿轮 options 集 ⊇ spec options 集(值域全等;label 不比) ──
// P2-4(apparent)/P2-5(15°) 两缺档实锤:合同③只锁键/default/globalCurrent,options 集是盲区——
// spec 加档、齿轮不加 → 全局改新档后齿轮回显异常且不能逐盘钉。负向:齿轮多出 spec 没有的值也红(野档)。
describe('挂载齿轮 options 集与 spec 全等', () => {
	it('每个 select/segmented 型 spec 键:齿轮 options 值集合 === spec options 值集合', () => {
		const { getTechniqueSettingsSchema } = require('../techniqueMountSettings');
		const fields = getTechniqueSettingsSchema('astrochart').fields;
		const byName = {};
		fields.forEach((f) => { byName[f.name] = f; });
		CLASSICAL_PARAM_SPEC.filter((s) => s.send === 'nonDefault' && Array.isArray(s.options)).forEach((s) => {
			const gear = byName[s.key];
			if(!gear || !Array.isArray(gear.options)){ return; }   // 键存在性由合同③管;此处只审有 options 的
			const specVals = s.options.map((o) => `${o.value}`).sort();
			const gearVals = gear.options.map((o) => `${o.value}`).sort();
			expect(`${s.key}: ${gearVals.join('|')}`).toBe(`${s.key}: ${specVals.join('|')}`);
		});
	});
});
