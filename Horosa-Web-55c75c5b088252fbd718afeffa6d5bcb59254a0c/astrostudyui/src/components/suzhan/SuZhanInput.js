import { Component } from 'react';
import { Row, Col, Form, DatePicker, Input, Button, Select } from 'antd';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import * as SZConst from './SZConst';
import { gcj02ToGps, randomStr } from '../../utils/helper';
import {convertLatStrToDegree, convertLonStrToDegree, convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import DateTime from '../comp/DateTime';

const {Option} = Select

class SuZhanInput extends Component{
	
	constructor(props) {
		super(props);

		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onZoneChanged = this.onZoneChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.onChartTypeChange = this.onChartTypeChange.bind(this);
		this.onChartShapeChange = this.onChartShapeChange.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.onDoubingSu28Change = this.onDoubingSu28Change.bind(this);
		this.onHouseStartModeChange = this.onHouseStartModeChange.bind(this);

		let type = localStorage.getItem('suzhanChartType');
		if(type !== undefined && type !== null){
			SZConst.SZChart.chart = parseInt(type+'');
		}

		let shape = localStorage.getItem('suzhanChartShape');
		if(shape !== undefined && shape !== null){
			SZConst.SZChart.shape = parseInt(shape+'');
		}
		let houseStartMode = localStorage.getItem('suzhanHouseStartMode');
		if(houseStartMode !== undefined && houseStartMode !== null){
			try{
				houseStartMode = parseInt(houseStartMode, 10);
				if(houseStartMode === SZConst.SZHouseStart_ASC){
					SZConst.SZChart.houseStartMode = SZConst.SZHouseStart_ASC;
				}
			}catch(e){
				SZConst.SZChart.houseStartMode = SZConst.SZHouseStart_Bazi;
			}
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
				}
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

	onChartTypeChange(val){
		SZConst.SZChart.chart = val;
		localStorage.setItem('suzhanChartType', val);
		if(this.props.onFieldsChange){
			this.props.onFieldsChange({
				szchart: {
					value: val,
				}
			});
		}
	}

	onChartShapeChange(val){
		SZConst.SZChart.shape = val;
		localStorage.setItem('suzhanChartShape', val);
		if(this.props.onFieldsChange){
			this.props.onFieldsChange({
				szshape: {
					value: val,
				}
			});
		}
	}

	onDoubingSu28Change(val){
		if(this.props.onFieldsChange){
			this.props.onFieldsChange({
				doubingSu28: {
					value: val,
				}
			});
		}
	}

	onHouseStartModeChange(val){
		SZConst.SZChart.houseStartMode = val;
		localStorage.setItem('suzhanHouseStartMode', val);
		if(this.props.onFieldsChange){
			this.props.onFieldsChange({
				houseStartMode: {
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

		let szchart = SZConst.SZChart.chart;
		if(fields.szchart !== undefined && fields.szchart !== null &&
			fields.szchart.value !== undefined && fields.szchart.value !== null){
			szchart = fields.szchart.value;
		}

		let szshape = SZConst.SZChart.shape;
		if(fields.szshape !== undefined && fields.szshape !== null &&
			fields.szshape.value !== undefined && fields.szshape.value !== null){
			szshape = fields.szshape.value;
		}
		let houseStartMode = SZConst.SZChart.houseStartMode;
		if(fields.houseStartMode !== undefined && fields.houseStartMode !== null &&
			fields.houseStartMode.value !== undefined && fields.houseStartMode.value !== null){
			houseStartMode = parseInt(fields.houseStartMode.value, 10);
		}
		if(houseStartMode !== SZConst.SZHouseStart_ASC){
			houseStartMode = SZConst.SZHouseStart_Bazi;
		}

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
					<Select value={szchart} onChange={this.onChartTypeChange} size='small' style={{width:'100%'}}>
						<Option value={SZConst.SZChart_NoExternChart}>无外盘</Option>
						<Option value={SZConst.SZChart_SignChart}>星座外盘</Option>
						<Option value={SZConst.SZChart_FengYeChart}>分野外盘</Option>
						<Option value={SZConst.SZChart_BaGuaChart}>八卦外盘</Option>
						<Option value={SZConst.SZChart_DunJiaChart}>遁甲外盘</Option>
						<Option value={SZConst.SZChart_TaiYiChart}>太乙外盘</Option>
						<Option value={SZConst.SZChart_FangWeiChart}>方位外盘</Option>
						<Option value={SZConst.SZChart_NiXiangChart}>逆向外盘</Option>
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
				<Col lg={12} xl={8}>
					<Select value={szshape} onChange={this.onChartShapeChange} size='small' style={{width:'100%'}}>
						<Option value={SZConst.SZChart_Circle}>圆形盘</Option>
						<Option value={SZConst.SZChart_Square}>方形盘</Option>
					</Select>
				</Col>
				<Col lg={12} xl={8}>
					<Select value={fields.doubingSu28.value} onChange={this.onDoubingSu28Change} size='small' style={{width:'100%'}}>
						<Option value={0}>现实距星法</Option>
						<Option value={1}>斗柄定房法</Option>
					</Select>
				</Col>
				<Col lg={12} xl={8}>
					<Select value={houseStartMode} onChange={this.onHouseStartModeChange} size='small' style={{width:'100%'}}>
						<Option value={SZConst.SZHouseStart_Bazi}>八字公式起盘</Option>
						<Option value={SZConst.SZHouseStart_ASC}>ASC起盘</Option>
					</Select>
				</Col>
				<Col lg={12} xl={8} style={{textAlign: 'right'}}>
					<span style={{width:'100%', textAlign: 'center'}}>{fields.lon.value + ' ' + fields.lat.value}</span>
				</Col>
			</Row>
			</div>
		);
	}

}

export default SuZhanInput;
