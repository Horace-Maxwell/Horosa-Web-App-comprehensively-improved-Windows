import { Component } from 'react';
import { Row, Col, Divider, Popover, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import { randomStr} from '../../utils/helper'
import styles from '../../css/styles.less';

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
	}

	genNormalAspDom(aspects){
		if(aspects === undefined || aspects === null){
			return null;
		}
		let divs = [];

		for(let i=0; i<AstroConst.LIST_POINTS.length; i++){
			let key = AstroConst.LIST_POINTS[i];
			let obj = aspects[key];
			if(obj === undefined || obj === null || !planets.has(key)){
				continue;
			}
			let domtitle = (
				<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{AstroText.AstroMsg[key]}</span>
				</div>
			);
			divs.push(domtitle);

			for(let idx in obj.Applicative){
				let asp = obj.Applicative[idx];
				if((!pars.has(asp.id)) && asp.id.indexOf('Pars') >= 0){
					continue;
				}
				if((!planets.has(asp.id))){
					continue;
				}
				let dom = (
					<div key={key + asp.id} style={{fontFamily: AstroConst.AstroFont}}>
						<span>&emsp;{AstroText.AstroMsg['Asp' + asp.asp]}&nbsp;</span>
						<span>{AstroText.AstroMsg[asp.id]}&nbsp;</span>
						<span style={{fontFamily: AstroConst.NormalFont}}>
							入相&nbsp;误差{Math.round(asp.orb * 1000)/1000}
						</span>
					</div>
				);
				divs.push(dom);
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
				let dom = (
					<div key={key + asp.id} style={{fontFamily: AstroConst.AstroFont}}>
						<span>&emsp;{AstroText.AstroMsg['Asp' + asp.asp]}&nbsp;</span>
						<span>{AstroText.AstroMsg[asp.id]}&nbsp;</span>
						<span style={{fontFamily: AstroConst.NormalFont}}>
							离相&nbsp;误差{Math.round(asp.orb * 1000)/1000}
						</span>
					</div>
				);
				divs.push(dom);
			}
			
			for(let idx=0; idx<obj.None.length; idx++){
				let asp = obj.None[idx];
				if((!pars.has(asp.id)) && asp.id.indexOf('Pars') >= 0){
					continue;
				}
				if((!planets.has(asp.id))){
					continue;
				}
				let dom = (
					<div key={key + asp.id} style={{fontFamily: AstroConst.AstroFont}}>
						<span>&emsp;{AstroText.AstroMsg['Asp' + asp.asp]}&nbsp;</span>
						<span>{AstroText.AstroMsg[asp.id]}&nbsp;</span>
						<span style={{fontFamily: AstroConst.NormalFont}}>误差{Math.round(asp.orb * 1000)/1000}</span>
					</div>
				);
				divs.push(dom);
			}
			let space = (
				<div key={key + 'Space'}><span>&nbsp;</span></div>
			);
			divs.push(space);
		}
		let dom = (
			<div>
				<Row>
					<Col span={24}>{divs}</Col>
				</Row>
			</div>
		);
		return dom;
	}

	genImmediateAspDom(aspects){
		if(aspects === undefined || aspects === null){
			return null;
		}
		let divs = [];

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
				<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{AstroText.AstroMsg[key]}&nbsp;</span>
					<span>{AstroText.AstroMsg['Asp' + obj[0].asp]}&nbsp;</span>
					<span>{AstroText.AstroMsg[obj[0].id]}</span>&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>
						<Popover content={'误差' + Math.round(obj[0].orb * 1000)/1000} >
							离相；&nbsp;
						</Popover>
					</span>
					<span>{AstroText.AstroMsg['Asp' + obj[1].asp]}&nbsp;</span>
					<span>{AstroText.AstroMsg[obj[1].id]}</span>&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>
						<Popover content={'误差' + Math.round(obj[1].orb * 1000)/1000} >
							入相
						</Popover>
					</span>
				</div>
			);
			divs.push(dom);
		}
		let dom = (
			<div>
				<Row>
					<Col span={24}>{divs}</Col>
				</Row>
			</div>
		);
		return dom;
	}

	genOneSignAspDom(key, obj){
		let divs = [];
		
		let domtitle = (
			<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
				<span>{AstroText.AstroMsg[key]}</span>
			</div>
		);
		divs.push(domtitle);

		for(let idx=0; idx<obj.length; idx++){
			let asp = obj[idx];
			if((!pars.has(asp.id)) && asp.id.indexOf('Pars') >= 0){
				continue;
			}
			if(!planets.has(asp.id)){
				continue;
			}
			let dom = (
				<div key={key + asp.id} style={{fontFamily: AstroConst.AstroFont}}>
					<span>&emsp;{AstroText.AstroMsg['Asp' + asp.asp]}&nbsp;</span>
					<span>{AstroText.AstroMsg[asp.id]}</span>
				</div>
			);
			divs.push(dom);
		}
		return divs;
	}

	genSignAspDom(aspects){
		if(aspects === undefined || aspects === null){
			return null;
		}
		let divs = [];
		let rows = [];
		let rowobj = null;
		let k = 0;
		for(let i=0; i<AstroConst.LIST_OBJECTS.length; i++){
			let key = AstroConst.LIST_OBJECTS[i];
			let obj = aspects[key];
			if(obj === undefined || obj === null || !planets.has(key)){
				continue;
			}
			if(k % 3 === 0){
				rowobj = [];
				rows.push(rowobj);
			}
			let oneplanetDom = this.genOneSignAspDom(key, obj);
			rowobj.push(oneplanetDom);
			k++;
		}

		for(let i=0; i<rows.length; i++){
			let rowobj = rows[i];
			let cols = [];
			for(let j=0; j<rowobj.length; j++){
				let dom = (
					<Col key={'asp_' + j} span={8}>{rowobj[j]}</Col>
				);
				cols.push(dom);
			}
			let dom = (
				<Row key={'aspsrow' + i}>
					{cols}
				</Row>
			);
			divs.push(dom);
			if(i < rows.length - 1){
				let divider = <Divider key={'divider'+ i} dashed={true} />
				divs.push(divider)	
			}
		}

		let dom = (
			<div>
				{divs}
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

		let chart = this.props.value ? this.props.value : {};
		let aspects = chart.aspects ? chart.aspects : {};

		let normalAsp = this.genNormalAspDom(aspects.normalAsp);
		let immediateAsp = this.genImmediateAspDom(aspects.immediateAsp);
		let signAsp = this.genSignAspDom(aspects.signAsp);

		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		return (
			<div className={styles.scrollbar} style={style}>
				<Divider orientation="left">标准相位</Divider>
				{normalAsp}
				<Divider orientation="left">立即相位</Divider>
				{immediateAsp}
				<Divider orientation="left">星座相位</Divider>
				{signAsp}
			</div>
		);
	}
}

export default AstroAspect;

