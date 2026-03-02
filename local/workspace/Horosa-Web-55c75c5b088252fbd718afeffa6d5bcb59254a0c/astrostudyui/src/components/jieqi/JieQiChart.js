import { Component } from 'react';
import { Row, Col, Tabs, Select } from 'antd';
import AstroChartMain from '../astro/AstroChartMain';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';

function paramsToFields(params){
	const fields = {
		date: {
			value: params.date,
		},
		time: {
			value: params.time,
		},
		ad: {
			value: params.ad ? params.ad : 1,
		},
		zone: {
			value: params.zone,
		},
		lat: {
			value: params.lat,
		},
		lon: {
			value: params.lon,
		},
		gpsLat: {
			value: params.gpsLat,
		},
		gpsLon: {
			value: params.gpsLon,
		},
		name: {
			value: params.name,
		},
		pos: {
			value: null,
		},
		hsys: {
			value: params.hsys,
		},
		zodiacal: {
			value: params.zodiacal,
		},
		tradition: {
			value: 0,
		},
		strongRecption: {
			value: 0,
		},
		simpleAsp: {
			value: 0,
		},
		virtualPointReceiveAsp: {
			value: 0,
		},
		predictive: {
			value: 0,
		},
		pdtype: {
			value: 0,
		},
		pdaspects: {
			value: [0, 60, 90, 120, 180],
		},

	};

	return fields;
}

class JieQiMain extends Component{

	constructor(props) {
		super(props);
		this.state = {
			chart:{}
		}

		this.genParams = this.genParams.bind(this);
		this.requestChart = this.requestChart.bind(this);
	}

	async requestChart(){

	}

	genParams(){
		let parts = this.props.time.split(' ');
		let params = {
			date: parts[0],
			time: parts[1],
			ad: this.props.ad,
			zone: this.props.zone,
			lat: this.props.lat,
			lon: this.props.lon,
			gpsLat: this.props.gpsLat,
			gpsLon: this.props.gpsLon,
			hsys: this.props.hsys,
			zodiacal: this.props.zodiacal,
			name: this.props.chartname,
		}

		return params;
	}

	render(){
		let params = this.genParams();
		let fields = paramsToFields(params);
		let height = this.props.height ? this.props.height : 760;

		return (
			<div>
				<AstroChartMain 
					value={this.state.chart} 
					hidehsys={1}
					hidezodiacal={1}
					hidedateselector={1}
					fields={fields} 
					height={height} 
					chartDisplay={this.props.chartDisplay}
					planetDisplay={this.props.planetDisplay}
					lotsDisplay={this.props.lotsDisplay}				
				/>
			</div>
		);
	}

}

export default JieQiMain;
