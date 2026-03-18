import { Component } from 'react';
import { Row, Col, Button, Select, Divider } from 'antd';
import AstroDoubleChart from './AstroDoubleChart';
import PlusMinusTime from './PlusMinusTime';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { saveAstroAISnapshot, } from '../../utils/astroAiSnapshot';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import styles from '../../css/styles.less';
import DateTime from '../comp/DateTime';
import { randomStr, } from '../../utils/helper';

const Option = Select.Option;

const PD_SYNC_REV = 'pd_method_sync_v6';
const DEFAULT_PD_METHOD = 'astroapp_alchabitius';
const DEFAULT_PD_TIME_KEY = 'Ptolemy';
const DEFAULT_PD_TYPE = 0;
const PD_DISPLAY_ZONE = '+00:00';
const ASTROAPP_PD_SUPPORTED_BASE_IDS = new Set([
	AstroConst.SUN,
	AstroConst.MOON,
	AstroConst.MERCURY,
	AstroConst.VENUS,
	AstroConst.MARS,
	AstroConst.JUPITER,
	AstroConst.SATURN,
	AstroConst.URANUS,
	AstroConst.NEPTUNE,
	AstroConst.PLUTO,
	AstroConst.NORTH_NODE,
	AstroConst.ASC,
	AstroConst.MC,
]);

function norm360(val){
	let n = Number(val);
	if(!Number.isFinite(n)){
		return 0;
	}
	n = n % 360;
	if(n < 0){
		n += 360;
	}
	return n;
}

function splitDegreeText(value){
	const num = Number(value);
	if(!Number.isFinite(num)){
		return `${value || ''}`;
	}
	const neg = num < 0 ? '-' : '';
	const abs = Math.abs(num);
	const deg = Math.floor(abs + 1e-12);
	let minute = Math.round((abs - deg) * 60);
	if(minute >= 60){
		return `${neg}${deg + 1}度0分`;
	}
	return `${neg}${deg}度${minute}分`;
}

function parseCoord(value){
	const txt = `${value || ''}`.trim().toUpperCase();
	const match = txt.match(/^(\d+)([NSEW])(\d+)$/);
	if(match){
		let num = Number(match[1]) + Number(match[3]) / 60.0;
		if(match[2] === 'S' || match[2] === 'W'){
			num = -num;
		}
		return num;
	}
	const num = Number(value);
	return Number.isFinite(num) ? num : 0;
}

function buildBirthDateTime(chartObj){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const birth = `${params.birth || ''}`.trim();
	if(!birth){
		return null;
	}
	const parts = birth.split(' ');
	if(parts.length < 2){
		return null;
	}
	const dt = new DateTime();
	let text = `${parts[0]} ${parts[1]}`;
	if(parts[1].split(':').length === 2){
		text = `${text}:00`;
	}
	try{
		dt.parse(text, 'YYYY-MM-DD HH:mm:ss');
		if(params.zone){
			dt.zone = params.zone;
			dt.calcJdn();
		}
		return dt;
	}catch(e){
		return null;
	}
}

function parseDisplayDateTime(text, zone){
	const txt = `${text || ''}`.trim();
	if(!txt){
		return null;
	}
	const dt = new DateTime();
	try{
		dt.parse(txt, 'YYYY-MM-DD HH:mm:ss');
		if(zone){
			dt.zone = zone;
			dt.calcJdn();
		}
		return dt;
	}catch(e){
		return null;
	}
}

function getPdJdnFromArc(birthDt, arc){
	if(!birthDt){
		return 0;
	}
	const magnitude = Math.abs(Number(arc));
	if(!Number.isFinite(magnitude)){
		return birthDt.jdn;
	}
	const years = Math.floor(magnitude + 1e-12);
	const fraction = magnitude - years;
	const whole = birthDt.clone();
	whole.addYear(years);
	const next = birthDt.clone();
	next.addYear(years + 1);
	const wholeDays = whole.jdn - birthDt.jdn;
	const spanDays = next.jdn - whole.jdn;
	return birthDt.jdn + wholeDays + fraction * spanDays;
}

