// 黄道制主图:外圈画所选版本的不等分段,内圈画回归十二座作对照,两圈之间是各星的落点。
// 上升在左、黄经逆时针增大,与盘面同向。调色板只在绘制时读;字形沿圈避让走 utils/circleSpread 单源。
import React from 'react';
import { watchChartAppearance } from '../../utils/chartDrawGuard';
import { spreadAngles } from '../../utils/circleSpread';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { astroSymbolStyle } from '../astro/AstroExtraCommon';

const norm = (x)=>(((x % 360) + 360) % 360);
const SIGN_IDS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
// 不等分段的中文名 → 十二座 id(取同座底色);蛇夫 / 鲸鱼不在十二座里,用线色淡淡铺一层(8%,明暗两套都不成色块)
const SIGN_OF_NAME = { 白羊: 'Aries', 金牛: 'Taurus', 双子: 'Gemini', 巨蟹: 'Cancer', 狮子: 'Leo', 处女: 'Virgo', 天秤: 'Libra', 天蝎: 'Scorpio', 射手: 'Sagittarius', 摩羯: 'Capricorn', 水瓶: 'Aquarius', 双鱼: 'Pisces' };
const ACCENT = 'var(--horosa-accent)';
const MARGIN = 16;           // 盘外留白:外圈不贴栏边
const NARROW_SEGMENT = 12;   // 度;十三星座的天蝎段只有六七度,字要小一号才不压邻段
const RING_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node'];
const DARK_FILL_OPACITY = 0.18;   // 与主盘座扇区同口径

function palette(){
	const c = AstroConst.AstroColor || {};
	const bg = c.ChartBackgroud || '#ffffff';
	const hex = `${bg}`.replace('#', '');
	const lum = hex.length >= 6 ? (0.2126 * parseInt(hex.slice(0, 2), 16) + 0.7152 * parseInt(hex.slice(2, 4), 16) + 0.0722 * parseInt(hex.slice(4, 6), 16)) : 255;
	const dark = lum < 80;
	return {
		stroke: c.Stroke || '#8a7a5a',
		planetInk: (id)=>c[id] || c.Stroke,
		signInk: (id)=>c[id] || c.Stroke,
		signFill: (id)=>((id && c.SignFill && c.SignFill[id]) || c.Stroke || 'transparent'),
		fillOpacity: dark ? DARK_FILL_OPACITY : 0.55,
	};
}

