// 双黄道(Michon)主图:外圈回归十二座、内圈恒星十二座(相对回归错开岁差),两圈之间的窄环按叠合段着色
// (叠合落在某一谐波族 = 金,无族 = 灰);往里依次是宫位数字圈、守护星(字形 + 座内度数,按字形大小沿圈避让不重叠)、
// 落点圈与金弦(落在族内的叠合在它两颗守护星之间连一条弦)。宫线只画在宫位圈到落点圈之间,不穿过中心;ASC / MC 两条轴加粗并标注。
// 上升在左、黄经逆时针增大(与盘面同向)。图例写在右栏「叠合」卡的副标题里(盘面四角不放字,免得压到外环)。只用主题 CSS 变量着色,切明暗自动跟随,不需要另挂重画。
import React from 'react';
import { watchChartAppearance } from '../../utils/chartDrawGuard';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { MICHON_FAMILY_LABELS, pointName } from '../../utils/directedFigures';

const norm = (x)=>(((x % 360) + 360) % 360);
const ACCENT = 'var(--horosa-accent)';
const ACCENT_STRONG = 'var(--horosa-accent-strong)';
const DARK_SIGN_FILL_OPACITY = 0.18;   // 与主盘(AstroChartCircle)座扇区同口径

// 调色板只在绘制时读(合同:不许模块级 / 实例字段烘焙)
function palette(){
	const c = AstroConst.AstroColor || {};
	const bg = c.ChartBackgroud || '#ffffff';
	const hex = `${bg}`.replace('#', '');
	const lum = hex.length >= 6 ? (0.2126 * parseInt(hex.slice(0, 2), 16) + 0.7152 * parseInt(hex.slice(2, 4), 16) + 0.0722 * parseInt(hex.slice(4, 6), 16)) : 255;
	const dark = lum < 80;
	return {
		bg,
		dark,
		stroke: c.Stroke || '#8a7a5a',
		signFill: (sid)=>((c.SignFill && c.SignFill[sid]) || 'transparent'),
		signInk: (sid)=>c[sid] || c.Stroke,
		planetInk: (id)=>c[id] || c.Stroke,
		fillOpacity: dark ? DARK_SIGN_FILL_OPACITY : 1,
	};
}

function glyphOf(id){ return (AstroText.AstroMsg && AstroText.AstroMsg[id]) || ''; }

// 把 [a, b](黄经,a→b 逆时针)切成环段路径
function bandPath(pt, a, b, r0, r1){
	const span = norm(b - a) || 360;
	const large = span > 180 ? 1 : 0;
	const [x0, y0] = pt(a, r1);
	const [x1, y1] = pt(a + span, r1);
	const [x2, y2] = pt(a + span, r0);
	const [x3, y3] = pt(a, r0);
	// 屏幕坐标 y 向下:黄经逆时针增大 = SVG 逆时针 = sweep-flag 0
	return `M${x0},${y0} A${r1},${r1} 0 ${large} 0 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 1 ${x3},${y3} Z`;
}

// 字形沿圈避让:按黄经排好,相邻间隔不足 minGap 度就向两侧对称推开,反复几轮直到都分开
function spread(items, minGap){
	const s = items.map((it)=>({ ...it, at: norm(it.lon) })).sort((a, b)=>a.at - b.at);
	if(s.length < 2){ return s; }
	for(let pass = 0; pass < 40; pass += 1){
		let moved = false;
		for(let i = 0; i < s.length; i += 1){
			const a = s[i];
			const b = s[(i + 1) % s.length];
			const gap = norm(b.at - a.at);
			if(gap < minGap - 0.01){
				const push = (minGap - gap) / 2;
				a.at = norm(a.at - push);
				b.at = norm(b.at + push);
				moved = true;
			}
		}
		if(!moved){ break; }
	}
	return s;
}

