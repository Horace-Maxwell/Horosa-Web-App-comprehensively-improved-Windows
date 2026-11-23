// 六爻页(组件类在这里;模块级助手按职责拆在 main/ 下):gua(卦名与爻文字、成卦、按时间 / 手录起卦)
//   → snapshot(旺衰与结构分析行、卦辞取数、AI 快照正文与排盘设置跨会话保留)。
// 组件方法也按职责拆在 main/ 下,类后 mixinMethods 挂回原型:panels(左右栏与弹窗渲染)· caseState(事盘回灌、设置改值、存案)
//   · cast(起卦各法、取农历与卦辞、逐爻翻动)。生命周期与 render 留在类里。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { dayBoundaryLockHeld } from '../../utils/dayBoundaryLock';
import { Component } from 'react';
import { watchChartAppearance } from '../../utils/chartDrawGuard';
import { createSignatureMemo } from '../../utils/memoBySignature';
import { XQStageEmpty } from '../xq-ui';
import GuaZhanChart from './GuaZhanChart';
import { normalizeLiuyaoSettings, loadPersistedLiuyaoSettings } from '../gua/liuyaoSchools';
import { saveModuleAISnapshotLazy } from '../../utils/moduleAiSnapshot';
import XQIcon from '../xq-icons';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
// 最小尺寸是屏幕可读意图(物理 px),壳缩放 z 下按 1/z 折算成布局 px;z=1 恒等。
import { visualFloorPx } from '../../utils/zoomDomain';
import { buildGuaSnapshotText, GUAZHAN_PAGE_SETTINGS } from './main/snapshot';
import { mixinMethods } from '../../utils/mixinMethods';
import { panelMethods } from './main/panels';
import { caseStateMethods } from './main/caseState';
import { castMethods } from './main/cast';
export { buildTimeGua, buildLinesGua } from './main/gua';
export { analyzeLiuyaoState, liuyaoStructLines, guaDescIdsOf, fetchGuaDescByIds, withGuaDesc, buildGuaSnapshotText, GUAZHAN_PAGE_SETTINGS } from './main/snapshot';

