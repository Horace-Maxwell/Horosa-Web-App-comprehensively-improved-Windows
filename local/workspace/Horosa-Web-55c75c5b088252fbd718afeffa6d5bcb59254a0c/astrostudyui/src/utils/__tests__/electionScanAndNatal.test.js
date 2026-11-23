// 择日挂载的本命合参(natalRecordId)与危象日(crisisDate)经同一核 runElectionForRecord 生效;
// scan_election_moments 候选窗与择日盘页同口径(当日 6–22 点 / 14 日同时刻),逐个打分排名。
jest.mock('../aiAnalysisSources', ()=>{
	const actual = jest.requireActual('../aiAnalysisSources');
	return { __esModule: true, ...actual, findAnalysisSourceById: (id)=>(id === 'chart-1' ? { id, sourceType: 'chart', record: { cid: id, birth: '1990-06-15 08:30:00', zone: '+08:00', lat: '39n54', lon: '116e23' } } : actual.findAnalysisSourceById(id)) };
});
import { buildMockResult } from '../../divination/election/__tests__/electionFixture';
import { runElectionForRecord, regenerateElectionSnapshot } from '../aiAnalysisContext/regenHoraryElection';
import { electionScanCandidates } from '../aiTools/tools/scanElectionMoments';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';

const rec = { cid: 'c1', divTime: '2026-11-20 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23' };

test('候选窗:hours = 当日 6..22 整点 17 个;days = 14 日同一时刻(跨月正确)', ()=>{
	const h = electionScanCandidates('2026-11-20 10:30:00', 'hours');
	expect(h.length).toBe(17);
	expect([h[0].time, h[16].time]).toEqual(['2026-11-20 06:00:00', '2026-11-20 22:00:00']);
	const d = electionScanCandidates('2026-11-25 10:30:00', 'days');
	expect(d.length).toBe(14);
	expect([d[0].time, d[6].time, d[13].time]).toEqual(['2026-11-25 10:30:00', '2026-12-01 10:30:00', '2026-12-08 10:30:00']);
	expect(electionScanCandidates('bad', 'hours')).toEqual([]);
});

test('挂载 schema:crisisDate 只在手术 / 用药显示;natalRecordId 缺省空', ()=>{
	const f = (getTechniqueSettingsSchema('election') || {}).fields || [];
	const c = f.find((x)=>x.name === 'crisisDate');
	expect(c.showWhen({ topicId: 'surgery' }) && c.showWhen({ topicId: 'medication' })).toBe(true);
	expect(c.showWhen({ topicId: 'marriage' })).toBe(false);
	expect(f.find((x)=>x.name === 'natalRecordId').default).toBe('');
});

test('🔴 本命合参:给命盘 id → 按择日盘同一口径起本命盘并作 runElection 第三参;不给 = 不起本命盘', async ()=>{
	const calls = [];
	const fetchChartResult = async (r)=>{ calls.push(r); return buildMockResult(); };
	const a = await runElectionForRecord(rec, { topicId: 'marriage', hsys: 3 }, { fetchChartResult });
	expect(a.natal).toBe(false);
	expect(calls.length).toBe(1);
	calls.length = 0;
	const b = await runElectionForRecord(rec, { topicId: 'marriage', hsys: 3, natalRecordId: 'chart-1' }, { fetchChartResult });
	expect(b.natal).toBe(true);
	expect(calls.length).toBe(2);
	expect(calls[1].birth).toBe('1990-06-15 08:30:00');
	expect(Number(calls[1].hsys)).toBe(3);   // 本命盘与择日盘同一宫制
	expect(b.report.natal && b.report.natal.available).toBe(true);
	const none = await runElectionForRecord(rec, { natalRecordId: 'nope' }, { fetchChartResult });
	expect(none.natal).toBe(false);   // 找不到按无本命判,不报错
});

test('🔴 危象日:给病始日期 → 同地点当日正午起盘取月黄经;日期格式不对 = 随存档', async ()=>{
	const calls = [];
	const fetchChartResult = async (r)=>{ calls.push(r); return buildMockResult(); };
	const r = await runElectionForRecord(rec, { topicId: 'surgery', crisisDate: '2026-11-10' }, { fetchChartResult });
	expect(calls.map((c)=>c.birth)).toContain('2026-11-10 12:00:00');
	expect(r.report.crisis && r.report.crisis.baseDate).toBe('2026-11-10');
	calls.length = 0;
	await runElectionForRecord(rec, { topicId: 'surgery', crisisDate: '11/10' }, { fetchChartResult });
	expect(calls.length).toBe(1);
});

test('快照入口仍是同一核(起不了盘回空串)', async ()=>{
	expect(typeof regenerateElectionSnapshot).toBe('function');
	expect(await runElectionForRecord(rec, {}, { fetchChartResult: async ()=>null })).toBe(null);
});
