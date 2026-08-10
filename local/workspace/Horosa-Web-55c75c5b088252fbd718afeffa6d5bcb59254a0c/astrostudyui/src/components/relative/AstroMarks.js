import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import AstroChartMain from '../astro/AstroChartMain';

const TabPane = Tabs.TabPane;

function paramsToFields(param, flds){
	// 本命 record 提供 date/time/zone/lat/lon,但 hsys/zodiacal/siderealAyanamsa 保留全局 flds(左栏当前选择)
	// 否则左栏 Select 会被 record 老快照覆盖回原值,显示与刚改的不一致。
	let fields = {
		...flds,
		date:{
			value: param.date
		},
		time:{
			value: param.time
		},
		ad: {
			value: param.ad ? param.ad : flds.ad.value,
		},
		zone:{
			value: param.zone
		},
		lat:{
			value: param.lat
		},
		lon:{
			value: param.lon
		},
	}
	return fields;
}

class AstroMarks extends Component{
	constructor(props) {
		super(props);
		this.state = {
			result: this.props.value,
		};

		this.unmounted = false;

		if(this.props.hook){
			this.props.hook.fun = (res)=>{
				if(this.unmounted){
					return;
				}
				this.setState({
					result: res
				})
			};
		}

	}

	componentDidMount(){
		this.unmounted = false;
	}

	componentWillUnmount(){
		this.unmounted = true;
	}

	render(){
		let height = this.props.height ? this.props.height : 760;

		let chartATitle = '星盘A';
		let chartBTitle = '星盘B';
		let fieldsA = this.props.fields;
		let fieldsB = this.props.fields;
		if(this.props.chartA){
			chartATitle = this.props.chartA.record.name;
			fieldsA = paramsToFields(this.props.chartA.record, this.props.fields);
		}
		if(this.props.chartB){
			chartBTitle = this.props.chartB.record.name;
			fieldsB = paramsToFields(this.props.chartB.record, this.props.fields);
		}

		let resobj = this.state.result ? this.state.result : {};
		let chartAobj = resobj.inner;
		let chartBobj = resobj.outer;


		const canRenderA = chartAobj !== undefined && chartAobj !== null && fieldsA;
		const canRenderB = chartBobj !== undefined && chartBobj !== null && fieldsB;

		return (
			<div style={{height: height}}>
				<Tabs 
					defaultActiveKey='chartA' tabPosition='top'
					style={{ height: height }}
				>
					<TabPane tab={chartATitle} key="chartA">
						{
							canRenderA ? (
									<AstroChartMain 
										value={chartAobj} 
									fields={fieldsA} 
									hidedateselector={1}
									hidelots={1}
									height={height - 40} 
									chartDisplay={this.props.chartDisplay}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										wheelArt={this.props.wheelArt}
										dispatch={this.props.dispatch}
										onChange={this.props.onChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
									/>
							) : (
								<div style={{padding: 16}}>请先选择星盘A和星盘B，再查看马克斯盘。</div>
							)
						}
					</TabPane>

					<TabPane tab={chartBTitle} key="chartB">
						{
							canRenderB ? (
									<AstroChartMain 
										value={chartBobj} 
									fields={fieldsB} 
									hidedateselector={1}
									hidelots={1}
									height={height - 40} 
									chartDisplay={this.props.chartDisplay}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										chartStyle={this.props.chartStyle}
										wheelArt={this.props.wheelArt}
										dispatch={this.props.dispatch}
										onChange={this.props.onChange}
										showPlanetHouseInfo={this.props.showPlanetHouseInfo}
										showAstroMeaning={this.props.showAstroMeaning}
									/>
							) : (
								<div style={{padding: 16}}>请先选择星盘A和星盘B，再查看马克斯盘。</div>
							)
						}
					</TabPane>						

				</Tabs>
			</div>
		);
	}

}

export default AstroMarks;
