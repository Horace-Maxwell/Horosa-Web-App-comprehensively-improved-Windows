import { lockDayBoundary, dayBoundaryLockHeld } from '../../utils/dayBoundaryLock';
import { Component } from 'react';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled, stepPrefetchEnabled, techniqueResultCacheEnabled, chartSCUEnabled } from '../../utils/perfFlags';
import { recordNewChartSeeds } from '../../utils/newChartSeeds';
import { cachedPost } from '../../services/_requestCache';
import { sendScopedFields } from '../../utils/scopedFieldsSink';
// R4-B2(horosa_prefetch_registry_v1):/ziwei/birth 步进预取登记 + 本地漏斗 settle 武装。
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
import { armStepPrefetch } from '../../utils/stepPrefetchArm';
import { markPanelReady, markInteractionStart } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Row, Col, message } from 'antd';
import { XQButton as Button, XQModal as Modal, XQTabs as Tabs } from '../xq-ui';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import { createSignatureMemo } from '../../utils/memoBySignature';
import ZiWeiInput from './ZiWeiInput';
import ZiWeiChart from './ZiWeiChart';
import ZWRuleMain from '../ruleziwei/ZWRuleMain';
import ZWLuckPanel, { buildDaxianItems, buildLiunianItems, emptyLuckSel, luckSelectDaxian, luckSelectLiunian, rederiveLuckSel } from './ZWLuckPanel';
import QuickDockBar from '../common/QuickDockBar';
import ZWPatternPanel from './ZWPatternPanel';
import TipsBoard from '../comp/TipsBoard';
import * as ZiWeiHelper from './ZiWeiHelper';
import * as ZWConst from '../../constants/ZWConst';
import { ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT } from './ziweiTempOverrideScope';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { ziweirulesCached } from '../../services/rules';
import { calcZiwei, deriveSanPan, applyLifeMasterOption } from './ZiweiCalc';
import { detectPatterns } from './ziweiPatterns';
import { ZWEngineOptions, ziweiNeedsLocalEngine, collectEngineOpts } from './ziweiOptions';
import { isYangGan } from './ziweiCore';
import { parseYearFromDateStr } from '../../utils/dateStrSafe';

import { getLayoutViewportWidth } from '../../utils/shellZoom';   // 版面尺寸一律读布局域(壳缩放下 documentElement.client* 恒为物理域)
import { periodFromLuckSel, ziweiSnapshotMeta, buildZiWeiSnapshotText, buildZiWeiInfoData } from './main/snapshot';
import { buildZiweiBirthParams, localEngineMemoKey } from './main/headless';
export { buildZiweiBirthParams, warmZiweiBirth, buildZiweiSnapshotForParams, ZW_ENGINE_SWITCH_KEYS, applyZiweiRecordOverride, localEngineMemoKey } from './main/headless';
const TabPane = Tabs.TabPane;

// 稳定空值(避免每次 render 新建字面量 → 下游 sCU/绘制守卫的引用比恒不等)。
// 三个消费者(ZiWeiChart.drawChart / ZWLuckPanel.render / buildZiWeiInfoData)在
// houses/nongli 缺省时都提前 return,不会写入这两个对象,故共享安全。
const ZW_EMPTY_CHART = {};
const ZW_EMPTY_PATTERNS = [];

// horosa_ziwei_state_slice_v1:本组件 render 实际消费的 state 键。
// indicator(仅 ZWChart 指示器句柄回传,render 从不读)与 cnt(历史遗留,零读取)变化时,
// 旧的「nextState !== this.state 即返 true」会把 12 宫 SVG + 右栏四页签全部重渲一遍。
// 取向仍是「宁可多渲、绝不漏渲」:只有**确认 render 不读**的键才判无关,其余任何键(含未知新增键)一律判「变了」。
const ZW_RENDER_IRRELEVANT_STATE_KEYS = { indicator: true, cnt: true };
function ziweiStateAffectsRender(prev, next){
	if(prev === next){
		return false;
	}
	if(!prev || !next){
		return true;
	}
	const prevKeys = Object.keys(prev);
	const nextKeys = Object.keys(next);
	if(prevKeys.length !== nextKeys.length){
		return true;   // 键集合变了 → 保守判「变了」
	}
	for(let i = 0; i < nextKeys.length; i += 1){
		const k = nextKeys[i];
		if(prev[k] === next[k]){
			continue;
		}
		if(ZW_RENDER_IRRELEVANT_STATE_KEYS[k]){
			continue;
		}
		return true;
	}
	return false;
}

