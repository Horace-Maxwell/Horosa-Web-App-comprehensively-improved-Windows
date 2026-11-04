// 决策层 · 资料片段重排 + 注入预筛合同:一段一请求(走批量)、按相关概率排序、注入 ≥ 0.9 剔除并列出、任一失败整批回 { ok:false }(调用方走原算法)、
// 入 ≤ 12 段、片段截 2000 字、收 signal;稳定层组装器不 import 本模块。
const fs = require('fs');
const path = require('path');
import { rerankPassages, rerankQuestions, rerankState, RERANK_MAX_ITEMS, RERANK_PASSAGE_MAX_CHARS, RERANK_DEFAULTS } from '../systemOne/rerank';
import { validateQuestions } from '../systemOne/questions';
import { setSystemOneProfilePresent, __resetSystemOnePrefsForTest } from '../systemOne/prefs';
import { __resetSystemOneClientForTest } from '../systemOne/client';
import * as svc from '../../services/aianalysis';

jest.mock('../../services/aianalysis', ()=>({ ...jest.requireActual('../../services/aianalysis'), requestSystemOne: jest.fn() }));
jest.mock('../../integrations/systemOne', ()=>({ ...jest.requireActual('../../integrations/systemOne'), getSystemOneProfile: jest.fn(async ()=>({ id: 'systemone-default', kind: 'systemone', apiKey: 'k', baseUrl: '', model: 'jev-latest', enabled: true })) }));

beforeEach(()=>{ window.localStorage.clear(); __resetSystemOnePrefsForTest(); __resetSystemOneClientForTest(); svc.requestSystemOne.mockReset(); setSystemOneProfilePresent(true); });

function upstream(scores){
	svc.requestSystemOne.mockImplementation(async (v)=>({ Result: { ok: true, results: v.batch.map((it)=>{ const s = scores[it.state.passage] || { r: 0.5, j: 0 }; return s.fail ? { ok: false, status: 500 } : { ok: true, status: 200, model: 'jev-x', answers: { relevant: { type: 'noul', noul: s.r }, injection: { type: 'noul', noul: s.j } }, usage: {} }; }) } }));
}

it('两问合法;state 截 2000 字', ()=>{
	expect(validateQuestions(rerankQuestions()).ok).toBe(true);
	expect(rerankState('q', 'x'.repeat(5000)).passage.length).toBe(RERANK_PASSAGE_MAX_CHARS);
	expect(RERANK_MAX_ITEMS).toBe(12); expect(RERANK_DEFAULTS.injectionDrop).toBe(0.9);
});

it('按相关概率降序;注入 ≥ 0.9 剔除并列出;原对象带回;空入空出零请求', async ()=>{
	upstream({ p1: { r: 0.2, j: 0.1 }, p2: { r: 0.9, j: 0.2 }, p3: { r: 0.7, j: 0.95 }, p4: { r: 0.7, j: 0.5 } });
	const r = await rerankPassages({ query: 'q', passages: [{ text: 'p1', id: 1 }, { text: 'p2', id: 2 }, { text: 'p3', id: 3 }, { text: 'p4', id: 4 }] });
	expect(r.ok).toBe(true);
	expect(r.ranked.map((x)=>x.item.id)).toEqual([2, 4, 1]);
	expect(r.dropped.map((x)=>x.item.id)).toEqual([3]);
	expect(r.ranked[0].relevance).toBe(0.9);
	expect(svc.requestSystemOne).toHaveBeenCalledTimes(1);
	expect(svc.requestSystemOne.mock.calls[0][0].batch.length).toBe(4);
	expect(await rerankPassages({ query: 'q', passages: [] })).toEqual({ ok: true, ranked: [], dropped: [], model: '', latencyMs: 0 });
	expect(svc.requestSystemOne).toHaveBeenCalledTimes(1);
});

it('任一段失败 → 整批 { ok:false }(调用方走原算法);入段超过 12 只取前 12;纯字符串片段也行', async ()=>{
	upstream({ a: { r: 0.5, j: 0 }, b: { fail: true } });
	const r = await rerankPassages({ query: 'q', passages: ['a', 'b'] });
	expect(r.ok).toBe(false);
	upstream({});
	const many = []; for(let i = 0; i < 20; i += 1){ many.push(`s${i}`); }
	const r2 = await rerankPassages({ query: 'q', passages: many });
	expect(r2.ok).toBe(true);
	expect(r2.ranked.length + r2.dropped.length).toBe(RERANK_MAX_ITEMS);
});

it('signal 已中止 → 不发请求、回 { ok:false }', async ()=>{
	upstream({});
	const ctl = new AbortController(); ctl.abort();
	const r = await rerankPassages({ query: 'q', passages: ['a'], signal: ctl.signal });
	expect(r.ok).toBe(false);
	expect(svc.requestSystemOne).not.toHaveBeenCalled();
});

it('🔴 稳定层组装器(aiAnalysisRag / 提示层)不 import rerank', ()=>{
	const UI = path.resolve(__dirname, '..', '..', '..');
	['src/utils/aiAnalysisRag.js', 'src/utils/aiChat/promptLayers.js', 'src/utils/aiAnalysisContext.js'].forEach((rel)=>{
		const f = path.join(UI, rel);
		if(fs.existsSync(f)){ expect({ file: rel, imports: /systemOne\/rerank/.test(fs.readFileSync(f, 'utf8')) }).toEqual({ file: rel, imports: false }); }
	});
});
