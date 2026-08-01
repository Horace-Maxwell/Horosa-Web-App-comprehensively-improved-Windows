// components/babylon/BabylonMelothesia.js —— P5 医疗占星(黄道-身体对应)。
// 铁律:中栏为「抽象结构图」——竖向 12 分区轴(头→足),绝不绘制拟人写实脸/手。
// 右栏:所选宫之身体/配料/巫术/吉日链 + 巴/希起源之辨。
import { Component } from 'react';
import { BABYLON_SIGNS, NOTES, HEMEROLOGY, babylonSign } from '../../divination/data/babylonianData';
import { lonToSignDeg } from '../../divination/babylon/units';

class BabylonMelothesia extends Component{
	constructor(props){
		super(props);
		const lons = props.lons || {};
		const moonSign = lons.moon !== undefined ? lonToSignDeg(lons.moon).sign : 1;
		this.state = { sel: moonSign };
	}

	renderColumn(){
		const dark = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-horosa-appearance') === 'dark');
		const ink = dark ? '#cabb92' : '#5b4423';
		const gold = dark ? '#b6934a' : '#9a6a25';
		const lons = this.props.lons || {};
		const moonSign = lons.moon !== undefined ? lonToSignDeg(lons.moon).sign : null;
		const W = 460, rowH = 34, top = 34, H = top + rowH * 12 + 26;
		return (
			<svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
				<text x={W / 2} y={18} fontSize="12.5" fontWeight="600" fill={ink} textAnchor="middle">自头至足(ištu muḫḫi adi šēpē)—— 抽象分区轴</text>
				{/* 中央轴线 */}
				<line x1={W / 2} y1={top} x2={W / 2} y2={top + rowH * 12} stroke={gold} strokeWidth="2" opacity="0.5" />
				{BABYLON_SIGNS.map((s, i) => {
					const y = top + i * rowH;
					const isSel = this.state.sel === s.n;
					const isMoon = moonSign === s.n;
					return (
						<g key={s.n} style={{ cursor: 'pointer' }} onClick={() => this.setState({ sel: s.n })}>
							<rect x={40} y={y + 3} width={W - 80} height={rowH - 6} rx={7}
								fill={isSel ? (dark ? 'rgba(182,147,74,0.2)' : 'rgba(154,106,37,0.12)') : (dark ? 'rgba(202,187,146,0.05)' : 'rgba(122,94,48,0.04)')}
								stroke={isSel ? gold : 'rgba(122,94,48,0.25)'} strokeWidth={isSel ? 1.4 : 0.7} />
							{/* 左:宫;右:身体部位;中:分区块序 */}
							<text x={52} y={y + rowH / 2 + 4} fontSize="12" fill={ink} fontWeight={isSel ? 700 : 500}>{s.cn}</text>
							<text x={104} y={y + rowH / 2 + 4} fontSize="8.5" fill={ink} opacity="0.6">{s.cune}</text>
							<circle cx={W / 2} cy={y + rowH / 2} r={isSel ? 5 : 3.4} fill={isSel ? gold : ink} opacity={isSel ? 1 : 0.5} />
							<text x={W - 52} y={y + rowH / 2 + 4} fontSize="12" fill={ink} textAnchor="end" fontWeight={isSel ? 700 : 500}>{s.body}</text>
							{isMoon ? <text x={W - 14} y={y + rowH / 2 + 4} fontSize="9" fill={gold} textAnchor="end">☾月</text> : null}
						</g>
					);
				})}
				<text x={W / 2} y={H - 8} fontSize="8.5" fill={ink} opacity="0.65" textAnchor="middle">结构图仅示「宫 → 部位」映射轴;楔文原件即为表格而非人像。</text>
			</svg>
		);
	}

	render(){
		const sel = babylonSign(this.state.sel);
		return (
			<div className="horosa-babylon-body" style={{ height: this.props.height }}>
				<div className="horosa-babylon-stage">
					<div className="horosa-babylon-svgwrap">{this.renderColumn()}</div>
				</div>
				<div className="horosa-babylon-readout">
					{this.props.schemePanel}
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">{sel ? sel.cn : ''} · 星医对应</div>
						<div>身体部位:<b>{sel ? sel.body : ''}</b>({sel ? sel.bodyAkk : ''})</div>
						<div>仪式配料:{sel ? sel.ingredient : ''}</div>
						<div>巫术/咒类:{sel && sel.magic ? sel.magic : '(该宫未见楔文记载)'}</div>
						<div className="horosa-babylon-caveat">
							应用逻辑:「〔宫/历单元〕→〔身体部位〕→ 用〔该宫石/草/木〕(于吉日)」。
							逐宫石草木与城庙名未公开原校——待补,不虚构。
						</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">吉日链(与吉日历相接)</div>
						<div>{HEMEROLOGY.links}</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">起源之辨(学界未决)</div>
						<div className="horosa-babylon-caveat">{NOTES.melothesia}</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">全表(宫 → 部位)</div>
						<table className="horosa-babylon-table">
							<thead><tr><th>宫</th><th>部位</th><th>楔文</th></tr></thead>
							<tbody>
								{BABYLON_SIGNS.map((s) => (
									<tr key={s.n} style={this.state.sel === s.n ? { fontWeight: 700 } : null}>
										<td>{s.cn}</td><td>{s.body}</td><td style={{ opacity: 0.75 }}>{s.bodyAkk}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		);
	}
}

export default BabylonMelothesia;
