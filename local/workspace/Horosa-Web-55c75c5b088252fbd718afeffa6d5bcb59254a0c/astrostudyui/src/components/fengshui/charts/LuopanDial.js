// 风水 · 综合罗经 SVG（同心多环 · 三针分层 · 度数游标）。
// 环由 fengshuiData.LUOPAN_LAYERS 声明式驱动（勿硬编码层数）；可见层按声明宽度等比重铺满全盘，
// 故关掉几层时余层自动加宽、不留空环。文字沿半径排布（内→外逐字），即传统罗盘读法。
// 亮/暗双主题(--fs-* 令牌带兜底色，无 JS 主题分支)。
import React, { useMemo, useRef, useCallback, useState } from 'react';
import { LUOPAN_LAYERS, NEEDLE_OFFSET } from '../fengshuiData';

const JX_FILL = {
	good: 'var(--fs-good-bg,rgba(46,156,90,.16))',
	bad: 'var(--fs-bad-bg,rgba(192,57,43,.16))',
	mild: 'var(--fs-gold-bg,rgba(184,134,47,.14))',
	neutral: 'transparent',
};
const JX_TEXT = { good: 'var(--fs-good,#2e9c5a)', bad: 'var(--fs-bad,#c0392b)', mild: 'var(--fs-gold,#b8862f)' };

