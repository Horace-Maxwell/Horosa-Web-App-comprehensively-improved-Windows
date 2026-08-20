import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Row, Col, Divider } from 'antd';
import AstroChart from '../astro/AstroChart';
import LatInput from '../astro/LatInput';
import LonInput from '../astro/LonInput';
import GeoCoordModal from '../amap/GeoCoordModal';
import {
	XQButton as Button,
	XQInput as Input,
	XQSelect as Select,
	XQTabs as Tabs,
} from '../xq-ui';
import * as AstroHelper from '../astro/AstroHelper';
import { resolveGeoZone } from '../../utils/timezone';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { randomStr, randomNum, gcj02ToGps,} from '../../utils/helper';
import { buildMeaningTipByCategory, } from '../astro/AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from '../astro/AstroMeaningPopover';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import styles from '../../css/styles.less';
import DateTime from '../comp/DateTime';
import { classicalBackendOverrides, classicalGlobalValue } from '../../utils/classicalChartGlobals';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';

const TabPane = Tabs.TabPane;
const Option = Select.Option;

const ALL_PLANETS = [
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, 
	AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN, 
	AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO,
	AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, AstroConst.DARKMOON, AstroConst.PURPLE_CLOUDS
];

const TRAD_PLANETS = [
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, 
	AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN, 
	AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, AstroConst.DARKMOON, AstroConst.PURPLE_CLOUDS
];

function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		return `${AstroText.AstroMsg[id]}`;
	}
	return `${id}`;
}

function splitDegree(degree){
	let d = Number(degree);
	if(Number.isNaN(d)){
		return [0, 0];
	}
	if(d < 0){
		d += 360;
	}
	const deg = Math.floor(d % 30);
	const min = Math.floor(((d % 30) - deg) * 60);
	return [deg, min];
}

export function buildChartObjectLines(chartObj){
	const lines = [];
	const chart = chartObj && chartObj.chart ? chartObj.chart : null;
	if(!chart){
		return lines;
	}
	const houses = chart.houses || [];
	const objects = chart.objects || [];
	if(houses.length === 0){
		return lines;
	}
	lines.push('| 宫位 | 星体 | 度 | 座 | 分 |');
	lines.push('| --- | --- | --- | --- | --- |');
	houses.forEach((house)=>{
		const inHouse = objects.filter((obj)=>obj.house === house.id);
		if(inHouse.length === 0){
			lines.push(`| ${msg(house.id)} | 无 | — | — | — |`);
			return;
		}
		inHouse.forEach((obj, k)=>{
			const sd = splitDegree(obj.signlon);
			lines.push(`| ${k === 0 ? msg(house.id) : '—'} | ${msg(obj.id)} | ${sd[0]} | ${msg(obj.sign)} | ${sd[1]} |`);
		});
	});
	return lines;
}

function buildDiceSnapshotText(params, result, text){
	const lines = [];
	const diceChart = result && result.diceChart ? result.diceChart : null;
	const skyChart = result && result.chart ? result.chart : null;

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);
	lines.push(`传统模式：${params.tradition ? '无三王星' : '含三王星'}`);
	lines.push(`问题：${text || '未填写'}`);

	lines.push('');
	lines.push('[骰子结果]');
	lines.push(`行星：${msg(result ? result.planet : null)}`);
	lines.push(`星座：${msg(result ? result.sign : null)}`);
	lines.push(`宫位：${msg('House' + ((result && result.house !== undefined && result.house !== null) ? (result.house + 1) : ''))}`);

	lines.push('');
	lines.push('[骰子盘宫位与星体]');
	lines.push(...buildChartObjectLines(diceChart));

	lines.push('');
	lines.push('[天象盘宫位与星体]');
	lines.push(...buildChartObjectLines(skyChart));

	return lines.join('\n');
}


