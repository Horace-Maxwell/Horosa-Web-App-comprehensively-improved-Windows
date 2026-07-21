import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import { randomStr } from '../../utils/helper';
import GuaSymDesc from '../gua/GuaSymDesc';
import TechniqueErrorBoundary from '../common/TechniqueErrorBoundary';
import CuanGong12 from '../commtools/CuanGong12';
import BaziPithy from '../commtools/BaziPithy';

const TabPane = Tabs.TabPane;

class CnTraditionMain extends Component{

	constructor(props) {
		super(props);

		const subtab = this.props.currentSubTab ? this.props.currentSubTab : 'guasym';
		const validTabs = ['guasym', 'cuangong12', 'pithy'];
		const tab = validTabs.indexOf(subtab) >= 0 ? subtab : 'guasym';
		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: tab,
			hook:{
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

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				let subtab = this.findTab();
				if(hook[subtab] && hook[subtab].fun){
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
		let subtab = this.state.currentTab ? this.state.currentTab : 'guasym';
		for(let key in this.state.hook){
			if(key === subtab){
				return key;
			}
		}
		let key = 'guasym';
		return key;
	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
		}, ()=>{
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
		});
	}


	render(){
		// 根 Tabs 改充满父面板（原 props.height-20 定死像素高 → 底部黑条）。
		let tab = this.findTab();

		return (
			<div id={this.state.divId} className="horosa-cntradition-page">
				<Tabs
					defaultActiveKey={tab} tabPosition='right'
					className="xq-tabs-rail"
					activeKey={tab}
					onChange={this.changeTab}
					style={{ height: '100%', minHeight: 0 }}
				>
					<TabPane tab="八卦类象" key="guasym">
						<TechniqueErrorBoundary label="八卦类象"><GuaSymDesc /></TechniqueErrorBoundary>
					</TabPane>

					<TabPane tab="十二串宫" key="cuangong12">
						<TechniqueErrorBoundary label="十二串宫"><CuanGong12 /></TechniqueErrorBoundary>
					</TabPane>

					<TabPane tab="八字规则" key="pithy">
						<TechniqueErrorBoundary label="八字规则"><BaziPithy /></TechniqueErrorBoundary>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default CnTraditionMain;
