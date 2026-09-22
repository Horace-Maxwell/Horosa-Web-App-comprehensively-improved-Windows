// 回答审阅(C6)纯函数合同:schema strict;system 带标记/规则/未对拍提示/程序核对问题/挂载数据;审阅模型 路由>跨家族>同家族;parseReview 校验截断;重写指令逐条;共享模块零业务管线 import。
import fs from 'fs';
import path from 'path';
import { REVIEW_SCHEMA, REVIEW_MARKER, buildReviewSystemPrompt, buildReviewUserPrompt, pickReviewModel, parseReview, buildRewriteDirective, reviewSummaryLine, REVIEW_MAX_ISSUES } from '../aiReview';
import { applyResponseSchema } from '../aiStructuredOutput';

const pA = { id: 'pa', name: 'A', providerType: 'openai', enabled: true, chatModelIds: ['gpt-x'] };
const pB = { id: 'pb', name: 'B', providerType: 'anthropic', enabled: true, chatModelIds: ['claude-y'] };
const pC = { id: 'pc', name: 'C', providerType: 'deepseek', enabled: true, chatModelIds: ['ds'] };

it('schema/提示词:strict 可用;带标记与四类;未挂数据提示;程序核对问题逐条进 system;挂载数据在最前(前缀同构)', ()=>{
	const opts = applyResponseSchema({}, { name: 'answer_review', schema: REVIEW_SCHEMA });
	expect(opts.response_format.type).toBe('json_schema');
	expect(opts.response_format.json_schema.schema.properties.issues.items.required).toEqual(['kind', 'quote', 'reason', 'severity']);
	const sys = buildReviewSystemPrompt({ snapshotSystem: '【案例】张三 八字…', deterministicIssues: ['日主应为甲木,回答写成乙木', { text: '大运起运岁数不符' }], hasData: true });
	// [Q-290/PP-19] 挂载数据放最前(与对话请求同前缀吃缓存),审阅标记与规则在其后
	expect(sys.indexOf('【案例】张三 八字…')).toBe(0);
	expect(sys.indexOf(REVIEW_MARKER)).toBeGreaterThan(0);
	expect(buildReviewSystemPrompt({ snapshotSystem: '', hasData: false }).indexOf(REVIEW_MARKER)).toBe(0);
	expect(sys).toContain('ungrounded');
	expect(sys).toContain('1. 日主应为甲木');
	expect(sys).toContain('2. 大运起运岁数不符');
	expect(sys.indexOf('【以上为排盘数据与规则')).toBeLessThan(sys.indexOf('【程序核对'));   // [Q-290/PP-19] 挂载数据前置
	expect(buildReviewSystemPrompt({ snapshotSystem: '', hasData: false })).toContain('未挂载排盘数据');
	expect(buildReviewUserPrompt({ question: 'Q', answer: 'A' })).toContain('【待审阅的回答】');
});

it('🔴 审阅模型:review 路由槽优先;否则另一家族档案(有聊天模型);都没有 → 当前模型', ()=>{
	expect(pickReviewModel({ routes: { review: 'pc::ds' }, providerProfiles: [pA, pB, pC], profile: pA, model: 'gpt-x' })).toEqual({ profile: pC, model: 'ds', crossFamily: false, via: 'route' });
	const cross = pickReviewModel({ routes: {}, providerProfiles: [pA, pB], profile: pA, model: 'gpt-x' });
	expect(cross.profile).toBe(pB); expect(cross.model).toBe('claude-y'); expect(cross.crossFamily).toBe(true); expect(cross.via).toBe('cross-family');
	expect(pickReviewModel({ routes: {}, providerProfiles: [pA, pC], profile: pA, model: 'gpt-x' }).via).toBe('same');
	expect(pickReviewModel({ routes: {}, providerProfiles: [pA, { ...pB, enabled: false }], profile: pA, model: 'gpt-x' }).via).toBe('same');
});

