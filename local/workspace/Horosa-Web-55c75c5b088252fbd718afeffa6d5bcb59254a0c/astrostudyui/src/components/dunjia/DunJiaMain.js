// 奇门遁甲页(组件类在这里;模块级助手按职责拆在 main/ 下):options(起局选项缺省、排盘设置跨会话保留、盘面尺寸、
//   旧存档选项迁移与用神查表)→ pageState(视口、判读偏好、在线快照、取盘键、实例态记忆与恢复、择日选项、首屏预热)。
// 排盘引擎在 DunJiaCalc.js(另一个门面,实现在 calc/)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
// 组件方法同样按职责拆在 main/ 下(caseState · compute · board · inputPanel · rightPanel),类后 mixinMethods 挂回原型;构造、生命周期与 render 留在类里。
import { dayBoundaryLockHeld } from '../../utils/dayBoundaryLock';
import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { stepPrefetchEnabled } from '../../utils/perfFlags';
// R4-B2(horosa_prefetch_registry_v1):遁甲 stage-1 登记 + 本地漏斗 settle 武装。
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
import XQIcon from '../xq-icons';
import { castSourceKey } from '../../utils/derivedChartSource';
import {
} from '../../utils/localNongliAdapter';
import {
	fetchPreciseNongli,
	fetchPreciseJieqiSeed,
} from '../../utils/preciseCalcBridge';
import sealedImage from '../../assets/sealed.png';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import { needJieqiYearSeed } from './DunJiaCalc';
import { BAGONG_PALACE_ORDER } from './DunJiaBaGongRules';
import { DUNJIA_PAGE_SETTINGS, normalizeKenQimenOptions } from './main/options';
import { getViewportHeight, loadPatternInterpretationPreference, getRestorableDunJiaLiveState, syncedSexFromFields } from './main/pageState';
import { mixinMethods } from '../../utils/mixinMethods';
import { caseStateMethods } from './main/caseState';
import { computeMethods } from './main/compute';
import { boardMethods } from './main/board';
import { inputPanelMethods } from './main/inputPanel';
import { rightPanelMethods } from './main/rightPanel';
export { dunjiaFactoryOptions, DUNJIA_PAGE_SETTINGS, QIMEN_YONGSHEN_BASIC, QIMEN_YONGSHEN_LOOKUP, QIMEN_YONGSHEN_SHENGKE } from './main/options';
export { syncedSexFromFields, dunjiaZeriOptions, warmDunJiaStage1 } from './main/pageState';

