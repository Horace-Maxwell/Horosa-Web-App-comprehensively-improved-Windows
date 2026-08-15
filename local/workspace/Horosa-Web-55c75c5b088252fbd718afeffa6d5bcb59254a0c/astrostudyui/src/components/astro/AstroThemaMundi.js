// G5 Thema Mundi 世界盘(希腊化占星):固定范式盘——上升 15°巨蟹,七政各居本垣 15°。
// 纯前端静态常量盘(不参与任何计算),古典 tab 末尾「世界盘」开关卡;含义三条出自第一性原理。中性表述。
import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { THEMA_MUNDI, SIGN_EN, SIGN_CN, PLANET_CN, parseSignDegree } from '../../divination/data/hellenisticData';
import { astroSymbol } from './AstroExtraCommon';
// 范式位派生与三条含义文案住 utils/astroClassicalDerived 单源(AI 快照 [古典·世界范式盘] 段同引)。
import { themaPositions, THEMA_MUNDI_BULLETS } from '../../utils/astroClassicalDerived';

const MUTED = 'var(--horosa-muted, #999)';
const BORDER = 'var(--horosa-border, rgba(120,120,120,0.28))';
const GOLD = 'var(--horosa-gold, #b8860b)';
const ASTRO_FONT = AstroConst.AstroFont;
// SVG <text> 不能嵌 HTML <span>,须直接取 ywastro 原始 glyph 字符 + 在 text 上设字体。
function glyphOf(id){ return (AstroText.AstroMsg && AstroText.AstroMsg[id]) || ''; }

// 静态范式盘 SVG:上升(15°巨蟹)置于左(9 点钟),黄经递增逆时针。
function ThemaWheel({ size = 300 }){
	const cx = size / 2;
	const cy = size / 2;
	const rOuter = size / 2 - 6;
	const rSignRing = rOuter - 22;
	const rPlanet = rSignRing - 30;
	const ascLon = (parseSignDegree(THEMA_MUNDI.ascendant) || { lon: 105 }).lon;
	// 黄经 → SVG 坐标(上升在 180°/左,黄经增逆时针;SVG y 向下故取负角)。
	const pt = (lon, r)=>{
		const a = (180 + (lon - ascLon)) * Math.PI / 180;
		return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
	};
	const sectors = [];
	for(let i = 0; i < 12; i++){
		const startLon = i * 30;
		const a0 = pt(startLon, rOuter);
		const a1 = pt(startLon, rSignRing - 4);
		sectors.push(<line key={`div-${i}`} x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} stroke={BORDER} strokeWidth="1" />);
		const mid = pt(i * 30 + 15, (rOuter + rSignRing) / 2 + 2);
		sectors.push(
			<text key={`sg-${i}`} x={mid.x} y={mid.y} fontFamily={ASTRO_FONT} fontSize="14" textAnchor="middle" dominantBaseline="central" fill={i === 3 ? GOLD : 'var(--horosa-text, #333)'}>
				{glyphOf(SIGN_EN[i])}
			</text>
		);
	}
	const planets = themaPositions().map((p)=>{
		const q = pt(p.lon, rPlanet);
		return (
			<text key={p.planetEn} x={q.x} y={q.y} fontFamily={ASTRO_FONT} fontSize="16" textAnchor="middle" dominantBaseline="central" fill={GOLD}>
				{glyphOf(p.planetEn)}
			</text>
		);
	});
	const asc = pt(ascLon, rOuter);
	return (
		<svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block', margin: '0 auto' }}>
			<circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={BORDER} strokeWidth="1.2" />
			<circle cx={cx} cy={cy} r={rSignRing} fill="none" stroke={BORDER} strokeWidth="1" />
			<circle cx={cx} cy={cy} r={rPlanet + 14} fill="none" stroke={BORDER} strokeWidth="0.8" strokeDasharray="2 3" />
			{sectors}
			{planets}
			<line x1={asc.x} y1={asc.y} x2={cx} y2={cy} stroke={GOLD} strokeWidth="1.4" />
			<text x={asc.x - 4} y={asc.y - 6} fontSize="11" textAnchor="end" fill={GOLD}>ASC</text>
		</svg>
	);
}

class AstroThemaMundi extends Component{
	constructor(props){
		super(props);
		this.state = { open: false };
	}
	render(){
		const { open } = this.state;
		const positions = themaPositions();
		return (
			<div className="horosa-info-card horosa-classical-card">
				<div className="horosa-classical-card-title" style={{ cursor: 'pointer', justifyContent: 'space-between' }}
					onClick={()=>this.setState({ open: !open })}>
					<span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
						<span className="horosa-classical-zh">世界范式盘</span>
						<span className="horosa-classical-en">Thema Mundi</span>
					</span>
					<span style={{ color: MUTED, fontSize: 12, flex: '0 0 auto' }}>{open ? '收起 ▲' : '展开 ▼'}</span>
				</div>
				{open ? (
					<div style={{ marginTop: 8 }}>
						<div style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>
							希腊化占星范式盘:上升 15°巨蟹,七政各居本垣中点 15°。非天文实算,示尊贵/相位/宫位语义之第一性原理。
						</div>
						<ThemaWheel size={300} />
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: 4, fontSize: 12, margin: '6px 0' }}>
							{positions.map((p)=>(
								<div key={p.planetEn} style={{ border: `1px solid ${BORDER}`, borderRadius: 5, padding: '2px 6px' }}>
									<span style={{ marginRight: 4 }}>{astroSymbol(p.planetEn)}</span>
									{PLANET_CN[p.planetEn] || p.planetEn}：{SIGN_CN[p.signIndex]} {p.deg}°
								</div>
							))}
						</div>
						<ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
							{THEMA_MUNDI_BULLETS.map((b, i)=>(<li key={i}>{b}</li>))}
						</ul>
					</div>
				) : null}
			</div>
		);
	}
}

export default AstroThemaMundi;
