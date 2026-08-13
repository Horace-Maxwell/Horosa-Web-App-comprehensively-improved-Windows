// TP7 宫廷体系专项:元素两套/星座两套/伴牌触发检测/astroLine 默认字节稳定。
import { courtEieOf, courtZodiacOf, courtSignDetect, COURT_ZODIAC_SIMPLE, COURT_RANK_ELEMENT_ALT } from '../decks/courtSystems';
import { astroLine } from '../engine/cardSchema';
import { resolveSettings } from '../engine/reading';
import { getDeck } from '../engine/deckRegistry';
import { CORE78 } from '../decks/core78';

const by = {};
CORE78.forEach((c) => { by[c.sid] = c; });
const D = (sid, i) => ({ position: { i: i || 1 }, cardId: by[sid].id, isReversed: false, card: by[sid] });

describe('宫廷两体系', () => {
	test('元素:gd=现行 EiE;alt=位阶制(王土/后水/骑火/侍风)', () => {
		expect(courtEieOf(by.wands_king, 'gd')).toBe(by.wands_king.courtEie);
		expect(courtEieOf(by.wands_king, 'alt')).toBe('火中之土(位阶制)');
		expect(courtEieOf(by.cups_queen, 'alt')).toBe('水中之水(位阶制)');
		expect(courtEieOf(by.swords_page, 'alt')).toBe('风中之风(位阶制)');
		expect(COURT_RANK_ELEMENT_ALT.knight).toBe('fire');
	});
	test('星座:gd_span=现行跨段;simple=单座制且侍从无星座', () => {
		expect(courtZodiacOf(by.wands_king, 'gd_span')).toBe(by.wands_king.courtSpan);
		expect(courtZodiacOf(by.wands_king, 'simple')).toContain('狮子');
		expect(courtZodiacOf(by.pentacles_king, 'simple')).toContain('金牛');
		expect(courtZodiacOf(by.wands_page, 'simple')).toContain('不配星座');
		expect(COURT_ZODIAC_SIMPLE.swords.knight).toBe('Gemini');
	});
	test('astroLine:默认(不传 courtView/传 gd 组合)=现行字节;alt/simple 才改写', () => {
		const deck = getDeck('rws');
		const legacy = `${by.wands_king.courtEie} · ${by.wands_king.courtSpan}`;
		expect(astroLine(by.wands_king, deck, 'A')).toBe(legacy);
		expect(astroLine(by.wands_king, deck, 'A', false, { elementSystem: 'gd', zodiacSystem: 'gd_span' })).toBe(legacy);
		const alt = astroLine(by.wands_king, deck, 'A', false, { elementSystem: 'alt', zodiacSystem: 'simple' });
		expect(alt).toContain('位阶制');
		expect(alt).toContain('狮子');
	});
});

describe('伴牌触发星座检测', () => {
	test('圣杯国王+死神=天蝎;宝剑国王+星星=水瓶;无伴牌=只给单座制基础', () => {
		const r1 = courtSignDetect([D('cups_king', 1), D('death', 2)]);
		expect(r1[0].hits.length).toBe(1);
		expect(r1[0].hits[0].signCn).toBe('天蝎');
		const r2 = courtSignDetect([D('swords_king', 1), D('the_star', 2)]);
		expect(r2[0].hits[0].signCn).toBe('水瓶');
		const r3 = courtSignDetect([D('cups_king', 1), D('wands_02', 2)]);
		expect(r3[0].hits.length).toBe(0);
		expect(r3[0].baseSignCn).toBe('天蝎');
		expect(courtSignDetect([D('wands_02', 1)]).length).toBe(0);
	});
});

describe('settings 接线', () => {
	test('resolveSettings 两键默认 gd 系;显式 alt/simple 生效', () => {
		const eff = resolveSettings(getDeck('rws'), {});
		expect(eff.courtElementSystem).toBe('gd');
		expect(eff.courtZodiacSystem).toBe('gd_span');
		const eff2 = resolveSettings(getDeck('rws'), { courtElementSystem: 'alt', courtZodiacSystem: 'simple' });
		expect(eff2.courtElementSystem).toBe('alt');
		expect(eff2.courtZodiacSystem).toBe('simple');
	});
});
