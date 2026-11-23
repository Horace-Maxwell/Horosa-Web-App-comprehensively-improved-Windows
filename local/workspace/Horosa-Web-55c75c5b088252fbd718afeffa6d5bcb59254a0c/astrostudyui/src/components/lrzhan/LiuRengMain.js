import { dayBoundaryLockHeld } from '../../utils/dayBoundaryLock';
import { Component } from 'react';
import { timeGeoFieldsChanged } from '../../utils/pendingTimeDraft';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import '../../utils/pageSettingsStore';
import { XQStageEmpty } from '../xq-ui';
import XQIcon from '../xq-icons';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import {randomStr, randomNum, littleEndian,} from '../../utils/helper';
import '../liureng/LRPanStyle';
import '../liureng/LRShenJiangDoc';
import '../liureng/ChuangChart';
import LiuRengChart from './LiuRengChart';
import DateTime from '../comp/DateTime';
import { chartDrawGuardEnabled, stepPrefetchEnabled } from '../../utils/perfFlags';
// R4-B2(horosa_prefetch_registry_v1):/liureng/gods 步进预取登记 + 选步长武装(S3 收敛)。
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
// 组件外的模块级助手(纯函数 / 常量 / 表 / 小组件)与组件方法(inputs · requests · caseState · inputPanel · rightTabs;类后 mixinMethods 挂回原型)按职责拆在 ./main/ 下;
// 构造、生命周期、render 与对外导出面仍在本文件。
import { sameLRSigArr, readLiurengChartType, readLiurengFlag, buildBirthFields, getSolarYearFromField, resolveDisplayRunYear } from './main/birthRunYear';
import { QIZHENG_PLANET_COLOR, QIZHENG_WUXING_COLOR, buildQiZhengItems } from './main/ganzhiHelpers';
import { LIURENG_PAGE_SETTINGS, liurengChouBranch, buildLiuRengCastOverride } from './main/castLayout';
import { getAppliedBirth, liurengBenmingXingnian } from './main/panData';
import { XIAO_JU_REFERENCE_TAB_KEYS } from './main/referenceXiaoJu';
import { buildReferenceDocumentText, buildOverviewReferenceText } from './main/referenceOverview';
import { buildLiuRengReferenceBundle } from './main/referenceMatch';
import { clearZeriLockMarks } from '../../divination/zeri/zeriPageCalibre';
import { mixinMethods } from '../../utils/mixinMethods';
import { inputMethods } from './main/inputs';
import { requestMethods } from './main/requests';
import { caseStateMethods } from './main/caseState';
import { inputPanelMethods } from './main/inputPanel';
import { rightTabMethods } from './main/rightTabs';
import { registerProcessCache } from '../../utils/processCacheRegistry';
import { techniqueResultCacheEnabled } from '../../utils/perfFlags';
// 对外导出面不变:搬进子模块的导出原样重导出
export { appendMapSection, resolveDisplayRunYear } from './main/birthRunYear';
export {
	QI_METHODS, LIURENG_PAGE_SETTINGS, liurengAyanamsa, getYueJiangByMethod, computeQiXY, buildLiuRengCastOverride,
	buildLiuRengLayout, liurengSeHaiOptsOf, liurengFenZhouYeDiurnal,
} from './main/castLayout';
export {
	liurengCaseGender, buildKeData, buildSanChuanData, buildLiuRengPanRows, buildLiuRengSanChuanRows,
	buildLiuRengSuiShaRows, buildLiuRengZhangShengRows,
} from './main/panData';
export { DA_GE_META } from './main/referenceDaGe';
export { XIAO_JU_META } from './main/referenceXiaoJu';
export { buildLiuRengReferenceContext, matchDaGeReferences, matchXiaoJuReferences } from './main/referenceMatch';
export { buildLiuRengSnapshotText } from './main/snapshot';