class DunJiaMain extends Component {
	constructor(props){
		super(props);
		// [奇门择日] techniqueScope:独立奇门页缺省 'qimen',择日页宿主传 'qimenzeri'。
		// live 态/AI 快照槽/案例链/导出刷新事件全按 scope 隔离(keep-alive 双实例并存,不隔离必竞写)。
		this.scope = props.techniqueScope || 'qimen';
		const restoredLiveState = getRestorableDunJiaLiveState(this.scope, props.fields);
		// 复用 live 态时,**未被本页左栏改过**的日界两键以全局现值为准(改过的按 live 值,
		//   与「左栏最高权限」拍板一致);live 态记了 boundaryTouched 标记,缺省(旧 live 态)按未改过处理。
		const liveOpts = restoredLiveState && restoredLiveState.options ? { ...restoredLiveState.options } : null;
		if(liveOpts){
			const touched = (restoredLiveState && restoredLiveState.boundaryTouched) || {};
			if(!touched.after23NewDay){ delete liveOpts.after23NewDay; }
			if(!touched.lateZiHourUseNextDay){ delete liveOpts.lateZiHourUseNextDay; }
		}
		// 本会话 live 态优先(它本来就含本会话改过的值);没有 live 态 = 刚开软件 → 用上次亲手设的排盘口径
		const initialOptions = liveOpts
			? normalizeKenQimenOptions(liveOpts)
			: normalizeKenQimenOptions(DUNJIA_PAGE_SETTINGS.loadSaved());   // 独立遁甲页与奇门择日内嵌实例同用(奇门择日的工作台参数取自内嵌盘,扫描与显示同口径,见文件头)
		// 「性别」是标签型(不进起局与断法),但初值曾恒 1(男)、不随全局 fields.gender:
		//   载入女命主进奇门,命式显示「男」、「盘类=命盘 → 保存」写 gender=1。改同三式合一
		//   handleExternalFieldsSync:构造与外部 fields 变化时按 fields.gender(0/1)初始化 sex。
		{
			const fg = syncedSexFromFields(props.fields);
			if(fg !== null){ initialOptions.sex = fg; }
		}

		this.state = {
			loading: false,
			nongli: restoredLiveState ? restoredLiveState.nongli : null,
			displaySolarTime: restoredLiveState ? restoredLiveState.displaySolarTime : '',
			pan: restoredLiveState ? restoredLiveState.pan : null,
			// 屏上这张盘的起课签名(起课时刻 + 地点):取盘失败时据此判「同一课只改设置 → 留存 / 换了时刻地点 → 清掉」
			panSig: restoredLiveState ? castSourceKey(props.fields) : '',
			localFields: null,
			hasPlotted: !!(restoredLiveState && restoredLiveState.pan),
			rightPanelTab: 'overview',
			bagongPalace: BAGONG_PALACE_ORDER[0],
			showPatternInterpretation: loadPatternInterpretationPreference(),
			leftBoardWidth: 0,
			leftBoardHeight: 0,
			viewportHeight: getViewportHeight(),
			options: initialOptions,
			faRelatedPeople: restoredLiveState && Array.isArray(restoredLiveState.faRelatedPeople) ? restoredLiveState.faRelatedPeople : [],
			chartCategory: (restoredLiveState && restoredLiveState.pan && restoredLiveState.pan.options && restoredLiveState.pan.options.chartCategory) || 'shi',
			shuziInput: '',
		};

		this.unmounted = false;
		this.jieqiSeedPromises = {};
		this.jieqiYearSeeds = {};
		this.lastRestoredCaseId = null;
		this.lastRestoredChartId = null;
		this._yearGanCache = {};
		this.timeHook = {};
		this.lastNongliKey = restoredLiveState ? restoredLiveState.lastNongliKey : '';
		this.lastPanSignature = restoredLiveState ? restoredLiveState.lastPanSignature : '';
		this.pendingNongli = null;
		this.requestSeq = 0;
		this.panCache = new Map();
		this.resizeObserver = null;
		this.prefetchSeedTimer = null;
		this.onOptionChange = this.onOptionChange.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.prefetchStepSelect = this.prefetchStepSelect.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.genJieqiParams = this.genJieqiParams.bind(this);
		this.ensureJieqiSeed = this.ensureJieqiSeed.bind(this);
		this.prefetchJieqiSeedForFields = this.prefetchJieqiSeedForFields.bind(this);
		this.prefetchNongliForFields = this.prefetchNongliForFields.bind(this);
		this.resolveDisplaySolarTime = this.resolveDisplaySolarTime.bind(this);
		this.getContext = this.getContext.bind(this);
		this.requestNongli = this.requestNongli.bind(this);
		this.genParams = this.genParams.bind(this);
		this.recalc = this.recalc.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.restoreOptionsFromCurrentCase = this.restoreOptionsFromCurrentCase.bind(this);
		this.restoreFromCurrentChart = this.restoreFromCurrentChart.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.applyFaRelatedToPan = this.applyFaRelatedToPan.bind(this);
		this.getRelatedPeopleOptions = this.getRelatedPeopleOptions.bind(this);
		this.onRelatedPeopleChange = this.onRelatedPeopleChange.bind(this);
		this.onChartCategoryChange = this.onChartCategoryChange.bind(this);
		this.captureLeftBoardHost = this.captureLeftBoardHost.bind(this);
		this.handleWindowResize = this.handleWindowResize.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.restoreOptionsFromCurrentCase();
				this.restoreFromCurrentChart();
				if(fields){
					this.setState({
						localFields: fields,
					});
					this.prefetchJieqiSeedForFields(fields);
					this.prefetchNongliForFields(fields);
				}
			};
			// R4-B2(horosa_prefetch_registry_v1):只登记 stage-1(确定性历法计算)。
			// 🔴 绝不预取 /qimen/pan 本身:它吃 stage-1 结果 + 组件态(流派/排盘法),
			//    强行预取要么构不出同键、要么把中间态钉进缓存。stage-1 暖了,用户点下一步时
			//    pan 的输入即时可得(pan 层另有草稿链负责)。
			// ⚠️ 择日页内嵌遁甲盘(techniqueScope 化)不重复登记:登记键恒 'dunjia'(主奇门 tab),
			//    zeri 在 NO_ARM_TABS,武装线不会驱动内嵌实例。
			if(stepPrefetchEnabled() && (!this.scope || this.scope === 'qimen')){
				this._dunjiaStepPrefetcher = (steppedFields)=>{
					if(this.unmounted || !steppedFields){
						return [];
					}
					const tasks = [];
					let params = null;
					try{
						params = this.genParams(steppedFields);
					}catch(e){
						params = null;
					}
					if(params){
						tasks.push({
							name: 'dunjia:nongli',
							path: '/nongli/time',
							run: ()=> fetchPreciseNongli(params),
						});
					}
					// 节气种子:与 requestNongli 同一 fixedOptions 口径(四个 GanZhiType 钉死),
					// 否则 key 不同 = 白预取。仅在该流派真需要种子时才发。
					try{
						const fixedOptions = {
							...this.state.options,
							jieQiType: 1,
							yearGanZhiType: 2,
							monthGanZhiType: 1,
							dayGanZhiType: 1,
						};
						if(needJieqiYearSeed(fixedOptions) && steppedFields.date && steppedFields.date.value){
							const year = parseInt(steppedFields.date.value.format('YYYY'), 10);
							const seedParams = (year && !Number.isNaN(year)) ? this.genJieqiParams(steppedFields, year) : null;
							if(seedParams){
								tasks.push({
									name: 'dunjia:jieqiseed',
									path: '/jieqi/year',
									run: ()=> fetchPreciseJieqiSeed(seedParams),
								});
							}
						}
					}catch(e){ /* 种子构参失败静默跳过 */ }
					return tasks;
				};
				registerStepPrefetcher('dunjia', this._dunjiaStepPrefetcher);
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
		this._after23BoundaryUserOverrode = false; // 用户改过左栏下拉后,全局事件不再覆盖(用户拍板:左栏最高权限)
		this._lateZiHourUserOverrode = false; // v2.2.1: 同上 — 时柱开关也尊重左栏覆盖
		if(typeof window !== 'undefined'){
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
		}
		this.restoreOptionsFromCurrentCase(true);
		this.restoreFromCurrentChart(true);
		window.addEventListener('resize', this.handleWindowResize);
		this.handleWindowResize();
		this.prefetchJieqiSeedForFields(this.state.localFields || this.props.fields);
		this.prefetchNongliForFields(this.state.localFields || this.props.fields);
		// 挂载即预取当前草稿时刻 pan:本会话首次「起局」也 ≈ 瞬间(链同 A4,失败静默)
		this.prefetchQimenPanForFields(this.state.localFields || this.props.fields, null);
	}

