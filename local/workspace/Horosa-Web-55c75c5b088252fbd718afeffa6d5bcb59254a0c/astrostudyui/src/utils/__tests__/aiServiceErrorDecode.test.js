// 后端失败说明在源头解码:Java 异常处理器把说明写成表单式 URL 编码(空格 → +,中文 → %XX),此前原样抛给调用方 ——
// 网页读取 / 联网检索 / 连通测试 / 拉模型 / 外部客户端看到的都是「%E7%BD%91…」,网页读取的「被拦」判定(看说明里有没有「不允许」)也永远落空。
import { decodeServiceErrorText, requestWebFetch, requestAIAnalysisChat } from '../../services/aianalysis';
import { runWebFetch } from '../../integrations/webFetch';

const encode = (s)=>encodeURIComponent(s).replace(/%20/g, '+');
const BLOCKED = '网页地址不允许:不允许读取本机或内网地址';
const UPSTREAM = '上游 provider 请求异常：ConnectException';

function mockFetchOnce(status, body){
	global.fetch = jest.fn(async ()=>({ ok: status >= 200 && status < 300, status, statusText: 'Internal Server Error', text: async ()=>JSON.stringify(body), headers: { get: ()=>null } }));
}
const realFetch = global.fetch;
afterEach(()=>{ global.fetch = realFetch; });

it('解码:表单式编码(+ 是空格)→ 原文;不像编码串的原样(真 + 号不动);坏编码原样', ()=>{
	expect(decodeServiceErrorText(encode(UPSTREAM))).toBe(UPSTREAM);
	expect(decodeServiceErrorText(encode(BLOCKED))).toBe(BLOCKED);
	expect(decodeServiceErrorText('C++ 与 a+b')).toBe('C++ 与 a+b');
	expect(decodeServiceErrorText('100%E')).toBe('100%E');
	expect(decodeServiceErrorText('%E4%B8')).toBe('%E4%B8');
	expect(decodeServiceErrorText(undefined)).toBe('');
});

it('🔴 非 2xx 回体里的编码说明 → 抛出的 Error 是原文(短调用 / 连通测试同一出口)', async ()=>{
	mockFetchOnce(500, { ResultCode: 500, Result: encode(UPSTREAM) });
	await expect(requestAIAnalysisChat({ providerType: 'custom', baseUrl: 'http://127.0.0.1:1/v1', model: 'm', messages: [] })).rejects.toThrow(UPSTREAM);
});

it('🔴 网页读取:守卫拒绝的编码说明 → 解码后归为 E_WEB_FETCH_BLOCKED(此前判成 E_WEB_FETCH_FAILED 且说明是乱码)', async ()=>{
	mockFetchOnce(500, { ResultCode: 40031, Result: encode(BLOCKED) });
	await expect(requestWebFetch({ url: 'http://127.0.0.1/x', maxChars: 600 })).rejects.toThrow(BLOCKED);
	mockFetchOnce(500, { ResultCode: 40031, Result: encode(BLOCKED) });
	const r = await runWebFetch({ url: 'http://127.0.0.1/x', maxChars: 600 });
	expect(r).toEqual({ ok: false, code: 'E_WEB_FETCH_BLOCKED', message: BLOCKED });
});
