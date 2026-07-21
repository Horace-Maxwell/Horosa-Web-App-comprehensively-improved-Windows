// [A1] L3 持久结果缓存金标:跨会话命中(模拟重启)/键去端口化/版本闸/空载不存/开关回退。
// jsdom 无 IndexedDB → 以 jest.mock 换内存假店(契约与 idbCacheStore 相同:值=字符串)。
const mockStore = new Map();
jest.mock('../idbCacheStore', ()=>({
	idbGet: (key)=>Promise.resolve(mockStore.has(key) ? mockStore.get(key) : null),
	idbScheduleWrite: (key, factory)=>{
		const text = factory();
		if(typeof text === 'string'){ mockStore.set(key, text); }
	},
}));

import { dedupedRequest, __clearDedupe, __l3KeyForTest, __resetL3RevForTest } from '../requestDedupe';

const URL_A = 'http://127.0.0.1:41234/chart';
const URL_B = 'http://127.0.0.1:59999/chart';   // 换端口(模拟下次启动随机口)
const BODY = JSON.stringify({ date: '2026-07-19', time: '10:00:00', zone: '+08:00' });

function setSearch(search){
	window.history.replaceState(null, '', `${window.location.pathname}${search}`);
}

beforeEach(()=>{
	__clearDedupe();
	mockStore.clear();
	setSearch('');
	__resetL3RevForTest();
	try{ localStorage.removeItem('horosa.perf.netResultCache'); }catch(e){ /* ignore */ }
});

