import { Component } from 'react';
import { Row, Col, Card, Tabs, Divider, Popover} from 'antd';
import { randomStr } from '../../utils/helper';
import { BaZiMsg } from '../../msg/bazimsg';
import styles from '../../css/styles.less';

const TabPane = Tabs.TabPane;

class MainDirection extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};
		this.genDirectionDom = this.genDirectionDom.bind(this);
		this.genSubDirectDom = this.genSubDirectDom.bind(this);
		this.genGods = this.genGods.bind(this);
		this.genGodsDom = this.genGodsDom.bind(this);
	}

	genGodsDom(rec){
		if(rec === undefined || rec === null){
			return null;
		}
		let cols = this.genGods(rec, '柱');
		let ganCols = this.genGods(rec.stem, '干');
		let ziCols = this.genGods(rec.branch, '支');
		let doms = [];
		if(cols){
			let row = (
				<Row key={randomStr(8)}>
					{cols}
				</Row>
			);
			doms.push(row);
		}
		if(ganCols){
			let row = (
				<Row key={randomStr(8)}>
					{ganCols}
				</Row>
			);
			doms.push(row);
		}
		if(ziCols){
			let row = (
				<Row key={randomStr(8)}>
					{ziCols}
				</Row>
			);
			doms.push(row);
		}

		let taisuiCols = [];
		let spans = [];
		if(rec.branch.taisuiGods.length > 0){
			spans.push(rec.branch.taisuiGods.join('，'));
		}
		if(spans.length > 0){
			let content = (
				<Col key={randomStr(8)} span={24}>
					<div>岁：&emsp;{spans.join('，')}</div>
				</Col>
			);
			taisuiCols.push(content);
		}
		if(taisuiCols.length > 0){
			let row = (
				<Row key={randomStr(8)}>
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
		let cols = [];
		let spans = [];
		if(rec.goodGods.length > 0){
			spans.push(rec.goodGods.join('，'));
		}
		if(rec.neutralGods.length > 0){
			spans.push(rec.neutralGods.join('，'));
		}
		if(rec.badGods.length > 0){
			spans.push(rec.badGods.join('，'));
		}

		if(spans.length > 0){
			let content = (
				<Col key={randomStr(8)} span={24}>
					<div>{titleStr}：&emsp;{spans.join('，')}</div>
				</Col>
			);
			cols.push(content);
		}
		if(cols.length > 0){
			return cols;
		}
		return null;
	}


	genSubDirectDom(dir, startYear, age, mainDirect, directTime, height){
		let dirdoms = [];
		for(let i=0; i<dir.length; i++){
			let sub = dir[i];
			let y = startYear + i;
			let dirtm = y;
			let gods = this.genGodsDom(sub);
			let popcontent = (
				<div style={{width: 350}}>
					<Row key={randomStr(8)} style={{width: 350}}>
						<Col span={24} key={randomStr(8)}>
							{BaZiMsg[sub.stem.polar] + sub.stem.cell + BaZiMsg[sub.stem.element]}&bull;{BaZiMsg[sub.stem.relative]}
						</Col>
						<Col span={24} key={randomStr(8)}>
							{BaZiMsg[sub.branch.polar] + sub.branch.cell + BaZiMsg[sub.branch.element]}&bull;{BaZiMsg[sub.branch.relative]}
						</Col>
					</Row>
					<Divider />
					{gods}
					<h4>值年星宿：{sub.starCharger.name}</h4>
					<div>{sub.starCharger.event}</div>
				</div>
			)
			let titlerow = (
				<Popover content={popcontent} title={sub.ganzi + ' ' + dirtm + ' ' + (age + i) + '岁'} key={randomStr(8)}>
					<Row key={randomStr(8)}>
						<Col span={4}>{sub.ganzi}</Col>
						<Col span={6}>{sub.naying}</Col>
						<Col span={9}>{dirtm}</Col>
						<Col span={5}>{age + i}岁</Col>
					</Row>
				</Popover>
			);

			dirdoms.push(titlerow);
		}
		let dirTime = startYear;

		let maingods = this.genGodsDom(mainDirect);
		let title = (
			<div key={randomStr(8)}>
				<Row>
					<Col span={12}>{mainDirect.ganzi + '-' + mainDirect.ganziPhase}</Col>
					<Col span={12}>{mainDirect.naying + '-' + mainDirect.nayingPhase}</Col>
					<Col span={12} key={randomStr(8)}>
						{BaZiMsg[mainDirect.stem.polar] + mainDirect.stem.cell + BaZiMsg[mainDirect.stem.element]}&bull;{BaZiMsg[mainDirect.stem.relative]}
					</Col>
					<Col span={12} key={randomStr(8)}>
						{BaZiMsg[mainDirect.branch.polar] + mainDirect.branch.cell + BaZiMsg[mainDirect.branch.element]}&bull;{BaZiMsg[mainDirect.branch.relative]}
					</Col>
				</Row>
				{maingods}
				<Row>
					<Col span={24}>{'开始时间：' + dirTime}</Col>
				</Row>
			</div>
		);
		let dom = (
			<Card title={title} bordered={false}>
				{dirdoms}
			</Card>
		);
		return dom;
	}

	genDirectionDom(dirs, directTime, height){
		let panes = [];
		if(dirs && dirs.length){
			for(let i = 0; i<dirs.length && i<8; i++){
				let dir = dirs[i];
				let age = dir.age;
				let startYear = dir.startYear;
				let mainDirect = dir.mainDirect;
				let subdir = this.genSubDirectDom(dir.subDirect, startYear, age, mainDirect, directTime, height);
				let pane = (
					<TabPane tab={startYear + ' ' + mainDirect.ganzi} key={i}>
						{subdir}
					</TabPane>
				);
				panes.push(pane);
			}	
		}
		return panes;
	}

	render(){
		let rec = this.props.value ? this.props.value : {};
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let doms = this.genDirectionDom(rec.direction, rec.directTime, height);

		return (
			<div className={styles.scrollbar} style={style}>
				<Row style={{marginLeft:20}}>
					<Col span={24} style={{fontSize: 16, fontWeight: 'bold'}}>
						{'上运时间：' + rec.directAge.toFixed(0) + '周岁 ' + rec.directTime.substr(0, 4) + ' '}
					</Col>
				</Row>
				<Tabs defaultActiveKey="0" tabPosition='right' style={{marginTop: 15}}>
					{doms}
				</Tabs>
			</div>
		);
	}
}

export default MainDirection;


