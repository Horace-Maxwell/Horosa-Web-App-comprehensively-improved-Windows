import { buildSmallYears } from '../BaZiLuckFlowPanel';

// 🔴 全年份域金标(前端·细盘小运期「大运」列)。真机症:BC/极端年(lunar-js 域外)八字细盘处于
// 小运期(生年→起运)时「大运」列空——小运期该列显示小运干支,经 selection.luckPillar 路由,
// 源为 buildSmallYears 每年的 pillar。Java /bazi/direct 的 smallDirection 元素小运柱在 src.direct
// (顶层无 ganzi),旧码 normalizePillar(src) 取不到 → 空。修复:优先取 src.direct(前端结构 src.direct
// 亦为小运柱),两结构统一非空。流年列(liunianPillar 用 src.yearGanzi/yearGanzi 兜底)本就正常。
describe('buildSmallYears · 小运柱干支源(Java/前端两结构)', () => {
	const dayStem = '庚';

	test('🔴 Java /bazi/direct 结构(小运柱在 src.direct,顶层无 ganzi)→ 大运列 pillar 非空', () => {
		const value = {
			smallDirection: [
				{ year: -12026, direct: { ganzi: '乙亥', stem: { cell: '乙' }, branch: { cell: '亥' } }, yearGanzi: { ganzi: '乙未' } },
				{ year: -12025, direct: { ganzi: '丙子', stem: { cell: '丙' }, branch: { cell: '子' } }, yearGanzi: { ganzi: '丙申' } },
			],
		};
		const years = buildSmallYears(value, -12026, -12023, dayStem, 'nominal');
		expect(years.length).toBe(3); // firstStart - birthYear = -12023 - (-12026) = 3
		expect(years[0].pillar.ganzi).toBe('乙亥');       // 小运干支(大运列)非空 — 核心断言
		expect(years[1].pillar.ganzi).toBe('丙子');
		expect(years[0].liunianPillar.ganzi).toBe('乙未'); // 流年列本就正常
	});

	test('前端 buildLocalBaziResult 结构(顶层 ganzi + src.direct 均为小运柱)→ 零回归非空', () => {
		const value = {
			smallDirection: [
				{ year: 2020, ganzi: '甲子', direct: { ganzi: '甲子', stem: { cell: '甲' }, branch: { cell: '子' } }, yearGanzi: { ganzi: '庚子' } },
			],
		};
		const years = buildSmallYears(value, 2020, 2023, dayStem, 'nominal');
		expect(years[0].pillar.ganzi).toBe('甲子'); // 优先 src.direct,与旧 normalizePillar(src) 同值 → 零回归
	});

	test('smallDirection 缺失/元素无 direct:回退 yearGanzi 兜底,绝不空/抛', () => {
		const years = buildSmallYears({ smallDirection: [] }, 2000, 2003, dayStem, 'nominal');
		expect(years.length).toBe(3);
		years.forEach((y)=>{ expect(y.pillar.ganzi.length).toBe(2); }); // yearGanzi(year) 兜底,干支两字
	});
});
