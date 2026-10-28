// 风水 · 二十四山环 SVG（三合长生环 / 坐向 dial）。外环 24 山(各15°)+ 长生阶(内环) + 坐向高亮。
// 成熟设计:暖金外环 + 柔色内盘 + 长生阶语义色 + 坐向高亮。亮/暗双主题(--fs-* 令牌)。
// 尺寸/字号加大版:山名带更宽、长生阶自成一环、字体放大,便于阅读。
import React from 'react';
import { polar } from './chartGeom';
import { SHAN_ORDER, SHAN_CENTER_DEG } from '../fengshuiData';

const STAGE_JX_COLOR = { good: 'var(--fs-good,#2e9c5a)', bad: 'var(--fs-bad,#c0392b)', neutral: 'var(--fs-muted,#9aa)' };

// props: ring[{shuangshan, zhi, stage, jx}]、zuoShan、xiangShan、size。
export default function TwentyFourShanRing({ ring = null, zuoShan = null, xiangShan = null, size = 700 }) {
	const cx = size / 2; const cy = size / 2;
	const hasRing = Array.isArray(ring) && ring.length > 0;
	const rOuter = size / 2 - 6;                          // 外缘
	const rShanIn = rOuter - Math.round(size * 0.118);    // 山名带内缘(带宽 ~83@700)
	const rShan = (rOuter + rShanIn) / 2;                 // 山名半径
	const rStage = rShanIn - Math.round(size * 0.052);    // 长生阶半径(内一环)
	// 无长生阶(如净阴净阳)时中心圆更大,充分利用中间空间;有长生阶时给其留环。
	const rCenter = (hasRing ? rStage - Math.round(size * 0.05) : rShanIn - Math.round(size * 0.02));
	const shanFont = Math.round(size * 0.034);            // 山名字号 ~24@700
	const stageFont = Math.round(size * 0.027);           // 长生阶字号 ~19@700
	const centerFont = Math.round(size * 0.033);          // 坐向字号 ~23@700

	const stageByShan = {};
	if (hasRing) { ring.forEach((c)=>{ (c.shuangshan || '').split('').forEach((s)=>{ stageByShan[s] = c; }); }); }

	const sectors = SHAN_ORDER.map((s)=>{
		const deg = SHAN_CENTER_DEG[s];
		const [lx, ly] = polar(cx, cy, rOuter, deg - 7.5);
		const [rx, ry] = polar(cx, cy, rOuter, deg + 7.5);
		const [lix, liy] = polar(cx, cy, rShanIn, deg - 7.5);
		const [rix, riy] = polar(cx, cy, rShanIn, deg + 7.5);
		const [tx, ty] = polar(cx, cy, rShan, deg);
		const isZuo = s === zuoShan; const isXiang = s === xiangShan;
		const hot = isZuo || isXiang;
		const path = `M ${lix} ${liy} L ${lx} ${ly} A ${rOuter} ${rOuter} 0 0 1 ${rx} ${ry} L ${rix} ${riy} A ${rShanIn} ${rShanIn} 0 0 0 ${lix} ${liy} Z`;
		const cellInfo = stageByShan[s];
		return (
			<g key={s}>
				<path d={path} fill={isZuo ? 'var(--fs-zuo,rgba(47,125,241,.18))' : (isXiang ? 'var(--fs-xiang,rgba(216,173,99,.20))' : 'var(--fs-tile,rgba(127,140,170,.06))')}
					stroke="var(--fs-grid,rgba(127,140,170,.3))" strokeWidth={0.8} />
				<text x={tx} y={ty + shanFont * 0.34} fontSize={hot ? shanFont + 3 : shanFont} textAnchor="middle"
					fill={isZuo ? 'var(--fs-accent,#2f7df1)' : (isXiang ? 'var(--fs-gold,#b8862f)' : 'var(--fs-text,#999)')}
					fontWeight={hot ? 800 : 560}>{s}</text>
				{cellInfo ? (()=>{ const [sx, sy] = polar(cx, cy, rStage, deg); return (
					<text x={sx} y={sy + stageFont * 0.34} fontSize={stageFont} textAnchor="middle" fontWeight={660} fill={STAGE_JX_COLOR[cellInfo.jx] || 'var(--fs-muted,#9aa)'}>{cellInfo.stage}</text>
				); })() : null}
			</g>
		);
	});

	return (
		<svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block' }} className="horosa-fs-ring">
			{/* 长生阶所在中间环底(有长生阶时) */}
			<circle cx={cx} cy={cy} r={rShanIn} fill="var(--fs-tile, rgba(127,140,170,.06))" stroke="none" />
			{/* 中心圆(坐向) */}
			<circle cx={cx} cy={cy} r={rCenter} fill="var(--horosa-surface-raised, rgba(255,255,255,.55))" stroke="var(--fs-grid, rgba(127,140,170,.22))" strokeWidth={0.8} />
			{/* 外缘暖金环 + 山名带内缘线 */}
			<circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--fs-gold, #c0883a)" strokeWidth={1.4} strokeOpacity={0.55} />
			<circle cx={cx} cy={cy} r={rShanIn} fill="none" stroke="var(--fs-grid, rgba(127,140,170,.32))" strokeWidth={0.9} />
			{hasRing ? <circle cx={cx} cy={cy} r={rCenter} fill="none" stroke="var(--fs-grid, rgba(127,140,170,.18))" strokeWidth={0.7} /> : null}
			{sectors}
			{(zuoShan || xiangShan) ? (
				<text x={cx} y={cy + centerFont * 0.34} fontSize={centerFont} textAnchor="middle" fontWeight={720} fill="var(--fs-text, #aaa)">{zuoShan ? `坐${zuoShan}` : ''}{xiangShan ? `${zuoShan ? '　' : ''}向${xiangShan}` : ''}</text>
			) : null}
		</svg>
	);
}
