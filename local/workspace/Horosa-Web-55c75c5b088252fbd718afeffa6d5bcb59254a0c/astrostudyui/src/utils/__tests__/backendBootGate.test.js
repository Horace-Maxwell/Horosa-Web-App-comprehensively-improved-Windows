// [B1] boot-gate 金标:非 early 恒 no-op(零行为变化的根据)/early 探活排队/壳确认短路/
// 兜底放行/同根单飞共享。探活 fetch 全程 mock,不打真网络。
import {
	waitForBackendBoot,
	isEarlyBootMode,
	__resetBackendBootGateForTest,
	bootContext, __bootGateGiveUpMsForTest,
	__bootGateRetryMsForTest,
	BACKEND_CONFIRMED_EVENT,
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
		// 🔴 本例只管「拒连要重试、起了才放行」,与 giveUp 兜底无关(那条另有专例、且自带紧预算)。
		//    公共 beforeEach 的 giveUpMs=200 是墙钟:全量并行跑时 jest 多 worker 抢核,
		//    两次探活加一次 sleep 就能超 200ms → 循环在第三次探活前走了兜底放行 → 只探到 2 次而判红
		//    (实测全量里偶发,独占跑 3/3 必绿)。故本例单独把预算放到 5s(正常只需几十 ms,留百倍余量),让兜底不可能先触发;
		//    断言本身一个字没动,兜底行为的覆盖由第 64 行那条专例保证。
		__resetBackendBootGateForTest({ retryMs: 5, giveUpMs: 5000 });
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

	// [R5 S2] 壳确认事件一到即放行:重试间隔故意放到 1s,探活恒拒连;20ms 后置旗标并派事件 → 远早于下一次重试就返回。
	test('[R5 S2] 壳 horosa:backend-confirmed 事件到达即放行,不等下一次重试', async ()=>{
		__resetBackendBootGateForTest({ retryMs: 1000, giveUpMs: 5000 });
		setSearch('?early=1');
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
		const t0 = Date.now();
		setTimeout(()=>{
			window.__horosaBackendConfirmed = true;
			window.dispatchEvent(new Event(BACKEND_CONFIRMED_EVENT));
		}, 20);
		await waitForBackendBoot(`${JAVA_ROOT}/chart`);
		expect(Date.now() - t0).toBeLessThan(600);
	});

	// [R5 S2] 重试间隔:缺省 50ms;perfFlag bootGateFastRetry=0 回旧 350ms;测试注入优先。
	test('[R5 S2] 探活重试间隔按 perfFlag:缺省 50,关=350,注入优先', ()=>{
		__resetBackendBootGateForTest();
		expect(__bootGateRetryMsForTest()).toBe(50);
		window.localStorage.setItem('horosa.perf.bootGateFastRetry', '0');
		expect(__bootGateRetryMsForTest()).toBe(350);
		window.localStorage.removeItem('horosa.perf.bootGateFastRetry');
		__resetBackendBootGateForTest({ retryMs: 7 });
		expect(__bootGateRetryMsForTest()).toBe(7);
	});
});

describe('[R5 S8] 启动上下文与更新后首启的兜底放行上限', ()=>{
	test('URL 无参:非 early、非首启、无 boot;兜底 90 s', ()=>{
		__resetBackendBootGateForTest();
		setSearch('');
		expect(bootContext()).toEqual({ early: false, firstLaunch: false, bootStartedAtMs: null });
		expect(__bootGateGiveUpMsForTest()).toBe(90000);
	});
	test('early=1&firstLaunch=1&boot=<epoch>:上下文齐全,兜底拉长到 900 s(= 启动脚本就绪总上限);注入值优先', ()=>{
		__resetBackendBootGateForTest();
		setSearch('?early=1&firstLaunch=1&boot=1790000000000');
		expect(bootContext()).toEqual({ early: true, firstLaunch: true, bootStartedAtMs: 1790000000000 });
		expect(__bootGateGiveUpMsForTest()).toBe(900000);
		// 与启动脚本的就绪总上限同值:脚本续命期间页面不得先放行
		const fs = require('fs');
		const path = require('path');
		const sh = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'start_horosa_local.sh'), 'utf8');
		const m = sh.match(/READY_TOTAL_CAP_SECS="\$\{HOROSA_READY_TOTAL_CAP_SECS:-(\d+)\}"/);
		expect(m && Number(m[1]) * 1000).toBe(900000);
		__resetBackendBootGateForTest({ giveUpMs: 123 });
		setSearch('?early=1&firstLaunch=1');
		expect(__bootGateGiveUpMsForTest()).toBe(123);
	});
	test('排盘服务直连路径(fetchChartWithRetry)同样先过就绪门:未监听则等,起了才发真请求', async ()=>{
		const { fetchChartWithRetry } = require('../chartFetch');
		__resetBackendBootGateForTest({ retryMs: 5, giveUpMs: 5000 });
		setSearch('?early=1');
		const CHART_ROOT = 'http://127.0.0.1:8899';
		const calls = [];
		global.fetch = jest.fn((u, o)=>{
			calls.push(String(u));
			if(calls.length === 1){ return Promise.reject(new TypeError('Failed to fetch')); }
			if(calls.length === 2){ return Promise.resolve({ ok: true, type: 'opaque' }); }
			return Promise.resolve({ ok: true, status: 200 });
		});
		const resp = await fetchChartWithRetry(`${CHART_ROOT}/qimen/pan`, { method: 'POST', body: '{}' });
		expect(resp.status).toBe(200);
		// 两次探活(根路径)之后才发真请求;真请求只发一次(不再靠拒连重试碰运气)
		expect(calls).toEqual([`${CHART_ROOT}/`, `${CHART_ROOT}/`, `${CHART_ROOT}/qimen/pan`]);
		delete global.fetch;
	});
	test('boot 非法(非数字/负数)→ null,不影响其它字段', ()=>{
		__resetBackendBootGateForTest();
		setSearch('?early=1&boot=abc');
		expect(bootContext()).toEqual({ early: true, firstLaunch: false, bootStartedAtMs: null });
	});
	test('上下文读完即从地址栏摘掉 firstLaunch / boot(手动刷新不再重演首启口径);early 与服务根参数保留', ()=>{
		__resetBackendBootGateForTest();
		setSearch('?early=1&firstLaunch=1&boot=1790000000000&srv=http%3A%2F%2F127.0.0.1%3A9999&rv=3.11.2-runtime1');
		expect(bootContext()).toEqual({ early: true, firstLaunch: true, bootStartedAtMs: 1790000000000 });
		const p = new URLSearchParams(window.location.search);
		expect(p.get('firstLaunch')).toBeNull();
		expect(p.get('boot')).toBeNull();
		expect(p.get('early')).toBe('1');
		expect(p.get('srv')).toBe('http://127.0.0.1:9999');
		expect(p.get('rv')).toBe('3.11.2-runtime1');
		// 本会话缓存的上下文不受地址栏变化影响;重读(= 手动刷新后的新会话)按摘掉后的地址栏 → 非首启、无 boot
		expect(bootContext().firstLaunch).toBe(true);
		__resetBackendBootGateForTest();
		expect(bootContext()).toEqual({ early: true, firstLaunch: false, bootStartedAtMs: null });
		// 没有一次性参数时不碰地址栏
		setSearch('?early=1&srv=x');
		__resetBackendBootGateForTest();
		bootContext();
		expect(window.location.search).toBe('?early=1&srv=x');
	});
});
