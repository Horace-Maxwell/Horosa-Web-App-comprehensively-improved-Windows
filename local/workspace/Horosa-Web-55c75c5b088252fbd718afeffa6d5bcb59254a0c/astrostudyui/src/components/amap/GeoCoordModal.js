import React, { Component } from 'react';
import Modal from '../comp/DragModal';
import GeoCoordSelector from './GeoCoordSelector';
import { gpsToGcj02, gcj02ToGps } from '../../utils/helper';

class GeoCoordModal extends Component{

	constructor(props) {
		super(props);

		this.state = {
			visible: false,
			record: null,
			openSeq: 0,   // 每次打开自增,作选择器 key 强制重新挂载 → 清掉上次的时区 override 残留
		}

		this.showModalHandler = this.showModalHandler.bind(this);
		this.hideModalHandler = this.hideModalHandler.bind(this);
		this.clickOk = this.clickOk.bind(this);
		this.onChange = this.onChange.bind(this);
	}

	showModalHandler(e) {
		if(e){
			e.preventDefault();
		}
		let lat = this.props.lat;
		let lng = this.props.lng;
		if(lat){
			let gcj = gpsToGcj02(lat, lng);
			this.setState({
				visible: true,
				openSeq: this.state.openSeq + 1,
				record:{
					lat: gcj.lat,
					lng: gcj.lon,
					gpsLat: lat,
					gpsLng: lng,
				}
			});
		}else{
			this.setState({
				visible: true,
				openSeq: this.state.openSeq + 1,
			});
		}
	}

	hideModalHandler(e) {
		if(e){
			e.stopPropagation();
		}
		this.setState({
			visible: false,
		});
	}

	onChange(info){
		// 合并而非整替:选点带地名后,若用户再仅改时区(zone-only,无 name 字段),旧地名不被抹掉。
		// 坐标类操作(选城市/搜地名/地图点选)总会带 name(可为空串→据实覆盖),故地名与坐标始终同步。
		this.setState({
			record: { ...(this.state.record || {}), ...info },
		});
	}

	clickOk(){
		const rec = {
			...this.state.record
		};
		if(rec.gpsLat === undefined || rec.gpsLat === null){
			let geo = gcj02ToGps(rec.lat, rec.lng);
			rec.gpsLat = geo.lat;
			rec.gpsLng = geo.lon;
		}
		// 对外一律真坐标(WGS84):GCJ-02 是高德地图的加偏坐标,只在本弹窗里给地图打点用。
		// 此前把 GCJ 点当 lat / lng 交出去,各页拿它写命盘经纬度文本(起盘就按它算)—— 与 gpsLat / gpsLng、
		// 与 AI 助手的地名解析(城市库即 WGS84)差几百米,取整到角分后约一半城市差 1′。
		// 在这一个出口统一换成真坐标,二十来处 changeGeo 不用各改(新页面接这个弹窗也自然对)。
		const gLat = Number(rec.gpsLat);
		const gLng = Number(rec.gpsLng);
		if(Number.isFinite(gLat) && Number.isFinite(gLng)){
			rec.lat = gLat;
			rec.lng = gLng;
		}
		// rec.zone(若用户在选择器内手改时区)随 ...record 透传给上层 changeGeo;
		// 未改则无 zone 字段,上层走自动推断。
		
		this.setState({
			record: null,
			visible: false,
		});

		if(this.props.onOk){
			this.props.onOk(rec);
		}

	}


	render(){

		const { children } = this.props;
		let lat = this.state.record ? this.state.record.lat : null;
		let lon = this.state.record ? this.state.record.lng : null;
		let gpslat = this.state.record ? this.state.record.gpsLat : null;
		let gpslng = this.state.record ? this.state.record.gpsLng : null;
		lat = Number.isNaN(lat) ? null : lat;
		lon = Number.isNaN(lon) ? null : lon;
		gpslat = Number.isNaN(gpslat) ? null : gpslat;
		gpslng = Number.isNaN(gpslng) ? null : gpslng;

		return (
			<span>
				<span onClick={this.showModalHandler}>
					{ children }
				</span>
				<Modal open={this.state.visible} 
					onCancel={this.hideModalHandler}
					onOk={this.clickOk}
					width={800} title='经纬度查找'
					bodyStyle={{height: 500, width:800}}
					>
					<GeoCoordSelector key={this.state.openSeq} onChange={this.onChange} height={400}
						lat={lat} lng={lon} gpsLat={gpslat} gpsLng={gpslng}
						date={this.props.date}
					/>
				</Modal>
			</span>
		)
	}
}

export default GeoCoordModal;