function getPdArcFromDate(birthDt, currentDt){
	if(!birthDt || !currentDt){
		return 0;
	}
	const target = Number(currentDt.jdn);
	if(!Number.isFinite(target) || target <= birthDt.jdn){
		return 0;
	}
	let low = 0;
	let high = Math.max(1, Math.ceil((target - birthDt.jdn) / 365) + 2);
	for(let i=0; i<16; i++){
		if(getPdJdnFromArc(birthDt, high) >= target){
			break;
		}
		high *= 2;
	}
	for(let i=0; i<64; i++){
		const mid = (low + high) / 2;
		const midJd = getPdJdnFromArc(birthDt, mid);
		if(midJd < target){
			low = mid;
		}else{
			high = mid;
		}
	}
	return (low + high) / 2;
}

function isBoundDirectionRow(pd){
	if(!pd || !pd.length){
		return false;
	}
	const prom = `${pd[1] || ''}`;
	const sig = `${pd[2] || ''}`;
	return prom.indexOf('T_') === 0 || sig.indexOf('T_') === 0;
}

function isAntisciaDirectionRow(pd){
	if(!pd || !pd.length){
		return false;
	}
	const prom = `${pd[1] || ''}`;
	const sig = `${pd[2] || ''}`;
	return prom.indexOf('A_') === 0 || prom.indexOf('C_') === 0
		|| sig.indexOf('A_') === 0 || sig.indexOf('C_') === 0;
}

function baseDirectionObjectId(text){
	const parts = `${text || ''}`.split('_');
	if(parts.length < 3){
		if(parts.length === 2 && (parts[0] === 'A' || parts[0] === 'C')){
			return parts[1];
		}
		return `${text || ''}`.trim();
	}
	if(parts[0] === 'T'){
		return `${parts[1] || ''}`.trim();
	}
	return parts.slice(1, parts.length - 1).join('_').trim();
}

function isAstroAppUnsupportedDirectionRow(pd){
	if(!pd || !pd.length){
		return false;
	}
	if(isBoundDirectionRow(pd)){
		return true;
	}
	const promBase = baseDirectionObjectId(pd[1]);
	const sigBase = baseDirectionObjectId(pd[2]);
	return !ASTROAPP_PD_SUPPORTED_BASE_IDS.has(promBase) || !ASTROAPP_PD_SUPPORTED_BASE_IDS.has(sigBase);
}

function buildDisplayRows(chartObj, pdMethod, showPdBounds){
	const predictives = chartObj && chartObj.predictives ? chartObj.predictives : {};
	const raw = Array.isArray(predictives.primaryDirection) ? predictives.primaryDirection : [];
	const rows = [];
	const hideBounds = showPdBounds === 0 || showPdBounds === false ? true : false;
	const isAstroApp = pdMethod === 'astroapp_alchabitius';
	raw.forEach((pd, index)=>{
		if(isAstroApp && isAstroAppUnsupportedDirectionRow(pd)){
			return;
		}
		if(hideBounds && isBoundDirectionRow(pd)){
			return;
		}
		if(isAstroApp && isAntisciaDirectionRow(pd)){
			return;
		}
		rows.push({
			Seq: index,
			Degree: Number(pd && pd[0]),
			Promittor: pd && pd[1] ? `${pd[1]}` : '',
			Significator: pd && pd[2] ? `${pd[2]}` : '',
			Date: pd && pd[4] ? `${pd[4]}` : '',
		});
	});
	return rows;
}

function normalizeSignDegree(value){
	const num = Number(value);
	if(!Number.isFinite(num)){
		return null;
	}
	let degree = num % 30;
	if(degree < 0){
		degree += 30;
	}
	return degree;
}

function buildAscTermHighlight(dirChart){
	const chart = dirChart && dirChart.chart ? dirChart.chart : null;
	if(!chart){
		return null;
	}
	const objects = Array.isArray(chart.objects) ? chart.objects : [];
	let asc = null;
	for(let i=0; i<objects.length; i++){
		if(objects[i] && objects[i].id === AstroConst.ASC){
			asc = objects[i];
			break;
		}
	}
	const houses = Array.isArray(chart.houses) ? chart.houses : [];
	const house1 = houses.length > 0 ? houses[0] : null;
	const sign = asc && asc.sign ? asc.sign : house1 && house1.sign ? house1.sign : null;
	const degree = normalizeSignDegree(
		asc && asc.signlon !== undefined && asc.signlon !== null
			? asc.signlon
			: house1 && house1.signlon !== undefined && house1.signlon !== null
				? house1.signlon
				: null
	);
	if(!sign || degree === null){
		return null;
	}
	const terms = AstroConst.EGYPTIAN_TERMS[sign];
	if(!Array.isArray(terms) || terms.length === 0){
		return null;
	}
	for(let i=0; i<terms.length; i++){
		const term = terms[i];
		if(term[1] <= degree && degree < term[2]){
			return {
				sign,
				signLabel: AstroText.AstroMsgCN[sign] || sign,
				degree,
				start: term[1],
				end: term[2],
				owner: term[0],
				ownerLabel: AstroText.AstroMsgCN[term[0]] || term[0],
				markerId: AstroConst.ASC,
				markerLabel: 'ASC',
			};
		}
	}
	return null;
}

