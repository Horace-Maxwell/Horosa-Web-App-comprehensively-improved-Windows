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
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height - 130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		return (
			<div className={styles.scrollbar}>
				<Tabs
					defaultActiveKey='sihua'
					style={style}
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
