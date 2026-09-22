// 会话用量统计(状态栏):与气泡处同口径的命中率分母、家族分式计价、无价档=null、上下文占比。
import { computeSessionStats, deriveUsage, estimateContextPct } from '../aiChat/status';
import { estimateUsageCost, getProviderProtocolFamily } from '../aiAnalysisProviders';

const asst = (usage)=>({ role: 'assistant', content: 'x', usage });

describe('aiChat/status', ()=>{
	test('anthropic 分母含缓存读写;openai 家族分母=input;命中率封顶 100', ()=>{
		const a = deriveUsage({ providerType: 'anthropic', model: 'claude-sonnet-4-5', input_tokens: 1000, output_tokens: 10, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 });
		expect(a.promptTotal).toBe(4000);
		expect(a.cachePct).toBe(75);
		const o = deriveUsage({ providerType: 'openai', model: 'gpt-4o', input_tokens: 4000, output_tokens: 10, cache_read_input_tokens: 3000 });
		expect(o.promptTotal).toBe(4000);
		expect(o.cachePct).toBe(75);
		const over = deriveUsage({ providerType: 'openai', model: 'gpt-4o', input_tokens: 100, output_tokens: 1, cache_read_input_tokens: 999 });
		expect(over.cachePct).toBe(100);
	});

	test('费用与气泡公式逐值相同;无价档模型 cost=null 且不污染总和', ()=>{
		const u = { providerType: 'anthropic', model: 'claude-sonnet-4-5', input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 500, cache_creation_input_tokens: 100 };
		const ref = estimateUsageCost(u.model, u.input_tokens, u.output_tokens, { cacheRead: 500, cacheWrite: 100, family: getProviderProtocolFamily('anthropic') });
		expect(deriveUsage(u).cost).toBe(ref ? ref.cost : null);
		const s = computeSessionStats([asst(u), asst({ providerType: 'custom', model: 'totally-unknown-model-xyz', input_tokens: 5, output_tokens: 5 })]);
		expect(s.turns).toBe(2);
		expect(s.costUsd).toBe(ref ? ref.cost : null);
		const none = computeSessionStats([asst({ providerType: 'custom', model: 'totally-unknown-model-xyz', input_tokens: 5, output_tokens: 5 })]);
		expect(none.costUsd).toBe(null);
	});

	test('汇总只计带 usage 的 assistant;空会话零值;lastCachePct 取最近一条', ()=>{
		const empty = computeSessionStats([]);
		expect(empty).toEqual(expect.objectContaining({ turns: 0, inputTokens: 0, outputTokens: 0, costUsd: null, lastCachePct: null }));
		const s = computeSessionStats([
			{ role: 'user', content: 'q', usage: { input_tokens: 999 } },
			asst({ providerType: 'openai', model: 'gpt-4o', input_tokens: 100, output_tokens: 10 }),
			asst({ providerType: 'openai', model: 'gpt-4o', input_tokens: 200, output_tokens: 20, cache_read_input_tokens: 100 }),
		]);
		expect(s.turns).toBe(2);
		expect(s.inputTokens).toBe(300);
		expect(s.outputTokens).toBe(30);
		expect(s.lastCachePct).toBe(50);
		expect(s.cachePctOverall).toBe(33);
	});

	test('上下文占比:窗口未知 null;已知按 1.6 字/token 折算并封顶', ()=>{
		expect(estimateContextPct({ stableChars: 1600, volatileChars: 0, historyTokens: 0, contextWindow: 0 })).toBe(null);
		expect(estimateContextPct({ stableChars: 1600, volatileChars: 1600, historyTokens: 1000, contextWindow: 10000 })).toBe(30);
		expect(estimateContextPct({ stableChars: 1e9, volatileChars: 0, historyTokens: 0, contextWindow: 10 })).toBe(100);
	});
});
