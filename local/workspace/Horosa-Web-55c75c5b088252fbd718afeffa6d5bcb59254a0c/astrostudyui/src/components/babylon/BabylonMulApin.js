// components/babylon/BabylonMulApin.js —— P3 图式天文(约前一千年汇编)。
// 中栏:三道带状星空(北/中/南 33/23/15)+ ziqpu 中天环;右栏:偕日升表·月路 17 星·置闰·可见期。
import { Component } from 'react';
import { XQSegmented } from '../xq-ui';
import { MULAPIN, BABYLON_ZIQPU, BABYLON_ZIQPU_MULAPIN, NOTES } from '../../divination/data/babylonianData';
import { MONTHS } from '../../divination/babylon/calendar';

class BabylonMulApin extends Component{
	constructor(props){
		super(props);
		this.state = { view: 'paths' };
	}

	renderPaths(){
		const W = 640, H = 420;
		const dark = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-horosa-appearance') === 'dark');
		const ink = dark ? '#cabb92' : '#5b4423';
		const bands = [
			{ key: 'enlil', y: 30, h: 130, fill: dark ? 'rgba(79,111,156,0.12)' : 'rgba(79,111,156,0.08)', data: MULAPIN.paths.enlil },
			{ key: 'anu', y: 165, h: 120, fill: dark ? 'rgba(154,106,37,0.14)' : 'rgba(154,106,37,0.09)', data: MULAPIN.paths.anu },
			{ key: 'ea', y: 290, h: 105, fill: dark ? 'rgba(61,143,116,0.12)' : 'rgba(61,143,116,0.08)', data: MULAPIN.paths.ea },
		];
		// 伪随机稳定散点(名字 hash → 带内位置)
		const hash = (s) => { let h = 0; for(let i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) % 9973; } return h / 9973; };
		return (
			<svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
				{bands.map((b) => (
					<g key={b.key}>
						<rect x={10} y={b.y} width={W - 20} height={b.h} rx={10} fill={b.fill} stroke="rgba(122,94,48,0.28)" strokeWidth="0.8" />
						<text x={20} y={b.y + 17} fontSize="12.5" fontWeight="600" fill={ink}>{b.data.cn} · {b.data.count} 星(赤纬 {b.data.decl})</text>
						{b.data.stars.map((name, i) => {
							const sx = 24 + ((i + 0.5) / b.data.stars.length) * (W - 60);
							const sy = b.y + 30 + hash(name) * (b.h - 44);
							return (
								<g key={i}>
									<circle cx={sx} cy={sy} r={2.1} fill={ink} opacity={0.85} />
									<text x={sx} y={sy + 11} fontSize="7.5" fill={ink} textAnchor="middle" opacity={0.75}>{name.split('(')[0].slice(0, 8)}</text>
									<title>{name}</title>
								</g>
							);
						})}
						{b.data.caveat ? <text x={W - 18} y={b.y + 15} fontSize="8" fill={ink} opacity="0.55" textAnchor="end">⚠ {b.data.caveat}</text> : null}
					</g>
				))}
				<text x={W / 2} y={H - 6} fontSize="9" fill={ink} opacity="0.7" textAnchor="middle">三道以约 ±17° 赤纬为界;五行星行于中道(月路)。{MULAPIN.pathCountCaveat}</text>
			</svg>
		);
	}

	renderZiqpu(){
		const W = 560, H = 560, C = W / 2, R = 232;
		const dark = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-horosa-appearance') === 'dark');
		const ink = dark ? '#cabb92' : '#5b4423';
		const gold = dark ? '#b6934a' : '#9a6a25';
		// 累积角:每星距前星 us(总 359+5;按顺时针铺满 360)
		let acc = 0;
		const items = BABYLON_ZIQPU.map((z) => { acc += z.us; return { ...z, at: acc }; });
		const total = acc;
		const ang = (us, r) => {
			const t = (90 - us / total * 360) * Math.PI / 180;
			return [C + r * Math.cos(t), C - r * Math.sin(t)];
		};
		return (
			<svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
				<circle cx={C} cy={C} r={R} fill="none" stroke="rgba(122,94,48,0.35)" strokeWidth="1" />
				<circle cx={C} cy={C} r={R - 40} fill="none" stroke="rgba(122,94,48,0.18)" strokeWidth="0.7" strokeDasharray="2,4" />
				{items.map((z, i) => {
					const [x, y] = ang(z.at, R);
					const [tx, ty] = ang(z.at, R - 22);
					const [lx, ly] = ang(z.at, R + 16);
					return (
						<g key={z.r}>
							<line x1={tx} y1={ty} x2={x} y2={y} stroke={gold} strokeWidth="0.7" opacity="0.6" />
							<circle cx={x} cy={y} r={2.3} fill={gold} />
							<text x={lx} y={ly + 3} fontSize="8.2" fill={ink} textAnchor="middle">{z.cn}</text>
							<title>{`${z.r} ${z.cn}(${z.en})· ${z.modern} · 距前星 ${z.us} UŠ`}</title>
						</g>
					);
				})}
				<text x={C} y={C - 8} fontSize="12" fill={ink} textAnchor="middle" fontWeight="600">ziqpu 中天环</text>
				<text x={C} y={C + 12} fontSize="9" fill={ink} textAnchor="middle" opacity="0.75">12 bēru = 360°;1 UŠ = 1° = 4 分钟</text>
				<text x={C} y={C + 30} fontSize="8" fill={ink} textAnchor="middle" opacity="0.6">立于北道、对观测者胸口的中天之星,借以夜间报时</text>
			</svg>
		);
	}

	render(){
		return (
			<div className="horosa-babylon-body" style={{ height: this.props.height }}>
				<div className="horosa-babylon-stage" style={{ padding: 10 }}>
					<div style={{ marginBottom: 6 }}>
						<XQSegmented value={this.state.view}
							options={[{ value: 'paths', label: '三道星空' }, { value: 'ziqpu', label: 'ziqpu 中天环' }]}
							onChange={(e) => this.setState({ view: e.target.value })} />
					</div>
					<div className="horosa-babylon-svgwrap">
						{this.state.view === 'paths' ? this.renderPaths() : this.renderZiqpu()}
					</div>
				</div>
				<div className="horosa-babylon-readout">
					{this.props.schemePanel}
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">偕日升日期(理想历)</div>
						<table className="horosa-babylon-table">
							<thead><tr><th>日期</th><th>偕日升之星</th></tr></thead>
							<tbody>
								{MULAPIN.heliacal.map((h, i) => (
									<tr key={i}>
										<td>{(MONTHS[h.month - 1] || {}).akk}({(MONTHS[h.month - 1] || {}).cn}){h.day} 日</td>
										<td>{h.stars}{h.water ? <span style={{ opacity: 0.65 }}>(水钟 {h.water})</span> : null}</td>
									</tr>
								))}
							</tbody>
						</table>
						<div className="horosa-babylon-caveat">理想年 12×30=360 日;「某星于 M 月 d 日升」= 赤经 (d+(M−1)×30)°;日号皆 5 的倍数。{MULAPIN.intervals.join(';')}。</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">月路星(黄道前身,17 星)</div>
						<div>{MULAPIN.moonPath.join(' → ')}</div>
						<div className="horosa-babylon-caveat">{MULAPIN.moonPathCaveat} 后于约前 400 年规整为 12×30° 均匀黄道(星团/天牛并入金牛,燕/Anunitu 并入双鱼,雇工成白羊)。</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">汇编内 ziqpu 星(14)</div>
						<div>{BABYLON_ZIQPU_MULAPIN.join('、')}</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">五星图式可见期</div>
						<table className="horosa-babylon-table">
							<thead><tr><th>行星</th><th>可见</th><th>隐没</th></tr></thead>
							<tbody>
								{MULAPIN.visibility.map((v) => (
									<tr key={v.planet}><td>{v.cn}</td><td>{v.visible}</td><td>{v.invisible}</td></tr>
								))}
							</tbody>
						</table>
						<div className="horosa-babylon-caveat">{MULAPIN.visibilityNote}</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">置闰与昼夜(图式)</div>
						{MULAPIN.intercalation.rules.map((r, i) => <div key={i}>· {r}</div>)}
						<div className="horosa-babylon-caveat">{MULAPIN.intercalation.arithmetic} {MULAPIN.intercalation.dayNight}</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">ziqpu 距表出处</div>
						<div className="horosa-babylon-caveat">{NOTES.ziqpu}</div>
					</div>
				</div>
			</div>
		);
	}
}

export default BabylonMulApin;