const norm = (d)=>((Number(d) % 360) + 360) % 360;
function polar(cx, cy, r, deg) {
	const a = (deg - 90) * Math.PI / 180;   // 0°=正上(北)，顺时针
	return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
// 环形扇区路径（deg0→deg1 顺时针，rIn/rOut）。
function sectorPath(cx, cy, rIn, rOut, deg0, deg1) {
	let sweep = norm(deg1 - deg0);
	if (sweep === 0) { sweep = 360; }
	const large = sweep > 180 ? 1 : 0;
	const [ax, ay] = polar(cx, cy, rOut, deg0);
	const [bx, by] = polar(cx, cy, rOut, deg0 + sweep);
	const [cx2, cy2] = polar(cx, cy, rIn, deg0 + sweep);
	const [dx, dy] = polar(cx, cy, rIn, deg0);
	return `M ${ax} ${ay} A ${rOut} ${rOut} 0 ${large} 1 ${bx} ${by} L ${cx2} ${cy2} A ${rIn} ${rIn} 0 ${large} 0 ${dx} ${dy} Z`;
}
// 🔴 字距常数 = CJK 排版盒高与字号之比的上界 + 余量。
//    实机 getBBox 实测：盒高/字号 ∈ [1.147, 1.183]（盒宽/字号 = 1.00，全角）。
//    径向字距与「按字数分配字号」都必须 ≥ 该上界，否则相邻字的盒必相压：
//    step 被 usable/n 夹住时，box = fs×1.183 而 step = usable/n = fs×PITCH → PITCH < 1.183 即重叠。
//    此前 1.04 → 严重重叠（用户实测反馈）；1.18 → 仍余 20% 边缘重叠；取 1.20 方彻底净空。
const CHAR_PITCH = 1.20;
// 沿半径逐字排布（首字在内、末字在外），即罗盘自内向外读。
function RadialText({ cx, cy, rIn, rOut, deg, text, fs, fill, weight }) {
	const s = `${text || ''}`;
	if (!s) { return null; }
	const n = s.length;
	const span = rOut - rIn;
	const step = Math.min(fs * CHAR_PITCH, span / Math.max(1, n));
	const mid = (rIn + rOut) / 2;
	const first = mid - (n - 1) * step / 2;
	return (
		<g transform={`rotate(${deg} ${cx} ${cy})`}>
			{s.split('').map((ch, i)=>(
				<text key={i} x={cx} y={cy - (first + i * step)} fontSize={fs} textAnchor="middle"
					dominantBaseline="central" fill={fill} fontWeight={weight}>{ch}</text>
			))}
		</g>
	);
}

// 天池：磁针（红头指北）+ 海底十字子午线 + 两点。
function TianChi({ cx, cy, r }) {
	const nR = r * 0.72;
	return (
		<g>
			<circle cx={cx} cy={cy} r={r} fill="var(--horosa-surface-raised,rgba(255,255,255,.55))"
				stroke="var(--fs-gold,#c0883a)" strokeWidth={1.2} strokeOpacity={0.7} />
			<line x1={cx} y1={cy - r * 0.86} x2={cx} y2={cy + r * 0.86} stroke="var(--fs-grid,rgba(127,140,170,.5))" strokeWidth={0.9} />
			<line x1={cx - r * 0.86} y1={cy} x2={cx + r * 0.86} y2={cy} stroke="var(--fs-grid,rgba(127,140,170,.32))" strokeWidth={0.7} />
			<circle cx={cx} cy={cy - r * 0.44} r={r * 0.075} fill="var(--fs-grid,rgba(127,140,170,.7))" />
			<circle cx={cx} cy={cy + r * 0.44} r={r * 0.075} fill="var(--fs-grid,rgba(127,140,170,.7))" />
			<path d={`M ${cx} ${cy - nR} L ${cx + r * 0.11} ${cy} L ${cx} ${cy + r * 0.1} L ${cx - r * 0.11} ${cy} Z`} fill="var(--fs-bad,#c0392b)" />
			<path d={`M ${cx} ${cy + nR} L ${cx + r * 0.1} ${cy} L ${cx} ${cy + r * 0.1} L ${cx - r * 0.1} ${cy} Z`} fill="var(--fs-text,#8a8f9a)" opacity={0.75} />
			<circle cx={cx} cy={cy} r={r * 0.07} fill="var(--horosa-surface-raised,#fff)" stroke="var(--fs-grid,rgba(127,140,170,.6))" strokeWidth={0.8} />
		</g>
	);
}

// props: deg 游标度数 / zuoShan 坐 / xiangShan 向 / layers 可见层 key 数组 / size / onDegChange(deg)
export default function LuopanDial({ deg = 0, zuoShan = null, xiangShan = null, layers = null, size = 760, onDegChange = null }) {
	const cx = size / 2; const cy = size / 2;
	const R = size / 2 - 6;
	const svgRef = useRef(null);
	// hover 只驱动一层薄覆盖（高亮描边 + 读数气泡），不进 rings 的 useMemo 依赖 →
	// 指针在 400+ 扇区上移动时静态环不重算。
	const [hover, setHover] = useState(null);
	const visKeys = Array.isArray(layers) && layers.length ? layers : LUOPAN_LAYERS.map((l)=>l.key);
	const visSig = visKeys.join(',');

	// 可见层按声明宽度等比重铺满 → 少选几层时余层自动加宽，不留空环。
	const laid = useMemo(()=>{
		const set = new Set(visSig.split(','));
		const vis = LUOPAN_LAYERS.filter((l)=>set.has(l.key));
		const total = vis.reduce((a, l)=>a + (l.r1 - l.r0), 0) || 1;
		let acc = 0;
		return vis.map((l)=>{
			const w = (l.r1 - l.r0) / total;
			const out = { ...l, rIn: acc * R, rOut: (acc + w) * R };
			acc += w;
			return out;
		});
	}, [visSig, R]);

	// 静态环（与游标解耦，游标动时不重算）。
	const rings = useMemo(()=>laid.map((l)=>{
		if (l.type === 'text') { return <TianChi key={l.key} cx={cx} cy={cy} r={l.rOut} />; }
		if (l.type === 'tick') {
			const ticks = [];
			for (let d = 0; d < 360; d += 5) {
				const major = d % 15 === 0; const big = d % 90 === 0;
				const rr = l.rIn + (l.rOut - l.rIn) * (big ? 0.05 : (major ? 0.28 : 0.52));
				const [x1, y1] = polar(cx, cy, rr, d); const [x2, y2] = polar(cx, cy, l.rOut, d);
				ticks.push(<line key={d} x1={x1} y1={y1} x2={x2} y2={y2}
					stroke={big ? 'var(--fs-gold,#c0883a)' : 'var(--fs-grid,rgba(127,140,170,.45))'} strokeWidth={big ? 1.3 : (major ? 0.9 : 0.5)} />);
			}
			const lblR = (l.rIn + l.rOut) / 2;
			const lbls = [0, 90, 180, 270].map((d)=>{
				const [x, y] = polar(cx, cy, lblR, d + 12);
				return <text key={`t${d}`} x={x} y={y} fontSize={Math.round(size * 0.0145)} textAnchor="middle" dominantBaseline="central"
					fill="var(--fs-muted,#9aa)" fontWeight={600}>{d}°</text>;
			});
			return <g key={l.key}>{ticks}{lbls}</g>;
		}
		const width = l.rOut - l.rIn;
		const cells = l.cells || [];
		// 🔴 字号必须同时受两个约束，缺一即重叠（曾漏第一条，满层时 64 卦名与线法干支糊成一片）：
		//   ① 径向：n 个字沿半径叠放，可用带宽须除以最长标签字数（此前误用 width*0.5，
		//      3-4 字标签所需 1.6 倍带宽 → 直接压进相邻环）
		//   ② 切向：取本环**最内圈**弧宽（最紧处），不是中径弧宽——中径够宽不代表内缘够宽
		const maxLen = cells.reduce((m, c)=>Math.max(m, `${c.label || ''}`.length), 1);
		const usable = width * 0.8;                                        // 与 RadialText 两端各 10% 内缩一致
		//   切向判在「第一个字符所在圆周」:字符自 rIn+10% 起排,首字中心 ≈ rIn+0.1w+fs/2。
		//   🔴 曾裸用 l.rIn:关掉「天池」层后首个可见层 rIn=0 → 弧宽算成 0 → 字号恒塌
		//   5px 下限(正针二十四山蚂蚁字);rIn>0 时该式仅比旧判据略宽,物理上仍无重叠。
		const fs0 = Math.min(usable / (maxLen * CHAR_PITCH), size * 0.026);
		const rTextIn = l.rIn + width * 0.1 + fs0 / 2;
		const arcIn = cells.length ? (2 * Math.PI * rTextIn) / cells.length : width;
		const fs = Math.max(5, Math.min(fs0, arcIn * 0.86));
		const isMain = !!l.main;
		return (
			<g key={l.key}>
				<circle cx={cx} cy={cy} r={l.rOut} fill="none" stroke={isMain ? 'var(--fs-gold,#c0883a)' : 'var(--fs-grid,rgba(127,140,170,.3))'}
					strokeWidth={isMain ? 1.4 : 0.8} strokeOpacity={isMain ? 0.75 : 1} />
				{cells.map((c, i)=>{
					const d0 = c.deg0; const d1 = c.deg1;
					const mid = norm(d0 + norm(d1 - d0) / 2);
					const hot = l.type === 'needle' && (c.label === zuoShan || c.label === xiangShan);
					const isZuo = hot && c.label === zuoShan;
					const bg = hot
						? (isZuo ? 'var(--fs-zuo,rgba(47,125,241,.18))' : 'var(--fs-xiang,rgba(216,173,99,.22))')
						: (c.jx ? (JX_FILL[c.jx] || 'transparent') : (i % 2 ? 'var(--fs-tile,rgba(127,140,170,.055))' : 'transparent'));
					const fill = hot
						? (isZuo ? 'var(--fs-accent,#2f7df1)' : 'var(--fs-gold,#b8862f)')
						: (c.jx && JX_TEXT[c.jx] ? JX_TEXT[c.jx] : (isMain ? 'var(--fs-text,#999)' : 'var(--fs-muted,#9aa)'));
					return (
						<g key={`${c.label}-${i}`}>
							<path d={sectorPath(cx, cy, l.rIn, l.rOut, d0, d1)} fill={bg}
								stroke="var(--fs-grid,rgba(127,140,170,.24))" strokeWidth={0.55} />
							<RadialText cx={cx} cy={cy} rIn={l.rIn + width * 0.1} rOut={l.rOut - width * 0.1} deg={mid}
								text={c.label} fs={hot ? fs + 1.5 : fs} fill={fill} weight={hot ? 800 : (isMain ? 640 : 520)} />
						</g>
					);
				})}
			</g>
		);
	}), [laid, cx, cy, size, zuoShan, xiangShan]);

	// 游标（随 deg 重渲）。
	const d = norm(deg);
	const [gx, gy] = polar(cx, cy, R, d);
	const [bx, by] = polar(cx, cy, R * 0.9, d);
	// 游标自天池外缘起，不穿过磁针盘心。
	const chi = laid.find((l)=>l.type === 'text');
	const cursorR0 = chi ? chi.rOut : 0;
	const [cx0, cy0] = polar(cx, cy, cursorR0, d);

	// 指针位置 → {deg, r}（svg 用户坐标）。
	const ptOf = useCallback((e)=>{
		if (!svgRef.current) { return null; }
		const rect = svgRef.current.getBoundingClientRect();
		if (!rect.width) { return null; }
		const scale = size / rect.width;
		const px = (e.clientX - rect.left) * scale - cx;
		const py = (e.clientY - rect.top) * scale - cy;
		return { deg: norm(Math.atan2(px, -py) * 180 / Math.PI), r: Math.hypot(px, py) };
	}, [size, cx, cy]);

	const handleClick = useCallback((e)=>{
		if (!onDegChange) { return; }
		const p = ptOf(e);
		// 天池区不改度数 —— 禁区半径用实际天池外缘(cursorR0,随层组布局变),
		// 🔴 曾硬编 R*0.12:默认层组天池实际 0.235R(之间点击仍跳度数)、满层 0.1R(误伤邻环)。
		// 天池层可被关闭(cursorR0=0):盘心附近 atan2 对像素极敏感,保底 0.06R 死区。
		const clickDead = cursorR0 > 0 ? cursorR0 : R * 0.06;
		if (!p || p.r < clickDead) { return; }
		onDegChange(+p.deg.toFixed(2));
	}, [onDegChange, ptOf, cursorR0, R]);

	// hover：命中哪一环、该环在该角度读到哪一格。
	const handleMove = useCallback((e)=>{
		const p = ptOf(e);
		if (!p) { return; }
		const l = laid.find((x)=>p.r >= x.rIn && p.r <= x.rOut);
		if (!l || l.type === 'text') { setHover(null); return; }
		const cell = (l.cells || []).find((c)=>{
			const span = norm(c.deg1 - c.deg0) || 360;
			return norm(p.deg - c.deg0) < span;
		});
		setHover({ key: l.key, label: l.label, rIn: l.rIn, rOut: l.rOut, deg: p.deg, cell: cell || null, approx: !!l.approx });
	}, [ptOf, laid]);
	const handleLeave = useCallback(()=>setHover(null), []);

	return (
		<svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block', cursor: onDegChange ? 'crosshair' : 'default' }}
			className="horosa-fs-luopan" onClick={handleClick} onMouseMove={handleMove} onMouseLeave={handleLeave}>
			<circle cx={cx} cy={cy} r={R} fill="var(--horosa-surface,rgba(127,140,170,.045))" stroke="none" />
			{rings}
			{/* hover：该环内外缘描金 + 命中格描边 */}
			{hover ? (
				<g pointerEvents="none">
					<circle cx={cx} cy={cy} r={hover.rIn} fill="none" stroke="var(--fs-gold,#c0883a)" strokeWidth={1.2} strokeOpacity={0.9} />
					<circle cx={cx} cy={cy} r={hover.rOut} fill="none" stroke="var(--fs-gold,#c0883a)" strokeWidth={1.2} strokeOpacity={0.9} />
					{hover.cell ? (
						<path d={sectorPath(cx, cy, hover.rIn, hover.rOut, hover.cell.deg0, hover.cell.deg1)}
							fill="var(--fs-gold-bg,rgba(184,134,47,.13))" stroke="var(--fs-gold,#c0883a)" strokeWidth={1.1} />
					) : null}
				</g>
			) : null}
			<circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--fs-gold,#c0883a)" strokeWidth={1.6} strokeOpacity={0.6} />
			{/* 度数游标 */}
			<line x1={cx0} y1={cy0} x2={gx} y2={gy} stroke="var(--fs-bad,#c0392b)" strokeWidth={1.4} strokeOpacity={0.85} />
			<circle cx={gx} cy={gy} r={3.2} fill="var(--fs-bad,#c0392b)" />
			<g transform={`translate(${bx},${by})`}>
				<rect x={-24} y={-11} width={48} height={22} rx={11} fill="var(--fs-bad,#c0392b)" opacity={0.92} />
				<text x={0} y={0} fontSize={12} textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight={700}>{d.toFixed(1)}°</text>
			</g>
			{/* hover 读数气泡：悬停哪一环就报该环在该角度的读数（盘心下方固定位，不跟指针跑、不遮环） */}
			{hover ? (()=>{
				const t1 = `${hover.label}　${hover.deg.toFixed(1)}°`;
				const t2 = hover.cell ? `${hover.cell.label}${hover.cell.positional ? ` · ${hover.cell.positional}` : ''}${hover.cell.nayin ? ` · ${hover.cell.nayin.name}` : ''}${hover.cell.kong ? ' · 空亡' : ''}` : '—';
				const w = Math.max(t1.length, t2.length) * 13 + 26;
				return (
					<g pointerEvents="none" transform={`translate(${cx},${cy + R * 0.34})`}>
						<rect x={-w / 2} y={-19} width={w} height={40} rx={10}
							fill="var(--horosa-surface-raised,rgba(255,255,255,.96))" stroke="var(--fs-gold,#c0883a)" strokeWidth={1} />
						<text x={0} y={-6} fontSize={12} textAnchor="middle" fill="var(--fs-muted,#9aa)">{t1}</text>
						<text x={0} y={12} fontSize={13.5} textAnchor="middle" fontWeight={760}
							fill={hover.cell && hover.cell.jx === 'bad' ? 'var(--fs-bad,#c0392b)' : (hover.cell && hover.cell.jx === 'good' ? 'var(--fs-good,#2e9c5a)' : 'var(--fs-text,#888)')}>{t2}</text>
						{hover.approx ? <text x={0} y={30} fontSize={10.5} textAnchor="middle" fill="var(--fs-muted,#9aa)">等分示意·非盈缩实度</text> : null}
					</g>
				);
			})() : null}
		</svg>
	);
}

export { NEEDLE_OFFSET };
