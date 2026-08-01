// 量化盘 六宫框(定局法 WP-2)—— 单框轮盘。
// 把一个宫框(cusps[12])画成轮:外环星座带(30°一格,描边走 currentColor / --horosa-chart-stroke)+
// 径向宫头线 + 宫号 + 各点按真实黄经落位(字形随全站星盘)。逆时针(0°正上,度向左增),与 UranianDial 一致。
// 纯展示:cusps/points 由父级算好传入,本组件不碰后端、不改任何既有签名。
import React, { Component } from 'react';
import * as d3 from 'd3';
import { randomStr } from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { spreadDialAngles } from '../../utils/uranianDial';
import { TNP_GLYPH_PATHS, appendTnpGlyphD3 } from './UranianGlyphs';

const TAU = Math.PI * 2;
const norm360 = (x) => ((x % 360) + 360) % 360;
// 逆时针:0° 在正上、度数向左增(与全站星盘 / UranianDial 同口径)。
const polar = (cx, cy, R, deg) => { const a = deg / 360 * TAU; return [cx - R * Math.sin(a), cy - R * Math.cos(a)]; };

// 字形:TNP=缩写、白羊点=Aries 字形、其余=AstroMsg+AstroChartFont(与 UranianDial.draw 同源)。
function glyphChar(id){
	const tnp = AstroText.isUranian(id) && id !== AstroConst.ARIES_POINT;
	if (tnp) return { ch: AstroText.uranianGlyph(id), font: 'inherit', weight: 600 };
	const ch = id === AstroConst.ARIES_POINT ? AstroText.AstroMsg[AstroConst.ARIES] : (AstroText.AstroMsg[id] || AstroText.uranianGlyph(id));
	return { ch, font: AstroConst.AstroChartFont, weight: 400 };
}

export default class UranianFrameWheel extends Component {
	constructor(props){
		super(props);
		this.svgid = 'uraframe_' + randomStr(8);
		this.draw = this.draw.bind(this);
	}
	componentDidMount(){ this.draw(); }
	componentDidUpdate(prev){
		if (prev.cusps !== this.props.cusps || prev.points !== this.props.points || prev.size !== this.props.size || prev.frameKey !== this.props.frameKey || prev.showTnp !== this.props.showTnp) this.draw();
	}

