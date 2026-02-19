import { Component } from 'react';
import { Row, Col, Tabs, Select, Drawer, Button } from 'antd';
import ACG from '../amap/ACG';
import request from '../../utils/request';
import DateTimeInfo from '../comp/DateTimeInfo';
import * as Constants from '../../utils/constants';
import { randomStr, gpsToGcj02,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import AstroLinesSelector from './AstroLinesSelector';
import { getAllLines, } from './AcgHelper';
import styles from '../../css/styles.less';

function fieldsToParams(fields){
	const params = {
		ad: fields.date.value.ad,
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.date.value.zone,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		name: fields.name.value,
		pos: fields.pos.value,
	};

	return params;
}

class AstroAcg extends Component{
	constructor(props) {
		super(props);
		let lines = getAllLines();
		let lineset = new Set();
		for(let i=0; i<lines.length; i++){
			lineset.add(lines[i]);
		}

		this.state = {
			acgObj: null,
			drawerVisible: false,
			lines: lines,
			linesSet: lineset,
			useSatellite: false,
		};

		this.unmounted = false;

		this.requestAcg = this.requestAcg.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.genLinesData = this.genLinesData.bind(this);
		this.genPlanetData = this.genPlanetData.bind(this);
		this.genAscData = this.genAscData.bind(this);
		this.genMcData = this.genMcData.bind(this);
		this.getNewLon = this.getNewLon.bind(this);
		this.closeDrawer = this.closeDrawer.bind(this);
		this.openDrawer = this.openDrawer.bind(this);
		this.changeLines = this.changeLines.bind(this);
		this.changeMapType = this.changeMapType.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (rec)=>{
				if(this.unmounted){
					return;
				}
				let params = this.genParams();
				this.requestAcg(params);
			};
		}

	}

	changeMapType(){
		let flag = ! this.state.useSatellite;
		this.setState({
			useSatellite: flag,
		});
	}

	changeLines(vals){
		let set = this.state.linesSet;
		set.clear();
		for(let i=0; i<vals.length; i++){
			set.add(vals[i]);
		}

		this.setState({
			lines: vals,
			linesSet: set,
		});
	}

	closeDrawer(){
		this.setState({
			drawerVisible: false,
		});
	}

	openDrawer(){
		this.setState({
			drawerVisible: true,
		});
	}

	genMcData(ary){
		let data = [];
		for(let i=-90; i<=90; i++){
			let pnt = gpsToGcj02(i, ary[0].lon);
			let pt = [pnt.lon, pnt.lat];
			data.push(pt);
		}
		return [data];
	}

	getNewLon(pnt, org){
		let lon = 0;
		let delta = 0;
		if((pnt.lon <= 0 && org.lon <= 0) || (pnt.lon >= 0 && org.lon >= 0)){
			delta = pnt.lon - org.lon;
		}else{
			if(pnt.lon > 0){
				delta = pnt.lon - org.lon;
			}else{
				delta = 360 + pnt.lon - org.lon;
			}
		}
		lon = org.lon - delta;
		if(Math.abs(lon) > 180){
			if(lon < 0){
				lon = 360 + lon;
			}else{
				lon = lon - 360;
			}
		}
		return lon;
	}

	genAscData(ary){
		let dt = [];
		let sym = -1;
		let ascdata = [];
		let org = ary[1];
		for(let i=ary.length - 1; i>1; i--){
			let pnt = ary[i];
			let lon = this.getNewLon(pnt, org);
			let gdpnt = gpsToGcj02(-pnt.lat, lon);
			if(Math.abs(gdpnt.lon) > 180){
				if(gdpnt.lon < 0){
					gdpnt.lon = 360 + gdpnt.lon;
				}else{
					gdpnt.lon = 360 - gdpnt.lon;
				}
			}
			let pt = [gdpnt.lon, gdpnt.lat];
			if(i === ary.length - 1){
				if(pt[0] < 0){
					sym = -1;
				}else{
					sym = 1;
				}
				ascdata.push(pt);
			}else{
				if((sym<0 && pt[0]<0) || (sym>0 && pt[0]>=0)){
					ascdata.push(pt);
				}else{
					dt.push(ascdata);
					sym = -1 * sym;
					ascdata = [pt];
				}
			}
		}
		for(let i=1; i<ary.length; i++){
			let pnt = ary[i];
			let gdpnt = gpsToGcj02(pnt.lat, pnt.lon);
			if(Math.abs(gdpnt.lon) > 180){
				if(gdpnt.lon < 0){
					gdpnt.lon = 360 + gdpnt.lon;
				}else{
					gdpnt.lon = 360 - gdpnt.lon;
				}
			}
			let pt = [gdpnt.lon, gdpnt.lat];
			if((sym<0 && pt[0]<0) || (sym>0 && pt[0]>=0)){
				ascdata.push(pt);
			}else{
				dt.push(ascdata);
				sym = -1 * sym;
				ascdata = [pt];
			}
		}
		dt.push(ascdata);
		return dt;
	}

	genPlanetData(planet, key){
		let ascdata = this.genAscData(planet.asc);
		let descdata = this.genAscData(planet.desc);
		let mcdata = this.genMcData(planet.mc);
		let icdata = this.genMcData(planet.ic);
		let res = {
			asc: ascdata,
			desc: descdata,
			mc: mcdata,
			ic: icdata,
			key: key,
		}
		return res;
	}

	genLinesData(rec){
		let res = {};
		for(let key in rec){
			let planet = rec[key]
			res[key] = this.genPlanetData(planet, key);
		}
		return res;
	}

	async requestAcg(params){
		const data = await request(`${Constants.ServerRoot}/location/acg`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]
		let lines = this.genLinesData(result);
		const st = {
			acgObj: lines,
		};

		this.setState(st);
	}

	genParams(){
		let fields = this.props.fields;
		let params = fieldsToParams(fields);
		return params;
	}

	onFieldsChange(values){
		if(this.props.onChange){
			let flds = this.props.onChange(values);
			let params = fieldsToParams(flds);
			this.requestAcg(params);
		}		
	}

	componentDidMount(){
		this.unmounted = false;

		let params = this.genParams();
		this.requestAcg(params);
	}

	componentWillUnmount(){
		this.unmounted = true;
	}

	render(){
		let acgObj = this.state.acgObj;
		let fields = this.props.fields;
		let height = this.props.height ? this.props.height : 760;
		height = height - 50;

		let dt = fields.date ? fields.date.value : null;

		let btnSateTitle = '显示卫星地图';
		if(this.state.useSatellite){
			btnSateTitle = '隐藏卫星地图'
		}

		return (
			<div>
				<Row>
					<Col span={16}>
						<DateTimeInfo  
							value={dt} 
						/>
					</Col>
					<Col span={4} style={{textAlign:'right', marginBottom: 10}}>
						<Button size='small' onClick={this.openDrawer}>行星线选择</Button>
					</Col>
				</Row>
				<Row>
					<Col span={24}>
						<ACG 
							value={acgObj} 
							fields={fields} 
							height={height} 
							lines={this.state.linesSet}
							useSatellite={this.state.useSatellite}
						/>
					</Col>
				</Row>

				<Drawer
					title='行星线选择'
					width={500}
					placement="left"
					onClose={this.closeDrawer}
					maskClosable={true}
					open={this.state.drawerVisible}
					style={{
						height: 'calc(100% - 0px)',
						overflow: 'auto',
						paddingBottom: 53,
						backgroundColor: 'transparent',
					}}        
				>
					<AstroLinesSelector 
						value={this.state.lines}
						onChange={this.changeLines}
					/>
				</Drawer>
			</div>
		);
	}
}

export default AstroAcg;
