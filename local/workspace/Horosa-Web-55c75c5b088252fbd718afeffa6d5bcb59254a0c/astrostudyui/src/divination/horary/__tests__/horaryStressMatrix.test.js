// 判读全局键·前端压力矩阵(2026-07 全功能排查轮)。
// 单键行为各有专门文件锁(horaryGlobalsLayer 四层优先级/horaryBatch2Engine 引擎分支);
// 本文件补穷举缺口:①isPartileByValues 三判据×边界值 ②viaCombustaRange 四档全+垃圾档
// ③moonReport 六口径×计三王×四座注记 24 组合矩阵 ④七档流派×判读九键全键穷举
// (绑定键恒流派值/未绑键恒全局值——GlobalsLayer 只抽验两键,此处全键)。
import { isPartileByValues } from '../../data/accidentalDignity';
import { viaCombustaRange } from '../../engine/radicality';
import { moonReport } from '../../engine/moon';
import {
	HORARY_SCHOOLS, HORARY_SCHOOL_ORDER, SCHOOL_JUDGE_DIFF, horaryJudgeOpts,
} from '../horarySchools';

describe('① isPartileByValues 三判据边界穷举', () => {
	test('same_degree(1647):整数度同格才算,与 orb 无关', () => {
		expect(isPartileByValues(14.2, 14.9, 0.7, 'same_degree')).toBe(true);    // 同 14 格
		expect(isPartileByValues(14.99, 15.01, 0.02, 'same_degree')).toBe(false); // 跨格,orb 再小也不算
		expect(isPartileByValues(0.0, 0.999, 0.999, 'same_degree')).toBe(true);
		expect(isPartileByValues(29.0, 29.99, 0.99, 'same_degree')).toBe(true);
		expect(isPartileByValues(29.99, 29.0, 5.0, 'same_degree')).toBe(true);   // 判据只看格,orb 无关
	});
	test('le1/le3:纯 orb 阈值,含边界等号', () => {
		expect(isPartileByValues(1, 20, 1.0, 'le1')).toBe(true);
		expect(isPartileByValues(1, 20, 1.0000001, 'le1')).toBe(false);
		expect(isPartileByValues(1, 20, 3.0, 'le3')).toBe(true);
		expect(isPartileByValues(1, 20, 3.0000001, 'le3')).toBe(false);
		expect(isPartileByValues(undefined, undefined, 0.5, 'le3')).toBe(true);  // 纯值版不需 signlon
	});
	test('signlon 缺失回退 orb≤1(容错支)与非法判据回默认', () => {
		expect(isPartileByValues(undefined, 5, 0.9, 'same_degree')).toBe(true);
		expect(isPartileByValues(undefined, 5, 1.1, 'same_degree')).toBe(false);
		expect(isPartileByValues(14.2, 14.8, 9, 'nonsense')).toBe(true);         // 未知判据走 same_degree
	});
});

describe('② viaCombustaRange 四档全 + 垃圾档回默认', () => {
	test('四档边界与后端 _VIA_COMBUSTA_RANGES 同值', () => {
		expect(viaCombustaRange('standard')).toEqual([195, 225]);
		expect(viaCombustaRange('narrow')).toEqual([208, 217]);
		expect(viaCombustaRange('scorpioFull')).toEqual([195, 240]);
		expect(viaCombustaRange('bothFull')).toEqual([180, 240]);
	});
	test('垃圾档/空值回默认 195–225', () => {
		['', null, undefined, 'garbage', 42].forEach((v) => {
			expect(viaCombustaRange(v)).toEqual([195, 225]);
		});
	});
});

// ── ③ moonReport 6×2×2 组合矩阵 ──
function factsMoonStress(apps, moonPatch){
	const moon = {
		key: 'moon', lon: 200, sign: 'libra', signlon: 20, house: 7,
		speed: 13.2, isVOC: true, combustion: null, dignityScore: 0, ...(moonPatch || {}),
	};
	const facts = {
		meta: { isDiurnal: true, moonPhase: { phase: 'waxing' } },
		planets: {
			moon,
			sun: { key: 'sun', lon: 100, sign: 'cancer', signlon: 10 },
			saturn: { key: 'saturn', lon: 250, sign: 'sagittarius', signlon: 10 },
			uranus: { key: 'uranus', lon: 230, sign: 'scorpio', signlon: 20 },
		},
		lons: {},
		result: { aspects: { normalAsp: {} } },
	};
	facts.__apps = apps || [];
	return facts;
}
// applyingAspects 由 aspectsEngine 从 result 推;此处直接 mock 该模块最稳。
jest.mock('../../engine/aspectsEngine', () => ({
	applyingAspects: (facts) => (facts.__apps || []).map((a) => ({ other: a.other, angle: a.angle, orb: a.orb })),
}));

