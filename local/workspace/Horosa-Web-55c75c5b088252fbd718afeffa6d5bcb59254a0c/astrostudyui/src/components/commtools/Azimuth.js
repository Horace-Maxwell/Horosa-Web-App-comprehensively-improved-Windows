import { Component } from 'react';
import { Row, Col, Button, Divider, Statistic, Select, Input, InputNumber } from 'antd';
import LatInput from '../astro/LatInput';
import LonInput from '../astro/LonInput';
import DateTimeSelector from '../comp/DateTimeSelector';
import DateTime from '../comp/DateTime';
import GeoCoordModal from '../amap/GeoCoordModal';
import { randomStr, getAzimuthStr, isNumber } from '../../utils/helper';
import {convertLatStrToDegree, convertLonStrToDegree, splitDegree} from '../astro/AstroHelper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';

const Option = Select.Option;
const InputGroup = Input.Group;

class Azimuth extends Component{
	constructor(props) {
		super(props);

		this.state = {
			lat: this.props.lat,
			lon: this.props.lon,
			gpsLat: convertLatStrToDegree(this.props.lat),
			gpsLon: convertLonStrToDegree(this.props.lon),
			time: this.props.time,
			coordType: 0,
			coordLon: 0,
			coordLat: 0,
			height: 150,
			temp: 0,
			press: 1000,

			azimuth: 0,
			altitudeTrue: 0,
			altitudeAppa: 0
		}

		this.changeGeo = this.changeGeo.bind(this);
		this.changeLon = this.changeLon.bind(this);
		this.changeLat = this.changeLat.bind(this);
		this.changeTime = this.changeTime.bind(this);
		this.changeCoordLon = this.changeCoordLon.bind(this);
		this.changeCoordLat = this.changeCoordLat.bind(this);
		this.changeCoordType = this.changeCoordType.bind(this);
		this.changeHeight = this.changeHeight.bind(this);
		this.changeTemp = this.changeTemp.bind(this);
		this.changePress = this.changePress.bind(this);

		this.requestCalc = this.requestCalc.bind(this);
	}

