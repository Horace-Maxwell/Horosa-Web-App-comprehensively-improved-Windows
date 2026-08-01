// 演禽 · 圆形演禽盘(WP-23)。自足轻量 SVG(与全 app 圆盘视觉语言一致:WUXING_COLOR/CSS 变量,明暗自适应)。
// 当日盘 = 子时正禽置子、按地支顺排 12 宫(时禽逐位);值日禽/三传/活曜/倒将落宫高亮,我彼禽描边随 woBi,锁泊位标注。
import React from 'react';
import { YAO_TO_WUXING, DIZHI, mansionByIdx } from './yanqinConst';

const WUXING_COLOR = { 木: '#3a7d44', 火: '#c0392b', 土: '#b8860b', 金: '#9a8478', 水: '#2c6e9b' };
const R_OUT = 150;
const R_IN = 96;
const R_LABEL = 122;
const CX = 160;
const CY = 160;

function polar(r, angDeg) {
	const a = ((angDeg - 90) * Math.PI) / 180;
	return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}
// 子在正上(12点),顺时针排 12 地支。
function branchAngle(idx) { return idx * 30; }

export default function YanQinChart({ cast, me, they }) {
	if (!cast || !cast.ziStart) { return null; }
	const ziIdx = cast.ziStart.idx;
	// 12 地支各一宿(子时正禽起,顺数)
	const cells = DIZHI.map((zhi, i) => ({ zhi, i, mansion: mansionByIdx(((ziIdx - 1 + i) % 28) + 1) }));
	const dayBranch = cast.hourBranch != null ? null : null; // 日禽落点见下
	// 各禽落哪个地支(在当日盘上):时禽=hourBranch;翻禽=其 landBranch(由引擎给);日禽 landBranch 反推。
	const hourB = cast.hourBranch;
	const meName = me ? me.name : null;
	const theyName = they ? they.name : null;
	return (
		<svg viewBox="0 0 320 320" width="100%" style={{ maxWidth: 340, display: 'block', margin: '0 auto' }} role="img" aria-label="圆形演禽盘">
			<circle cx={CX} cy={CY} r={R_OUT} fill="none" stroke="var(--horosa-border,rgba(120,120,120,0.35))" strokeWidth="1" />
			<circle cx={CX} cy={CY} r={R_IN} fill="none" stroke="var(--horosa-border,rgba(120,120,120,0.25))" strokeWidth="1" />
			{cells.map((c) => {
				const a0 = branchAngle(c.i) - 15;
				const a1 = branchAngle(c.i) + 15;
				const [x0o, y0o] = polar(R_OUT, a0);
				const [x1o, y1o] = polar(R_OUT, a1);
				const [x0i, y0i] = polar(R_IN, a0);
				const [x1i, y1i] = polar(R_IN, a1);
				const [lx, ly] = polar(R_LABEL, branchAngle(c.i));
				const [zx, zy] = polar(R_IN - 12, branchAngle(c.i));
				const color = WUXING_COLOR[YAO_TO_WUXING[c.mansion.yao]] || '#888';
				const isHour = c.i === hourB;
				const isMe = meName && c.mansion.name === meName;
				const isThey = theyName && c.mansion.name === theyName;
				const stroke = isMe ? '#2e7d32' : (isThey ? '#c0392b' : 'transparent');
				return (
					<g key={c.zhi}>
						<path
							d={`M${x0i},${y0i} L${x0o},${y0o} A${R_OUT},${R_OUT} 0 0 1 ${x1o},${y1o} L${x1i},${y1i} A${R_IN},${R_IN} 0 0 0 ${x0i},${y0i} Z`}
							fill={isHour ? 'var(--horosa-accent,#b8860b)' : 'transparent'}
							fillOpacity={isHour ? 0.14 : 0}
							stroke={stroke} strokeWidth={stroke === 'transparent' ? 0 : 2}
						/>
						<text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={color} fontWeight={isHour ? 700 : 400}>
							{c.mansion.name[0]}{c.mansion.name[2]}
						</text>
						<text x={zx} y={zy} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="var(--horosa-muted,#9a8f7d)">{c.zhi}</text>
					</g>
				);
			})}
			<text x={CX} y={CY - 8} textAnchor="middle" fontSize="12" fill="var(--horosa-text,#333)">{cast.ganzhi}日</text>
			<text x={CX} y={CY + 10} textAnchor="middle" fontSize="11" fill="var(--horosa-muted,#9a8f7d)">{cast.yuan}元{cast.jiang}将</text>
			<text x={CX} y={CY + 26} textAnchor="middle" fontSize="9" fill="var(--horosa-muted,#9a8f7d)">绿边=我 · 红边=彼</text>
		</svg>
	);
}