export default function MichonDualRing({ result, size, height }){
	const [, bump] = React.useReducer((x)=>x + 1, 0);
	React.useEffect(()=>watchChartAppearance(()=>bump()), []);   // 切明暗:调色板换了,整张重渲染
	const P = palette();
	const LINE = P.stroke;
	const TEXT = P.stroke;
	const SOFT = P.stroke;
	// 字形与度数的底色描边:线穿过时字仍清楚(paint-order 先描边后填色)
	const halo = { paintOrder: 'stroke', stroke: P.bg, strokeWidth: 3, strokeLinejoin: 'round' };
	const r = result || {};
	const w = size;
	const h = height || size;
	const cx = w / 2;
	const cy = h / 2;
	const R = Math.max(Math.min(w, h) / 2 - 14, 80);
	const ay = Number(r.ayanamsa) || 0;
	const cusps = Array.isArray(r.cusps) ? r.cusps.map(Number) : [];
	const asc = cusps.length ? norm(cusps[0] + (r.equalHouses ? 15 : 0)) : 0;
	const mc = !r.equalHouses && cusps.length >= 10 ? cusps[9] : null;
	const pt = (lon, rad)=>{
		const t = Math.PI + (norm(lon) - asc) * Math.PI / 180;
		return [+(cx + rad * Math.cos(t)).toFixed(2), +(cy - rad * Math.sin(t)).toFixed(2)];
	};
	// 半径层次(外 → 内)
	const rTo = R;
	const rTi = R * 0.86;
	const rSo = R * 0.83;
	const rSi = R * 0.69;
	const rHouse = R * 0.635;
	const rHouseIn = R * 0.585;
	const rPl = R * 0.50;
	const rDeg = R * 0.415;
	const rIn = R * 0.355;
	const fs = Math.max(Math.round(R * 0.07), 12);
	const sups = Array.isArray(r.superpositions) ? r.superpositions : [];
	const planets = Array.isArray(r.planets) ? r.planets : [];
	const lonOf = {};
	planets.forEach((p)=>{ lonOf[p.id] = Number(p.lon); });
	// 最小角间隔 = 字形宽(含座内度数)对应的圆心角
	const minGap = (fs * 1.55) / rPl * 180 / Math.PI;
	const placed = spread(planets.map((p)=>({ id: p.id, lon: Number(p.lon) })), minGap);
	const lit = sups.filter((s)=>s.family && s.family !== 'no');

	const signs = (offset, r0, r1, keyPfx, opacityScale)=>AstroConst.LIST_SIGNS.map((sid, k)=>{
		const a = 30 * k + offset;
		const [lx, ly] = pt(a + 15, (r0 + r1) / 2);
		const [bx0, by0] = pt(a, r0);
		const [bx1, by1] = pt(a, r1);
		return (
			<g key={`${keyPfx}${k}`}>
				<path d={bandPath(pt, a, a + 30, r0, r1)} style={{ fill: P.signFill(sid), fillOpacity: P.fillOpacity * opacityScale, stroke: 'none' }} />
				<line x1={bx0} y1={by0} x2={bx1} y2={by1} style={{ stroke: LINE, strokeWidth: 1 }} />
				<text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
					style={{ fontFamily: AstroConst.AstroFont, fontSize: fs * 1.1, fill: P.signInk(sid), opacity: opacityScale < 1 ? 0.78 : 1 }}>
					<title>{(AstroText.AstroTxtMsg && AstroText.AstroTxtMsg[sid]) || sid}</title>
					{glyphOf(sid)}
				</text>
			</g>
		);
	});

	// 叠合段:回归第 t 座与恒星第 s 座的交集(岁差≈25° 时是回归座的前 25° 左右)
	const seams = sups.map((s)=>{
		const a0 = 30 * Number(s.tropicalSign);
		const b0 = 30 * Number(s.siderealSign) + ay;
		const from = norm(b0 - a0) < 30 ? b0 : a0;
		const to = norm(b0 - a0) < 30 ? a0 + 30 : b0 + 30;
		const on = s.family && s.family !== 'no';
		const label = `叠合 ${s.n}:${MICHON_FAMILY_LABELS[s.family] || '无族'}(${pointName(s.p1)}—${pointName(s.p2)})`;
		return (
			<path key={`seam${s.n}`} d={bandPath(pt, from, to, rSo + 0.5, rTi - 0.5)} style={{ fill: on ? ACCENT : P.stroke, fillOpacity: on ? 1 : 0.22, stroke: 'none' }}>
				<title>{label}</title>
			</path>
		);
	});

	const chords = lit.map((s)=>{
		if(!Number.isFinite(lonOf[s.p1]) || !Number.isFinite(lonOf[s.p2])){ return null; }
		const [x1, y1] = pt(lonOf[s.p1], rIn);
		const [x2, y2] = pt(lonOf[s.p2], rIn);
		return (
			<line key={`ch${s.n}`} x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: ACCENT, strokeWidth: 1.6, opacity: 0.85 }}>
				<title>{`叠合 ${s.n}:${pointName(s.p1)}—${pointName(s.p2)} ${MICHON_FAMILY_LABELS[s.family] || ''}`}</title>
			</line>
		);
	});

	const houseMarks = cusps.map((c, i)=>{
		const [x0, y0] = pt(c, rIn);
		const [x1, y1] = pt(c, rSi);
		const axis = i === 0 || (mc !== null && i === 9);
		const nextC = Number.isFinite(cusps[(i + 1) % 12]) ? cusps[(i + 1) % 12] : c + 30;
		const [nx, ny] = pt(c + norm(nextC - c) / 2, (rHouse + rHouseIn) / 2);
		return (
			<g key={`h${i}`}>
				<line x1={x0} y1={y0} x2={x1} y2={y1} style={{ stroke: axis ? TEXT : LINE, strokeWidth: axis ? 1.6 : 0.9, opacity: axis ? 0.75 : 1 }} />
				<text x={nx} y={ny} textAnchor="middle" dominantBaseline="central" style={{ fontSize: Math.max(fs * 0.62, 11), fill: SOFT, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</text>
			</g>
		);
	});

	const axisLabel = (lon, text)=>{
		if(!Number.isFinite(lon)){ return null; }
		// 标在轴线外端(贴内环、宫位数字圈外),不压中部字形
		const [x, y] = pt(lon, (rSi + rHouse) / 2 + R * 0.012);
		return <text key={`ax${text}`} x={x} y={y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: Math.max(fs * 0.6, 11), fontWeight: 700, fill: ACCENT_STRONG, letterSpacing: '0.04em', ...halo }}>{text}</text>;
	};

	const planetMarks = placed.map((p)=>{
		const [tx0, ty0] = pt(p.lon, rSi);
		const [tx1, ty1] = pt(p.lon, rSi - R * 0.035);
		const [gx, gy] = pt(p.at, rPl);
		const [dgx, dgy] = pt(p.at, rDeg);
		const [dx, dy] = pt(p.lon, rIn);
		const deg = Math.floor(norm(p.lon) % 30);
		return (
			<g key={`p${p.id}`}>
				<title>{`${pointName(p.id)} ${(norm(p.lon) % 30).toFixed(1)}°`}</title>
				<line x1={tx0} y1={ty0} x2={tx1} y2={ty1} style={{ stroke: P.planetInk(p.id), strokeWidth: 1.4 }} />
				<circle cx={dx} cy={dy} r={2.6} style={{ fill: P.planetInk(p.id) }} />
				<text x={gx} y={gy} textAnchor="middle" dominantBaseline="central"
					style={{ fontFamily: AstroConst.AstroFont, fontSize: fs * 1.2, fill: P.planetInk(p.id), ...halo }}>
					{glyphOf(p.id)}
				</text>
				<text x={dgx} y={dgy} textAnchor="middle" dominantBaseline="central"
					style={{ fontSize: Math.max(fs * 0.58, 10), fill: P.planetInk(p.id), fontVariantNumeric: 'tabular-nums', ...halo }}>
					{`${deg}°`}
				</text>
			</g>
		);
	});

	return (
		<svg width={w} height={h} style={{ display: 'block' }}>
			<circle cx={cx} cy={cy} r={rTo} style={{ fill: P.bg, stroke: LINE }} />
			{signs(0, rTi, rTo, 't', 1)}
			{seams}
			{signs(ay, rSi, rSo, 's', 0.55)}
			<circle cx={cx} cy={cy} r={rTi} style={{ fill: 'none', stroke: LINE }} />
			<circle cx={cx} cy={cy} r={rSo} style={{ fill: 'none', stroke: LINE }} />
			<circle cx={cx} cy={cy} r={rSi} style={{ fill: 'none', stroke: LINE }} />
			<circle cx={cx} cy={cy} r={rIn} style={{ fill: 'none', stroke: LINE, strokeDasharray: '2 4' }} />
			{houseMarks}
			{chords}
			{planetMarks}
			{axisLabel(asc, 'ASC')}
			{axisLabel(mc, 'MC')}
		</svg>
	);
}