	async requestCalc(){
		this.state.time.calcJdn();
		let params = {
			jdn: this.state.time.jdn,
			lat: this.state.gpsLat,
			lon: this.state.gpsLon,
			height: this.state.height,
			temp: this.state.temp,
			press: this.state.press,
			coordType: this.state.coordType,
			coordLat: this.state.coordLat,
			coordLon: this.state.coordLon,
		}

		const data = await request(`${Constants.ServerRoot}/calc/azimuth`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		const st = {
			azimuth: result.azimuth,
			altitudeTrue: result.altitudeTrue,
			altitudeAppa: result.altitudeAppa,
		};

		this.setState(st);
	}


	changeTime(res){
		this.setState({
			time: res.value,
		});
	}

	changeLon(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		let gpslon = convertLonStrToDegree(val);
		this.setState({
			gpsLon: gpslon,
			lon: val,
		})
	}

	changeLat(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		let gpslat = convertLatStrToDegree(val);
		this.setState({
			gpsLat: gpslat,
			lat: val,
		})
	}

	changeGeo(geo){
        let gps = {
            lat: geo.gpsLat,
            lon: geo.gpsLng,
        };
        let latdeg = splitDegree(gps.lat);
        let londeg = splitDegree(gps.lon);
        let latdir = 'n';
        let londir = 'e';
        if(londeg[0] < 0){
            londir = 'w';
            londeg[0] = -londeg[0];
            londeg[1] = -londeg[1];
        }
        if(latdeg[0] < 0){
            latdir = 's';
            latdeg[0] = -latdeg[0];
            latdeg[1] = -latdeg[1];
        }
        let lat = latdeg[0] + latdir + (latdeg[1] < 10 ? '0' + latdeg[1] : latdeg[1]);
        let lon = londeg[0] + londir + (londeg[1] < 10 ? '0' + londeg[1] : londeg[1]);

		this.setState({
            lat: lat,
			lon: lon,
			gpsLat: gps.lat,
			gpsLon: gps.lon,			
		})

	}

	changeCoordLat(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		if(typeof val === 'string' && !isNumber(val)){
			return;
		}
		this.setState({
			coordLat: val,
		})
	}

	changeCoordLon(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		if(typeof val === 'string' && !isNumber(val)){
			return;
		}
		this.setState({
			coordLon: val,
		})		
	}

	changeCoordType(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		this.setState({
			coordType: val,
		})		
	}

	changeHeight(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		if(typeof val === 'string' && !isNumber(val)){
			return;
		}
		this.setState({
			height: val,
		})		
	}
	changeTemp(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		if(typeof val === 'string' && !isNumber(val)){
			return;
		}
		this.setState({
			temp: val,
		})		
	}
	changePress(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		if(typeof val === 'string' && !isNumber(val)){
			return;
		}
		this.setState({
			press: val,
		})		
	}

	render(){
		let azdeg = getAzimuthStr(this.state.azimuth);
		let altTrue = Math.round(this.state.altitudeTrue * 1000) / 1000 + 'º';
		let altAppa = Math.round(this.state.altitudeAppa * 1000) / 1000 + 'º';

		return (
			<div>
				<Row>
					<Col span={24}>
						<DateTimeSelector
							onlyYear={false}
							showTime={true}
							showAdjust={false}
							value={this.state.time}
							onChange={this.changeTime}
						/>						
					</Col>
					<Col span={12}>
						<LonInput onChange={this.changeLon} value={this.state.lon} oneRow={true} />
					</Col>
					<Col span={12}>
						<LatInput onChange={this.changeLat} value={this.state.lat} oneRow={true} />
					</Col>
					<Col span={12}>
						<GeoCoordModal 
							onOk={this.changeGeo}
							lat={this.state.gpsLat} lng={this.state.gpsLon}
						>
							<Button>经纬度选择</Button>
						</GeoCoordModal>
					</Col>
				</Row>
				<Row style={{marginTop: 10}}>
					<Col span={6}>
						<Select value={this.state.coordType} onChange={this.changeCoordType}>
							<Option value={0}>黄道坐标</Option>
							<Option value={1}>赤道坐标</Option>
						</Select>
					</Col>
					<Col span={9}>
						<InputGroup >
							<span>经：</span>
							<InputNumber min={0} max={360} step={0.001} value={this.state.coordLon} 
								onChange={this.changeCoordLon} 
								style={{width: 120}}
							/><span>度</span>
						</InputGroup>
					</Col>
					<Col span={9}>
						<InputGroup >
							<span>纬：</span>
							<InputNumber min={-90} max={90} step={0.001} value={this.state.coordLat} 
								onChange={this.changeCoordLat} 
								style={{width: 120}}
							/><span>度</span>
						</InputGroup>
					</Col>
				</Row>
				<Row style={{marginTop: 10}}>
					<Col span={24}>
						<InputGroup >
							<span>海拔：</span>
							<InputNumber min={0} max={9000} step={10} 
								value={this.state.height} 
								onChange={this.changeHeight} 
								style={{width: 120}}
							/><span>米</span>
						</InputGroup>
					</Col>
					<Col span={12}>
						<InputGroup >
							<span>温度：</span>
							<InputNumber min={-100} max={60} step={1} 
								value={this.state.temp} 
								onChange={this.changeTemp} 
								style={{width: 120}}
							/><span>摄氏度</span>
						</InputGroup>
					</Col>
					<Col span={12}>
						<InputGroup >
							<span>大气压：</span>
							<InputNumber min={1} max={5000} step={10} 
								value={this.state.press} 
								onChange={this.changePress} 
								style={{width: 120}}
							/><span>百帕</span>
						</InputGroup>
					</Col>

				</Row>
				<Row style={{marginTop: 20}}>
					<Col offset={18} span={6}>
						<Button type='primary' onClick={this.requestCalc}>计算</Button>
					</Col>
				</Row>
				
				<Divider orientation='left'  style={{marginTop: 20}}>地平坐标</Divider>
				<Row>
					<Col span={24}>
						<Statistic title='地平经度（方位角）' value={azdeg} />
					</Col>
				</Row>
				<Row style={{marginTop: 20}}>
					<Col span={12}>
						<Statistic title='真地平纬度' value={altTrue} />
					</Col>
					<Col span={12}>
						<Statistic title='视地平纬度' value={altAppa} />
					</Col>
				</Row>
			</div>
		)
	}
}

export default Azimuth;
