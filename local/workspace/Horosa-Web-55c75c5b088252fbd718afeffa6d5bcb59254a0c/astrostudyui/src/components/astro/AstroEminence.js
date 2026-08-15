// G18 显赫格局 Eminence(希腊化古典占星):显赫程度计分卡,嵌本命「古典」tab。
// 纯前端派生,零后端,零回归:只读现成 chartObj(chart.objects[].selfDignity/score/ofSect/house/phase + chart.houses + 希腊点 + chart.aspects.normalAsp)。
// 五指标各 0-2 分,总分 0-10 → 等级。计分核心 computeEminence 住 utils/astroClassicalDerived(零组件依赖单源,
// AI 快照 [古典·显赫计分] 段同引 —— AI 核禁 import 组件文件)。
// 角宫判定复用现成宫位分类(1/4/7/10 角宫);夜盘区间光体=月,缺福点/朔望降级。中性表述。
import { Component } from 'react';
import { SmallTable, astroSymbol } from './AstroExtraCommon';
import { computeEminence } from '../../utils/astroClassicalDerived';

const MUTED = 'var(--horosa-muted, #999)';
const GOLD = 'var(--horosa-gold, #b8860b)';

class AstroEminence extends Component{
	constructor(props){
		super(props);
		this.state = { open: false };
	}
	render(){
		const { open } = this.state;
		const chartObj = this.props.value;
		const data = computeEminence(chartObj);
		return (
			<div className="horosa-info-card horosa-classical-card">
				<div className="horosa-classical-card-title" style={{ cursor: 'pointer', justifyContent: 'space-between' }}
					onClick={() => this.setState({ open: !open })}>
					<span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
						<span className="horosa-classical-zh">显赫程度</span>
						<span className="horosa-classical-en">Eminence</span>
					</span>
					<span style={{ color: MUTED, fontSize: 12, flex: '0 0 auto' }}>
						{data.ok ? <span style={{ color: data.levelColor, fontWeight: 600, marginRight: 8 }}>{data.level}　{data.total}/10</span> : null}
						{open ? '收起 ▲' : '展开 ▼'}
					</span>
				</div>
				{open ? (
					!data.ok ? (
						<div style={{ marginTop: 8, color: MUTED, fontSize: 12 }}>数据不足,暂无法评估显赫程度。</div>
					) : (
						<div style={{ marginTop: 8 }}>
							<div style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>
								{data.isDay ? '昼生盘(区间光体=日)' : '夜生盘(区间光体=月)'}。五指标各 0-2 分,合计映射显赫等级。
								<span style={{ marginLeft: 6 }}>各分值为便于横向比较之现代计分,非典籍原文权重。</span>
							</div>
							<SmallTable
								rowKey={(r) => r.key}
								rows={data.rows}
								columns={[
									{ key: 'name', title: '指标', render: (v, r) => (
										<span>{v}{r.almuten ? <span style={{ marginLeft: 4 }}>{astroSymbol(r.almuten)}</span> : null}</span>
									) },
									{ key: 'factors', title: '满足要素' },
									{ key: 'score', title: '小分', render: (v) => (
										<span style={{ fontWeight: 600, color: v >= 1.5 ? GOLD : (v > 0 ? 'inherit' : MUTED) }}>{v}</span>
									) },
								]}
							/>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--horosa-border, rgba(120,120,120,0.28))' }}>
								<span style={{ fontWeight: 600 }}>总分 {data.total} / 10</span>
								<span style={{ color: data.levelColor, fontWeight: 700 }}>{data.level}</span>
							</div>
							<div style={{ color: MUTED, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
								显赫由两光位置、福点、护卫、盘主、四显赫点综合判定:总分 ≥8 显赫 / 6-7 显著 / 3-5 平凡 / &lt;3 暗晦。
								{data.note ? <div style={{ color: GOLD, marginTop: 2 }}>{data.note}</div> : null}
							</div>
						</div>
					)
				) : null}
			</div>
		);
	}
}

export default AstroEminence;