describe('[A1] requestDedupe L3 持久层', ()=>{
	test('键去端口化:不同端口同 path+body → 同一 L3 键', ()=>{
		expect(__l3KeyForTest(URL_A, BODY)).toBe(__l3KeyForTest(URL_B, BODY));
		expect(__l3KeyForTest(URL_A, BODY)).toBe(`net./chart ${BODY}`);
	});

	test('跨会话命中:清空内存 L1/L2 后换端口再请求 → 零网络(runner 不再被调)', async ()=>{
		const runner1 = jest.fn(()=>Promise.resolve({ pan: 'result-1' }));
		const v1 = await dedupedRequest(URL_A, { body: BODY }, runner1);
		expect(v1).toEqual({ pan: 'result-1' });
		expect(runner1).toHaveBeenCalledTimes(1);
		// 模拟重启:内存层全清(L1/L2 亡),仅 L3(假店)存续;端口换随机新口。
		__clearDedupe();
		const runner2 = jest.fn(()=>Promise.resolve({ pan: 'should-not-run' }));
		const v2 = await dedupedRequest(URL_B, { body: BODY }, runner2);
		expect(v2).toEqual({ pan: 'result-1' });
		expect(runner2).not.toHaveBeenCalled();
	});

	test('命中副本独立:两次取回互不共享引用(防就地改互染)', async ()=>{
		await dedupedRequest(URL_A, { body: BODY }, ()=>Promise.resolve({ list: [1, 2] }));
		__clearDedupe();
		const a = await dedupedRequest(URL_A, { body: BODY }, ()=>Promise.resolve(null));
		const b = await dedupedRequest(URL_A, { body: BODY }, ()=>Promise.resolve(null));
		expect(a).toEqual(b);
		a.list.push(99);
		expect(b.list).toEqual([1, 2]);
	});

	test('版本闸:rev 不符的旧档 → miss 重取', async ()=>{
		const key = __l3KeyForTest(URL_A, BODY);
		mockStore.set(key, JSON.stringify({ rev: 'net-v0-stale', at: Date.now(), value: { pan: 'stale' } }));
		const runner = jest.fn(()=>Promise.resolve({ pan: 'fresh' }));
		const v = await dedupedRequest(URL_A, { body: BODY }, runner);
		expect(v).toEqual({ pan: 'fresh' });
		expect(runner).toHaveBeenCalledTimes(1);
	});

	test('[T1] rv 版本闸:URL 带 rv 时信封 rev 掺版本,runtime 更新(rv 变)→ 旧档 miss', async ()=>{
		setSearch('?rv=3.4.0-runtime1');
		__resetL3RevForTest();
		const runner1 = jest.fn(()=>Promise.resolve({ pan: 'v340' }));
		await dedupedRequest(URL_A, { body: BODY }, runner1);
		const key = __l3KeyForTest(URL_A, BODY);
		expect(JSON.parse(mockStore.get(key)).rev).toBe('net-v1|3.4.0-runtime1');
		// 同 rv 跨会话:命中
		__clearDedupe();
		__resetL3RevForTest();
		const runner2 = jest.fn(()=>Promise.resolve({ pan: 'nope' }));
		expect(await dedupedRequest(URL_B, { body: BODY }, runner2)).toEqual({ pan: 'v340' });
		expect(runner2).not.toHaveBeenCalled();
		// runtime 更新(rv 变):旧档必须 miss 重算——封死 24h 陈果窗
		setSearch('?rv=3.5.0-runtime1');
		__clearDedupe();
		__resetL3RevForTest();
		const runner3 = jest.fn(()=>Promise.resolve({ pan: 'v350' }));
		expect(await dedupedRequest(URL_A, { body: BODY }, runner3)).toEqual({ pan: 'v350' });
		expect(runner3).toHaveBeenCalledTimes(1);
	});

	test('[T1] 无 rv 参(dev 直跑):rev 保持 net-v1 旧行为', async ()=>{
		await dedupedRequest(URL_A, { body: BODY }, ()=>Promise.resolve({ pan: 'dev' }));
		expect(JSON.parse(mockStore.get(__l3KeyForTest(URL_A, BODY))).rev).toBe('net-v1');
	});

	test('TTL 过期档 → miss 重取', async ()=>{
		const key = __l3KeyForTest(URL_A, BODY);
		mockStore.set(key, JSON.stringify({ rev: 'net-v1', at: Date.now() - 25 * 60 * 60 * 1000, value: { pan: 'old' } }));
		const runner = jest.fn(()=>Promise.resolve({ pan: 'fresh' }));
		const v = await dedupedRequest(URL_A, { body: BODY }, runner);
		expect(v).toEqual({ pan: 'fresh' });
		expect(runner).toHaveBeenCalledTimes(1);
	});

	test('空载荷(吞错型失败)不入 L3:重启后仍会真发请求', async ()=>{
		await dedupedRequest(URL_A, { body: BODY }, ()=>Promise.resolve(undefined));
		expect(mockStore.size).toBe(0);
		__clearDedupe();
		const runner = jest.fn(()=>Promise.resolve({ pan: 'ok' }));
		const v = await dedupedRequest(URL_A, { body: BODY }, runner);
		expect(v).toEqual({ pan: 'ok' });
		expect(runner).toHaveBeenCalledTimes(1);
	});

	test('失败(reject)不入任何层且照常抛出', async ()=>{
		await expect(dedupedRequest(URL_A, { body: BODY }, ()=>Promise.reject(new Error('boom')))).rejects.toThrow('boom');
		expect(mockStore.size).toBe(0);
	});

	test('kill-switch:netResultCache=0 → 不读不写 L3(纯内存 L1/L2 现状)', async ()=>{
		localStorage.setItem('horosa.perf.netResultCache', '0');
		const runner1 = jest.fn(()=>Promise.resolve({ pan: 'r1' }));
		await dedupedRequest(URL_A, { body: BODY }, runner1);
		expect(mockStore.size).toBe(0);   // 不写
		__clearDedupe();
		const runner2 = jest.fn(()=>Promise.resolve({ pan: 'r2' }));
		const v = await dedupedRequest(URL_A, { body: BODY }, runner2);
		expect(v).toEqual({ pan: 'r2' });   // 不读(内存清了就真发)
		expect(runner2).toHaveBeenCalledTimes(1);
	});
});
