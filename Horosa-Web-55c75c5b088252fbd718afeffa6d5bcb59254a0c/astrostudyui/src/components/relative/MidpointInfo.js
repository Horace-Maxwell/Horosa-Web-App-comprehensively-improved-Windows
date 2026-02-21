import { Component } from 'react';
import { Row, Col, Divider, Popover, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from '../astro/AstroHelper';
import AstroObjectLabel from '../astro/AstroObjectLabel';
import { randomStr} from '../../utils/helper'
import styles from '../../css/styles.less';

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
	}

	genAspectDom(aspects, title){
		if(aspects === undefined || aspects === null){
			return null;
		}
		const chartSources = this.props.chartSources || this.props.value;
		let divs = [];

		for(let i=0; i<LIST_POINTS.length; i++){
			let key = LIST_POINTS[i];
			let obj = aspects[key];
			if(obj === undefined || obj === null || !planets.has(key)){
				continue;
			}
			let domtitle = (
				<div key={randomStr(8)}>
					<span style={{fontFamily: AstroConst.NormalFont}}>{title}&nbsp;</span>
					<AstroObjectLabel id={key} chartSources={chartSources} />
				</div>
			);
			divs.push(domtitle);

			for(let idx=0; idx<obj.length; idx++){
				let asp = obj[idx];

				let dom = (
					<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
						<span>&emsp;{AstroText.AstroMsg['Asp' + asp.aspect]}&nbsp;</span>
						<span style={{fontFamily: AstroConst.NormalFont}}>（</span>
						<AstroObjectLabel id={asp.midpoint.idA} chartSources={chartSources} />
						<span style={{fontFamily: AstroConst.NormalFont}}>&nbsp;|&nbsp;</span>
						<AstroObjectLabel id={asp.midpoint.idB} chartSources={chartSources} />
						<span style={{fontFamily: AstroConst.NormalFont}}>）&nbsp;</span>
						<span style={{fontFamily: AstroConst.NormalFont}}>
							误差{Math.round(asp.delta * 1000)/1000}
						</span>
					</div>
				);
				divs.push(dom);
			}

			let space = (
				<div key={randomStr(8)}><span>&nbsp;</span></div>
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
