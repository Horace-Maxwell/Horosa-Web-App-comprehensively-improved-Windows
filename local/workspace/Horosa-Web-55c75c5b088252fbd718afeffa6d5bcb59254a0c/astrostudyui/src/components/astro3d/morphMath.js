// 3D 星盘补间纯数学(WS-1b 改时间滑移补间)。
// 零依赖纯模块:jest 直测;Astro3D 本体(WebGL/DOM 依赖,jsdom 不可实例化)只消费不定义。
//
// 约定:角度一律以「度」为单位;补间走劣弧(shortest arc),跨 0°/360° 不绕远。

/** 归一化到 [0, 360) */
export function norm360(deg){
	return ((deg % 360) + 360) % 360;
}

/**
 * 新旧黄经差的最短弧(劣弧)增量,返回 [−180, 180)。
 * 359°→1° 得 +2(不走 −358);对跖点(差恰 180°)两向等距,约定返回 −180 保确定性。
 */
export function shortestArcDelta(fromDeg, toDeg){
	return ((toDeg - fromDeg) % 360 + 540) % 360 - 180;
}

/** easeInOutCubic 缓动(与相机预设飞行同族;滑移补间 ~600ms 用) */
export function easeInOutCubic(t){
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
