// divination/data/__tests__/termsTablesDoc.test.js
// 界表逐格权威锁(卜卦盘 WP1.0 制度化产物)。
// ── 为什么逐格而不只校「合计=30°」──
// 2026-07 审计曾疑埃及界射手/托系天秤/托系双鱼三处为数据错误;经 Tetrabiblos I.20–21 原典、
// 界表传承专论(Culture & Cosmos v11)与行星年数不变量三重终校,结论=三处代码全对、参考文档误录。
// 教训:错行「合计仍=30°」,任何求和校验都抓不到——必须 12 座 × 5 段 (主星,起,止) 三元组逐字锁。
// ── 锁定口径 ──
// 0=埃及界(希腊化正统;行星年数不变量 ♄57/♃79/♂66/♀82/☿76)
// 1=托勒密界·校勘本(Tetrabiblos 批判本传承:双子 7/13/20/26、天秤 ☿11–16/♃16–24、狮子木先水次)
// 2=托勒密界·经典传本(1647 印本传承:双子 ♄21–25/♂25–30、天秤 ♃11–19/☿19–24、双鱼 ♂20–25/♄25–30)
// 3=迦勒底界(宽度 8/7/6/5/4·元素昼序·夜盘土水互换;推演口径)
// 字面量为前(AstroConst/dignities)后(flatlib)三方同源契约的冻结快照——改任何一方必须三方 lockstep 并重审典籍。
import * as AstroConst from '../../../constants/AstroConst';
import { EGYPTIAN_TERMS as D_EGY, PTOLEMAIC_TERMS as D_PTO, TETRABIBLOS_TERMS as D_TET, PTOLEMAIC_GEMINI_EMENDED_ROW, termRulerAt, termsVariantKey } from '../dignities';
import { CHALDEAN_TERMS_DAY, CHALDEAN_TERMS_NIGHT, termsTableForVariant, SIGN_EN } from '../hellenisticData';

const EXPECT_EGYPTIAN = {
	Aries: [['Jupiter', 0, 6], ['Venus', 6, 12], ['Mercury', 12, 20], ['Mars', 20, 25], ['Saturn', 25, 30]],
	Taurus: [['Venus', 0, 8], ['Mercury', 8, 14], ['Jupiter', 14, 22], ['Saturn', 22, 27], ['Mars', 27, 30]],
	Gemini: [['Mercury', 0, 6], ['Jupiter', 6, 12], ['Venus', 12, 17], ['Mars', 17, 24], ['Saturn', 24, 30]],
	Cancer: [['Mars', 0, 7], ['Venus', 7, 13], ['Mercury', 13, 19], ['Jupiter', 19, 26], ['Saturn', 26, 30]],
	Leo: [['Jupiter', 0, 6], ['Venus', 6, 11], ['Saturn', 11, 18], ['Mercury', 18, 24], ['Mars', 24, 30]],
	Virgo: [['Mercury', 0, 7], ['Venus', 7, 17], ['Jupiter', 17, 21], ['Mars', 21, 28], ['Saturn', 28, 30]],
	Libra: [['Saturn', 0, 6], ['Mercury', 6, 14], ['Jupiter', 14, 21], ['Venus', 21, 28], ['Mars', 28, 30]],
	Scorpio: [['Mars', 0, 7], ['Venus', 7, 11], ['Mercury', 11, 19], ['Jupiter', 19, 24], ['Saturn', 24, 30]],
	Sagittarius: [['Jupiter', 0, 12], ['Venus', 12, 17], ['Mercury', 17, 21], ['Saturn', 21, 26], ['Mars', 26, 30]],
	Capricorn: [['Mercury', 0, 7], ['Jupiter', 7, 14], ['Venus', 14, 22], ['Saturn', 22, 26], ['Mars', 26, 30]],
	Aquarius: [['Mercury', 0, 7], ['Venus', 7, 13], ['Jupiter', 13, 20], ['Mars', 20, 25], ['Saturn', 25, 30]],
	Pisces: [['Venus', 0, 12], ['Jupiter', 12, 16], ['Mercury', 16, 19], ['Mars', 19, 28], ['Saturn', 28, 30]],
};

