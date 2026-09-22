export function hasTauriInvoke(){   // [Q-305] 导出供页头「诊断报告」菜单判壳环境
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

// 组件层统一句柄:{ invoke } 或 null。打包版只有 __TAURI_INTERNALS__(withGlobalTauri 缺省 false,
// 页面里没有 window.__TAURI__)——任何「!!window.__TAURI__」门控在打包版恒假,按钮永远不出现/点了没反应。
export function getDesktopInvokeApi(){
	if(!hasTauriInvoke()){ return null; }
	return { invoke };
}

// 通用命令直通(secureKeyStore 等按需调桌面命令;浏览器 dev 无桥时抛 desktop.bridge.unavailable)。
export async function invokeDesktopCommand(command, args){
	return invoke(command, args);
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

// [Q-308/M-105] 本地版本号(不联网、不写更新节流戳):「关于」只要版本号,不该顺手做一次联网检查。
//   壳缺席(网页端)→ null;旧壳没有该命令 → 调用抛错,调用方按 null 处理(退回「玄学与星座云平台」文案)。
export async function appVersionLocal(){
	if(!hasTauriInvoke()){
		return null;
	}
	try{
		return await invoke('app_version_local_command');
	}catch(e){
		return null;
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

// ── AI 助手·行动能力/外部智能体连接(壳侧命令;非桌面壳或旧壳缺命令时一律返回 available:false,绝不抛给 UI) ──
// [进阶审计 D9·2026-09-07] 数组结果不能展开:`{...[a,b]}` 变成 {0:a,1:b},调用方读 `.value` 恒 undefined —— 壳侧
// `mcp_client_list_command` 返回 Vec → 外部服务器清单在打包版里永远是空表(桌面桥 mock 的 端到端用例实抓)。数组一律包成 value。
export function __wrapOptionalForTests(r){
	return { available: true, ...(r && typeof r === 'object' && !Array.isArray(r) ? r : { value: r }) };
}
async function invokeOptional(command, args){
	if(!isDesktopBridgeAvailable()){ return { available: false, reason: 'no-desktop' }; }
	try{
		const r = await invoke(command, args);
		return __wrapOptionalForTests(r);
	}catch(e){
		return { available: false, reason: e && e.message ? `${e.message}` : `${e}` };
	}
}

// 页面总开关同步给壳(壳启动外部智能体服务时要求页面侧总开关也为开)
export async function desktopSetAgentEnabled(enabled){
	return invokeOptional('set_agent_enabled_command', { enabled: !!enabled });
}

export async function desktopMcpServerStatus(){
	return invokeOptional('mcp_server_status_command');
}

export async function desktopMcpServerSetEnabled(enabled){
	return invokeOptional('mcp_server_set_enabled_command', { enabled: !!enabled });
}
// [D74] 外部客户端策略「每分钟调用上限」镜像到壳令牌桶(壳此前写死 60/分钟,页面 >60 全部无效);非桌面 ⇒ available:false 零 invoke
export async function desktopMcpServerSetLimits(callsPerMinute){
	const raw = Number(callsPerMinute);
	const n = Number.isFinite(raw) ? Math.max(1, Math.min(600, Math.round(raw))) : 60;   // 0 ⇒ 钳到 1(不是「缺省 60」);非数 ⇒ 60
	return invokeOptional('mcp_server_set_limits_command', { callsPerMinute: n });
}


// [P6] 外部 MCP 服务器:清单/连接/调用全部经壳;令牌只落壳侧 0600 文件,页面永不持有
export async function desktopMcpClientList(){
	return invokeOptional('mcp_client_list_command');
}

// [Q-294/M-109·AR-24] keepHeaders:编辑已带令牌的 http 服务器且令牌框留空 → 壳侧保留已存 headers(此前整份 upsert 把令牌清空)
export async function desktopMcpClientUpsert(spec, opts){
	return invokeOptional('mcp_client_upsert_command', { spec, keepHeaders: !!(opts && opts.keepHeaders) });
}

export async function desktopMcpClientRemove(id){
	return invokeOptional('mcp_client_remove_command', { id });
}

export async function desktopMcpClientConnect(id){
	return invokeOptional('mcp_client_connect_command', { id });
}

export async function desktopMcpClientCall(id, tool, args){
	return invokeOptional('mcp_client_call_command', { id, tool, arguments: args || {} });
}

export async function desktopMcpClientDisconnect(id){
	return invokeOptional('mcp_client_disconnect_command', { id });
}

export async function desktopMcpServerRotateToken(){
	return invokeOptional('mcp_server_rotate_token_command');
}

// 令牌按需取(状态查询不再携带令牌):仅面板「复制」按钮调用。
// [P1] 桌面横幅:壳侧命令(偏好 show_status_notifications 门 + 脱控制字符 + 限流 6/min 突发 3 + 10s 同文去重);返回 { shown, reason }
export async function desktopShowNotification(title, body){
	return invokeDesktopCommand('show_desktop_notification_command', { title: `${title || ''}`, body: `${body || ''}` });
}

// [P3] 定时任务:壳侧 60 秒哑心跳开关镜像(偏好 scheduler_enabled,缺省 false)与状态(ticks/lastTickAt/killSwitch)
export async function desktopSetSchedulerEnabled(enabled){
	return invokeOptional('set_scheduler_enabled_command', { enabled: !!enabled });
}


export async function desktopMcpServerRevealToken(){
	return invokeOptional('mcp_server_reveal_token_command');
}

// [批三⑥] 通知外部脚本钩(仅桌面壳):状态 / 设置(开时壳侧校验路径六道门)/ 运行(自动化动作与面板「测试运行」;载荷=一个 JSON 参数,零 shell)
export async function desktopNotifyHookStatus(){
	return invokeOptional('notify_hook_status_command');
}
export async function desktopNotifyHookSet(enabled, path){
	return invokeOptional('notify_hook_set_command', { enabled: !!enabled, path: `${path || ''}` });
}
export async function desktopNotifyHookRun(payload, test){
	return invokeOptional('notify_hook_run_command', { payload: payload && typeof payload === 'object' ? payload : { text: `${payload || ''}` }, test: !!test });
}

// [进阶复查 D18·2026-09-08] 本机 MCP 服务 list_changed 通知:壳侧 agent_notify_command(kind) 早已在(mcp_server 宣告三面 listChanged:true),
// 页面此前从未调用 —— 记录/模版/工具面变了外部客户端永远不知。去抖发射器:每 kind 一个定时器;未启用/桥不可用 = 零定时器零 invoke。
export const AGENT_NOTIFY_KINDS = ['tools', 'resources', 'prompts'];
export async function desktopAgentNotify(kind){
	if(AGENT_NOTIFY_KINDS.indexOf(kind) < 0){ return { available: false, reason: 'bad-kind' }; }
	return invokeOptional('agent_notify_command', { kind });
}
export function createAgentNotifier(opts){
	const o = opts || {};
	const delayMs = Number(o.delayMs) > 0 ? Number(o.delayMs) : 500;
	const notify = typeof o.notify === 'function' ? o.notify : desktopAgentNotify;
	const enabled = typeof o.enabled === 'function' ? o.enabled : ()=>true;
	const timers = new Map();
	let disposed = false;
	const isOn = ()=>{ try{ return !!enabled(); }catch(e){ return false; } };
	function fire(kind){
		timers.delete(kind);
		if(disposed || !isOn()){ return; }
		try{ Promise.resolve(notify(kind)).catch(()=>{}); }catch(e){ /* noop */ }
	}
	return {
		emit(kind){
			if(disposed || AGENT_NOTIFY_KINDS.indexOf(kind) < 0 || !isOn()){ return false; }
			if(timers.has(kind)){ return true; }
			timers.set(kind, setTimeout(()=>fire(kind), delayMs));
			return true;
		},
		pending(){ return Array.from(timers.keys()); },
		dispose(){ disposed = true; timers.forEach((t)=>clearTimeout(t)); timers.clear(); },
	};
}
