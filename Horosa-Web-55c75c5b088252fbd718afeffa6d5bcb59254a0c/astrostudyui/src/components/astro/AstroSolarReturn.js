import { Component } from 'react';
import { Row, Col, Divider, Popover, Tabs, Select } from 'antd';
import AstroChart from './AstroChart';
import AstroDoubleChart from './AstroDoubleChart';
import AstroDirectionForm from './AstroDirectionForm';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { randomStr, convertToArray} from '../../utils/helper';
import styles from '../../css/styles.less';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildPredictiveSnapshotText, } from '../../utils/predictiveAiSnapshot';

const TabPane = Tabs.TabPane;
const Option = Select.Option;

class AstroSolarReturn extends Component{

	constructor(props) {
		super(props);

		this.unmounted = false;

		this.submit = this.submit.bind(this);
		this.fieldsChanged = this.fieldsChanged.bind(this);
		this.requestDirection = this.requestDirection.bind(this);
		this.genNatalParams = this.genNatalParams.bind(this);
		this.requestData = this.requestData.bind(this);
		this.genAspectDom = this.genAspectDom.bind(this);
		this.changeDblChartType = this.changeDblChartType.bind(this);

		let qryparam = this.genNatalParams(this.props.value);
		let dt = new DateTime();
		if(qryparam.datetime){
			dt = qryparam.datetime;
		}

		this.state = {
			params: {
				date: qryparam.date,
				time: qryparam.time,
				ad: qryparam.ad ? qryparam.ad : 1,
				zone: qryparam.zone,
				lon: qryparam.lon,
				lat: qryparam.lat,
				hsys: qryparam.hsys,
				tradition: qryparam.tradition,
				zodiacal: qryparam.zodiacal,
				datetime: dt,
				dirLat: qryparam.lat,
				dirLon: qryparam.lon,
				dirZone: qryparam.zone,
				gpsLat: qryparam.gpsLat,
				gpsLon: qryparam.gpsLon,
				tmType: 'y',
				nodeRetrograde: false,
				asporb: 1,
			},
			dirChart: null,
			inverse: true,
		}

		if(this.state.params.date){
			let dtstr = this.state.params.datetime.format('YYYY-MM-DD');
			if(dtstr === this.state.params.date){
				this.state.params.datetime.add(1, 'd');
			}
		}else{
			let tm = new DateTime();
			this.state.params.date = tm.format('YYYY-MM-DD');
			this.state.params.datetime.add(1, 'd');
		}


		if(this.props.hook){
			this.props.hook.fun = (chartObj)=>{
				if(this.unmounted || chartObj === undefined || chartObj === null){
					return;
				}
				let param = this.genNatalParams(chartObj);
				let params = {
					...this.state.params,
					...param,
				};
				this.setState({
					params: params
				}, ()=>{
					this.requestData();
				})
			};

		}
	}

	genNatalParams(chartObj){
		let qryparam = chartObj ? chartObj.params : {};
		let datetime = new DateTime();
		if(qryparam.birth){
			let parts = qryparam.birth.split(' ');
			qryparam.date = parts[0];
			qryparam.time = parts[1];
			let dtstr = datetime.format('yyyy') + parts[0].substr(4) + ' ' + parts[1];
			if(parts[1].length < 8){
				dtstr = dtstr + ':00';
			}
			datetime.parse(dtstr, 'yyyy-MM-dd HH:mm:ss');
		}
		let params = {
			date: qryparam.date,
			time: qryparam.time,
			datetime: datetime,
			ad: qryparam.ad ? qryparam.ad : 1,
			zone: qryparam.zone,
			lon: qryparam.lon,
			lat: qryparam.lat,
			gpsLon: qryparam.gpsLon,
			gpsLat: qryparam.gpsLat,
			hsys: qryparam.hsys,
			zodiacal: qryparam.zodiacal,
			tradition: qryparam.tradition,
		};
		return params;
	}

