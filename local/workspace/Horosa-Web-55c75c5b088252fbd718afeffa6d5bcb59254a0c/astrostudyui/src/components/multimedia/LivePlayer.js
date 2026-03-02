import { Component } from 'react';
import flvjs from 'flv.js';
import { Row, Col, Input, InputNumber, Typography, Button, Select, Dropdown, Modal,} from 'antd';
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { randomStr } from '../../utils/helper';
import { ServerRoot, ResultKey, RtmpPlayServer, RtmpPushServer} from '../../utils/constants';
import request from '../../utils/request';
import LiveStreamsModal from './LiveStreamsModal';
import StreamPlayer from './StreamPlayer';

const Search = Input.Search;

class LivePlayer extends Component{

	constructor(props) {
		super(props);

		this.state = {
			url: null,
			stream: null,
			liveName: null,
		}

		this.doClear = {fun: null};

		this.requestPlayUrl = this.requestPlayUrl.bind(this);
		this.requestPushUrl = this.requestPushUrl.bind(this);

		this.clickPlay = this.clickPlay.bind(this);
		this.clickPush = this.clickPush.bind(this);
		this.clickDispose = this.clickDispose.bind(this);

		this.selectStream = this.selectStream.bind(this);
		this.changeLiveName = this.changeLiveName.bind(this);
	}

	async requestPushUrl(){
		const params = { 
			stream: this.state.liveName,
		};

		const data = await request(`${ServerRoot}/astroreader/livepublishpath`, {
			body: JSON.stringify(params),
		});

		const result = data[ResultKey];

		let url = `${RtmpPushServer}${result.Path}`;	

		Modal.info({
			title: '现在可以用直播软件推送直播流到如下url，2分钟内有效',
			content: (
				<div>
					<p>{url}</p>
				</div>
			)
		})
	}

	async requestPlayUrl(){
		if(this.state.stream === null){
			Modal.error({
				title: '请选择一个直播频道',
			});
			return;
		}

		const params = { 
			key: this.state.stream.Key,
		};

		const data = await request(`${ServerRoot}/live/playpath`, {
			body: JSON.stringify(params),
		});

		const result = data[ResultKey];

		let url = `${RtmpPlayServer}${result.Path}`;	
		this.setState({
			url: url,
		});
	}

	clickPlay(){
		this.requestPlayUrl();
	}

	clickDispose(){
		if(this.doClear.fun){
			this.doClear.fun();
		}
		this.setState({
			url: null,
			stream: null,
		});
	}

	selectStream(rec){
		this.setState({
			stream: rec,
		}, ()=>{
			this.clickPlay();
		});
	}

	changeLiveName(e){
		this.setState({
			liveName: e.target.value,
		});
	}

	clickPush(){
		this.requestPushUrl();
	}

	componentDidMount(){

	}

	render(){
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 80;
		height = height - 100;

		return (
			<div>				
				<Row gutter={16} style={{marginBottom: 10}}>
					<Col span={6}>
						<LiveStreamsModal onOk={this.selectStream}>
							<Search placeholder="选择直播频道" readOnly enterButton value={this.state.stream ? this.state.stream.Stream : null}/>
						</LiveStreamsModal>
					</Col>

					<Col span={3}>
						<Button onClick={this.clickPlay}>获取视频</Button>
					</Col>
					<Col span={3}>
						<Button onClick={this.clickDispose}>清除视频</Button>
					</Col>
					<Col offset={4} span={5}>
						<Input value={this.state.liveName} onChange={this.changeLiveName} placeholder='直播名称' />
					</Col>
					<Col span={3}>
						<Button onClick={this.clickPush}>亲自直播</Button>
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

export default LivePlayer;

