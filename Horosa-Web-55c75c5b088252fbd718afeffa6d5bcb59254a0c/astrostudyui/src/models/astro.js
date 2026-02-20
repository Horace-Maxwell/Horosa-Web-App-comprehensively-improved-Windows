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

function newEmptyFields(){
	const fields = {
		cid: {
			value: null,
			name: ['cid'],
		},
		ad:{
			value: dtm.ad,
			name: ['ad'],
		},
		date: {
			value: dtm,
			name: ['date'],
		},
		time: {
			value: dtm.clone(),
			name: ['time'],
		},
		zone: {
			value: dtm.zone,
			name: ['zone'],
		},
		lat: {
			value: DefLat,
			name: ['lat'],
		},
		lon: {
			value: DefLon,
			name: ['lon'],
		},
		gpsLat: {
			value: DefGpsLat,
			name: ['gpsLat'],
		},
		gpsLon: {
			value: DefGpsLon,
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
			value: 0,
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
					value: 1,
					name: ['pdtype'],
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

function isValidChartResponse(rsp){
	return rsp !== undefined && rsp !== null && rsp.Result !== undefined && rsp.Result !== null;
}

function showChartServiceError(){
	Modal.error({
		title: '排盘失败：本地排盘服务未就绪（127.0.0.1:8899）。请先启动本地服务后重试。',
	});
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
	if(currentTab === 'indiachart' || currentTab === 'locastro' || currentTab === 'astrochart'
		|| currentTab === 'hellenastro' || currentTab === 'guolao'  || currentTab === 'astrochart3D'
		|| currentTab === 'germanytech' || currentTab === 'jieqichart'
		|| currentTab === 'cntradition' || currentTab === 'cnyibu' || currentTab === 'otherbu'
		|| currentTab === 'fengshui' || currentTab === 'sanshiunited'){
		if(hook[currentTab].fun){
			hook[currentTab].fun(fields)
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

export default { 
	namespace: 'astro',
	state:{
		height: 660,
		chartObj: null,
		drawerVisible: closeAllDrawer('init'),
		currentTab: 'astrochart',
		currentSubTab: null,
		currentChart: null,
		memoType: 0,
		memo: '',

		deeplearn: null,

		predictHook:{
			astrochart:{
				fun: null
			},
			astrochart3D:{
				fun: null
			},
			direction:{
				fun: null
			},
			profection:{
				fun: null
			},
			solararc:{
				fun: null
			},
			solarreturn:{
				fun: null
			},
			zodialrelease:{
				fun: null
			},
			locastro:{
				fun: null
			},
			hellenastro:{
				fun: null
			},
			indiachart:{
				fun: null
			},
			relativechart:{
				fun: null
			},
			germanytech:{
				fun: null
			},
			jieqichart:{
				fun: null
			},
			cntradition:{
				fun: null
			},
			cnyibu:{
				fun: null
			},
			calendar:{
				fun: null
			},
			otherbu:{
				fun: null
			},
			fengshui:{
				fun: null
			},
			sanshiunited:{
				fun: null
			},
			astroreader:{
				fun: null
			},
			admintools:{
				fun: null
			},
			guolao:{
				fun: null
			},

		},

		fields:{
			cid: {
				value: null,
				name: ['cid'],
			},	
			ad:{
				value: now.ad,
				name: ['ad'],
			},
			date: {
				value: now.startOf('date'),
				name: ['date'],
			},
			time: {
				value: now.clone(),
				name: ['time'],
			},
			zone: {
				value: now.zone,
				name: ['zone'],
			},
			lat: {
				value: DefLat,
				name: ['lat'],
			},
			lon: {
				value: DefLon,
				name: ['lon'],
			},
			gpsLat: {
				value: DefGpsLat,
				name: ['gpsLat'],
			},
			gpsLon: {
				value: DefGpsLon,
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
				value: 0,
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
				value: 1,
				name: ['pdtype'],
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
			group: {
				value: null,
				name: ['group'],
			},
			southchart: {
				value: 0,
				name: ['southchart'],
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

		},
	},
	

	reducers: {
		save(state, {payload: values}){
			let st = { ...state, ...values, };
			let tab = values.currentTab ? values.currentTab : state.currentTab;
			let subtab = values.currentSubTab ? values.currentSubTab : state.currentSubTab;

			if(values.currentChart){
				return st;
			}

			const currentChart = state.currentChart;
			if(currentChart === undefined || currentChart === null){
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


		*fetch({ payload: values }, { call, put }){
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

			const rsp = yield call(service.fetchChart, param);
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			const Result = rsp.Result;
			Result.params.name = values.name;
			Result.params.pos = values.pos;
			Result.chartId = randomStr(8);
			saveAstroAISnapshot(Result, values);

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

		*fetchByChartData({ payload: values }, { call, put }){
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
			const rsp = yield call(service.fetchChart, param);
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			const Result = rsp.Result;
			Result.params.name = values.name;
			Result.params.pos = values.pos;
			Result.chartId = randomStr(8);
			saveAstroAISnapshot(Result, fields);

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

		*fetchByFields({ payload: values }, { call, put }){
			const requestOptions = values && values.__requestOptions && typeof values.__requestOptions === 'object'
				? values.__requestOptions
				: null;
			const fieldValues = {
				...(values || {}),
			};
			if(Object.prototype.hasOwnProperty.call(fieldValues, '__requestOptions')){
				delete fieldValues.__requestOptions;
			}
			const param = fieldsToParams(fieldValues);
			param.cid = null;

			const rsp = yield call(service.fetchChart, param, requestOptions);
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			const Result = rsp.Result;
			Result.params.name = fieldValues.name.value;
			Result.params.pos = fieldValues.pos.value;
			Result.chartId = randomStr(8);
			saveAstroAISnapshot(Result, fieldValues);

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

		*nowChart({ payload: values }, { call, put }){
			let fields = values.fields;
			if(fields === undefined || fields === null){
				fields = newEmptyFields();
			}
			const param = fieldsToParams(fields);

			const rsp = yield call(service.fetchChart, param);
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			const Result = rsp.Result;
			Result.chartId = randomStr(8);
			saveAstroAISnapshot(Result, fields);

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
