import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import AstroChartMain from '../astro/AstroChartMain';
import { paramsToFields } from './relativeFields';

const TabPane = Tabs.TabPane;

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
									<AstroChartMain embeddedSubChart relativeContext={this.props.relativeContext} 
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
										showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}   /* 四键补传:弹层显示值与主页同源 */
										voidClassical={this.props.voidClassical}
										planetListStyle={this.props.planetListStyle}
										aspects={this.props.aspects}
									/>
							) : (
								<div style={{padding: 16}}>请先选择星盘A和星盘B，再查看马克斯盘。</div>
							)
						}
					</TabPane>

					<TabPane tab={chartBTitle} key="chartB">
						{
							canRenderB ? (
									<AstroChartMain embeddedSubChart relativeContext={this.props.relativeContext} 
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
										showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}   /* 四键补传:弹层显示值与主页同源 */
										voidClassical={this.props.voidClassical}
										planetListStyle={this.props.planetListStyle}
										aspects={this.props.aspects}
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
