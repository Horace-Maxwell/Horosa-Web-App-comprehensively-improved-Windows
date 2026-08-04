/**
 * R4-B5b optionDispatchScheduler 金标:
 * ① 连拨 5 次 → 恰 2 发(leading 立发 + trailing 合并);
 * ② trailing payload = 发时点 fresh base + 窗口内全部 delta(时间键恒最新——base 中途
 *    变化时以变化后为准,选项 delta 一个不丢);
 * ③ kill-switch 关 → 每次各发各的(5 次)。
 */
import { scheduleOptionDispatch, __resetOptionDispatchScheduler } from '../optionDispatchScheduler';
import { safeLocalStorageSet } from '../safeStorage';

describe('optionDispatchScheduler(R4-B5b)', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		__resetOptionDispatchScheduler();
		safeLocalStorageSet('horosa.perf.optionDebounce', '1');
	});
	afterEach(() => {
		jest.useRealTimers();
		safeLocalStorageSet('horosa.perf.optionDebounce', '');
	});

	it('连拨 5 次恰 2 发:leading 带首键,trailing 带后四键合并', () => {
		const fired = [];
		const base = { date: { value: 'D1' } };
		const getBase = () => ({ ...base });
		scheduleOptionDispatch((p) => fired.push(p), { a: { value: 1 } }, getBase);
		scheduleOptionDispatch((p) => fired.push(p), { b: { value: 2 } }, getBase);
		scheduleOptionDispatch((p) => fired.push(p), { c: { value: 3 } }, getBase);
		scheduleOptionDispatch((p) => fired.push(p), { d: { value: 4 } }, getBase);
		scheduleOptionDispatch((p) => fired.push(p), { e: { value: 5 } }, getBase);
		expect(fired.length).toBe(1);
		expect(fired[0].a.value).toBe(1);
		jest.advanceTimersByTime(260);
		expect(fired.length).toBe(2);
		expect(fired[1].b.value).toBe(2);
		expect(fired[1].c.value).toBe(3);
		expect(fired[1].d.value).toBe(4);
		expect(fired[1].e.value).toBe(5);
	});

	it('trailing 发时点重取 base:窗口内时间键变化以最新为准(不覆盖时间轴在途变更)', () => {
		const fired = [];
		const live = { date: { value: 'OLD' } };
		scheduleOptionDispatch((p) => fired.push(p), { a: { value: 1 } }, () => ({ ...live }));
		scheduleOptionDispatch((p) => fired.push(p), { b: { value: 2 } }, () => ({ ...live }));
		live.date = { value: 'NEW' }; // 模拟时间轴变更在 trailing 窗口内落库
		jest.advanceTimersByTime(260);
		expect(fired.length).toBe(2);
		expect(fired[1].date.value).toBe('NEW');
		expect(fired[1].b.value).toBe(2);
	});

	it('kill-switch 关 → 逐发不合并', () => {
		safeLocalStorageSet('horosa.perf.optionDebounce', '0');
		const fired = [];
		const getBase = () => ({});
		for (let i = 0; i < 5; i += 1) {
			scheduleOptionDispatch((p) => fired.push(p), { [`k${i}`]: { value: i } }, getBase);
		}
		expect(fired.length).toBe(5);
	});

	it('窗口过后再拨 → 新 leading 立发(非永久合并)', () => {
		// legacy fake timers 不推进 Date.now —— 用 spy 手动推墙钟。
		const fired = [];
		const getBase = () => ({});
		let wallClock = 1000000;
		const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => wallClock);
		try {
			scheduleOptionDispatch((p) => fired.push(p), { a: { value: 1 } }, getBase);
			wallClock += 300;
			scheduleOptionDispatch((p) => fired.push(p), { b: { value: 2 } }, getBase);
			expect(fired.length).toBe(2);
			expect(fired[1].b.value).toBe(2);
		} finally {
			nowSpy.mockRestore();
		}
	});
});
