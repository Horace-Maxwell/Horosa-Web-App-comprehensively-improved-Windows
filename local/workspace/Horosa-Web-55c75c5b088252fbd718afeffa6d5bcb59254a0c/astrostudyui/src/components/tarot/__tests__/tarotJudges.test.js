// TP3 判定器专项:尊位两版本 / 模式尊贵 / 行星星座归组 / 奇偶旬相 / 大小牌配比 / 四要素互动简法 / 现代行星注。
import { dignify, dignify3 } from '../engine/dignities';
import { synthesize } from '../engine/verdict';
import { astroLine } from '../engine/cardSchema';
import { getDeck } from '../engine/deckRegistry';
import { CORE78 } from '../decks/core78';

const by = {};
CORE78.forEach((c) => { by[c.sid] = c; });
const mk = (sids) => sids.map((sid, i) => ({ position: { i: i + 1 }, cardId: by[sid].id, isReversed: false, card: by[sid] }));

describe('尊位两版本', () => {
	test('modern:火+土=中立(0);mathers:火+土=稍微支持(+0.5)', () => {
		const m = dignify('fire', 'earth', null);
		expect(m.score).toBe(0);
		expect(m.notes).toContain('中立');
		const ma = dignify('fire', 'earth', null, 'mathers');
		expect(ma.score).toBe(0.5);
		expect(ma.notes).toContain('稍微支持');
		// 同元素/友/敌 两版本一致
		expect(dignify('fire', 'fire', null, 'mathers').score).toBe(2);
		expect(dignify('fire', 'air', null, 'mathers').score).toBe(1);
		expect(dignify('fire', 'water', null, 'mathers').score).toBe(-1);
		expect(dignify3('earth', 'fire', 'water', 'mathers').notes).toContain('稍微支持');
	});
});

describe('synthesize 判定器扩展', () => {
	test('行星主题线/星座聚集/三态/奇偶/旬相', () => {
		// wands_05(Saturn·Leo·固定·上升) wands_06(Jupiter·Leo·固定·续座) swords_09(Mars·Gemini·变动·续座) the_tower(Mars 行星大牌)
		const s = synthesize(mk(['wands_05', 'wands_06', 'swords_09', 'the_tower']));
		expect(s.planetGroups.find((g) => g.planet === 'Mars')).toBeTruthy(); // 剑九 Mars + 塔 Mars
		expect(s.planetGroups.find((g) => g.planet === 'Mars').theme).toContain('激烈');
		expect(s.signGroups.find((g) => g.sign === 'Leo')).toBeTruthy(); // 杖五/杖六同狮子
		expect(s.modeCount.固定).toBe(2);
		expect(s.modeCount.变动).toBe(1);
		expect(s.oddEven).toEqual({ odd: 2, even: 1 });
		expect(s.phaseTally['上升(初发)']).toBe(1);
		expect(s.phaseTally['续座(全盛)']).toBe(2);
	});
	test('大小牌配比:≥5张且大牌>40%出超比注;全小牌出可控注;<5张不出', () => {
		expect(synthesize(mk(['the_fool', 'the_tower', 'death', 'wands_02', 'cups_03'])).majorRatioNote).toContain('超常态比');
		expect(synthesize(mk(['wands_02', 'cups_03', 'swords_04', 'pentacles_05', 'wands_06'])).majorRatioNote).toContain('全为小牌');
		expect(synthesize(mk(['the_fool', 'wands_02', 'cups_03'])).majorRatioNote).toBeNull();
	});
	test('四要素互动简法:火+风同现=改善;火+水同现=转难;缺元素列出', () => {
		const a = synthesize(mk(['wands_02', 'swords_03']));
		expect(a.elementInteraction.improve).toContain('火+风');
		expect(a.elementInteraction.missing).toEqual(expect.arrayContaining(['water', 'earth']));
		const b = synthesize(mk(['wands_02', 'cups_03']));
		expect(b.elementInteraction.worsen).toContain('火+水');
	});
	test('宫廷三态:后=本位/骑=固定/王=变动;侍不计', () => {
		const s = synthesize(mk(['wands_queen', 'cups_knight', 'swords_king', 'pentacles_page']));
		expect(s.modeCount).toEqual({ 本位: 1, 固定: 1, 变动: 1 });
	});
});

describe('现代行星注', () => {
	test('开=三元素大牌附注;关=不附;非三元素牌不受扰', () => {
		const deck = getDeck('rws');
		expect(astroLine(by.the_fool, deck, 'A', true)).toContain('近代 天王星');
		expect(astroLine(by.hanged_man, deck, 'A', true)).toContain('近代 海王星');
		expect(astroLine(by.judgement, deck, 'A', true)).toContain('近代 冥王星');
		expect(astroLine(by.the_fool, deck, 'A')).not.toContain('近代');
		expect(astroLine(by.the_sun, deck, 'A', true)).not.toContain('近代');
	});
});
