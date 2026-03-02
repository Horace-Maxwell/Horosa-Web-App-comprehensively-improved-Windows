import { Component } from 'react';
import { Row, Col, Card, } from 'antd';
import { randomStr } from '../../utils/helper';
import styles from '../../css/styles.less';

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
		for(let key in rec){
			let ary = rec[key];
			let spans = ary.map((item, idx)=>{
				return (
					<span key={randomStr(8)}>{item.cell}（{item.zhu}）&emsp;</span>
				)
			});
			let spanhe = (
				<span key={randomStr(8)}>&rarr;&emsp;{key}</span>
			);
			spans.push(spanhe);
			let row = (
				<Row key={randomStr(8)}>
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
		for(let key in rec){
			let ary = rec[key];
			let gan0 = (<span key={randomStr(8)}>{ary[0].cell}（{ary[0].zhu}）&emsp;</span>);
			let gan1 = (<span key={randomStr(8)}>{ary[1].cell}（{ary[1].zhu}）&emsp;</span>);
			let cong = (<span key={randomStr(8)}>冲</span>);
			let row = (
				<Row key={randomStr(8)}>
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

		return (
			<div className={styles.scrollbar} style={style}>
				<Card title='合' bordered={true} >
					{hedom}
				</Card>
				<Card title='冲' bordered={true} >
					{congdom}
				</Card>
			</div>
		);
	}
}

export default GanHeCong;