const EXPECT_TETRABIBLOS = {
	Aries: [['Jupiter', 0, 6], ['Venus', 6, 14], ['Mercury', 14, 21], ['Mars', 21, 26], ['Saturn', 26, 30]],
	Taurus: [['Venus', 0, 8], ['Mercury', 8, 15], ['Jupiter', 15, 22], ['Saturn', 22, 24], ['Mars', 24, 30]],
	Gemini: [['Mercury', 0, 7], ['Jupiter', 7, 13], ['Venus', 13, 20], ['Mars', 20, 26], ['Saturn', 26, 30]],
	Cancer: [['Mars', 0, 6], ['Jupiter', 6, 13], ['Mercury', 13, 20], ['Venus', 20, 27], ['Saturn', 27, 30]],
	Leo: [['Jupiter', 0, 6], ['Mercury', 6, 13], ['Saturn', 13, 19], ['Venus', 19, 25], ['Mars', 25, 30]],
	Virgo: [['Mercury', 0, 7], ['Venus', 7, 13], ['Jupiter', 13, 18], ['Saturn', 18, 24], ['Mars', 24, 30]],
	Libra: [['Saturn', 0, 6], ['Venus', 6, 11], ['Mercury', 11, 16], ['Jupiter', 16, 24], ['Mars', 24, 30]],
	Scorpio: [['Mars', 0, 6], ['Venus', 6, 13], ['Jupiter', 13, 21], ['Mercury', 21, 27], ['Saturn', 27, 30]],
	Sagittarius: [['Jupiter', 0, 8], ['Venus', 8, 14], ['Mercury', 14, 19], ['Saturn', 19, 25], ['Mars', 25, 30]],
	Capricorn: [['Venus', 0, 6], ['Mercury', 6, 12], ['Jupiter', 12, 19], ['Saturn', 19, 25], ['Mars', 25, 30]],
	Aquarius: [['Saturn', 0, 6], ['Mercury', 6, 12], ['Venus', 12, 20], ['Jupiter', 20, 25], ['Mars', 25, 30]],
	Pisces: [['Venus', 0, 8], ['Jupiter', 8, 14], ['Mercury', 14, 20], ['Mars', 20, 25], ['Saturn', 25, 30]],
};

const EXPECT_LILLY = {
	Aries: [['Jupiter', 0, 6], ['Venus', 6, 14], ['Mercury', 14, 21], ['Mars', 21, 26], ['Saturn', 26, 30]],
	Taurus: [['Venus', 0, 8], ['Mercury', 8, 15], ['Jupiter', 15, 22], ['Saturn', 22, 26], ['Mars', 26, 30]],
	Gemini: [['Mercury', 0, 7], ['Jupiter', 7, 14], ['Venus', 14, 21], ['Saturn', 21, 25], ['Mars', 25, 30]],
	Cancer: [['Mars', 0, 6], ['Jupiter', 6, 13], ['Mercury', 13, 20], ['Venus', 20, 27], ['Saturn', 27, 30]],
	Leo: [['Saturn', 0, 6], ['Mercury', 6, 13], ['Venus', 13, 19], ['Jupiter', 19, 25], ['Mars', 25, 30]],
	Virgo: [['Mercury', 0, 7], ['Venus', 7, 13], ['Jupiter', 13, 18], ['Saturn', 18, 24], ['Mars', 24, 30]],
	Libra: [['Saturn', 0, 6], ['Venus', 6, 11], ['Jupiter', 11, 19], ['Mercury', 19, 24], ['Mars', 24, 30]],
	Scorpio: [['Mars', 0, 6], ['Jupiter', 6, 14], ['Venus', 14, 21], ['Mercury', 21, 27], ['Saturn', 27, 30]],
	Sagittarius: [['Jupiter', 0, 8], ['Venus', 8, 14], ['Mercury', 14, 19], ['Saturn', 19, 25], ['Mars', 25, 30]],
	Capricorn: [['Venus', 0, 6], ['Mercury', 6, 12], ['Jupiter', 12, 19], ['Mars', 19, 25], ['Saturn', 25, 30]],
	Aquarius: [['Saturn', 0, 6], ['Mercury', 6, 12], ['Venus', 12, 20], ['Jupiter', 20, 25], ['Mars', 25, 30]],
	Pisces: [['Venus', 0, 8], ['Jupiter', 8, 14], ['Mercury', 14, 20], ['Mars', 20, 25], ['Saturn', 25, 30]],
};

const SIGNS = SIGN_EN;
const lc = (rows) => rows.map((r) => [String(r[0]).toLowerCase(), Number(r[1]), Number(r[2])]);

function expectTableEqual(actual, expected, keyLower){
	SIGNS.forEach((sign) => {
		const k = keyLower ? sign.toLowerCase() : sign;
		expect({ sign, rows: lc(actual[k] || []) }).toEqual({ sign, rows: lc(expected[sign]) });
	});
}

