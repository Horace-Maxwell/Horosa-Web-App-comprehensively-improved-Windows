import { history } from 'umi';
import {getStore, } from '../utils/storageutil';
import { Modal, } from 'antd';
import DateTime from '../components/comp/DateTime';
import * as service from '../services/astro';
import {randomStr,} from '../utils/helper';
import { DefLat, DefLon, DefGpsLat, DefGpsLon, } from '../utils/constants';
import { saveAstroAISnapshot, } from '../utils/astroAiSnapshot';
import { loadLocalFateEvents, saveLocalFateEvents, } from '../utils/localdeeplearn';

let dtm = new DateTime();
const StartupChartCacheKey = 'horosa.startupChartCache.v1';
const StartupErrorGraceUntil = Date.now() + 45000;
const DefaultModuleSubTabs = Object.freeze({
	direction: 'primarydirect',
	relativechart: 'Comp',
	indiachart: 'Natal',
	cntradition: 'bazi',
	cnyibu: 'suzhan',
	liveplayer: null,
});

function buildDefaultModuleSubTabs(){
	return {
		...DefaultModuleSubTabs,
	};
}

function normalizeModuleSubTabs(raw){
	const next = buildDefaultModuleSubTabs();
	if(!raw || typeof raw !== 'object'){
		return next;
	}
	Object.keys(raw).forEach((key)=>{
		if(raw[key] === undefined){
			return;
		}
		next[key] = raw[key];
	});
	return next;
}

function normalizeStartupUiState(raw){
	if(!raw || typeof raw !== 'object'){
		return null;
	}
	const currentTab = raw.currentTab !== undefined && raw.currentTab !== null && `${raw.currentTab}` !== ''
		? `${raw.currentTab}`
		: 'astrochart';
	const moduleSubTabs = normalizeModuleSubTabs(raw.moduleSubTabs);
	let currentSubTab = raw.currentSubTab;
	if(currentSubTab === undefined){
		currentSubTab = moduleSubTabs[currentTab] !== undefined ? moduleSubTabs[currentTab] : null;
	}
	return {
		currentTab,
		currentSubTab: currentSubTab === undefined ? null : currentSubTab,
		moduleSubTabs,
	};
}

function readStoredStartupCachePayload(){
	if(typeof window === 'undefined' || !window.localStorage){
		return null;
	}
	try{
		const raw = window.localStorage.getItem(StartupChartCacheKey);
		if(!raw){
			return null;
		}
		const payload = JSON.parse(raw);
		return payload && typeof payload === 'object' ? payload : null;
	}catch(e){
		return null;
	}
}

function writeStartupCachePayload(partial){
	if(typeof window === 'undefined' || !window.localStorage){
		return;
	}
	try{
		const previous = readStoredStartupCachePayload() || {};
		const payload = {
			...previous,
			...partial,
			savedAt: Date.now(),
		};
		window.localStorage.setItem(StartupChartCacheKey, JSON.stringify(payload));
	}catch(e){}
}

function parseStartupLaunchState(){
	try{
		if(typeof window === 'undefined' || !window.location || !window.location.search){
			return null;
		}
		const params = new URLSearchParams(window.location.search || '');
		const sdate = params.get('sdate');
		const stime = params.get('stime');
		const szone = params.get('szone');
		if(!sdate || !stime || !szone){
			return null;
		}
		const dateParts = sdate.split(/[\\/\\-]/).map((item)=>parseInt(item, 10));
		const timeParts = stime.split(':').map((item)=>parseInt(item, 10));
		if(dateParts.length !== 3 || timeParts.length < 2){
			return null;
		}
		if(dateParts.some((item)=>!Number.isFinite(item)) || timeParts.some((item)=>!Number.isFinite(item))){
			return null;
		}
		const second = Number.isFinite(timeParts[2]) ? timeParts[2] : 0;
		const gpsLatRaw = Number(params.get('sgpslat'));
		const gpsLonRaw = Number(params.get('sgpslon'));
		const hsysRaw = parseInt(params.get('shsys'), 10);
		return {
			dateTime: new DateTime({
				ad: 1,
				year: dateParts[0],
				month: dateParts[1],
				date: dateParts[2],
				hour: timeParts[0],
				minute: timeParts[1],
				second,
				zone: szone,
			}),
			zone: szone,
			lat: params.get('slat') || DefLat,
			lon: params.get('slon') || DefLon,
			gpsLat: Number.isFinite(gpsLatRaw) ? gpsLatRaw : DefGpsLat,
			gpsLon: Number.isFinite(gpsLonRaw) ? gpsLonRaw : DefGpsLon,
			hsys: Number.isFinite(hsysRaw) ? hsysRaw : 0,
		};
	}catch(e){
		return null;
	}
}

