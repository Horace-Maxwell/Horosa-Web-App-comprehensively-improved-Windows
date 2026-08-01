// 风水 · 三合线法环 SVG（穿山七十二龙 / 透地六十龙 / 百二十分金 三同心环 + 坐山度数游标）。
// 语义色：旺相 good / 孤虚 muted / 空亡（龟甲戊己·甲己龙）bad。干支标注为通行三合盘口径，须按门派校。
// 亮/暗双主题(--fs-* 令牌)。
import React from 'react';
import { CHUANSHAN_72, TOUDI_60, FENJIN_120 } from '../fengshuiData';

const norm = (d)=>((Number(d) % 360) + 360) % 360;
function polar(cx, cy, r, deg) {
	const a = (deg - 90) * Math.PI / 180;
	return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function sectorPath(cx, cy, rIn, rOut, deg0, deg1) {
	let sweep = norm(deg1 - deg0);
	if (sweep === 0) { sweep = 360; }
	const large = sweep > 180 ? 1 : 0;
	const [ax, ay] = polar(cx, cy, rOut, deg0);
	const [bx, by] = polar(cx, cy, rOut, deg0 + sweep);
	const [c2x, c2y] = polar(cx, cy, rIn, deg0 + sweep);
	const [dx, dy] = polar(cx, cy, rIn, deg0);
	return `M ${ax} ${ay} A ${rOut} ${rOut} 0 ${large} 1 ${bx} ${by} L ${c2x} ${c2y} A ${rIn} ${rIn} 0 ${large} 0 ${dx} ${dy} Z`;
}
const FILL = {
	good: 'var(--fs-good-bg,rgba(46,156,90,.18))',
	bad: 'var(--fs-bad-bg,rgba(192,57,43,.18))',
	neutral: 'var(--fs-tile,rgba(127,140,170,.06))',
};
const CHAR_PITCH = 1.20;   // 同罗经：实测盒高/字号上界 1.183，取 1.20 留余量
const TEXT = { good: 'var(--fs-good,#2e9c5a)', bad: 'var(--fs-bad,#c0392b)', neutral: 'var(--fs-muted,#9aa)' };

function RadialText({ cx, cy, rIn, rOut, deg, text, fs, fill, weight }) {
	const s = `${text || ''}`;
	if (!s) { return null; }
	const step = Math.min(fs * CHAR_PITCH, (rOut - rIn) / s.length);
	const first = (rIn + rOut) / 2 - (s.length - 1) * step / 2;
	return (
		<g transform={`rotate(${deg} ${cx} ${cy})`}>
			{s.split('').map((ch, i)=>(
				<text key={i} x={cx} y={cy - (first + i * step)} fontSize={fs} textAnchor="middle" dominantBaseline="central" fill={fill} fontWeight={weight}>{ch}</text>
			))}
		</g>
	);
}

const RINGS = [
	{ key: 'chuanshan', label: '穿山七十二龙', cells: CHUANSHAN_72, r0: 0.52, r1: 0.68 },
	{ key: 'toudi', label: '透地六十龙', cells: TOUDI_60, r0: 0.68, r1: 0.84 },
	{ key: 'fenjin', label: '百二十分金', cells: FENJIN_120, r0: 0.84, r1: 1 },
];

// props: deg 坐山度数(可空) / size
export default function XianfaRing({ deg = null, size = 560 }) {
	const cx = size / 2; const cy = size / 2;
	const R = size / 2 - 6;
	const hasDeg = deg != null && deg !== '' && !Number.isNaN(Number(deg));
	const d = hasDeg ? norm(deg) : null;

	return (
		<svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block' }} className="horosa-fs-xianfa">
			<circle cx={cx} cy={cy} r={R} fill="var(--horosa-surface,rgba(127,140,170,.045))" />
			{RINGS.map((ring)=>{
				const rIn = ring.r0 * R; const rOut = ring.r1 * R;
				const width = rOut - rIn;
				// 与罗经同一口径：径向按最长标签字数分配、切向取最内圈弧宽（最紧处，中径够宽不代表内缘够宽）。
				const maxLen = ring.cells.reduce((m, c)=>Math.max(m, `${c.label || ''}`.length), 1);
				const arcIn = (2 * Math.PI * rIn) / ring.cells.length;
				const fs = Math.max(5, Math.min((width * 0.8) / (maxLen * CHAR_PITCH), arcIn * 0.86, size * 0.024));
				return (
					<g key={ring.key}>
						{ring.cells.map((c, i)=>{
							const mid = norm(c.deg0 + norm(c.deg1 - c.deg0) / 2);
							const hit = hasDeg && norm(d - c.deg0) < norm(c.deg1 - c.deg0);
							return (
								<g key={`${ring.key}-${i}`}>
									<path d={sectorPath(cx, cy, rIn, rOut, c.deg0, c.deg1)}
										fill={hit ? 'var(--fs-xiang,rgba(216,173,99,.34))' : (FILL[c.jx] || FILL.neutral)}
										stroke="var(--fs-grid,rgba(127,140,170,.22))" strokeWidth={0.5} />
									<RadialText cx={cx} cy={cy} rIn={rIn + width * 0.1} rOut={rOut - width * 0.1} deg={mid}
										text={c.label} fs={hit ? fs + 1 : fs} fill={hit ? 'var(--fs-gold,#b8862f)' : (TEXT[c.jx] || TEXT.neutral)}
										weight={hit ? 800 : 520} />
								</g>
							);
						})}
						<circle cx={cx} cy={cy} r={rOut} fill="none" stroke="var(--fs-grid,rgba(127,140,170,.3))" strokeWidth={0.8} />
					</g>
				);
			})}
			<circle cx={cx} cy={cy} r={0.52 * R} fill="var(--horosa-surface-raised,rgba(255,255,255,.55))"
				stroke="var(--fs-grid,rgba(127,140,170,.24))" strokeWidth={0.9} />
			<circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--fs-gold,#c0883a)" strokeWidth={1.4} strokeOpacity={0.55} />
			{/* 中心图例 */}
			<text x={cx} y={cy - size * 0.075} fontSize={Math.round(size * 0.032)} textAnchor="middle" fontWeight={720} fill="var(--fs-text,#aaa)">三合线法</text>
			{RINGS.map((ring, i)=>(
				<text key={ring.key} x={cx} y={cy - size * 0.02 + i * size * 0.038} fontSize={Math.round(size * 0.024)} textAnchor="middle" fill="var(--fs-muted,#9aa)">{ring.label}</text>
			))}
			{hasDeg ? (
				<text x={cx} y={cy + size * 0.115} fontSize={Math.round(size * 0.03)} textAnchor="middle" fontWeight={760} fill="var(--fs-gold,#b8862f)">{d.toFixed(1)}°</text>
			) : (
				<text x={cx} y={cy + size * 0.115} fontSize={Math.round(size * 0.022)} textAnchor="middle" fill="var(--fs-muted,#9aa)">填坐山度数以定格</text>
			)}
			{/* 游标自内环起（不穿过中心图例）。 */}
			{hasDeg ? (()=>{ const [x, y] = polar(cx, cy, R, d); const [ix, iy] = polar(cx, cy, 0.52 * R, d); return (
				<g>
					<line x1={ix} y1={iy} x2={x} y2={y} stroke="var(--fs-bad,#c0392b)" strokeWidth={1.3} strokeOpacity={0.85} />
					<circle cx={x} cy={y} r={3} fill="var(--fs-bad,#c0392b)" />
				</g>
			); })() : null}
		</svg>
	);
}
