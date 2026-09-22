// [挂载自检 F-28·P1] 合盘快照带两盘身份;挂载核对当前命主 ∈ {A,B},否则 missing(不喂无关合盘)。判别向量:去掉 relMatch 判断即第 2 例红。
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: {} })) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({ listLocalCases: jest.fn(() => []), getCaseTypeLabel: jest.fn((t) => t), getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })), CASE_TYPE_OPTIONS: [], __esModule: true }));
const snap = { current: null };
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => snap.current), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn() }));
jest.mock('../aiAnalysisStore', () => ({ AI_ANALYSIS_STORES: { contextCache: 'contextCache' }, getStoreRecord: jest.fn(async () => null), putStoreRecord: jest.fn(async (s, r) => r) }));
import fs from 'fs';
import path from 'path';
import { relativeSnapshotMatchesRecord, getAnalysisTechniqueContexts } from '../aiAnalysisContext';

const A = '1990-05-18 10:00:00', B = '1985-01-02 03:04:05', X = '2000-07-07 07:07:00';
const src = (birth)=>({ id: 'chart-x', sourceType: 'chart', record: { cid: 'x', name: 'X', birth, zone: '+08:00', lon: '118e27', lat: '31n38' } });

it('比对:命主是 A 或 B → true;都不是 → false;旧 meta 无身份/记录无生辰 → null', ()=>{
	const meta = { chartABirth: A, chartBBirth: B };
	expect(relativeSnapshotMatchesRecord(meta, { birth: A })).toBe(true);
	expect(relativeSnapshotMatchesRecord(meta, { birth: `${B.slice(0, 16)}:59` })).toBe(true);
	expect(relativeSnapshotMatchesRecord(meta, { birth: X })).toBe(false);
	expect(relativeSnapshotMatchesRecord({ chartA: '甲', chartB: '乙' }, { birth: X })).toBeNull();
	expect(relativeSnapshotMatchesRecord(meta, {})).toBeNull();
});

it('🔴 挂载:合盘快照两盘皆非当前命主 → missing+提示;是其一 → ready 原文', async ()=>{
	snap.current = { module: 'relative', content: '[合盘起盘信息]\n甲×乙 比较盘', meta: { relation: 'synastry', chartA: '甲', chartB: '乙', chartABirth: A, chartBBirth: B } };
	const [bad] = await getAnalysisTechniqueContexts(src(X), ['relative']);
	expect(bad.status).toBe('missing');
	expect(bad.content).toBe('');
	expect(bad.meta.mismatch).toBe('relative-parties');
	const [ok] = await getAnalysisTechniqueContexts(src(A), ['relative']);
	expect(ok.status).toBe('ready');
	expect(ok.content).toContain('甲×乙');
	// 旧快照(无身份)沿旧行为:照挂(用户/AI 自辨)
	snap.current = { module: 'relative', content: '[合盘起盘信息]\n旧', meta: { chartA: '甲', chartB: '乙' } };
	const [legacy] = await getAnalysisTechniqueContexts(src(X), ['relative']);
	expect(legacy.status).toBe('ready');
});

it('合盘页存快照带两盘出生时刻/时区(源码锚)', ()=>{
	const s = fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'astro', 'AstroRelative.js'), 'utf8');
	expect(s).toContain('chartABirth: recA ? `${recA.birth || \'\'}` : \'\'');
	expect(s).toContain('chartBBirth: recB ? `${recB.birth || \'\'}` : \'\'');
});