	requestData(){
		let params = {
			...this.state.params
		};
		params.datetime = params.datetime.format('YYYY-MM-DD HH:mm');
		params.dirZone = params.datetime.zone;
		if(this.props.value){
			this.requestDirection(params);
		}
	}

	async requestDirection(params){
		const data = await request(`${Constants.ServerRoot}/predict/solarreturn`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		let tm = new DateTime();
		let dt = tm.parse(params.datetime, 'YYYY-MM-DD HH:mm:ss');
		if(params.dirZone){
			dt.setZone(params.dirZone);
		}
		const st = {
			dirChart: result,
			params: {
				...params,
				datetime: dt,
			},
		};

		this.setState(st, ()=>{
			saveModuleAISnapshot('solarreturn', buildPredictiveSnapshotText(this.props.value, st.params, result), {
				module: 'solarreturn',
			});
		});
	}

	submit(values){
		let params = {
			...this.state.params
		};
		params.datetime = values.datetime.format('YYYY-MM-DD HH:mm:ss');
		params.dirLat = values.lat;
		params.dirLon = values.lon;
		if(values.zone){
			params.dirZone = values.zone;
		}

		this.requestDirection(params);
	}

	fieldsChanged(changedFields){
		let params = {
			...this.state.params
		}

		if(changedFields.datetime && changedFields.datetime.value){
			if(changedFields.datetime.value instanceof DateTime){
				params.datetime = changedFields.datetime.value;
			}else{
				params.datetime = changedFields.datetime.value.time;
			}
			params.ad = changedFields.datetime.value.ad;
		}
		if(changedFields.lat){
			params.dirLat = changedFields.lat.value;
		}
		if(changedFields.lon){
			params.dirLon = changedFields.lon.value;
		}
		if(changedFields.zone){
			params.dirZone = changedFields.zone.value;
		}
		if(changedFields.gpsLat){
			params.gpsLat = changedFields.gpsLat.value;
		}
		if(changedFields.gpsLon){
			params.gpsLon = changedFields.gpsLon.value;
		}
		if(changedFields.tmType){
			params.tmType = changedFields.tmType.value;
		}
		if(changedFields.asporb){
			params.asporb = changedFields.asporb.value;
		}
		if(changedFields.nodeRetrograde){
			params.nodeRetrograde = changedFields.nodeRetrograde.value;
		}

		this.setState({
			params: params
		});
	}

	genAspectDom(){
		if(this.state.dirChart === undefined || this.state.dirChart === null){
			return null;
		}

		let aspects = this.state.dirChart.chart.aspects;
		let divs = [];
		for(let i=0; i<aspects.length; i++){
			let obj = aspects[i];
			if(obj.objects.length === 0){
				continue;
			}
			let coldivs = [];
			let natalObjs = obj.objects;
			for(let j=0; j<natalObjs.length; j++){
				let natalObj = natalObjs[j];
				let asp = natalObj.aspect;
				let dom = (
					<div key={natalObj.natalId + j}>
						<span style={{fontFamily: AstroConst.AstroFont}}>&emsp;{AstroText.AstroMsg['Asp' + asp]}&nbsp;</span>
						<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[natalObj.natalId]}&nbsp;</span>
						<span style={{fontFamily: AstroConst.NormalFont}}>
							误差{Math.round(natalObj.delta * 1000)/1000}
						</span>
					</div>
				);
				coldivs.push(dom);
			}
			let domtitle = (
				<Col key={i} span={12}>
					<div>
						<span style={{fontFamily: AstroConst.NormalFont}}>行运&nbsp;</span>
						<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[obj.directId]}</span>
					</div>
					{coldivs}
				</Col>
			);
			divs.push(domtitle);
		}

