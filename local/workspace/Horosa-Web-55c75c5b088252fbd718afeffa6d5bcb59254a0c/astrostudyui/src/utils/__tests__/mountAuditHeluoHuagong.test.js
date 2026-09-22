// [挂载自检 F-18·P0] 河洛无头 [命运篇] 化工按真实节气(与河洛页 solarTermHuagong 同源),不再走月支近似 MONTH_HG。
// 判别向量:把 buildHeluoSnapshotForRecord 的 st 改回 null 即第 2 例红(挑的是节气象限≠月支近似的日期)。
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => { throw new Error('offline'); }) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({ listLocalCases: jest.fn(() => []), getCaseTypeLabel: jest.fn((t) => t), getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })), CASE_TYPE_OPTIONS: [], __esModule: true }));
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn() }));
import { regenerateChartTechniqueSnapshot, heluoSolarTermForDate } from '../aiAnalysisContext';

const rec = (birth)=>({ cid: 'c', name: 'QA', birth, zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 });
const MONTH_HG = { 卯: ['震'], 辰: ['震'], 午: ['離'], 未: ['離'], 酉: ['兌'], 戌: ['兌'], 子: ['坎'], 丑: ['坎'], 寅: ['坤', '艮'], 巳: ['坤', '艮'], 申: ['坤', '艮'], 亥: ['坤', '艮'] };
const huagongLine = (txt)=>`${txt}`.split('\n').find((l)=>l.startsWith('化工 ')) || '';

it('节气化工函数对合法日期有值,含 hg 候选', ()=>{
	const st = heluoSolarTermForDate('1990-05-18', 'tuWangKunGen');
	expect(st && Array.isArray(st.hg) && st.hg.length).toBeTruthy();
	expect(heluoSolarTermForDate('', 'tuWangKunGen')).toBeNull();
});

it('🔴 无头 [命运篇] 化工 = 真实节气化工(1990-05-18:月支巳 → 月支近似给 坤/艮,真实节气(立夏后)给 震)', async ()=>{
	const st = heluoSolarTermForDate('1990-05-18', 'tuWangKunGen');
	expect(st.hg).toEqual(['震']);
	const txt = await regenerateChartTechniqueSnapshot(rec('1990-05-18 10:00:00'), 'heluo');
	const line = huagongLine(txt);
	expect(line).toContain('化工 震');
	expect(line).not.toContain('化工 坤/艮');   // MONTH_HG[巳] 近似值 —— 退化版会打出它
	// 再验一个不同象限的日期:9 月中(白露后)→ 離
	const st2 = heluoSolarTermForDate('1990-09-15', 'tuWangKunGen');
	expect(st2.hg).toEqual(['離']);
	const txt2 = await regenerateChartTechniqueSnapshot(rec('1990-09-15 10:00:00'), 'heluo');
	expect(huagongLine(txt2)).toContain('化工 離');
});
