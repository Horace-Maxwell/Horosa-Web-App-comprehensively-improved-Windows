import { history } from 'umi';
import { Modal, } from 'antd';
import * as service from '../services/user';
import DateTime from '../components/comp/DateTime';
import { DefLat, DefLon, DefGpsLat, DefGpsLon, } from '../utils/constants';
import { getPagedLocalCharts, upsertLocalChart, removeLocalChart } from '../utils/localcharts';
import { getPagedLocalCases, upsertLocalCase, removeLocalCase, getCaseTypeMeta } from '../utils/localcases';


// 书架 catalog 字段为服务端存的 JSON 串;单本损坏不能拖垮整个书架列表(map 内裸 parse
// 抛错会让 effect 在 save 前中断)。坏数据回退空目录,消费端 BookReader 同此口径。
function parseBookCatalogs(books){
	(books || []).forEach((book)=>{
		try{
			book.catalog = JSON.parse(book.catalog);
		}catch(e){
			book.catalog = [];
		}
	});
	return books;
}

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
		// 日界点 + 晚子时·时柱起干 + 时间算法 必须随命盘存档(不存则下次打开按全局默认,日柱/时柱可能算错)。
		orbs:{
			value: undefined,
			name: ['orbs'],
		},
		orbScale:{
			value: undefined,
			name: ['orbScale'],
		},
		after23NewDay:{
			value: undefined,
			name: ['after23NewDay'],
		},
		lateZiHourUseNextDay:{
			value: undefined,
			name: ['lateZiHourUseNextDay'],
		},
		timeAlg:{
			value: undefined,
			name: ['timeAlg'],
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
		payload: {
			value: null,
			name: ['payload'],
		},
		sourceModule: {
			value: null,
			name: ['sourceModule'],
		},
		chartType: {
			value: null,
			name: ['chartType'],
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

		// 🔴 事盘「显式载入」代次:每执行一次 applyCase(用户在列表里点一条记录)即 +1。
		// 各技法读档函数都有一道去重守卫 `!force && lastRestoredCaseId === saved.caseVersion`,
		// 而 lastRestoredCaseId 只在构造函数里初始化、任何地方都不会重置 —— 于是同一条记录
		// 第二次载入必被守卫拦掉,屏幕上仍是用户后来新起的卦(用户实报:灵棋经存了再读卦不一样)。
		// 把本代次拼进 caseVersion 后:用户每点一次记录代次就变、必定重新还原;
		// 而 fields 因无关原因变化时代次不变、守卫照旧拦住(守卫原意「别反复覆盖用户现场」得以保留)。
		caseApplySeq: 0,

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
			// 日界点 + 晚子时·时柱起干 + 时间算法 随命盘持久化(用户拍板,见 dayBoundary.js)。
			orbs:{
				value: undefined,
				name: ['orbs'],
			},
			orbScale:{
				value: undefined,
				name: ['orbScale'],
			},
			after23NewDay:{
				value: undefined,
				name: ['after23NewDay'],
			},
			lateZiHourUseNextDay:{
				value: undefined,
				name: ['lateZiHourUseNextDay'],
			},
			timeAlg:{
				value: undefined,
				name: ['timeAlg'],
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
			payload: {
				value: null,
				name: ['payload'],
			},
			sourceModule: {
				value: null,
				name: ['sourceModule'],
			},
			chartType: {
				value: null,
				name: ['chartType'],
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
		*newCurrentChart({ payload: values }, { call, put, select }){
			const astrostate = yield select((s)=>s.astro);
			const fld = astrostate.fields;
			let date = fld.date.value.format('YYYY-MM-DD');
			let time = fld.date.value.format('HH:mm:ss');
			// 调用方可注入完整出生时间(如奇门「保存为命盘」用起局时间作生时)；占星新增命盘不传 → 沿用全局 fields,行为不变。
			let birth = (values && values.birth) ? `${values.birth}` : (date + ' ' + time);
			let chart = newEmptyChartFields();
			let tm = new DateTime();
			tm.setZone((values && values.zone) ? values.zone : fld.zone.value);
			chart.birth.value = tm.parse(birth, 'YYYY-MM-DD HH:mm:ss');
			chart.zone.value = tm.zone;
			chart.lat.value = fld.lat.value;
			chart.lon.value = fld.lon.value;
			chart.doubingSu28.value = fld.doubingSu28 ? fld.doubingSu28.value : 0;
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
			// 日界点 + 晚子时·时柱起干 + 时间算法 随命盘存档(用户拍板,见 dayBoundary.js)。
			if(fld.after23NewDay && fld.after23NewDay.value !== undefined){
				chart.after23NewDay.value = fld.after23NewDay.value;
			}
			if(fld.orbs && fld.orbs.value){ chart.orbs.value = fld.orbs.value; }
			if(fld.orbScale && fld.orbScale.value){ chart.orbScale.value = fld.orbScale.value; }
			if(fld.lateZiHourUseNextDay && fld.lateZiHourUseNextDay.value !== undefined){
				chart.lateZiHourUseNextDay.value = fld.lateZiHourUseNextDay.value;
			}
			if(fld.timeAlg && fld.timeAlg.value !== undefined){
				chart.timeAlg.value = fld.timeAlg.value;
			}
			if(values){
				if(values.payload !== undefined){
					chart.payload.value = values.payload;
				}
				if(values.sourceModule !== undefined){
					chart.sourceModule.value = values.sourceModule;
				}
				if(values.chartType !== undefined){
					chart.chartType.value = values.chartType;
				}
				// 调用方可注入完整人盘信息(奇门「保存为命盘」补性别/经纬度/地名,使命盘管理里信息完整)；占星新增不传 → 不变。
				if(values.gender !== undefined && values.gender !== null && chart.gender){ chart.gender.value = values.gender; }
				if(values.pos !== undefined && values.pos !== null && chart.pos){ chart.pos.value = values.pos; }
				if(values.lat !== undefined && values.lat !== null){ chart.lat.value = values.lat; }
				if(values.lon !== undefined && values.lon !== null){ chart.lon.value = values.lon; }
				if(values.gpsLat !== undefined && values.gpsLat !== null && chart.gpsLat){ chart.gpsLat.value = values.gpsLat; }
				if(values.gpsLon !== undefined && values.gpsLon !== null && chart.gpsLon){ chart.gpsLon.value = values.gpsLon; }
				if(values.name !== undefined && values.name !== null && chart.name){ chart.name.value = values.name; }
			}

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
			chart.payload.value = values.payload;
			chart.sourceModule.value = values.sourceModule;
			chart.chartType.value = values.chartType;

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

		*newCurrentCase({ payload: values }, { call, put, select }){
			const astrostate = yield select((s)=>s.astro);
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
				if(values.lat !== undefined && values.lat !== null){
					caze.lat.value = values.lat;
				}
				if(values.lon !== undefined && values.lon !== null){
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

		*fetchCases({ payload: values }, { call, put, select }){
			const param = {
				...values,
			};
			const state = yield select((s)=>s.user);
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

		*searchCases({ payload: values }, { call, put, select }){
			const param = {
				...values,
			};
			const state = yield select((s)=>s.user);
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
			try{
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
			}catch(e){
				Modal.error({
					title: '事盘保存失败',
					content: '本地存储不可用或空间不足，请导出清理后重试。',
				});
			}
		},

		*updateCase({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			try{
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
			}catch(e){
				Modal.error({
					title: '事盘更新失败',
					content: '本地存储不可用或空间不足，请导出清理后重试。',
				});
			}
		},

		*deleteCase({ payload: values }, { call, put, select }){
			try{
				removeLocalCase(values.cid);
				// [X1·P2-43] 删的是当前已应用事盘 → 清 currentCase;否则技法页 restoreFromCurrentCase
				// 与 AI 挂载 getKentangSavedCasePayload 继续命中已删档(幽灵还原)。
				const cur = yield select((s)=>s.user && s.user.currentCase);
				const curCid = cur && cur.cid && cur.cid.value !== undefined && cur.cid.value !== null ? `${cur.cid.value}` : null;
				if(curCid !== null && `${values.cid}` === curCid){
					yield put({ type: 'save', payload: { currentCase: null } });
				}
				yield put({
					type: 'astro/openDrawer',
					payload: {
						key: 'caselist',
					},
				});
			}catch(e){
				Modal.error({
					title: '事盘删除失败',
					content: '本地存储不可用，请稍后重试。',
				});
			}
		},

		*applyCase({ payload: values }, { call, put, select }){
			// 🔴 先自增「显式载入代次」再设 currentCase:代次进 caseVersion(kentangCaseSave.js),
			// 各技法的读档去重守卫据此认出「这是用户又点了一次记录」,从而必定重新还原 ——
			// 同一条记录连点两次也必两次还原(此前第二次永远被守卫拦掉,是存档失真的直接根因)。
			const prevSeq = yield select((s)=>(s.user && s.user.caseApplySeq) || 0);
			yield put({
				type: 'save',
				payload: { caseApplySeq: prevSeq + 1 },
			});
			yield put({
				type: 'setCurrentCase',
				payload: values,
			});
			// Close management drawers immediately so case selection always exits back to the target technique view.
			yield put({
				type: 'astro/closeDrawer',
				payload: {},
			});
			const astrostate = yield select((s)=>s.astro);
			const flds = {
				...astrostate.fields,
			};
			// 与 astro/fetchByChartData 同款不可变写：命中键写「新 entry」，绝不就地改共享 entry
			// （否则组件层 prevProps 与 props 同对象、值比对失明；失败路径也会脏写 state）。
			const setF = (key, value)=>{ flds[key] = { ...(flds[key] || { name: [key] }), value }; };
			let tm = new DateTime();
			const zone = values.zone ? values.zone : (flds.zone ? flds.zone.value : '+08:00');
			tm.setZone(zone);
			let divTime = values.divTime;
			if(divTime instanceof DateTime){
				tm = divTime.clone ? divTime.clone() : divTime;
			}else if(typeof divTime === 'string' && divTime){
				tm = tm.parse(divTime, 'YYYY-MM-DD HH:mm:ss');
			}
			setF('date', tm.clone());
			setF('time', tm.clone());
			setF('ad', tm.ad);
			setF('zone', zone);
			if(values.lon !== undefined && values.lon !== null){
				setF('lon', values.lon);
			}
			if(values.lat !== undefined && values.lat !== null){
				setF('lat', values.lat);
			}
			if(values.gpsLon !== undefined && values.gpsLon !== null){
				setF('gpsLon', values.gpsLon);
			}
			if(values.gpsLat !== undefined && values.gpsLat !== null){
				setF('gpsLat', values.gpsLat);
			}
			if(values.pos !== undefined){
				setF('pos', values.pos);
			}
			// 储存全字段保真:与 astro/fetchByChartData(命盘还原)同口径,案例/事盘还原也补回性别 +
			// 影响盘的设置(日界点/晚子时/时间算法/容许度),否则沿用当前全局值致还原盘错位
			// (如保存时求测人性别=女、还原时全局=男 → 用神/乾坤造错位)。存档无该字段则跳过、不改现状。
			// 🔴 [X1 审计] 事盘经 openKentangCaseDrawer 存的这些口径在 payload.fieldSnapshot(嵌套),
			// 顶层同名键永不存在 → 此前全仓只写不读、载入必回落全局当前值;读取补嵌套回退(顶层优先兼容旧档)。
			const caseFieldSnap = (values.payload && values.payload.fieldSnapshot && typeof values.payload.fieldSnapshot === 'object') ? values.payload.fieldSnapshot : {};
			const pickCaseField = (k)=>{
				const v = values[k] !== undefined && values[k] !== null && values[k] !== '' ? values[k] : caseFieldSnap[k];
				return v === undefined || v === null || v === '' ? null : v;
			};
			if(values.gender !== undefined && values.gender !== null){ setF('gender', parseInt(values.gender + '', 10)); }
			if(pickCaseField('after23NewDay') !== null){ setF('after23NewDay', parseInt(pickCaseField('after23NewDay') + '', 10)); }
			if(pickCaseField('lateZiHourUseNextDay') !== null){ setF('lateZiHourUseNextDay', parseInt(pickCaseField('lateZiHourUseNextDay') + '', 10)); }
			if(pickCaseField('guaAfter23NewDay') !== null){ setF('guaAfter23NewDay', parseInt(pickCaseField('guaAfter23NewDay') + '', 10)); }
			if(pickCaseField('timeAlg') !== null){ setF('timeAlg', parseInt(pickCaseField('timeAlg') + '', 10)); }
			if(values.orbs && typeof values.orbs === 'object'){ setF('orbs', values.orbs); }
			if(values.orbScale !== undefined && values.orbScale !== null){ setF('orbScale', values.orbScale); }
			const typeMeta = getCaseTypeMeta(values.caseType || values.sourceModule);
			const nextTab = typeMeta.tab ? typeMeta.tab : (typeMeta.module === 'sanshiunited' ? 'sanshiunited' : 'cnyibu');
			const nextSubTab = typeMeta.subTab || null;
			yield put({
				type: 'astro/save',
				payload: {
					currentTab: nextTab,
					currentSubTab: nextSubTab,
				},
			});
			yield put({
				type: 'astro/fetchByFields',
				payload: flds,
			});
		},

		*searchCharts({ payload: values }, { call, put, select }){
			const param = {
				...values,
			};
			const state = yield select((s)=>s.user);
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

		*fetchCharts({ payload: values }, { call, put, select }){
			const param = {
				...values,
			};
			const state = yield select((s)=>s.user);
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
			try{
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
			}catch(e){
				Modal.error({
					title: '命盘保存失败',
					content: '本地存储不可用或空间不足，请导出清理后重试。',
				});
			}
			return;
			
		},

		*addLocalChartQuiet({ payload: values }, { put }){
			// 静默入库(名人库「加入命盘」等场景):不弹「星盘列表」抽屉、不导航,仅落库 + 刷新列表 state。
			// addChart 面向保存表单(打开列表抽屉且birth 为 DateTime(带符号年,BC/五位年安全));此处 payload.birth 多为字符串
			// ("YYYY-MM-DD HH:mm:ss"),upsertLocalChart/buildLocalChartRecord 本就容忍字符串,直接落库。
			try{
				upsertLocalChart(values);
				yield put({ type: 'fetchCharts', payload: {} });
			}catch(e){
				// localStorage 满/不可用:静默失败(调用方 iframe 已给乐观提示);不打断当前页。
			}
			return;
		},

		*updateChart({ payload: values }, { call, put }){
			const param = {
				...values,
			};
			try{
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
			}catch(e){
				Modal.error({
					title: '命盘更新失败',
					content: '本地存储不可用或空间不足，请导出清理后重试。',
				});
			}
			return;

		},

		*saveMemo({ payload: values }, { call, put, select }){
            const currentChart = yield select((s)=>s.user.currentChart);
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
			try{
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
					payload: currentChart.payload ? currentChart.payload.value : null,
					sourceModule: currentChart.sourceModule ? currentChart.sourceModule.value : null,
					chartType: currentChart.chartType ? currentChart.chartType.value : null,
				});
			}catch(e){
				Modal.error({
					title: '批注保存失败',
					content: '本地存储不可用或空间不足，请导出清理后重试。',
				});
				return;
			}
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
			parseBookCatalogs(Result.Books);
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
			parseBookCatalogs(Result.Books);
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
			parseBookCatalogs(Result.Books);
			yield put({
                type: 'save',
                payload: {  
					bookshelf: Result.Books,
                },
            });
		},

		*updateBook({ payload: values }, { call, put, select }){
			const userstate = yield select((s)=>s.user);
			const fld = userstate.bookFields;
            let params = {
				BookId: fld.bookId.value,
                Name: values.name,
                Author: values.author,
			};
			
			const { Result } = yield call(service.updateBook, params);
			parseBookCatalogs(Result.Books);
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
