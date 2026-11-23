// 塔罗页:类定义在这里;模块级助手与类方法按职责拆在 ./main/ 下,
// 方法拆片 caseState · spreadViews · inputPanel · rightPanel,类后 mixinMethods 挂回原型。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import QuickDockBar from '../common/QuickDockBar';
import React, { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { subscribeRemoteNongli } from '../../utils/divinationTimeDraft';
import TechniqueErrorBoundary from '../common/TechniqueErrorBoundary';
import { DEFAULT_DECK } from './engine/deckRegistry';
import { correspondenceView } from './engine/cardSchema';
import { DEFAULT_SPREAD } from './engine/spreads';
// settings↔state 键映射单源(保存/载入同表,防「存而不载」)——正文与 roundtrip 哨兵见 engine/settingsMap.js。
import CardDetailDrawer from './CardDetailDrawer';
import { deckDefaults, savedTarotState } from './main/settings';
import { mixinMethods } from '../../utils/mixinMethods';
import { caseStateMethods } from './main/caseState';
import { spreadViewMethods } from './main/spreadViews';
import { inputPanelMethods } from './main/inputPanel';
import { rightPanelMethods } from './main/rightPanel';
export { resolveSeed, TAROT_PAGE_SETTINGS } from './main/settings';
export { buildTarotSnapshotForFields } from './main/snapshot';

class TarotMain extends Component{
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
		const dd = deckDefaults(DEFAULT_DECK);
		this.state = {
			deckId: DEFAULT_DECK,
			spreadType: DEFAULT_SPREAD,
			seedMode: 'random', manualSeed: 0, question: '',
			reading: null, lastSeed: '', rightPanelTab: 'overview',
			useReversals: dd.reversals, useDignities: dd.dignities, variant: dd.variant, showCorrespondences: dd.showCorrespondences,
			sig: { mode: 'none', gender: 'male', age: 30, sign: '', manualId: 'wands_king' },
			birth: { year: '', month: '', day: '', refYear: '' },
			verdictMode: 'majority',
			quintMode: 'standard', // TP2 精华牌口径:'standard' 通行 | 'fool22' 马赛数值加法(愚人计22,3张阵另显分组加法)
			showBottomCard: false, // TP2 牌底牌(基调):默认关
			edVersion: 'modern', // TP3 尊位版本:'modern' 现行三档 | 'mathers' 原典四档(火土/风水=稍微支持)
			astroModern: false, // TP3 三元素大牌附现代行星注(天/海/冥):默认关
			timingMethod: 'suit_unit', // TP4 计时法:花色单位(默认)/大牌数字/大牌星座/旬星全谱/翻至王牌
			timingUnit: '周', // TP4 大牌数字法单位:天/周/月
			majorsOverlay: false, // TP4 大牌加盖(≥4大牌或过半→每大牌自余牌盖一张小牌):默认关
			showCutCard: false, // TP4 切牌(问卜者心态):默认关
			includeBlank: false, // TP4 空白牌入池(78+1):默认关
			courtElementSystem: 'gd', // TP7 宫廷元素:'gd' 元素中元素(默认) | 'alt' 位阶制(王土/后水/骑火/侍风)
			courtZodiacSystem: 'gd_span', // TP7 宫廷星座:'gd_span' 跨段(默认) | 'simple' 单座制(侍无星座)
			meaningSystem: dd.meaningSystem, // 牌义体系:'manual' 逐牌唯一义 | 'waite' 派生义 | 'degrees' 马赛数字度(随牌组吸附)
			reversalMode: 'stored', // 逆位读法:'stored' 预存逆位义(默认) | blocked/internal/opposite/reduced/excess
			suitElementSwap: false, // 火/风互换(少数派):默认 off
			reversalGen: 'shuffle', // 逆位产生:'shuffle' 洗牌逐张(默认) | 'fingers3' 三指定牌 | 'all' 全逆位阵
			crossingUpright: true, // 凯尔特交叉牌恒正读(横置第三态,古法默认开;关=按洗牌朝向读)
			dummettOrder: 'C', // 大牌顺序 Dummett A/B/C 区域序(仅 visconti;A/B 切区域特征注记,不重排逐牌)
			ookTable: 'standard', // 开钥计数表:'standard' 通行(数字=面值/Ace5/宫廷4/侍7/大牌3·9·12) | 'sephira' 质点(王2/后3/骑6/侍9)
			artStyle: 'image', // 'image' 真实牌面(默认;牌面图本地打包、离线可用;没有真实牌面的牌组与缺图的牌自动回退符号) | 'symbol' 简约符号
			// [自由起盘] 本地时间地理草稿(null=跟主命盘;非空=用户左栏自选:「出生信息」种子按此时地算,亦入事盘)。
			localFields: null,
			detailCard: null, // TP6 单卡详情面板当前牌(null=关)
			...savedTarotState(),   // 上次亲手设的口径(没存过 = 上面的出厂值原样)
		};
		this.unmounted = false;
		['drawCards', 'clickReproduce', 'clickSaveCase', 'restoreFromCurrentCase', 'setRightPanelTab', 'changeSpread', 'changeDeck', 'handleSnapshotRefreshRequest', 'applyRecompute', 'changeVerdictMode', 'onTimeChanged', 'changeGeo'].forEach((m) => { this[m] = this[m].bind(this); });
		if(this.props.hook){ this.props.hook.fun = () => { if(!this.unmounted){ this.restoreFromCurrentCase(); } }; }
	}

	componentDidMount(){
		this._unsubNongli = subscribeRemoteNongli(() => this.forceUpdate());
		this.unmounted = false;
		window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		if(!this.restoreFromCurrentCase()){ this.drawCards(); }
	}
	// 🔴 载档触发通路:本组件此前**只有** componentDidMount 这一条。
	// 而子技法面板常驻挂载(Tabs 无 destroyInactiveTabPane),用户若已停在塔罗页再从事盘列表
	// 载一条塔罗档,组件不重挂 → mount 不响 → 载档静默不生效(盘不变,像没点一样)。
	// 补上 fields 变化即还原(照 lingqi:90 / guice:94 同款范式)。
	// 🔴 这里只调 restore、**绝不在返 false 时 drawCards** —— 那会让「改个时间」变成重新抽牌,
	// 把冻结值毁掉;mount 那处的 drawCards 是首屏兜底,语义不同。
	componentDidUpdate(prev){
		if(prev.fields !== this.props.fields && this.props.fields){ this.restoreFromCurrentCase(); }
	}
	componentWillUnmount(){
		if(this._unsubNongli){ this._unsubNongli(); }
		this.unmounted = true;
		window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
	}

	render(){
		// 页高走 100% 定高链(样式见 .horosa-tarot-page:纵向 flex —— 三栏吃剩余空间、底部快捷栏按自身高)。
		// 此前页根内联「工作区高 − 8」px 且三栏 height:100% 占满整页,自渲的快捷栏被挤到页根之外、整条落在视口下方看不见。
		return (
			<TechniqueErrorBoundary label="塔罗">
				<div className="horosa-cnyibu-technique horosa-tarot-page">
					<div className="horosa-tarot-layout">
						<div className="horosa-tarot-col-left">{this.renderInputPanel()}</div>
						<div className="horosa-tarot-col-center">{this.renderCenter()}</div>
						<div className="horosa-tarot-col-right">{this.renderRightPanel()}</div>
					</div>
					{/* TP6 单卡详情面板:中栏点牌/牌义页点名打开;体系视角随左栏当前设置(进阶对应关着时按缺省口径,与牌义表同一 correspondenceView) */}
					<CardDetailDrawer
						card={this.state.detailCard}
						deck={this.currentDeck()}
						visible={!!this.state.detailCard}
						onClose={() => this.setState({ detailCard: null })}
						view={correspondenceView(this.currentDeck(), this.state, this.caps())}
					/>
					{/* [塔罗升一级] 独立页自渲底部快捷坞(存档/AI 能力跟上;聚合容器时代由 CnYiBuMain
					    读 getQuickDockConfig 透传渲染,升一级后无容器 → 自渲。hideQuickDock 防御保留:
					    任何宿主想统一渲染时仍可关掉,绝不双 dock)。config 与容器时代同一来源零分叉。 */}
					{!this.props.hideQuickDock && (() => {
						const dc = this.getQuickDockConfig() || {};
						return (
							<QuickDockBar
								page="tarot"
								className="horosa-tarot-quick-dock"
								hasResult={dc.hasResult !== undefined ? !!dc.hasResult : false}
								primary={dc.primary}
								extras={dc.extras || []}
								save={dc.save}
								ai={dc.ai !== undefined ? dc.ai : true}
								dispatch={this.props.dispatch}
							/>
						);
					})()}
				</div>
			</TechniqueErrorBoundary>
		);
	}
}
mixinMethods(TarotMain, caseStateMethods, spreadViewMethods, inputPanelMethods, rightPanelMethods);   // 方法按职责拆在 ./main/ 下(见各文件头),挂回原型

export default TarotMain;