describe('③ moonReport 六口径×计三王×四座注记 24 组合矩阵', () => {
	const MODES = ['classic', 'by_orb', 'by_sign_perfect', 'by_sign_orb', 'kenodromia', 'exempt4'];
	test('24 组合全跑不炸且返回结构完整', () => {
		MODES.forEach((m) => {
			[false, true].forEach((outer) => {
				[false, true].forEach((mit) => {
					const r = moonReport(factsMoonStress([{ other: 'saturn', angle: 60, orb: 5 }]),
						{ vocMode: m, vocIncludeOuter: outer, vocMitigateSigns: mit });
					expect(typeof r.voc).toBe('boolean');
					expect(Array.isArray(r.findings)).toBe(true);
				});
			});
		});
	});
	test('vocIncludeOuter 只对前端解算口径生效:kenodromia 下天王入相解空', () => {
		const appsOuterOnly = [{ other: 'uranus', angle: 0, orb: 3 }];
		const rOff = moonReport(factsMoonStress(appsOuterOnly), { vocMode: 'kenodromia', vocIncludeOuter: false });
		const rOn = moonReport(factsMoonStress(appsOuterOnly), { vocMode: 'kenodromia', vocIncludeOuter: true });
		expect(rOff.voc).toBe(true);   // 七政集无入相 → 空
		expect(rOn.voc).toBe(false);   // 计三王 → 天王合月解空
	});
	test('vocMitigateSigns 注记支:月落豁免座+判空 → 出减凶注记(不改判定);exempt4 不重复出注', () => {
		const inTaurus = { sign: 'taurus', lon: 45, signlon: 15 };
		const rMit = moonReport(factsMoonStress([], inTaurus), { vocMode: 'kenodromia', vocMitigateSigns: true });
		expect(rMit.voc).toBe(true);
		expect(rMit.findings.some((f) => f.key === 'voc_mitigated_sign')).toBe(true);
		const rEx = moonReport(factsMoonStress([], inTaurus), { vocMode: 'exempt4', vocMitigateSigns: true });
		expect(rEx.voc).toBe(false);   // exempt4 直接豁免
		expect(rEx.findings.some((f) => f.key === 'voc_mitigated_sign')).toBe(false);
	});
	test('via_combusta finding 吃变体:天蝎 24°(=234°) standard 不中、bothFull 中', () => {
		const inScorpioLate = { sign: 'scorpio', lon: 234, signlon: 24 };
		const rStd = moonReport(factsMoonStress([{ other: 'saturn', angle: 60, orb: 5 }], inScorpioLate), {});
		const rFull = moonReport(factsMoonStress([{ other: 'saturn', angle: 60, orb: 5 }], inScorpioLate), { viaCombustaVariant: 'bothFull' });
		expect(rStd.findings.some((f) => f.key === 'via_combusta')).toBe(false);
		expect(rFull.findings.some((f) => f.key === 'via_combusta')).toBe(true);
	});
});

describe('④ 七档流派 × 判读全局层:全键穷举(绑定键恒流派值/未绑键恒全局值)', () => {
	// 与真实全局仓九键同域的「全非默认」注入(globals 参数形)。
	const G = {
		combustMitigateSameSign: false, antiscia: false,
		cazimiOrb: 1.0, combustOrb: 10.0, underBeamsOrb: 20.0,
		vocMode: 'by_orb', vocIncludeOuter: true, fixedStarOrb: 3.5, fixedStarOrbMode: 'byMagnitude',
	};
	test('每档×每键:SCHOOL_JUDGE_DIFF 有键 → 恒流派值;无键 → 恒全局值;页面 overrides 恒最高', () => {
		HORARY_SCHOOL_ORDER.forEach((id) => {
			const diff = SCHOOL_JUDGE_DIFF[id] || {};
			const opts = horaryJudgeOpts(id, null, G);
			Object.keys(G).forEach((k) => {
				if(Object.prototype.hasOwnProperty.call(diff, k)){
					expect(opts[k]).toBe(diff[k]);   // 学理绑定恒压全局
				}else{
					expect(opts[k]).toBe(G[k]);      // 未绑定吃全局
				}
			});
			// 页面 overrides 最高层:任取一键翻转
			const ov = { vocMode: 'exempt4', cazimiOrb: 0.05 };
			const opts2 = horaryJudgeOpts(id, ov, G);
			expect(opts2.vocMode).toBe('exempt4');
			expect(opts2.cazimiOrb).toBe(0.05);
		});
	});
	test('七档档数与键域自证(防档表萎缩)', () => {
		expect(HORARY_SCHOOL_ORDER.length).toBe(7);
		HORARY_SCHOOL_ORDER.forEach((id) => expect(HORARY_SCHOOLS[id]).toBeTruthy());
	});
});
