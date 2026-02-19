import { Component } from 'react';
import { Icon, message, Row, Col, Drawer, List, Typography, Button, Select, Dropdown, Menu} from 'antd';
import { randomStr } from '../../utils/helper';
import { ServerRoot, } from '../../utils/constants';
import { requestRaw, } from '../../utils/request';


class ReaderTTS extends Component{

	constructor(props) {
		super(props);

		this.state = {
			auditId: 'audit' + randomStr(8),
			speed: 180,
		}

		this.requestTTS = this.requestTTS.bind(this);
		this.ttsEnd = this.ttsEnd.bind(this);
	}

	async requestTTS(txt, speed){
		if(txt === undefined || txt === null || txt === ''){
			return;
		}

		const params = {
			Text: txt,
			Speed: speed,
		}

		const blob = await requestRaw(`${ServerRoot}/astroreader/tts`, {
			body: JSON.stringify(params),
		});

		let audio = document.getElementById(this.state.auditId);
		if(audio){
			audio.pause();
			audio.type = "audio/mpeg";
			audio.src = window.webkitURL.createObjectURL(blob)|| URL.createObjectURL(blob);
			audio.currentTime = 0;
			audio.load();
			audio.play();
		}
	}

	ttsEnd(){
		if(this.props.audioEnd){
			this.props.audioEnd();
		}
	}

	componentDidMount(){
		
	}

	render(){
		let speed = this.props.speed ? this.props.speed : this.state.speed;
		let txt = this.props.text ? this.props.text : '';
		this.requestTTS(txt, speed);

		return (
			<audio id={this.state.auditId} controls style={{width: '100%'}} onEnded={this.ttsEnd} />
		)
	}

}

export default ReaderTTS;

