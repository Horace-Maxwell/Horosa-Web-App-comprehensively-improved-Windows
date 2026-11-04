// 决策层 · 校准指标与达标线合同:平衡准确率 / κ / 覆盖率 / 自动采纳错误率 / 误报率 各有判别向量(对的绿、错的红);
// 达标规则按类别(quality / precision / tighten / suggest;shadow 不设线);样本不足拒;runCalibration 走批量通道、按真实模型号落盘、失败只落该点。
import { computeMetrics, passRule, evaluatePoint, runCalibration, PASS_RULES, CALIBRATION_MIN_ITEMS } from '../systemOne/calibration';
import { getPoint } from '../systemOne/registry';
import { GOLDEN_SETS } from '../systemOne/golden';
import { readCalibration, __resetCalibrationStoreForTest } from '../systemOne/calibrationStore';
import { setSystemOneProfilePresent, __resetSystemOnePrefsForTest, isPointCalibrated } from '../systemOne/prefs';
import { __resetSystemOneClientForTest } from '../systemOne/client';
import * as svc from '../../services/aianalysis';
import * as integ from '../../integrations/systemOne';

jest.mock('../../services/aianalysis', ()=>({ ...jest.requireActual('../../services/aianalysis'), requestSystemOne: jest.fn() }));
jest.mock('../../integrations/systemOne', ()=>({ ...jest.requireActual('../../integrations/systemOne'), getSystemOneProfile: jest.fn(async ()=>({ id: 'systemone-default', kind: 'systemone', apiKey: 'k', baseUrl: '', model: 'jev-latest', enabled: true })) }));

beforeEach(()=>{ window.localStorage.clear(); __resetSystemOnePrefsForTest(); __resetCalibrationStoreForTest(); __resetSystemOneClientForTest(); svc.requestSystemOne.mockReset(); setSystemOneProfilePresent(true); });

describe('指标', ()=>{
	it('平衡准确率 = 各类召回均值(类别不均衡时与朴素准确率分离);κ 对偶然一致校正', ()=>{
		const rows = [];
		for(let i = 0; i < 90; i += 1){ rows.push({ pred: 'a', truth: 'a', adopted: true }); }
		for(let i = 0; i < 10; i += 1){ rows.push({ pred: 'a', truth: 'b', adopted: true }); }
		const m = computeMetrics(rows);
		expect(m.accuracy).toBeCloseTo(0.9, 9);
		expect(m.balancedAccuracy).toBeCloseTo(0.5, 9);   // b 类召回 0
		expect(m.kappa).toBeCloseTo(0, 9);
		expect(m.coverage).toBe(1);
		expect(m.adoptedErrorRate).toBeCloseTo(0.1, 9);
		const perfect = computeMetrics([{ pred: 1, truth: 1, adopted: true }, { pred: 2, truth: 2, adopted: false }]);
		expect(perfect.balancedAccuracy).toBe(1); expect(perfect.kappa).toBe(1); expect(perfect.coverage).toBe(0.5); expect(perfect.adoptedErrorRate).toBe(0);
	});
	it('误报率只看真值为负的样本;结构值按 JSON 比', ()=>{
		const m = computeMetrics([
			{ pred: 'suspect', truth: 'clean', positive: true, truthPositive: false },
			{ pred: 'clean', truth: 'clean', positive: false, truthPositive: false },
			{ pred: 'clean', truth: 'clean', positive: false, truthPositive: false },
			{ pred: 'clean', truth: 'clean', positive: false, truthPositive: false },
			{ pred: 'suspect', truth: 'suspect', positive: true, truthPositive: true },
		]);
		expect(m.falsePositiveRate).toBeCloseTo(0.25, 9);
		expect(computeMetrics([{ pred: { a: 1 }, truth: { a: 1 } }]).accuracy).toBe(1);
		expect(computeMetrics([]).n).toBe(0);
	});
	it('达标线:每类一绿一红;样本不足红;影子恒红(不设线)', ()=>{
		const good = { n: 40, balancedAccuracy: 0.9, adoptedErrorRate: 0.01, falsePositiveRate: 0, accuracy: 0.9 };
		expect(passRule('quality', good).passed).toBe(true);
		expect(passRule('quality', { ...good, balancedAccuracy: 0.8 }).passed).toBe(false);
		expect(passRule('precision', { ...good, adoptedErrorRate: 0.05 }).passed).toBe(false);
		expect(passRule('tighten', { n: 40, balancedAccuracy: 0.7, falsePositiveRate: 0.005 }).passed).toBe(true);
		expect(passRule('tighten', { n: 40, balancedAccuracy: 0.7, falsePositiveRate: 0.02 }).passed).toBe(false);
		expect(passRule('suggest', { n: 40, accuracy: 0.75 }).passed).toBe(true);
		expect(passRule('suggest', { n: 40, accuracy: 0.5 }).passed).toBe(false);
		expect(passRule('quality', { ...good, n: CALIBRATION_MIN_ITEMS - 1 }).passed).toBe(false);
		expect(passRule('shadow', good).passed).toBe(false);
		expect(PASS_RULES.quality.balancedAccuracyMin).toBe(0.85);
		expect(PASS_RULES.tighten.falsePositiveMax).toBe(0.01);
	});
});

