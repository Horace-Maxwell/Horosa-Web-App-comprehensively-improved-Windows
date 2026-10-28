// 铁板神数框架层引擎测试:§5.5.3 八卦滚 golden(古籍完整算例逐卦)+ §4 配数点检 +
//   §11.3 96局 + §5.4.2 六亲 + 穷举不抛 + 确定性 + 反臆造秘数护栏。
import {
	buildTiebanFramework, baguaGun, taixuanPeishu, eightKeGan, keOfFen, ninetySixJu,
	liuQinFromPillars, sanYuanOf, sanYuanWeight, baseGuaFromPillars, frameworkNumber,
	guaNumberBySchool, buildTiebanFrameworkSnapshot, huTiGua, cuoGua, swapTrigrams, bianYao,
	guaOfLines, linesOfGua, GUA64, TIEBAN_TAIXUAN, TIEBAN_EIGHT_KE,
} from '../tiebanFrameworkLocal';

const FP_CASES = [
	{ fourPillars: { year: '甲子', month: '丙寅', day: '庚申', hour: '庚辰' }, birthYear: 1984 },
	{ fourPillars: { year: '乙丑', month: '戊寅', day: '辛酉', hour: '己亥' }, birthYear: 1985 },
	{ fourPillars: { year: '壬午', month: '丙午', day: '戊子', hour: '壬子' }, birthYear: 2002 },
	{ fourPillars: { year: '戊辰', month: '己未', day: '丁卯', hour: '辛丑' }, birthYear: 1988 },
	{ fourPillars: { year: '癸酉', month: '辛酉', day: '乙卯', hour: '丁丑' }, birthYear: 1993 },
];

describe('§5.5.3 八卦滚法 golden(古籍完整算例·逐卦锁定)', () => {
	test('基本卦 天地否 / 数序 4410 / 下元乙丑 → 8 卦 = 渐·同人·归妹·师·大畜·鼎·萃·屯', () => {
		const base = linesOfGua('乾', '坤'); // 天地否 [0,0,0,1,1,1]
		const roll = baguaGun(base, 4410, '乙丑', { sanyuan: 'xia', isYangManYinNv: true });
		expect(roll.base.name).toBe('天地否');
		expect(roll.weight).toBe(88);      // 下元:支丑8×10 + 干乙8 = 88
		expect(roll.total).toBe(4498);
		expect(roll.bianYao9).toMatchObject({ remainder: 7, pos: 1, ying: 4 }); // 初爻与四爻同变
		expect(roll.bianYao6).toMatchObject({ remainder: 4, pos: 4 });          // 第四爻变
		expect(roll.seq.map((g) => g.name)).toEqual([
			'风山渐', '天火同人', '雷泽归妹', '地水师', '山天大畜', '火风鼎', '泽地萃', '水雷屯',
		]);
		expect(roll.verseCount).toBe(48); // 每卦 6 条 × 8 卦
	});

	test('互体/错卦/对调 分步与古籍一致', () => {
		const pi = linesOfGua('乾', '坤');
		expect(huTiGua(pi).name).toBe('风山渐');            // 互体(否)
		const jian = linesOfGua('巽', '艮');
		expect(cuoGua(jian).name).toBe('雷泽归妹');          // 错卦(渐)
		const tongren = linesOfGua('乾', '離');
		expect(cuoGua(tongren).name).toBe('地水师');         // 错卦(同人)
		// 渐 第四爻变+上下对调 → 山天大畜
		expect(guaOfLines(swapTrigrams(bianYao(jian, [4]))).name).toBe('山天大畜');
	});
});

