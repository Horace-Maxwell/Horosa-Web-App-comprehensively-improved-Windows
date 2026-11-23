// AI 助手·查新版本:与菜单「检查更新」同一条壳命令,只读回本机版本 / 最新版本 / 更新说明 / 预计下载量;
// **绝不**下载、安装或重启 —— 装更新留给人(菜单「检查更新」/ 更新提示里手点)。只在桌面 App 里可用(网页 / 无头没有更新通道)。
import { GUIDE } from './_shared';
import { hasTauriInvoke, updateCheckSilent, appVersionLocal } from '../../aiAnalysisDesktop';

export const NEW_VERSION_NOTES_MAX = 2000;

export default {
	name: 'check_new_version',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 120000,
	enabled: ()=>hasTauriInvoke(),
	description: `查星阙有没有新版本:回本机版本、最新版本、要不要更新、更新说明摘要与预计下载量(与菜单「检查更新」同一条检查)。只查不装 —— 下载与安装要用户自己在「检查更新」里点。${GUIDE}:用户问「有没有新版本 / 要不要升级」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, properties: {} },
	outputSchema: { type: 'object', required: ['available', 'currentVersion', 'latestVersion'], properties: {
		available: { type: 'boolean' }, currentVersion: { type: 'string' }, latestVersion: { type: 'string' }, runtimeNeedsUpdate: { type: 'boolean' },
		notes: { type: 'string' }, releaseUrl: { type: 'string' }, updateMode: { type: 'string' }, downloadBytes: { type: 'integer' }, notifyOnly: { type: 'boolean' },
	} },
	async run(){
		let r;
		try{ r = await updateCheckSilent(); }catch(e){
			const local = await appVersionLocal().catch(()=>null);
			return { ok: false, code: 'E_CAST_BACKEND_FAILED', retryable: true, message: `没查到最新版本(网络或发布源不可达):${`${(e && e.message) || e}`.slice(0, 160)}`,
				...(local ? { data: { currentVersion: `${local.appVersion || ''}`, runtimeVersion: `${local.runtimeVersion || ''}` } } : {}) };
		}
		if(!r || typeof r !== 'object'){ return { ok: false, code: 'E_BRIDGE_UNAVAILABLE', message: '这个环境没有更新通道(只在桌面 App 里可用)' }; }
		const notes = `${r.notes || ''}`;
		const data = {
			available: !!r.available, currentVersion: `${r.currentVersion || ''}`, latestVersion: `${r.latestVersion || ''}`, runtimeNeedsUpdate: !!r.runtimeNeedsUpdate,
			notes: notes.length > NEW_VERSION_NOTES_MAX ? `${notes.slice(0, NEW_VERSION_NOTES_MAX)}…` : notes,
			releaseUrl: `${r.releaseUrl || ''}`,
			...(r.updateMode ? { updateMode: `${r.updateMode}` } : {}),
			...(Number.isFinite(Number(r.downloadBytes)) && r.downloadBytes !== null ? { downloadBytes: Math.round(Number(r.downloadBytes)) } : {}),
			notifyOnly: !!r.notifyOnly,
		};
		return { ok: true, data,
			summary: data.available ? `有新版本 ${data.latestVersion}(本机 ${data.currentVersion})` : `已是最新(${data.currentVersion})`,
			assumptions: ['只查不装:要更新请用户在菜单「检查更新」里点下载与安装'] };
	},
};
