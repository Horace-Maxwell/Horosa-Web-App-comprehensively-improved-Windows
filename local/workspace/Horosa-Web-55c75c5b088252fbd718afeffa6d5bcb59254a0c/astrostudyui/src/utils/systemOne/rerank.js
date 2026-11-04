// 决策层 · 资料片段重排 + 注入预筛(对话检索 / 工具检索共用;稳定层组装器绝不 import 本文件)。
// 做法 = 「RAG 片段分类」+「一候选一请求」:每段各发一次(走 Java 批量端点),两问 —— 相关(noul)+ 注入企图(noul);
// 按相关概率排序,注入 ≥ 阈值的剔除并列给界面;任何失败回 { ok:false },调用方走原算法。收 signal(用户点停止即中止)。
import { callSystemOneBatch } from './client';
import { rerankQuestions, rerankState, RERANK_MAX_ITEMS, RERANK_PASSAGE_MAX_CHARS, RERANK_DEFAULTS } from './rerankQuestions';

export { rerankQuestions, rerankState, RERANK_MAX_ITEMS, RERANK_PASSAGE_MAX_CHARS, RERANK_DEFAULTS };

// passages: [{ text, ...其它字段原样带回 }];回 { ok, ranked:[{ index, relevance, injection, drop, item }], dropped:[…], model, latencyMs }
export async function rerankPassages({ query, passages, signal, thresholds } = {}){
	const th = { ...RERANK_DEFAULTS, ...(thresholds || {}) };
	const list = (Array.isArray(passages) ? passages : []).slice(0, RERANK_MAX_ITEMS);
	if(!list.length){ return { ok: true, ranked: [], dropped: [], model: '', latencyMs: 0 }; }
	const q = rerankQuestions();
	const res = await callSystemOneBatch(list.map((p)=>({ state: rerankState(query, p && (p.text !== undefined ? p.text : p)), questions: q })), { mode: 'background', signal });
	if(!res.ok){ return { ok: false, reason: res.reason || 'failed', latencyMs: res.latencyMs }; }
	const rows = [];
	for(let i = 0; i < list.length; i += 1){
		const r = res.results[i];
		if(!r || !r.ok || !r.answers.relevant || !r.answers.injection){ return { ok: false, reason: (r && r.reason) || 'partial', latencyMs: res.latencyMs }; }
		rows.push({ index: i, item: list[i], relevance: r.answers.relevant.value, injection: r.answers.injection.value, drop: r.answers.injection.value >= th.injectionDrop });
	}
	const kept = rows.filter((r)=>!r.drop && r.relevance >= th.relevantMin).sort((a, b)=>b.relevance - a.relevance || a.index - b.index);
	const dropped = rows.filter((r)=>r.drop);
	return { ok: true, ranked: kept, dropped, model: res.model, latencyMs: res.latencyMs };
}
