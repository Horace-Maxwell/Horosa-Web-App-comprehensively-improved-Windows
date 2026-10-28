// 后端在、但它连不上本地排盘引擎(连接被拒 / 被系统代理拦截)时,排盘请求不能「界面空白却不报错」:
//   · 后端回固定业务码 + 稳定键 → 即便请求是 silent(面板 / 后台请求),也弹一次可见提示;
//   · 一波并发失败只弹一次(长冷却去重);
//   · 其它业务错误的 silent 语义不变(不弹);
//   · 原始的 SOCKS / 代理异常文本在非 silent 路径上换成指向系统代理的人话,不回显堆栈;
//   · 业务码 / 稳定键与后端 AstroHelper 逐字同步。
jest.mock('dva', ()=>({
	fetch: jest.fn(),
}));
jest.mock('antd', ()=>({
	message: { error: jest.fn(), warning: jest.fn(), info: jest.fn(), success: jest.fn() },
}));
jest.mock('../backendIdentity', ()=>({
	renegotiateLocalServerRoot: jest.fn(async ()=>null),
}));
jest.mock('../rsahelper', ()=>({
	encryptRSA: (s)=>`enc:${s}`,
	decryptRSA: (s)=>s,
}));

import fs from 'fs';
import path from 'path';
import request, { requestRaw, humanizeBackendError } from '../request';
import { fetch as dvaFetch } from 'dva';
import { message } from 'antd';
import { isEngineLinkFailure, ENGINE_LINK_ERROR_CODE, ENGINE_LINK_ERROR_KEY } from '../requestFailure';
import { getErrMsg } from '../../msg/errmsg';
import * as Constants from '../constants';

function fakeResponse(code, msg){
	const headers = {
		[Constants.ResultCodeKey]: `${code}`,
		[Constants.ResultMessageKey]: encodeURIComponent(msg),
	};
	return {
		status: 500,
		statusText: 'Internal Server Error',
		url: 'http://127.0.0.1:9999/chart',
		headers: { get: (k)=>(Object.prototype.hasOwnProperty.call(headers, k) ? headers[k] : null) },
		text: async ()=>JSON.stringify({ [Constants.ResultKey]: msg, [Constants.ResultCodeKey]: code }),
	};
}

const ENGINE_TEXT = getErrMsg(ENGINE_LINK_ERROR_KEY);
let now = 1_000_000;
let nowSpy = null;
let logSpy = null;
let warnSpy = null;
beforeEach(()=>{
	now += 10 * 60 * 1000;   // 每个用例跨过所有提示冷却
	nowSpy = jest.spyOn(Date, 'now').mockImplementation(()=>now);
	logSpy = jest.spyOn(console, 'log').mockImplementation(()=>{});
	warnSpy = jest.spyOn(console, 'warn').mockImplementation(()=>{});
	message.error.mockClear();
	dvaFetch.mockReset();
});
afterEach(()=>{
	nowSpy.mockRestore();
	logSpy.mockRestore();
	warnSpy.mockRestore();
});

describe('连不上本地排盘引擎 → 可见提示', ()=>{
	it('稳定键有人话文案(不是原样回键)', ()=>{
		expect(ENGINE_TEXT).not.toBe(ENGINE_LINK_ERROR_KEY);
		expect(ENGINE_TEXT).toMatch(/排盘引擎/);
	});

	it('silent 请求遇引擎连不上 → 仍 resolve undefined,但弹一次提示', async ()=>{
		dvaFetch.mockResolvedValue(fakeResponse(ENGINE_LINK_ERROR_CODE, ENGINE_LINK_ERROR_KEY));
		const out = await request('http://127.0.0.1:9999/ziwei/birth', { silent: true, body: '{"a":1}' });
		expect(out).toBeUndefined();
		expect(message.error).toHaveBeenCalledTimes(1);
		expect(message.error).toHaveBeenCalledWith(ENGINE_TEXT);
	});

	it('一波并发 silent 失败只弹一次', async ()=>{
		dvaFetch.mockImplementation(async ()=>fakeResponse(ENGINE_LINK_ERROR_CODE, ENGINE_LINK_ERROR_KEY));
		await Promise.all([
			request('http://127.0.0.1:9999/chart', { silent: true, body: '{"b":1}' }),
			request('http://127.0.0.1:9999/nongli/time', { silent: true, body: '{"b":2}' }),
			requestRaw('http://127.0.0.1:9999/jieqi/year', { silent: true, body: '{"b":3}' }),
		]);
		expect(message.error).toHaveBeenCalledTimes(1);
	});

	it('requestRaw silent 同样可见', async ()=>{
		dvaFetch.mockResolvedValue(fakeResponse(ENGINE_LINK_ERROR_CODE, ENGINE_LINK_ERROR_KEY));
		await requestRaw('http://127.0.0.1:9999/liureng/gods', { silent: true, body: '{"c":1}' });
		expect(message.error).toHaveBeenCalledWith(ENGINE_TEXT);
	});

	it('非 silent 请求遇引擎连不上 → 弹同一句人话', async ()=>{
		dvaFetch.mockResolvedValue(fakeResponse(ENGINE_LINK_ERROR_CODE, ENGINE_LINK_ERROR_KEY));
		await request('http://127.0.0.1:9999/predict/pd', { body: '{"d":1}' });
		expect(message.error).toHaveBeenCalledWith(ENGINE_TEXT);
	});

	it('其它业务错误的 silent 语义不变:不弹', async ()=>{
		dvaFetch.mockResolvedValue(fakeResponse(9999, 'miss.date'));
		const out = await request('http://127.0.0.1:9999/chart', { silent: true, body: '{"e":1}' });
		expect(out).toBeUndefined();
		expect(message.error).not.toHaveBeenCalled();
	});

	it('非 silent 遇原始 SOCKS 异常文本 → 指向系统代理的人话,不回显异常', async ()=>{
		dvaFetch.mockResolvedValue(fakeResponse(9999, 'java.net.SocketException: Reply from SOCKS server has bad version'));
		await request('http://127.0.0.1:9999/chart', { body: '{"f":1}' });
		expect(message.error).toHaveBeenCalledTimes(1);
		const shown = message.error.mock.calls[0][0];
		expect(shown).toMatch(/系统代理/);
		expect(shown).not.toMatch(/SOCKS|java\./);
	});
});