function bandPath(pt, start, length, r0, r1){
	const end = start + length;
	const large = length > 180 ? 1 : 0;
	const [x0, y0] = pt(start, r1);
	const [x1, y1] = pt(end, r1);
	const [x2, y2] = pt(end, r0);
	const [x3, y3] = pt(start, r0);
	return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 0 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 1 ${x3} ${y3}Z`;
}

export default class ZodiacRing extends React.Component {
	componentDidMount(){ this._detachAppearance = watchChartAppearance(()=>this.forceUpdate()); }

	componentWillUnmount(){ if(this._detachAppearance){ this._detachAppearance(); } }

	render(){
		const { wheel, rows, asc, size, versionLabel, galacticCenter } = this.props;
		const c = palette();
		const center = size / 2;
		const outer = Math.max(size / 2 - MARGIN, 60);
		const band = outer * 0.13;
		const inner = outer - band;
		const tropicalOuter = outer * 0.66;
		const tropicalInner = tropicalOuter - outer * 0.1;
		const glyphR = (inner + tropicalOuter) / 2;
		const origin = Number.isFinite(asc) ? asc : 0;
		// 上升点在 9 点方向,黄经增大逆时针
		const pt = (lon, r)=>{
			const a = (180 + norm(lon - origin)) * Math.PI / 180;
			return [center + r * Math.cos(a), center - r * Math.sin(a)];
		};
		const labelAt = (lon, r, text, fill, fontSize, key, glyph, extra)=>{
			const [x, y] = pt(lon, r);
			return <text key={key} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fill={fill} style={glyph ? { fontFamily: astroSymbolStyle.fontFamily } : undefined} {...extra}>{text}</text>;
		};
		const segFont = (len)=>(len < NARROW_SEGMENT ? Math.min(13, Math.max(10, band * 0.2)) : Math.min(17, Math.max(12, band * 0.26)));
		const bodies = (rows || []).filter((row)=>RING_BODIES.indexOf(row.id) >= 0 && Number.isFinite(row.lon));
		const glyphSize = Math.min(24, Math.max(14, outer * 0.05));
		const minGap = (glyphSize * 1.25) / glyphR * 180 / Math.PI;
		const shownAt = spreadAngles(bodies.map((row)=>Number(row.lon)), minGap);
		return (
			<svg className="horosa-plain-text-board" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }} data-zodiac-ring="1">
				{/* 外圈:所选版本的不等分段 */}
				{(wheel || []).map((seg, i)=>{
					const sid = SIGN_OF_NAME[seg.sign];
					return (
						<g key={`seg${i}`}>
							<path d={bandPath(pt, seg.start, seg.length, inner, outer)} fill={c.signFill(sid)} fillOpacity={sid ? c.fillOpacity : 0.08} stroke={c.stroke} strokeWidth={0.8} strokeOpacity={0.7}>
								<title>{`${seg.sign} · ${Number(seg.start).toFixed(2)}° 起 · 长 ${Number(seg.length).toFixed(2)}°`}</title>
							</path>
							{labelAt(seg.start + seg.length / 2, (inner + outer) / 2, seg.sign, sid ? c.signInk(sid) : 'var(--horosa-text)', segFont(seg.length), `n${i}`, false, { letterSpacing: '0.08em' })}
						</g>
					);
				})}
				<circle cx={center} cy={center} r={outer} fill="none" stroke={c.stroke} strokeOpacity={0.9} />
				<circle cx={center} cy={center} r={inner} fill="none" stroke={c.stroke} strokeOpacity={0.9} />
				{/* 内圈:回归十二座对照 */}
				{SIGN_IDS.map((id, i)=>(
					<g key={id}>
						<path d={bandPath(pt, i * 30, 30, tropicalInner, tropicalOuter)} fill={c.signFill(id)} fillOpacity={c.fillOpacity * 0.8} stroke={c.stroke} strokeWidth={0.6} strokeOpacity={0.6} />
						{labelAt(i * 30 + 15, (tropicalInner + tropicalOuter) / 2, (AstroText.AstroMsg && AstroText.AstroMsg[id]) || '', c.signInk(id), Math.min(20, Math.max(11, outer * 0.042)), `s${id}`, true)}
					</g>
				))}
				<circle cx={center} cy={center} r={tropicalInner} fill="none" stroke={c.stroke} strokeOpacity={0.5} strokeDasharray="2 4" />
				{/* 上升:左侧水平短线 + 标注 */}
				{(()=>{
					const [x0, y0] = pt(origin, tropicalInner);
					const [x1, y1] = pt(origin, tropicalInner - outer * 0.07);
					const [lx, ly] = pt(origin, tropicalInner - outer * 0.12);
					return (
						<g data-zodiac-asc="1">
							<line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ACCENT} strokeWidth={1.6} />
							<text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(13, Math.max(10, outer * 0.024))} fontWeight={700} fill={ACCENT} letterSpacing="0.06em">ASC</text>
						</g>
					);
				})()}
				{/* 各星:真位在外圈内沿与内圈外沿各一刻度,字形按圈避让后放在两圈之间,挪开时用细线指回真位 */}
				{bodies.map((row, i)=>{
					const lon = Number(row.lon);
					const at = norm(shownAt[i]);
					const [ox0, oy0] = pt(lon, inner);
					const [ox1, oy1] = pt(lon, inner - outer * 0.035);
					const [ix0, iy0] = pt(lon, tropicalOuter);
					const [ix1, iy1] = pt(lon, tropicalOuter + outer * 0.03);
					const [gx, gy] = pt(at, glyphR);
					const [lx0, ly0] = pt(lon, inner - outer * 0.04);
					const moved = Math.abs(((at - norm(lon) + 540) % 360) - 180) > 0.5;
					const glyph = (AstroText.AstroMsg && AstroText.AstroMsg[row.id]) || '';
					const ink = c.planetInk(row.id);
					return (
						<g key={row.id}>
							<title>{`${(AstroText.AstroMsgCN && AstroText.AstroMsgCN[row.id]) || row.id} 回归黄经 ${lon.toFixed(2)}°`}</title>
							<line x1={ox0} y1={oy0} x2={ox1} y2={oy1} stroke={ink} strokeWidth={1.6} />
							<line x1={ix0} y1={iy0} x2={ix1} y2={iy1} stroke={ink} strokeWidth={1.2} />
							{moved ? <line x1={lx0} y1={ly0} x2={gx} y2={gy} stroke={ink} strokeWidth={0.6} strokeOpacity={0.6} /> : null}
							<text x={gx} y={gy} textAnchor="middle" dominantBaseline="central" fontSize={glyphSize} fill={ink} style={{ fontFamily: astroSymbolStyle.fontFamily }}>{glyph}</text>
						</g>
					);
				})}
				{Number.isFinite(galacticCenter) ? (()=>{
					const [x0, y0] = pt(galacticCenter, outer);
					const [x1, y1] = pt(galacticCenter, inner);
					const [lx, ly] = pt(galacticCenter, inner - outer * 0.06);
					return (
						<g data-zodiac-gc="1">
							<line x1={x0} y1={y0} x2={x1} y2={y1} stroke={ACCENT} strokeWidth={2.2}><title>银心</title></line>
							<text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(12, Math.max(10, outer * 0.022))} fill={ACCENT}>银心</text>
						</g>
					);
				})() : null}
				{versionLabel ? (
					<g>
						<text x={center} y={center - outer * 0.04} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(24, Math.max(14, outer * 0.042))} fontWeight={600} fill="var(--horosa-text)" letterSpacing="0.06em">{versionLabel}</text>
						<text x={center} y={center + outer * 0.045} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(13, Math.max(11, outer * 0.024))} fill="var(--horosa-text-soft)">外圈所选版本 · 内圈回归十二座</text>
					</g>
				) : null}
			</svg>
		);
	}
}
