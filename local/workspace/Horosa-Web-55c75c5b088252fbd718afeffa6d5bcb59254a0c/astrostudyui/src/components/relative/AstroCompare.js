import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import RelativeStageEmpty from './RelativeStageEmpty';
import AstroDoubleChartMain from '../astro/AstroDoubleChartMain';

const TabPane = Tabs.TabPane;

class AstroCompare extends Component{

	constructor(props) {
		super(props);

		this.state = {
			result: this.props.value,
		}

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
		let resobj = this.props.value ? this.props.value : {};
		let chartAobj = {
			natual: resobj.outer,
			dir: resobj.inner,
			aspects: resobj.inToOutAsp,
			midpoints: resobj.inToOutMidpoint,
			antiscias: resobj.inToOutAnti,
			cantiscias: resobj.inToOutCAnti
		};
		let chartBobj = {
			natual: resobj.inner,
			dir: resobj.outer,
			aspects: resobj.outToInAsp,
			midpoints: resobj.outToInMidpoint,
			antiscias: resobj.outToInAnti,
			cantiscias: resobj.outToInCAnti
		};

		let chartATitle = '星盘A';
		let chartBTitle = '星盘B';
		if(this.props.chartA){
			chartATitle = this.props.chartA.record.name;
			if(chartBobj.natual){
				chartBobj.natual.params.name = '内圈：' + chartATitle;
			}
		}
		if(this.props.chartB){
			chartBTitle = this.props.chartB.record.name;
			if(chartAobj.natual){
				chartAobj.natual.params.name = '内圈：' + chartBTitle;
			}
		}


		let height = this.props.height ? this.props.height : 760;
		// 两张盘都排出来才画双盘;否则中栏正中给一句提示(与影响盘 / 马克斯盘同款)
		const canRender = !!(resobj.outer && resobj.inner);
		const empty = <RelativeStageEmpty height={height - 40}>选好星盘 A 与星盘 B 并排盘后显示比较盘</RelativeStageEmpty>;

		return (
			<div style={{ height: height }}>
				<Tabs 
					defaultActiveKey='chartA' tabPosition='top'
					style={{ height: height }}
				>
					<TabPane tab={chartATitle} key="chartA">
							{canRender ? (
							<AstroDoubleChartMain 
								value={chartAobj} 
							height={height - 40} 
							title={chartATitle}
							innerTitle={chartBTitle}
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							) : empty}					
					</TabPane>
					<TabPane tab={chartBTitle} key="chartB">
							{canRender ? (
							<AstroDoubleChartMain 
								value={chartBobj} 
							height={height - 40} 
							title={chartBTitle}
							innerTitle={chartATitle}
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							) : empty}					
					</TabPane>
				</Tabs>
			</div>
		)
	}
}

export default AstroCompare;
