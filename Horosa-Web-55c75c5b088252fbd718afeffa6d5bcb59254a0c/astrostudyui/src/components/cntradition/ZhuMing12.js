import { Component } from 'react';
import { Row, Col, } from 'antd';
import { randomStr } from '../../utils/helper';
import { BaZiMsg, ZhiColor } from '../../msg/bazimsg';

export default class ZhuMing12 extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};

		this.genStemInBranchDom = this.genStemInBranchDom.bind(this);
	}

	genStemInBranchDom(stems){
		if(stems === undefined || stems === null){
			return null;
		}

		let cols = stems.map((item, idx)=>{
			return (
				<Col span={24} style={{textAlign: 'center'}} key={randomStr(8)}>
					<span>{BaZiMsg[item.polar] + item.cell + BaZiMsg[item.element]}&bull;{BaZiMsg[item.relative]}</span>
				</Col>
			);
		});
		for(let i=cols.length; i<3; i++){
			let emptycol = (<Col span={24} key={randomStr(8)}><span>&nbsp;</span></Col>);
			cols.push(emptycol);
		}

		let dom = (
			<Row key={randomStr(8)}>
				{cols}
			</Row>
		);

		return dom;
	}

	render(){
		let rec = this.props.value ? this.props.value : { };

		let gods = rec.gods ? rec.gods.join('，') : null;
		let star = rec.star;

		let zicolor = ZhiColor[rec.zhi];

		let gua = rec.gua ? rec.gua : null;

		return (
			<div>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span style={{fontSize: 18}}>命宫</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span style={{fontSize: 16}}>十二串宫</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center', color: zicolor}}>
						<span style={{fontSize: 26}}>{rec.zhi}</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span style={{fontSize: 16}}>{star}</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span style={{fontSize: 14}}>{gods}</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span style={{fontSize: 14}}>{gua}</span>
					</Col>
				</Row>
			</div>
		)
	}

}