class DiceMain extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}


	constructor(props) {
		super(props);

		this.unmounted = false;

		this.submit = this.submit.bind(this);
		this.requestDirection = this.requestDirection.bind(this);
		this.genParams = this.genParams.bind(this);
		this.requestData = this.requestData.bind(this);
		this.genZone = this.genZone.bind(this);
		this.changeZone = this.changeZone.bind(this);
		this.changeTradition = this.changeTradition.bind(this);
		this.changeText = this.changeText.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.changeLat = this.changeLat.bind(this);
		this.changeLon = this.changeLon.bind(this);
			this.genResultDom = this.genResultDom.bind(this);
			this.getChartDisplay = this.getChartDisplay.bind(this);
			this.getPlanetsDisplay = this.getPlanetsDisplay.bind(this);
			this.showMeaning = this.showMeaning.bind(this);
			this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

			// AI 导出实时取数:requestDirection 的 params/result 是请求局部量(date/time 来自当次
			// new DateTime(),从不入 state),refresh 时无法从 state 字节等价重建 → 留存最近一次成功
			// 起盘的构建入参,refresh 监听据此即时重建快照(显示什么就导出什么)。
			this._lastDiceSnapshotInput = null;

		let fld = this.props.fields;
		this.state = {
			zone: fld.zone.value,
			lat: fld.lat.value,
			lon: fld.lon.value,
			gpsLat: fld.gpsLat.value,
			gpsLon: fld.gpsLon.value,
			hsys: fld.hsys.value,
			zodiacal: fld.zodiacal.value, siderealAyanamsa: fld.siderealAyanamsa ? fld.siderealAyanamsa.value : '',
			tradition: fld.tradition.value,
			virtualPointReceiveAsp: fld.virtualPointReceiveAsp.value,
			txt: null,
			diceChart: null,
			chart: null,
			planet: null,
			sign: null,
			house: null,
			// horosa_freeze_subtabs_v1:中栏「骰子盘/天象盘」原为非受控 Tabs,无从判激活。
			// 改受控(初值=原 defaultActiveKey,onChange 记进 state)—— 切页行为逐字不变,
			// 只是让 FreezeSubTab 拿得到 active。
			chartTab: 'touzichart',
		}

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				let fld = fields;
				this.setState({
					zone: fld ? fld.zone.value : this.state.zone,
					lat: fld ? fld.lat.value : this.state.lat,
					lon: fld ? fld.lon.value : this.state.lon,
					gpsLat: fld ? fld.gpsLat.value : this.state.gpsLat,
					gpsLon: fld ? fld.gpsLon.value : this.state.gpsLon,
					hsys: fld ? fld.hsys.value: this.state.hsys,
					zodiacal: fld ? fld.zodiacal.value: this.state.zodiacal, siderealAyanamsa: fld ? (fld.siderealAyanamsa ? fld.siderealAyanamsa.value : '') : this.state.siderealAyanamsa,
					tradition: fld ? fld.tradition.value: this.state.tradition,
					virtualPointReceiveAsp: fld ? fld.virtualPointReceiveAsp.value: this.state.virtualPointReceiveAsp,
				});
			};

		}
	}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	genParams(){
		let datetime = new DateTime();
		let ran = randomNum(3);
		let ranPlanet = ran % ALL_PLANETS.length;
		let planet = ALL_PLANETS[ranPlanet];
		if(this.state.tradition){
			ranPlanet = ran % TRAD_PLANETS.length;
			planet = TRAD_PLANETS[ranPlanet];
		}
		let ranSign = randomNum(3) % 12;
		let ranHouse = randomNum(3) % 12;
		let params = {
			date: datetime.format('yyyy-MM-dd'),
			time: datetime.format('HH:mm:ss'),
			ad: datetime.ad,
			zone: datetime.zone,
			lon: this.state.lon,
			lat: this.state.lat,
			gpsLon: this.state.gpsLon,
			gpsLat: this.state.gpsLat,
			hsys: this.state.hsys,
			zodiacal: this.state.zodiacal, siderealAyanamsa: this.state.siderealAyanamsa,
			tradition: this.state.tradition,
			virtualPointReceiveAsp: this.state.virtualPointReceiveAsp,
			sign: AstroConst.LIST_SIGNS[ranSign],
			house: ranHouse,
			planet: planet,
			// [SURF-5] 古典设置单源接入(骰子盘无 fields,直读全局仓;/predict/dice 装饰器统一 push)。
			...classicalBackendOverrides(classicalGlobalValue),
		};
		return params;
	}

	requestData(){
		let params = this.genParams();
		this.requestDirection(params);
	}

	async requestDirection(params){
		// [SURF-R5d] 连掷乱序防:每掷=独立随机占,快速连掷两在途,先掷后回会覆盖后掷(显示与
		// _lastDiceSnapshotInput/AI 快照全取旧占)。代际失配即弃+unmounted 守卫补齐。
		const seq = ++this._diceSeq || (this._diceSeq = 1);
		const data = await request(`${Constants.ServerRoot}/predict/dice`, {
			body: JSON.stringify(params),
		});
		if(this.unmounted || seq !== this._diceSeq){ return; }
		if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
		const result = data[Constants.ResultKey];

		const st = {
			diceChart: result.diceChart,
			chart: result.chart,
			house: result.house,
			planet: result.planet,
			sign: result.sign,
		};

		// horosa_panel_ready_v1:diceChart/chart/house/planet/sign 同批落定 = 骰子盘(中栏)与
		// 星体表(右栏)画完的那一次 setState。本处原无回调 —— 补一个只为埋点,不改任何既有语义。
		this.setState(st, ()=>{ markPanelReady('auxchart'); });
		const diceTxt = this.state.txt;
		this._lastDiceSnapshotInput = { params, result, text: diceTxt };
		saveModuleAISnapshotLazy('otherbu', ()=>buildDiceSnapshotText(params, result, diceTxt), {
			date: params.date,
			time: params.time,
			zone: params.zone,
			lon: params.lon,
			lat: params.lat,
		});
	}

	submit(){
		this.requestData();
	}


	genZone(){
		let dom = [(
			<Option key="+00:00" value="+00:00">东0区</Option>
		),(
			<Option key="+01:00" value="+01:00">东1区</Option>
		),(
			<Option key="+02:00" value="+02:00">东2区</Option>
		),(
			<Option key="+03:00" value="+03:00">东3区</Option>
		),(
			<Option key="+04:00" value="+04:00">东4区</Option>
		),(
			<Option key="+04:30" value="+04:30">东4.5</Option>
		),(
			<Option key="+05:00" value="+05:00">东5区</Option>
		),(
			<Option key="+05:30" value="+05:30">东5.5</Option>
		),(
			<Option key="+06:00" value="+06:00">东6区</Option>
		),(
			<Option key="+07:00" value="+07:00">东7区</Option>
		),(
			<Option key="+08:00" value="+08:00">东8区</Option>
		),(
			<Option key="+09:00" value="+09:00">东9区</Option>
		),(
			<Option key="+10:00" value="+10:00">东10</Option>
		),(
			<Option key="+11:00" value="+11:00">东11</Option>
		),(
			<Option key="+12:00" value="+12:00">东12</Option>
		),(
			<Option key="-01:00" value="-01:00">西1区</Option>
		),(
			<Option key="-02:00" value="-02:00">西2区</Option>
		),(
			<Option key="-03:00" value="-03:00">西3区</Option>
		),(
			<Option key="-04:00" value="-04:00">西4区</Option>
		),(
			<Option key="-04:30" value="-04:30">西4.5</Option>
		),(
			<Option key="-05:00" value="-05:00">西5区</Option>
		),(
			<Option key="-05:30" value="-05:30">西5.5</Option>
		),(
			<Option key="-06:00" value="-06:00">西6区</Option>
		),(
			<Option key="-07:00" value="-07:00">西7区</Option>
		),(
			<Option key="-07:30" value="-07:30">西7.5</Option>
		),(
			<Option key="-08:00" value="-08:00">西8区</Option>
		),(
			<Option key="-09:00" value="-09:00">西9区</Option>
		),(
			<Option key="-10:00" value="-10:00">西10</Option>
		),(
			<Option key="-11:00" value="-11:00">西11</Option>
		)];

		return dom;
	}

    changeGeo(geo){
        let gps = {
            lat: geo.gpsLat,
            lon: geo.gpsLng,
        };
        let latdeg = AstroHelper.splitDegree(gps.lat);
        let londeg = AstroHelper.splitDegree(gps.lon);
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

        // 选地点 → 时区自动校正(骰子按此刻起盘、以今天作 DST 锚点;手动改过时区则沿用 geo.zone)
        const nextZone = resolveGeoZone(geo, null);

        this.setState({
            zone: nextZone || this.state.zone,
            lat: lat,
			lon: lon,
			gpsLat: gps.lat,
			gpsLon: gps.lon,			
        });       
	}

	changeLat(value){
		let gdlat = AstroHelper.convertLatStrToDegree(value);
		let gdlon = AstroHelper.convertLonStrToDegree(this.state.lon);
		let gps = gcj02ToGps(gdlat, gdlon);

		this.setState({
			lat: value,
			gpsLat: gps.lat,
			gpsLon: gps.lon
		});
	}
	
	changeLon(value){
		let gdlat = AstroHelper.convertLatStrToDegree(this.state.lat);
		let gdlon = AstroHelper.convertLonStrToDegree(value);
		let gps = gcj02ToGps(gdlat, gdlon);
		this.setState({
			lon: value,
			gpsLat: gps.lat,
			gpsLon: gps.lon
		});
	}
	
	changeTradition(value){
		this.setState({
			tradition: value,
		});
	}

	changeZone(value){
		this.setState({
			zone: value,
		});
	}

	changeText(e){
		this.setState({
			txt: e.target.value,
		});
	}

	genResultDom(){
		let dom = null;
		let resstyle = {
			textAlign: 'center', 
			fontFamily: AstroConst.AstroFont,
			fontSize: 'xx-large'
		}
		let housestyle = {
			fontFamily: AstroConst.AstroFont,
			fontSize: 'x-large',
			paddingTop: 6,
		}
		let house = 'House' + (this.state.house + 1);
		if(this.state.sign === null){
			house = null;
		}
		dom = (
			<div>
				<Row>
					<Col span={24} style={{textAlign: 'center', fontSize: 'xx-large'}}>
						<span>{this.state.txt}</span>
					</Col>									
				</Row>
					<Row>
						<Col span={6} style={resstyle}>
							{wrapWithMeaning(
								<span>{AstroText.AstroMsg[this.state.planet]}</span>,
								this.showMeaning(),
								buildMeaningTipByCategory('planet', this.state.planet)
							)}
						</Col>
						<Col span={6} style={resstyle}>
							{wrapWithMeaning(
								<span>{AstroText.AstroMsg[this.state.sign]}</span>,
								this.showMeaning(),
								buildMeaningTipByCategory('sign', this.state.sign)
							)}
						</Col>
						<Col span={12} style={housestyle}>
							{wrapWithMeaning(
								<span>{AstroText.AstroMsg[house]}</span>,
								this.showMeaning(),
								buildMeaningTipByCategory('house', house)
							)}
						</Col>
					</Row>
			</div>
		);
		return dom;
	}

	getChartDisplay(){
		let chartDisp = this.props.chartDisplay.slice(0);
		return chartDisp;
	}

	getPlanetsDisplay(){
		let planetDisp = new Set();
		if(this.state.diceChart){
			for(let i=0; i<this.state.diceChart.chart.objects.length; i++){
				let obj = this.state.diceChart.chart.objects[i];
				planetDisp.add(obj.id);
			}
		}
		for(let i=0; i<this.props.planetDisplay.length; i++){
			let id = this.props.planetDisplay[i];
			planetDisp.add(id);
		}
		if(this.state.tradition){
			planetDisp.delete(AstroConst.URANUS);
			planetDisp.delete(AstroConst.NEPTUNE);
			planetDisp.delete(AstroConst.PLUTO);
		}else{
			planetDisp.add(AstroConst.URANUS);
			planetDisp.add(AstroConst.NEPTUNE);
			planetDisp.add(AstroConst.PLUTO);
		}
		AstroConst.LIST_SMALL_PLANETS.map((item, idx)=>{
			planetDisp.delete(item);
			return null;
		});
		planetDisp.delete(AstroConst.MC);
		planetDisp.delete(AstroConst.ASC);
		planetDisp.delete(AstroConst.IC);
		planetDisp.delete(AstroConst.DESC);

		let res = [];
		for(let planet of planetDisp){
			res.push(planet);
		}
		return res;
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用最近一次起盘的构建入参即时重建快照
	// 并回填,保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存
	// 可能为空,此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'otherbu'){
			return;
		}
		const last = this._lastDiceSnapshotInput;
		if(!last || !last.result){
			return;
		}
		let text = '';
		try{
			text = `${buildDiceSnapshotText(last.params, last.result, last.text) || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('otherbu', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}


	componentDidMount(){
		this.unmounted = false;
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}


	render(){
		let height = this.props.height ? this.props.height : 760;
		let style = {
			height: (height-20) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};
		let chartHeight = height - 50;

		let zoneopt = this.genZone();
		let resdom = this.genResultDom();

		let chartDisp = this.getChartDisplay();
		let planetDisp = this.getPlanetsDisplay();		

		let keyPlanets = [];
		if(this.state.planet){
			keyPlanets.push(this.state.planet)
		}

		return (
			<div className='horosa-dice-page'>
				<Row gutter={14} className='horosa-dice-layout'>
					<Col span={17} className='horosa-dice-chart-panel'>
						{/* horosa_freeze_subtabs_v1:两张 AstroChart 是本页最重的两块;非激活那张此前每次重渲都跟着重画一遍。
						    冻结≠卸载,切回即拿最新 state 立刻重画。Tabs 原为非受控 → 改受控(初值=原 defaultActiveKey,
						    onChange 记进 state),切页行为逐字不变,只是让 FreezeSubTab 拿得到 active。 */}
						<Tabs
							activeKey={this.state.chartTab}
							onChange={(k)=>this.setState({ chartTab: k })}
							defaultActiveKey='touzichart' tabPosition='bottom'
							style={{ height: height }}						
						>
								<TabPane tab="骰子盘" key="touzichart">
									<FreezeSubTab active={this.state.chartTab === 'touzichart'}>{() => (
										<AstroChart value={this.state.diceChart}
											wheelArt={this.props.wheelArt}
											keyPlanets={keyPlanets}
											chartDisplay={chartDisp}
											planetDisplay={planetDisp}
											lotsDisplay={this.props.lotsDisplay}
											showAstroMeaning={this.props.showAstroMeaning}
											height={chartHeight}
										/>
									)}</FreezeSubTab>
								</TabPane>
								<TabPane tab="天象盘" key="chart">
									<FreezeSubTab active={this.state.chartTab === 'chart'}>{() => (
										<AstroChart value={this.state.chart}
											wheelArt={this.props.wheelArt}
											chartDisplay={this.props.chartDisplay}
											planetDisplay={this.props.planetDisplay}
											lotsDisplay={this.props.lotsDisplay}
											showAstroMeaning={this.props.showAstroMeaning}
											height={chartHeight}
										/>
									)}</FreezeSubTab>
								</TabPane>
						</Tabs>
					</Col>
					<Col span={7} className='horosa-dice-inspector-panel'>
						<div className={styles.scrollbar} style={style}>
							<Row>
								<Col span={24}>
									<LatInput value={this.state.lat} oneRow={true} onChange={this.changeLat} size='small' />
								</Col>
								<Col span={24}>
									<LonInput value={this.state.lon} oneRow={true} onChange={this.changeLon} size='small' />
								</Col>
							</Row>
							<Row gutter={6}>
								<Col span={12}>
									<GeoCoordModal 
										onOk={this.changeGeo}
										lat={this.state.gpsLat} lng={this.state.gpsLon}
									>
										<Button size='small' style={{width: '100%'}}>经纬度选择</Button>
									</GeoCoordModal>								
								</Col>
								<Col span={12}>
									<Select value={this.state.zone} onChange={this.changeZone} size='small' style={{width: '100%'}}>
										{zoneopt}
									</Select>
								</Col>
							</Row>
							<Row gutter={6}>
								<Col span={24}>
									<Input value={this.state.txt} onChange={this.changeText} size='small'
										placeholder='内容' allowClear style={{width: '100%'}} />
								</Col>
							</Row>
							<Row gutter={6}>
								<Col span={12}>
									<Select value={this.state.tradition} onChange={this.changeTradition} style={{width: '100%'}} size='small'>
										<Option value={0}>含三王星</Option>
										<Option value={1}>无三王星</Option>
									</Select>
								</Col>
								<Col span={12}>
									<Button type="primary" size='small' onClick={this.submit}>见证奇迹</Button>
								</Col>
							</Row>
							<Divider orientation="left">骰子结果</Divider>
							{resdom}
						</div>
					</Col>
				</Row>
			</div>
		)
	}
}

export default DiceMain;
