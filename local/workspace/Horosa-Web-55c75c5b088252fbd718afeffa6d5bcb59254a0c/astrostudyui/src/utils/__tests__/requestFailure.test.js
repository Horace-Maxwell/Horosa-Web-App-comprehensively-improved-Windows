// 请求失败分类器八向量 + 边角:每种 kind 各有唯一判别输入;retryable/offline 只在对应类为真。
import { classifyRequestFailure, REQUEST_FAILURE_KINDS } from '../requestFailure';
import * as Constants from '../constants';

describe('classifyRequestFailure 八向量', ()=>{
	it('TypeError(fetch 网络层失败)→ unreachable + offline + retryable', ()=>{
		expect(classifyRequestFailure(new TypeError('Failed to fetch'))).toEqual({ kind: 'unreachable', retryable: true, offline: true });
	});
	it('{name:TimeoutError} → timeout(不算离线、不可盲目重放)', ()=>{
		const e = new Error('request.timeout');
		e.name = 'TimeoutError';
		expect(classifyRequestFailure(e)).toEqual({ kind: 'timeout', retryable: false, offline: false });
		expect(classifyRequestFailure({ name: 'TimeoutError' }).kind).toBe('timeout');
	});
	it('{name:AbortError} → aborted', ()=>{
		expect(classifyRequestFailure({ name: 'AbortError', message: 'The user aborted a request.' })).toEqual({ kind: 'aborted', retryable: false, offline: false });
	});
	it('{headers:{},status:500} → http5xx 且 retryable', ()=>{
		expect(classifyRequestFailure({ headers: {}, status: 500 })).toEqual({ kind: 'http5xx', retryable: true, offline: false, status: 500 });
	});
	it('{headers:{},status:404} → http4xx 不可重试', ()=>{
		expect(classifyRequestFailure({ headers: {}, status: 404 })).toEqual({ kind: 'http4xx', retryable: false, offline: false, status: 404 });
	});
	it('{headers:{}, ResultCode:need.login} → business 且带 code', ()=>{
		const e = { headers: {} };
		e[Constants.ResultCodeKey] = 'need.login';
		expect(classifyRequestFailure(e)).toEqual({ kind: 'business', retryable: false, offline: false, code: 'need.login' });
		// code 也可来自响应头对象(getResponseHeaders 抛出的形状);0 视为无码
		const e2 = { headers: {} };
		e2.headers[Constants.ResultCodeKey] = 999;
		expect(classifyRequestFailure(e2).code).toBe(999);
		const e3 = { headers: {} };
		e3[Constants.ResultCodeKey] = 0;
		expect(classifyRequestFailure(e3).code).toBeUndefined();
	});
	it('{horosaIdentitySuspect:true,status:200} → poisoned(200 绝不算未就绪)', ()=>{
		expect(classifyRequestFailure({ horosaIdentitySuspect: true, status: 200, headers: {} })).toEqual({ kind: 'poisoned', retryable: false, offline: false, status: 200 });
	});
	it('new Error("x") → unknown', ()=>{
		expect(classifyRequestFailure(new Error('x'))).toEqual({ kind: 'unknown', retryable: false, offline: false });
	});
});

describe('classifyRequestFailure 边角', ()=>{
	it('message 含 request.timeout(手工拼的超时错误)→ timeout,优先于 headers', ()=>{
		const e = new Error('request.timeout');
		e.headers = {};
		e[Constants.ResultCodeKey] = 999;
		expect(classifyRequestFailure(e).kind).toBe('timeout');
	});
	it('DOMException NetworkError → unreachable+offline;其它 DOMException → dom;AbortError 型 DOMException → aborted', ()=>{
		expect(classifyRequestFailure(new DOMException('net down', 'NetworkError'))).toMatchObject({ kind: 'unreachable', offline: true });
		expect(classifyRequestFailure(new DOMException('bad state', 'InvalidStateError'))).toMatchObject({ kind: 'dom', offline: false });
		expect(classifyRequestFailure(new DOMException('aborted', 'AbortError')).kind).toBe('aborted');
	});
	it('空值 / 非法 status 不抛:null → unknown;status 字符串数字可用、非数字丢弃', ()=>{
		expect(classifyRequestFailure(null).kind).toBe('unknown');
		expect(classifyRequestFailure(undefined).kind).toBe('unknown');
		expect(classifyRequestFailure({ headers: {}, status: '503' })).toMatchObject({ kind: 'http5xx', status: 503 });
		expect(classifyRequestFailure({ headers: {}, status: 'abc' })).toEqual({ kind: 'business', retryable: false, offline: false });
	});
	it('kind 枚举固定为九类,每个向量的 kind 都在枚举内', ()=>{
		expect(REQUEST_FAILURE_KINDS.length).toBe(9);
		[new TypeError('x'), { name: 'TimeoutError' }, { name: 'AbortError' }, { headers: {}, status: 500 }, { headers: {}, status: 404 }, { headers: {} }, { horosaIdentitySuspect: true }, new Error('x'), new DOMException('x', 'SecurityError')].forEach((v)=>{
			expect(REQUEST_FAILURE_KINDS).toContain(classifyRequestFailure(v).kind);
		});
	});
});
