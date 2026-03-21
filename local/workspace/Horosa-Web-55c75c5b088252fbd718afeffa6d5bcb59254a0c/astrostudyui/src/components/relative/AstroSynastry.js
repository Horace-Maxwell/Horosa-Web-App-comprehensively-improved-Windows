import { Component } from 'react';
import { Row, Col, Tabs, Select } from 'antd';
import AstroChartMain from '../astro/AstroChartMain';

const TabPane = Tabs.TabPane;

function paramsToFields(param, flds){
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
		hsys:{
			value: param.hsys
		},
		zodiacal:{
			value: param.zodiacal
		},
	}
	return fields;
}

class AstroSynastry extends Component{
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
			<div style={{ height: height, maxHeight: height, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				<Tabs 
					defaultActiveKey='chartA' tabPosition='top'
					className='horosaFillTabs'
					style={{ flex: '1 1 auto', minHeight: 0 }}
				>
					<TabPane tab={chartATitle} key="chartA">
						{
							canRenderA ? (
								<div style={{ height: '100%', overflow: 'hidden' }}>
									<AstroChartMain 
										value={chartAobj} 
										fields={fieldsA} 
										hidezodiacal={1}
										hidehsys={1}
										hidedateselector={1}
										hidelots={1}
										height={height} 
										chartDisplay={this.props.chartDisplay}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										showAstroMeaning={this.props.showAstroMeaning}
										fitChartToViewport={true}
									/>
								</div>
							) : (
								<div style={{padding: 16}}>请先选择星盘A和星盘B，再查看影响盘。</div>
							)
						}
					</TabPane>

					<TabPane tab={chartBTitle} key="chartB">
						{
							canRenderB ? (
								<div style={{ height: '100%', overflow: 'hidden' }}>
									<AstroChartMain 
										value={chartBobj} 
										fields={fieldsB} 
										hidezodiacal={1}
										hidehsys={1}
										hidedateselector={1}
										hidelots={1}
										height={height} 
										chartDisplay={this.props.chartDisplay}
										planetDisplay={this.props.planetDisplay}
										lotsDisplay={this.props.lotsDisplay}
										showAstroMeaning={this.props.showAstroMeaning}
										fitChartToViewport={true}
									/>
								</div>
							) : (
								<div style={{padding: 16}}>请先选择星盘A和星盘B，再查看影响盘。</div>
							)
						}
					</TabPane>						

				</Tabs>
			</div>
		);
	}

}

export default AstroSynastry;
