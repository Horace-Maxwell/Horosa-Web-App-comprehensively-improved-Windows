// components/babylon/BabylonEphemeris.js —— P2 数理星历(五星 System A/B + 月亮列)。
// 表 = 逐次会合现象(黄经+间隔月/tithi);迷你图 = 阶梯(A)/锯齿(B)会合弧随黄经/序号变化。
// 锚 = 本盘该行星恒星黄经(可视作「以出生位置起算的推演」;真实古星历以观测现象为锚)。
import { Component } from 'react';
import { XQSegmented, XQSelect } from '../xq-ui';
import {
	jupiterSeriesA, saturnSeriesA, marsSeriesA, mercurySeriesA, venusSeriesA, jupiterSeriesB,
	lunarPhiSeq, lunarBSeq, dayLengthC, cPrime, lunarFSeqA, LUNAR_F_A, LUNAR_PHI,
	sarosPattern, TRAPEZOID,
} from '../../divination/babylon/mathAstro';
import { SYSTEM_A, SYSTEM_B, LUNAR, PERIOD_RELATIONS, DATE_CONSTANTS, SAROS } from '../../divination/data/babylonianData';
import { sexFormat, sexParse, lonToSignDeg } from '../../divination/babylon/units';
import { BABYLON_SIGNS } from '../../divination/data/babylonianData';

const S = sexParse;
function signDeg(lon){
	const { sign, deg } = lonToSignDeg(lon);
	const s = BABYLON_SIGNS[sign - 1];
	return `${s ? s.cn : sign} ${sexFormat(deg, { frac: 1 })}°`;
}

const PLANET_TABS = [
	{ key: 'jupiter', cn: '木星' }, { key: 'saturn', cn: '土星' }, { key: 'mars', cn: '火星' },
	{ key: 'venus', cn: '金星' }, { key: 'mercury', cn: '水星' }, { key: 'moon', cn: '月亮' },
];
const MERCURY_PHASES = [
	{ value: 'mf', label: '晨初见 Γ' }, { value: 'ef', label: '昏初见 Ξ' },
	{ value: 'ml', label: '晨末见 Σ' }, { value: 'el', label: '昏末见 Ω' },
];
const VENUS_PHASES = [
	{ value: 'el', label: '昏末见 Ω(恒 215;30)' }, { value: 'mf', label: '晨初见 Γ' },
	{ value: 'ml', label: '晨末见 Σ' }, { value: 'ef', label: '昏初见 Ξ' },
];

class BabylonEphemeris extends Component{
	constructor(props){
		super(props);
		this.state = { planet: 'jupiter', mercuryPhase: 'mf', venusPhase: 'el', rows: 24 };
	}

	series(){
		const { planet, mercuryPhase, venusPhase, rows } = this.state;
		const src = (this.props.opts || {}).ephemerisSource || 'swiss';
		const useB = src === 'systemB';
		const lons = this.props.lons || {};
		const anchor = lons[planet] !== undefined ? lons[planet] : 0;
		if(planet === 'jupiter'){
			return useB ? jupiterSeriesB(anchor, rows) : jupiterSeriesA(anchor, rows);
		}
		if(planet === 'saturn'){ return saturnSeriesA(anchor, rows); }
		if(planet === 'mars'){ return marsSeriesA(anchor, rows); }
		if(planet === 'venus'){ return venusSeriesA(anchor, venusPhase, rows); }
		if(planet === 'mercury'){ return mercurySeriesA(anchor, mercuryPhase, rows); }
		return null;
	}

