// 决策层 · 闸与回落语义合同:总开关只认 '1' · pointOn 四道(总开关 ∧ 分开关 on ∧ 档案 ∧ 校准)· 影子不改行为 ·
// 超时 / 429 / 低置信度 / 未校准 / 模型号漂移 / 形状不认得 → 一律回落原路径且 decide 永不抛 · 关路径零 await(源码级断言每个接缝都是
// `pointOn(id) ? await decide(id, …) : null`)· 只加严类(B2)只升不降 · 客户端缓存 / 在途去重 / 永不抛。
const fs = require('fs');
const path = require('path');
import * as prefs from '../systemOne/prefs';
import { setSystemOneEnabled, setPointMode, setThresholds, pointOn, pointShadow, isSystemOneEnabled, setSystemOneProfilePresent, __resetSystemOnePrefsForTest, SYSTEMONE_ENABLED_KEY } from '../systemOne/prefs';
import { __setCalibrationForTest, __resetCalibrationStoreForTest, noteResponseModel, readCalibration } from '../systemOne/calibrationStore';
import { decide, shadowDecide, tierOf, sameValue, DEFAULT_TIER_THRESHOLDS } from '../systemOne/gate';
import { callSystemOne, callSystemOneBatch, __resetSystemOneClientForTest, TIMEOUT_INTERACTIVE_MS, TIMEOUT_BACKGROUND_MS } from '../systemOne/client';
import { listDecisions, __resetSystemOneLogForTest, readStats } from '../systemOne/log';
import { getPoint, listPoints } from '../systemOne/registry';
import * as svc from '../../services/aianalysis';
import * as integ from '../../integrations/systemOne';

jest.mock('../../services/aianalysis', ()=>({ ...jest.requireActual('../../services/aianalysis'), requestSystemOne: jest.fn() }));
jest.mock('../../integrations/systemOne', ()=>({ ...jest.requireActual('../../integrations/systemOne'), getSystemOneProfile: jest.fn() }));

const PROFILE = { id: 'systemone-default', kind: 'systemone', apiKey: 'k', baseUrl: '', model: 'jev-latest', enabled: true };
const okBody = (p, model = 'jev-2026')=>({ Result: { ok: true, status: 200, model, answers: { specific_case: { type: 'noul', noul: p } }, usage: { input_tokens: 10, output_tokens: 1 } } });

function armed(pointId){
	setSystemOneEnabled(true);
	setPointMode(pointId, 'on');
	setSystemOneProfilePresent(true);
	__setCalibrationForTest('jev-2026', [pointId]);
}

beforeEach(()=>{
	window.localStorage.clear();
	__resetSystemOnePrefsForTest(); __resetCalibrationStoreForTest(); __resetSystemOneClientForTest(); __resetSystemOneLogForTest();
	svc.requestSystemOne.mockReset();
	integ.getSystemOneProfile.mockReset();
	integ.getSystemOneProfile.mockImplementation(async ()=>{ setSystemOneProfilePresent(true); return PROFILE; });
	// calibrationStore 装载时把校准判定注入 prefs;重置 prefs 后要重新装一次(与真实装载顺序等价)
	__setCalibrationForTest('jev-2026', []);
});

