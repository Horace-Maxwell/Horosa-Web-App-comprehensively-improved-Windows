import { Component } from 'react';
import { Row, Col, Tabs, Select } from 'antd';
import AstroChartMain from '../astro/AstroChartMain';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { randomStr, } from '../../utils/helper';
import styles from '../../css/styles.less';

function isFieldsReady(fields){
	if(!fields){
		return false;
	}
	return !!(
		fields.date && fields.date.value &&
		fields.time && fields.time.value &&
		fields.ad &&
		fields.zone &&
		fields.lat &&
		fields.lon &&
		fields.gpsLat &&
		fields.gpsLon &&
		fields.hsys &&
		fields.zodiacal &&
		fields.tradition &&
		fields.strongRecption &&
		fields.simpleAsp &&
		fields.virtualPointReceiveAsp &&
		fields.name &&
		fields.pos
	);
}

function fieldsToParams(fields){
	if(!isFieldsReady(fields)){
		return null;
	}
	const params = {
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		ad: fields.ad.value,
		zone: fields.zone.value,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: fields.hsys.value,
		zodiacal: fields.zodiacal.value,
		tradition: fields.tradition.value,
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: 0,
		name: fields.name.value,
		pos: fields.pos.value,
	};

	return params;
}

class AstroChart13 extends Component{
	constructor(props) {
		super(props);
		this.state = {
			chartObj: null,
		};

		this.unmounted = false;

		this.requestChart = this.requestChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (chartObj)=>{
				if(this.unmounted){
					return;
				}
				let params = this.genParams();
				this.requestChart(params);
			};
		}

	}

	async requestChart(params){
		if(!params){
			return;
		}
		const data = await request(`${Constants.ServerRoot}/chart13`, {
			body: JSON.stringify(params),
		});
		const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;

		const st = {
			chartObj: result,
		};

		this.setState(st);
	}

	genParams(){
		let fields = this.props.fields;
		let params = fieldsToParams(fields);
		return params;
	}

	onFieldsChange(values){
		if(this.props.onChange){
			let flds = this.props.onChange(values);
			let params = fieldsToParams(flds);
			if(params){
				this.requestChart(params);
			}
		}		
	}

	componentDidMount(){
		this.unmounted = false;

		let params = this.genParams();
		if(params){
			this.requestChart(params);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
	}

	render(){
		let chartObj = this.state.chartObj;
		let fields = this.props.fields;
		let height = this.props.height ? this.props.height : 760;

		return (
			<div>
				<AstroChartMain 
					value={chartObj} 
					onChange={this.onFieldsChange}
					hidehsys={1}
					hidezodiacal={1}
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

export default AstroChart13;
