// 诸方中栏图:玛雅历=卓尔金与哈布两轮;十三月亮历=Kin 卡;人类图=九中心体图;灵名字母=五要点与象限字母。
import React from 'react';
import { watchChartAppearance } from '../../utils/chartDrawGuard';
import * as AstroConst from '../../constants/AstroConst';
import { TZOLKIN_NAMES, HAAB_MONTHS, HD_CENTER_CN, HD_TYPE_CN, HD_AUTHORITY_CN, SPIRIT_POINT_CN } from '../../utils/zhufangArts';

const ACCENT = 'var(--horosa-accent)';
const DESIGN = '#c2402f';

function palette(){
	const c = AstroConst.AstroColor || {};
	return { stroke: c.Stroke || '#8a7a5a', ink: c.Stroke || '#8a7a5a' };
}

function ring(cx, cy, r, count, active, labelOf, pal, size){
	return Array.from({ length: count }, (_, i)=>{
		const a = (-90 + i * 360 / count) * Math.PI / 180;
		const x = cx + r * Math.cos(a);
		const y = cy + r * Math.sin(a);
		const hot = i === active;
		return (
			<g key={i}>
				<circle cx={x} cy={y} r={size} fill={hot ? ACCENT : 'none'} fillOpacity={hot ? 0.25 : 0} stroke={hot ? ACCENT : pal.stroke} strokeWidth={hot ? 2 : 0.8} />
				<text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.62} fill={hot ? ACCENT : pal.ink}>{labelOf(i)}</text>
			</g>
		);
	});
}

function mayanBoard(local, pal){
	const m = local && local.mayan;
	if(!m){ return <text x={300} y={300} textAnchor="middle" fontSize={16} fill={pal.ink}>公元前日期不排玛雅历</text>; }
	return (
		<g>
			{ring(300, 300, 250, 20, m.tzolkin.sign, (i)=>TZOLKIN_NAMES[i].split(' ')[1], pal, 22)}
			{ring(300, 300, 175, 19, m.haab.month, (i)=>HAAB_MONTHS[i].slice(0, 4), pal, 19)}
			<text x={300} y={250} textAnchor="middle" fontSize={16} fill={pal.ink}>长历</text>
			<text x={300} y={286} textAnchor="middle" fontSize={30} fill={ACCENT}>{m.longCountText}</text>
			<text x={300} y={328} textAnchor="middle" fontSize={20} fill={pal.ink}>{m.tzolkin.number} {m.tzolkin.name}</text>
			<text x={300} y={358} textAnchor="middle" fontSize={16} fill={pal.ink}>{m.haab.day} {m.haab.name} · G{m.lordOfNight}</text>
		</g>
	);
}

function dreamspellBoard(local, pal){
	const ds = local && local.dreamspell;
	if(!ds){ return <text x={300} y={300} textAnchor="middle" fontSize={16} fill={pal.ink}>公元前日期不排十三月亮历</text>; }
	return (
		<g>
			{ring(300, 300, 250, 20, ds.seal - 1, (i)=>i + 1, pal, 20)}
			{ring(300, 300, 185, 13, ds.tone - 1, (i)=>i + 1, pal, 18)}
			<text x={300} y={262} textAnchor="middle" fontSize={16} fill={pal.ink}>Kin</text>
			<text x={300} y={306} textAnchor="middle" fontSize={46} fill={ACCENT}>{ds.kin}</text>
			<text x={300} y={344} textAnchor="middle" fontSize={20} fill={pal.ink}>{ds.toneName}的{ds.sealName}</text>
			<text x={300} y={372} textAnchor="middle" fontSize={14} fill={pal.ink} opacity={0.8}>{ds.moonDate.special || `第 ${ds.moonDate.moon} 月第 ${ds.moonDate.day} 日`}</text>
		</g>
	);
}

// 九中心位置(体图惯例):头顶在上,根部在下,直觉在左,情绪在右
const CENTER_POS = {
	head: { x: 300, y: 55, shape: 'up' }, ajna: { x: 300, y: 150, shape: 'down' }, throat: { x: 300, y: 250, shape: 'square' },
	g: { x: 300, y: 370, shape: 'diamond' }, heart: { x: 395, y: 410, shape: 'up', small: true },
	spleen: { x: 140, y: 500, shape: 'right' }, sacral: { x: 300, y: 520, shape: 'square' }, solar: { x: 460, y: 500, shape: 'left' },
	root: { x: 300, y: 640, shape: 'square' },
};

const centerSize = (p)=>(p.small ? 30 : 44);
// 中心外接半径(沿连线方向收线头用):菱形 1.1s,三角 / 方形按外接圆
const centerReach = (p)=>centerSize(p) * (p.shape === 'diamond' ? 1.1 : (p.shape === 'square' ? 1.0 : 0.9)) + 4;

