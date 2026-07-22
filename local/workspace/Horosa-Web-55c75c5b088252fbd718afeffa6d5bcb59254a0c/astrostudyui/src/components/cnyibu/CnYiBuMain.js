import React, { Component, createRef, Suspense } from 'react';
import { Spin } from 'antd';
import { XQTabs as Tabs } from '../xq-ui';
import { randomStr } from '../../utils/helper';
// [C2·性能] 十子技法组件级 lazy(照下方 guice 四件既有范式):进「卜·其他」只拉壳+当前子页,
// 其余子页首次点击才拉(idle 预取与悬停预取照旧);ref 经 React.lazy 透传,dock 判空自动降级。
const SuZhanMain = React.lazy(() => import(/* webpackChunkName: "suzhan-main" */ '../suzhan/SuZhanMain'));
const JinKouMain = React.lazy(() => import(/* webpackChunkName: "jinkou-main" */ '../jinkou/JinKouMain'));
const TongSheFaMain = React.lazy(() => import(/* webpackChunkName: "tongshefa-main" */ '../tongshefa/TongSheFaMain'));
const HuangJiMain = React.lazy(() => import(/* webpackChunkName: "huangji-main" */ '../huangji/HuangJiMain'));
const WuZhaoMain = React.lazy(() => import(/* webpackChunkName: "wuzhao-main" */ '../wuzhao/WuZhaoMain'));
const TaiXuanMain = React.lazy(() => import(/* webpackChunkName: "taixuan-main" */ '../taixuan/TaiXuanMain'));
const JingJueMain = React.lazy(() => import(/* webpackChunkName: "jingjue-main" */ '../jingjue/JingJueMain'));
const ShenYiShuMain = React.lazy(() => import(/* webpackChunkName: "shenyishu-main" */ '../shenyishu/ShenYiShuMain'));
const GeomancyMain = React.lazy(() => import(/* webpackChunkName: "geomancy-main" */ '../geomancy/GeomancyMain'));
const TarotMain = React.lazy(() => import(/* webpackChunkName: "tarot-main" */ '../tarot/TarotMain'));
// 皇极轨策:组件级 lazy —— 其引擎(十二起卦法/演数/卦变/断法/十应/大定/历数)只随本页签走,
// 不入本模块主 chunk。ref 经 React.lazy 透传至内层 class(getQuickDockConfig 等仍可用);
// 未解析前 childRefs.guice.current 为 null,getActiveChild 本就判空 → dock 自动降级。
const GuiceMain = React.lazy(() => import(/* webpackChunkName: "guice-main" */ '../guice/GuiceMain'));
const XiaoLiuRenMain = React.lazy(() => import(/* webpackChunkName: "xiaoliuren-main" */ '../xiaoliuren/XiaoLiuRenMain'));
const XiaoChengTuMain = React.lazy(() => import(/* webpackChunkName: "xiaochengtu-main" */ '../xiaochengtu/XiaoChengTuMain'));
const FeiGongMain = React.lazy(() => import(/* webpackChunkName: "feigong-main" */ '../feigong/FeiGongMain'));
import QuickDockBar from '../common/QuickDockBar';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';


