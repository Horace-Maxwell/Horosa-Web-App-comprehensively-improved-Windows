import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Divider, } from 'antd';
import RuleHouses from './RuleHouses';
import RuleStars from './RuleStars';
import RuleSihua from './RuleSihua';
import RuleHuaDesc from './RuleHuaDesc';
import styles from '../../css/styles.less';
import { XQTabs as Tabs } from '../xq-ui';

const TabPane = Tabs.TabPane;

class ZWRuleMain extends Component{
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
	}

	render(){
		// 此前内层 Tabs 定高 =(工作区高 − 130)px 且自带滚动:常数与真实页签 / 边距不等,小窗 × 放大档时内层 tabpane
		// (右栏页签族给的 height:100% + overflow:hidden)把最后几行裁掉,而两层滚动盒都滚不到那一截。
		// 改为按内容高自然流,唯一滚动出路 = 外层右栏 holder(overflow:auto):任何缩放 / 窗高零常数。
		return (
			<div className={styles.scrollbar}>
				<Tabs
					defaultActiveKey='sihua'
				>
					<TabPane tab="天干四化" key="sihua">
						<RuleSihua rules={this.props.rules} />
					</TabPane>
					<TabPane tab="宫 / 星" key="housestar">
						<RuleHouses rules={this.props.rules} />
						<Divider />
						<RuleStars rules={this.props.rules} />
					</TabPane>
					<TabPane tab="四化简述" key="huadesc">
						<RuleHuaDesc rules={this.props.rules} />
					</TabPane>
				</Tabs>
			</div>
		);
	}
}

export default ZWRuleMain;