// 中心实形的多边形顶点(画图与标签避让同一份):方形按四角,菱形按四顶点,三角按三顶点
export function centerPolygon(key){
	const p = CENTER_POS[key];
	const s = centerSize(p);
	let rel;
	if(p.shape === 'square'){ rel = [[-s, -s], [s, -s], [s, s], [-s, s]]; }
	else if(p.shape === 'diamond'){ rel = [[0, -s * 1.1], [s * 1.1, 0], [0, s * 1.1], [-s * 1.1, 0]]; }
	else{ rel = { up: [[0, -s], [s, s * 0.8], [-s, s * 0.8]], down: [[-s, -s * 0.8], [s, -s * 0.8], [0, s]], right: [[-s * 0.8, -s], [s, 0], [-s * 0.8, s]], left: [[s * 0.8, -s], [-s, 0], [s * 0.8, s]] }[p.shape]; }
	return rel.map(([dx, dy])=>[p.x + dx, p.y + dy]);
}

// 中心名的放置点:多边形重心(三角形的视觉中心不在外接框中点,按框中点放字会偏向尖角一侧)
function centerLabelPoint(key){
	const poly = centerPolygon(key);
	return [poly.reduce((a, v)=>a + v[0], 0) / poly.length, poly.reduce((a, v)=>a + v[1], 0) / poly.length];
}

