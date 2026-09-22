// 多技法编排(C7)纯控制流合同:限额冻结且子任务零写入不可覆盖;两 schema strict 可用;parsePlan 过滤未知/重复技法并封顶;parseSynthesis 校验;分歧确定性渲染;
// 只读注册表视图藏 additive、拒跑 additive(E_APPROVAL_DENIED)、read 透传;runOrchestration:规划→并行子任务(≤PARALLEL)→综合;规划坏→各技法各答;综合坏→拼接;单份不花综合;全败→error;中止→aborted。
import { ORCH_LIMITS, PLAN_SCHEMA, SYNTH_SCHEMA, ORCH_PLAN_TAG, ORCH_SYNTH_TAG, ORCH_SUBTASK_TAG, ORCH_DISAGREE_TITLE, buildPlanPrompt, buildSubtaskPrompt, buildSynthesisPrompt, parsePlan, fallbackPlan, parseSynthesis, fallbackSynthesis, renderDisagreements, composeContent, readOnlyRegistryView, defaultReadOnlyRegistry, runOrchestration } from '../aiAgent/orchestrator';
import { applyResponseSchema, describeResponseFormat } from '../aiStructuredOutput';

const TECH = [{ key: 'bazi', label: '八字' }, { key: 'ziwei', label: '紫微' }, { key: 'qimen', label: '奇门' }, { key: 'liureng', label: '六壬' }, { key: 'taiyi', label: '太乙' }];
const planJson = (subtasks, note = '拆法')=>JSON.stringify({ subtasks, note });
const synthJson = (o)=>JSON.stringify({ answer: '综合:今年宜稳', disagreements: [{ topic: '创业时机', positions: [{ technique: 'bazi', claim: '明年更佳', basis: '流年' }, { technique: 'ziwei', claim: '下半年可', basis: '化禄' }], note: '以八字为主' }], confidence: 'medium', ...o });

it('限额冻结:MAX_SUBTASKS 4 / SUB_MAX_ROUNDS 3 / SUB_MAX_ADDITIVE 0 / PARALLEL 3;两 schema strict 可挂 response_format;提示词带标记', ()=>{
	expect(ORCH_LIMITS).toEqual({ MAX_SUBTASKS: 4, SUB_MAX_ROUNDS: 3, SUB_MAX_ADDITIVE: 0, PARALLEL: 3 });
	expect(Object.isFrozen(ORCH_LIMITS)).toBe(true);
	expect(applyResponseSchema({}, { name: 'orchestration_plan', schema: PLAN_SCHEMA }).response_format.type).toBe('json_schema');
	expect(applyResponseSchema({}, { name: 'orchestration_synthesis', schema: SYNTH_SCHEMA }).response_format.json_schema.schema.properties.confidence.enum).toEqual(['high', 'medium', 'low']);
	expect(describeResponseFormat(applyResponseSchema({}, { name: 'orchestration_synthesis', schema: SYNTH_SCHEMA }))).toBe('json_schema:orchestration_synthesis');
	expect(describeResponseFormat(applyResponseSchema({}, { name: 'orchestration_plan', schema: PLAN_SCHEMA }))).toBe('json_schema:orchestration_plan');
	const p = buildPlanPrompt({ question: '今年适合创业吗', techniques: TECH });
	expect(p.system.indexOf(ORCH_PLAN_TAG)).toBe(0); expect(p.system).toContain('bazi(八字)'); expect(p.system).toContain('最多 4 个子任务'); expect(p.user).toContain('今年适合创业吗');
	expect(buildSubtaskPrompt({ question: '看大运', overallQuestion: '创业', label: '八字', technique: 'bazi' }).indexOf(`${ORCH_SUBTASK_TAG}八字`)).toBe(0);
	const s = buildSynthesisPrompt({ question: 'Q', results: [{ technique: 'bazi', label: '八字', question: 'q1', text: 'A1' }] });
	expect(s.system.indexOf(ORCH_SYNTH_TAG)).toBe(0); expect(s.user).toContain('### 八字(bazi)');
});