function newEmptyFields(){
	const startupLaunchState = parseStartupLaunchState();
	const baseDateTime = startupLaunchState ? startupLaunchState.dateTime : dtm;
	const baseZone = startupLaunchState ? startupLaunchState.zone : dtm.zone;
	const baseLat = startupLaunchState ? startupLaunchState.lat : DefLat;
	const baseLon = startupLaunchState ? startupLaunchState.lon : DefLon;
	const baseGpsLat = startupLaunchState ? startupLaunchState.gpsLat : DefGpsLat;
	const baseGpsLon = startupLaunchState ? startupLaunchState.gpsLon : DefGpsLon;
	const baseHsys = startupLaunchState ? startupLaunchState.hsys : 0;
	const fields = {
		cid: {
			value: null,
			name: ['cid'],
		},
		ad:{
			value: baseDateTime.ad,
			name: ['ad'],
		},
		date: {
			value: baseDateTime.clone(),
			name: ['date'],
		},
		time: {
			value: baseDateTime.clone(),
			name: ['time'],
		},
		zone: {
			value: baseZone,
			name: ['zone'],
		},
		lat: {
			value: baseLat,
			name: ['lat'],
		},
		lon: {
			value: baseLon,
			name: ['lon'],
		},
		gpsLat: {
			value: baseGpsLat,
			name: ['gpsLat'],
		},
		gpsLon: {
			value: baseGpsLon,
			name: ['gpsLon'],
		},
		name: {
			value: null,
			name: ['name'],
		},
		pos: {
			value: null,
			name: ['pos'],
		},
		hsys: {
			value: baseHsys,
			name: ['hsys'],
		},
		zodiacal: {
			value: 0,
			name: ['zodiacal'],
		},
		tradition: {
			value: 0,
			name: ['tradition'],
		},
		strongRecption: {
			value: 0,
			name: ['strongRecption'],
		},
		simpleAsp: {
			value: 0,
			name: ['simpleAsp'],
		},
		virtualPointReceiveAsp: {
			value: 0,
			name: ['virtualPointReceiveAsp'],
		},
		doubingSu28: {
			value: 0,
			name: ['doubingSu28'],
		},
		houseStartMode: {
			value: 0,
			name: ['houseStartMode'],
		},
				predictive: {
					value: 1,
					name: ['predictive'],
				},
				showPdBounds: {
					value: 1,
					name: ['showPdBounds'],
				},
		pdtype: {
			value: 0,
			name: ['pdtype'],
		},
		pdMethod: {
			value: 'astroapp_alchabitius',
			name: ['pdMethod'],
		},
		pdTimeKey: {
			value: 'Ptolemy',
			name: ['pdTimeKey'],
		},
		pdaspects: {
			value: [0, 60, 90, 120, 180],
			name: ['pdaspects'],
		},
		timeAlg: {
			value: 0,
			name: ['timeAlg'],
		},
		phaseType: {
			value: 0,
			name: ['phaseType'],
		},
		godKeyPos: {
			value: '年',
			name: ['godKeyPos'],
		},
		after23NewDay: {
			value: 0,
			name: ['after23NewDay'],
		},
		adjustJieqi: {
			value: 0,
			name: ['adjustJieqi'],
		},
		gender: {
			value: 1,
			name: ['gender'],
		},
		southchart: {
			value: 0,
			name: ['southchart'],
		},
		group: {
			value: null,
			name: ['group'],
		},
		memoZiWei:{
			value: null,
			name: ['memoZiWei'],
		},
		memoBaZi:{
			value: null,
			name: ['memoBaZi'],
		},
		memoAstro:{
			value: null,
			name: ['memoAstro'],
		},
		memo74:{
			value: null,
			name: ['memo74'],
		},
		memoGua:{
			value: null,
			name: ['memoGua'],
		},
		memoLiuReng:{
			value: null,
			name: ['memoLiuReng'],
		},
		memoQiMeng:{
			value: null,
			name: ['memoQiMeng'],
		},
		memoSuZhan:{
			value: null,
			name: ['memoSuZhan'],
		},

	};

	return fields;
}

function fieldsToParams(fields){
	const params = {
		cid: fields.cid.value,
		ad: fields.date.value.ad,
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.date.value.zone,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: fields.hsys.value,
		southchart: fields.southchart.value,
		zodiacal: fields.zodiacal.value,
		tradition: fields.tradition.value,
		doubingSu28: fields.doubingSu28.value,
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: fields.predictive.value,
		showPdBounds: fields.showPdBounds ? fields.showPdBounds.value : 1,
		pdtype: fields.pdtype ? fields.pdtype.value : 0,
		pdMethod: fields.pdMethod ? fields.pdMethod.value : 'astroapp_alchabitius',
		pdTimeKey: fields.pdTimeKey ? fields.pdTimeKey.value : 'Ptolemy',
		pdaspects: fields.pdaspects.value,
		name: fields.name.value,
		pos: fields.pos.value,
		group: fields.group ? fields.group.value : null,
	};

	if(params.pdaspects && params.pdaspects instanceof String){
		params.pdaspects = JSON.parse(params.pdaspects);
	}

	return params;
}

