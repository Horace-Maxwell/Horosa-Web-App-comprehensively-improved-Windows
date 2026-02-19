import { Component } from 'react';
import { Row, Col, Tag, } from 'antd';
import MapV2 from './MapV2';
import PropTypes from 'prop-types';
import {randomStr} from '../../utils/helper';


class GeoCoord extends Component{

	constructor(props) {
		super(props);


		this.state = {
			map: null,
			mapid: 'div' + randomStr(8),
			lat: props.lat,
			lng: props.lng,
			gpsLat: props.gpsLat,
			gpsLng: props.gpsLng,
			marker: null,
		};

		this.handleMapCreated = this.handleMapCreated.bind(this);
		this.handleLoadUIComplete = this.handleLoadUIComplete.bind(this);
		this.handleMapClick = this.handleMapClick.bind(this);

		this.handleCenter = this.handleCenter.bind(this);
	}

	handleMapCreated(map){
		this.setState({
			map: map,
		}, ()=>{
			window.AMapUI.loadUI(['control/BasicControl'], (BasicControl)=>{
				map.addControl(new BasicControl.Zoom({
					position: 'lt',
					showZoomNum: false
				}));
			})
	
			window.AMapUI.loadUI(['overlay/SimpleMarker'], this.handleLoadUIComplete);
		});	

	}

	handleLoadUIComplete(SimpleMarker){
		let simmark = new SimpleMarker({
			map: this.state.map,
			iconStyle: 'red',
			iconTheme: 'default',
		});

		this.setState({
			marker: simmark,
		});
	}

	handleMapClick(e){

	}

	handleCenter(e){
		if(this.state.map && this.state.lat !== undefined && this.state.lng !== undefined){
			const pos = new window.AMap.LngLat(this.state.lng, this.state.lat);
			this.state.map.setCenter(pos);
		}
	}

	render(){
		const mapstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
		};

		const plugins = [{
			name: 'ControlBar',
			options:{
				showControlButton: false,
			}
		}];


		let lnglat = '经纬度: 无';
		if(this.props.lat !== undefined && this.props.lng !== undefined && 
			this.props.lat !== null && this.props.lng !== null && 
			this.props.lat !== 0 && this.props.lng !== 0){
			lnglat = `经度：${this.props.lng}，纬度：${this.props.lat}`;
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
						<Tag color='gold' onClick={this.handleCenter}>回到中点</Tag>
						<Tag color='gold'><h2>{lnglat}</h2></Tag>
					</Col>
				</Row>
				<div id={this.state.mapid} style={mapstyle} >					
					<MapV2
						zoom={this.props.zoom ? this.props.zoom : 11}
						uiplugin={['control/BasicControl', 'overlay/SimpleMarker']}
						created={this.handleMapCreated}
					/>
				</div>
			</div>
		);

	}

}

GeoCoord.propTypes = {
	width: PropTypes.any,
	height: PropTypes.any,
	zoom: PropTypes.number,
	lat: PropTypes.number,
	lng: PropTypes.number,
};

export default GeoCoord;
