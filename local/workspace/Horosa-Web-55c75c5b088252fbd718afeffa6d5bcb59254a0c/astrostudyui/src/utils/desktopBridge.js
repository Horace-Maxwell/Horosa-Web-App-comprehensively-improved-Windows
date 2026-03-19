export function getDesktopBridge(){
	if(typeof window === 'undefined'){
		return null;
	}
	return window.horosaDesktop || null;
}

export function hasDesktopBridge(){
	const bridge = getDesktopBridge();
	return !!(bridge && typeof bridge.getAppInfo === 'function');
}

export function getDesktopBootstrapConfig(){
	if(typeof window === 'undefined'){
		return {};
	}
	return window.__HOROSA_DESKTOP_CONFIG__ || {};
}

export async function getDesktopAppInfo(){
	const bridge = getDesktopBridge();
	if(!bridge || typeof bridge.getAppInfo !== 'function'){
		return null;
	}
	return bridge.getAppInfo();
}

export async function checkDesktopUpdates(){
	const bridge = getDesktopBridge();
	if(!bridge || typeof bridge.checkForUpdates !== 'function'){
		return {
			status: 'unsupported',
			message: '当前不是桌面 App 环境',
		};
	}
	return bridge.checkForUpdates();
}

export async function installDesktopUpdate(){
	const bridge = getDesktopBridge();
	if(!bridge || typeof bridge.installDownloadedUpdate !== 'function'){
		return {
			ok: false,
			message: '当前不是桌面 App 环境',
		};
	}
	return bridge.installDownloadedUpdate();
}

export async function openDesktopLogsDirectory(){
	const bridge = getDesktopBridge();
	if(!bridge || typeof bridge.openLogsDirectory !== 'function'){
		return {
			ok: false,
			message: '当前不是桌面 App 环境',
		};
	}
	return bridge.openLogsDirectory();
}

export async function exportDesktopDiagnostics(snapshotPayload){
	const bridge = getDesktopBridge();
	if(!bridge || typeof bridge.exportDiagnostics !== 'function'){
		return {
			ok: false,
			message: '当前不是桌面 App 环境',
		};
	}
	return bridge.exportDiagnostics(snapshotPayload || {});
}

export async function retryDesktopRuntime(){
	const bridge = getDesktopBridge();
	if(!bridge || typeof bridge.retryRuntime !== 'function'){
		return {
			ok: false,
			message: '当前不是桌面 App 环境',
		};
	}
	return bridge.retryRuntime();
}

export function onDesktopUpdateState(callback){
	const bridge = getDesktopBridge();
	if(!bridge || typeof bridge.onUpdateState !== 'function'){
		return ()=>{};
	}
	return bridge.onUpdateState(callback);
}

export function onDesktopRuntimeState(callback){
	const bridge = getDesktopBridge();
	if(!bridge || typeof bridge.onRuntimeState !== 'function'){
		return ()=>{};
	}
	return bridge.onRuntimeState(callback);
}
