// 星盘页 dva 模型(model 对象与改写模块级状态的挂钩句柄 / 主链中止控制器在这里;模块级助手按职责拆在 astro/ 下):
//   fields(空字段表 = 非默认捕获的基准、字段 → 排盘请求参数)→ chartFlow(是否带主限法、响应校验与报错、抽屉收起、提交代次、
//   步进预取任务构造与登记、挂钩分发)。astro/ 下的文件没有默认导出,dva 的模型扫描按校验跳过它们。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { normalizeBaziCalibreOverride, recordPinsDayBoundary } from '../utils/baziCalibreScope';
import {getStore, } from '../utils/storageutil';
import { message } from 'antd';
import { RECORD_DISPLAY_FIELDS } from '../utils/localRecordStore';
import DateTime from '../components/comp/DateTime';
import * as service from '../services/astro';
import {randomStr,} from '../utils/helper';
import { saveAstroAISnapshotLazy, } from '../utils/astroAiSnapshot';
import { hookRafEnabled, fieldsFastCommitEnabled, prewarmRequestsEnabled, stepPrefetchArmEnabled, stepPrefetchDepth, mainChainAbortEnabled } from '../utils/perfFlags';
import { submitStepPrefetch } from '../utils/stepPrefetch';
// R4-B2(horosa_step_prefetch_arm_v1):「选步长即武装」——构造器经 registerArmPlanBuilder
// 注入(utils 不反向 import models);settle 兜底武装的档位来自 reportStepUnit 的记录。
import { reportStepUnit, currentStepUnit, shouldArmForTab } from '../utils/stepPrefetchArm';
// R4-B5(horosa_option_prefetch_v1):选项 Hamming-1 投机 —— 构参注入同 arm,settle 尾空闲投机。
import { registerOptionChartTaskBuilder, speculateChartOptions } from '../utils/optionPrefetch';
import { perfBegin } from '../utils/perfMark';
import { loadLocalFateEvents, saveLocalFateEvents, } from '../utils/localdeeplearn';
import { applyRecordToFields } from '../utils/recordFieldsRestore';
import { applyZiweiRecordSettings, restoreZiweiUserSeed, dropZiweiSessionTablesUnlessFor } from '../utils/ziweiRecordSettings';
// 「新盘种子」:随盘键(黄道 / 宫制 / 时间算法 / 八字长生·神煞 / 宿法 / 印占 / 主限法口径)的新命盘缺省 = 上次亲手设的值;
// 没存过 = 内建默认逐字节零回归;载入记录时由 recordFieldsRestore 先复位到内建默认(记录自带口径永远优先)。
import { newChartSeedValue } from '../utils/newChartSeeds';
import { newEmptyFields, fieldsToParams } from './astro/fields';
import { shouldIncludePrimaryDirection, isValidChartResponse, showChartServiceError, closeAllDrawer, takeChartCommitTicket, chartCommitTicketLive, buildStepPrefetchTasks, hooking, now } from './astro/chartFlow';
import { speculativePrecomputeEnabled } from '../utils/perfFlags';
export { fieldsToParams as __fieldsToParamsForTest } from './astro/fields';
export { buildStepPrefetchTasks as __buildStepPrefetchTasksForTest } from './astro/chartFlow';

// doHook rAF 合并用:未执行的上一帧任务句柄(latest-wins,见 *doHook)。
let pendingHookFrame = null;
// /chart 主链在途请求的 AbortController(模块级单例:新发先 abort 旧)。
let chartMainAbortCtl = null;

// R4-B5(horosa_option_prefetch_v1):选项投机的 /chart 变体任务构造器 —— 与真点/步进预取
// 共用同一 fieldsToParams 路径(键逐字节同是命中的唯一前提)。
registerOptionChartTaskBuilder((variantFields, astroState)=>{
	const param = fieldsToParams(variantFields);
	param.cid = null;
	param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
	return {
		name: 'chart',
		path: '/chart',
		run: ()=> service.fetchChart(param, { silent: true, retry: { retries: 0 } }),
	};
});

// 具名导出(仅供金标):键等性锁要机械验证「预取构出的 param ≡ 用户真点会发出的 param」,
// 私有函数测不到 —— 导出不改任何运行时行为(dva 只吃 default)。

// PERF-R8 P0(纯观测,horosa_interaction_span_v1 配套):排盘 saga 成功提交 chartObj 后打
// refresh-end mark,并与 pages/index.js 的 horosa:tab:*:refresh-start 配 measure ——
// DevTools Performance 面板可把「点击→显示」分解为 后端+网络(start→end)与
// 前端渲染(end→render-complete)。失败静默,零行为影响。
function markChartRefreshEnd(){
	try{
		if(typeof performance !== 'undefined' && performance.mark){
			performance.mark('horosa:chart:refresh-end');
			if(performance.getEntriesByType && performance.measure){
				const starts = performance.getEntriesByType('mark').filter((m)=>m.name.indexOf(':refresh-start') >= 0);
				if(starts.length){
					performance.measure('horosa:chart:refresh', starts[starts.length - 1].name, 'horosa:chart:refresh-end');
				}
			}
		}
	}catch(e){ /* observation only */ }
}

