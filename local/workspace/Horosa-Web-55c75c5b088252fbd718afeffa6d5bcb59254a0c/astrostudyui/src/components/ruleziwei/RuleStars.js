import { Component } from 'react';
import { Row, Col, Popover, } from 'antd';
import * as ZWConst from '../../constants/ZWConst';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

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
				<Col span={4} key={star}>
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
					<hr key={i} />
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
						<li key={i}>{rule}</li>
					);	
				}
			}
			lis.push(li);
		}
		let rulesDom = (
			<div key="rules" style={{width: 400, height:400, overflow: 'auto'}}>
				<ul key="list">
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
