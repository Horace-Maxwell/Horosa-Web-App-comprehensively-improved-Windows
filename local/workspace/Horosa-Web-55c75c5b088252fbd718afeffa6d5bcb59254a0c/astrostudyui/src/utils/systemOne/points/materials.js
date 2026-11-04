// 决策层 · 资料检索重排 + 注入预筛(D1+D2,合并为一点;实际重排走 rerank.js 的批量通道,这里是登记 / 校准 / 手册用的单点定义:
// 一段一请求,两问 —— 相关(noul)+ 注入企图(noul)。只在没配嵌入模型、或用户显式勾选「有嵌入也用」时启用;失败回落原算法。
import { rerankQuestions, rerankState, RERANK_DEFAULTS } from '../rerankQuestions';

export const D1D2 = {
	id: 'D1D2', title: '资料片段重排 + 注入预筛', group: 'materials', kind: 'quality', timing: 'background', shadowOnly: false,
	sends: ['用户提问', '被检索到的资料片段(每段一请求,≤ 12 段)'],
	help: '资料检索命中的片段逐段问「是否有助于回答」「是否在给 AI 下指令」:按相关度重排,疑似注入的剔除并列出;只在没配嵌入模型或你显式勾选时启用,失败回落原算法。',
	goldenId: 'D1D2', defaultThresholds: { act: 0.85, confirm: 0.6, injectionDrop: RERANK_DEFAULTS.injectionDrop },
	buildState(inputs){ return rerankState(inputs && inputs.query, inputs && inputs.passage); },
	buildQuestions(){ return rerankQuestions(); },
	interpret(answers, th){
		const r = answers && answers.relevant;
		const j = answers && answers.injection;
		if(!r || r.kind !== 'noul' || !j || j.kind !== 'noul'){ return null; }
		const drop = th && Number.isFinite(Number(th.injectionDrop)) ? Number(th.injectionDrop) : RERANK_DEFAULTS.injectionDrop;
		return { value: { relevant: r.value >= 0.5, injection: j.value >= drop }, confidence: Math.min(r.confidence, j.confidence), detail: { relevance: r.value, injection: j.value } };
	},
	fallback(inputs){ return { relevant: inputs && inputs.heuristicRelevant !== undefined ? !!inputs.heuristicRelevant : true, injection: false }; },
	isPositive(value){ return !!(value && value.injection); },
};

export const MATERIAL_POINTS = [D1D2];
