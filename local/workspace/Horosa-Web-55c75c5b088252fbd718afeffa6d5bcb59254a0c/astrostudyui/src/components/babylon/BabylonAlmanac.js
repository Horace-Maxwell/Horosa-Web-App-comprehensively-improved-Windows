// components/babylon/BabylonAlmanac.js —— P7 目标年周期法与年历预测摘要。
// 中栏:目标年取数图(预测 Y 年 ← 各行星 Y−周期);右栏:周期表·工作流·Lunar Six 修正律·本盘目标年。
import { Component } from 'react';
import { GOAL_YEAR, LUNAR_SIX, NOTES, SAROS } from '../../divination/data/babylonianData';

const PLANET_COLOR = { jupiter: '#7d5bA6', venus: '#c25c8a', mercury: '#3d8f74', saturn: '#5b5347', mars: '#bf3c36', moon: '#4f6f9c' };

class BabylonAlmanac extends Component{
	renderDiagram(){
		const dark = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-horosa-appearance') === 'dark');
		const ink = dark ? '#cabb92' : '#5b4423';
		const gold = dark ? '#b6934a' : '#9a6a25';
		const bab = this.props.bab;
		const targetYear = bab ? bab.babylonianDate.seYear : 90;
		const W = 640, H = 380, axisY = H - 56;
		const maxBack = 90;
		const x = (back) => 36 + (1 - back / maxBack) * (W - 90);
		return (
			<svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
				<line x1={30} y1={axisY} x2={W - 24} y2={axisY} stroke="rgba(122,94,48,0.4)" strokeWidth="1" />
				{[0, 18, 46, 59, 71, 79, 83].map((b) => (
					<g key={b}>
						<line x1={x(b)} y1={axisY - 3} x2={x(b)} y2={axisY + 3} stroke={ink} strokeWidth="0.8" />
						<text x={x(b)} y={axisY + 15} fontSize="9" fill={ink} textAnchor="middle">{b === 0 ? `目标年 ${targetYear}` : `−${b}`}</text>
					</g>
				))}
				{GOAL_YEAR.map((g, gi) => (
					g.periods.map((p, pi) => {
						const y0 = 34 + gi * 40;
						const col = PLANET_COLOR[g.planet] || '#777';
						return (
							<g key={`${g.planet}${pi}`}>
								<path d={`M${x(p)},${y0 + 12} C ${x(p)},${axisY - 60} ${x(0)},${y0 + 40} ${x(0)},${axisY - 6}`}
									fill="none" stroke={col} strokeWidth="1.3" opacity="0.65" strokeDasharray={pi ? '4,3' : 'none'} />
								<circle cx={x(p)} cy={y0 + 12} r={3} fill={col} />
								<text x={x(p)} y={y0 + 6} fontSize="10" fill={col} textAnchor="middle" fontWeight="600">{g.cn} −{p}</text>
							</g>
						);
					})
				))}
				<circle cx={x(0)} cy={axisY - 6} r={4.5} fill={gold} />
				<text x={x(0)} y={40} fontSize="11.5" fill={gold} textAnchor="middle" fontWeight="700">Y(预测年)</text>
				<text x={W / 2} y={H - 26} fontSize="9.5" fill={ink} textAnchor="middle" opacity="0.8">
					自 Y−周期 年的观测档案取各天体现象与位置 → 施小修正 → 汇为来年逐月预测摘要
				</text>
				<text x={W / 2} y={H - 12} fontSize="9" fill={ink} textAnchor="middle" opacity="0.6">
					观测记录(逐夜) → 目标年文本(按周期取数) → 年历(按宫)/距星年历(相对距星)
				</text>
			</svg>
		);
	}

	render(){
		const bab = this.props.bab;
		return (
			<div className="horosa-babylon-body" style={{ height: this.props.height }}>
				<div className="horosa-babylon-stage">
					<div className="horosa-babylon-svgwrap">{this.renderDiagram()}</div>
				</div>
				<div className="horosa-babylon-readout">
					{this.props.schemePanel}
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">目标年周期表</div>
						<div className="horosa-babylon-scroll-x"><table className="horosa-babylon-table">
							<thead><tr><th>天体</th><th>周期(年)</th><th>±1 日精度</th><th>备注</th></tr></thead>
							<tbody>
								{GOAL_YEAR.map((g) => (
									<tr key={g.planet}>
										<td>{g.cn}</td>
										<td className="num">{g.periods.join(' / ')}</td>
										<td className="num">{g.accuracy || '—'}</td>
										<td style={{ fontSize: 11 }}>{g.note}</td>
									</tr>
								))}
							</tbody>
						</table></div>
					</div>
					{bab ? (
						<div className="horosa-babylon-card">
							<div className="horosa-babylon-card-title">本盘目标年取数(S.E.{bab.babylonianDate.seYear})</div>
							{GOAL_YEAR.map((g) => (
								<div key={g.planet}>· {g.cn} ← S.E.{g.periods.map((p) => bab.babylonianDate.seYear - p).join(' 与 S.E.')} 年之档案</div>
							))}
						</div>
					) : null}
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">Lunar Six(朔望六时距,单位 UŠ)</div>
						{LUNAR_SIX.map((l) => (
							<div key={l.key}>· <b>{l.cune}</b>({l.phase}):{l.def}</div>
						))}
						<div className="horosa-babylon-caveat">{NOTES.lunarSix}</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">月与食(Saros)</div>
						<div>月之目标年周期 = 18 年 = 223 朔望月 = 1 Saros;{SAROS.days}。</div>
						<div className="horosa-babylon-caveat">{SAROS.exeligmos}。年历尚记录:各行星所在宫与入宫日期、现象日期、月食、二分二至(图式)、天狼星——「含编制个人星盘所需全部信息」。</div>
					</div>
				</div>
			</div>
		);
	}
}

export default BabylonAlmanac;
