import { Component } from 'react';
import { Row, Col, Tree } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import {
	computeYearSystem129, buildYearSystem129SnapshotText, yearSystem129OptionsLine, yearSystem129StartLabel,
	YS129_START_OPTIONS, YS129_SECT_START, YS129_ORDERS, YS129_YEAR_TYPES, YS129_SUB_RULES,
} from '../../utils/yearSystem129';
import { symbolWithMeaning } from './AstroExtraCommon';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText } from '../../utils/planetHouseInfo';
import { XQSelect as Select } from '../xq-ui';
import styles from '../../css/styles.less';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import { markPanelReady } from '../../utils/perfMark';

// 快照构造器住在 utils/yearSystem129(页面 / AI 重算等各处同一来源);这里转出给旧引用方。
export { buildYearSystem129SnapshotText };

const Option = Select.Option;

// 页面上的四项口径 ↔ 引擎选项名
const OPT_OF_STATE = { ys129StartPlanet: 'startPlanet', ys129Order: 'order', ys129YearType: 'yearType', ys129SubRule: 'subRule' };

class AstroYearSystem129 extends Component{
	constructor(props){
		super(props);
		const sv = DIRECTION_PAGE_SETTINGS.load();   // 上次亲手设的四项口径
		this.state = {
			ys129StartPlanet: sv.ys129StartPlanet,
			ys129Order: sv.ys129Order,
			ys129YearType: sv.ys129YearType,
			ys129SubRule: sv.ys129SubRule,
			treeData: [],
		};
		this.engineOpts = this.engineOpts.bind(this);
		this.rebuild = this.rebuild.bind(this);
		this.titleOf = this.titleOf.bind(this);
		this.changeOpt = this.changeOpt.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this.rebuild();
		this.saveAISnapshot();
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentDidUpdate(prevProps){
		if(prevProps.value !== this.props.value || prevProps.showAstroMeaning !== this.props.showAstroMeaning || prevProps.showPlanetHouseInfo !== this.props.showPlanetHouseInfo){
			this.rebuild();
			if(prevProps.value !== this.props.value){
				// horosa_panel_ready_v1:本技法无自有请求 —— 主限 / 子限树整份由前端引擎 computeYearSystem129
				// 从新盘对象同步派生(rebuild 里 setState),「数据落定」就是拿到新盘对象后的这一次渲染提交,与带回调的技法同口径。
				markPanelReady('direction');
				this.saveAISnapshot();
			}
		}
	}

	componentWillUnmount(){
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	engineOpts(){
		const o = {};
		Object.keys(OPT_OF_STATE).forEach((k) => { o[OPT_OF_STATE[k]] = this.state[k]; });
		return o;
	}

	saveAISnapshot(){
		const txt = buildYearSystem129SnapshotText(this.props.value, this.engineOpts());
		saveModuleAISnapshot('yearsystem129', txt, { tab: 'yearsystem129' });
		return txt;
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'yearsystem129'){ return; }
		const txt = this.saveAISnapshot();
		if(txt){ evt.detail.snapshotText = txt; }
	}

	rebuild(){
		const chartObj = this.props.value;
		if(!chartObj || !chartObj.chart){ this.setState({ treeData: [] }); return; }
		const { rows } = computeYearSystem129(chartObj, this.engineOpts());
		const treeData = rows.map((r, i) => ({
			key: `m${i}`,
			title: this.titleOf(r.mainDirect, 1, r.startDate, r.durYears),
			children: r.subDirect.map((s, k) => ({ key: `m${i}s${k}`, isLeaf: true, title: this.titleOf(s.subDirect, 2, s.date, s.durYears) })),
		}));
		this.setState({ treeData });
	}

	titleOf(planet, level, date, years){
		const cn = AstroText.AstroTxtMsg[planet] || planet;
		const house = splitPlanetHouseInfoText(appendPlanetHouseInfoById(cn, this.props.value, planet, this.props.showPlanetHouseInfo)).info;   // 「行星后显示宫位」开时带落宫
		return (
			<span className={`horosa-balbillus-node horosa-balbillus-node--l${level}`}>
				<span className="bb-planet">
					{symbolWithMeaning(planet, this.props.showAstroMeaning)}
					<span className="bb-name" style={{ fontFamily: AstroConst.NormalFont }}>{cn}{house ? `(${house})` : ''}</span>
				</span>
				<span className="bb-date">{date || '-'}</span>
				<span className="bb-dur" style={{ fontFamily: AstroConst.NormalFont }}>{years.toFixed(2)} 年</span>
			</span>
		);
	}

	changeOpt(key, val){
		DIRECTION_PAGE_SETTINGS.save({ [key]: val });
		this.setState({ [key]: val }, () => { this.rebuild(); this.saveAISnapshot(); });
	}

	render(){
		const planetLabel = (p) => {
			if(p === YS129_SECT_START){ return <span style={{ fontFamily: AstroConst.NormalFont }}>{yearSystem129StartLabel(p)}</span>; }
			const glyph = AstroText.AstroMsg[p];
			return (
				<span>
					{glyph ? <span style={{ fontFamily: AstroConst.AstroFont }}>{glyph}</span> : null}
					<span style={{ fontFamily: AstroConst.NormalFont }}> {yearSystem129StartLabel(p)}</span>
				</span>
			);
		};
		// 零常数:面板已由星运页 Tabs 内容链定高,列表盒铺满面板(见 AstroFirdaria 同名注)。
		const style = { height: '100%', maxHeight: '100%', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden' };
		const chartObj = this.props.value;
		return (
			<div className={`${styles.scrollbar} horosa-balbillus-shell`} style={style}>
				<div className="horosa-balbillus-head">
					<div className="horosa-balbillus-title">
						129 年系统<span className="horosa-balbillus-sub">七星小年 · 土 30 木 12 火 15 日 19 金 8 水 20 月 25</span>
					</div>
					<div className="horosa-balbillus-desc">
						主限长度 = 该星小年 × 年长；七星按所选次序从起始星铺开，一轮 129 年后循环。子限从本主限星起按同一次序；点主限可展开子限。
						{chartObj && chartObj.chart ? <span>（当前：{yearSystem129OptionsLine(chartObj, this.engineOpts())}）</span> : null}
					</div>
					<Row gutter={12} className="horosa-balbillus-controls">
						<Col span={6}>
							<div className="horosa-balbillus-label">起始星</div>
							<Select value={this.state.ys129StartPlanet} onChange={(v) => this.changeOpt('ys129StartPlanet', v)} style={{ width: '100%' }}>
								{YS129_START_OPTIONS.map((p) => <Option value={p} key={p}>{planetLabel(p)}</Option>)}
							</Select>
						</Col>
						<Col span={6}>
							<div className="horosa-balbillus-label">次序</div>
							<Select value={this.state.ys129Order} onChange={(v) => this.changeOpt('ys129Order', v)} style={{ width: '100%' }}>
								{Object.keys(YS129_ORDERS).map((k) => <Option value={k} key={k}>{YS129_ORDERS[k]}</Option>)}
							</Select>
						</Col>
						<Col span={6}>
							<div className="horosa-balbillus-label">年制</div>
							<Select value={this.state.ys129YearType} onChange={(v) => this.changeOpt('ys129YearType', v)} style={{ width: '100%' }}>
								{Object.keys(YS129_YEAR_TYPES).map((k) => <Option value={k} key={k}>{YS129_YEAR_TYPES[k].label}</Option>)}
							</Select>
						</Col>
						<Col span={6}>
							<div className="horosa-balbillus-label">子限铺法</div>
							<Select value={this.state.ys129SubRule} onChange={(v) => this.changeOpt('ys129SubRule', v)} style={{ width: '100%' }}>
								{Object.keys(YS129_SUB_RULES).map((k) => <Option value={k} key={k}>{YS129_SUB_RULES[k]}</Option>)}
							</Select>
						</Col>
					</Row>
				</div>
				<div className="horosa-balbillus-colhead">
					<span className="bb-planet">主限星 / 子限星</span>
					<span className="bb-date">起始日期</span>
					<span className="bb-dur">时长</span>
				</div>
				<div className="horosa-balbillus-tree">
					<Tree
						treeData={this.state.treeData}
						showLine={{ showLeafIcon: false }}
						selectable={false}
						blockNode={true}
					/>
				</div>
			</div>
		);
	}
}

export default AstroYearSystem129;
