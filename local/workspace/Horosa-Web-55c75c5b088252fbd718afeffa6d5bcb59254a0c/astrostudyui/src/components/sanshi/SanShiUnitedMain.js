// 三式合一页:类定义在这里;模块级助手与类方法按职责拆在 ./main/ 下,
// 方法拆片 caseState · inputs · compute · recalc · board · inputPanel · rightPanel,类后 mixinMethods 挂回原型。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { dayBoundaryLockHeld } from '../../utils/dayBoundaryLock';
import { Component } from 'react';
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
import { castIsDiurnal } from '../../utils/castDiurnal';
import { fetchQimenPan, isQimenLocalRoute } from '../dunjia/DunJiaCalc';
import {
	getNongliLocalCache,
	setNongliLocalCache,
} from '../../utils/localCalcCache';
import { fetchPreciseNongli } from '../../utils/preciseCalcBridge';
import { DEFAULT_TAIYI_SCHOOL } from '../taiyi/core/taiyiSchool';
// 年神排序 / 土旺衰两档此前在合一页只经 pickSanshiLiurengCastOpts 进 AI 快照,
// 页面无任何落点(帮助却称「与独立页同名同义」「改年神在右栏的排列起点」)。补右栏落点,与独立页同源同函数。
import { BAGONG_PALACE_ORDER } from '../dunjia/DunJiaBaGongRules';
// 遁甲「用神 / 化解」子tab静态显示所需的派生函数与速查数据(对齐独立遁甲页同源)。
import styles from './SanShiUnitedMain.less';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { clamp, safe } from '../dunjia/qimenPageShared';
import { clearZeriLockMarks } from '../../divination/zeri/zeriPageCalibre';
import { normalizeAscRaMode } from '../../utils/ascRaMode';
import { SANSHI_PAGE_SETTINGS } from './main/options';
import { getViewportHeight, normalizeTimeAlg } from './main/format';
import { mixinMethods } from '../../utils/mixinMethods';
import { caseStateMethods } from './main/caseState';
import { inputMethods } from './main/inputs';
import { computeMethods } from './main/compute';
import { recalcMethods } from './main/recalc';
import { boardMethods } from './main/board';
import { inputPanelMethods } from './main/inputPanel';
import { rightPanelMethods } from './main/rightPanel';
import { fetchPreciseJieqiSeed } from '../../utils/preciseCalcBridge';
import { needJieqiYearSeed } from '../dunjia/DunJiaCalc';
export { QIMEN_OPTIONS, OUTER_RING_LAYOUT, WEAK_SOLID_POS, LIURENG_RING_LAYOUT, QIMEN_RING_POSITIONS, QIMEN_CORNER_PALACES, SANSHI_PAGE_SETTINGS, SANSHI_BOARD_READABLE_MIN, SANSHI_CAST_CHART_WAIT_MS, SANSHI_RECALC_HELD } from './main/options';
export { shortTianJiang, splitGanZhi, getGanzhiParts, fmtDirect, fmtSolar, fmtLunar, extractIsDiurnalFromChartWrap, getChartYue, getOuterChartKey } from './main/format';
export { pickSanshiLiurengCastOpts, SANSHI_TRUE_SOLAR_FALLBACK_NOTE, buildSanshiLiuRengCastOverride, buildLiuRengLayout, buildLrNongli, buildKeData, buildSanChuan, buildSanshiWeakSolid, computeSanshiXun } from './main/liureng';
export { buildOuterData, buildShenShaMap, buildSanshiPalaceSections, getOuterLabelLayout, getOuterStarsLayout, padOuterStarsRow, buildPillarFromPan } from './main/outerRing';
export { buildSanShiUnitedSnapshotText } from './main/snapshot';
export { toQimenMeaningTip, buildOuterHouseMeaningTip, buildOuterBranchMeaningTip, buildOuterStarMeaningTip } from './main/meaningTips';
export { clamp, safe };

