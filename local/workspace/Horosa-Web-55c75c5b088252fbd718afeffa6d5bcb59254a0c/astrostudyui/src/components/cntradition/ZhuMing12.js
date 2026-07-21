import { Component } from 'react';
import { Row, Col, } from 'antd';
import { BaZiMsg, ZhiColor } from '../../msg/bazimsg';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

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
				<Col span={24} style={{textAlign: 'center'}} key={`stem-${idx}`}>
					<span>{BaZiMsg[item.polar] + item.cell + BaZiMsg[item.element]}&bull;{BaZiMsg[item.relative]}</span>
				</Col>
			);
		});
		for(let i=cols.length; i<3; i++){
			// padding cols share the `cols` array with the mapped stems above, so use a distinct prefix
			let emptycol = (<Col span={24} key={`empty-${i}`}><span>&nbsp;</span></Col>);
			cols.push(emptycol);
		}

		let dom = (
			<Row key="stem-in-branch">
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