describe('对一个点评分', ()=>{
	it('A2:全对的答案通过;恒定答案不过;请求失败只计 failed 不计入指标', ()=>{
		const A2 = getPoint('A2');
		const items = GOLDEN_SETS.A2;
		const oracle = items.map((it)=>({ ok: true, answers: { specific_case: { kind: 'noul', value: it.truth === 'release' ? 0.02 : 0.98, confidence: 0.96 } } }));
		const ev = evaluatePoint(A2, items, oracle);
		expect(ev.passed).toBe(true);
		expect(ev.metrics.n).toBe(items.length); expect(ev.metrics.balancedAccuracy).toBe(1); expect(ev.metrics.coverage).toBe(1);
		const constant = items.map(()=>({ ok: true, answers: { specific_case: { kind: 'noul', value: 0.98, confidence: 0.96 } } }));
		const bad = evaluatePoint(A2, items, constant);
		expect(bad.passed).toBe(false);
		expect(bad.metrics.balancedAccuracy).toBeCloseTo(0.5, 9);
		const half = items.map((it, i)=>(i % 2 ? { ok: false, reason: 'timeout' } : oracle[i]));
		const h = evaluatePoint(A2, items, half);
		expect(h.metrics.failed).toBe(Math.floor(items.length / 2));
		expect(h.metrics.n).toBe(items.length - h.metrics.failed);
	});
	it('B3(只加严):把 clean 判成 suspect 超过 1% 就红', ()=>{
		const B3 = getPoint('B3');
		const items = GOLDEN_SETS.B3;
		const answers = items.map((it)=>({ ok: true, answers: { injection: { kind: 'noul', value: it.truth === 'suspect' ? 0.97 : 0.03, confidence: 0.94 } } }));
		expect(evaluatePoint(B3, items, answers).passed).toBe(true);
		const firstClean = items.findIndex((it)=>it.truth === 'clean');
		answers[firstClean] = { ok: true, answers: { injection: { kind: 'noul', value: 0.97, confidence: 0.94 } } };
		const r = evaluatePoint(B3, items, answers);
		expect(r.passed).toBe(false);
		expect(r.reason).toContain('误报率');
	});
});

describe('runCalibration', ()=>{
	it('按点走批量通道、记录按回体真实模型号落盘;失败的点只落该点;进度回调 / 中止', async ()=>{
		svc.requestSystemOne.mockImplementation(async (v)=>({ Result: { ok: true, results: (v.batch || []).map((it)=>({ ok: true, status: 200, model: 'jev-2026-09-01', answers: Object.keys(it.questions).reduce((acc, name)=>{ const q = it.questions[name]; acc[name] = q.type === 'noul' ? { type: 'noul', noul: 0.97 } : (q.type === 'choice' ? { type: 'choice', choice: Object.keys(q.criteria)[0], probabilities: { [Object.keys(q.criteria)[0]]: 0.9 }, confidence: 0.9 } : { type: 'score', score: 0, probabilities: { '0': 1 }, legend: { '0': 'x' }, confidence: 0.9 }); return acc; }, {}), usage: { input_tokens: 3, output_tokens: 1 } })) } }));
		const seen = [];
		const rec = await runCalibration({ pointIds: ['A2', 'B1'], progress: (id, done, total)=>seen.push([id, done, total]) });
		expect(rec.model).toBe('jev-2026-09-01');
		expect(Object.keys(rec.points).sort()).toEqual(['A2', 'B1']);
		expect(rec.points.A2.passed).toBe(false);          // 恒定答案
		expect(rec.points.B1.reason).toBe('shadow');
		expect(seen[0]).toEqual(['A2', 0, 2]); expect(seen[seen.length - 1]).toEqual(['', 2, 2]);
		expect(readCalibration().model).toBe('jev-2026-09-01');
		expect(isPointCalibrated('A2')).toBe(false);
		const batches = svc.requestSystemOne.mock.calls.filter((c)=>c[0].batch).length;
		expect(batches).toBeGreaterThanOrEqual(Math.ceil(GOLDEN_SETS.A2.length / 16));
		const ctl = new AbortController(); ctl.abort();
		const rec2 = await runCalibration({ pointIds: ['A3'], signal: ctl.signal });
		expect(rec2.points.A3.reason).toBe('已中止');
		expect(rec2.points.A2.passed).toBe(false);        // 上次的其它点保留
	});
	it('通过的点 → isPointCalibrated 真;没有金标集的 id 落「没有金标集」', async ()=>{
		const truthByText = {}; GOLDEN_SETS.A2.forEach((it)=>{ truthByText[it.inputs.text] = it.truth; });
		svc.requestSystemOne.mockImplementation(async (v)=>({ Result: { ok: true, results: (v.batch || []).map((it)=>{ const truthRelease = truthByText[it.state.question] === 'release'; return { ok: true, status: 200, model: 'jev-x', answers: { specific_case: { type: 'noul', noul: truthRelease ? 0.02 : 0.98 } }, usage: {} }; }) } }));
		const rec = await runCalibration({ pointIds: ['A2'] });
		expect({ passed: rec.points.A2.passed, reason: rec.points.A2.reason }).toEqual({ passed: true, reason: '' });
		expect(isPointCalibrated('A2')).toBe(true);
	});
});
