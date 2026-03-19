import { Component } from 'react';
import { Tabs, } from 'antd';
import { randomStr } from '../../utils/helper';
import SuZhanMain from '../suzhan/SuZhanMain';
import GuaZhanMain from '../guazhan/GuaZhanMain';
import LiuRengMain from '../lrzhan/LiuRengMain';
import JinKouMain from '../jinkou/JinKouMain';
import DunJiaMain from '../dunjia/DunJiaMain';
import TaiYiMain from '../taiyi/TaiYiMain';
import TongSheFaMain from '../tongshefa/TongSheFaMain';
import styles from './CnYiBuMain.less';

const TabPane = Tabs.TabPane;
const VALID_TABS = ['suzhan', 'guazhan', 'liureng', 'jinkou', 'dunjia', 'taiyi', 'tongshefa'];
const CNYIBU_MIN_HEIGHT = 300;

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
	let h = toNumber(rawHeight);
	if(h === null){
		h = getViewportHeight();
	}
	return Math.max(CNYIBU_MIN_HEIGHT, h);
}

class CnYiBuMain extends Component{
	constructor(props) {
		super(props);
		const tab = this.normalizeTab(this.props.currentSubTab);

		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
			hook:{
				suzhan:{ fun: null },
				guazhan:{ fun: null },
				liureng:{ fun: null },
				jinkou:{ fun: null },
				dunjia:{ fun: null },
				taiyi:{ fun: null },
				tongshefa:{ fun: null },
			},
		};

		this.changeTab = this.changeTab.bind(this);
		this.normalizeTab = this.normalizeTab.bind(this);
		this.renderPane = this.renderPane.bind(this);
		this.isActive = this.isActive.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				const currentTab = this.normalizeTab(this.state.currentTab);
				const hook = this.state.hook;
				if(hook[currentTab] && hook[currentTab].fun){
					hook[currentTab].fun(fields);
				}
			};
		}
	}

	normalizeTab(tab){
		return VALID_TABS.indexOf(tab) >= 0 ? tab : 'suzhan';
	}

	isActive(){
		return this.props.active !== false;
	}

	componentDidUpdate(prevProps){
		if(!this.isActive()){
			return;
		}
		if(prevProps.currentSubTab !== this.props.currentSubTab){
			const nextTab = this.normalizeTab(this.props.currentSubTab);
			if(nextTab !== this.state.currentTab){
				this.setState({
					currentTab: nextTab,
				});
			}
		}
	}

	changeTab(key){
		const nextTab = this.normalizeTab(key);
		if(nextTab === this.state.currentTab){
			return;
		}
		const hook = this.state.hook;
		this.setState({
			currentTab: nextTab,
		}, ()=>{
			if(hook[nextTab] && hook[nextTab].fun){
				hook[nextTab].fun(this.props.fields);
			}
			if(this.props.dispatch && this.isActive()){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: nextTab,
					}
				});
			}
		});
	}

	renderPane(tab, height){
		switch(tab){
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
					showAstroMeaning={this.props.showAstroMeaning}
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
		case 'suzhan':
		default:
			return (
				<SuZhanMain
					active={tab === 'suzhan'}
					value={this.props.chart}
					height={height}
					fields={this.props.fields}
					chartDisplay={this.props.chartDisplay}
					planetDisplay={this.props.planetDisplay}
					hook={this.state.hook.suzhan}
					dispatch={this.props.dispatch}
				/>
			);
		}
	}

	render(){
		const height = resolveBoundedHeight(this.props.height);
		const tab = this.normalizeTab(this.state.currentTab);

		return (
			<div id={this.state.divId} className={styles.root} style={{ height }}>
				<Tabs
					className={styles.tabs}
					tabPosition='right'
					activeKey={tab}
					onChange={this.changeTab}
					destroyInactiveTabPane
					animated={false}
					style={{ height }}
				>
					<TabPane tab="宿盘" key="suzhan">
						{this.renderPane('suzhan', height)}
					</TabPane>
					<TabPane tab="易卦" key="guazhan">
						{this.renderPane('guazhan', height)}
					</TabPane>
					<TabPane tab="六壬" key="liureng">
						{this.renderPane('liureng', height)}
					</TabPane>
					<TabPane tab="金口诀" key="jinkou">
						{this.renderPane('jinkou', height)}
					</TabPane>
					<TabPane tab="遁甲" key="dunjia">
						{this.renderPane('dunjia', height)}
					</TabPane>
					<TabPane tab="太乙" key="taiyi">
						{this.renderPane('taiyi', height)}
					</TabPane>
					<TabPane tab="统摄法" key="tongshefa">
						{this.renderPane('tongshefa', height)}
					</TabPane>
				</Tabs>
			</div>
		);
	}
}

export default CnYiBuMain;
