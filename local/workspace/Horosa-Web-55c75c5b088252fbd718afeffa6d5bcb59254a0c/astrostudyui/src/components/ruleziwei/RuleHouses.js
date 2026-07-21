import { Component } from 'react';
import { Row, Col, Divider, Popover, } from 'antd';
import * as ZWConst from '../../constants/ZWConst';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

class RuleHouses extends Component{
	constructor(props) {
		super(props);

		this.genDoms = this.genDoms.bind(this);
		this.genPopoverDom = this.genPopoverDom.bind(this);

		this.genHouseTypeDoms = this.genHouseTypeDoms.bind(this);

	}

	genDoms(){
		let cols = [];
		let ZWRules = this.props.rules ? this.props.rules.ZWRules : null;
		if(ZWRules === null){
			return cols;
		}

		let houses = ZWConst.ZWHouses;
		for(let i=0; i<houses.length; i++){
			let house = houses[i];
			let rules = ZWRules.RuleHouses[house];
			let dom = this.genPopoverDom(rules);
			let title = house + '';
			let col = (
				<Col span={6} key={house}>
					<Popover content={dom} title={title}>
						{house}
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
				li = (<hr />);
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
						<li key={i}>{rule}</li>
					);	
				}
			}
			lis.push(li);
		}
		let rulesDom = (
			<div key="rules" style={{width: 400}}>
				<ul key="list">
					{lis}
				</ul>
			</div>
		);

		return rulesDom;
	}

	genHouseTypeDoms(){
		let cols = [];

		let ZWRules = this.props.rules ? this.props.rules.ZWRules : null;
		if(ZWRules === null){
			return cols;
		}

		for(let key in ZWRules.RuleHouseType){
			let rules = ZWRules.RuleHouseType[key];
			let dom = this.genPopoverDom(rules);
			let col = (
				<Col span={6} key={key}>
					<Popover content={dom} title={key}>
						{key}
					</Popover>					
				</Col>
			)
			cols.push(col);
		}
		return cols;
	}

	render(){
		let cols = this.genDoms();
		let houseTypes = this.genHouseTypeDoms();

		return (
			<div>
				<Row>
					{cols}
				</Row>
				<Divider />
				<Row>
					{houseTypes}
				</Row>
			</div>
		);
	}
}

export default RuleHouses;
