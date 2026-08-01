// Solunars golden:8 盘种/两权重口径/mundoscope 角化/休眠盘/元首之死复合判据。
import {
	SOLUNAR_TYPES, SOLUNAR_WEIGHTS, computeAngularity, isDormantChart,
	rulerDeathSignature, describeSolunar, mundoPositionOf,
} from '../../divination/mundane/solunar';

const mkHouses = () => {
	const houses = {};
	for(let i = 1; i <= 12; i++){ houses[i] = { lon: (i - 1) * 30 }; }   // 等宽宫框(测试用)
	return houses;
};
const mkFacts = (planets) => ({ planets, houses: mkHouses(), meta: {} });

describe('盘种与权重口径', () => {
	test('8 盘种(日月×四基点恒星座);目标度 270/0/90/180', () => {
		expect(SOLUNAR_TYPES).toHaveLength(8);
		expect(SOLUNAR_TYPES.filter((t) => t.body === 'sun')).toHaveLength(4);
		expect(SOLUNAR_TYPES.find((t) => t.key === 'capsolar').target).toBe(270);
		expect(SOLUNAR_TYPES.find((t) => t.key === 'arilunar').target).toBe(0);
	});
	test('两口径:4-1-3-1/4-1-1-1 与 4-1-2-1;Capsolar 权重恒 4', () => {
		expect(SOLUNAR_WEIGHTS.scheme_a.sun).toEqual([4, 1, 3, 1]);
		expect(SOLUNAR_WEIGHTS.scheme_a.moon).toEqual([4, 1, 1, 1]);
		expect(SOLUNAR_WEIGHTS.scheme_b.sun).toEqual([4, 1, 2, 1]);
		expect(describeSolunar('capsolar', 'scheme_a').weight).toBe(4);
		expect(describeSolunar('cansolar', 'scheme_a').weight).toBe(3);
		expect(describeSolunar('cansolar', 'scheme_b').weight).toBe(2);
		expect(describeSolunar('canlunar', 'scheme_a').weight).toBe(1);
	});
});

describe('mundoscope 角化(Campanus 宫框比例插值)', () => {
	test('宫头即等分点:1 宫头星 mundo=0(合上升);10 宫头星 mundo=270(合天顶)', () => {
		const houses = mkHouses();
		expect(mundoPositionOf({ lon: 0, house: 1 }, houses)).toBeCloseTo(0, 6);
		expect(mundoPositionOf({ lon: 270, house: 10 }, houses)).toBeCloseTo(270, 6);
		expect(mundoPositionOf({ lon: 15, house: 1 }, houses)).toBeCloseTo(15, 6);   // 宫中点
	});
	test('角化排序与前景/强判:2° 星 foreground、0.5° 星 strong;12° 星背景', () => {
		const facts = mkFacts({
			sun: { lon: 2, house: 1 },        // mundo 2 → 距 ASC 2°
			mars: { lon: 270.5, house: 10 },  // 距 MC 0.5°
			venus: { lon: 102, house: 4 },    // mundo 102 → 距 IC 12°
		});
		const a = computeAngularity(facts, 3);
		expect(a.rows[0].planet).toBe('mars');
		expect(a.rows[0].strong).toBe(true);
		expect(a.rows.find((r) => r.planet === 'sun').foreground).toBe(true);
		expect(a.rows.find((r) => r.planet === 'venus').foreground).toBe(false);
	});
});

describe('休眠盘与元首之死复合判据', () => {
	test('无星角化 ≤3° → 休眠;有则非休眠', () => {
		const dormant = mkFacts({ sun: { lon: 15, house: 1 }, moon: { lon: 45, house: 2 } });   // mundo 15/45 距轴均 >3
		expect(isDormantChart(dormant, 3)).toBe(true);
		const active = mkFacts({ sun: { lon: 1, house: 1 } });
		expect(isDormantChart(active, 3)).toBe(false);
	});
	test('土日皆角化且互无主相位 → 命中;成主相位或未角化则不中', () => {
		// 非等宽 Campanus 宫框(真实盘常态):MC 黄经 250 → mundo 270。
		// 日 mundo 1(角)、土 mundo≈270.3(角);黄经差 110°(距 90/120 各 ≥10°)→ 无主相位 → 命中。
		const houses = { 1: { lon: 0 }, 2: { lon: 28 }, 3: { lon: 55 }, 4: { lon: 80 }, 5: { lon: 108 }, 6: { lon: 140 }, 7: { lon: 180 }, 8: { lon: 208 }, 9: { lon: 235 }, 10: { lon: 250 }, 11: { lon: 288 }, 12: { lon: 325 } };
		const hit = { planets: { sun: { lon: 1, house: 1 }, saturn: { lon: 251, house: 10 } }, houses, meta: {} };
		expect(rulerDeathSignature(hit, 3)).toBe(true);
		// 同框日土黄经差 90(刑) → 不中(有主相位)。
		const squared = { planets: { sun: { lon: 1, house: 1 }, saturn: { lon: 91, house: 5 } }, houses, meta: {} };
		expect(rulerDeathSignature(squared, 3)).toBe(false);
		// 土星未角化 → 不中(双条件皆须满足)。
		const notAngular = mkFacts({ sun: { lon: 1, house: 1 }, saturn: { lon: 45, house: 2 } });
		expect(rulerDeathSignature(notAngular, 3)).toBe(false);
	});
});
