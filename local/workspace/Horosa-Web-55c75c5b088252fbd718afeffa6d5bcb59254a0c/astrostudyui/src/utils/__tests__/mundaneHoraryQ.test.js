// 世运卜卦三类问 golden。
import { describeWarQuestion, describeWeatherQuestion, describePriceQuestion, MUNDANE_HORARY_KINDS } from '../../divination/mundane/mundaneHorary';

const mkFacts = (planets, houses) => ({ planets, houses, meta: {}, result: {} });
const H = (o) => { const h = {}; for(let i = 1; i <= 12; i++){ h[i] = o[i] || { sign: 'aries' }; } return h; };

describe('战争问', () => {
	test('己方(1宫主)强于敌方(7宫主)+2 以上 → 己方有利;7宫主强 → 宜守', () => {
		const houses = H({ 1: { sign: 'aries', ruler: 'mars' }, 7: { sign: 'libra', ruler: 'venus' } });
		const strongUs = mkFacts({
			mars: { dignityScore: 5, house: 10, sign: 'capricorn' },
			venus: { dignityScore: -4, house: 6, sign: 'virgo', retro: true },
			moon: { dignityScore: 0, house: 2, sign: 'taurus' },
		}, houses);
		const r1 = describeWarQuestion(strongUs);
		expect(r1.verdict.tone).toBe('us');
		expect(r1.us.role).toContain('一宫主');
		const strongThem = mkFacts({
			mars: { dignityScore: -5, house: 12, sign: 'pisces', combustion: 'combust' },
			venus: { dignityScore: 5, house: 7, sign: 'taurus' },
			moon: { dignityScore: 0, house: 6, sign: 'virgo' },
		}, houses);
		expect(describeWarQuestion(strongThem).verdict.tone).toBe('them');
	});
	test('强弱评分明细可稽(角宫+3/焦伤−5/逆行−4)', () => {
		const houses = H({ 1: { sign: 'aries', ruler: 'mars' }, 7: { sign: 'libra', ruler: 'venus' } });
		const f = mkFacts({ mars: { dignityScore: 2, house: 10 }, venus: { dignityScore: 0, house: 3, combustion: 'combust', retro: true }, moon: { dignityScore: 0, house: 2 } }, houses);
		const r = describeWarQuestion(f);
		expect(r.us.items.find((i) => i.cn === '角宫').v).toBe(3);
		expect(r.them.items.map((i) => i.cn)).toEqual(expect.arrayContaining(['焦伤', '逆行', '果宫']));
	});
});

describe('天气问', () => {
	test('月金临角 → 偏湿;火日临角 → 偏燥;土临角附寒冷注', () => {
		const wet = mkFacts({ moon: { house: 1, su28: '毕宿' }, venus: { house: 10 }, mars: { house: 3 } }, H({}));
		expect(describeWeatherQuestion(wet).tone).toContain('偏湿');
		expect(describeWeatherQuestion(wet).moonMansion).toBe('毕宿');
		const dry = mkFacts({ mars: { house: 4 }, sun: { house: 7 }, saturn: { house: 10 } }, H({}));
		const rd = describeWeatherQuestion(dry);
		expect(rd.tone).toContain('偏燥');
		expect(rd.tone).toContain('寒冷');
	});
});

describe('物价问', () => {
	test('财货宫主强顺 → 趋涨;多逆/弱 → 趋跌;火土同宫 → 歉收风险', () => {
		const houses = H({ 2: { ruler: 'venus' }, 8: { ruler: 'jupiter' }, 11: { ruler: 'mercury' }, 4: { ruler: 'moon' } });
		const up = mkFacts({ venus: { dignityScore: 5, house: 1 }, jupiter: { dignityScore: 5, house: 10 }, mercury: { dignityScore: 4, house: 11 }, moon: { dignityScore: 0, house: 4 }, mars: { house: 3 }, saturn: { house: 9 } }, houses);
		expect(describePriceQuestion(up).trend.dir).toBe('up');
		expect(describePriceQuestion(up).cropRisk).toBe(false);
		const down = mkFacts({ venus: { dignityScore: -3, house: 6, retro: true }, jupiter: { dignityScore: -2, house: 12, retro: true }, mercury: { dignityScore: 0, house: 3 }, moon: { dignityScore: 0, house: 4 }, mars: { house: 5 }, saturn: { house: 5 } }, houses);
		const rd = describePriceQuestion(down);
		expect(rd.trend.dir).toBe('down');
		expect(rd.cropRisk).toBe(true);   // 火土同宫(5)
	});
	test('三类问键齐备', () => {
		expect(MUNDANE_HORARY_KINDS.map((k) => k.key)).toEqual(['war', 'weather', 'price']);
	});
});
