import { Component } from 'react';
import { Row, Card, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import styles from '../../css/styles.less';

class AstroPredictPlanetSign extends Component{

	constructor(props) {
		super(props);
		this.state = {

		}
		this.genDom = this.genDom.bind(this);
	}


	genDom(chartObj){
		const doms = [];
		const planetsig = chartObj && chartObj.predict && chartObj.predict.PlanetSign
			? chartObj.predict.PlanetSign
			: {};
		const keys = Object.keys(planetsig);
		if(keys.length === 0){
			return (
				<div style={{padding: 12}}>
					暂无可能性数据
				</div>
			);
		}
		for(let i=0; i<keys.length; i++){
			const key = keys[i];
			let list = planetsig[key];
			if(!Array.isArray(list)){
				list = [];
			}
			let desc = list.map((item, idx)=>{
				return (
					<li key={`${key}_${idx}`}>{item}</li>
				)
			});
			let dom = (
				<Row key={key}>
					<Card title={AstroText.AstroMsg[key] + '（' + AstroText.AstroTxtMsg[key] + '）'} 
						bordered={true} 
						style={{
							fontFamily: AstroConst.AstroFont,
							background: AstroConst.AstroColor.Backgroud
						}}>
							<ul style={{fontFamily: AstroConst.NormalFont}}>
								{desc}
							</ul>
					</Card>
				</Row>
			);
			doms.push(dom);
		}
		return doms;
	}


	render(){
		const chart = this.props.value || {};
		const dom = this.genDom(chart);

		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		return (
			<div className={styles.scrollbar} style={style}>
				{dom}
			</div>
		);
	}
}

export default AstroPredictPlanetSign;
