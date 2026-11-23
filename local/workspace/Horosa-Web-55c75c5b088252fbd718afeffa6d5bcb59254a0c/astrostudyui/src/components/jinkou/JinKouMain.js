// 金口诀页(组件类在这里;模块级助手按职责拆在 main/ 下):runYear(出生资料与行年、本命属相 / 虚岁派生)
//   · snapshot(AI 快照正文与快照元信息)· pageState(签名比较、深拷贝、起课缓存与排盘设置跨会话保留)。
// 排盘引擎在 JinKouCalc.js(另一个门面,实现在 calc/)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
// 组件方法同样按职责拆在 main/ 下(inputs · requests · caseState · inputPanel · rightPanel),类后 mixinMethods 挂回原型;构造、生命周期与 render 留在类里。
import { dayBoundaryLockHeld } from '../../utils/dayBoundaryLock';
import { Component } from 'react';
import { timeGeoFieldsChanged } from '../../utils/pendingTimeDraft';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { ZSList, ZhangSheng, } from '../liureng/LRZhangSheng';
import DateTime from '../comp/DateTime';
import JinKouChart from './JinKouChart';
import { castChartFor } from '../../utils/derivedChartSource';
import { buildBirthFields, resolveDisplayRunYear, getAppliedBirth } from './main/runYear';
import { mapObjToRows } from './main/snapshot';
import { JINKOU_PAGE_SETTINGS } from './main/pageState';
import { mixinMethods } from '../../utils/mixinMethods';
import { inputMethods } from './main/inputs';
import { requestMethods } from './main/requests';
import { caseStateMethods } from './main/caseState';
import { inputPanelMethods } from './main/inputPanel';
import { rightPanelMethods } from './main/rightPanel';
import { JINKOU_BIRTH_GANZI_MEM, JINKOU_GODS_INFLIGHT, JINKOU_GODS_MEM, JINKOU_RUNYEAR_INFLIGHT, JINKOU_RUNYEAR_MEM } from './main/pageState';
import { techniqueResultCacheEnabled } from '../../utils/perfFlags';
export { resolveDisplayRunYear, deriveBenMingFromRunYear, deriveXuSuiFromRunYear } from './main/runYear';
export { buildJinKouSnapshotText } from './main/snapshot';
export { JINKOU_PAGE_SETTINGS } from './main/pageState';

class JinKouMain extends Component{
	// 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props) {
		super(props);
		const now = new DateTime();
		const birth = buildBirthFields(this.props.fields, now);

		this.state = {
			birth: birth,
			calcBirth: birth,
			liureng: null,
			runyear: null,
			wuxing: '土',
			// 贵神体系恒 0（六壬法）：左栏无此控件，参考典籍亦无「遁甲法/星占法贵人」之目。
			// 流派差异走「贵人昼夜表」(schoolGuiTable)。此键只为兼容旧事盘档与 AI 挂载设置而留。
			guireng: 0,
			// 专题起式（定局法）：未选＝主课不受影响。
			// 本命属相与行年虚岁不入 state —— 由「问测人出生时间」经 deriveBenMing/deriveXuSui 现算，
			// 单一真值源，避免手填值与出生档不一致时谁说了算的问题。
			topicKey: '',
			shiJianKind: '',
			// 合占扣题（G6/E1-3）：引擎早已支持七类扣题与三档时段，此前无 UI 入口，
			// 右栏「所问」恒「未限定」、「时段」恒「常规」，七个分类分支页面永不可达。
			askKey: '',
			timeScope: 'default',
			// 十二长生五行默认跟随日干；用户一旦手选即置 false，此后重排不再覆写。
			wuxingAuto: true,
			diFenSource: 'zhi',
			diFenSourceInput: '',
			// 参考页赋文折叠态（纯展示，不入装配签名、不随档）
			fuwenOpen: {},
			// 金口诀行年（旬法）虚岁；与既有干支流年并存，空则不产出。
			diFen: '子',
			diFenAuto: true,
			yueJiang: 'auto',
			zhanShi: 'auto',
			// 排盘流派(P0-1)：默认中气换将/实务派贵人/地盘起贵神/阳盘 → 与现有后端盘零回归。
			// 上次亲手设的排盘流派 / 时间基准(没保存过 = schema 缺省 = 原先的缺省,零回归)
			...JINKOU_PAGE_SETTINGS.load(),
			jinkouPan: null,
			jinkouError: '',
			rightPanelTab: 'overview',
			calcFields: null,
			calcChart: null,	// 这一课的底盘(与 calcFields / liureng 同一次落定;对不上起课时刻的主盘不进来)
			calcIsDiurnal: null,
		};