class GuaZhanMain extends Component{
	constructor(props) {
		super(props);

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.genYao = this.genYao.bind(this);
		this.randomYao = this.randomYao.bind(this);
		this.randomGua = this.randomGua.bind(this);
		this.genGua = this.genGua.bind(this);
		this.genGua64OptDom = this.genGua64OptDom.bind(this);
		this.changeGua = this.changeGua.bind(this);
		this.filterGua = this.filterGua.bind(this);
		this.getCurrentGua = this.getCurrentGua.bind(this);
		this.setupYao = this.setupYao.bind(this);
		this.emptyYao = this.emptyYao.bind(this);
		this.getYaoColor = this.getYaoColor.bind(this);
		this.genParams = this.genParams.bind(this);
		this.genTimeGua = this.genTimeGua.bind(this);
		this.clickTimeGua = this.clickTimeGua.bind(this);
		this.genGua8Doms = this.genGua8Doms.bind(this);
		this.upGuaIdxChanged = this.upGuaIdxChanged.bind(this);
		this.downGuaIdxChanged = this.downGuaIdxChanged.bind(this);
		this.custGuaDongYaoChanged = this.custGuaDongYaoChanged.bind(this);
		this.numGuaDongYaoChanged = this.numGuaDongYaoChanged.bind(this);
		this.numberChanged = this.numberChanged.bind(this);
		this.clickCustGua = this.clickCustGua.bind(this);
		this.clickNumGua = this.clickNumGua.bind(this);
		this.clickYarrowGua = this.clickYarrowGua.bind(this);
		this.genFields = this.genFields.bind(this);
		this.dongyaoChanged = this.dongyaoChanged.bind(this);
		this.getDongYaos = this.getDongYaos.bind(this);
		this.fillYaoGods = this.fillYaoGods.bind(this);
		this.getGuasId = this.getGuasId.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.requestGuaDescReturn = this.requestGuaDescReturn.bind(this);
		this.requestGuaDesc = this.requestGuaDesc.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.navigateFeature = this.navigateFeature.bind(this);
		this.getLiuyaoAnalysis = this.getLiuyaoAnalysis.bind(this);
		this.changeLiuyaoPreset = this.changeLiuyaoPreset.bind(this);
		this.changeLiuyaoOption = this.changeLiuyaoOption.bind(this);
		this.changeLiuyaoSelection = this.changeLiuyaoSelection.bind(this);
		this.changeLiuyaoRelatedCard = this.changeLiuyaoRelatedCard.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		this.state = {
			yao: this.emptyYao(),
			btnDisabled: [false, false, false, false, false, false],
			btnName: [
				'随机一爻', '随机二爻', '随机三爻', '随机四爻', '随机五爻', '随机六爻'
			],
			btnGenGua: '整卦随机',
			currentGua: null,
			// 起卦来源:'time'=时间卦(随时间派生,改时间应重起);其余=一次性成卦(手摇/蓍草/报数/自定义/直选/随机),
			// 改时间/地点/日界只应刷新干支(日辰月建旬空神煞),绝不可重摇 —— 「起出即冻结」。
			guaOrigin: 'time',
			nongli: null,
			custGuaDongYao: GUAZHAN_PAGE_SETTINGS.load().custGuaDongYao,   // 上次亲手选的动爻取法(没存过 = 附加时辰)
			numGuaDongYao: GUAZHAN_PAGE_SETTINGS.load().numGuaDongYao,
			upGuaIdx: null,
			downGuaIdx:null,
			number: null,
			guaDesc: null,
			rightPanelTab: 'overview',
			shenshaModalOpen: false,
			liuyaoSettings: loadPersistedLiuyaoSettings() || normalizeLiuyaoSettings(null),
		};
		this._liuyaoMemo = createSignatureMemo(4);

		this.unmounted = false;
		this.lastRestoredCaseId = null;
		this.timeHook = {};
		this.colorIndex = 0;
		this.periodTask = null;
		this.guaPeriodTask = null;

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.restoreFromCurrentCase();
			};
		}
	}

	// 手动/尾包起卦入口(LiuYaoCastPad 归一产物):lines=[0/1]×6(初爻在前),
	// moving=动爻位(1-6);装配流程与 clickYarrowGua 逐行同(仅爻源不同)。
	onManualCast = ({ lines, moving })=>{
		this.stopFlipping();
		let yao = this.emptyYao();
		for(let i = 0; i < 6; i++){
			yao[i].value = lines[i];
			yao[i].change = (moving || []).indexOf(i + 1) >= 0;
		}
		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);
		let flds = this.genFields();
		this.requestNongli(flds, ()=>{
			this.setState({ yao: yao, currentGua: guaidx, guaOrigin: 'cast' }, ()=>{ this.requestGuaDesc(); });
		});
	};

	// 重 wrapper sCU(照 BaZi/ZiWeiMain 既有范式):全 props 机械浅比(函数型视为恒等,
	// 详 wrapperPropsEqual;开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲
	// (setState 恒换引用)。收益:激活态下宿主无关 dispatch 不再整树白跑本重组件。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}
	// 改爻快捷键:数字 1-6 翻对应爻动/静(走既有 dongyaoChanged 链)。
	// 守卫:开关开+无修饰键+焦点不在输入类控件(input/textarea/select/富文本)。
	handleYaoHotkey = (e) => {
		const s = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		if(!s.yaoHotkeys){ return; }
		if(this.isFlipping()){ return; }
		if(e.ctrlKey || e.metaKey || e.altKey){ return; }
		const t = e.target;
		const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
		if(tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)){ return; }
		const n = parseInt(e.key, 10);
		if(!(n >= 1 && n <= 6)){ return; }
		const idx = n - 1;
		const cur = [];
		(this.state.yao || []).forEach((y, i)=>{ if(y && y.change){ cur.push(i); } });
		const next = cur.indexOf(idx) >= 0 ? cur.filter((i)=>i !== idx) : cur.concat([idx]);
		this.dongyaoChanged(next);
	};

	componentDidMount(){
		window.addEventListener('keydown', this.handleYaoHotkey);
		this.unmounted = false;
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再触发重新计算
		this._lateZiHourUserOverrode = false; // v2.2.1: 同款时柱开关局部覆盖语义
		this.restoreFromCurrentCase(true);
		if(typeof window !== 'undefined'){
			this._dayBoundaryListener = (ev) => {
				if(dayBoundaryLockHeld(this, 'after23')) return;
				const v = ev && ev.detail ? ev.detail.after23NewDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.onTimeGeoChanged(this.props.fields);
				}
			};
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			this._lateZiHourListener = (ev) => {
				if(dayBoundaryLockHeld(this, 'lateZi')) return;
				const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.onTimeGeoChanged(this.props.fields);
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		// 主题(亮↔暗)切换:爻的 .color 存的是取盘时的 AstroColor.Stroke(随主题的墨色)。切主题后不刷 → 爻线用旧墨色
		// (如暗色墨落在亮底上看不清,且与六亲名的新墨色对不上,用户实测「爻颜色切换后不对」)。观察属性,变则刷成当前墨色。
		this._detachAppearance = watchChartAppearance(() => {
			if(this.unmounted){ return; }
			this.setState((prev) => ({ yao: (prev.yao || []).map((y) => (y && y.value >= 0 ? { ...y, color: this.getYaoColor() } : y)) }));
		});
		// WP-6:预热《断易天机》断语库(异步 chunk),使 AI 快照同步路径(zhanleiLines 有界摘要)能取到缓存。
		import('../gua/data/liuyaoDoctrineCache').then((m) => { if(m && m.loadDoctrine){ m.loadDoctrine(); } }).catch(() => {});
	}

	componentDidUpdate(prevProps, prevState){
		this.restoreFromCurrentCase();
		if(prevProps.fields !== this.props.fields
			|| prevState.currentGua !== this.state.currentGua
			|| prevState.yao !== this.state.yao
			|| prevState.nongli !== this.state.nongli
			|| prevState.guaDesc !== this.state.guaDesc
			|| prevState.liuyaoSettings !== this.state.liuyaoSettings){
			// 翻动中每帧都变:卦未定不写快照(停下收尾后再写)。断卦设置的落盘不在这里(只在亲手改时,见 setLiuyaoSettingsByUser)
			if(!this.isFlipping()){
			const fields = this.props.fields;
		const state = this.state;
		saveModuleAISnapshotLazy('guazhan', ()=>buildGuaSnapshotText(fields, state));
			}
		}
	}

	componentWillUnmount(){
		window.removeEventListener('keydown', this.handleYaoHotkey);
		this.unmounted = true;
		// 摇卦/周期动画 interval:用户在动画态直接切走技法时这里是唯一的清理出口,
		// 不清则 interval 持续 setState 打已卸载组件(告警刷屏+闭包持组件泄漏)。
		if(this.guaPeriodTask !== null){
			clearInterval(this.guaPeriodTask);
			this.guaPeriodTask = null;
		}
		if(this.periodTask !== null){
			clearInterval(this.periodTask);
			this.periodTask = null;
		}
		if(this._detachAppearance){ this._detachAppearance(); this._detachAppearance = null; }
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
			height = 760
		}else{
			height = height - 20
		}

		let chartObj = this.props.value;
		let chart = chartObj ? chartObj.chart : {};

		// 中栏 d3 的六神随「六神」开关:关则剥离 god → 中盘不画六神(令中盘也随设置变)
		const _liuSet = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		let chartYao = this.fillYaoGods(this.state.yao);
		if(!_liuSet.sixGods && Array.isArray(chartYao)){ chartYao = chartYao.map((y)=>({ ...y, god: null })); }

		let opts = this.genGua64OptDom();

		let upopts = this.genGua8Doms();
		let downopts = this.genGua8Doms();

		let dyvalues = this.getDongYaos();
		let yao = this.fillYaoGods(this.state.yao);

		let guadesc = this.state.guaDesc;
		// 还没起卦时中栏给一句居中的提示,不画一张空盘。逐爻随机(一爻一爻起)时六爻没齐就没有本卦,
		// 但已落定 / 正在翻动的爻要照常一爻一爻长出来 —— 只要有一爻有值就画盘。
		const hasGua = (this.state.currentGua !== null && this.state.currentGua !== undefined)
			|| (this.state.yao || []).some((y)=>y && y.value >= 0);

		return (
			<div className="horosa-guazhan-page horosa-astro-redesign horosa-guazhan-redesign" style={{ height: height, minHeight: height, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-guazhan-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-guazhan-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-guazhan-input-panel">
							{this.renderInputPanel(opts, upopts, downopts, dyvalues)}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-guazhan-chart-panel xq-chart-renderer xq-chart-renderer-liuyao">
							{/* 流派/卦序/用神/卦身 已并入中栏盘内标题(GZChart.drawTitle),移除左侧冗余浮层 */}
							<div className="horosa-guazhan-board-host">
						{hasGua ? (
						<GuaZhanChart
							value={chart}
									height={Math.max(visualFloorPx(560), height - 22)}
							fields={this.props.fields}
							nongli={this.state.nongli}
							yao={chartYao} analysis={this.getLiuyaoAnalysis()}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
						/>
						) : (
							<XQStageEmpty hint="左栏「快捷起卦」或下方快捷功能都可以起卦">起卦后显示卦盘</XQStageEmpty>
						)}
						</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-guazhan-info-panel">
							<div className="horosa-side-panel-heading horosa-guazhan-info-heading">
								<div>
									<div className="horosa-side-panel-title">六爻信息</div>
									<div className="horosa-side-panel-subtitle">概览与卦辞</div>
								</div>
							</div>
							{this.renderRightPanel(height, guadesc)}
						</div>
					</div>
					{this.renderBottomQuickDock()}
				</div>
			</div>

		);
	}
}
mixinMethods(GuaZhanMain, panelMethods, caseStateMethods, castMethods);   // 方法按职责拆在 ./main/ 下(见各文件头),挂回原型

export default GuaZhanMain;