	renderStepGraph(zones){
		// 阶梯函数迷你图:x=黄经 0–360,y=会合弧
		const W = 520, H = 130, pad = 26;
		const ws = zones.map((z) => S(z.w));
		const maxW = Math.max(...ws) * 1.12, minW = Math.min(...ws) * 0.85;
		const x = (lon) => pad + (lon / 360) * (W - pad * 2);
		const y = (w) => H - pad / 2 - ((w - minW) / (maxW - minW)) * (H - pad * 1.4);
		const segs = [];
		zones.forEach((z, i) => {
			const from = z.from, to = z.to < z.from ? z.to + 360 : z.to;
			const w = S(z.w);
			segs.push(<line key={`s${i}`} x1={x(from)} y1={y(w)} x2={x(Math.min(to, 360))} y2={y(w)} stroke="#9a6a25" strokeWidth="2.2" />);
			if(to > 360){
				segs.push(<line key={`s${i}b`} x1={x(0)} y1={y(w)} x2={x(to - 360)} y2={y(w)} stroke="#9a6a25" strokeWidth="2.2" />);
			}
			segs.push(<text key={`t${i}`} x={x((from + Math.min(to, from + (to - from) / 2)) % 360 === 0 ? from + 8 : (from + (to - from) / 2) % 360)} y={y(w) - 5} fontSize="9" fill="#9a6a25" textAnchor="middle">{z.w}</text>);
		});
		return (
			<svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 640 }}>
				<line x1={pad} y1={H - pad / 2} x2={W - pad} y2={H - pad / 2} stroke="rgba(122,94,48,0.35)" strokeWidth="0.8" />
				{[0, 90, 180, 270, 360].map((d) => (
					<text key={d} x={x(d)} y={H - 2} fontSize="8.5" fill="rgba(122,94,48,0.7)" textAnchor="middle">{d}°</text>
				))}
				{segs}
			</svg>
		);
	}

	renderZigzagGraph(params, n){
		const W = 520, H = 130, pad = 26;
		const m = S(params.m), M = S(params.M);
		const seq = [];
		{
			let v = S(params.mu), dir = 1;
			const d = S(params.d);
			for(let i = 0; i < n; i++){
				seq.push(v);
				v += dir * d;
				if(v > M){ v = 2 * M - v; dir = -1; }
				else if(v < m){ v = 2 * m - v; dir = 1; }
			}
		}
		const x = (i) => pad + (i / (n - 1)) * (W - pad * 2);
		const y = (v) => H - pad / 2 - ((v - m * 0.98) / (M * 1.02 - m * 0.98)) * (H - pad * 1.4);
		const pts = seq.map((v, i) => `${x(i)},${y(v)}`).join(' ');
		return (
			<svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 640 }}>
				<line x1={pad} y1={y(M)} x2={W - pad} y2={y(M)} stroke="rgba(191,60,54,0.4)" strokeDasharray="3,3" strokeWidth="0.8" />
				<line x1={pad} y1={y(m)} x2={W - pad} y2={y(m)} stroke="rgba(61,143,116,0.4)" strokeDasharray="3,3" strokeWidth="0.8" />
				<text x={W - pad + 2} y={y(M) + 3} fontSize="8.5" fill="#bf3c36">M</text>
				<text x={W - pad + 2} y={y(m) + 3} fontSize="8.5" fill="#3d8f74">m</text>
				<polyline points={pts} fill="none" stroke="#9a6a25" strokeWidth="1.6" />
			</svg>
		);
	}

	renderPlanetTable(ser){
		return (
			<div className="horosa-babylon-scroll-x">
				<table className="horosa-babylon-table">
					<thead><tr><th>#</th><th>黄经</th><th>宫位</th><th>会合弧 Δλ</th><th>间隔(Δt)</th></tr></thead>
					<tbody>
						{ser.map((r, i) => (
							<tr key={i}>
								<td className="num">{i + 1}</td>
								<td className="num">{r.lon.toFixed(2)}°</td>
								<td>{signDeg(r.lon)}</td>
								<td className="num">{r.w !== undefined ? sexFormat(r.w, { frac: 2 }) + '°' : '—'}</td>
								<td className="num">{r.months !== undefined ? `${r.months} 月 + ${sexFormat(r.tithi, { frac: 2 })} t` : '—'}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	}

	renderMoon(){
		const n = 24;
		const PHI_GRAPH_STEPS = 40;   // 锯齿图步数(与表行数 n 分离;标题与绘图必须同源,曾一处写 24 一处画 40)
		const phi = lunarPhiSeq(n);
		const lonsSun = lunarBSeq((this.props.lons || {}).sun || 0, n);
		const f = lunarFSeqA(n);
		const rows = [];
		let prevC = null;
		for(let i = 0; i < n; i++){
			const c = dayLengthC(lonsSun[i].lon, (this.props.opts || {}).solstice === 'B8' ? 8 : 10);
			rows.push({
				i: i + 1,
				phi: phi[i],
				b: lonsSun[i].lon,
				bw: lonsSun[i].w,
				c,
				cp: prevC === null ? null : cPrime(prevC, c),
				f: f[i],
			});
			prevC = c;
		}
		return (
			<div style={{ width: '100%' }}>
				<div className="horosa-babylon-card">
					<div className="horosa-babylon-card-title">月亮多列星历(逐朔望;可真算列)</div>
					<div className="horosa-babylon-scroll-x">
						<table className="horosa-babylon-table">
							<thead><tr><th>行</th><th>Φ(UŠ)</th><th>B 太阳黄经</th><th>太阳月速</th><th>C 昼长(UŠ)</th><th>C′</th><th>F 月速(°/日)</th></tr></thead>
							<tbody>
								{rows.map((r) => (
									<tr key={r.i}>
										<td className="num">{r.i}</td>
										<td className="num">{sexFormat(r.phi, { frac: 2, intGroups: true })}</td>
										<td>{signDeg(r.b)}</td>
										<td className="num">{sexFormat(r.bw, { frac: 2 })}</td>
										<td className="num">{r.c.toFixed(1)}</td>
										<td className="num">{r.cp === null ? '—' : r.cp.toFixed(2)}</td>
										<td className="num">{sexFormat(r.f, { frac: 2 })}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="horosa-babylon-caveat">
						Φ 锯齿 M={LUNAR_PHI.M} / m={LUNAR_PHI.m} / d={LUNAR_PHI.d}(周期 6247 月 ≈ 505 年);
						B 太阳两带 快 30;0(处女13°→双鱼27°)/慢 28;7,30;C 按 3:2 比(216/144/180 UŠ)。
						F 极值为由 μ/d/周期派生(非原校);E(黄纬)/Ψ(食分)/G/J 之精确参数未公开原校——
						结构:Φ→E→Ψ(节点偏移 ±6 finger)、K=G+J、M(n)=M(n−1)+29ᵈ+K。
					</div>
				</div>
				<div className="horosa-babylon-card">
					<div className="horosa-babylon-card-title">Φ 列锯齿(前 {PHI_GRAPH_STEPS} 步)</div>
					{this.renderZigzagGraph(LUNAR_PHI, PHI_GRAPH_STEPS)}
				</div>
				<div className="horosa-babylon-card">
					<div className="horosa-babylon-card-title">Saros 食可能格局(38 = 33×6 + 5×5)</div>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
						{sarosPattern().map((m, i) => (
							<span key={i} className="horosa-babylon-badge" style={{ minWidth: 30, textAlign: 'center' }}>{m}</span>
						))}
					</div>
					<div className="horosa-babylon-caveat">
						一 Saros(223 朔望月 = 242 交点月 = 239 近点月 ≈ 18 年 11 日 8 时)内食可能之月序;
						分 5 组 8,7,8,7,8,组内隔 6 月、组间 5 月。选食:黄纬变号附近 |E| 最小(E 规则)或 Ψ′ 刚转正(Ψ′ 规则)。
					</div>
				</div>
			</div>
		);
	}

	render(){
		const { planet } = this.state;
		const src = (this.props.opts || {}).ephemerisSource || 'swiss';
		const ser = planet === 'moon' ? null : this.series();
		const zones = planet === 'jupiter' ? SYSTEM_A.jupiter.zones
			: planet === 'saturn' ? SYSTEM_A.saturn.zones
			: planet === 'mars' ? SYSTEM_A.mars.zones
			: planet === 'mercury' ? SYSTEM_A.mercury[this.state.mercuryPhase].zones
			: planet === 'venus' && this.state.venusPhase !== 'el' ? SYSTEM_A.venus[this.state.venusPhase]
			: null;
		const period = PERIOD_RELATIONS.find((p) => p.planet === planet);
		const dc = DATE_CONSTANTS.find((p) => p.planet === planet);
		return (
			<div className="horosa-babylon-body" style={{ height: this.props.height }}>
				<div className="horosa-babylon-stage" style={{ padding: 10 }}>
					<div style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
						<XQSegmented value={planet} options={PLANET_TABS.map((p) => ({ value: p.key, label: p.cn }))}
							onChange={(e) => this.setState({ planet: e.target.value })} />
						{planet === 'mercury' ? (
							<XQSelect size="small" style={{ minWidth: 150 }} value={this.state.mercuryPhase}
								options={MERCURY_PHASES} onChange={(v) => this.setState({ mercuryPhase: v })} />
						) : null}
						{planet === 'venus' ? (
							<XQSelect size="small" style={{ minWidth: 190 }} value={this.state.venusPhase}
								options={VENUS_PHASES} onChange={(v) => this.setState({ venusPhase: v })} />
						) : null}
					</div>
					{planet === 'moon' ? this.renderMoon() : (
						<div style={{ width: '100%' }}>
							{zones ? (
								<div className="horosa-babylon-card">
									<div className="horosa-babylon-card-title">阶梯函数(会合弧随黄经分带)</div>
									{this.renderStepGraph(zones)}
								</div>
							) : null}
							{planet === 'jupiter' && src === 'systemB' ? (
								<div className="horosa-babylon-card">
									<div className="horosa-babylon-card-title">锯齿函数(会合弧随序号)</div>
									{this.renderZigzagGraph(SYSTEM_B.jupiter, 30)}
								</div>
							) : null}
							<div className="horosa-babylon-card">
								<div className="horosa-babylon-card-title">现象序列(自本盘位置推演 {this.state.rows} 步)</div>
								{ser ? this.renderPlanetTable(ser) : null}
							</div>
						</div>
					)}
				</div>
				<div className="horosa-babylon-readout">
					{this.props.schemePanel}
					{period ? (
						<div className="horosa-babylon-card">
							<div className="horosa-babylon-card-title">周期关系</div>
							<div>Π = {period.Pi} 现象 · Z = {period.Z} 黄道回 · Y = {period.Y} 年</div>
							<div>均会合弧 = {period.arc}(= {period.arcDec}°)</div>
							{period.note ? <div className="horosa-babylon-caveat">{period.note}</div> : null}
						</div>
					) : null}
					{dc ? (
						<div className="horosa-babylon-card">
							<div className="horosa-babylon-card-title">日期常数</div>
							<div>Δt = Δλ + c;c = {dc.c} tithi · 整月基数 {dc.baseMonths} 月</div>
							{dc.variants ? <div className="horosa-babylon-caveat">变体:{dc.variants}</div> : null}
						</div>
					) : null}
					{planet === 'jupiter' ? (
						<div className="horosa-babylon-card">
							<div className="horosa-babylon-card-title">梯形法(速度线性递减)</div>
							<div>首 60 日行 10;45°;日 60–120 行 5;30°。</div>
							<div>速度-时间图下面积即行程;等积二分得半程时刻 ≈ 第 {TRAPEZOID.tau.toFixed(1)} 日(非时间中点)。</div>
							<div className="horosa-babylon-caveat">速度线性 → 位置随时间二次;半程时刻由两面积值解出。另有「推」细分:第一留→冲 −4;25°、冲→第二留 −5;35°(全逆行 −10;0°);可见期 1/3 处第一留、1/2 处冲、2/3 处第二留。</div>
						</div>
					) : null}
					{planet === 'mercury' ? (
						<div className="horosa-babylon-card">
							<div className="horosa-babylon-card-title">水星四相位分带(逐带核得)</div>
							{MERCURY_PHASES.map((ph) => {
								const t = SYSTEM_A.mercury[ph.value];
								return (
									<div key={ph.value} style={{ marginBottom: 4 }}>
										<b>{ph.label}</b>(周期 {t.period};Δλ={t.dLam};c={t.c})
										<div style={{ opacity: 0.8, fontSize: 11.5 }}>
											{t.zones.map((z, i) => `${z.w}@${z.from}°`).join(' · ')}
										</div>
									</div>
								);
							})}
							<div className="horosa-babylon-caveat">14 个振幅中 9 个大于本带带长 → 一步常跨两界;另有最早的「三列星历」系统:两带 −20;0/−16;0(界巨蟹 20°),每步=3 会合。</div>
						</div>
					) : null}
					{planet === 'mars' || planet === 'saturn' ? (
						<div className="horosa-babylon-card">
							<div className="horosa-babylon-card-title">锯齿(System B)参数</div>
							<div>{planet === 'mars' ? `仅均值 μ=${SYSTEM_B.mars.mu} 确;极值未公开原校。` : `仅 d=${SYSTEM_B.saturn.d} 确(三变体同 d);极值未公开原校。`}</div>
						</div>
					) : null}
					{planet === 'venus' ? (
						<div className="horosa-babylon-card">
							<div className="horosa-babylon-card-title">金星说明</div>
							<div>各现象弧值为「超出 360°」部分(真跳 = 360° + 值);昏末见全黄道恒 215;30°。</div>
							<div className="horosa-babylon-caveat">8 年 ≈ 5 会合(octaeteris);无真正锯齿系统。</div>
						</div>
					) : null}
				</div>
			</div>
		);
	}
}

export default BabylonEphemeris;
