// components/babylon/BabylonEae.js —— P6 天象预兆(国家占卜)。
// 中栏:四国-四方月食地理罗盘 + 二元律图示;右栏:分段结构·代表条文·颜色·行星预兆义。
import { Component } from 'react';
import { EAE, FOUR_LANDS, BABYLON_COLORS, NOTES, landOfMonth } from '../../divination/data/babylonianData';

class BabylonEae extends Component{
	renderCompass(){
		const dark = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-horosa-appearance') === 'dark');
		const ink = dark ? '#cabb92' : '#5b4423';
		const gold = dark ? '#b6934a' : '#9a6a25';
		const W = 480, C = W / 2, R = 168;
		const bab = this.props.bab;
		const birthLand = bab ? landOfMonth(Math.floor(bab.babylonianDate.month.n)) : null;
		// 方位角(N上/E右/S下/W左)
		const AT = { '北': -90, '东': 0, '南': 90, '西': 180 };
		return (
			<svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: '100%' }}>
				<circle cx={C} cy={C} r={R} fill={dark ? 'rgba(182,147,74,0.05)' : 'rgba(154,106,37,0.05)'} stroke="rgba(122,94,48,0.35)" strokeWidth="1" />
				<circle cx={C} cy={C} r={R * 0.42} fill="none" stroke="rgba(122,94,48,0.25)" strokeWidth="0.8" strokeDasharray="4,3" />
				<text x={C} y={C + 4} fontSize="11" fill={ink} textAnchor="middle" opacity="0.85">月面四象限</text>
				{FOUR_LANDS.map((l) => {
					const a = AT[l.dir] * Math.PI / 180;
					const x = C + Math.cos(a) * R * 0.7, y = C + Math.sin(a) * R * 0.7;
					const lx = C + Math.cos(a) * (R + 22), ly = C + Math.sin(a) * (R + 22);
					const hl = birthLand && birthLand.land === l.land;
					return (
						<g key={l.dir}>
							<line x1={C + Math.cos(a) * R * 0.42} y1={C + Math.sin(a) * R * 0.42}
								x2={C + Math.cos(a) * R} y2={C + Math.sin(a) * R}
								stroke={hl ? gold : 'rgba(122,94,48,0.3)'} strokeWidth={hl ? 1.6 : 0.8} />
							<text x={x} y={y - 6} fontSize="13" fill={hl ? gold : ink} textAnchor="middle" fontWeight={hl ? 700 : 600}>{l.land.split('(')[0]}</text>
							<text x={x} y={y + 10} fontSize="9" fill={ink} textAnchor="middle" opacity="0.75">{l.dir}方 · {l.wind}</text>
							<text x={x} y={y + 24} fontSize="8.5" fill={ink} textAnchor="middle" opacity="0.6">主 {l.months.join('/')} 月</text>
							<text x={lx} y={ly + 4} fontSize="12" fill={ink} textAnchor="middle" opacity="0.5">{l.dir}</text>
						</g>
					);
				})}
				<text x={C} y={W - 30} fontSize="9.5" fill={ink} textAnchor="middle" opacity="0.8">食时变暗之象限 → 该国之灾;全食 → 普世之灾</text>
				<text x={C} y={W - 16} fontSize="9" fill={ink} textAnchor="middle" opacity="0.65">二元律:右=吉·左=凶;明=吉·暗=凶</text>
				{birthLand ? <text x={C} y={26} fontSize="10" fill={gold} textAnchor="middle">本盘生月({Math.floor(this.props.bab.babylonianDate.month.n)} 月)所主:{birthLand.land}</text> : null}
			</svg>
		);
	}

	render(){
		return (
			<div className="horosa-babylon-body" style={{ height: this.props.height }}>
				<div className="horosa-babylon-stage">
					<div className="horosa-babylon-svgwrap">{this.renderCompass()}</div>
					<div style={{ width: '100%', maxWidth: 560, padding: '0 12px 12px' }}>
						<div className="horosa-babylon-card">
							<div className="horosa-babylon-card-title">解读机制</div>
							<div>{EAE.mechanism}</div>
							<div className="horosa-babylon-caveat">{EAE.ritual}</div>
						</div>
					</div>
				</div>
				<div className="horosa-babylon-readout">
					{this.props.schemePanel}
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">大预兆系列 · 四神分段</div>
						<div className="horosa-babylon-scroll-x"><table className="horosa-babylon-table">
							<thead><tr><th>段</th><th>泥板</th><th>内容</th></tr></thead>
							<tbody>
								{EAE.segments.map((s, i) => (
									<tr key={i}><td>{s.god}</td><td className="num">{s.tablets}</td><td>{s.content}{s.caveat ? <span style={{ opacity: 0.6 }}>(⚠ {s.caveat})</span> : null}</td></tr>
								))}
							</tbody>
						</table></div>
						<div className="horosa-babylon-caveat">{EAE.scale}</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">代表条文(逐字/权威转写)</div>
						{EAE.examples.map((e, i) => (
							<div key={i} style={{ marginBottom: 6 }}>
								<span className="horosa-babylon-badge">{e.type}</span>
								<div style={{ marginTop: 2, fontStyle: 'italic' }}>{e.text}</div>
							</div>
						))}
						<div className="horosa-babylon-caveat">{EAE.exampleCaveat}</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">颜色象征</div>
						{BABYLON_COLORS.map((c, i) => (
							<div key={i}>· {c.color} — {c.planet}:{c.meaning}{c.caveat ? '(⚠ 各条不一)' : ''}</div>
						))}
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">行星预兆主题</div>
						{EAE.planetOmens.map((p, i) => (
							<div key={i}>· <b>{p.cn}</b>:{p.theme}</div>
						))}
						<div className="horosa-babylon-caveat">{EAE.verbs} 二元属性(右/左、明/暗、日期、象限)+ 四国地理叠加得出所指之国与时机。{NOTES.fourLands}</div>
					</div>
				</div>
			</div>
		);
	}
}

export default BabylonEae;
