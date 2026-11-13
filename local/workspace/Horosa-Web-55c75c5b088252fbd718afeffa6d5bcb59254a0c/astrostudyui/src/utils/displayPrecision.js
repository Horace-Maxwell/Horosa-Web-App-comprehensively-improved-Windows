// 全站数值显示精度口径(界面上给人看的数;AI 快照 / 导出正文沿用引擎原值,不经这里):
//  · 位置(黄经 / 赤经 / 赤纬 / 方位高度):度分(秒),走各页既有的度分出口;
//  · 用小数写的量 —— 角度(相位误差、容许度差、弧、赤纬差)、年数、比率:最多 3 位小数,尾零不补
//    (全站「误差 1.364」这类读数本就是 3 位;引擎回 4 位及以上的在显示处收到 3 位);
//  · 天文常数与用户亲手输入的数(年长 365.2425 等)原样。
export const DISPLAY_MAX_DECIMALS = 3;

// 最多保留 n 位小数,尾零不补;不是有限数的原样转成字符串(缺值由调用方自己兜)。
export function trimDecimals(value, n = DISPLAY_MAX_DECIMALS){
	if(value === null || value === undefined || value === ''){ return ''; }
	const num = Number(value);
	if(!Number.isFinite(num)){ return `${value}`; }
	const k = Math.pow(10, n);
	const r = Math.round(num * k) / k;
	return `${Object.is(r, -0) ? 0 : r}`;
}

// 同上,但不为零的极小量不写成 0:收位后是 0 → 「<0.001」(负的「>-0.001」)。给速度这类跨几个量级的读数用。
export function trimDecimalsNonZero(value, n = DISPLAY_MAX_DECIMALS){
	const text = trimDecimals(value, n);
	const num = Number(value);
	if(text !== '0' || !Number.isFinite(num) || num === 0){ return text; }
	const floor = (1 / Math.pow(10, n)).toFixed(n);
	return num > 0 ? `<${floor}` : `>-${floor}`;
}