describe('开关判据', ()=>{
	it('总开关只认字符串 "1";分开关 / 档案 / 校准 任一缺 → pointOn 假', ()=>{
		['true', 'on', '01', '1 ', 'yes'].forEach((v)=>{ window.localStorage.setItem(SYSTEMONE_ENABLED_KEY, v); expect(isSystemOneEnabled()).toBe(false); });
		window.localStorage.setItem(SYSTEMONE_ENABLED_KEY, '1'); expect(isSystemOneEnabled()).toBe(true);
		setPointMode('A2', 'on'); setSystemOneProfilePresent(true);
		expect(pointOn('A2')).toBe(false);                       // 未校准
		__setCalibrationForTest('jev-2026', ['A2']);
		expect(pointOn('A2')).toBe(true);
		setSystemOneProfilePresent(false); expect(pointOn('A2')).toBe(false);
		setSystemOneProfilePresent(true); setPointMode('A2', 'shadow'); expect(pointOn('A2')).toBe(false); expect(pointShadow('A2')).toBe(true);
		setSystemOneEnabled(false); expect(pointShadow('A2')).toBe(false);
	});
	it('模型号漂移 → 所有点视为未校准;清漂移后恢复', ()=>{
		armed('A2');
		expect(pointOn('A2')).toBe(true);
		expect(noteResponseModel('jev-2027')).toEqual(expect.objectContaining({ drift: true }));
		expect(readCalibration().drift).toBe('jev-2027');
		expect(pointOn('A2')).toBe(false);
	});
	it('置信度三档;sameValue 结构相等', ()=>{
		expect(tierOf(0.9)).toBe('act'); expect(tierOf(0.7)).toBe('confirm'); expect(tierOf(0.1)).toBe('escalate'); expect(tierOf(NaN)).toBe('escalate');
		expect(tierOf(0.7, { act: 0.65 })).toBe('act');
		expect(DEFAULT_TIER_THRESHOLDS).toEqual({ act: 0.85, confirm: 0.6 });
		expect(sameValue({ a: [1] }, { a: [1] })).toBe(true); expect(sameValue('x', 'y')).toBe(false);
	});
});

describe('decide 的回落语义(永不抛)', ()=>{
	it('关路径:总开关关 → 回落且零请求;未知点 → 回落', async ()=>{
		const d = await decide('A2', { text: '什么是命宫', mounted: false });
		expect(d).toEqual(expect.objectContaining({ source: 'fallback', value: 'block', reason: 'off' }));
		expect(svc.requestSystemOne).not.toHaveBeenCalled();
		expect((await decide('ZZ9', {})).reason).toBe('unknown-point');
	});
	it('开路径:高置信度直接采纳;低置信度 → 回落但带 suggested;日志记「同 / 异」', async ()=>{
		armed('A2');
		svc.requestSystemOne.mockImplementationOnce(async ()=>okBody(0.02));
		const d = await decide('A2', { text: '什么是命宫', mounted: false });
		expect(d.source).toBe('systemone'); expect(d.value).toBe('release'); expect(d.tier).toBe('act'); expect(d.agree).toBe(false);
		__resetSystemOneClientForTest();
		svc.requestSystemOne.mockImplementationOnce(async ()=>okBody(0.4));   // |2p−1| = 0.2 → escalate
		const low = await decide('A2', { text: '什么是命宫 2', mounted: false });
		expect(low.source).toBe('fallback'); expect(low.value).toBe('block'); expect(low.suggested).toBe('block'); expect(low.reason).toBe('low-confidence');
		const log = listDecisions();
		expect(log.length).toBe(2);
		expect(log.map((r)=>r.source)).toEqual(['fallback', 'systemone']);
		expect(JSON.stringify(log)).not.toContain('什么是命宫');   // 日志不存 state 原文
	});
	it('超时 / 网络 / HTTP 失败 / 形状不认得 / 模型号漂移 → 回落且带原因', async ()=>{
		armed('A2');
		const inputs = { text: 'x', mounted: false };
		svc.requestSystemOne.mockImplementationOnce(async ()=>{ throw new Error('timeout'); });
		expect((await decide('A2', { ...inputs, text: 'a' })).reason).toBe('timeout');
		svc.requestSystemOne.mockImplementationOnce(async ()=>{ throw new Error('ECONNREFUSED'); });
		expect((await decide('A2', { ...inputs, text: 'b' })).reason).toBe('network');
		svc.requestSystemOne.mockImplementationOnce(async ()=>({ Result: { ok: false, status: 429, code: 'E_SYSTEMONE_HTTP' } }));
		const http = await decide('A2', { ...inputs, text: 'c' });
		expect(http.reason).toBe('http'); expect(http.source).toBe('fallback'); expect(http.value).toBe('block');
		svc.requestSystemOne.mockImplementationOnce(async ()=>({ Result: { ok: true, answers: { nope: { type: 'weird' } } } }));
		expect((await decide('A2', { ...inputs, text: 'd' })).reason).toBe('invalid');
		svc.requestSystemOne.mockImplementationOnce(async ()=>okBody(0.02, 'jev-2099'));
		const drift = await decide('A2', { ...inputs, text: 'e' });
		expect(drift.reason).toBe('drift'); expect(drift.source).toBe('fallback');
		expect(pointOn('A2')).toBe(false);
		expect(readStats().errors).toBe(4);
	});
	it('影子:分开关 shadow 才发请求、永远回 null、只记一致率', async ()=>{
		setSystemOneEnabled(true); setSystemOneProfilePresent(true); setPointMode('B1', 'shadow');
		svc.requestSystemOne.mockImplementationOnce(async ()=>({ Result: { ok: true, model: 'jev-2026', answers: { status: { type: 'choice', choice: 'done', probabilities: { done: 0.9, continue: 0.05, blocked: 0.05 }, confidence: 0.9 } }, usage: {} } }));
		expect(await shadowDecide('B1', { goal: 'g', reply: 'r', heuristic: 'done' })).toBe(null);
		expect(listDecisions()[0]).toEqual(expect.objectContaining({ source: 'shadow', agree: true }));
		setPointMode('B1', 'off');
		expect(await shadowDecide('B1', { goal: 'g', reply: 'r' })).toBe(null);
		expect(svc.requestSystemOne).toHaveBeenCalledTimes(1);
	});
	it('只加严 B2:任何答案下 ask 永不变 auto;auto 只在明显不符时变 ask', ()=>{
		const B2 = getPoint('B2');
		for(let p = 0; p <= 1.0001; p += 0.05){
			const out = B2.interpret({ matches: { kind: 'noul', value: p, confidence: Math.abs(2 * p - 1) } }, { ...B2.defaultThresholds });
			expect(['ask', 'auto']).toContain(out.value);
			if(p <= 0.1){ expect(out.value).toBe('ask'); } else { expect(out.value).toBe('auto'); }
		}
		expect(B2.fallback()).toBe('auto');
		expect(B2.isPositive('ask')).toBe(true);
	});
	it('阈值覆盖生效:把 act 抬到 0.99 后原本直接采纳的答案落到先确认', async ()=>{
		armed('A2');
		setThresholds('A2', { act: 0.99 });
		svc.requestSystemOne.mockImplementationOnce(async ()=>okBody(0.02));
		const d = await decide('A2', { text: 'x', mounted: false });
		expect(d.source).toBe('fallback'); expect(d.tier).toBe('confirm');
	});
});

