import { Component } from 'react';
import { Row, Col, Tabs, } from 'antd';
import { randomStr } from '../../utils/helper';
import SuZhanMain from '../suzhan/SuZhanMain';
import GuaZhanMain from '../guazhan/GuaZhanMain';
import LiuRengMain from '../lrzhan/LiuRengMain';
import JinKouMain from '../jinkou/JinKouMain';
import DunJiaMain from '../dunjia/DunJiaMain';
import TaiYiMain from '../taiyi/TaiYiMain';
import TongSheFaMain from '../tongshefa/TongSheFaMain';


const TabPane = Tabs.TabPane;
const ValidTabs = ['suzhan', 'guazhan', 'liureng', 'jinkou', 'dunjia', 'taiyi', 'tongshefa'];
const CNYIBU_VIEWPORT_GAP = 22;
const CNYIBU_MIN_HEIGHT = 300;
const CNYIBU_WARM_DELAY_MS = 120;
const CNYIBU_WARM_STEP_MS = 180;

function getViewportHeight(){
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		return window.innerHeight;
	}
	if(typeof document !== 'undefined' && document.documentElement){
		return document.documentElement.clientHeight || 900;
	}
	return 900;
}

function toNumber(val){
	if(typeof val === 'number' && Number.isFinite(val)){
		return val;
	}
	if(typeof val === 'string'){
		const txt = val.trim();
		if(/^[-+]?\d+(\.\d+)?(px)?$/i.test(txt)){
			const n = parseFloat(txt);
			return Number.isFinite(n) ? n : null;
		}
	}
	return null;
}

function resolveBoundedHeight(rawHeight){
	const viewport = getViewportHeight();
	let h = toNumber(rawHeight);
	if(h === null){
		h = rawHeight === '100%' ? (viewport - 80) : 760;
	}
	h = h - 20;
	const maxH = Math.max(CNYIBU_MIN_HEIGHT, viewport - CNYIBU_VIEWPORT_GAP);
	return Math.max(CNYIBU_MIN_HEIGHT, Math.min(h, maxH));
}

class CnYiBuMain extends Component{

	constructor(props) {
		super(props);
		const tab = this.normalizeTab(this.props.currentSubTab);
		const preloadedTabs = {};
		ValidTabs.forEach((key)=>{
			preloadedTabs[key] = key === tab;
		});

		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
			preloadedTabs,
			hook:{
				suzhan:{
					fun: null
				},
				guazhan:{
					fun: null
				},
				liureng:{
					fun: null
				},
				jinkou:{
					fun: null
				},
				dunjia:{
					fun: null
				},
				taiyi:{
					fun: null
				},
				tongshefa:{
					fun: null
				}
			},
		};

