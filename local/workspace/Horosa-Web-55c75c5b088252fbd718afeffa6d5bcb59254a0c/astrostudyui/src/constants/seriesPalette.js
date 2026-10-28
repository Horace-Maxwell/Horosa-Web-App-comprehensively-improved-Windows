// 多序列曲线分类色板:星 → 序号的唯一映射(色值在 layouts/app/01-base.less 的 --horosa-series-1..12,亮暗成对)。
//
// 为什么单设:曲线交叉处只能靠颜色辨星。借语义色(日借 planet-sun、土借 planet-saturn、月借 info、海借 link)
// 会撞色——那几组本来就同属一个色族,同图两两色差掉到 6–7(几乎同色)。
// 本色板每色在亮 / 暗全部盘面底上 ≥ 3.4:1、同套两两 CIEDE2000 ≥ 16,由合同测试 chartInkContrast 看守。
// 用法:曲线 stroke / 标签 fill 一律 seriesColorOf(星名);新加一类多序列图,按语义挑序号,不要再借语义色。
import * as AstroConst from './AstroConst';

export const SERIES_PALETTE_SIZE = 12;

// 序号 1..12 → var(--horosa-series-N)
export function seriesVar(n){
	const k = Math.max(1, Math.min(SERIES_PALETTE_SIZE, Math.round(Number(n) || 1)));
	return `var(--horosa-series-${k})`;
}

// 星 → 序号(两交点同色、四轴同色,与它们在图上的「同一类参考」语义一致)
export const SERIES_SLOT_BY_PLANET = {
	[AstroConst.SUN]: 1,
	[AstroConst.MOON]: 2,
	[AstroConst.MERCURY]: 3,
	[AstroConst.VENUS]: 4,
	[AstroConst.MARS]: 5,
	[AstroConst.JUPITER]: 6,
	[AstroConst.SATURN]: 7,
	[AstroConst.URANUS]: 8,
	[AstroConst.NEPTUNE]: 9,
	[AstroConst.PLUTO]: 10,
	[AstroConst.NORTH_NODE]: 11,
	[AstroConst.SOUTH_NODE]: 11,
	[AstroConst.ASC]: 12,
	[AstroConst.MC]: 12,
};

// 星名 → 曲线色;不在色板里的星返回 fallback(调用方给,缺省 undefined)
export function seriesColorOf(id, fallback){
	const n = SERIES_SLOT_BY_PLANET[id];
	return n ? seriesVar(n) : fallback;
}

// 一张图里按星名取一组色(值即 var() 串)
export function seriesToneMap(ids){
	const out = {};
	(ids || []).forEach((id)=>{
		const c = seriesColorOf(id);
		if(c){ out[id] = c; }
	});
	return out;
}

// 冗余编码:线型。色觉缺陷(绿色弱 / 红色弱 / 蓝色弱,Machado 2009 全强度模拟)下仍有几对序号色差不足
// (如亮色月 ~ 木只剩 2.0、火 ~ 交 2.5),交叉处单靠颜色分不开 —— 这些对一律用不同线型补足。
// 分配由合同 chartInkContrast ⑤ 看守:同图两两要么模拟色差 ≥ 8,要么线型不同。实线留给日 / 月 / 火 / 天王 / 海王 / 四轴。
export const SERIES_DASH = { dashed: '6 3', dotted: '1.6 2.4' };
export const SERIES_DASH_BY_SLOT = {
	3: SERIES_DASH.dashed,	// 水
	4: SERIES_DASH.dashed,	// 金
	6: SERIES_DASH.dashed,	// 木
	7: SERIES_DASH.dotted,	// 土
	10: SERIES_DASH.dotted,	// 冥王
	11: SERIES_DASH.dotted,	// 交点
};

// 序号 → stroke-dasharray(实线返回 undefined,直接给 SVG 属性即可)
export function seriesDashVar(n){
	const k = Math.max(1, Math.min(SERIES_PALETTE_SIZE, Math.round(Number(n) || 1)));
	return SERIES_DASH_BY_SLOT[k];
}

// 星名 → 线型(不在色板里的星为实线)
export function seriesDashOf(id){
	const n = SERIES_SLOT_BY_PLANET[id];
	return n ? seriesDashVar(n) : undefined;
}
