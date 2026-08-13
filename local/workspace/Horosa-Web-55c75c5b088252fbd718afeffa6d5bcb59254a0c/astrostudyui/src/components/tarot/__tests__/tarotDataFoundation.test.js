// TP-DATA 哨兵:对应叠层二期数据的结构完整性 + 派生交叉锚(表间互证,防抄录漂移)。
import {
	MAJORS_CORR, SUITS, ESOTERIC_TITLE_MAJOR, COURT_TITLE, LETTER_META, MODERN_PLANET,
	PLANET_WEEKDAY, COURT_MODE, COURT_SPAN_SIGNS, COURT_SHADOW_PIPS, ACE_QUADRANT_SIGNS,
	SUIT_EXTENDED, NUMBER_META, PLANET_DIGNITY, pipDignity, majorSidByAstro, decanMajors,
	signDateRange, pathsBetween, DECAN,
} from '../decks/correspondences';
import { SEPHIROTH_SCALE, minorScaleColor } from '../engine/colorScales';
import { CORE78 } from '../decks/core78';
import { questionsOf } from '../decks/questions22';
import { heroineOf, HEROINE_NARRATIVE } from '../decks/heroineNarrative';
import { traditionalMeaningOf } from '../decks/traditionalMeanings';
import { domainsOf, DOMAIN_KEYS, DOMAIN_CN } from '../decks/domainMeanings';
import { noteOf } from '../decks/cardNotes';

const SIDS = new Set(CORE78.map((c) => c.sid));
const byId = {};
CORE78.forEach((c) => { byId[c.sid] = c; });

describe('对应叠层二期 · 结构完整性', () => {
	test('大牌称号/字母元数据/自问/叙事:22 张全覆盖且键=MAJORS_CORR sid', () => {
		MAJORS_CORR.forEach((m) => {
			expect(ESOTERIC_TITLE_MAJOR[m.id]).toBeTruthy();
			expect(LETTER_META[m.id] && LETTER_META[m.id].kind).toMatch(/^[母双单]$/);
			expect(questionsOf(byId[m.id]) && questionsOf(byId[m.id]).length).toBeGreaterThan(0);
			expect(heroineOf(byId[m.id])).toBeTruthy();
		});
		expect(Object.keys(ESOTERIC_TITLE_MAJOR).length).toBe(22);
		expect(Object.keys(LETTER_META).length).toBe(22);
		expect(Object.keys(HEROINE_NARRATIVE).length).toBe(22);
	});

	test('母/双/单字母配比 3/7/12(《创世之书》结构)', () => {
		const kinds = Object.values(LETTER_META).map((x) => x.kind);
		expect(kinds.filter((k) => k === '母').length).toBe(3);
		expect(kinds.filter((k) => k === '双').length).toBe(7);
		expect(kinds.filter((k) => k === '单').length).toBe(12);
	});

	test('宫廷称号/跨段/辖下小牌:4×4 全;辖下 sid 全部真实存在;张数 3/3/3/9', () => {
		SUITS.forEach((suit) => {
			['king', 'queen', 'knight', 'page'].forEach((court) => {
				expect(COURT_TITLE[suit][court]).toBeTruthy();
				const pips = COURT_SHADOW_PIPS[suit][court];
				expect(pips.length).toBe(court === 'page' ? 9 : 3);
				pips.forEach((sid) => expect(SIDS.has(sid)).toBe(true));
			});
			expect(COURT_SPAN_SIGNS[suit].page.length).toBe(3);
		});
	});

	test('辖下小牌↔旬星表互证:王/后/骑的 3 张小牌旬星座 = [跨入座,本位座,本位座]', () => {
		SUITS.forEach((suit) => {
			['king', 'queen', 'knight'].forEach((court) => {
				const spans = COURT_SPAN_SIGNS[suit][court];
				const signsOfPips = COURT_SHADOW_PIPS[suit][court].map((sid) => {
					const c = byId[sid];
					return DECAN[c.suit][c.number][2];
				});
				expect(signsOfPips).toEqual([spans[0], spans[1], spans[1]]);
			});
		});
	});

	test('Ace 象限三星座与 Page 象限一致(同一天球象限双口径)', () => {
		SUITS.forEach((suit) => {
			expect(ACE_QUADRANT_SIGNS[suit]).toEqual(COURT_SPAN_SIGNS[suit].page);
		});
	});

	test('花色扩表/数字元数据/曜日/模式:键齐全', () => {
		SUITS.forEach((s) => {
			['quality', 'humor', 'temperament', 'sense', 'hour', 'festival', 'letter', 'world', 'power', 'archangel', 'creature', 'elemental'].forEach((k) => {
				expect(SUIT_EXTENDED[s][k]).toBeTruthy();
			});
		});
		for(let n = 1; n <= 10; n++){ expect(NUMBER_META[n] && NUMBER_META[n].papus).toBeTruthy(); }
		expect(Object.keys(PLANET_WEEKDAY).length).toBe(7);
		expect(COURT_MODE.queen).toBe('本位');
		expect(Object.keys(MODERN_PLANET)).toEqual(['the_fool', 'hanged_man', 'judgement']);
	});
});

