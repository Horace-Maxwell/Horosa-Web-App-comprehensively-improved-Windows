// 神数正传 · 大定神数 golden：以古籍《起推人生死数例》的算例为金标，逐步锚定。
// 失败＝引擎错，不得改测试将就。
import {
	dadingCe, dadingDeathYear, dadingPairChain, dadingDeathMonth, dadingDeathHour,
	isYangChen, monthGzOf, hourGzOf, WUXING_BEN, DADING_CONST,
} from '../zhengchuanDadingLocal';

describe('大定神数 · 干支策数 = 太玄数(干)+太玄数(支)+纳音五行本数', () => {
	// 古籍算例中直接印出策值的五柱
	test.each([
		['戊寅', 17, '土'], ['乙卯', 15, '水'], ['乙未', 20, '金'], ['丁丑', 15, '水'], ['癸卯', 15, '金'],
	])('%s 策 = %i（纳音 %s）', (gz, want, el) => {
		const r = dadingCe(gz);
		expect(r.nayin).toBe(el);
		expect(r.ce).toBe(want);
		expect(r.gan + r.zhi + r.ben).toBe(want);
	});

	// 同为「金」而策数不同 —— 证策数按干支取值、非按五行
	test('乙未与癸卯同属金，策数却不同（20 vs 15）——策按干支非按五行', () => {
		expect(dadingCe('乙未').nayin).toBe(dadingCe('癸卯').nayin);
		expect(dadingCe('乙未').ce).toBe(20);
		expect(dadingCe('癸卯').ce).toBe(15);
	});

	test('五行本数取自古籍所载：水1 火2 木3 金4 土5', () => {
		expect(WUXING_BEN).toEqual({ 水: 1, 火: 2, 木: 3, 金: 4, 土: 5 });
	});

	test('六十甲子策数皆为正整数，且落在合理区间', () => {
		const GAN = '甲乙丙丁戊己庚辛壬癸';
		const ZHI = '子丑寅卯辰巳午未申酉戌亥';
		let n = 0;
		for (let i = 0; i < 60; i += 1) {
			const gz = GAN[i % 10] + ZHI[i % 12];
			const r = dadingCe(gz);
			expect(Number.isInteger(r.ce)).toBe(true);
			expect(r.ce).toBeGreaterThanOrEqual(4 + 4 + 1);   // 最小 太玄4+4+水1
			expect(r.ce).toBeLessThanOrEqual(9 + 9 + 5);      // 最大 太玄9+9+土5
			n += 1;
		}
		expect(n).toBe(60);
	});
});

describe('大定神数 · 死年链（古籍算例逐步）', () => {
	// 壬子年 壬寅月 己巳日 壬申时，大运丙午，小运乙巳，岁君辛卯，年四十岁
	const INPUT = {
		pillars: ['壬子', '壬寅', '己巳', '壬申'],
		dayun: '丙午', xiaoyun: '乙巳', suijun: '辛卯', age: 40,
	};

	test('七位策积 = 115（古籍载「一百一十五策」）', () => {
		const r = dadingDeathYear(INPUT);
		expect(r.sum).toBe(115);
		expect(r.items.map((x) => x.ce)).toEqual([18, 17, 16, 17, 17, 14, 16]);
	});

	test('全链六步逐一与古籍吻合：795 → 13807 → 13752 → 余27 → 三因81 → 余9', () => {
		const r = dadingDeathYear(INPUT);
		const v = r.steps.map((s) => s.value);
		expect(v).toEqual([115, 795, 13807, 13752, 27, 81, 9]);
		expect(r.r45).toBe(27);
		expect(r.tripled).toBe(81);
		expect(r.r12).toBe(9);
		expect(r.exhausted).toBe(false);   // 27≠0 → 非「四十五除是尽期」，走三因
	});

	test('常数取自古籍口诀：每岁虚加17、虚加13012、除天数55、45除、12除', () => {
		expect(DADING_CONST).toMatchObject({ perYear: 17, base: 13012, tianShu: 55, div1: 45, div2: 12 });
	});

	test('岁数改变则链随之改变（非写死）', () => {
		const a = dadingDeathYear({ ...INPUT, age: 40 });
		const b = dadingDeathYear({ ...INPUT, age: 41 });
		expect(b.steps[1].value - a.steps[1].value).toBe(17);
		expect(b.r12).not.toBe(a.r12);
	});
});

