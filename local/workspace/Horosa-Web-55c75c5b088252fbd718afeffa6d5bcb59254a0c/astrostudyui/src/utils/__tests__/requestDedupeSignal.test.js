// 请求去重层 × 取消信号 × 不用缓存 × 业务错误:
// ① 同参请求并成一程时,网络用这一程的内部取消信号 —— 只有全部参与方都取消才取消网络;谁取消只让谁以 AbortError 结束
//    (此前在途键不含 signal:带 signal 的发起方被 abort,同参搭车方一起拿到 AbortError,services 层那道隔离被这一层抵消);
// ② 调用前就已取消的请求不发、不读缓存;fetchWithTimeout 同口径(此前 abort 事件不会再来,请求照发),监听用完即解绑;
// ③ 应用层开关 resultCache:false / cache:false 不读不写 L1 / L2 / L3,在途只与同样不用缓存的同参请求共享;
//    fetch 原生的 cache 字符串(no-store / reload / no-cache)不算「不用结果缓存」(此前算,主限法步进预取全部白跑);
// ④ 业务错误(信封顶层或 Result 里带 err)不进任何一层缓存(判据单一出处 resultEnvelope);
// ⑤ requestStream silent 不弹错(与 request / requestRaw 同口径)。
jest.mock('../idbCacheStore', ()=>({
	idbGet: jest.fn(async ()=>undefined),
	idbScheduleWrite: jest.fn(),
}));
const pending = [];
jest.mock('dva', ()=>({
	fetch: jest.fn((url, opts)=>new Promise((resolve, reject)=>{
		const sig = opts && opts.signal;
		const entry = { url, opts, resolve, reject, abortedAtCall: !!(sig && sig.aborted) };
		pending.push(entry);
		const fail = ()=>{ const e = new Error('The operation was aborted.'); e.name = 'AbortError'; reject(e); };
		if(sig){
			if(sig.aborted){ fail(); return; }
			sig.addEventListener('abort', fail);
		}
	})),
}));
jest.mock('../backendIdentity', ()=>({ renegotiateLocalServerRoot: jest.fn(async ()=>null) }));
jest.mock('../rsahelper', ()=>({ encryptRSA: (s)=>`enc:${s}`, decryptRSA: (s)=>s }));

const { dedupedRequest, __clearDedupe, __dedupeStats } = require('../requestDedupe');
const idb = require('../idbCacheStore');
const { responseHasBusinessError, responseCacheable } = require('../resultEnvelope');

const URL = 'http://127.0.0.1:9999/chart';
const BODY = JSON.stringify({ date: '2026-10-24', time: '10:00:00' });
const tick = ()=>new Promise((r)=>setTimeout(r, 0));
const outcome = (p)=>p.then((v)=>({ ok: v }), (e)=>({ err: e && e.name }));
// 可控 runner:记下拿到的共享信号,手动放行
function gatedRunner(value){
	const r = { calls: 0, signals: [], release: null };
	r.fn = (sig)=>{
		r.calls += 1;
		r.signals.push(sig);
		return new Promise((resolve, reject)=>{
			r.release = ()=>resolve(value);
			if(sig){ sig.addEventListener('abort', ()=>{ const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }); }
		});
	};
	return r;
}

beforeEach(()=>{ __clearDedupe(); pending.length = 0; idb.idbScheduleWrite.mockClear(); idb.idbGet.mockClear(); });

describe('🔴 取消信号按参与方计数', ()=>{
	test('发起方带 signal、搭车方不带:发起方取消只让自己结束,网络照跑,搭车方拿到结果', async ()=>{
		const r = gatedRunner({ Result: { v: 1 } });
		const ctl = new AbortController();
		const pA = dedupedRequest(URL, { body: BODY, signal: ctl.signal }, r.fn);
		const pB = dedupedRequest(URL, { body: BODY }, r.fn);
		await tick();
		expect(r.calls).toBe(1);
		expect(r.signals[0]).not.toBe(ctl.signal);   // 网络用的是内部信号,不是发起方的
		ctl.abort();
		expect(await outcome(pA)).toEqual({ err: 'AbortError' });
		expect(r.signals[0].aborted).toBe(false);
		r.release();
		expect(await outcome(pB)).toEqual({ ok: { Result: { v: 1 } } });
	});
	test('两方都带 signal:取消一方网络照跑;两方都取消才真取消,这一程摘出在途表,新来的另起一程', async ()=>{
		const r = gatedRunner({ Result: { v: 2 } });
		const c1 = new AbortController();
		const c2 = new AbortController();
		const p1 = dedupedRequest(URL, { body: BODY, signal: c1.signal }, r.fn);
		const p2 = dedupedRequest(URL, { body: BODY, signal: c2.signal }, r.fn);
		await tick();
		c1.abort();
		expect(r.signals[0].aborted).toBe(false);
		c2.abort();
		expect(r.signals[0].aborted).toBe(true);
		expect([await outcome(p1), await outcome(p2)]).toEqual([{ err: 'AbortError' }, { err: 'AbortError' }]);
		expect(__dedupeStats().inflight).toBe(0);
		const r2 = gatedRunner({ Result: { v: 3 } });
		const p3 = dedupedRequest(URL, { body: BODY }, r2.fn);
		await tick();
		r2.release();
		expect(await p3).toEqual({ Result: { v: 3 } });
		expect(r2.calls).toBe(1);
	});
	test('搭车方先取消、发起方不带 signal:搭车方 AbortError,发起方正常', async ()=>{
		const r = gatedRunner({ Result: { v: 4 } });
		const ctl = new AbortController();
		const pB = dedupedRequest(URL, { body: BODY }, r.fn);
		const pA = dedupedRequest(URL, { body: BODY, signal: ctl.signal }, r.fn);
		await tick();
		ctl.abort();
		r.release();
		expect([await outcome(pA), await outcome(pB)]).toEqual([{ err: 'AbortError' }, { ok: { Result: { v: 4 } } }]);
	});
	test('调用前就已取消:不发请求、也不读缓存', async ()=>{
		const r = gatedRunner({ Result: { v: 5 } });
		const p0 = dedupedRequest(URL, { body: BODY }, r.fn);
		await tick();
		r.release();
		await p0;   // 现在 L1 里有了
		const ctl = new AbortController();
		ctl.abort();
		const r2 = gatedRunner({ Result: { v: 6 } });
		expect(await outcome(dedupedRequest(URL, { body: BODY, signal: ctl.signal }, r2.fn))).toEqual({ err: 'AbortError' });
		expect(r2.calls).toBe(0);
	});
});

