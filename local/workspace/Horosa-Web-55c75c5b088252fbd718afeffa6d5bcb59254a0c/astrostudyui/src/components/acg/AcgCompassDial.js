import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';

// 本地空间罗盘盘面(§5.4):右侧宽面板(左盘右表)· 天球方位-高度投影 —— 方位=角(N顶东为正顺时针),
// 高度=半径(天顶在圆心、地平在中圈、天底在外缘);同方位不同高度自然分到不同半径,再叠力导斥开算法+
// 引线回真位,彻底防重叠。纯渲染,用后端 lines.lsAz={az,alt}。
const PLANET_CN = {
	[AstroConst.SUN]: '太阳', [AstroConst.MOON]: '月亮', [AstroConst.MERCURY]: '水星', [AstroConst.VENUS]: '金星',
	[AstroConst.MARS]: '火星', [AstroConst.JUPITER]: '木星', [AstroConst.SATURN]: '土星', [AstroConst.URANUS]: '天王星',
	[AstroConst.NEPTUNE]: '海王星', [AstroConst.PLUTO]: '冥王星', [AstroConst.CHIRON]: '凯龙星',
	[AstroConst.DARKMOON]: '莉莉丝', [AstroConst.PURPLE_CLOUDS]: '紫炁',
	[AstroConst.CERES]: '谷神星', [AstroConst.PALLAS]: '智神星', [AstroConst.JUNO]: '婚神星', [AstroConst.VESTA]: '灶神星', [AstroConst.ERIS]: '阋神星',
};
function glyph(k) { return (AstroText.AstroMsg && AstroText.AstroMsg[k]) || ''; }
// 按标记底色亮度选字色(深底白字/浅底深字),保证 glyph 高对比且无需描边。
function textOn(hex) {
	const c = String(hex || '').replace('#', '');
	if (c.length < 6) return '#fff';
	const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#1a1206' : '#fff';
}
const DIRS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];

