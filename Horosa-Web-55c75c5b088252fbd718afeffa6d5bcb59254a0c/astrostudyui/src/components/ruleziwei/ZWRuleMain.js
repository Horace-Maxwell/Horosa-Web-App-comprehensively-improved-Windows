import { Component } from 'react';
import { Row, Col, Divider, Tabs, } from 'antd';
import * as ZWConst from '../../constants/ZWConst';
import RuleHouses from './RuleHouses';
import RuleStars from './RuleStars';
import RuleSihua from './RuleSihua';
import RuleHuaDesc from './RuleHuaDesc';
import styles from '../../css/styles.less';

const TabPane = Tabs.TabPane;

class ZWRuleMain extends Component{
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