class SanShiUnitedMain extends Component{
	constructor(props){
		super(props);
		// 上次亲手设的排盘口径 —— 只有独立三式页读;三式择日里内嵌的那份恒从出厂值 / 共享字段现值起(理由见 SANSHI_PAGE_SETTINGS 注)。
		const savedOnly = this.usesSavedSettings() ? SANSHI_PAGE_SETTINGS.loadSaved() : {};
		// 外圈两项是组件自己的 state,不在 options 里:从 options 的播种里摘出来(否则 options 里多出两个没人读的陈旧副本,还会跟着事盘存下去)
		const { outerCoord: savedOuterCoord, showWeakSolid: savedShowWeakSolid, ascRaMode: savedAscRaMode, ...savedOptionKeys } = savedOnly;
		const defaultTimeAlg = normalizeTimeAlg(
			props
			&& props.fields
			&& props.fields.timeAlg
			&& props.fields.timeAlg.value
		);
		this.state = {
			loading: false,
			nongli: null,
			displaySolarTime: '',
			liureng: null,
			dunjia: null,
			taiyi: null,
			castChart: null,	// 这一课所用的参照盘(与 nongli / dunjia / taiyi / liureng 同一次落定;盘面外圈 / 七政 / 快照都读它)
			lessonSig: '',	// 屏上这一课的起课签名(时刻 + 地点)
			lrLayout: null,
			keData: null,
			sanChuan: null,
			localFields: null,
			plottedFields: null,
			hasPlotted: false,
			rightPanelTab: 'overview',
			outerCoord: savedOuterCoord !== undefined ? savedOuterCoord : 'ecliptic', // 外圈分宫:ecliptic(黄道,出厂值) | equatorial(赤道/赤经);上次亲手设的值
			showWeakSolid: savedShowWeakSolid !== undefined ? savedShowWeakSolid : true, // 外圈是否叠七政四余式「虚实」红绿点(出厂显示);上次亲手设的值
			ascRaMode: normalizeAscRaMode(savedAscRaMode), // 外圈赤道分宫的上升取法(出厂 = 改进 / 真赤经);上次亲手设的值
			liurengRefTab: 'dage',
			bagongSubTab: 'bagong', // 遁甲右栏内层子tab:八宫 / 用神 / 化解
			taiyiSubTab: 'overview', // 太乙右栏内层子tab:概览 / 十六宫 / 八门 / 断法
			bagongPalace: BAGONG_PALACE_ORDER[0],
			liurengRefBundle: null,
			liurengSnapshotInput: null, // 六壬断卦层快照入参(随 recalc 落 state,供存档/还原路径的 payload 复用)
			options: {
				mode: 'shi',   // 模式缺省改事局:与「盘类」缺省事局一致(此前页面「命局」与 AI 所见「事局」并存,缺省点保存不存三式事盘)
				timeAlg: defaultTimeAlg,
				sex: 1,
				guireng: 2,
				zodiacal: 0,
				siderealAyanamsa: '',
				hsys: 0,
				after23NewDay: defaultAfter23NewDay(),
				lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
				paiPanType: 3,
				zhiShiType: 0,
				yueJiaQiJuType: 0,
				qijuMethod: 'zhirun',
				kongMode: 'day',
				yimaMode: 'day',
				shiftPalace: 0,
				// 奇门流派/起局补充(默认=现行行为,零回归):盘式转盘 / 报数空 / 未封局 / 置闰满9天(≥9)即闰。
				school: '转盘',
				shuziReportNumber: '',
				fengJu: false,
				zhirunLeapDays: 9,
				taiyiStyle: 3,
				taiyiAccum: 0,
				taiyiTimeBasis: 'direct',   // 缺省 direct=此前钉死值,字节零变;可选真太阳时(与独立太乙页同源)
				// 太乙博弈 + 流派(默认=关闭/全默认,字节不变零回归)。
				gameTheory: 0,
				taiyiSchool: { ...DEFAULT_TAIYI_SCHOOL },
				// 大六壬流派(默认=现行固定月将/晨昏分昼夜/仅下贼上,零回归)。
				yueJiangMethod: 'zhongqi',
				fenZhouYe: 'chenhun',
				seHaiMethod: 'app',
				seHaiBoundary: 'app',
				shiRuKe: false,
				yearShenShaSort: 'sanyuan',
				yinyangSystem: 'danmu',
				tuWangShuai: 'siji',
				// 上次亲手设的排盘口径(只并入确实保存过的键;没保存过的照旧走上面的缺省 / 共享字段现值)
				...savedOptionKeys,   // 仅独立三式页有值(择日内嵌实例为空;工作台下发走 applyOptions → setState,不落盘)
			},
			leftBoardWidth: 0,
			leftBoardHeight: 0,
			viewportHeight: getViewportHeight(),
			rightPanelHeight: 0,
		};
		this.unmounted = false;
		this.lastKey = '';
		this.lastRestoredCaseId = null;
		this.jieqiSeedPromises = {};
		this.jieqiYearSeeds = {};
		this.timeHook = {};
		this.lastRecalcSignature = '';
		this.lastRecalcError = null;
		this.refreshSeq = 0;
		this._recalcSeq = 0;   // 重算(performRecalcByNongli)代次:只认最后一次开始的重算
		this.pendingRefresh = null;
		this.panCache = new Map();
		this.lrBundleCache = {};
		this.outerDataCache = { chartKey: '', data: null };
		this.resizeObserver = null;
		this.prefetchSeedTimer = null;
		this.awaitingChartSync = false;
		this.pendingTimeFields = null;
		this.awaitingSyncTimer = null;
		this.pendingRecalcTimer = null;
		this.pendingRecalcPayload = null;
		this.pendingRecalcResolvers = [];
		this.pendingSnapshotTimer = null;
		this.lastExternalFieldsKey = '';
		this.taiyiCache = new Map();

		this.refreshAll = this.refreshAll.bind(this);
		this.genParams = this.genParams.bind(this);
		this.ensureJieqiSeed = this.ensureJieqiSeed.bind(this);
		this.prefetchJieqiSeedForFields = this.prefetchJieqiSeedForFields.bind(this);
		this.prefetchNongliForFields = this.prefetchNongliForFields.bind(this);
		this.resolveDisplaySolarTime = this.resolveDisplaySolarTime.bind(this);
		this.genJieqiParams = this.genJieqiParams.bind(this);
		this.getQimenOptions = this.getQimenOptions.bind(this);
		this.recalcByNongli = this.recalcByNongli.bind(this);
		this.performRecalcByNongli = this.performRecalcByNongli.bind(this);
		this.resolvePendingRecalc = this.resolvePendingRecalc.bind(this);
		this.cancelPendingRecalc = this.cancelPendingRecalc.bind(this);
		this.scheduleSnapshotSave = this.scheduleSnapshotSave.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		// 紫微四化 tab 上报的盘+大运/流年选中态(实例字段,非 state:避免重渲循环);
		// tab 未打开过(antd 懒渲染)保持 null → 快照不产 [紫微四化] 段。
		this.ziweiSihuaSnapshotInput = null;
		this.handleZiweiSihuaSnapshotState = this.handleZiweiSihuaSnapshotState.bind(this);
		this.handleExternalFieldsSync = this.handleExternalFieldsSync.bind(this);
		this.syncFields = this.syncFields.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onTimeAlgChange = this.onTimeAlgChange.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.onOptionChange = this.onOptionChange.bind(this);
		this.onAstroFieldOptionChange = this.onAstroFieldOptionChange.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.clickSave = this.clickSave.bind(this);
		this.renderQuickDock = this.renderQuickDock.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.restoreOptionsFromCurrentCase = this.restoreOptionsFromCurrentCase.bind(this);
		this.captureLeftBoardHost = this.captureLeftBoardHost.bind(this);
		this.captureRightPanel = this.captureRightPanel.bind(this);
		this.onOuterCoordChange = this.onOuterCoordChange.bind(this);
		this.handleWindowResize = this.handleWindowResize.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields, chartObj)=>{
				if(this.unmounted){
					return;
				}
				this.restoreOptionsFromCurrentCase();
				this.handleExternalFieldsSync(fields, chartObj);
			};
			// PERF-R9 Ship 7:三式合参同为【两段式】—— stage-1(/nongli/time)先回来才能推三盘。
			// 与主 /chart 无关,在 /chart 返回之前并行发出即把 stage-1 摘出关键路径。
			// 闸:horosa.perf.prewarmRequests(关=此函数不被调用,逐字节旧序)。标记 horosa_sanshi_prewarm_hook_v1。
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.unmounted){
					return;
				}
				try{
					this.prefetchNongliForFields(flds || this.props.fields);
				}catch(e){ /* 预热失败无害 */ }
			};
			// 择日宿主代点首盘(加性:未起盘态 sync 只存草稿=用户定版语义,宿主 pick 语义
			// 是「点击即起盘看盘」——经此显式起;主页 hook 不调 plot=零影响)。
			// 择日宿主 pick 前回写工作台扫描口径(六壬贵人/月将/阴阳系、奇门盘式/起局/流派/值使/空亡/驿马、太乙积年)
			// 到本页 options,让 pick 后显示盘/母快照与命中判定同口径(此前宿主 fields 只带时地,显示盘按左栏旧档自排)。
			this.props.hook.applyOptions = (partial)=>new Promise((resolve)=>{
				if(this.unmounted || !partial || typeof partial !== 'object' || !Object.keys(partial).length){ resolve(); return; }
				this._zeriRestoredLocks = clearZeriLockMarks(this._zeriRestoredLocks, partial);   // 回写过的锁定项不再是「由存案复原」的
				this.setState({ options: { ...(this.state.options || {}), ...partial } }, resolve);
			});
			this.props.hook.plot = ()=>{
				if(this.unmounted){
					return;
				}
				this.clickPlot();
			};
			// 择日宿主扫描前取本页奇门家全量引擎 options(暗干/暗支/八神/寄宫/移星等左栏档),
			// 与奇门择日「取遁甲页全部 options」同律;工作台 13 键覆盖其上。
			this.props.hook.getQimenOptions = ()=>(this.unmounted ? null : this.getQimenOptions());
			// 择日宿主扫描前取本页平铺 options(六壬家分昼夜 / 涉害三键、太乙家流派表):扫描与点开的盘同口径
			this.props.hook.getOptions = ()=>(this.unmounted ? null : JSON.parse(JSON.stringify(this.state.options || {})));
		}
	}

	// 重 wrapper sCU(照 BaZi/ZiWeiMain 既有范式):全 props 机械浅比(函数型视为恒等,
	// 开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲(setState 恒换引用)。
	// 收益:激活态下宿主无关 dispatch 不再整树白跑本重组件。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		this.restoreOptionsFromCurrentCase(true);
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再覆盖
		this._lateZiHourUserOverrode = false; // v2.2.1: 同款时柱开关局部覆盖语义
		window.addEventListener('resize', this.handleWindowResize);
		window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		this._dayBoundaryListener = (ev) => {
			if(dayBoundaryLockHeld(this, 'after23')) return;
			const v = ev && ev.detail ? ev.detail.after23NewDay : null;
			if(v === 0 || v === 1){
				this.onOptionChange('after23NewDay', v, { fromGlobal: true });
			}
		};
		window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
		this._lateZiHourListener = (ev) => {
			if(dayBoundaryLockHeld(this, 'lateZi')) return;
			const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
			if(v === 0 || v === 1){
				this.onOptionChange('lateZiHourUseNextDay', v, { fromGlobal: true });
			}
		};
		window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
		this.handleWindowResize();
		const activeFields = this.state.localFields || this.props.fields;
		this.prefetchJieqiSeedForFields(activeFields);
		this.prefetchNongliForFields(activeFields);
		// [三式步进预取](horosa_sanshi_step_prefetch_v1)stage-1 三段链,与主链同参同键:
		// nongli' → kinqimen 后端盘'(仅时家转盘等后端模式;本地 calcDunJia 家族无 HTTP 免热)
		//         + 太乙盘'。两 HTTP 经 kentangCache 收口=预取即入缓存,真步进网络归零;
		// 六壬纯本地零网络无需预热。登记进共享调度器(白名单闸/latest-wins/预算),
		// armStepPrefetch 全局武装链(选步长/settle/切页签)登记后自动生效。
		// [Windows-only 增量] 第二条任务 sanshi:jieqiseed 保留(我方 R9 Ship7 首创):
		// 链式任务把 this.jieqiYearSeeds 现值传给 fetchQimenPan,但**不会去补缺失的年种子**;
		// 跨年步进时缺种子那一步仍要现付 /jieqi/year。两者互补,不重复(端点不同、键不同)。
		this._sanshiStepPrefetcher = (steppedFields)=>{
			if(this.unmounted || !steppedFields){
				return [];
			}
			let params = null;
			try{ params = this.genParams(steppedFields); }catch(e){ params = null; }
			if(!params){
				return [];
			}
			const tasks = [{
				name: 'sanshi:stage1',
				path: '/nongli/time',
				run: async ()=>{
					let nongli = getNongliLocalCache(params);
					if(!nongli){
						nongli = await fetchPreciseNongli(params).then((r)=>{
							if(r){ setNongliLocalCache(params, r); }
							return r;
						}).catch(()=>null);
					}
					if(!nongli || this.unmounted){
						return null;
					}
					const jobs = [];
					try{
						const qimenOptions = this.getQimenOptions();
						const o = qimenOptions || {};
						const kinq = !isQimenLocalRoute(o);   // 路由单源:本地路由无 HTTP 免热
						if(kinq){
							const year = steppedFields.date && steppedFields.date.value
								? parseInt(steppedFields.date.value.format('YYYY'), 10) : null;
					const displaySolarTime = await this.resolveDisplaySolarTime(params, nongli);
							// isDiurnal 取现值 chartWrap(±数步内昼夜大概率不变=同键;跨昼夜界偶发白预取无害)。
							const isDiurnal = castIsDiurnal(this.props.chartObj || this.props.chart || null, steppedFields);
							jobs.push(fetchQimenPan(steppedFields, nongli, qimenOptions, {
								year,
								jieqiYearSeeds: this.jieqiYearSeeds,
								isDiurnal,
								displaySolarTime,
							}).catch(()=>null));
						}
					}catch(e){ /* 奇门预热构参失败静默 */ }
					try{
						jobs.push(this.getKintaiyiPan(steppedFields, nongli, {
							...(this.state.options || {}),
						}).catch(()=>null));
					}catch(e){ /* 太乙预热失败静默 */ }
					if(jobs.length){
						await Promise.all(jobs);
					}
					return true;
				},
			}];
			try{
				const qimenOptions = this.getQimenOptions();
				if(needJieqiYearSeed(qimenOptions) && steppedFields.date && steppedFields.date.value){
					const year = parseInt(steppedFields.date.value.format('YYYY'), 10);
					const seedParams = (year && !Number.isNaN(year)) ? this.genJieqiParams(steppedFields, year) : null;
					if(seedParams){
						tasks.push({
							name: 'sanshi:jieqiseed',
							path: '/jieqi/year',
							run: ()=> fetchPreciseJieqiSeed(seedParams),
						});
					}
				}
			}catch(e){ /* 种子构参失败静默跳过 */ }
			return tasks;
		};
		registerStepPrefetcher('sanshiunited', this._sanshiStepPrefetcher);
	}

	componentDidUpdate(prevProps, prevState){
		// 择日宿主:本页选项变了(亲手改 / 宿主回写 / 载入存案)→ 告诉宿主,宿主按同一套过期判据重算「结果已过期」
		if(this.props.onPageCalibreChange && prevState && prevState.options !== this.state.options){
			this.props.onPageCalibreChange();
		}
		this.restoreOptionsFromCurrentCase();
		const chartChanged = (prevProps.chartObj !== this.props.chartObj) || (prevProps.chart !== this.props.chart);
		// 🔴 [外圈随时间校正](horosa_sanshi_outer_follow_time_v1)此处**不得**再加 awaitingChartSync 前置条件。
		// 病史(用户实测三次仍报「改时间盘不动」):awaitingChartSync 只在 clickPlot 的 needChartSync
		// 分支置起,而实时传导路径下它恒为 false —— onTimeChanged 先 syncFields 把新时间写进
		// state.fields,待 clickPlot 在 setState 回调里跑时 props.fields 已是新值,maybePatchDateTime
		// 比出「相等」⇒ patchFields 空 ⇒ needChartSync=false ⇒ 闸门没置起 ⇒ /chart 回流时这条
		// 校正路径整个被跳过。表现:中栏表头(走三式自己的 /nongli/time)跟着变、奇门与太乙盘也重取,
		// 唯独**外圈星度(顶/升/金/日/月,唯一数据源是 props.chartObj)冻在起盘那一刻**;同一时辰内
		// 奇门局与太乙局本就不变,于是整盘看上去「完全没动」。四分钟一档最明显(MC 每 4 分钟约走 1°)。
		// 安全性:refreshAll → performRecalcByNongli 内有 recalcSignature 去重,chartObj 实质没变
		// (同一时刻重复回流)即瞬时 no-op —— 前提是 outerChartKey 不含随机 chartId(见 getOuterChartKey)。
		if(this.state.hasPlotted && chartChanged){
			if(this.awaitingSyncTimer){
				clearTimeout(this.awaitingSyncTimer);
				this.awaitingSyncTimer = null;
			}
			const fields = this.state.localFields || this.props.fields;
			this.awaitingChartSync = false;
			this.refreshAll(fields, true);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		this.clearCastChartWait();
		if(this._sanshiStepPrefetcher){
			unregisterStepPrefetcher('sanshiunited', this._sanshiStepPrefetcher);
			this._sanshiStepPrefetcher = null;
		}
		window.removeEventListener('resize', this.handleWindowResize);
		window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		if(this._dayBoundaryListener){
			window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
		}
		if(this._lateZiHourListener){
			window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
		}
		if(this.prefetchSeedTimer){
			clearTimeout(this.prefetchSeedTimer);
			this.prefetchSeedTimer = null;
		}
		if(this.awaitingSyncTimer){
			clearTimeout(this.awaitingSyncTimer);
			this.awaitingSyncTimer = null;
		}
		this.cancelPendingRecalc(false);
		if(this.pendingSnapshotIdle && typeof cancelIdleCallback === 'function'){
			cancelIdleCallback(this.pendingSnapshotIdle);
			this.pendingSnapshotIdle = null;
		}
		if(this.pendingSnapshotTimer){
			clearTimeout(this.pendingSnapshotTimer);
			this.pendingSnapshotTimer = null;
		}
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	render(){
		const height = this.state.leftBoardHeight > 0
			? this.state.leftBoardHeight
			: Math.max(760, (this.state.viewportHeight || 900) - 108);
		return (
			<div className={`${styles.root} horosa-sanshi-page horosa-astro-redesign horosa-sanshi-redesign`} style={{ height: '100%', minHeight: 0 }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-sanshi-redesign-layout">
					{/* [连续调整不打断] 原 <Spin spinning={loading}> 满屏压暗遮罩已撤(用户实告「加载把整屏挡住」):
					    重算期旧盘 keep-stale 保留可见,仅中栏右上角一枚非阻塞小转圈(复用全站 workspace-updating
					    观感,sanshi-updating 变体只改定位为中栏内 absolute)。 */}
					<div className="horosa-astro-redesign-grid horosa-sanshi-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-sanshi-input-panel">
							{this.renderInputPanel()}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-sanshi-chart-panel xq-chart-renderer xq-chart-renderer-sanshi">
							{this.state.loading ? (
								<div className="horosa-workspace-updating horosa-sanshi-updating">重算中…</div>
							) : null}
							<div ref={this.captureLeftBoardHost} className="horosa-sanshi-board-host">
								{this.renderLeftBoard(height)}
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-sanshi-info-panel">
							{this.renderRight()}
						</div>
					</div>
					{this.renderQuickDock()}
				</div>
			</div>
		);
	}
}
mixinMethods(SanShiUnitedMain, caseStateMethods, inputMethods, computeMethods, recalcMethods, boardMethods, inputPanelMethods, rightPanelMethods);   // 方法按职责拆在 ./main/ 下(见各文件头),挂回原型

export default SanShiUnitedMain;
