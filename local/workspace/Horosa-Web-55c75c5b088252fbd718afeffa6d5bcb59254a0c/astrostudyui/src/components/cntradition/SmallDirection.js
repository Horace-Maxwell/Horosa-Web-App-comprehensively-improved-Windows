import { Component } from 'react';
import { Row, Col, Popover, Divider, } from 'antd';
import { randomStr } from '../../utils/helper';
import { BaZiMsg } from '../../msg/bazimsg';
import styles from '../../css/styles.less';

class SmallDirection extends Component{
	constructor(props) {
		super(props);
		this.state = {
			
		};

		this.genDirectionDom = this.genDirectionDom.bind(this);
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

	genDirectionDom(dirs){
		let dirdoms = [];
		for(let i=0; i<dirs.length; i++){
			let dir = dirs[i];
			let age = dir.age;
			let year = dir.year;
			let subdir = dir.direct;
			let yeardir = dir.yearGanzi;
			let subgods = this.genGodsDom(subdir);
			let yeargods = this.genGodsDom(yeardir);
			let popsubcontent = (
				<div style={{width: 350}}>
					<Row key={randomStr(8)}>
						<Col span={24} key={randomStr(8)}>
							{BaZiMsg[subdir.stem.polar] + subdir.stem.cell + BaZiMsg[subdir.stem.element]}&bull;{BaZiMsg[subdir.stem.relative]}
						</Col>
						<Col span={24} key={randomStr(8)}>
							{BaZiMsg[subdir.branch.polar] + subdir.branch.cell + BaZiMsg[subdir.branch.element]}&bull;{BaZiMsg[subdir.branch.relative]}
						</Col>
						<Col span={24} key={randomStr(8)}><Divider /></Col>
					</Row>
					{subgods}
				</div>
			)
			let popyearcontent = (
				<div style={{width: 350}}>
					<Row key={randomStr(8)}>
						<Col span={24} key={randomStr(8)}>
							{BaZiMsg[yeardir.stem.polar] + yeardir.stem.cell + BaZiMsg[yeardir.stem.element]}&bull;{BaZiMsg[yeardir.stem.relative]}
						</Col>
						<Col span={24} key={randomStr(8)}>
							{BaZiMsg[yeardir.branch.polar] + yeardir.branch.cell + BaZiMsg[yeardir.branch.element]}&bull;{BaZiMsg[yeardir.branch.relative]}
						</Col>
						<Col span={24} key={randomStr(8)}><Divider /></Col>
					</Row>
					{yeargods}
					<h4>值年星宿：{yeardir.starCharger.name}</h4>
					<div>{yeardir.starCharger.event}</div>
				</div>
			)

			let row = (
				<Row key={randomStr(8)} gutter={12}>
					<Col span={9}>
						<Popover content={popsubcontent} title={'小运：' + subdir.ganzi}>
							小运：{subdir.ganzi}（{subdir.naying}）
						</Popover>
					</Col>
					<Col span={9}>
						<Popover content={popyearcontent} title={'流年：' + yeardir.ganzi + ' ' + year + ' ' + age + '岁'}>
							流年：{yeardir.ganzi}（{yeardir.naying}）
						</Popover>
					</Col>
					<Col span={3}>{year}</Col>
					<Col span={3}>{age}周岁</Col>
				</Row>
			);
			dirdoms.push(row);
		}
		return dirdoms;

	}

	render(){
		let rec = this.props.value ? this.props.value : {};
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let doms = this.genDirectionDom(rec.smallDirection);

		return (
			<div className={styles.scrollbar} style={style}>
				{doms}
			</div>
		);
	}
}

export default SmallDirection;