	draw(){
		const size = this.props.size || 320;
		const cusps = this.props.cusps || [];
		const points = this.props.points || [];
		const cx = size / 2, cy = size / 2;
		const stroke = 'currentColor';
		const svg = d3.select('#' + this.svgid);
		svg.selectAll('*').remove();
		if (cusps.length !== 12) return;
		const root = svg.append('g').attr('color', 'var(--horosa-chart-stroke, currentColor)');

		const R = size / 2 - 4;
		const rSign = R;                 // 星座带外缘
		const rSignIn = R - Math.max(16, size * 0.07); // 星座带内缘 = 宫环外缘
		const rHouse = rSignIn;          // 宫环外缘
		const rHole = Math.max(28, rSignIn * 0.34);    // 中央留白
		const rNum = (rHouse + rHole) / 2;             // 宫号半径
		const rPt = rHouse - Math.max(12, size * 0.05); // 点落位半径

		// —— 外圈 + 星座带(12 等分 30°,描边 currentColor,柔填星座色)——
		root.append('circle').attr('cx', cx).attr('cy', cy).attr('r', rSign).attr('fill', 'none').attr('stroke', stroke).attr('stroke-width', 1.1).attr('opacity', 0.85);
		root.append('circle').attr('cx', cx).attr('cy', cy).attr('r', rSignIn).attr('fill', 'none').attr('stroke', stroke).attr('stroke-width', 0.9).attr('opacity', 0.5);
		for (let i = 0; i < 12; i++){
			const sig = AstroConst.LIST_SIGNS[i];
			const a0 = (i * 30) / 360 * TAU, a1 = ((i + 1) * 30) / 360 * TAU;
			const arc = d3.arc().innerRadius(rSignIn).outerRadius(rSign).startAngle(-a0).endAngle(-a1);
			const fill = (AstroConst.AstroColor.SignFill && AstroConst.AstroColor.SignFill[sig]) || 'none';
			root.append('path').attr('transform', `translate(${cx},${cy})`).attr('d', arc()).attr('fill', fill).attr('fill-opacity', 0.12).attr('stroke', stroke).attr('stroke-width', 0.5).attr('opacity', 0.55);
			// 星座符号(AstroMsg[名]+AstroChartFont,与 signsBand 同源,不用裸 Unicode)。
			const [gx, gy] = polar(cx, cy, (rSign + rSignIn) / 2, i * 30 + 15);
			root.append('text').attr('x', gx).attr('y', gy).attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('font-size', Math.max(9, size * 0.034)).attr('opacity', 0.6).attr('fill', stroke).attr('font-family', AstroConst.AstroChartFont).text(AstroText.AstroMsg[sig] || sig);
		}

		// —— 宫头径向线 + 宫号(cusps 由父传,子午局不等距同样照画)——
		root.append('circle').attr('cx', cx).attr('cy', cy).attr('r', rHole).attr('fill', 'none').attr('stroke', stroke).attr('stroke-width', 0.7).attr('opacity', 0.4);
		for (let i = 0; i < 12; i++){
			const c = norm360(cusps[i]);
			const isAngle = (i % 3 === 0); // 1/4/7/10 宫头加粗(角宫)
			const [x1, y1] = polar(cx, cy, rHole, c), [x2, y2] = polar(cx, cy, rHouse, c);
			root.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', stroke).attr('stroke-width', isAngle ? 1.3 : 0.7).attr('opacity', isAngle ? 0.7 : 0.4);
			// 宫号画在该宫中点(到下一宫头的弧中)。
			const cn = norm360(cusps[(i + 1) % 12]);
			const span = norm360(cn - c);
			const [nx, ny] = polar(cx, cy, rNum, c + span / 2);
			root.append('text').attr('x', nx).attr('y', ny).attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('font-size', Math.max(8, size * 0.03)).attr('fill', stroke).attr('opacity', 0.45).text(`${i + 1}`);
		}

		// —— 各点按真实黄经落位(避让挤压;白羊点/TNP 字形特殊)——
		const visible = (points || []).filter((p) => (this.props.showTnp === false ? (!AstroText.isUranian(p.id) || p.id === AstroConst.ARIES_POINT) : true));
		const baseSz = Math.max(9, Math.min(15, size * 0.04));
		const minGap = Math.min(16, (baseSz * 1.2) / Math.max(30, rPt) * 180 / Math.PI);
		const placed = spreadDialAngles(visible.map((p) => ({ p, displayAngle: norm360(p.lon) })), minGap);
		placed.forEach((item) => {
			const p = item.p;
			const [px, py] = polar(cx, cy, rHouse - 1, item.displayAngle); // 环上真位小点
			const [lx, ly] = polar(cx, cy, rPt, item.glyphAngle);          // 避让后字形位
			const g = glyphChar(p.id);
			root.append('line').attr('x1', px).attr('y1', py).attr('x2', lx).attr('y2', ly).attr('stroke', stroke).attr('stroke-width', 0.6).attr('opacity', 0.35);
			root.append('circle').attr('cx', px).attr('cy', py).attr('r', 1.6).attr('fill', stroke).attr('opacity', 0.8);
			// B1:TNP 走手绘 SVG 星图字形(path 直插);缺字形回退粗体缩写(glyphChar 原路径)。
			const tnpB1 = AstroText.isUranian(p.id) && p.id !== AstroConst.ARIES_POINT;
			let t = null;
			if (TNP_GLYPH_PATHS[p.id]) t = appendTnpGlyphD3(root, p.id, lx, ly, baseSz * 0.98, stroke);
			if (!t){
				t = root.append('text').attr('x', lx).attr('y', ly).attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
					.attr('font-size', g.font === 'inherit' ? baseSz * 0.8 : baseSz).attr('fill', stroke)
					.attr('font-family', g.font).attr('font-weight', g.weight).style('letter-spacing', g.font === 'inherit' ? '0.2px' : '0').style('pointer-events', 'none')
					.text(g.ch);
			}
			t.append('title').text(AstroText.AstroMsgCN[p.id] || p.id);
		});

		// —— 框名标题(中央)——
		if (this.props.label){
			root.append('text').attr('x', cx).attr('y', cy).attr('text-anchor', 'middle').attr('dominant-baseline', 'central').attr('font-size', Math.max(10, size * 0.04)).attr('fill', stroke).attr('opacity', 0.5).text(this.props.label);
		}
	}

	render(){
		const size = this.props.size || 320;
		return (
			<svg id={this.svgid} width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ color: 'var(--horosa-chart-stroke, currentColor)', display: 'block' }} />
		);
	}
}
