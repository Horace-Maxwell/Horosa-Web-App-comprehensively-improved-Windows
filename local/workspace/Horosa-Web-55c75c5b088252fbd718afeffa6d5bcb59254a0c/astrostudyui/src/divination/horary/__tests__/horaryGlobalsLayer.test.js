// horaryGlobalsLayer.test.js —— 判读参数四层优先级哨兵：
//   引擎内建默认 < 全局仓(星盘设置) < 流派差异集(SCHOOL_JUDGE_DIFF) < 页面 overrides。
// 关键定理：无全局层（globals 缺省/空对象）时输出与三参前的实现逐字节一致（零回归自证）。
import {
	HORARY_SCHOOLS, HORARY_SCHOOL_ORDER, HORARY_PARAM_SPEC, HORARY_PARAM_BY_KEY,
	SCHOOL_JUDGE_DIFF, horaryJudgeOpts,
} from '../horarySchools';
import { CLASSICAL_GLOBAL_DEFAULTS } from '../../../utils/classicalChartGlobals';
import { DIVINATION_JUDGE_DEFAULTS } from '../../../utils/divinationJudgeGlobals';

describe('四层优先级 · 零回归自证', () => {
	test('globals 缺省 == 空对象 == 三层语义(七档全量逐键相等)', () => {
		HORARY_SCHOOL_ORDER.forEach((id) => {
			const noArg = horaryJudgeOpts(id);
			const empty = horaryJudgeOpts(id, null, {});
			expect(empty).toEqual(noArg);
			// 与「预设 judge 全量展开」的旧实现语义等价(judge = defaults ∪ diff)。
			const sc = HORARY_SCHOOLS[id];
			Object.keys(sc.judge).forEach((k) => {
				expect(noArg[k]).toEqual(sc.judge[k]);
			});
		});
	});

	test('SCHOOL_JUDGE_DIFF 与 judge 合成关系成立(judge = 基线 ∪ diff;diff 键必在 judge 同值)', () => {
		HORARY_SCHOOL_ORDER.forEach((id) => {
			const diff = SCHOOL_JUDGE_DIFF[id];
			expect(diff).toBeTruthy();
			Object.keys(diff).forEach((k) => {
				expect(HORARY_SCHOOLS[id].judge[k]).toEqual(diff[k]);
			});
		});
	});
});

describe('四层优先级 · 全局层生效面', () => {
	test('流派未绑定的键：全局值生效（classical 未绑 antiscia/cazimiOrb → 全局压过基线）', () => {
		expect(SCHOOL_JUDGE_DIFF.classical.antiscia).toBeUndefined();
		expect(SCHOOL_JUDGE_DIFF.classical.cazimiOrb).toBeUndefined();
		const o = horaryJudgeOpts('classical', null, { antiscia: false, cazimiOrb: 1 });
		expect(o.antiscia).toBe(false);
		expect(o.cazimiOrb).toBe(1);
	});

	test('流派学理绑定的键：流派差异集恒压过全局（classical 绑 vocMode → 全局 by_orb 不生效）', () => {
		expect(SCHOOL_JUDGE_DIFF.classical.vocMode).toBe('classic');
		const o = horaryJudgeOpts('classical', null, { vocMode: 'by_orb' });
		expect(o.vocMode).toBe('classic');
		// 但同一全局对未绑定该键的档…… 七档全绑 vocMode(学理),此处再验 medieval 绑 cazimi 压过全局。
		const m = horaryJudgeOpts('medieval', null, { cazimiOrb: 1 });
		expect(m.cazimiOrb).toBe(16 / 60);
	});

	test('页面 overrides 是最高层（压过全局与流派差异集）', () => {
		const o = horaryJudgeOpts('classical', { vocMode: 'kenodromia', antiscia: true }, { vocMode: 'by_orb', antiscia: false });
		expect(o.vocMode).toBe('kenodromia');
		expect(o.antiscia).toBe(true);
	});

	test('全局层白名单收编：非判读域键（hsys/school/任意杂键）不得渗入 opts', () => {
		const o = horaryJudgeOpts('classical', null, { hsys: 99, school: 'hack', tripSystem: 'dorothean', ___x: 1 });
		expect(o.hsys).toBeUndefined();
		expect(o.school).toBe('classical');
		expect(o.tripSystem).toBe('ptolemaic');
		expect(o.___x).toBeUndefined();
	});
});

describe('spec.scope 三作用域划分与双 store 覆盖一致性', () => {
	test('每项 scope ∈ {global, school, horary}', () => {
		HORARY_PARAM_SPEC.forEach((p) => {
			expect(['global', 'school', 'horary']).toContain(p.scope);
		});
	});

	test('scope=global 的键必在两全局仓之一（星盘设置有真实控件落点,防死键）', () => {
		const storeKeys = new Set([
			...Object.keys(CLASSICAL_GLOBAL_DEFAULTS),
			...Object.keys(DIVINATION_JUDGE_DEFAULTS),
		]);
		HORARY_PARAM_SPEC.filter((p) => p.scope === 'global').forEach((p) => {
			expect(storeKeys.has(p.key)).toBe(true);
		});
	});

	test('scope=global 且属判读域的键：默认值与 divinationJudgeGlobals 默认逐键一致（双仓不漂移）', () => {
		Object.keys(DIVINATION_JUDGE_DEFAULTS).forEach((k) => {
			const spec = HORARY_PARAM_BY_KEY[k];
			expect(spec).toBeTruthy();
			expect(spec.scope).toBe('global');
			expect(spec.default).toEqual(DIVINATION_JUDGE_DEFAULTS[k]);
		});
	});

	test('scope=horary 的键不含任何全局仓键（卜卦面板与星盘设置零双入口）', () => {
		const storeKeys = new Set([
			...Object.keys(CLASSICAL_GLOBAL_DEFAULTS),
			...Object.keys(DIVINATION_JUDGE_DEFAULTS),
		]);
		HORARY_PARAM_SPEC.filter((p) => p.scope === 'horary').forEach((p) => {
			expect(storeKeys.has(p.key)).toBe(false);
		});
	});

	test('sendToBackend 键的 scope 只能是 school/global（判读面板绝不再渲染排盘键）', () => {
		HORARY_PARAM_SPEC.filter((p) => p.sendToBackend).forEach((p) => {
			expect(['global', 'school']).toContain(p.scope);
		});
	});
});
