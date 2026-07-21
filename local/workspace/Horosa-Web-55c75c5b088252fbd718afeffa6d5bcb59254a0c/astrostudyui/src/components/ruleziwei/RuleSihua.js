import { Component } from 'react';
import { Row, Col, Popover, } from 'antd';
import * as ZWConst from '../../constants/ZWConst';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

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
				<Row key={g}>
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
						<hr key={j} />
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
							<li key={j}>{rule}</li>
						);	
					}
				}
	
				lis.push(li);
			}
			// 内层 ul 复合 i:它随外层化曜循环逐轮重建,裸字面量会跨轮撞键
			rulesDom[i] = (
				<div key={i} style={{width: 400}}>
					<ul key={`rules-${i}`}>
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
				<Row key='sihua-header'>
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