it('parseReview:围栏/散文;kind 非法回落 ungrounded;severity 夹 1-3;无 reason 丢;超 12 截;verdict 与 issues 一致;坏文本 null;重写指令逐条;总评行', ()=>{
	const r = parseReview('```json\n{"verdict":"issues","issues":[{"kind":"error","quote":"日主乙木","reason":"应为甲木","severity":5},{"kind":"weird","quote":"","reason":"没依据","severity":0},{"kind":"omission","reason":""}],"summary":"两处"}\n```');
	expect(r.verdict).toBe('issues');
	expect(r.issues).toEqual([{ kind: 'error', quote: '日主乙木', reason: '应为甲木', severity: 3 }, { kind: 'ungrounded', quote: '', reason: '没依据', severity: 1 }]);
	expect(parseReview('{"verdict":"ok","issues":[],"summary":"好"}').verdict).toBe('ok');
	expect(parseReview('{"verdict":"ok","issues":[{"kind":"error","quote":"x","reason":"y","severity":2}]}').verdict).toBe('issues');
	expect(parseReview('nope')).toBe(null);
	const many = parseReview(JSON.stringify({ verdict: 'issues', issues: Array.from({ length: 20 }, (_, i)=>({ kind: 'error', quote: `q${i}`, reason: `r${i}`, severity: 1 })), summary: '' }));
	expect(many.issues.length).toBe(REVIEW_MAX_ISSUES);
	const d = buildRewriteDirective(r);
	expect(d.indexOf('【按审阅重写】')).toBe(0);
	expect(d).toContain('1. [错误·3]「日主乙木」:应为甲木');
	expect(buildRewriteDirective({ issues: [] })).toBe('');
	expect(reviewSummaryLine(r)).toContain('错误 1');
	expect(reviewSummaryLine({ verdict: 'ok', issues: [], summary: '好' })).toBe('审阅通过:好');
});

it('共享模块零业务管线 import(事实核对/一致性由调用方注入)', ()=>{
	const src = fs.readFileSync(path.resolve(__dirname, '..', 'aiReview.js'), 'utf8');
	expect(/reportFactCheck|reportConsistency|reportPipeline|ReportPane/.test(src)).toBe(false);
});

// ---- [压测二轮·D5·V1] 审阅判官返回「合法 JSON 但值全越界」:钳制 / 丢弃 / 上限,绝不把越界值原样交给重写指令 ----
it('V1 合法 JSON 越界:severity 9/-1 钳到 1..3、kind 未知回落 ungrounded、issues 50 条封 12、quote 5000 字截断、verdict "maybe" 按 issues 定', ()=>{
	const wild = {
		verdict: 'maybe',
		issues: [
			{ kind: 'error', quote: '甲', reason: '过高', severity: 9 },
			{ kind: 'error', quote: '乙', reason: '过低', severity: -1 },
			{ kind: 'nope', quote: '丙', reason: '未知类', severity: 2 },
			{ kind: 'error', quote: '长'.repeat(5000), reason: '超长引文', severity: 2 },
		].concat(Array.from({ length: 46 }, (_, i)=>({ kind: 'omission', quote: `q${i}`, reason: `r${i}`, severity: 2 }))),
		summary: '总'.repeat(1000),
	};
	const r = parseReview(JSON.stringify(wild));
	expect(r.issues.length).toBeLessThanOrEqual(REVIEW_MAX_ISSUES);
	expect(r.issues.every((it)=>it.severity >= 1 && it.severity <= 3)).toBe(true);
	expect(r.issues[0].severity).toBe(3);
	expect(r.issues[1].severity).toBe(1);
	expect(r.issues.every((it)=>['error', 'exaggeration', 'omission', 'ungrounded'].indexOf(it.kind) >= 0)).toBe(true);
	expect(r.issues[2].kind).toBe('ungrounded');
	expect(r.issues[3].quote.length).toBeLessThanOrEqual(120);
	expect(r.summary.length).toBeLessThanOrEqual(400);
	expect(r.verdict).toBe('issues');                       // 有批注 → issues(不认 "maybe")
	expect(parseReview('{"verdict":"maybe","issues":[]}').verdict).toBe('ok');   // 无批注 → ok
	// 重写指令只吃钳制后的值(不会把 severity 9 写进提示词)
	const d = buildRewriteDirective(r);
	expect(d).not.toContain('·9');
	expect(d).not.toContain('·-1');
	expect(d.split('\n').length).toBeLessThanOrEqual(REVIEW_MAX_ISSUES + 1);
});
