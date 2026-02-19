import { Component } from 'react';
import { Row, Col, Tag, } from 'antd';
import MapV2 from './MapV2';
import { AMapKey, AMapVer, AMapUIVer } from '../../utils/constants';
import {randomStr, gcj02ToGps, getScriptPromise} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';

let AstroColor = {};
AstroColor[AstroConst.MERCURY] = '#1E90FF';
AstroColor[AstroConst.VENUS] = '#FFFF00';
AstroColor[AstroConst.MARS] = '#B22222';
AstroColor[AstroConst.JUPITER] = '#8A2BE2';
AstroColor[AstroConst.SATURN] = '#8B795E';
AstroColor[AstroConst.SUN] = '#FFD700';
AstroColor[AstroConst.MOON] = '#0000CD';
AstroColor[AstroConst.DARKMOON] = '#483D8B';
AstroColor[AstroConst.PURPLE_CLOUDS] = '#3b3b3b';
AstroColor[AstroConst.NORTH_NODE] = '#CD5C5C';
AstroColor[AstroConst.SOUTH_NODE] = '#CDB38B';
AstroColor[AstroConst.URANUS] = '#40E0D0';
AstroColor[AstroConst.NEPTUNE] = '#000080';
AstroColor[AstroConst.CHIRON] = '#00CD00';
AstroColor[AstroConst.PLUTO] = '#1C1C1C';

class ACG extends Component{

	constructor(props) {
		super(props);

		this.state = {
			map: null,
			infoWindow: null,
			satellite: null,
			mapid: 'div' + randomStr(8),
		};

		this.handleMapCreated = this.handleMapCreated.bind(this);
		this.handleMapClick = this.handleMapClick.bind(this);
		this.drawLines = this.drawLines.bind(this);
		this.drawPlanetLines = this.drawPlanetLines.bind(this);
		this.genInfoWinContent = this.genInfoWinContent.bind(this);
		this.drawPointsLine = this.drawPointsLine.bind(this);
		this.openInfoWin = this.openInfoWin.bind(this);
		this.showSatellite = this.showSatellite.bind(this);
		this.hideSatellite = this.hideSatellite.bind(this);
	}

	genInfoWinContent(title, evt){
		let lat = 0;
		let lon = 0;
		let gpslat = 0;
		let gpslon = 0;
		if(evt){
			lat = evt.lnglat.lat;
			lon = evt.lnglat.lng;
			let pnt = gcj02ToGps(lat, lon);
			gpslat = Math.round(pnt.lat*1000000)/1000000;
			gpslon = Math.round(pnt.lon*1000000)/1000000;
		}
		let fontcolor = '#3b3b3b';
		if(this.props.useSatellite){
			fontcolor = '#fefeef';
		}
		let dom = `<ul style='font-size:200%;color:${fontcolor}'><li>${title}</li><li>纬度:${lat}</li><li>经度:${lon}</li><li>gps纬度:${gpslat}</li><li>gps经度:${gpslon}</li></ul>`;
		return dom;
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
			})

			let infowin = new window.AMap.InfoWindow({
				isCustom: true,  //使用自定义窗体
				content: this.genInfoWinContent('title', null),
				offset: new window.AMap.Pixel(16, 15)
			});
			this.setState({
				infoWindow: infowin,
			}, ()=>{
				this.drawLines();
				if(this.props.useSatellite){
					this.showSatellite();
				}else{
					this.hideSatellite();
				}
			})
		});	

	}

	handleMapClick(e){

	}

	showSatellite(){
		if(this.state.satellite){
			this.state.satellite.show();
		}
	}

	hideSatellite(){
		if(this.state.satellite){
			this.state.satellite.hide();
		}
	}

	openInfoWin(key, angle, e){
		let title = `<span style='font-family:${AstroConst.AstroFont}'>${AstroText.AstroMsg[key]}&nbsp;${AstroText.AstroMsg['Asp0']}&nbsp;${AstroText.AstroMsg[angle]}</span>`;
		let content = this.genInfoWinContent(title, e);
		this.state.infoWindow.setPosition(e.lnglat);
		this.state.infoWindow.setContent(content);
		this.state.infoWindow.open(this.state.map);
	}

	drawPointsLine(pntsary, key, angle){
		if(this.props.lines){
			let linekey = `${key}:${angle}`;
			if(!this.props.lines.has(linekey)){
				return;
			}
		}
		
		for(let i=0; i<pntsary.length; i++){
			let pnts = pntsary[i];
			if(pnts.lenght === 1){
				continue;
			}
			let path = [];
			for(let j=0; j<pnts.length; j++){
				let p = pnts[j];
				let lon = parseFloat(p[0]);
				let lat = parseFloat(p[1]);
				if(Math.abs(lon) > 180 || Math.abs(lat) > 90){
					continue;
				}	
				path.push([lon, lat]);
			}

			let line = new window.AMap.Polyline({
				path: path,            // 设置线覆盖物路径
				strokeColor: AstroColor[key],   // 线颜色
				strokeOpacity: 1,         // 线透明度
				strokeWeight: 2,          // 线宽
				strokeStyle: 'solid',     // 线样式
				strokeDasharray: [10, 5], // 补充线样式
				geodesic: true,           // 绘制大地线
				extData: key,
			});			
			line.setMap(this.state.map);
			line.on('mouseover', (e)=>{
				this.openInfoWin(key, angle, e);
			});
			line.on('click', (e)=>{
				this.openInfoWin(key, angle, e);
			});
			line.on('mouseout', (e)=>{
				this.state.infoWindow.close();
			});	
	
			line.on('touchmove', (e)=>{
				this.openInfoWin(key, angle, e);
			});
			line.on('touchend', (e)=>{
				this.state.infoWindow.close();
			});	
	
		}


	}

	drawPlanetLines(planet, key){
		let pntsary = planet.asc;
		this.drawPointsLine(pntsary, key, AstroConst.ASC);
		pntsary = planet.desc;
		this.drawPointsLine(pntsary, key, AstroConst.DESC);

		pntsary = planet.mc;
		this.drawPointsLine(pntsary, key, AstroConst.MC);
		pntsary = planet.ic;
		this.drawPointsLine(pntsary, key, AstroConst.IC);

	}

	drawLines(){
		if(this.state.map === undefined || this.state.map === null || 
			this.state.infoWindow === undefined || this.state.infoWindow === null || 
			this.props.value === undefined || this.props.value === null){
			return;
		}
		let map = this.state.map;
		map.clearMap();
		for(let key in this.props.value){
			let planet = this.props.value[key];
			this.drawPlanetLines(planet, key);
		}
	}

	render(){
		const mapstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
		};

		
		if(this.props.useSatellite){
			this.showSatellite();
		}else{
			this.hideSatellite();
		}

		this.drawLines();

		return (
			<div>
				<div id={this.state.mapid} style={mapstyle} >					
					<MapV2
						zoom={this.props.zoom ? this.props.zoom : 1}
						plugin={['AMap.Autocomplete']}
						uiplugin={['control/BasicControl']}
						created={this.handleMapCreated}
					/>
				</div>
			</div>
		);
	}
}

export default ACG;
