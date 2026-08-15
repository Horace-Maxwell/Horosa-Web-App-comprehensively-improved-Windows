// G19 派生宫 / 转宫(希腊化占星·整宫制):以第 b 宫为第 1 宫,重派十二宫话题。
// 纯前端派生,嵌本命「古典」tab;读 chartObj.chart.houses + objects[].house;不改主盘。中性表述。
import { Component } from 'react';
import { astroSymbol, SmallTable } from './AstroExtraCommon';
import { SIGNS } from '../../divination/data/signs';
import { chartIdOfKey } from '../../utils/dispositorChain';
// 派生核心 deriveDerivedHouseRows 住 utils/astroClassicalDerived 单源(AI 快照 [古典·派生宫转宫] 段同引)。
import { deriveDerivedHouseRows } from '../../utils/astroClassicalDerived';

const sn = (s) => (SIGNS[s] && SIGNS[s].cn) || s || '-';
const symKey = (k) => astroSymbol(chartIdOfKey(k) || k);
// 快捷基准:以哪个原宫作第 1 宫。
const PRESETS = [{ b: 1, label: '本命(命1)' }, { b: 4, label: '父母(田4)' }, { b: 7, label: '伴侣(夫7)' }, { b: 5, label: '子女(子5)' }, { b: 10, label: '事业(官10)' }];

class AstroDerivedHouses extends Component {
	constructor(props){
		super(props);
		this.state = { base: 1 };
	}
	renderTitle(){
		return (
			<div className="horosa-classical-card-title">
				<span className="horosa-classical-zh">派生宫 · 转宫</span>
				<span className="horosa-classical-en">Derived Houses</span>
			</div>
		);
	}
	render(){
		const chartObj = this.props.value;
		if(!chartObj || !chartObj.chart){
			return (
				<div className="horosa-info-card horosa-classical-card">
					{this.renderTitle()}
					<div className="horosa-empty-line">暂无本命盘数据</div>
				</div>
			);
		}
		const base = this.state.base;
		const { rows, isWhole } = deriveDerivedHouseRows(chartObj, base);
		return (
			<div className="horosa-info-card horosa-classical-card">
				{this.renderTitle()}
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
					{PRESETS.map((pr)=>(
						<button key={pr.b} type="button"
							onClick={()=>this.setState({ base: pr.b })}
							style={{ fontSize: 12, padding: '2px 8px', borderRadius: 5, cursor: 'pointer',
								border: `1px solid ${base === pr.b ? 'var(--horosa-gold,#b8860b)' : 'var(--horosa-border,rgba(120,120,120,.28))'}`,
								background: base === pr.b ? 'rgba(184,134,11,.12)' : 'transparent',
								color: base === pr.b ? 'var(--horosa-gold,#b8860b)' : 'inherit' }}>
							{pr.label}
						</button>
					))}
				</div>
				<div style={{ fontSize: 12, color: 'var(--horosa-muted,#999)', marginBottom: 4 }}>
					以原第 {base} 宫为第 1 宫,派生十二宫话题(如以田宅 4 宫为命=父母之事盘)。
					{isWhole ? '' : '　※ 转宫为整宫制技法,当前非整宫制下仅作话题参考。'}
				</div>
				<SmallTable
					rowKey={(r) => r.k}
					rows={rows}
					columns={[
						{ key: 'k', title: '派生宫', render: (v, r) => `${v}·${r.topic}` },
						{ key: 'origin', title: '原宫', render: (v) => `${v}宫` },
						{ key: 'sign', title: '星座', render: (v) => sn(v) },
						{ key: 'planets', title: '落星', render: (v) => (v && v.length ? v.map((id, i) => <span key={i} style={{ marginRight: 2 }}>{symKey(id)}</span>) : '-') },
						{ key: 'ruler', title: '宫主', render: (v) => (v ? symKey(v) : '-') },
					]}
				/>
			</div>
		);
	}
}

export default AstroDerivedHouses;
