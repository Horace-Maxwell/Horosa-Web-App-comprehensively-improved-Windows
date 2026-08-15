import { Component } from 'react';
import { saveDerivedAstroSnapshot } from '../../utils/derivedAstroSnapshot';
import { classicalBackendOverridesFromFields } from '../../utils/classicalChartGlobals';
import AstroChartMain from '../astro/AstroChartMain';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { randomStr, } from '../../utils/helper';
import styles from '../../css/styles.less';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { markPanelReady } from '../../utils/perfMark';

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
		hsys: fields.hsys.value,
		zodiacal: fields.zodiacal.value, siderealAyanamsa: fields.siderealAyanamsa ? fields.siderealAyanamsa.value : '',
		tradition: fields.tradition.value,
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: 0,
		name: fields.name.value,
		pos: fields.pos.value,
		after23NewDay: (fields.after23NewDay && fields.after23NewDay.value !== undefined) ? fields.after23NewDay.value : defaultAfter23NewDay(),
		lateZiHourUseNextDay: (fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined) ? fields.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
		// 界系(bounds)：默认 0/缺省 不下发 → 请求体零变 + 不扰缓存键(同主盘 fieldsToParams 口径);仅非 0 才传。
		...(fields.termsVariant && fields.termsVariant.value ? { termsVariant: fields.termsVariant.value } : {}),
		// 双子界序(仅经典传本受影响):同款条件透传,默认忠原书不下发。
		...(fields.geminiBoundEmended && fields.geminiBoundEmended.value ? { geminiBoundEmended: 1 } : {}),
		// 希腊化变体(西占交点真平 / 昼夜缓冲 / 迦勒底界狮子首星 / 三分集 / 福点反转):照主盘 models/astro.js:311-315 同款条件透传。
		// 默认(平 / 几何地平 / 狮子木首 / Dorothean / 反转 ON)不下发 → 请求体零变·缓存键零回归;仅非默认才传。后端 webchartsrv.py:206/284(chart13/chart12)已能接收。
		...(fields.westNodeType && fields.westNodeType.value === 'true' ? { westNodeType: 'true' } : {}),
		...(fields.sectBuffer && fields.sectBuffer.value === 'ptolemy5' ? { sectBuffer: 'ptolemy5' } : {}),
		...(fields.leoBoundFirst && (fields.leoBoundFirst.value === 1 || fields.leoBoundFirst.value === '1') ? { leoBoundFirst: 1 } : {}),
		...(fields.triplicity && fields.triplicity.value && fields.triplicity.value !== 'Dorothean' ? { triplicity: fields.triplicity.value } : {}),
		...(fields.lotReversal && (fields.lotReversal.value === 0 || fields.lotReversal.value === '0') ? { lotReversal: 0 } : {}),
		// 2026-07 二批九键:共享 helper 条件透传。
		...classicalBackendOverridesFromFields(fields),
		orbs: (fields.orbs && fields.orbs.value) ? fields.orbs.value : undefined,
		orbScale: (fields.orbScale && fields.orbScale.value) ? fields.orbScale.value : undefined,
	};

	return params;
}

const CHART13_CACHE_MAX = 64;
const chart13Mem = new Map();
const chart13Inflight = new Map();

function clonePlain(obj){
	if(obj === undefined || obj === null){
		return obj;
	}
	try{
		return JSON.parse(JSON.stringify(obj));
	}catch(e){
		return obj;
	}
}

function pushCache(map, key, val){
	if(!key || val === undefined || val === null){
		return;
	}
	if(map.has(key)){
		map.delete(key);
	}
	map.set(key, val);
	if(map.size > CHART13_CACHE_MAX){
		const first = map.keys().next().value;
		if(first){
			map.delete(first);
		}
	}
}

function buildChart13Key(params, endpoint){
	try{
		return `${endpoint || 'chart13'}|${JSON.stringify(params || {})}`;
	}catch(e){
		return '';
	}
}

