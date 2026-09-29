import { Component } from 'react';
import { Row, Col } from 'antd';
import { XQCard as Card } from '../xq-ui';

import styles from '../../css/styles.less';

function relationItemText(item){
	if(!item){
		return '';
	}
	return `${item.cell || ''}（${item.zhu || ''}）`;
}

class GanHeCong extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};
		this.genHeDom = this.genHeDom.bind(this);
		this.genCongDom = this.genCongDom.bind(this);
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
					<span key={`s1-${idx}`}>{relationItemText(item)}&emsp;</span>
				)
			});
			let spanhe = (
				<span key={`s2-${key}`}>&rarr;&emsp;{key}</span>
			);
			spans.push(spanhe);
			let row = (
				<Row key={`s3-${key}`}>
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
			let gan0 = (<span key={`s4-${key}`}>{relationItemText(ary[0])}&emsp;</span>);
			let gan1 = (<span key={`s5-${key}`}>{relationItemText(ary[1])}&emsp;</span>);
			let cong = (<span key={`s6-${key}`}>冲</span>);
			let row = (
				<Row key={`s7-${key}`}>
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

	render(){
		let rec = this.props.value ? this.props.value : {};
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

			let hedom = this.genHeDom(rec.ganHe);
			let congdom = this.genCongDom(rec.ganCong);
			const empty = <div style={{padding: '8px 12px'}}>暂无资料</div>;

			return (
				<div className={styles.scrollbar} style={style}>
					<Card title='合' bordered={true} >
						{hedom.length ? hedom : empty}
					</Card>
					<Card title='冲' bordered={true} >
						{congdom.length ? congdom : empty}
					</Card>
				</div>
			);
	}
}

export default GanHeCong;
