// 东亚诸术中栏图:随页签换图。藏占=八方八卦围九宫;蒙古=十二支环;算命学=三柱;九星=九宫飞星;洛书=身形九格;易卦=星与卦。
// 调色板只在绘制时读(随明暗主题重画)。
import React from 'react';
import { watchChartAppearance } from '../../utils/chartDrawGuard';
import * as AstroConst from '../../constants/AstroConst';
import { PARKHA, MEWA_COLOR, EAST_ASIA_BRANCHES, EAST_ASIA_ANIMALS, hexTrigrams, hexName, trigramName } from '../../utils/eastAsiaArts';

const ACCENT = 'var(--horosa-accent)';
const ZHI_LIST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];   // 每支一个整词
const VIEW = 600;
const C = VIEW / 2;

function palette(){
	const c = AstroConst.AstroColor || {};
	return { stroke: c.Stroke || '#8a7a5a', ink: c.Stroke || '#8a7a5a' };
}

const MEWA_FILL = { 白: '#f4f1e8', 黑: '#2a2a2a', 蓝: '#3b6db3', 绿: '#3e8f5a', 黄: '#d6b13c', 红: '#c2402f', 碧: '#2f8f8a', 赤: '#c2402f', 紫: '#7a4fa8' };
// 九星气学的星色(一白 二黑 三碧 四绿 五黄 六白 七赤 八白 九紫);藏式九宫用 MEWA_COLOR
const STAR_COLOR = { 1: '白', 2: '黑', 3: '碧', 4: '绿', 5: '黄', 6: '白', 7: '赤', 8: '白', 9: '紫' };
const LOSHU_PALACE = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];

function flyValue(center, palace){ return ((center - 1 + (palace - 5)) % 9 + 9) % 9 + 1; }

function NineGrid({ x, y, size, center, mark, pal, title, colors }){
	const cell = size / 3;
	return (
		<g>
			{title ? <text x={x + size / 2} y={y - 10} textAnchor="middle" fontSize={15} fill={pal.ink}>{title}</text> : null}
			{LOSHU_PALACE.map((row, r)=>row.map((palace, c)=>{
				const v = flyValue(center, palace);
				const color = (colors || MEWA_COLOR)[v];
				const hot = v === center || v === mark;
				return (
					<g key={`${r}-${c}`}>
						<rect x={x + c * cell} y={y + r * cell} width={cell} height={cell} fill="none" stroke={hot ? ACCENT : pal.stroke} strokeWidth={hot ? 2.4 : 1} />
						<circle cx={x + c * cell + cell * 0.22} cy={y + r * cell + cell * 0.22} r={cell * 0.08} fill={MEWA_FILL[color] || 'none'} stroke={pal.stroke} strokeWidth={0.6} />
						<text x={x + c * cell + cell / 2} y={y + r * cell + cell / 2} textAnchor="middle" dominantBaseline="central" fontSize={cell * 0.36} fill={hot ? ACCENT : pal.ink}>{v}</text>
						<text x={x + c * cell + cell / 2} y={y + r * cell + cell * 0.84} textAnchor="middle" fontSize={cell * 0.13} fill={pal.ink} opacity={0.75}>{color}</text>
					</g>
				);
			}))}
		</g>
	);
}

