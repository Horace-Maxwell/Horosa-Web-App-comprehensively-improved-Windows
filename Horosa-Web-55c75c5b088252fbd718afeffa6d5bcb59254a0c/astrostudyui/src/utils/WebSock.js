import { sendData, recvData, uploadWSFile, } from './wshelper';
import { WebSockServer} from './constants';

class WebSock {
	constructor(option){
		this.url = option.url;
		this.autoConnect = option.autoConnect === undefined ? true :  option.autoConnect;

		this.checkPeriod = 5;
		this.heartbeatPeriod = 30;

		this.websock = null;

		this.handles = {};

		this.connectTask = null;
		this.heartbeatTask = null;

		this.connect = this.connect.bind(this);
		this.disconnect = this.disconnect.bind(this);
		this.sendHeartbeat = this.sendHeartbeat.bind(this);
		this.send = this.send.bind(this);

	}

	connect(){
		if(this.websock){
			this.websock.close();
		}

		this.websock = new window.WebSocket(this.url);
		this.websock.onclose = (evt)=>{
			this.websock = null;
			this.disconnect();
		};

		this.websock.onerror = (evt)=>{
			this.disconnect();
			
			if(this.autoConnect){
				this.connectTask = setTimeout(this.connect, this.checkPeriod * 1000);
			}
		};

		this.websock.onopen = (evt)=>{
			this.heartbeatTask = setInterval(this.sendHeartbeat, this.heartbeatPeriod * 1000);
		};

		this.websock.onmessage = (evt)=>{
			let txt = evt.data;
			let res = recvData(txt);

			let cmd = res.obj.Cmd + '';

			if(this.handles[cmd]){
				this.handles[cmd](res.obj.Body, res.obj.Head);
			}
		};
	}

	disconnect(){
		if(this.websock){
			this.websock.close();
		}
		this.websock = null;

		if(this.connectTask){
			clearTimeout(this.connectTask);
		}
		this.connectTask = null;

		if(this.heartbeatTask){
			clearInterval(this.heartbeatTask);
		}
		this.heartbeatTask = null;
	}

	send(cmd, obj){
		if(this.websock === null){
			return {
				plain: null,
				coded: null,
			};
		}

		return sendData(this.websock, cmd, obj);
	}

	sendHeartbeat(){
		let data = {};
		this.send(0x0100, data);
	}

	upload(file){
		if(this.websock === null){
			throw 'websocket not connected';
		}
		uploadWSFile(this.websock, file);
	}

	setCmd(cmd, handler){
		this.handles[cmd + ''] = handler;
	}

	isConnected(){
		if(this.websock){
			return this.websock.readyState === 1;
		}
		return false;
	}
}

export default WebSock;

export let globalWS = new WebSock({
	url: WebSockServer,
	autoConnect: true,
});


