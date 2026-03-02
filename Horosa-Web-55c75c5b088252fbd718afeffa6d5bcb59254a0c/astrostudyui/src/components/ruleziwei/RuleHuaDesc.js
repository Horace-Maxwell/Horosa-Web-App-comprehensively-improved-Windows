import { Component } from 'react';
import { Row, Col, Button, Divider, Popover, } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as ZWConst from '../../constants/ZWConst';

class RuleHuaDesc extends Component{
	constructor(props) {
		super(props);

		this.genDoms = this.genDoms.bind(this);
		this.genPopoverDom = this.genPopoverDom.bind(this);
		this.genHuaInHouseDom = this.genHuaInHouseDom.bind(this);
		this.genPopoverDomInObj = this.genPopoverDomInObj.bind(this);
	}

	genDoms(huas){
		let cols = [];
		for(let key in huas){
			let rules = huas[key];
			let dom = this.genPopoverDom(rules);
			let col = (
				<Col span={8} key={randomStr(8)}>
					<Popover content={dom} title={key}>
						{key}
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
						return (<li>{sitem}</li>)
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


	genHuaInHouseDom(){
		let cols = [];
		let ZWRuleSihua = this.props.rules ? this.props.rules.ZWRuleSihua : null;
		if(ZWRuleSihua === null){
			return cols;
		}
		for(let key in ZWRuleSihua.HuaInHouse){
			let hua = ZWRuleSihua.HuaInHouse[key];
			let dom = this.genPopoverDomInObj(hua);
			let title = key + '在命盘'
			let col = (
				<Col span={12} key={randomStr(8)}>
					<Popover content={dom} title={title}>
						<span style={ZWConst.SihuaColor[key]}>{title}</span>						
					</Popover>					
				</Col>
			);
			cols.push(col);
		}
		return cols;
	}

	genPopoverDomInObj(hua){
		let lis = [];
		for(let key in hua){
			let houslis = [];		
			let rules = hua[key];
			for(let i=0; i<rules.length; i++){
				let rule = rules[i];
				let li = null;
				if(rule === '=='){
					li = (
						<hr key={randomStr(8)} />
					);
				}else{
					li = (
						<li key={randomStr(8)}>{rule}</li>
					);
				}
				houslis.push(li);
			}

			let house = (
				<li key={randomStr(8)}>
					<div>
						{key}
					</div>
					<ul>{houslis}</ul>
				</li>
			);
			lis.push(house);
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
		let cols = null;
		let multicols = null;
		let ZWRuleSihua = this.props.rules ? this.props.rules.ZWRuleSihua : null;
		if(ZWRuleSihua){
			cols = this.genDoms(ZWRuleSihua.TwoHua);
			multicols = this.genDoms(ZWRuleSihua.MultiHua);	
		}
		let huaInHouse = this.genHuaInHouseDom();

		return (
			<div>
				<Row>
					{huaInHouse}
				</Row>
				<Divider orientation='left'></Divider>
				<Row>
					{cols}
					{multicols}
				</Row>
			</div>
		);
	}
}

export default RuleHuaDesc;

