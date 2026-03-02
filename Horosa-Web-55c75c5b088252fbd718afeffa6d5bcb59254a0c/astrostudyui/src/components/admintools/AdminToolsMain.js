import { Component } from 'react';
import { Row, Col, Tabs, } from 'antd';
import { randomStr } from '../../utils/helper';
import LogQryMain from '../logqry/LogQryMain';
import Statis from '../statis/Statis';
import DLStatis from '../deeplearn/DLStatis';
import BackupTool from './BackupTool';
import BookMain from '../reader/BookMain';
import LiveMgmt from '../multimedia/LiveMgmt';
import UserMgmt from '../user/UserMgmt';

const TabPane = Tabs.TabPane;

class AdminToolsMain extends Component{

	constructor(props) {
		super(props);

		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: 'livemgmt',
			hook:{
				statis:{
					fun: null
				},
				logqry:{
					fun: null
				},
				deeplearn:{
					fun: null
				},
				bookmgmt:{
					fun: null
				},
				livemgmt:{
					fun: null
				},
				usermgmt:{
					fun: null
				},
				backup:{
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
		let height = document.documentElement.clientHeight;
		height = height - 80;

		return (
			<div id={this.state.divId}>
				<Tabs 
					defaultActiveKey={this.state.currentTab} tabPosition='right'
					onChange={this.changeTab}
					style={{ height: height }}
				>
					<TabPane tab="直播管理" key="livemgmt">
						<LiveMgmt 
							height={height}
							dispatch={this.props.dispatch}
							hook={this.state.hook.livemgmt}
						/>
					</TabPane>

					<TabPane tab="用户管理" key="usermgmt">
						<UserMgmt 
							height={height}
							dispatch={this.props.dispatch}
							hook={this.state.hook.usermgmt}
						/>
					</TabPane>

					<TabPane tab="书籍管理" key="bookmgmt">
						<BookMain 
							bookmgmt={true}
							height={height}
							dispatch={this.props.dispatch}
							hook={this.state.hook.bookmgmt}
						/>
					</TabPane>

					<TabPane tab="日志查询" key="logqry">
						<LogQryMain 
							height={height}
							dispatch={this.props.dispatch}
							hook={this.state.hook.logqry}
						/>
					</TabPane>

					<TabPane tab="统计" key="statis">
						<Statis 
							height={height}
							dispatch={this.props.dispatch}
							hook={this.state.hook.statis}
						/>
					</TabPane>

					<TabPane tab="数据备份" key="backup">
						<BackupTool 
							height={height}
							dispatch={this.props.dispatch}
							hook={this.state.hook.backup}
						/>
					</TabPane>

					<TabPane tab="深度学习" key="deeplearn">
						<DLStatis 
							height={height}
							dispatch={this.props.dispatch}
							hook={this.state.hook.deeplearn}
						/>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default AdminToolsMain;