class AcgCompassDial extends Component {
	render() {
		const { planets, colors, lineVisible, onClose } = this.props;
		if (!planets) return null;
		const H = typeof this.props.height === 'number' ? Math.max(this.props.height, 420) : 660;
		const dark = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-horosa-appearance') === 'dark');
		const ring = dark ? '#5b4b2c' : '#9a7b3f';
		const ringSoft = dark ? '#3d3320' : '#c6ab74';
		const txt = dark ? '#cabb92' : '#463919';
		const tickCol = dark ? '#8a7640' : '#7d6329';
		const faint = dark ? 'rgba(202,187,146,0.55)' : 'rgba(70,57,25,0.72)';
		const bg = dark ? '#0d1119' : '#faf7f0';
		const horizon = dark ? '#6e5a30' : '#8f7135';

		// SVG viewBox 固定 420×420,CSS 缩放填满左侧盘区。方位=角,高度=半径(天顶圆心/地平中圈/天底外缘)。
		const VB = 420, C = VB / 2, R = 188;
		const rOfAlt = (alt) => R * (90 - alt) / 180;   // +90→0(天顶) 0→R/2(地平) −90→R(天底)
		const angPos = (deg, r) => { const t = (deg - 90) * Math.PI / 180; return [C + r * Math.cos(t), C + r * Math.sin(t)]; };

		const raw = Object.keys(planets).map((pk) => {
			const la = planets[pk].lines && planets[pk].lines.lsAz;
			if (!la || la.az === undefined) return null;
			if (typeof lineVisible === 'function' && !['mc', 'ic', 'asc', 'desc'].some((f) => lineVisible(pk, f))) return null;
			return { pk, az: la.az, alt: la.alt, above: la.alt >= 0, color: (colors && colors[pk]) || '#8a8a8a' };
		}).filter(Boolean);

		// 真位置(az角,alt半径)→ 力导斥开(保持近真位,markers 不叠)。
		const MR = 25;   // glyph 两两最小中心距(字盒~17×22 + 间隙,两两不叠)
		const DR = 21;   // glyph 到任一真位点的最小间距(须 ≥ 字盒半对角13.9 + 点半径2.6 + 余量,点绝不被 glyph 遮住)
		// 初始按黄金角微偏,给"离开自身点"确定方向(避免 glyph 起始压在自身点、d=0 退化)。
		const disp = raw.map((it, i) => { const [tx, ty] = angPos(it.az, rOfAlt(it.alt)); const a = i * 2.399963; return { ...it, tx, ty, x: tx + Math.cos(a) * 4, y: ty + Math.sin(a) * 4 }; });
		const dots = disp.map((it) => [it.tx, it.ty]);   // 全部真位点=固定障碍
		for (let iter = 0; iter < 240; iter++) {
			for (let i = 0; i < disp.length; i++) {
				for (let j = i + 1; j < disp.length; j++) {
					let dx = disp[j].x - disp[i].x, dy = disp[j].y - disp[i].y;
					let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
					if (d < MR) { const p = (MR - d) / 2 / d; dx *= p; dy *= p; disp[i].x -= dx; disp[i].y -= dy; disp[j].x += dx; disp[j].y += dy; }
				}
				// glyph–真位点 斥开(含自身点):任何点都不被 glyph 压住(点固定,只推 glyph)
				for (let k = 0; k < dots.length; k++) {
					let dx = disp[i].x - dots[k][0], dy = disp[i].y - dots[k][1];
					let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
					if (d < DR) { const p = (DR - d) / d; disp[i].x += dx * p; disp[i].y += dy * p; }
				}
				disp[i].x += (disp[i].tx - disp[i].x) * 0.035;
				disp[i].y += (disp[i].ty - disp[i].y) * 0.035;
				const rr = Math.sqrt((disp[i].x - C) ** 2 + (disp[i].y - C) ** 2);   // 夹在盘内
				if (rr > R - 6) { const k = (R - 6) / rr; disp[i].x = C + (disp[i].x - C) * k; disp[i].y = C + (disp[i].y - C) * k; }
			}
		}
		const listSorted = raw.slice().sort((a, b) => a.az - b.az);

		return (
			<div className="horosa-acg-dial-panel" style={{ position: 'absolute', right: 0, top: 0, width: '70%', minWidth: 840, height: H,
				background: bg, borderLeft: `1px solid ${ring}`, boxShadow: '-8px 0 30px rgba(0,0,0,0.24)',
				zIndex: 6, display: 'flex', flexDirection: 'column' }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px 8px', flex: '0 0 auto' }}>
					<span style={{ fontWeight: 600, fontSize: 15, color: txt, letterSpacing: '0.03em' }}>本地空间 · 罗盘盘面</span>
					<button onClick={onClose} aria-label="关闭" style={{ width: 30, height: 30, borderRadius: 7, cursor: 'pointer',
						border: `1px solid ${ring}`, background: 'transparent', color: txt, fontSize: 17, lineHeight: '26px', padding: 0 }}>×</button>
				</div>
				<div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0 }}>
					{/* 左:大罗盘(填满列,尽量放大到全高) */}
					<div style={{ flex: '3 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 6px 8px' }}>
						<svg viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
							<defs>
								<radialGradient id="acgdial-bg" cx="50%" cy="50%" r="50%">
									<stop offset="0%" stopColor={dark ? 'rgba(215,173,105,0.06)' : 'rgba(215,173,105,0.12)'} />
									<stop offset="70%" stopColor="transparent" />
								</radialGradient>
							</defs>
							<circle cx={C} cy={C} r={R} fill="url(#acgdial-bg)" stroke={ring} strokeWidth="1.4" />
							<circle cx={C} cy={C} r={R / 2} fill="none" stroke={horizon} strokeWidth="1.1" strokeDasharray="4,3" opacity="0.85" />
							<circle cx={C} cy={C} r={R * 0.25} fill="none" stroke={ringSoft} strokeWidth="0.7" />
							<circle cx={C} cy={C} r={R * 0.75} fill="none" stroke={ringSoft} strokeWidth="0.6" strokeDasharray="1,4" opacity="0.6" />
							{/* 度数刻度 */}
							{Array.from({ length: 72 }, (_, i) => i * 5).map((deg) => {
								const major = deg % 30 === 0;
								const [x1, y1] = angPos(deg, R);
								const [x2, y2] = angPos(deg, R - (major ? 11 : 5));
								return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tickCol} strokeWidth={major ? 1 : 0.5} opacity={major ? 0.9 : 0.45} />;
							})}
							{Array.from({ length: 12 }, (_, i) => i * 30).map((deg) => {
								const [x, y] = angPos(deg, R - 22);
								return <text key={deg} x={x} y={y + 3.5} fontSize="10" fill={tickCol} textAnchor="middle" opacity="0.75">{deg}°</text>;
							})}
							{DIRS.map(([lbl, az]) => {
								const [xo, yo] = angPos(az, R + 15);
								const card = az % 90 === 0;
								return (
									<g key={lbl}>
										<line x1={angPos(az, 0)[0]} y1={angPos(az, 0)[1]} x2={angPos(az, R)[0]} y2={angPos(az, R)[1]} stroke={ring} strokeWidth={card ? 0.7 : 0.3} opacity={card ? 0.45 : 0.28} />
										<text x={xo} y={yo + 5} fontSize={card ? 17 : 12.5} fill={txt} textAnchor="middle" fontWeight={card ? 700 : 500}>{lbl}</text>
									</g>
								);
							})}
							<circle cx={C} cy={C} r="2.4" fill={horizon} />
							<text x={C} y={C - 8} fontSize="8.5" fill={faint} textAnchor="middle">天顶</text>
							<text x={angPos(0, R / 2)[0]} y={angPos(0, R / 2)[1] - 4} fontSize="8.5" fill={faint} textAnchor="middle">地平</text>
							{/* 引线(底) */}
							{disp.map((it) => (
								<line key={'l' + it.pk} x1={it.x} y1={it.y} x2={it.tx} y2={it.ty} stroke={it.color} strokeWidth="0.8" opacity="0.4" />
							))}
							{/* glyph(中)—本体色填充,已被力导挪离所有真位点 */}
							{disp.map((it) => (
								<text key={'g' + it.pk} x={it.x} y={it.y} fontSize="21" fill={it.color} opacity={it.above ? 1 : 0.55}
									textAnchor="middle" dominantBaseline="central" style={{ fontFamily: AstroConst.AstroFont }}>
									{glyph(it.pk)}
									<title>{`${PLANET_CN[it.pk] || it.pk} · 罗盘方位 ${it.az.toFixed(1)}° · 地平高度 ${it.alt.toFixed(1)}°`}</title>
								</text>
							))}
							{/* 真位点(顶,加 bg 光环,永不被 glyph 遮住) */}
							{disp.map((it) => (
								<circle key={'d' + it.pk} cx={it.tx} cy={it.ty} r="2.6" fill={it.color} opacity={it.above ? 0.95 : 0.55}
									stroke={bg} strokeWidth="0.9" />
							))}
						</svg>
					</div>
					{/* 右:方位读数表 */}
					<div style={{ flex: '0 0 auto', width: 232, overflowY: 'auto', padding: '8px 16px 16px', borderLeft: `1px solid ${ringSoft}` }}>
						<div style={{ fontSize: 12.5, fontWeight: 600, color: txt, margin: '2px 0 8px', opacity: 0.9 }}>方位读数</div>
						<div style={{ fontSize: 10.5, color: faint, margin: '0 0 8px', lineHeight: 1.5 }}>方位=罗盘度(N=0/E=90);↑地平上·↓地平下 + 高度。</div>
						{listSorted.map((it) => (
							<div key={it.pk} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '5px 0',
								borderBottom: `1px solid ${dark ? 'rgba(202,187,146,0.1)' : 'rgba(107,90,52,0.09)'}` }}>
								<span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
									background: it.color, opacity: it.above ? 1 : 0.5 }} />
								<span style={{ fontFamily: AstroConst.AstroFont, fontSize: 14, color: it.color, width: 16, textAlign: 'center' }}>{glyph(it.pk)}</span>
								<span style={{ color: txt, flex: 1 }}>{PLANET_CN[it.pk] || it.pk}</span>
								<span style={{ color: txt, opacity: 0.78, fontVariantNumeric: 'tabular-nums' }}>{it.az.toFixed(0)}° {it.alt >= 0 ? '↑' : '↓'}{Math.abs(it.alt).toFixed(0)}°</span>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}
}

export default AcgCompassDial;