function buildSnapshotText(chartObj, currentDt, currentArc){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const lines = [];
	lines.push('[出生时间]');
	lines.push(`出生时间：${params.birth || '无'}`);
	lines.push('');
	lines.push('[星盘信息]');
	lines.push(`经纬度：${params.lon || ''} ${params.lat || ''}`.trim() || '无');
	lines.push(`时区：${params.zone || '无'}`);
	lines.push('');
	lines.push('[主限法盘设置]');
	lines.push(`时间选择：${currentDt ? currentDt.format('YYYY-MM-DD HH:mm:ss') : '无'}`);
	lines.push(`推运方法：${params.pdMethod === 'horosa_legacy' ? 'Horosa原方法' : 'Alchabitius'}`);
		lines.push(`度数换算：${params.pdTimeKey || DEFAULT_PD_TIME_KEY}`);
	lines.push(`当前Arc：${splitDegreeText(currentArc)}`);
	lines.push('');
	lines.push('[主限法盘说明]');
	lines.push('左侧双盘内圈为本命盘，外圈为按当前主限法设置和所选时间推导出的主限法盘位置。');
	lines.push('当前页面会先将所选时间换算为主限年龄弧，再按后台主限法算法推进各星曜与虚点，最后统一投影回黄道后与本命盘套盘显示。');
	return lines.join('\n');
}

function buildFieldsFromChartObj(baseFields, chartObj, pdMethod, pdTimeKey){
	const fields = {
		...(baseFields || {}),
	};
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const birth = `${params.birth || ''}`.trim();
	if(birth){
		const birthDt = new DateTime();
		try{
			birthDt.parse(birth, 'YYYY-MM-DD HH:mm:ss');
			if(params.zone){
				birthDt.zone = params.zone;
				birthDt.calcJdn();
			}
			fields.date = {
				...(fields.date || { name: ['date'] }),
				value: birthDt.clone(),
			};
			fields.time = {
				...(fields.time || { name: ['time'] }),
				value: birthDt.clone(),
			};
			fields.ad = {
				...(fields.ad || { name: ['ad'] }),
				value: birthDt.ad,
			};
			fields.zone = {
				...(fields.zone || { name: ['zone'] }),
				value: birthDt.zone,
			};
		}catch(e){
			// Keep existing field values if parsing fails.
		}
	}
	const assign = (key, val, fallback)=>{
		fields[key] = {
			...(fields[key] || { name: [key] }),
			value: val !== undefined && val !== null ? val : fallback,
		};
	};
	assign('lat', params.lat, fields.lat ? fields.lat.value : '');
	assign('lon', params.lon, fields.lon ? fields.lon.value : '');
	assign('gpsLat', params.gpsLat !== undefined && params.gpsLat !== null ? params.gpsLat : params.lat, fields.gpsLat ? fields.gpsLat.value : '');
	assign('gpsLon', params.gpsLon !== undefined && params.gpsLon !== null ? params.gpsLon : params.lon, fields.gpsLon ? fields.gpsLon.value : '');
	assign('hsys', params.hsys, fields.hsys ? fields.hsys.value : 0);
	assign('zodiacal', params.zodiacal, fields.zodiacal ? fields.zodiacal.value : 0);
	assign('tradition', params.tradition, fields.tradition ? fields.tradition.value : 0);
	assign('strongRecption', params.strongRecption, fields.strongRecption ? fields.strongRecption.value : 0);
	assign('simpleAsp', params.simpleAsp, fields.simpleAsp ? fields.simpleAsp.value : 0);
	assign('virtualPointReceiveAsp', params.virtualPointReceiveAsp, fields.virtualPointReceiveAsp ? fields.virtualPointReceiveAsp.value : 0);
	assign('doubingSu28', params.doubingSu28, fields.doubingSu28 ? fields.doubingSu28.value : 0);
	assign('predictive', 1, 1);
	assign('showPdBounds', params.showPdBounds === 0 ? 0 : 1, 1);
	assign('pdtype', 0, 0);
	assign('pdMethod', pdMethod, DEFAULT_PD_METHOD);
	assign('pdTimeKey', pdTimeKey, DEFAULT_PD_TIME_KEY);
	assign('pdaspects', params.pdaspects, fields.pdaspects ? fields.pdaspects.value : [0, 60, 90, 120, 180]);
	assign('name', params.name, fields.name ? fields.name.value : null);
	assign('pos', params.pos, fields.pos ? fields.pos.value : null);
	assign('southchart', params.southchart, fields.southchart ? fields.southchart.value : 0);
	assign('cid', null, null);
	return fields;
}

