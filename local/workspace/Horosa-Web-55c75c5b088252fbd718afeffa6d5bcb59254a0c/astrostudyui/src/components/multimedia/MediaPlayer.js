import { Component } from 'react';
import { Row, Col } from 'antd';
import { XQButton as Button, XQInput as Input } from '../xq-ui';
import StreamPlayer from './StreamPlayer';

import { getLayoutViewportHeight } from '../../utils/shellZoom';   // 版面尺寸一律读布局域(壳缩放下 documentElement.client* 恒为物理域)
class MediaPlayer extends Component{

	constructor(props) {
		super(props);
		this.state = {
			url: null,
			realUrl: null
		};

		this.doClear = {fun: null};

		this.changeUrl = this.changeUrl.bind(this);
		this.clickPlay = this.clickPlay.bind(this);
		this.clickDispose = this.clickDispose.bind(this);
	}

	changeUrl(e){
		this.setState({
			url: e.target.value,
		});
	}

	clickPlay(){
		this.setState({
			realUrl: this.state.url,
		});
	}

	clickDispose(){
		if(this.doClear.fun){
			this.doClear.fun();
		}
		this.setState({
			realUrl: null,
			url: null,
		});
	}


	render(){
		let height = this.props.height ? this.props.height : getLayoutViewportHeight() - 80;
		height = height - 100;

		return (
			<div>				
				<Row gutter={16} style={{marginBottom: 10}}>
					<Col span={18}><Input value={this.state.url} onChange={this.changeUrl} placeholder='音视频URL，只支持mp3, mp4, ogg, webm, flv, rtmp, hls(.m3u8)等音视频格式' style={{width: '100%',}}/></Col>
					<Col span={3}>
						<Button onClick={this.clickPlay}>获取视频</Button>
					</Col>
					<Col span={3}>
						<Button onClick={this.clickDispose}>清除视频</Button>
					</Col>
				</Row>
				<StreamPlayer 
					height={height}
					url={this.state.realUrl}
					autoplay={true}
					doClear={this.doClear}
				/>
			</div>
		)
	}
}

export default MediaPlayer;