		this.unmounted = false;
		// horosa_kentang_result_cache_v1:命中模块级 LRU(切页往返 0 请求);关闸=每实例独立(旧行为)。
		const jkShareCache = techniqueResultCacheEnabled();
		this.birthYearGanZiCache = jkShareCache ? JINKOU_BIRTH_GANZI_MEM : {};
		// 金口数据装配缓存(单槽 last-result):render() 每次都调 assembleJinKouData→buildJinKouData(引擎)。
		// 切右栏 tab(rightTab/rightPanelTab/analysisTab/auxTab)只改无关 state,却让引擎整盘重跑。
		// 按「装配实际消费的全部输入(liureng/backendPan 引用 + 各流派/地分/贵神/月将/盘式开关)」做签名,
		// 签名全等 → 复用上次实例(byte-perfect:同输入必同输出);任一变 → 真重算。kill-switch 复用 chartDrawGuard 闸。
		this._jinkouDataCache = null;
		this.godsCache = jkShareCache ? JINKOU_GODS_MEM : new Map();
		this.godsInflight = jkShareCache ? JINKOU_GODS_INFLIGHT : new Map();
		this.runYearServerCache = jkShareCache ? JINKOU_RUNYEAR_MEM : new Map();
		this.runYearServerInflight = jkShareCache ? JINKOU_RUNYEAR_INFLIGHT : new Map();

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.prefetchStepSelect = this.prefetchStepSelect.bind(this);
		this.onBirthChange = this.onBirthChange.bind(this);
		this.onWuXingChange = this.onWuXingChange.bind(this);
		this.onDiFenChange = this.onDiFenChange.bind(this);
		this.onYueJiangChange = this.onYueJiangChange.bind(this);
		this.onZhanShiChange = this.onZhanShiChange.bind(this);
		this.onSchoolChange = this.onSchoolChange.bind(this);
		this.assembleJinKouData = this.assembleJinKouData.bind(this);
		this.onTimeBasisChange = this.onTimeBasisChange.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.genWuXingDoms = this.genWuXingDoms.bind(this);
		this.genGodsParams = this.genGodsParams.bind(this);
		this.genRunYearParams = this.genRunYearParams.bind(this);
		this.requestGods = this.requestGods.bind(this);
		this.requestRunYear = this.requestRunYear.bind(this);
		this.requestBirthYearGanZi = this.requestBirthYearGanZi.bind(this);
		this.saveJinKouSnapshot = this.saveJinKouSnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.renderInfoTable = this.renderInfoTable.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields, chartObj)=>{
				if(this.unmounted){
					return;
				}
				this.requestGods(fields || this.props.fields, chartObj);
			};
		}
	}

	componentDidMount(){
		this.unmounted = false;
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再触发重新起课
		this._lateZiHourUserOverrode = false; // v2.2.1: 同款时柱开关局部覆盖语义
		if(typeof window !== 'undefined'){
			// v2.2.1: setTimeout 0 延迟到下一 macrotask,让 dva 的 syncFromGlobal subscription 先把
			// fields.{after23NewDay,lateZiHourUseNextDay}.value 更新到 store + React 把新 props 透给本组件,再 fetch。
			// 否则 this.props.fields 在 listener 同步触发时仍是旧 snapshot,fetch 用的还是旧值,全局开关切了不生效。
			this._dayBoundaryListener = (ev) => {
				if(dayBoundaryLockHeld(this, 'after23')) return;
				const v = ev && ev.detail ? ev.detail.after23NewDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					setTimeout(() => {
						if(this.unmounted) return;
						this.requestGods(this.props.fields);
					}, 0);
				}
			};
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			this._lateZiHourListener = (ev) => {
				if(dayBoundaryLockHeld(this, 'lateZi')) return;
				const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					setTimeout(() => {
						if(this.unmounted) return;
						this.requestGods(this.props.fields);
					}, 0);
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.restoreFromCurrentCase(true)){
			return;
		}
		if(this.props.fields){
			this.requestGods(this.props.fields);
		}
	}

	componentDidUpdate(prevProps){
		// 没点「确定」的时间草稿:fields 从外面换了(载入别的盘 / 此刻起课)就作废(与六壬同)
		if(prevProps && timeGeoFieldsChanged(prevProps.fields, this.props.fields)){
			this.pendingFields = null;
		}
		this.restoreFromCurrentCase();
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(typeof window !== 'undefined' && this._dayBoundaryListener){
			window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
		}
		if(typeof window !== 'undefined' && this._lateZiHourListener){
			window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
		}
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 760;
		}else{
			height = height - 20;
		}

		let chartHeight = height;
		if(typeof chartHeight !== 'number'){
			chartHeight = 760;
		}

		// 盘面画「这一课」的底盘(与课同一次落定);还没起过课时,主盘与当前时刻同一刻才拿来画
		const chartObj = this.state.calcFields ? this.state.calcChart : castChartFor(this.props.value, this.props.fields);
		const chart = chartObj ? this.jkChartFor(chartObj.chart) : {};
		const chartFields = this.state.calcFields ? this.state.calcFields : this.props.fields;
		const appliedBirth = getAppliedBirth(this.state);
		const displayRunYear = resolveDisplayRunYear(this.state.runyear, appliedBirth, chartFields);
		const jinkouData = this.assembleJinKouData(this.state.liureng, this.state.jinkouPan);
		const wxdoms = this.genWuXingDoms();

		const godsZiRows = this.state.liureng ? mapObjToRows(this.state.liureng.godsZi) : [];
		const godsYearRows = this.state.liureng && this.state.liureng.godsYear ? mapObjToRows(this.state.liureng.godsYear.taisui1) : [];
		// 十二长生：优先取引擎产出的 phaseTable（土之长生随「土长生」流派：申/寅），
		// 引擎未就绪时回落共用 wxphase（＝默认水土同宫，与改造前逐字一致）。
		const phaseTable = jinkouData && jinkouData.phaseTable ? jinkouData.phaseTable : null;
		const zsRows = ZSList.map((name)=>{
			const fromEngine = phaseTable ? phaseTable[name] : '';
			const fallback = ZhangSheng.wxphase[`${this.state.wuxing}_${name}`];
			return {
				key: name,
				value: fromEngine || fallback || '—',
			};
		});
		const roleRefRows = [{
			key: '四、人元',
			value: '尊、客、天、君、祖、外',
		}, {
			key: '三、贵神',
			value: '上、主、宰相、臣、父、官禄',
		}, {
			key: '二、月将',
			value: '中、己身、妻财、亲戚、内',
		}, {
			key: '一、地分',
			value: '下、田宅、子孙、奴仆、鞍马、六畜',
		}];

		return (
				<div className={`horosa-jinkou-page horosa-astro-redesign horosa-jinkou-redesign${this.props.hideQuickDock ? ' horosa-jinkou-embedded' : ''}`} style={{ height: height, minHeight: height, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-jinkou-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-jinkou-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-jinkou-input-panel">
							{this.renderInputPanel(wxdoms)}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-jinkou-chart-panel xq-chart-renderer xq-chart-renderer-jinkou">
							<div className="horosa-jinkou-board-host">
								<JinKouChart
									value={chart}
									liureng={this.state.liureng}
									runyear={displayRunYear}
									gender={appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : -1}
									zhangshengElem={this.state.wuxing}
									guireng={this.state.guireng}
									jinkouData={jinkouData}
									height={chartHeight - 22}   /* 盘按宿主高画;比设计尺寸(JinKouPanChart 的 JK_DESIGN_MIN_*)小时整体等比缩小,不再撑高 + 中栏滚动 */
									fields={chartFields}
								/>
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-jinkou-info-panel">
							<div className="horosa-side-panel-heading horosa-jinkou-info-heading">
								<div>
									<div className="horosa-side-panel-title">金口诀信息</div>
									<div className="horosa-side-panel-subtitle">概览、四位与神煞</div>
								</div>
							</div>
							{this.renderRightPanel(jinkouData, displayRunYear, appliedBirth, chartFields, godsZiRows, godsYearRows, zsRows, roleRefRows)}
						</div>
					</div>
					{!this.props.hideQuickDock && this.renderBottomQuickDock()}
				</div>
			</div>
		);
	}
}
mixinMethods(JinKouMain, inputMethods, requestMethods, caseStateMethods, inputPanelMethods, rightPanelMethods);   // 方法按职责拆在 ./main/ 下(见各文件头),挂回原型

export default JinKouMain;