	componentDidUpdate(prevProps){
		this.restoreOptionsFromCurrentCase();
		this.restoreFromCurrentChart();
		// 取数期间排下的外部起盘:取数落地(loading 清掉)后补起最后一次
		if(this._queuedExternalPlot && !this.state.loading && !this.unmounted){
			const queued = this._queuedExternalPlot;
			this._queuedExternalPlot = null;
			this.applyExternalPlot(queued);
		}
		// 外部 fields.gender 变化(载入命盘/顶栏改性别)→ 同步标签型 sex(本页 onGenderChange
		//   反向写全局时两值已相等,此处不动,不成环)。
		const prevG = syncedSexFromFields(prevProps && prevProps.fields);
		const nextG = syncedSexFromFields(this.props.fields);
		if(nextG !== null && nextG !== prevG){
			this.syncSexFromFields(nextG);   // 程序改动:不走「用户亲手改 → 落盘」
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		// R4-B2:反注册步进预取器(防卸载后闭包吃到死组件态)。
		if(this._dunjiaStepPrefetcher){
			unregisterStepPrefetcher('dunjia', this._dunjiaStepPrefetcher);
			this._dunjiaStepPrefetcher = null;
		}
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
			if(this._dayBoundaryListener){
				window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			}
			if(this._lateZiHourListener){
				window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			}
		}
		window.removeEventListener('resize', this.handleWindowResize);
		if(this.prefetchSeedTimer){
			clearTimeout(this.prefetchSeedTimer);
			this.prefetchSeedTimer = null;
		}
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = '100%';
		}else{
			height = Number(height);
			height = Number.isFinite(height) && height > 0 ? height : 760;
		}
		const pageHeight = this.props.height ? '100%' : height;
		return (
			<div className="horosa-dunjia-page horosa-astro-redesign horosa-dunjia-redesign" style={{ height: pageHeight, minHeight: 0, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-dunjia-redesign-layout">
					{/* [连续调整不打断] 原 <Spin spinning={loading}> 满屏压暗遮罩已撤(用户实告「加载这一大片
					    白色全屏遮挡也该去掉,只留中间盘右上角的加载中」):重算期旧盘 keep-stale 保留可见,
					    仅中栏右上角一枚非阻塞小转圈(与三式合一同款,复用全站 workspace-updating 观感,
					    dunjia-updating 变体只改定位为中栏内 absolute)。奇门择日内嵌的正是本组件,
					    故择日页同步生效。 */}
					<div className="horosa-astro-redesign-grid horosa-dunjia-redesign-grid">
							<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-dunjia-input-panel">
								{this.renderInputPanel()}
							</div>
							<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-dunjia-chart-panel xq-chart-renderer xq-chart-renderer-qimen">
								{this.state.loading ? (
									<div className="horosa-workspace-updating horosa-dunjia-updating">重算中…</div>
								) : null}
								<div ref={this.captureLeftBoardHost} className="horosa-dunjia-board-host">
									{this.renderBoard()}
								</div>
							</div>
							<div className="horosa-inspector-panel horosa-astro-content-panel horosa-dunjia-info-panel">
								<div className="horosa-side-panel-heading horosa-dunjia-info-heading">
									<div>
										<div className="horosa-side-panel-title">遁甲信息</div>
										<div className="horosa-side-panel-subtitle">概览、神煞与八宫详解</div>
									</div>
								</div>
								{this.renderRight()}
							</div>
					</div>
					{this.renderQuickDock()}
				</div>
			</div>
		);
	}
}
mixinMethods(DunJiaMain, caseStateMethods, computeMethods, boardMethods, inputPanelMethods, rightPanelMethods);   // 方法按职责拆在 ./main/ 下(见各文件头),挂回原型

// 用神取用速查的静态数据(基本用神 / 分类取用 / 取用生克),供「三式合一」遁甲页用神子tab复用同款表。

export default DunJiaMain;