class ZiWeiMain extends Component{
	constructor(props) {
		super(props);
		// 本地引擎签名记忆(生辰+开关往返切换免重算);kill-switch horosa.perf.localEngineMemo
		this._localEngineMemo = createSignatureMemo(4);
		this.state = {
			result: null,
			rules: null,
			indicator: null,
			cnt: 0,
			tips: null,
			centerInfoVisible: false,
			dualView: 'day',   // 晚子双盘(WP-8):day=当日盘(默认) / next=次日盘;仅 chart.dualAlt 在时显切换
			tonglianHi: null,  // 童限/中限(WP-1/2)点选高亮的本命宫 index(独立于 luckSel;金框机制);选大限则清
			// 运限单一真值源（需求1）：命盘九宫格与运限 tab(ZWLuckPanel) 共读写；默认空＝无运限(本命四化+自化)。
			// dirIndex / luckMingIndex / 各宫运限标签 / 四化滑窗 全由 luckSel 派生(见 render)。
			luckSel: emptyLuckSel(),
			// horosa_freeze_subtabs_v1:右栏四页签改【受控】(原 defaultActiveKey 非受控 → 无从冻结)。
			// 初值 'info' 与原 defaultActiveKey 逐字一致 = 首屏所见零变化。
			rightTab: 'info',
		};

		this.unmounted = false;

		this.requestZiWei = this.requestZiWei.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onChangeDirection = this.onChangeDirection.bind(this);
		this.getNowDirectionIdx = this.getNowDirectionIdx.bind(this);
		this.genDirectionDom = this.genDirectionDom.bind(this);
		this.indicate = this.indicate.bind(this);
		this.onTipClick = this.onTipClick.bind(this);
		this.openCenterInfo = this.openCenterInfo.bind(this);
		this.closeCenterInfo = this.closeCenterInfo.bind(this);
		this.openDrawer = this.openDrawer.bind(this);
		this.navigateFeature = this.navigateFeature.bind(this);
		this.renderBottomQuickDock = this.renderBottomQuickDock.bind(this);
		this.onLuckSelChange = this.onLuckSelChange.bind(this);
		this.onTonglianHighlight = this.onTonglianHighlight.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		// 稳定回调:原先是 render 内联箭头(每次 render 新引用)→ 下游 sCU 的 props 比恒不等,memo 形同虚设。
		this.onRightTabChange = this.onRightTabChange.bind(this);
		this.openAiAnalysis = this.openAiAnalysis.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.requestZiWei(fields);
			};
			// 所见那张盘实际所用的 fields(请求过了代次校验、确定上屏的那一次):择日宿主存案取它 —— 内嵌页自己重排、宿主改了工作台没重排、覆盖层里没确定的草稿,都不会让存案的时间地点与所见不一致
			this.props.hook.getPlottedFields = ()=>this._plottedFields || null;
			// 🔴 chartFree 契约(极速化快车道):本页中右栏【零】消费共享 chartObj(全部由 fields
			// 驱动本组件自算/自取)。声明后 fetchByFields 对本页走快车道:fields 立即提交、
			// 不等 /chart 网络 —— 本页从「等一次网络(~230ms)」变「点击即出(<100ms)」。
			// 若日后本页开始读 props.value/chartObj,必须删掉此行(有静态哨兵机械核)。
			this.props.hook.chartFree = true;
			// R4-B2(horosa_prefetch_registry_v1):/ziwei/birth 是确定性纯计算(同 生辰+流派 恒同盘;
			// 无随机、不依赖「现在」)→ 登记步进预取。
			// 🔴 登记必须在组件内:genParams 吃组件态的流派设置(ZWConst.ZWSchool),
			//    模块级登记构不出与真点同键的 body。闸:horosa.perf.stepPrefetch(关=零登记)。
			if(stepPrefetchEnabled()){
				this._ziweiStepPrefetcher = (steppedFields)=>{
					if(this.unmounted){
						return [];
					}
					let params = null;
					try{
						params = this.genParams(steppedFields);
					}catch(e){
						return [];
					}
					if(!params){
						return [];
					}
					// 与 requestZiWei 完全同一入口(同 url、同 body、同缓存层)—— 差一字节即白预取。
					// silent + retry:0:后端重启窗口绝不退避风暴。
					const opts = { silent: true, retry: { retries: 0 } };
					return [{
						name: 'ziwei:birth',
						path: '/ziwei/birth',
						run: ()=> (techniqueResultCacheEnabled()
							? cachedPost(`${Constants.ServerRoot}/ziwei/birth`, params, opts, { ns: 'ziwei/birth' })
							: request(`${Constants.ServerRoot}/ziwei/birth`, {
								body: JSON.stringify(params),
								...opts,
							})),
					}];
				};
				registerStepPrefetcher('ziwei', this._ziweiStepPrefetcher);
			}
		}
	}

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			const patch = {
				...field,
			};
			const confirmed = !!patch.__confirmed;
			if(Object.prototype.hasOwnProperty.call(patch, '__confirmed')){
				delete patch.__confirmed;
			}
			// 紫微不走 fetchByFields(save+requestZiWei 自链),步进提示在此捕获后剥净:
			// 防其进入 astro/save 与 requestZiWei 请求体(save reducer 另有中央网兜底);
			// 捕获值驱动本组件专属的顺向 +1 步预取(A4 紫微版)。
			const stepHint = patch.__stepHint || null;
			if(Object.prototype.hasOwnProperty.call(patch, '__stepHint')){
				delete patch.__stepHint;
			}
			// horosa_panel_ready_v1 配对起点:紫微【左栏】(ZiWeiInput:改时间/流派/传本开关/杂曜显示…)
			// 全部走本方法 → dispatch('astro/save') + 直调 requestZiWei,**不经** pages/index.js 的
			// changeCond,故那里的 markInteractionStart 覆盖不到它 → 起点缺失时 markPanelReady 因
			// stepT0===0 静默丢弃,左栏这条最高频路径将永远量不到一条样本。与 calendar 族
			// (NongLiMain/TongshuMain「本页时间条不经 pages/index.js」)同一处置。
			// 判据与下方真正触发重排的分支逐字同源,故不会为「只落 fields、不重排」的调用留悬空起点。
			if(confirmed || !Object.prototype.hasOwnProperty.call(field || {}, '__confirmed')){
				markInteractionStart('ziwei');
			}
			// 「新盘种子」:独立紫微页亲手改「时间算法」= 全局时间算法缺省(与设置弹窗同一仓);择日内嵌 / 截图挂载不记
			if(!this.props.techniqueScope && patch.timeAlg !== undefined){
				recordNewChartSeeds({ timeAlg: patch.timeAlg });
			}
			// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖。
			if(field && Object.prototype.hasOwnProperty.call(field, 'after23NewDay')){
				lockDayBoundary(this, 'after23');
				if(!this.props.techniqueScope){
					this.props.dispatch({ type: 'astro/setAfter23BoundaryUserOverrode', payload: { value: true } });
				}
			}
			// 择日宿主内嵌:改动交给宿主的覆盖层(宿主用新 fields 调 hook 重排),不写主盘
			if(sendScopedFields(this.props, patch, { recompute: confirmed || !Object.prototype.hasOwnProperty.call(field || {}, '__confirmed') })){
				return;
			}
			let flds = {
				fields: {
					...this.props.fields,
					...patch,
				}
			};
			this.props.dispatch({
				type: 'astro/saveUserFields',
				payload: flds
			});
			if(confirmed || !Object.prototype.hasOwnProperty.call(field || {}, '__confirmed')){
				this.requestZiWei(flds.fields);
				this.prefetchNextStepZiwei(flds.fields, stepHint);
			}
		}
	}

	// 顺向 +1 步预取:/ziwei/birth 经 genParams 同源构参 → 键逐字节等,
	// 结果落 requestDedupe(L1/L2/L3);rules 与盘无关恒缓存。连点下一步 ≈ 瞬间。
	// 失败静默;开关关=零行为。
	prefetchNextStepZiwei(baseFields, stepHint){
		try{
			if(!stepPrefetchEnabled()){ return; }
			if(!stepHint || !stepHint.dir){ return; }
			const dt0 = baseFields && baseFields.date && baseFields.date.value;
			if(!dt0 || typeof dt0.clone !== 'function'){ return; }
			if(this.prefetchStepTimer){ clearTimeout(this.prefetchStepTimer); }
			this.prefetchStepTimer = setTimeout(()=>{
				this.prefetchStepTimer = null;
				if(this.unmounted){ return; }
				try{
					const dt2 = dt0.clone();
					const unit = stepHint.unit || 'm';
					if(unit === 'y'){ dt2.addYear(stepHint.dir); }
					else if(unit === 'M'){ dt2.addMonth(stepHint.dir); }
					else if(unit === 'd'){ dt2.addDate(stepHint.dir); }
					else if(unit === 'h'){ dt2.addHour(stepHint.dir); }
					else { dt2.addMinute(4 * stepHint.dir); }
					const flds2 = {
						...baseFields,
						date: { value: dt2.clone() },
						time: { value: dt2.clone() },
						ad: { value: dt2.ad },
						zone: { value: dt2.zone },
					};
					const params = this.genParams(flds2);
					if(!params){ return; }
					request(`${Constants.ServerRoot}/ziwei/birth`, {
						body: JSON.stringify(params),
						silent: true,
					}).catch(()=>null);
				}catch(e){ /* 预取失败无害 */ }
			}, 150);
		}catch(e){ /* 预取失败无害 */ }
	}

	// 命盘九宫格点大限(需求1)：写统一 luckSel(等价 ZWLuckPanel.pickDaxian)，立即驱动 运X/金框/大限四化叠层。
	// 再点同一已选大限且无更深层 → 取消(回本命四化+自化的经典盘)，给用户「无运限」可达路径。
	onChangeDirection(value){
		const chart = this.state.result ? this.state.result.chart : null;
		if(!chart){
			return;
		}
		const sel = this.state.luckSel || emptyLuckSel();
		const isSame = sel.daxian && sel.daxian.mingIndex === value;
		const noDeeper = !sel.liunian && !sel.liuyue && !sel.liuri && !sel.liushi;
		// horosa_panel_ready_v1 配对起点:点大限是【纯本地】setState(不发请求、不经 pages/index.js
		// changeCond),此前起点/终点两头皆无 → 这条路径在验收台架里是**零样本**(既非通过也非失败,
		// 而是根本没量)。起点紧贴真正会落数的 setState 之前打,早退分支不留悬空起点。
		if(isSame && noDeeper){
			markInteractionStart('ziwei');
			this.setState({ luckSel: emptyLuckSel() }, ()=>{ markPanelReady('ziwei'); });
			return;
		}
		const item = buildDaxianItems(chart).find((d)=> d.mingIndex === value) || null;
		markInteractionStart('ziwei');
		this.setState({ luckSel: luckSelectDaxian(chart, item, sel) }, ()=>{ markPanelReady('ziwei'); });
	}

	genParams(fields){
		// R4-B3:构造原样抽为模块级纯函数(预热/预取复用同一路径 ⇒ key/body 逐字节一致);
		// 本方法保持既有签名与 props 兜底语义,纯委托零行为变化。
		return buildZiweiBirthParams(fields ? fields : this.props.fields);
	}

	async requestZiWei(fields){
		if(fields === undefined || fields === null){
			return;
		}
		const params = this.genParams(fields);
		// 请求代次:只认最后发出的那次(择日宿主载入存案时,挂载即请求的当前时刻盘与存案那张并发,
		// 存案那张命中缓存先回、当前时刻那张后到会把它盖掉)。与八字 baziReqSeq 同做法
		const seq = (this._zwReqSeq = (this._zwReqSeq || 0) + 1);

		// 并行 + rules 会话缓存:rules 与本盘无关(body 恒 {}),原串行瀑布白付一次 RTT;
		// 启动已 prime 缓存(models/app.js dispatch rules/ziwei),此处通常零成本命中。
		// 任一失败整体 throw、不 setState,与原「串行中途失败不 setState」口径一致。
		// WP-C/D 极速化:silent=不触发全局满屏 Spin(keep-stale:旧盘留存+「更新中…」角标,
		// 新盘到达单次 setState 整体替换)。关 silentTechniquePanels 开关=旧全屏。
		this.setState({ updating: true });
		const [data, rules] = await Promise.all([
			techniqueResultCacheEnabled()
				? cachedPost(`${Constants.ServerRoot}/ziwei/birth`, params, { silent: silentTechniquePanelsEnabled() }, { ns: 'ziwei/birth' })
				: request(`${Constants.ServerRoot}/ziwei/birth`, {
					body: JSON.stringify(params),
					silent: silentTechniquePanelsEnabled(),
				}),
			ziweirulesCached({}),
		]);
		if(this.unmounted || seq !== this._zwReqSeq){
			return;
		}
		// 🔴 空载荷守卫:request() 网络层失败会吞错 resolve undefined(非 reject)。
		// 缺守卫时 data[ResultKey]/rules[ResultKey] 直接崩(Unhandled Rejection)→ 生产白屏/选项永无反应。
		// 口径与「失败不 setState」一致:人话提示 + return,后端就绪后用户重试即恢复。
		if(!data || !rules){
			this.setState({ updating: false });
			message.error('后端服务尚未就绪,请稍后重试');
			return;
		}
		this._plottedFields = fields;
		const result = data[Constants.ResultKey]

		// 本地引擎双路(传本开关):任一开关非默认 → 用本地 ZiweiCalc 重排中盘(Java 不支持大限跨度/天马/星集/三盘等);
		// 全默认 → 保留 Java 盘(逐宫零回归)。本地失败一律 try/catch 兜底回退 Java,默认/异常都不破坏现有盘。
		if(result && result.chart && ziweiNeedsLocalEngine()){
			try {
				const birth = { date: params.date, time: params.time, zone: params.zone, lon: params.lon, lat: params.lat, gpsLon: params.gpsLon, gpsLat: params.gpsLat, ad: 1, gender: params.gender };
				const opts = { timeAlg: params.timeAlg, after23NewDay: params.after23NewDay, lateZiHourUseNextDay: params.lateZiHourUseNextDay, lateZi: ZWEngineOptions.lateZi, yearBoundary: ZWEngineOptions.yearBoundary, ...collectEngineOpts(ZWEngineOptions), lifeMasterBy: ZWEngineOptions.lifeMasterBy || 'year_branch' };
				// ⚠️ lifeMasterBy 显式选项(默认 'year_branch'=Java 同源;fallback 字面量保留防单例缺位)。
				//    历史上此处钉死生年支防「翻拨开关误改命主」——现由显式选项+ziweiCalc 哨兵金标接防
				//    (默认零回归;ming_branch=用户主动选,命主按天盘命宫支且不随观察盘移)。
				// 签名记忆:同 生辰+引擎开关+三盘 往返切换(A→B→A)免重算本地引擎全套
				// (calcZiwei+deriveSanPan+detectPatterns ≈50-200ms)。缓存值冻结存放,
				// 使用时浅拷贝再 spread 进 result.chart,防调用侧改写污染缓存。
				// 星曜生年四化与格局都随当前四化流派(含自定义 / 随盘四化表)算:键带流派与生效中的四化表,
				// 否则切流派后命中旧流派的记忆(亮度在本地盘里恒存基础值、显示层另叠,不入键)。
				const memoKey = localEngineMemoKey(birth, opts, ZWEngineOptions.sanPan || 'tian');
				let memoVal = this._localEngineMemo.get(memoKey);
				if(!memoVal){
					let localChart = calcZiwei(birth, opts);
					if(ZWEngineOptions.sanPan && ZWEngineOptions.sanPan !== 'tian'){ localChart = deriveSanPan(localChart, ZWEngineOptions.sanPan); }
					let localPatterns = null;
					if(localChart && Array.isArray(localChart.houses) && localChart.houses.length === 12){
						// WP-G:格局随本地盘重算(切开关后主星可移位/四化变,Java 默认盘 patterns 会失配)。失败回退 Java。
						try{ const lp = detectPatterns({ ...result.chart, ...localChart }); if(Array.isArray(lp)){ localPatterns = lp; } }catch(e2){ /* 保留 Java patterns */ }
					}
					memoVal = this._localEngineMemo.set(memoKey, { localChart, localPatterns });
				}
				if(memoVal.localChart && Array.isArray(memoVal.localChart.houses) && memoVal.localChart.houses.length === 12){
					result.chart = { ...result.chart, ...memoVal.localChart };   // 保留 Java 顶层兼容字段、仅换排盘核心
					// 年干阴阳随本地盘年干同步(Java 顶层 yearPolar 残留会致命局「阴男」而大限按阳男顺排、isDirCloseWise 错向)。
					if(memoVal.localChart.yearGan){ result.chart.yearPolar = isYangGan(memoVal.localChart.yearGan) ? 'Positive' : 'Negative'; }
					if(Array.isArray(memoVal.localPatterns)){ result.patterns = memoVal.localPatterns; }
				}
			} catch(e){ /* 本地异常 → 保留 Java 盘(零回归兜底) */ }
		}
		// 命主取法后处理:仅 Java 盘路径(本地盘已按 ctx.lifeMasterBy 以天盘命宫算好)
		if(result && result.chart && !ziweiNeedsLocalEngine()){ applyLifeMasterOption(result.chart, ZWEngineOptions.lifeMasterBy); }

		// 运限选择：仅当盘「身份」(生辰+性别+生年干+命宫)变 → 重置(新盘=本命四化+自化的经典盘)；
		// 盘式(三合/四化)、流派等纯视图重排(同盘) → 保留 luckSel(其 mingIndex/gan 仍对当前盘有效)，避免误清用户所选运限。
		const prevChart = (this.state.result && this.state.result.chart) ? this.state.result.chart : null;
		const chartIdentity = (c)=> c ? `${c.birth}|${c.gender}|${c.yearGan}|${c.lifeHouseIndex}` : '';
		const sameChart = !!prevChart && chartIdentity(prevChart) === chartIdentity(result.chart);
		// 回访 / 同参再取(切回本页、宿主重复触发):取回来的盘与手上这张逐字相同时,沿用手上的对象。
		// 盘面与右栏都按引用判要不要重画 —— 内容没变却换了引用,整张盘就重建一遍(一次回访近四千次 DOM 改动)。
		// 只比内容、不猜入参:流派 / 引擎开关 / 三盘改了,取回的盘自然不同,照常换新。
		let nextResult = result;
		try{
			const prevResult = this.state.result;
			if(prevResult && prevResult !== result){
				if(this._resultJsonOf !== prevResult){ this._resultJsonOf = prevResult; this._resultJson = JSON.stringify(prevResult); }
				if(this._resultJson === JSON.stringify(result)){ nextResult = prevResult; }
			}
		}catch(e){ nextResult = result; }
		const st = {
			result: nextResult,
			rules: rules[Constants.ResultKey],
			luckSel: sameChart ? (this.state.luckSel || emptyLuckSel()) : emptyLuckSel(),
			updating: false,
		};

		// horosa_panel_ready_v1:本次交互的**唯一**落数点 —— 中栏(12 宫 SVG,读 result/luckSel)与
		// 右栏(命盘/运限/格局,读 result/rules/luckSel)同吃这一次 setState,故接在它的回调上即
		// 「中栏+右栏都拿到最终数据」。上面本地引擎段(calcZiwei+deriveSanPan+detectPatterns,50-200ms)
		// 是本次 setState **之前**的同步开销,因而被完整计入本段。markPanelReady 内部再用双 rAF
		// 逼近「本帧已绘」。技法 key 用顶层页签的 'ziwei'(与 pages/index.js markInteractionStart 同源)。
		this.setState(st, ()=>{
			markPanelReady('ziwei');
			// R4-B2(b′):紫微步进走本地漏斗(onFieldsChange→astro/save+直调本方法,不经
			// fetchByFields)⇒ settle 武装必须在这里自己做,否则登记的 /ziwei/birth 预取器
			// 在本页步进路径上永不触发。skipChart:/chart 不在本页步进路径上(chartFree)。
			try{ armStepPrefetch('local-settle', { fieldsOverride: fields, skipChart: true }); }catch(e){ /* 武装失败静默 */ }
		});
		// 带上盘面此刻所选运限(与刷新应答同口径:此前惰性存的一份缺 [运限] 段,只有导出带)。
		this.saveZiweiSnapshot(params, result, st.luckSel);
	}

	composeSnapshotText(base){
		// 择日宿主经 composeAiSnapshot 拼接择时三段(scope 化,主紫微页零影响)
		if(typeof this.props.composeAiSnapshot === 'function'){
			try{ return `${this.props.composeAiSnapshot(base) || base}`; }catch(e){ return base; }
		}
		return base;
	}

	// 惰性构建:12 宫×星曜×四化遍历挪出排盘关键路径(params/result 在登记时刻取定,闭包安全;
	// builder 读的全局流派 ZWConst.ZWSchool 若在 idle 前被切换,切换路径必经 requestZiWei
	// 重排 → 新 save 覆盖本 pending,latest-wins 兜底)。取数完成、显示口径改档、运限点选三处同此一份。
	saveZiweiSnapshot(params, result, luckSel){
		const period = periodFromLuckSel(luckSel);
		const snapshotParams = period ? { ...params, period } : params;
		saveModuleAISnapshotLazy(this.props.techniqueScope || 'ziwei', ()=>this.composeSnapshotText(buildZiWeiSnapshotText(snapshotParams, result) || ''), ziweiSnapshotMeta(params));
	}

	componentDidUpdate(prevProps, prevState){
		// 只重绘、不重排的口径改档(小限顺逆 / 流年四化取干 / 流月起法 …,经 zwDisplayRev)与运限点选 → 按当前盘重存快照:
		// 此前只在排盘完成时存一次,改这几项后 AI 对话挂载读到的还是旧口径与旧运限(导出会刷新,两边不一)。
		// 盘本身换了由 requestZiWei 自存(那时 result 引用已变,此处不重复)。
		if(!prevState || !this.state.result || !this.state.result.chart || !this.props.fields){ return; }
		if(prevState.result !== this.state.result){ return; }
		if(prevState.zwDisplayRev !== this.state.zwDisplayRev || prevState.luckSel !== this.state.luckSel){
			this.saveZiweiSnapshot(this.genParams(this.props.fields), this.state.result, this.state.luckSel);
		}
	}

	getNowDirectionIdx(chartobj){
		if(chartobj.birth === undefined || chartobj.birth === null){
			return null;
		}
		let now = new DateTime();
		let y = now.format('YYYY');
		let year = parseInt(y);
		let birth = parseYearFromDateStr(chartobj.birth);
		let age = year - birth + 1;
		for(let i = 0; i<12; i++){
			let house = chartobj.houses[i];
			if(house.direction[0]<= age && age<=house.direction[1]){
				return i;
			}
		}
		return null;
	}

	genDirectionDom(chart){
		if(chart.houses === undefined || chart.houses === null){
			return null;
		}
		let startidx = chart.lifeHouseIndex;

		let dom = [];
		for(let i=0; i<12; i++){
			let idx = 0;
			if(ZiWeiHelper.isDirCloseWise(chart)){
				idx = (startidx + i) % 12;
			}else{
				idx = (startidx - i + 12) % 12;
			}
			let house = chart.houses[idx];
			let txt1 = house.direction[0] + '~' + house.direction[1];
			let txt2 = house.ganzi + '限';
			let lbl = (
				<Row>
					<Col span={24} style={{textAlign: 'center'}}>{txt1}</Col>
					<Col span={24} style={{textAlign: 'center'}}>{txt2}</Col>
				</Row>
			);
			let btntype = null;
			const selDx = this.state.luckSel && this.state.luckSel.daxian;
			if(selDx && selDx.mingIndex === idx){
				btntype = 'primary';
			}
			let rad = (
				<Col span={8} key={idx}>
					<Button 
						className="horosa-ziwei-direction-button"
						type={btntype}
						onClick={()=>{this.onChangeDirection(idx);}} 
						style={{width: '100%', height: 50}}
					>
						{lbl}
					</Button>
				</Col>
			);
			dom.push(rad);
		}
		return dom;
	}

	indicate(zwIndicator){
		this.setState({
			indicator: zwIndicator,
		});
	}

	onTipClick(tipobj){
		this.setState({
			tips: tipobj,
		});
	}

	openCenterInfo(){
		this.setState({
			centerInfoVisible: true,
		});
	}

	closeCenterInfo(){
		this.setState({
			centerInfoVisible: false,
		});
	}

	// horosa_freeze_subtabs_v1:右栏页签受控切换。仅记 rightTab,不触发任何请求/重排。
	onRightTabChange(key){
		if(key === this.state.rightTab){
			return;
		}
		// horosa_panel_ready_v1 配对起点:owner 验收口径含「换页签」,而右栏换页签是纯本地 setState,
		// 不经 changeCond → 不打起点就永远量不到。首次激活某页签时 FreezeSubTab 会在这一帧真正
		// 首渲该面板(运限轴/格局全表),正是该被计入的那段开销。
		markInteractionStart('ziwei');
		this.setState({ rightTab: key }, ()=>{ markPanelReady('ziwei'); });
	}

	// 稳定引用的「AI解读」跳转(原为 ZWLuckPanel 的内联 onAi 箭头)。
	openAiAnalysis(){
		this.navigateFeature('aianalysis');
	}

	// 运限 tab(ZWLuckPanel) 受控上报：直接落 luckSel 单一真值源（与九宫格同源）。选运限层即清童限高亮(互斥)。
	onLuckSelChange(next){
		// horosa_panel_ready_v1 配对起点:运限页签点 大限/流年/流月/流日/流时 chip 的落点(纯本地)。
		markInteractionStart('ziwei');
		this.setState({ luckSel: next || emptyLuckSel(), tonglianHi: null }, ()=>{ markPanelReady('ziwei'); });
	}

	// 童限/中限点选:高亮对应本命宫(金框);再点同宫取消。与 luckSel 互斥(设童限即以其为高亮源)。
	onTonglianHighlight(idx){
		this.setState((s)=>({ tonglianHi: (s.tonglianHi === idx ? null : idx) }));
	}

	openDrawer(key){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key,
				},
			});
		}
	}

	navigateFeature(key){
		if(this.props.onNavigate){
			this.props.onNavigate(key);
			return;
		}
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/save',
				payload: {
					currentTab: key,
				},
			});
		}
	}

	// 快捷栏契约:「运限对齐今天」:一键选中今天所在大限+今年流年(小限随流年自动合并),
	// 免去九宫格逐层点找;与九宫格/运限 tab 同走 luckSel 单一真值源,幂等无副作用。
	alignLuckToToday(){
		const chart = this.state.result ? this.state.result.chart : null;
		if(!chart || !chart.houses){
			return;
		}
		const idx = this.getNowDirectionIdx(chart);
		if(idx === null){
			message.info('今天不在任何大限范围内');
			return;
		}
		const dx = buildDaxianItems(chart).find((d)=>d.mingIndex === idx) || null;
		if(!dx){
			return;
		}
		let sel = luckSelectDaxian(chart, dx, this.state.luckSel);
		const year = parseInt(new DateTime().format('YYYY'), 10);
		const ln = buildLiunianItems(chart, dx).find((l)=>l.year === year) || null;
		if(ln){
			sel = luckSelectLiunian(chart, ln, sel);
		}
		// horosa_panel_ready_v1 配对起点:快捷栏「运限对齐今天」(纯本地,同 onChangeDirection 口径)。
		markInteractionStart('ziwei');
		this.setState({ luckSel: sel }, ()=>{ markPanelReady('ziwei'); });
	}

	// 快捷栏契约:原 6 个占星推运跨页键(主限/法达/小限/返照/合盘/星运)=跨页导航滥用,全撤;
	// 换成本页真动词(运限对齐/清运限)。笔记保留=本页唯一入口(页头无)。
	renderBottomQuickDock(){
		const hasChart = !!(this.state.result && this.state.result.chart);
		const hasLuck = (()=>{
			const sel = this.state.luckSel;
			return !!(sel && (sel.daxian || sel.liunian || sel.liuyue || sel.liuri || sel.liushi));
		})();
		return (
			<QuickDockBar
				page="ziwei"
				className="horosa-ziwei-quick-dock"
				hasResult={hasChart}
				extras={[
					{ key: 'luckToday', label: '运限对齐今天', icon: 'quickTransit', onClick: ()=>this.alignLuckToToday() },
					{ key: 'luckClear', label: '清除运限', icon: 'quickReturn', disabled: !hasChart || !hasLuck, onClick: ()=>{ markInteractionStart('ziwei'); this.setState({ luckSel: emptyLuckSel() }, ()=>{ markPanelReady('ziwei'); }); } },
					{ key: 'memo', label: '笔记', icon: 'quickNote', needsResult: false, onClick: ()=>this.openDrawer('memo') },
				]}
				dispatch={this.props.dispatch}
			/>
		);
	}

	renderZiWeiInfoPanel(infoData, directionDoms, tipheight){
		if(!infoData || infoData.rows.length === 0){
			return <div className="horosa-empty-hint">起盘后显示命盘信息</div>;
		}
		return (
			<div className="horosa-ziwei-meta-scroll horosa-astro-content-scroll">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">基本信息</div>
					{infoData.rows.map((row)=>(
						<div className="horosa-info-row" key={row[0]}>
							<span>{row[0]}</span>
							<strong>{row[1]}</strong>
						</div>
					))}
				</div>
				<div className="horosa-info-card horosa-ziwei-bazi-card">
					<div className="horosa-info-card-title">四柱</div>
					<div className="horosa-ziwei-bazi-grid">
						{infoData.bazi.map((item)=>(
							<div className="horosa-ziwei-bazi-cell" key={item.label}>
								<span>{item.label}</span>
								<strong>{item.value}</strong>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card horosa-ziwei-direction-card">
					<div className="horosa-info-card-title">行运大限</div>
					<div className="horosa-ziwei-direction-list">
						<Row>
							{directionDoms}
						</Row>
					</div>
				</div>
				<TipsBoard
					height={tipheight}
					value={this.state.tips}
					/>
			</div>
		);
	}

	// WP-H-2 极速化:重 wrapper sCU —— 全 props 机械浅比(函数型跳过,详 wrapperPropsEqual);
	// state 任一引用变照常重渲(setState 恒换引用,此比既完整又廉价)。
	// 收益:宿主因无关状态重渲时,本重组件整树不再白跑。关 chartSCU 开关 = 恒重渲旧行为。
	// horosa_ziwei_state_slice_v1:state 由「引用比」细化为「按键浅比 + 白名单剔无关键」。
	// 变化点仅一个:只有 indicator / cnt 变(render 不读它们)时不再整树重渲;其余任何 state 变化
	// (result/rules/luckSel/updating/tips/centerInfoVisible/rightTab/未知新键)行为与之前逐字一致。
	// kill-switch 同 chartSCU:关掉 → 回到「state 引用一变即重渲」的旧行为。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			if(!chartSCUEnabled()){
				return true;
			}
			if(ziweiStateAffectsRender(this.state, nextState)){
				return true;
			}
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再触发重新起盘
		this._lateZiHourUserOverrode = false; // v2.2.1: 同上 — 左栏改过 lateZiHourUseNextDay 后,全局事件不再触发重新起盘
		if(typeof window !== 'undefined'){
			this._dayBoundaryListener = (ev) => {
				if(dayBoundaryLockHeld(this, 'after23')) return;
				const v = ev && ev.detail ? ev.detail.after23NewDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.requestZiWei(this.props.fields);
				}
			};
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			this._lateZiHourListener = (ev) => {
				if(dayBoundaryLockHeld(this, 'lateZi')) return;
				const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.requestZiWei(this.props.fields);
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			// 纯显示层开关(杂曜/十二神)不进请求体,重新请求必被 requestDedupe 挡住;
			// 只递增一枚版本号并透传给 ZiWeiChart —— 唯一能让盘面真正重绘的通道。
			this._zwDisplayListener = (ev) => {
				if(this.unmounted){ return; }
				// 命主取法运行时切换:Java 盘(非本地引擎)就地重派生 —— chart 引用不变不改签名,
				// 恰由本次 rev 递增强制重绘中宫;本地引擎盘在下次重排时按 opts 取,不在此就地改
				// (观察盘 lifeHouseIndex 是移过的,就地重算会错基)。
				try{
					const d = ev && ev.detail;
					if(d && d.key === 'lifeMasterBy' && this.state.result && this.state.result.chart && !ziweiNeedsLocalEngine()){
						const c = this.state.result.chart;
						if(d.value === 'ming_branch'){ applyLifeMasterOption(c, 'ming_branch'); }
						else if(c.yearZi){
							// 切回生年支:交互路径显式恢复(applyLifeMasterOption 默认恒 no-op 保基线)
							const { LIFE_MASTER } = require('./data/ziweiTables');
							if(LIFE_MASTER[c.yearZi]){ c.lifeMaster = LIFE_MASTER[c.yearZi]; }
						}
					}
				}catch(e){ /* 派生失败不阻断重绘 */ }
				this.setState((s) => {
					const st = { zwDisplayRev: (s.zwDisplayRev || 0) + 1 };
					// 运限口径改档(小限顺逆/流年四化取干/流月起法/preset 批量套…)→ 已选运限快照
					// 整链重派生:luckSel 存的是点击时刻的 build 快照,口径变了不重派生就与按钮列表自相矛盾
					// (实测:改小限顺逆后芯片已按新口径,详情卡/叠宫层/金框/AI period 仍旧口径)。
					// rederiveLuckSel 幂等(口径未变时逐层值等)→ 全键触发不设白名单,新增口径键零登记成本。
					try{
						let c = this.state.result && this.state.result.chart;
						if(c && c.dualAlt && s.dualView === 'next'){ c = c.dualAlt; }
						if(c && s.luckSel){ st.luckSel = rederiveLuckSel(c, s.luckSel); }
					}catch(e2){ /* 重派生失败保留原选择,不阻断重绘 */ }
					return st;
				});
			};
			window.addEventListener(ZiWeiHelper.ZIWEI_DISPLAY_EVENT, this._zwDisplayListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
			// 盘面截图 / 挂载快照的按盘临时覆盖在途时本页首次挂载:覆盖还原后按当前字段重排一次(否则停在那张盘的随盘设置上)
			this._zwTempRestoredListener = () => {
				if(this.unmounted || !this.props.fields){ return; }
				this.requestZiWei(this.props.fields);
			};
			window.addEventListener(ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT, this._zwTempRestoredListener);
		}
		if(this.props.fields){
			this.requestZiWei(this.props.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		// R4-B2:反注册步进预取器(防卸载后闭包吃到死组件态)。
		if(this._ziweiStepPrefetcher){
			unregisterStepPrefetcher('ziwei', this._ziweiStepPrefetcher);
			this._ziweiStepPrefetcher = null;
		}
		if(typeof window !== 'undefined' && this._dayBoundaryListener){
			window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
		}
		if(typeof window !== 'undefined' && this._lateZiHourListener){
			window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
		}
		if(typeof window !== 'undefined' && this._zwDisplayListener){
			window.removeEventListener(ZiWeiHelper.ZIWEI_DISPLAY_EVENT, this._zwDisplayListener);
		}
		if(typeof window !== 'undefined' && this._zwTempRestoredListener){
			window.removeEventListener(ZIWEI_TEMP_OVERRIDE_RESTORED_EVENT, this._zwTempRestoredListener);
			this._zwTempRestoredListener = null;
		}
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示的盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(reload/rehydrate 未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	// 数据源与 requestZiWei 里 saveModuleAISnapshotLazy 同口径:result=this.state.result(盘渲染读的同一份),
	// params=genParams(this.props.fields)+period=buildPeriodFromLuckSel()(盘面当前所选运限,故 period 段随盘面保真)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== (this.props.techniqueScope || 'ziwei')){
			return;
		}
		const result = this.state ? this.state.result : null;
		if(!result || !result.chart){
			return;
		}
		let text = '';
		let params = null;
		try{
			params = this.genParams(this.props.fields);
			// 注入盘面当前所选运限(需求6A)：使「显示什么就导出什么」对运限也成立(此前实时导出不含 [运限])。
			const period = this.buildPeriodFromLuckSel();
			text = `${buildZiWeiSnapshotText(period ? { ...params, period } : params, result) || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			text = this.composeSnapshotText(text);
		}
		if(text){
			// 带本盘出生签名写槽(与惰性存同一份 meta):不带则刷新一次后槽失去签名,对话挂载认不出是这位命主、改走无头重算
			saveModuleAISnapshot(this.props.techniqueScope || 'ziwei', text, ziweiSnapshotMeta(params));
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	// 由 luckSel 单一真值源派生盘面渲染所需（需求1/3/5）：大限索引(运X)、最深运命宫(金框高亮)、
	// 四化滑窗层(末3层+自化开关)、长生左侧标签层(年/月/日/时)。本命/大限按 hua 本色(periodColor=null)，
	// 流年小限/流月/流日/流时按各层期色。
	buildLuckRender(chart){
		const sel = this.state.luckSel || emptyLuckSel();
		const yearGan = chart && chart.yearGan ? chart.yearGan : '';
		const win = ZiWeiHelper.luckSihuaWindow(sel, yearGan);
		const isHuaColored = (key)=> key === 'benming' || key === 'daxian';
		const sihuaLayers = win.layers.map((l)=>({
			key: l.key,
			gan: l.gan,
			// 流年层四化干消费期现算:盘面星徽与面板/快照三处恒同源(切档即追新)
			sihuaGan: ZiWeiHelper.effLayerSihuaGan(chart, l),
			periodColor: isHuaColored(l.key) ? null : ZWConst.ZWPeriodColor[l.key],
		}));
		// 小限叠宫层:开关开才插「限」标签层(默认关=零回归;快照/挂载链不经此,恒不含)。
		const labelLayers = ZiWeiHelper.luckLabelLayers(sel, ZiWeiHelper.zwShowXiaoxianLayer()).map((l)=>({
			prefix: l.prefix,
			mingIndex: l.mingIndex,
			color: ZWConst.ZWPeriodColor[l.key],
		}));
		// 稳定签名 key：派生数组每次 render 新建引用，重绘守卫不能用其做引用比较 → 用本 key（仅选择变才变）。
		const key = [
			sel.daxian ? sel.daxian.id : '',
			sel.liunian ? sel.liunian.id : '',
			sel.liuyue ? sel.liuyue.id : '',
			sel.liuri ? sel.liuri.id : '',
			sel.liushi ? sel.liushi.id : '',
		].join('|');
		return {
			dirIndex: sel.daxian ? sel.daxian.mingIndex : null,
			luckMingIndex: ZiWeiHelper.luckDeepestMingIndex(sel),
			sihuaLayers,
			// 自化常显:开关开=无视滑窗勾选恒显自化(默认关=原勾选行为)
			showZihua: win.showZihua || ZiWeiHelper.zwZihuaAlways(),
			labelLayers,
			// 流年神煞上盘用:选中流年的地支(绘制期替换判据;未选=null=恒不替换)。
			flowZhi: (sel.liunian && sel.liunian.zhi) || null,
			key,
		};
	}

	// luckSel → AI 快照 period（与挂载 record→period 同结构，经同一 buildZiweiPeriodLines 出文；需求6A，
	// 使「显示什么就导出什么」对运限也成立）。全空→null（不产 [运限] 段，与现状逐字一致）。
	buildPeriodFromLuckSel(){
		return periodFromLuckSel(this.state.luckSel);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 70px)'
		}else{
			height = height - 40
		}

		// 无盘时用模块级稳定空对象(原为每次 render 新建 {} → 下游引用比恒不等 → 白重绘)。
		let chart = this.state.result ? this.state.result.chart : ZW_EMPTY_CHART;
		// 晚子双盘(WP-8):当日盘为 primary、次日盘挂 chart.dualAlt;选「次日盘」则下游全用 dualAlt(luck/info/盘面一致)。
		const dualAlt = chart && chart.dualAlt ? chart.dualAlt : null;
		if(dualAlt && this.state.dualView === 'next'){ chart = dualAlt; }
		const luckRender = this.buildLuckRender(chart);
		let doms = this.genDirectionDom(chart);
		let infoData = buildZiWeiInfoData(chart, this.props.fields);

		let tipheight = 270;
		let docwid = getLayoutViewportWidth();
		if(docwid <= 1440){
			tipheight = 120;
		}

		// 童限/中限点选高亮:覆盖 luckMingIndex(金框),并入重绘 key(否则守卫认为盘未变不重画)。
		const effMingIndex = this.state.tonglianHi != null ? this.state.tonglianHi : luckRender.luckMingIndex;
		const effLuckKey = `${luckRender.key}|tl${this.state.tonglianHi == null ? '' : this.state.tonglianHi}`;

		return (
			<div className="horosa-ziwei-page horosa-astro-redesign horosa-ziwei-redesign">
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-ziwei-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-ziwei-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-ziwei-input-panel">
							{/* [择日宿主] 左栏插槽(主紫微页不传=零渲染) */}
							{typeof this.props.renderLeftExtra === 'function' ? this.props.renderLeftExtra() : null}
							<ZiWeiInput
								fields={this.props.fields}
								onFieldsChange={this.onFieldsChange}
								keepEngine={!!this.props.engineManagedByHost}
							/>
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-ziwei-chart-panel xq-chart-renderer xq-chart-renderer-ziwei" style={{ position: 'relative' }}>
							{this.state.updating && this.state.result ? <UpdatingBadge /> : null}
							{dualAlt ? (
								<div className="horosa-ziwei-dual-toggle" style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '4px 0' }}>
									{[['day', '当日盘'], ['next', '次日盘']].map(([k, lab])=>(
										<button key={k} type="button"
											onClick={()=>this.setState({ dualView: k, luckSel: emptyLuckSel(), tonglianHi: null })} /* 双盘宫位必错位(differ 判据),旧 luckSel 的 mingIndex 会把运限金框/运X/AI period 标到错宫 */
											style={{ padding: '3px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
												border: '1px solid var(--horosa-gold, #dab16f)',
												background: this.state.dualView === k ? 'var(--horosa-gold, #dab16f)' : 'transparent',
												color: this.state.dualView === k ? '#1a1a1a' : 'var(--horosa-gold, #dab16f)' }}>
											{lab}
										</button>
									))}
								</div>
							) : null}
							<div className="horosa-ziwei-chart-viewport" data-capture-chart-only>
								<ZiWeiChart
									value={chart}
									height="100%"
									zwDisplayRev={this.state.zwDisplayRev || 0}
									fields={this.props.fields}
									dirIndex={luckRender.dirIndex}
									luckMingIndex={effMingIndex}
									luckSihuaLayers={luckRender.sihuaLayers}
									luckShowZihua={luckRender.showZihua}
									luckLabelLayers={luckRender.labelLayers}
									luckFlowZhi={luckRender.flowZhi}
									luckKey={effLuckKey}
									indicate={this.indicate}
									rules={this.state.rules}
									onTipClick={this.onTipClick}
									onCenterInfoClick={this.openCenterInfo}
								/>
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-ziwei-info-panel">
							{/* 星阙金 W1 试点:XQTabs 自带 xq-tabs 基线(金 ink-bar 2px+三态字色);W2 全量收编 content-tabs 族 */}
						{/* horosa_freeze_subtabs_v1:受控 Tabs + 每面板 FreezeSubTab。
						    非激活面板在父组件重渲(切时间/改选项/点大限)时跳过 re-render;
						    冻结≠卸载 —— 已渲染过的面板保留 DOM/实例/滚动位置与展开态,切回即拿最新 children 渲一帧。*/}
						<Tabs activeKey={this.state.rightTab} onChange={this.onRightTabChange} tabPosition='top' className="horosa-content-tabs horosa-ziwei-tabs">
								<TabPane tab="命盘" key="info">
									<FreezeSubTab active={this.state.rightTab === 'info'}>
										{()=>this.renderZiWeiInfoPanel(infoData, doms, tipheight)}
									</FreezeSubTab>
								</TabPane>
								<TabPane tab="运限" key="luck">
									<FreezeSubTab active={this.state.rightTab === 'luck'}>
										{()=>(
											<ZWLuckPanel
												chart={chart}
												value={this.state.luckSel}
												onChange={this.onLuckSelChange}
												tonglianHi={this.state.tonglianHi}
												onTonglianHighlight={this.onTonglianHighlight}
												onAi={this.openAiAnalysis}
											/>
										)}
									</FreezeSubTab>
								</TabPane>
								<TabPane tab="格局" key="patterns">
									<FreezeSubTab active={this.state.rightTab === 'patterns'}>
										{()=>(
											<ZWPatternPanel patterns={this.state.result ? this.state.result.patterns : ZW_EMPTY_PATTERNS} />
										)}
									</FreezeSubTab>
								</TabPane>
								<TabPane tab="资料参考" key="2">
									<FreezeSubTab active={this.state.rightTab === '2'}>
										{()=>(
											<ZWRuleMain height={height} rules={this.state.rules} />
										)}
									</FreezeSubTab>
								</TabPane>
							</Tabs>
						</div>
						</div>
						{this.renderBottomQuickDock()}
						<Modal
							open={this.state.centerInfoVisible}
							title="命盘信息"
							footer={null}
							onCancel={this.closeCenterInfo}
							width={640}
							className="horosa-ziwei-center-info-modal"
						>
							{this.renderZiWeiInfoPanel(infoData, doms, tipheight)}
						</Modal>
					</div>
				</div>
		);
	}
}

export default ZiWeiMain;
