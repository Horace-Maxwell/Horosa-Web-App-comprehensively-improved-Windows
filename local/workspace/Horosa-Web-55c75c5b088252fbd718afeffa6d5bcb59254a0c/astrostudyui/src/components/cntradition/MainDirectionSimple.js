import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Row, Col } from 'antd';
import { BaZiMsg } from '../../msg/bazimsg';
import MDSDirect from './MDSDirect';
import MDSYear from './MDSYear';
import { birthMonthDayFromBazi } from './starChargerLazy';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。


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


	genDoms(dirs, birthMonth, birthDay){
		let dom = [];
		if(dirs && dirs.length){
			let sz = dirs.length;
			let span = Math.floor(24 / 8);
			for(let i=0; i<sz; i++){
				let dir = dirs[i];
				if(i !== 0 && (i % 8 == 0)) {
					let col = (
						<Col span={24} key={`hr-${i}`}><hr /></Col>
					);
					dom.push(col);
				}
				let col = (
					<Col span={span} key={`dir-${i}`}>
						<Row>
							<Col span={24}><MDSDirect value={dir} /></Col>
						</Row>
						<Row>
							<Col span={24}><MDSYear value={dir} birthMonth={birthMonth} birthDay={birthDay} /></Col>
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
		let doms = this.genDoms(rec.direction, bmd.month, bmd.day);

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

