// [B1] boot-gate 金标:非 early 恒 no-op(零行为变化的根据)/early 探活排队/壳确认短路/
// 兜底放行/同根单飞共享。探活 fetch 全程 mock,不打真网络。
import {
	waitForBackendBoot,
	isEarlyBootMode,
	__resetBackendBootGateForTest,
} from '../backendBootGate';

const JAVA_ROOT = 'http://127.0.0.1:9999';

function setSearch(search){
	window.history.replaceState(null, '', `${window.location.pathname}${search}`);
}

describe('[B1] backendBootGate', ()=>{
	let fetchMock;
	beforeEach(()=>{
		__resetBackendBootGateForTest({ retryMs: 5, giveUpMs: 200 });
		delete window.__horosaBackendConfirmed;
		fetchMock = jest.fn();
		global.fetch = fetchMock;
		setSearch('');
	});
	afterEach(()=>{
		delete global.fetch;
		delete window.__horosaBackendConfirmed;
		setSearch('');
	});

	test('非 early 模式:同步 no-op,零探活零等待(dev/公网/旧壳零行为变化)', async ()=>{
		setSearch('?srv=http%3A%2F%2F127.0.0.1%3A9999');
		expect(isEarlyBootMode()).toBe(false);
		await waitForBackendBoot(`${JAVA_ROOT}/chart`);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('early=1:后端未起(拒连)则重试,起了才放行', async ()=>{
		setSearch('?early=1');
		expect(isEarlyBootMode()).toBe(true);
		fetchMock
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockResolvedValue({ ok: true, type: 'opaque' });
		await waitForBackendBoot(`${JAVA_ROOT}/chart`);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		// 探活的是根路径、no-cors、不落 HTTP 缓存
		const [probeUrl, probeOpts] = fetchMock.mock.calls[0];
		expect(probeUrl).toBe(`${JAVA_ROOT}/`);
		expect(probeOpts.mode).toBe('no-cors');
		expect(probeOpts.cache).toBe('no-store');
		// 就绪后同根第二次:零探活直通
		fetchMock.mockClear();
		await waitForBackendBoot(`${JAVA_ROOT}/predict/pd`);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('壳收尾 ready 置 __horosaBackendConfirmed:未探活也立即放行', async ()=>{
		setSearch('?early=1');
		window.__horosaBackendConfirmed = true;
		await waitForBackendBoot(`${JAVA_ROOT}/chart`);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('兜底:持续拒连超 giveUp 上限后放行(交既有离线横幅/自愈,不永久卡死)', async ()=>{
		setSearch('?early=1');
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
		const t0 = Date.now();
		await waitForBackendBoot(`${JAVA_ROOT}/chart`);
		expect(Date.now() - t0).toBeGreaterThanOrEqual(150);
		expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	test('同根并发请求共享一个探活飞行(不放大探测流量)', async ()=>{
		setSearch('?early=1');
		let resolveProbe = null;
		fetchMock.mockImplementation(()=>new Promise((resolve)=>{ resolveProbe = resolve; }));
		const p1 = waitForBackendBoot(`${JAVA_ROOT}/chart`);
		const p2 = waitForBackendBoot(`${JAVA_ROOT}/ziwei/birth`);
		await new Promise((r)=>setTimeout(r, 10));
		expect(fetchMock).toHaveBeenCalledTimes(1);
		resolveProbe({ ok: true, type: 'opaque' });
		await Promise.all([p1, p2]);
	});

	test('同源(静态服务器)与相对路径不设门', async ()=>{
		setSearch('?early=1');
		await waitForBackendBoot(`${window.location.origin}/index.html`);
		await waitForBackendBoot('/local/asset.json');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('kill-switch horosa.perf.bootGate=0:early 模式也直发', async ()=>{
		window.localStorage.setItem('horosa.perf.bootGate', '0');
		try{
			setSearch('?early=1');
			expect(isEarlyBootMode()).toBe(false);
			await waitForBackendBoot(`${JAVA_ROOT}/chart`);
			expect(fetchMock).not.toHaveBeenCalled();
		}finally{
			window.localStorage.removeItem('horosa.perf.bootGate');
		}
	});
});
