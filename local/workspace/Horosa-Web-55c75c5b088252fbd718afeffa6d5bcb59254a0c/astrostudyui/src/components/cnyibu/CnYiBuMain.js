import { Component } from 'react';
import { randomStr } from '../../utils/helper';
import SuZhanMain from '../suzhan/SuZhanMain';
import GuaZhanMain from '../guazhan/GuaZhanMain';
import LiuRengMain from '../lrzhan/LiuRengMain';
import JinKouMain from '../jinkou/JinKouMain';
import DunJiaMain from '../dunjia/DunJiaMain';
import TaiYiMain from '../taiyi/TaiYiMain';
import TongSheFaMain from '../tongshefa/TongSheFaMain';
import styles from '../../css/styles.less';

const ValidTabs = ['suzhan', 'guazhan', 'liureng', 'jinkou', 'dunjia', 'taiyi', 'tongshefa'];
const CNYIBU_VIEWPORT_GAP = 22;
const CNYIBU_MIN_HEIGHT = 300;
const CNYIBU_WARM_DELAY_MS = 120;
const CNYIBU_WARM_STEP_MS = 150;
const CNYIBU_NAV_ITEMS = [
	{ key: 'suzhan', label: '宿盘' },
	{ key: 'guazhan', label: '易卦' },
	{ key: 'liureng', label: '六壬' },
	{ key: 'jinkou', label: '金口诀' },
	{ key: 'dunjia', label: '遁甲' },
	{ key: 'taiyi', label: '太乙' },
	{ key: 'tongshefa', label: '统摄法' },
];

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
		this.isCnYiBuActive = this.isCnYiBuActive.bind(this);
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
		if(prevProps.currentSubTab !== this.props.currentSubTab && this.isCnYiBuActive()){
			const nextIncomingTab = this.props.currentSubTab;
			if(ValidTabs.indexOf(nextIncomingTab) < 0){
				return;
			}
			const nextTab = this.normalizeTab(nextIncomingTab);
			if(nextTab && nextTab !== this.state.currentTab){
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

	isCnYiBuActive(){
		return !this.props.currentTab || this.props.currentTab === 'cnyibu';
	}

	clearWarmTimer(){
		if(this.warmTimer){
			clearTimeout(this.warmTimer);
			this.warmTimer = null;
		}
	}

	ensureTabPreloaded(tab){
		if(!tab || this.unmounted){
			return;
		}
		if(this.state.preloadedTabs && this.state.preloadedTabs[tab]){
			return;
		}
		this.setState((prevState)=>{
			if(prevState.preloadedTabs && prevState.preloadedTabs[tab]){
				return null;
			}
			return {
				preloadedTabs: {
					...prevState.preloadedTabs,
					[tab]: true,
				},
			};
		});
	}

	scheduleWarmTabs(activeTab){
		if(this.unmounted || !this.isCnYiBuActive()){
			return;
		}
		this.clearWarmTimer();
		const queue = ValidTabs.filter((key)=>key !== activeTab);
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

	renderTabPane(tabKey, height){
		switch(tabKey){
			case 'suzhan':
				return (
					<SuZhanMain
						value={this.props.chart}
						height={height}
						fields={this.props.fields}
						chartDisplay={this.props.chartDisplay}
						planetDisplay={this.props.planetDisplay}
						hook={this.state.hook.suzhan}
						dispatch={this.props.dispatch}
					/>
				);
			case 'guazhan':
				return (
					<GuaZhanMain
						value={this.props.chart}
						height={height}
						fields={this.props.fields}
						hook={this.state.hook.guazhan}
						dispatch={this.props.dispatch}
					/>
				);
			case 'liureng':
				return (
					<LiuRengMain
						value={this.props.chart}
						height={height}
						fields={this.props.fields}
						hook={this.state.hook.liureng}
						dispatch={this.props.dispatch}
					/>
				);
			case 'jinkou':
				return (
					<JinKouMain
						value={this.props.chart}
						height={height}
						fields={this.props.fields}
						hook={this.state.hook.jinkou}
						dispatch={this.props.dispatch}
					/>
				);
			case 'dunjia':
				return (
					<DunJiaMain
						value={this.props.chart}
						height={height}
						fields={this.props.fields}
						hook={this.state.hook.dunjia}
						dispatch={this.props.dispatch}
					/>
				);
			case 'taiyi':
				return (
					<TaiYiMain
						value={this.props.chart}
						height={height}
						fields={this.props.fields}
						hook={this.state.hook.taiyi}
						dispatch={this.props.dispatch}
					/>
				);
			case 'tongshefa':
				return (
					<TongSheFaMain
						value={this.props.chart}
						height={height}
						fields={this.props.fields}
						hook={this.state.hook.tongshefa}
						dispatch={this.props.dispatch}
					/>
				);
			default:
				return null;
		}
	}


	render(){
		const height = resolveBoundedHeight(this.props.height);
		const tab = this.normalizeTab(this.state.currentTab);
		const wrapStyle = {
			height,
			maxHeight: height,
			overflow: 'hidden',
			overflowX: 'hidden',
			position: 'relative',
		};
		const dockStyle = {
			height,
			maxHeight: height,
		};

		return (
			<div id={this.state.divId} style={wrapStyle}>
				<div className={styles.cnYiBuDock} style={dockStyle}>
					<div className={styles.cnYiBuContent}>
						{ValidTabs.map((key)=>{
							if(!this.state.preloadedTabs[key]){
								return null;
							}
							const active = key === tab;
							return (
								<div
									key={key}
									className={`${styles.cnYiBuPane} ${active ? styles.cnYiBuPaneActive : ''}`}
									aria-hidden={!active}
								>
									{this.renderTabPane(key, height)}
								</div>
							);
						})}
					</div>
					<div className={styles.cnYiBuSideNav} role="tablist" aria-label="易与三式子项">
						{CNYIBU_NAV_ITEMS.map((item)=>(
							<button
								key={item.key}
								type="button"
								role="tab"
								aria-selected={tab === item.key}
								className={`${styles.cnYiBuNavButton} ${tab === item.key ? styles.cnYiBuNavButtonActive : ''}`}
								onClick={()=>this.changeTab(item.key)}
							>
								{item.label}
							</button>
						))}
					</div>
				</div>
			</div>
		);
	}
}

export default CnYiBuMain;
