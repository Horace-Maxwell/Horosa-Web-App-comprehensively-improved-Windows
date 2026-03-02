import { Component } from 'react';
import { Row, Col, Tabs, Select } from 'antd';
import AstroChart from '../astro/AstroChart';
import Midpoint from './Midpoint';
import AspectToMidpoint from './AspectToMidpoint';
import PlusMinusTime from '../astro/PlusMinusTime';
import DateTime from '../comp/DateTime';
import { getHousesOption } from '../comp/CompHelper'

const TabPane = Tabs.TabPane;
const Option = Select.Option;

class MidpointMain extends Component{

	constructor(props) {
		super(props);
		this.state = {

		}

		this.changeTime = this.changeTime.bind(this);
		this.changeZodiacal = this.changeZodiacal.bind(this);
		this.changeHsys = this.changeHsys.bind(this);
		this.changeSouthChart = this.changeSouthChart.bind(this);
	}

	changeTime(tm){
		if(this.props.onChange){
			this.props.onChange({
				tm: tm.time,
				ad: tm.ad,
				zone: tm.time.zone,
			});
		}
	}

	changeZodiacal(val){
		if(this.props.onChange){
			this.props.onChange({
				zodiacal: val,
			});
		}
	}

	changeHsys(val){
		if(this.props.onChange){
			this.props.onChange({
				hsys: val,
			});
		}
	}

	changeSouthChart(val){
		if(this.props.fields.gpsLat === undefined || this.props.fields.gpsLat === null || this.props.fields.gpsLat.value >= 0){
			return;
		}
		if(this.props.onChange){
			this.props.onChange({
				southchart: val,
			});
		}
	}

	render(){
		let chartObj = null;
		if(this.props.value){
			chartObj = this.props.value.chartObj
		}

		let midpoints = null;
		let aspects = null;
		if(this.props.value && this.props.value.midpoints){
			midpoints = this.props.value.midpoints.midpoints;
			aspects = this.props.value.midpoints.aspects;
		}

		let fields = this.props.fields;
		let dtstr = chartObj ? chartObj.params.birth : null;
		let dt = new DateTime();
		if(dtstr){
			if(dtstr.length > 11){
				dt = dt.parse(dtstr, 'YYYY-MM-DD HH:mm');
			}else{
				dt = dt.parse(dtstr, 'YYYY-MM-DD');
			}
		}

		let height = this.props.height ? this.props.height : 760;
		let showzodical = true;
		let showhsys = true;
		let showdateselector = true;
		let indiahsys = false;
		if(this.props.hidezodiacal){
			showzodical = false
		}
		if(this.props.hidehsys){
			showhsys = false;
		}
		if(this.props.hidedateselector){
			showdateselector = false;
		}
		if(this.props.indiahsys){
			indiahsys = true;
			showhsys = false;
		}

		return (
			<div>
				<Row gutter={6}>
					<Col span={18}>
						<AstroChart value={chartObj} 
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							height={height}
						/>
					</Col>
					<Col span={6}>
						<Row>
							{
								showdateselector && (
									<Col span={24}>
										<PlusMinusTime value={dt} onChange={this.changeTime} />
									</Col>	
								)
							}
							{
								showzodical && (
									<Col span={12}>
										<Select style={{width:'100%'}}
											onChange={this.changeZodiacal}
											value={this.props.fields.zodiacal.value} 
											size='small'>
											<Option value={0}>回归黄道</Option>
											<Option value={1}>恒星黄道</Option>
										</Select>
									</Col>
	
								)
							}
							{
								showhsys && (
									<Col span={12}>
										<Select style={{width: '100%'}}
											onChange={this.changeSouthChart}
											value={this.props.fields.southchart.value} 
											size='small'>
											<Option value={0}>天文星座</Option>
											<Option value={1}>涵义星座</Option>
										</Select>
									</Col>	
								)
							}
							{
								showhsys && (
									<Col span={24} >
										<Select style={{width:'100%'}}
											onChange={this.changeHsys}
											value={this.props.fields.hsys.value} 
											size='small'>
											{ getHousesOption() }
										</Select>
									</Col>	
								)
							}
							{
								indiahsys && (
									<Col span={24}>
										<Select style={{width:196}}
											onChange={this.changeHsys}
											value={this.props.fields.hsys.value} 
											size='small'>
											<Option value={0}>整宫制</Option>
											<Option value={5}>Vehlow Equal</Option>
										</Select>
									</Col>	
								)
							}
						</Row>
						<Tabs defaultActiveKey="1" tabPosition='top'>
							<TabPane tab="中点" key="1">
								<Midpoint height={height}
									value={midpoints} fields={fields}
									planetDisplay={this.props.planetDisplay}
								/>
							</TabPane>
							<TabPane tab="相位" key="2">
								<AspectToMidpoint 
									value={aspects} height={height}
									planetDisplay={this.props.planetDisplay}
								/>
							</TabPane>
						</Tabs>
					</Col>
				</Row>

			</div>
		);
	}

}

export default MidpointMain;