describe('界表逐格权威锁(12座×5段×4变体)', () => {
	test('AstroConst.EGYPTIAN_TERMS 逐格=权威埃及界', () => {
		expectTableEqual(AstroConst.EGYPTIAN_TERMS, EXPECT_EGYPTIAN, false);
	});
	test('AstroConst.TETRABIBLOS_TERMS 逐格=托勒密界·校勘本', () => {
		expectTableEqual(AstroConst.TETRABIBLOS_TERMS, EXPECT_TETRABIBLOS, false);
	});
	test('AstroConst.LILLY_TERMS 逐格=托勒密界·经典传本', () => {
		expectTableEqual(AstroConst.LILLY_TERMS, EXPECT_LILLY, false);
	});
	test('双轨锁:dignities 三表与 AstroConst 三表逐格同源(含 2026-07-23 双鱼勘误后)', () => {
		expectTableEqual(D_EGY, EXPECT_EGYPTIAN, true);
		expectTableEqual(D_PTO, EXPECT_LILLY, true);
		expectTableEqual(D_TET, EXPECT_TETRABIBLOS, true);
	});
	test('每座五段连续覆盖 0–30°(三表)', () => {
		[EXPECT_EGYPTIAN, EXPECT_TETRABIBLOS, EXPECT_LILLY].forEach((tbl) => {
			SIGNS.forEach((sign) => {
				const rows = tbl[sign];
				expect(rows[0][1]).toBe(0);
				expect(rows[4][2]).toBe(30);
				for(let i = 1; i < 5; i++) expect(rows[i][1]).toBe(rows[i - 1][2]);
			});
		});
	});
	test('埃及界行星年数不变量:♄57/♃79/♂66/♀82/☿76(错一格必破)', () => {
		const sums = {};
		SIGNS.forEach((sign) => EXPECT_EGYPTIAN[sign].forEach(([p, a, b]) => { sums[p] = (sums[p] || 0) + (b - a); }));
		expect(sums).toEqual({ Saturn: 57, Jupiter: 79, Mars: 66, Venus: 82, Mercury: 76 });
	});
});

describe('迦勒底界(变体3)构造与 sect 分表', () => {
	test('昼表:火象=♃♀♄☿♂·宽 8/7/6/5/4;每座合计 30', () => {
		expect(lc(CHALDEAN_TERMS_DAY.Aries)).toEqual([
			['jupiter', 0, 8], ['venus', 8, 15], ['saturn', 15, 21], ['mercury', 21, 26], ['mars', 26, 30],
		]);
		SIGNS.forEach((sign) => {
			const rows = CHALDEAN_TERMS_DAY[sign];
			expect(rows.length).toBe(5);
			expect(rows.reduce((acc, r) => acc + (r[2] - r[1]), 0)).toBe(30);
		});
	});
	test('夜表=昼表土☿互换(位置换、宽度带不换)', () => {
		expect(lc(CHALDEAN_TERMS_NIGHT.Aries)).toEqual([
			['jupiter', 0, 8], ['venus', 8, 15], ['mercury', 15, 21], ['saturn', 21, 26], ['mars', 26, 30],
		]);
	});
	test('termsTableForVariant:0/1/2 走传入表、3 按昼夜取迦勒底', () => {
		const base = [{ t: 'egy' }, { t: 'tet' }, { t: 'lil' }];
		expect(termsTableForVariant(0, true, base, base[0])).toBe(base[0]);
		expect(termsTableForVariant(2, false, base, base[0])).toBe(base[2]);
		expect(termsTableForVariant(3, true, base, base[0])).toBe(CHALDEAN_TERMS_DAY);
		expect(termsTableForVariant(3, false, base, base[0])).toBe(CHALDEAN_TERMS_NIGHT);
	});
});

describe('双子界序口径开关(经典传本 received/emended)', () => {
	// 双子 23° 落界4、27° 落界5:传本 ♄/♂,校勘 ♂/♄。
	const lonGem23 = 60 + 23, lonGem27 = 60 + 27;
	test('默认(忠原书)零回归:23°双子=土星、27°双子=火星', () => {
		expect(termRulerAt(lonGem23, 'ptolemaic')).toBe('saturn');
		expect(termRulerAt(lonGem27, 'ptolemaic')).toBe('mars');
	});
	test('校勘口径:23°双子=火星、27°双子=土星;其余座不受影响', () => {
		expect(termRulerAt(lonGem23, 'ptolemaic', { geminiEmended: true })).toBe('mars');
		expect(termRulerAt(lonGem27, 'ptolemaic', { geminiEmended: true })).toBe('saturn');
		expect(termRulerAt(10, 'ptolemaic', { geminiEmended: true })).toBe(termRulerAt(10, 'ptolemaic'));
	});
	test('校勘行本体连续且合计 30', () => {
		expect(PTOLEMAIC_GEMINI_EMENDED_ROW[0][1]).toBe(0);
		expect(PTOLEMAIC_GEMINI_EMENDED_ROW[4][2]).toBe(30);
		expect(PTOLEMAIC_GEMINI_EMENDED_ROW.reduce((a, r) => a + (r[2] - r[1]), 0)).toBe(30);
	});
});

describe('变体数字键 ↔ 判读侧字符串键', () => {
	test('0=egyptian/1=tetrabiblos/2=ptolemaic(经典传本)/3=chaldean;非法回落埃及', () => {
		expect(termsVariantKey(0)).toBe('egyptian');
		expect(termsVariantKey(1)).toBe('tetrabiblos');
		expect(termsVariantKey(2)).toBe('ptolemaic');
		expect(termsVariantKey(3)).toBe('chaldean');
		expect(termsVariantKey(9)).toBe('egyptian');
		expect(termsVariantKey(undefined)).toBe('egyptian');
	});
});