describe('client:时限 / 缓存 / 在途去重 / 批量单项隔离 / 无档案', ()=>{
	it('无档案 → no-profile 且零请求', async ()=>{
		integ.getSystemOneProfile.mockImplementation(async ()=>{ setSystemOneProfilePresent(false); return null; });
		const r = await callSystemOne({ state: { a: 1 }, questions: { q: { type: 'noul', instructions: 'x' } } });
		expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'no-profile' }));
		expect(svc.requestSystemOne).not.toHaveBeenCalled();
	});
	it('交互 1500 ms / 后台 10000 ms 两档时限透传;同参命中缓存不重发;并发同参只发一次', async ()=>{
		expect(TIMEOUT_INTERACTIVE_MS).toBe(1500); expect(TIMEOUT_BACKGROUND_MS).toBe(10000);
		svc.requestSystemOne.mockImplementation(async ()=>okBody(0.9));
		const q = { q: { type: 'noul', instructions: 'x' } };
		const [a, b] = await Promise.all([callSystemOne({ state: { s: 1 }, questions: q, mode: 'interactive' }), callSystemOne({ state: { s: 1 }, questions: q, mode: 'interactive' })]);
		expect(a.ok && b.ok).toBe(true);
		expect(svc.requestSystemOne).toHaveBeenCalledTimes(1);
		expect(svc.requestSystemOne.mock.calls[0][0].timeoutMs).toBe(1500);
		expect(svc.requestSystemOne.mock.calls[0][0].maxRetries).toBe(0);
		const c = await callSystemOne({ state: { s: 1 }, questions: q, mode: 'background' });
		expect(c.cached).toBe(true);
		expect(svc.requestSystemOne).toHaveBeenCalledTimes(1);
		await callSystemOne({ state: { s: 2 }, questions: q, mode: 'background' });
		expect(svc.requestSystemOne.mock.calls[1][0].timeoutMs).toBe(10000);
		expect(svc.requestSystemOne.mock.calls[1][0].maxRetries).toBe(1);
	});
	it('批量:单项失败不拖垮整批,序不乱;≤ 16 项一批;非法项本地拒', async ()=>{
		svc.requestSystemOne.mockImplementation(async (v)=>({ Result: { ok: true, results: v.batch.map((it, i)=>(i === 1 ? { ok: false, status: 500, code: 'E_SYSTEMONE_HTTP' } : { ok: true, status: 200, model: 'jev-2026', answers: { q: { type: 'noul', noul: 0.1 * (i + 1) } }, usage: { input_tokens: 2, output_tokens: 1 } })) } }));
		const q = { q: { type: 'noul', instructions: 'x' } };
		const items = []; for(let i = 0; i < 18; i += 1){ items.push({ state: { i }, questions: q }); }
		items.push({ state: null, questions: q });
		const r = await callSystemOneBatch(items, { mode: 'background' });
		expect(r.ok).toBe(true);
		expect(r.results.length).toBe(19);
		expect(svc.requestSystemOne).toHaveBeenCalledTimes(2);
		expect(svc.requestSystemOne.mock.calls[0][0].batch.length).toBe(16);
		expect(r.results[1]).toEqual(expect.objectContaining({ ok: false, reason: 'http', status: 500 }));
		expect(r.results[0].answers.q.value).toBeCloseTo(0.1, 9);
		expect(r.results[2].answers.q.value).toBeCloseTo(0.3, 9);
		expect(r.results[18]).toEqual(expect.objectContaining({ ok: false, reason: 'invalid' }));
	});
});