const model = {
	namespace: 'astro',
	state:{
		height: 660,
		chartObj: null,
		bootChartRestore: null,      // 温启恢复状态:null / 'pending' / 'done' / 'dropped' / 'failed'
		bootFieldsApplied: false,    // checkUser 已在恢复期落过 fields(失败回落「此刻」由恢复方负责)
		drawerVisible: closeAllDrawer('init'),
		currentTab: 'astrochart',
		// 八字本页口径覆盖层(日界 / 晚子时 / 时间算法;只八字页读;新命盘 / 载入复位)+ 载入命盘自带口径钉住共享层
		baziCalibreOverride: {},
		_dayBoundaryRecordPinned: false,
		// 「左栏亲手改过日界 / 晚子时」的锁只属于当时那张盘:换盘(载入 / 新命盘 / 此刻)一律复位;
		// chartEpoch 每换一张盘 +1,技法页组件实例上的锁按它判是不是同一张盘(utils/dayBoundaryLock.js)
		_after23BoundaryUserOverrode: false,
		_lateZiHourUserOverrode: false,
		chartEpoch: 0,
		// 「用户已动手」代次:用户操作改 fields 一律经 saveUserFields(+1);温启恢复的响应回来时它变了就丢弃(latest-wins,与主盘提交代次并列)
		userFieldsRev: 0,
		currentSubTab: null,
		currentChart: null,
		memoType: 0,
		memo: '',

		deeplearn: null,

		predictHook:{
			astrochart:{
				fun: null
			},
			bazi:{
				fun: null
			},
			ziwei:{
				fun: null
			},
			planetarium:{
				fun: null
			},
			planetarium:{
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
			auxchart:{
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
			guazhan:{
				fun: null
			},
			liureng:{
				fun: null
			},
			dunjia:{
				fun: null
			},
			taiyi:{
				fun: null
			},
			shusuan:{
				fun: null
			},
			yanqin:{
				fun: null
			},
			mingother:{
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
			aianalysis:{
				fun: null
			},
			guolao:{
				fun: null
			},

		},

		// [2026-07 五批] fields 初始态单源化:此前是与 newEmptyFields() 平行的手写字面量,
		// 缺 27 键(全部古典播种键 + guolao/india 键)→ app 启动首发 nowChart 链拿到的 fields
		// 无播种键,「设置→星盘设置」全局偏好在重启后对主页首发盘全部失效(直到抽屉再改一次
		// 被 applyClassicalField patch 救回)。单源 = newEmptyFields()(种子读全局仓);
		// 仅时间四键保留原字面量语义(date 归零到当日 00:00 的 startOf 口径)。
		fields: {
			...newEmptyFields(),
			ad: { value: now.ad, name: ['ad'] },
			date: { value: now.startOf('date'), name: ['date'] },
			time: { value: now.clone(), name: ['time'] },
			zone: { value: now.zone, name: ['zone'] },
		},
	},

	reducers: {
		// 用户操作触发的 fields 写入(左栏 / 表单 / 显示设置 / 跳转到盘…):与 save 相同,另把「用户已动手」代次 +1。
		// 温启恢复据此判用户是否已先动手 —— 此前只认 chartObj 变 / 快车道代次推进,紫微左栏改字段两者都不动,回包按快照重建盖掉
		saveUserFields(state, action){
			const next = model.reducers.save(state, action);
			return { ...next, userFieldsRev: ((state && state.userFieldsRev) || 0) + 1 };
		},

		save(state, {payload: values}){
			// __stepHint 是「步进方向提示」瞬态字段,只供 fetchByFields
			// 消费(其内已剥);个别宿主(紫微/八字/三式 syncFields)把 patch 原样 save ——
			// 在唯一入口统一剥离,保证它永不落 redux/存档。
			if(values && values.fields && Object.prototype.hasOwnProperty.call(values.fields, '__stepHint')){
				const { __stepHint, ...cleanFields } = values.fields;
				values = { ...values, fields: cleanFields };
			}
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
				if(tab === 'bazi'){
					type = 1;
					memo = currentChart.memoBaZi.value;
				}else if(tab === 'ziwei'){
					type = 2;
					memo = currentChart.memoZiWei.value;
				}else if(tab === 'guazhan'){
					type = 4;
					memo = currentChart.memoGua.value;
				}else if(tab === 'liureng'){
					type = 5;
					memo = currentChart.memoLiuReng.value;
				}else if(tab === 'dunjia' || tab === 'taiyi'){
					type = 6;
					memo = currentChart.memoQiMeng.value;
				}else if(tab === 'cntradition'){
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

		syncAfter23NewDay(state, { payload }){
			const value = payload && payload.after23NewDay;
			if(value !== 0 && value !== 1) return state;
			// 共享层只被「载入命盘自带口径」钉住(随盘值 > 全局);八字左栏改动已分到本页覆盖层,
			// 不再锁死全局同步(此前锁到重启,其它技法对全局失聪)。_after23BoundaryUserOverrode 旧锁仍有写入者:
			// 金口诀 / 六壬 / 卦占左栏改日界时置位(紫微同样派发,但紫微左栏没有日界控件、走不到),且本会话内不复位 ——
			// 置位后「设置 → 日界」的全局改动不再同步到共享 fields(各页本页覆盖层另算)。
			if(state && (state._dayBoundaryRecordPinned || state._after23BoundaryUserOverrode)) return state;
			const next = { ...state };
			if(next.fields && next.fields.after23NewDay){
				next.fields = {
					...next.fields,
					after23NewDay: { ...next.fields.after23NewDay, value },
				};
			}
			return next;
		},

		syncLateZiHourMode(state, { payload }){
			const value = payload && payload.lateZiHourUseNextDay;
			if(value !== 0 && value !== 1) return state;
			// 同上:只被载入命盘自带口径钉住;旧锁保留兼容。
			if(state && (state._dayBoundaryRecordPinned || state._lateZiHourUserOverrode)) return state;
			const next = { ...state };
			if(next.fields && next.fields.lateZiHourUseNextDay){
				next.fields = {
					...next.fields,
					lateZiHourUseNextDay: { ...next.fields.lateZiHourUseNextDay, value },
				};
			}
			return next;
		},

		setAfter23BoundaryUserOverrode(state, { payload }){
			// 由 Main 组件在用户改局部下拉时 dispatch,锁定主盘 fields 不被全局事件覆盖(共享 fields 路径)。
			return { ...state, _after23BoundaryUserOverrode: !!(payload && payload.value) };
		},

		// 八字本页覆盖层:merge 写(只认三键整数)/ 清空;载入命盘自带口径钉住共享层。
		setBaziCalibreOverride(state, { payload }){
			const merged = normalizeBaziCalibreOverride({ ...(state.baziCalibreOverride || {}), ...((payload && payload.override) || {}) });
			return { ...state, baziCalibreOverride: merged };
		},
		clearBaziCalibreOverride(state){
			return Object.keys(state.baziCalibreOverride || {}).length ? { ...state, baziCalibreOverride: {} } : state;
		},
		setDayBoundaryRecordPinned(state, { payload }){
			return { ...state, _dayBoundaryRecordPinned: !!(payload && payload.value) };
		},
		setLateZiHourUserOverrode(state, { payload }){
			// v2.2.1 同款语义:左栏改过 lateZiHourUseNextDay 后,锁定不被全局事件覆盖。
			return { ...state, _lateZiHourUserOverrode: !!(payload && payload.value) };
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

		*openDrawer({ payload: values }, { call, put, select }){
			// 事盘编辑抽屉只认带 record 的派发(唯一派发方:事盘列表「编辑」恒带)。没带 record → 什么都不做:
			// 不开抽屉、不关别的抽屉、不换当前事盘(此前抽屉照开、显示的是当前事盘的表单,与「没带 record 什么都不做」不符)
			if(values && values.key === 'caseedit' && !values.record){
				if(typeof console !== 'undefined' && console.warn){ console.warn('[astro/openDrawer] caseedit 需要 record,已忽略'); }
				return;
			}
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
					payload: values.record ? values.record : (values.fromCurrent ? { fromCurrent: true } : { }),
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
				// 没带 record 的已在函数开头挡掉(不从当前事盘的表单字段反拼记录:会漏性别 / 备注 / 时间算法等键,编辑保存时抹掉)
				yield put({
					type: 'user/setCurrentCase',
					payload: {
						...values.record,
						drawerVisible: drawer,
					},
				});
			}else if(values.key === 'chartdeeplearn'){
				let record = values.record;
				if(record){
					yield put({
						type: 'fetchFateEvents',
						payload: record,
					});
				}else{
					const userstate = yield select((s)=>s.user);
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
					const userstate = yield select((s)=>s.user);
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
							memoAstro: chart.memoAstro.value,
							memoBaZi: chart.memoBaZi.value,
							memoZiWei: chart.memoZiWei.value,
							memo74: chart.memo74.value,
							memoGua: chart.memoGua.value,
							memoLiuReng: chart.memoLiuReng.value,
							memoQiMeng: chart.memoQiMeng.value,
							memoSuZhan: chart.memoSuZhan.value,
							payload: chart.payload ? chart.payload.value : null,
							sourceModule: chart.sourceModule ? chart.sourceModule.value : null,
							chartType: chart.chartType ? chart.chartType.value : null,
							drawerVisible: drawer,
						};
						yield put({
							type: 'user/setCurrentChart',
							payload: record,
						});
					}else{
						// 当前这张还没存过:编辑 = 把它存为命盘(带上它的批注)
						yield put({
							type: 'openDrawer',
							payload: {
								key: 'chartadd',
								fromCurrent: true,
							},
						});
					}

				}
			}else if(values.key === 'planetselect'){

			}else if(values.key === 'statistic'){

			}else if(values.key === 'homepage'){

			}

		},


		// [Windows-ahead] perf T-6(speculativePrecompute):排盘表单编辑期的「只暖缓存」预计算。
		// 参数构造与下方 *fetch 逐字节一致(date/time/ad/zone/cid + includePrimaryDirection),但结果
		// 只进 services/astro 的 chartMem/chartInflight —— 不落任何 state、不关抽屉、不触发 hook、
		// 不弹错误。用户点「提交」时 *fetch 的 fetchChart 直接命中缓存或加入在途请求 →
		// 点击→显示 ≈ 渲染耗时。任何失败静默(投机性质,正式路径行为不变)。
		// 派发点=AstroFormComp/ChartFormData 的 livePrecompute 防抖(五层 §22);效应缺席时
		// dva 对未知 type 静默无操作 = 机制整体哑死,故本效应随派发点一体保全。
		*precomputeFetch({ payload: values }, { call, select }){
			try{
				if(!speculativePrecomputeEnabled()){ return; }
				if(!values || !values.date || typeof values.date.format !== 'function'){ return; }
				if(values.lon === undefined || values.lon === null || values.lon === ''
					|| values.lat === undefined || values.lat === null || values.lat === ''){
					return; // 表单未填完整,预取无意义(且避免以半参数占缓存槽)
				}
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
				yield call(service.fetchChart, param, { silent: true, disableLoading: true });
			}catch(e){
				// speculative only — never surface
			}
		},

		*fetch({ payload: values }, { call, put, select }){
			const commitTicket = takeChartCommitTicket();   // 第一个 yield 之前取号(主盘提交代次)
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

			const rsp = yield call(service.fetchChart, param);
			if(!chartCommitTicketLive(commitTicket)){ return; }   // 之后又换过主盘:旧响应作废
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			const Result = rsp.Result;
			Result.params.name = values.name;
			Result.params.pos = values.pos;
			Result.chartId = randomStr(8);
			saveAstroAISnapshotLazy(Result, values, { classicalDerived: true });   // 本命主盘快照带古典衍化四段(opt-in,嵌套消费方不带)

			let drawer = closeAllDrawer('*fetch');

            yield put({
                type: 'save',
                payload: {
					chartObj: Result,
					drawerVisible: drawer,
                },
            });
			markChartRefreshEnd();

			if(values.nohook){
				return;
			}

            const state = yield select((s)=>s.astro);
			yield put({
                type: 'doHook',
                payload: {
					chartObj: Result,
					fields: state.fields,
                },
            });
		},

		*fetchByChartData({ payload: values }, { call, put, select }){
			const commitTicket = takeChartCommitTicket();   // 第一个 yield 之前取号(主盘提交代次)
            const state = yield select((s)=>s.astro);
			// 载入还原（不可变）：record 里保存的每个排盘选项键按 RECORD_FIELDS_RESTORE_MANIFEST 条件还原
			// （record 缺键=保持当前值，legacy 零冲击）；命中键与下方核心键一律写「新 entry」——
			// 旧实现 {...state.fields} 后就地改共享 entry，① 组件层 prevProps 与 props 同对象、值比对失明,
			// ② /chart 失败时 state 已被改一半（脏写）。清单见 utils/recordFieldsRestore.js（哨兵守全枚举）。
			// 字段构造收成闭包:温启恢复(bootRestore)在响应回来后若 checkUser 已换过 fields(预测设置 / 用户档),
			// 用**最新** fields 重建一次,record 键仍然覆盖 ⇒ 盘与选项一致,且 checkUser 的补充不丢。
			const buildFields = (base)=>{
				const f = applyRecordToFields(base, values);
				const set = (key, value)=>{ f[key] = { ...(f[key] || { name: [key] }), value }; };
				set('cid', values.cid);
				set('date', tm);
				set('time', tm);
				set('zone', tm.zone);
				set('lat', values.lat);
				set('lon', values.lon);
				set('name', values.name);
				set('pos', values.pos);
				set('ad', tm.ad);
				// 温启没钉住的盘:快照不带时间算法(不钉住),而它是新盘种子键、缺键会被复位成内建默认 →
				// 用快照另记的值回填(旧快照没有这一项时取种子现值,与「此刻」盘同源)
				if(values.bootRestore && (values.timeAlg === undefined || values.timeAlg === null)){
					const ta = values.bootUnpinnedTimeAlg !== undefined && values.bootUnpinnedTimeAlg !== null ? values.bootUnpinnedTimeAlg : newChartSeedValue('timeAlg');
					if(ta !== undefined && ta !== null){ set('timeAlg', ta); }
				}
				return f;
			};
			let fields = null;
			const setF = (key, value)=>{ fields[key] = { ...(fields[key] || { name: [key] }), value }; };

			let tm = new DateTime();
			tm.parse(values.birth, 'YYYY-MM-DD HH:mm:ss');
			// 🔴 ad 权威 = birth 串前导负号(birth 由 format('YYYY-MM-DD') 产出,必然反映 date.value.ad)。
			// record.ad 可能与 birth 不同步(存量 BC 记录 ad 误存 1 → 旧式 setAd(1) 把 BC 强转成 AD 12026,
			// 与当前显示恰好相同 → 载入"时间不变/无反应")。故负号带 -1 时优先,别被错误 record.ad 覆盖。
			const birthIsBc = typeof values.birth === 'string' && values.birth.trim().charAt(0) === '-';
			tm.setAd(birthIsBc ? -1 : (values.ad ? values.ad : 1));
			tm.setZone(values.zone);

			fields = buildFields(state.fields);
			const param = fieldsToParams(fields);
			const astroState = yield select((allState)=>allState.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
			const bootUserRev = (state && state.userFieldsRev) || 0;
			let rsp = yield call(service.fetchChart, param);
			if(values.bootRestore){
				// 温启恢复:响应回来时用户若已先动手(已有盘提交 / 快车道代际已推进)→ 丢弃,latest-wins;
				// 服务异常静默(恢复是优化不是功能,不弹错):标 failed,若 checkUser 已落过 fields 就由这里回落「此刻」,
				// 否则 checkUser 看到 failed 自己走「此刻」(两处只跑一处,不出双盘)。
				const now = yield select((s)=>s.astro);
				// 温启没落成时,上次那张盘带来的紫微临时表只在当前看的仍是那张盘时留着(否则「此刻」盘照用它的表)
				const keepSessionFor = (st)=>{ try{ dropZiweiSessionTablesUnlessFor(st && st.fields && st.fields.cid ? st.fields.cid.value : ''); }catch(e){ /* ignore */ } };
				if(now.chartObj !== state.chartObj || !chartCommitTicketLive(commitTicket) || ((now.userFieldsRev || 0) !== bootUserRev)){
					keepSessionFor(now);
					yield put({ type: 'save', payload: { bootChartRestore: 'dropped' } });
					return;
				}
				if(!isValidChartResponse(rsp)){
					keepSessionFor(null);   // 回落「此刻」(新盘)
					yield put({ type: 'save', payload: { bootChartRestore: 'failed' } });
					if(now.bootFieldsApplied){
						yield put({ type: 'nowChart', payload: { fields: now.fields, asNewChart: true } });   // 温启恢复失败回落的「此刻」盘 = 新盘
					}
					return;
				}
				if(now.fields !== state.fields){
					fields = buildFields(now.fields);
					// checkUser 在恢复请求在途时落了用户档 / 预测设置(预测开关、主限法方法 / 时间键 / 相位等不在存档记录里):
					// 盘必须按最终展示的选项算 —— 参数有变就按新参数重取一次(同参 L3 命中时近乎零成本),否则盘与选项不一致。
					const param2 = fieldsToParams(fields);
					param2.includePrimaryDirection = param.includePrimaryDirection;
					if(JSON.stringify(param2) !== JSON.stringify(param)){
						rsp = yield call(service.fetchChart, param2);
						const again = yield select((s)=>s.astro);
						if(again.chartObj !== state.chartObj || !chartCommitTicketLive(commitTicket) || ((again.userFieldsRev || 0) !== bootUserRev)){
							keepSessionFor(again);
							yield put({ type: 'save', payload: { bootChartRestore: 'dropped' } });
							return;
						}
						if(!isValidChartResponse(rsp)){
							keepSessionFor(null);
							yield put({ type: 'save', payload: { bootChartRestore: 'failed' } });
							if(again.bootFieldsApplied){
								yield put({ type: 'nowChart', payload: { fields: again.fields, asNewChart: true } });
							}
							return;
						}
						if(again.fields !== now.fields){
							fields = buildFields(again.fields);
						}
					}
				}
			}
			// 列表连着载入两张 / 载入在途时又步进时间、点此刻:不是最后发起的那次 → 作废(不落库、不弹错、不改紫微设置)
			if(!chartCommitTicketLive(commitTicket)){ return; }
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			// 紫微排盘设置随盘:排盘成功后、字段更新与页面重排之前,把记录里的紫微设置写回引擎单例与本机偏好
			// (温启恢复不套用;排盘失败不改设置,免得左栏已是新盘设置、盘面仍是旧盘);失败不阻断载入。
			try{ applyZiweiRecordSettings(values); }catch(e){ /* 紫微设置还原失败不影响载入本身 */ }
			if(values.__pendingCurrentChart){ yield put({ type: 'user/save', payload: { currentChart: values.__pendingCurrentChart } }); }
			const Result = rsp.Result;
			Result.params.name = values.name;
			Result.params.pos = values.pos;
			Result.chartId = randomStr(8);
			saveAstroAISnapshotLazy(Result, fields, { classicalDerived: true });   // 本命主盘快照带古典衍化四段(opt-in,嵌套消费方不带)

			// memo×8：无条件覆盖语义（record 无备注 = 清空该备注），与还原键的条件语义不同，故留手工。
			setF('memo74', values.memo74);
			setF('memoBaZi', values.memoBaZi);
			setF('memoZiWei', values.memoZiWei);
			setF('memoAstro', values.memoAstro);
			setF('memoGua', values.memoGua);
			setF('memoLiuReng', values.memoLiuReng);
			setF('memoQiMeng', values.memoQiMeng);
			setF('memoSuZhan', values.memoSuZhan);

			let type = state.memoType;
			// 换盘代次在提交这一刻按最新 state 加一(不沿用发请求前读到的值:两次提交才不会是同一代次)
			const chartEpochNext = (((yield select((s)=>s.astro)) || {}).chartEpoch || 0) + 1;
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
					baziCalibreOverride: {},                                   // 载入命盘:八字本页覆盖层复位(随盘值 > 本页左栏)
					// 命盘自带口径 → 钉住共享层,全局事件不覆盖;温启带回「左栏亲手改过」的 → 不钉住,恢复亲手改过的标志(只锁那一键)
					_dayBoundaryRecordPinned: values.bootDayBoundaryUserOverride ? false : recordPinsDayBoundary(values),
					// 换了一张盘:「亲手改过」的锁复位(只属于改的那张盘);温启带回的是同一张盘亲手改过的那一键 → 照样锁
					_after23BoundaryUserOverrode: !!(values.bootDayBoundaryUserOverride && values.bootDayBoundaryUserOverride.after23),
					_lateZiHourUserOverrode: !!(values.bootDayBoundaryUserOverride && values.bootDayBoundaryUserOverride.lateZi),
					chartEpoch: chartEpochNext,
					...(values.bootRestore ? { bootChartRestore: 'done' } : {}),   // 温启恢复已落盘
					// 列表载入:当前命盘与字段同一次提交(排盘失败时两边都不变,见 user/setCurrentChart)
					...(values.__pendingCurrentChart ? { currentChart: values.__pendingCurrentChart, ...(values.drawerVisible ? { drawerVisible: values.drawerVisible } : {}) } : {}),
                },
            });
			markChartRefreshEnd();

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
			let requestOptions = values && values.__requestOptions && typeof values.__requestOptions === 'object'
				? values.__requestOptions
				: { silent: true };
			const fieldValues = {
				...(values || {}),
			};
			if(Object.prototype.hasOwnProperty.call(fieldValues, '__requestOptions')){
				delete fieldValues.__requestOptions;
			}
			// 步进方向提示(WP-P1):只驱动 settle 后的预取,同 __requestOptions 一样绝不落 state.fields
			const stepHint = fieldValues.__stepHint;
			if(Object.prototype.hasOwnProperty.call(fieldValues, '__stepHint')){
				delete fieldValues.__stepHint;
			}
			const param = fieldsToParams(fieldValues);
			param.cid = null;
			// 🔴🔴 [代际与取消必须原子](horosa_chart_epoch_abort_atomic_v1)以下两件事之间**绝不允许有
			// yield**,否则两个并发 effect 会互相残杀、一个响应都保不下来:
			//   ① 取主盘提交代次(takeChartCommitTicket)—— 决定「谁的响应不被当作过期货丢弃」;
			//   ② abort 旧 AbortController + 建新的 —— 决定「谁的请求不被网络层取消」。
			// 病史(用户实测三轮「三式改时间盘不动」的真身,horosa_sanshi_outer_follow_time_v1 的下游):
			// 原实现把 ② 放在函数开头、① 放在 `yield select(state.astro)` 之后。dva 的 effect 默认
			// takeEvery=并发,一次时间步进会连发两次 fetchByFields,两者在那个 yield 处交错后,
			// 「持有活 controller 的」与「持有最大 epoch 的」落到了**不同的 effect** 上:
			//     A:②建 ctlA → B:②abort(ctlA)建 ctlB → B:①epoch=2 → A:①epoch=3
			//   ⇒ A 的请求被 abort(它 epoch 最大、本该活)、B 的响应被 epoch 判过期丢弃
			//   ⇒ **两个都没落 store**,chartObj 连 chartId 都不换,外圈星度永远停在起盘那一刻。
			// 实测日志形如 `start epoch=2 / start epoch=3 / abort epoch=2 / abort epoch=3`——
			// 两条 abort、零条 SAVE,即此病的指纹。合并为原子段后,「最后进来的」必然同时拿到
			// 最大 epoch 与活着的 controller,两道机制判据统一。
			// 整段放在第一个 yield 之前:与另外三个换主盘入口同一判据(第一个 yield 之前取号),跨入口的先后也按发起先后算。
			const commitTicket = takeChartCommitTicket();
			// /chart 主链 AbortController:新发先 abort 旧在途(网络层取消——释放连接与
			// 后端算力;结果层正确性由主盘提交代次保证,两层互补)。带 signal 的请求在
			// services 层不入 chartInflight 共享(A abort 不连坐 B);abort 失败路径在 request 层
			// 短路(不自愈/不弹错)。浅拷贝挂载,绝不变异调用方传入的 __requestOptions 对象。
			if(mainChainAbortEnabled() && typeof AbortController !== 'undefined' && !requestOptions.signal){
				if(chartMainAbortCtl){
					chartMainAbortCtl.abort();   // 已 settled 的控制器再 abort 是空操作,不抛
				}
				chartMainAbortCtl = new AbortController();
				requestOptions = { ...requestOptions, signal: chartMainAbortCtl.signal };
			}
			const astroState = yield select((state)=>state.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
			// 交互真尺:改动进入 → compute(响应/提交)→ commit(rAF 渲染近似)。
			// 取消/失败路径不记(避免把 stale 响应算进延迟分布)。
			const pm = perfBegin(astroState.currentTab || 'chart', stepHint ? `step:${stepHint.unit}` : 'fields');

			// —— 「点时间→出盘」快车道(2026-07 极速化大修) ——
			// 病根:此前 fields 的 save 排在 /chart 网络之后 → 纯本地技法(八字/数算/风水…)
			// 也被迫等一次网络(实测热态 229ms 占总延迟 70%),网络失败则 fields 根本不更新。
			// 修法:当前 tab 的 hook 自述 chartFree(=本页中右栏不消费 chartObj)时,fields 立即
			// 提交+立即 doHook —— 本地技法一次性整体出(<100ms);/chart 照发,回来单独补 chartObj。
			// 非 chartFree 页维持「到齐才 save{fields+chartObj}」的原子性(逐字节旧序),但先把
			// 本页的请求集并行预热(prewarm,silent,经 requestDedupe 在途共享)→ latency=max 而非 sum。
			const fastCommitOn = fieldsFastCommitEnabled();
			const activeHook = astroState.predictHook && astroState.predictHook[astroState.currentTab];
			const fastPath = fastCommitOn && !!(activeHook && activeHook.chartFree === true);

			let fld = {
				...fieldValues,
				nohook: false,
			}

			if(fastPath){
				yield put({
					type: 'save',
					payload: { fields: fld },
				});
				pm.computed();
				if(!values.nohook){
					// 喂旧 chartObj:chartFree 契约=hook 不读它(有静态哨兵守),只用 fields。
					yield put({
						type: 'doHook',
						payload: { chartObj: astroState.chartObj, fields: fld },
					});
					pm.committed();
				}
			}else if(fastCommitOn && prewarmRequestsEnabled() && activeHook && typeof activeHook.prewarmRequests === 'function'){
				// fire-and-forget:组件自述的预热函数(silent 请求),失败静默——正式请求照常兜底。
				try{ activeHook.prewarmRequests(fld); }catch(e){ /* 预热失败无害 */ }
			}

			let rsp;
			try{
				rsp = yield call(service.fetchChart, param, requestOptions);
			}catch(abortErr){
				// 被新请求 abort 的旧主链:静默退场(新请求自有其成败路径)。
				// 其它错误维持旧行为原样上抛(request 层早已按 silent 决定 surface 与否)。
				if(abortErr && (abortErr.name === 'AbortError' || (requestOptions.signal && requestOptions.signal.aborted))){
					return;
				}
				throw abortErr;
			}
			if(!chartCommitTicketLive(commitTicket)){
				// 已有更新的一次时间变更在途/完成 —— 本响应作废,静默丢弃(连错误弹窗也不弹:
				// 旧请求失败不该打断用户正在进行的新操作;新请求自有其成败路径)。
				return;
			}
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			const Result = rsp.Result;
			if(!fastPath){ pm.computed(); }
			Result.params.name = fieldValues.name.value;
			Result.params.pos = fieldValues.pos.value;
			if(fieldValues.orbs && fieldValues.orbs.value){ Result.params.orbs = fieldValues.orbs.value; }
			if(fieldValues.orbScale && fieldValues.orbScale.value){ Result.params.orbScale = fieldValues.orbScale.value; }
			Result.chartId = randomStr(8);
			saveAstroAISnapshotLazy(Result, fieldValues, { classicalDerived: true });   // 本命主盘快照带古典衍化四段(opt-in,嵌套消费方不带)

			if(fastPath){
				// fields 已先行提交且引用未变 —— 只补 chartObj,不重放 fields(免二次 didUpdate)、
				// 不重发 doHook(chartFree 页不消费 chartObj;其余页由各自 tab 切换签名兜底)。
				yield put({
					type: 'save',
					payload: { chartObj: Result },
				});
				markChartRefreshEnd();   // horosa_interaction_span_v1:快车道不打 end = 三族报伪造渲染时间(R9 Ship0a)
				// 武装+投机全是优化:整块 try —— 任何异常静默,绝不许碰快车道主流程。
				try{
					if(stepHint){
						// settle 后预取「下一步」:用户已停手+主盘已回,天然错峰(风暴防护在调度器内)
						reportStepUnit(astroState.currentTab, stepHint.unit, stepHint.dir);   // horosa_pump_skew_v1:dir 供连击计量
						submitStepPrefetch(buildStepPrefetchTasks(fieldValues, { ...stepHint, depth: stepPrefetchDepth() }, astroState));
					}else if(stepPrefetchArmEnabled() && shouldArmForTab(astroState.currentTab)){
						// R4-B2:无向 settle(初盘/确定/改设置/切回)也武装当前档位 ±depth ——
						// 单位取该技法最近一次选择/步进的档位,不再硬编码 'm',
						// 于是「不选步长直接点 ±」的第一下也命中。
						submitStepPrefetch(buildStepPrefetchTasks(fieldValues, { unit: currentStepUnit(astroState.currentTab), dir: 0, depth: stepPrefetchDepth() }, astroState));
					}
					// R4-B5(horosa_option_prefetch_v1):选项二值轴的 Hamming-1 变体走空闲通道(与步进泵分队)。
					speculateChartOptions(fieldValues, astroState);
				}catch(e){ /* optimization only — never surface */ }
				return;
			}

            yield put({
                type: 'save',
                payload: {
					chartObj: Result,
					fields: fld,
                },
            });
			markChartRefreshEnd();

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
			pm.committed();

			// 同快车道分支:优化整块 try,异常静默不碰主流程。
			try{
				if(stepHint){
					reportStepUnit(astroState.currentTab, stepHint.unit, stepHint.dir);   // horosa_pump_skew_v1:dir 供连击计量
					submitStepPrefetch(buildStepPrefetchTasks(fieldValues, { ...stepHint, depth: stepPrefetchDepth() }, astroState));
				}else if(stepPrefetchArmEnabled() && shouldArmForTab(astroState.currentTab)){
					// R4-B2:无向 settle 也武装(同快车道分支)。
					submitStepPrefetch(buildStepPrefetchTasks(fieldValues, { unit: currentStepUnit(astroState.currentTab), dir: 0, depth: stepPrefetchDepth() }, astroState));
				}
				// R4-B5:选项 Hamming-1 投机(同快车道分支)。
				speculateChartOptions(fieldValues, astroState);
			}catch(e){ /* optimization only — never surface */ }

		},

		*doHook({ payload: values }, { call, put }){
			// rAF 化(流畅度):hooking 同步遍历 predictHook 命令式刷新各技法面板,曾与主盘渲染
			// 挤在同一帧。改为下一帧执行:主盘先上屏,技法面板随后刷新;cancel 上一帧未执行的
			// 任务(latest-wins,连发只跑最后一次)。predictHook/currentTab 在回调时刻重读
			// (防延迟一帧后打到已切走的 tab/已注销的 hook);fields/chartObj 用触发时 payload
			// (数据正确性)。已核查全部 5 个 dispatch 点之后均无依赖 hooking 同步完成的代码。
			const runHooking = ()=>{
				// rAF 回调内不可 yield select;getStore 需守卫(RootLayout 首渲染前为空,同 app.js 修法)
				const store = getStore();
				if(!store || !store.astro){
					return;
				}
				const state = store.astro;
				hooking(state.predictHook, state.currentTab, values.fields, values.chartObj);
			};
			if(hookRafEnabled() && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'){
				if(pendingHookFrame !== null){
					window.cancelAnimationFrame(pendingHookFrame);
				}
				pendingHookFrame = window.requestAnimationFrame(()=>{
					pendingHookFrame = null;
					runHooking();
				});
				return;
			}
			runHooking();
		},

		// 「重算当前」/「重算星盘」用这个:拿状态里已录的 fields 重排。
		// 从前这两个入口都 dispatch nowChart 且 payload 为空 → nowChart 内 fields===undefined
		// 就走 newEmptyFields()(=此刻新盘),于是按钮名写着「重算」、行为却是把已录生辰清成当下,
		// 误点即丢盘。起此刻新盘仍走 nowChart 空 payload(「新命盘」按钮的语义)。
		*recalcChart(_, { put, select }){
			const st = yield select((s)=>s.astro);
			yield put({ type: 'nowChart', payload: { fields: st && st.fields ? st.fields : undefined } });
		},
		*nowChart({ payload: values }, { call, put, select }){
			const commitTicket = takeChartCommitTicket();   // 第一个 yield 之前取号(主盘提交代次)
			let fields = values.fields;
			const isNewChart = fields === undefined || fields === null;
			// 「当新盘处理」:带着字段起的盘也可以按新盘语义收尾(启动时的「此刻」盘、玄学史建盘)——紫微用回你自己的设置。
			// 此前只有不带字段(「新命盘」按钮)才用回,启动的此刻盘沿用了上一张载入的盘的紫微设置
			const treatAsNewChart = isNewChart || !!(values && values.asNewChart);
			if(isNewChart){
				fields = newEmptyFields();
				// 「新命盘」=此刻:newEmptyFields 的日期取模块级常量 dtm(模型载入时 new 一次,从不刷新)→ 起的是应用启动时刻的盘。
				// 只在本路径换成真「此刻」(newEmptyFields 仍是非默认捕获的基准工厂,不动)。
				const nowDt = new DateTime();
				fields = { ...fields, ad: { ...fields.ad, value: nowDt.ad }, date: { ...fields.date, value: nowDt }, time: { ...fields.time, value: nowDt.clone() } };
			}
			const param = fieldsToParams(fields);
			const astroState = yield select((state)=>state.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);

			const rsp = yield call(service.fetchChart, param);
			if(!chartCommitTicketLive(commitTicket)){ return; }   // 之后又换过主盘:旧响应作废(也不用回紫微种子)
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			if(treatAsNewChart){
				// 「新命盘」:紫微用回你自己的设置(载入记录只改本盘生效值,不改你的新盘种子)。
				// 排盘成功后才用回(失败 = 盘没换,左栏设置也不该换;与载入命盘同一时序)。
				try{ restoreZiweiUserSeed(); }catch(e){ /* 用回失败:保持当前设置 */ }
			}
			const Result = rsp.Result;
			Result.chartId = randomStr(8);
			// 确保「基本信息」名称/地点反映当前输入 fields(后端参数白名单可能不回显 name/pos → 跳转后无需手动按确定即同步)
			if(!Result.params){ Result.params = {}; }
			if(fields && fields.name){ Result.params.name = fields.name.value; }
			if(fields && fields.pos){ Result.params.pos = fields.pos.value; }
			saveAstroAISnapshotLazy(Result, fields, { classicalDerived: true });   // 本命主盘快照带古典衍化四段(opt-in,嵌套消费方不带)

			let drawer = closeAllDrawer('*nowChart');
			// 换盘代次在提交这一刻按最新 state 加一(不沿用发请求前读到的值)
			const chartEpochNext = (((yield select((s)=>s.astro)) || {}).chartEpoch || 0) + 1;
            yield put({
                type: 'save',
                payload: {
					fields: fields,
					chartObj: Result,
					drawerVisible: drawer,
					baziCalibreOverride: {},            // 新命盘:八字本页覆盖层复位
					_dayBoundaryRecordPinned: false,   // 新命盘:共享层不再钉住(跟随全局)
					_after23BoundaryUserOverrode: false,   // 新命盘 / 此刻:上一张盘上亲手改的日界 / 晚子时锁不带过来
					_lateZiHourUserOverrode: false,
					chartEpoch: chartEpochNext,
                },
            });

            const state = yield select((s)=>s.astro);
			let hook = state.predictHook;
			hooking(hook, state.currentTab, fields, Result);

		},

		*setHomePage({ payload: values }, { call, put, select }){
			if(values.path === undefined || values.path === null){
				return;
			}

			let path = values.path;
			let payload = {
				currentTab: path[0],
			};
			if(path.length > 1){
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

			// 曾有 `const localOnly = true` 写死的服务端 fetchFateEvents 分支
			// (登录多用户时代残留,永不可达)——纯本地桌面形态定谳后收敛为本地唯一路径。
			const localResult = loadLocalFateEvents(values.cid);
			yield put({
				type: 'save',
				payload: {
					deeplearn: localResult,
				},
			});
		},

		*deeplearn({ payload: values }, { call, put, select }){
            const state = yield select((s)=>s.astro);
			if(state.deeplearn){
				let param = {
					Cid: state.deeplearn.Cid,
					Val10000: state.deeplearn.Val10000,
					Val20000: state.deeplearn.Val20000,
					Val30000: state.deeplearn.Val30000,
					Val40000: state.deeplearn.Val40000,
				};
				// 服务端 dlTrain 分支同上,收敛为本地唯一路径。写不进(存储满 / 原内容读不出又没能另存)如实提示
				if(!saveLocalFateEvents(param)){ message.error('本机存储已满(或原有的命主实况读不出),没能保存这次填写'); }
			}

            yield put({
                type: 'openDrawer',
                payload: {
					key: 'chartlist'
                },
            });

		},

		// 当前命盘只改了展示字段(别的窗口改名 / 改地名等,不影响起盘、不重排):左栏字段与盘面参数里的展示字段跟上库里那版。
		// 只动 RECORD_DISPLAY_FIELDS 里 astro.fields 有的键(名字 / 地名),且只在字段属于这条记录时;不推进任何代次、不重新请求。
		*patchRecordDisplayFields({ payload: rec }, { put, select }){
			const state = yield select((s)=>s.astro);
			if(!rec || !state || !state.fields || !state.fields.cid || `${state.fields.cid.value}` !== `${rec.cid}`){ return; }
			const fields = { ...state.fields };
			const params = state.chartObj && state.chartObj.params ? { ...state.chartObj.params } : null;
			let changed = false;
			RECORD_DISPLAY_FIELDS.forEach((k)=>{
				if(!fields[k] || rec[k] === undefined){ return; }
				const v = rec[k] === null ? '' : rec[k];
				if(fields[k].value !== v){ fields[k] = { ...fields[k], value: v }; changed = true; }
				if(params && Object.prototype.hasOwnProperty.call(params, k) && params[k] !== v){ params[k] = v; changed = true; }
			});
			if(!changed){ return; }
			yield put({ type: 'save', payload: { fields, ...(params ? { chartObj: { ...state.chartObj, params } } : {}) } });
		},

		*syncAndRecalcFromDayBoundary(_, { put, select }) {
			const state = yield select(s => s.astro);
			if(state && state.fields){
				yield put({
					type: 'fetchByFields',
					payload: {
						...state.fields,
						__requestOptions: { silent: true },
					},
				});
			}
		},

	},

	subscriptions: {
		syncFromGlobalDayBoundary({ dispatch }){
			if(typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
			const handler = (ev) => {
				const detail = ev && ev.detail ? ev.detail : {};
				const value = detail.after23NewDay;
				if(value === 0 || value === 1){
					dispatch({ type: 'syncAfter23NewDay', payload: { after23NewDay: value } });
					dispatch({ type: 'syncAndRecalcFromDayBoundary' });
				}
			};
			window.addEventListener('horosa:day-boundary-changed', handler);
			return ()=>window.removeEventListener('horosa:day-boundary-changed', handler);
		},

		syncFromGlobalLateZiHour({ dispatch }){
			if(typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
			const handler = (ev) => {
				const detail = ev && ev.detail ? ev.detail : {};
				const value = detail.lateZiHourUseNextDay;
				if(value === 0 || value === 1){
					dispatch({ type: 'syncLateZiHourMode', payload: { lateZiHourUseNextDay: value } });
					dispatch({ type: 'syncAndRecalcFromDayBoundary' });
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', handler);
			return ()=>window.removeEventListener('horosa:late-zi-hour-mode-changed', handler);
		},
	},

};

export default model;