const TabPane = Tabs.TabPane;
const CNYIBU_VALID_TABS = ['suzhan', 'jinkou', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu', 'geomancy', 'tarot', 'guice', 'xiaoliuren', 'xiaochengtu', 'feigong'];
// horosa_prefetch_registry_v1(PERF-R10 P6):可步进预取的确定性子页,显式枚举 ——
// 随机起卦子页(wuzhao 非 ganzhi/jingjue/geomancy/tarot/xiaoliuren/guice/dice 类)绝不入列
//(预取=把随机结果钉死;端点级 FORBIDDEN 双闸仍兜底);jinkou 两阶段(pan 需 nongli 真太阳时
// 种子,来源不走共享桥)暂不入列,待 P0 实测数据决定接线方式;suzhan/tongshefa/feigong 等
// 吃 props.chart(主 /chart±N 武装已覆盖其上游)。
const CNYIBU_PREFETCH_TABS = new Set(['huangji', 'taixuan', 'shenyishu']);

function getRuntimeCnYiBuTab(){
	if(typeof window === 'undefined'){
		return null;
	}
	const tab = window.__horosaCnyibuCurrentTab;
	return CNYIBU_VALID_TABS.indexOf(tab) >= 0 ? tab : null;
}

function setRuntimeCnYiBuTab(tab){
	if(typeof window !== 'undefined' && CNYIBU_VALID_TABS.indexOf(tab) >= 0){
		window.__horosaCnyibuCurrentTab = tab;
	}
}

class CnYiBuMain extends Component{

	constructor(props) {
		super(props);
		const subtab = this.props.currentSubTab || getRuntimeCnYiBuTab() || 'suzhan';
		const tab = CNYIBU_VALID_TABS.indexOf(subtab) >= 0 ? subtab : 'suzhan';
		setRuntimeCnYiBuTab(tab);

		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
			hook:{
				suzhan:{
					fun: null
				},
				jinkou:{
					fun: null
				},
				tongshefa:{
					fun: null
				},
				huangji:{
					fun: null
				},
				wuzhao:{
					fun: null
				},
				taixuan:{
					fun: null
				},
				guice:{
					fun: null
				},
				xiaoliuren:{
					fun: null
				},
				xiaochengtu:{
					fun: null
				},
				feigong:{
					fun: null
				},
				jingjue:{
					fun: null
				},
				shenyishu:{
					fun: null
				},
				geomancy:{
					fun: null
				},
				tarot:{
					fun: null
				}
			},
		};

		this.childRefs = {
			suzhan: createRef(),
			jinkou: createRef(),
			tongshefa: createRef(),
			huangji: createRef(),
			wuzhao: createRef(),
			taixuan: createRef(),
			guice: createRef(),
			xiaoliuren: createRef(),
			xiaochengtu: createRef(),
			feigong: createRef(),
			jingjue: createRef(),
			shenyishu: createRef(),
			geomancy: createRef(),
			tarot: createRef(),
		};

		this.changeTab = this.changeTab.bind(this);
		this.renderBottomQuickDock = this.renderBottomQuickDock.bind(this);
		this.wrapDockHandler = this.wrapDockHandler.bind(this);
		this.refreshDock = this.refreshDock.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields, chartObj)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					hook[this.state.currentTab].fun(fields, chartObj);
				}
			};
		}

	}

	changeTab(key){
		setRuntimeCnYiBuTab(key);
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
		}, ()=>{
			if(hook[key].fun){
				hook[key].fun(this.props.fields, this.props.chart);
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: key,
					}
				});
			}	
		});
	}

	componentDidMount(){
		this.unmounted = false;
		// 首渲时子页 ref 尚未挂上,取不到 getQuickDockConfig;挂载后补一拍让 dock 内容就位
		this.forceUpdate();
		// horosa_prefetch_registry_v1(PERF-R10 P6):cnyibu 单键注册,按活跃子页转发到子组件的
		// getStepPrefetchTasks(lazy 子页 ref 未挂/未实现该方法/非确定性子页 → [],零网络)。
		this._stepPrefetcher = (steppedFields)=>{
			try{
				const key = this.state.currentTab;
				if(!CNYIBU_PREFETCH_TABS.has(key)){ return []; }
				const inst = this.childRefs[key] && this.childRefs[key].current;
				if(!inst || typeof inst.getStepPrefetchTasks !== 'function'){ return []; }
				const tasks = inst.getStepPrefetchTasks(steppedFields);
				return Array.isArray(tasks) ? tasks : [];
			}catch(e){
				return [];
			}
		};
		registerStepPrefetcher('cnyibu', this._stepPrefetcher);
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._stepPrefetcher){
			unregisterStepPrefetcher('cnyibu', this._stepPrefetcher);
			this._stepPrefetcher = null;
		}
	}

	componentDidUpdate(prevProps){
		if(prevProps.currentSubTab !== this.props.currentSubTab){
			const key = this.props.currentSubTab;
			if(CNYIBU_VALID_TABS.indexOf(key) >= 0 && key !== this.state.currentTab){
				setRuntimeCnYiBuTab(key);
				this.setState({ currentTab: key }, ()=>{
					const hook = this.state.hook;
					if(hook[key] && hook[key].fun){
						hook[key].fun(this.props.fields, this.props.chart);
					}
				});
			}
		}
	}

	/**
	 * 子页 ref 之挂载钩 —— 真挂上那一刻补一拍，让 dock 跟上。
	 *
	 * 🔴 lazy 子页(轨策)的 ref 是【异步】挂上的:componentDidMount 补的那一拍跑在
	 *    chunk 解析【之前】,彼时 ref.current 尚是 null → dock 拿着空 config 定格,
	 *    此后再无人触发容器重渲 → 该子页的 dock 永劫只剩「AI助手」,起卦/保存全不见
	 *    (轨策身为首个 lazy 子页,正栽于此;真机点开才现形,jest 只验了 ref 写在 JSX 上)。
	 *    故改用 callback ref:null→实例那一刻补拍。此后任一子页改 lazy 皆自免此疫。
	 */
	attachChildRef(key){
		if(!this._refCbs){
			this._refCbs = {};
		}
		if(!this._refCbs[key]){
			this._refCbs[key] = (el)=>{
				const box = this.childRefs[key];
				if(!box){
					return;
				}
				const had = box.current;
				box.current = el;
				// 只在 null→实例时补(卸载置 null 不必);容器已卸则不动
				if(!had && el && !this.unmounted){
					this.forceUpdate();
				}
			};
		}
		return this._refCbs[key];
	}

	getActiveChild(){
		const ref = this.childRefs[this.state.currentTab];
		return ref && ref.current ? ref.current : null;
	}

	// dock 不在子页渲染树内,子页 setState 不会连带重渲容器——动作后补拍 forceUpdate,
	// 让 hasResult/禁用态跟上子页内部状态。补三拍(0/600/2500ms):起盘/起课类动作是异步的,
	// 结果落地在网络/计算返回之后,单拍会读到旧态(dock 永远禁用的伪死)。
	// 子页自述其态已变(如自左栏起了卦)时唤之 —— dock 不在子页渲染树内,不告则不知。
	refreshDock(){
		if(!this.unmounted){
			this.forceUpdate();
		}
	}

	wrapDockHandler(fn){
		if(!fn){
			return fn;
		}
		return (...args)=>{
			fn(...args);
			[0, 600, 2500].forEach((delay)=>{
				window.setTimeout(()=>{
					if(!this.unmounted){
						this.forceUpdate();
					}
				}, delay);
			});
		};
	}

	// 快捷栏契约:原十套硬编码分支(右栏 tab 镜像/跨子页目录/跨页导航,经 ref 穿透)全部撤除——
	// 那是目录不是快捷功能。各子页以 getQuickDockConfig() 自述主键/专属动词/保存,容器只透传。
	renderBottomQuickDock(){
		const tab = this.state.currentTab;
		const child = this.getActiveChild();
		const config = child && typeof child.getQuickDockConfig === 'function' ? child.getQuickDockConfig() : {};
		const wrapItem = (item)=>(item ? { ...item, onClick: this.wrapDockHandler(item.onClick) } : item);
		const primary = Array.isArray(config.primary) ? config.primary.map(wrapItem) : wrapItem(config.primary);
		return (
			<QuickDockBar
				page={`cnyibu-${tab}`}
				className="horosa-cnyibu-quick-dock"
				hasResult={config.hasResult !== undefined ? !!config.hasResult : false}
				primary={primary}
				extras={(config.extras || []).map(wrapItem)}
				save={this.wrapDockHandler(config.save)}
				ai={config.ai !== undefined ? config.ai : true}
				dispatch={this.props.dispatch}
			/>
		);
	}


	render(){
		let height = this.props.height ? this.props.height : 760;
		height = height - 20;
		const contentHeight = typeof height === 'number' ? Math.max(height - 44, 260) : 'calc(100% - 44px)';
		const tab = this.state.currentTab;

		return (
			<div id={this.state.divId} className="horosa-cnyibu-page">
				<Tabs
					defaultActiveKey={tab} tabPosition='right'
					activeKey={tab}
					onChange={this.changeTab}
					className="xq-tabs-rail"
					style={{ height: '100%', minHeight: 0 }}
				>
					<TabPane tab="宿盘" key="suzhan">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'suzhan'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<SuZhanMain 
									ref={this.attachChildRef('suzhan')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									hook={this.state.hook.suzhan}
									dispatch={this.props.dispatch}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>

					<TabPane tab="金口诀" key="jinkou">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'jinkou'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<JinKouMain
									ref={this.attachChildRef('jinkou')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.jinkou}
									dispatch={this.props.dispatch}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="统摄法" key="tongshefa">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'tongshefa'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<TongSheFaMain
									ref={this.attachChildRef('tongshefa')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.tongshefa}
									dispatch={this.props.dispatch}
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="皇极经世" key="huangji">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'huangji'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<HuangJiMain
									ref={this.attachChildRef('huangji')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.huangji}
									dispatch={this.props.dispatch}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="五兆" key="wuzhao">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'wuzhao'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<WuZhaoMain
									ref={this.attachChildRef('wuzhao')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.wuzhao}
									dispatch={this.props.dispatch}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="太玄" key="taixuan">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'taixuan'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<TaiXuanMain
									ref={this.attachChildRef('taixuan')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.taixuan}
									dispatch={this.props.dispatch}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="皇极轨策" key="guice">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'guice'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<GuiceMain
									ref={this.attachChildRef('guice')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.guice}
									dispatch={this.props.dispatch}
									onResultChange={this.refreshDock}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="小六壬" key="xiaoliuren">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'xiaoliuren'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<XiaoLiuRenMain
									ref={this.attachChildRef('xiaoliuren')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.xiaoliuren}
									dispatch={this.props.dispatch}
									onResultChange={this.refreshDock}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="小成图" key="xiaochengtu">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'xiaochengtu'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<XiaoChengTuMain
									ref={this.attachChildRef('xiaochengtu')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.xiaochengtu}
									dispatch={this.props.dispatch}
									onResultChange={this.refreshDock}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="飞宫小奇门" key="feigong">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'feigong'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<FeiGongMain
									ref={this.attachChildRef('feigong')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.feigong}
									dispatch={this.props.dispatch}
									onResultChange={this.refreshDock}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="荆诀" key="jingjue">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'jingjue'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<JingJueMain
									ref={this.attachChildRef('jingjue')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.jingjue}
									dispatch={this.props.dispatch}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="神易数" key="shenyishu">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'shenyishu'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<ShenYiShuMain
									ref={this.attachChildRef('shenyishu')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.shenyishu}
									dispatch={this.props.dispatch}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>

					<TabPane tab="地占" key="geomancy">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'geomancy'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<GeomancyMain
									ref={this.attachChildRef('geomancy')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.geomancy}
									dispatch={this.props.dispatch}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>

					<TabPane tab="塔罗" key="tarot">
						{/* horosa_freeze_subtabs_v1: 非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
						<FreezeSubTab active={tab === 'tarot'}>{() => (
							<Suspense fallback={<div className="horosa-guice-loading"><Spin size="small" /> 载入中</div>}>
								<TarotMain
									ref={this.attachChildRef('tarot')}
									value={this.props.chart}
									height={contentHeight}
									fields={this.props.fields}
									hook={this.state.hook.tarot}
									dispatch={this.props.dispatch}
									hideQuickDock
								/>
							</Suspense>
						)}</FreezeSubTab>
					</TabPane>

				</Tabs>
				{this.renderBottomQuickDock()}
			</div>
		);
	}
}

export default CnYiBuMain;
