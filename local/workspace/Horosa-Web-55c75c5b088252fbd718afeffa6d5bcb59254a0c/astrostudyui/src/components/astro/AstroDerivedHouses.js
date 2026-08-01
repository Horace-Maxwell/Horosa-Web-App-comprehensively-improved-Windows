// G19 派生宫 / 转宫(希腊化占星·整宫制):以第 b 宫为第 1 宫,重派十二宫话题。
// 纯前端派生,嵌本命「古典」tab;读 chartObj.chart.houses + objects[].house;不改主盘。中性表述。
import { Component } from 'react';
import { astroSymbol, SmallTable } from './AstroExtraCommon';
import { SIGNS } from '../../divination/data/signs';
import { houseNum, signOf, chartIdOfKey } from '../../utils/dispositorChain';

const sn = (s) => (SIGNS[s] && SIGNS[s].cn) || s || '-';
const symKey = (k) => astroSymbol(chartIdOfKey(k) || k);
// 十二宫话题(自命宫起)。
const TOPICS = ['命宫·自我', '财帛', '兄弟·近邻', '田宅·父母', '子女·创造', '奴仆·疾厄', '夫妻·伴侣', '疾厄·死亡', '迁移·信仰', '官禄·事业', '福德·友群', '玄秘·隐患'];
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
		const houses = chartObj.chart.houses || [];
		const objects = chartObj.chart.objects || [];
		const hsys = chartObj.params && chartObj.params.hsys;
		// 整宫家族 = 0(整宫制)与 24(福点整宫制);8 是「天顶为10宫中点等宫制」,与整宫无关 ——
		// 从前判 '8' 恰好判反:真选整宫制反而弹「非整宫制仅作参考」,选那个等宫制却当整宫处理。
		const isWhole = String(hsys) === '0' || String(hsys) === '24' || String(hsys) === 'whole' || String(hsys).toLowerCase() === 'w';
		const base = this.state.base;
		// 原宫号 → {sign, planets[]}。
		const byHouse = {};
		houses.forEach((h)=>{
			if(!h){ return; }
			const hn = houseNum(h.id);
			if(!hn){ return; }
			const csign = h.sign ? String(h.sign).toLowerCase() : (h.lon != null ? signOf(h.lon) : null);
			byHouse[hn] = { sign: csign, planets: [] };
		});
		objects.forEach((o)=>{
			// 🔴 objects[].house 是字符串 'House4',Number() 恒 NaN → 落星列恒空
			// (同文件对 houses 已用 houseNum,此处曾退化成 Number,同文件两套解析漂移)。
			const hn = houseNum(o.house);
			if(byHouse[hn]){ byHouse[hn].planets.push(o.id); }
		});
		// 派生:派生宫 k(1..12)对应原宫 ((base-1)+(k-1))%12 +1。
		const rows = [];
		for(let k = 1; k <= 12; k++){
			const origin = ((base - 1) + (k - 1)) % 12 + 1;
			const cell = byHouse[origin] || { sign: null, planets: [] };
			const ruler = cell.sign ? (SIGNS[cell.sign] || {}).domicile || null : null;
			rows.push({ k, origin, sign: cell.sign, planets: cell.planets, ruler, topic: TOPICS[k - 1] });
		}
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
