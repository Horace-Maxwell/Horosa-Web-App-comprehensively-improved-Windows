// AI 对话·会话级用量统计(状态栏消费):纯函数,只读消息上的 usage,不解析正文。
// 命中率与费用公式与气泡处逐字同口径(AIAnalysisMain 气泡 tooltip):
//  - anthropic:input 不含缓存段,分母 = input + 缓存读 + 缓存写;openai 家族 input 已含,分母 = input;
//  - 费用经 estimateUsageCost 按家族分式;无价档的模型计 null(不把「不知道」算成 0)。
import { estimateUsageCost, getProviderProtocolFamily } from '../aiAnalysisProviders';

function num(v){
	const n = Number(v);
	return Number.isFinite(n) && n > 0 ? n : 0;
}

// [I1] usage 缓存计量归一:各家把「命中的前缀缓存」放在不同键上,状态栏/A/B 分析器/费用闸只认
// anthropic 的 cache_read_input_tokens。这里把两种别名折进该键(纯函数,不改原对象):
//   · DeepSeek(openai 协议扩展):usage.prompt_cache_hit_tokens
//   · OpenAI 家族:usage.prompt_tokens_details.cached_tokens
// 纪律:已经带 cache_read_input_tokens 的 usage 一律不覆盖(上游自报优先,含显式 0);
//       非对象/空值原样返回不抛(SSE 事件里 usage 可能是 null 或字符串)。
export function normalizeUsage(u){
	if(!u || typeof u !== 'object' || Array.isArray(u)){ return u; }
	if(Object.prototype.hasOwnProperty.call(u, 'cache_read_input_tokens')){ return u; }
	const details = u.prompt_tokens_details;
	const raw = [
		u.prompt_cache_hit_tokens,
		details && typeof details === 'object' ? details.cached_tokens : undefined,
	];
	// ⚠️ Number(null)===0:不能拿 Number() 当「有没有这个数」的判据,否则 null 会被折成 0 并凭空写出该键。
	const hit = raw.find((v)=>(typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) && Number(v) >= 0);
	if(hit === undefined){ return u; }
	return { ...u, cache_read_input_tokens: Number(hit) };
}

// 单条 usage 的派生量:{ inputTokens, outputTokens, cacheRead, cacheWrite, promptTotal, cachePct, cost|null }
export function deriveUsage(usage, familyFallback){
	const u = usage && typeof usage === 'object' ? usage : {};
	const inputTokens = num(u.input_tokens);
	const outputTokens = num(u.output_tokens);
	const cacheRead = num(u.cache_read_input_tokens);
	const cacheWrite = num(u.cache_creation_input_tokens);
	const family = u.providerType ? getProviderProtocolFamily(u.providerType) : (familyFallback || getProviderProtocolFamily());
	const promptTotal = inputTokens + (family === 'anthropic' ? cacheRead + cacheWrite : 0);
	const cachePct = cacheRead > 0 && promptTotal > 0 ? Math.min(100, Math.round((cacheRead / promptTotal) * 100)) : 0;
	const priced = u.model ? estimateUsageCost(u.model, inputTokens, outputTokens, { cacheRead, cacheWrite, family }) : null;
	return { inputTokens, outputTokens, cacheRead, cacheWrite, promptTotal, cachePct, family, cost: priced ? priced.cost : null };
}

// 会话汇总:turns=带 usage 的 assistant 条数;costUsd=有价档条目求和(全部无价档→null);
// lastCachePct=最近一条带 usage 的命中率;cachePctOverall=Σ读/Σ分母(只算有缓存计量的轮)。
export function computeSessionStats(messages, opts){
	const family = opts && opts.family ? opts.family : undefined;
	const list = Array.isArray(messages) ? messages : [];
	let turns = 0;
	let inputTokens = 0;
	let outputTokens = 0;
	let cacheRead = 0;
	let cacheWrite = 0;
	let promptTotal = 0;
	let costUsd = null;
	let lastCachePct = null;
	let lastUsage = null;
	list.forEach((m)=>{
		if(!m || m.role !== 'assistant' || !m.usage || typeof m.usage !== 'object'){ return; }
		const d = deriveUsage(m.usage, family);
		if(!d.inputTokens && !d.outputTokens){ return; }
		turns += 1;
		inputTokens += d.inputTokens;
		outputTokens += d.outputTokens;
		cacheRead += d.cacheRead;
		cacheWrite += d.cacheWrite;
		promptTotal += d.promptTotal;
		if(d.cost !== null){ costUsd = (costUsd === null ? 0 : costUsd) + d.cost; }
		lastCachePct = d.cachePct;
		lastUsage = m.usage;
	});
	const cachePctOverall = cacheRead > 0 && promptTotal > 0 ? Math.min(100, Math.round((cacheRead / promptTotal) * 100)) : 0;
	return { turns, inputTokens, outputTokens, cacheRead, cacheWrite, promptTotal, cachePctOverall, lastCachePct, costUsd, lastUsage };
}

// 上下文占比:稳定层+挥发层字数按 1.6 字/token 折算 + 历史保留 token,相对模型窗口;窗口未知 → null。
export function estimateContextPct({ stableChars, volatileChars, historyTokens, contextWindow }){
	const win = num(contextWindow);
	if(!win){ return null; }
	const promptTokens = (num(stableChars) + num(volatileChars)) / 1.6 + num(historyTokens);
	return Math.min(100, Math.round((promptTokens / win) * 100));
}
