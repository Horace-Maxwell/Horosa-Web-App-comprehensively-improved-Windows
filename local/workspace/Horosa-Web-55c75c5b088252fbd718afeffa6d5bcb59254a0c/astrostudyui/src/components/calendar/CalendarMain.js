import { Component } from 'react';
import { Row, Col, Tabs, } from 'antd';
import { randomStr } from '../../utils/helper';
import NongLiMain from './NongLiMain';

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
		let height = this.props.height ? this.props.height : 760;
		height = height - 20;

		return (
			<div id={this.state.divId}>
				<Tabs 
					defaultActiveKey={this.state.currentTab} tabPosition='right'
					onChange={this.changeTab}
					style={{ height: height }}
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


				</Tabs>
			</div>
		);
	}
}

export default CalendarMain;
