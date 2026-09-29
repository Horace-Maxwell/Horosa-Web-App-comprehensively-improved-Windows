import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Row, Col } from 'antd';

import { BaZiMsg } from '../../msg/bazimsg';
import MDSDirect from './MDSDirect';
import MDSYear from './MDSYear';
import { birthMonthDayFromBazi } from './starChargerLazy';
import styles from '../../css/styles.less';


class MainDirectionSimple extends Component{
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

		this.genDoms = this.genDoms.bind(this);
	}


	genDoms(dirs, birthMonth, birthDay, ageStyle){
		let dom = [];
		if(dirs && dirs.length){
			let sz = dirs.length;
			let span = Math.floor(24 / 8);
			for(let i=0; i<sz; i++){
				let dir = dirs[i];
				if(i !== 0 && (i % 8 == 0)) {
					let col = (
						<Col span={24} key={`s1-${i}`}><hr /></Col>
					);
					dom.push(col);
				}
				let col = (
					<Col span={span} key={`s2-${i}`}>
						<Row>
							<Col span={24}><MDSDirect value={dir} ageStyle={ageStyle} /></Col>
						</Row>
						<Row>
							<Col span={24}><MDSYear value={dir} birthMonth={birthMonth} birthDay={birthDay} ageStyle={ageStyle} /></Col>
						</Row>
					</Col>
				)
				dom.push(col)
			}
		}

		return dom;
	}

	render(){
		let rec = this.props.value ? this.props.value : {};
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto',
			overflowX:'hidden',
		};

		// starCharger 惰性补算所需出生月/日（从 nongli.birth 解析），下传 MDSYear。
		const bmd = birthMonthDayFromBazi(rec);
		// ageStyle:八字页旧版界面下传「年龄」档;反推八字等不传 → 子卡原样「N周岁」(见 baziAgeText)。
		let doms = this.genDoms(rec.direction, bmd.month, bmd.day, this.props.ageStyle);

		return (
			<div className={styles.scrollbar} style={style}>
				<Row gutter={6}>
					{doms}
				</Row>
			</div>
		);
	}
}

export default MainDirectionSimple;

