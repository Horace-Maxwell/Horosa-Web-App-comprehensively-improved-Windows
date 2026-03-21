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
import { normalizeContentHeight } from '../../utils/layout';
import { computeSquareChartHostHeight } from '../../utils/chartViewportLayout';

const TabPane = Tabs.TabPane;
const Option = Select.Option;
const CHART_HOST_BOTTOM_GAP = 12;

class AstroChartMain extends Component{

	constructor(props) {
		super(props);
		this.state = {
			chartHostHeight: null,
		}

        this.tmHook = {
            getValue: null,
        }

		this.chartColumnHost = null;
		this.chartHost = null;
		this.chartResizeObserver = null;

		this.changeTime = this.changeTime.bind(this);
		this.changeZodiacal = this.changeZodiacal.bind(this);
		this.changeHsys = this.changeHsys.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.changeSouthChart = this.changeSouthChart.bind(this);
		this.captureChartColumnHost = this.captureChartColumnHost.bind(this);
		this.captureChartHost = this.captureChartHost.bind(this);
		this.observeChartHostResize = this.observeChartHostResize.bind(this);
		this.disconnectChartHostResize = this.disconnectChartHostResize.bind(this);
		this.syncChartHostHeight = this.syncChartHostHeight.bind(this);

		if(this.props.hook){
			// Keep hook registration for compatibility; no extra fetch is needed here.
			this.props.hook.fun = ()=>{};
		}

	}

	changeTime(tm){
		if(this.props.onChange){
			this.props.onChange({
				tm: tm.time,
				ad: tm.ad,
				zone: tm.time.zone,
				confirmed: !!tm.confirmed,
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

	componentDidMount(){
		window.addEventListener('resize', this.syncChartHostHeight);
		this.observeChartHostResize();
		this.syncChartHostHeight();
	}

	componentDidUpdate(prevProps){
		if(prevProps.height !== this.props.height || prevProps.fitChartToViewport !== this.props.fitChartToViewport){
			this.syncChartHostHeight();
		}
	}

	componentWillUnmount(){
		window.removeEventListener('resize', this.syncChartHostHeight);
		this.disconnectChartHostResize();
	}

	captureChartColumnHost(node){
		this.chartColumnHost = node || null;
		this.observeChartHostResize();
		this.syncChartHostHeight();
	}

	captureChartHost(node){
		this.chartHost = node || null;
		this.observeChartHostResize();
		this.syncChartHostHeight();
	}

	disconnectChartHostResize(){
		if(this.chartResizeObserver){
			this.chartResizeObserver.disconnect();
			this.chartResizeObserver = null;
		}
	}

	observeChartHostResize(){
		this.disconnectChartHostResize();
		if(typeof ResizeObserver === 'undefined'){
			return;
		}
		const targets = [this.chartColumnHost, this.chartHost].filter(Boolean);
		if(targets.length === 0){
			return;
		}
		this.chartResizeObserver = new ResizeObserver(()=>{
			this.syncChartHostHeight();
		});
		targets.forEach((node)=>{
			this.chartResizeObserver.observe(node);
		});
	}

	syncChartHostHeight(){
		if(!this.props.fitChartToViewport){
			if(this.state.chartHostHeight !== null){
				this.setState({ chartHostHeight: null });
			}
			return;
		}
		const host = this.chartHost || this.chartColumnHost;
		if(!host){
			return;
		}
		const containerWidth = host.clientWidth || 0;
		const containerHeight = this.chartColumnHost ? this.chartColumnHost.clientHeight : host.clientHeight || 0;
		const nextHeight = computeSquareChartHostHeight(containerWidth, containerHeight, {
			bottomGap: this.props.chartBottomGap !== undefined ? this.props.chartBottomGap : CHART_HOST_BOTTOM_GAP,
		});
		if(Math.abs((this.state.chartHostHeight || 0) - nextHeight) >= 2){
			this.setState({
				chartHostHeight: nextHeight,
			});
		}
	}

	render(){
		let chartObj = this.props.value;
		let fields = this.props.fields;
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

		let height = normalizeContentHeight(this.props.height);
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
		const fitChartToViewport = !!this.props.fitChartToViewport;
		const chartHostHeight = fitChartToViewport
			? (this.state.chartHostHeight || computeSquareChartHostHeight(0, height, {
				bottomGap: this.props.chartBottomGap !== undefined ? this.props.chartBottomGap : CHART_HOST_BOTTOM_GAP,
			}))
			: height;

		return (
			<div style={{ height, maxHeight: height, overflow: 'hidden' }}>
				<Row gutter={6} style={{ height: '100%' }}>
					<Col span={17} style={{ height: '100%', overflow: 'hidden', minHeight: 0 }}>
						<div ref={this.captureChartColumnHost} style={{ height: '100%', overflow: 'hidden' }}>
							<div
								ref={this.captureChartHost}
								style={{
									height: chartHostHeight,
									maxHeight: '100%',
									overflow: 'hidden',
								}}
							>
								<AstroChart value={chartObj} 
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}
									showAstroMeaning={this.props.showAstroMeaning}
									backgroundColor='aliceblue' 
									height='100%'
								/>
							</div>
						</div>
					</Col>
					<Col span={7} style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
						</Row>
						<Tabs defaultActiveKey="1" tabPosition='top' className='horosaFillTabs' style={{ flex: '1 1 auto', minHeight: 0 }}>
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
