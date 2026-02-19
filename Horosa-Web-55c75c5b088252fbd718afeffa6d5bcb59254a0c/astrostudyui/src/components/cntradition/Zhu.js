import { Component } from 'react';
import { Row, Col, } from 'antd';
import { randomStr } from '../../utils/helper';
import { BaZiMsg, BaZiColor } from '../../msg/bazimsg';

class Zhu extends Component{
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
		let rec = this.props.value ? this.props.value : { stem:{}, branch:{}};
		let gong12 = this.props.gong12;
		let stemInBranchDom = this.genStemInBranchDom(rec.stemInBranch);

		let zhu = rec.zhu;
		if(zhu === '年' || zhu === '月' || zhu === '日' || zhu === '时'){
			zhu = zhu + '柱'
		}else if(zhu === '胎'){
			zhu = zhu + '元'
		}else{
			zhu = zhu + '宫'
		}

		let gong12Gan = null;
		let gong12Zi = null;
		if(gong12){
			gong12Gan = gong12['干'].name;
			gong12Zi = gong12['支'].name;
		}

		let gzphasePad = rec && rec.ganziPhase && rec.ganziPhase.length === 1 ? (<span>&emsp;</span>) : null;
		let nyphasePad = rec && rec.nayingPhase && rec.nayingPhase.length === 1 ? (<span>&emsp;</span>) : null;

		let stemColor = BaZiColor[rec.stem.polar + rec.stem.element];
		let branchColor = BaZiColor[rec.branch.polar + rec.branch.element];

		let needZiShiShen = true;
		if(this.props.baziOpt && this.props.baziOpt.onlyZiGanShen){
			needZiShiShen = false;
		}

		let gua = null;
		if(rec.zhiStarGod){
			gua = rec.zhiStarGod.gua;
		}

		return (
			<div>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span style={{fontSize: 18}}>{zhu}</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span>{gong12Gan}&bull;{gong12Zi}</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span style={{fontSize: 16}}>{BaZiMsg[rec.stem.polar] + BaZiMsg[rec.stem.element]}&bull;{BaZiMsg[rec.stem.relative]}</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center', color:stemColor}}>
						<span style={{fontSize: 26}}>{rec.stem.cell}</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center', color:branchColor}}>
						<span style={{fontSize: 26}}>{rec.branch.cell}</span>
					</Col>
				</Row>
				<Row>
					{
						needZiShiShen && (
							<Col span={24} style={{textAlign:'center'}}>
								<span style={{fontSize: 16}}>{BaZiMsg[rec.branch.polar] + BaZiMsg[rec.branch.element]}&bull;{BaZiMsg[rec.branch.relative]}</span>
							</Col>	
						)
					}
					<Col span={24}><span>&nbsp;</span></Col>
				</Row>
				{stemInBranchDom}
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span>&emsp;旬空&bull;{rec.xunEmpty}</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span>&emsp;干支&bull;{rec.ganziPhase}{gzphasePad}</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span>{rec.naying}&bull;{rec.nayingPhase}{nyphasePad}</span>
					</Col>
				</Row>
				<Row>
					<Col span={24} style={{textAlign:'center'}}>
						<span>&emsp;{gua}</span>
					</Col>
				</Row>
			</div>
		)
	}

}

export default Zhu;
