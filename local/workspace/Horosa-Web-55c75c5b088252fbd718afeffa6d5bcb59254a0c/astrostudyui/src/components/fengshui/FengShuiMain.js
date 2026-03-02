import { Component } from 'react';
import { Card } from 'antd';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';

const FENGSHUI_SNAPSHOT_EVENT = 'horosa:fengshui-snapshot';
const FENGSHUI_SNAPSHOT_REQUEST_EVENT = 'horosa:fengshui-snapshot-request';

class FengShuiMain extends Component {
	constructor(props){
		super(props);
		this.state = {
			reloadKey: 1,
		};
		this.iframeRef = null;
		this.handleEmbeddedMessage = this.handleEmbeddedMessage.bind(this);
		this.requestEmbeddedSnapshot = this.requestEmbeddedSnapshot.bind(this);
		this.handleIframeLoad = this.handleIframeLoad.bind(this);
	}

	componentDidMount(){
		window.addEventListener('message', this.handleEmbeddedMessage);
	}

	componentWillUnmount(){
		window.removeEventListener('message', this.handleEmbeddedMessage);
	}

	handleEmbeddedMessage(event){
		if(event && event.origin && typeof window !== 'undefined' && event.origin !== window.location.origin){
			return;
		}
		const data = event && event.data ? event.data : null;
		if(!data || data.type !== FENGSHUI_SNAPSHOT_EVENT){
			return;
		}
		const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
		const content = typeof payload.content === 'string' ? payload.content.trim() : '';
		if(!content){
			return;
		}
		const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {};
		saveModuleAISnapshot('fengshui', content, meta);
	}

	requestEmbeddedSnapshot(){
		if(!this.iframeRef || !this.iframeRef.contentWindow){
			return;
		}
		try{
			this.iframeRef.contentWindow.postMessage({
				type: FENGSHUI_SNAPSHOT_REQUEST_EVENT,
			}, '*');
		}catch(e){
		}
	}

	handleIframeLoad(){
		this.requestEmbeddedSnapshot();
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 48px)';
		}else{
			height = height + 28;
		}

		return (
			<div style={{ minHeight: height, marginTop: -12 }}>
				<Card bordered={false} bodyStyle={{ padding: 0 }}>
					<iframe
						ref={(node)=>{ this.iframeRef = node; }}
						key={`fengshui_iframe_${this.state.reloadKey}`}
						title="风水纳气"
						src="/fengshui/index.html?embedded=horosa"
						onLoad={this.handleIframeLoad}
						style={{
							width: '100%',
							height: typeof height === 'number' ? `${height}px` : 'calc(100vh - 132px)',
							border: '1px solid #f0f0f0',
							borderRadius: 8,
							background: '#fff',
						}}
					/>
				</Card>
			</div>
		);
	}
}

export default FengShuiMain;
