// PERF-R10 Ship5 缓存统一金标:
//   ① horosa_kentang_l3_v1:kentang 结果缓存的 IndexedDB 持久位 —— 信封 rev 闸(rv 不符=miss)、
//     命中回填内存、成功才写、空/错不入(投毒防护与 requestDedupe 同律);
//   ② horosa_moira_stable_key_v1:同 (params,transitParams) 不同 chartObj.chartId → 第二次命中
//     (rawFn 只跑一次)—— 旧键含随机 chartId 时同参永不命中的退化在此钉死;
//   ③ cachedPost cfg.key 显式键覆盖生效。
// jest.mock 会被提升到 import 之前 —— 存储必须活在 factory 闭包里,经模块导出句柄取用。
jest.mock('../../utils/idbCacheStore', () => {
	const store = new Map();
	return {
		__store: store,
		idbGet: async (k) => store.get(k),
		idbScheduleWrite: (k, factory) => {
			const v = factory();
			if (v !== null && v !== undefined) { store.set(k, v); }
		},
	};
});
jest.mock('../../utils/request', () => ({
	__esModule: true,
	default: jest.fn(async () => ({ Result: 'net', ResultCode: 0 })),
}));

import { __store as idbStore } from '../../utils/idbCacheStore';
import { cachedKentangCall, clearKentangResultCache, __resetKtL3RevForTest } from '../_kentangResultCache';
import { cachedPost } from '../_requestCache';
import request from '../../utils/request';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
	idbStore.clear();
	clearKentangResultCache();
	__resetKtL3RevForTest();
	window.localStorage.removeItem('horosa.perf.kentangL3');
	window.localStorage.removeItem('horosa.perf.techniqueResultCache');
	request.mockClear();
});

describe('horosa_kentang_l3_v1', () => {
	test('成功结果写入 L3;清内存后同键从 L3 命中且 rawFn 不再跑;命中回填内存', async () => {
		let calls = 0;
		const raw = async () => { calls += 1; return { pan: [1, 2, 3] }; };
		const r1 = await cachedKentangCall('qimen/pan', { d: 1 }, raw, { key: 'k1' });
		expect(r1).toEqual({ pan: [1, 2, 3] });
		expect(calls).toBe(1);
		expect([...idbStore.keys()]).toEqual(['kt.qimen/pan|k1']);
		clearKentangResultCache();                    // 模拟重启:内存全冷,持久位仍在
		const r2 = await cachedKentangCall('qimen/pan', { d: 1 }, raw, { key: 'k1' });
		expect(r2).toEqual({ pan: [1, 2, 3] });
		expect(calls).toBe(1);                        // L3 命中,零重算
		clearKentangResultCache();
		idbStore.clear();                             // 持久位没了 → 回填过的也清了 → 必重算
		const r3 = await cachedKentangCall('qimen/pan', { d: 1 }, raw, { key: 'k1' });
		expect(calls).toBe(2);
		expect(r3).toEqual({ pan: [1, 2, 3] });
	});

	test('rev 闸:信封 rev 不等于当前 rev(runtime 更新)⇒ 判 miss 重算 —— 陈果窗封死', async () => {
		let calls = 0;
		const raw = async () => { calls += 1; return { v: calls }; };
		await cachedKentangCall('qimen/pan', {}, raw, { key: 'k2' });
		expect(calls).toBe(1);
		// 篡改信封 rev = 模拟旧 runtime 写的档
		const k = 'kt.qimen/pan|k2';
		const row = JSON.parse(idbStore.get(k));
		row.rev = 'kt-v1|old-runtime';
		idbStore.set(k, JSON.stringify(row));
		clearKentangResultCache();
		await cachedKentangCall('qimen/pan', {}, raw, { key: 'k2' });
		expect(calls).toBe(2);                        // 不认旧 rev
	});

	test('空/抛错不写 L3(投毒防护);kill-switch 关 = 不读不写持久位', async () => {
		await cachedKentangCall('t/pan', {}, async () => null, { key: 'k3' }).catch(() => {});
		await cachedKentangCall('t/pan', {}, async () => { throw new Error('x'); }, { key: 'k4' }).catch(() => {});
		expect(idbStore.size).toBe(0);
		window.localStorage.setItem('horosa.perf.kentangL3', '0');
		let calls = 0;
		await cachedKentangCall('t/pan', {}, async () => { calls += 1; return { ok: 1 }; }, { key: 'k5' });
		expect(idbStore.size).toBe(0);                // 关闸不写
		clearKentangResultCache();
		await cachedKentangCall('t/pan', {}, async () => { calls += 1; return { ok: 1 }; }, { key: 'k5' });
		expect(calls).toBe(2);                        // 关闸也不读 → 纯内存旧行为
	});
});

describe('horosa_moira_stable_key_v1(cachedPost cfg.key)', () => {
	test('显式键:同 (params,transitParams) 不同 chartId → 第二次命中,网络只发一次', async () => {
		const key = JSON.stringify({ params: { date: 'D' }, transitParams: { y: 2026 } });
		const mk = (cid) => ({ params: { date: 'D' }, chartObj: { chartId: cid, big: 'x'.repeat(64) }, transitParams: { y: 2026 } });
		const r1 = await cachedPost('http://x/qizheng/moira', mk('aaaa1111'), { silent: true }, { ns: 'qizheng/moira', key });
		await wait(5);
		const r2 = await cachedPost('http://x/qizheng/moira', mk('bbbb2222'), { silent: true }, { ns: 'qizheng/moira', key });
		expect(request).toHaveBeenCalledTimes(1);     // 旧键(整 body 含随机 chartId)时这里必是 2
		expect(r1).toEqual(r2);
	});
});
