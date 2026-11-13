// 金口诀 · 地支刑冲合害破 关系图（独立 SVG，不耦合主盘 JinKouPanChart）
import { Component } from 'react';

const ZI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function ptOf(i, cx, cy, r){
	const ang = (-90 + i * 30) * Math.PI / 180;
	return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
}

class JinKouRelationMini extends Component {
	render(){
		const relations = this.props.relations || [];
		const rows = this.props.rows || [];
		const size = 260;
		const cx = 130;
		const cy = 130;
		const r = 104;
		const four = {};
		rows.forEach((row)=>{ if(row && row.branch){ four[row.branch] = row.label; } });
		const colorOf = (t)=>((t === '合' || t === '三合') ? 'var(--horosa-jx-he, #3d8f74)' : (t === '冲' ? 'var(--horosa-jx-chong, #c0392b)' : 'var(--horosa-jx-other, #c98a2f)'));
		const dashedOf = (t)=>(t === '刑' || t === '害' || t === '破');
		return (
			<svg className="horosa-plain-text-board" viewBox={`0 -24 ${size} ${size + 28}`} width="100%" style={{ display: 'block', height: 'auto', maxWidth: 320, margin: '0 auto' }}>
				<circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--horosa-border, #e0d9c0)" strokeWidth="1" />
				{relations.map((rel, k)=>{
					const ia = ZI.indexOf(rel.a);
					const ib = ZI.indexOf(rel.b);
					if(ia < 0 || ib < 0){ return null; }
					const pa = ptOf(ia, cx, cy, r);
					const pb = ptOf(ib, cx, cy, r);
					return (
						<line
							key={`rel_${k}`}
							x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
							stroke={colorOf(rel.type)} strokeWidth="2.2"
							strokeDasharray={dashedOf(rel.type) ? '5 4' : ''} opacity="0.85"
						>
							<title>{`${rel.a}${rel.type}${rel.b}`}</title>
						</line>
					);
				})}
				{ZI.map((zi, i)=>{
					const p = ptOf(i, cx, cy, r);
					const hit = four[zi];
					return (
						<g key={`zi_${zi}`}>
							<circle
								cx={p.x} cy={p.y} r={hit ? 16 : 12}
								fill={hit ? 'var(--horosa-gold-soft, #f7f3dc)' : 'transparent'}
								stroke={hit ? 'var(--horosa-jx-other, #c98a2f)' : 'var(--horosa-border, #d9d9d9)'} strokeWidth="1.2"
							/>
							<text
								x={p.x} y={p.y + 5} textAnchor="middle" fontSize="15"
								fill={hit ? 'var(--horosa-jx-other, #8a5a17)' : 'var(--horosa-text-soft, #595959)'} fontWeight="400"
							>{zi}</text>
							{hit ? (
								<text x={p.x} y={p.y - 21} textAnchor="middle" fontSize="12" fontWeight="400" fill="var(--horosa-text-soft, #8c8c8c)">{hit}</text>
							) : null}
						</g>
					);
				})}
			</svg>
		);
	}
}

export default JinKouRelationMini;
