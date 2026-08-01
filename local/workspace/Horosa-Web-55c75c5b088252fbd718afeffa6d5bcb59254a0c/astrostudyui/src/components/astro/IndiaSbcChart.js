// Sarvatobhadra Chakra(SBC,全吉盘)中栏渲染器(§24.1)。
// 数据 = chartObj.jyotish.sarvatobhadra(引擎纯派生);本组件零请求、零计算,只画。
// 分层照抄北印/东印范式:SVG 只画网格线 + 高亮(pointer-events:none),其上叠 DOM 格承载文本。
// viewBox 0 0 99 99:9 格 × 每格恰 11 个整数单位(避开 33.333 小数抖动的既有教训)。
// 🔴 降级契约:layout.source==='placeholder_sequential' 时环序为占位(显式打标),
//    Vedha 图层引擎已禁(vedhaGraph/hits 全空)—— 本组件照实呈现,绝不自造 Vedha。
import React, { Component } from 'react';
import { indiaChartShouldUpdate } from './IndiaSouthChart';
import './IndiaSbcChart.less';

// 自有 SCU 键(🔴 不改动 INDIA_CHART_SCU_KEYS —— chartSCU.test.js 三盘 block 须逐字不变)
export const INDIA_SBC_SCU_KEYS = ['value', 'height', 'focusRef', 'label'];

const CELL = 11;                       // 99 / 9

class IndiaSbcChart extends Component {
	shouldComponentUpdate(nextProps){
		return indiaChartShouldUpdate(this, nextProps, INDIA_SBC_SCU_KEYS);
	}

	render(){
		const sbc = this.props.value || null;
		const height = this.props.height || 640;
		if(!sbc || !sbc.layout || !(sbc.layout.rows || []).length){
			return <div className="horosa-india-dasha-empty">暂无全吉盘数据</div>;
		}
		const rows = sbc.layout.rows;
		const placeholder = sbc.layout.source !== 'classical';
		const focus = this.props.focusRef || 'moon';
		const refs = sbc.natalRefs || {};
		const focusNak = refs[focus];
		const hits = sbc.hits || [];
		const hitNaks = new Set(hits.map((h)=>h.transitNak28));
		// 过运曜落宿(引擎恒出 transits;占位环序下宿序=环序,照落格标注)
		const PLANET_CN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木',
			Venus: '金', Saturn: '土', 'North Node': '罗', 'South Node': '计' };
		const MALEFIC = { Sun: 1, Mars: 1, Saturn: 1, 'North Node': 1, 'South Node': 1 };
		const transitByNak = {};
		(sbc.transits || []).forEach((t)=>{
			if(!transitByNak[t.nak28]){ transitByNak[t.nak28] = []; }
			transitByNak[t.nak28].push(t.planet);
		});
		const NAK_LABEL = {};
		rows.forEach((x)=>{ NAK_LABEL[x.nak28] = x.labelCn; });
		const size = Math.min(height, 720);
		return (
			<div className="horosa-india-sbc" style={{ width: size, height: size }}>
				<svg viewBox="0 0 99 99" className="horosa-india-sbc-lines" aria-hidden="true">
					{/* 外框(粗金)+ 四角 L 形饰线 */}
					<rect x="0.3" y="0.3" width="98.4" height="98.4" className="horosa-india-sbc-frame" />
					{[[2, 2, 1, 0], [97, 2, -1, 0], [2, 97, 1, 0], [97, 97, -1, 0]].map(([x, y, dx], i)=>(
						<path key={`cn${i}`} className="horosa-india-sbc-corner-deco"
							d={`M ${x + dx * 4} ${y} L ${x} ${y} L ${x} ${y + (y < 50 ? 4 : -4)}`} />
					))}
					{/* 9×9 网格线 */}
					{Array.from({ length: 10 }, (_, i)=>(
						<React.Fragment key={i}>
							<line x1={i * CELL} y1="0" x2={i * CELL} y2="99" />
							<line x1="0" y1={i * CELL} x2="99" y2={i * CELL} />
						</React.Fragment>
					))}
					{/* 四隅空:斜杠示不用 */}
					{[[0, 0], [0, 8], [8, 0], [8, 8]].map(([r, c])=>(
						<line key={`x${r}${c}`} x1={c * CELL + 2} y1={r * CELL + 2}
							x2={c * CELL + CELL - 2} y2={r * CELL + CELL - 2}
							className="horosa-india-sbc-corner" />
					))}
					{/* 本命参照格高亮(填充+描边双层) */}
					{rows.filter((x)=>x.nak28 === focusNak).map((x)=>(
						<React.Fragment key={`f${x.ringIndex}`}>
							<rect x={x.col * CELL} y={x.row * CELL}
								width={CELL} height={CELL} className="horosa-india-sbc-focus" />
							<rect x={x.col * CELL + 0.5} y={x.row * CELL + 0.5}
								width={CELL - 1} height={CELL - 1} className="horosa-india-sbc-focus-ring" />
						</React.Fragment>
					))}
					{/* Vedha 命中格(仅经典锚在位时引擎才产) */}
					{rows.filter((x)=>hitNaks.has(x.nak28)).map((x)=>(
						<rect key={`h${x.ringIndex}`} x={x.col * CELL} y={x.row * CELL}
							width={CELL} height={CELL} className="horosa-india-sbc-hit" />
					))}
				</svg>
				{rows.map((x)=>(
					<div
						key={x.ringIndex}
						className={`horosa-india-sbc-cell${x.isAbhijit ? ' is-abhijit' : ''}${x.nak28 === focusNak ? ' is-focus' : ''}`}
						style={{ left: `${(x.col * CELL / 99) * 100}%`, top: `${(x.row * CELL / 99) * 100}%`,
							width: `${(CELL / 99) * 100}%`, height: `${(CELL / 99) * 100}%` }}
						title={`${x.sanskrit} · 第${x.nak28}宿${x.isAbhijit ? '(织女 Abhijit)' : ''}`}
					>
						<strong>{x.labelCn}</strong>
						<em>{x.nak28}</em>
						{(transitByNak[x.nak28] || []).length ? (
							<span className="horosa-india-sbc-transits">
								{transitByNak[x.nak28].map((pid)=>(
									<i key={pid} className={MALEFIC[pid] ? 'is-mal' : 'is-ben'}>{PLANET_CN[pid] || pid}</i>
								))}
							</span>
						) : null}
					</div>
				))}
				<div className="horosa-india-sbc-center">
					<span className="horosa-india-sbc-center-badge">
						<strong>全吉盘</strong>
						<em>{placeholder ? '环序占位 · 非经典格位' : 'Sarvatobhadra'}</em>
						<span className="horosa-india-sbc-center-refs">
							{refs.moon ? <b>月宿 {NAK_LABEL[refs.moon] || refs.moon}</b> : null}
							{refs.lagna ? <b>升宿 {NAK_LABEL[refs.lagna] || refs.lagna}</b> : null}
						</span>
						{(sbc.transits || []).length ? (
							<span className="horosa-india-sbc-center-transits">
								{(sbc.transits || []).map((t)=>(
									<b key={t.planet} className={MALEFIC[t.planet] ? 'is-mal' : 'is-ben'}>
										{PLANET_CN[t.planet] || t.planet}·{NAK_LABEL[t.nak28] || t.nak28}
									</b>
								))}
							</span>
						) : null}
						{placeholder ? (
							<small>经典环锚待录入 · Vedha 判定按纪律禁用</small>
						) : null}
					</span>
				</div>
			</div>
		);
	}
}

export default IndiaSbcChart;
