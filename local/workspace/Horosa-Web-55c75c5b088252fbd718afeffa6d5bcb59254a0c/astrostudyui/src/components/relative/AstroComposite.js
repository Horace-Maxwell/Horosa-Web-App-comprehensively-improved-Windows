import { Component } from 'react';
import AstroChartMain from '../astro/AstroChartMain';

function paramsToFields(param, flds){
	let fields = {
		...flds,
		date:{
			value: param.date
		},
		time:{
			value: param.time
		},
		ad:{
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
		// hsys/zodiacal/siderealAyanamsa 保留全局 flds(左栏当前选择),不被 record 老快照覆盖。
	}
	return fields;
}

class AstroComposite extends Component{
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

		let fields = this.props.fields;
		let resobj = this.state.result;
		if(resobj){
			fields = paramsToFields(resobj.params, this.props.fields);
		}

		return (
			<div style={{height: height}}>
					<AstroChartMain
						value={resobj} 
					fields={fields} 
					hidedateselector={1}
					hidelots={1}
					height={height} 
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
			</div>
		);
	}

}

export default AstroComposite;