// horosa_kentang_result_cache_v1 —— /liureng/gods + /liureng/runyear 的结果缓存**提升到模块级**。
// 原为 per-instance(this.godsCache 等):每次切走六壬页 → 组件卸载 → 缓存连同在途 Promise 一起蒸发,
// 切回来整趟往返重付。这两个端点是确定性纯计算(key=genGodsParams/genRunYearParams 的 JSON,
// 即请求体本身:'YYYY-MM-DD'/'HH:mm' 格式化字串 + 经纬/时区/性别/日界开关,无 Date 对象、无随机、
// 无「现在时刻」依赖),故跨实例复用与直连逐值等价。
// ns 显式写死在下面四个常量名里(**不**由 URL 派生:ServerRoot 端口每次后端启动随机,URL 派生的
// ns 会跨会话碎片化)。上限沿用原调用点的 72 / 96(pushCache 逐条传入,未改)。
// 关 horosa.perf.techniqueResultCache → 构造函数回到 new Map()(=今日的 per-instance 行为,逐字一致)。
const LIURENG_GODS_MEM = new Map();
const LIURENG_GODS_INFLIGHT = new Map();
const LIURENG_RUNYEAR_MEM = new Map();
const LIURENG_RUNYEAR_INFLIGHT = new Map();
// 模块级共享后这四张表即「进程内同参复用」缓存:照上游惯例登记清空函数(只供审计仪器取样前清空;产品运行期从不调用,零行为变化)。
registerProcessCache('liureng.godsRunyear', ()=>{ LIURENG_GODS_MEM.clear(); LIURENG_GODS_INFLIGHT.clear(); LIURENG_RUNYEAR_MEM.clear(); LIURENG_RUNYEAR_INFLIGHT.clear(); });

// 起课口径的 state 键(择日宿主经 hook.getCastOptions 取;变了经 onPageCalibreChange 告知宿主)
const LIURENG_CAST_STATE_KEYS = ['guireng', 'castMethod', 'yueJiangMethod', 'fenZhouYe', 'seHaiMethod', 'seHaiBoundary', 'shiRuKe', 'yearShenShaSort', 'yinyangSystem', 'tuWangShuai'];

