import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Row, Col, Divider, Popover} from 'antd';
import { XQCard as Card, XQTabs as Tabs } from '../xq-ui';
import { BaZiMsg } from '../../msg/bazimsg';
import { birthMonthDayFromBazi, resolveStarCharger } from './starChargerLazy';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

const TabPane = Tabs.TabPane;

function safeArray(value){
	return Array.isArray(value) ? value : [];
}

function describeStemBranch(item){
	if(!item){
		return '';
	}
	return `${BaZiMsg[item.polar] || ''}${item.cell || ''}${BaZiMsg[item.element] || ''}•${BaZiMsg[item.relative] || item.relative || ''}`;
}

class MainDirection extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

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
		// 柱/干/支/岁 四段各最多入 doms 一次,故字面量键即稳定且互不重复。
		if(cols){
			let row = (
				<Row key="pillar">
					{cols}
				</Row>
			);
			doms.push(row);
		}
		if(ganCols){
			let row = (
				<Row key="stem">
					{ganCols}
				</Row>
			);
			doms.push(row);
		}
		if(ziCols){
			let row = (
				<Row key="branch">
					{ziCols}
				</Row>
			);
			doms.push(row);
		}

		let taisuiCols = [];
		let spans = [];
			const taisuiGods = safeArray(rec.branch && rec.branch.taisuiGods);
			if(taisuiGods.length > 0){
				spans.push(taisuiGods.join('，'));
			}
		if(spans.length > 0){
			let content = (
				<Col key="taisui" span={24}>
					<div>岁：&emsp;{spans.join('，')}</div>
				</Col>
			);
			taisuiCols.push(content);
		}
		if(taisuiCols.length > 0){
			let row = (
				<Row key="taisui">
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
			if(goodGods.length > 0){
				spans.push(goodGods.join('，'));
			}
			if(neutralGods.length > 0){
				spans.push(neutralGods.join('，'));
			}
			if(badGods.length > 0){
				spans.push(badGods.join('，'));
			}

		if(spans.length > 0){
			let content = (
				<Col key={titleStr} span={24}>
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
				let sub = dir[i] || {};
				let y = startYear + i;
				let dirtm = y;
				let gods = this.genGodsDom(sub);
				// starCharger 惰性化：null 时按公历年补算（buildStarChargerForYear，与 eager 逐字等价）。
				let starCharger = resolveStarCharger(sub.starCharger, sub.year != null ? sub.year : y, this._birthMonth, this._birthDay);
				let popcontent = (
					<div style={{width: 350}}>
						<Row key="stemBranch" style={{width: 350}}>
							<Col span={24} key="stem">
								{describeStemBranch(sub.stem)}
							</Col>
							<Col span={24} key="branch">
								{describeStemBranch(sub.branch)}
							</Col>
						</Row>
						<Divider />
						{gods}
						<h4>值年星宿：{starCharger.name || '暂无'}</h4>
						<div>{starCharger.event || ''}</div>
					</div>
				)
				let titlerow = (
					<Popover content={popcontent} title={(sub.ganzi || '') + ' ' + dirtm + ' ' + (age + i) + '岁'} key={i}>
						<Row key={i}>
							<Col span={4}>{sub.ganzi || ''}</Col>
							<Col span={6}>{sub.naying || ''}</Col>
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
				<div key="mainDirect">
					<Row>
						<Col span={12}>{[mainDirect.ganzi, mainDirect.ganziPhase].filter(Boolean).join('-')}</Col>
						<Col span={12}>{[mainDirect.naying, mainDirect.nayingPhase].filter(Boolean).join('-')}</Col>
						<Col span={12} key="stem">
							{describeStemBranch(mainDirect.stem)}
						</Col>
						<Col span={12} key="branch">
							{describeStemBranch(mainDirect.branch)}
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
					let mainDirect = dir.mainDirect || {};
					let subdir = this.genSubDirectDom(safeArray(dir.subDirect), startYear, age, mainDirect, directTime, height);
					let pane = (
						<TabPane tab={startYear + ' ' + (mainDirect.ganzi || '')} key={i}>
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
		// starCharger 惰性补算所需出生月/日（从 nongli.birth 解析），供 genSubDirectDom 用。
		const bmd = birthMonthDayFromBazi(rec);
		this._birthMonth = bmd.month;
		this._birthDay = bmd.day;
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto',
			overflowX:'hidden',
		};

			let doms = this.genDirectionDom(safeArray(rec.direction), rec.directTime, height);
			let directAge = Number.isFinite(rec.directAge) ? rec.directAge.toFixed(0) : '';
			let directYear = typeof rec.directTime === 'string' ? rec.directTime.substr(0, 4) : '';

		return (
			<div className={styles.scrollbar} style={style}>
				<Row style={{marginLeft:20}}>
						<Col span={24} style={{fontSize: 16, fontWeight: 'bold'}}>
							{'上运时间：' + directAge + '周岁 ' + directYear + ' '}
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
