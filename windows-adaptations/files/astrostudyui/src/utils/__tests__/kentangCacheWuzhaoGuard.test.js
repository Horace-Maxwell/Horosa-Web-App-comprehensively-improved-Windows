// horosa_wuzhao_random_guard_v1 金标(Windows-ahead,v3.5.1):
// 五兆自动揲筮(mode!=='ganzhi' 且 !manual,服务端 random.randint 无 seed)**不得入缓存** ——
// 上游覆盖矩阵把 wuzhao 误标 deterministic;不拦则同 body 重卦返回钉死旧卦(随机语义破坏)。
// 干支法 / 手动折竹(manualSplits 全量入 body)仍享三层缓存。
jest.mock('../idbCacheStore', () => {
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
jest.mock('../chartFetch', () => ({
	fetchChartWithRetry: jest.fn(async () => ({
		ok: true,
		status: 200,
		text: async () => JSON.stringify({ ResultCode: 0, Result: { roll: Math.random() } }),
	})),
}));

import { cachedKentangFetch, __ktCacheResetForTest, __ktCacheStateForTest } from '../kentangCache';
import { fetchChartWithRetry } from '../chartFetch';

const POST = (body) => ({
	method: 'POST',
	headers: { 'Content-Type': 'application/json; charset=UTF-8' },
	body: JSON.stringify(body),
});

beforeEach(() => {
	__ktCacheResetForTest();
	fetchChartWithRetry.mockClear();
	window.localStorage.removeItem('horosa.perf.kentangCache');
});

test('自动揲筮(mode=auto,manual=false)同 body 两次 → 两次真发(绝不钉死随机)', async () => {
	const body = { year: 2026, month: 7, day: 22, mode: 'auto', manual: false };
	await cachedKentangFetch('http://127.0.0.1:8899/wuzhao/pan', POST(body), { retries: 0 });
	await cachedKentangFetch('http://127.0.0.1:8899/wuzhao/pan', POST(body), { retries: 0 });
	expect(fetchChartWithRetry).toHaveBeenCalledTimes(2);
	const { l1 } = __ktCacheStateForTest();
	expect(l1.size).toBe(0);   // 未入任何缓存层
});

test('干支法(mode=ganzhi)同 body 两次 → 第二次命中零网络', async () => {
	const body = { year: 2026, month: 7, day: 22, mode: 'ganzhi', manual: false };
	await cachedKentangFetch('http://127.0.0.1:8899/wuzhao/pan', POST(body), { retries: 0 });
	await cachedKentangFetch('http://127.0.0.1:8899/wuzhao/pan', POST(body), { retries: 0 });
	expect(fetchChartWithRetry).toHaveBeenCalledTimes(1);
});

test('手动折竹(manual=true)同 body 两次 → 第二次命中零网络', async () => {
	const body = { year: 2026, month: 7, day: 22, mode: 'auto', manual: true, manualSplits: [1, 2, 3, 4, 5, 6] };
	await cachedKentangFetch('http://127.0.0.1:8899/wuzhao/pan', POST(body), { retries: 0 });
	await cachedKentangFetch('http://127.0.0.1:8899/wuzhao/pan', POST(body), { retries: 0 });
	expect(fetchChartWithRetry).toHaveBeenCalledTimes(1);
});
