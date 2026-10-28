// 风水圆盘类 SVG 图共用的几何小件(罗经 / 二十四山 / 六十四卦圆图 / 穿山透地分金环 / 玄空大卦卦象),此前各图各抄一份。
import React from 'react';
import { GUA8_BIN } from '../fengshuiData';
import { scriptWordAttrs } from '../../../utils/scriptMode';

// 极坐标 → 画布坐标:0°=正上(北),顺时针。
export function polar(cx, cy, r, deg) {
	const a = (deg - 90) * Math.PI / 180;
	return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

// 沿半径竖排的字距系数:实机 getBBox 实测盒高 / 字号 ∈ [1.147, 1.183](盒宽 / 字号 = 1.00,全角)。
// 径向字距与「按字数分配字号」都必须 ≥ 该上界,否则相邻字的盒必相压(1.04 严重重叠、1.18 仍余边缘重叠),取 1.20 彻底净空。
export const CHAR_PITCH = 1.20;

// 扇区内沿半径方向竖排一串字(自内向外,即罗盘自内向外读),整体按 deg 旋转到扇区中线。
// 一个字一个 <text>:每个字带整词与位次(scriptWordAttrs,与 GraphHelper.appendPerCharText 同一组属性),
// 界面繁体按整词转再取那一位 —— 逐字转会丢词境(一简多繁的字:后 / 干 / 发 / 历 …)。罗经 / 线法 / 六十四卦圆图共用这一份。
export function RadialText({ cx, cy, rIn, rOut, deg, text, fs, fill, weight }) {
	const s = `${text || ''}`;
	if (!s) { return null; }
	const step = Math.min(fs * CHAR_PITCH, (rOut - rIn) / s.length);
	const first = (rIn + rOut) / 2 - (s.length - 1) * step / 2;
	return (
		<g transform={`rotate(${deg} ${cx} ${cy})`}>
			{s.split('').map((ch, i)=>(
				<text key={i} x={cx} y={cy - (first + i * step)} fontSize={fs} textAnchor="middle" dominantBaseline="central" fill={fill} fontWeight={weight} {...scriptWordAttrs(s, i)}>{ch}</text>
			))}
		</g>
	);
}

// 六爻数组(自下而上):下卦三爻 + 上卦三爻,阳 1 阴 0;idx0 = 初爻(底)。
export function hexYao(lower, upper) {
	const lo = GUA8_BIN[lower] || [0, 0, 0];
	const up = GUA8_BIN[upper] || [0, 0, 0];
	return [lo[0], lo[1], lo[2], up[0], up[1], up[2]];
}
