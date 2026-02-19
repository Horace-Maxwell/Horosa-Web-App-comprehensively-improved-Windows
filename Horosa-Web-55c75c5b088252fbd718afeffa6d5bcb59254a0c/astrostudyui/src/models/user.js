import { history } from 'umi';
import { Modal, } from 'antd';
import * as service from '../services/user';
import {getStore} from '../utils/storageutil';
import DateTime from '../components/comp/DateTime';
import { DefLat, DefLon, DefGpsLat, DefGpsLon, } from '../utils/constants';
import { getPagedLocalCharts, upsertLocalChart, removeLocalChart } from '../utils/localcharts';
import { getPagedLocalCases, upsertLocalCase, removeLocalCase, getCaseTypeMeta } from '../utils/localcases';


function newEmptyChartFields(){
	let now = new DateTime();
	const fields = {
		birth: {
			value: now,
			name: ['birth'],
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
		pos: {
			value: null,
			name: ['pos'],
		},
		name: {
			value: null,
			name: ['name'],
		},
		isPub: {
			value: 0,
			name: ['isPub'],
		},
		gender: {
			value: -1,
			name: ['gender'],
		},
		group: {
			value: null,
			name: ['group'],
		},
		doubingSu28: {
			value: 0,
			name: ['doubingSu28'],
		},
		creator: {
			value: null,
			name: ['creator'],
		},
		updateTime: {
			value: null,
			name: ['updateTime'],
		},
		cid: {
			value: null,
			name: ['cid'],
		},
		memoAstro:{
			value: null,
			name: ['memoAstro'],
		},
		memoBaZi:{
			value: null,
			name: ['memoBaZi'],
		},
		memoZiWei:{
			value: null,
			name: ['memoZiWei'],
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

function newEmptyCaseFields(){
	let now = new DateTime();
	const fields = {
		divTime: {
			value: now,
			name: ['divTime'],
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
		pos: {
			value: null,
			name: ['pos'],
		},
		event: {
			value: null,
			name: ['event'],
		},
		caseType: {
			value: 'liuyao',
			name: ['caseType'],
		},
		isPub: {
			value: 0,
			name: ['isPub'],
		},
		group: {
			value: null,
			name: ['group'],
		},
		creator: {
			value: null,
			name: ['creator'],
		},
		updateTime: {
			value: null,
			name: ['updateTime'],
		},
		cid: {
			value: null,
			name: ['cid'],
		},
		payload: {
			value: null,
			name: ['payload'],
		},
		sourceModule: {
			value: null,
			name: ['sourceModule'],
		},
	};
	return fields;
}

let now = new DateTime();

export default { 
	namespace: 'user',
	state:{
		token: null,
		charts: [],
		userInfo: null,
		admin: false,
		pageSize: 30,
		pageIndex: 1,
		total: 0,
		cases: [],
		casePageSize: 30,
		casePageIndex: 1,
		caseTotal: 0,

		bookshelf: [],
		currentBook: null,

		bookFields: {
			bookId: {
				value: null,
				name: ['bookId'],
			},
			name: {
				value: null,
				name: ['name'],
			},
			author: {
				value: null,
				name: ['author'],
			},
			img: {
				value: null,
				name: ['img'],
			},
		},

		pwdFields:{
            oldPwd: {
				value: null,
				name: ['oldPwd'],
            },
            newPwd: {
				value: null,
				name: ['newPwd'],
            },
            newPwdAgain: {
				value: null,
				name: ['newPwdAgain'],
            },
		},

		currentChart: {
			birth: {
				value: now,
				name: ['birth'],
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
			gender: {
				value: -1,
				name: ['gender'],
			},
			isPub: {
				value: 0,
				name: ['isPub'],
			},
			cid: {
				value: null,
				name: ['cid'],
			},
			doubingSu28: {
				value: 0,
				name: ['doubingSu28'],
			},
			creator: {
				value: null,
				name: ['creator'],
			},
			group: {
				value: null,
				name: ['group'],
			},
			updateTime: {
				value: null,
				name: ['updateTime'],
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
		currentCase: {
			divTime: {
				value: now,
				name: ['divTime'],
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
			event: {
				value: null,
				name: ['event'],
			},
			pos: {
				value: null,
				name: ['pos'],
			},
			caseType: {
				value: 'liuyao',
				name: ['caseType'],
			},
			isPub: {
				value: 0,
				name: ['isPub'],
			},
			cid: {
				value: null,
				name: ['cid'],
			},
			creator: {
				value: null,
				name: ['creator'],
			},
			group: {
				value: null,
				name: ['group'],
			},
			updateTime: {
				value: null,
				name: ['updateTime'],
			},
			payload: {
				value: null,
				name: ['payload'],
			},
			sourceModule: {
				value: null,
				name: ['sourceModule'],
			},
		},

	},
	

	reducers: {
		save(state, {payload: values}){
			let st = { ...state, ...values, };
			return st;
		},
	},

	effects: {
		*newCurrentChart({ payload: values }, { call, put }){
			const store = getStore();
			const astrostate = store.astro;
			const fld = astrostate.fields;
			let date = fld.date.value.format('YYYY-MM-DD');
			let time = fld.date.value.format('HH:mm:ss');
			let birth = date + ' ' + time;
			let chart = newEmptyChartFields();
			let tm = new DateTime();
			tm.setZone(fld.zone.value);
			chart.birth.value = tm.parse(birth, 'YYYY-MM-DD HH:mm:ss');
			chart.zone.value = tm.zone;
			chart.lat.value = fld.lat.value;
			chart.lon.value = fld.lon.value;
			chart.doubingSu28 = fld.doubingSu28.value;
			chart.group.value = fld.group.value;
			if(fld.group && !(fld.group.value instanceof Array)){
				try{
					chart.group.value = JSON.parse(fld.group.value);
					if(chart.group.value){
						if(chart.group.value.length === undefined || chart.group.value.length === null){
							chart.group.value = null;
						}
					}
				}catch(e){
					chart.group.value = null;
				}
			}
			chart.memo74.value = fld.memo74.value;
			chart.memoBaZi.value = fld.memoBaZi.value;
			chart.memoZiWei.value = fld.memoZiWei.value;
			chart.memoAstro.value = fld.memoAstro.value;
			chart.memoGua.value = fld.memoGua.value;
			chart.memoLiuReng.value = fld.memoLiuReng.value;
			chart.memoQiMeng.value = fld.memoQiMeng.value;
			chart.memoSuZhan.value = fld.memoSuZhan.value;

			yield put({
                type: 'save',
                payload: {  
					currentChart: chart,
                },
			});
			
			yield put({
                type: 'astro/save',
                payload: {  
					currentChart: chart,
                },
            });

		},

		*setCurrentChart({ payload: values }, { call, put }){
			let tm = new DateTime();
			tm.setZone(values.zone);
			let chart = newEmptyChartFields();
			if(values.birth instanceof DateTime){
				chart.birth.value = values.birth;
			}else{
				chart.birth.value = tm.parse(values.birth, 'YYYY-MM-DD HH:mm:ss');
			}
			chart.zone.value = tm.zone;
			chart.lat.value = values.lat;
			chart.lon.value = values.lon;
			chart.gpsLat.value = values.gpsLat;
			chart.gpsLon.value = values.gpsLon;
			chart.name.value = values.name;
			chart.pos.value = values.pos;
			chart.gender.value = parseInt(values.gender +'');
			chart.isPub.value = parseInt(values.isPub + '');
			chart.cid.value = values.cid;
			chart.creator.value = values.creator;
			chart.updateTime.value = values.updateTime;
			chart.doubingSu28.value = values.doubingSu28 ? values.doubingSu28 : 0;
			chart.group.value = values.group;
			if(values.group && !(values.group instanceof Array)){
				try{
					chart.group.value = JSON.parse(values.group);
					if(chart.group.value){
						if(chart.group.value.length === undefined || chart.group.value.length === null){
							chart.group.value = null;
						}
					}
				}catch(e){
					chart.group.value = null;
				}
			}

			chart.memo74.value = values.memo74;
			chart.memoBaZi.value = values.memoBaZi;
			chart.memoZiWei.value = values.memoZiWei;
			chart.memoAstro.value = values.memoAstro;
			chart.memoGua.value = values.memoGua;
			chart.memoLiuReng.value = values.memoLiuReng;
			chart.memoQiMeng.value = values.memoQiMeng;
			chart.memoSuZhan.value = values.memoSuZhan;

			yield put({
                type: 'save',
                payload: {  
					currentChart: chart,
                },
            });

			let val = {
				currentChart: chart,
			};
			if(values.drawerVisible){
				val.drawerVisible = values.drawerVisible;
			}

			yield put({
                type: 'astro/save',
                payload: val,
            });

			if(!values || values.skipFetchByChartData !== true){
				yield put({
	                type: 'astro/fetchByChartData',
	                payload: values,
	            });
			}

		},

		*newCurrentCase({ payload: values }, { call, put }){
			const store = getStore();
			const astrostate = store.astro;
			const fld = astrostate.fields;
			const caze = newEmptyCaseFields();
			let tm = new DateTime();
			if(fld && fld.date && fld.time){
				const dtstr = `${fld.date.value.format('YYYY-MM-DD')} ${fld.time.value.format('HH:mm:ss')}`;
				tm = tm.parse(dtstr, 'YYYY-MM-DD HH:mm:ss');
				tm.setZone(fld.zone.value);
			}
			caze.divTime.value = tm;
			caze.zone.value = fld && fld.zone ? fld.zone.value : tm.zone;
			caze.lat.value = fld && fld.lat ? fld.lat.value : DefLat;
			caze.lon.value = fld && fld.lon ? fld.lon.value : DefLon;
			caze.gpsLat.value = fld && fld.gpsLat ? fld.gpsLat.value : DefGpsLat;
			caze.gpsLon.value = fld && fld.gpsLon ? fld.gpsLon.value : DefGpsLon;
			caze.pos.value = fld && fld.pos ? fld.pos.value : null;
			if(values){
				if(values.caseType !== undefined && values.caseType !== null){
					caze.caseType.value = values.caseType;
				}
				if(values.event !== undefined && values.event !== null){
					caze.event.value = values.event;
				}
				if(values.payload !== undefined){
					caze.payload.value = values.payload;
				}
				if(values.sourceModule !== undefined){
					caze.sourceModule.value = values.sourceModule;
				}
				if(values.zone){
					caze.zone.value = values.zone;
				}
				if(values.lat){
					caze.lat.value = values.lat;
				}
				if(values.lon){
					caze.lon.value = values.lon;
				}
				if(values.gpsLat !== undefined && values.gpsLat !== null){
					caze.gpsLat.value = values.gpsLat;
				}
				if(values.gpsLon !== undefined && values.gpsLon !== null){
					caze.gpsLon.value = values.gpsLon;
				}
				if(values.pos !== undefined){
					caze.pos.value = values.pos;
				}
				if(values.divTime){
					let tcase = new DateTime();
					tcase.setZone(caze.zone.value || tm.zone);
					if(values.divTime instanceof DateTime){
						caze.divTime.value = values.divTime;
					}else{
						caze.divTime.value = tcase.parse(values.divTime, 'YYYY-MM-DD HH:mm:ss');
					}
				}
			}

			yield put({
				type: 'save',
				payload: {
					currentCase: caze,
				},
			});
		},

		*setCurrentCase({ payload: values }, { call, put }){
			const caze = newEmptyCaseFields();
			const zone = values.zone !== undefined && values.zone !== null ? values.zone : '+08:00';
			let tm = new DateTime();
			tm.setZone(zone);
			if(values.divTime instanceof DateTime){
				caze.divTime.value = values.divTime;
			}else{
				caze.divTime.value = tm.parse(values.divTime, 'YYYY-MM-DD HH:mm:ss');
			}
			caze.zone.value = zone;
			caze.lat.value = values.lat;
			caze.lon.value = values.lon;
			caze.gpsLat.value = values.gpsLat;
			caze.gpsLon.value = values.gpsLon;
			caze.event.value = values.event;
			caze.pos.value = values.pos;
			caze.caseType.value = values.caseType;
			caze.isPub.value = parseInt((values.isPub !== undefined && values.isPub !== null ? values.isPub : 0) + '', 10);
			caze.cid.value = values.cid;
			caze.creator.value = values.creator;
			caze.updateTime.value = values.updateTime;
			caze.group.value = values.group;
			if(values.group && !(values.group instanceof Array)){
				try{
					caze.group.value = JSON.parse(values.group);
					if(caze.group.value){
						if(caze.group.value.length === undefined || caze.group.value.length === null){
							caze.group.value = null;
						}
					}
				}catch(e){
					caze.group.value = null;
				}
			}
			caze.payload.value = values.payload;
			caze.sourceModule.value = values.sourceModule;

			yield put({
				type: 'save',
				payload: {
					currentCase: caze,
				},
			});

			if(values.drawerVisible){
				yield put({
					type: 'astro/save',
					payload: {
						drawerVisible: values.drawerVisible,
					},
				});
			}
		},

		*fetchCases({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			const store = getStore();
			const state = store.user;
			if(param.PageIndex === undefined || param.PageIndex === null){
				param.PageIndex = state.casePageIndex;
				param.PageSize = state.casePageSize;
			}
			const result = getPagedLocalCases(param);
			yield put({
				type: 'save',
				payload: {
					cases: result.List,
					caseTotal: result.Total,
					casePageIndex: result.PageIndex,
					casePageSize: result.PageSize,
				},
			});
		},

		*searchCases({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			const store = getStore();
			const state = store.user;
			if(param.PageIndex === undefined || param.PageIndex === null){
				param.PageIndex = state.casePageIndex;
				param.PageSize = state.casePageSize;
			}
			const result = getPagedLocalCases(param);
			yield put({
				type: 'save',
				payload: {
					cases: result.List,
					caseTotal: result.Total,
					casePageIndex: result.PageIndex,
					casePageSize: result.PageSize,
				},
			});
		},

		*addCase({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			if(values.divTime){
				param.divTime = values.divTime.format('YYYY-MM-DD HH:mm:ss');
				param.zone = values.divTime.zone;
			}
			const rec = upsertLocalCase(param);
			yield put({
				type: 'setCurrentCase',
				payload: rec,
			});
			yield put({
				type: 'astro/openDrawer',
				payload: {
					key: 'caselist',
				},
			});
		},

		*updateCase({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			if(values.divTime){
				param.divTime = values.divTime.format('YYYY-MM-DD HH:mm:ss');
				param.zone = values.divTime.zone;
			}
			const rec = upsertLocalCase(param);
			yield put({
				type: 'setCurrentCase',
				payload: rec,
			});
			yield put({
				type: 'astro/openDrawer',
				payload: {
					key: 'caselist',
				},
			});
		},

		*deleteCase({ payload: values }, { call, put }){
			removeLocalCase(values.cid);
			yield put({
				type: 'astro/openDrawer',
				payload: {
					key: 'caselist',
				},
			});
		},

		*applyCase({ payload: values }, { call, put }){
			yield put({
				type: 'setCurrentCase',
				payload: values,
			});
			const store = getStore();
			const astrostate = store.astro;
			const flds = {
				...astrostate.fields,
			};
			let tm = new DateTime();
			const zone = values.zone ? values.zone : (flds.zone ? flds.zone.value : '+08:00');
			tm.setZone(zone);
			let divTime = values.divTime;
			if(divTime instanceof DateTime){
				tm = divTime.clone ? divTime.clone() : divTime;
			}else if(typeof divTime === 'string' && divTime){
				tm = tm.parse(divTime, 'YYYY-MM-DD HH:mm:ss');
			}
			flds.date.value = tm.clone();
			flds.time.value = tm.clone();
			flds.ad.value = tm.ad;
			flds.zone.value = zone;
			if(values.lon){
				flds.lon.value = values.lon;
			}
			if(values.lat){
				flds.lat.value = values.lat;
			}
			if(values.gpsLon !== undefined && values.gpsLon !== null){
				flds.gpsLon.value = values.gpsLon;
			}
			if(values.gpsLat !== undefined && values.gpsLat !== null){
				flds.gpsLat.value = values.gpsLat;
			}
			if(values.pos !== undefined){
				flds.pos.value = values.pos;
			}
			const typeMeta = getCaseTypeMeta(values.caseType);
			const nextTab = typeMeta.tab ? typeMeta.tab : (typeMeta.module === 'sanshiunited' ? 'sanshiunited' : 'cnyibu');
			yield put({
				type: 'astro/save',
				payload: {
					currentTab: nextTab,
					currentSubTab: nextTab === 'cnyibu' ? typeMeta.subTab : null,
				},
			});
			yield put({
				type: 'astro/fetchByFields',
				payload: flds,
			});
			yield put({
				type: 'astro/closeDrawer',
				payload: {},
			});
		},

		*searchCharts({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			const store = getStore();
			const state = store.user;
			if(param.PageIndex === undefined || param.PageIndex === null){
				param.PageIndex = state.pageIndex;
				param.PageSize = state.pageSize;
			}
			if(param.name === undefined || param.name === null || param.name === ''){
				yield put({
					type: 'fetchCharts',
					payload: param,
				});
				return;
			}
			const result = getPagedLocalCharts(param);
	            yield put({
	                type: 'save',
	                payload: {  
						charts: result.List,
						total: result.Total,
						pageIndex: result.PageIndex,
						pageSize: result.PageSize,
	                },
	            });
			return;

		},

		*fetchCharts({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			const store = getStore();
			const state = store.user;
			if(param.PageIndex === undefined || param.PageIndex === null){
				param.PageIndex = state.pageIndex;
				param.PageSize = state.pageSize;
			}
			const result = getPagedLocalCharts(param);
			yield put({
                type: 'save',
                payload: {  
					charts: result.List,
					total: result.Total,
					pageIndex: result.PageIndex,
					pageSize: result.PageSize,
                },
            });
			return;

		},

		*addChart({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			if(values.birth){
				param.birth = values.birth.format('YYYY-MM-DD HH:mm:ss');
				param.zone = values.birth.zone;
			}
			const rec = upsertLocalChart(param);
			yield put({
	                type: 'setCurrentChart',
	                payload: rec,
	            });

            yield put({
                type: 'astro/openDrawer',
                payload: {
					key: 'chartlist'
				},
            });
			return;
			
		},

		*updateChart({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			if(values.birth){
				param.birth = values.birth.format('YYYY-MM-DD HH:mm:ss');
				param.zone = values.birth.zone;
			}
			const rec = upsertLocalChart(param);
			yield put({
	                type: 'setCurrentChart',
	                payload: rec,
	            });
			yield put({
	                type: 'astro/openDrawer',
	                payload: {
						key: 'chartlist'
					},
				});

            yield put({
                type: 'astro/fetchByChartData',
                payload: {
					...values,
					birth: param.birth,
					zone: param.zone,
				},
			});
			return;

		},

		*saveMemo({ payload: values }, { call, put }){
            const store = getStore();
			const currentChart = store.user.currentChart;
			let type = values.type;
			if(type === 0){
				currentChart.memoAstro.value = values.orgMemo;
			}else if(type === 1){
				currentChart.memoBaZi.value = values.orgMemo;
			}else if(type === 2){
				currentChart.memoZiWei.value = values.orgMemo;
			}else if(type === 3){
				currentChart.memo74.value = values.orgMemo;
			}else if(type === 4){
				currentChart.memoGua.value = values.orgMemo;
			}else if(type === 5){
				currentChart.memoLiuReng.value = values.orgMemo;
			}else if(type === 6){
				currentChart.memoQiMeng.value = values.orgMemo;
			}else if(type === 7){
				currentChart.memoSuZhan.value = values.orgMemo;
			}
			upsertLocalChart({
				cid: values.cid,
				memoAstro: currentChart.memoAstro.value,
				memoBaZi: currentChart.memoBaZi.value,
				memoZiWei: currentChart.memoZiWei.value,
				memo74: currentChart.memo74.value,
				memoGua: currentChart.memoGua.value,
				memoLiuReng: currentChart.memoLiuReng.value,
				memoQiMeng: currentChart.memoQiMeng.value,
				memoSuZhan: currentChart.memoSuZhan.value,
				name: currentChart.name.value,
				birth: currentChart.birth.value.format('YYYY-MM-DD HH:mm:ss'),
				zone: currentChart.zone.value,
				lat: currentChart.lat.value,
				lon: currentChart.lon.value,
				gpsLat: currentChart.gpsLat.value,
				gpsLon: currentChart.gpsLon.value,
				pos: currentChart.pos.value,
				gender: currentChart.gender.value,
				isPub: currentChart.isPub.value,
				group: currentChart.group.value,
				doubingSu28: currentChart.doubingSu28.value,
				creator: currentChart.creator.value,
			});
			Modal.info({
				title: '批注已保存到本地。'
			});
			yield put({
	                type: 'save',
	                payload: {
					currentChart: currentChart,
				},
	            });
			yield put({
	                type: 'astro/save',
	                payload: {  
					currentChart: currentChart,
	                },
	            });
			return;
		},

		*deleteChart({ payload: values }, { call, put }){
			removeLocalChart(values.cid);
	            yield put({
	                type: 'astro/openDrawer',
	                payload: {
					key: 'chartlist'
				},
	            });
			return;

		},

		*changePwd({ payload: values }, { call, put }){
            let params = {
                OldPwd: values.oldPwd,
                NewPwd: values.newPwd,
			};
			
			const { Result } = yield call(service.changepwd, params);

            yield put({
                type: 'astro/closeDrawer',
                payload: {},
            });

		},

		*changeParams({ payload: values }, { call, put }){
			const param = {
				...values,
			};

			const { Result } = yield call(service.changeparams, param);

			yield put({
                type: 'astro/closeDrawer',
                payload: {},
            });

		},

		*listBooks({ payload: values }, { call, put }){
			const param = {
				Name: values.name,
			};

			const { Result } = yield call(service.listBooks, param);
			Result.Books.map((book, idx)=>{
				book.catalog = JSON.parse(book.catalog);
			});
			yield put({
                type: 'save',
                payload: {  
					bookshelf: Result.Books,
                },
            });
		},

		*deleteBook({ payload: values }, { call, put }){
			const param = {
				BookId: values.bookId,
			};

			const { Result } = yield call(service.deleteBook, param);
			Result.Books.map((book, idx)=>{
				book.catalog = JSON.parse(book.catalog);
			});
			yield put({
                type: 'save',
                payload: {  
					bookshelf: Result.Books,
                },
            });
		},

		*removeBook({ payload: values }, { call, put }){
			const param = {
				BookId: values.bookId,
			};

			const { Result } = yield call(service.removeBook, param);
			Result.Books.map((book, idx)=>{
				book.catalog = JSON.parse(book.catalog);
			});
			yield put({
                type: 'save',
                payload: {  
					bookshelf: Result.Books,
                },
            });
		},

		*updateBook({ payload: values }, { call, put }){
			const store = getStore();
			const userstate = store.getState().user;
			const fld = userstate.bookFields;
            let params = {
				BookId: fld.bookId.value,
                Name: values.name,
                Author: values.author,
			};
			
			const { Result } = yield call(service.updateBook, params);
			Result.Books.map((book, idx)=>{
				book.catalog = JSON.parse(book.catalog);
			});
			yield put({
                type: 'save',
                payload: {  
					bookshelf: Result.Books,
                },
			});

		},

		*readBook({ payload: values }, { call, put }){
			yield put({
                type: 'save',
                payload: {  
					currentBook: values,
                },
			});

		},

	}

}
