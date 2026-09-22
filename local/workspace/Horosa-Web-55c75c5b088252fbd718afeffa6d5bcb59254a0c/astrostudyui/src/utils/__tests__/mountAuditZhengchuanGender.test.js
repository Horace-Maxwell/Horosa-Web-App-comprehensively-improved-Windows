// [挂载自检 F-20·P0] 神数正传·心易:女命记录(gender 0)查女表(此前恒按男)。判别向量:改回 `=== 'Female'` 即红。
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => { throw new Error('offline'); }) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({ listLocalCases: jest.fn(() => []), getCaseTypeLabel: jest.fn((t) => t), getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })), CASE_TYPE_OPTIONS: [], __esModule: true }));
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn() }));
import { regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';
import { lookupXiang, XINYI_ITEMS, XINYI_SOUNDS_A } from '../zhengchuanXinyiLocal';

const base = { cid: 'c', name: 'QA', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, ad: 1,
	zcSchool: 'xinyi', zcItem: XINYI_ITEMS[0], zcSound: XINYI_SOUNDS_A[0], zcKe: '一刻', zcGong: '乾' };

it('🔴 女命(gender 0)与男命(gender 1)的心易查表结果不同(挑有 ●○/× 分标的条目),且女命快照=女表', async ()=>{
	// 找一个查表结果随性别不同的 (事项, 声音):分标 ●○(乾造)/×(坤造) 的条目
	let pick = null;
	XINYI_ITEMS.forEach((item)=>{ XINYI_SOUNDS_A.forEach((sound)=>{ if(pick){ return; } const m = lookupXiang(item, sound, 1), f = lookupXiang(item, sound, 0); if(m && f && JSON.stringify(m.picked) !== JSON.stringify(f.picked)){ pick = { item, sound, m, f }; } }); });
	expect(pick).toBeTruthy();
	const tM = await regenerateChartTechniqueSnapshot({ ...base, zcItem: pick.item, zcSound: pick.sound, gender: 1 }, 'zhengchuan');
	const tF = await regenerateChartTechniqueSnapshot({ ...base, zcItem: pick.item, zcSound: pick.sound, gender: 0 }, 'zhengchuan');
	expect(`${tM}`.length).toBeGreaterThan(0);
	expect(tM).not.toBe(tF);
	expect(`${tF}`).toContain('坤造');
	expect(`${tM}`).toContain('乾造');
	// '女'/'Female' 同样归女
	const tF2 = await regenerateChartTechniqueSnapshot({ ...base, zcItem: pick.item, zcSound: pick.sound, gender: 'Female' }, 'zhengchuan');
	expect(tF2).toBe(tF);
});

// [Q-284/T-276] 性别「未知(按男排)」gender=-1:心易查表与快照均按男(与八字本地引擎「0=女,其余=男」同口径;此前 `=== 1` 判男 → 未知当女命)。
it('未知性别(-1)的心易结果与快照 = 男命,不再当坤造', async ()=>{
	let pick = null;
	XINYI_ITEMS.forEach((item)=>{ XINYI_SOUNDS_A.forEach((sound)=>{ if(pick){ return; } const m = lookupXiang(item, sound, 1), f = lookupXiang(item, sound, 0); if(m && f && JSON.stringify(m.picked) !== JSON.stringify(f.picked)){ pick = { item, sound }; } }); });
	expect(pick).toBeTruthy();
	expect(JSON.stringify(lookupXiang(pick.item, pick.sound, -1).picked)).toBe(JSON.stringify(lookupXiang(pick.item, pick.sound, 1).picked));
	const tM = await regenerateChartTechniqueSnapshot({ ...base, zcItem: pick.item, zcSound: pick.sound, gender: 1 }, 'zhengchuan');
	const tU = await regenerateChartTechniqueSnapshot({ ...base, zcItem: pick.item, zcSound: pick.sound, gender: -1 }, 'zhengchuan');
	expect(`${tU}`).toContain('乾造');
	expect(tU).toBe(tM);
});
