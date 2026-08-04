/**
 * R4-B5b 主链 AbortController 三防线金标:
 * ① AbortError 不算「后端不可达」(不触发退避重试/离线横幅——serviceStatus 既有防线锁死);
 * ② fetchChart 带 signal 的请求不入 chartInflight 共享(A abort 不连坐同参搭车 B);
 * ③ request 层 abort 短路语义锚(signal.aborted 时不走自愈直接上抛)。
 */
import { isBackendUnreachableError } from '../serviceStatus';

describe('mainChainAbort(R4-B5b)', () => {
	it('① AbortError 不判离线:不重试不置离线横幅', () => {
		const abortErr = new Error('The user aborted a request.');
		abortErr.name = 'AbortError';
		expect(isBackendUnreachableError(abortErr)).toBe(false);
	});

	it('② fetchChart 带 signal 不入在途共享,不带 signal 照常共享', () => {
		jest.isolateModules(() => {
			jest.doMock('../request', () => ({
				__esModule: true,
				default: jest.fn(() => new Promise(() => {})), // 永挂起:考察在途共享行为
			}));
			// eslint-disable-next-line global-require
			const service = require('../../services/astro');
			// eslint-disable-next-line global-require
			const request = require('../request').default;
			const values = { probe: 'abort-share-1' };
			const ctl = { signal: { aborted: false } };
			service.fetchChart(values, { signal: ctl.signal });
			service.fetchChart(values, { signal: ctl.signal });
			// 带 signal:两次各自真发(不共享在途)
			expect(request.mock.calls.length).toBe(2);
			const plain = { probe: 'abort-share-2' };
			service.fetchChart(plain, {});
			service.fetchChart(plain, {});
			// 不带 signal:第二次搭车在途,只真发一次
			expect(request.mock.calls.length).toBe(3);
		});
	});

	it('③ request 层 abort 短路锚:signal.aborted 分支在自愈之前(源码结构断言)', () => {
		// 行为级 mock fetch 全链过重;此锚锁「短路在 healAndRetryOnce 之前」的代码次序——
		// 次序颠倒(先自愈后短路)= abort 触发身份再协商,即本锚要防的回归。
		// eslint-disable-next-line global-require
		const fs = require('fs');
		// eslint-disable-next-line global-require
		const path = require('path');
		const src = fs.readFileSync(path.join(__dirname, '..', 'request.js'), 'utf8');
		const guards = [...src.matchAll(/options\.signal && options\.signal\.aborted/g)];
		expect(guards.length).toBeGreaterThanOrEqual(2); // requestCore + requestRaw 两路
		const firstGuard = src.indexOf('options.signal && options.signal.aborted');
		const firstHeal = src.indexOf('const healed = await healAndRetryOnce');
		expect(firstGuard).toBeGreaterThan(-1);
		expect(firstHeal).toBeGreaterThan(-1);
		expect(firstGuard).toBeLessThan(firstHeal);
	});
});
