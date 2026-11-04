// 决策层 · 线格式合同:请求形状与上限(64k / 32k / choice ≤ 255 / score 2–10 / 单项 ≤ 512 KB)· 三种答案归一(noul 自定义置信度 |2p−1|;
// score 的 probabilities / legend 键是层级下标串 → levels 数组;缺 choice / confidence 的防御)· 价格常数单源 · 与钉死的官方 schema 同形。
const fs = require('fs');
const path = require('path');
import { noul, choice, score, validateQuestions, estimateTokens, CHOICE_MAX, SCORE_MAX } from '../systemOne/questions';
import { buildRequest, normalizeAnswer, normalizeResponse, estimateCostUsd, normalizeModelName, SYSTEMONE_LIMITS, SYSTEMONE_PRICE_USD_PER_MTOK_INPUT, SYSTEMONE_ENDPOINT_PATH, SYSTEMONE_DEFAULT_BASE_URL } from '../systemOne/wire';

const SCHEMA = path.resolve(__dirname, '..', '..', '..', '..', '..', 'Horosa_Desktop_Installer', 'scripts', 'l5', 'schemas', 'typesafe.systemone.json');

describe('问题构造与校验', ()=>{
	it('noul 判据必须 true / false 两侧都有;choice ≥ 2 且 ≤ 255;score 2–10 级;未知类型拒', ()=>{
		expect(validateQuestions({ q: noul('Is `x` short?') }).ok).toBe(true);
		expect(validateQuestions({ q: noul('Is `x` short?', { true: 'yes' }) }).ok).toBe(false);
		expect(validateQuestions({ q: noul('Is `x` short?', { true: 'yes', false: 'no' }) }).ok).toBe(true);
		expect(validateQuestions({ q: choice('Pick', { a: { what: 'A' } }) }).ok).toBe(false);
		const many = {}; for(let i = 0; i < CHOICE_MAX + 1; i += 1){ many[`o${i}`] = null; }
		expect(validateQuestions({ q: choice('Pick', many) }).ok).toBe(false);
		expect(validateQuestions({ q: score('Rate', ['a']) }).ok).toBe(false);
		expect(validateQuestions({ q: score('Rate', new Array(SCORE_MAX + 1).fill('l')) }).ok).toBe(false);
		expect(validateQuestions({ q: score('Rate', ['low', 'high']) }).ok).toBe(true);
		expect(validateQuestions({ q: { type: 'essay', instructions: 'write' } }).ok).toBe(false);
		expect(validateQuestions({}).ok).toBe(false);
		expect(validateQuestions([]).ok).toBe(false);
	});
	it('token 粗估:中文按字、其它按 4 字符', ()=>{
		expect(estimateTokens('abcd')).toBe(1);
		expect(estimateTokens('命宫')).toBe(2);
		expect(estimateTokens({ a: '命宫' })).toBeGreaterThanOrEqual(3);
	});
});

describe('组请求', ()=>{
	it('模型别名只认 jev-*,其余回 jev-latest;state 空拒;超限拒(32k / 64k / 512 KB)', ()=>{
		expect(normalizeModelName('')).toBe('jev-latest');
		expect(normalizeModelName('gpt-4o')).toBe('jev-latest');
		expect(normalizeModelName('jev-preview')).toBe('jev-preview');
		expect(buildRequest({ state: null, questions: { q: noul('x') } }).ok).toBe(false);
		const ok = buildRequest({ state: { text: 'hi' }, questions: { q: noul('Is `text` short?') }, model: 'nope' });
		expect(ok.ok).toBe(true);
		expect(ok.request).toEqual({ state: { text: 'hi' }, model: 'jev-latest', questions: { q: { type: 'noul', instructions: 'Is `text` short?' } } });
		const big = '字'.repeat(SYSTEMONE_LIMITS.stateAndQuestionMaxTokens + 10);
		expect(buildRequest({ state: { text: big }, questions: { q: noul('x') } }).ok).toBe(false);
		const bytes = 'a'.repeat(SYSTEMONE_LIMITS.itemMaxBytes + 10);
		expect(buildRequest({ state: { text: bytes }, questions: { q: noul('x') } }).ok).toBe(false);
	});
	it('端点路径 / 官方基址 / 价格常数单源', ()=>{
		expect(SYSTEMONE_ENDPOINT_PATH).toBe('/v1/systemone');
		expect(SYSTEMONE_DEFAULT_BASE_URL).toBe('https://api.typesafe.ai');
		expect(SYSTEMONE_PRICE_USD_PER_MTOK_INPUT).toBe(0.042);
		expect(estimateCostUsd({ inputTokens: 1e6, outputTokens: 5e6 })).toBeCloseTo(0.042, 9);
		expect(estimateCostUsd(null)).toBe(0);
	});
});

