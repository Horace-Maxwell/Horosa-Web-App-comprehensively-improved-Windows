import React, { Component } from 'react';
import GeoCoordModal from '../amap/GeoCoordModal';
import TimeFieldTrigger from './QuickTimeField';
import PlusMinusTime from '../astro/PlusMinusTime';
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
	constructor(props){
		super(props);
		this.onQuickCommit = this.onQuickCommit.bind(this);
	}

	// 双击键入 14 位数字后的提交:与弹窗「确定」同一条路(宿主 onTimeChange,confirmed=true 即重算)
	onQuickCommit(dt){
		if(this.props.onTimeChange){
			this.props.onTimeChange({ time: dt, ad: dt.ad, confirmed: true });
		}
	}

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
		const timeEditor = (
			<div className="horosa-time-popover">
				<PlusMinusTime value={value} onChange={this.props.onTimeChange} needZone={needZone}
					onStepSelect={this.props.onStepSelect} />
			</div>
		);

		return (
			<div className={`horosa-spacetime-panel ${this.props.className || ''}`}>
				<div className="horosa-field-block">
					<div className="horosa-field-label">时间</div>
					<TimeFieldTrigger value={value} timeText={timeText} popoverContent={timeEditor} onQuickCommit={this.onQuickCommit} />
					<div className="horosa-field-hint">当地时间</div>
					<div className="horosa-time-adjust-inline">
						<PlusMinusTime
							value={value}
							onChange={this.props.onTimeChange}
							hook={this.props.timeHook}
							adjustOnly
							confirmOnAdjust={this.props.confirmOnAdjust !== false}
							needZone={needZone}
							onStepSelect={this.props.onStepSelect}
						/>
					</div>
				</div>
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