describe('关路径零 await(源码级)', ()=>{
	const UI = path.resolve(__dirname, '..', '..', '..');
	function walk(d, out){ fs.readdirSync(d).forEach((n)=>{ const f = path.join(d, n); if(n === 'node_modules' || n.startsWith('.')){ return; } if(fs.statSync(f).isDirectory()){ walk(f, out); } else if(/\.js$/.test(n) && !/\.test\.js$/.test(n)){ out.push(f); } }); return out; }
	it('🔴 除内核自身外,任何调用 decide( 的接缝都必须写成 `pointOn(…) ? await decide(…) : null`;稳定层组装器不 import systemOne', ()=>{
		const files = walk(path.join(UI, 'src'), []).filter((f)=>f.indexOf(`${path.sep}utils${path.sep}systemOne${path.sep}`) < 0);
		const offenders = [];
		files.forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			if(src.indexOf('decide(') < 0 || src.indexOf('systemOne') < 0){ return; }
			const lines = src.split('\n');
			lines.forEach((line, i)=>{
				if(/\bdecide\(/.test(line) && !/pointOn\([^)]*\)\s*\?\s*await\s+decide\(/.test(line) && !/^\s*(\/\/|\*|import)/.test(line)){ offenders.push(`${path.relative(UI, f)}:${i + 1}`); }
			});
		});
		expect(offenders).toEqual([]);
		['src/utils/aiAnalysisRag.js', 'src/utils/aiAnalysisContext.js', 'src/utils/aiChat/promptLayers.js'].forEach((rel)=>{
			const f = path.join(UI, rel);
			if(fs.existsSync(f)){ expect({ file: rel, importsSystemOne: /systemOne/.test(fs.readFileSync(f, 'utf8')) }).toEqual({ file: rel, importsSystemOne: false }); }
		});
	});
	it('prefs 零 IO 依赖(不 import IndexedDB 层);pointOn 是同步函数', ()=>{
		const src = fs.readFileSync(path.join(UI, 'src', 'utils', 'systemOne', 'prefs.js'), 'utf8');
		expect(src).not.toMatch(/aiAnalysisStore|indexedDB|fetch\(/);
		expect(prefs.pointOn.constructor.name).toBe('Function');
		expect(listPoints().length).toBeGreaterThanOrEqual(13);
	});
});