it('parsePlan:围栏/未知技法丢/重复技法丢/封顶 4/空 → null;fallbackPlan 各技法各答;parseSynthesis 校验;fallbackSynthesis 拼接;分歧渲染确定性', ()=>{
	const txt = '```json\n' + planJson([{ technique: 'bazi', question: 'q1', why: 'w' }, { technique: 'nope', question: 'x', why: '' }, { technique: 'bazi', question: 'dup', why: '' }, { technique: 'ziwei', question: 'q2', why: '' }, { technique: 'qimen', question: 'q3', why: '' }, { technique: 'liureng', question: 'q4', why: '' }, { technique: 'taiyi', question: 'q5', why: '' }]) + '\n```';
	const plan = parsePlan(txt, TECH.map((t)=>t.key));
	expect(plan.subtasks.map((s)=>s.technique)).toEqual(['bazi', 'ziwei', 'qimen', 'liureng']);
	expect(plan.fallback).toBe(false);
	expect(parsePlan(planJson([{ technique: 'nope', question: 'x', why: '' }]), ['bazi'])).toBe(null);
	expect(parsePlan('not json', ['bazi'])).toBe(null);
	const fb = fallbackPlan({ question: 'Q', techniques: TECH });
	expect(fb.fallback).toBe(true); expect(fb.subtasks.length).toBe(4); expect(fb.subtasks[0]).toEqual({ technique: 'bazi', question: 'Q', why: '规划不可用,按技法各自作答' });
	const syn = parseSynthesis(synthJson({ confidence: 'weird' }));
	const flat = parseSynthesis(JSON.stringify({ answer: 'A', disagreements: [{ topic: '时机', technique: 'bazi', claim: '明年', basis: '流年', note: '' }, { topic: '时机', technique: 'ziwei', claim: '下半年', basis: '化禄', note: '以八字为主' }, { topic: '', technique: 'x', claim: 'y', basis: '', note: '' }], confidence: 'high' }));
	expect(flat.disagreements).toEqual([{ topic: '时机', positions: [{ technique: 'bazi', claim: '明年', basis: '流年' }, { technique: 'ziwei', claim: '下半年', basis: '化禄' }], note: '以八字为主' }]);
	expect(syn.confidence).toBe('medium'); expect(syn.disagreements.length).toBe(1); expect(syn.disagreements[0].positions.length).toBe(2);
	expect(parseSynthesis(JSON.stringify({ answer: '', disagreements: [], confidence: 'high' }))).toBe(null);
	expect(parseSynthesis(JSON.stringify({ answer: 'A', disagreements: [{ topic: 't', positions: [{ technique: 'bazi', claim: '' }], note: '' }], confidence: 'high' })).disagreements).toEqual([]);
	const fbs = fallbackSynthesis([{ technique: 'bazi', label: '八字', text: 'A1' }, { technique: 'ziwei', label: '紫微', text: '' }]);
	expect(fbs.answer).toBe('### 八字\nA1'); expect(fbs.fallback).toBe(true); expect(fbs.confidence).toBe('low');
	const lab = (k)=>({ bazi: '八字', ziwei: '紫微' }[k] || k);
	const r = renderDisagreements(syn, lab);
	expect(r.split('\n')).toEqual([`## ${ORCH_DISAGREE_TITLE}`, '1. **创业时机**', '   - 八字:明年更佳(依据:流年)', '   - 紫微:下半年可(依据:化禄)', '   - 取舍:以八字为主']);
	expect(renderDisagreements({ disagreements: [] })).toBe('');
	expect(composeContent(syn, lab)).toBe(`综合:今年宜稳\n\n${r}`);
});

it('🔴 只读注册表视图:manifest 只露 read;getTool additive → null;runTool additive → E_APPROVAL_DENIED 且不触底层;read 透传', async ()=>{
	const calls = [];
	const reg = {
		getTool: (n)=>({ list_records: { name: 'list_records', level: 'read' }, create_record: { name: 'create_record', level: 'additive' } }[n] || null),
		exportToolManifest: ()=>[{ name: 'list_records', level: 'read' }, { name: 'create_record', level: 'additive' }],
		runTool: async (n, a)=>{ calls.push(n); return { ok: true, data: a }; },
	};
	const v = readOnlyRegistryView(reg);
	expect(v.readOnly).toBe(true);
	expect(v.exportToolManifest().map((t)=>t.name)).toEqual(['list_records']);
	expect(v.getTool('create_record')).toBe(null);
	expect(v.getTool('list_records').level).toBe('read');
	const denied = await v.runTool('create_record', { name: 'x' }, {});
	expect(denied.ok).toBe(false); expect(denied.code).toBe('E_APPROVAL_DENIED'); expect(calls).toEqual([]);
	const ok = await v.runTool('list_records', { limit: 1 }, {});
	expect(ok.ok).toBe(true); expect(calls).toEqual(['list_records']);
});

it('🔴 默认绑定 defaultReadOnlyRegistry:内置目录的只读视图——manifest 只露 read 级、additive 工具取不到也跑不了', async ()=>{
	const v = defaultReadOnlyRegistry();
	expect(v.readOnly).toBe(true);
	const names = v.exportToolManifest().map((t)=>t.name);
	expect(names.length).toBeGreaterThan(0);
	names.forEach((n)=>expect(v.getTool(n).level).toBe('read'));
	expect(names.some((n)=>/^(create_|set_settings|load_record|schedule_task)/.test(n))).toBe(false);
	expect(v.getTool('create_chart_record')).toBe(null);
	const denied = await v.runTool('create_chart_record', { name: 'x' }, { origin: 'in-app' });
	expect(denied.ok).toBe(false); expect(denied.code).toBe('E_APPROVAL_DENIED');
});

