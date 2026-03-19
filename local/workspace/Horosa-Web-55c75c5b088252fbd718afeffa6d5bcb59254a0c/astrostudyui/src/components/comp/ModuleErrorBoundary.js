import React from 'react';
import { Button, message } from 'antd';
import {
	hasDesktopBridge,
	openDesktopLogsDirectory,
	exportDesktopDiagnostics,
} from '../../utils/desktopBridge';

function getErrorMessage(error){
	if(!error){
		return '模块发生异常，请稍后重试。';
	}
	if(typeof error === 'string'){
		return error;
	}
	if(error && error.message){
		return error.message;
	}
	return '模块发生异常，请稍后重试。';
}

class ModuleErrorBoundary extends React.Component{
	constructor(props){
		super(props);
		this.state = {
			hasError: false,
			error: null,
			retryNonce: 0,
		};

		this.handleRetry = this.handleRetry.bind(this);
		this.handleOpenLogs = this.handleOpenLogs.bind(this);
		this.handleExportDiagnostics = this.handleExportDiagnostics.bind(this);
	}

	static getDerivedStateFromError(error){
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error, info){
		console.error(`[Horosa:${this.props.moduleName || 'module'}]`, error, info);
		if(typeof this.props.onError === 'function'){
			this.props.onError(error, info);
		}
	}

	componentDidUpdate(prevProps){
		if(prevProps.resetKey !== this.props.resetKey && this.state.hasError){
			this.setState({
				hasError: false,
				error: null,
			});
		}
	}

	handleRetry(){
		if(typeof this.props.onRetry === 'function'){
			try{
				this.props.onRetry();
			}catch(e){
				console.error('[Horosa:retry-failed]', e);
			}
		}
		this.setState((prev)=>({
			hasError: false,
			error: null,
			retryNonce: prev.retryNonce + 1,
		}));
	}

	async handleOpenLogs(){
		try{
			const ret = await openDesktopLogsDirectory();
			if(ret && ret.ok){
				message.success(ret.message || '日志目录已打开');
			}else{
				message.warning((ret && ret.message) ? ret.message : '打开日志目录失败');
			}
		}catch(e){
			message.error((e && e.message) ? e.message : '打开日志目录失败');
		}
	}

	async handleExportDiagnostics(){
		try{
			const ret = await exportDesktopDiagnostics({
				moduleError: {
					moduleName: this.props.moduleName || '未知模块',
					message: getErrorMessage(this.state.error),
					stack: this.state.error && this.state.error.stack ? this.state.error.stack : null,
					timestamp: new Date().toISOString(),
				},
			});
			if(ret && ret.ok){
				message.success(ret.message || '诊断报告导出成功');
			}else if(ret && ret.canceled){
				message.info('已取消导出诊断报告');
			}else{
				message.warning((ret && ret.message) ? ret.message : '导出诊断报告失败');
			}
		}catch(e){
			message.error((e && e.message) ? e.message : '导出诊断报告失败');
		}
	}

	renderFallback(){
		const moduleName = this.props.moduleName || '当前模块';
		const showDesktopActions = hasDesktopBridge();
		return (
			<div
				style={{
					height: '100%',
					minHeight: 220,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					padding: 24,
					boxSizing: 'border-box',
					background: '#fff',
				}}
			>
				<div
					style={{
						width: '100%',
						maxWidth: 720,
						border: '1px solid #f0f0f0',
						borderRadius: 10,
						padding: 24,
						boxShadow: '0 4px 18px rgba(15, 23, 42, 0.06)',
						background: '#fff',
					}}
				>
					<div style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>
						{moduleName} 出现错误
					</div>
					<div style={{ color: '#666', lineHeight: 1.7, marginBottom: 18 }}>
						当前模块已被安全隔离，主界面不会白屏。你可以重试当前模块，或先回到安全页面继续使用。
					</div>
					<div
						style={{
							padding: '10px 12px',
							background: '#fff7e6',
							border: '1px solid #ffd591',
							borderRadius: 8,
							color: '#ad6800',
							marginBottom: 18,
							wordBreak: 'break-word',
						}}
					>
						{getErrorMessage(this.state.error)}
					</div>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
						<Button type='primary' onClick={this.handleRetry}>重试当前模块</Button>
						{typeof this.props.onClose === 'function' ? (
							<Button onClick={this.props.onClose}>关闭当前面板</Button>
						) : null}
						{typeof this.props.onGoSafe === 'function' ? (
							<Button onClick={this.props.onGoSafe}>回到星盘</Button>
						) : null}
						{showDesktopActions ? (
							<Button onClick={this.handleOpenLogs}>打开日志目录</Button>
						) : null}
						{showDesktopActions ? (
							<Button onClick={this.handleExportDiagnostics}>导出诊断</Button>
						) : null}
					</div>
				</div>
			</div>
		);
	}

	render(){
		if(this.state.hasError){
			return this.renderFallback();
		}

		return (
			<div key={this.state.retryNonce} style={{ height: '100%' }}>
				{this.props.children}
			</div>
		);
	}
}

export default ModuleErrorBoundary;
