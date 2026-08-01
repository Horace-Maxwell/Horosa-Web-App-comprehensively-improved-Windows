// 风水 · 伏羲六十四卦圆图 SVG（64 扇区各 5.625°，扇内画六爻卦象 + 卦名；内环 384 爻刻度）。
// 向首度数落卦落爻高亮；合十两卦以弦连线示意。与并列双卦图 SixtyFourGuaRing 互补：
// 圆图管「落在哪」，并列图管「看清爻象」。亮/暗双主题(--fs-* 令牌)。
import React from 'react';
import { GUA64_CIRCLE, GUA64_CIRCLE_META, GUA8_BIN, GUA8_XIANTIAN_NUM } from '../fengshuiData';

const norm = (d)=>((Number(d) % 360) + 360) % 360;
function polar(cx, cy, r, deg) {
	const a = (deg - 90) * Math.PI / 180;
	return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function sectorPath(cx, cy, rIn, rOut, deg0, deg1) {
	let sweep = norm(deg1 - deg0);
	if (sweep === 0) { sweep = 360; }
	const [ax, ay] = polar(cx, cy, rOut, deg0);
	const [bx, by] = polar(cx, cy, rOut, deg0 + sweep);
	const [c2x, c2y] = polar(cx, cy, rIn, deg0 + sweep);
	const [dx, dy] = polar(cx, cy, rIn, deg0);
	return `M ${ax} ${ay} A ${rOut} ${rOut} 0 0 1 ${bx} ${by} L ${c2x} ${c2y} A ${rIn} ${rIn} 0 0 0 ${dx} ${dy} Z`;
}
// 六爻（自下而上）：下卦三爻 + 上卦三爻。
function hexYao(lower, upper) {
	const lo = GUA8_BIN[lower] || [0, 0, 0];
	const up = GUA8_BIN[upper] || [0, 0, 0];
	return [lo[0], lo[1], lo[2], up[0], up[1], up[2]];
}
// 扇区内的微卦象：沿半径方向自内(初爻)向外(上爻)排六条横画，画本身垂直于半径。
function MiniHex({ cx, cy, rIn, rOut, deg, yao, color, w, hot }) {
	const step = (rOut - rIn) / 6;
	const lh = Math.max(0.9, step * 0.34);
	const gap = w * 0.16;
	return (
		<g transform={`rotate(${deg} ${cx} ${cy})`}>
			{yao.map((v, i)=>{
				const y = cy - (rIn + step * (i + 0.5));
				if (v) { return <rect key={i} x={cx - w / 2} y={y - lh / 2} width={w} height={lh} rx={lh / 2} fill={color} opacity={hot ? 1 : 0.82} />; }
				const seg = (w - gap) / 2;
				return (
					<g key={i}>
						<rect x={cx - w / 2} y={y - lh / 2} width={seg} height={lh} rx={lh / 2} fill={color} opacity={hot ? 1 : 0.82} />
						<rect x={cx + gap / 2} y={y - lh / 2} width={seg} height={lh} rx={lh / 2} fill={color} opacity={hot ? 1 : 0.82} />
					</g>
				);
			})}
		</g>
	);
}
const CHAR_PITCH = 1.20;   // 同罗经：实测盒高/字号上界 1.183，取 1.20 留余量
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

// props: deg 向首度数(可空) / heShiOf 合十配对卦名(可空) / size
export default function SixtyFourGuaCircle({ deg = null, heShiOf = null, size = 620 }) {
	const cx = size / 2; const cy = size / 2;
	const R = size / 2 - 6;
	const rYao = R * 0.44;      // 384 爻刻度环内缘
	const rHexIn = R * 0.50;    // 卦象环
	const rHexOut = R * 0.74;
	const rNameIn = R * 0.76;   // 卦名环
	const rNameOut = R * 0.98;
	const hasDeg = deg != null && deg !== '' && !Number.isNaN(Number(deg));
	const d = hasDeg ? norm(deg) : null;
	const hitGua = hasDeg ? GUA64_CIRCLE.find((g)=>norm(d - g.deg0) < GUA64_CIRCLE_META.degPerGua) : null;
	// 同罗经口径：径向按最长卦名字数（四字如「雷泽归妹」）、切向取名环最内缘弧宽。
	const nameMaxLen = GUA64_CIRCLE.reduce((m, g)=>Math.max(m, g.name.length), 1);
	const nameFs = Math.max(6, Math.min(size * 0.0205, (rNameOut - rNameIn) / (nameMaxLen * CHAR_PITCH), (2 * Math.PI * rNameIn / 64) * 0.92));
	const hexW = Math.min(size * 0.028, (2 * Math.PI * rHexIn / 64) * 0.86);

	// 384 爻刻度。
	const yaoTicks = [];
	for (let i = 0; i < 384; i++) {
		const a = norm(GUA64_CIRCLE_META.startDeg + i * GUA64_CIRCLE_META.degPerYao);
		const isGua = i % 6 === 0;
		const [x1, y1] = polar(cx, cy, rYao - (isGua ? R * 0.035 : R * 0.016), a);
		const [x2, y2] = polar(cx, cy, rYao, a);
		yaoTicks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
			stroke={isGua ? 'var(--fs-gold,#c0883a)' : 'var(--fs-grid,rgba(127,140,170,.4))'} strokeWidth={isGua ? 0.9 : 0.45} />);
	}

	// 合十弦：命中卦与其合十对卦连线（heShiOf 给定卦名时画）。
	let chord = null;
	if (hitGua && heShiOf) {
		const mate = GUA64_CIRCLE.find((g)=>g.name === heShiOf);
		if (mate) {
			const [x1, y1] = polar(cx, cy, rHexIn - 4, hitGua.center);
			const [x2, y2] = polar(cx, cy, rHexIn - 4, mate.center);
			chord = (
				<g>
					<line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fs-gold,#c0883a)" strokeWidth={1.3} strokeDasharray="5 4" opacity={0.85} />
					<circle cx={x2} cy={y2} r={3} fill="var(--fs-gold,#c0883a)" />
				</g>
			);
		}
	}

	return (
		<svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block' }} className="horosa-fs-gua64circle">
			<circle cx={cx} cy={cy} r={R} fill="var(--horosa-surface,rgba(127,140,170,.045))" />
			{/* 八宫底色（先天八卦各辖三山 45°） */}
			{['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'].map((g, i)=>{
				const cell = GUA64_CIRCLE.find((c)=>c.sector === g);
				if (!cell) { return null; }
				return (
					<path key={g} d={sectorPath(cx, cy, rHexIn - 2, rNameOut, norm(cell.sectorDeg - 22.5), norm(cell.sectorDeg + 22.5))}
						fill={i % 2 ? 'var(--fs-tile,rgba(127,140,170,.06))' : 'transparent'} stroke="var(--fs-grid,rgba(127,140,170,.28))" strokeWidth={0.7} />
				);
			})}
			{yaoTicks}
			{GUA64_CIRCLE.map((g)=>{
				const hot = hitGua && g.name === hitGua.name;
				const mate = heShiOf && g.name === heShiOf;
				const color = hot ? 'var(--fs-gold,#b8862f)' : (mate ? 'var(--fs-accent,#2f7df1)' : 'var(--fs-text,#8b93a5)');
				return (
					<g key={g.name}>
						{hot ? <path d={sectorPath(cx, cy, rHexIn - 2, rNameOut, g.deg0, g.deg1)} fill="var(--fs-xiang,rgba(216,173,99,.28))" stroke="var(--fs-gold,#c0883a)" strokeWidth={1} /> : null}
						<MiniHex cx={cx} cy={cy} rIn={rHexIn} rOut={rHexOut} deg={g.center} yao={hexYao(g.lower, g.upper)} color={color} w={hexW} hot={!!hot} />
						<RadialText cx={cx} cy={cy} rIn={rNameIn} rOut={rNameOut} deg={g.center} text={g.name}
							fs={hot ? nameFs + 1 : nameFs} fill={color} weight={hot ? 800 : 520} />
					</g>
				);
			})}
			{chord}
			<circle cx={cx} cy={cy} r={rYao} fill="var(--horosa-surface-raised,rgba(255,255,255,.55))" stroke="var(--fs-grid,rgba(127,140,170,.24))" strokeWidth={0.9} />
			<circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--fs-gold,#c0883a)" strokeWidth={1.5} strokeOpacity={0.6} />
			{/* 中心读数 */}
			{hitGua ? (
				<g>
					<text x={cx} y={cy - size * 0.062} fontSize={Math.round(size * 0.026)} textAnchor="middle" fill="var(--fs-muted,#9aa)">向首 {d.toFixed(2)}°</text>
					<text x={cx} y={cy - size * 0.018} fontSize={Math.round(size * 0.045)} textAnchor="middle" fontWeight={800} fill="var(--fs-gold,#b8862f)">{hitGua.name}</text>
					<text x={cx} y={cy + size * 0.028} fontSize={Math.round(size * 0.026)} textAnchor="middle" fill="var(--fs-text,#999)">{hitGua.upper}上 · {hitGua.lower}下（先天 {GUA8_XIANTIAN_NUM[hitGua.lower]}·{GUA8_XIANTIAN_NUM[hitGua.upper]}）</text>
					<text x={cx} y={cy + size * 0.066} fontSize={Math.round(size * 0.023)} textAnchor="middle" fill="var(--fs-muted,#9aa)">每卦 5.625° · 每爻 0.9375°</text>
				</g>
			) : (
				<g>
					<text x={cx} y={cy - size * 0.012} fontSize={Math.round(size * 0.034)} textAnchor="middle" fontWeight={720} fill="var(--fs-text,#aaa)">六十四卦圆图</text>
					<text x={cx} y={cy + size * 0.028} fontSize={Math.round(size * 0.024)} textAnchor="middle" fill="var(--fs-muted,#9aa)">填向首度数以落卦落爻</text>
				</g>
			)}
		</svg>
	);
}
