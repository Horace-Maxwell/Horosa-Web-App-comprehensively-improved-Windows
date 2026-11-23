// 地占页(组件类在这里;模块级常量与 AI 快照按职责拆在 main/ 下):
//   tables(符号、细分设置字段、各传本多边形与目录、问事 / 起卦 / 流派选项与判读中文表、页面设置与盘面设计尺寸)
//   → snapshot(取盘、快照正文与按字段无头起盘)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
// 组件方法同样按职责拆在 main/ 下(caseState · cast · inputPanel · shieldViews · houseCharts · rightPanel · techniqueCard),类后 mixinMethods 挂回原型;构造、生命周期与 render 留在类里。
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
// 🔴 React 须显式导入:JSX 编译成 React.createElement,应用构建靠 umi 自动注入才没炸,
//    但 jest 直接载入本模块时无此注入 → render 期 ReferenceError。仓内同族坑已犯过一次。
import React, { Component } from 'react';
import XQIcon from '../xq-icons';
import { XQSpin } from '../xq-ui';
import TechniqueErrorBoundary from '../common/TechniqueErrorBoundary';
import { subscribeRemoteNongli } from '../../utils/divinationTimeDraft';
import './GeomancyMain.less';
import { ownedBoxSizeRef, shortHostVars, GEOMANCY_HOST_SHORT } from '../../utils/boxSizeVars';
import { savedGeomancySettings } from './main/tables';
import { mixinMethods } from '../../utils/mixinMethods';
import { caseStateMethods } from './main/caseState';
import { castMethods } from './main/cast';
import { inputPanelMethods } from './main/inputPanel';
import { shieldViewMethods } from './main/shieldViews';
import { houseChartMethods } from './main/houseCharts';
import { rightPanelMethods } from './main/rightPanel';
import { techniqueCardMethods } from './main/techniqueCard';
export { restoredGeomancySeedMode, GEOMANCY_PAGE_SETTINGS, GEOMANCY_BOARD_TITLE_ROW, GEOMANCY_SQUARE_DESIGN_W, GEOMANCY_SQUARE_DESIGN_H, GEOMANCY_POLY_DESIGN_W, GEOMANCY_POLY_DESIGN_H } from './main/tables';
export { buildGeomancySnapshotText, buildGeomancySnapshotForFields } from './main/snapshot';

