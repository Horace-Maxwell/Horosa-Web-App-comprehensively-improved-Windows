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
import { appendPlanetHouseInfo, appendPlanetHouseInfoById, } from '../../utils/planetHouseInfo';
import { normalizeContentHeight } from '../../utils/layout';
import {
	normalizeHouseSystemValue,
	normalizeZodiacalValue,
} from '../../utils/chartDisplay';

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
const AI_EXPORT_PLANET_INFO = {
	showHouse: 1,
	showRuler: 1,
};

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

function normalizeDoubingFlag(value){
	if(value === true || value === '1' || value === 1){
		return 1;
	}
	return 0;
}

function buildJieqiChartSignature(params, term, birth){
	return {
		title: `${term || ''}`,
		birth: `${birth || ''}`.trim(),
		hsys: normalizeHouseSystemValue(params && params.hsys),
		zodiacal: normalizeZodiacalValue(params && params.zodiacal),
		doubingSu28: normalizeDoubingFlag(params && params.doubingSu28),
	};
}

function isJieqiChartMatch(chartObj, params, term, birth){
	if(!chartObj || !chartObj.params){
		return false;
	}
	const expected = buildJieqiChartSignature(params, term, birth);
	const actual = buildJieqiChartSignature(chartObj.params, term, chartObj.params.birth || birth);
	return (
		expected.title === actual.title
		&& expected.birth === actual.birth
		&& expected.hsys === actual.hsys
		&& expected.zodiacal === actual.zodiacal
		&& expected.doubingSu28 === actual.doubingSu28
	);
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

function getJieqiFourColumns(item){
	if(!item){
		return null;
	}
	if(item.bazi && item.bazi.fourColumns){
		return item.bazi.fourColumns;
	}
	if(item.fourColumns){
		return item.fourColumns;
	}
	if(item.bazi){
		const fromBazi = toSimpleFourColumns(item.bazi);
		if(fromBazi){
			return fromBazi;
		}
	}
	if(item.nongli){
		return toSimpleFourColumns(item.nongli);
	}
	return null;
}

function normalizeFourColumnPart(part){
	const src = part || {};
	return {
		ganzi: src.ganzi ? `${src.ganzi}` : '',
		naying: src.naying ? `${src.naying}` : '',
	};
}

function compactFourColumns(fourCols){
	if(!fourCols){
		return null;
	}
	return {
		year: normalizeFourColumnPart(fourCols.year),
		month: normalizeFourColumnPart(fourCols.month),
		day: normalizeFourColumnPart(fourCols.day),
		time: normalizeFourColumnPart(fourCols.time),
	};
}

function compactJieqiSeedResult(result){
	if(!result || !Array.isArray(result.jieqi24)){
		return result;
	}
	const jieqi24 = result.jieqi24.map((item)=>{
		const fourCols = compactFourColumns(getJieqiFourColumns(item));
		return {
			ord: item && item.ord !== undefined ? item.ord : null,
			jieqi: item && item.jieqi ? `${item.jieqi}` : '',
			jie: item && item.jie !== undefined ? item.jie : null,
			time: item && item.time ? `${item.time}` : '',
			ad: item && item.ad !== undefined ? item.ad : null,
			bazi: fourCols ? { fourColumns: fourCols } : null,
		};
	});
	return {
		...result,
		jieqi24,
		charts: {},
	};
}

function mergeJieqiRows(baseRows, patchRows){
	const base = Array.isArray(baseRows) ? baseRows : [];
	const patch = Array.isArray(patchRows) ? patchRows : [];
	if(!base.length){
		return patch;
	}
	if(!patch.length){
		return base;
	}
	const patchMap = {};
	patch.forEach((row)=>{
		const key = row && row.jieqi ? `${row.jieqi}` : '';
		if(!key){
			return;
		}
		patchMap[key] = row;
	});
	return base.map((row)=>{
		const key = row && row.jieqi ? `${row.jieqi}` : '';
		const next = key ? patchMap[key] : null;
		if(!next){
			return row;
		}
		return {
			...row,
			ord: next.ord !== undefined ? next.ord : row.ord,
			jie: next.jie !== undefined ? next.jie : row.jie,
			time: next.time || row.time,
			ad: next.ad !== undefined ? next.ad : row.ad,
			bazi: next.bazi || row.bazi || null,
		};
	});
}

function cacheJieqiSeedRows(params, rows){
	if(!params || !Array.isArray(rows) || !rows.length){
		return;
	}
	const seed = {};
	rows.forEach((entry)=>{
		const term = entry && entry.jieqi ? `${entry.jieqi}` : '';
		const time = entry && entry.time ? `${entry.time}` : '';
		const fourCols = getJieqiFourColumns(entry);
		if(term && time){
			seed[term] = {
				term,
				time,
				dateKey: time.split(' ')[0].replace(/-/g, ''),
				dayGanzhi: fourCols && fourCols.day ? `${fourCols.day.ganzi || ''}` : '',
			};
		}
	});
	if(Object.keys(seed).length){
		setJieqiSeedLocalCache(params, seed);
	}
}

function findJieqiRow(rows, title){
	if(!Array.isArray(rows) || !title){
		return null;
	}
	for(let i = 0; i < rows.length; i += 1){
		const row = rows[i];
		if(row && row.jieqi === title){
			return row;
		}
	}
	return null;
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

function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		const val = AstroText.AstroMsg[id];
		if(isEncodedToken(val)){
			return `${id}`;
		}
		return `${val}`;
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
	let houseName = msg(house && house.id ? house.id : null) || `第${idx + 1}宫`;
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
	const signName = AstroText.AstroMsgCN[sign] || msg(sign);
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
				lines.push(`星曜：${appendPlanetHouseInfo(msg(obj.id), obj, AI_EXPORT_PLANET_INFO)} ${sd[0]}˚${su}${sd[1]}分`);
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
		lines.push(`黄道：${msg(chart.zodiacal)}`);
	}
	if(chart.hsys){
		lines.push(`宫制：${msg(chart.hsys)}`);
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
			lines.push(`${msg(house.id) || `第${idx + 1}宫`}：${Math.abs(deg[0] % 30)}˚${signs[sign]}${Math.abs(deg[1])}分`);
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
		lines.push(`${appendPlanetHouseInfoById(msg(obj.id), chartObj, obj.id, AI_EXPORT_PLANET_INFO)}：${sd[0]}˚${msg(obj.sign)}${sd[1]}分；宫位=${msg(obj.house)}`);
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

function tabNeedsJieqiCharts(currentTab, jieqis){
	return parseJieQiTab(currentTab, jieqis) !== null;
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
		this.pendingSeedRequest = null;
		this.lastSeedResultKey = '';
		this.chartRequestSeq = 0;
		this.pendingChartRequest = null;
		this.lastChartResultKey = '';
		this.baziRequestSeq = 0;
		this.pendingBaziRequest = null;
		this.lastBaziResultKey = '';

		this.changeTab = this.changeTab.bind(this);
		this.requestJieQi = this.requestJieQi.bind(this);
		this.requestJieQiCharts = this.requestJieQiCharts.bind(this);
		this.requestJieQiBazi = this.requestJieQiBazi.bind(this);
		this.currentTabNeedsCharts = this.currentTabNeedsCharts.bind(this);
		this.ensureChartsForTab = this.ensureChartsForTab.bind(this);
		this.genParams = this.genParams.bind(this);
		this.genSeedParams = this.genSeedParams.bind(this);
		this.genChartParams = this.genChartParams.bind(this);

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
		this.scheduleJieqiSnapshotSave = this.scheduleJieqiSnapshotSave.bind(this);

		let params = this.genSeedParams();
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

	genParams(includeJieqis=true){
		const params = {
			year: this.state.time.format('YYYY'),
			ad: this.state.ad,
			zone: this.state.zone,
			lon: this.state.lon,
			lat: this.state.lat,
			hsys: this.state.hsys,
			zodiacal: this.state.zodiacal,
			gpsLat: this.state.gpsLat,
			gpsLon: this.state.gpsLon,
			doubingSu28: this.state.doubingSu28,
		}
		if(includeJieqis){
			params.jieqis = this.state.jieqis;
		}
		return params;
	}

	genSeedParams(){
		return this.genParams(false);
	}

	genChartParams(seedParams){
		const base = seedParams || this.genSeedParams();
		return {
			...base,
			jieqis: this.state.jieqis,
		};
	}

	currentTabNeedsCharts(tab){
		return tabNeedsJieqiCharts(tab || this.state.currentTab, this.state.jieqis);
	}

	ensureChartsForTab(tab){
		if(!this.currentTabNeedsCharts(tab)){
			return null;
		}
		const titleInfo = parseJieQiTab(tab || this.state.currentTab, this.state.jieqis);
		const title = titleInfo && titleInfo.title ? titleInfo.title : null;
		const reqParams = this.genSeedParams();
		const rows = this.state.result && Array.isArray(this.state.result.jieqi24)
			? this.state.result.jieqi24 : [];
		const row = title ? findJieqiRow(rows, title) : null;
		const birth = row && row.time ? row.time : '';
		if(
			title
			&& birth
			&& this.state.result
			&& this.state.result.charts
			&& isJieqiChartMatch(this.state.result.charts[title], reqParams, title, birth)
		){
			return Promise.resolve(this.state.result.charts[title]);
		}
		return this.requestJieQiCharts(reqParams, this.requestSeq);
	}

	getSeedRequestKey(params){
		const p = params || this.genSeedParams();
		return [
			getSeedCacheKey(p),
			p && p.hsys,
			p && p.zodiacal,
			p && p.doubingSu28,
			p && p.seedOnly ? 1 : 0,
		].join('|');
	}

	getChartRequestKey(params, tab){
		const p = params || this.genSeedParams();
		const info = parseJieQiTab(tab || this.state.currentTab, this.state.jieqis);
		const title = info && info.title ? info.title : '';
		return [
			getSeedCacheKey(p),
			p && p.hsys,
			p && p.zodiacal,
			p && p.doubingSu28,
			title,
		].join('|');
	}

	async requestJieQi(){
		const seedParams = this.genSeedParams();
		const needsCharts = this.currentTabNeedsCharts();
		const flds = paramsToFields(seedParams, this.state.fields);
		const seq = ++this.requestSeq;
		this.setState({
			fields: flds,
		});
		if(needsCharts){
			this.requestJieQiCharts(seedParams, seq, this.state.currentTab);
		}
		return this.requestJieQiBazi(seedParams, seq);
	}

	async requestJieQiCharts(seedParams, seedSeq, tab){
		const currentTab = tab || this.state.currentTab;
		const info = parseJieQiTab(currentTab, this.state.jieqis);
		if(!info || !info.title){
			return null;
		}
		const title = info.title;
		const reqParams = seedParams || this.genSeedParams();
		const reqKey = this.getChartRequestKey(reqParams, currentTab);
		if(this.pendingChartRequest && this.pendingChartRequest.key === reqKey){
			return this.pendingChartRequest.promise;
		}
		const seq = ++this.chartRequestSeq;
		const reqPromise = (async()=>{
			let rows = this.state.result && Array.isArray(this.state.result.jieqi24)
				? this.state.result.jieqi24 : [];
			let row = findJieqiRow(rows, title);
			if(!row || !row.time){
				rows = await this.requestJieQiBazi(reqParams, seedSeq);
				row = findJieqiRow(rows, title);
			}
			if(!row || !row.time || this.unmounted){
				return null;
			}
			if(seedSeq !== undefined && seedSeq !== this.requestSeq){
				return null;
			}
			if(seq !== this.chartRequestSeq){
				return null;
			}
			const existingChart = this.state.result
				&& this.state.result.charts
				? this.state.result.charts[title]
				: null;
			if(isJieqiChartMatch(existingChart, reqParams, title, row.time)){
				this.lastChartResultKey = reqKey;
				return existingChart;
			}
			const chartObj = await loadJieqiChart(reqParams, title, row.time);
			if(!chartObj || this.unmounted){
				return chartObj;
			}
			if(seedSeq !== undefined && seedSeq !== this.requestSeq){
				return chartObj;
			}
			if(seq !== this.chartRequestSeq){
				return chartObj;
			}
			this.lastChartResultKey = reqKey;
			this.setState((prev)=>{
				const prevResult = prev.result || {};
				return {
					result: {
						...prevResult,
						charts: {
							...(prevResult.charts || {}),
							[title]: chartObj,
						},
					},
				};
				}, ()=>{
					this.saveCurrentJieQiSnapshot(this.state.currentTab, this.state.result, this.state.fields);
					this.scheduleJieqiSnapshotSave(this.state.result, this.state.fields, reqParams);
				});
			return chartObj;
		})().finally(()=>{
			if(this.pendingChartRequest && this.pendingChartRequest.seq === seq){
				this.pendingChartRequest = null;
			}
		});
		this.pendingChartRequest = {
			key: reqKey,
			seq,
			promise: reqPromise,
		};
		return reqPromise;
	}

	async requestJieQiBazi(seedParams, seedSeq){
		const reqKey = this.getSeedRequestKey(seedParams);
		if(this.pendingBaziRequest && this.pendingBaziRequest.key === reqKey){
			return this.pendingBaziRequest.promise;
		}
		if(this.lastBaziResultKey === reqKey
			&& this.state.result
			&& Array.isArray(this.state.result.jieqi24)
			&& this.state.result.jieqi24.some((item)=>item && item.bazi && item.bazi.fourColumns)){
			return this.state.result.jieqi24;
		}
		const seq = ++this.baziRequestSeq;
		const reqPromise = (async()=>{
			const fullResult = await fetchPreciseJieqiYear(seedParams);
			if(!fullResult || this.unmounted){
				return fullResult;
			}
			if(seedSeq !== undefined && seedSeq !== this.requestSeq){
				return fullResult;
			}
			if(seq !== this.baziRequestSeq){
				return fullResult;
			}
			const compact = compactJieqiSeedResult(fullResult);
			const fullRows = compact && Array.isArray(compact.jieqi24) ? compact.jieqi24 : [];
			if(!fullRows.length){
				return fullRows;
			}
			cacheJieqiSeedRows(seedParams, fullRows);
			this.lastBaziResultKey = reqKey;
			this.setState((prev)=>{
				const prevResult = prev.result || {};
				const mergedJieqi24 = mergeJieqiRows(prevResult.jieqi24, fullRows);
				return {
					result: {
						...prevResult,
						jieqi24: mergedJieqi24,
					},
				};
			}, ()=>{
				this.saveCurrentJieQiSnapshot(this.state.currentTab, this.state.result, this.state.fields);
				this.scheduleJieqiSnapshotSave(this.state.result, this.state.fields, seedParams);
			});
			return fullRows;
		})().finally(()=>{
			if(this.pendingBaziRequest && this.pendingBaziRequest.seq === seq){
				this.pendingBaziRequest = null;
			}
		});
		this.pendingBaziRequest = {
			key: reqKey,
			seq,
			promise: reqPromise,
		};
		return reqPromise;
	}

	scheduleJieqiSnapshotSave(result, fields, params){
		if(this.snapshotTimer){
			if(typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function'){
				window.cancelIdleCallback(this.snapshotTimer);
			}else{
				clearTimeout(this.snapshotTimer);
			}
			this.snapshotTimer = null;
		}
		const saveJob = ()=>{
			if(this.unmounted){
				return;
			}
			const p = params || {};
			saveModuleAISnapshot('jieqi', buildJieQiSnapshotText(result, fields, this.state.jieqis, this.props.planetDisplay), {
				year: p.year,
				zone: p.zone,
				lon: p.lon,
				lat: p.lat,
				hsys: p.hsys,
				zodiacal: p.zodiacal,
			});
			saveModuleAISnapshot('jieqi_current', buildJieQiCurrentSnapshotText(this.state.currentTab, result, fields, this.state.jieqis, this.props.planetDisplay), {
				year: p.year,
				zone: p.zone,
				lon: p.lon,
				lat: p.lat,
				hsys: p.hsys,
				zodiacal: p.zodiacal,
				currentTab: this.state.currentTab,
			});
		};
		// 节气快照在空闲时保存，避免主线程卡顿。
		if(typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'){
			this.snapshotTimer = window.requestIdleCallback(saveJob, { timeout: 1200 });
		}else{
			this.snapshotTimer = setTimeout(saveJob, 220);
		}
	}

	changeTab(key){
		this.setState({
			currentTab: key,
		}, ()=>{
			this.ensureChartsForTab(key);
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
			const fourCols = getJieqiFourColumns(item);
			const key = item && item.jieqi ? item.jieqi : `jieqi_${idx}`;
			const yearCol = fourCols && fourCols.year ? fourCols.year : null;
			const monthCol = fourCols && fourCols.month ? fourCols.month : null;
			const dayCol = fourCols && fourCols.day ? fourCols.day : null;
			const timeCol = fourCols && fourCols.time ? fourCols.time : null;
			return (
				<Col key={key} span={6}>
					<Card title={item && item.jieqi ? item.jieqi : ''} bordered={false}>
						<Row>
							<Col span={24}>{item && item.time ? item.time : ''}</Col>
							{
								yearCol && (
									<Col span={24} style={{textAlign:'center'}}>
										<Row gutter={6}>
											<Col span={6}>
												{yearCol.ganzi}
											</Col>
											<Col span={6}>
												{monthCol ? monthCol.ganzi : ''}
											</Col>
											<Col span={6}>
												{dayCol ? dayCol.ganzi : ''}
											</Col>
											<Col span={6}>
												{timeCol ? timeCol.ganzi : ''}
											</Col>
										</Row>
									</Col>	
								)
							}
							{
								yearCol && (
									<Col span={24} style={{textAlign:'center'}}>
										<Row gutter={6}>
											<Col span={6}>
												{yearCol.naying}
											</Col>
											<Col span={6}>
												{monthCol ? monthCol.naying : ''}
											</Col>
											<Col span={6}>
												{dayCol ? dayCol.naying : ''}
											</Col>
											<Col span={6}>
												{timeCol ? timeCol.naying : ''}
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
		const charts = this.state.result.charts || {};
		const rows = Array.isArray(this.state.result.jieqi24) ? this.state.result.jieqi24 : [];
		const reqParams = this.genSeedParams();
		for(let i=0; i<this.state.jieqis.length; i++){
			let title = this.state.jieqis[i];
			const row = findJieqiRow(rows, title);
			const birth = row && row.time ? row.time : '';
			let chart = isJieqiChartMatch(charts[title], reqParams, title, birth) ? charts[title] : null;
			if(!chart){
				tabs.push(
					<TabPane tab={title+'星盘'} key={title}>
						<div style={{ padding: 12 }}>加载中...</div>
					</TabPane>
				);
				tabs.push(
					<TabPane tab={title+'宿盘'} key={'宿盘'+title}>
						<div style={{ padding: 12 }}>加载中...</div>
					</TabPane>
				);
				tabs.push(
					<TabPane tab={title+'3D盘'} key={'3D盘'+title}>
						<div style={{ padding: 12 }}>加载中...</div>
					</TabPane>
				);
				continue;
			}
			let flds = {
				...(this.props.fields || {}),
				...(this.state.fields || {}),
			};
			if(chart.params){
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
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
						/>) : null}
				</TabPane>

			);
			tabs.push(tab);

			let sztab = (
				<TabPane tab={title+'宿盘'} key={suKey}>
					{renderSu ? (
					<SuZhanMain
						value={chart}
						height={height}
						fields={flds}
						chartDisplay={this.props.chartDisplay}
						planetDisplay={this.props.planetDisplay}
						hook={this.state.hook.suzhan}
						onFieldsChange={this.onSuZhanFieldsChange}
						dispatch={this.props.dispatch}
					/>) : null}
				</TabPane>
			);
			tabs.push(sztab);

			let tab3d = (
				<TabPane tab={title+'3D盘'} key={d3Key}>
					{render3d ? (
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
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
						/>) : null}
				</TabPane>
			);
			tabs.push(tab3d);

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
		const height = normalizeContentHeight(this.props.height);
		let showInput = true;
		if(this.state.currentTab.indexOf('宿盘') >= 0){
			showInput = false;
		}
		const tabsHeight = Math.max(260, height - (showInput ? 48 : 0));
		let style = {
			height: tabsHeight,
			overflowY:'auto', 
			overflowX:'hidden',
		};


		const tabs = this.genTabsDom(tabsHeight);

		let jieqi24dom = this.gen24JieqiDom();

		return (
			<div id={this.state.divid} style={{ height, maxHeight: height, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
					className='horosaFillTabs'
					style={{ height: tabsHeight, flex: '1 1 auto', minHeight: 0 }}
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
