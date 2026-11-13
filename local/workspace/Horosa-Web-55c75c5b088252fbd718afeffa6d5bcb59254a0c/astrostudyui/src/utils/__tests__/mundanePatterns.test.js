// 世运盘 WP-2 §17.1 分布型 + §17.2 格局世运义 golden。
import { mundaneDistribution, mundanePatternMeaning, DISTRIBUTION_MUNDANE, PATTERN_MUNDANE } from '../../divination/mundane/patterns';

const mk = (lonsBySign) => ({ meta: { ascLon: 0, mcLon: 270 }, planets: lonsBySign });

describe('世运盘 分布型 mundaneDistribution(§17.1)', () => {
	test('集束型 Bundle(占≤120°)+ 元素/模式偏盛', () => {
		// 三星聚火象 0/30/60(白羊·金牛·双子? 用 sign 显式)
		const d = mundaneDistribution({ meta: { ascLon: 0, mcLon: 270 }, planets: {
			sun: { lon: 5, sign: 'aries' }, mars: { lon: 10, sign: 'aries' }, jupiter: { lon: 50, sign: 'taurus' },
		} });
		expect(d.jones).toBe('bundle');
		expect(d.jonesInfo.cn).toMatch(/集束/);
		expect(d.elements.fire).toBe(2);              // 太阳·火星白羊
		expect(d.domElement).toBe('fire');
		expect(d.domElementText).toMatch(/火盛/);
	});

	test('碗型 Bowl / 火车头 Locomotive 阈值', () => {
		const bowl = mundaneDistribution(mk({ sun: { lon: 0, sign: 'aries' }, moon: { lon: 40, sign: 'taurus' }, mercury: { lon: 80, sign: 'gemini' }, venus: { lon: 120, sign: 'leo' }, mars: { lon: 160, sign: 'virgo' } }));
		expect(bowl.jones).toBe('bowl');              // g1=200,g2=40
		const loco = mundaneDistribution(mk({ sun: { lon: 0, sign: 'aries' }, moon: { lon: 40, sign: 'taurus' }, mercury: { lon: 80, sign: 'gemini' }, venus: { lon: 120, sign: 'leo' }, mars: { lon: 160, sign: 'virgo' }, jupiter: { lon: 200, sign: 'libra' } }));
		expect(loco.jones).toBe('locomotive');        // g1=160,g2=40
	});

	test('散布型 Splash(均布无大空档)', () => {
		const KEYS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
		const planets = {};
		KEYS.forEach((k, i) => { planets[k] = { lon: i * 40, sign: 'aries' }; });
		expect(mundaneDistribution({ meta: {}, planets }).jones).toBe('splash');   // 全 40° 空档
	});

	test('少于 3 星 / 缺 facts → null', () => {
		expect(mundaneDistribution({ planets: { sun: { lon: 0, sign: 'aries' } } })).toBeNull();
		expect(mundaneDistribution(null)).toBeNull();
	});

	test('排盘判读随流派(WP-0):allowOuter=false 只取七曜', () => {
		// 七曜聚 0–50°、外行星散布 150/250/320°
		const planets = {
			sun: { lon: 5, sign: 'aries' }, moon: { lon: 10, sign: 'aries' }, mercury: { lon: 15, sign: 'aries' },
			venus: { lon: 20, sign: 'aries' }, mars: { lon: 25, sign: 'aries' }, jupiter: { lon: 40, sign: 'taurus' }, saturn: { lon: 50, sign: 'taurus' },
			uranus: { lon: 150, sign: 'virgo' }, neptune: { lon: 250, sign: 'sagittarius' }, pluto: { lon: 320, sign: 'aquarius' },
		};
		const modern = mundaneDistribution({ meta: { ascLon: 0, mcLon: 270 }, planets });
		const classical = mundaneDistribution({ meta: { ascLon: 0, mcLon: 270 }, planets }, false);
		expect(modern.count).toBe(10);
		expect(classical.count).toBe(7);
		expect(classical.classical).toBe(true);
		expect(classical.jones).toBe('bundle');        // 七曜全聚 ≤120° → 集束
		expect(modern.jones).not.toBe('bundle');        // 含散布外行星 → 非集束
	});
});

describe('世运盘 格局世运义 mundanePatternMeaning(§17.2)', () => {
	test('后端 type → 世运义', () => {
		expect(mundanePatternMeaning('grand_cross').cn).toBe('大十字');
		expect(mundanePatternMeaning('t_square').text).toMatch(/顶点|apex/i);
		expect(mundanePatternMeaning('yod').cn).toMatch(/上帝之指/);
		expect(mundanePatternMeaning('nonsense')).toBeNull();
		expect(Object.keys(PATTERN_MUNDANE)).toEqual(expect.arrayContaining(['grand_trine', 'grand_cross', 'kite', 'stellium_sign']));
	});
});

describe('世运盘 篮形格局义', () => {
	test('后端 detect_patterns 的 basket 有世运义,不被静默吞掉', () => {
		expect(PATTERN_MUNDANE.basket.cn).toBe('篮形');
		expect(PATTERN_MUNDANE.basket.text.length).toBeGreaterThan(10);
		expect(mundanePatternMeaning('basket')).toBeTruthy();
	});
});