		this.changeTab = this.changeTab.bind(this);
		this.normalizeTab = this.normalizeTab.bind(this);
		this.ensureTabPreloaded = this.ensureTabPreloaded.bind(this);
		this.scheduleWarmTabs = this.scheduleWarmTabs.bind(this);
		this.runWarmTabs = this.runWarmTabs.bind(this);
		this.clearWarmTimer = this.clearWarmTimer.bind(this);
		this.warmTimer = null;
		this.warmToken = 0;
		this.unmounted = false;

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				const currentTab = this.normalizeTab(this.state.currentTab);
				let hook = this.state.hook;
				if(hook[currentTab] && hook[currentTab].fun){
					hook[currentTab].fun(fields);
				}
			};
		}

	}

	normalizeTab(tab){
		return ValidTabs.indexOf(tab) >= 0 ? tab : 'suzhan';
	}

	componentDidUpdate(prevProps){
		if(prevProps.currentSubTab !== this.props.currentSubTab){
			const nextTab = this.normalizeTab(this.props.currentSubTab);
			if(nextTab !== this.state.currentTab){
				this.setState({
					currentTab: nextTab,
				}, ()=>{
					this.ensureTabPreloaded(nextTab);
					this.scheduleWarmTabs(nextTab);
				});
			}
		}
	}

	componentDidMount(){
		this.unmounted = false;
		this.ensureTabPreloaded(this.state.currentTab);
		this.scheduleWarmTabs(this.state.currentTab);
	}

	componentWillUnmount(){
		this.unmounted = true;
		this.clearWarmTimer();
	}

	clearWarmTimer(){
		if(this.warmTimer){
			clearTimeout(this.warmTimer);
			this.warmTimer = null;
		}
	}

	ensureTabPreloaded(tab){
		const nextTab = this.normalizeTab(tab);
		if(this.unmounted){
			return;
		}
		if(this.state.preloadedTabs && this.state.preloadedTabs[nextTab]){
			return;
		}
		this.setState((prevState)=>{
			if(prevState.preloadedTabs && prevState.preloadedTabs[nextTab]){
				return null;
			}
			return {
				preloadedTabs: {
					...prevState.preloadedTabs,
					[nextTab]: true,
				},
			};
		});
	}

	scheduleWarmTabs(activeTab){
		if(this.unmounted){
			return;
		}
		this.clearWarmTimer();
		const currentTab = this.normalizeTab(activeTab);
		const queue = ValidTabs.filter((key)=>key !== currentTab);
		if(!queue.length){
			return;
		}
		const token = ++this.warmToken;
		this.warmTimer = setTimeout(()=>{
			this.warmTimer = null;
			this.runWarmTabs(token, queue, 0);
		}, CNYIBU_WARM_DELAY_MS);
	}

	runWarmTabs(token, queue, index){
		if(this.unmounted || token !== this.warmToken){
			return;
		}
		if(!queue || index >= queue.length){
			return;
		}
		const nextTab = queue[index];
		this.ensureTabPreloaded(nextTab);
		this.warmTimer = setTimeout(()=>{
			if(this.unmounted || token !== this.warmToken){
				return;
			}
			this.warmTimer = null;
			this.runWarmTabs(token, queue, index + 1);
		}, CNYIBU_WARM_STEP_MS);
	}

	changeTab(key){
		const nextTab = this.normalizeTab(key);
		let hook = this.state.hook;
		this.setState({
			currentTab: nextTab,
		}, ()=>{
			this.ensureTabPreloaded(nextTab);
			if(hook[nextTab] && hook[nextTab].fun){
				hook[nextTab].fun(this.props.fields);
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: nextTab,
					}
				});
			}	
			this.scheduleWarmTabs(nextTab);
		});
	}


	render(){
		const height = resolveBoundedHeight(this.props.height);
		const tab = this.normalizeTab(this.state.currentTab);
		const wrapStyle = {
			height,
			maxHeight: height,
			overflowY: 'auto',
			overflowX: 'hidden',
			position: 'relative',
		};
		const tabsStyle = {
			height,
			maxHeight: height,
			overflow: 'hidden',
		};
		const tabBarStyle = {
			position: 'relative',
			zIndex: 6,
			backgroundColor: '#fff',
			paddingInlineStart: 8,
		};

		return (
			<div id={this.state.divId} style={wrapStyle}>
				<Tabs 
					defaultActiveKey={tab} tabPosition='right'
					activeKey={tab}
					onChange={this.changeTab}
					style={tabsStyle}
					tabBarStyle={tabBarStyle}
				>
					<TabPane tab="宿盘" key="suzhan" forceRender={!!this.state.preloadedTabs.suzhan}>
						<SuZhanMain 
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							hook={this.state.hook.suzhan}
							dispatch={this.props.dispatch}
						/>
					</TabPane>

					<TabPane tab="易卦" key="guazhan" forceRender={!!this.state.preloadedTabs.guazhan}>
						<GuaZhanMain 
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.guazhan}
							dispatch={this.props.dispatch}
						/>
					</TabPane>

					<TabPane tab="六壬" key="liureng" forceRender={!!this.state.preloadedTabs.liureng}>
						<LiuRengMain 
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.liureng}
							dispatch={this.props.dispatch}
						/>
					</TabPane>
					<TabPane tab="金口诀" key="jinkou" forceRender={!!this.state.preloadedTabs.jinkou}>
						<JinKouMain
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.jinkou}
							dispatch={this.props.dispatch}
						/>
					</TabPane>
					<TabPane tab="遁甲" key="dunjia" forceRender={!!this.state.preloadedTabs.dunjia}>
						<DunJiaMain
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.dunjia}
							dispatch={this.props.dispatch}
						/>
					</TabPane>
					<TabPane tab="太乙" key="taiyi" forceRender={!!this.state.preloadedTabs.taiyi}>
						<TaiYiMain
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.taiyi}
							dispatch={this.props.dispatch}
						/>
					</TabPane>
					<TabPane tab="统摄法" key="tongshefa" forceRender={!!this.state.preloadedTabs.tongshefa}>
						<TongSheFaMain
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.tongshefa}
							dispatch={this.props.dispatch}
						/>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default CnYiBuMain;
