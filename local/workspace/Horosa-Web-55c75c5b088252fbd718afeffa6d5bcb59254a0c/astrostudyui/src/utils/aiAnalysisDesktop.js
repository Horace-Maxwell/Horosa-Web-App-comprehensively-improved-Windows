function hasTauriInvoke(){
	return !!(
		typeof window !== 'undefined'
		&& (
			(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)
			|| (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke)
		)
	);
}

async function invoke(command, args){
	if(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke){
		return window.__TAURI__.core.invoke(command, args);
	}
	if(window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke){
		return window.__TAURI_INTERNALS__.invoke(command, args);
	}
	throw new Error('desktop.bridge.unavailable');
}

function normalizeDesktopImportItem(item){
	if(!item || typeof item !== 'object'){
		return null;
	}
	const fileName = item.fileName || item.file_name || '';
	const mimeType = item.mimeType || item.mime_type || '';
	const base64Data = item.base64Data || item.base64_data || '';
	const relativePath = item.relativePath || item.relative_path || null;
	if(!fileName || !base64Data){
		return null;
	}
	return {
		fileName,
		mimeType,
		base64Data,
		relativePath,
	};
}

export function normalizeDesktopImportItems(payload){
	const list = Array.isArray(payload)
		? payload
		: (payload ? [payload] : []);
	return list.map((item)=>normalizeDesktopImportItem(item)).filter(Boolean);
}

export function isDesktopBridgeAvailable(){
	return hasTauriInvoke();
}

export async function pickDesktopFiles(){
	if(!hasTauriInvoke()){
		return [];
	}
	return normalizeDesktopImportItems(await invoke('pick_ai_analysis_files_command'));
}


export async function pickDesktopFolder(){
	if(!hasTauriInvoke()){
		return [];
	}
	return normalizeDesktopImportItems(await invoke('pick_ai_analysis_folder_command'));
}

export async function saveDesktopFile(payload){
	if(!hasTauriInvoke()){
		throw new Error('desktop.bridge.unavailable');
	}
	return invoke('save_ai_analysis_file_command', { payload });
}

// 桌面剪贴板:webview 的 navigator.clipboard/execCommand 被拦,走原生 pbcopy 命令。成功 true / 不可用或失败 false。
export async function copyDesktopClipboard(text){
	if(!hasTauriInvoke()){
		return false;
	}
	try{
		await invoke('copy_text_to_clipboard_command', { text: `${text == null ? '' : text}` });
		return true;
	}catch(e){
		return false;
	}
}

export async function openDesktopBackup(){
	if(!hasTauriInvoke()){
		throw new Error('desktop.bridge.unavailable');
	}
	const payload = await invoke('open_ai_analysis_backup_command');
	const list = normalizeDesktopImportItems(payload);
	return list.length ? list[0] : null;
}

// 在系统默认浏览器打开外链(通用):桌面端 webview 里 <a target="_blank">/window.open 无新标签页→点了没反应,
// 走 Rust `open` 命令;非桌面(浏览器/dev)回落 window.open。仅放行 http(s)。返回是否已发起打开。
export async function openExternalUrl(url){
	const u = `${url == null ? '' : url}`.trim();
	if(!/^https?:\/\//i.test(u)){
		return false;
	}
	if(hasTauriInvoke()){
		try{
			await invoke('open_external_url_command', { url: u });
			return true;
		}catch(e){
			// 命令失败(极少)→ 回落浏览器 window.open,尽量别让用户点了完全没反应。
		}
	}
	try{
		window.open(u, '_blank', 'noopener,noreferrer');
		return true;
	}catch(e){
		return false;
	}
}

// v2.2.1 软件内升级桥(非阻塞):静默检查 / 后台下载 / 重启安装。仅桌面端可用。
export async function updateCheckSilent(){
	if(!hasTauriInvoke()){
		return null;
	}
	return invoke('update_check_silent');
}

export async function updateStartBackground(){
	if(!hasTauriInvoke()){
		throw new Error('desktop.bridge.unavailable');
	}
	return invoke('update_start_background');
}

export async function updateInstallAndRestart(){
	if(!hasTauriInvoke()){
		throw new Error('desktop.bridge.unavailable');
	}
	return invoke('update_install_and_restart');
}
