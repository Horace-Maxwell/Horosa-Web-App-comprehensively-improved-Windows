import { Component } from 'react';
import { Row, Col, Button, Divider, } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import DateTimeSelector from '../comp/DateTimeSelector';
import { convertLonToStr, convertLatToStr } from '../astro/AstroHelper';
import { randomStr, } from '../../utils/helper';
import DateTime from '../comp/DateTime';
import NongLi from './NongLi';
import GuaChartDiv from '../gua/GuaChartDiv';
import {Week} from '../../msg/types';

const NONG_LI_MONTH_CACHE_PREFIX = 'horosa.nongli.month.v1';
const NONG_LI_MONTH_CACHE = new Map();
const NONG_LI_MONTH_INFLIGHT = new Map();

function getLocalStorageSafe(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			return window.localStorage;
		}
		if(typeof localStorage !== 'undefined'){
			return localStorage;
		}
	}catch(e){
		return null;
	}
	return null;
}

function buildMonthCacheKey(params){
	if(!params){
		return '';
	}
	return [
		NONG_LI_MONTH_CACHE_PREFIX,
		params.date || '',
		params.zone || '',
		params.lon || '',
	].join('|');
}

function normalizeMonthPayload(payload){
	if(!payload || !Array.isArray(payload.days) || !Array.isArray(payload.prevDays)){
		return null;
	}
	return {
		days: payload.days,
		prevDays: payload.prevDays,
	};
}

function readMonthCache(cacheKey){
	if(!cacheKey){
		return null;
	}
	if(NONG_LI_MONTH_CACHE.has(cacheKey)){
		return NONG_LI_MONTH_CACHE.get(cacheKey);
	}
	const storage = getLocalStorageSafe();
	if(!storage){
		return null;
	}
	try{
		const raw = storage.getItem(cacheKey);
		if(!raw){
			return null;
		}
		const parsed = normalizeMonthPayload(JSON.parse(raw));
		if(parsed){
			NONG_LI_MONTH_CACHE.set(cacheKey, parsed);
		}
		return parsed;
	}catch(e){
		return null;
	}
}

function writeMonthCache(cacheKey, payload){
	const normalized = normalizeMonthPayload(payload);
	if(!cacheKey || !normalized){
		return null;
	}
	NONG_LI_MONTH_CACHE.set(cacheKey, normalized);
	const storage = getLocalStorageSafe();
	if(storage){
		try{
			storage.setItem(cacheKey, JSON.stringify(normalized));
		}catch(e){
		}
	}
	return normalized;
}

async function fetchMonthPayload(params){
	const cacheKey = buildMonthCacheKey(params);
	const cached = readMonthCache(cacheKey);
	if(cached){
		return cached;
	}
	if(NONG_LI_MONTH_INFLIGHT.has(cacheKey)){
		return NONG_LI_MONTH_INFLIGHT.get(cacheKey);
	}
	const promise = request(`${Constants.ServerRoot}/calendar/month`, {
		body: JSON.stringify(params),
		silent: true,
	}).then((data)=>{
		const result = data ? data[Constants.ResultKey] : null;
		return writeMonthCache(cacheKey, {
			days: result && Array.isArray(result.days) ? result.days : [],
			prevDays: result && Array.isArray(result.prevDays) ? result.prevDays : [],
		});
	}).finally(()=>{
		NONG_LI_MONTH_INFLIGHT.delete(cacheKey);
	});
	NONG_LI_MONTH_INFLIGHT.set(cacheKey, promise);
	return promise;
}

function buildInitialDate(fields){
	const value = fields && fields.date && fields.date.value;
	if(value && typeof value.clone === 'function'){
		return value.clone();
	}
	return new DateTime();
}

function normalizeFieldValue(fields, key, fallback){
	if(fields && fields[key] && fields[key].value !== undefined && fields[key].value !== null){
		const value = `${fields[key].value}`.trim();
		if(value){
			return value;
		}
	}
	return fallback;
}


class NongLiMain extends Component{
	constructor(props) {
		super(props);
		const date = buildInitialDate(this.props.fields);
		const lon = normalizeFieldValue(this.props.fields, 'lon', '120e00');
		const lat = normalizeFieldValue(this.props.fields, 'lat', '0n00');
		const cachedMonth = readMonthCache(buildMonthCacheKey({
			date: date.format('YYYY-MM-DD'),
			zone: date.zone,
			lon,
		}));
		this.state = {
			date,
			gpsLon: this.props.fields.gpsLon.value,
			gpsLat: this.props.fields.gpsLat.value,
			lon,
			lat,
			days: cachedMonth ? cachedMonth.days : [],
			prevDays: cachedMonth ? cachedMonth.prevDays : [],
			dateSelected: null,
			yearGua: null,
		};

		this.genParams = this.genParams.bind(this);
		this.requestNongli = this.requestNongli.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.genSelectDateDom = this.genSelectDateDom.bind(this);
		this.clickDate = this.clickDate.bind(this);
		this.clickYearGua = this.clickYearGua.bind(this);
		this.requestYearGua = this.requestYearGua.bind(this);
		this.unmounted = false;
		this.initialRequestTimer = null;
	}

	genParams(){
		const params = {
			date: this.state.date.format('YYYY-MM-DD'),
			zone: this.state.date.zone,
			lon: this.state.lon,
		}
		return params;
	}