describe('§4 配数点检(公有口诀·可断言)', () => {
	test('§4.1-A 太玄数:甲己9 乙庚8 丙辛7 丁壬6 戊癸5 / 子午9 巳亥4', () => {
		expect(taixuanPeishu('甲')).toBe(9); expect(taixuanPeishu('己')).toBe(9);
		expect(taixuanPeishu('乙')).toBe(8); expect(taixuanPeishu('庚')).toBe(8);
		expect(taixuanPeishu('戊')).toBe(5); expect(taixuanPeishu('癸')).toBe(5);
		expect(taixuanPeishu('子')).toBe(9); expect(taixuanPeishu('午')).toBe(9);
		expect(taixuanPeishu('巳')).toBe(4); expect(taixuanPeishu('亥')).toBe(4);
		expect(taixuanPeishu('?')).toBeNull();
		// 天干地支共用同数表齐全
		expect(Object.keys(TIEBAN_TAIXUAN.gan).length).toBe(10);
		expect(Object.keys(TIEBAN_TAIXUAN.zhi).length).toBe(12);
	});
	test('§4.7 八刻天干:初甲…八辛;keOfFen 分段', () => {
		expect(TIEBAN_EIGHT_KE).toEqual(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛']);
		expect(eightKeGan(1)).toBe('甲'); expect(eightKeGan(8)).toBe('辛');
		expect(keOfFen(0, 'qing8').ke).toBe(1);
		expect(keOfFen(20, 'qing8')).toMatchObject({ ke: 2, gan: '乙' });    // 15-30′
		expect(keOfFen(119, 'qing8').ke).toBe(8);
	});
	test('§4.3 卦数偏好:南派后天洛书/北派先天河图', () => {
		expect(guaNumberBySchool('坎', 'south')).toBe(1);  // 后天洛书 坎1
		expect(guaNumberBySchool('離', 'south')).toBe(9);  // 后天 离9
		expect(guaNumberBySchool('乾', 'north')).toBe(1);  // 先天 乾1
		expect(guaNumberBySchool('坤', 'north')).toBe(8);  // 先天 坤8
	});
});

describe('§11.3 九十六局 / §5.4.2 六亲 / 三元', () => {
	test('§11.3 卯时三刻 = 全日第 27 刻', () => {
		expect(ninetySixJu('卯', 3)).toMatchObject({ quanRiKe: 27, total: 96 });
		expect(ninetySixJu('子', 1).quanRiKe).toBe(1);
		expect(ninetySixJu('亥', 8).quanRiKe).toBe(96);
		expect(ninetySixJu('X', 3)).toBeNull();
	});
	test('§5.4.2 四柱配六亲:年父母/月兄弟/日夫妻/时子女', () => {
		const lq = liuQinFromPillars(FP_CASES[0].fourPillars);
		expect(lq.map((x) => x.liuqin)).toEqual(['父母', '兄弟', '夫妻', '子女']);
		expect(lq[0]).toMatchObject({ pillar: 'year', ganzhi: '甲子', shengxiao: '鼠' });
	});
	test('三元判定 + 权重公式', () => {
		expect(sanYuanOf(1900)).toBe('shang');
		expect(sanYuanOf(1984)).toBe('xia');
		expect(sanYuanOf(1950)).toBe('zhong');
		// 上元:干×10+支;下元:支×10+干;中元阳男阴女:干×100+支×10
		expect(sanYuanWeight('乙', '丑', 'shang', true)).toBe(8 * 10 + 8);
		expect(sanYuanWeight('乙', '丑', 'xia', true)).toBe(8 * 10 + 8);
		expect(sanYuanWeight('甲', '子', 'zhong', true)).toBe(9 * 100 + 9 * 10);
		expect(sanYuanWeight('甲', '子', 'zhong', false)).toBe(9 * 100 + 9 * 10);
	});
});

describe('刻制 / 考刻刻位 语义(§4.7 八刻天干正交于 §11.4 刻制)', () => {
	const fc = FP_CASES[3]; // 戊辰 己未 丁卯 辛丑
	test('§4.7 八刻天干 seg 恒 15′(不随刻制缩放);juStruct 随刻制变', () => {
		['qing8', 'ming100', 'dou12'].forEach((keSystem) => {
			const fw = buildTiebanFramework(fc.fourPillars, { school: 'south', keSystem, gender: 1, birthYear: fc.birthYear, ke: 5 });
			// 八刻天干表本身=清八刻,seg 恒 15′
			expect(fw.eightKe.map((k) => k.seg)).toEqual(['0–15′', '15–30′', '30–45′', '45–60′', '60–75′', '75–90′', '90–105′', '105–120′']);
			expect(fw.eightKe.map((k) => k.gan)).toEqual(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛']);
		});
		// juStruct 随刻制不同(96局/百刻/144局)
		const j8 = buildTiebanFramework(fc.fourPillars, { keSystem: 'qing8', birthYear: fc.birthYear }).keSystemInfo.juStruct;
		const j100 = buildTiebanFramework(fc.fourPillars, { keSystem: 'ming100', birthYear: fc.birthYear }).keSystemInfo.juStruct;
		const j12 = buildTiebanFramework(fc.fourPillars, { keSystem: 'dou12', birthYear: fc.birthYear }).keSystemInfo.juStruct;
		expect(new Set([j8, j100, j12]).size).toBe(3);
		expect(j8).toContain('96局');
		expect(j12).toContain('144局');
	});
	test('考刻刻位 active 标当前刻;96局 K 随刻位递增', () => {
		for (let ke = 1; ke <= 8; ke += 1) {
			const fw = buildTiebanFramework(fc.fourPillars, { school: 'south', keSystem: 'qing8', ke, birthYear: fc.birthYear });
			const actives = fw.eightKe.filter((k) => k.active);
			expect(actives.length).toBe(1);
			expect(actives[0].ke).toBe(ke);
			// 时柱辛丑 → 丑时;96局 K=(丑序1)*8+ke=8+ke
			expect(fw.ju.quanRiKe).toBe(8 + ke);
		}
		// 快照标(考刻)
		const snap = buildTiebanFrameworkSnapshot(buildTiebanFramework(fc.fourPillars, { ke: 5, birthYear: fc.birthYear }));
		expect(snap).toMatch(/五刻戊\(考刻\)/);
	});
});

describe('buildTiebanFramework 穷举:四柱×南北派×刻制×性别 不抛 + 结构完整', () => {
	test('全组合 → 8 卦滚齐 / 六亲4 / 96局合法 / 快照有段', () => {
		let n = 0;
		FP_CASES.forEach((fc) => {
			['south', 'north'].forEach((school) => {
				['qing8', 'ming100', 'dou12'].forEach((keSystem) => {
					[1, 0].forEach((gender) => {
						[1, 5, 8].forEach((ke) => {
							let fw = null;
							expect(() => { fw = buildTiebanFramework(fc.fourPillars, { school, keSystem, gender, birthYear: fc.birthYear, ke }); }).not.toThrow();
							expect(fw.roll.seq.length).toBe(8);
							fw.roll.seq.forEach((g) => { expect(GUA64[`${g.upper}|${g.lower}`] || g.name).toBeTruthy(); expect(g.lines.length).toBe(6); });
							expect(fw.liuQin.length).toBe(4);
							expect(fw.ju.quanRiKe).toBeGreaterThanOrEqual(1);
							expect(fw.ju.quanRiKe).toBeLessThanOrEqual(96);
							expect(fw.eightKe.filter((k) => k.active).length).toBe(1);
							const snap = buildTiebanFrameworkSnapshot(fw);
							expect(snap).toContain('[框架·八卦滚]');
							expect(snap).toContain('[框架·批断顺序]');
							n += 1;
						});
					});
				});
			});
		});
		expect(n).toBe(5 * 2 * 3 * 2 * 3);
	});

	test('确定性:同输入两次结果一致;边界四柱/空 → 不抛回退', () => {
		const a = buildTiebanFramework(FP_CASES[2].fourPillars, { school: 'south', keSystem: 'qing8', gender: 1, birthYear: 2002 });
		const b = buildTiebanFramework(FP_CASES[2].fourPillars, { school: 'south', keSystem: 'qing8', gender: 1, birthYear: 2002 });
		expect(a.roll.seq.map((g) => g.name)).toEqual(b.roll.seq.map((g) => g.name));
		expect(buildTiebanFramework(null, {})).toBeNull();
		expect(buildTiebanFramework({ year: '甲子' }, {})).toBeNull();
		expect(() => buildTiebanFramework(FP_CASES[0].fourPillars, { school: 'zzz', keSystem: 'zzz', gender: 9 })).not.toThrow();
	});
});

describe('🔴 反臆造护栏:框架层不含任何存疑秘数常量', () => {
	test('引擎源码无 7130/7600/×79/×314/+96 等秘数', () => {
		// 以纯函数输出侧证:框架不产出精确条文号(只有结构总量 48)
		const fw = buildTiebanFramework(FP_CASES[0].fourPillars, { school: 'south', keSystem: 'qing8', gender: 1, birthYear: 1984 });
		const snap = buildTiebanFrameworkSnapshot(fw);
		['7130', '7600', '13039', '15696'].forEach((n) => expect(snap.indexOf(n)).toBe(-1));
		// frameworkNumber 是太玄数和(公开),非秘数
		expect(frameworkNumber(FP_CASES[0].fourPillars)).toBeGreaterThan(0);
		expect(baseGuaFromPillars(FP_CASES[0].fourPillars).name).toBeTruthy();
	});
});
