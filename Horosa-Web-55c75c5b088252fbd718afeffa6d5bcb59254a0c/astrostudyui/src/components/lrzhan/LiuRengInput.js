import { Component } from 'react';
import { Row, Col, Form, DatePicker, Input, Button, Select } from 'antd';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import * as LRConst from '../liureng/LRConst';
import { gcj02ToGps, randomStr } from '../../utils/helper';
import {convertLatStrToDegree, convertLonStrToDegree, convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import DateTime from '../comp/DateTime';

const {Option} = Select

class LiuRengInput extends Component{
	
	constructor(props) {
		super(props);

		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onZoneChanged = this.onZoneChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.onChartTypeChange = this.onChartTypeChange.bind(this);

		let type = localStorage.getItem('liurengChartType');
		if(type !== undefined && type !== null){
			LRConst.LRChartType = parseInt(type+'');
		}

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

	onChartTypeChange(val){
		LRConst.LRChartType = val;
		localStorage.setItem('liurengChartType', val);
		if(this.props.onFieldsChange){
			this.props.onFieldsChange({
				lrchart: {
					value: val,
				}
			});
		}
	}

	render(){
		let fields = this.props.fields ? this.props.fields : {};
		let datetm = new DateTime();
		if(fields.date && fields.time){
			let str = fields.date.value.format('YYYY-MM-DD') + ' ' + 
						fields.time.value.format('HH:mm');
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}

		let lrchart = LRConst.LRChartType;

		return (
			<div>
			<Row>
				<Col span={24}>
					<PlusMinusTime value={datetm} onChange={this.onTimeChanged} />
				</Col>	
			</Row>
			<Row>
				<Col lg={12} xl={8}>
					<Select value={fields.gender.value} onChange={this.onGenderChange} size='small' style={{width:'100%'}}>
						<Option value={-1}>未知</Option>
						<Option value={0}>女</Option>
						<Option value={1}>男</Option>
					</Select>
				</Col>

				<Col lg={12} xl={8}>
					<Select value={lrchart} onChange={this.onChartTypeChange} size='small' style={{width:'100%'}}>
						<Option value={LRConst.LRChart_Circle}>圆形盘</Option>
						<Option value={LRConst.LRChart_Square}>方形盘</Option>
					</Select>				
				</Col>

				<Col lg={12} xl={8}>
					<div>
						<GeoCoordModal 
							onOk={this.changeGeo}
							lat={fields.gpsLat.value} lng={fields.gpsLon.value}
						>
							<Button size='small' style={{width:'100%'}}>经纬度选择</Button>
						</GeoCoordModal>
					</div>
				</Col>
				<Col lg={12} xl={24} style={{textAlign: 'right'}}>
					<span style={{width:'100%', textAlign: 'center'}}>{fields.lon.value + ' ' + fields.lat.value}</span>
				</Col>
			</Row>
			</div>
		);
	}

}

export default LiuRengInput;