function tibetanBoard(model, pal){
	// 南在上(藏式八卦图惯例):离居上,顺时针 坤 兑 乾 坎 艮 震 巽
	// 外 285 / 内 170:带深 ≈106(按中线方向),两行字(卦名 26 + 方位五行 13)斜放在四个隅卦里也不碰斜边;
	// 内八边形边心距 157 > 九宫半对角 148.5,九宫不顶内框
	const R = 285;
	const r = 170;
	const yearKey = model.parkha.year && model.parkha.year.key;
	const dayKey = model.parkha.day && model.parkha.day.key;
	return (
		<g>
			{PARKHA.map((pk, i)=>{
				const a0 = (-90 + i * 45 - 22.5) * Math.PI / 180;
				const a1 = (-90 + i * 45 + 22.5) * Math.PI / 180;
				const am = (-90 + i * 45) * Math.PI / 180;
				const pts = [[C + R * Math.cos(a0), C + R * Math.sin(a0)], [C + R * Math.cos(a1), C + R * Math.sin(a1)], [C + r * Math.cos(a1), C + r * Math.sin(a1)], [C + r * Math.cos(a0), C + r * Math.sin(a0)]];
				const mx = pts.reduce((a, p)=>a + p[0], 0) / 4;
				const my = pts.reduce((a, p)=>a + p[1], 0) / 4;
				const hot = pk.key === yearKey;
				const day = pk.key === dayKey;
				return (
					<g key={pk.key}>
						<polygon points={pts.map((p)=>p.join(',')).join(' ')} fill={hot ? ACCENT : 'none'} fillOpacity={hot ? 0.18 : 0} stroke={hot || day ? ACCENT : pal.stroke} strokeWidth={hot ? 2.4 : (day ? 1.8 : 1)} strokeDasharray={day && !hot ? '6 4' : undefined} />
						{/* 两行字以带的几何中心(梯形四角平均)为中心上下对称排,dominantBaseline 定在字身中线,不靠基线猜偏移 */}
						<text x={mx} y={my - 12} textAnchor="middle" dominantBaseline="central" fontSize={26} fill={hot ? ACCENT : pal.ink}>{pk.gua}</text>
						<text x={mx} y={my + 17} textAnchor="middle" dominantBaseline="central" fontSize={13} fill={pal.ink} opacity={0.8}>{pk.dir} · {pk.element}</text>
					</g>
				);
			})}
			<NineGrid x={C - 105} y={C - 105} size={210} center={model.mewa.birth} mark={model.mewa.year} pal={pal} />
			<text x={C} y={VIEW - 12} textAnchor="middle" fontSize={12} fill={pal.ink} opacity={0.75}>{yearKey ? `实框 = ${model.flowYear} 年流年八卦 · ` : `${model.flowYear} 年早于出生,无流年八卦 · `}虚框 = 出生日八卦 · 九宫中宫为本命 {model.mewa.birth}</text>
		</g>
	);
}

function zurkhaiBoard(model, pal){
	const R = 230;
	const at = (i, rr)=>{ const a = (-90 + i * 30) * Math.PI / 180; return [C + rr * Math.cos(a), C + rr * Math.sin(a)]; };
	const yi = EAST_ASIA_BRANCHES.indexOf(model.zurkhai.yearZhi);
	const mi = EAST_ASIA_BRANCHES.indexOf(model.zurkhai.monthZhi);
	const [yx0, yy0] = at(yi, R - 40);
	const [mx0, my0] = at(mi, R - 40);
	// 连线两端收到支圈外沿(圈半径 30,再留 4):虚线不压圈里的支名与生肖
	const len = Math.hypot(mx0 - yx0, my0 - yy0) || 1;
	const ux = (mx0 - yx0) / len;
	const uy = (my0 - yy0) / len;
	const yx = yx0 + ux * 34;
	const yy = yy0 + uy * 34;
	const mx = mx0 - ux * 34;
	const my = my0 - uy * 34;
	return (
		<g>
			<circle cx={C} cy={C} r={R} fill="none" stroke={pal.stroke} />
			<circle cx={C} cy={C} r={R - 80} fill="none" stroke={pal.stroke} opacity={0.5} />
			{ZHI_LIST.map((zhi, i)=>{
				const [x, y] = at(i, R - 40);
				const hot = i === yi || i === mi;
				return (
					<g key={zhi}>
						<circle cx={x} cy={y} r={30} fill={hot ? ACCENT : 'none'} fillOpacity={hot ? 0.2 : 0} stroke={hot ? ACCENT : pal.stroke} strokeWidth={hot ? 2.2 : 1} />
						<text x={x} y={y - 4} textAnchor="middle" fontSize={22} fill={hot ? ACCENT : pal.ink}>{zhi}</text>
						<text x={x} y={y + 16} textAnchor="middle" fontSize={11} fill={pal.ink} opacity={0.8}>{EAST_ASIA_ANIMALS[i]}</text>
					</g>
				);
			})}
			{yi !== mi ? <line x1={yx} y1={yy} x2={mx} y2={my} stroke={ACCENT} strokeWidth={2} strokeDasharray="8 5" /> : null}
			<circle cx={C} cy={C} r={78} fill="var(--horosa-surface-solid, #14161b)" stroke={pal.stroke} strokeOpacity={0.4} />
			<text x={C} y={C - 12} textAnchor="middle" fontSize={20} fill={pal.ink}>年 {model.zurkhai.yearZhi} · 月 {model.zurkhai.monthZhi}</text>
			<text x={C} y={C + 22} textAnchor="middle" fontSize={34} fill={ACCENT}>{model.zurkhai.aspect}</text>
			<text x={C} y={C + 50} textAnchor="middle" fontSize={14} fill={pal.ink}>{model.zurkhai.relation}</text>
		</g>
	);
}

