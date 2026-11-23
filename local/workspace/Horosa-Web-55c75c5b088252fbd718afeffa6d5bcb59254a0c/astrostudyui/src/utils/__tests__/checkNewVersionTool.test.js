// check_new_version 只查不装(与菜单「检查更新」同一条壳命令);没有壳不进目录;网络失败如实报并附本机版本。
let mockShell = true;
const mockCheck = jest.fn();
jest.mock('../aiAnalysisDesktop', ()=>{
	const actual = jest.requireActual('../aiAnalysisDesktop');
	return { __esModule: true, ...actual, hasTauriInvoke: ()=>mockShell, updateCheckSilent: (...a)=>mockCheck(...a), appVersionLocal: async ()=>({ appVersion: '3.14.0', runtimeVersion: '3.14.0' }),
		updateStartBackground: jest.fn(), updateInstallAndRestart: jest.fn() };
});
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests, exportToolManifest } from '../aiTools/registry';
import { setAgentEnabled } from '../aiAgent/prefs';
import * as desk from '../aiAnalysisDesktop';

const ctx = { origin: 'mcp', requestId: 'cv' };
beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); setAgentEnabled(true); registerBuiltinTools(); mockShell = true; mockCheck.mockReset(); });
afterEach(()=>setAgentEnabled(false));

test('有新版本:回版本 / 说明(截断)/ 下载量;绝不调下载与安装', async ()=>{
	mockCheck.mockResolvedValue({ available: true, currentVersion: '3.14.0', latestVersion: '3.15.0', runtimeNeedsUpdate: true, notes: 'x'.repeat(5000), releaseUrl: 'https://example.invalid/r', updateMode: 'incremental', downloadBytes: 1234, notifyOnly: false });
	const r = await runTool('check_new_version', {}, ctx);
	expect(r.ok).toBe(true);
	expect(r.data).toEqual(expect.objectContaining({ available: true, currentVersion: '3.14.0', latestVersion: '3.15.0', updateMode: 'incremental', downloadBytes: 1234 }));
	expect(r.data.notes.length).toBeLessThanOrEqual(2001);
	expect(desk.updateStartBackground).not.toHaveBeenCalled();
	expect(desk.updateInstallAndRestart).not.toHaveBeenCalled();
});

test('网络失败 → 可重试错误并附本机版本;没有壳 → 不进目录', async ()=>{
	mockCheck.mockRejectedValue(new Error('github unreachable'));
	const r = await runTool('check_new_version', {}, ctx);
	expect(r.ok).toBe(false);
	expect(r.retryable).toBe(true);
	mockShell = false;
	expect(exportToolManifest().some((t)=>t.name === 'check_new_version')).toBe(false);
});
