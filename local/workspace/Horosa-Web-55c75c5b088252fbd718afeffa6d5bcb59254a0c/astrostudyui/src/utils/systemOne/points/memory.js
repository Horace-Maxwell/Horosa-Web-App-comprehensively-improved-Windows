// 决策层 · 记忆候选复评(C1):只复评正则已选中的候选,一候选一请求;仍需用户确认才入库。
import { noul, choice } from '../questions';

function text(v, max){ return `${v === undefined || v === null ? '' : v}`.slice(0, max || 4000); }

export const C1_BUCKETS = ['user', 'chart', 'global'];

export const C1 = {
	id: 'C1', title: '记忆候选复评', group: 'memory', kind: 'quality', timing: 'background', shadowOnly: false,
	sends: ['被正则选中的那一句用户原话'],
	help: '自动沉淀候选时,把正则选中的句子再问一次「是不是长期稳定的个人事实或偏好」并归类主体;不像的丢弃,像的带真实置信度进候选区;仍需你确认才入库。',
	goldenId: 'C1', defaultThresholds: { act: 0.85, confirm: 0.6, keepMin: 0.3 },
	buildState(inputs){ return { sentence: text(inputs && inputs.sentence, 1000) }; },
	buildQuestions(){
		return {
			stable: noul('Is `sentence` a long-term stable personal fact or preference about the user (or someone in their life) worth remembering across conversations?', {
				true: 'A durable fact: name / relation / birth info / occupation / lasting preference or taboo, e.g. "我妻子叫李四", "我不看流年只看大运"', false: 'A one-off question, a temporary state, a request, or a statement about the chart being discussed',
			}),
			bucket: choice('Who is `sentence` about?', {
				user: { what: 'The user themself, or their preferences / rules for the assistant' },
				chart: { what: 'A specific person whose chart is being analysed (a client, relative or friend named in the sentence)' },
				global: { what: 'A general standing convention that applies to every conversation regardless of person' },
			}),
		};
	},
	interpret(answers, th){
		const s = answers && answers.stable;
		const b = answers && answers.bucket;
		if(!s || s.kind !== 'noul' || !b || b.kind !== 'choice'){ return null; }
		const keepMin = th && Number.isFinite(Number(th.keepMin)) ? Number(th.keepMin) : 0.3;
		const keep = s.value >= keepMin;
		return { value: { keep, bucket: keep ? (C1_BUCKETS.indexOf(b.value) >= 0 ? b.value : 'user') : null }, confidence: keep ? Math.min(s.confidence, b.confidence) : s.confidence, detail: { stable: s.value } };
	},
	fallback(inputs){ return { keep: true, bucket: inputs && C1_BUCKETS.indexOf(inputs.heuristicBucket) >= 0 ? inputs.heuristicBucket : 'user' }; },
};

export const MEMORY_POINTS = [C1];