describe('🔴 不用缓存的请求', ()=>{
	test('cache:false / resultCache:false 不读不写 L1 / L2 / L3', async ()=>{
		let n = 0;
		const run = async ()=>{ n += 1; return { Result: { n } }; };
		expect(await dedupedRequest(URL, { body: BODY }, run)).toEqual({ Result: { n: 1 } });       // 普通请求写进缓存
		expect(await dedupedRequest(URL, { body: BODY, cache: false }, run)).toEqual({ Result: { n: 2 } });   // 不读
		expect(await dedupedRequest(URL, { body: BODY, resultCache: false }, run)).toEqual({ Result: { n: 3 } });
		expect(await dedupedRequest(URL, { body: BODY }, run)).toEqual({ Result: { n: 1 } });       // 也没写(仍是第一次那份)
		expect(idb.idbScheduleWrite).toHaveBeenCalledTimes(1);
		const reads = idb.idbGet.mock.calls.length;
		await dedupedRequest(URL, { body: `${BODY} `, cache: false }, run);
		expect(idb.idbGet.mock.calls.length).toBe(reads);   // 不读 L3
	});
	test('🔴 fetch 原生的 cache 字符串不算「不用结果缓存」:同参照样命中、写进缓存', async ()=>{
		let n = 0;
		const run = async ()=>{ n += 1; return { Result: { n } }; };
		expect(await dedupedRequest(URL, { body: BODY, cache: 'no-store' }, run)).toEqual({ Result: { n: 1 } });   // 写进缓存
		expect(await dedupedRequest(URL, { body: BODY }, run)).toEqual({ Result: { n: 1 } });                       // 命中
		expect(await dedupedRequest(URL, { body: BODY, cache: 'reload' }, run)).toEqual({ Result: { n: 1 } });
		expect(await dedupedRequest(URL, { body: BODY, cache: 'no-cache' }, run)).toEqual({ Result: { n: 1 } });
		expect(n).toBe(1);
		expect(idb.idbScheduleWrite).toHaveBeenCalledTimes(1);
	});
	test('预取先跑完、前台再要同参:网络只走一次(预取有处落桶)', async ()=>{
		let n = 0;
		const run = async ()=>{ n += 1; return { Result: { step: 1 } }; };
		await dedupedRequest(URL, { body: BODY, silent: true, retry: { retries: 0 } }, run);   // 预取
		expect(await dedupedRequest(URL, { body: BODY }, run)).toEqual({ Result: { step: 1 } });   // 前台
		expect(n).toBe(1);
	});
	test('不用缓存的不搭普通请求那一程(那一程可能由 L3 回放)', async ()=>{
		const r = gatedRunner({ Result: { v: 'normal' } });
		const p1 = dedupedRequest(URL, { body: BODY }, r.fn);
		const r2 = gatedRunner({ Result: { v: 'fresh' } });
		const p2 = dedupedRequest(URL, { body: BODY, cache: false }, r2.fn);
		await tick();
		r.release(); r2.release();
		expect([await p1, await p2]).toEqual([{ Result: { v: 'normal' } }, { Result: { v: 'fresh' } }]);
		expect([r.calls, r2.calls]).toEqual([1, 1]);
	});
});

