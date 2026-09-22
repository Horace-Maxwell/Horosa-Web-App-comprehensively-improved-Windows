// 多模型对比(C5)纯函数合同:候选计划(models 去重 ≤4、不足 2 空;angles 缺省经典+审慎)· 成本估算(无价档 null,有价合计)· 判官/合并提示词带标记与 id 约束 · JUDGE_SCHEMA 严格 · parseJudge 校验/补齐/围栏 · historyContentOf 只带采用稿。
import { planCandidates, estimateCandidatesCost, buildJudgePrompt, buildMergePrompt, parseJudge, historyContentOf, JUDGE_SCHEMA, MAX_CANDIDATES, MIN_CANDIDATES, ROLE_ANGLES, BESTOF_JUDGE_MARKER, candidateCharCap, clipCandidateText, candidateOverflow, BESTOF_CANDIDATE_CHAR_CAP } from '../aiBestOfN';
import { applyResponseSchema } from '../aiStructuredOutput';

const pA = { id: 'pa', name: 'A', providerType: 'openai', providerOptions: {} };
const pB = { id: 'pb', name: 'B', providerType: 'anthropic', providerOptions: {} };

describe('planCandidates / cost', ()=>{
	it('models:按 selection 建候选、同档同模去重、封顶 4、不足 2 → 空;angles:缺省经典+审慎,最多 4', ()=>{
		expect(MAX_CANDIDATES).toBe(4); expect(MIN_CANDIDATES).toBe(2);
		const c = planCandidates({ mode: 'models', selections: ['pa::gpt-4o', 'pb::claude-x', 'pa::gpt-4o', 'nope::m', 'pa::mini', 'pb::opus', 'pa::extra'], providerProfiles: [pA, pB], profile: pA, model: 'gpt-4o' });
		expect(c.map((x)=>x.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
		expect(c[0].label).toBe('A / gpt-4o'); expect(c[1].profile).toBe(pB); expect(c[0].angle).toBe(null);
		expect(planCandidates({ mode: 'models', selections: ['pa::gpt-4o'], providerProfiles: [pA], profile: pA, model: 'gpt-4o' })).toEqual([]);
		const a = planCandidates({ mode: 'angles', selections: [], providerProfiles: [pA], profile: pA, model: 'gpt-4o' });
		expect(a.map((x)=>x.angle.key)).toEqual(['classic', 'modern']);
		expect(planCandidates({ mode: 'angles', angles: ['classic', 'cautious'], providerProfiles: [pA], profile: pA, model: 'm' }).map((x)=>x.angle.key)).toEqual(['classic', 'cautious']);
		expect(planCandidates({ mode: 'angles', angles: ['a', 'b', 'c'], profile: pA, model: 'm' })).toEqual([]);
		expect(ROLE_ANGLES.length).toBe(4);
	});
	it('成本:无价档 totalUsd null/unknown 计数;有价档合计', ()=>{
		const unknown = estimateCandidatesCost({ candidates: [{ id: 'c1', model: 'mock-model' }, { id: 'c2', model: 'mock-2' }], inputTokens: 1000, outputTokens: 500 });
		expect(unknown.totalUsd).toBe(null); expect(unknown.unknown).toBe(2);
		const known = estimateCandidatesCost({ candidates: [{ id: 'c1', model: 'gpt-4o-mini' }, { id: 'c2', model: 'gpt-4o-mini' }], inputTokens: 1000, outputTokens: 500 });
		expect(known.known).toBe(2);
		expect(known.totalUsd).toBeGreaterThan(0);
		expect(known.totalUsd).toBeCloseTo(known.per[0].costUsd * 2, 6);
	});
});

describe('judge / merge / history', ()=>{
	it('🔴 判官提示带标记与 id 约束;schema 经 applyResponseSchema 成 strict json_schema;parseJudge 校验 best、补齐 ranking、剥围栏、坏值 null', ()=>{
		const cands = [{ id: 'c1', label: 'A', text: '甲' }, { id: 'c2', label: 'B', text: '乙' }];
		const jp = buildJudgePrompt({ question: 'Q', candidates: cands });
		expect(jp.system.indexOf(BESTOF_JUDGE_MARKER)).toBe(0);
		expect(jp.system).toContain('c1, c2');
		expect(jp.user).toContain('【候选 c2(B)】');
		const opts = applyResponseSchema({}, { name: 'bestof_judge', schema: JUDGE_SCHEMA });
		expect(opts.response_format.type).toBe('json_schema');
		expect(opts.response_format.json_schema.schema.required).toEqual(['best', 'ranking', 'reasons']);
		expect(parseJudge('```json\n{"best":"c2","ranking":["c2"],"reasons":[{"id":"c2","score":9,"reason":"好"},{"id":"zz","score":1,"reason":"x"}]}\n```', ['c1', 'c2'])).toEqual({ best: 'c2', ranking: ['c2', 'c1'], reasons: [{ id: 'c2', score: 9, reason: '好' }] });
		expect(parseJudge('{"best":"c1","ranking":["c2","c1"]}', ['c1', 'c2']).ranking).toEqual(['c1', 'c2']);
		expect(parseJudge('{"best":"c9"}', ['c1', 'c2'])).toBe(null);
		expect(parseJudge('not json', ['c1'])).toBe(null);
		const mp = buildMergePrompt({ question: 'Q', candidates: cands, ranking: ['c2', 'c1'] });
		expect(mp.user.indexOf('【候选 c2')).toBeLessThan(mp.user.indexOf('【候选 c1'));
	});
	it('historyContentOf:普通消息原样;content 空且有候选 → 采用/排名第一/首个非空;非对象空串', ()=>{
		expect(historyContentOf({ content: '正文' })).toBe('正文');
		expect(historyContentOf({ content: '', candidates: [{ id: 'c1', text: '甲' }, { id: 'c2', text: '乙' }], bestOf: { adoptedId: 'c2' } })).toBe('乙');
		expect(historyContentOf({ content: '', candidates: [{ id: 'c1', text: '' }, { id: 'c2', text: '乙' }], bestOf: { ranking: ['c2', 'c1'] } })).toBe('乙');
		expect(historyContentOf({ content: '', candidates: [{ id: 'c1', text: '' }, { id: 'c2', text: '乙' }] })).toBe('乙');
		expect(historyContentOf(null)).toBe('');
	});
});

// ---- [压测二轮·D5·V2] 多模型判官返回越界值:score 钳制、未知 best 整条作废(由调用方回落首份)、ranking 去重补齐 ----
describe('V2 判官越界', ()=>{
	it('V2 score 99/-5/非数 钳到 1..10;best 不在候选集 → null(钩子据此回落首份);ranking 重复与未知 id 去掉后按候选集补齐', ()=>{
		const ids = ['c1', 'c2', 'c3'];
		const wild = parseJudge(JSON.stringify({ best: 'c2', ranking: ['c2', 'c2', 'zzz', 'c1', 'c1'], reasons: [
			{ id: 'c2', score: 99, reason: '高' }, { id: 'c1', score: -5, reason: '低' }, { id: 'c3', score: 'abc', reason: '非数' }, { id: 'nope', score: 5, reason: '不存在' },
		] }), ids);
		expect(wild.best).toBe('c2');
		expect(wild.ranking).toEqual(['c2', 'c1', 'c3']);
		expect(wild.reasons.map((r)=>r.id)).toEqual(['c2', 'c1', 'c3']);
		expect(wild.reasons.every((r)=>r.score >= 1 && r.score <= 10)).toBe(true);
		expect(wild.reasons[0].score).toBe(10);
		expect(wild.reasons[1].score).toBe(1);
		expect(wild.reasons[2].score).toBe(1);
		// best 不在候选集 → 整条判定作废(useChatBestOf 据此回落到完成序第一份并标 error:'unparseable')
		expect(parseJudge(JSON.stringify({ best: 'zzz', ranking: ['c1'], reasons: [] }), ids)).toBe(null);
		expect(parseJudge(JSON.stringify({ ranking: ['c1'] }), ids)).toBe(null);
		// 判别力:正常判定照常通过
		expect(parseJudge(JSON.stringify({ best: 'c1', ranking: ['c1', 'c2', 'c3'], reasons: [] }), ids).ranking).toEqual(['c1', 'c2', 'c3']);
	});
});

// [Q-331/M-52] 候选截断:此前固定 6000 字硬切且无标注 —— 判官对着半截候选打分、合并稿采用了残稿,用户看不出来。
describe('[Q-331] 多模型候选截断:动态上限 + 截断标注', ()=>{
	test('candidateCharCap:无预算=旧行为 6000;有预算按份数分且夹在 1500..24000', ()=>{
		expect(candidateCharCap({ count: 3 })).toBe(BESTOF_CANDIDATE_CHAR_CAP);
		expect(candidateCharCap({ count: 2, charBudget: 40000 })).toBe(16000);
		expect(candidateCharCap({ count: 8, charBudget: 40000 })).toBe(4000);
		expect(candidateCharCap({ count: 40, charBudget: 40000 })).toBe(1500);   // 下限
		expect(candidateCharCap({ count: 1, charBudget: 400000 })).toBe(24000);  // 上限
	});
	test('clipCandidateText:未超限原样;超限保留前 N 字并注明原长度(勿扣分/勿臆补)', ()=>{
		expect(clipCandidateText('短文', 100)).toBe('短文');
		const long = '甲'.repeat(9000);
		const out = clipCandidateText(long, 6000);
		expect(out.slice(0, 6000)).toBe('甲'.repeat(6000));
		expect(out).toContain('原文约 9000 字');
		expect(out).toContain('只给前 6000 字');
		expect(out).toContain('请勿因此扣分');
	});
	test('candidateOverflow 报出超限候选;判官/合并 prompt 带标注而非静默硬切', ()=>{
		const cands = [{ id: 'a', label: 'A', text: '甲'.repeat(9000) }, { id: 'b', label: 'B', text: '乙' }];
		expect(candidateOverflow(cands).map((x)=>x.id)).toEqual(['a']);
		expect(candidateOverflow(cands, 400000).length).toBe(0);   // 预算大 → 不截
		const jp = buildJudgePrompt({ question: 'Q', candidates: cands });
		expect(jp.user).toContain('本候选已截断');
		const mp = buildMergePrompt({ question: 'Q', candidates: cands, ranking: ['a', 'b'] });
		expect(mp.user).toContain('本候选已截断');
		// 预算充裕 → 整份进(零截断)
		expect(buildMergePrompt({ question: 'Q', candidates: cands, ranking: ['a', 'b'], charBudget: 400000 }).user).not.toContain('本候选已截断');
	});
});

