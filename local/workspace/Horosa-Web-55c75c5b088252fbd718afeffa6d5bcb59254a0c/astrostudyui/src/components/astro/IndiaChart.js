import { Component } from 'react';
import { Row, Col, Tabs, Select } from 'antd';
import AstroChartMain from './AstroChartMain';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { buildAstroSnapshotContent, } from '../../utils/astroAiSnapshot';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';

const INDIA_CHART_CACHE_MAX = 48;
const INDIA_CHART_CACHE = new Map();
const INDIA_CHART_INFLIGHT = new Map();

function fieldsToParams(fields){
	const params = {
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		ad: fields.ad.value,
		zone: fields.zone.value,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: fields.hsys.value === 0 || fields.hsys.value === 5 ? fields.hsys.value : 0,
		zodiacal: 1,
		tradition: fields.tradition.value,
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: 0,
		name: fields.name.value,
		pos: fields.pos.value,
	};

	if(fields.chartnum){
		params.chartnum = fields.chartnum.value;
	}

	return params;
}

function buildIndiaCacheKey(params){
	if(!params){
		return '';
	}
	return [
		params.date,
		params.time,
		params.ad,
		params.zone,
		params.lat,
		params.lon,
		params.hsys,
		params.zodiacal,
		params.tradition,
		params.strongRecption,
		params.simpleAsp,
		params.virtualPointReceiveAsp,
		params.predictive,
		params.chartnum,
	].map((v)=>`${v === undefined || v === null ? '' : v}`).join('|');
}

function pushIndiaCache(key, val){
	if(!key || !val){
		return;
	}
	if(INDIA_CHART_CACHE.has(key)){
		INDIA_CHART_CACHE.delete(key);
	}
	INDIA_CHART_CACHE.set(key, val);
	if(INDIA_CHART_CACHE.size > INDIA_CHART_CACHE_MAX){
		const oldest = INDIA_CHART_CACHE.keys().next().value;
		if(oldest !== undefined){
			INDIA_CHART_CACHE.delete(oldest);
		}
	}
}

export function buildIndiaChartParams(fields, chartnum){
	const params = fieldsToParams(fields);
	if(chartnum !== undefined && chartnum !== null){
		params.chartnum = chartnum;
	}else if(params.chartnum === undefined || params.chartnum === null){
		params.chartnum = 1;
	}
	return params;
}

export async function requestIndiaChartCached(params){
	const key = buildIndiaCacheKey(params);
	if(key && INDIA_CHART_CACHE.has(key)){
		return INDIA_CHART_CACHE.get(key);
	}
	if(key && INDIA_CHART_INFLIGHT.has(key)){
		return INDIA_CHART_INFLIGHT.get(key);
	}
	const req = request(`${Constants.ServerRoot}/india/chart`, {
		body: JSON.stringify(params),
		silent: true,
		disableLoading: true,
	}).then((data)=>{
		const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
		pushIndiaCache(key, result);
		return result;
	}).finally(()=>{
		if(key){
			INDIA_CHART_INFLIGHT.delete(key);
		}
	});
	if(key){
		INDIA_CHART_INFLIGHT.set(key, req);
	}
	return req;
}

export function warmIndiaChart(fields, chartnum){
	if(!fields){
		return Promise.resolve(null);
	}
	const params = buildIndiaChartParams(fields, chartnum);
	return requestIndiaChartCached(params).catch(()=>null);
}

function resolveIndiaFractal(chartnum, hook){
	let fractal = parseInt(chartnum, 10);
	if(Number.isNaN(fractal) || fractal <= 0){
		if(hook && hook.fractal){
			fractal = parseInt(hook.fractal, 10);
		}
	}
	if(Number.isNaN(fractal) || fractal <= 0){
		fractal = 1;
	}
	return fractal;
}

function resolveIndiaLabel(fractal, hook){
	if(hook && hook.txt){
		return hook.txt;
	}
	if(fractal === 1){
		return '命盘';
	}
	return `${fractal}律盘`;
}