class AstroPrimaryDirectionChart extends Component{

	constructor(props) {
		super(props);
		const initialDateTime = this.buildDefaultDateTime(props.value);
		this.unmounted = false;
		this.requestSeq = 0;
		this.state = {
			datetime: initialDateTime,
			birthKey: this.buildBirthKey(props.value),
			pdMethodValue: this.normalizePdMethod(props.pdMethod),
			pdTimeKeyValue: this.normalizePdTimeKey(props.pdTimeKey),
			dirChart: null,
		};

		this.handleTimeChanged = this.handleTimeChanged.bind(this);
		this.handlePdMethodChange = this.handlePdMethodChange.bind(this);
		this.handlePdTimeKeyChange = this.handlePdTimeKeyChange.bind(this);
		this.handlePdCalculate = this.handlePdCalculate.bind(this);
		this.normalizePdMethod = this.normalizePdMethod.bind(this);
		this.normalizePdTimeKey = this.normalizePdTimeKey.bind(this);
		this.normalizePdType = this.normalizePdType.bind(this);
		this.getAppliedPdState = this.getAppliedPdState.bind(this);
		this.getSelectedPdMethod = this.getSelectedPdMethod.bind(this);
		this.getSelectedPdTimeKey = this.getSelectedPdTimeKey.bind(this);
		this.needsPdRecompute = this.needsPdRecompute.bind(this);
		this.buildDerived = this.buildDerived.bind(this);
		this.buildDefaultDateTime = this.buildDefaultDateTime.bind(this);
		this.buildBirthKey = this.buildBirthKey.bind(this);
		this.buildRequestParams = this.buildRequestParams.bind(this);
		this.requestDirectedChart = this.requestDirectedChart.bind(this);
		this.requestChartRefresh = this.requestChartRefresh.bind(this);
		this.saveSnapshot = this.saveSnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (chartObj)=>{
				if(this.unmounted){
					return;
				}
				const nextKey = this.buildBirthKey(chartObj);
				if(nextKey !== this.state.birthKey){
					this.setState({
						datetime: this.buildDefaultDateTime(chartObj),
						birthKey: nextKey,
						dirChart: null,
					}, ()=>{
						this.requestDirectedChart();
					});
				}
			};
		}
	}

	componentDidMount(){
		this.unmounted = false;
		if(typeof window !== 'undefined' && window.addEventListener){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.requestDirectedChart();
		this.saveSnapshot();
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(typeof window !== 'undefined' && window.removeEventListener){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentDidUpdate(prevProps, prevState){
		const nextMethod = this.normalizePdMethod(this.props.pdMethod);
		const nextTimeKey = this.normalizePdTimeKey(this.props.pdTimeKey);
		if(prevProps.pdMethod !== this.props.pdMethod || prevProps.pdTimeKey !== this.props.pdTimeKey){
			if(this.state.pdMethodValue !== nextMethod || this.state.pdTimeKeyValue !== nextTimeKey){
				this.setState({
					pdMethodValue: nextMethod,
					pdTimeKeyValue: nextTimeKey,
				}, ()=>{
					this.requestDirectedChart();
				});
				return;
			}
		}
		const nextBirthKey = this.buildBirthKey(this.props.value);
		if(nextBirthKey !== this.state.birthKey){
			this.setState({
				datetime: this.buildDefaultDateTime(this.props.value),
				birthKey: nextBirthKey,
				dirChart: null,
			}, ()=>{
				this.requestDirectedChart();
			});
			return;
		}
		if(
			prevProps.value !== this.props.value
			|| prevState.datetime !== this.state.datetime
			|| prevState.pdMethodValue !== this.state.pdMethodValue
			|| prevState.pdTimeKeyValue !== this.state.pdTimeKeyValue
		){
			this.requestDirectedChart();
		}
		if(
			prevProps.value !== this.props.value
			|| prevProps.showPdBounds !== this.props.showPdBounds
			|| prevProps.pdMethod !== this.props.pdMethod
			|| prevProps.pdTimeKey !== this.props.pdTimeKey
			|| prevState.pdMethodValue !== this.state.pdMethodValue
			|| prevState.pdTimeKeyValue !== this.state.pdTimeKeyValue
			|| prevState.datetime !== this.state.datetime
			|| prevState.dirChart !== this.state.dirChart
		){
			this.saveSnapshot();
		}
	}

	buildBirthKey(chartObj){
		const params = chartObj && chartObj.params ? chartObj.params : {};
		return [
			params.birth || '',
			params.zone || '',
			params.lon || '',
			params.lat || '',
			chartObj && chartObj.chartId ? chartObj.chartId : '',
		].join('|');
	}

	buildDefaultDateTime(chartObj){
		const birthDt = buildBirthDateTime(chartObj);
		const params = chartObj && chartObj.params ? chartObj.params : {};
		const rows = buildDisplayRows(chartObj || {}, params.pdMethod || DEFAULT_PD_METHOD, params.showPdBounds);
		for(let i=0; i<rows.length; i++){
			const dt = parseDisplayDateTime(rows[i].Date, PD_DISPLAY_ZONE);
			if(dt){
				return dt;
			}
		}
		if(birthDt){
			const next = birthDt.clone();
			next.addDate(1);
			next.zone = PD_DISPLAY_ZONE;
			next.calcJdn();
			return next;
		}
		return new DateTime();
	}

	normalizePdMethod(value){
		if(value === 'horosa_legacy' || value === 'astroapp_alchabitius'){
			return value;
		}
		return DEFAULT_PD_METHOD;
	}

	normalizePdTimeKey(value){
		if(value === 'Ptolemy'){
			return value;
		}
		return DEFAULT_PD_TIME_KEY;
	}

	normalizePdType(value){
		const num = Number(value);
		if(Number.isNaN(num)){
			return DEFAULT_PD_TYPE;
		}
		return num;
	}

	getSelectedPdMethod(){
		return this.normalizePdMethod(this.state.pdMethodValue);
	}

	getSelectedPdTimeKey(){
		return this.normalizePdTimeKey(this.state.pdTimeKeyValue);
	}

	getAppliedPdState(){
		const chart = this.props.value ? this.props.value : {};
		const params = chart && chart.params ? chart.params : {};
		const hasMethod = params.pdMethod !== undefined && params.pdMethod !== null && `${params.pdMethod}` !== '';
		const hasTimeKey = params.pdTimeKey !== undefined && params.pdTimeKey !== null && `${params.pdTimeKey}` !== '';
		const hasPdType = params.pdtype !== undefined && params.pdtype !== null && `${params.pdtype}` !== '';
		const syncRev = params.pdSyncRev ? `${params.pdSyncRev}` : '';
		const hasCompleteParams = hasMethod && hasTimeKey && hasPdType && syncRev === PD_SYNC_REV;
		return {
			hasCompleteParams,
			pdMethod: this.normalizePdMethod(hasMethod ? params.pdMethod : this.props.pdMethod),
			pdTimeKey: this.normalizePdTimeKey(hasTimeKey ? params.pdTimeKey : this.props.pdTimeKey),
			pdtype: this.normalizePdType(hasPdType ? params.pdtype : DEFAULT_PD_TYPE),
		};
	}

	needsPdRecompute(){
		const chart = this.props.value ? this.props.value : {};
		const predictives = chart.predictives ? chart.predictives : {};
		const pds = predictives.primaryDirection ? predictives.primaryDirection : [];
		const applied = this.getAppliedPdState();
		if(this.getSelectedPdMethod() !== applied.pdMethod || this.getSelectedPdTimeKey() !== applied.pdTimeKey){
			return true;
		}
		if(!applied.hasCompleteParams){
			return true;
		}
		if(applied.pdtype !== DEFAULT_PD_TYPE){
			return true;
		}
		return !(Array.isArray(pds) && pds.length > 0);
	}

	handleTimeChanged(val){
		if(!val || !val.time){
			return;
		}
		const next = val.time instanceof DateTime ? val.time : val.time.time;
		if(next){
			this.setState({
				datetime: next.clone ? next.clone() : next,
			});
		}
	}

	handlePdMethodChange(value){
		this.setState({
			pdMethodValue: value,
		});
	}

	handlePdTimeKeyChange(value){
		this.setState({
			pdTimeKeyValue: value,
		});
	}

	handlePdCalculate(){
		if(!this.needsPdRecompute()){
			return;
		}
		if(this.props.dispatch){
			this.requestChartRefresh();
			return;
		}
		if(this.props.onPdConfigApply){
			this.props.onPdConfigApply(
				this.state.pdMethodValue,
				this.state.pdTimeKeyValue
			);
		}
	}

	buildChartRequestParams(){
		const chartObj = this.props.value || {};
		const params = chartObj && chartObj.params ? chartObj.params : {};
		const birth = `${params.birth || ''}`.trim();
		if(!birth){
			return null;
		}
		const parts = birth.split(' ');
		return {
			date: parts[0],
			time: parts[1] || '00:00:00',
			ad: params.ad !== undefined && params.ad !== null ? params.ad : 1,
			zone: params.zone,
			lon: params.lon,
			lat: params.lat,
			gpsLat: params.gpsLat !== undefined && params.gpsLat !== null ? params.gpsLat : params.lat,
			gpsLon: params.gpsLon !== undefined && params.gpsLon !== null ? params.gpsLon : params.lon,
			hsys: params.hsys,
			zodiacal: params.zodiacal,
			tradition: params.tradition,
			strongRecption: params.strongRecption !== undefined ? params.strongRecption : false,
			simpleAsp: params.simpleAsp !== undefined ? params.simpleAsp : false,
			virtualPointReceiveAsp: params.virtualPointReceiveAsp !== undefined ? params.virtualPointReceiveAsp : false,
			doubingSu28: params.doubingSu28 !== undefined ? params.doubingSu28 : false,
			southchart: params.southchart !== undefined ? params.southchart : false,
			predictive: true,
			showPdBounds: params.showPdBounds === 0 ? 0 : 1,
			pdtype: DEFAULT_PD_TYPE,
			pdMethod: this.getSelectedPdMethod(),
			pdTimeKey: this.getSelectedPdTimeKey(),
			pdaspects: params.pdaspects || [0, 60, 90, 120, 180],
			name: params.name,
			pos: params.pos,
			cid: null,
		};
	}

	async requestChartRefresh(){
		if(!this.props.dispatch){
			return;
		}
		const req = this.buildChartRequestParams();
		if(!req){
			return;
		}
		const chartObj = this.props.value || {};
		const nextFields = buildFieldsFromChartObj(
			this.props.fields,
			chartObj,
			this.getSelectedPdMethod(),
			this.getSelectedPdTimeKey()
		);
		if(!nextFields || !nextFields.date || !nextFields.time || !nextFields.zone || !nextFields.lat || !nextFields.lon){
			return;
		}
		let pdRows = null;
		try{
			const data = await request(`${Constants.ServerRoot}/predict/pd`, {
				body: JSON.stringify(req),
				cache: 'no-store',
			});
			const result = data ? data[Constants.ResultKey] : null;
			pdRows = result && Array.isArray(result.pd) ? result.pd : null;
		}catch(e){
			pdRows = null;
		}
		if(this.unmounted || !Array.isArray(pdRows)){
			return;
		}
		const nextChartObj = {
			...chartObj,
			params: {
				...(chartObj.params || {}),
				name: req.name,
				pos: req.pos,
				showPdBounds: req.showPdBounds === 0 ? 0 : 1,
				pdtype: DEFAULT_PD_TYPE,
				pdMethod: this.getSelectedPdMethod(),
				pdTimeKey: this.getSelectedPdTimeKey(),
				pdSyncRev: PD_SYNC_REV,
			},
			predictives: {
				...(chartObj.predictives || {}),
				primaryDirection: pdRows,
			},
			chartId: randomStr(8),
		};
		saveAstroAISnapshot(nextChartObj, nextFields);
		this.props.dispatch({
			type: 'app/save',
			payload: {
				pdMethod: this.getSelectedPdMethod(),
				pdTimeKey: this.getSelectedPdTimeKey(),
			},
		});
		this.props.dispatch({
			type: 'astro/save',
			payload: {
				chartObj: nextChartObj,
				fields: nextFields,
			},
		});
		this.props.dispatch({
			type: 'astro/doHook',
			payload: {
				chartObj: nextChartObj,
				fields: nextFields,
			},
		});
	}

	buildRequestParams(){
		const chartObj = this.props.value || {};
		const params = chartObj && chartObj.params ? chartObj.params : {};
		const currentDt = this.state.datetime ? this.state.datetime.clone() : this.buildDefaultDateTime(chartObj);
		if(!params.birth || !currentDt){
			return null;
		}
		const birthParts = `${params.birth}`.split(' ');
		return {
			date: birthParts[0],
			time: birthParts[1] || '00:00:00',
			ad: params.ad ? params.ad : 1,
			zone: params.zone,
			dirZone: currentDt.zone || params.zone,
			lon: params.lon,
			lat: params.lat,
			gpsLat: params.gpsLat,
			gpsLon: params.gpsLon,
			hsys: params.hsys,
			zodiacal: params.zodiacal,
			tradition: params.tradition,
			pdtype: DEFAULT_PD_TYPE,
			pdMethod: this.getSelectedPdMethod(),
			pdTimeKey: this.getSelectedPdTimeKey(),
			showPdBounds: params.showPdBounds,
			datetime: currentDt.format('YYYY-MM-DD HH:mm:ss'),
		};
	}

	async requestDirectedChart(){
		const params = this.buildRequestParams();
		if(!params || !this.props.value){
			return;
		}
		const seq = ++this.requestSeq;
		let result = null;
		try{
			const data = await request(`${Constants.ServerRoot}/predict/pdchart`, {
				body: JSON.stringify(params),
				cache: 'no-store',
			});
			result = data[Constants.ResultKey];
		}catch(e){
			result = null;
		}
		if(this.unmounted || seq !== this.requestSeq){
			return;
		}
		if(!result || result.err){
			this.setState({
				dirChart: null,
			});
			return;
		}
		this.setState({
			dirChart: result,
		});
	}

	buildDerived(){
		const chartObj = this.props.value || {};
		const currentDt = this.state.datetime ? this.state.datetime.clone() : this.buildDefaultDateTime(chartObj);
		const birthDt = buildBirthDateTime(chartObj);
		const dirChart = this.state.dirChart ? {
			...this.state.dirChart,
			natalChart: chartObj,
		} : null;
		const currentArc = dirChart && Number.isFinite(Number(dirChart.arc))
			? Number(dirChart.arc)
			: getPdArcFromDate(birthDt, currentDt);
		return {
			birthDt,
			currentDt,
			currentArc,
			dirChart,
		};
	}

	saveSnapshot(){
		const chartObj = this.props.value || {};
		const derived = this.buildDerived();
		const snapshotChartObj = {
			...chartObj,
			params: {
				...(chartObj.params || {}),
				pdMethod: this.getSelectedPdMethod(),
				pdTimeKey: this.getSelectedPdTimeKey(),
			},
		};
		const txt = buildSnapshotText(snapshotChartObj, derived.currentDt, derived.currentArc);
		if(!txt){
			return '';
		}
		saveModuleAISnapshot('primarydirchart', txt, {
			tab: 'primarydirchart',
			pdMethod: this.getAppliedPdState().pdMethod,
			pdTimeKey: this.getAppliedPdState().pdTimeKey,
			datetime: derived.currentDt ? derived.currentDt.format('YYYY-MM-DD HH:mm:ss') : '',
		});
		return txt;
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || typeof evt.detail !== 'object'){
			return;
		}
		if(evt.detail.module !== 'primarydirchart'){
			return;
		}
		const txt = this.saveSnapshot();
		if(txt){
			evt.detail.snapshotText = txt;
		}
	}

	render(){
		const chartObj = this.props.value || {};
		const derived = this.buildDerived();
		const height = this.props.height ? this.props.height : 760;
		const style = {
			height: `${height-20}px`,
			overflowY: 'auto',
			overflowX: 'hidden',
		};
		const chartWrap = {
			natualChart: chartObj,
			dirChart: derived.dirChart,
			inverse: false,
		};
		const applied = this.getAppliedPdState();
		const dirty = this.needsPdRecompute();
		const buttonText = dirty ? (applied.hasCompleteParams ? '重新计算' : '计算') : '已同步';
		const selectedPdMethod = this.getSelectedPdMethod();
		const selectedPdTimeKey = this.getSelectedPdTimeKey();
		const ascTermHighlight = buildAscTermHighlight(derived.dirChart);
		const pdMethodLabel = selectedPdMethod === 'horosa_legacy' ? 'Horosa原方法' : 'Alchabitius';
		const appliedMethodLabel = applied.pdMethod === 'horosa_legacy' ? 'Horosa原方法' : 'Alchabitius';
		const sectionGapStyle = {marginTop: 6};
		const hintStyle = {
			color: 'rgba(0, 0, 0, 0.65)',
			lineHeight: 1.85,
		};

		return (
			<div>
				<Row gutter={6}>
					<Col span={17}>
							<AstroDoubleChart
							value={chartWrap}
							height={height}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							chartDisplay={this.props.chartDisplay}
							termHighlight={ascTermHighlight}
							showAstroMeaning={this.props.showAstroMeaning}
						/>
					</Col>
					<Col span={7}>
						<div className={styles.scrollbar} style={style}>
							<Divider orientation='left'>时间选择</Divider>
							<Row>
								<Col span={24}>
									<PlusMinusTime
										value={derived.currentDt}
										startTime={derived.birthDt || undefined}
										needZone={true}
										showAdjust={true}
										onAfterChanged={this.handleTimeChanged}
									/>
								</Col>
							</Row>
							<Divider orientation='left'>主限法设置</Divider>
							<Row gutter={12} style={sectionGapStyle}>
								<Col span={24}>
									<div style={{marginBottom: 8}}>推运方法</div>
									<Select value={this.state.pdMethodValue} onChange={this.handlePdMethodChange} style={{width: '100%'}}>
						<Option value='astroapp_alchabitius'>Alchabitius</Option>
										<Option value='horosa_legacy'>Horosa原方法</Option>
									</Select>
								</Col>
							</Row>
							<Row gutter={12} style={{marginTop: 16}}>
								<Col span={24}>
									<div style={{marginBottom: 8}}>度数换算</div>
									<Select value={this.state.pdTimeKeyValue} onChange={this.handlePdTimeKeyChange} style={{width: '100%'}}>
										<Option value='Ptolemy'>Ptolemy</Option>
									</Select>
								</Col>
							</Row>
							<Row style={{marginTop: 16}}>
								<Col span={24}>
									<Button type='primary' disabled={!dirty} onClick={this.handlePdCalculate} style={{width: '100%'}}>
										{buttonText}
									</Button>
								</Col>
							</Row>
							<Divider orientation='left'>当前状态</Divider>
							<div style={{lineHeight: 1.9}}>
								<div>当前盘面方法：{pdMethodLabel}</div>
								<div>当前盘面度数换算：{selectedPdTimeKey}</div>
								{dirty ? <div>主/界限法表格已应用方法：{appliedMethodLabel} / {applied.pdTimeKey}</div> : null}
								<div>当前主限法年龄：{splitDegreeText(derived.currentArc)}</div>
								<div>外圈时间：{derived.currentDt ? derived.currentDt.format('YYYY-MM-DD HH:mm:ss') : '无'}</div>
								{ascTermHighlight ? (
									<div>
										当前ASC所在界：{ascTermHighlight.ownerLabel}界（{ascTermHighlight.signLabel} {splitDegreeText(ascTermHighlight.start)} - {splitDegreeText(ascTermHighlight.end)}）
									</div>
								) : null}
							</div>
							<Divider orientation='left'>说明</Divider>
							<div style={hintStyle}>
								<div>
									左侧双盘内圈为本命盘，外圈为按当前主限法设置和所选时间推导出的主限法盘位置。
								</div>
								<div>
									外圈位置会先按右侧时间换算主限年龄弧，再按后台主限法算法推进各星曜与虚点，并统一投影到黄道后与本命盘套盘显示。
								</div>
								<div>
									{dirty
										? '左侧主限法盘会立即按右侧所选方法与时间换算重绘；点击“计算/重新计算”后，主/界限法表格也会同步到同一套设置。'
										: '当前页面已与“主/界限法”同步，切换时间后会继续按当前设置推演任意时刻的外圈位置。'}
								</div>
							</div>
						</div>
					</Col>
				</Row>
			</div>
		);
	}
}

export default AstroPrimaryDirectionChart;
