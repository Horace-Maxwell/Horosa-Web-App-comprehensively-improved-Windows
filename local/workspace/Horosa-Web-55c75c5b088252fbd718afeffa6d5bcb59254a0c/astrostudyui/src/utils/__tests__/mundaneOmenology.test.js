// 天象占 golden:四象限判定(可算部分)+查表完整性。
import { ECLIPSE_COLOR_OMEN, WEATHER_OMENS, describeQuadrantNations, QUADRANT_NATIONS } from '../../divination/mundane/omenology';

describe('天象占', () => {
	test('色占五行齐(黑铅灰土/白木/赤红火/黄金/杂色水);大气天象六类;四象限四方', () => {
		expect(ECLIPSE_COLOR_OMEN).toHaveLength(5);
		expect(ECLIPSE_COLOR_OMEN.map((c) => c.planet)).toEqual(['saturn', 'jupiter', 'mars', 'venus', 'mercury']);
		expect(WEATHER_OMENS).toHaveLength(6);
		expect(QUADRANT_NATIONS).toHaveLength(4);
	});
	test('四象限判定:ASC0/MC270 框架下 食点 45°→东、135°→南、225°→西、315°→北', () => {
		const facts = { meta: { ascLon: 0, mcLon: 270 }, planets: { sun: { lon: 45 } } };
		expect(describeQuadrantNations(facts, 45).quadrant).toBe('east');
		expect(describeQuadrantNations(facts, 135).quadrant).toBe('south');
		expect(describeQuadrantNations(facts, 225).quadrant).toBe('west');
		expect(describeQuadrantNations(facts, 315).quadrant).toBe('north');
		expect(describeQuadrantNations(facts).quadrant).toBe('east');   // 缺食点回落太阳
	});
});
