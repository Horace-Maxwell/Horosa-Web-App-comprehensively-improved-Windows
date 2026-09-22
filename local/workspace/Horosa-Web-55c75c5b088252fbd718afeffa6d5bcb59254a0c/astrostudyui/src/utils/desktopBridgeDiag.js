// [FL-20260902-1] 桌面桥自检上报(启动一次):把「页面到底有没有 window.__TAURI__ / __TAURI_INTERNALS__、
// plugin:event|listen 是否被 ACL 拒」写进壳侧启动账本(诊断包随之导出)。真机结论以此为据,不靠猜。
// 浏览器 preview(无桥)静默跳过;老壳无 bridge_diag_report_command 时 invoke 抛错也静默。
import { isDesktopBridgeAvailable, invokeDesktopCommand } from './aiAnalysisDesktop';
import { snapshot as requestTelemetrySnapshot } from './requestTelemetry';

export function collectDesktopBridgeDiag(){
	const w = typeof window !== 'undefined' ? window : {};
	return {
		tauriGlobal: typeof w.__TAURI__,
		tauriInternals: typeof w.__TAURI_INTERNALS__,
		autoBackupHook: typeof w.__horosaAutoBackupTick,
		pendingAutoBackupTicks: Array.isArray(w.__horosaPendingAutoBackupTicks) ? w.__horosaPendingAutoBackupTicks.length : 0,
		userAgent: typeof navigator !== 'undefined' ? `${navigator.userAgent || ''}`.slice(0, 120) : '',
	};
}

// 探测 core:event:allow-listen 是否授权:直接走 __TAURI_INTERNALS__.invoke('plugin:event|listen');
// 被 ACL 拒 → 'denied:<msg>';通过 → 'allowed'(说明 capabilities 开了事件面,与本仓设计不符,同样值得看见)。
export async function probeEventListenAcl(){
	const w = typeof window !== 'undefined' ? window : {};
	const internals = w.__TAURI_INTERNALS__;
	if(!internals || typeof internals.invoke !== 'function'){ return 'no-internals'; }
	try{
		await internals.invoke('plugin:event|listen', { event: 'horosa://bridge-diag-probe', target: { kind: 'Any' }, handler: 0 });
		return 'allowed';
	}catch(e){
		return `denied:${`${(e && e.message) || e}`.slice(0, 160)}`;
	}
}

export async function reportDesktopBridgeDiag(){
	if(!isDesktopBridgeAvailable()){ return null; }
	const diag = collectDesktopBridgeDiag();
	diag.eventListenAcl = await probeEventListenAcl();
	try{ await invokeDesktopCommand('bridge_diag_report_command', { payload: diag }); }catch(_e){ /* 老壳无此命令 */ }
	return diag;
}

// 页面侧请求失败计数进壳侧账本(同一 bridge_diag_report_command,payload.kind = page_telemetry 区分):
// 入口两个 —— 后端离线跳变 / 周期上报;同 reason 30s 内只报一次;浏览器 preview(无桥)静默 null;
// 载荷即 requestTelemetry.snapshot()(url 已去 query、无请求体 / 响应头 / 令牌)。
const PAGE_TELEMETRY_THROTTLE_MS = 30 * 1000;
let pageTelemetryLastAt = {};

export async function reportPageTelemetry(reason){
	if(!isDesktopBridgeAvailable()){ return null; }
	const key = `${reason || 'unspecified'}`;
	const now = Date.now();
	const last = pageTelemetryLastAt[key];
	if(last !== undefined && now - last < PAGE_TELEMETRY_THROTTLE_MS){ return null; }
	pageTelemetryLastAt[key] = now;
	const payload = { kind: 'page_telemetry', reason: key, ...requestTelemetrySnapshot() };
	try{ await invokeDesktopCommand('bridge_diag_report_command', { payload }); }catch(_e){ /* 老壳无此命令 */ }
	return payload;
}

export function __resetPageTelemetryForTests(){
	pageTelemetryLastAt = {};
}
