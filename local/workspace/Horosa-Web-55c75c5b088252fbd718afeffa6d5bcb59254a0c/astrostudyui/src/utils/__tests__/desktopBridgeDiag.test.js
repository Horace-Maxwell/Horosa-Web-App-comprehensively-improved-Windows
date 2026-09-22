// 桌面桥自检上报(FL-20260902-1 的证据面):字段集合同、浏览器 preview 静默 no-op、有桥时上报进壳侧账本。
import { collectDesktopBridgeDiag, reportDesktopBridgeDiag, probeEventListenAcl, reportPageTelemetry, __resetPageTelemetryForTests } from '../desktopBridgeDiag';
import * as desktop from '../aiAnalysisDesktop';
import { recordRequestFailure, __resetRequestTelemetryForTests } from '../requestTelemetry';

afterEach(()=>{
	jest.restoreAllMocks();
	delete window.__TAURI__;
	delete window.__TAURI_INTERNALS__;
	delete window.__horosaAutoBackupTick;
	delete window.__horosaPendingAutoBackupTicks;
});

describe('collectDesktopBridgeDiag', ()=>{
	it('字段集固定(preflight [239]/壳侧账本 rust.bridge_diag 消费这五个键)', ()=>{
		const d = collectDesktopBridgeDiag();
		expect(Object.keys(d).sort()).toEqual(['autoBackupHook', 'pendingAutoBackupTicks', 'tauriGlobal', 'tauriInternals', 'userAgent'].sort());
		expect(d.tauriGlobal).toBe('undefined');
		expect(d.pendingAutoBackupTicks).toBe(0);
	});
	it('登记了备份回调与在途队列后如实上报', ()=>{
		window.__horosaAutoBackupTick = ()=>{};
		window.__horosaPendingAutoBackupTicks = [{ seq: 1 }, { seq: 2 }];
		const d = collectDesktopBridgeDiag();
		expect(d.autoBackupHook).toBe('function');
		expect(d.pendingAutoBackupTicks).toBe(2);
	});
});

describe('probeEventListenAcl', ()=>{
	it('无 __TAURI_INTERNALS__ → no-internals', async ()=>{
		expect(await probeEventListenAcl()).toBe('no-internals');
	});
	it('ACL 拒绝 → denied:<msg>;放行 → allowed(说明 capabilities 开了事件面,同样要看见)', async ()=>{
		window.__TAURI_INTERNALS__ = { invoke: jest.fn(async ()=>{ throw new Error('plugin:event|listen not allowed'); }) };
		expect(await probeEventListenAcl()).toMatch(/^denied:.*not allowed/);
		window.__TAURI_INTERNALS__ = { invoke: jest.fn(async ()=>1) };
		expect(await probeEventListenAcl()).toBe('allowed');
	});
});

describe('reportDesktopBridgeDiag', ()=>{
	it('浏览器 preview(无桥)静默返回 null,不 invoke', async ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(false);
		const inv = jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue(true);
		expect(await reportDesktopBridgeDiag()).toBeNull();
		expect(inv).not.toHaveBeenCalled();
	});
	it('有桥:payload 带 eventListenAcl 探测结果,经 bridge_diag_report_command 上报;老壳无命令抛错也静默', async ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		window.__TAURI_INTERNALS__ = { invoke: jest.fn(async ()=>{ throw new Error('not allowed'); }) };
		const inv = jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue(true);
		const out = await reportDesktopBridgeDiag();
		expect(out.eventListenAcl).toMatch(/^denied:/);
		expect(inv).toHaveBeenCalledWith('bridge_diag_report_command', expect.objectContaining({ payload: expect.objectContaining({ tauriInternals: 'object', eventListenAcl: expect.stringMatching(/^denied:/) }) }));
		inv.mockRejectedValue(new Error('command not found'));
		await expect(reportDesktopBridgeDiag()).resolves.toBeTruthy();
	});
});

describe('reportPageTelemetry(页面侧请求失败计数进壳侧账本)', ()=>{
	beforeEach(()=>{
		__resetPageTelemetryForTests();
		__resetRequestTelemetryForTests();
	});
	it('有桥:payload.kind === page_telemetry,带 reason 与失败计数快照,经 bridge_diag_report_command 上报', async ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		const inv = jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue(true);
		recordRequestFailure({ url: 'http://127.0.0.1:9999/chart?x=1', kind: 'unreachable', silent: true, name: 'TypeError', message: 'Failed to fetch' });
		const out = await reportPageTelemetry('offline');
		expect(inv).toHaveBeenCalledTimes(1);
		expect(inv).toHaveBeenCalledWith('bridge_diag_report_command', expect.objectContaining({
			payload: expect.objectContaining({ kind: 'page_telemetry', reason: 'offline', total: 1, counts: expect.objectContaining({ byKind: { unreachable: 1 } }) }),
		}));
		expect(out.kind).toBe('page_telemetry');
		expect(out.recent[0].url).toBe('http://127.0.0.1:9999/chart');
		// 老壳无此命令抛错也静默
		inv.mockRejectedValue(new Error('command not found'));
		await expect(reportPageTelemetry('periodic')).resolves.toBeTruthy();
	});
	it('同 reason 30s 内二次调用不再 invoke;不同 reason 不受节流;无桥静默 null', async ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		const inv = jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue(true);
		expect(await reportPageTelemetry('periodic')).toBeTruthy();
		expect(await reportPageTelemetry('periodic')).toBeNull();
		expect(inv).toHaveBeenCalledTimes(1);
		expect(await reportPageTelemetry('offline')).toBeTruthy();
		expect(inv).toHaveBeenCalledTimes(2);
		desktop.isDesktopBridgeAvailable.mockReturnValue(false);
		expect(await reportPageTelemetry('other')).toBeNull();
		expect(inv).toHaveBeenCalledTimes(2);
	});
});
