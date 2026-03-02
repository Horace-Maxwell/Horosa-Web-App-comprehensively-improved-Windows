import { Component } from 'react';
import MapV2 from './MapV2';
import { Row, Col, Input, Tag, } from 'antd';
import PropTypes from 'prop-types';
import { uuid } from '../../utils/helper';
import {randomStr} from '../../utils/helper';
import { gcj02ToGps } from '../../utils/helper';


class GeoCoordSelector extends Component{

	constructor(props) {
		super(props);


		this.state = {
			map: null,
			mapid: 'div' + randomStr(8),
			autoCompleteInputId: 'auinput_' + uuid(16, 16),
			autoSearch: null,
			marker: null,
		};

		this.handleMapCreated = this.handleMapCreated.bind(this);
		this.handleSearchSelect = this.handleSearchSelect.bind(this);
		this.handleMapClick = this.handleMapClick.bind(this);

		this.changePos = this.changePos.bind(this);
	}

	changePos(info){
		if(this.props.onChange){
			let geo = gcj02ToGps(info.lat, info.lng);
			info.gpsLat = geo.lat;
			info.gpsLng = geo.lon;
			this.props.onChange(info);
		}
	}

	handleMapCreated(map){
		if(this.state.autoSearch){
			return;
		}

		map.on('click', this.handleMapClick);

		var marker = new window.AMap.Marker({
			position: new window.AMap.LngLat(116.39, 39.9),  
		});
		map.add(marker);

		window.AMapUI.loadUI(['control/BasicControl'], (BasicControl)=>{
			map.addControl(new BasicControl.Zoom({
				position: 'lt',
				showZoomNum: false
			}));
		})

		map.plugin(['AMap.AutoComplete'], ()=>{
			const auto = new window.AMap.AutoComplete({
				input: this.state.autoCompleteInputId
			});

			auto.on("select", this.handleSearchSelect);

			this.setState({
				map: map,
				autoSearch: auto,
			});	
		});

		this.setState({
			marker: marker,
		});
	}

	handleSearchSelect(e){
		if (e.poi && e.poi.location){
			this.state.map.setZoom(15);
			this.state.map.setCenter(e.poi.location);
			this.state.marker.setPosition(e.poi.location);

			this.changePos({
				lat: e.poi.location.lat,
				lng: e.poi.location.lng,
			});
		}

	}

	handleMapClick(e){
		this.changePos({
			lat: e.lnglat.lat,
			lng: e.lnglat.lng,
		});

	}

	render(){
		const mapstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
		};


		let lnglat = '当前所选经纬度: 未选择';
		if(this.props.lat !== undefined && this.props.lng !== undefined && 
			this.props.lat !== null && this.props.lng !== null && 
			this.props.lat !== 0 && this.props.lng !== 0){
			lnglat = `当前所选GPS经度：${this.props.gpsLng}，纬度：${this.props.gpsLat}`;
			if(this.state.map){
				const pos = new window.AMap.LngLat(this.props.lng, this.props.lat);
				if(this.state.marker){
					this.state.marker.setPosition(pos);
				}
				this.state.map.setCenter(pos);
			}
		}

		return (			
			<div>
				<Row>
					<Col span={24}>
						<Tag color='gold'><h2>{lnglat}</h2></Tag>
					</Col>
				</Row>
				<Row gutter={12}>
					<Col span={24}>
						<Input placeholder='输入关键字搜索地理位置' id={this.state.autoCompleteInputId} />
					</Col>
				</Row>
				<div id={this.state.mapid} style={mapstyle} >
					<MapV2
						zoom={this.props.zoom ? this.props.zoom : 11}
						plugin={['AMap.AutoComplete']}
						uiplugin={['control/BasicControl', 'overlay/SimpleMarker']}
						created={this.handleMapCreated}
					/>
				</div>
			</div>
		);

	}

}

GeoCoordSelector.propTypes = {
	width: PropTypes.any,
	height: PropTypes.any,
	zoom: PropTypes.number,
	lat: PropTypes.number,
	lng: PropTypes.number,
	onChange: PropTypes.func,
};

export default GeoCoordSelector;
