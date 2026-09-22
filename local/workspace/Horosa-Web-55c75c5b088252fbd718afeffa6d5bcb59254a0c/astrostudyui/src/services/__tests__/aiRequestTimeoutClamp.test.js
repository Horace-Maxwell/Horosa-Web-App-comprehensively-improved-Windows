// [Q-411/M-157] 请求超时单源钳位:前端等待与下发后端的 providerOptions.requestTimeoutMs 同一个数;
//   越界只存在于存量旧档(表单已加范围校验),钳到 [1000, 600000];留空/非法 → 剥掉键(两层各走缺省)。
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';
if(typeof global.TextEncoder === 'undefined'){ global.TextEncoder = NodeTextEncoder; }
if(typeof global.TextDecoder === 'undefined'){ global.TextDecoder = NodeTextDecoder; }
// eslint-disable-next-line import/first
import { clampRequestTimeoutMs, withClampedRequestTimeout, REQUEST_TIMEOUT_MIN_MS, REQUEST_TIMEOUT_MAX_MS, diagnoseProvider } from '../aianalysis';

describe('[Q-411/M-157] 超时钳位', ()=>{
	test('clamp:越界钳到边界;空/非法/非正 → null', ()=>{
		expect(clampRequestTimeoutMs(500)).toBe(REQUEST_TIMEOUT_MIN_MS);
		expect(clampRequestTimeoutMs(900000)).toBe(REQUEST_TIMEOUT_MAX_MS);
		expect(clampRequestTimeoutMs('30000')).toBe(30000);
		expect(clampRequestTimeoutMs(1500.4)).toBe(1500);
		expect(clampRequestTimeoutMs('')).toBeNull();
		expect(clampRequestTimeoutMs(null)).toBeNull();
		expect(clampRequestTimeoutMs('abc')).toBeNull();
		expect(clampRequestTimeoutMs(0)).toBeNull();
		expect(clampRequestTimeoutMs(-5)).toBeNull();
	});
	test('withClampedRequestTimeout:同数原样返回;越界改写;非法剥键;无键不动', ()=>{
		const ok = { providerOptions: { requestTimeoutMs: 30000, x: 1 } };
		expect(withClampedRequestTimeout(ok)).toBe(ok);
		expect(withClampedRequestTimeout({ providerOptions: { requestTimeoutMs: 500 } }).providerOptions.requestTimeoutMs).toBe(1000);
		expect(withClampedRequestTimeout({ providerOptions: { requestTimeoutMs: 900000 } }).providerOptions.requestTimeoutMs).toBe(600000);
		const stripped = withClampedRequestTimeout({ providerOptions: { requestTimeoutMs: 'abc', x: 1 } });
		expect(Object.prototype.hasOwnProperty.call(stripped.providerOptions, 'requestTimeoutMs')).toBe(false);
		expect(stripped.providerOptions.x).toBe(1);
		const none = { providerOptions: { x: 1 } };
		expect(withClampedRequestTimeout(none)).toBe(none);
		expect(withClampedRequestTimeout(null)).toBeNull();
	});
	test('出站请求体里的 requestTimeoutMs 已是钳位值(后端与前端同数)', async ()=>{
		let bodySeen = null;
		const origFetch = global.fetch;
		global.fetch = jest.fn(async (url, init)=>{
			bodySeen = init.body;
			return { ok: true, text: async ()=>JSON.stringify({ Result: { ok: true } }) };
		});
		try{
			await diagnoseProvider({ providerType: 'openai', providerOptions: { requestTimeoutMs: 500 } });
		}finally{ global.fetch = origFetch; }
		// 请求体可能被加密(encryptAIAnalysisBody);至少证明原始 500 没有以明文出站,且出站体非空
		expect(bodySeen).toBeTruthy();
		const text = `${bodySeen}`;
		if(text.indexOf('providerOptions') >= 0){
			expect(text).toContain('"requestTimeoutMs":1000');
			expect(text).not.toContain('"requestTimeoutMs":500');
		}
	});
});