describe('答案归一(官方回体形状 2026-09-22 核对)', ()=>{
	it('noul:{type,noul:p} → value p、confidence |2p−1|、probabilities 两侧', ()=>{
		expect(normalizeAnswer({ type: 'noul', noul: 0.9 })).toEqual({ kind: 'noul', value: 0.9, probabilities: { true: 0.9, false: 0.09999999999999998 }, confidence: 0.8 });
		expect(normalizeAnswer({ noul: 0.25 }).confidence).toBeCloseTo(0.5, 9);
		expect(normalizeAnswer({ type: 'noul', noul: 1.7 }).value).toBe(1);
		expect(normalizeAnswer({ type: 'noul' })).toBe(null);
	});
	it('choice:带 confidence 原样;缺 choice 取最大概率;缺 confidence 用 (n·pmax−1)/(n−1)', ()=>{
		expect(normalizeAnswer({ type: 'choice', choice: 'b', probabilities: { a: 0.2, b: 0.8 }, confidence: 0.77 })).toEqual({ kind: 'choice', value: 'b', probabilities: { a: 0.2, b: 0.8 }, confidence: 0.77 });
		expect(normalizeAnswer({ type: 'choice', probabilities: { a: 0.2, b: 0.8 } }).value).toBe('b');
		expect(normalizeAnswer({ type: 'choice', choice: 'a', probabilities: { a: 0.5, b: 0.3, c: 0.2 } }).confidence).toBeCloseTo((3 * 0.5 - 1) / 2, 9);
		expect(normalizeAnswer({ type: 'choice' })).toBe(null);
	});
	it('score:probabilities / legend 键 = 层级下标串 → levels 数组;缺 score 按概率加权', ()=>{
		const a = normalizeAnswer({ type: 'score', score: 2.3, probabilities: { '0': 0.1, '1': 0.2, '2': 0.7 }, legend: { '0': 'low', '1': 'mid', '2': 'high' }, confidence: 0.6 });
		expect(a.kind).toBe('score');
		expect(a.value).toBe(2.3);
		expect(a.levels).toEqual([{ index: 0, label: 'low', p: 0.1 }, { index: 1, label: 'mid', p: 0.2 }, { index: 2, label: 'high', p: 0.7 }]);
		expect(a.confidence).toBe(0.6);
		const b = normalizeAnswer({ type: 'score', probabilities: { '0': 0.5, '1': 0.5 } });
		expect(b.value).toBeCloseTo(0.5, 9);
		expect(normalizeAnswer({ type: 'score' })).toBe(null);
		expect(normalizeAnswer({ type: 'weird' })).toBe(null);
	});
	it('整份回体:answers 缺 / 空 / 形状不认得 → { ok:false };usage 缺项归零;model 原样', ()=>{
		expect(normalizeResponse(null).ok).toBe(false);
		expect(normalizeResponse({ answers: {} }).ok).toBe(false);
		expect(normalizeResponse({ answers: { q: { type: 'weird' } } }).ok).toBe(false);
		const r = normalizeResponse({ model: 'jev-2026-09-01', answers: { q: { type: 'noul', noul: 0.4 } }, usage: { input_tokens: 12 } });
		expect(r.ok).toBe(true);
		expect(r.model).toBe('jev-2026-09-01');
		expect(r.usage).toEqual({ inputTokens: 12, outputTokens: 0 });
		expect(r.answers.q.kind).toBe('noul');
	});
});

// 钉子文件随评测工具链一起提供;没有评测工具链的构建跳过本组(其余合同不变)
const describeSchema = fs.existsSync(SCHEMA) ? describe : describe.skip;
describeSchema('与钉死的官方 schema 同形', ()=>{
	it('钉子在位:请求三键 / 三种问题类型 / 三种答案类型 / usage 两键;buildRequest 产物满足 required', ()=>{
		expect(fs.existsSync(SCHEMA)).toBe(true);
		const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
		const defs = schema.definitions || {};
		expect(Object.keys(defs)).toEqual(expect.arrayContaining(['SystemOneRequest', 'Question', 'NoulQuestion', 'ChoiceQuestion', 'ScoreQuestion', 'SystemOneResponse', 'Answer', 'NoulAnswer', 'ChoiceAnswer', 'ScoreAnswer', 'Usage']));
		expect(defs.SystemOneRequest.required).toEqual(['state', 'model', 'questions']);
		expect(defs.NoulAnswer.required).toEqual(['type', 'noul']);
		expect(defs.ChoiceAnswer.required).toEqual(expect.arrayContaining(['type', 'choice', 'probabilities', 'confidence']));
		expect(defs.ScoreAnswer.required).toEqual(expect.arrayContaining(['type', 'score', 'probabilities', 'legend', 'confidence']));
		expect(defs.Usage.required).toEqual(['input_tokens', 'output_tokens']);
		expect(defs.ChoiceQuestion.properties.criteria.maxProperties).toBe(SYSTEMONE_LIMITS.choiceMax);
		expect(defs.ScoreQuestion.properties.criteria.minItems).toBe(SYSTEMONE_LIMITS.scoreMin);
		expect(defs.ScoreQuestion.properties.criteria.maxItems).toBe(SYSTEMONE_LIMITS.scoreMax);
		const built = buildRequest({ state: { text: 'hi' }, questions: { a: noul('x', { true: 't', false: 'f' }), b: choice('y', { p: { what: 'P' }, q: null }), c: score('z', ['l', 'h']) } });
		expect(built.ok).toBe(true);
		defs.SystemOneRequest.required.forEach((k)=>expect(built.request[k]).toBeDefined());
	});
});
