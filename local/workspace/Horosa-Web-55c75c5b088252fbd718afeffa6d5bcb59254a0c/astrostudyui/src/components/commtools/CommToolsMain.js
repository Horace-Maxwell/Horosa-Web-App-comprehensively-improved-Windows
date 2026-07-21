import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import Azimuth from './Azimuth';
import CoordTrans from './CoordTrans';
import Calculator from './Calculator';
import DateCalc from './DateCalc';
import NaYing from './NaYing';
import InverseBazi from './InverseBazi';
import BaziPattern from './BaziPattern';
import GuaSymDesc from '../gua/GuaSymDesc';
import CuanGong12 from './CuanGong12';
import BaziPithy from './BaziPithy';
import TechniqueErrorBoundary from '../common/TechniqueErrorBoundary';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/safeStorage';

const TabPane = Tabs.TabPane;

// horosa_freeze_subtabs_v1 ★复核补丁(horosa_controlled_tab_clamp_v1):
// 本组件的 Tabs 已从 defaultActiveKey(非受控)改为受控 activeKey,而初值来自 localStorage
// 'commtoolstab' —— 那是**跨版本持久**的用户数据,可能存着已改名/已下线的旧 key。
// 非受控时代 rc-tabs 会自己把不存在的 key 纠偏到第一个面板;受控之下外部 activeKey 永远盖过
// 内部兜底 → 小工具抽屉打开即**整块空白、无页签高亮**,且因为写在 localStorage 里,刷新也不自愈。
// 故这里对持久值做白名单校验,不认识就回落到默认页。白名单必须与下面 TabPane 的 key 一一对应。
const COMMTOOLS_TAB_KEYS = [
	'naying', 'calculator', 'datecalc', 'azimuth', 'cotrans',
	'inversebazi', 'bazipattern', 'guasym', 'cuangong12', 'pithy',
];

class CommToolsMain extends Component{
	constructor(props) {
		super(props);

		let tab = safeLocalStorageGet('commtoolstab');
		if(COMMTOOLS_TAB_KEYS.indexOf(tab) < 0){
			tab = 'naying';
		}

		this.state = {
			tab: tab,
		};

		this.changeTab = this.changeTab.bind(this);
	}

	changeTab(key){
		safeLocalStorageSet('commtoolstab', key);
		this.setState({
			tab: key
		});
	}

	// horosa_panel_ready_v1 —— **本组件刻意不接**,原因记档以免下次有人"补上":
	// CommToolsMain 不是顶层技法页签,而是挂在 pages/index.js 的 Drawer 里(destroyOnClose)。
	// markInteractionStart 只在 changeCond 里按 currentTab 打点,永远不会打出 'commtools';
	// 而 markPanelReady 消费的是**全局**那一枚交互起点。若在这里打,当用户正在八字页改时间、
	// 小工具抽屉恰好开着时,本组件会把八字那次交互的样本抢走并记成 'commtools' —— 量出来的
	// 数会是错的。观测宁可缺一格,不可记错格。

	render(){
		let height = document.documentElement.clientHeight;
		height = height - 80;

		let fields = this.props.fields;
		// 🔒 防黑屏:fields(或 lat/lon/date 子字段)在未起盘/重置/切页瞬态可能缺失,而坐标类 TabPane 的
		//   <Calculator lat={fields.lat.value}.../> 等 props 在 render 时即被 React.createElement 求值
		//   (即便该 tab 未激活也会求值)→ fields.lat.value 抛 TypeError、整个小工具(无边界)即黑屏。
		//   统一兜底取值,缺失即传 undefined,各坐标面板自身已能处理空值。
		const latV = (fields && fields.lat) ? fields.lat.value : undefined;
		const lonV = (fields && fields.lon) ? fields.lon.value : undefined;
		const timeV = (fields && fields.date) ? fields.date.value : undefined;

		// 受控化:原来是 defaultActiveKey(非受控),FreezeSubTab 需要真实 activeKey 才能判断激活面板。
		// state.tab 本就在 onChange 里同步维护,改为受控不改变任何可见行为(初值仍来自 localStorage)。
		const activeTab = this.state.tab;

		// 🔒 每个面板独立 error boundary:任一技法 render 抛错只显本面板回退卡片,绝不黑全屏(Mac/JSC 更易触发)。
		// horosa_freeze_subtabs_v1:第二参改为**取节点的函数**(thunk)。边界仍在最外层逐面板独立,
		// 内层 FreezeSubTab 负责:① 从未激活过的面板不求值 thunk(连元素都不建,顺带根治上面那条
		// 「未激活面板的 props 也会被求值」的黑屏隐患);② 已激活过的面板在非激活期间跳过 re-render,
		// 切回时拿本轮最新 props 立刻渲一帧 —— 不卸载、不清空用户在计算器/日期计算里已输入的内容。
		const wrap = (label, key, fn) => (
			<TechniqueErrorBoundary label={label}>
				<FreezeSubTab active={activeTab === key}>{fn}</FreezeSubTab>
			</TechniqueErrorBoundary>
		);

		return (
			<div className="horosa-commtools-root">
				<Tabs
					className="horosa-commtools-tabs"
					activeKey={activeTab}
					onChange={this.changeTab}
					tabPosition='left'
					style={{ height: height }}
				>
					<TabPane tab="纳音五行" key="naying">
						{wrap('纳音五行', 'naying', ()=><NaYing />)}
					</TabPane>

					<TabPane tab="计算器" key="calculator">
						{wrap('计算器', 'calculator', ()=><Calculator lat={latV} lon={lonV} time={timeV} />)}
					</TabPane>

					<TabPane tab="日期计算" key="datecalc">
						{wrap('日期计算', 'datecalc', ()=><DateCalc lat={latV} lon={lonV} time={timeV} />)}
					</TabPane>

					<TabPane tab="地平坐标" key="azimuth">
						{wrap('地平坐标', 'azimuth', ()=><Azimuth lat={latV} lon={lonV} time={timeV} />)}
					</TabPane>

					<TabPane tab="黄赤坐标" key="cotrans">
						{wrap('黄赤坐标', 'cotrans', ()=><CoordTrans lat={latV} lon={lonV} time={timeV} />)}
					</TabPane>

					<TabPane tab="八字反查" key="inversebazi">
						{wrap('八字反查', 'inversebazi', ()=><InverseBazi />)}
					</TabPane>

					<TabPane tab="八字格局" key="bazipattern">
						{wrap('八字格局', 'bazipattern', ()=><BaziPattern />)}
					</TabPane>

					<TabPane tab="八卦类象" key="guasym">
						{wrap('八卦类象', 'guasym', ()=><GuaSymDesc />)}
					</TabPane>

					<TabPane tab="十二串宫" key="cuangong12">
						{wrap('十二串宫', 'cuangong12', ()=><CuanGong12 />)}
					</TabPane>

					<TabPane tab="八字规则" key="pithy">
						{wrap('八字规则', 'pithy', ()=><BaziPithy />)}
					</TabPane>

				</Tabs>
			</div>
		)
	}
}

export default CommToolsMain;
