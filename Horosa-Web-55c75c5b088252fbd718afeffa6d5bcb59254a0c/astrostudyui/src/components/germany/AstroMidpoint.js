import { Component } from 'react';
import { Row, Col, Tabs, Select } from 'antd';
import MidpointMain from './MidpointMain';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { randomStr, } from '../../utils/helper';
import { buildAstroSnapshotContent, } from '../../utils/astroAiSnapshot';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import styles from '../../css/styles.less';

function fieldsToParams(fields){
	const params = {
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.zone.value,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: fields.hsys.value,
		zodiacal: fields.zodiacal.value,
		tradition: fields.tradition.value,
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: 0,
		name: fields.name.value,
		pos: fields.pos.value,
	};

	return params;
}

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

function round3(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '';
	}
	return `${Math.round(Number(val) * 1000) / 1000}`;
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

function aspectText(asp){
	const n = Number(asp);
	if(Number.isNaN(n)){
		return `${asp || ''}`;
	}
	return `${n}˚`;
}

function formatSignDegree(sign, signlon){
	const sd = splitDegree(signlon);
	return `${sd[0]}˚${msg(sign)}${sd[1]}分`;
}

function pickAstroSections(text, sectionNames){
	const wanted = new Set(sectionNames || []);
	const blocks = [];
	const parts = (text || '').split(/\n{2,}(?=\[)/);
	for(let i=0; i<parts.length; i++){
		const part = parts[i].trim();
		if(!part){
			continue;
		}
		const firstLine = part.split('\n')[0] || '';
		const m = firstLine.match(/^\[([^\]]+)\]$/);
		if(!m){
			continue;
		}
		const title = m[1];
		if(wanted.has(title)){
			blocks.push(part);
		}
	}
	return blocks.join('\n\n').trim();
}

function buildGermanySnapshotText(params, chartObj, result, fields){
	const lines = [];
	const midpoints = result && result.midpoints ? result.midpoints : [];
	const aspects = result && result.aspects ? result.aspects : {};

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);
	if(params.zodiacal !== undefined){
		lines.push(`黄道：${msg(AstroConst.ZODIACAL[params.zodiacal])}`);
	}
	if(params.hsys !== undefined){
		lines.push(`宫制：${msg(AstroConst.HouseSys[params.hsys])}`);
	}

	const astroText = buildAstroSnapshotContent(chartObj, fields);
	const baseSections = pickAstroSections(astroText, ['宫位宫头', '行星']);
	if(baseSections){
		lines.push('');
		lines.push(baseSections);
	}

	lines.push('');
	lines.push('[中点]');
	if(midpoints.length === 0){
		lines.push('暂无中点数据');
	}else{
		midpoints.forEach((item)=>{
			lines.push(`${msg(item.idA)} | ${msg(item.idB)} = ${formatSignDegree(item.sign, item.signlon)}`);
		});
	}

	lines.push('');
	lines.push('[中点相位]');
	const aspectKeys = Object.keys(aspects || {});
	if(aspectKeys.length === 0){
		lines.push('暂无中点相位数据');
	}else{
		aspectKeys.forEach((key)=>{
			const arr = aspects[key] || [];
			lines.push(`主体：${msg(key)}`);
			if(arr.length === 0){
				lines.push('无');
				return;
			}
			arr.forEach((asp)=>{
				const mid = asp.midpoint || {};
				const idA = mid.idA !== undefined ? mid.idA : asp.idA;
				const idB = mid.idB !== undefined ? mid.idB : asp.idB;
				lines.push(`与中点(${msg(idA)} | ${msg(idB)}) 成 ${aspectText(asp.aspect)} 相位，误差${round3(asp.delta)}`);
			});
			lines.push('');
		});
	}

	return lines.join('\n');
}

class AstroMidpoint extends Component{
	constructor(props) {
		super(props);
		this.state = {
			midpoints: null,
		};

		this.unmounted = false;

		this.requestChart = this.requestChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.requestChartObj = this.requestChartObj.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				if(this.unmounted){
					return;
				}
				this.requestChartObj(this.props.fields);
			};
		}

	}

	async requestChart(params){
		const data = await request(`${Constants.ServerRoot}/germany/midpoint`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		const st = {
			midpoints: result,
		};

		this.setState(st);
		saveModuleAISnapshot('germany', buildGermanySnapshotText(params, this.props.chart, result, this.props.fields), {
			date: params.date,
			time: params.time,
			zone: params.zone,
			lon: params.lon,
			lat: params.lat,
		});
	}

	requestChartObj(fields){
		let params = null;
		if(fields){
			params = fieldsToParams(fields);
		}else{
			params = this.genParams();
		}
		this.requestChart(params);
	}

	genParams(){
		let fields = this.props.fields;
		let params = fieldsToParams(fields);
		return params;
	}

	onFieldsChange(values){
		let flds = {
			...this.props.fields,
			...values
		};
		this.requestChartObj(flds);

		if(this.props.onChange){
			this.props.onChange(values);
		}		
	}

	componentDidMount(){
		this.unmounted = false;
	}

	componentWillUnmount(){
		this.unmounted = true;
	}

	render(){
		let fields = this.props.fields;
		let height = this.props.height ? this.props.height : 760;
		let chartObj = {
			midpoints: this.state.midpoints,
			chartObj: this.props.chart,
		}

		return (
			<div>
				<MidpointMain 
					value={chartObj} 
					onChange={this.onFieldsChange}
					fields={fields} 
					height={height} 
					chartDisplay={this.props.chartDisplay}
					planetDisplay={this.props.planetDisplay}
					lotsDisplay={this.props.lotsDisplay}
				/>
			</div>
		);
	}
}

export default AstroMidpoint;