const pointInPoly = (x, y, poly)=>{
	let inside = false;
	for(let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1){
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		if(((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)){ inside = !inside; }
	}
	return inside;
};
const segCross = (a, b, c, d)=>{
	const o = (p, q, r)=>(q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
	return (o(a, b, c) > 0) !== (o(a, b, d) > 0) && (o(c, d, a) > 0) !== (o(c, d, b) > 0);
};
// 标签框与中心实形是否相交(框角在形内 / 形顶点在框内 / 边相交)
export function boxHitsCenter(box, key){
	const poly = centerPolygon(key);
	const corners = [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]];
	if(corners.some(([x, y])=>pointInPoly(x, y, poly))){ return true; }
	if(poly.some(([x, y])=>x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h)){ return true; }
	for(let i = 0; i < 4; i += 1){
		for(let j = 0; j < poly.length; j += 1){
			if(segCross(corners[i], corners[(i + 1) % 4], poly[j], poly[(j + 1) % poly.length])){ return true; }
		}
	}
	return false;
}

function centerShape(key, defined, pal){
	const p = CENTER_POS[key];
	const s = centerSize(p);
	// 先铺一层底色(随主题),再叠中心本色:通道线不会从中心里穿过去压住中心名
	const base = { fill: 'var(--horosa-surface-solid, #fdfbf6)', stroke: 'none' };
	const common = { fill: defined ? ACCENT : 'none', fillOpacity: defined ? 0.32 : 0, stroke: defined ? ACCENT : pal.stroke, strokeWidth: defined ? 2 : 1.2 };
	let draw;
	if(p.shape === 'square'){ draw = (props)=><rect x={p.x - s} y={p.y - s} width={s * 2} height={s * 2} rx={6} {...props} />; }
	else{ draw = (props)=><polygon points={centerPolygon(key).map(([x, y])=>`${x},${y}`).join(' ')} {...props} />; }
	const [lx, ly] = centerLabelPoint(key);
	return (
		<g key={key}>
			{draw(base)}
			{draw(common)}
			<text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={p.small ? 11 : 13} fill={pal.ink}>{(HD_CENTER_CN[key] || key).replace(/\(.*\)/, '')}</text>
		</g>
	);
}

const LABEL_H = 12;
// 中心名字所占的框(与 centerShape 的 text 同位置同字号估算)
export function centerLabelBox(key){
	const p = CENTER_POS[key];
	const text = (HD_CENTER_CN[key] || key).replace(/\(.*\)/, '');
	const fs = p.small ? 11 : 13;
	const w = text.length * fs + 4;
	const [lx, ly] = centerLabelPoint(key);
	return { x: lx - w / 2, y: ly - fs / 2 - 2, w, h: fs + 4 };
}
const labelWidth = (text)=>text.length * 6 + 6;
const boxesHit = (a, b)=>a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// 体图通道布局(纯几何,导出供测试):同一对中心之间的几条通道对称排开,线头收到中心外沿,
// 门号标签放在线的外侧,与其它标签、中心框都不重叠(撞了就沿线方向挪)。
export function layoutHdChannels(channels){
	const groups = {};
	(channels || []).forEach((ch, i)=>{
		const key = [ch.centers[0], ch.centers[1]].sort().join('-');
		(groups[key] = groups[key] || []).push(i);
	});
	const SPACING = 12;
	// 已占位:中心名字框与已放标签(权重 10,绝不压);中心实形另按多边形判(同权重 10,标签不许压到框线上)
	const placed = [];
	Object.keys(CENTER_POS).forEach((key)=>{
		placed.push({ ...centerLabelBox(key), weight: 10 });
	});
	const centerKeys = Object.keys(CENTER_POS);
	return (channels || []).map((ch, i)=>{
		const key = [ch.centers[0], ch.centers[1]].sort().join('-');
		const grp = groups[key];
		const k = grp.indexOf(i);
		const n = grp.length;
		const a = CENTER_POS[ch.centers[0]];
		const b = CENTER_POS[ch.centers[1]];
		if(!a || !b){ return null; }
		// 方向统一按排序后的两端定,同组几条线的「左右」才一致
		const [pa, pb] = ch.centers[0] <= ch.centers[1] ? [a, b] : [b, a];
		const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
		const ux = (pb.x - pa.x) / len;
		const uy = (pb.y - pa.y) / len;
		const nx = -uy;
		const ny = ux;
		const off = (k - (n - 1) / 2) * SPACING;
		const ra = centerReach(pa);
		const rb = centerReach(pb);
		const x1 = pa.x + ux * ra + nx * off;
		const y1 = pa.y + uy * ra + ny * off;
		const x2 = pb.x - ux * rb + nx * off;
		const y2 = pb.y - uy * rb + ny * off;
		const mx = (x1 + x2) / 2;
		const my = (y1 + y2) / 2;
		const text = ch.gates.join('-');
		const w = labelWidth(text);
		const side = off < 0 ? -1 : 1;
		const gap = Math.abs(off) + 9;
		// 候选位:沿线方向前后挪,再不行离线远一档;都撞就取撞得最少的那个
		let box = null;
		let best = Infinity;
		for(let far = 0; far < 6 && best > 0; far += 1){
			for(let t = 0; t <= 12 && best > 0; t += 1){
				const step = t === 0 ? 0 : (t % 2 ? (t + 1) / 2 : -t / 2);
				const along = step * (LABEL_H + 2);
				const g2 = gap + far * 16;
				const cx = mx + ux * along + nx * g2 * side;
				const cy = my + uy * along + ny * g2 * side;
				// 标签框放在法线那一侧:法线朝右放左对齐,朝左放右对齐,竖直方向居中
				const bx = (nx * side) > 0.3 ? cx : ((nx * side) < -0.3 ? cx - w : cx - w / 2);
				const by = (ny * side) > 0.3 ? cy : ((ny * side) < -0.3 ? cy - LABEL_H : cy - LABEL_H / 2);
				const cand = { x: bx, y: by, w, h: LABEL_H };
				if(cand.x < 2 || cand.x + cand.w > 598 || cand.y < 84 || cand.y + cand.h > 698){ continue; }   // 不出图、不压左上角类型字
				const hits = placed.reduce((acc, pb2)=>acc + (boxesHit(cand, pb2) ? pb2.weight : 0), 0)
					+ centerKeys.reduce((acc, ck)=>acc + (boxHitsCenter(cand, ck) ? 10 : 0), 0);
				if(hits < best){ best = hits; box = cand; }
			}
		}
		if(!box){ box = { x: mx + 4, y: my - LABEL_H / 2, w, h: LABEL_H }; }
		placed.push({ ...box, weight: 10 });
		return { x1, y1, x2, y2, mx, my, label: { text, x: box.x + 3, y: box.y + LABEL_H - 2, box } };
	});
}

function hdBoard(remote, pal){
	const hd = remote && remote.humanDesign;
	if(!hd){ return <text x={300} y={340} textAnchor="middle" fontSize={16} fill={pal.ink}>人类图计算中或未算出</text>; }
	const pGates = new Set(hd.personality.map((r)=>r.gate));
	const dGates = new Set(hd.design.map((r)=>r.gate));
	const colorOf = (g)=>(pGates.has(g) && dGates.has(g) ? ACCENT : (dGates.has(g) ? DESIGN : pal.ink));
	const geo = layoutHdChannels(hd.channels);
	const lines = hd.channels.map((ch, i)=>{
		const L = geo[i];
		if(!L){ return null; }
		// 线的前半段属 centers[0] 那端的门、后半段属 centers[1] 那端的门(布局按排序方向,这里按原端点取色)
		const firstAtStart = ch.centers[0] <= ch.centers[1];
		const gStart = firstAtStart ? ch.gates[0] : ch.gates[1];
		const gEnd = firstAtStart ? ch.gates[1] : ch.gates[0];
		return (
			<g key={i}>
				<line x1={L.x1} y1={L.y1} x2={L.mx} y2={L.my} stroke={colorOf(gStart)} strokeWidth={4} />
				<line x1={L.mx} y1={L.my} x2={L.x2} y2={L.y2} stroke={colorOf(gEnd)} strokeWidth={4} />
			</g>
		);
	});
	const labels = hd.channels.map((ch, i)=>{
		const L = geo[i];
		if(!L){ return null; }
		return (
			<g key={`l${i}`}>
				<rect x={L.label.box.x} y={L.label.box.y} width={L.label.box.w} height={L.label.box.h} rx={2} fill="var(--horosa-surface-solid, #fdfbf6)" fillOpacity={0.9} stroke="none" />
				<text x={L.label.x} y={L.label.y} fontSize={10} fill={pal.ink}>{L.label.text}</text>
			</g>
		);
	});
	return (
		<g>
			{lines}
			{Object.keys(CENTER_POS).map((key)=>centerShape(key, hd.defined.indexOf(key) >= 0, pal))}
			{labels}
			<text x={20} y={30} fontSize={15} fill={ACCENT}>{HD_TYPE_CN[hd.type] || hd.type}</text>
			<text x={20} y={52} fontSize={12} fill={pal.ink}>权威 {HD_AUTHORITY_CN[hd.authority] || hd.authority}</text>
			<text x={20} y={72} fontSize={12} fill={pal.ink}>角色 {hd.profile.join('/')}</text>
			<text x={580} y={30} textAnchor="end" fontSize={11} fill={pal.ink}>本色 = 个人 · 红 = 设计 · 金 = 两者都有</text>
		</g>
	);
}

function spiritBoard(remote, pal){
	const sn = remote && remote.spiritNames;
	if(!sn){ return <text x={300} y={300} textAnchor="middle" fontSize={16} fill={pal.ink}>灵名字母计算中或未算出</text>; }
	const rows = sn.ibnEzra;
	return (
		<g>
			<text x={300} y={50} textAnchor="middle" fontSize={15} fill={pal.ink}>五要点字母(从上升度起每 22 度一轮)</text>
			{rows.map((r, i)=>{
				const x = 70 + i * 115;
				return (
					<g key={r.id}>
						<rect x={x - 48} y={80} width={96} height={130} rx={8} fill="none" stroke={pal.stroke} />
						<text x={x} y={150} textAnchor="middle" fontSize={54} fill={ACCENT}>{r.letter ? r.letter.glyph : '—'}</text>
						<text x={x} y={186} textAnchor="middle" fontSize={12} fill={pal.ink}>{r.letter ? r.letter.name : ''}</text>
						<text x={x} y={232} textAnchor="middle" fontSize={12} fill={pal.ink}>{SPIRIT_POINT_CN[r.id] || r.id}</text>
					</g>
				);
			})}
			<text x={300} y={300} textAnchor="middle" fontSize={15} fill={pal.ink}>象限 {sn.quadrant} 四宫主星字母</text>
			{sn.quadrantRows.map((r, i)=>{
				const x = 120 + i * 120;
				return (
					<g key={r.house}>
						<rect x={x - 48} y={330} width={96} height={130} rx={8} fill="none" stroke={i === 0 ? ACCENT : pal.stroke} />
						<text x={x} y={400} textAnchor="middle" fontSize={54} fill={ACCENT}>{r.letter.glyph}</text>
						<text x={x} y={436} textAnchor="middle" fontSize={12} fill={pal.ink}>{r.letter.name}</text>
						<text x={x} y={482} textAnchor="middle" fontSize={12} fill={pal.ink}>{r.house} 宫 · {r.score} 分</text>
					</g>
				);
			})}
			<text x={300} y={540} textAnchor="middle" fontSize={15} fill={pal.ink}>十一宫主星字母 <tspan fill={ACCENT} fontSize={28}>{sn.eleventh.letter.glyph}</tspan> {sn.eleventh.letter.name}</text>
		</g>
	);
}

export default class ZhufangBoard extends React.Component {
	componentDidMount(){ this._detachAppearance = watchChartAppearance(()=>this.forceUpdate()); }
	componentWillUnmount(){ if(this._detachAppearance){ this._detachAppearance(); this._detachAppearance = null; } }

	render(){
		const { tab, local, remote } = this.props;
		const pal = palette();
		const hd = tab === 'hd';
		const view = hd ? '0 0 600 700' : '0 0 600 600';
		const body = tab === 'dreamspell' ? dreamspellBoard(local, pal) : (tab === 'hd' ? hdBoard(remote, pal) : (tab === 'spirit' ? spiritBoard(remote, pal) : mayanBoard(local, pal)));
		return (
			<svg className="horosa-plain-text-board" viewBox={view} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', maxHeight: '100%' }}>
				{body}
			</svg>
		);
	}
}
