import { Component } from 'react';
import { Row, Col, Tree } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import {
	buildBalbillusContext, buildBalbillusRoots, buildBalbillusChildren,
	buildBalbillusSnapshotText, BALBILLUS_YEAR_TYPES, BALBILLUS_MODES, BALBILLUS_SUB_RULES, BALBILLUS_DEFAULT_OPTS,
} from '../../utils/balbillus';
import { symbolWithMeaning } from './AstroExtraCommon';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText } from '../../utils/planetHouseInfo';
import { XQSelect as Select } from '../xq-ui';
import styles from '../../css/styles.less';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import { markPanelReady } from '../../utils/perfMark';

const Option = Select.Option;
const PLANET_OPTIONS = [
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS,
	AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN,
];

function updateTreeData(list, key, children){
	return list.map((node) => {
		if(node.key === key){ return { ...node, children }; }
		if(node.children){ return { ...node, children: updateTreeData(node.children, key, children) }; }
		return node;
	});
}

class AstroBalbillus extends Component{
	constructor(props){
		super(props);
		this.state = {
			opts: (()=>{ const sv = DIRECTION_PAGE_SETTINGS.load(); return { ...BALBILLUS_DEFAULT_OPTS, startPlanet: sv.balbillusStartPlanet, yearType: sv.balbillusYearType, mode: sv.balbillusMode, subRule: sv.balbillusSubRule }; })(),   // 上次亲手设的四项口径
			treeData: [],
		};
		this.ctx = null;
		this.rebuild = this.rebuild.bind(this);
		this.onLoadData = this.onLoadData.bind(this);
		this.titleOf = this.titleOf.bind(this);
		this.toTreeNode = this.toTreeNode.bind(this);
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
				// horosa_panel_ready_v1:本技法无自有请求,数据整份派生自 chartObj —— 「落定」= 拿到新盘那次提交。
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

	saveAISnapshot(){
		const txt = buildBalbillusSnapshotText(this.props.value, this.state.opts);
		saveModuleAISnapshot('balbillus', txt, { tab: 'balbillus' });
		return txt;
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'balbillus'){ return; }
		const txt = this.saveAISnapshot();
		if(txt){ evt.detail.snapshotText = txt; }
	}

	rebuild(){
		this.ctx = buildBalbillusContext(this.props.value, this.state.opts);
		const roots = buildBalbillusRoots(this.ctx).map((n) => this.toTreeNode(n));
		this.setState({ treeData: roots });
	}

	toTreeNode(node){
		return { ...node, title: this.titleOf(node) };
	}

	onLoadData(treeNode){
		return new Promise((resolve) => {
			const node = treeNode;
			if((node.children && node.children.length) || node.isLeaf){ resolve(); return; }
			const kids = buildBalbillusChildren(this.ctx, node).map((n) => this.toTreeNode(n));
			this.setState((st) => ({ treeData: updateTreeData(st.treeData, node.key, kids) }), resolve);
		});
	}

	titleOf(node){
		const cn = AstroText.AstroTxtMsg[node.planet] || node.planet;
		const house = splitPlanetHouseInfoText(appendPlanetHouseInfoById(cn, this.props.value, node.planet, this.props.showPlanetHouseInfo)).info;   // 「行星后显示宫位」开时带落宫
		return (
			<span className={`horosa-balbillus-node horosa-balbillus-node--l${node.level}`}>
				<span className="bb-planet">
					{symbolWithMeaning(node.planet, this.props.showAstroMeaning)}
					<span className="bb-name" style={{ fontFamily: AstroConst.NormalFont }}>{cn}{house ? `(${house})` : ''}</span>
				</span>
				<span className="bb-date">{node.startDate || '-'}</span>
				<span className="bb-dur" style={{ fontFamily: AstroConst.NormalFont }}>{node.durYears.toFixed(2)} 年</span>
			</span>
		);
	}

	changeOpt(key, val){
		const persistAs = { startPlanet: 'balbillusStartPlanet', yearType: 'balbillusYearType', mode: 'balbillusMode', subRule: 'balbillusSubRule' }[key];
		if(persistAs){ DIRECTION_PAGE_SETTINGS.save({ [persistAs]: val }); }
		const opts = { ...this.state.opts, [key]: val };
		this.setState({ opts }, () => { this.rebuild(); this.saveAISnapshot(); });
	}

	render(){
		const height = this.props.height ? this.props.height : 760;
		const opts = this.state.opts;
		const planetLabel = (p) => {
			const glyph = AstroText.AstroMsg[p];
			const cn = AstroText.AstroTxtMsg[p] || p;
			return (
				<span>
					{glyph ? <span style={{ fontFamily: AstroConst.AstroFont }}>{glyph}</span> : null}
					<span style={{ fontFamily: AstroConst.NormalFont }}> {cn}</span>
				</span>
			);
		};
		return (
			<div className={`${styles.scrollbar} horosa-balbillus-shell`} style={{ height: `${height - 20}px`, overflowY: 'auto', overflowX: 'hidden' }}>
				<div className="horosa-balbillus-head">
					<div className="horosa-balbillus-title">
						Balbillus 法<span className="horosa-balbillus-sub">129 年系统 · 旺距削减</span>
					</div>
					<div className="horosa-balbillus-desc">
						主限长度 = N′ ×（360 − d）⁄ 360 年：d 为本命星所在度（黄经取整加一）离其擢升度的整度角距，N′ = 水 20 / 金 8 / 木 12 / 土 30 / 日 18 / 月 24 / 火 14。七星按本命黄经序从起始星铺开。子限从父期主星起按同一次序，每颗 = 该星上一层时长 ÷ 12；点节点可展开下一层。
					</div>
					<Row gutter={12} className="horosa-balbillus-controls">
						<Col span={6}>
							<div className="horosa-balbillus-label">起始星</div>
							<Select value={opts.startPlanet} onChange={(v) => this.changeOpt('startPlanet', v)} style={{ width: '100%' }}>
								{PLANET_OPTIONS.map((p) => <Option value={p} key={p}>{planetLabel(p)}</Option>)}
							</Select>
						</Col>
						<Col span={6}>
							<div className="horosa-balbillus-label">年制</div>
							<Select value={opts.yearType} onChange={(v) => this.changeOpt('yearType', v)} style={{ width: '100%' }}>
								{Object.keys(BALBILLUS_YEAR_TYPES).map((k) => <Option value={k} key={k}>{BALBILLUS_YEAR_TYPES[k].label}</Option>)}
							</Select>
						</Col>
						<Col span={6}>
							<div className="horosa-balbillus-label">距离口径</div>
							<Select value={opts.mode} onChange={(v) => this.changeOpt('mode', v)} style={{ width: '100%' }}>
								{Object.keys(BALBILLUS_MODES).map((k) => <Option value={k} key={k}>{BALBILLUS_MODES[k]}</Option>)}
							</Select>
						</Col>
						<Col span={6}>
							<div className="horosa-balbillus-label">子限铺法</div>
							<Select value={opts.subRule} onChange={(v) => this.changeOpt('subRule', v)} style={{ width: '100%' }}>
								{Object.keys(BALBILLUS_SUB_RULES).map((k) => <Option value={k} key={k}>{BALBILLUS_SUB_RULES[k]}</Option>)}
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
						loadData={this.onLoadData}
						showLine={{ showLeafIcon: false }}
						selectable={false}
						blockNode={true}
					/>
				</div>
			</div>
		);
	}
}

export default AstroBalbillus;