function serializeDateTime(val){
	if(!(val instanceof DateTime)){
		return val;
	}
	return {
		__type: 'DateTime',
		ad: val.ad,
		year: val.year,
		month: val.month,
		date: val.date,
		hour: val.hour,
		minute: val.minute,
		second: val.second,
		zone: val.zone,
	};
}

function deserializeDateTime(val){
	if(!val || typeof val !== 'object' || val.__type !== 'DateTime'){
		return val;
	}
	return new DateTime({
		ad: val.ad,
		year: val.year,
		month: val.month,
		date: val.date,
		hour: val.hour,
		minute: val.minute,
		second: val.second,
		zone: val.zone,
	});
}

function serializeFields(fields){
	if(!fields || typeof fields !== 'object'){
		return null;
	}
	const out = {};
	Object.keys(fields).forEach((key)=>{
		const item = fields[key];
		if(!item || typeof item !== 'object'){
			return;
		}
		out[key] = {
			...item,
			value: serializeDateTime(item.value),
		};
	});
	return out;
}

function deserializeFields(raw){
	const base = newEmptyFields();
	if(!raw || typeof raw !== 'object'){
		return base;
	}
	Object.keys(raw).forEach((key)=>{
		const item = raw[key];
		if(!item || typeof item !== 'object'){
			return;
		}
		base[key] = {
			...(base[key] || { name: [key] }),
			...item,
			value: deserializeDateTime(item.value),
		};
	});
	return base;
}

function saveStartupChartCache(chartObj, fields){
	if(!chartObj || !fields){
		return;
	}
	writeStartupCachePayload({
		chartObj: chartObj,
		fields: serializeFields(fields),
	});
}

function saveStartupUiState(state){
	const uiState = normalizeStartupUiState(state);
	if(!uiState){
		return;
	}
	writeStartupCachePayload({
		uiState,
	});
}

function loadStartupChartCache(){
	if(typeof window === 'undefined'){
		return null;
	}
	try{
		let globalPayload = window.__HOROSA_STARTUP_CACHE;
		if(globalPayload && globalPayload.chartObj && globalPayload.fields){
			try{
				if(window.localStorage){
					const storedPayload = readStoredStartupCachePayload();
					if(storedPayload && storedPayload.uiState && !globalPayload.uiState){
						globalPayload = {
							...globalPayload,
							uiState: storedPayload.uiState,
						};
					}
					window.localStorage.setItem(StartupChartCacheKey, JSON.stringify(globalPayload));
				}
			}catch(e){}
			return {
				chartObj: globalPayload.chartObj,
				fields: deserializeFields(globalPayload.fields),
				uiState: normalizeStartupUiState(globalPayload.uiState),
			};
		}
		if(!window.localStorage){
			return null;
		}
		const payload = readStoredStartupCachePayload();
		if(!payload || !payload.chartObj || !payload.fields){
			return null;
		}
		return {
			chartObj: payload.chartObj,
			fields: deserializeFields(payload.fields),
			uiState: normalizeStartupUiState(payload.uiState),
		};
	}catch(e){
		return null;
	}
}

function shouldIncludePrimaryDirection(state){
	return !!(
		state
		&& state.currentTab === 'direction'
		&& (state.currentSubTab === 'primarydirect' || state.currentSubTab === 'primarydirchart')
	);
}

function isValidChartResponse(rsp){
	return rsp !== undefined && rsp !== null && rsp.Result !== undefined && rsp.Result !== null;
}

function hasChartParamError(rsp){
	return !!(
		rsp &&
		(
			(typeof rsp.err === 'string' && rsp.err.trim()) ||
			(typeof rsp.detail === 'string' && rsp.detail.trim())
		)
	);
}

function getChartErrorDetail(rsp){
	if(!rsp){
		return '';
	}
	if(typeof rsp.err === 'string' && rsp.err.trim()){
		return rsp.err.trim();
	}
	if(typeof rsp.detail === 'string' && rsp.detail.trim()){
		return rsp.detail.trim();
	}
	return '';
}

