import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import { randomStr } from '../../utils/helper';
import NongLiMain from './NongLiMain';
import HuangLiMain from './HuangLiMain';
import TongshuMain from './TongshuMain';
import RiziMain from './RiziMain';

const TabPane = Tabs.TabPane;

class CalendarMain extends Component{

	constructor(props) {
		super(props);

		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: 'nongli',
			hook:{
				nongli:{
					fun: null
				},
				huangli:{
					fun: null
				},
				tongshu:{
					fun: null
				},
				rizi:{
					fun: null
				},
				xingli:{
					fun: null
				},

			},
		};

		this.changeTab = this.changeTab.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					hook[this.state.currentTab].fun(fields);
				}
			};
		}

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
		// 填满整页高度（原按 props.height-20 固定像素，比实际页面矮 ~66px 留大片空白）；
		// 子 main 皆已支持 '100%'（内部转 calc）。配合 CSS 让 tab 内容链 height:100% 逐层撑满。
		const height = '100%';

		return (
			<div id={this.state.divId} className='horosa-calendar-page'>
				<Tabs
					defaultActiveKey={this.state.currentTab} tabPosition='right'
					onChange={this.changeTab}
					className='horosa-calendar-tabs'
					style={{ height: '100%' }}
				>
					<TabPane tab="农历" key="nongli">
						<NongLiMain
							height={height}
							fields={this.props.fields}
							days={this.state.days}
							predDays={this.state.predDays}
							dispatch={this.props.dispatch}
							hook={this.state.hook.nongli}
						/>
					</TabPane>

					<TabPane tab="老黄历" key="huangli">
						<HuangLiMain
							height={height}
							fields={this.props.fields}
							dispatch={this.props.dispatch}
							hook={this.state.hook.huangli}
						/>
					</TabPane>

					<TabPane tab="通书择日" key="tongshu">
						<TongshuMain
							height={height}
							fields={this.props.fields}
							dispatch={this.props.dispatch}
							hook={this.state.hook.tongshu}
						/>
					</TabPane>

					<TabPane tab="日子馆" key="rizi">
						<RiziMain
							height={height}
							fields={this.props.fields}
							dispatch={this.props.dispatch}
							hook={this.state.hook.rizi}
						/>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default CalendarMain;
