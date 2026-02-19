import { Component } from 'react';
import { Row, Col, Tabs, Select, Button } from 'antd';
import AstroChart from './AstroChart';
import AstroInfo from './AstroInfo';
import AstroAspect from './AstroAspect';
import AstroPlanet from './AstroPlanet';
import AstroLots from './AstroLots';
import AstroPredictPlanetSign from './AstroPredictPlanetSign';
import PlusMinusTime from './PlusMinusTime';
import DateTime from '../comp/DateTime';
import GeoCoordModal from '../amap/GeoCoordModal';
import { convertLatToStr, convertLonToStr} from './AstroHelper';
import { getHousesOption } from '../comp/CompHelper'

const TabPane = Tabs.TabPane;
const Option = Select.Option;

class AstroChartMain extends Component{

	constructor(props) {
		super(props);
		this.state = {

		}

        this.tmHook = {
            getValue: null,
        }

		this.changeTime = this.changeTime.bind(this);
		this.changeZodiacal = this.changeZodiacal.bind(this);
		this.changeHsys = this.changeHsys.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.changeSouthChart = this.changeSouthChart.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.props.onChange){
					this.props.onChange({
						nohook: true,
					});
				}
			};
		}

	}

	changeTime(tm){
		if(this.props.onChange){
			this.props.onChange({
				tm: tm.time,
				ad: tm.ad,
				zone: tm.time.zone,
			});
		}
	}

	changeZodiacal(val){
		if(this.props.onChange){
			if(this.tmHook.getValue){
				let tm = this.tmHook.getValue().value;
				this.props.onChange({
					zodiacal: val,
					tm: tm,
					ad: tm.ad,
					zone: tm.zone,
				});	
			}else{
				this.props.onChange({
					zodiacal: val,
				});	
			}
	
		}
	}

	changeHsys(val){
		if(this.props.onChange){
			if(this.tmHook.getValue){
				let tm = this.tmHook.getValue().value;
				this.props.onChange({
					hsys: val,
					tm: tm,
					ad: tm.ad,
					zone: tm.zone,
				});	
			}else{
				this.props.onChange({
					hsys: val,
				});	
			}
		}
	}

	changeSouthChart(val){
		if(this.props.fields.lat === undefined || this.props.fields.lat === null){
			return;
		}
		let lat = this.props.fields.lat.value;
		if(lat.toLowerCase().indexOf('n') >= 0){
			return;
		}

		if(this.props.onChange){
			if(this.tmHook.getValue){
				let tm = this.tmHook.getValue().value;
				this.props.onChange({
					southchart: val,
					tm: tm,
					ad: tm.ad,
					zone: tm.zone,
				});		
			}else{
				this.props.onChange({
					southchart: val,
				});	
			}
		}
	}

	changeGeo(rec){
		if(this.props.onChange){
			if(this.tmHook.getValue){
				let tm = this.tmHook.getValue().value;
				this.props.onChange({
					lon: convertLonToStr(rec.lng),
					lat: convertLatToStr(rec.lat),
					gpsLon: rec.gpsLng,
					gpsLat: rec.gpsLat,
					tm: tm,
					ad: tm.ad,
					zone: tm.zone,
				});	
			}else{
				this.props.onChange({
					lon: convertLonToStr(rec.lng),
					lat: convertLatToStr(rec.lat),
					gpsLon: rec.gpsLng,
					gpsLat: rec.gpsLat
				});	
			}
		}
	}

	render(){
		let chartObj = this.props.value;
		let fields = this.props.fields;
		const perf = this.props.chartPerf || {};
		const perfSourceMap = {
			network: '网络',
			'mem-hit': '内存缓存',
			'state-hit': '状态缓存',
		};
		const perfSource = perfSourceMap[perf.source] || '--';
		const perfTotal = Number.isFinite(perf.totalMs) ? `${perf.totalMs}ms` : '--';
		const perfChart = Number.isFinite(perf.chartMs) ? `${perf.chartMs}ms` : '--';
		const perfCache = perf.cacheHit ? '是' : '否';
		let dt = new DateTime();
		if(chartObj){
			dt.setZone(chartObj.params.zone);
		}else{
			dt.setZone(fields.zone.value);
		}
		let dtstr = chartObj ? chartObj.params.birth : null;
		if(dtstr){
			if(dtstr.length > 11){
				dt.parse(dtstr, 'YYYY-MM-DD HH:mm:ss');
			}else{
				dt.parse(dtstr, 'YYYY-MM-DD');
			}
		}	

		let height = this.props.height ? this.props.height : 760;
		let tabHeight = height - 100;

		let showzodical = true;
		let showhsys = true;
		let showdateselector = true;
		let showlots = true;
		let indiahsys = false;
		if(this.props.hidezodiacal){
			showzodical = false
		}
		if(this.props.hidehsys){
			showhsys = false;
		}
		if(this.props.hidedateselector){
			showdateselector = false;
			tabHeight = tabHeight + 100;
		}
		if(this.props.hidelots){
			showlots = false;
		}
		if(this.props.indiahsys){
			indiahsys = true;
			showhsys = false;
		}

		return (
			<div>
				<Row gutter={6}>
					<Col span={17}>
						<AstroChart value={chartObj} 
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							backgroundColor='aliceblue' 
							height={height}
						/>
					</Col>
					<Col span={7}>
						<Row gutter={0}>
							{
								showdateselector && (
									<Col span={24}>
										<PlusMinusTime value={dt} onChange={this.changeTime} hook={this.tmHook} />
									</Col>	
								)
							}
							{
								showzodical && (
									<Col span={7}>
										<Select 
											style={{width: '100%'}}
											onChange={this.changeZodiacal}
											value={this.props.fields.zodiacal.value} size='small'>
											<Option value={0}>回归黄道</Option>
											<Option value={1}>恒星黄道</Option>
										</Select>
									</Col>
	
								)
							}
							{
								showhsys && (
									<Col span={10}>
										<Select style={{width: '100%'}}
											onChange={this.changeHsys}
											value={this.props.fields.hsys.value} 
											size='small'>
											{ getHousesOption() }
										</Select>
									</Col>	
								)
							}
							{
								showhsys && (
									<Col span={7}>
										<Select style={{width: '100%'}}
											onChange={this.changeSouthChart}
											value={this.props.fields.southchart.value} 
											size='small'>
											<Option value={0}>天文星座</Option>
											<Option value={1}>涵义星座</Option>
										</Select>
									</Col>	
								)
							}
							{
								indiahsys && (
									<Col span={24}>
										<Select style={{width:196}}
											onChange={this.changeHsys}
											value={this.props.fields.hsys.value} 
											size='small'>
											<Option value={0}>整宫制</Option>
											<Option value={5}>Vehlow Equal</Option>
										</Select>
									</Col>	
								)
							}
							{
								showdateselector && (
									<Col span={24}>
										<Row>
										<Col span={8}>
											<GeoCoordModal 
												onOk={this.changeGeo}
												lat={this.props.fields.gpsLat.value} lng={this.props.fields.gpsLon.value}
											>
												<Button size='small' style={{width:'100%'}}>经纬度选择</Button>
											</GeoCoordModal>
										</Col>
										<Col span={16} style={{textAlign: 'center'}}>
											<span style={{width:'100%'}}>{this.props.fields.lon.value + ' ' + this.props.fields.lat.value}</span>
										</Col>
										</Row>
									</Col>
								)
							}
							<Col span={24}>
								<div style={{ marginTop: 4, padding: '4px 6px', border: '1px solid #e8e8e8', borderRadius: 4, background: '#fafafa', fontSize: 12, lineHeight: '18px' }}>
									<div>性能: 来源 {perfSource} | 总耗时 {perfTotal}</div>
									<div>排盘耗时 {perfChart} | 命中缓存 {perfCache}</div>
								</div>
							</Col>
						</Row>
						<Tabs defaultActiveKey="1" tabPosition='top'>
							<TabPane tab="信息" key="1">
								<AstroInfo height={tabHeight}
									value={chartObj} fields={fields}
									planetDisplay={this.props.planetDisplay}
								/>
							</TabPane>
							<TabPane tab="相位" key="2">
								<AstroAspect 
									value={chartObj} height={tabHeight}
									lotsDisplay={this.props.lotsDisplay}
									planetDisplay={this.props.planetDisplay}
								/>
							</TabPane>
							<TabPane tab="行星" key="3">
								<AstroPlanet value={chartObj} height={tabHeight}/>
							</TabPane>
							{
								showlots && (
									<TabPane tab="希腊点" key="4">
										<AstroLots value={chartObj} height={tabHeight}/>
									</TabPane>	
								)
							}
							<TabPane tab="可能性" key="5">
								<AstroPredictPlanetSign height={tabHeight}
									value={chartObj} fields={fields}
									planetDisplay={this.props.planetDisplay}
								/>
							</TabPane>
						</Tabs>
					</Col>
				</Row>

			</div>
		);
	}

}

export default AstroChartMain;
