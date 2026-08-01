import { Component } from 'react';
import { isPartileByValues } from '../../divination/data/accidentalDignity';
import { classicalGlobalValue, CLASSICAL_GLOBALS_EVENT } from '../../utils/classicalChartGlobals';
import { Row, Col, Popover, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import { buildMeaningTipByCategory, buildAspectMeaningTip, } from './AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from './AstroMeaningPopover';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

let pars = new Set()
let planets = new Set()

class AstroAspect extends Component{

	constructor(props) {
		super(props);
		this.state = {

		}

		this.genNormalAspDom = this.genNormalAspDom.bind(this);
		this.genImmediateAspDom = this.genImmediateAspDom.bind(this);
		this.genSignAspDom = this.genSignAspDom.bind(this);
		this.genOneSignAspDom = this.genOneSignAspDom.bind(this);
		this.genAntisciasDom = this.genAntisciasDom.bind(this);
		this.showMeaning = this.showMeaning.bind(this);
		this.aspectNode = this.aspectNode.bind(this);
		this.aspPill = this.aspPill.bind(this);
	}

	componentDidMount(){
		// partile 判据全局变更 → 重渲相位表(标记列吃 classicalGlobalValue,监听只触发重渲)。
		this._onClassicalGlobals = () => this.forceUpdate();
		if(typeof window !== 'undefined'){ window.addEventListener(CLASSICAL_GLOBALS_EVENT, this._onClassicalGlobals); }
	}

	componentWillUnmount(){
		if(typeof window !== 'undefined' && this._onClassicalGlobals){ window.removeEventListener(CLASSICAL_GLOBALS_EVENT, this._onClassicalGlobals); }
	}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	// 该星/点是否在当前显示集合内：行星看 planetDisplay、希腊点看 lotsDisplay；两集合皆空则全显（对齐 AstroInfo「空集→全显」）。
	canDisplayPlanet(id){
		if(planets.size === 0 && pars.size === 0){
			return true;
		}
		return planets.has(id) || pars.has(id);
	}

	aspectNode(aspDeg, objAId, objBId){
		const base = (
			<span>{AstroText.AstroMsg['Asp' + aspDeg]}&nbsp;</span>
		);
		return wrapWithMeaning(
			base,
			this.showMeaning(),
			buildAspectMeaningTip(aspDeg, {id: objAId}, {id: objBId})
		);
	}

	planetLabel(id){
		const text = appendPlanetHouseInfoById(
			AstroText.AstroMsg[id],
			this.currChartObj,
			id,
			this.props.showPlanetHouseInfo
		);
		const one = splitPlanetHouseInfoText(text);
		const labelNode = (
			<span>
				<span style={{fontFamily: AstroConst.AstroFont}}>{one.label}</span>
				{one.info ? <span style={{fontFamily: AstroConst.NormalFont}}>{`(${one.info})`}</span> : null}
			</span>
		);
		return wrapWithMeaning(labelNode, this.showMeaning(), buildMeaningTipByCategory('planet', id));
	}

	// 一条相位「pill」：相位字形 + 对象星 + 入相/离相标 + 误差。phaseKind: applying|separating|none。
	// 正相位(partile)标记:按全局 partileDef(同整数度/≤3°/≤1°)对每行判「正」;
	// 判据与卜卦尊贵计分同源(isPartileByValues 单一真值)。取两端真黄经座内度(currChartObj)。
	isRowPartile(srcId, asp){
		try{
			const a = AstroHelper.getObject(this.currChartObj, srcId);
			const b = AstroHelper.getObject(this.currChartObj, asp.id);
			return isPartileByValues(a && a.signlon, b && b.signlon, asp.orb, classicalGlobalValue('partileDef'));
		}catch(e){
			return false;
		}
	}

	aspPill(rowKey, srcId, asp, phaseLabel, phaseKind){
		return (
			<div key={rowKey} className="horosa-aspect-row" style={{fontFamily: AstroConst.AstroFont}}>
				<span className="horosa-aspect-glyph">{this.aspectNode(asp.asp, srcId, asp.id)}</span>
				<span className="horosa-aspect-target">{this.planetLabel(asp.id)}</span>
				{this.isRowPartile(srcId, asp) ? (
					<span className="horosa-aspect-partile" style={{fontFamily: AstroConst.NormalFont}} title="正相位（partile）：按 设置→星盘设置 的判据">正</span>
				) : null}
				{phaseLabel ? (
					<span className={`horosa-aspect-phase horosa-aspect-phase--${phaseKind}`} style={{fontFamily: AstroConst.NormalFont}}>{phaseLabel}</span>
				) : null}
				<span className="horosa-aspect-orb" style={{fontFamily: AstroConst.NormalFont}}>误差{Math.round(asp.orb * 1000)/1000}</span>
			</div>
		);
	}

	genNormalAspDom(aspects){
		if(aspects === undefined || aspects === null){
			return null;
		}
		let groups = [];

		for(let i=0; i<AstroConst.LIST_POINTS.length; i++){
			let key = AstroConst.LIST_POINTS[i];
			let obj = aspects[key];
			if(obj === undefined || obj === null || !planets.has(key)){
				continue;
			}

			let rows = [];

			for(let idx in obj.Applicative){
				let asp = obj.Applicative[idx];
				if((!pars.has(asp.id)) && asp.id.indexOf('Pars') >= 0){
					continue;
				}
				if((!planets.has(asp.id))){
					continue;
				}
				rows.push(this.aspPill(key + 'a' + asp.id, key, asp, '入相', 'applying'));
			}

			let aspary = obj.Exact.map((elm)=>{
				return elm;
			});
			for(let idx=0; idx<obj.Separative.length; idx++){
				aspary.push(obj.Separative[idx]);
			}
			for(let idx=0; idx<aspary.length; idx++){
				let asp = aspary[idx];
				if((!pars.has(asp.id)) && asp.id.indexOf('Pars') >= 0){
					continue;
				}
				if((!planets.has(asp.id))){
					continue;
				}
				rows.push(this.aspPill(key + 's' + asp.id, key, asp, '离相', 'separating'));
			}

			for(let idx=0; idx<obj.None.length; idx++){
				let asp = obj.None[idx];
				if((!pars.has(asp.id)) && asp.id.indexOf('Pars') >= 0){
					continue;
				}
				if((!planets.has(asp.id))){
					continue;
				}
				rows.push(this.aspPill(key + 'n' + asp.id, key, asp, '', 'none'));
			}

			if(rows.length === 0){
				continue;
			}
			groups.push(
				<div key={key} className="horosa-aspect-group">
					<div className="horosa-aspect-group-title" style={{fontFamily: AstroConst.AstroFont}}>{this.planetLabel(key)}</div>
					<div className="horosa-aspect-rows">{rows}</div>
				</div>
			);
		}

		if(groups.length === 0){
			return <div className="horosa-aspect-empty">无</div>;
		}
		return <div className="horosa-aspect-list">{groups}</div>;
	}

	genImmediateAspDom(aspects){
		if(aspects === undefined || aspects === null){
			return null;
		}
		let rows = [];

		for(let i=0; i<AstroConst.LIST_OBJECTS.length; i++){
			let key = AstroConst.LIST_OBJECTS[i];
			let obj = aspects[key];
			if(obj === undefined || obj === null){
				continue;
			}
			let flag = (!pars.has(obj[0].id)) && obj[0].id.indexOf('Pars') >= 0;
			flag = flag | ((!pars.has(obj[1].id)) && obj[1].id.indexOf('Pars') >= 0)
			flag = flag | (!planets.has(key)) | (!planets.has(obj[0].id)) | (!planets.has(obj[1].id))
			if(flag){
				continue;
			}

			let dom = (
				<div key={key} className="horosa-aspect-row horosa-aspect-row--immediate" style={{fontFamily: AstroConst.AstroFont}}>
					<span className="horosa-aspect-target">{this.planetLabel(key)}</span>
					<span className="horosa-aspect-glyph">{this.aspectNode(obj[0].asp, key, obj[0].id)}</span>
					<span className="horosa-aspect-target">{this.planetLabel(obj[0].id)}</span>
					<span className="horosa-aspect-phase horosa-aspect-phase--separating" style={{fontFamily: AstroConst.NormalFont}}>
						<Popover content={'误差' + Math.round(obj[0].orb * 1000)/1000} >离相</Popover>
					</span>
					<span className="horosa-aspect-glyph">{this.aspectNode(obj[1].asp, key, obj[1].id)}</span>
					<span className="horosa-aspect-target">{this.planetLabel(obj[1].id)}</span>
					<span className="horosa-aspect-phase horosa-aspect-phase--applying" style={{fontFamily: AstroConst.NormalFont}}>
						<Popover content={'误差' + Math.round(obj[1].orb * 1000)/1000} >入相</Popover>
					</span>
				</div>
			);
			rows.push(dom);
		}
		if(rows.length === 0){
			return <div className="horosa-aspect-empty">无</div>;
		}
		return <div className="horosa-aspect-list">{rows}</div>;
	}

	genOneSignAspDom(key, obj){
		let rows = [];
		for(let idx=0; idx<obj.length; idx++){
			let asp = obj[idx];
			if((!pars.has(asp.id)) && asp.id.indexOf('Pars') >= 0){
				continue;
			}
			if(!planets.has(asp.id)){
				continue;
			}
			let dom = (
				<div key={key + asp.id} className="horosa-aspect-row horosa-aspect-row--sign" style={{fontFamily: AstroConst.AstroFont}}>
					<span className="horosa-aspect-glyph">{this.aspectNode(asp.asp, key, asp.id)}</span>
					<span className="horosa-aspect-target">{this.planetLabel(asp.id)}</span>
				</div>
			);
			rows.push(dom);
		}
		return (
			<div className="horosa-aspect-group horosa-aspect-group--sign">
				<div className="horosa-aspect-group-title" style={{fontFamily: AstroConst.AstroFont}}>{this.planetLabel(key)}</div>
				<div className="horosa-aspect-rows">{rows}</div>
			</div>
		);
	}

	genSignAspDom(aspects){
		if(aspects === undefined || aspects === null){
			return null;
		}
		let cells = [];
		for(let i=0; i<AstroConst.LIST_OBJECTS.length; i++){
			let key = AstroConst.LIST_OBJECTS[i];
			let obj = aspects[key];
			if(obj === undefined || obj === null || !planets.has(key)){
				continue;
			}
			cells.push(
				<Col key={'asp_' + key} xs={12} sm={8}>{this.genOneSignAspDom(key, obj)}</Col>
			);
		}
		if(cells.length === 0){
			return <div className="horosa-aspect-empty">无</div>;
		}
		return (
			<div className="horosa-aspect-list">
				<Row gutter={[8, 8]}>{cells}</Row>
			</div>
		);
	}

	// 映点 + 反映点（antiscia / contra-antiscia）：两数组都渲染，缺一不可。源 chartObj.chart.antiscias。
	genAntisciasDom(chart){
		if(chart === undefined || chart === null || chart.antiscias === undefined || chart.antiscias === null){
			return null;
		}
		let anti = chart.antiscias;
		let antisciaArr = Array.isArray(anti.antiscia) ? anti.antiscia : [];
		let cantisciaArr = Array.isArray(anti.cantiscia) ? anti.cantiscia : [];
		if(antisciaArr.length === 0 && cantisciaArr.length === 0){
			return null;
		}

		let antiRows = [];
		for(let idx=0; idx<antisciaArr.length; idx++){
			let obj = antisciaArr[idx];
			// OR-显示：任一端在显示集即显（映点常落在主星↔冷门体，AND 会几乎全空）。
			if((!this.canDisplayPlanet(obj[0])) && (!this.canDisplayPlanet(obj[1]))){
				continue;
			}
			antiRows.push(
				<div key={'anti' + idx} className="horosa-aspect-row" style={{fontFamily: AstroConst.AstroFont}}>
					<span className="horosa-aspect-target">{this.planetLabel(obj[0])}</span>
					<span className="horosa-aspect-phase horosa-aspect-phase--anti" style={{fontFamily: AstroConst.NormalFont}}>映</span>
					<span className="horosa-aspect-target">{this.planetLabel(obj[1])}</span>
					<span className="horosa-aspect-orb" style={{fontFamily: AstroConst.NormalFont}}>误差{Math.round(obj[2] * 1000) / 1000}</span>
				</div>
			);
		}

		let cantiRows = [];
		for(let idx=0; idx<cantisciaArr.length; idx++){
			let obj = cantisciaArr[idx];
			if((!this.canDisplayPlanet(obj[0])) && (!this.canDisplayPlanet(obj[1]))){
				continue;
			}
			cantiRows.push(
				<div key={'canti' + idx} className="horosa-aspect-row" style={{fontFamily: AstroConst.AstroFont}}>
					<span className="horosa-aspect-target">{this.planetLabel(obj[0])}</span>
					<span className="horosa-aspect-phase horosa-aspect-phase--canti" style={{fontFamily: AstroConst.NormalFont}}>反映</span>
					<span className="horosa-aspect-target">{this.planetLabel(obj[1])}</span>
					<span className="horosa-aspect-orb" style={{fontFamily: AstroConst.NormalFont}}>误差{Math.round(obj[2] * 1000) / 1000}</span>
				</div>
			);
		}

		if(antiRows.length === 0 && cantiRows.length === 0){
			return null;
		}

		return (
			<div className="horosa-aspect-list">
				<div className="horosa-aspect-group">
					<div className="horosa-aspect-group-title horosa-aspect-group-title--plain">映点</div>
					<div className="horosa-aspect-rows">{antiRows.length ? antiRows : <div className="horosa-aspect-empty">无</div>}</div>
				</div>
				<div className="horosa-aspect-group">
					<div className="horosa-aspect-group-title horosa-aspect-group-title--plain">反映点</div>
					<div className="horosa-aspect-rows">{cantiRows.length ? cantiRows : <div className="horosa-aspect-empty">无</div>}</div>
				</div>
			</div>
		);
	}

	render(){
		if(this.props.lotsDisplay){
			pars = new Set();
			for(let i=0; i<this.props.lotsDisplay.length; i++){
				pars.add(this.props.lotsDisplay[i]);
			}
		}
		if(this.props.planetDisplay){
			planets = new Set();
			for(let i=0; i<this.props.planetDisplay.length; i++){
				planets.add(this.props.planetDisplay[i]);
			}
		}

		let chart = this.props.value ? this.props.value : {};
		this.currChartObj = chart;
		let aspects = chart.aspects ? chart.aspects : {};

		let normalAsp = this.genNormalAspDom(aspects.normalAsp);
		let immediateAsp = this.genImmediateAspDom(aspects.immediateAsp);
		let signAsp = this.genSignAspDom(aspects.signAsp);
		let antiAsp = this.genAntisciasDom(chart.chart);

		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto',
			overflowX:'hidden',
		};

		return (
			<div className={`${styles.scrollbar} horosa-aspect-panel`} style={style}>
				<div className="horosa-aspect-section">
					<div className="horosa-aspect-section-title">标准相位</div>
					{normalAsp}
				</div>
				<div className="horosa-aspect-section">
					<div className="horosa-aspect-section-title">立即相位</div>
					{immediateAsp}
				</div>
				<div className="horosa-aspect-section">
					<div className="horosa-aspect-section-title">星座相位</div>
					{signAsp}
				</div>
				{antiAsp ? (
					<div className="horosa-aspect-section">
						<div className="horosa-aspect-section-title">映点 / 反映点</div>
						{antiAsp}
					</div>
				) : null}
			</div>
		);
	}
}

export default AstroAspect;
