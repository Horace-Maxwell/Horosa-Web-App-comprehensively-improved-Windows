// 「显示星体」面板置灰名单的双向看守。
//
// 由 2026-07-31 运行时死开关审计落成:那轮在十二分盘逐个点了 40 个星体芯片,
// 其中 9 个(汉堡八虚星 + 七政命度点)盘面与右栏毫无变化 —— 因为西洋盘绘制层根本不消费它们。
// 这里锁两个方向:①名单不漏(该置灰的都在) ②名单不滥(西洋盘画得出来的星绝不能被误灰)。
import * as AstroConst from '../AstroConst';
import { PLANET_ONLY_IN, unavailableIn } from '../planetAvailability';

describe('显示星体面板的置灰名单', () => {
	test('汉堡八虚星全在名单内,去向指向量化盘', () => {
		const list = AstroConst.LIST_URANIAN;
		expect(list.length).toBe(8);
		list.forEach((id) => {
			expect(unavailableIn(id)).toContain('量化盘');
		});
	});

	test('七政命度点指向七政盘', () => {
		expect(unavailableIn(AstroConst.LIFEMASTERDEG74)).toContain('七政');
	});

	test('十大行星与四轴绝不在名单内(误灰=把好功能砍了)', () => {
		[
			AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS,
			AstroConst.JUPITER, AstroConst.SATURN, AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO,
			AstroConst.ASC, AstroConst.DESC, AstroConst.MC, AstroConst.IC,
			AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, AstroConst.CHIRON,
		].forEach((id) => {
			expect(unavailableIn(id)).toBe('');
		});
	});

	test('名单只覆盖 LIST_POINTS 里真实存在的条目', () => {
		const known = new Set(AstroConst.LIST_POINTS);
		Object.keys(PLANET_ONLY_IN).forEach((id) => {
			expect(known.has(id)).toBe(true);
		});
	});
});