function showChartServiceError(rsp){
	const detail = getChartErrorDetail(rsp);
	const inStartupGrace = Date.now() <= StartupErrorGraceUntil;
	try{
		const store = getStore();
		const astroState = store && store.astro ? store.astro : null;
		const hasLiveChart = !!(astroState && astroState.chartObj);
		const hasStartupCache = !!loadStartupChartCache();
		if((hasLiveChart || hasStartupCache) && inStartupGrace){
			return;
		}
	}catch(e){}
	if(detail){
		Modal.error({
			title: detail.indexOf('param error') >= 0
				? '排盘失败：参数或图盘数据不合法。'
				: '排盘失败',
			content: detail,
		});
		return;
	}
	if(inStartupGrace){
		return;
	}
	Modal.error({
		title: '排盘失败：本地排盘服务未就绪。请确认 Horosa 本地服务仍在运行后重试。',
	});
}

function sleep(ms){
	return new Promise((resolve)=>{
		setTimeout(resolve, ms);
	});
}

function shouldRetryChartFetch(rsp, attempt){
	if(hasChartParamError(rsp)){
		return false;
	}
	if(isValidChartResponse(rsp)){
		return false;
	}
	return Date.now() <= StartupErrorGraceUntil;
}

function* fetchChartWithRecovery(call, param, requestOptions){
	let rsp = null;
	const retryDelays = [250, 400, 600, 900, 1200, 1600, 2100, 2600, 3200];
	for(let attempt = 0; attempt <= retryDelays.length; attempt++){
		try{
			rsp = yield call(service.fetchChart, param, requestOptions);
		}catch(e){
			rsp = null;
		}
		if(isValidChartResponse(rsp) || hasChartParamError(rsp)){
			return rsp;
		}
		if(!shouldRetryChartFetch(rsp, attempt)){
			return rsp;
		}
		const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
		yield sleep(delay);
	}
	return rsp;
}


function closeAllDrawer(msg){
	console.log(msg);
	const drawer = {
		query: false,
		selectplanet: false,
		selectchartdisplay: false,
		selectasp: false,
		register: false,
		login: false,
		resetpwd: false,
		changepwd: false,
		changeparams: false,
		chartlist: false,
		chartedit: false,
		chartadd: false,
		caselist: false,
		caseedit: false,
		caseadd: false,
		chartdeeplearn: false,
		memo: false,
		chartsgps: false,
		commtools: false,
		homepage: false,
	};
	return drawer;
}

function hooking(hook, currentTab, fields, chartObj){
	if(currentTab === 'indiachart' || currentTab === 'locastro'
		|| currentTab === 'hellenastro' || currentTab === 'guolao'
		|| currentTab === 'germanytech' || currentTab === 'jieqichart'
		|| currentTab === 'cntradition' || currentTab === 'cnyibu' || currentTab === 'otherbu'
		|| currentTab === 'fengshui' || currentTab === 'sanshiunited'){
		if(hook[currentTab].fun){
			hook[currentTab].fun(fields, chartObj)
		}
	}else if(currentTab === 'direction'){
		if(hook[currentTab].fun){
			hook[currentTab].fun(chartObj);
		}
	}else if(currentTab === 'astroreader'){
		if(hook[currentTab].fun){
			hook[currentTab].fun();
		}
	}

}

let now = new DateTime();
function buildInitialAstroState(){
	const startupCache = loadStartupChartCache();
	const startupUiState = startupCache && startupCache.uiState ? startupCache.uiState : null;
	const moduleSubTabs = startupUiState && startupUiState.moduleSubTabs
		? startupUiState.moduleSubTabs
		: buildDefaultModuleSubTabs();
	const currentTab = startupUiState && startupUiState.currentTab ? startupUiState.currentTab : 'astrochart';
	let currentSubTab = startupUiState ? startupUiState.currentSubTab : null;
	if(currentSubTab === undefined){
		currentSubTab = moduleSubTabs[currentTab] !== undefined ? moduleSubTabs[currentTab] : null;
	}
	const initialHeight = (typeof document !== 'undefined' && document.documentElement)
		? Math.max(660, document.documentElement.clientHeight - 88)
		: 660;
	return {
		height: initialHeight,
		chartObj: startupCache && startupCache.chartObj ? startupCache.chartObj : null,
		drawerVisible: closeAllDrawer('init'),
		currentTab: currentTab,
		currentSubTab: currentSubTab,
		moduleSubTabs: moduleSubTabs,
		currentChart: null,
		memoType: 0,
		memo: '',
		deeplearn: null,
		predictHook:{
			astrochart:{ fun: null },
			astrochart3D:{ fun: null },
			direction:{ fun: null },
			profection:{ fun: null },
			solararc:{ fun: null },
			solarreturn:{ fun: null },
			zodialrelease:{ fun: null },
			locastro:{ fun: null },
			hellenastro:{ fun: null },
			indiachart:{ fun: null },
			relativechart:{ fun: null },
			germanytech:{ fun: null },
			jieqichart:{ fun: null },
			cntradition:{ fun: null },
			cnyibu:{ fun: null },
			calendar:{ fun: null },
			otherbu:{ fun: null },
			fengshui:{ fun: null },
			sanshiunited:{ fun: null },
			astroreader:{ fun: null },
			admintools:{ fun: null },
			guolao:{ fun: null },
		},
		fields: startupCache && startupCache.fields ? startupCache.fields : newEmptyFields(),
	};
}