function splitSections(text){
	const lines = `${text || ''}`.split('\n');
	const map = {};
	let current = '';
	lines.forEach((line)=>{
		const trimmed = `${line || ''}`.trim();
		const matched = trimmed.match(/^\[(.+)\]$/);
		if(matched && matched[1]){
			current = matched[1].trim();
			if(!map[current]){
				map[current] = [];
			}
			return;
		}
		if(!current){
			return;
		}
		map[current].push(line);
	});
	return map;
}

function ensureSection(lines, title, body){
	const clean = (body || []).map((line)=>`${line || ''}`.trimEnd()).filter((line)=>line.trim());
	lines.push(`[${title}]`);
	if(clean.length){
		lines.push(...clean);
	}else{
		lines.push('无数据');
	}
	lines.push('');
}

function buildIndiaSnapshotText(chartObj, fields, chartnum, hook){
	if(!chartObj || !chartObj.chart){
		return '';
	}
	const fractal = resolveIndiaFractal(chartnum, hook);
	const label = resolveIndiaLabel(fractal, hook);
	const astroText = buildAstroSnapshotContent(chartObj, fields) || '';
	const sections = splitSections(astroText);
	const baseInfo = sections['起盘信息'] || [];
	const houseCusps = sections['宫位宫头'] || [];
	const starsAndPoints = sections['星与虚点'] || [];
	const info = sections['信息'] || [];
	const aspects = sections['相位'] || [];
	const planets = sections['行星'] || [];
	const lots = sections['希腊点'] || [];
	const possibility = sections['可能性'] || [];
	const starInfo = [
		...houseCusps,
		...starsAndPoints,
		...info,
	];

	const lines = [];
	ensureSection(lines, '起盘信息', [
		`当前律盘：${label}`,
		`分盘：D${fractal}`,
		...baseInfo,
	]);
	ensureSection(lines, '星盘信息', starInfo);
	ensureSection(lines, '信息', info);
	ensureSection(lines, '相位', aspects);
	ensureSection(lines, '行星', planets);
	ensureSection(lines, '希腊点', lots);
	ensureSection(lines, '可能性', possibility);
	return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

class IndiaChart extends Component{
	constructor(props) {
		super(props);
		this.state = {
			chartObj: null,
		};

		this.requestChart = this.requestChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.requestChartObj = this.requestChartObj.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				this.requestChartObj(fields);
			};
		}

	}

	async requestChart(params, sourceFields){
		const result = await requestIndiaChartCached(params);

		const st = {
			chartObj: result,
		};

		this.setState(st);
		const snapshotFields = sourceFields || this.props.fields;
		const snapshotText = buildIndiaSnapshotText(result, snapshotFields, params ? params.chartnum : null, this.props.hook);
		if(snapshotText){
			const fractal = resolveIndiaFractal(params ? params.chartnum : null, this.props.hook);
			const label = resolveIndiaLabel(fractal, this.props.hook);
			const meta = {
				fractal,
				label,
			};
			saveModuleAISnapshot('indiachart', snapshotText, meta);
			saveModuleAISnapshot('indiachart_current', snapshotText, meta);
			saveModuleAISnapshot(`indiachart_${fractal}`, snapshotText, meta);
		}
	}

	requestChartObj(fields){
		let params = null;
		if(fields){
			params = buildIndiaChartParams(fields);
		}else{
			params = this.genParams();
		}
		this.requestChart(params, fields || this.props.fields);
	}

	genParams(){
		let fields = this.props.fields;
		let params = buildIndiaChartParams(fields);
		if(this.props.chartnum){
			params.chartnum = this.props.chartnum;
		}
		return params;
	}

	onFieldsChange(values){
		if(this.props.onChange){
			this.props.onChange(values);
		}		
	}

	render(){
		let fields = this.props.fields;
		let chartObj = this.state.chartObj;
		let height = this.props.height ? this.props.height : 760;

		return (
			<div>
				<AstroChartMain 
					value={chartObj} 
					onChange={this.onFieldsChange}
					fields={fields} 
					hidezodiacal={1}
					hidehsys={1}
					indiahsys={1}
					height={height} 
					chartDisplay={this.props.chartDisplay}
					planetDisplay={this.props.planetDisplay}
					lotsDisplay={this.props.lotsDisplay}
				/>
			</div>
		);
	}
}

export default IndiaChart;
