import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { XQTabs as Tabs } from '../xq-ui';
import { randomStr } from '../../utils/helper';
import { ZERI_SUBTABS, rememberSubTab } from '../../constants/SubTabRegistry';
import TianxingElectionMain from './TianxingElectionMain';
import QimenZeriMain from './QimenZeriMain';
import HuangliZeriMain from './HuangliZeriMain';
import BaziZeriMain from './BaziZeriMain';
import TaiyiZeriMain from './TaiyiZeriMain';
import ZiweiZeriMain from './ZiweiZeriMain';
import LiurengZeriMain from './LiurengZeriMain';
import SanshiZeriMain from './SanshiZeriMain';
import QizhengZeriMain from './QizhengZeriMain';
import IndiaZeriMain from './IndiaZeriMain';

const TabPane = Tabs.TabPane;

// 「择日」主导航模块宿主。布局**逐字照抄辅盘**(horosa-auxchart-page/-layout/-tabs 三类
// 复用其整条高度链与栏位链,用户明令勿自创);差异仅两点,均锁 .horosa-zeri-host 作用域:
//   ① 无底部 QuickDock → layout 的 64px dock 行去掉(app.less zeri 覆盖条)
//   ② 右栏(征象搜索区)大屏加宽(app.less 6850 区 zeri 覆盖条)
// 新增择日技法在 ZERI_SUBTABS + 此处 TabPane 成对追加。
export default class ZeriMain extends Component{
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props){
		super(props);
		const subtab = this.props.currentSubTab ? this.props.currentSubTab : 'tianxing';
		const tab = ZERI_SUBTABS.indexOf(subtab) >= 0 ? subtab : 'tianxing';
		rememberSubTab('zeri', tab, ZERI_SUBTABS);
		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
			// [奇门择日空闲预挂载](horosa_zeri_idle_prerender_v1)用户实报「软件首开后首次点
			// 奇门择日子页签要卡一会儿,其它子页签瞬间」。
			// 实测(MutationObserver 计时,不依赖 rAF——本机 preview pane 隐藏时 rAF 不触发,
			// 早前用 rAF 测出的 9.7s/13s 全是假象):**热态**子页签互切仅 28-79ms,故开销集中在
			// 「首次」= 懒加载 chunk + 首次构造整棵树(本面板内嵌的是完整遁甲盘 DunJiaMain,
			// 左栏全选项+中栏盘+右栏)。
			// 本措施只针对后者:进页那一刻仍走「只挂当前面板」的快路径(进择日页速度逐字不变),
			// 等主线程空闲再把该面板 forceRender 打开,让 React 在空闲片里把树建好 ⇒ 用户真点击
			// 时已就绪。空闲期建树对其它部件零影响(idle 优先级最低,且有 timeout 兜底)。
			// ⚠️ 生产环境(装机 APP)的收益尚未 A/B 实测——dev 的 chunk 现编译开销会盖过一切,
			// 无法在 dev 得到可信数字;若装机后仍卡,须在 APP 内实测再定位(chunk 体积 or 后端请求)。
			// 首屏就直达奇门择日时无需预挂载(它本就要立刻挂)。
			prerenderQimenZeri: tab === 'qimenzeri',
		};
		this.changeTab = this.changeTab.bind(this);
	}

	componentDidMount(){
		// kill-switch:localStorage['horosa.perf.zeriPrerender']='0' ⇒ 完全退回旧行为(点了才挂)。
		try{
			if(typeof window !== 'undefined' && window.localStorage
				&& window.localStorage.getItem('horosa.perf.zeriPrerender') === '0'){
				return;
			}
		}catch(e){ /* 隐私模式读不到 localStorage:按默认开 */ }
		if(this.state.prerenderQimenZeri){
			return;
		}
		const arm = ()=>{
			this.zeriPrerenderIdle = null;
			this.zeriPrerenderTimer = null;
			if(this.unmounted || this.state.prerenderQimenZeri){
				return;
			}
			this.setState({ prerenderQimenZeri: true });
		};
		if(typeof requestIdleCallback === 'function'){
			// timeout 兜底:长时间无空闲片也要建,否则用户久等后点击仍是冷的。
			this.zeriPrerenderIdle = requestIdleCallback(arm, { timeout: 4000 });
		}else{
			this.zeriPrerenderTimer = setTimeout(arm, 1200);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this.zeriPrerenderIdle && typeof cancelIdleCallback === 'function'){
			try{ cancelIdleCallback(this.zeriPrerenderIdle); }catch(e){ /* ignore */ }
			this.zeriPrerenderIdle = null;
		}
		if(this.zeriPrerenderTimer){
			clearTimeout(this.zeriPrerenderTimer);
			this.zeriPrerenderTimer = null;
		}
	}

	componentDidUpdate(prevProps){
		const next = this.props.currentSubTab;
		if(next && next !== prevProps.currentSubTab && ZERI_SUBTABS.indexOf(next) >= 0 && next !== this.state.currentTab){
			rememberSubTab('zeri', next, ZERI_SUBTABS);
			this.setState({ currentTab: next });
		}
	}

	changeTab(key){
		rememberSubTab('zeri', key, ZERI_SUBTABS);
		this.setState({ currentTab: key }, ()=>{
			if(this.props.dispatch){
				this.props.dispatch({ type: 'astro/save', payload: { currentSubTab: key } });
			}
		});
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		height = height - 20;
		const childHeight = Math.max(height - 36, 560);
		return (
			<div id={this.state.divId} className="horosa-auxchart-page horosa-zeri-host">
				<div className="horosa-auxchart-layout">
					<Tabs
						defaultActiveKey={this.state.currentTab}
						activeKey={this.state.currentTab}
						tabPosition='right'
						onChange={this.changeTab}
						className="xq-tabs-rail horosa-auxchart-tabs"
						style={{ height: '100%' }}
					>
						<TabPane tab="天星择日" key="tianxing">
							<TianxingElectionMain
							wheelArt={this.props.wheelArt}
								fields={this.props.fields}
								height={childHeight}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								showOnlyRulExaltReception={this.props.showOnlyRulExaltReception}
								voidClassical={this.props.voidClassical}
								dispatch={this.props.dispatch}
							/>
						</TabPane>
						<TabPane tab="奇门择日" key="qimenzeri" forceRender={this.state.prerenderQimenZeri}>
							<QimenZeriMain
								fields={this.props.fields}
								height={childHeight}
								chart={this.props.chart}
								dispatch={this.props.dispatch}
							/>
						</TabPane>
						<TabPane tab="黄历择日" key="huanglizeri">
							<HuangliZeriMain height={childHeight} />
						</TabPane>
						<TabPane tab="八字择日" key="bazizeri">
							<BaziZeriMain height={childHeight} />
						</TabPane>
						<TabPane tab="太乙择日" key="taiyizeri">
							<TaiyiZeriMain height={childHeight} />
						</TabPane>
						<TabPane tab="紫微择日" key="ziweizeri">
							<ZiweiZeriMain height={childHeight} />
						</TabPane>
						<TabPane tab="六壬择日" key="liurengzeri">
							<LiurengZeriMain height={childHeight} />
						</TabPane>
						<TabPane tab="三式择日" key="sanshizeri">
							<SanshiZeriMain height={childHeight} />
						</TabPane>
						<TabPane tab="七政择日" key="qizhengzeri">
							<QizhengZeriMain height={childHeight} />
						</TabPane>
						<TabPane tab="印度择日" key="indiazeri">
							<IndiaZeriMain height={childHeight} />
						</TabPane>
					</Tabs>
				</div>
			</div>
		);
	}
}
