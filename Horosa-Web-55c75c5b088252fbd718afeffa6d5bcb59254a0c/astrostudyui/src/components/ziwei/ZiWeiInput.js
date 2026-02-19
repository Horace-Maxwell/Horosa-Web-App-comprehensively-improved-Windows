import { Component } from 'react';
import { Row, Col, Form, DatePicker, Input, Button, Select, Checkbox } from 'antd';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import { gcj02ToGps, randomStr } from '../../utils/helper';
import {convertLatStrToDegree, convertLonStrToDegree, convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import * as ZWCont from '../../constants/ZWConst';
import DateTime from '../comp/DateTime';

const {Option} = Select
const InputGroup = Input.Group;

class ZiWeiInput extends Component{
	
	constructor(props) {
		super(props);

		let showTips = true;
		let tips = localStorage.getItem('ziweiTips');
		if(tips !== undefined && tips !== null){
			if(tips+'' === '1'){
				showTips = true;
			}else{
				showTips = false;
			}
		}

		this.state = {
			showTips: showTips,
		}

        this.tmHook = {
            getValue: null,
        }

		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);

		this.onGenderChange = this.onGenderChange.bind(this);
		this.onChartTypeChange = this.onChartTypeChange.bind(this);
		this.onTipsChange = this.onTipsChange.bind(this);

		let type = localStorage.getItem('ziweiChartType');
		if(type !== undefined && type !== null){
			ZWCont.ZWChart.chart = parseInt(type+'');
		}

	}

	onChartTypeChange(val){
		ZWCont.ZWChart.chart = val;
		localStorage.setItem('ziweiChartType', val);
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				zwchart: {
					value: val,
				},
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

	onGenderChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				gender: {
					value: val,
				},
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
				}
			});
		}
	}



	onTipsChange(e){
		let val = e.target.checked;
		localStorage.setItem('ziweiTips', val ? 1 : 0);
		this.setState({
			showTips: val,
		});
	}


	changeGeo(rec){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
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
				},
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

		let zwchart = ZWCont.ZWChart.chart;
		if(fields.zwchart !== undefined && fields.zwchart !== null &&
			fields.zwchart.value !== undefined && fields.zwchart.value !== null){
			zwchart = fields.zwchart.value;
		}

		return (
			<div>
			<Row>
				<Col span={24}>
					<PlusMinusTime value={datetm} ad={this.props.fields.ad.value} onChange={this.onTimeChanged} hook={this.tmHook} />
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
					<Select value={zwchart} onChange={this.onChartTypeChange} size='small' style={{width:'100%'}}>
						<Option value={ZWCont.ZWChart_SiHua}>四化盘</Option>
						<Option value={ZWCont.ZWChart_SangHe}>三合盘</Option>
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
				<Col lg={12} xl={16}>
					<Checkbox checked={this.state.showTips} onChange={this.onTipsChange}>允许提示</Checkbox>
				</Col>
				<Col lg={12} xl={8} style={{textAlign: 'right'}}>
					<span style={{width:'100%', textAlign: 'center'}}>{fields.lon.value + ' ' + fields.lat.value}</span>
				</Col>
			</Row>
			</div>
		);
	}

}

export default ZiWeiInput;
