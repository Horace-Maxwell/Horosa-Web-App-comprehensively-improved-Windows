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

class CnYiBuMain extends Component{

	constructor(props) {
		super(props);
		const tab = this.normalizeTab(this.props.currentSubTab);

		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
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
				});
			}
		}
	}

	changeTab(key){
		const nextTab = this.normalizeTab(key);
		let hook = this.state.hook;
		this.setState({
			currentTab: nextTab,
		}, ()=>{
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
		});
	}


	render(){
		let height = this.props.height ? this.props.height : 760;
		height = height - 20;
		const tab = this.normalizeTab(this.state.currentTab);

		return (
			<div id={this.state.divId}>
				<Tabs 
					defaultActiveKey={tab} tabPosition='right'
					activeKey={tab}
					onChange={this.changeTab}
					style={{ height: height }}
				>
					<TabPane tab="宿盘" key="suzhan">
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

					<TabPane tab="易卦" key="guazhan">
						<GuaZhanMain 
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.guazhan}
							dispatch={this.props.dispatch}
						/>
					</TabPane>

					<TabPane tab="六壬" key="liureng">
						<LiuRengMain 
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.liureng}
							dispatch={this.props.dispatch}
						/>
					</TabPane>
					<TabPane tab="金口诀" key="jinkou">
						<JinKouMain
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.jinkou}
							dispatch={this.props.dispatch}
						/>
					</TabPane>
					<TabPane tab="遁甲" key="dunjia">
						<DunJiaMain
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.dunjia}
							dispatch={this.props.dispatch}
						/>
					</TabPane>
					<TabPane tab="太乙" key="taiyi">
						<TaiYiMain
							value={this.props.chart}
							height={height}
							fields={this.props.fields}
							hook={this.state.hook.taiyi}
							dispatch={this.props.dispatch}
						/>
					</TabPane>
					<TabPane tab="统摄法" key="tongshefa">
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
