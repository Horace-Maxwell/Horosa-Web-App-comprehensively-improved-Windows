import { Component } from 'react';
import { Row, Col, Divider, Popover, } from 'antd';
import AstroDoubleChart from './AstroDoubleChart';
import AstroDirectionForm from './AstroDirectionForm';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import AstroObjectLabel from './AstroObjectLabel';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { randomStr, convertToArray} from '../../utils/helper';
import styles from '../../css/styles.less';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildPredictiveSnapshotText, } from '../../utils/predictiveAiSnapshot';

class AstroProfection extends Component{

	constructor(props) {
		super(props);
		this.unmounted = false;

		let qryparam = this.props.value ? this.props.value.params : {};
		if(qryparam.birth){
			let parts = qryparam.birth.split(' ');
			qryparam.date = parts[0];
			qryparam.time = parts[1];
		}

		let now = new DateTime();
		this.state = {
			params: {
				date: qryparam.date,
				time: qryparam.time,
				ad: qryparam.ad ? qryparam.ad : 1,
				zone: qryparam.zone,
				dirZone: qryparam.zone,
				lon: qryparam.lon,
				lat: qryparam.lat,
				gpsLat: qryparam.gpsLat,
				gpsLon: qryparam.gpsLon,
				hsys: qryparam.hsys,
				zodiacal: qryparam.zodiacal,
				tradition: qryparam.tradition,
				datetime: now,
				tmType: 'y',
				nodeRetrograde: false,
				asporb: 1,
			},
			dirChart: null,
		};

		if(this.state.params.date){
			let dtstr = this.state.params.datetime.format('YYYY-MM-DD');
			if(dtstr === this.state.params.date){
				this.state.params.datetime.add(1, 'd');
			}
		}else{
			this.state.params.date = now.format('YYYY-MM-DD');
			this.state.params.datetime.add(1, 'd');
		}

		this.submit = this.submit.bind(this);
		this.fieldsChanged = this.fieldsChanged.bind(this);
		this.requestDirection = this.requestDirection.bind(this);
		this.genNatalParams = this.genNatalParams.bind(this);
		this.requestData = this.requestData.bind(this);
		this.genAspectDom = this.genAspectDom.bind(this);

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
		if(qryparam.birth){
			let parts = qryparam.birth.split(' ');
			qryparam.date = parts[0];
			qryparam.time = parts[1];
		}
		let params = {
			date: qryparam.date,
			time: qryparam.time,
			ad: qryparam.ad ? qryparam.ad : 1,
			zone: qryparam.zone,
			dirZone: qryparam.zone,
			lon: qryparam.lon,
			lat: qryparam.lat,
			gpsLat: qryparam.gpsLat,
			gpsLon: qryparam.gpsLon,
			hsys: qryparam.hsys,
			tradition: qryparam.tradition,
			zodiacal: qryparam.zodiacal,
		};
		return params;
	}

	requestData(){
		let params = {
			...this.state.params
		};
		params.datetime = params.datetime.format('YYYY-MM-DD HH:mm');
		if(this.props.value){
			this.requestDirection(params);
		}
	}

	async requestDirection(params){
		const data = await request(`${Constants.ServerRoot}/predict/profection`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];
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
			saveModuleAISnapshot('profection', buildPredictiveSnapshotText(this.props.value, st.params, result), {
				module: 'profection',
			});
		});
	}

	submit(values){
		let params = {
			...this.state.params,
		};
		if(values.zone){
			params.dirZone = values.zone;
		}
		if(values.ad){
			params.ad = values.ad;
		}
		if(values.datetime){
			params.datetime = values.datetime.format('YYYY-MM-DD HH:mm:ss');
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
		if(changedFields.zone && changedFields.zone.value){
			params.dirZone = changedFields.zone.value;
		}
		if(changedFields.tmType && changedFields.tmType){
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
		const chartSources = [this.state.dirChart, this.props.value];

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
						<AstroObjectLabel id={natalObj.natalId} chartSources={chartSources} />&nbsp;
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
						<AstroObjectLabel id={obj.directId} chartSources={chartSources} />
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
		};

		let param = this.state.params;
		let tm = new DateTime();
		let fields = {
			startDate: {
				value: tm.parse(param.date, 'YYYY-MM-DD'),
				name: ['startDate'],
			},
			datetime: {
				value: param.datetime,
				name: ['datetime'],
			},
			lat: {
				value: param.lat,
				name: ['lat'],
			},
			lon: {
				value: param.lon,
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
			ad: {
				value: param.ad,
				name: ['ad'],
			},
			nodeRetrograde: {
				value: param.nodeRetrograde,
				name: ['nodeRetrograde'],
			},
			asporb: {
				value: param.asporb,
				name: ['asporb'],
			}
		};
		let fieldsary = convertToArray(fields);

		let aspdom = this.genAspectDom();

		let height = this.props.height ? this.props.height : 760;
		let style = {
			height: (height-20) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};


		return (
			<div>
				<Row gutter={6}>
					<Col span={17}>
						<AstroDoubleChart value={chartObj} 
							height={height}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							chartDisplay={this.props.chartDisplay}
						/>
					</Col>
					<Col span={7}>
						<div className={styles.scrollbar} style={style}>
							<Row>
								<Col span={24}>
									<AstroDirectionForm {...fields}
										fieldsAry={fieldsary}
										onFieldsChange={this.fieldsChanged}
										onSubmit={this.submit}
									/>
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

export default AstroProfection;
