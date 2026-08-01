// Tri-patākī Chakra(三旗盘)中栏渲染器(§11.11)。
// 数据 = chartObj.jyotish.tripataki(opt-in;判定引擎侧已委托 gochara)。零请求、只画。
// 三旗几何:权威只给「三面旗」意象未给格位 → 引擎按其自有 Kendradi 三分给 flagGroups
// (payload 已标 layoutSource='horosa_derived_kendradi',仅呈现分组不参与判定)。
// 半旗语义(本盘最有表现力的视觉):吉位被 Vedha 遮 → 旗面高度 ×0.5 + 虚线 + ⊘。
import React, { Component } from 'react';
import { indiaChartShouldUpdate } from './IndiaSouthChart';
import './IndiaTripatakiChart.less';

export const INDIA_TRIPATAKI_SCU_KEYS = ['value', 'height', 'center', 'monthIndex', 'label'];

const PLANET_CN = {
	Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木',
	Venus: '金', Saturn: '土', 'North Node': '罗', 'South Node': '计',
};

class IndiaTripatakiChart extends Component {
	shouldComponentUpdate(nextProps){
		return indiaChartShouldUpdate(this, nextProps, INDIA_TRIPATAKI_SCU_KEYS);
	}

	render(){
		const tri = this.props.value || null;
		const height = this.props.height || 640;
		if(!tri || !tri.byCenter){
			return (
				<div className="horosa-india-dasha-empty">
					三旗盘为按需计算(12 次逐月过运)——在右栏「年度」页开启后显示
				</div>
			);
		}
		const centerKey = this.props.center === 'saturn' ? 'saturn' : 'moon';
		const center = tri.byCenter[centerKey] || {};
		if(!center.available){
			return <div className="horosa-india-dasha-empty">暂无三旗盘数据(缺{centerKey === 'moon' ? '年盘月亮' : '年盘土星'})</div>;
		}
		const months = center.months || [];
		const mi = Math.min(Math.max(1, this.props.monthIndex || 1), months.length) - 1;
		const month = months[mi] || { rows: [] };
		const groups = tri.flagGroups || [];
		const size = Math.min(height, 700);
		return (
			<div className="horosa-india-tripataki" style={{ maxWidth: size }}>
				<div className="horosa-india-tripataki-title">
					三旗盘 · 中心 {centerKey === 'moon' ? '年盘月亮' : '年盘土星'}({center.centerSign})
					<em>{tri.layoutNote}</em>
				</div>
				{this.props.onCenterChange ? (
					<div className="horosa-india-tripataki-center-switch">
						{[{ v: 'moon', l: '月亮心' }, { v: 'saturn', l: '土星心' }].map((o)=>(
							<button key={o.v} type="button"
								className={`horosa-india-pill-toggle${(this.props.center || 'moon') === o.v ? ' is-active' : ''}`}
								onClick={()=>this.props.onCenterChange(o.v)}>{o.l}</button>
						))}
					</div>
				) : null}
				<div className="horosa-india-tripataki-flags">
					{groups.map((g)=>{
						const rows = (month.rows || []).filter((r)=>r.flagGroup === g.key);
						return (
							<div className="horosa-india-tripataki-flag" key={g.key}>
								<div className="horosa-india-tripataki-flag-head">{g.label}</div>
								<div className="horosa-india-tripataki-flag-pole">
									{rows.map((r)=>{
										const cls = r.blocked ? ' is-blocked' : (r.effective ? ' is-good' : (r.good === false ? ' is-bad' : ''));
										return (
											<div className={`horosa-india-tripataki-banner${cls}`} key={r.planet}
												title={`${r.planetLabel || r.planet} 第${r.house}宫${r.blocked ? ` · 被 ${PLANET_CN[r.vedhaBy] || r.vedhaBy || ''} Vedha 遮` : ''}`}>
												<span className="horosa-india-tripataki-glyph">{PLANET_CN[r.planet] || r.planet}</span>
												<span className="horosa-india-tripataki-house">{r.house}</span>
												{r.blocked ? <span className="horosa-india-tripataki-veto">⊘</span> : null}
											</div>
										);
									})}
									{!rows.length ? <div className="horosa-india-tripataki-emptyflag">—</div> : null}
								</div>
							</div>
						);
					})}
				</div>
				<div className="horosa-india-tripataki-months">
					{months.map((m, i)=>{
						const net = (m.score || {}).net || 0;
						const tone = net > 0 ? ' is-good' : (net < 0 ? ' is-bad' : '');
						return (
							<button
								type="button"
								key={m.month}
								className={`horosa-india-tripataki-month${i === mi ? ' is-active' : ''}${tone}`}
								onClick={()=>this.props.onMonthChange && this.props.onMonthChange(m.month)}
								title={`${m.label} · 净 ${net}(有效吉 ${(m.score || {}).effectiveGood} / 遮 ${(m.score || {}).blocked} / 凶 ${(m.score || {}).bad})`}
							>
								<strong>{m.month}</strong>
								<em>{net > 0 ? `+${net}` : net}</em>
							</button>
						);
					})}
				</div>
				<div className="horosa-india-tripataki-note">
					月界:{tri.monthBasis === 'equal12' ? '年首起每 1/12 回归年(权威未定义月界,如实标注)' : tri.monthBasis}
					· 半旗 = 吉位被 Vedha 遮(计入「遮」不计吉)
				</div>
			</div>
		);
	}
}

export default IndiaTripatakiChart;
