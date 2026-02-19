import { Component } from 'react';
import { Row, Col, Divider, Popover, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from '../astro/AstroHelper';
import { randomStr} from '../../utils/helper'
import styles from '../../css/styles.less';

let pars = new Set()
let planets = new Set()

class AspectInfo extends Component{

	constructor(props) {
		super(props);
		this.state = {
			 
		}

		this.genAspectDom = this.genAspectDom.bind(this);
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
				let dom = (
					<div key={randomStr(8)}>
						<span style={{fontFamily: AstroConst.AstroFont}}>&emsp;{AstroText.AstroMsg['Asp' + asp]}&nbsp;</span>
						<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[natalId]}&nbsp;</span>
						<span style={{fontFamily: AstroConst.NormalFont}}>
							误差{Math.round(natalObj.delta * 1000)/1000}
						</span>
					</div>
				);
				coldivs.push(dom);
			}
			let domtitle = (
				<Col key={i} span={12}>
					<div>
						<span style={{fontFamily: AstroConst.NormalFont}}>{title}&nbsp;</span>
						<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[objId]}</span>
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
						<div key={randomStr(8)}>
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
			<Row key={randomStr(8)}>
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

