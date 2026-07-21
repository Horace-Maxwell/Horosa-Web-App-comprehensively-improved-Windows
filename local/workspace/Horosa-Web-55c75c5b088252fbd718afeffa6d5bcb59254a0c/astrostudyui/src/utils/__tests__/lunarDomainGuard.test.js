// 本地历法域守卫金标:lunar-javascript 可靠域 AD1~9999;域外必须显式拒绝,
// 绝不静默吐出错误干支(实测域外月柱错位:BC 全错、AD10000+ 错)。
import { isLunarJsYearReliable, LUNAR_JS_MIN_YEAR, LUNAR_JS_MAX_YEAR } from '../lunarDomainGuard';
import buildLocalBaziResult from '../baziLunarLocal';
import { buildLocalJieqiYearSeed } from '../localNongliAdapter';

describe('lunarDomainGuard(本地历法可靠域 AD1~9999)', () => {
	test('域判定边界', () => {
		expect(LUNAR_JS_MIN_YEAR).toBe(1);
		expect(LUNAR_JS_MAX_YEAR).toBe(9999);
		expect(isLunarJsYearReliable(1)).toBe(true);
		expect(isLunarJsYearReliable(9999)).toBe(true);
		expect(isLunarJsYearReliable(0)).toBe(false);
		expect(isLunarJsYearReliable(-2000)).toBe(false);
		expect(isLunarJsYearReliable(10000)).toBe(false);
		expect(isLunarJsYearReliable('abc')).toBe(false);
	});

	test('域内八字照常(2026-07-19 年柱丙午在结果中)', () => {
		const r = buildLocalBaziResult({ date: '2026-07-19', time: '10:30:00' });
		expect(r).toBeTruthy();
		expect(JSON.stringify(r)).toContain('丙午');
	});

	test('域外八字必须抛错(绝不静默给错干支)', () => {
		expect(() => buildLocalBaziResult({ date: '12000-06-15', time: '10:30:00' })).toThrow();
	});

	test('域内节气种子正常;域外返 null 走后端实算', () => {
		expect(buildLocalJieqiYearSeed(2026, '+08:00')).toBeTruthy();
		expect(buildLocalJieqiYearSeed(12000, '+08:00')).toBeNull();
		expect(buildLocalJieqiYearSeed(-500, '+08:00')).toBeNull();
	});
});