it('🔴 runOrchestration:规划→并行子任务(并发 ≤ PARALLEL)→综合;requests 1+N+1;内容=综合稿+分歧标注;进度回调三段', async ()=>{
	let running = 0; let peak = 0; const seen = [];
	const io = {
		plan: async ({ system })=>{ expect(system.indexOf(ORCH_PLAN_TAG)).toBe(0); return planJson([{ technique: 'bazi', question: '八字看时机', why: 'a' }, { technique: 'ziwei', question: '紫微看事业宫', why: 'b' }, { technique: 'qimen', question: '奇门看', why: 'c' }, { technique: 'liureng', question: '六壬看', why: 'd' }]); },
		runSubtask: async (st)=>{ running += 1; peak = Math.max(peak, running); seen.push(st.technique); await new Promise((r)=>setTimeout(r, 15)); running -= 1; return { text: `${st.label}答:${st.question}`, trace: { rounds: [] }, usage: { input_tokens: 1, output_tokens: 1 } }; },
		synthesize: async ({ system, user })=>{ expect(system.indexOf(ORCH_SYNTH_TAG)).toBe(0); expect(user).toContain('### 八字(bazi)'); return synthJson({}); },
	};
	const stages = [];
	const out = await runOrchestration({ question: '今年适合创业吗', techniques: TECH, io, limits: { PARALLEL: 2, SUB_MAX_ADDITIVE: 5 }, onProgress: (ev)=>stages.push(ev.stage) });
	expect(out.status).toBe('done');
	expect(out.plan.subtasks.length).toBe(4); expect(out.plan.fallback).toBe(false);
	expect(seen.sort()).toEqual(['bazi', 'liureng', 'qimen', 'ziwei']);
	expect(peak).toBeLessThanOrEqual(2);
	expect(out.subTurns.map((s)=>s.status)).toEqual(['done', 'done', 'done', 'done']);
	expect(out.subTurns[0].prompt.indexOf(`${ORCH_SUBTASK_TAG}八字`)).toBe(0);
	expect(out.requests).toEqual({ plan: 1, subtasks: 4, synthesis: 1 });
	expect(out.content).toContain('综合:今年宜稳'); expect(out.content).toContain(`## ${ORCH_DISAGREE_TITLE}`); expect(out.content).toContain('   - 八字:明年更佳(依据:流年)');
	expect(stages).toEqual(['planned', 'subtask', 'subtask', 'subtask', 'subtask', 'synthesized']);
});

it('🔴 规划坏 JSON → 各技法各答(fallback+error);综合坏 → 按技法拼接;单份子回答不花综合;子任务全败 → error;中止 → aborted', async ()=>{
	const mk = (over)=>({ plan: async ()=>'not json', runSubtask: async (st)=>({ text: `${st.label}答` }), synthesize: async ()=>'garbage', ...over });
	const a = await runOrchestration({ question: 'Q', techniques: TECH.slice(0, 2), io: mk({}) });
	expect(a.plan.fallback).toBe(true); expect(a.plan.error).toBe('unparseable');
	expect(a.subTurns.map((s)=>s.question)).toEqual(['Q', 'Q']);
	expect(a.synthesis.fallback).toBe(true); expect(a.content).toBe('### 八字\n八字答\n\n### 紫微\n紫微答');
	let synthCalls = 0;
	const b = await runOrchestration({ question: 'Q', techniques: TECH.slice(0, 1), io: mk({ synthesize: async ()=>{ synthCalls += 1; return synthJson({}); } }) });
	expect(synthCalls).toBe(0); expect(b.synthesis.single).toBe(true); expect(b.content).toBe('八字答'); expect(b.requests).toEqual({ plan: 1, subtasks: 1, synthesis: 0 });
	const c = await runOrchestration({ question: 'Q', techniques: TECH.slice(0, 2), io: mk({ runSubtask: async ()=>{ throw new Error('boom'); } }) });
	expect(c.status).toBe('error'); expect(c.subTurns.every((s)=>s.status === 'error' && s.error === 'boom')).toBe(true);
	const ac = new AbortController(); ac.abort();
	const d = await runOrchestration({ question: 'Q', techniques: TECH.slice(0, 2), io: mk({}), signal: ac.signal });
	expect(d.status).toBe('aborted'); expect(d.subTurns).toEqual([]);
	const e = await runOrchestration({ question: 'Q', techniques: [], io: mk({}) });
	expect(e.status).toBe('error');
});