function sanmeiBoard(model, pal){
	const sm = model.sanmei;
	if(!sm){ return null; }
	const colW = 150;
	const x0 = C - colW * 1.5;
	const rows = [['天干', (p)=>p.gan], ['地支', (p)=>p.zhi], ['藏干', (p, i)=>sm.hidden[i].ruler || '—']];
	return (
		<g>
			{sm.pillars.map((p, i)=>(
				<g key={p.label}>
					<text x={x0 + colW * i + colW / 2} y={110} textAnchor="middle" fontSize={18} fill={pal.ink}>{p.label}柱</text>
					{rows.map(([label, get], r)=>{
						const v = get(p, i);
						const voidHit = r === 1 && sm.tenchusatsu.indexOf(v) >= 0;
						return (
							<g key={label}>
								<rect x={x0 + colW * i + 10} y={130 + r * 110} width={colW - 20} height={96} fill="none" stroke={voidHit ? ACCENT : pal.stroke} strokeWidth={voidHit ? 2.4 : 1} />
								<text x={x0 + colW * i + colW / 2} y={130 + r * 110 + 56} textAnchor="middle" dominantBaseline="central" fontSize={46} fill={r === 2 ? ACCENT : pal.ink}>{v}</text>
							</g>
						);
					})}
				</g>
			))}
			{rows.map(([label], r)=>(<text key={label} x={x0 - 6} y={130 + r * 110 + 52} textAnchor="end" fontSize={14} fill={pal.ink} opacity={0.8}>{label}</text>))}
			<text x={C} y={500} textAnchor="middle" fontSize={18} fill={pal.ink}>天中杀 <tspan fill={ACCENT}>{sm.tenchusatsu.join('')}</tspan> · 节入 {sm.prevJie} 后 {sm.daysAfterJie} 日</text>
		</g>
	);
}

function ninestarBoard(model, pal){
	const k = model.ninestar;
	if(!k){ return null; }
	return (
		<g>
			<NineGrid x={C - 210} y={C - 200} size={420} center={k.honmei} mark={k.getsumei} pal={pal} colors={STAR_COLOR} title={`本命星 ${k.honmeiName} 入中 · 月命星 ${k.getsumeiName}`} />
		</g>
	);
}

const BODY = [['leftShoulder', 'head', 'rightShoulder'], ['leftHand', 'chest', 'rightHand'], ['leftFoot', 'belly', 'rightFoot']];
function loshuBoard(model, pal){
	const ls = model.loshu[0];
	if(!ls){ return null; }
	if(ls.beforeBirth){
		return <text x={C} y={C} textAnchor="middle" fontSize={16} fill={pal.ink}>{ls.year} 年早于出生(公历生年 {model.facts.civil.year} 年),不排洛书流年</text>;
	}
	const byKey = {};
	ls.cells.forEach((c)=>{ byKey[c.key] = c; });
	const size = 420;
	const cell = size / 3;
	const x = C - size / 2;
	const y = C - size / 2 + 10;
	return (
		<g>
			<text x={C} y={y - 16} textAnchor="middle" fontSize={16} fill={pal.ink}>{ls.year} 年 · {ls.age} 岁 · 当年数 {ls.active}</text>
			{BODY.map((row, r)=>row.map((key, c)=>{
				const item = byKey[key];
				const hot = item && item.active;
				return (
					<g key={key}>
						<rect x={x + c * cell} y={y + r * cell} width={cell} height={cell} fill={hot ? ACCENT : 'none'} fillOpacity={hot ? 0.18 : 0} stroke={hot ? ACCENT : pal.stroke} strokeWidth={hot ? 2.4 : 1} />
						<text x={x + c * cell + cell / 2} y={y + r * cell + cell / 2} textAnchor="middle" dominantBaseline="central" fontSize={cell * 0.38} fill={hot ? ACCENT : pal.ink}>{item ? item.value : ''}</text>
						<text x={x + c * cell + cell / 2} y={y + r * cell + cell * 0.86} textAnchor="middle" fontSize={14} fill={pal.ink} opacity={0.8}>{item ? item.label : ''}</text>
					</g>
				);
			}))}
		</g>
	);
}

