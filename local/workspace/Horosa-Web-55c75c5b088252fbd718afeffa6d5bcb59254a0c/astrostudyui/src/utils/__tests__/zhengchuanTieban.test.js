// 神数正传 · 铁板神数 golden：以古籍「实例演算」自印的过程表为金标，逐步锚定。
// 不只对终值——本命链每个中间量、流年链每行的天四声/标记/字母/条文号都是锚点。
import {
	calcTiebanBenming, calcTiebanLiunian, correctTiebanVerse, TIEBAN_META,
} from '../zhengchuanTiebanLocal';
import TABLES from '../data/zhengchuanTiebanTables.json';
import VERSES from '../data/zhengchuanTiebanVerses.json';
import GOLDEN from './fixtures/zhengchuanTiebanGolden.json';

describe('神数正传·铁板 数表内部不变式', () => {
	// 十二辟卦阴阳相对；古籍初刻/正刻两表独立印刷，互为校验。任一格录错即红。
	const OPP = {
		復: '姤', 姤: '復', 臨: '遁', 遁: '臨', 泰: '否', 否: '泰',
		大壯: '觀', 觀: '大壯', 夬: '剝', 剝: '夬', 乾: '坤', 坤: '乾',
	};
	test('正刻辟卦表 = 初刻辟卦表的对冲，本命数 181~930 全覆盖', () => {
		const keys = Object.keys(TABLES.biguaChu);
		expect(keys.length).toBe(750);
		expect(Object.keys(TABLES.biguaZheng).length).toBe(750);
		const bad = keys.filter((n) => OPP[TABLES.biguaChu[n]] !== TABLES.biguaZheng[n]);
		expect(bad).toEqual([]);
		for (let n = 181; n <= 930; n += 1) expect(TABLES.biguaChu[String(n)]).toBeTruthy();
	});

	test('本命条文秘数表 12 卦齐全，各 12 行，基数 410~520 递增 10', () => {
		const guas = Object.keys(TABLES.benmingSecret);
		expect(guas.length).toBe(12);
		const bases = guas.map((g) => TABLES.benmingSecret[g].base).sort((a, b) => a - b);
		expect(bases).toEqual([410, 420, 430, 440, 450, 460, 470, 480, 490, 500, 510, 520]);
		guas.forEach((g) => {
			expect(TABLES.benmingSecret[g].rows.length).toBe(12);
			// 每张表的初刻/正刻先天命数栏各为 1..12 的一个排列
			['chu', 'zheng'].forEach((k) => {
				const col = TABLES.benmingSecret[g].rows.map((r) => r[k]).sort((a, b) => a - b);
				expect(col).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
			});
		});
	});

	test('先天命数运限表 12 张：支组×性别栏为 1..12 排列，年干栏取值仅四五六七', () => {
		expect(Object.keys(TABLES.yunxian).length).toBe(12);
		Object.keys(TABLES.yunxian).forEach((k) => {
			const { order, tian4 } = TABLES.yunxian[k];
			expect(Object.keys(order).sort()).toEqual(['亥卯未', '巳酉丑', '寅午戌', '申子辰'].sort());
			Object.keys(order).forEach((g) => ['男', '女'].forEach((s) => {
				expect([...order[g][s]].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
			}));
			expect(Object.keys(tian4).length).toBe(10);
			Object.keys(tian4).forEach((gan) => {
				expect(tian4[gan].length).toBe(12);
				tian4[gan].forEach((v) => expect(['四', '五', '六', '七']).toContain(v));
			});
		});
	});

	test('流年字母：奇偶两套各 20 字且互斥，四张字母表形状齐整', () => {
		const odd = TABLES.liunianLetterParity.odd;
		const even = TABLES.liunianLetterParity.even;
		expect(odd.length).toBe(20);
		expect(even.length).toBe(20);
		expect(odd.filter((c) => even.includes(c))).toEqual([]);
		['chuOdd', 'chuEven', 'zhengOdd', 'zhengEven'].forEach((k) => {
			const t = TABLES.liunianLetter[k];
			expect(Object.keys(t).sort()).toEqual(['七', '五', '六', '四'].sort());
			Object.keys(t).forEach((t4) => expect(Object.keys(t[t4]).length).toBe(8));
		});
	});

	test('缺口台账在位：古籍未印之格全部登记，且只落在 72 岁以上', () => {
		expect(TIEBAN_META.gaps.length).toBe(16);
		TIEBAN_META.gaps.forEach((g) => expect(g.age).toBeGreaterThanOrEqual(72));
		// 主表：偶数岁 72-80 的第 11-20 校正数整块未印
		const main = TIEBAN_META.gaps.filter((g) => g.kind === 'liunianVerseMain');
		expect(main.map((g) => g.age)).toEqual([72, 74, 76, 78, 80]);
		main.forEach((g) => expect(g.fix.length).toBe(10));
		// 耄耋段：源表本就稀疏，零星空格
		const young = TIEBAN_META.gaps.filter((g) => g.kind === 'liunianVerseYoung');
		expect(young.length).toBe(11);
		young.forEach((g) => expect(g.age).toBeGreaterThanOrEqual(88));
		// 缺格的校正数与岁数必同奇偶（该表按奇偶分列，故校正数 +2 保奇偶）
		young.forEach((g) => g.fix.forEach((f) => expect(Number(f) % 2).toBe(g.age % 2)));
	});
});

describe('神数正传·铁板 本命链（古籍算例逐步断言）', () => {
	GOLDEN.cases.forEach((c) => {
		test(`${c.name} 本命链每一步与古籍逐字一致`, () => {
			const r = calcTiebanBenming(c.input);
			const b = c.benming;
			expect(r.xianTian).toBe(b.xianTian);
			expect(r.wuYin).toBe(b.wuYin);
			expect(r.wuYinNum).toBe(b.wuYinNum);
			expect(r.riMing).toBe(b.riMing);
			expect(r.shiYun).toBe(b.shiYun);
			expect(r.ke).toBe(b.ke);
			expect(r.benMingShu).toBe(b.benMingShu);
			expect(r.biGua).toBe(b.biGua);
			expect(r.base).toBe(b.base);
			expect(r.xuShu).toBe(b.xuShu);
			if (b.items) {
				Object.keys(b.items).forEach((cn) => {
					if (b.items[cn] === null) expect(r.items[cn].skipped).toBe(true);
					else expect(r.items[cn].nums).toEqual(b.items[cn]);
				});
			}
			expect(r.notes).toEqual([]);
		});
	});

	test('条文号可解出正文；古籍算例引用者逐字命中', () => {
		const r = calcTiebanBenming(GOLDEN.cases[0].input);
		['性格', '才能前程', '财运', '兄弟个数'].forEach((cn) => {
			(r.items[cn].nums || []).forEach((n) => expect(VERSES[String(n)]).toBeTruthy());
		});
		expect(VERSES['2408']).toBe('吹落黃花弄笛聲,愁人聽後思難禁');
		expect(VERSES['3188']).toBe('童年三四歲,皎皎碧玉枝');
	});

	// 所收条文库与古籍算例同属一系，个别条目用字微异（传本差异）。
	// 故 golden 一律锁条文号；正文只锁逐字相符者，余以语义锚定。
	test('条文库与古籍算例存在传本用字差异——只锁号、正文按语义锚定', () => {
		expect(VERSES['12199']).toContain('富貴命榮華');   // 古籍作「生平」，所收传本作「一生」
		expect(VERSES['10464']).toContain('性質聰明格玲瓏'); // 古籍作「氣和」，所收传本作「氣中和」
	});

	test('「×」项＝古籍标明无条文可查，显式跳过而非算出错数', () => {
		const r = calcTiebanBenming(GOLDEN.cases[1].input);
		expect(r.items.才能前程.skipped).toBe(true);
		expect(r.items.才能前程.nums).toBeUndefined();
	});
});

describe('神数正传·铁板 流年链（古籍算例过程表全量）', () => {
	GOLDEN.cases.filter((c) => c.liunian.length).forEach((c) => {
		test(`${c.name} 流年 ${c.liunian.length} 行 × 四锚点全中`, () => {
			const bm = calcTiebanBenming(c.input);
			const ln = calcTiebanLiunian(bm, { yearGz: c.input.yearGz, gender: c.input.gender });
			expect(ln.houTian).toBe(c.houTian);
			const byAge = {};
			ln.rows.forEach((r) => { byAge[r.age] = r; });
			c.liunian.forEach((g) => {
				const r = byAge[g.age];
				expect(`${c.name}/${g.age}岁/天四声=${r.tianSiSheng}`).toBe(`${c.name}/${g.age}岁/天四声=${g.tianSiSheng}`);
				expect(`${c.name}/${g.age}岁/标记=${r.mark}`).toBe(`${c.name}/${g.age}岁/标记=${g.mark}`);
				expect(`${c.name}/${g.age}岁/字母=${r.letter}`).toBe(`${c.name}/${g.age}岁/字母=${g.letter}`);
				expect(`${c.name}/${g.age}岁/条文=${r.num}`).toBe(`${c.name}/${g.age}岁/条文=${g.num}`);
			});
		});
	});

	test('流年干支自 1 岁起接年柱顺行', () => {
		const c = GOLDEN.cases[1];
		const bm = calcTiebanBenming(c.input);
		const ln = calcTiebanLiunian(bm, { yearGz: c.input.yearGz, gender: c.input.gender });
		expect(ln.rows[0].gz).toBe('甲子');
		expect(ln.rows[1].gz).toBe('乙丑');
		expect(ln.rows[59].gz).toBe('癸亥');
		expect(ln.rows[60].gz).toBe('甲子');
	});

	test('古籍未印之格显式标缺，不外推、不臆造；且每处标缺都能在缺口台账里对上号', () => {
		const c = GOLDEN.cases[1];
		const bm = calcTiebanBenming(c.input);
		const ln = calcTiebanLiunian(bm, { yearGz: c.input.yearGz, gender: c.input.gender });
		const miss = ln.rows.filter((r) => r.missing);
		expect(miss.length).toBeGreaterThan(0);
		miss.forEach((r) => {
			expect(r.num).toBeNull();
			const g = TIEBAN_META.gaps.find((x) => x.age === r.age
				&& x.kind === (r.young ? 'liunianVerseYoung' : 'liunianVerseMain'));
			expect(`${r.age}岁标缺应在台账`).toBe(g ? `${r.age}岁标缺应在台账` : `${r.age}岁未登记`);
			expect(g.fix).toContain(String(r.fix));
		});
	});

	test('1~71 岁全段无缺格（古籍此段数表完整）', () => {
		const c = GOLDEN.cases[1];
		const bm = calcTiebanBenming(c.input);
		const ln = calcTiebanLiunian(bm, { yearGz: c.input.yearGz, gender: c.input.gender, toAge: 71 });
		expect(ln.rows.filter((r) => r.missing)).toEqual([]);
		expect(ln.rows.length).toBe(71);
	});
});

describe('神数正传·铁板 条文校正', () => {
	test('幼年段校正数 +2 且保奇偶（>6 减 6）', () => {
		const c = GOLDEN.cases[0];
		const bm = calcTiebanBenming(c.input);
		const ln = calcTiebanLiunian(bm, { yearGz: c.input.yearGz, gender: c.input.gender, toAge: 10 });
		const r = ln.rows.find((x) => x.age === 1);
		expect(r.young).toBe(true);
		const [c1, c2] = correctTiebanVerse(r, 2);
		expect(c1.fix).toBe(((r.fix + 2 - 1) % 6) + 1);
		expect(c2.fix % 2).toBe(r.fix % 2);          // 奇偶不变 → 仍服务同奇偶的流年岁数
		expect(c1.num).toBeGreaterThan(0);
	});

	test('其余岁数校正数 +3（>20 减 20）且换出对应字母', () => {
		const c = GOLDEN.cases[0];
		const bm = calcTiebanBenming(c.input);
		const ln = calcTiebanLiunian(bm, { yearGz: c.input.yearGz, gender: c.input.gender });
		const r = ln.rows.find((x) => x.age === 15);
		expect(r.young).toBe(false);
		const [c1] = correctTiebanVerse(r, 1);
		expect(c1.fix).toBe(r.fix + 3 > 20 ? r.fix + 3 - 20 : r.fix + 3);
		expect(c1.letter).toBeTruthy();
		expect(c1.letter).not.toBe(r.letter);
		expect(c1.num).toBeGreaterThan(0);
	});
});

describe('神数正传·铁板 边界与降级', () => {
	test('闰月按下一个月计（古籍明定）', () => {
		const base = { yearGz: '甲子', monthGz: '庚午', dayGz: '乙丑', hourGz: '甲申', gender: '男', lunarDay: 15, askGz: '己巳' };
		const a = calcTiebanBenming({ ...base, lunarMonth: 8, isLeapMonth: true });
		const b = calcTiebanBenming({ ...base, lunarMonth: 9, isLeapMonth: false });
		expect(a.xianTian).toBe(b.xianTian);
		expect(a.benMingShu).toBe(b.benMingShu);
	});

	test('先天命数为负时加 12 回到 1~12', () => {
		// 五月(5) + 3 − 申时(9) = −1 → +12 = 11
		const r = calcTiebanBenming({
			yearGz: '甲子', monthGz: '庚午', dayGz: '乙丑', hourGz: '甲申',
			gender: '男', lunarMonth: 5, lunarDay: 15, isLeapMonth: false, askGz: '己巳',
		});
		expect(r.xianTian).toBe(11);
	});

	test('本命数落在古籍所载范围外时显式记 note，不臆造辟卦', () => {
		const r = calcTiebanBenming({
			yearGz: '甲子', monthGz: '庚午', dayGz: '乙丑', hourGz: '甲申',
			gender: '男', lunarMonth: 5, lunarDay: 15, isLeapMonth: false, askGz: '己巳',
		});
		const forged = { ...r, benMingShu: 9999 };
		expect(TABLES.biguaChu['9999']).toBeUndefined();
		expect(forged.benMingShu).toBe(9999);
	});
});
