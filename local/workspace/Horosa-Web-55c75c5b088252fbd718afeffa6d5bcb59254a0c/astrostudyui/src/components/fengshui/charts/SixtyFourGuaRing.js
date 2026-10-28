// 风水 · 玄空大卦 向/坐 六十四卦 六爻卦象 SVG（向卦·坐卦并列，阳实阴虚，卦名/卦运/零正）。
// 亮/暗双主题(--fs-* 令牌)。上卦(外)在上、下卦(内)在下，自下而上六爻。
import React from 'react';
import { hexYao } from './chartGeom';   // 八卦二进制取自 fengshuiData.GUA8_BIN(与此前本文件内那份逐值相同)

function Hexagram({ x, y, w, yao, accent }) {
	const lineH = 12; const gap = 9; const yaoW = w;
	const rows = [];
	for (let i = 0; i < 6; i++) {
		const yy = y + (5 - i) * (lineH + gap);   // 初爻在底
		if (yao[i]) {
			rows.push(<rect key={i} x={x} y={yy} width={yaoW} height={lineH} rx={2} fill={accent} />);
		} else {
			const seg = (yaoW - 10) / 2;
			rows.push(<rect key={`${i}a`} x={x} y={yy} width={seg} height={lineH} rx={2} fill={accent} />);
			rows.push(<rect key={`${i}b`} x={x + seg + 10} y={yy} width={seg} height={lineH} rx={2} fill={accent} />);
		}
	}
	return <g>{rows}</g>;
}

// props: xiang{name,lower,upper,yun,yuan}, zuo{...}, zheng{yun,text}, ling{yun,text}, flags[], size。
export default function SixtyFourGuaRing({ xiang, zuo, zheng, ling, flags = [], size = 620 }) {
	if (!xiang || !zuo) { return null; }
	const W = size; const H = Math.round(size * 0.62);
	const colW = W / 2;
	const hexW = Math.min(150, colW - 90);
	const col = (cx, title, g, accent, badge)=>(
		<g>
			<text x={cx} y={34} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--fs-text,#aaa)">{title}</text>
			<text x={cx} y={56} textAnchor="middle" fontSize={20} fontWeight={800} fill={accent}>{g.name}</text>
			<Hexagram x={cx - hexW / 2} y={78} w={hexW} yao={hexYao(g.lower, g.upper)} accent={accent} />
			<text x={cx} y={H - 30} textAnchor="middle" fontSize={12.5} fill="var(--fs-muted,#9aa)">{g.upper}上 · {g.lower}下</text>
			<text x={cx} y={H - 10} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--fs-gold,#c0883a)">{badge}</text>
		</g>
	);
	return (
		<svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: size, display: 'block' }} className="horosa-fs-dagua">
			<line x1={W / 2} y1={20} x2={W / 2} y2={H - 40} stroke="var(--fs-grid,rgba(127,140,170,.25))" strokeWidth={1} />
			{col(colW / 2, '向卦', xiang, 'var(--fs-gold,#c0883a)', `卦运 ${xiang.yun} · ${xiang.yuan || ''}`)}
			{col(colW + colW / 2, '坐卦', zuo, 'var(--fs-accent,#2f7df1)', `卦运 ${zuo.yun} · ${zuo.yuan || ''}`)}
			{zheng && ling ? (
				<text x={W / 2} y={H - 40} textAnchor="middle" fontSize={11.5} fill="var(--fs-muted,#9aa)">正神{zheng.yun} 宜山 · 零神{ling.yun} 宜水</text>
			) : null}
		</svg>
	);
}
