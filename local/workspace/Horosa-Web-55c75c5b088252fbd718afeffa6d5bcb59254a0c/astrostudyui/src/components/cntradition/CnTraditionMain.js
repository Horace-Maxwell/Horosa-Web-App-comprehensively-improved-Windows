import { Component } from 'react';
import { Row, Col, Tabs, } from 'antd';
import { randomStr } from '../../utils/helper';
import BaZi from './BaZi';
import ZiWeiMain from '../ziwei/ZiWeiMain';
import GuaSymDesc from '../gua/GuaSymDesc';
import CuanGong12 from '../commtools/CuanGong12';
import BaziPithy from '../commtools/BaziPithy';

const TabPane = Tabs.TabPane;
const CN_TRADITION_TAB_KEYS = ['bazi', 'ziwei', 'guasym', 'cuangong12', 'pithy'];
const CN_TRADITION_WARM_DELAY_MS = 120;
const CN_TRADITION_WARM_STEP_MS = 160;

class CnTraditionMain extends Component{

	constructor(props) {
		super(props);

		let tab = this.props.currentSubTab ? this.props.currentSubTab : 'bazi';
		const preloadedTabs = {
			bazi: tab === 'bazi',
			ziwei: tab === 'ziwei',
			guasym: tab === 'guasym',
			cuangong12: tab === 'cuangong12',
			pithy: tab === 'pithy',
		};
		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
			preloadedTabs,
			hook:{
				bazi:{
					fun: null
				},
				ziwei:{
					fun: null
				},
				guasym:{
					fun: null
				},
				cuangong12: {
					fun: null
				},
				pithy: {
					fun: null
				},
			},
		};

		this.changeTab = this.changeTab.bind(this);
		this.findTab = this.findTab.bind(this);
		this.ensureTabPreloaded = this.ensureTabPreloaded.bind(this);
		this.scheduleWarmTabs = this.scheduleWarmTabs.bind(this);
		this.runWarmTabs = this.runWarmTabs.bind(this);
		this.clearWarmTimer = this.clearWarmTimer.bind(this);
		this.warmTimer = null;
		this.warmToken = 0;
		this.unmounted = false;

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				let subtab = this.findTab();
				if(hook[subtab].fun){
					hook[subtab].fun(fields);
				}
				setTimeout(()=>{
					if(this.props.dispatch){
						this.props.dispatch({
							type: 'astro/save',
							payload: {
								currentSubTab: subtab,
							}
						});
					}			
				}, 500);
			};
		}

	}

	findTab(){
		let subtab = this.state.currentTab ? this.state.currentTab : 'bazi';
		for(let key in this.state.hook){
			if(key === subtab){
				return key;
			}
		}
		let key = 'bazi';
		return key;
	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
		}, ()=>{
			this.ensureTabPreloaded(key);
			if(hook[key].fun){
				hook[key].fun(this.props.fields);
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: key,
					}
				});
			}	
			this.scheduleWarmTabs(key);
		});
	}

	componentDidMount(){
		this.unmounted = false;
		this.ensureTabPreloaded(this.state.currentTab);
		this.scheduleWarmTabs(this.state.currentTab);
	}

	componentDidUpdate(prevProps){
		if(prevProps.currentSubTab !== this.props.currentSubTab){
			const nextTab = this.props.currentSubTab || 'bazi';
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
		if(this.unmounted){
			return;
		}
		this.clearWarmTimer();
		const queue = CN_TRADITION_TAB_KEYS.filter((key)=>key !== activeTab);
		if(!queue.length){
			return;
		}
		const token = ++this.warmToken;
		this.warmTimer = setTimeout(()=>{
			this.warmTimer = null;
			this.runWarmTabs(token, queue, 0);
		}, CN_TRADITION_WARM_DELAY_MS);
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
		}, CN_TRADITION_WARM_STEP_MS);
	}


	render(){
		let height = this.props.height ? this.props.height : 760;
		height = height - 20;
		let tab = this.findTab();

		return (
			<div id={this.state.divId}>
				<Tabs 
					defaultActiveKey={tab} tabPosition='right'
					activeKey={tab}
					onChange={this.changeTab}
					style={{ height: height }}
				>
					<TabPane tab="八字" key="bazi" forceRender={!!this.state.preloadedTabs.bazi}>
						<BaZi 
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.bazi}
							dispatch={this.props.dispatch}
						/>
					</TabPane>

					<TabPane tab="紫微斗数" key="ziwei" forceRender={!!this.state.preloadedTabs.ziwei}>
						<ZiWeiMain 
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.ziwei}
							dispatch={this.props.dispatch}
						/>
					</TabPane>

					<TabPane tab="八卦类象" key="guasym" forceRender={!!this.state.preloadedTabs.guasym}>
						<GuaSymDesc />
					</TabPane>

					<TabPane tab="十二串宫" key="cuangong12" forceRender={!!this.state.preloadedTabs.cuangong12}>
						<CuanGong12 />
					</TabPane>

					<TabPane tab="八字规则" key="pithy" forceRender={!!this.state.preloadedTabs.pithy}>
						<BaziPithy />
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default CnTraditionMain;
