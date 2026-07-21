import { Component } from 'react';
import { Row, Col, Divider, Popover, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from '../astro/AstroHelper';
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

let planets = new Set()

class AspectToMidpoint extends Component{

	constructor(props) {
		super(props);
		this.state = {
			 
		}

			this.genAspDom = this.genAspDom.bind(this);
			this.showMeaning = this.showMeaning.bind(this);
		}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	genAspDom(aspects){
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
					<div key={`title-${key}`} style={{fontFamily: AstroConst.AstroFont}}>
						{wrapWithMeaning(
							<span>{AstroText.AstroMsg[key]}</span>,
							this.showMeaning(),
							buildMeaningTipByCategory('planet', key)
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
									buildAspectMeaningTip(asp.aspect, {id: key}, {id: asp.idA})
								)
							}</span>
							<span style={{fontFamily: AstroConst.NormalFont}}>（</span>
							{wrapWithMeaning(
								<span>{AstroText.AstroMsg[asp.idA]}</span>,
								this.showMeaning(),
								buildMeaningTipByCategory('planet', asp.idA)
							)}
							<span style={{fontFamily: AstroConst.NormalFont}}>&nbsp;|&nbsp;</span>
							{wrapWithMeaning(
								<span>{AstroText.AstroMsg[asp.idB]}</span>,
								this.showMeaning(),
								buildMeaningTipByCategory('planet', asp.idB)
							)}
							<span style={{fontFamily: AstroConst.NormalFont}}>）&nbsp;</span>
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
		if(this.props.planetDisplay){
			planets = new Set();
			for(let i=0; i<this.props.planetDisplay.length; i++){
				planets.add(this.props.planetDisplay[i]);
			}
		}

		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-180) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let dom = this.genAspDom(this.props.value);
		
		return (
			<div className={styles.scrollbar} style={style}>
				{dom}
			</div>
		);
	}

}

export default AspectToMidpoint;
