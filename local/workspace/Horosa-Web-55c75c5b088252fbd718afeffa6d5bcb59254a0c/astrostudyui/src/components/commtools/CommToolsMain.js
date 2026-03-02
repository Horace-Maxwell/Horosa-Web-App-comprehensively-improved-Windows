import { Component } from 'react';
import { Row, Col, Tabs, Divider } from 'antd';
import { randomStr } from '../../utils/helper';
import Azimuth from './Azimuth';
import CoordTrans from './CoordTrans';
import Calculator from './Calculator';
import DateCalc from './DateCalc';
import NaYing from './NaYing';
import InverseBazi from './InverseBazi';
import BaziPattern from './BaziPattern';
import GuaSymDesc from '../gua/GuaSymDesc';
import CuanGong12 from './CuanGong12';
import BaziPithy from './BaziPithy';

const TabPane = Tabs.TabPane;

class CommToolsMain extends Component{
	constructor(props) {
		super(props);

		let tab = localStorage.getItem('commtoolstab');
		if(tab === undefined || tab === null || tab === ''){
			tab = 'naying';
		}

		this.state = {
			tab: tab,
		};

		this.changeTab = this.changeTab.bind(this);
	}

	changeTab(key){
		localStorage.setItem('commtoolstab', key);
		this.setState({
			tab: key
		});
	}

	render(){
		let height = document.documentElement.clientHeight;
		height = height - 80;

		let fields = this.props.fields;

		return (
			<div>
				<Tabs 
					defaultActiveKey={this.state.tab} 
					onChange={this.changeTab}
					tabPosition='left'
					style={{ height: height }} 
				>
					<TabPane tab="纳音五行" key="naying">
						<NaYing />
					</TabPane>

					<TabPane tab="计算器" key="calculator">
						<Calculator 
							lat={fields.lat.value}
							lon={fields.lon.value}
							time={fields.date.value}
						/>
					</TabPane>

					<TabPane tab="日期计算" key="datecalc">
						<DateCalc 
							lat={fields.lat.value}
							lon={fields.lon.value}
							time={fields.date.value}
						/>
					</TabPane>

					<TabPane tab="地平坐标" key="azimuth">
						<Azimuth 
							lat={fields.lat.value}
							lon={fields.lon.value}
							time={fields.date.value}
						/>
					</TabPane>

					<TabPane tab="黄赤坐标" key="cotrans">
						<CoordTrans 
							lat={fields.lat.value}
							lon={fields.lon.value}
							time={fields.date.value}
						/>
					</TabPane>

					<TabPane tab="八字反查" key="inversebazi">
						<InverseBazi />
					</TabPane>

					<TabPane tab="八字格局" key="bazipattern">
						<BaziPattern />
					</TabPane>

					<TabPane tab="八卦类象" key="guasym">
						<GuaSymDesc />
					</TabPane>

					<TabPane tab="十二串宫" key="cuangong12">
						<CuanGong12 />
					</TabPane>

					<TabPane tab="八字规则" key="pithy">
						<BaziPithy />
					</TabPane>

				</Tabs>
			</div>
		)
	}
}

export default CommToolsMain;
