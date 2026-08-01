import * as AstroConst from './AstroConst';

/**
 * 「此星点只有某些技法画得出来」的登记表 —— 单一真值源。
 *
 * 病灶(2026-07-31 运行时死开关审计实证):左栏「显示星体」面板由 PlanetSelector 无条件铺开
 * AstroConst.LIST_POINTS 全表,但该面板只服务西洋盘族(AstroChartMain:本命/十二分/十三分/
 * 卜卦/择日/世俗…)。汉堡学派八虚星的消费面只在 components/germany/(量化盘),
 * 七政命度点只在 components/guolao/(七政盘) —— 两者都有各自独立的界面,压根不走这个面板。
 * 结果:用户在西洋盘里勾这 9 个,盘面与右栏**毫无变化**,界面也不给任何解释。
 *
 * 处置照本仓既有先例(奇门 DunJiaMain 的置灰范式):不从列表里抹掉(突然消失只会让人以为功能没了),
 * 而是置灰 + 说明去哪儿看。真正能画它们的页面各有自己的选择器,不受本表影响。
 */
export const PLANET_ONLY_IN = (function build(){
	const map = {};
	(AstroConst.LIST_URANIAN || []).forEach(function (id) {
		map[id] = '量化盘（汉堡学派）';
	});
	map[AstroConst.LIFEMASTERDEG74] = '七政四余盘';
	return map;
})();

/** 该星点在「西洋盘族的显示星体面板」里是否画不出来;画得出来返回 ''。 */
export function unavailableIn(id){
	return PLANET_ONLY_IN[id] || '';
}

export default PLANET_ONLY_IN;
