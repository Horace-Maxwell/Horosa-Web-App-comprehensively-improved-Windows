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

let pars = new Set()
let planets = new Set()

class AspectInfo extends Component{

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

	genAspectDom(title){
		let resobj = this.props.value ? this.props.value : {};
		let aspects = resobj.aspects;
		if(aspects === undefined || aspects === null){
			return null;
		}
		let divs = [];
		for(let i=0; i<aspects.length; i++){
			let obj = aspects[i];
			if(obj.objects.length === 0){
				continue;
			}
			let objId = obj.id ? obj.id : obj.directId;
			let coldivs = [];
			let natalObjs = obj.objects;
			for(let j=0; j<natalObjs.length; j++){
				let natalObj = natalObjs[j];
				let natalId = natalObj.id ? natalObj.id : natalObj.natalId;
				let asp = natalObj.aspect;
				const natalLabel = appendPlanetHouseInfoById(
					AstroText.AstroMsg[natalId],
					this.props.natualChart,
					natalId,
					this.props.showPlanetHouseInfo
				);
					let dom = (
						<div key={j}>
							<span style={{fontFamily: AstroConst.AstroFont}}>
								&emsp;{
									wrapWithMeaning(
										<span>{AstroText.AstroMsg['Asp' + asp]}&nbsp;</span>,
										this.showMeaning(),
										buildAspectMeaningTip(asp, {id: objId}, {id: natalId})
									)
								}
							</span>
							<span>{this.renderLabel(natalLabel, natalId)}&nbsp;</span>
							<span style={{fontFamily: AstroConst.NormalFont}}>
								误差{Math.round(natalObj.delta * 1000)/1000}
							</span>
					</div>
				);
				coldivs.push(dom);
			}
			const directLabel = appendPlanetHouseInfoById(
				AstroText.AstroMsg[objId],
				this.props.dirChart,
				objId,
				this.props.showPlanetHouseInfo
			);
				let domtitle = (
					<Col key={i} span={12}>
						<div>
							<span style={{fontFamily: AstroConst.NormalFont}}>{title}&nbsp;</span>
							<span>{this.renderLabel(directLabel, objId)}</span>
						</div>
						{coldivs}
					</Col>
			);
			divs.push(domtitle);
		}

		let rows = [];
		let cols = [];
		for(let i=0; i<divs.length; i++){
			if(i % 2 === 0){
				if(i > 0){
					let dom = (
						<div key={`rowgroup-${i}`}>
							<Row>
								{cols}
							</Row>
							<Divider dashed />
						</div>
					);	
					rows.push(dom);		
				}
				cols = [];
			}
			cols.push(divs[i]);
		}
		rows.push((
			<Row key="rowgroup-last">
				{cols}
			</Row>
		));

		let dom = (
			<div>
				{rows}
			</div>
		);
		return dom;
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

		let normalAsp = this.genAspectDom(this.props.title);

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

export default AspectInfo;
