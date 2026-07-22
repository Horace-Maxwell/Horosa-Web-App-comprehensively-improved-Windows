import { Component } from 'react';
import { Row, Col } from 'antd';
import SpaceTimePanel from '../comp/SpaceTimePanel';
import { gcj02ToGps, randomStr } from '../../utils/helper';
import {convertLatStrToDegree, convertLonStrToDegree, convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import { resolveGeoZone } from '../../utils/timezone';
import { geoNameFieldPatch } from '../../utils/geoName';
import DateTime from '../comp/DateTime';
import { XQSelect as Select } from '../xq-ui';

const {Option} = Select;

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
				...(value.step ? { __stepHint: value.step } : {}),
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
			const payload = {
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
			};
			// 选地点 → 时区自动校正 + 重锚 date/time 到新时区(clone+setZone:保留钟面时刻、瞬时随之偏移);
			// 六爻只改起卦时刻的时区/经度(供真太阳时/神煞),不重摇卦象。手动改过时区则沿用 rec.zone。
			const f = this.props.fields || {};
			const dDt = f.date && f.date.value;
			const tDt = f.time && f.time.value;
			const ds = (dDt && dDt.format) ? dDt.format('YYYY-MM-DD') : null;
			const z = resolveGeoZone(rec, ds);
			if(z){
				payload.zone = { value: z };
				if(dDt && dDt.clone){ const nd = dDt.clone(); nd.setZone(z); payload.date = { value: nd }; payload.ad = { value: nd.ad }; }
				if(tDt && tDt.clone){ const nt = tDt.clone(); nt.setZone(z); payload.time = { value: nt }; }
			}
			Object.assign(payload, geoNameFieldPatch(rec));
			this.props.onFieldsChange(payload);
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
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					onTimeChange={this.onTimeChanged}
					timeHook={this.props.hook}
					onGeoChange={this.changeGeo}
				/>
				<Row>
					<Col span={24}>
						<Select value={fields.gender.value} onChange={this.onGenderChange} size='small' style={{width:'100%'}}>
							<Option value={-1}>未知</Option>
							<Option value={0}>女</Option>
							<Option value={1}>男</Option>
						</Select>
					</Col>
				</Row>
			</div>
		);
	}

}

export default GuaZhanInput;