class LiuRengMain extends Component{
	constructor(props) {
		super(props);
		let now = new DateTime();
		let birth = buildBirthFields(this.props.fields, now);
		// 上次亲手设的排盘口径 —— 只有独立六壬页读;六壬择日里内嵌的那份恒从出厂值起(扫描引擎的钉死口径 = 出厂值,
		// 显示盘必须与扫描判定同口径;工作台口径另经 applyCastFields 下发)。
		const savedSet = this.usesSavedSettings() ? LIURENG_PAGE_SETTINGS.load() : LIURENG_PAGE_SETTINGS.defaults();

		this.state = {
			birth: birth,
			calcBirth: birth,
			liureng: null,
			runyear: null,
			// 起课时间算法:0=真太阳时(缺省=后端历来写死的口径,字节零回归) / 1=直接时间。
			// 此前独立六壬页无此控件、后端写死真太阳时,而三式合一的六壬层时柱取自奇门(奇门吃 timeAlg)
			// → 全局选「直接时间」时,同一时刻两页六壬时柱可分属两个时辰。补控件使两页可对齐。
			timeAlg: savedSet.timeAlg,
			wuxing: '土',
			// 「十二长生五行」的真实缺省是**日干五行**(每次起课回包按日干重置);
			// 此前无「用户已选」记忆 → 用户选了金,一改时间/步进/再起课就被冲回日干五行,载档回灌的值同样守不住。
			// 本标记为 true 后,起课回包不再覆盖(载档回灌带存档值时一并置 true)。
			wuxingUserSet: false,
			guireng: savedSet.guireng,
			castMethod: savedSet.castMethod,
			xuanShiZhi: '',
			yanShuNum: '',
			yueJiangMethod: savedSet.yueJiangMethod,
			fenZhouYe: savedSet.fenZhouYe,
			seHaiMethod: savedSet.seHaiMethod,     // 涉害取舍:app=仅下贼上(默认·已固定)/standard=标准深浅两向/mengzhongji=直取孟仲季
			seHaiBoundary: savedSet.seHaiBoundary,   // 涉害起讫:app=计起点不计本家(默认)/both=两端皆计/neither=皆不计
			shiRuKe: savedSet.shiRuKe,         // 始入课:false=并入重审(默认)/true=单一下贼上单列始入(九法变十法)
			yearShenShaSort: savedSet.yearShenShaSort, // 年神排序:sanyuan=四利三元序(默认)/suigui=太岁排轮(太阴落宫异)
			yinyangSystem: savedSet.yinyangSystem,     // 昼夜阳阴归属:danmu=旦暮系(默认)/yinyang=星历考原阳阴系(A正法甲乙丙辛壬癸昼夜互换)
			tuWangShuai: savedSet.tuWangShuai,        // 土旺衰:siji=四季月18日土旺(默认)/huotu=火土同宫(土随火)
			calcFields: null,
			calcChart: null,
			rightPanelTab: 'dage',
			chartType: readLiurengChartType(),
			xiangOn: readLiurengFlag('liurengXiangOn', false),
			pinnedXiang: null,
			zhanCategory: 'general',
			bifaQuery: '',
		};

		this.unmounted = false;
		this.timeHook = {};
		this.pendingFields = null;
		this.birthYearGanZiCache = {};
		// horosa_kentang_result_cache_v1:命中模块级 LRU(切页往返 0 请求);关闸=每实例独立 Map(旧行为)。
		const lrShareCache = techniqueResultCacheEnabled();
		this.godsCache = lrShareCache ? LIURENG_GODS_MEM : new Map();
		this.godsInflight = lrShareCache ? LIURENG_GODS_INFLIGHT : new Map();
		this.runYearServerCache = lrShareCache ? LIURENG_RUNYEAR_MEM : new Map();
		this.runYearServerInflight = lrShareCache ? LIURENG_RUNYEAR_INFLIGHT : new Map();
		// render 内派生缓存(单槽 last-result)。render() 每次都 buildLiuRengCastOverride(新对象!)+
		// buildLiuRengReferenceBundle(~650行重算)。切右栏 tab(rightTab/activeTab 等)只改无关 state,却让二者整套重跑;
		// 且 castOverride 每次新引用 → 透传给 LiuRengChart 的 CDU 恒判「变」→ d3 整树白重画(越用越卡的真凶)。
		// 按各自实际消费的输入做签名缓存:签名全等 → 复用上次结果(引用稳定,byte-perfect 同输入同输出),
		// LiuRengChart 拿到稳定 castOverride → CDU 不再误触发;任一变 → 真重算重画。kill-switch 复用 chartDrawGuard 闸。
		this._castOverrideCache = null;
		this._refBundleCache = null;

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onBirthChange = this.onBirthChange.bind(this);
		this.onWuXingChange = this.onWuXingChange.bind(this);
		this.onGuiRengChange = this.onGuiRengChange.bind(this);
		this.onCastMethodChange = this.onCastMethodChange.bind(this);
		this.handleCastField = this.handleCastField.bind(this);
		this.onChartTypeChange = this.onChartTypeChange.bind(this);
		this.genGodsParams = this.genGodsParams.bind(this);
		this.prefetchStepSelect = this.prefetchStepSelect.bind(this);
		this.genRunYearParams = this.genRunYearParams.bind(this);
		this.requestGods = this.requestGods.bind(this);
		this.onTimeAlgChange = this.onTimeAlgChange.bind(this);
		this.requestRunYear = this.requestRunYear.bind(this);
		this.requestBirthYearGanZi = this.requestBirthYearGanZi.bind(this);
		this.startPaiPanByFields = this.startPaiPanByFields.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickStartPaiPan = this.clickStartPaiPan.bind(this);
		this.saveLiuRengAISnapshot = this.saveLiuRengAISnapshot.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.onToggleXiang = this.onToggleXiang.bind(this);
		this.handleXiangPick = this.handleXiangPick.bind(this);
		this.onZhanCategoryChange = this.onZhanCategoryChange.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields, chartObj)=>{
				if(this.unmounted){
					return;
				}
				// 切回本页时的刷新(不带底盘):还没起过课就不替用户起 —— 首次进页留空等「起课」,切走再回来也一样
				// (此前回访时自己起出一课,与首次进页、与遁甲 / 三式合一都不一致);起过课的照旧按当前时刻重起
				if((chartObj === undefined || chartObj === null) && !this.state.liureng){
					return;
				}
				this.startPaiPanByFields(fields || this.props.fields, chartObj);
			};
			// 只换底盘、不起课:择日宿主载入存案后按存案时刻取回的底盘(四课三传由存档复原,不重起;
			// 盘头农历与天地盘随之与存档同一时刻,之后点「起课」也拿得到对得上的底盘)
			this.props.hook.setChart = (fields, chartObj)=>{
				if(this.unmounted){
					return;
				}
				const calcChart = chartObj && chartObj.chart ? chartObj.chart : null;
				if(!fields || !calcChart){
					return;
				}
				this.setState({ calcFields: fields, calcChart });
			};
			// 择日宿主取这一刻的底盘失败:换了起课时刻 / 地点 → 屏上那一课是上一课,清掉(盘区留空);同一课只改设置 → 留存
			this.props.hook.chartUnavailable = (fields)=>{
				if(this.unmounted){ return; }
				this.settleCastChartFailure(fields);
			};
			// 并行预热:fetchByFields 等 /chart 前先把 /liureng/gods 打出去
			// (silent,经 requestDedupe 在途共享)→ 页面总延迟 sum→max。构参走 genGodsParams
			// 同源 → 与 hook 正式请求逐字节同键。失败静默,正式请求自兜底。
			// 择日宿主 pick 前回写工作台口径(贵人体系 guireng/月将法 yueJiangMethod/昼夜阳阴归属 yinyangSystem)
			// 到本页起课选项,让 pick 后显示盘/母快照与命中判定同口径(此前宿主 fields 不透传三键,显示盘按左栏旧档起课)。
			this.props.hook.applyCastFields = (partial)=>new Promise((resolve)=>{
				if(this.unmounted || !partial || typeof partial !== 'object' || !Object.keys(partial).length){ resolve(); return; }
				// 宿主回写过的锁定项不再是「由存案复原」的(见 zeriLockProps 第四参)
				this._zeriRestoredLocks = clearZeriLockMarks(this._zeriRestoredLocks, partial);
				this.setState(partial, resolve);
			});
			// 择日宿主点结果行时回写卜卦人出生(工作台「用事人本命」):盘头行年、右栏本命 / 行年与快照随之按这个人算,
			// 与扫描判本命组条件的是同一个人。出生档即刻生效(草稿 = 已应用),旧行年作废、在途的行年请求作废;之后的起课重取行年
			this.props.hook.applyBirth = (birthFields)=>new Promise((resolve)=>{
				if(this.unmounted || !birthFields || typeof birthFields !== 'object'){ resolve(); return; }
				const birth = buildBirthFields({ ...this.state.birth, ...birthFields }, new DateTime());
				this._runYearReqSeq = (this._runYearReqSeq || 0) + 1;
				this.setState({ birth, calcBirth: birth, runyear: null }, resolve);
			});
			// 择日宿主开始择时前取本页当前起课口径(分昼夜 / 涉害三键等):扫描与点开的课同口径
			this.props.hook.getCastOptions = ()=>{
				if(this.unmounted){ return null; }
				const out = {};
				LIURENG_CAST_STATE_KEYS.forEach((k)=>{ out[k] = this.state[k]; });
				return out;
			};
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.unmounted){ return; }
				try{
					const params = this.genGodsParams(flds || this.props.fields);
					if(!params){ return; }
					request(`${Constants.ServerRoot}/liureng/gods`, {
						body: JSON.stringify(params),
						silent: true,
					}).catch(()=>null);
				}catch(e){ /* 预热失败无害 */ }
			};
			// R4-B2(horosa_prefetch_registry_v1):/liureng/gods 是确定性纯计算(同时刻恒同神将)
			// → 登记步进预取,武装线(选步长/settle/切页)±depth 全窗经共享调度器构造发出
			// (享白名单闸/latest-wins/预算;S3 收敛:本地裸发路径退役为薄壳,见 prefetchStepSelect)。
			// 🔴 只登记「按时间起课」这条确定性链;六壬页若走随机/摇课起课路径,其参数不经本构造。
			if(stepPrefetchEnabled()){
				this._liurengStepPrefetcher = (steppedFields)=>{
					if(this.unmounted || !steppedFields){
						return [];
					}
					let params = null;
					try{
						params = this.genGodsParams(steppedFields);
					}catch(e){
						return [];
					}
					if(!params){
						return [];
					}
					return [{
						name: 'liureng:gods',
						path: '/liureng/gods',
						run: ()=> request(`${Constants.ServerRoot}/liureng/gods`, {
							body: JSON.stringify(params),
							silent: true,
							retry: { retries: 0 },
						}),
					}];
				};
				registerStepPrefetcher('liureng', this._liurengStepPrefetcher);
			}
		}
	}


	// WP-H-2 极速化:重 wrapper sCU —— 全 props 机械浅比(函数型跳过,详 wrapperPropsEqual);
	// state 任一引用变照常重渲(setState 恒换引用,此比既完整又廉价)。
	// 收益:宿主因无关状态重渲时,本重组件整树不再白跑。关 chartSCU 开关 = 恒重渲旧行为。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再覆盖
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
			window.addEventListener('horosa:liureng-xiang-pick', this.handleXiangPick);
		}		this.restoreFromCurrentCase(true);
	}

	componentDidUpdate(prevProps, prevState){
		// 择日宿主:本页起课口径变了(亲手改 / 宿主回写 / 载入存案)→ 告诉宿主,宿主按同一套过期判据重算「结果已过期」
		if(this.props.onPageCalibreChange && prevState && LIURENG_CAST_STATE_KEYS.some((k)=>prevState[k] !== this.state[k])){
			this.props.onPageCalibreChange();
		}
		// 时间弹层里没点「确定」的草稿只对当时那张盘有效:fields 从外面换了(载入别的盘 / 此刻起课 / 择日点选)
		// 就作废,否则再点「起课」会拿旧草稿(连同旧地点)盖掉新盘
		if(prevProps && timeGeoFieldsChanged(prevProps.fields, this.props.fields)){
			this.pendingFields = null;
		}
		// 择日内嵌载入存案引起的那一次 fields 变化:盘面由存档复原,不重起。先判后还原 —— 本轮还原新置的标记
		// 留给下一轮(覆盖层生效那一轮);此前同一轮里置了就被本轮(宿主重渲染换了 fields 引用)用掉
		const skipRecompute = !!(this._skipNextAfter23Recompute && prevProps && prevProps.fields !== this.props.fields);
		if(skipRecompute){ this._skipNextAfter23Recompute = false; }
		this.restoreFromCurrentCase();
		if(skipRecompute){
			return;
		}
		// 即时重算: 当 props.fields.after23NewDay 通过全局设置 sync 改变时自动重新起课。
		// 用户拍板: 左栏已改过则跳过(最高权限)。
		if(dayBoundaryLockHeld(this, 'after23')) return;
		const prev = prevProps && prevProps.fields && prevProps.fields.after23NewDay;
		const curr = this.props && this.props.fields && this.props.fields.after23NewDay;
		if(prev && curr && prev.value !== curr.value){
			this.requestGods(this.props.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		// R4-B2:反注册步进预取器(防卸载后闭包吃到死组件态)。
		if(this._liurengStepPrefetcher){
			unregisterStepPrefetcher('liureng', this._liurengStepPrefetcher);
			this._liurengStepPrefetcher = null;
		}
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
			window.removeEventListener('horosa:liureng-xiang-pick', this.handleXiangPick);
		}
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 760
		}else{
			height = height - 20
		}

		let chart = this.state.calcChart ? this.lrChartFor(this.state.calcChart) : null;
		let chartFields = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const appliedBirth = getAppliedBirth(this.state);
		const displayRunYear = resolveDisplayRunYear(this.state.runyear, appliedBirth, chartFields);
		const _lrExtra = liurengBenmingXingnian(appliedBirth, displayRunYear);
		const _solarYear = getSolarYearFromField(chartFields && chartFields.date ? chartFields.date : null);
		const _guardOn = chartDrawGuardEnabled();

		// ① castOverride 缓存:签名 = chart 引用 + buildLiuRengCastOverride/computeQiXY 实际消费的全部 opts 标量。
		//    全等 → 复用上次实例(引用稳定)→ 透传 LiuRengChart 的 CDU 不再误判变、d3 不白重画;任一变 → 真重算。
		const _castSig = [
			chart,
			this.state.castMethod, this.state.yueJiangMethod, this.state.fenZhouYe,
			this.state.seHaiMethod, this.state.seHaiBoundary, this.state.shiRuKe,
			this.state.yinyangSystem, _solarYear,
			this.state.xuanShiZhi, this.state.yanShuNum,
			_lrExtra.benmingZhi, _lrExtra.xingnianZhi,
		];
		let castOverride;
		if(_guardOn && this._castOverrideCache && sameLRSigArr(this._castOverrideCache.sig, _castSig)){
			castOverride = this._castOverrideCache.data;
		}else{
			castOverride = buildLiuRengCastOverride(chart, { ...this.state, benmingZhi: _lrExtra.benmingZhi, xingnianZhi: _lrExtra.xingnianZhi, solarYear: _solarYear });
			if(_guardOn){
				this._castOverrideCache = { sig: _castSig, data: castOverride };
			}
		}

		// ② refBundle 缓存:签名 = liureng/chart 引用 + guireng + 行年(仅消费 runyear.year)+ castOverride 引用(①已稳定)。
		//    切右栏 tab 不动这些 → 跳过 ~650 行参考体系重算;重排盘/换流派/换贵神/换行年 → 真重算。
		const _refSig = [
			this.state.liureng, chart, this.state.guireng,
			(displayRunYear && displayRunYear.year) || '', castOverride,
			_lrExtra.benmingZhi || '',
		];
		let refBundle;
		if(_guardOn && this._refBundleCache && sameLRSigArr(this._refBundleCache.sig, _refSig)){
			refBundle = this._refBundleCache.data;
		}else{
			refBundle = buildLiuRengReferenceBundle(this.state.liureng, chart, this.state.guireng, displayRunYear, castOverride, { benMingBranch: _lrExtra.benmingZhi });
			if(_guardOn){
				this._refBundleCache = { sig: _refSig, data: refBundle };
			}
		}
		const refContext = refBundle.context || {};
		const panStyleName = refContext.panStyle && refContext.panStyle.name ? refContext.panStyle.name : '';
		const xiaojuAllItems = Array.isArray(refBundle.xiaoju) ? refBundle.xiaoju : [];
		const xiaojuMainItems = xiaojuAllItems.filter((item)=>!XIAO_JU_REFERENCE_TAB_KEYS.has(item.key));
		const xiaojuReferenceItems = xiaojuAllItems.filter((item)=>XIAO_JU_REFERENCE_TAB_KEYS.has(item.key));
		const overviewItems = Array.isArray(refBundle.overview) ? refBundle.overview : [];
		const refSummary = [
			refContext.courseName ? `课式：${refContext.courseName}` : '',
			refContext.sanChuanText ? `三传：${refContext.sanChuanText}` : '',
			refContext.dayGanZi ? `日干支：${refContext.dayGanZi}` : '',
		].filter(Boolean).join('；');
		return (
			<div className="horosa-liureng-page horosa-astro-redesign horosa-liureng-redesign" style={{ height: height, minHeight: height, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-liureng-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-liureng-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-liureng-input-panel">
							{this.renderInputPanel()}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-liureng-chart-panel xq-chart-renderer xq-chart-renderer-liureng">
							<div className="horosa-liureng-chart-host">
								<LiuRengChart
									value={chart}
									liureng={this.state.liureng}
									panStyleName={panStyleName}
									runyear={displayRunYear}
									gender={appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : -1}
									zhangshengElem={this.state.wuxing}
									guireng={this.state.guireng}
									castOverride={castOverride}
									height={height}
									fields={chartFields}
									chartType={this.state.chartType}
									timeAlg={this.state.timeAlg}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
								/>
								{/* 未起课:盘面是空 svg,提示落在舞台正中(与遁甲 / 三式 / 六爻同款);盘组件照常挂着,起课后原地画 */}
								{!chart && !this.state.liureng ? (
									<div className="horosa-liureng-stage-empty">
										<XQStageEmpty>点击左侧“起课”后显示六壬盘</XQStageEmpty>
									</div>
								) : null}
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-liureng-info-panel">
							<div className="horosa-side-panel-heading horosa-liureng-info-heading">
								<div>
									<div className="horosa-side-panel-title">格局参考</div>
									<div className="horosa-side-panel-subtitle">大格、小局与参考条目</div>
								</div>
							</div>
							{/* horosa_liureng_render_slice_v1(L2):七政/信息两组条目原在此处每轮 render 先算好
							    (buildQiZhengItems + buildQuickMetaItems),而消费方只有各自 FreezeSubTab 面板 ——
							    非激活时算完即弃。改传原料(chart/displayRunYear),调用下沉进对应 thunk:面板激活才算;
							    freezeSubTabs 开关关闭 = thunk 每轮照跑 = 旧行为,无新旗标。 */}
							{this.renderReferenceTabs({
								refSummary,
								refBundle,
								xiaojuMainItems,
								xiaojuReferenceItems,
								overviewItems,
								chart,
								displayRunYear,
							})}
						</div>
					</div>
					{this.renderQuickDock()}
				</div>
			</div>

		);
	}
}
mixinMethods(LiuRengMain, inputMethods, requestMethods, caseStateMethods, inputPanelMethods, rightTabMethods);   // 方法按职责拆在 ./main/ 下(见各文件头),挂回原型

export {
	buildLiuRengReferenceBundle,
	buildReferenceDocumentText,
	buildOverviewReferenceText,
	XIAO_JU_REFERENCE_TAB_KEYS,
	liurengChouBranch,
	buildQiZhengItems,
	QIZHENG_PLANET_COLOR,
	QIZHENG_WUXING_COLOR,
};

export default LiuRengMain;
