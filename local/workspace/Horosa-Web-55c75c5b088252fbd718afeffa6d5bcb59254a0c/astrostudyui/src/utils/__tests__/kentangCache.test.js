// [R3-A3] kentang 缓存壳金标:命中链/键等性/坑49 守卫/HTTP 透传/开关直通/
// qizhengkin 年键守卫/预取纪律(seedInBody 绝不预取)/在途去重/L3 rev 闸。
import {
	cachedKentangFetch, prefetchKentang, buildKentangCacheKey,
	__ktCacheStateForTest, __ktCacheResetForTest,
} from '../kentangCache';
import { fetchChartWithRetry } from '../chartFetch';
import { idbGet, idbScheduleWrite } from '../idbCacheStore';

jest.mock('../chartFetch', ()=>({
	fetchChartWithRetry: jest.fn(),
}));
jest.mock('../idbCacheStore', ()=>{
	const mockStore = new Map();
	return {
		__esModule: true,
		idbGet: jest.fn(async (key)=>mockStore.get(key)),
		idbScheduleWrite: jest.fn((key, factory)=>{
			const v = factory();
			if(v !== null && v !== undefined){ mockStore.set(key, v); }
		}),
		__mockIdbStore: mockStore,
	};
});

const OK_TEXT = JSON.stringify({ ResultCode: 0, pan: { sections: [{ title: 'x' }] } });

function okResp(text){
	return { ok: true, status: 200, text: async ()=>text };
}

function post(body){
	return { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body) };
}

beforeEach(()=>{
	__ktCacheResetForTest();
	fetchChartWithRetry.mockReset();
	idbGet.mockClear();
	idbScheduleWrite.mockClear();
	// eslint-disable-next-line global-require
	require('../idbCacheStore').__mockIdbStore.clear();
	try{ localStorage.removeItem('horosa.perf.kentangCache'); }catch(e){ /* ignore */ }
});

