// 静默失败留痕端到端:request(url,{silent:true}) 在网络层失败时
//   · 仍 resolve undefined(既有吞错语义不变);
//   · console.warn 恰一次含 'silent failure',参数 = [标记, 去 query 的 url, kind, name, message];
//   · 失败留痕 +1(kind = unreachable,url 去 query,silent = true);
//   · 非静默失败同样留痕但不打 silent failure。
jest.mock('dva', ()=>({
	fetch: jest.fn(()=>Promise.reject(new TypeError('Failed to fetch'))),
}));
jest.mock('../backendIdentity', ()=>({
	renegotiateLocalServerRoot: jest.fn(async ()=>null),
}));
// RSA 加密层在 jest 沙箱不可执行(库内隐式全局变量);本测试考察的是失败分支,加密只需桩。
jest.mock('../rsahelper', ()=>({
	encryptRSA: (s)=>`enc:${s}`,
	decryptRSA: (s)=>s,
}));

import request from '../request';
import { fetch as dvaFetch } from 'dva';
import { snapshot, __resetRequestTelemetryForTests } from '../requestTelemetry';
import { isServiceOnline, markServiceOnline } from '../serviceStatus';

const URL_Q = 'http://127.0.0.1:9999/probe/silent?x=1';
const URL_NQ = 'http://127.0.0.1:9999/probe/silent';

let warn = null;
let log = null;
beforeEach(()=>{
	__resetRequestTelemetryForTests();
	dvaFetch.mockClear();
	warn = jest.spyOn(console, 'warn').mockImplementation(()=>{});
	log = jest.spyOn(console, 'log').mockImplementation(()=>{});
	markServiceOnline();
});
afterEach(()=>{
	warn.mockRestore();
	log.mockRestore();
	markServiceOnline();
});

function silentWarns(){
	return warn.mock.calls.filter((c)=>`${c[0]}`.indexOf('silent failure') >= 0);
}

describe('request 静默失败留痕', ()=>{
	it('silent:true 网络失败 → resolve undefined;warn 恰一次;留痕 +1 kind=unreachable(url 去 query)', async ()=>{
		const out = await request(URL_Q, { silent: true, body: '{}' });
		expect(out).toBeUndefined();
		expect(dvaFetch).toHaveBeenCalledTimes(1);
		const hits = silentWarns();
		expect(hits.length).toBe(1);
		expect(hits[0]).toEqual(['[request] silent failure', URL_NQ, 'unreachable', 'TypeError', 'Failed to fetch']);
		const s = snapshot();
		expect(s.total).toBe(1);
		expect(s.counts.byKind).toEqual({ unreachable: 1 });
		expect(s.counts.byPath).toEqual({ '/probe/silent': 1 });
		expect(s.recent[0]).toMatchObject({ url: URL_NQ, kind: 'unreachable', silent: true, name: 'TypeError', message: 'Failed to fetch' });
		expect(s.recent[0].status).toBeUndefined();
		// 不可达 → 置离线是既有语义,留痕不改变它
		expect(isServiceOnline()).toBe(false);
	});

	it('非 silent 失败同样留痕(silent=false)但不打 silent failure', async ()=>{
		const out = await request(URL_Q, { body: '{}' });
		expect(out).toBeUndefined();
		expect(silentWarns().length).toBe(0);
		const s = snapshot();
		expect(s.total).toBe(1);
		expect(s.recent[0]).toMatchObject({ url: URL_NQ, kind: 'unreachable', silent: false });
	});

	it('两次失败累计:total 2,byKind.unreachable 2,recent 时间升序', async ()=>{
		await request(URL_Q, { silent: true, body: '{}' });
		await request(`${URL_NQ}2?y=2`, { silent: true, body: '{}' });
		const s = snapshot();
		expect(s.total).toBe(2);
		expect(s.counts.byKind.unreachable).toBe(2);
		expect(s.recent.map((e)=>e.url)).toEqual([URL_NQ, `${URL_NQ}2`]);
		expect(silentWarns().length).toBe(2);
	});
});

describe('requestRaw / requestStream / chartFetch 同一环形缓冲', ()=>{
	it('requestRaw silent 失败 → resolve undefined + 留痕 + warn 一次', async ()=>{
		// eslint-disable-next-line global-require
		const { requestRaw } = require('../request');
		const out = await requestRaw(URL_Q, { silent: true, body: '{}' });
		expect(out).toBeUndefined();
		expect(silentWarns().length).toBe(1);
		expect(silentWarns()[0][2]).toBe('unreachable');
		expect(snapshot().recent[0]).toMatchObject({ url: URL_NQ, kind: 'unreachable', silent: true });
	});

	it('requestStream 失败仍抛出;留痕 kind 带 stream: 前缀;silent 时 warn 一次', async ()=>{
		// eslint-disable-next-line global-require
		const { requestStream } = require('../request');
		await expect(requestStream(URL_Q, { silent: true, body: '{}' })).rejects.toBeInstanceOf(TypeError);
		expect(silentWarns().length).toBe(1);
		expect(silentWarns()[0][2]).toBe('stream:unreachable');
		const s = snapshot();
		expect(s.counts.byKind).toEqual({ 'stream:unreachable': 1 });
		expect(s.recent[0]).toMatchObject({ url: URL_NQ, kind: 'stream:unreachable', silent: true, name: 'TypeError' });
	});

	it('chartFetch(裸 fetch 排盘)重试耗尽仍抛出,同样留痕 kind=unreachable', async ()=>{
		const realFetch = global.fetch;
		global.fetch = jest.fn(()=>Promise.reject(new TypeError('Failed to fetch')));
		try{
			// eslint-disable-next-line global-require
			const { fetchChartWithRetry } = require('../chartFetch');
			await expect(fetchChartWithRetry('http://127.0.0.1:8899/kentang/x?y=1', {}, { retries: 1, backoff: [1, 1] })).rejects.toBeInstanceOf(TypeError);
			expect(global.fetch).toHaveBeenCalledTimes(2);   // 1 次 + 1 次重试;只有最终失败留痕
			const s = snapshot();
			expect(s.total).toBe(1);
			expect(s.recent[0]).toMatchObject({ url: 'http://127.0.0.1:8899/kentang/x', kind: 'unreachable', silent: false, name: 'TypeError' });
			expect(silentWarns().length).toBe(0);
		}finally{
			global.fetch = realFetch;
		}
	});
});
