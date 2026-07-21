import { Component } from 'react';
import { Row, Col } from 'antd';
import { XQCard as Card } from '../xq-ui';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

function relationItemText(item){
	if(!item){
		return '';
	}
	return `${item.cell || ''}（${item.zhu || ''}）`;
}

class ZiHeCong extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};

		this.genHeDom = this.genHeDom.bind(this);
		this.genCongDom = this.genCongDom.bind(this);
		this.genXingDom = this.genXingDom.bind(this);
	}

	genHeDom(rec){
		let rows = [];
		if(!rec){
			return rows;
		}
		for(let key in rec){
			let ary = rec[key];
			if(!Array.isArray(ary) || ary.length === 0){
				continue;
			}
			let spans = ary.map((item, idx)=>{
				return (
					<span key={idx}>{relationItemText(item)}&emsp;</span>
				)
			});
			// 尾部箭头段唯一,且字面量键不会与前面的数字下标键相撞。
			let spanhe = (
				<span key="he">&rarr;&emsp;{key}</span>
			);
			spans.push(spanhe);
			let row = (
				<Row key={key}>
					<Col offset={1} span={23}>
						{spans}
					</Col>
				</Row>
			);
			rows.push(row);
		}
		return rows;
	}

	genCongDom(rec){
		let rows = [];
		if(!rec){
			return rows;
		}
		for(let key in rec){
			let ary = rec[key];
			if(!Array.isArray(ary) || ary.length < 2){
				continue;
			}
			let gan0 = (<span key="gan0">{relationItemText(ary[0])}&emsp;</span>);
			let gan1 = (<span key="gan1">{relationItemText(ary[1])}&emsp;</span>);
			let cong = (<span key="cong">冲</span>);
			let row = (
				<Row key={key}>
					<Col offset={1} span={23}>
						{gan0} 
						{cong} 
						{gan1}
					</Col>
				</Row>
			);
			rows.push(row);
		}
		return rows;
	}

	genXingDom(rec){
		let rows = [];
		if(!rec){
			return rows;
		}
		for(let key in rec){
			let ary = rec[key];
			if(!Array.isArray(ary) || ary.length === 0){
				continue;
			}
			let spans = ary.map((item, idx)=>{
				return (
					<span key={idx}>{relationItemText(item)}&emsp;</span>
				)
			});
			let row = (
				<Row key={key}>
					<Col offset={1} span={23}>
						{spans}
					</Col>
				</Row>
			);
			rows.push(row);
		}
		return rows;
	}


	render(){
		let rec = this.props.value ? this.props.value : {};
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let hedom = this.genHeDom(rec.ziHe6);
		let gongdom = this.genHeDom(rec.ziHe3);
		let huidom = this.genHeDom(rec.ziHui);
		let congdom = this.genCongDom(rec.ziCong);
			let xingdom = this.genXingDom(rec.ziXing);
			let cuandom = this.genXingDom(rec.ziCuan);
			let podom = this.genXingDom(rec.ziPo);
			const empty = <div style={{padding: '8px 12px'}}>暂无资料</div>;

			return (
				<div className={styles.scrollbar} style={style}>
					<Card title='合' bordered={true} >
						{hedom.length ? hedom : empty}
					</Card>
					<Card title='拱' bordered={true} >
						{gongdom.length ? gongdom : empty}
					</Card>
					<Card title='会' bordered={true} >
						{huidom.length ? huidom : empty}
					</Card>
					<Card title='刑' bordered={true} >
						{xingdom.length ? xingdom : empty}
					</Card>
					<Card title='冲' bordered={true} >
						{congdom.length ? congdom : empty}
					</Card>
					<Card title='穿' bordered={true} >
						{cuandom.length ? cuandom : empty}
					</Card>
					<Card title='破' bordered={true} >
						{podom.length ? podom : empty}
					</Card>
				</div>
			);
	}
}

export default ZiHeCong;