export default { 
	namespace: 'astro',
	state: buildInitialAstroState(),
	

	reducers: {
		save(state, {payload: values}){
			values = values || {};
			const nextModuleSubTabs = {
				...(state.moduleSubTabs || {}),
				...((values && values.moduleSubTabs) ? values.moduleSubTabs : {}),
			};
			const hasCurrentTab = values.currentTab !== undefined && values.currentTab !== null && `${values.currentTab}` !== '';
			const hasCurrentSubTab = values.currentSubTab !== undefined && values.currentSubTab !== null && `${values.currentSubTab}` !== '';
			let tab = hasCurrentTab ? values.currentTab : state.currentTab;
			if(tab && hasCurrentSubTab){
				nextModuleSubTabs[tab] = values.currentSubTab;
			}
			let subtab = hasCurrentSubTab
				? values.currentSubTab
				: (
					tab && nextModuleSubTabs[tab] !== undefined
						? nextModuleSubTabs[tab]
						: state.currentSubTab
				);
			let st = {
				...state,
				...values,
				currentSubTab: subtab,
				moduleSubTabs: nextModuleSubTabs,
			};

			if(values.currentChart){
				saveStartupUiState(st);
				return st;
			}

			const currentChart = state.currentChart;
			if(currentChart === undefined || currentChart === null){
				saveStartupUiState(st);
				return st;
			}

			if(tab && (values.memoType === undefined || values.memoType === null)){
				let type = 0;
				let memo = currentChart.memoAstro.value;
				if(tab === 'cntradition'){
					if(subtab && subtab === 'bazi'){
						type = 1;
						memo = currentChart.memoBaZi.value;
					}else if(subtab && subtab === 'ziwei'){
						type = 2;
						memo = currentChart.memoZiWei.value;
					}else if(subtab && subtab === '74'){
						type = 3;
						memo = currentChart.memo74.value;
					}else{
						type = 2;
						memo = currentChart.memoZiWei.value;
					}
				}else if(tab === 'cnyibu'){
					if(subtab && subtab === 'suzhan'){
						type = 7;
						memo = currentChart.memoSuZhan.value;
					}else if(subtab && subtab === 'guazhan'){
						type = 4;
						memo = currentChart.memoGua.value;
					}else if(subtab && subtab === 'liureng'){
						type = 5;
						memo = currentChart.memoLiuReng.value;
					}else if(subtab && subtab === 'jinkou'){
						type = 5;
						memo = currentChart.memoLiuReng.value;
					}else{
						type = 4;
						memo = currentChart.memoGua.value;
					}
				}else if(tab === 'guolao'){
					type = 3;
					memo = currentChart.memo74.value;
				}
				st.memoType = type;	
				st.memo = memo;
			}else if(values.memoType !== undefined && values.memoType !== null && 
				(values.byChartData === undefined || values.byChartData === null)){
				let type = values.memoType;
				let memo = currentChart.memoAstro.value;
				if(type === 1){
					memo = currentChart.memoBaZi.value;
				}else if(type === 2){
					memo = currentChart.memoZiWei.value;
				}else if(type === 3){
					memo = currentChart.memo74.value;
				}else if(type === 4){
					memo = currentChart.memoGua.value;
				}else if(type === 5){
					memo = currentChart.memoLiuReng.value;
				}else if(type === 6){
					memo = currentChart.memoQiMeng.value;
				}else if(type === 7){
					memo = currentChart.memoSuZhan.value;
				}
				st.memo = memo;
			}

			if(values.memo){
				st.memo = values.memo;
			}

			saveStartupUiState(st);
			return st;
		},
	},

	effects: {
		*closeDrawer({ payload: values }, { call, put }){
			let drawer = closeAllDrawer('*closeDrawer');
            yield put({
                type: 'save',
                payload: {  
					drawerVisible: drawer,
                },
            });

		},

		*openDrawer({ payload: values }, { call, put }){
			let drawer = closeAllDrawer('*openDrawer');
			drawer[values.key] = true;

            yield put({
                type: 'save',
                payload: {  
					drawerVisible: drawer,
                },
            });

			if(values.key === 'register' || values.key === 'resetpwd'){
				yield put({
					type: 'app/fetchImgToken',
					payload: { },
				});	
			}else if(values.key === 'chartadd'){
				yield put({
					type: 'user/newCurrentChart',
					payload: { },
				});	
			}else if(values.key === 'chartlist'){
				yield put({
					type: 'user/fetchCharts',
					payload: { },
				});
			}else if(values.key === 'caselist'){
				yield put({
					type: 'user/fetchCases',
					payload: { },
				});
			}else if(values.key === 'caseadd'){
				yield put({
					type: 'user/newCurrentCase',
					payload: values.record ? values.record : {},
				});
			}else if(values.key === 'caseedit'){
				let record = values.record;
				if(record){
					yield put({
						type: 'user/setCurrentCase',
						payload: {
							...values.record,
							drawerVisible: drawer,
						},
					});
				}else{
					const store = getStore();
					const userstate = store.user;
					if(userstate.currentCase && userstate.currentCase.cid && userstate.currentCase.cid.value){
						let caze = userstate.currentCase;
						record = {
							cid: caze.cid.value,
							event: caze.event.value,
							caseType: caze.caseType.value,
							divTime: caze.divTime.value,
							zone: caze.zone.value,
							lat: caze.lat.value,
							lon: caze.lon.value,
							gpsLat: caze.gpsLat.value,
							gpsLon: caze.gpsLon.value,
							pos: caze.pos.value,
							isPub: caze.isPub.value,
							creator: caze.creator.value,
							updateTime: caze.updateTime.value,
							group: caze.group.value,
							payload: caze.payload.value,
							sourceModule: caze.sourceModule.value,
							drawerVisible: drawer,
						};
						yield put({
							type: 'user/setCurrentCase',
							payload: record,
						});
					}else{
						yield put({
							type: 'openDrawer',
							payload: {
								key: 'caseadd',
							},
						});
					}
				}
			}else if(values.key === 'chartdeeplearn'){
				let record = values.record;
				if(record){
					yield put({
						type: 'fetchFateEvents',
						payload: record,
					});		
				}else{
					const store = getStore();
					const userstate = store.user;
					if(userstate.currentChart.cid.value && userstate.currentChart.cid.value !== ''){
						let chart = userstate.currentChart;
						let tm = chart.birth.value.clone();
						record = {
							birth: tm,
							zone: chart.zone.value,
							ad: tm.ad,
							lat: chart.lat.value,
							lon: chart.lon.value,
							gpsLat: chart.gpsLat.value,
							gpsLon: chart.gpsLon.value,
							name: chart.name.value,
							pos: chart.pos.value,
							gender: parseInt(chart.gender.value + ''),
							isPub: chart.isPub.value,
							cid: chart.cid.value,
							creator: chart.creator.value,
							updateTime: chart.updateTime.value,
							group: chart.group.value,
						};
						yield put({
							type: 'fetchFateEvents',
							payload: record,
						});			
					}
				}
			}else if(values.key === 'chartedit'){
				let record = values.record;
				if(record){
					yield put({
						type: 'user/setCurrentChart',
						payload: {
							...values.record, 
							drawerVisible: drawer
						},
					});		
				}else{
					const store = getStore();
					const userstate = store.user;
					if(userstate.currentChart.cid.value && userstate.currentChart.cid.value !== ''){
						let chart = userstate.currentChart;
						let tm = chart.birth.value.clone();
						record = {
							birth: tm,
							zone: chart.zone.value,
							ad: tm.ad,
							lat: chart.lat.value,
							lon: chart.lon.value,
							gpsLat: chart.gpsLat.value,
							gpsLon: chart.gpsLon.value,
							name: chart.name.value,
							pos: chart.pos.value,
							gender: parseInt(chart.gender.value + ''),
							isPub: chart.isPub.value,
							cid: chart.cid.value,
							creator: chart.creator.value,
							updateTime: chart.updateTime.value,
							group: chart.group.value,
							drawerVisible: drawer,
						};
						yield put({
							type: 'user/setCurrentChart',
							payload: record,
						});			
					}else{
						yield put({
							type: 'openDrawer',
							payload: {
								key: 'chartadd',
							},
						});			
					}
		
				}
			}else if(values.key === 'planetselect'){

			}else if(values.key === 'statistic'){

			}else if(values.key === 'homepage'){

			}

		},


		*fetch({ payload: values }, { call, put, select }){
			const param = {
				...values,
				date: values.date.format('YYYY/MM/DD'),
				time: values.date.format('HH:mm:ss'),
				ad: values.date.ad,
				zone: values.date.zone,
				cid: null,
			};

			if(param.pdaspects && param.pdaspects instanceof String){
				param.pdaspects = JSON.parse(param.pdaspects);
			}
			const astroState = yield select((state)=>state.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);

			const rsp = yield* fetchChartWithRecovery(call, param);
			if(!isValidChartResponse(rsp)){
				showChartServiceError(rsp);
				return;
			}
			const Result = rsp.Result;
			Result.params.name = values.name;
			Result.params.pos = values.pos;
			Result.chartId = randomStr(8);
			saveAstroAISnapshot(Result, values);
			saveStartupChartCache(Result, state.fields);

			let drawer = closeAllDrawer('*fetch');

            yield put({
                type: 'save',
                payload: {  
					chartObj: Result,
					drawerVisible: drawer,
                },
            });

			if(values.nohook){
				return;
			}

            const store = getStore();
			const state = store.astro;
			yield put({
                type: 'doHook',
                payload: {  
					chartObj: Result,
					fields: state.fields,
                },
            });
		},

		*fetchByChartData({ payload: values }, { call, put, select }){
            const store = getStore();
			const state = store.astro;
			const fields = {
				...state.fields
			}

			let tm = new DateTime();
			tm.parse(values.birth, 'YYYY-MM-DD HH:mm:ss');
			tm.setAd(values.ad ? values.ad : 1);
			tm.setZone(values.zone);

			fields.cid.value = values.cid;
			fields.date.value = tm;
			fields.time.value = tm;
			fields.zone.value = tm.zone;
			fields.lat.value = values.lat;
			fields.lon.value = values.lon;
			fields.name.value = values.name;
			fields.pos.value = values.pos;
			fields.ad.value = tm.ad;
			if(values.gender !== undefined && values.gender !== null){
				fields.gender.value = parseInt(values.gender + '');
			}
			if(values.group !== undefined && values.group !== null){
				fields.group.value = values.group;
			}
			
			const param = fieldsToParams(fields);
			const astroState = yield select((allState)=>allState.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
			const rsp = yield* fetchChartWithRecovery(call, param);
			if(!isValidChartResponse(rsp)){
				showChartServiceError(rsp);
				return;
			}
			const Result = rsp.Result;
			Result.params.name = values.name;
			Result.params.pos = values.pos;
			Result.chartId = randomStr(8);
			saveAstroAISnapshot(Result, fields);
			saveStartupChartCache(Result, fields);

			fields.memo74.value = values.memo74;
			fields.memoBaZi.value = values.memoBaZi;
			fields.memoZiWei.value = values.memoZiWei;
			fields.memoAstro.value = values.memoAstro;
			fields.memoGua.value = values.memoGua;
			fields.memoLiuReng.value = values.memoLiuReng;
			fields.memoQiMeng.value = values.memoQiMeng;
			fields.memoSuZhan.value = values.memoSuZhan;

			let type = state.memoType;
			let memo = '';
			if(type === 0){
				memo = fields.memoAstro.value;
			}else if(type === 1){
				memo = fields.memoBaZi.value;
			}else if(type === 2){
				memo = fields.memoZiWei.value;
			}else if(type === 3){
				memo = fields.memo74.value;
			}else if(type === 4){
				memo = fields.memoGua.value;
			}else if(type === 5){
				memo = fields.memoLiuReng.value;
			}else if(type === 6){
				memo = fields.memoQiMeng.value;
			}else if(type === 7){
				memo = fields.memoSuZhan.value;
			}
			yield put({
                type: 'save',
                payload: {  
					chartObj: Result,
					fields: fields,
					byChartData: true,
					memo: memo,
					memoType: type,
                },
            });

			if(values.nohook){
				return;
			}

			yield put({
                type: 'doHook',
                payload: {  
					chartObj: Result,
					fields: fields,
					drawerVisible: values.drawerVisible,
                },
            });

			if(values.drawerVisible){
				yield put({
					type: 'save',
					payload: {  
						drawerVisible: values.drawerVisible,
					},
				});	
			}
		},

		*fetchByFields({ payload: values }, { call, put, select }){
			const requestOptions = values && values.__requestOptions && typeof values.__requestOptions === 'object'
				? values.__requestOptions
				: { silent: true };
			const fieldValues = {
				...(values || {}),
			};
			if(Object.prototype.hasOwnProperty.call(fieldValues, '__requestOptions')){
				delete fieldValues.__requestOptions;
			}
			const param = fieldsToParams(fieldValues);
			param.cid = null;
			const astroState = yield select((state)=>state.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);

			const rsp = yield* fetchChartWithRecovery(call, param, requestOptions);
			if(!isValidChartResponse(rsp)){
				showChartServiceError(rsp);
				return;
			}
			const Result = rsp.Result;
			Result.params.name = fieldValues.name.value;
			Result.params.pos = fieldValues.pos.value;
			Result.chartId = randomStr(8);
			saveAstroAISnapshot(Result, fieldValues);
			saveStartupChartCache(Result, fieldValues);

			let fld = {
				...fieldValues,
				nohook: false,
			}
            yield put({
                type: 'save',
                payload: {  
					chartObj: Result,
					fields: fld,
                },
            });

			if(values.nohook){
				return;
			}

			yield put({
                type: 'doHook',
                payload: {  
					chartObj: Result,
					fields: fld,
                },
            });

		},

		*doHook({ payload: values }, { call, put }){
            const store = getStore();
			const state = store.astro;
			let hook = state.predictHook;
			hooking(hook, state.currentTab, values.fields, values.chartObj);
		},

		*nowChart({ payload: values }, { call, put, select }){
			let fields = values.fields;
			if(fields === undefined || fields === null){
				fields = newEmptyFields();
			}
			const param = fieldsToParams(fields);
			const astroState = yield select((state)=>state.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
			const forceSilent = !!(values && values.__silent);
			const suppressErrors = !!(values && values.__suppressErrors);
			const requestOptions = (forceSilent || (astroState && astroState.chartObj)) ? { silent: true } : undefined;

			const rsp = yield* fetchChartWithRecovery(call, param, requestOptions);
			if(!isValidChartResponse(rsp)){
				if(!suppressErrors){
					showChartServiceError(rsp);
				}
				return;
			}
			const Result = rsp.Result;
			Result.chartId = randomStr(8);
			saveAstroAISnapshot(Result, fields);
			saveStartupChartCache(Result, fields);

			let drawer = closeAllDrawer('*nowChart');
            yield put({
                type: 'save',
                payload: {  
					fields: fields,
					chartObj: Result,
					drawerVisible: drawer,
                },
            });

            const store = getStore();
			const state = store.astro;
			let hook = state.predictHook;
			hooking(hook, state.currentTab, fields, Result);

		},

		*hydrateStartupCache({ payload: values }, { call, put, select }){
			const cached = loadStartupChartCache();
			if(cached){
				const uiState = cached.uiState || null;
				const uiPayload = uiState ? {
					currentTab: uiState.currentTab,
					currentSubTab: uiState.currentSubTab,
					moduleSubTabs: uiState.moduleSubTabs,
				} : {};
				yield put({
					type: 'save',
					payload: {
						fields: cached.fields,
						chartObj: cached.chartObj,
						drawerVisible: closeAllDrawer('*hydrateStartupCache'),
						...uiPayload,
					},
				});
				return;
			}
			const astroState = yield select((state)=>state.astro);
			const fields = astroState && astroState.fields ? astroState.fields : null;
			if(fields){
				yield put({
					type: 'fetchByFields',
					payload: {
						...fields,
						__requestOptions: { silent: true },
					},
				});
			}
		},

		*setHomePage({ payload: values }, { call, put }){
			if(values.path === undefined || values.path === null){
				return;
			}

			let path = values.path;
			if(path[0] === 'astroreader'){
				const store = getStore();
				const userState = store.user;
				if(userState.userInfo === undefined || userState.userInfo === null){
					yield put({
						type: 'save',
						payload: {
							currentTab: '1',
						},
					});		
					return;
				}	
			}

			let payload = {
				currentTab: path[0],
			};
			if(path.length > 0){
				payload.currentSubTab = path[1];
			}

			yield put({
				type: 'save',
				payload: payload,
			});

		},

		*fetchFateEvents({ payload: values }, { call, put }){
			yield put({
				type: 'user/setCurrentChart',
				payload: {
					...values,
					skipFetchByChartData: true,
				},
			});		

			const param = {
				Cid: values.cid,
			};
			const localOnly = true;
			if(localOnly){
				const localResult = loadLocalFateEvents(values.cid);
				yield put({
					type: 'save',
					payload: {
						deeplearn: localResult,
					},
				});
				return;
			}

			let rsp = null;
			try{
				rsp = yield call(service.fetchFateEvents, param);
			}catch(e){
				rsp = null;
			}
			if(!rsp || !rsp.Result){
				const localResult = loadLocalFateEvents(values.cid);
				yield put({
					type: 'save',
					payload: {
						deeplearn: localResult,
					},
				});
				return;
			}
			const Result = rsp.Result;

            yield put({
                type: 'save',
                payload: {  
					deeplearn: Result,
                },
            });

		},

		*deeplearn({ payload: values }, { call, put }){
            const store = getStore();
			const state = store.astro;
			if(state.deeplearn){
				let param = {
					Cid: state.deeplearn.Cid,
					Val10000: state.deeplearn.Val10000,
					Val20000: state.deeplearn.Val20000,
					Val30000: state.deeplearn.Val30000,
					Val40000: state.deeplearn.Val40000,
				};
				const localOnly = true;
				if(localOnly){
					saveLocalFateEvents(param);
				}else{
					try{
						yield call(service.dlTrain, param);
					}catch(e){
						saveLocalFateEvents(param);
					}
				}
			}

            yield put({
                type: 'openDrawer',
                payload: {  
					key: 'chartlist'
                },
            });

		},

	}

}