	async requestNongli(){
		const params = this.genParams();
		const result = await fetchMonthPayload(params);
		if(this.unmounted || !result){
			return;
		}

		const st = {
			days: result.days,
			prevDays: result.prevDays,
			dateSelected: null,
		};

		this.setState(st);
	}

	async requestYearGua(){
		if(this.state.dateSelected === undefined || this.state.dateSelected === null){
			return null;
		}
		let date = this.state.dateSelected;
		let gua = date.qimengYearGua;
		if(gua === undefined || gua === null){
			return;
		}

		let params = {
			name: [gua],
		}
		const data = await request(`${Constants.ServerRoot}/gua/desc`, {
			body: JSON.stringify(params),
			silent: true,
		});
		const result = data[Constants.ResultKey];

		const st = {
			yearGua: result[gua],
		};

		this.setState(st);
	}

	onTimeChanged(dt){
		this.setState({
			date: dt.value,
		}, ()=>{
			this.requestNongli();
		});
	}

	changeGeo(rec){
		this.setState({
			lat: convertLatToStr(rec.lat),
			lon: convertLonToStr(rec.lng),
			gpsLat: rec.gpsLat,
			gpsLon: rec.gpsLng,
		}, ()=>{
			this.requestNongli();
		});
	}

	clickDate(date){
		let lastdt = this.state.dateSelected;
		let lastGua = lastdt ? lastdt.qimengYearGua : null;
		let same = lastGua === date.qimengYearGua;

		this.setState({
			dateSelected: date,
		}, ()=>{
			if(!same){
				this.requestYearGua();
			}
		});
	}

	clickYearGua(){
		this.requestYearGua();
	}

	genSelectDateDom(){
		if(this.state.dateSelected === undefined || this.state.dateSelected === null){
			return null;
		}
		let date = this.state.dateSelected;
		let parts = date.birth.split(' ');
		let month = date.month + date.day;
		if(date.leap){
			month = '闰'+month;
		}

		let mt = '';
		if(date.dayInt === 1){
			mt = '朔月';
		}else if(date.dayInt === 15){
			mt = '望月';
		}

		let row = (
			<Row key={randomStr(8)}>
				<Col span={24}>
					<span>{parts[0]}</span>&nbsp;
					<span>{Week[date.dayOfWeek+'']}</span>
				</Col>
				<Col span={24}>
					<span>年纳音：{date.yearNaying}</span>
				</Col>
				<Col span={24}>
					<span>{date.year}年{month}</span>
				</Col>
				<Col span={24}>
					<span>{date.yearJieqi}年</span>&nbsp;
					<span>{date.monthGanZi}月</span>&nbsp;
					<span>{date.dayGanZi}日</span>&nbsp;					
					<span>{date.time}时</span>&nbsp;					
				</Col>
				<Col span={24}>
					(此处月干支以当天中午12点计算是否跨节气来决定。)
				</Col>
				<Col span={24}>
					<span>{date.jiedelta}，{date.chef}</span>
				</Col>
				{
					date.jieqi && (
						<Col span={24}>
							<Divider />
							<span>{date.jieqi}</span>&nbsp;
							<span>{date.jieqiTime}</span>&nbsp;
						</Col>	
					)
				}
				{
					date.jieqi && (
						<Col span={24}>
							<span>jdn:{date.jieqiJdn}</span>&nbsp;					
						</Col>	
					)
				}
				{
					date.moonTime && (
						<Col span={24}>
							<Divider />
							<span>{mt}</span>&nbsp;
							<span>{date.date}&nbsp;{date.moonTime}</span>&nbsp;
						</Col>	
					)
				}
				{
					date.moonTime && (
						<Col span={24}>
							<span>jdn：{date.moonJdn}</span>&nbsp;					
						</Col>	
					)
				}
				<Col span={24}><Divider /></Col>
				{
					date.qimengYearGua && (
						<Col span={24}>
							<Button type='link' onClick={this.clickYearGua}>奇门年卦：{date.qimengYearGua}</Button>
						</Col>	
					)
				}
				{
					this.state.yearGua && (
						<Col span={24}>
							<Row>
								<Col span={6}>
									<GuaChartDiv value={this.state.yearGua} height={30} width={40} />
								</Col>
								<Col span={18}>
									<a href={this.state.yearGua.url} target='_blank'>{this.state.yearGua.desc}</a>
								</Col>
							</Row>
						</Col>
					)
				}
			</Row>
		);


		return row;
	}

	componentDidMount(){
		this.unmounted = false;
		this.initialRequestTimer = setTimeout(()=>{
			this.initialRequestTimer = null;
			this.requestNongli();
		}, 16);
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this.initialRequestTimer){
			clearTimeout(this.initialRequestTimer);
			this.initialRequestTimer = null;
		}
	}


	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 30px)'
		}else{
			height = height - 30;
		}

		let seldatedom = this.genSelectDateDom();

		return (
			<div>
				<Row gutter={6}>
					<Col span={16}>
						<NongLi 
							height={height}
							date={this.state.date}
							days={this.state.days}
							prevDays={this.state.prevDays}
							focusDate={this.state.date}
							onDateClick={this.clickDate}
						/>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>
								<DateTimeSelector 
									value={this.state.date}
									defaultTimeType='M'
									showTime={false}
									showAdjust={true}
									onlyMonthAdjust={true}
									onChange={this.onTimeChanged} 
								/>

							</Col>
						</Row>
						<Divider />
						{seldatedom}
					</Col>
				</Row>
			</div>
		);
	}
}

export default NongLiMain;
