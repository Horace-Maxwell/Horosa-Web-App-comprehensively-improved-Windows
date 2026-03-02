import { Component } from 'react';
import { Row, Col, Tabs, Input, Button, DatePicker, Card, Select } from 'antd';
import AstroChartMain from '../astro/AstroChartMain';
import GeoCoordModal from '../amap/GeoCoordModal';
import SuZhanMain from '../suzhan/SuZhanMain';
import AstroChartMain3D from '../astro3d/AstroChartMain3D';
import * as Constants from '../../utils/constants';
import * as AstroConst from '../../constants/AstroConst';
import request from '../../utils/request';
import { gcj02ToGps, randomStr } from '../../utils/helper';
import {convertLatStrToDegree, convertLonStrToDegree, convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import styles from '../../css/styles.less';
import DateTime from '../comp/DateTime';
import DateTimeSelector from '../comp/DateTimeSelector';
import { getHousesOption } from '../comp/CompHelper'
import * as AstroText from '../../constants/AstroText';
import * as SZConst from '../suzhan/SZConst';
import * as Su28Helper from '../su28/Su28Helper';
import { buildAstroSnapshotContent, } from '../../utils/astroAiSnapshot';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { setJieqiSeedLocalCache, } from '../../utils/localCalcCache';
import { fetchPreciseJieqiYear } from '../../utils/preciseCalcBridge';
import {
	appendPlanetMetaName,
} from '../../utils/planetMetaDisplay';

const JIEQI_SNAPSHOT_PLANET_META = {
	showPostnatal: 1,
	showHouse: 1,
	showRuler: 1,
};

const { MonthPicker, } = DatePicker
const TabPane = Tabs.TabPane;
const InputGroup = Input.Group;
const {Option} = Select
const JIEQI_STD = [
	'小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
	'清明', '谷雨', '立夏', '小满', '芒种', '夏至',
	'小暑', '大暑', '立秋', '处暑', '白露', '秋分',
	'寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

const jieqiChartMem = {};
const JIEQI_VIEWPORT_GAP = 12;
const JIEQI_MIN_HEIGHT = 320;

function getViewportHeight(){
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		return window.innerHeight;
	}
	if(typeof document !== 'undefined' && document.documentElement){
		return document.documentElement.clientHeight || 900;
	}
	return 900;
}

function toNumber(val){
	if(typeof val === 'number' && Number.isFinite(val)){
		return val;
	}
	if(typeof val === 'string'){
		const txt = val.trim();
		if(/^[-+]?\d+(\.\d+)?(px)?$/i.test(txt)){
			const n = parseFloat(txt);
			return Number.isFinite(n) ? n : null;
		}
	}
	return null;
}

function resolveBoundedHeight(rawHeight){
	const viewport = getViewportHeight();
	let h = toNumber(rawHeight);
	if(h === null){
		h = rawHeight === '100%' ? (viewport - 80) : 760;
	}
	h = h - 50;
	const maxH = Math.max(JIEQI_MIN_HEIGHT, viewport - JIEQI_VIEWPORT_GAP);
	return Math.max(JIEQI_MIN_HEIGHT, Math.min(h, maxH));
}

function newEmptyFields(fld){
	const fields = {
		...fld,
		group: {
			value: null,
		},
		memoZiWei:{
			value: null,
		},
		memoBaZi:{
			value: null,
		},
		memoAstro:{
			value: null,
		},
		memo74:{
			value: null,
		},
		memoGua:{
			value: null,
		},
		memoLiuReng:{
			value: null,
		},
		memoQiMeng:{
			value: null,
		},
		memoSuZhan:{
			value: null,
		},

	};

	return fields;
}

function paramsToFields(params, flds){
	let tm = new DateTime();
	tm.setZone(params.zone);
	const toInt = (val, defval)=>{
		const parsed = parseInt(val, 10);
		return Number.isNaN(parsed) ? defval : parsed;
	};
	const pickValue = (key, defval)=>{
		if(params[key] !== undefined && params[key] !== null){
			return params[key];
		}
		if(flds && flds[key] && flds[key].value !== undefined && flds[key].value !== null){
			return flds[key].value;
		}
		return defval;
	};
	const pickPreferFields = (key, defval)=>{
		if(flds && flds[key] && flds[key].value !== undefined && flds[key].value !== null){
			return flds[key].value;
		}
		if(params[key] !== undefined && params[key] !== null){
			return params[key];
		}
		return defval;
	};
	const doubingSu28Val = pickPreferFields('doubingSu28', 0);
	const fields = {
		date: {
			value: tm.parse(params.year, 'YYYY'),
		},
		time: {
			value: tm,
		},
		ad: {
			value: tm.ad,
		},
		zone: {
			value: tm.zone,
		},
		lat: {
			value: params.lat,
		},
		lon: {
			value: params.lon,
		},
		gpsLat: {
			value: params.gpsLat,
		},
		gpsLon: {
			value: params.gpsLon,
		},
		name: {
			value: params.name ? params.name : null,
		},
		pos: {
			value: params.pos ? params.pos : null,
		},
		hsys: {
			value: params.hsys,
		},
		zodiacal: {
			value: params.zodiacal,
		},
		doubingSu28: {
			value: (doubingSu28Val === true || parseInt(doubingSu28Val, 10) === 1) ? 1 : 0,
		},
		houseStartMode: {
			value: toInt(pickPreferFields('houseStartMode', SZConst.SZHouseStart_Bazi), SZConst.SZHouseStart_Bazi) === SZConst.SZHouseStart_ASC
				? SZConst.SZHouseStart_ASC : SZConst.SZHouseStart_Bazi,
		},
		szchart: {
			value: toInt(pickPreferFields('szchart', SZConst.SZChart.chart), SZConst.SZChart.chart),
		},
		szshape: {
			value: toInt(pickPreferFields('szshape', SZConst.SZChart.shape), SZConst.SZChart.shape),
		},
		tradition: {
			value: 0,
		},
		strongRecption: {
			value: 0,
		},
		simpleAsp: {
			value: 0,
		},
		virtualPointReceiveAsp: {
			value: 0,
		},
		predictive: {
			value: 0,
		},
		pdtype: {
			value: 0,
		},
		pdaspects: {
			value: [0, 60, 90, 120, 180],
		},
		gender: {
			value: toInt(pickPreferFields('gender', 1), 1),
		},

	};

	if(params.year === undefined || params.year === null){
		if(params.birth){
			let bir = new DateTime();
			bir.parse(params.birth, 'YYYY-MM-DD HH:mm:ss');
			fields.date.value = bir;
			fields.time.value = bir;
		}	
	}
	if(params.zodiacal === 'Tropical'){
		fields.zodiacal.value = 0;
	}
	if(params.zodiacal === 'Sidereal'){
		fields.zodiacal.value = 1;
	}

	if(flds){
		if(params.gpsLat === undefined || params.gpsLat === null){
			fields.gpsLat = flds.gpsLat;
		}
		if(params.gpsLon === undefined || params.gpsLon === null){
			fields.gpsLon = flds.gpsLon;
		}
	}
	return fields;
}

function fieldsToState(fields){
	let st = {
		time: fields.date.value,
		ad: fields.ad.value,
		zone: fields.zone.value,
		lat: fields.lat.value,
		lon: fields.lon.value,
		hsys: fields.hsys.value,
		zodiacal: fields.zodiacal.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		doubingSu28: fields.doubingSu28.value,
		fields: {
			...fields
		},
	};
	return st;
}

function getSeedCacheKey(params){
	return [
		params && params.year,
		params && params.ad,
		params && params.zone,
		params && params.lon,
		params && params.lat,
		params && params.gpsLon,
		params && params.gpsLat,
	].join('|');
}

function getChartCacheKey(params, term, birth){
	return [
		getSeedCacheKey(params),
		term,
		birth,
		params && params.hsys,
		params && params.zodiacal,
		params && params.doubingSu28,
	].join('|');
}

function splitBirthToDateTime(birth){
	const txt = `${birth || ''}`.trim();
	const parts = txt.split(' ');
	const date = parts[0] || '';
	const time = parts[1] || '00:00:00';
	return { date, time };
}

function normalizeGanZi(txt){
	const raw = `${txt || ''}`.trim();
	return raw.length >= 2 ? raw.slice(0, 2) : raw;
}

function toSimpleFourColumns(nongli){
	if(!nongli){
		return null;
	}
	return {
		year: {
			ganzi: normalizeGanZi(nongli.yearGanZi || nongli.yearJieqi || nongli.year),
			naying: '',
		},
		month: {
			ganzi: normalizeGanZi(nongli.monthGanZi),
			naying: '',
		},
		day: {
			ganzi: normalizeGanZi(nongli.dayGanZi),
			naying: '',
		},
		time: {
			ganzi: normalizeGanZi(nongli.time || nongli.timeGanZi),
			naying: '',
		},
	};
}

function buildChartRequestParams(params, birth){
	const dt = splitBirthToDateTime(birth);
	return {
		cid: null,
		ad: params.ad,
		date: dt.date.replace(/-/g, '/'),
		time: dt.time,
		zone: params.zone,
		lat: params.lat,
		lon: params.lon,
		gpsLat: params.gpsLat,
		gpsLon: params.gpsLon,
		hsys: params.hsys,
		southchart: false,
		zodiacal: params.zodiacal,
		tradition: 0,
		doubingSu28: params.doubingSu28,
		strongRecption: 0,
		simpleAsp: 0,
		virtualPointReceiveAsp: 0,
		predictive: 0,
		pdaspects: [0, 60, 90, 120, 180],
		name: null,
		pos: null,
		group: null,
	};
}

async function loadJieqiChart(params, term, birth){
	const key = getChartCacheKey(params, term, birth);
	const cached = jieqiChartMem[key];
	if(cached && cached.chart){
		return cached.chart;
	}
	const dt = splitBirthToDateTime(birth);
	const reqParams = buildChartRequestParams(params, birth);
	const data = await request(`${Constants.ServerRoot}/chart`, {
		body: JSON.stringify(reqParams),
	});
	const chartObj = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
	if(!chartObj){
		return null;
	}
	if(!chartObj.params){
		chartObj.params = {};
	}
	chartObj.params = {
		...chartObj.params,
		...reqParams,
		birth: `${dt.date} ${dt.time}`,
		year: params.year,
	};
	jieqiChartMem[key] = {
		...(jieqiChartMem[key] || {}),
		chart: chartObj,
	};
	return chartObj;
}

function isEncodedToken(text){
	return /^[A-Za-z0-9${}]$/.test((text || '').trim());
}

function msg(id, chartSources){
	if(id === undefined || id === null){
		return '';
	}
	let base = null;
	if(AstroText.AstroTxtMsg[id]){
		base = AstroText.AstroTxtMsg[id];
	}else if(AstroText.AstroMsg[id]){
		const val = AstroText.AstroMsg[id];
		if(isEncodedToken(val)){
			base = `${id}`;
		}else{
			base = `${val}`;
		}
	}else{
		base = `${id}`;
	}
	return appendPlanetMetaName(base, id, chartSources, JIEQI_SNAPSHOT_PLANET_META);
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

function signFromLon(lon){
	if(lon === undefined || lon === null || Number.isNaN(Number(lon))){
		return null;
	}
	let val = Number(lon) % 360;
	if(val < 0){
		val += 360;
	}
	const idx = Math.floor(val / 30) % 12;
	return AstroConst.LIST_SIGNS[idx];
}

function resolveHouseStartMode(fields){
	if(fields && fields.houseStartMode && fields.houseStartMode.value !== undefined && fields.houseStartMode.value !== null){
		return parseInt(fields.houseStartMode.value, 10) === SZConst.SZHouseStart_ASC
			? SZConst.SZHouseStart_ASC : SZConst.SZHouseStart_Bazi;
	}
	return SZConst.SZHouseStart_Bazi;
}

function computeAscSignIndex(rootObj, chart, fields){
	const objects = chart && chart.objects ? chart.objects : [];
	const asc = objects.find((obj)=>obj.id === AstroConst.ASC);
	const sun = objects.find((obj)=>obj.id === AstroConst.SUN);
	if(!asc){
		return -1;
	}
	const ascIdx = Math.floor(Number(asc.ra) / 30);
	if(resolveHouseStartMode(fields) === SZConst.SZHouseStart_ASC){
		return ascIdx;
	}
	const bazi = (chart && chart.nongli && chart.nongli.bazi)
		|| (rootObj && rootObj.nongli && rootObj.nongli.bazi);
	if(!bazi || !sun){
		return ascIdx;
	}
	const timezi = bazi.time && bazi.time.branch ? bazi.time.branch.cell : null;
	const timesig = timezi ? SZConst.ZiSign[timezi] : null;
	const tmsigidx = timesig ? AstroConst.LIST_SIGNS.indexOf(timesig) : -1;
	if(tmsigidx < 0){
		return ascIdx;
	}
	const sunidx = Math.floor(Number(sun.ra) / 30);
	return (sunidx - tmsigidx - 5 + 24) % 12;
}

function houseFullLabel(house, idx, ascSignIndex){
	let houseName = msg(house && house.id ? house.id : null, null) || `第${idx + 1}宫`;
	const sign = signFromLon(house ? house.lon : null);
	if(!sign){
		return houseName;
	}
	const signIdx = AstroConst.LIST_SIGNS.indexOf(sign);
	if(signIdx >= 0 && ascSignIndex >= 0){
		const hnum = (signIdx - ascSignIndex + 12) % 12 + 1;
		houseName = `第${hnum}宫`;
	}
	const zi = SZConst.SignZi[sign] || '';
	const area = (SZConst.SZSigns[signIdx] && SZConst.SZSigns[signIdx].length >= 2)
		? `${SZConst.SZSigns[signIdx][0]}${SZConst.SZSigns[signIdx][1]}`
		: '';
	const signName = AstroText.AstroMsgCN[sign] || msg(sign, null);
	return `${zi}—${area}—${signName}座—${houseName}`;
}

function buildJieQiSuSection(chartObj, fields, planetDisplay){
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const houses = chart.houses || [];
	const objects = chart.objects || [];
	const lines = [];
	const ascSignIndex = computeAscSignIndex(chartObj, chart, fields);
	let visibleSet = null;
	if(planetDisplay && planetDisplay.length){
		visibleSet = new Set(planetDisplay);
	}
	houses.forEach((house, idx)=>{
		lines.push(`宫位：${houseFullLabel(house, idx, ascSignIndex)}`);
		const inHouse = objects.filter((obj)=>{
			if(obj.house !== house.id){
				return false;
			}
			if(visibleSet){
				return visibleSet.has(obj.id);
			}
			return AstroConst.isTraditionPlanet(obj.id);
		})
			.sort((a, b)=>{
				if(a.ra > 300 && b.ra < 30){
					return -1;
				}
				return a.ra - b.ra;
			});
		if(inHouse.length === 0){
			lines.push('二十八宿：无');
			lines.push('星曜：无');
			lines.push('');
			return;
		}
		const suMap = new Map();
		inHouse.forEach((obj)=>{
			const su = obj.su28 || '未知宿';
			if(!suMap.has(su)){
				suMap.set(su, []);
			}
			suMap.get(su).push(obj);
		});
		const suKeys = Array.from(suMap.keys()).sort((a, b)=>{
			const ia = Su28Helper.Su28.indexOf(a);
			const ib = Su28Helper.Su28.indexOf(b);
			if(ia < 0 && ib < 0){
				return `${a}`.localeCompare(`${b}`);
			}
			if(ia < 0){
				return 1;
			}
			if(ib < 0){
				return -1;
			}
			return ia - ib;
		});
		suKeys.forEach((su)=>{
			const list = suMap.get(su) || [];
			lines.push(`二十八宿：${su}`);
			list.forEach((obj)=>{
				let radeg = Number(obj.ra);
				const suRef = (chart.fixedStarSu28 || []).find((it)=>it.name === su);
				if(!Number.isNaN(radeg) && suRef && suRef.ra !== undefined && suRef.ra !== null){
					radeg = Number(obj.ra) - Number(suRef.ra);
					if(radeg < 0){
						radeg += 360;
					}
				}else{
					radeg = Number(obj.signlon);
				}
				const sd = splitDegree(radeg);
				lines.push(`星曜：${msg(obj.id, chartObj)} ${sd[0]}˚${su}${sd[1]}分`);
			});
		});
		lines.push('');
	});
	return lines.join('\n').trim();
}

function buildJieQiAstroLightSection(chartObj, fields, withHeaders=true){
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const houses = chart.houses || [];
	const objects = chart.objects || [];
	const lines = [];

	if(withHeaders){
		lines.push('[起盘信息]');
	}
	const lon = fields && fields.lon ? fields.lon.value : params.lon;
	const lat = fields && fields.lat ? fields.lat.value : params.lat;
	if(lon || lat){
		lines.push(`经纬度：${lon || ''} ${lat || ''}`);
	}
	if(params.birth){
		lines.push(`时间：${params.birth}`);
	}
	if(params.zone !== undefined && params.zone !== null){
		lines.push(`时区：${params.zone}`);
	}
	if(chart.zodiacal){
		lines.push(`黄道：${msg(chart.zodiacal, chartObj)}`);
	}
	if(chart.hsys){
		lines.push(`宫制：${msg(chart.hsys, chartObj)}`);
	}

	if(withHeaders){
		lines.push('');
		lines.push('[宫位宫头]');
	}else{
		lines.push('');
		lines.push('宫位宫头：');
	}
	houses.forEach((house, idx)=>{
		if(house && house.lon !== undefined && house.lon !== null){
			const deg = splitDegree(house.lon);
			const sign = Math.floor(((house.lon % 360) + 360) % 360 / 30);
			const signs = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
			lines.push(`${msg(house.id, chartObj) || `第${idx + 1}宫`}：${Math.abs(deg[0] % 30)}˚${signs[sign]}${Math.abs(deg[1])}分`);
		}
	});

	lines.push('');
	if(withHeaders){
		lines.push('[行星与点]');
	}else{
		lines.push('行星与点：');
	}
	objects.forEach((obj)=>{
		const sd = splitDegree(obj.signlon);
		lines.push(`${msg(obj.id, chartObj)}：${sd[0]}˚${msg(obj.sign, chartObj)}${sd[1]}分；宫位=${msg(obj.house, chartObj)}`);
	});
	return lines.join('\n').trim();
}

function buildJieQiSnapshotText(result, baseFields, jieqis, planetDisplay){
	const lines = [];
	const charts = result && result.charts ? result.charts : {};
	lines.push('[节气盘参数]');
	if(baseFields && baseFields.date && baseFields.date.value){
		lines.push(`年份：${baseFields.date.value.format('YYYY')}`);
	}
	if(baseFields && baseFields.zone){
		lines.push(`时区：${baseFields.zone.value}`);
	}
	if(baseFields && baseFields.lon && baseFields.lat){
		lines.push(`经纬度：${baseFields.lon.value} ${baseFields.lat.value}`);
	}
	lines.push('说明：以下包含二分二至（春分、夏至、秋分、冬至）的星盘与宿盘专用导出。');

	(jieqis || []).forEach((title)=>{
		const one = charts[title];
		if(!one){
			return;
		}
		let flds = baseFields;
		if(one.params){
			flds = paramsToFields(one.params, baseFields);
		}
		lines.push('');
		lines.push(`[${title}星盘]`);
		lines.push(buildJieQiAstroLightSection(one, flds, false) || '无数据');
		lines.push('');
		lines.push(`[${title}宿盘]`);
		lines.push(buildJieQiSuSection(one, flds, planetDisplay) || '无数据');
	});
	return lines.join('\n').trim();
}

function parseJieQiTab(currentTab, jieqis){
	if(!currentTab){
		return null;
	}
	if((jieqis || []).indexOf(currentTab) >= 0){
		return { title: currentTab, type: 'astro' };
	}
	for(let i=0; i<(jieqis || []).length; i++){
		const title = jieqis[i];
		if(currentTab === `宿盘${title}`){
			return { title, type: 'suzhan' };
		}
		if(currentTab === `3D盘${title}`){
			return { title, type: 'astro3d' };
		}
	}
	return null;
}

function buildJieQiCurrentSnapshotText(currentTab, result, baseFields, jieqis, planetDisplay){
	const info = parseJieQiTab(currentTab, jieqis);
	if(!info){
		return '';
	}
	const charts = result && result.charts ? result.charts : {};
	const one = charts[info.title];
	if(!one){
		return '';
	}
	let flds = baseFields;
	if(one.params){
		flds = paramsToFields(one.params, baseFields);
	}
	const lines = [];
	if(info.type === 'suzhan'){
		lines.push(`[${info.title}宿盘]`);
		lines.push(buildJieQiSuSection(one, flds, planetDisplay) || '无数据');
	}else{
		const panelName = info.type === 'astro3d' ? `${info.title}3D盘` : `${info.title}星盘`;
		lines.push(`[${panelName}]`);
		lines.push(buildAstroSnapshotContent(one, flds) || '无数据');
	}
	return lines.join('\n').trim();
}


class JieQiChartsMain extends Component{

	constructor(props) {
		super(props);

		let now = new DateTime();
		this.state = {
			divid: 'div_' + randomStr(8),
			currentTab: '二十四节气',
			result: {},
			time: now,
			zone: now.zone,
			lat: Constants.DefLat,
			lon: Constants.DefLon,
			ad: now.ad,
			hsys: 0,
			zodiacal: 0,
			doubingSu28: 0,
			gpsLat: Constants.DefGpsLat,
			gpsLon: Constants.DefGpsLon,
			jieqis: ['春分', '夏至', '秋分', '冬至'],
			fields: {},

			hook:{
				suzhan:{
					fun: null
				},
				chart3d:{
					fun: null
				},	
			},
		}

		this.unmounted = false;
		this.snapshotTimer = null;
		this.requestSeq = 0;
		this.pendingRequest = null;
		this.lastResultKey = '';

		this.changeTab = this.changeTab.bind(this);
		this.requestJieQi = this.requestJieQi.bind(this);
		this.genParams = this.genParams.bind(this);

		this.onLatChanged = this.onLatChanged.bind(this);
		this.onLonChanged = this.onLonChanged.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onZoneChanged = this.onZoneChanged.bind(this);
		this.onAdChanged = this.onAdChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.changeHsys = this.changeHsys.bind(this);
		this.changeZodiacal = this.changeZodiacal.bind(this);
		this.onSuZhanFieldsChange = this.onSuZhanFieldsChange.bind(this);

		this.gen24JieqiDom = this.gen24JieqiDom.bind(this);
		this.genTabsDom = this.genTabsDom.bind(this);
		this.saveCurrentJieQiSnapshot = this.saveCurrentJieQiSnapshot.bind(this);

		let params = this.genParams();
		this.state.fields = paramsToFields(params);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				if(fields){
					let st = fieldsToState(fields);
					this.setState(st, ()=>{
						if(this.unmounted){
							return;
						}
						this.requestJieQi();
					});
				}else{
					this.requestJieQi();
				}
			};
		}

	}

	genParams(){
		const params = {
			year: this.state.time.format('YYYY'),
			ad: this.state.ad,
			zone: this.state.zone,
			lon: this.state.lon,
			lat: this.state.lat,
			jieqis: this.state.jieqis,
			hsys: this.state.hsys,
			zodiacal: this.state.zodiacal,
			gpsLat: this.state.gpsLat,
			gpsLon: this.state.gpsLon,
			doubingSu28: this.state.doubingSu28,
		}
		return params;
	}

	getRequestKey(params){
		const p = params || this.genParams();
		return [
			getSeedCacheKey(p),
			p && p.hsys,
			p && p.zodiacal,
			p && p.doubingSu28,
			p && Array.isArray(p.jieqis) ? p.jieqis.join(',') : '',
		].join('|');
	}

	async requestJieQi(){
		const params = this.genParams();
		const reqKey = this.getRequestKey(params);
		if(this.pendingRequest && this.pendingRequest.key === reqKey){
			return this.pendingRequest.promise;
		}
		if(this.lastResultKey === reqKey && this.state.result && Object.keys(this.state.result).length){
			return this.state.result;
		}
		const seq = ++this.requestSeq;
		const flds = paramsToFields(params, this.state.fields);
		const reqPromise = (async()=>{
			const preciseResult = await fetchPreciseJieqiYear(params);
			let result = preciseResult;
			if(!result || this.unmounted || seq !== this.requestSeq){
				return result;
			}
			if(result && Array.isArray(result.jieqi24)){
				const seed = {};
				result.jieqi24.forEach((entry)=>{
					const term = entry && entry.jieqi ? `${entry.jieqi}` : '';
					const time = entry && entry.time ? `${entry.time}` : '';
					if(term && time){
						seed[term] = {
							term,
							time,
							dateKey: time.split(' ')[0].replace(/-/g, ''),
							dayGanzhi: entry && entry.bazi && entry.bazi.fourColumns && entry.bazi.fourColumns.day
								? `${entry.bazi.fourColumns.day.ganzi || ''}` : '',
						};
					}
				});
				if(Object.keys(seed).length){
					setJieqiSeedLocalCache(params, seed);
				}
			}
			const st = {
				result: result,
				fields: flds,
			};
			this.lastResultKey = reqKey;
			this.setState(st, ()=>{
				this.saveCurrentJieQiSnapshot(this.state.currentTab, result, flds);
			});
			if(this.snapshotTimer){
				if(typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function'){
					window.cancelIdleCallback(this.snapshotTimer);
				}else{
					clearTimeout(this.snapshotTimer);
				}
			}
			const saveJob = ()=>{
				if(this.unmounted){
					return;
				}
				saveModuleAISnapshot('jieqi', buildJieQiSnapshotText(result, flds, this.state.jieqis, this.props.planetDisplay), {
					year: params.year,
					zone: params.zone,
					lon: params.lon,
					lat: params.lat,
					hsys: params.hsys,
					zodiacal: params.zodiacal,
				});
				saveModuleAISnapshot('jieqi_current', buildJieQiCurrentSnapshotText(this.state.currentTab, result, flds, this.state.jieqis, this.props.planetDisplay), {
					year: params.year,
					zone: params.zone,
					lon: params.lon,
					lat: params.lat,
					hsys: params.hsys,
					zodiacal: params.zodiacal,
					currentTab: this.state.currentTab,
				});
			};
			// 节气快照在空闲时保存，避免与页面交互竞争主线程。
			if(typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'){
				this.snapshotTimer = window.requestIdleCallback(saveJob, { timeout: 1200 });
			}else{
				this.snapshotTimer = setTimeout(saveJob, 200);
			}
			return result;
		})().finally(()=>{
			if(this.pendingRequest && this.pendingRequest.seq === seq){
				this.pendingRequest = null;
			}
		});
		this.pendingRequest = {
			key: reqKey,
			seq,
			promise: reqPromise,
		};
		return reqPromise;
	}

	changeTab(key){
		this.setState({
			currentTab: key,
		}, ()=>{
			this.saveCurrentJieQiSnapshot(key);
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
					currentSubTab: key,
					},
				});
			}	
		});
	}

	saveCurrentJieQiSnapshot(currentTab, result, flds){
		const tab = currentTab || this.state.currentTab;
		const rs = result || this.state.result;
		const fields = flds || this.state.fields;
		const txt = buildJieQiCurrentSnapshotText(tab, rs, fields, this.state.jieqis, this.props.planetDisplay);
		if(!txt){
			return;
		}
		saveModuleAISnapshot('jieqi_current', txt, {
			currentTab: tab,
		});
	}

	onAdChanged(value){
		this.setState({
			ad: value,
		}, ()=>{
			this.requestJieQi()
		});
	}

	onTimeChanged(val){
		this.setState({
			time: val.value,
		}, ()=>{
			this.requestJieQi()
		});
	}

	onZoneChanged(val){
		this.setState({
			zone: val,
		}, ()=>{
			this.requestJieQi()
		});
	}

	onLatChanged(value){
		let lon = convertLonStrToDegree(this.state.lon);
		let lat = convertLatStrToDegree(value);
		let geo = gcj02ToGps(lat, lon);

		this.setState({
			lat: value,
			gpsLat: geo.lat,
			gpsLon: geo.lon
		});

	}

	onLonChanged(value){
		let lat = convertLatStrToDegree(this.state.lat);
		let lon = convertLonStrToDegree(value);
		let geo = gcj02ToGps(lat, lon);
		this.setState({
			lon: value,
			gpsLat: geo.lat,
			gpsLon: geo.lon
		});
	}

	changeGeo(rec){
		this.setState({
			lon: convertLonToStr(rec.lng),
			lat: convertLatToStr(rec.lat),
			gpsLon: rec.gpsLng,
			gpsLat: rec.gpsLat,
		}, ()=>{
			this.requestJieQi()
		});
	}

	changeZodiacal(val){
		this.setState({
			zodiacal: val,
		}, ()=>{
			this.requestJieQi()
		})
	}

	changeHsys(val){
		this.setState({
			hsys: val,
		}, ()=>{
			this.requestJieQi()
		})
	}

	onSuZhanFieldsChange(changedFields){
		const patch = changedFields || {};
		const mergedFields = {
			...(this.state.fields || {}),
			...patch,
		};
		const statePatch = {
			fields: mergedFields,
		};
		const needReload = ['date', 'time', 'ad', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon', 'doubingSu28']
			.some((key)=>Object.prototype.hasOwnProperty.call(patch, key));

		if(patch.date && patch.date.value){
			statePatch.time = patch.date.value;
		}
		if(patch.zone && patch.zone.value !== undefined && patch.zone.value !== null){
			statePatch.zone = patch.zone.value;
		}
		if(patch.ad && patch.ad.value !== undefined && patch.ad.value !== null){
			statePatch.ad = patch.ad.value;
		}
		if(patch.lat && patch.lat.value){
			statePatch.lat = patch.lat.value;
		}
		if(patch.lon && patch.lon.value){
			statePatch.lon = patch.lon.value;
		}
		if(patch.gpsLat && patch.gpsLat.value !== undefined && patch.gpsLat.value !== null){
			statePatch.gpsLat = patch.gpsLat.value;
		}
		if(patch.gpsLon && patch.gpsLon.value !== undefined && patch.gpsLon.value !== null){
			statePatch.gpsLon = patch.gpsLon.value;
		}
		if(patch.doubingSu28 && patch.doubingSu28.value !== undefined && patch.doubingSu28.value !== null){
			statePatch.doubingSu28 = patch.doubingSu28.value;
		}

		this.setState(statePatch, ()=>{
			if(needReload){
				this.requestJieQi();
				return;
			}
			this.saveCurrentJieQiSnapshot(this.state.currentTab, this.state.result, this.state.fields);
		});
	}

	gen24JieqiDom(){
		let dom = null;
		if(this.state.result.jieqi24 === undefined || this.state.result.jieqi24 === null){
			return dom;
		}

		let cols = this.state.result.jieqi24.map((item, idx)=>{
			const one = item || {};
			const fourCols = one && one.bazi && one.bazi.fourColumns ? one.bazi.fourColumns : null;
			const title = one.jieqi || `节气${idx + 1}`;
			return (
				<Col key={`${title}_${idx}`} span={6}>
					<Card title={title} bordered={false}>
						<Row>
							<Col span={24}>{one.time || '时间缺失'}</Col>
							{
								fourCols && fourCols.year && fourCols.month && fourCols.day && fourCols.time && (
									<Col span={24} style={{textAlign:'center'}}>
										<Row gutter={6}>
											<Col span={6}>
												{fourCols.year.ganzi}
											</Col>
											<Col span={6}>
												{fourCols.month.ganzi}
											</Col>
											<Col span={6}>
												{fourCols.day.ganzi}
											</Col>
											<Col span={6}>
												{fourCols.time.ganzi}
											</Col>
										</Row>
									</Col>	
								)
							}
							{
								fourCols && fourCols.year && fourCols.month && fourCols.day && fourCols.time && (
									<Col span={24} style={{textAlign:'center'}}>
										<Row gutter={6}>
											<Col span={6}>
												{fourCols.year.naying}
											</Col>
											<Col span={6}>
												{fourCols.month.naying}
											</Col>
											<Col span={6}>
												{fourCols.day.naying}
											</Col>
											<Col span={6}>
												{fourCols.time.naying}
											</Col>
										</Row>
									</Col>	
								)
							}
						</Row>					
					</Card>
				</Col>
			);
		});

		dom = (
			<Row gutter={12}>
				{cols}
			</Row>
		);
		return dom;
	}

	genTabsDom(height){
		let tabs = [];
		const charts = this.state.result.charts;
		if(charts){
			for(let i=0; i<this.state.jieqis.length; i++){
				let title = this.state.jieqis[i];
				let chart = charts[title] ? charts[title] : null;
				const hasRenderableChart = !!(chart && chart.params && chart.chart);
				let fallbackMessage = `${title}数据暂不可用，请点击右上“新命盘”重试。`;
				if(chart && chart.err){
					fallbackMessage = `${fallbackMessage}（${chart.err}）`;
				}
				const fallbackDom = (
					<Card bordered={false}>
						{fallbackMessage}
					</Card>
				);
				let flds = {
					...(this.props.fields || {}),
					...(this.state.fields || {}),
				};
				if(chart && chart.params){
					flds = paramsToFields(chart.params, flds);
				}
				const starKey = title;
				const suKey = '宿盘'+title;
				const d3Key = '3D盘'+title;
				const renderStar = this.state.currentTab === starKey;
				const renderSu = this.state.currentTab === suKey;
				const render3d = this.state.currentTab === d3Key;
				let tab = (
					<TabPane tab={title+'星盘'} key={starKey}>
						{renderStar ? (
						(hasRenderableChart ? (
							<AstroChartMain
								hidehsys={1}
								hidezodiacal={1}
								hidedateselector={true}
								height={height}
								fields={flds}
								value={chart}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}	
							/>
						) : fallbackDom)) : null}
					</TabPane>

				);
				tabs.push(tab);

				let sztab = (
					<TabPane tab={title+'宿盘'} key={suKey}>
						{renderSu ? (
						(hasRenderableChart ? (
							<SuZhanMain
								value={chart}
								height={height}
								fields={flds}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								hook={this.state.hook.suzhan}
								onFieldsChange={this.onSuZhanFieldsChange}
								dispatch={this.props.dispatch}
							/>
						) : fallbackDom)) : null}
					</TabPane>
				);
				tabs.push(sztab);

				let tab3d = (
					<TabPane tab={title+'3D盘'} key={d3Key}>
						{render3d ? (
						(hasRenderableChart ? (
							<AstroChartMain3D
								hidehsys={1}
								hidezodiacal={1}
								hidedateselector={true}
								needChart3D={true}
								value={chart}
								height={height}
								fields={flds}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}	
							/>
						) : fallbackDom)) : null}
					</TabPane>
				);
				tabs.push(tab3d);

			}
		}

		return tabs;
	}

	componentDidMount(){
		this.unmounted = false;
		if(this.props.fields){
			let st = fieldsToState(this.props.fields);
			this.setState(st, ()=>{
				if(this.unmounted){
					return;
				}
				this.requestJieQi();
			});
		}else{
			this.requestJieQi();
		}
	}

	componentDidUpdate(prevProps){
		const fieldsChanged = prevProps.fields !== this.props.fields;
		const planetChanged = prevProps.planetDisplay !== this.props.planetDisplay;
		if(!fieldsChanged && !planetChanged){
			return;
		}
		if(this.state.currentTab && this.state.currentTab.indexOf('宿盘') >= 0){
			this.saveCurrentJieQiSnapshot(this.state.currentTab, this.state.result, this.state.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this.snapshotTimer){
			if(typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function'){
				window.cancelIdleCallback(this.snapshotTimer);
			}else{
				clearTimeout(this.snapshotTimer);
			}
			this.snapshotTimer = null;
		}
	}

	render(){
		const height = resolveBoundedHeight(this.props.height);
		const tabsHeight = this.state.currentTab && this.state.currentTab.indexOf('宿盘') >= 0
			? height
			: Math.max(240, height - 44);
		let style = {
			height: tabsHeight,
			overflowY:'auto', 
			overflowX:'hidden',
		};


		const tabs = this.genTabsDom(tabsHeight);

		let jieqi24dom = this.gen24JieqiDom();

		let showInput = true;
		if(this.state.currentTab.indexOf('宿盘') >= 0){
			showInput = false;
		}

		return (
			<div id={this.state.divid} style={{ height, maxHeight: height, overflowY: 'auto', overflowX: 'hidden' }}>
				{
					showInput && (
					<Row gutter={6}>
						<Col span={8}>
							<DateTimeSelector
								value={this.state.time}
								onlyYear={true}
								showTime={false}
								showAdjust={false}
								onChange={this.onTimeChanged}
							/>
						</Col>
						<Col span={3}>
							<Select 
								style={{width: '100%'}}
								onChange={this.changeZodiacal}
								value={this.state.zodiacal} size='small'>
								<Option value={0}>回归黄道</Option>
								<Option value={1}>恒星黄道</Option>
							</Select>
						</Col>
						<Col span={3}>
							<Select style={{width:140}}
								onChange={this.changeHsys}
								value={this.state.hsys} 
								size='small'>
								{ getHousesOption() }
							</Select>
						</Col>
						<Col span={2}>
							<GeoCoordModal 
								onOk={this.changeGeo}
								lat={this.state.gpsLat} lng={this.state.gpsLon}
							>
								<Button size='small'>经纬度选择</Button>
							</GeoCoordModal>
						</Col>
						<Col span={4}>
							<span>{this.state.lon + ' ' + this.state.lat}</span>
						</Col>
					</Row>
	
					)
				}
				<Tabs 
					activeKey={this.state.currentTab}
					tabPosition='right'
					onChange={this.changeTab}
					destroyInactiveTabPane={true}
					style={{ height: tabsHeight, maxHeight: tabsHeight }}
				>
					<TabPane tab='二十四节气' key='二十四节气'>
						<div className={styles.scrollbar} style={style}>
						{jieqi24dom}
						</div>
					</TabPane>
					{ tabs }
				</Tabs>
			</div>
		);
	}
}

export default JieQiChartsMain;
