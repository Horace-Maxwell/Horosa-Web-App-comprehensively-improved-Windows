import { Component } from 'react';
import { Alert, Button, Card, Space } from 'antd';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { normalizeContentHeight } from '../../utils/layout';
import {
	exportDesktopDiagnostics,
	getDesktopBootstrapConfig,
	hasDesktopBridge,
	openDesktopLogsDirectory,
} from '../../utils/desktopBridge';

const FENGSHUI_SNAPSHOT_EVENT = 'horosa:fengshui-snapshot';
const FENGSHUI_SNAPSHOT_REQUEST_EVENT = 'horosa:fengshui-snapshot-request';
const FENGSHUI_READY_EVENT = 'horosa:fengshui-ready';
const FENGSHUI_LOAD_TIMEOUT_MS = 8000;

function resolveFengShuiUrl(){
	if(typeof window === 'undefined'){
		return '/fengshui/index.html?embedded=horosa';
	}
	const search = '?embedded=horosa';
	const pathname = window.location.pathname || '';
	const bootstrapConfig = getDesktopBootstrapConfig();
	const isDesktopFileMode = window.location.protocol === 'file:' || hasDesktopBridge() || !!bootstrapConfig.desktop;
	if(isDesktopFileMode){
		try{
			return new URL(`./fengshui/index.html${search}`, window.location.href).toString();
		}catch(_error){
			return `fengshui/index.html${search}`;
		}
	}
	return `/fengshui/index.html${search}`;
}

class FengShuiMain extends Component {
	constructor(props){
		super(props);
		this.state = {
			reloadKey: 1,
			loadState: 'loading',
			loadError: '',
		};
		this.iframeRef = null;
		this.loadTimeout = null;
		this.hasReceivedReady = false;
		this.handleEmbeddedMessage = this.handleEmbeddedMessage.bind(this);
		this.requestEmbeddedSnapshot = this.requestEmbeddedSnapshot.bind(this);
		this.handleIframeLoad = this.handleIframeLoad.bind(this);
		this.handleIframeError = this.handleIframeError.bind(this);
		this.retryLoad = this.retryLoad.bind(this);
		this.startLoadWatchdog = this.startLoadWatchdog.bind(this);
		this.clearLoadWatchdog = this.clearLoadWatchdog.bind(this);
		this.openLogs = this.openLogs.bind(this);
		this.exportDiagnostics = this.exportDiagnostics.bind(this);
	}

	componentDidMount(){
		window.addEventListener('message', this.handleEmbeddedMessage);
		this.startLoadWatchdog();
	}

	componentWillUnmount(){
		window.removeEventListener('message', this.handleEmbeddedMessage);
		this.clearLoadWatchdog();
	}

	handleEmbeddedMessage(event){
		if(this.iframeRef && this.iframeRef.contentWindow && event && event.source && event.source !== this.iframeRef.contentWindow){
			return;
		}
		const data = event && event.data ? event.data : null;
		if(!data || !data.type){
			return;
		}
		if(data.type === FENGSHUI_READY_EVENT){
			this.hasReceivedReady = true;
			this.clearLoadWatchdog();
			if(this.state.loadState !== 'loaded'){
				this.setState({
					loadState: 'loaded',
					loadError: '',
				});
			}
			this.requestEmbeddedSnapshot();
			return;
		}
		if(data.type !== FENGSHUI_SNAPSHOT_EVENT){
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
		if(this.hasReceivedReady){
			this.clearLoadWatchdog();
			this.setState({
				loadState: 'loaded',
				loadError: '',
			});
			this.requestEmbeddedSnapshot();
			return;
		}
		this.startLoadWatchdog();
	}

	handleIframeError(){
		this.clearLoadWatchdog();
		this.setState({
			loadState: 'failed',
			loadError: '未能加载风水本地页面，请检查桌面资源是否完整。',
		});
	}

	startLoadWatchdog(){
		this.clearLoadWatchdog();
		this.hasReceivedReady = false;
		this.setState({
			loadState: 'loading',
			loadError: '',
		});
		this.loadTimeout = setTimeout(()=>{
			if(this.hasReceivedReady){
				return;
			}
			this.setState({
				loadState: 'failed',
				loadError: '风水子页面未在预期时间内完成初始化，可能是本地路径或子资源加载失败。',
			});
		}, FENGSHUI_LOAD_TIMEOUT_MS);
	}

	clearLoadWatchdog(){
		if(this.loadTimeout){
			clearTimeout(this.loadTimeout);
			this.loadTimeout = null;
		}
	}

	retryLoad(){
		this.startLoadWatchdog();
		this.setState((prevState)=>({
			reloadKey: prevState.reloadKey + 1,
		}));
	}

	async openLogs(){
		await openDesktopLogsDirectory();
	}

	async exportDiagnostics(){
		await exportDesktopDiagnostics({
			module: 'fengshui',
			loadState: this.state.loadState,
			loadError: this.state.loadError,
			src: resolveFengShuiUrl(),
		});
	}

	render(){
		const height = normalizeContentHeight(this.props.height);
		const iframeHeight = Math.max(240, height - 4);
		const iframeSrc = resolveFengShuiUrl();
		const isFailed = this.state.loadState === 'failed';
		const isLoading = this.state.loadState === 'loading';

		return (
			<div style={{ height, maxHeight: height, overflow: 'hidden' }}>
				<Card bordered={false} bodyStyle={{ padding: 0 }}>
					{isLoading && (
						<div style={{ padding: '12px 14px', color: '#595959', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
							正在加载风水模块...
						</div>
					)}
					{isFailed && (
						<div style={{ padding: 12 }}>
							<Alert
								type='error'
								showIcon
								message='风水模块加载失败'
								description={this.state.loadError || '未找到本地风水资源或子页面初始化失败。'}
								action={(
									<Space direction='vertical' size={8}>
										<Button size='small' type='primary' onClick={this.retryLoad}>重试加载</Button>
										{hasDesktopBridge() && (
											<Button size='small' onClick={this.openLogs}>打开日志目录</Button>
										)}
										{hasDesktopBridge() && (
											<Button size='small' onClick={this.exportDiagnostics}>导出诊断</Button>
										)}
									</Space>
								)}
							/>
						</div>
					)}
					<iframe
						ref={(node)=>{ this.iframeRef = node; }}
						key={`fengshui_iframe_${this.state.reloadKey}`}
						title="风水纳气"
						src={iframeSrc}
						onLoad={this.handleIframeLoad}
						onError={this.handleIframeError}
						style={{
							width: '100%',
							height: `${iframeHeight}px`,
							border: '1px solid #f0f0f0',
							borderRadius: 8,
							background: '#fff',
							display: isFailed ? 'none' : 'block',
						}}
					/>
				</Card>
			</div>
		);
	}
}

export default FengShuiMain;
