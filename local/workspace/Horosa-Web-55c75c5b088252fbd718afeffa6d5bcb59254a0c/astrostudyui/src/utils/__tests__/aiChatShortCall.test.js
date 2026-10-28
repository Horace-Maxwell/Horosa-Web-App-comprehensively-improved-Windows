// 非流式短调用封装:system 首行调用类型标记 / 无档案不发请求 / 失败不抛 / JSON 提取。
const mockChat = jest.fn();
jest.mock('../../services/aianalysis', ()=>({ requestAIAnalysisChat: (...a)=>mockChat(...a) }));

const { requestShortCompletion, shortCallSystem, parseShortCallJson, SHORT_CALL_MARKERS } = require('../aiChat/shortCall');

const PROFILE = { providerType: 'openai', apiKey: 'k', baseUrl: 'https://example.invalid', providerOptions: {} };

beforeEach(()=>{ mockChat.mockReset(); });

describe('aiChat/shortCall', ()=>{
	test('system 首行 = 类型标记(假上游据此判辅助请求);未知类型抛', ()=>{
		expect(shortCallSystem('compact', '压缩规则').split('\n')[0]).toBe(SHORT_CALL_MARKERS.compact);
		expect(shortCallSystem('init', '')).toBe(SHORT_CALL_MARKERS.init);
		expect(()=>shortCallSystem('bogus', 'x')).toThrow();
	});

	test('无档案/模型不发请求;有档案时经 requestAIAnalysisChat 且 system 带标记、思考档关', async ()=>{
		const none = await requestShortCompletion({ profile: null, model: 'm', kind: 'memory', system: 's', user: 'u' });
		expect(none.ok).toBe(false);
		expect(mockChat).not.toHaveBeenCalled();
		mockChat.mockResolvedValue({ Result: { content: '{"facts":[]}', usage: { input_tokens: 1 } } });
		const r = await requestShortCompletion({ profile: PROFILE, model: 'gpt-4o', kind: 'memory', system: '提炼规则', user: '对话正文' });
		expect(r.ok).toBe(true);
		expect(r.content).toBe('{"facts":[]}');
		const body = mockChat.mock.calls[0][0];
		expect(body.messages[0].content.startsWith(SHORT_CALL_MARKERS.memory)).toBe(true);
		expect(body.messages[1].content).toBe('对话正文');
		expect(body.providerOptions.requestTimeoutMs).toBe(30000);
	});

	test('「辅助」槽:槽空 = 用传入的档案 / 模型、选项逐字节同不给槽;填了槽 = 改走该槽的档案与模型,并回报实际所用模型', async ()=>{
		const { writeModelRoutes, clearModelRoutes, ROUTE_SLOTS } = require('../aiModelRouting');
		expect(ROUTE_SLOTS).toContain('utility');
		window.localStorage.clear();
		mockChat.mockResolvedValue({ Result: { content: '摘要' } });
		const A = { ...PROFILE, id: 'pa', providerOptions: { temperature: 0.3 } };
		const B = { providerType: 'anthropic', id: 'pb', apiKey: 'kb', baseUrl: 'https://b.invalid', providerOptions: {} };
		const plain = await requestShortCompletion({ profile: A, model: 'big', kind: 'compact', system: 's', user: 'u' });
		const slotted = await requestShortCompletion({ profile: A, model: 'big', kind: 'compact', system: 's', user: 'u', slot: 'utility', providerProfiles: [A, B] });
		expect(mockChat.mock.calls[1][0]).toEqual(mockChat.mock.calls[0][0]);
		expect(plain.model).toBe('big'); expect(slotted.model).toBe('big');
		writeModelRoutes({ utility: 'pb::small' });
		const routed = await requestShortCompletion({ profile: A, model: 'big', kind: 'compact', system: 's', user: 'u', slot: 'utility', providerProfiles: [A, B] });
		const body = mockChat.mock.calls[2][0];
		expect(body.model).toBe('small'); expect(body.providerType).toBe('anthropic'); expect(body.baseUrl).toBe('https://b.invalid');
		expect(routed.model).toBe('small');
		clearModelRoutes();
	});

	test('上游抛错/空回复 → ok:false 不抛', async ()=>{
		mockChat.mockRejectedValue(new Error('boom'));
		const r = await requestShortCompletion({ profile: PROFILE, model: 'gpt-4o', kind: 'compact', system: 's', user: 'u' });
		expect(r.ok).toBe(false);
		expect(r.error).toBe('boom');
		mockChat.mockResolvedValue({ Result: { content: '' } });
		const e = await requestShortCompletion({ profile: PROFILE, model: 'gpt-4o', kind: 'compact', system: 's', user: 'u' });
		expect(e.ok).toBe(false);
		expect(e.error).toBe('empty');
	});

	test('parseShortCallJson:剥围栏取首个对象;非对象/坏 JSON → null', ()=>{
		expect(parseShortCallJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
		expect(parseShortCallJson('前言 {"a":{"b":2}} 后语')).toEqual({ a: { b: 2 } });
		expect(parseShortCallJson('[1,2]')).toBe(null);
		expect(parseShortCallJson('{bad')).toBe(null);
	});
});
