import { Component } from 'react';
import { Row, Col } from 'antd';
import { XQCard as Card } from '../xq-ui';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

function safeArray(value){
	return Array.isArray(value) ? value : [];
}

class Gods extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};

		this.genGods = this.genGods.bind(this);
		this.genGodsDom = this.genGodsDom.bind(this);
	}

	genGodsDom(rec){
		if(rec === undefined || rec === null){
			return null;
		}
		let cols = this.genGods(rec, '整柱');
		let ganCols = this.genGods(rec.stem, '天干');
		let ziCols = this.genGods(rec.branch, '地支');
		let doms = [];
		// 整柱/天干/地支/太岁 四段各最多入 doms 一次,故字面量键即稳定且互不重复。
		if(cols){
			let row = (
				<Row gutter={12} key="pillar">
					{cols}
				</Row>
			);
			doms.push(row);
		}
		if(ganCols){
			let row = (
				<Row gutter={12} key="stem">
					{ganCols}
				</Row>
			);
			doms.push(row);
		}
		if(ziCols){
			let row = (
				<Row gutter={12} key="branch">
					{ziCols}
				</Row>
			);
			doms.push(row);
		}

		let taisuiCols = [];
		let spans = [];
		const taisuiGods = safeArray(rec.branch && rec.branch.taisuiGods);
		for(let i=0; i<taisuiGods.length; i++){
			let str = taisuiGods[i];
			let span = (
				<span key={i}>{str}&emsp;</span>
			);
			spans.push(span);
		}
		if(spans.length > 0){
			let title = (<Col key="title" span={4}>太岁：</Col>);
			taisuiCols.push(title);
			let content = (
				<Col key="content" span={20}>{spans}</Col>
			);
			taisuiCols.push(content);
		}
		if(taisuiCols.length > 0){
			let row = (
				<Row gutter={12} key="taisui">
					{taisuiCols}
				</Row>
			);
			doms.push(row);
		}
		if(doms.length > 0){
			return doms;
		}else{
			return null;
		}
	}

	genGods(rec, titleStr){
		if(rec === undefined || rec === null){
			return null;
		}
		let cols = [];
		let spans = [];
		const goodGods = safeArray(rec.goodGods);
		const neutralGods = safeArray(rec.neutralGods);
		const badGods = safeArray(rec.badGods);
		// 三个循环共用同一 spans 数组,下标区间重叠,故键须带 good/neutral/bad 前缀方能同层唯一。
		for(let i=0; i<goodGods.length; i++){
			let str = goodGods[i];
			let span = (
				<span key={`good-${i}`}>{str}&emsp;</span>
			);
			spans.push(span);
		}
		for(let i=0; i<neutralGods.length; i++){
			let str = neutralGods[i];
			let span = (
				<span key={`neutral-${i}`}>{str}&emsp;</span>
			);
			spans.push(span);
		}
		for(let i=0; i<badGods.length; i++){
			let str = badGods[i];
			let span = (
				<span key={`bad-${i}`}>{str}&emsp;</span>
			);
			spans.push(span);
		}
		if(spans.length > 0){
			let title = (<Col key="title" span={4}>{titleStr}：</Col>);
			cols.push(title);
			let content = (
				<Col key="content" span={20}>{spans}</Col>
			);
			cols.push(content);
		}
		if(cols.length > 0){
			return cols;
		}
		return null;
	}

	render(){
		let rec = this.props.value ? this.props.value : {};
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let yeardom = this.genGodsDom(rec.year);
		let monthdom = this.genGodsDom(rec.month);
		let daydom = this.genGodsDom(rec.day);
		let timedom = this.genGodsDom(rec.time);
		let taidom = this.genGodsDom(rec.tai);
		let mingdom = this.genGodsDom(rec.ming);
		let shendom = this.genGodsDom(rec.shen);

		return (
			<div className={styles.scrollbar} style={style}>
				<Card title='年柱' bordered={true} >
					{yeardom}
				</Card>	
				<Card title='月柱' bordered={true} >
					{monthdom}
				</Card>
				<Card title='日柱' bordered={true} >
					{daydom}
				</Card>
				<Card title='时柱' bordered={true} >
					{timedom}
				</Card>
				{
					taidom && (
						<Card title='胎元' bordered={true} >
							{taidom}
						</Card>		
					)
				}
				{
					mingdom && (
						<Card title='命宫' bordered={true} >
							{mingdom}
						</Card>		
					)
				}
				{
					shendom && (
						<Card title='身宫' bordered={true} >
							{shendom}
						</Card>		
					)
				}
			</div>
		);
	}
}

export default Gods;
