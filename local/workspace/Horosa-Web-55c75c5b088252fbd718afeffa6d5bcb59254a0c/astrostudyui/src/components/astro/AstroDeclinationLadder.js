import { Component, createRef } from 'react';
import { astroSymbol, cardStyle } from './AstroExtraCommon';

// 赤纬图（Declination graph）：赤纬非黄经，圆盘表达不了，故专门画。
// 成熟做法（避免行星符号在赤纬密集处堆叠看不清）：
//   每列一条「真值脊柱」，行星真实赤纬画成脊柱上的小圆点（平行/反平行连线走真值点，几何不失真）；
//   符号本体按 1D 去碰撞算法竖向错位排开（互不重叠），用引线连回各自真值点；符号推到两侧、中间留给连线。
// 数据来自后端 jaynesprog：natalDeclinations / 各 method.declinations / method.parallels。
const OBLIQUITY = 23.4366;

function declMap(arr){
	const m = {};
	(arr || []).forEach((d)=>{ m[d.id] = d.decl; });
	return m;
}

// 1D 去碰撞：按真值 y 排序，相邻不足 minGap 则下推；超下界整体上移；保持单调、尽量贴近真值。
function dodgeColumn(items, minGap, top, bottom){
	const sorted = items.map((it)=>({ ...it })).sort((a, b)=>a.trueY - b.trueY);
	let prev = -Infinity;
	sorted.forEach((it)=>{ it.y = Math.max(it.trueY, prev + minGap); prev = it.y; });
	if(sorted.length){
		const overflow = sorted[sorted.length - 1].y - bottom;
		if(overflow > 0){ sorted.forEach((it)=>{ it.y -= overflow; }); }
		const minY = sorted[0].y;
		if(minY < top){ const sh = top - minY; sorted.forEach((it)=>{ it.y += sh; }); }
	}
	return sorted;
}

class AstroDeclinationLadder extends Component{
	constructor(props){
		super(props);
		this.state = { width: 560 };
		this.ref = createRef();
		this.measure = this.measure.bind(this);
	}

	componentDidMount(){
		this.measure();
		if(typeof window !== 'undefined'){ window.addEventListener('resize', this.measure); }
		// [Tahoe 订阅补齐] 容器 RO:量的是 ref 容器宽(由外层布局决定,measure 不改它,无循环)。
		try{
			if(typeof ResizeObserver !== 'undefined' && this.ref.current){
				this._hostRO = new ResizeObserver(this.measure);
				this._hostRO.observe(this.ref.current);
			}
		}catch(e){ this._hostRO = null; }
	}
	componentDidUpdate(){ this.measure(); }
	componentWillUnmount(){
		if(typeof window !== 'undefined'){ window.removeEventListener('resize', this.measure); }
		if(this._hostRO){ try{ this._hostRO.disconnect(); }catch(e){ /* noop */ } this._hostRO = null; }
	}

	measure(){
		if(this.ref.current){
			const w = this.ref.current.clientWidth;
			if(w && Math.abs(w - this.state.width) > 2){ this.setState({ width: w }); }
		}
	}

