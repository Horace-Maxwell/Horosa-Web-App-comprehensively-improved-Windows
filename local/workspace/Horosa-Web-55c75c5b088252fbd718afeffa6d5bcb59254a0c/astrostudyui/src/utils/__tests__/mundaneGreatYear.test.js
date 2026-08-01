// 大年时代 golden:差值体系锚点自检 + 春分点位置 + 三法边界。
import { GREAT_YEAR_CONST, AGE_BOUNDARY_METHODS, AGE_CLAIMS, ayanamsaAt, computeCurrentAge } from '../../divination/mundane/greatYear';

describe('大年常量与定年表', () => {
	test('岁差 25772/圆整 25920/柏拉图月 2148–2160/率 50.29″', () => {
		expect(GREAT_YEAR_CONST.precessionYears).toBe(25772);
		expect(GREAT_YEAR_CONST.roundedYears).toBe(25920);
		expect(GREAT_YEAR_CONST.platonicMonthYears).toEqual([2148, 2160]);
	});
	test('三法在位且 IAU 边界 2597;定年表 11 行、key 全中性(claim_ 前缀)、零人名', () => {
		expect(AGE_BOUNDARY_METHODS).toHaveLength(3);
		expect(AGE_BOUNDARY_METHODS.find((m) => m.key === 'iau').boundaryYear).toBe(2597);
		expect(AGE_CLAIMS).toHaveLength(11);
		AGE_CLAIMS.forEach((c) => {
			expect(c.key).toMatch(/^claim_/);
			// 零拉丁人名(允许中文描述与数字;技术名词不入 basis)
			expect(c.basis).not.toMatch(/[A-Z][a-z]+\s[A-Z]/);
		});
	});
});

describe('ayanamsa 锚点自检(古籍附录值)', () => {
	test('Fagan/Bradley 1950-01-01 = 24°02′31″', () => {
		const v = ayanamsaAt(1950, 'fagan');
		expect(Math.abs(v - (24 + 2 / 60 + 31 / 3600))).toBeLessThan(1e-9);
	});
	test('Lahiri 1900 = 22°27′38″;2000 ≈ 23°51′;两系差 ≈ 0°53′(1950 附近)', () => {
		expect(Math.abs(ayanamsaAt(1900, 'lahiri') - (22 + 27 / 60 + 38 / 3600))).toBeLessThan(1e-9);
		expect(Math.abs(ayanamsaAt(2000, 'lahiri') - (23 + 51 / 60))).toBeLessThan(0.01);
		const diff1950 = ayanamsaAt(1950, 'fagan') - ayanamsaAt(1950, 'lahiri');
		expect(diff1950).toBeGreaterThan(0.75);   // ≈0°53′=0.883°,容忍线性近似
		expect(diff1950).toBeLessThan(1.0);
	});
});

describe('computeCurrentAge · 春分点与三法边界', () => {
	test('2000 年恒星派:春分点 ≈ 恒星双鱼 5°15′(古籍值),仍属双鱼座时代', () => {
		const r = computeCurrentAge(2000, 'fagan');
		expect(r.sign).toBe('pisces');
		expect(Math.abs(r.degInSign - (5 + 15 / 60))).toBeLessThan(0.1);
		expect(r.inAquarius).toBe(false);
	});
	test('等分法宝瓶边界:恒星锚等分口径 ≈ 2376(±10 年,线性近似)', () => {
		const r = computeCurrentAge(2000, 'fagan');
		expect(r.equalBoundaryYear).toBeGreaterThan(2366);
		expect(r.equalBoundaryYear).toBeLessThan(2386);
	});
	test('远未来(2600,恒星派):春分点已入宝瓶', () => {
		const r = computeCurrentAge(2600, 'fagan');
		expect(r.inAquarius).toBe(true);
		expect(r.sign).toBe('aquarius');
	});
});
