import { Component } from 'react';
import { Row, Col, Popover, } from 'antd';
import * as ZWConst from '../../constants/ZWConst';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。
import STAR_MEANING from '../ziwei/data/tables/ziweiStarMeaning.json';   // WP-7 星曜含义结构化

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
			let dom = this.genPopoverDom(rules, star);
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

	// WP-7:14 主星结构化属性块(五行/斗分/化气/主管+性格);杂曜给一句义。放自由文本上方。
	genMeaningHead(star){
		const m = STAR_MEANING.mainStars[star];
		const a = STAR_MEANING.assistStars[star];
		const boxStyle = { marginBottom: 8, padding: '6px 9px', background: 'var(--horosa-ziwei-selected-bg, rgba(120,72,232,0.08))', borderRadius: 4, fontSize: 12, lineHeight: '20px' };
		const lab = { opacity: 0.6, marginRight: 3 };
		if(m){
			return (
				<div key="main-meaning" style={boxStyle}>
					<div>
						<span style={lab}>五行</span>{m.wuxing}　<span style={lab}>斗分</span>{m.dou}
					</div>
					<div>
						<span style={lab}>化气</span>{m.huaqi}　<span style={lab}>主管</span>{m.zhu}
					</div>
					<div style={{ marginTop: 4 }}>{m.xing}</div>
				</div>
			);
		}
		if(a){ return (<div key="assist-meaning" style={boxStyle}>{a}</div>); }
		return null;
	}

	genPopoverDom(rules, star){
		let head = this.genMeaningHead(star);
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
				{head}
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
