// horosa_pump_gap_v1(PERF-R13 F1)—— 泵拍间隔分档金标。
// 病根断言(旧节拍):缓存直供任务也等满 80ms;真网络任务后空窗 = 其耗时(480ms 请求 ⇒ 480ms 空窗)。
// 新节拍:缓存直供(<8ms)零间隔;真网络任务后 max(80, 耗时) 封顶 120ms。关闸 = 旧节拍逐字节。
// 台架:老式假计时器不接管 Date.now,这里手动接管一只与 advanceTimersByTime 同步推进的时钟,
// 让 lastTaskDurationMs 按「任务真跨越的假时间」计量(网络任务 = setTimeout 500ms 后 resolve)。
// jsdom 无 requestIdleCallback ⇒ 非首目标组任务每拍走 250ms 降级档,首目标组走 fast-first 32ms;
// 各用例末尾必须把队列排干(模块级 running/queue 跨用例共享,半途弃用例会把后续用例卡死)。
import { submitStepPrefetch } from '../stepPrefetch';

describe('horosa_pump_gap_v1:泵拍间隔按缓存直供/真网络分档', () => {
	let now = 0;
	let realNow;
	const advance = async (ms) => {
		for (let t = 0; t < ms; t += 10) {
			now += 10;
			jest.advanceTimersByTime(10);
			await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
		}
	};
	const instant = (name, onRun) => ({ name, path: '/qimen/pan', run: () => { onRun(); return Promise.resolve(); } });
	const slow = (name, ms, onRun) => ({ name, path: '/qimen/pan', run: () => { onRun(); return new Promise((r) => setTimeout(r, ms)); } });

	beforeEach(() => {
		jest.useFakeTimers();
		now = 0;
		realNow = Date.now;
		Date.now = () => now;
	});
	afterEach(() => {
		Date.now = realNow;
		jest.useRealTimers();
		window.localStorage.removeItem('horosa.perf.stepPrefetchPumpGap');
	});

	test('开闸:首目标组两个缓存直供任务 80ms 内全部派发(a@32 → 零间隔 → b@64)', async () => {
		let ran = 0;
		submitStepPrefetch([instant('a', () => { ran += 1; }), instant('b', () => { ran += 1; }), instant('c', () => { ran += 1; })]);
		await advance(80);
		expect(ran).toBe(2);
		await advance(600);
		expect(ran).toBe(3);
	});

	test('关闸:同样任务 80ms 内只发出首任务(旧节拍缓存命中也等满 80ms)', async () => {
		window.localStorage.setItem('horosa.perf.stepPrefetchPumpGap', '0');
		let ran = 0;
		submitStepPrefetch([instant('a', () => { ran += 1; }), instant('b', () => { ran += 1; }), instant('c', () => { ran += 1; })]);
		await advance(80);
		expect(ran).toBe(1);
		await advance(800);
		expect(ran).toBe(3);   // 旧节拍稍后也全发完:只改节拍不改集合
	});

	test('开闸:真网络任务(500ms)之后的空窗封顶 120ms,不再等满一个耗时', async () => {
		let ran = 0;
		submitStepPrefetch([slow('a', 500, () => { ran += 1; }), instant('b', () => { ran += 1; })]);
		await advance(50);
		expect(ran).toBe(1);            // 首发 32ms
		await advance(500);             // a 在 ~540ms resolve
		await advance(200);             // + 封顶 120ms + fast-first 32ms ⇒ b 在 ~700ms 前必发
		expect(ran).toBe(2);
	});

	test('关闸:真网络任务(500ms)之后旧节拍空窗 = 耗时(~500ms),750ms 时 b 仍未发', async () => {
		window.localStorage.setItem('horosa.perf.stepPrefetchPumpGap', '0');
		let ran = 0;
		submitStepPrefetch([slow('a', 500, () => { ran += 1; }), instant('b', () => { ran += 1; })]);
		await advance(750);
		expect(ran).toBe(1);
		await advance(600);
		expect(ran).toBe(2);
	});
});