		let rows = [];
		let cols = [];
		for(let i=0; i<divs.length; i++){
			if(i % 2 === 0){
				if(i > 0){
					let dom = (
						<div key={randomStr(8)}>
							<Row>
								{cols}
							</Row>
							<Divider dashed />
						</div>
					);	
					rows.push(dom);		
				}
				cols = [];
			}
			cols.push(divs[i]);
		}
		rows.push((
			<Row key={randomStr(8)}>
				{cols}
			</Row>
		));

		let dom = (
			<div>
				{rows}
			</div>
		);
		return dom;
	}

	changeDblChartType(value){
		this.setState({
			inverse: value,
		});
	}

	componentDidMount(){
		this.unmounted = false;
		this.requestData();
	}

	componentWillUnmount(){
		this.unmounted = true;
	}

	render(){
		let chartObj = {
			natualChart: this.props.value,
			dirChart: this.state.dirChart,
			inverse: this.state.inverse,
		};

		let rChart = null;
		if(this.state.dirChart && this.state.dirChart.dirChart){
			rChart = this.state.dirChart.dirChart;
		}

		let param = this.state.params;
		let tm = new DateTime();
		let fields = {
			startDate: {
				value: tm.parse(param.date, 'YYYY-MM-DD'),
				name: ['startDate'],
			},
			onlyYear: true,
			needZone: true,
			datetime: {
				value: param.datetime,
				name: ['datetime'],
			},
			lat: {
				value: param.dirLat,
				name: ['lat'],
			},
			lon: {
				value: param.dirLon,
				name: ['lon'],
			},
			gpsLat: {
				value: param.gpsLat,
				name: ['gpsLat'],
			},
			gpsLon: {
				value: param.gpsLon,
				name: ['gpsLon'],
			},
			tmType: {
				value: param.tmType,
				name: ['tmType'],
			},
			nodeRetrograde: {
				value: param.nodeRetrograde,
				name: ['nodeRetrograde'],
			},
			asporb: {
				value: param.asporb,
				name: ['asporb'],
			},
			tmTasporbype: {
				value: param.asporb,
				name: ['tmTasporbype'],
			},
			ad: {
				value: param.ad,
				name: ['ad'],
			},
		};
		let fieldsary = convertToArray(fields);

		let aspdom = this.genAspectDom();

		let height = this.props.height ? this.props.height : 760;
		let style = {
			height: (height-20) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};
		let chartHeight = height - 50;

		return (
			<div>
				<Row gutter={6}>
					<Col span={17}>
						<Tabs
							defaultActiveKey='singlechart' tabPosition='bottom'
							style={{ height: height }}						
						>
							<TabPane tab="返照盘" key="singlechart">
								<AstroChart value={rChart} 
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}
									height={chartHeight}
								/>
							</TabPane>
							<TabPane tab="原命盘" key="nautalchart">
								<AstroChart value={chartObj.natualChart} 
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}
									height={chartHeight}
								/>
							</TabPane>
							<TabPane tab="对比盘" key="doublechart">
								<AstroDoubleChart value={chartObj} 
									height={chartHeight}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}
									chartDisplay={this.props.chartDisplay}
								/>
							</TabPane>
						</Tabs>
					</Col>
					<Col span={7}>
						<div className={styles.scrollbar} style={style}>
							<Row>
								<Col span={24}>
									<AstroDirectionForm {...fields}
										fieldsAry={fieldsary}
										geo={true}
										ignoreNodeRetrograde={true}
										onFieldsChange={this.fieldsChanged}
										onSubmit={this.submit}
									/>
								</Col>
							</Row>
							<Row style={{marginTop: 50}}>
								<Col span={24}>
									<Select value={this.state.inverse} onChange={this.changeDblChartType} style={{width: '100%'}}>
										<Option value={true}>返照盘在内盘</Option>
										<Option value={false}>原命盘在内盘</Option>
									</Select>
								</Col>
							</Row>
							<Divider orientation="left">相位</Divider>
							{aspdom}
						</div>
					</Col>
				</Row>
			</div>
		)
	}
}

export default AstroSolarReturn;
