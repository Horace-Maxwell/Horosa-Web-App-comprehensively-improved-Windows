import { startRecoveryPolling, buildDefaultRecoveryProbe, invokeLightServiceRestart } from '../serviceRecovery';

// 微任务冲刷:probe 的 Promise 链在 fake timers 下需要手动放行
const flushPromises = () => Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());

describe('serviceRecovery 自动恢复轮询', () => {
	beforeEach(() => { jest.useFakeTimers(); });
	afterEach(() => { jest.useRealTimers(); });

	test('失败继续轮询;成功恰好回调一次并自动停', async () => {
		let call = 0;
		const seq = [false, false, true];
		const probe = jest.fn(() => Promise.resolve(seq[Math.min(call++, seq.length - 1)]));
		const onOnline = jest.fn();
		startRecoveryPolling({ intervalMs: 10000, probe, onOnline });

		jest.advanceTimersByTime(10000);
		await flushPromises();
		expect(probe).toHaveBeenCalledTimes(1);
		expect(onOnline).not.toHaveBeenCalled();

		jest.advanceTimersByTime(10000);
		await flushPromises();
		expect(probe).toHaveBeenCalledTimes(2);

		jest.advanceTimersByTime(10000);
		await flushPromises();
		expect(probe).toHaveBeenCalledTimes(3);
		expect(onOnline).toHaveBeenCalledTimes(1);

		// 恢复即停:此后不再有任何探测
		jest.advanceTimersByTime(60000);
		await flushPromises();
		expect(probe).toHaveBeenCalledTimes(3);
		expect(onOnline).toHaveBeenCalledTimes(1);
	});

	test('stop 句柄:停后不再探测也不再回调(幂等)', async () => {
		const probe = jest.fn(() => Promise.resolve(true));
		const onOnline = jest.fn();
		const stop = startRecoveryPolling({ intervalMs: 10000, probe, onOnline });
		stop();
		stop(); // 幂等
		jest.advanceTimersByTime(50000);
		await flushPromises();
		expect(probe).not.toHaveBeenCalled();
		expect(onOnline).not.toHaveBeenCalled();
	});

	test('probe 抛错按未恢复处理,轮询不中断', async () => {
		let call = 0;
		const probe = jest.fn(() => {
			call += 1;
			if (call === 1) return Promise.reject(new Error('boom'));
			return Promise.resolve(true);
		});
		const onOnline = jest.fn();
		startRecoveryPolling({ intervalMs: 10000, probe, onOnline });
		jest.advanceTimersByTime(10000);
		await flushPromises();
		expect(onOnline).not.toHaveBeenCalled();
		jest.advanceTimersByTime(10000);
		await flushPromises();
		expect(onOnline).toHaveBeenCalledTimes(1);
	});
});

describe('buildDefaultRecoveryProbe 探测组装', () => {
	test('首验通过 → true 且不触发再协商', async () => {
		const verify = jest.fn(() => Promise.resolve({ ok: true }));
		const renegotiate = jest.fn(() => Promise.resolve({ changed: false }));
		const probe = buildDefaultRecoveryProbe({
			verifyBackendIdentity: verify,
			renegotiateLocalServerRoot: renegotiate,
			getServerRoot: () => 'http://127.0.0.1:9999',
		});
		await expect(probe()).resolves.toBe(true);
		expect(renegotiate).not.toHaveBeenCalled();
	});

	test('首验不过 → 再协商后二验通过 → true(verify-to-switch 生效)', async () => {
		const verify = jest.fn()
			.mockResolvedValueOnce({ ok: false, reason: 'unreachable' })
			.mockResolvedValueOnce({ ok: true });
		const renegotiate = jest.fn(() => Promise.resolve({ changed: true }));
		const probe = buildDefaultRecoveryProbe({
			verifyBackendIdentity: verify,
			renegotiateLocalServerRoot: renegotiate,
			getServerRoot: () => 'http://127.0.0.1:9999',
		});
		await expect(probe()).resolves.toBe(true);
		expect(renegotiate).toHaveBeenCalledTimes(1);
	});

	test('两验皆败 → false;verify 抛错 → false(绝不抛)', async () => {
		const verifyFail = jest.fn(() => Promise.resolve({ ok: false }));
		const probeFail = buildDefaultRecoveryProbe({
			verifyBackendIdentity: verifyFail,
			renegotiateLocalServerRoot: jest.fn(() => Promise.resolve({})),
			getServerRoot: () => 'http://127.0.0.1:9999',
		});
		await expect(probeFail()).resolves.toBe(false);
		const probeThrow = buildDefaultRecoveryProbe({
			verifyBackendIdentity: jest.fn(() => Promise.reject(new Error('net'))),
			renegotiateLocalServerRoot: jest.fn(() => Promise.resolve({})),
			getServerRoot: () => 'http://127.0.0.1:9999',
		});
		await expect(probeThrow()).resolves.toBe(false);
	});
});

describe('invokeLightServiceRestart(横幅/状态灯/弹窗三处统一入口)', ()=>{
	test('轻量命令成功 → light,不碰全量修复', async ()=>{
		const calls = [];
		const api = { invoke: async (cmd)=>{ calls.push(cmd); } };
		await expect(invokeLightServiceRestart(api)).resolves.toBe('light');
		expect(calls).toEqual(['restart_local_services_command']);
	});
	test('老壳无轻量命令 → 回退全量修复(代数差安全)→ full', async ()=>{
		const calls = [];
		const api = { invoke: async (cmd)=>{
			calls.push(cmd);
			if(cmd === 'restart_local_services_command'){ throw new Error('unknown command'); }
		} };
		await expect(invokeLightServiceRestart(api)).resolves.toBe('full');
		expect(calls).toEqual(['restart_local_services_command', 'trigger_runtime_repair_command']);
	});
	test('两者皆失败 → 抛错(调用方报「重启失败」)', async ()=>{
		const api = { invoke: async ()=>{ throw new Error('boom'); } };
		await expect(invokeLightServiceRestart(api)).rejects.toThrow('boom');
	});
	test('无桥 → 立即抛(非桌面环境)', async ()=>{
		await expect(invokeLightServiceRestart(null)).rejects.toThrow();
	});
});
