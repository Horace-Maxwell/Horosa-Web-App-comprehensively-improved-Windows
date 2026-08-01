// 世运盘 WP-7 地理分野(§12.1 四象限 + §12.2 星座地域)golden:数据完整 + 四轴落分野派生。
import {
	SIGN_CHOROGRAPHY, MUNDANE_QUADRANTS, CHOROGRAPHY_DATASETS, CHOROGRAPHY_DISCLAIMER,
	describeChorography, MUNDANE_SIGN_ORDER,
} from '../../divination/mundane/chorography';

describe('世运盘 分野 数据完整性', () => {
	test('SIGN_CHOROGRAPHY:12 星座,两层国家(古典层非空)+城市', () => {
		expect(Object.keys(SIGN_CHOROGRAPHY)).toHaveLength(12);
		MUNDANE_SIGN_ORDER.forEach((k) => {
			expect(SIGN_CHOROGRAPHY[k]).toBeTruthy();
			expect(SIGN_CHOROGRAPHY[k].countries.ptolemaic.length).toBeGreaterThan(0);
			expect(Array.isArray(SIGN_CHOROGRAPHY[k].countries.modern)).toBe(true);
			expect(SIGN_CHOROGRAPHY[k].cities.length).toBeGreaterThan(0);
		});
		// 抽样字节核对古籍(拆层依据=时代标注:「(现代)」/新世界 → modern 层,余留古典层)
		expect(SIGN_CHOROGRAPHY.aries.countries.ptolemaic).toContain('英格兰');
		expect(SIGN_CHOROGRAPHY.gemini.countries.modern).toContain('美国(现代)');
		expect(SIGN_CHOROGRAPHY.gemini.countries.ptolemaic).not.toContain('美国(现代)');
		expect(SIGN_CHOROGRAPHY.libra.cities).toContain('Vienna');
		expect(SIGN_CHOROGRAPHY.capricorn.countries.ptolemaic).toContain('印度');
		expect(SIGN_CHOROGRAPHY.capricorn.countries.modern).toContain('墨西哥');
		expect(SIGN_CHOROGRAPHY.aquarius.countries.modern).toContain('俄罗斯(现代)');
	});

	test('[G2] 数据集真分叉:classical 档只出古典层且不列城市;modern 档合并两层+城市', () => {
		const FACTS = { meta: { ascSign: 'gemini' }, lons: { asc: 65, mc: 340 } };
		const classical = describeChorography(FACTS, 'classical');
		const modern = describeChorography(FACTS, 'modern');
		const ascC = classical.axes.find((a) => a.axis === 'ASC');
		const ascM = modern.axes.find((a) => a.axis === 'ASC');
		expect(ascC.regions.countries).not.toContain('美国(现代)');   // 古典档零现代条目
		expect(ascM.regions.countries).toContain('美国(现代)');
		expect(ascC.regions.cities).toHaveLength(0);                  // 城市系后世增补,古典档不列
		expect(ascM.regions.cities.length).toBeGreaterThan(0);
		expect(classical.citiesOmitted).toBe(true);
		expect(modern.citiesOmitted).toBe(false);
		// classical_medieval 同古典层(古籍未单列中世纪增补名单,不臆造)
		const cm = describeChorography(FACTS, 'classical_medieval');
		expect(cm.axes.find((a) => a.axis === 'ASC').regions.countries).not.toContain('美国(现代)');
	});

	test('MUNDANE_QUADRANTS:4 三方,12 星座恰好各属一方', () => {
		expect(MUNDANE_QUADRANTS).toHaveLength(4);
		const all = MUNDANE_QUADRANTS.flatMap((q) => q.signs);
		expect(all.sort()).toEqual([...MUNDANE_SIGN_ORDER].sort());
		MUNDANE_QUADRANTS.forEach((q) => {
			expect(q.signs).toHaveLength(3);
			expect(q.rulers.day).toBeTruthy();
			expect(q.rulers.night).toBeTruthy();
		});
		const fire = MUNDANE_QUADRANTS.find((q) => q.key === 'fire');
		expect(fire.signs).toEqual(['aries', 'leo', 'sagittarius']);
		expect(fire.rulers.day).toBe('sun');
	});

	test('数据集 + 免责存在', () => {
		expect(Object.keys(CHOROGRAPHY_DATASETS)).toEqual(expect.arrayContaining(['classical', 'classical_medieval', 'modern']));
		expect(CHOROGRAPHY_DISCLAIMER).toMatch(/各家有别|多源/);
	});
});

describe('世运盘 分野 describeChorography(四轴落分野)', () => {
	const FACTS = { meta: { ascSign: 'aries' }, lons: { asc: 5, mc: 280 } };   // ASC白羊, MC≈摩羯280°

	test('四轴(ASC/MC/DSC/IC)→ 对应星座 + 分野;对宫正确', () => {
		const r = describeChorography(FACTS, 'modern');
		expect(r).toBeTruthy();
		const byAxis = {};
		r.axes.forEach((a) => { byAxis[a.axis] = a.sign; });
		expect(byAxis.ASC).toBe('aries');
		expect(byAxis.DSC).toBe('libra');         // 白羊对宫=天秤
		expect(byAxis.MC).toBe('capricorn');       // 280° → 摩羯
		expect(byAxis.IC).toBe('cancer');          // 摩羯对宫=巨蟹
		const asc = r.axes.find((a) => a.axis === 'ASC');
		expect(asc.regions.countries).toContain('英格兰');
		expect(r.dataset).toBe('modern');
		expect(r.datasetMeta.label).toBeTruthy();
	});

	test('数据集回退 modern;缺 facts/meta → null', () => {
		expect(describeChorography(FACTS, 'nonsense').dataset).toBe('modern');
		expect(describeChorography(null, 'modern')).toBeNull();
		expect(describeChorography({}, 'modern')).toBeNull();
	});
});