class GeomancyMain extends Component{
	// 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props){
		super(props);
		this.state = {
			loading: false,
			result: null,
			resultSig: '',	// 屏上这一盘的起盘签名(时刻 + 地点 + 种子),取失败时据此判留存 / 清掉
			question: '',
			questionType: 'custom',
			// 所问宫默认随问类预设(custom→一宫)。
			// ⚠️ custom/life → 一宫与问者宫重合是**合法自指**(问的就是自身),不是数据错;
			//    错在此时完美/相位数学上恒成立却不加说明。今由技法卡如实标注并指引改选。
			quesitedHouse: 1,
			seedMode: 'random',
			manualSeed: 0,
			tradition: 'european_classical',   // 流派预设(默认古典定局派=现状零回归)
			readingScope: 'L3',
			zodiacSystem: 'classical',
			...(()=>{ const sv = savedGeomancySettings(); return { seedMode: sv.seedMode, tradition: sv.tradition, readingScope: sv.readingScope, zodiacSystem: sv.zodiacSystem }; })(),   // 上次亲手设的口径
			rightPanelTab: 'reading',
			centerView: 'square',
			history: [],
			// [高级传本] 只存**用户显式改过**的项:未改=不发 → 后端回落所选流派默认 = 字节零回归。
			// 显示值取「用户覆盖 ?? 后端回传的生效值」;换流派预设即清空覆盖(预设=批量写默认)。
			granular: savedGeomancySettings().granular,
			// 转宫:以某宫为新命宫重算指示与完美(null=不转)
			turnTo: null,
			// 图形 Unicode 字形叠加:默认关 —— 自绘点阵为主(字体缺字时 Unicode 会显方框),
			// 开启则在图形卡旁并显该码位字形,供有对应字体者查对。
			showUnicodeGlyph: savedGeomancySettings().showUnicodeGlyph,
			// [自由起盘] 本地时间地理草稿(null=跟主命盘;非空=用户左栏自选时间/经纬:时间起卦按此算种子,
			// 经纬/时间随事盘存储 + 透传后端占星盘)。
			localFields: null,
			// [报数起卦] 用户自报十六数(奇=单点/偶=双点),空白或逗号分隔;仅 seedMode==='numbers' 时用。
			castNumbersText: '',
			// [行星地占盘] 独立盘型:默认关(关则后端一颗随机数不取 ⇒ 全响应字节零变)。
			...(()=>{ const sv = savedGeomancySettings(); return { planetaryChart: sv.planetaryChart, planetaryChartZodiac: sv.planetaryChartZodiac, planetaryChartNodes: sv.planetaryChartNodes, planetaryChartExtras: sv.planetaryChartExtras }; })(),
			// [地占三角] 含义两派 —— 纯显示态,不发后端、不改计算。
			triangleSchool: savedGeomancySettings().triangleSchool,   // 上次亲手选的那一派(没存过 = 近代传本)
			// [寻源四线] 金字塔盘当前所寻之线(火/风/水/土)
			pyrLine: 'fire',
		};
		this.unmounted = false;
		this.requestSeq = 0;
		this._recastTimer = null;
		this._suppressRecast = false;
		// [实时重算] 时地签名基线须在构造期就取真值:否则首次 didUpdate 会把「本来就没变」误判成变了,
		// 而那一拍若正带着载入的存档盘,就会把存档盘重算覆盖掉。
		this._lastCastParamSig = this.castParamSig();
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.clickCast = this.clickCast.bind(this);
		this.clickReproduce = this.clickReproduce.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.setCenterView = this.setCenterView.bind(this);
		this.changeGeomancyOpt = this.changeGeomancyOpt.bind(this);
		this.commitQuestion = this.commitQuestion.bind(this);
		this.changeQuestionType = this.changeQuestionType.bind(this);
		this.changeQuesitedHouse = this.changeQuesitedHouse.bind(this);
		this.changePlanetaryOpt = this.changePlanetaryOpt.bind(this);
		this.traditionOptions = this.traditionOptions.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.applyHistory = this.applyHistory.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				if(this.unmounted){ return; }
				this.restoreFromCurrentCase();
			};
		}
	}

	componentDidMount(){
		this._unsubNongli = subscribeRemoteNongli(() => this.forceUpdate());
		this.loadHistory();
		window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		this.restoreFromCurrentCase();
	}

	// 🔴 载档触发通路:本组件此前**只有** componentDidMount 这一条。
	// 子技法面板常驻挂载(Tabs 无 destroyInactiveTabPane),用户若已停在地占页再从事盘列表
	// 载一条地占档,组件不重挂 → mount 不响 → 载档静默不生效。补上 fields 变化即还原
	// (照 lingqi:90 / guice:94 同款范式;restore 内部自带去重守卫,不会反复覆盖用户现场)。
	componentDidUpdate(prev){
		let restored = false;
		if(prev.fields !== this.props.fields && this.props.fields){ restored = this.restoreFromCurrentCase(); }
		// 🔴 [实时重算] 时地一改即按新时地重排判读,不必再点一次「起盘」(原先改了地点毫无反应,
		//    非得重起一盘才生效 —— 而重起就是重掷,那副卦就没了)。护盾盘由 recastPinned 钉住不动。
		//    签名无论是否重算都要同步:载档那一拍若留下陈旧签名,下一拍就会误触发一次重算把存档盘覆盖掉。
		const sig = this.castParamSig();
		const changed = (sig !== this._lastCastParamSig);
		this._lastCastParamSig = sig;
		if(changed && !restored && !this._suppressRecast){ this.scheduleRecastPinned(); }
	}

	componentWillUnmount(){
		if(this._recastTimer){ clearTimeout(this._recastTimer); this._recastTimer = null; }
		if(this._centerRO){ this._centerRO.disconnect(); this._centerRO = null; }
		if(this._unsubNongli){ this._unsubNongli(); }
		this.unmounted = true;
		window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
	}

	render(){
		const embedded = !!this.props.hideQuickDock;
		let height = this.props.height ? this.props.height : 760;
		let pageStyle = { height, minHeight: height, overflow: 'hidden' };
		if(embedded){
			pageStyle = { height: '100%', minHeight: 0, overflow: 'hidden' };
		}else if(height === '100%'){
			height = 760;
			pageStyle = { height, minHeight: height, overflow: 'hidden' };
		}else{
			height = height - 20;
			pageStyle = { height, minHeight: height, overflow: 'hidden' };
		}
		return (
			<TechniqueErrorBoundary label="天文地占">
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-geomancy-redesign${embedded ? ' horosa-huangji-embedded' : ''}`} style={pageStyle}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<XQSpin spinning={this.state.loading}>
						<div className="horosa-astro-redesign-grid horosa-huangji-redesign-grid">
							<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
								{this.renderInputPanel()}
							</div>
							<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer">
								<div className="horosa-huangji-board-host" ref={ownedBoxSizeRef(this, 'host', shortHostVars(GEOMANCY_HOST_SHORT))}>{this.renderCenter()}</div>
							</div>
							<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
								<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
									<div>
										<div className="horosa-side-panel-title">地占信息</div>
										<div className="horosa-side-panel-subtitle">判官、宫位与图形</div>
									</div>
								</div>
								{this.renderRightPanel()}
							</div>
						</div>
					</XQSpin>
					{!this.props.hideQuickDock && this.renderBottomQuickDock()}
				</div>
			</div>
			</TechniqueErrorBoundary>
		);
	}
}
mixinMethods(GeomancyMain, caseStateMethods, castMethods, inputPanelMethods, shieldViewMethods, houseChartMethods, rightPanelMethods, techniqueCardMethods);   // 方法按职责拆在 ./main/ 下(见各文件头),挂回原型

export default GeomancyMain;
