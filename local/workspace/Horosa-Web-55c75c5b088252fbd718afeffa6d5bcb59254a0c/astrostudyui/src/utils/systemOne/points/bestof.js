// 决策层 · 多模型对比候选评判(E1,影子):并行问 choice 选最佳,只记与 LLM 判官的一致率。
// 理由:2–4 篇长中文答案的质量评判是这类模型最差的工况,且填不了界面要显示的 reasons[] —— 不接管,只对照。
import { choice } from '../questions';
import { MAX_CANDIDATES } from '../../aiBestOfN';

function text(v, max){ return `${v === undefined || v === null ? '' : v}`.slice(0, max || 4000); }

export const E1 = {
	id: 'E1', title: '多模型候选评判(影子)', group: 'bestof', kind: 'shadow', timing: 'background', shadowOnly: true,
	sends: ['用户提问', '各候选答案正文'],
	help: '多模型对比由模型判官打分采用;影子开着时并行问一次决策层「哪份最好」,只记一致率,不影响采用哪一份。',
	goldenId: 'E1', defaultThresholds: { act: 0.85, confirm: 0.6 },
	buildState(inputs){
		const list = inputs && inputs.candidates;
		const cands = Array.isArray(list) ? list.slice(0, MAX_CANDIDATES).map((c)=>text(c, 6000)) : [];
		return { question: text(inputs && inputs.question, 2000), candidates: cands };
	},
	buildQuestions(inputs){
		const n = Math.min(MAX_CANDIDATES, Math.max(2, Array.isArray(inputs && inputs.candidates) ? inputs.candidates.length : 2));
		const criteria = {};
		for(let i = 0; i < n; i += 1){ criteria[`c${i + 1}`] = { what: `\`candidates[${i}]\`` }; }
		return { best: choice('Which candidate in `candidates` answers `question` most accurately and usefully, judged only by what the candidates state?', criteria) };
	},
	interpret(answers){
		const a = answers && answers.best;
		if(!a || a.kind !== 'choice'){ return null; }
		const idx = parseInt(`${a.value}`.replace(/^c/, ''), 10);
		return { value: Number.isFinite(idx) ? idx - 1 : null, confidence: a.confidence, probabilities: a.probabilities };
	},
	fallback(inputs){ return inputs && inputs.heuristic !== undefined ? inputs.heuristic : null; },
};

export const BESTOF_POINTS = [E1];
