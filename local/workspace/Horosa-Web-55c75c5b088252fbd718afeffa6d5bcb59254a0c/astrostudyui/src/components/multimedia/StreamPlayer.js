import flvjs from 'flv.js';
import videojs from 'video.js';
import videojsflash from 'videojs-flash';
import { Component } from 'react';
import { Chart3DServer, } from '../../utils/constants';
import { randomStr, handleError, startWith, endWith, } from '../../utils/helper';

class StreamPlayer extends Component{

	constructor(props) {
		super(props);

		this.state = {
			mediaId: 'media_' + randomStr(8),	
			divId: 'div' + randomStr(8),	
			url: null,
			type: null,
		}

		this.genFlv = this.genFlv.bind(this);
		this.genVideo = this.genVideo.bind(this);
		this.genPlayer = this.genPlayer.bind(this);
		this.genVideoDom = this.genVideoDom.bind(this);
		this.innerCreatePlayer = this.innerCreatePlayer.bind(this);

		this.dispose = this.dispose.bind(this);

		if(this.props.doDispose){
			this.props.doDispose.fun = ()=>{
				this.dispose();
			}
		}
		if(this.props.doClear){
			this.props.doClear.fun = ()=>{
				this.genVideoDom();
			}
		}
	}

	dispose(){
		if(this.player){
			try{
				this.player.destroy();
			}catch(e){
			}
			this.player = null;
		}
		if(this.videoPlayer){
			try{
				this.videoPlayer.dispose();
			}catch(e){
			}
			this.videoPlayer = null;
		}
		this.disposed = true;
	}

	genVideoDom(){
		let div = document.getElementById(this.state.divId);
		if(div === undefined || div === null){
			return false;
		}

		this.dispose();

		let dom = document.createElement("video");
		dom.id = this.state.mediaId;
		dom.controls = 'controls';
		if(this.props.autoplay){
			dom.autoplay = 'autoplay';
		}
		if(this.props.poster){
			dom.poster = this.props.poster;
		}
		dom.style.width = '100%';
		dom.style.height = '100%';

		let type = this.props.type ? this.props.type : 'flv'
		if(startWith(type, 'rtmp') || endWith(type, 'x-mpegURL')){
			dom.className = 'video-js';
		}

		let olddom = document.getElementById(this.state.mediaId);
		if(olddom){
			olddom.parentNode.removeChild(olddom);
		}

		if(div){
			div.appendChild(dom);
		}

		this.disposed = false;

		return true;
	}

	genPlayer(){
		let url = this.props.url;
		let type = this.props.type;
		if(url === undefined || url === null){
			return;
		}

		this.genVideoDom();
		console.log(url);

		try{
			this.innerCreatePlayer(url, type);
		}catch(e){
			handleError(e);
		}
	}

	innerCreatePlayer(url, type){
		if(startWith(url, 'rtmp://')){
			type = 'rtmp/flv';
			this.genVideo(url, type);
		}else if(startWith(url, 'hls://') || endWith(url, '.m3u8')){
			type = 'application/x-mpegURL';
			this.genVideo(url, type);
		}else if(endWith(url, '.mp4') || endWith(url, '.mkv') || endWith(url, '.wmv')){
			type = 'video/mp4';
			this.genFlv(url, type);
		}else if(endWith(url, '.webm')){
			type = 'video/webm';
			this.genFlv(url, type);
		}else if(endWith(url, '.ogv')){
			type = 'video/ogv';
			this.genFlv(url, type);
		}else if(endWith(url, '.mp3')){
			type = 'audio/mp3';
			this.genFlv(url, type);
		}else if(endWith(url, '.ogg')){
			type = 'video/ogg';
			this.genFlv(url, type);
		}else{
			if(type === undefined || type === null){
				type = 'flv';
			}
			this.genFlv(url, type);
		}
	}

	genFlv(url, type){
		const videoElem = document.getElementById(this.state.mediaId);
		if(this.player){
			this.player.destroy();
		}
		this.player = flvjs.createPlayer({
			isLive: true,
			type: type,
			url: url,
		});
		this.player.on(flvjs.Events.ERROR, (e)=>{
			handleError(e);
		});
		
		this.player.attachMediaElement(videoElem);
		this.player.load();
		if(this.props.autoplay){
			this.player.play();
		}
	}

	genVideo(url, type){
		let techOrder = ['html5'];
		if(startWith(type, 'rtmp')){
			techOrder = ['flash', 'html5'];
		}
		let autplay = this.props.autoplay ? true : false;
		let opt = {
			poster: this.props.poster,
			autoplay: autplay,
			controls: true,
			techOrder: techOrder,
			sources: [{
				src: url,
				type: type,
			}],
			flash: {
				swf: `${Chart3DServer}/static/video-js.swf`,
			},
		};

		if(this.videoPlayer){
			this.genVideoDom();
		}
		
		let div = document.getElementById(this.state.mediaId);
		let cls = div.className;
		if(!startWith(cls, 'video-js')){
			div.className = 'video-js ' + cls;
		}
		try{
			this.videoPlayer = videojs(this.state.mediaId, opt, ()=>{
				if(this.props.autoplay){
					this.videoPlayer.play();
				}
			});			
		}catch(e){
			handleError(e);
		}
	}
	
	componentWillUnmount(){
		this.dispose();
	}


	render(){
		let height = this.props.height ? this.props.height : 600;

		let clsname = null;
		if(this.props.url){
			let url = this.props.url;
			if(startWith(url, 'rtmp://') || endWith(url, '.m3u8')){
				clsname = 'video-js';
			}
		}else{
			let type = this.props.type ? this.props.type : 'flv'
			if(startWith(type, 'rtmp') || endWith(type, 'x-mpegURL')){
				clsname = 'video-js';
			}	
		}

		setTimeout(()=>{
			if(this.props.url !== this.state.url || this.disposed){
				this.setState({
					url: this.props.url,
					type: this.props.type,
				}, ()=>{
					this.genPlayer();
				});
			}
		}, 500);

		return (
			<div id={this.state.divId} style={{height:height, backgroundColor: '#000000'}}>
				<video 
					id={this.state.mediaId} controls
					className={clsname}
					poster={this.props.poster}
					style={{width: '100%', height: '100%'}}
				/>
			</div>
		)
	}
}

export default StreamPlayer;