function HexGlyph({ x, y, w, num, pal, accent }){
	const t = hexTrigrams(num);
	if(!t){ return null; }
	const bits = [(t.lower >> 2) & 1, (t.lower >> 1) & 1, t.lower & 1, (t.upper >> 2) & 1, (t.upper >> 1) & 1, t.upper & 1];
	const color = accent ? ACCENT : pal.ink;
	return (
		<g>
			{bits.map((b, i)=>{
				const yy = y + (5 - i) * 9;
				return b
					? <rect key={i} x={x} y={yy} width={w} height={5} fill={color} />
					: <g key={i}><rect x={x} y={yy} width={w * 0.42} height={5} fill={color} /><rect x={x + w * 0.58} y={yy} width={w * 0.42} height={5} fill={color} /></g>;
			})}
		</g>
	);
}

const PLANET_CN = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };
function ichingBoard(model, pal){
	const rows = model.iching.rows;
	if(!rows.length){
		return <text x={C} y={C} textAnchor="middle" fontSize={16} fill={pal.ink}>先在「占星」页排出本命盘,易卦星盘读它的星位与宫位</text>;
	}
	const order = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
	const sorted = rows.slice().sort((a, b)=>order.indexOf(a.id) - order.indexOf(b.id));
	const rowH = Math.min(78, (VIEW - 60) / sorted.length);
	const top = (VIEW - rowH * sorted.length) / 2 + 10;
	const x0 = C - 250;
	return (
		<g>
			<text x={x0 + 160} y={top - 18} textAnchor="middle" fontSize={13} fill={pal.ink} opacity={0.8}>度卦</text>
			<text x={x0 + 370} y={top - 18} textAnchor="middle" fontSize={13} fill={pal.ink} opacity={0.8}>合入星的三爻后</text>
			{sorted.map((r, i)=>{
				const y = top + i * rowH;
				return (
					<g key={r.id}>
						<text x={x0} y={y + 26} fontSize={16} fill={pal.ink}>{PLANET_CN[r.id] || r.id}</text>
						<text x={x0} y={y + 46} fontSize={11} fill={pal.ink} opacity={0.75}>{trigramName(r.trigram)} · {r.toUpper ? '合上卦' : '合下卦'}</text>
						<HexGlyph x={x0 + 100} y={y + 4} w={40} num={r.degree} pal={pal} />
						<text x={x0 + 150} y={y + 32} fontSize={13} fill={pal.ink}>{hexName(r.degree)}</text>
						<HexGlyph x={x0 + 310} y={y + 4} w={40} num={r.degreeMerged} pal={pal} accent />
						<text x={x0 + 360} y={y + 32} fontSize={13} fill={ACCENT}>{hexName(r.degreeMerged)}</text>
					</g>
				);
			})}
		</g>
	);
}

const BOARDS = { tibetan: tibetanBoard, zurkhai: zurkhaiBoard, sanmei: sanmeiBoard, ninestar: ninestarBoard, loshu: loshuBoard, iching: ichingBoard };

export default class EastAsiaBoard extends React.Component {
	componentDidMount(){ this._detachAppearance = watchChartAppearance(()=>this.forceUpdate()); }
	componentWillUnmount(){ if(this._detachAppearance){ this._detachAppearance(); this._detachAppearance = null; } }

	render(){
		const { model, tab, emptyReason } = this.props;
		const pal = palette();
		if(!model){
			// 排不出时中栏也写原因(与右栏同一句),不留整块空白
			return emptyReason ? (
				<svg className="horosa-plain-text-board" viewBox={`0 0 ${VIEW} ${VIEW}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', maxHeight: '100%' }}>
					<text x={C} y={C} textAnchor="middle" fontSize={16} fill={pal.ink}>{emptyReason}</text>
				</svg>
			) : null;
		}
		const draw = BOARDS[tab] || BOARDS.tibetan;
		return (
			<svg className="horosa-plain-text-board" viewBox={`0 0 ${VIEW} ${VIEW}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', maxHeight: '100%' }}>
				{draw(model, pal)}
			</svg>
		);
	}
}