describe('[R3-A3] kentangCache', ()=>{
	test('命中链:首发走网络入缓存,二发 L1 命中零网络;结果逐字节同', async ()=>{
		fetchChartWithRetry.mockResolvedValueOnce(okResp(OK_TEXT));
		const url = 'http://127.0.0.1:8899/qimen/pan';
		const r1 = await cachedKentangFetch(url, post({ year: 2026, day: 1 }));
		expect(await r1.text()).toBe(OK_TEXT);
		expect(r1.__horosaKtSource).toBe('net');
		const r2 = await cachedKentangFetch(url, post({ year: 2026, day: 1 }));
		expect(r2.__horosaKtSource).toBe('l1');
		expect(await r2.text()).toBe(OK_TEXT);
		expect(fetchChartWithRetry).toHaveBeenCalledTimes(1);
	});

	test('键=去端口化 path+body(端口漂移不废缓存;body 逐字节参与)', ()=>{
		const b = JSON.stringify({ a: 1 });
		expect(buildKentangCacheKey('http://127.0.0.1:8899/taiyi/pan', b))
			.toBe(buildKentangCacheKey('http://127.0.0.1:9999/taiyi/pan', b));
		expect(buildKentangCacheKey('http://127.0.0.1:8899/taiyi/pan', b))
			.not.toBe(buildKentangCacheKey('http://127.0.0.1:8899/taiyi/pan', JSON.stringify({ a: 2 })));
	});

	test('坑49:空文/坏 JSON/ResultCode≠0 一律不入缓存(每次都重打网络)', async ()=>{
		const url = 'http://127.0.0.1:8899/taiyi/pan';
		for(const bad of ['', 'not-json', JSON.stringify({ ResultCode: 9999 })]){
			fetchChartWithRetry.mockResolvedValueOnce(okResp(bad));
			fetchChartWithRetry.mockResolvedValueOnce(okResp(bad));
			// eslint-disable-next-line no-await-in-loop
			await cachedKentangFetch(url, post({ q: bad.length }));
			// eslint-disable-next-line no-await-in-loop
			const r2 = await cachedKentangFetch(url, post({ q: bad.length }));
			expect(r2.__horosaKtSource).toBe('net');
		}
		expect(fetchChartWithRetry).toHaveBeenCalledTimes(6);
	});

	test('HTTP !ok:原响应对象原样透传、body 不消费、不入缓存', async ()=>{
		const errResp = { ok: false, status: 500, text: async ()=>'traceback' };
		fetchChartWithRetry.mockResolvedValue(errResp);
		const r = await cachedKentangFetch('http://127.0.0.1:8899/jinkou/pan', post({ x: 1 }));
		expect(r).toBe(errResp);
		expect(__ktCacheStateForTest().l1.size).toBe(0);
	});

	test('kill-switch:关=直通旧路径,返回原 Response,零缓存行为', async ()=>{
		localStorage.setItem('horosa.perf.kentangCache', '0');
		const raw = okResp(OK_TEXT);
		fetchChartWithRetry.mockResolvedValue(raw);
		const r1 = await cachedKentangFetch('http://127.0.0.1:8899/qimen/pan', post({ y: 1 }));
		const r2 = await cachedKentangFetch('http://127.0.0.1:8899/qimen/pan', post({ y: 1 }));
		expect(r1).toBe(raw);
		expect(r2).toBe(raw);
		expect(fetchChartWithRetry).toHaveBeenCalledTimes(2);
		expect(__ktCacheStateForTest().l1.size).toBe(0);
	});

	test('未知模块路径:直通不缓存(新模块必须先登记矩阵)', async ()=>{
		const raw = okResp(OK_TEXT);
		fetchChartWithRetry.mockResolvedValue(raw);
		const r = await cachedKentangFetch('http://127.0.0.1:8899/nosuchmodule/pan', post({ y: 1 }));
		expect(r).toBe(raw);
		expect(__ktCacheStateForTest().l1.size).toBe(0);
	});

	test('qizhengkin 年键守卫:缺 currentYear=不入缓存(服务端 now() 兜底形态);带年键=正常缓存', async ()=>{
		const url = 'http://127.0.0.1:8899/qizhengkin/pan';
		fetchChartWithRetry.mockResolvedValue(okResp(OK_TEXT));
		await cachedKentangFetch(url, post({ year: 1990 }));           // 缺年键
		expect(__ktCacheStateForTest().l1.size).toBe(0);
		await cachedKentangFetch(url, post({ year: 1990, currentYear: 2026 }));
		expect(__ktCacheStateForTest().l1.size).toBe(1);
	});

	test('🔴 预取纪律:deterministic 可预取;seedInBody(geomancy/taixuan/jingjue)/browse(xuanshi) 代码层拒绝', async ()=>{
		fetchChartWithRetry.mockResolvedValue(okResp(OK_TEXT));
		expect(await prefetchKentang('http://127.0.0.1:8899/qimen/pan', { y: 1 })).toBe(true);
		expect(fetchChartWithRetry).toHaveBeenCalledTimes(1);
		for(const m of ['geomancy', 'taixuan', 'jingjue', 'xuanshi']){
			// eslint-disable-next-line no-await-in-loop
			expect(await prefetchKentang(`http://127.0.0.1:8899/${m}/pan`, { y: 1 })).toBe(false);
		}
		expect(fetchChartWithRetry).toHaveBeenCalledTimes(1); // 四个拒绝零网络
	});

	test('在途去重:并发同 key 只打一次网络,双方拿到同文本', async ()=>{
		let release;
		const gate = new Promise((res)=>{ release = res; });
		fetchChartWithRetry.mockImplementation(async ()=>{ await gate; return okResp(OK_TEXT); });
		const url = 'http://127.0.0.1:8899/wuzhao/pan';
		const p1 = cachedKentangFetch(url, post({ z: 1 }));
		const p2 = cachedKentangFetch(url, post({ z: 1 }));
		release();
		const [r1, r2] = await Promise.all([p1, p2]);
		expect(await r1.text()).toBe(OK_TEXT);
		expect(await r2.text()).toBe(OK_TEXT);
		expect(fetchChartWithRetry).toHaveBeenCalledTimes(1);
	});

	test('L3 rev 闸:rev 不符的旧信封=miss(重打网络)', async ()=>{
		const url = 'http://127.0.0.1:8899/shaozi/pan';
		const body = post({ n: 7 });
		const key = buildKentangCacheKey(url, body.body);
		// eslint-disable-next-line global-require
		require('../idbCacheStore').__mockIdbStore.set(key,
			JSON.stringify({ rev: 'kt-v0|stale', at: Date.now(), text: OK_TEXT }));
		fetchChartWithRetry.mockResolvedValue(okResp(OK_TEXT));
		const r = await cachedKentangFetch(url, body);
		expect(r.__horosaKtSource).toBe('net');
		expect(fetchChartWithRetry).toHaveBeenCalledTimes(1);
	});

	test('L3 命中:合法信封跨会话命中零网络', async ()=>{
		const url = 'http://127.0.0.1:8899/tieban/pan';
		const body = post({ n: 8 });
		const key = buildKentangCacheKey(url, body.body);
		// eslint-disable-next-line global-require
		require('../idbCacheStore').__mockIdbStore.set(key,
			JSON.stringify({ rev: 'kt-v1', at: Date.now(), text: OK_TEXT }));
		const r = await cachedKentangFetch(url, body);
		expect(r.__horosaKtSource).toBe('l3');
		expect(await r.text()).toBe(OK_TEXT);
		expect(fetchChartWithRetry).toHaveBeenCalledTimes(0);
	});
});
