import { Component } from 'react';
import { Row, Col, Divider, Popover, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from '../astro/AstroHelper';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import { buildMeaningTipByCategory, buildAspectMeaningTip, } from '../astro/AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from '../astro/AstroMeaningPopover';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

const LIST_POINTS = [
    AstroConst.ASC, AstroConst.MC, AstroConst.DESC, AstroConst.IC,
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, 
	AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN, 
	AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO, 
	AstroConst.CHIRON, AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, 
	AstroConst.DARKMOON, AstroConst.PURPLE_CLOUDS, AstroConst.SYZYGY, AstroConst.PARS_FORTUNA
]

let pars = new Set()
let planets = new Set()

class MidpointInfo extends Component{

	constructor(props) {
		super(props);
		this.state = {
			 
		}

			this.genAspectDom = this.genAspectDom.bind(this);
			this.renderLabel = this.renderLabel.bind(this);
			this.showMeaning = this.showMeaning.bind(this);
		}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

		renderLabel(text, id){
			const one = splitPlanetHouseInfoText(text);
			const labelNode = (
				<span>
					<span style={{fontFamily: AstroConst.AstroFont}}>{one.label}</span>
					{one.info ? <span style={{fontFamily: AstroConst.NormalFont}}>{`(${one.info})`}</span> : null}
				</span>
			);
			return wrapWithMeaning(labelNode, this.showMeaning(), buildMeaningTipByCategory('planet', id));
		}

	genAspectDom(aspects, title){
		if(aspects === undefined || aspects === null){
			return null;
		}
		let divs = [];

		for(let i=0; i<LIST_POINTS.length; i++){
			let key = LIST_POINTS[i];
			let obj = aspects[key];
			if(obj === undefined || obj === null || !planets.has(key)){
				continue;
			}
			let domtitle = (
				<div key={`title-${key}`}>
						<span style={{fontFamily: AstroConst.NormalFont}}>{title}&nbsp;</span>
						{this.renderLabel(
							appendPlanetHouseInfoById(
							AstroText.AstroMsg[key],
								this.props.dirChart,
								key,
								this.props.showPlanetHouseInfo
							),
							key
						)}
					</div>
				);
			divs.push(domtitle);

			for(let idx=0; idx<obj.length; idx++){
				let asp = obj[idx];

				// 标题/相位/空行同推 divs，故用外层行星 key 与内层序号组合避免撞 key
				let dom = (
						<div key={`asp-${key}-${idx}`} style={{fontFamily: AstroConst.AstroFont}}>
							<span>&emsp;{
								wrapWithMeaning(
									<span>{AstroText.AstroMsg['Asp' + asp.aspect]}&nbsp;</span>,
									this.showMeaning(),
									buildAspectMeaningTip(asp.aspect, {id: key}, {id: asp.midpoint ? asp.midpoint.idA : null})
								)
							}</span>
							<span style={{fontFamily: AstroConst.NormalFont}}>(</span>
							{this.renderLabel(
								appendPlanetHouseInfoById(
								AstroText.AstroMsg[asp.midpoint.idA],
									this.props.natualChart,
									asp.midpoint.idA,
									this.props.showPlanetHouseInfo
								),
								asp.midpoint.idA
							)}
							<span style={{fontFamily: AstroConst.NormalFont}}>&nbsp;|&nbsp;</span>
							{this.renderLabel(
							appendPlanetHouseInfoById(
								AstroText.AstroMsg[asp.midpoint.idB],
									this.props.natualChart,
									asp.midpoint.idB,
									this.props.showPlanetHouseInfo
								),
								asp.midpoint.idB
							)}
						<span style={{fontFamily: AstroConst.NormalFont}}>)&nbsp;</span>
						<span style={{fontFamily: AstroConst.NormalFont}}>
							误差{Math.round(asp.delta * 1000)/1000}
						</span>
					</div>
				);
				divs.push(dom);
			}

			let space = (
				<div key={`space-${key}`}><span>&nbsp;</span></div>
			);
			divs.push(space);
		}
		return divs;
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

		let normalAsp = this.genAspectDom(this.props.value, this.props.title);

		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		return (
			<div className={styles.scrollbar} style={style}>
				{normalAsp}
			</div>
		);
	}
}

export default MidpointInfo;