describe('大定神数 · 死月/死时二柱链（古籍算例逐步）', () => {
	test('月例：戊寅生月 × 乙卯尽月 → 32 → ×7=224 → 余44 → 三因132 → 余0（此月尽）', () => {
		const c = dadingPairChain('戊寅', '乙卯');
		expect([c.sum, c.prod, c.r45, c.tripled, c.r12]).toEqual([32, 224, 44, 132, 0]);
		expect(c.yang).toBe(true);
		expect(c.mul).toBe(7);
		expect(c.exhausted).toBe(true);
	});

	test('时例：戊寅生时 × 癸卯尽时 → 同链 32/224/44/132/0（此时尽）', () => {
		const c = dadingPairChain('戊寅', '癸卯');
		expect([c.sum, c.prod, c.r45, c.tripled, c.r12]).toEqual([32, 224, 44, 132, 0]);
		expect(c.exhausted).toBe(true);
	});

	test('阳辰以七乘、阴辰以八乘（古籍明定）', () => {
		expect(isYangChen('戊寅')).toBe(true);    // 寅＝阳支
		expect(isYangChen('乙未')).toBe(false);   // 未＝阴支
		expect(dadingPairChain('戊寅', '乙卯').mul).toBe(7);
		expect(dadingPairChain('乙未', '丁丑').mul).toBe(8);
	});

	test('日例：乙未生日 × 丁丑 → 二柱共35（古籍载「二柱共得三十五策」）', () => {
		const c = dadingPairChain('乙未', '丁丑');
		expect(c.sum).toBe(35);
		expect(c.mul).toBe(8);        // 未＝阴辰
		expect(c.prod).toBe(280);
	});
});

describe('大定神数 · 遁月遁时', () => {
	test('五虎遁：戊子年正月建甲寅，二月乙卯（古籍算例「以五虎元辰遁得乙卯月尽」）', () => {
		expect(monthGzOf('戊', 1)).toBe('甲寅');
		expect(monthGzOf('戊', 2)).toBe('乙卯');
	});

	test('五鼠遁：日干起子时', () => {
		expect(hourGzOf('甲', 0)).toBe('甲子');
		expect(hourGzOf('乙', 0)).toBe('丙子');
		expect(hourGzOf('戊', 0)).toBe('壬子');
	});

	test('逐月扫描自正月起，遇链尽即止', () => {
		const r = dadingDeathMonth('戊寅', '戊');
		expect(r.hit).toBeTruthy();
		expect(r.hit.gz).toBe('乙卯');           // 戊子年二月
		expect(r.hit.monthNo).toBe(2);
		expect(r.scan.length).toBe(2);           // 正月不尽 → 二月尽即止
	});

	test('逐时扫描自子时起，遇链尽即止', () => {
		const r = dadingDeathHour('戊寅', '癸');  // 癸日 → 子时起壬子
		expect(r.scan[0].gz).toBe('壬子');
		expect(r.scan.every((x) => x.gz.length === 2)).toBe(true);
	});
});

describe('大定神数 · 边界与降级', () => {
	test('非法干支返回 null，不抛', () => {
		expect(dadingCe('')).toBeNull();
		expect(dadingCe('X')).toBeNull();
		expect(dadingPairChain('戊寅', 'ZZ')).toBeNull();
	});

	test('每一步都产出可展开的中间量（供推算流程卡逐步显示）', () => {
		const r = dadingDeathYear({
			pillars: ['壬子', '壬寅', '己巳', '壬申'], dayun: '丙午', xiaoyun: '乙巳', suijun: '辛卯', age: 40,
		});
		expect(r.steps.length).toBe(7);
		r.steps.forEach((s) => {
			expect(typeof s.label).toBe('string');
			expect(typeof s.detail).toBe('string');
			expect(Number.isInteger(s.value)).toBe(true);
		});
	});
});
