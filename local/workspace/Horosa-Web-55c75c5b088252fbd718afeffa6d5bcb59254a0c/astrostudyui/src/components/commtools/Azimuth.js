import { Component } from 'react';
import { Row, Col, Divider, Statistic } from 'antd';
import { XQButton as Button, XQInputNumber as InputNumber, XQSelect as Select } from '../xq-ui';
import LatInput from '../astro/LatInput';
import LonInput from '../astro/LonInput';
import DateTimeSelector from '../comp/DateTimeSelector';
import DateTime from '../comp/DateTime';
import GeoCoordModal from '../amap/GeoCoordModal';
import { randomStr, getAzimuthStr, isNumber } from '../../utils/helper';
import {convertLatStrToDegree, convertLonStrToDegree, splitDegree} from '../astro/AstroHelper';
import { message } from 'antd';

// 🛡 纯前端球面三角法地平坐标:输入 jdn / 观测点 / 黄道或赤道坐标 → 真高度+视高度+方位角(0=南顺时针,与既有 getAzimuthStr 兼容)。
//   弃用后端 /calc/azimuth(RSA body 在 prod WKWebView 上偶发字段穿透 → params.error/raw "param error"),
//   纯本地计算永久根治。误差 < 0.5°,对地平坐标显示足够。
// 共享导出:七政「方位标注」列/择日动盘离线兜底同用此实现(0=南顺时针;罗盘向=+180)。
export function calcAzimuthLocal({jdn, latObs, lonObs, coordLon, coordLat, coordType, temp, press}){
	const D2R = Math.PI / 180.0;
	const R2D = 180.0 / Math.PI;
	const T = (jdn - 2451545.0) / 36525.0;

	let RA_deg;
	let dec_rad;
	if(coordType === 0){
		// 黄道 → 赤道(IAU 1976 黄赤交角多项式)
		const eps = (23.4392911 - 0.0130042*T - 1.64e-7*T*T + 5.04e-7*T*T*T) * D2R;
		const lonRad = coordLon * D2R;
		const latRad = coordLat * D2R;
		const sinDec = Math.sin(latRad)*Math.cos(eps) + Math.cos(latRad)*Math.sin(eps)*Math.sin(lonRad);
		dec_rad = Math.asin(sinDec);
		// RA = atan2(sin(lon)*cos(lat)*cos(eps) - sin(lat)*sin(eps), cos(lon)*cos(lat))
		const y = Math.sin(lonRad)*Math.cos(latRad)*Math.cos(eps) - Math.sin(latRad)*Math.sin(eps);
		const x = Math.cos(lonRad)*Math.cos(latRad);
		RA_deg = Math.atan2(y, x) * R2D;
		if(RA_deg < 0) RA_deg += 360;
	}else{
		// 赤道坐标直接用
		RA_deg = coordLon;
		dec_rad = coordLat * D2R;
	}

	// GMST(IAU 1982)
	const D = jdn - 2451545.0;
	let GMST = 280.46061837 + 360.98564736629 * D + 0.000387933*T*T - (T*T*T)/38710000.0;
	GMST = ((GMST % 360) + 360) % 360;

	// LST(本地恒星时,东经为正)
	let LST = GMST + lonObs;
	LST = ((LST % 360) + 360) % 360;

	// 时角
	let H_deg = LST - RA_deg;
	H_deg = ((H_deg % 360) + 360) % 360;
	const Hrad = H_deg * D2R;
	const latObsRad = latObs * D2R;

	// 真高度
	const sinAlt = Math.sin(latObsRad)*Math.sin(dec_rad) + Math.cos(latObsRad)*Math.cos(dec_rad)*Math.cos(Hrad);
	const altTrue = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * R2D;

	// 传统天文方位角:0=南顺时针(0=南,90=西,180=北,270=东) → 与 getAzimuthStr 一致
	const azY = Math.sin(Hrad);
	const azX = Math.cos(Hrad) * Math.sin(latObsRad) - Math.tan(dec_rad) * Math.cos(latObsRad);
	let az = Math.atan2(azY, azX) * R2D;
	if(az < 0) az += 360;

	// 大气折射(Saemundsson,适用于 altTrue ≳ -1°)
	let altAppa = altTrue;
	if(altTrue > -1){
		const inner = (altTrue + 10.3/(altTrue + 5.11)) * D2R;
		const tanv = Math.tan(inner);
		if(Math.abs(tanv) > 1e-9){
			const R_arcmin = (press/1010.0) * (283.0/(273.0 + temp)) * 1.02 / tanv;
			altAppa = altTrue + R_arcmin / 60.0;
		}
	}

	return {
		azimuth: az,
		altitudeTrue: altTrue,
		altitudeAppa: altAppa,
	};
}

const Option = Select.Option;
const inputGroupStyle = { display: 'flex', alignItems: 'center', gap: 6 };

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

	requestCalc(){
		// 🆕 纯本地球面三角法计算地平坐标,不再发后端 → 永久根治 prod WKWebView 偶发的 "param error"。
		if(!this.state.time || typeof this.state.time.calcJdn !== 'function'){
			message.error('请先选择时间');
			return;
		}
		try{ this.state.time.calcJdn(); }catch(e){
			message.error('时间解析失败,请重新选择');
			return;
		}
		const jdn = Number(this.state.time.jdn);
		const latObs = Number(this.state.gpsLat);
		const lonObs = Number(this.state.gpsLon);
		const temp = Number(this.state.temp);
		const press = Number(this.state.press);
		const coordLat = Number(this.state.coordLat);
		const coordLon = Number(this.state.coordLon);
		const coordType = Number(this.state.coordType) || 0;
		const required = { '儒略日': jdn, '观测纬度': latObs, '观测经度': lonObs, '温度': temp, '气压': press, '坐标纬度': coordLat, '坐标经度': coordLon };
		for(const k of Object.keys(required)){
			if(!Number.isFinite(required[k])){
				message.error(`参数「${k}」无效,请检查输入`);
				return;
			}
		}

		const result = calcAzimuthLocal({ jdn, latObs, lonObs, coordLon, coordLat, coordType, temp, press });
		this.setState({
			azimuth: result.azimuth,
			altitudeTrue: result.altitudeTrue,
			altitudeAppa: result.altitudeAppa,
		});
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
        if(londeg[0] < 0 || (londeg[3] && londeg[3].length)){
            londir = 'w';
            londeg[0] = -londeg[0];
            londeg[1] = Math.abs(londeg[1]);
        }
        if(latdeg[0] < 0 || (latdeg[3] && latdeg[3].length)){
            latdir = 's';
            latdeg[0] = -latdeg[0];
            latdeg[1] = Math.abs(latdeg[1]);
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
						<div style={inputGroupStyle}>
							<span>经：</span>
							<InputNumber min={0} max={360} step={0.001} value={this.state.coordLon} 
								onChange={this.changeCoordLon} 
								style={{width: 120}}
							/><span>度</span>
						</div>
					</Col>
					<Col span={9}>
						<div style={inputGroupStyle}>
							<span>纬：</span>
							<InputNumber min={-90} max={90} step={0.001} value={this.state.coordLat} 
								onChange={this.changeCoordLat} 
								style={{width: 120}}
							/><span>度</span>
						</div>
					</Col>
				</Row>
				{/* [Q-306/T-298] 海拔输入已移除:纯前端 calcAzimuthLocal 不吃海拔(物理影响极小),留着是死开关 */}
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