async function fetchChart13Cached(params, silent, endpoint){
	const ep = endpoint || 'chart13';
	const key = buildChart13Key(params, ep);
	if(key && chart13Mem.has(key)){
		return clonePlain(chart13Mem.get(key));
	}
	if(key && chart13Inflight.has(key)){
		const inflight = await chart13Inflight.get(key);
		return clonePlain(inflight);
	}
	const req = request(`${Constants.ServerRoot}/${ep}`, {
		body: JSON.stringify(params),
		silent: !!silent,
	}).then((data)=>{
		const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
		if(key && result){
			pushCache(chart13Mem, key, clonePlain(result));
		}
		return result;
	}).finally(()=>{
		if(key){
			chart13Inflight.delete(key);
		}
	});
	if(key){
		chart13Inflight.set(key, req);
	}
	const result = await req;
	return clonePlain(result);
}

class AstroChart13 extends Component{
	constructor(props) {
		super(props);
		this.state = {
			chartObj: null,
		};

		this.unmounted = false;
		this.chartReqSeq = 0;
		this.prefetchTimer = null;

		this.requestChart = this.requestChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (chartObj)=>{
				if(this.unmounted){
					return;
				}
				let params = this.genParams();
				this.requestChart(params);
			};
		}

	}

	async requestChart(params){
		if(!params){
			return;
		}
		const seq = ++this.chartReqSeq;
		const result = await fetchChart13Cached(params, true, this.props.endpoint);
		if(this.unmounted || seq !== this.chartReqSeq){
			return;
		}
		if(!result){
			return;
		}

		const st = {
			chartObj: result,
		};

		// horosa_panel_ready_v1:十三分/十二分盘的中栏盘 + 右栏信息全部由 chartObj 派生,
		// 这一次 setState 就是「面板数据落定」的唯一那次(顶层页签 key = auxchart)。
		this.setState(st, ()=>{
			markPanelReady('auxchart');
		});
		// [审计修·派生盘快照重定源] 此前导出/挂载读 astro 单例=本命盘冒充分盘;出盘即存本键快照。
		try{
			const snapKey = this.props.endpoint === 'chart12' ? 'dwadasamsa' : 'hellenastro';
			saveDerivedAstroSnapshot(snapKey, result, this.props.fields, null);
		}catch(e){ /* 快照失败不阻断渲染 */ }
	}

	genParams(){
		let fields = this.props.fields;
		let params = fieldsToParams(fields);
		return params;
	}

	onFieldsChange(values){
		if(this.props.onChange){
			let flds = this.props.onChange(values);
			if(!flds){
				return;
			}
			let params = fieldsToParams(flds);
			const unconfirmed = values && Object.prototype.hasOwnProperty.call(values, 'confirmed') && values.confirmed === false;
			if(unconfirmed){
				if(this.prefetchTimer){
					clearTimeout(this.prefetchTimer);
				}
				this.prefetchTimer = setTimeout(()=>{
					if(this.unmounted){
						return;
					}
					fetchChart13Cached(params, true, this.props.endpoint).catch(()=>{
						return null;
					});
				}, 240);
				return;
			}
			if(this.prefetchTimer){
				clearTimeout(this.prefetchTimer);
				this.prefetchTimer = null;
			}
			this.requestChart(params);
		}		
	}

	componentDidMount(){
		this.unmounted = false;

		let params = this.genParams();
		this.requestChart(params);
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this.prefetchTimer){
			clearTimeout(this.prefetchTimer);
			this.prefetchTimer = null;
		}
	}

	render(){
		let chartObj = this.state.chartObj;
		let fields = this.props.fields;
		let height = this.props.height ? this.props.height : 760;

		return (
			<div style={{height: '100%', minHeight: 0}}>
					<AstroChartMain
						value={chartObj}
					onChange={this.onFieldsChange}
					hidehsys={1}
					hidezodiacal={1}
					showSchoolSection={true}
					tripSystem={this.props.tripSystem}
					fields={fields}
					height={height}
						chartStyle={this.props.chartStyle}
						wheelArt={this.props.wheelArt}
						dispatch={this.props.dispatch}
						chartDisplay={this.props.chartDisplay}
						planetDisplay={this.props.planetDisplay}
						lotsDisplay={this.props.lotsDisplay}
						showPlanetHouseInfo={this.props.showPlanetHouseInfo}
						showAstroMeaning={this.props.showAstroMeaning}
					/>
			</div>
		);
	}
}

export default AstroChart13;
