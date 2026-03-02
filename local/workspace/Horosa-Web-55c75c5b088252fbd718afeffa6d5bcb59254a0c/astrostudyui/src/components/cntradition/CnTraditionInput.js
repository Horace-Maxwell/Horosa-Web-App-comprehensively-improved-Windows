import { Component } from 'react';
import { Row, Col, Form, DatePicker, Input, Button, Select, Checkbox } from 'antd';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import { gcj02ToGps, randomStr } from '../../utils/helper';
import {convertLatStrToDegree, convertLonStrToDegree, convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import DateTime from '../comp/DateTime';

const {Option} = Select
const InputGroup = Input.Group;

class CnTraditionInput extends Component{
	
	constructor(props) {
		super(props);

        this.tmHook = {
            getValue: null,
        }

		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onZoneChanged = this.onZoneChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);

		this.onTimeAlgChange = this.onTimeAlgChange.bind(this);
		this.onPhaseTypeChange = this.onPhaseTypeChange.bind(this);
		this.onGodKeyPosChange = this.onGodKeyPosChange.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.onAfter23NewDayChange = this.onAfter23NewDayChange.bind(this);
		this.onChangeAdjustJieqi = this.onChangeAdjustJieqi.bind(this);

		this.onOnlyZiganChange = this.onOnlyZiganChange.bind(this);

	}

	onOnlyZiganChange(e){
		let val = e.target.checked;
		let opt = {
			...this.props.baziOpt,
		};
		opt.onlyZiGanShen = val;
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
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

	onTimeAlgChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				timeAlg: {
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

	onPhaseTypeChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				phaseType: {
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

	onGodKeyPosChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				godKeyPos: {
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
				},
			});
		}
	}

	onZoneChanged(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				zone: {
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

	onAfter23NewDayChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				after23NewDay: {
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

	onChangeAdjustJieqi(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				adjustJieqi: {
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
						fields.time.value.format('HH:mm:ss');
			datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}

		return (
			<Row>
				<Col span={24}>
					<PlusMinusTime value={datetm} onChange={this.onTimeChanged} hook={this.tmHook} />
				</Col>
				<Col span={8}>
					<Select value={fields.gender.value} onChange={this.onGenderChange} size='small' style={{width:'100%'}}>
						<Option value={-1}>未知</Option>
						<Option value={0}>女</Option>
						<Option value={1}>男</Option>
					</Select>
				</Col>
				<Col span={8}>
					<Select value={fields.timeAlg.value} onChange={this.onTimeAlgChange} size='small' style={{width:'100%'}}>
						<Option value={0}>真太阳时</Option>
						<Option value={1}>直接时间</Option>
						<Option value={2}>春分定卯时</Option>
					</Select>
				</Col>
				<Col span={8}>
					<Select value={fields.phaseType.value} onChange={this.onPhaseTypeChange} size='small' style={{width:'100%'}}>
						<Option value={0}>长生火土同</Option>
						<Option value={1}>长生水土同</Option>
						<Option value={2}>长生阳顺阴逆</Option>
					</Select>
				</Col>
				<Col span={8}>
					<Select value={fields.godKeyPos.value} onChange={this.onGodKeyPosChange} size='small' style={{width:'100%'}} >
						<Option value='年'>按年柱查神煞</Option>
						<Option value='日'>按日柱查神煞</Option>
						<Option value='年日'>年柱日柱都查</Option>
					</Select>
				</Col>
				<Col span={8}>
					<Select value={fields.after23NewDay.value} onChange={this.onAfter23NewDayChange} size='small' style={{width:'100%'}}>
						<Option value={0}>23点算当天</Option>
						<Option value={1}>23点算第二天</Option>
					</Select>
				</Col>
				<Col span={8}>
					<GeoCoordModal 
						onOk={this.changeGeo}
						lat={fields.gpsLat.value} lng={fields.gpsLon.value}
					>
						<Button size='small' style={{width:'100%'}}>经纬度选择</Button>
					</GeoCoordModal>
				</Col>
				<Col span={9}>
					<Checkbox checked={this.props.baziOpt.onlyZiGanShen} onChange={this.onOnlyZiganChange}>只显示地支藏干十神</Checkbox>
				</Col>
				<Col span={8}>
					<Select size='small' style={{width: '100%'}} value={fields.adjustJieqi.value} onChange={this.onChangeAdjustJieqi}>
						<Option value={0}>不调整节气</Option>
						<Option value={1}>节气按纬度调整</Option>
					</Select>
				</Col>
				<Col span={7} style={{textAlign: 'right'}}>
					<span style={{width:'100%'}}>{fields.lon.value + ' ' + fields.lat.value}</span>
				</Col>

			</Row>

		);
	}

}

export default CnTraditionInput;
