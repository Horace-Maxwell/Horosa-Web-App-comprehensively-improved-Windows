import { Component } from 'react';
import { Row, Col, Tabs, } from 'antd';
import { randomStr } from '../../utils/helper';
import LivePlayer from './LivePlayer';
import MediaPlayer from './MediaPlayer';
import RtspPlayer from './RtspPlayer';
import { HasRtspPlayer, } from '../../utils/constants';

const TabPane = Tabs.TabPane;

class MediaMain extends Component{

	constructor(props) {
		super(props);

		this.hasBaobaoVideo = HasRtspPlayer && this.props.admin;

		this.state = {
			divId: 'div_' + randomStr(8),
			currentTab: this.hasBaobaoVideo ? 'baobao' : 'live',
			hook:{
				baobao:{
					fun: null
				},
				live:{
					fun: null
				},
				player:{
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
		if(HasRtspPlayer && this.props.admin){
			this.hasBaobaoVideo = true;
		}else{
			this.hasBaobaoVideo = false;
		}

		let curTab = this.state.currentTab;
		if(curTab === 'baobao' && !this.hasBaobaoVideo){
			curTab = 'live';
		}

		return (
			<div id={this.state.divId}>
				<Tabs 
					defaultActiveKey={curTab} tabPosition='right'
					onChange={this.changeTab}
					style={{ height: height }}
				>
					{
						this.hasBaobaoVideo && (
							<TabPane tab="宝宝视频" key="baobao">
								<RtspPlayer 
									height={height}
									dispatch={this.props.dispatch}
									hook={this.state.hook.baobao}
								/>
							</TabPane>	
						)
					}
					<TabPane tab="直播" key="live">
						<LivePlayer 
							height={height}
							dispatch={this.props.dispatch}
							hook={this.state.hook.live}
						/>
					</TabPane>
					<TabPane tab="播放器" key="player">
						<MediaPlayer 
							height={height}
							dispatch={this.props.dispatch}
							hook={this.state.hook.live}
						/>
					</TabPane>


				</Tabs>
			</div>
		);
	}
}

export default MediaMain;
