import { Component } from 'react';
import { Row, Col, Button, Divider, Popover, } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as ZWConst from '../../constants/ZWConst';

class RuleSihua extends Component{
	constructor(props) {
		super(props);

		this.genSihuaDoms = this.genSihuaDoms.bind(this);
		this.genSihuaRulesDom = this.genSihuaRulesDom.bind(this);

	}

	genSihuaDoms(){
		let rows = [];
		let gan = ZWConst.SiHua.gan;
		for(let g in gan){
			let stars = gan[g];
			let row = (
				<Row key={randomStr(8)}>
					<Col span={4}>{g + '：'}</Col>
					<Col span={5} style={ZWConst.SihuaColor[0]}>{stars[0]}</Col>
					<Col span={5} style={ZWConst.SihuaColor[1]}>{stars[1]}</Col>
					<Col span={5} style={ZWConst.SihuaColor[2]}>{stars[2]}</Col>
					<Col span={5} style={ZWConst.SihuaColor[3]}>{stars[3]}</Col>
				</Row>
			);
			rows.push(row);
		}
		return rows;
	}

	genSihuaRulesDom(){
		let rulesDom = [null, null, null, null];
		let shs = ZWConst.SiHua.hua;
		let ZWRules = this.props.rules ? this.props.rules.ZWRules : null;
		if(ZWRules === null){
			return rulesDom;
		}
		for(let i=0; i<shs.length; i++){
			let sihua = shs[i];
			let rules = ZWRules.RuleSihua[sihua];
			let lis = [];
			for(let j=0; j<rules.length; j++){
				let li = null;
				let rule = rules[j];
				if(rule === '=='){
					li = (
						<hr key={randomStr(8)} />
					);
				}else{
					if(rule instanceof Array){
						let slis = rule.map((sitem, idx)=>{
							return (<li>${sitem}</li>)
						})
						li = (
							<ul style={{marginRight: 10}}>
								{slis}
							</ul>
						)
					}else{
						li = (
							<li key={randomStr(8)}>{rule}</li>
						);	
					}
				}
	
				lis.push(li);
			}
			rulesDom[i] = (
				<div key={randomStr(8)} style={{width: 400}}>
					<ul key={randomStr(8)}>
						{lis}
					</ul>
				</div>
			);
		}

		return rulesDom;
	}

	render(){
		let sihuadoms = this.genSihuaDoms();

		let rules = this.genSihuaRulesDom();

		return (
			<div>
				<Row key={randomStr(8)}>
					<Col span={4}>天干</Col>
					<Col span={5} style={ZWConst.SihuaColor[0]}>
						<Popover content={rules[0]} title={'化' + ZWConst.SiHua.hua[0]}>
							<span style={{fontSize: 16}}>{ZWConst.SiHua.hua[0]}</span>
						</Popover>
					</Col>
					<Col span={5} style={ZWConst.SihuaColor[1]}>
						<Popover content={rules[1]} title={'化' + ZWConst.SiHua.hua[1]}>
							<span style={{fontSize: 16}}>{ZWConst.SiHua.hua[1]}</span>
						</Popover>
					</Col>
					<Col span={5} style={ZWConst.SihuaColor[2]}>
						<Popover content={rules[2]} title={'化' + ZWConst.SiHua.hua[2]}>
							<span style={{fontSize: 16}}>{ZWConst.SiHua.hua[2]}</span>
						</Popover>
					</Col>
					<Col span={5} style={ZWConst.SihuaColor[3]}>
						<Popover content={rules[3]} title={'化' + ZWConst.SiHua.hua[3]}>
							<span style={{fontSize: 16}}>{ZWConst.SiHua.hua[3]}</span>
						</Popover>
					</Col>
				</Row>
				{sihuadoms}
			</div>
		);
	}
}

export default RuleSihua;

