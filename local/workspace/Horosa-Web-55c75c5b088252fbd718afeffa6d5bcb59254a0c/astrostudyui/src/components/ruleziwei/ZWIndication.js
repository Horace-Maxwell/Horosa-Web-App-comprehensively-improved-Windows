import { Component } from 'react';
import { Row, Col, Divider, Tabs, } from 'antd';
import * as ZWConst from '../../constants/ZWConst';
import RuleHouses from './RuleHouses';
import RuleStars from './RuleStars';
import RuleSihua from './RuleSihua';
import RuleHuaDesc from './RuleHuaDesc';
import styles from '../../css/styles.less';

const TabPane = Tabs.TabPane;

class ZWIndication extends Component{
	constructor(props) {
		super(props);

		this.genEventsDom = this.genEventsDom.bind(this);
	}

	genEventsDom(){
		if(this.props.indicator === undefined || this.props.indicator === null){
			return null;
		}
		let indicator = this.props.indicator;
		let risk = indicator.getFatherRisk();
		if(risk){
			risk = risk + '需注意父亲的状况';
		}else{
			risk = '';
		}
		let dom = (
			<div>
				<span>{risk}</span>
			</div>
		);
		return dom;
	}

	render(){
		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height - 130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let eventdoms = this.genEventsDom();

		return (
			<div className={styles.scrollbar}>
				<Tabs
					defaultActiveKey='reng'
					style={style}
					tabPosition='right'
				>
					<TabPane tab="人" key="reng">
						<Row>
							<Col span={24}>
								{eventdoms}
							</Col>
						</Row>
					</TabPane>
				</Tabs>
			</div>
		);
	}
}

export default ZWIndication;