describe('对应叠层二期 · 派生交叉锚', () => {
	test('行星尊贵:旬星逐格判定抽查(庙/旺/陷/弱各有实锚)', () => {
		expect(pipDignity(byId.wands_02).status).toBe('domicile');      // Mars in Aries
		expect(pipDignity(byId.swords_03).status).toBe('exaltation');   // Saturn in Libra
		expect(pipDignity(byId.pentacles_09).status).toBe('fall');      // Venus in Virgo
		expect(pipDignity(byId.cups_07).status).toBe('detriment');      // Venus in Scorpio
		expect(pipDignity(byId.cups_04).status).toBe('domicile');       // Moon in Cancer
		expect(pipDignity(byId.wands_03).status).toBe('exaltation');    // Sun in Aries(太阳旺白羊)
		expect(pipDignity(byId.wands_08).status).toBe('detriment');     // Mercury in Sagittarius(水星陷射手)
		expect(pipDignity(byId.wands_09)).toBeNull();                   // Moon in Sagittarius 无尊贵 → null
	});

	test('大牌读小牌:旬星二连/宫廷跨段/Ace 象限', () => {
		expect(decanMajors(byId.wands_05)).toEqual({ kind: 'decan', majors: ['the_world', 'strength'] }); // Saturn+Leo
		expect(decanMajors(byId.cups_02)).toEqual({ kind: 'decan', majors: ['the_empress', 'the_chariot'] }); // Venus+Cancer
		expect(decanMajors(byId.wands_king)).toEqual({ kind: 'span', majors: ['death', 'temperance'] }); // Scorpio+Sagittarius
		expect(decanMajors(byId.swords_page).kind).toBe('quadrant');
		expect(decanMajors(byId.wands_01).majors).toEqual(['the_chariot', 'strength', 'the_hermit']); // 巨蟹狮子处女
		expect(decanMajors(byId.the_fool)).toBeNull();
	});

	test('星座日期段由旬表派生:12 星座全窗对齐通行回归黄道窗(此锚曾咬出钱币三组日期错位真bug)', () => {
		const SIGN_WINDOWS = {
			Aries: '03-21~04-20', Taurus: '04-21~05-20', Gemini: '05-21~06-20', Cancer: '06-21~07-21',
			Leo: '07-22~08-22', Virgo: '08-23~09-22', Libra: '09-23~10-22', Scorpio: '10-23~11-22',
			Sagittarius: '11-23~12-21', Capricorn: '12-22~01-19', Aquarius: '01-20~02-18', Pisces: '02-19~03-20',
		};
		Object.keys(SIGN_WINDOWS).forEach((sign) => {
			expect(`${sign}:${signDateRange(sign)}`).toBe(`${sign}:${SIGN_WINDOWS[sign]}`);
		});
	});

	test('生命树路径:直连单解;5↔9 双解各两跳;变体 B 下 7↔9 有皇帝直连', () => {
		const direct = pathsBetween(2, 3, 'A');
		expect(direct.length).toBe(1);
		expect(direct[0].map((e) => e.sid)).toEqual(['the_empress']);
		const multi = pathsBetween(5, 9, 'A');
		expect(multi.length).toBeGreaterThanOrEqual(2);
		multi.forEach((r) => expect(r.length).toBe(2));
		const vb = pathsBetween(7, 9, 'B');
		expect(vb.some((r) => r.length === 1 && r[0].sid === 'the_emperor')).toBe(true);
	});

	test('辉耀色阶 10×4 全;小牌取色(数字=rank 行/宫廷=质点行);大牌不取', () => {
		for(let i = 1; i <= 10; i++){
			['king', 'queen', 'prince', 'princess'].forEach((w) => expect(SEPHIROTH_SCALE[i][w].hex).toMatch(/^#/));
		}
		expect(minorScaleColor(byId.cups_05).name).toBe('猩红');       // 圣杯5→Geburah×Briah
		expect(minorScaleColor(byId.wands_10).name).toBe('黄');        // 权杖10→Malkuth×Atziluth
		expect(minorScaleColor(byId.swords_queen).name).toBe('暗棕');  // 后=Binah×Yetzirah
		expect(minorScaleColor(byId.the_sun)).toBeNull();
	});

	test('内容层 accessor:骨架条目可取;缺条返回 null 不抛', () => {
		expect(traditionalMeaningOf(byId.the_fool)).toBeTruthy();
		// 传统义层已铺满 78 张(Wave A/B/C);缺条语义改由异构牌组守(覆盖率断言在 tarotContentWaves)。
		expect(traditionalMeaningOf({ arcana: 'lenormand', suit: 'lenormand', sid: 'lenormand_01' })).toBeNull();
		expect(domainsOf(byId.the_fool).love).toBeTruthy();
		// 主题占断已铺满 78 张(内容波次);缺条语义改由异构牌组(无 arcana/suit 对应)守——覆盖率断言在 tarotContentWaves。
		expect(domainsOf({ arcana: 'lenormand', suit: 'lenormand', sid: 'lenormand_01' })).toBeNull();
		expect(noteOf(byId.death).special).toContain('不作死亡预兆');
		// 牌面笔记已铺大牌 22 + 六张有图像倒转传统的数字牌;缺条语义由其余数字牌守(覆盖率断言在 tarotContentWaves)。
		expect(noteOf(byId.cups_02)).toBeNull();
		expect(DOMAIN_KEYS.every((k) => DOMAIN_CN[k])).toBe(true);
	});
});
