import { Component } from 'react';
import { Row, Col, Divider, Tabs,Popover, } from 'antd';
import AstroDoubleChart from './AstroDoubleChart';
import AspectInfo from '../relative/AspectInfo';
import MidpointInfo from '../relative/MidpointInfo';
import AntisciaInfo from '../relative/AntisciaInfo';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { randomStr, } from '../../utils/helper';
import styles from '../../css/styles.less';

const TabPane = Tabs.TabPane;

class AstroCompare extends Component{

	constructor(props) {
		super(props);

		this.state = {
			result: this.props.value,
		}

	}

	render(){
		let resobj = this.props.value ? this.props.value : {};
		let chartObj = {
			natualChart: resobj.natual,
			dirChart: resobj.dir,
		};

		let title = this.props.title ? this.props.title : '外圈';
		let innerTitle = this.props.innerTitle ? this.props.innerTitle : '内圈';
		let height = this.props.height ? this.props.height : 760;

		let showAntiscia = resobj.antiscias ? true : false;
		let showMidpoint = resobj.midpoints ? true : false;
		let style = {
			height: (height-20) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		return (
			<div>
				<Row gutter={6}>
					<Col span={17}>
						<AstroDoubleChart value={chartObj} 
							height={height}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							chartDisplay={this.props.chartDisplay}
						/>
					</Col>
					<Col span={7}>
						<Tabs defaultActiveKey="1" tabPosition='top'>
							<TabPane tab="相位" key="1">
								<AspectInfo 
									value={this.props.value}
									title={title}
									innerTitle={innerTitle}
									height={height-20}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}
								/>
							</TabPane>
							{
								showAntiscia && (
									<TabPane tab="映点" key="2">
										<AntisciaInfo 
											value={resobj}
											title={title}
											innerTitle={innerTitle}
											height={height-20}
											planetDisplay={this.props.planetDisplay}
											lotsDisplay={this.props.lotsDisplay}
										/>
									</TabPane>
								)
							}
							{
								showMidpoint && (
									<TabPane tab="中点" key="3">
										<MidpointInfo 
											value={resobj.midpoints}
											title={title}
											innerTitle={innerTitle}
											height={height-20}
											planetDisplay={this.props.planetDisplay}
											lotsDisplay={this.props.lotsDisplay}
										/>
									</TabPane>
								)
							}
						</Tabs>
					</Col>
				</Row>
			</div>
		)
	}
}

export default AstroCompare;

