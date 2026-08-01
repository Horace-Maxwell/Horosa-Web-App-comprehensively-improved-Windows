// 窄栏下拉收起态短名:剥括号规则本身 + 全部参数表「同组短名唯一」的看守。
// 唯一性一旦被新增选项打破,收起态会出现两个同名项而用户无从分辨 —— 那是静默的可用性回归,
// 只能靠测试挡住(界面上看不出是 bug,只会觉得"这两个怎么一样")。
import { shortOptionLabel, shortLabelsUnique } from '../shortOptionLabel';
import { HORARY_PARAM_SPEC } from '../../divination/horary/horarySchools';
import { ELECTION_PARAM_SPEC } from '../../divination/election/electionParams';

describe('shortOptionLabel 剥括号规则', () => {
	test('尾部括号补充被剥,主名保留', () => {
		expect(shortOptionLabel('启发式（现行）')).toBe('启发式');
		expect(shortOptionLabel('传统（4父/10母）')).toBe('传统');
		expect(shortOptionLabel('按度差（古典近似）')).toBe('按度差');
		expect(shortOptionLabel('按宫（皆果→天/皆续→周/皆角→月）')).toBe('按宫');
		expect(shortOptionLabel('现代(Carter–Campion)')).toBe('现代');
	});

	test('无括号 / 空值原样返回', () => {
		expect(shortOptionLabel('Regiomontanus')).toBe('Regiomontanus');
		expect(shortOptionLabel('入宫盘')).toBe('入宫盘');
		expect(shortOptionLabel('')).toBe('');
		expect(shortOptionLabel(null)).toBe('');
		expect(shortOptionLabel(undefined)).toBe('');
	});

	test('括号后仍有正文时不剥(不丢主体)', () => {
		expect(shortOptionLabel('法A·紧连偏正面')).toBe('法A·紧连偏正面');
		expect(shortOptionLabel('（仅括号）')).toBe('（仅括号）');   // 剥空则退回原文
	});
});

describe('参数表同组短名唯一性', () => {
	test('卜卦全部 select 型参数逐组唯一', () => {
		const groups = (HORARY_PARAM_SPEC || []).filter((p) => p && Array.isArray(p.options) && p.options.length);
		expect(groups.length).toBeGreaterThan(5);   // 表被清空时不该假绿
		const broken = groups
			.map((p) => ({ key: p.key, labels: p.options.map((o) => o.label) }))
			.filter((g) => !shortLabelsUnique(g.labels));
		expect(broken).toEqual([]);
	});

	test('择日流派口径覆盖逐组唯一(含固定首项「随流派」)', () => {
		// ElectionMain 在每组前额外插一个 value='' 的「随流派（当前绑定值）」,收起态短名恒为「随流派」;
		// 它必须与该组任何显式选项的短名都不撞,否则用户分不清"跟随"与"显式选了同名值"。
		const groups = (ELECTION_PARAM_SPEC || []).filter((p) => p && Array.isArray(p.options) && p.options.length);
		expect(groups.length).toBeGreaterThan(5);
		const broken = groups
			.map((p) => ({ key: p.key, labels: ['随流派（X）'].concat(p.options.map((o) => o.label)) }))
			.filter((g) => !shortLabelsUnique(g.labels));
		expect(broken).toEqual([]);
	});
});
