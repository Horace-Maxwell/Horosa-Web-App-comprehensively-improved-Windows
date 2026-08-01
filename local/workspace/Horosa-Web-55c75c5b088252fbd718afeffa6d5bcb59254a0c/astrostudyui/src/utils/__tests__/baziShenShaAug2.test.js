/**
 * 神煞四味补全 golden（§5.10 通行版）：国印/福星（干系）、天喜（年支系）、德秀（月令系）。
 * 落表=运行时合并（纯追加）；既有条目零回归（天乙/红鸾/月德抽检）。
 */
import {
	BAZI_DAY_YEAR_STEMS, BAZI_YEAR_BRANCH, BAZI_MONTH_STEMS,
	calcPillarShenSha, calcFourPillarShenSha,
} from '../baziShenShaLocal';

function P(gz){ return { stem: { cell: gz.charAt(0) }, branch: { cell: gz.charAt(1) } }; }
function four(y, m, d, t){ return { year: P(y), month: P(m), day: P(d), time: P(t) }; }

describe('国印/福星（干系 → BAZI_DAY_YEAR_STEMS）', () => {
	test('国印十干全表：甲戌乙亥丙丑丁寅戊丑己寅庚辰辛巳壬未癸申', () => {
		const pairs = { 甲: '戌', 乙: '亥', 丙: '丑', 丁: '寅', 戊: '丑', 己: '寅', 庚: '辰', 辛: '巳', 壬: '未', 癸: '申' };
		Object.keys(pairs).forEach((g) => {
			expect(BAZI_DAY_YEAR_STEMS[g + pairs[g]]).toContain('国印贵人');
		});
	});
	test('福星：甲见寅/子、辛见巳（与国印同键并存）', () => {
		expect(BAZI_DAY_YEAR_STEMS['甲寅']).toContain('福星贵人');
		expect(BAZI_DAY_YEAR_STEMS['甲子']).toContain('福星贵人');
		expect(BAZI_DAY_YEAR_STEMS['辛巳']).toEqual(expect.arrayContaining(['国印贵人', '福星贵人']));
	});
	test('组装链：甲年见戌柱标国印（年基）；日基档同表生效', () => {
		const r = calcFourPillarShenSha(four('甲子', '丙寅', '庚辰', '丙戌'));
		expect(r.time).toContain('国印贵人');   // 年干甲 + 时支戌
		const d = calcPillarShenSha({ dayGan: '甲' }, { zhi: '戌' }, '日');
		expect(d).toContain('国印贵人');
	});
});

describe('天喜（年支系 → BAZI_YEAR_BRANCH）', () => {
	test('十二年支全表 = 红鸾对宫（六冲位）', () => {
		const CHONG = { 子: '午', 丑: '未', 寅: '申', 卯: '酉', 辰: '戌', 巳: '亥', 午: '子', 未: '丑', 申: '寅', 酉: '卯', 戌: '辰', 亥: '巳' };
		const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
		ZHI.forEach((y) => {
			const hongluan = ZHI.find((z) => (BAZI_YEAR_BRANCH[y + z] || []).indexOf('红鸾') >= 0);
			expect(hongluan).toBeTruthy();
			expect(BAZI_YEAR_BRANCH[y + CHONG[hongluan]]).toContain('天喜');
		});
	});
	test('组装链：卯年见午柱标天喜', () => {
		const r = calcFourPillarShenSha(four('丁卯', '丙午', '庚辰', '丙子'));
		expect(r.month).toContain('天喜');
	});
});

describe('德秀（月令系 → BAZI_MONTH_STEMS，恒查）', () => {
	test('寅午戌月丙丁戊癸、亥卯未月甲乙丁壬为德秀', () => {
		['寅', '午', '戌'].forEach((m) => ['丙', '丁', '戊', '癸'].forEach((g) => {
			expect(BAZI_MONTH_STEMS[m + g]).toContain('德秀贵人');
		}));
		['亥', '卯', '未'].forEach((m) => ['甲', '乙', '丁', '壬'].forEach((g) => {
			expect(BAZI_MONTH_STEMS[m + g]).toContain('德秀贵人');
		}));
	});
	test('与既有月德贵人同键并存（寅丙）', () => {
		expect(BAZI_MONTH_STEMS['寅丙']).toEqual(expect.arrayContaining(['月德贵人', '德秀贵人']));
	});
	test('组装链：午月丙干柱标德秀（任意主位档恒查）', () => {
		const r = calcFourPillarShenSha(four('庚辰', '壬午', '丙申', '戊子'), '日');
		expect(r.day).toContain('德秀贵人'); // 月支午 + 日干丙
	});
});

describe('零回归：既有条目不删不改', () => {
	test('天乙贵人（甲丑）/ 红鸾（子卯）/ 月德贵人（子壬）原样保留', () => {
		expect(BAZI_DAY_YEAR_STEMS['甲丑']).toContain('天乙贵人');
		expect(BAZI_YEAR_BRANCH['子卯']).toContain('红鸾');
		expect(BAZI_MONTH_STEMS['子壬']).toContain('月德贵人');
	});
	test('新名只增不substitute：戊丑=天乙+太极+国印三名并存', () => {
		expect(BAZI_DAY_YEAR_STEMS['戊丑']).toEqual(expect.arrayContaining(['天乙贵人', '太极贵人', '国印贵人']));
	});
});
