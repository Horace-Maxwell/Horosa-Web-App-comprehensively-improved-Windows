import { Component } from 'react';
import { Row, Col, Tag, } from 'antd';
import MapV2 from './MapV2';
import {randomStr, gcj02ToGps, gpsToGcj02} from '../../utils/helper';
import { Sex, } from '../../msg/types';
import { convertLatStrToDegree, convertLonStrToDegree, } from '../astro/AstroHelper';

class PointsCluster extends Component{

	constructor(props) {
		super(props);


		this.state = {
			map: null,
			mapid: 'div' + randomStr(8),
		};

		this.handleMapCreated = this.handleMapCreated.bind(this);
		this.genMarkers = this.genMarkers.bind(this);
	}


	handleMapCreated(map){
		this.setState({
			map: map,
		}, ()=>{
			window.AMapUI.loadUI(['control/BasicControl'], (BasicControl)=>{
				map.addControl(new BasicControl.Zoom({
					position: 'lt',
					showZoomNum: true
				}));
				map.addControl(new BasicControl.LayerSwitcher({
					position: 'rt'
				}));
			});

			map.plugin(["AMap.MarkerCluster"], ()=>{
				let points = this.genMarkers();
				let cluster = new window.AMap.MarkerCluster(map, points, {
					gridSize: 60, // 聚合网格像素大小
					renderMarker: (obj)=>{
						let rec = obj.data[0];
						obj.marker.setTitle(rec.title);
					},
				});			
			});

		});	

	}

	genMarkers(){
		let markers = [];
		if(this.props.value === undefined || this.props.value === null || 
			this.props.value.length === undefined || this.props.value.length === null){
			return markers;
		}

		let errchart = [];
		for(let i=0; i<this.props.value.length; i++){
			let item = this.props.value[i];
			let name = item.name ? item.name : '';
			let birth = item.birth ? item.birth : '';
			let gen = '未知';
			if(item.gender !== undefined && item.gender !== null){
				gen = item.gender + '';
			}
			let gender = Sex[gen];
			if(gender === undefined){
				gender = '未知';
			}
			let gdgps = {};
			if(item.gpsLat !== undefined || item.gpsLat !== null){
				gdgps = gpsToGcj02(item.gpsLat, item.gpsLon);
			}else{
				let lat = convertLatStrToDegree(item.lat);
				let lon = convertLonStrToDegree(item.lon);
				gdgps = gpsToGcj02(lat, lon);	
			}
			if(isNaN(gdgps.lat) || isNaN(gdgps.lon)){
				console.log(item);
				errchart.push(item);
				continue;
			}

			let marker = {
				position: {
					longitude: gdgps.lon,
					latitude: gdgps.lat,
				},
				lnglat: [gdgps.lon, gdgps.lat],
				record: item,
				title: gender + ' ' + name + ' ' + birth,
			}
			markers.push(marker);
		}

		return markers;
	}

	render(){
		const mapstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
		};

		return (			
			<div>
				<Row>
					<Col span={24}>
					</Col>
				</Row>
				<div id={this.state.mapid} style={mapstyle} >
					<MapV2
						zoom={this.props.zoom ? this.props.zoom : 4}
						plugin={['AMap.MarkerCluster']}
						uiplugin={['control/BasicControl',]}
						created={this.handleMapCreated}
					/>					
				</div>
			</div>
		);

	}

}

export default PointsCluster;
