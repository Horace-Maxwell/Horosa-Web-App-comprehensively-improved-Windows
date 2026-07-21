// 主盘时间派发调度器(WP-E 防抖改形)金标 —— fake timers 锁行为。
//
// 🔴 旧式纯 trailing 180ms:每一次步进/格子/此刻都白等 180ms 才发请求(固定延迟税)。
//    新式 leading 立发 + trailing 合并:单次 0ms 起跑;连点首发立即、中间全并、末发兜底。
import {
	scheduleUnconfirmedTimeDispatch,
	cancelPendingTimeDispatch,
	__resetTimeDispatchScheduler,
} from '../timeDispatchScheduler';

beforeEach(() => {
	jest.useFakeTimers('modern');   // umi-test 的 jest 默认 legacy,setSystemTime 须 modern
	// fake timers 也要接管 Date.now —— 调度器用它算 leading 窗口
	jest.setSystemTime(100000);   // 起点须 >窗口:设 0 会让「now-leadingAt(0)>180」恒假,首发假死
	__resetTimeDispatchScheduler();
	window.localStorage.removeItem('horosa.perf.leadingDebounce');
});
afterEach(() => { jest.useRealTimers(); });

describe('🔴 leading 立发:单次操作 0ms 起跑(旧式白等 180ms)', () => {
	test('首发立即派、payload 原样', () => {
		const fn = jest.fn();
		scheduleUnconfirmedTimeDispatch(fn, { v: 1 });
		expect(fn).toHaveBeenCalledTimes(1);          // 不等计时器
		expect(fn).toHaveBeenCalledWith({ v: 1 });
	});

	test('🔴 连发 5 次:首发立即 + 末发 trailing,共 2 次,且末发是最后的 payload', () => {
		const fn = jest.fn();
		for(let i = 1; i <= 5; i += 1){
			scheduleUnconfirmedTimeDispatch(fn, { v: i });
			jest.advanceTimersByTime(30);             // 30ms 一点,全在 180ms 窗口内
			jest.setSystemTime(Date.now() + 30);
		}
		expect(fn).toHaveBeenCalledTimes(1);          // 此刻只有 leading 那发
		expect(fn.mock.calls[0][0]).toEqual({ v: 1 });
		jest.advanceTimersByTime(180);
		expect(fn).toHaveBeenCalledTimes(2);          // trailing 兜底一发
		expect(fn.mock.calls[1][0]).toEqual({ v: 5 }); // 且是最后一份 payload
	});

	test('窗口过后再点:又是 leading 立发(每个孤立操作都 0ms)', () => {
		const fn = jest.fn();
		scheduleUnconfirmedTimeDispatch(fn, { v: 1 });
		jest.advanceTimersByTime(400);
		jest.setSystemTime(Date.now() + 400);   // 相对推进(绝对值会被起点碾过)
		scheduleUnconfirmedTimeDispatch(fn, { v: 2 });
		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn.mock.calls[1][0]).toEqual({ v: 2 });
	});
});

describe('confirmed 直发前的取消', () => {
	test('🔴 cancel 后在途 trailing 不追发(否则「确定」后旧 payload 补一枪)', () => {
		const fn = jest.fn();
		scheduleUnconfirmedTimeDispatch(fn, { v: 1 });   // leading
		jest.setSystemTime(30);
		scheduleUnconfirmedTimeDispatch(fn, { v: 2 });   // 进 trailing
		cancelPendingTimeDispatch();
		jest.advanceTimersByTime(500);
		expect(fn).toHaveBeenCalledTimes(1);             // trailing 已被取消
	});
});

describe('kill-switch:关 = 纯 trailing 旧行为', () => {
	test('flag=0 时首发也要等 180ms,连发只出最后一份', () => {
		window.localStorage.setItem('horosa.perf.leadingDebounce', '0');
		const fn = jest.fn();
		scheduleUnconfirmedTimeDispatch(fn, { v: 1 });
		expect(fn).not.toHaveBeenCalled();               // 旧行为:不立发
		scheduleUnconfirmedTimeDispatch(fn, { v: 2 });
		jest.advanceTimersByTime(180);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn.mock.calls[0][0]).toEqual({ v: 2 });
	});
});
