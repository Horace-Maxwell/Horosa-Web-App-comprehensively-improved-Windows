import { Component } from 'react';
import { Row, Col } from 'antd';
import { dstAwareZoneAt, dstDateField } from '../../utils/timezone';
import { pressable } from '../../utils/pressable';

// 时区 / 夏令时(DST)自动校正指示器(可复用)。
// props:
//   fields   — 表单 fields 对象(含 zone / date|birth|divTime / gpsLat / gpsLon)
//   onApply  — 点击「改用」时回调(调用方负责 applyDstToFields + setState)
//   marginTop— 顶部间距(默认 8)
// 当前盘偏移 ≠ 含夏令时正确值时,显示「当前 X · 改用 Y」可点 pill;否则显示「已自动校正」。
export default class DstZoneIndicator extends Component{
	constructor(props){
		super(props);
		this._cache = null; // {key, info} 缓存,避免每帧重复 tz-lookup
		this.onApply = this.onApply.bind(this);
	}

	computeInfo(){
		const flds = this.props.fields;
		const df = dstDateField(flds);
		if(!df || !df.value || !df.value.format){
			return null;
		}
		const dateStr = df.value.format('YYYY-MM-DD');
		const gpsLat = flds.gpsLat ? flds.gpsLat.value : null;
		const gpsLon = flds.gpsLon ? flds.gpsLon.value : null;
		const key = gpsLat + '|' + gpsLon + '|' + dateStr;
		if(this._cache && this._cache.key === key){
			return this._cache.info;
		}
		const info = dstAwareZoneAt(gpsLat, gpsLon, dateStr);
		this._cache = { key: key, info: info };
		return info;
	}

	onApply(){
		if(this.props.onApply){
			this.props.onApply();
		}
	}

	render(){
		const info = this.computeInfo();
		if(!info){
			return null;
		}
		const flds = this.props.fields;
		const curZone = (flds && flds.zone) ? flds.zone.value : null;
		const mismatch = curZone && curZone !== info.offset;
		const marginTop = (this.props.marginTop !== undefined) ? this.props.marginTop : 8;
		return (
			<Row gutter={12} style={{ marginTop: marginTop }}>
				<Col span={24}>
					<div className={'horosa-dst-indicator' + (info.dst ? ' is-dst' : '')}>
						<span className="horosa-dst-icon" role="img" aria-label="timezone">🌐</span>
						<span className="horosa-dst-zone">{info.zone}</span>
						<span className="horosa-dst-state">{info.dst ? '夏令时' : '标准时'}</span>
						<span className="horosa-dst-offset">UTC{info.offset}</span>
						{
							mismatch ? (
								<span className="horosa-dst-meta">
									当前 {curZone}
									<span className="horosa-dst-apply" {...pressable(this.onApply)}>改用 {info.offset}</span>
								</span>
							) : (
								<span className="horosa-dst-meta">已按出生地与日期自动校正</span>
							)
						}
					</div>
				</Col>
			</Row>
		);
	}
}