describe('🔴 业务错误不进缓存', ()=>{
	test('Result.err / 顶层 err:每次都重新请求,L3 不写', async ()=>{
		let n = 0;
		const run = async ()=>{ n += 1; return { ResultCode: 0, Result: { err: 'boom' } }; };
		await dedupedRequest(URL, { body: BODY }, run);
		await dedupedRequest(URL, { body: BODY }, run);
		expect(n).toBe(2);
		const run2 = async ()=>{ n += 1; return { err: 'top' }; };
		await dedupedRequest(URL, { body: `${BODY}x` }, run2);
		await dedupedRequest(URL, { body: `${BODY}x` }, run2);
		expect(n).toBe(4);
		expect(idb.idbScheduleWrite).not.toHaveBeenCalled();
	});
	test('判据单一出处', ()=>{
		expect(responseHasBusinessError({ Result: { err: 'x' } })).toBe(true);
		expect(responseHasBusinessError({ err: 'x' })).toBe(true);
		expect(responseHasBusinessError({ Result: { params: {} } })).toBe(false);
		expect(responseHasBusinessError({ Result: [1, 2] })).toBe(false);
		expect(responseCacheable(undefined)).toBe(false);
		expect(responseCacheable(null)).toBe(false);
		expect(responseCacheable({ Result: { ok: 1 } })).toBe(true);
		const fs = require('fs');
		const path = require('path');
		const src = (f)=>fs.readFileSync(path.resolve(__dirname, '..', '..', f), 'utf8');
		expect(src('utils/requestDedupe.js')).toMatch(/responseCacheable\(v\)/);
		expect(src('services/_requestCache.js')).toMatch(/responseCacheable\(rsp\)/);
	});
});

describe('🔴 接到 request():同参并发时发起方取消不连坐;fetchWithTimeout 已取消不发、监听解绑;requestStream silent 不弹错', ()=>{
	const okResponse = (obj)=>{ const body = JSON.stringify(obj); return { status: 200, ok: true, url: 'x', headers: { get: (k)=>(k === 'ResultCode' ? '0' : null) }, text: async ()=>body }; };
	test('A(带 signal)先发、B(同参不带)搭车;A 取消后 B 照常拿到结果,网络只发一次', async ()=>{
		const request = require('../request').default;
		const ctl = new AbortController();
		const pA = request(URL, { body: BODY, signal: ctl.signal, silent: true });
		await new Promise((r)=>setTimeout(r, 20));
		const pB = request(URL, { body: BODY, silent: true });
		await new Promise((r)=>setTimeout(r, 20));
		expect(pending.length).toBe(1);
		ctl.abort();
		expect(await outcome(pA)).toEqual({ err: 'AbortError' });
		pending[0].resolve(okResponse({ ResultCode: 0, Result: { params: { a: 1 } } }));
		const rb = await pB;
		expect(rb.Result.params.a).toBe(1);
	});
	test('fetchWithTimeout:调用前已取消 → 不发请求;正常结束后外部信号上不留监听', async ()=>{
		const { requestRaw } = require('../request');
		const ctl = new AbortController();
		ctl.abort();
		await outcome(requestRaw('http://127.0.0.1:9999/probe/raw', { body: '{}', signal: ctl.signal, timeoutMs: 300, silent: true }));
		const sent = pending.filter((p)=>p.url.indexOf('/probe/raw') >= 0 && !p.abortedAtCall);
		expect(sent.length).toBe(0);
		// 长寿 signal:请求结束后监听解绑
		let added = 0;
		let removed = 0;
		const live = new AbortController();
		const sig = live.signal;
		const add = sig.addEventListener.bind(sig);
		const rem = sig.removeEventListener.bind(sig);
		sig.addEventListener = (t, fn, o)=>{ if(t === 'abort'){ added += 1; } return add(t, fn, o); };
		sig.removeEventListener = (t, fn, o)=>{ if(t === 'abort'){ removed += 1; } return rem(t, fn, o); };
		const p = requestRaw('http://127.0.0.1:9999/probe/raw2', { body: '{}', signal: sig, timeoutMs: 5000, silent: true });
		await new Promise((r)=>setTimeout(r, 20));
		pending.filter((x)=>x.url.indexOf('/probe/raw2') >= 0).forEach((x)=>x.resolve(okResponse({ ResultCode: 0, Result: { ok: 1 } })));
		await outcome(p);
		expect(added).toBeGreaterThanOrEqual(1);
		expect(removed).toBe(added);
	});
	test('requestStream silent:失败照抛、不弹错;非 silent 照旧弹', async ()=>{
		const { requestStream } = require('../request');
		const antd = require('antd');
		const spy = jest.spyOn(antd.message, 'error').mockImplementation(()=>{});
		const dva = require('dva');
		const mkErr = ()=>{ const e = new Error('流式出错'); e.Result = '流式出错了'; return e; };
		dva.fetch.mockImplementationOnce(()=>Promise.reject(mkErr()));
		await expect(requestStream('http://127.0.0.1:9999/aianalysis/stream', { body: '{}', silent: true })).rejects.toBeTruthy();
		expect(spy).not.toHaveBeenCalled();
		dva.fetch.mockImplementationOnce(()=>Promise.reject(mkErr()));
		await expect(requestStream('http://127.0.0.1:9999/aianalysis/stream', { body: '{}' })).rejects.toBeTruthy();
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});