	render(){
		const H = this.props.height || 560;
		const W = this.state.width || 560;
		const natal = this.props.natalDeclinations || [];
		const prog = this.props.progressedDeclinations || [];
		const parallels = this.props.parallels || [];
		const nMap = declMap(natal), pMap = declMap(prog);
		const allAbs = [...natal, ...prog].map((d)=>Math.abs(d.decl || 0));
		const maxAbs = Math.max(24, Math.ceil((allAbs.length ? Math.max.apply(null, allAbs) : 0) + 1));
		const padTop = 58, padBottom = 30;
		const plotH = Math.max(140, H - padTop - padBottom);
		const y = (dec)=> padTop + (maxAbs - dec) / (2 * maxAbs) * plotH;

		const natalSpineX = Math.round(W * 0.40);
		const progSpineX = Math.round(W * 0.60);
		const leftEdge = 34, rightEdge = W - 14;
		const GLYPH = 22, DEG = 11, MIN_GAP = 27, LEADER = 12;

		const axisColor = 'var(--horosa-border, #b9b2a3)';
		const eqColor = 'var(--horosa-text-soft, #8a8472)';
		const parColor = 'var(--horosa-ziwei-period-month, #2f9e44)';
		const contraColor = 'var(--horosa-ziwei-period-hour, #e8590c)';
		const oobColor = 'var(--horosa-ziwei-period-day, #e64980)';
		const dotColor = 'var(--horosa-text, #d8d2c4)';

		const ticks = [];
		for(let t = Math.ceil(-maxAbs / 10) * 10; t <= maxAbs; t += 10){ ticks.push(t); }

		const natalDodge = dodgeColumn(natal.map((d)=>({ id: d.id, decl: d.decl, trueY: y(d.decl) })), MIN_GAP, padTop, padTop + plotH);
		const progDodge = dodgeColumn(prog.map((d)=>({ id: d.id, decl: d.decl, trueY: y(d.decl) })), MIN_GAP, padTop, padTop + plotH);

		const glyphDiv = (it, side)=>{
			const oob = Math.abs(it.decl) > OBLIQUITY;
			const deg = (it.decl >= 0 ? '+' : '') + it.decl.toFixed(1) + '°';
			const isNatal = side === 'n';
			const style = {
				position: 'absolute',
				top: it.y,
				left: isNatal ? (natalSpineX - LEADER) : (progSpineX + LEADER),
				transform: isNatal ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
				display: 'flex', alignItems: 'center', gap: 5,
				flexDirection: isNatal ? 'row' : 'row',
				whiteSpace: 'nowrap', pointerEvents: 'none', lineHeight: 1,
			};
			const glyph = <span key="g" style={{ fontSize: GLYPH, lineHeight: 1, color: oob ? oobColor : 'inherit', fontWeight: oob ? 700 : 400 }}>{astroSymbol(it.id)}</span>;
			const degLab = <span key="d" style={{ fontSize: DEG, opacity: 0.6 }}>{deg}</span>;
			return (
				<div key={side + it.id} style={style}>
					{isNatal ? [degLab, glyph] : [glyph, degLab]}
				</div>
			);
		};

		return (
			<div ref={this.ref} style={{ ...cardStyle, position: 'relative', height: H, overflow: 'hidden' }}>
				<div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', fontSize: 13, fontWeight: 600, opacity: 0.85 }}>赤纬图</div>
				<div style={{ position: 'absolute', top: 30, left: 0, right: 0, textAlign: 'center', fontSize: 11, opacity: 0.6 }}>平行<span style={{ color: parColor }}>━</span>　反平行<span style={{ color: contraColor }}>━</span>　<span style={{ color: oobColor }}>玫色＝赤纬出界</span></div>
				<div style={{ position: 'absolute', top: 40, left: natalSpineX, transform: 'translateX(-50%)', fontSize: 13, fontWeight: 600, opacity: 0.9 }}>本命</div>
				<div style={{ position: 'absolute', top: 40, left: progSpineX, transform: 'translateX(-50%)', fontSize: 13, fontWeight: 600, opacity: 0.9 }}>推运</div>
				<svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
					{ticks.map((t)=>(
						<g key={'t' + t}>
							<line x1={leftEdge} x2={rightEdge} y1={y(t)} y2={y(t)} stroke={axisColor} strokeWidth="0.5" opacity="0.18" />
							<text x={6} y={y(t) + 3.5} fontSize="11" fill={eqColor}>{(t > 0 ? '+' : '') + t}°</text>
						</g>
					))}
					<line x1={leftEdge} x2={rightEdge} y1={y(OBLIQUITY)} y2={y(OBLIQUITY)} stroke={axisColor} strokeDasharray="5 4" strokeWidth="1" opacity="0.7" />
					<line x1={leftEdge} x2={rightEdge} y1={y(-OBLIQUITY)} y2={y(-OBLIQUITY)} stroke={axisColor} strokeDasharray="5 4" strokeWidth="1" opacity="0.7" />
					<text x={rightEdge} y={y(OBLIQUITY) - 4} fontSize="10" fill={eqColor} textAnchor="end">出界 +23°26′</text>
					<text x={rightEdge} y={y(-OBLIQUITY) + 12} fontSize="10" fill={eqColor} textAnchor="end">出界 −23°26′</text>
					<line x1={leftEdge} x2={rightEdge} y1={y(0)} y2={y(0)} stroke={eqColor} strokeWidth="1.5" />
					<text x={6} y={y(0) - 4} fontSize="10" fill={eqColor}>赤道 0°</text>
					{/* 脊柱 */}
					<line x1={natalSpineX} x2={natalSpineX} y1={padTop} y2={padTop + plotH} stroke={axisColor} strokeWidth="1" opacity="0.35" />
					<line x1={progSpineX} x2={progSpineX} y1={padTop} y2={padTop + plotH} stroke={axisColor} strokeWidth="1" opacity="0.35" />
					{/* 平行/反平行：连真值点 */}
					{parallels.map((p, i)=>{
						const db = nMap[p.b], da = pMap[p.a];
						if(db === undefined || da === undefined){ return null; }
						const col = p.type === 'contraparallel' ? contraColor : parColor;
						return <line key={'p' + i} x1={natalSpineX} y1={y(db)} x2={progSpineX} y2={y(da)} stroke={col} strokeWidth="1.3" opacity="0.85" />;
					})}
					{/* 真值点 + 引线到错位后的符号 */}
					{natalDodge.map((it)=>(
						<g key={'nl' + it.id}>
							<circle cx={natalSpineX} cy={it.trueY} r="2.6" fill={dotColor} opacity="0.9" />
							<line x1={natalSpineX} y1={it.trueY} x2={natalSpineX - LEADER} y2={it.y} stroke={dotColor} strokeWidth="0.7" opacity="0.45" />
						</g>
					))}
					{progDodge.map((it)=>(
						<g key={'pl' + it.id}>
							<circle cx={progSpineX} cy={it.trueY} r="2.6" fill={dotColor} opacity="0.9" />
							<line x1={progSpineX} y1={it.trueY} x2={progSpineX + LEADER} y2={it.y} stroke={dotColor} strokeWidth="0.7" opacity="0.45" />
						</g>
					))}
				</svg>
				{natalDodge.map((it)=>glyphDiv(it, 'n'))}
				{progDodge.map((it)=>glyphDiv(it, 'p'))}
			</div>
		);
	}
}

export default AstroDeclinationLadder;
