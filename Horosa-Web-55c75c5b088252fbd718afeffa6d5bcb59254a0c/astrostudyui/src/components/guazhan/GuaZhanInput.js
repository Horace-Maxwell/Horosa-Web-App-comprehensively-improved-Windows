import { Component } from 'react';
import { Row, Col, Form, DatePicker, Input, Button, Select } from 'antd';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import { gcj02ToGps, randomStr } from '../../utils/helper';
import {convertLatStrToDegree, convertLonStrToDegree, convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import DateTime from '../comp/DateTime';

const {Option} = Select

class GuaZhanInput extends Component{
	
	constructor(props) {
		super(props);

		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onZoneChanged = this.onZoneChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
	}

	onGenderChange(val){
		if(this.props.onFieldsChange){
			this.props.onFieldsChange({
				gender: {
					value: val,
				}
			});
		}
	}

	onTimeChanged(value){
		if(this.props.onFieldsChange){
			let dt = value.time;

			this.props.onFieldsChange({
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	onZoneChanged(val){
		if(this.props.onFieldsChange){
			this.props.onFieldsChange({
				zone: {
					value: val,
				}
			});
		}
	}

	changeGeo(rec){
		if(this.props.onFieldsChange){
			this.props.onFieldsChange({
				lon: {
					value: convertLonToStr(rec.lng),
				},
				lat: {
					value: convertLatToStr(rec.lat),
				},
				gpsLon: {
					value: rec.gpsLng
				},
				gpsLat: {
					value: rec.gpsLat
				}
			});
		}
	}

	render(){
		let fields = this.props.fields ? this.props.fields : {};
		let datetm = new DateTime();
		if(fields.date && fields.time){
			let str = fields.date.value.format('YYYY-MM-DD') + ' ' + 
						fields.time.value.format('HH:mm:ss');
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}


		return (
			<div>
			<Row>
				<Col span={24}>
					<PlusMinusTime value={datetm} onChange={this.onTimeChanged} hook={this.props.hook} />
				</Col>	
			</Row>
			<Row>
				<Col span={8}>
					<Row>
						<Col span={24}>
							<Select value={fields.gender.value} onChange={this.onGenderChange} size='small' style={{width:'100%'}}>
								<Option value={-1}>未知</Option>
								<Option value={0}>女</Option>
								<Option value={1}>男</Option>
							</Select>
						</Col>
					</Row>
				</Col>

				<Col span={7}>
					<div>
						<GeoCoordModal 
							onOk={this.changeGeo}
							lat={fields.gpsLat.value} lng={fields.gpsLon.value}
						>
							<Button size='small'>经纬度选择</Button>
						</GeoCoordModal>
					</div>
				</Col>
				<Col span={9} style={{textAlign: 'center'}}>
					<span>{fields.lon.value + ' ' + fields.lat.value}</span>
				</Col>
			</Row>
			</div>
		);
	}

}

export default GuaZhanInput;
