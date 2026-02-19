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

class AstroTimeSpace extends Component{
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
			<div>
				<AstroChartMain 
					value={resobj} 
					fields={fields} 
					hidezodiacal={1}
					hidehsys={1}
					hidedateselector={1}
					hidelots={1}
					height={height} 
					chartDisplay={this.props.chartDisplay}
					planetDisplay={this.props.planetDisplay}
					lotsDisplay={this.props.lotsDisplay}
				/>
			</div>
		);
	}

}

export default AstroTimeSpace;