describe('代理握手判据只认握手字样', ()=>{
	it('🔴 类名里带 Proxy 的技术异常不报成「被系统代理拦截」;真代理握手失败照报', ()=>{
		for(const t of ['java.lang.ClassCastException: class jdk.proxy2.$Proxy12 cannot be cast to class java.util.Map', 'java.lang.IllegalStateException: at spacex.astrostudy.service.AIAnalysisProxyService.stream(AIAnalysisProxyService.java:88)']){
			expect(humanizeBackendError(t)).not.toMatch(/系统代理/);
		}
		for(const t of ['java.io.IOException: Unable to tunnel through proxy. Proxy returns "HTTP/1.1 407"', 'java.net.SocketException: Can\'t connect to SOCKS proxy:Connection refused', 'java.net.SocketException: Reply from SOCKS server has bad version']){
			expect(humanizeBackendError(t)).toMatch(/系统代理/);
		}
	});
});

describe('isEngineLinkFailure 判据', ()=>{
	it('认业务码(数 / 串)与稳定键(消息 / 头);其它不认', ()=>{
		expect(isEngineLinkFailure({ [Constants.ResultCodeKey]: ENGINE_LINK_ERROR_CODE })).toBe(true);
		expect(isEngineLinkFailure({ [Constants.ResultCodeKey]: `${ENGINE_LINK_ERROR_CODE}` })).toBe(true);
		expect(isEngineLinkFailure({ headers: { [Constants.ResultCodeKey]: ENGINE_LINK_ERROR_CODE } })).toBe(true);
		expect(isEngineLinkFailure(new Error(ENGINE_LINK_ERROR_KEY))).toBe(true);
		expect(isEngineLinkFailure({ headers: { [Constants.ResultMessageKey]: ENGINE_LINK_ERROR_KEY } })).toBe(true);
		expect(isEngineLinkFailure({ [Constants.ResultCodeKey]: 9999, message: 'boom' })).toBe(false);
		expect(isEngineLinkFailure(new TypeError('Failed to fetch'))).toBe(false);
		expect(isEngineLinkFailure(null)).toBe(false);
	});

	it('业务码与稳定键与后端 AstroHelper 逐字同步', ()=>{
		const javaSrc = fs.readFileSync(path.join(__dirname, '../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/AstroHelper.java'), 'utf8');
		const code = javaSrc.match(/EngineLinkErrorCode\s*=\s*(\d+)\s*;/);
		const key = javaSrc.match(/EngineLinkErrorKey\s*=\s*"([^"]+)"\s*;/);
		expect(code && Number(code[1])).toBe(ENGINE_LINK_ERROR_CODE);
		expect(key && key[1]).toBe(ENGINE_LINK_ERROR_KEY);
		// 后端确实在连不上引擎时抛这个码(不是只声明了常量)
		expect(javaSrc).toMatch(/isConnectFailure\(e\)\)\s*\{\s*throw new ErrorCodeException\(EngineLinkErrorCode, EngineLinkErrorKey, e\)/);
	});
});
