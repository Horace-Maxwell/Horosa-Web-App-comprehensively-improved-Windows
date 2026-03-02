import { Component } from 'react';
import flvjs from 'flv.js';
import { Row, Col, Input, InputNumber, Typography, Button, Select, Dropdown, Menu} from 'antd';
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { randomStr } from '../../utils/helper';
import { ServerRoot, ResultKey} from '../../utils/constants';
import request from '../../utils/request';
import StreamPlayer from './StreamPlayer';


class RtspPlayer extends Component{

	constructor(props) {
		super(props);

		this.state = {
			url: null,
			disableResart: false,
		}

		this.doClear = {fun: null};

		this.requestUrl = this.requestUrl.bind(this);
		this.requestRestartSrv = this.requestRestartSrv.bind(this);

		this.clickDispose = this.clickDispose.bind(this);
		this.clickPlay = this.clickPlay.bind(this);
		this.clickRestarLiveSrv = this.clickRestarLiveSrv.bind(this);
	}

	async requestUrl(idx){
		const params = { 
			index: idx,
		};

		const data = await request(`${ServerRoot}/astroreader/flvurl`, {
			body: JSON.stringify(params),
		});

		const result = data[ResultKey];

		let url = result.Url;	
		url = url.replace('spacex.f3322.net', 'zyqspace.7766.org');
		this.setState({
			url: url,
		});
	}

	async requestRestartSrv(){
		const params = { };

		const data = await request(`${ServerRoot}/astroreader/restartlive`, {
			body: JSON.stringify(params),
		});

	}

	clickPlay(idx){
		this.requestUrl(idx);
	}

	clickDispose(){
		if(this.doClear.fun){
			this.doClear.fun();
		}
		this.setState({
			url: null,
		});
	}

	clickRestarLiveSrv(){
		this.requestRestartSrv();
	}

	render(){
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 80;
		height = height - 100;

		return (
			<div>				
				<Row gutter={16} style={{marginBottom: 10}}>
					<Col span={3}>
						<Button onClick={()=>{this.clickPlay(1);}}>获取视频1</Button>
					</Col>
					<Col span={3}>
						<Button onClick={()=>{this.clickPlay(2);}}>获取视频2</Button>
					</Col>
					<Col span={3}>
						<Button onClick={this.clickDispose}>清除视频</Button>
					</Col>
					<Col span={4}>
						<Button onClick={this.clickRestarLiveSrv} disabled={this.state.disableResart}>重启视频服务</Button>
					</Col>
				</Row>
				<StreamPlayer 
					height={height}
					url={this.state.url}
					type='flv'
					autoplay={true}
					doClear={this.doClear}
				/>
			</div>
		)
	}

}

export default RtspPlayer;

