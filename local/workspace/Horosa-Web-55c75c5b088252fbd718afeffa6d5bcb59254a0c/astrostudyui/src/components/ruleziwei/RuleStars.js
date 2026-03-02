import { Component } from 'react';
import { Row, Col, Button, Divider, Popover, } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as ZWConst from '../../constants/ZWConst';

class RuleStars extends Component{
	constructor(props) {
		super(props);

		this.genDoms = this.genDoms.bind(this);
		this.genPopoverDom = this.genPopoverDom.bind(this);

	}

	genDoms(){
		let cols = [];
		let ZWRules = this.props.rules ? this.props.rules.ZWRules : null;
		if(ZWRules === null){
			return cols;
		}
		let stars = ZWRules.ZWStarArray;
		for(let i=0; i<stars.length; i++){
			let star = stars[i];
			let rules = ZWRules.RuleStars[star];
			let dom = this.genPopoverDom(rules);
			let title = star + '';
			let col = (
				<Col span={4} key={randomStr(8)}>
					<Popover content={dom} title={title}>
						{star}
					</Popover>					
				</Col>
			);
			cols.push(col);
		}
		return cols;
	}

	genPopoverDom(rules){
		let lis = [];
		for(let i=0; i<rules.length; i++){
			let rule = rules[i];
			let li = null;
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
		let rulesDom = (
			<div key={randomStr(8)} style={{width: 400, height:400, overflow: 'auto'}}>
				<ul key={randomStr(8)}>
					{lis}
				</ul>
			</div>
		);

		return rulesDom;
	}

	render(){
		let cols = this.genDoms();

		return (
			<div>
				<Row>
					{cols}
				</Row>
			</div>
		);
	}
}

export default RuleStars;

