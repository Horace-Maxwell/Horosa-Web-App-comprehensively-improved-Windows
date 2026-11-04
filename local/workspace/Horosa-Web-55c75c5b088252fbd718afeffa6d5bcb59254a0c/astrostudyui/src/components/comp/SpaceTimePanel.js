import React, { Component } from 'react';
import GeoCoordModal from '../amap/GeoCoordModal';
import CompactTimeField from './CompactTimeField';
import XQIcon from '../xq-icons';
import DateTime from './DateTime';

function fieldValue(fields, key, fallback = ''){
	if(!fields || !fields[key] || fields[key].value === undefined || fields[key].value === null){
		return fallback;
	}
	return fields[key].value;
}

export function buildDateTimeFromFields(fields){
	let datetm = new DateTime();
	if(fields && fields.date && fields.time){
		const dateText = fields.date.value && fields.date.value.format ? fields.date.value.format('YYYY-MM-DD') : '';
		const timeText = fields.time.value && fields.time.value.format ? fields.time.value.format('HH:mm:ss') : '';
		if(dateText && timeText){
			datetm = datetm.parse(`${dateText} ${timeText}`, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
	}
	return datetm;
}

export function formatSpaceTime(fields, fallback = ''){
	if(!fields || !fields.date || !fields.time || !fields.date.value || !fields.time.value){
		return fallback;
	}
	const dateText = fields.date.value.format ? fields.date.value.format('YYYY-MM-DD') : '';
	const timeText = fields.time.value.format ? fields.time.value.format('HH:mm:ss') : '';
	return `${dateText} ${timeText}`.trim() || fallback;
}

class SpaceTimePanel extends Component{
	render(){
		const fields = this.props.fields || {};
		const value = this.props.value || buildDateTimeFromFields(fields);
		const timeText = this.props.timeText || formatSpaceTime(fields, '---- -- -- --:--:--');
		const locationName = this.props.locationName || fieldValue(fields, 'pos', '未命名地点') || '未命名地点';
		const lon = fieldValue(fields, 'lon', '');
		const lat = fieldValue(fields, 'lat', '');
		const gpsLat = fieldValue(fields, 'gpsLat', undefined);
		const gpsLon = fieldValue(fields, 'gpsLon', undefined);
		const needZone = this.props.needZone;
		const showLocation = this.props.showLocation !== false;

		return (
			<div className={`horosa-spacetime-panel ${this.props.className || ''}`}>
				{/* 时间块与星运各页右上角同一个件(CompactTimeField:单击编辑器 / 双击键入 / 拖动调单位 / 步进行) */}
				<CompactTimeField
					value={value}
					timeText={timeText}
					onChange={this.props.onTimeChange}
					timeHook={this.props.timeHook}
					needZone={needZone}
					onStepSelect={this.props.onStepSelect}
					confirmOnAdjust={this.props.confirmOnAdjust}
				/>
				{showLocation ? (
					<div className="horosa-field-block">
						<div className="horosa-field-label">地点</div>
						<GeoCoordModal onOk={this.props.onGeoChange} lat={gpsLat} lng={gpsLon}>
							<button type="button" className="horosa-unified-field horosa-place-field">
								<XQIcon name="locastro" />
								<span>
									<strong>{locationName}</strong>
									<small>{lon}{lon && lat ? ' · ' : ''}{lat}</small>
								</span>
								<XQIcon name="globe" />
							</button>
						</GeoCoordModal>
					</div>
				) : null}
			</div>
		);
	}
}

export default SpaceTimePanel;
