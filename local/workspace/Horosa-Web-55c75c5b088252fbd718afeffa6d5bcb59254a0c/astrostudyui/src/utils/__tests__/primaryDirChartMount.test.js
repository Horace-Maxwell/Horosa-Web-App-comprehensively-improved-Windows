// 批B P5 主限法盘/表格拆分 round-trip：
//  - primarydirchart(盘) 接 record.datetime → 出真盘快照 [主限法盘设置] 段（时间选择/推运方法/向运方向/当前Arc），
//    不再 fallthrough 到表格 builder（修原盘喂表格 Bug）。
//  - primarydirect(表格) 仍走 buildPrimaryDirectSnapshotText（占位 mock 验证不混用）。
const mockFetchChartCalls = [];
jest.mock('../../services/astro', () => ({
	__esModule: true,
	fetchChart: jest.fn(async (values) => {
		mockFetchChartCalls.push(values);
		return {
			Result: {
				chart: { objects: [], stars: [] },
				lots: [],
				params: {
					birth: '1990-05-18 10:00:00',
					zone: '+08:00',
					lon: '118e27',
					lat: '31n38',
					ad: 1,
				},
				predictives: { primaryDirection: [] },
			},
		};
	}),
}));

// 表格 builder 给固定 marker（盘若误用它即可被测出来）。
jest.mock('../../components/direction/AstroDirectMain', () => ({
	buildPrimaryDirectSnapshotText: jest.fn(() => '主限法表格快照(占位)'),
	buildFirdariaSnapshotText: jest.fn(() => ''),
}));

jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({
	listLocalCases: jest.fn(() => []),
	getCaseTypeLabel: jest.fn((t) => t),
	getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })),
	__esModule: true,
}));
jest.mock('../astroAiSnapshot', () => ({
	buildAstroSnapshotContent: jest.fn(() => 'snapshot'),
	loadAstroAISnapshot: jest.fn(() => null),
	// [审计修] 盘无头补全后消费的两条 line-builder(缺则产线 typeof 守卫回 [],此处给正锚)。
	buildStarAndLotPositionLines: jest.fn(() => ['太阳 白羊 10.00°']),
	buildHouseCuspLines: jest.fn(() => ['1宫 白羊 0.00°']),
}));
jest.mock('../moduleAiSnapshot', () => ({
	loadModuleAISnapshot: jest.fn(() => null),
	saveModuleAISnapshot: jest.fn(),
}));
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: {} })) }));
jest.mock('../aiAnalysisStore', () => ({
	AI_ANALYSIS_STORES: { contextCache: 'contextCache' },
	getStoreRecord: jest.fn(async () => null),
	putStoreRecord: jest.fn(async (s, r) => r),
}));

import { getAnalysisTechniqueContextWithOptions } from '../aiAnalysisContext';

const SOURCE = {
	id: 'chart-pdc',
	sourceType: 'chart',
	record: {
		cid: 'chart-pdc',
		name: 'pd chart 测试',
		birth: '1990-05-18 10:00:00',
		zone: '+08:00',
		lon: '118e27',
		lat: '31n38',
	},
};

describe('P5 主限法盘 primarydirchart round-trip', () => {
	beforeEach(() => {
		mockFetchChartCalls.length = 0;
	});

	it('盘接 record.datetime → 出真盘快照 [主限法盘设置]（含所选时间/向运方向），非表格占位', async () => {
		const ctx = await getAnalysisTechniqueContextWithOptions(SOURCE, 'primarydirchart', {
			datetime: '2025-06-05 10:00',
			direction: 'converse',
		});
		expect(ctx).toBeTruthy();
		expect(ctx.content).toContain('[主限法盘设置]');
		expect(ctx.content).toContain('2025-06-05 10:00:00'); // 所选时间换算后回显
		expect(ctx.content).toContain('逆向 Converse');       // direction 透传
		expect(ctx.content).toContain('当前Arc');
		// [审计修] 盘体补全:本命段带星/宫行(此前无头快照零盘体,AI 拿不到任何星曜宫位)。
		expect(ctx.content).toContain('[本命盘配置]');
		expect(ctx.content).toContain('太阳 白羊 10.00°');
		expect(ctx.content).toContain('[主限法盘配置]');
		// 不应误用表格 builder 的占位串。
		expect(ctx.content).not.toContain('主限法表格快照(占位)');
	});

	it('盘空 datetime（仅改方位法）→ 仍出盘快照、时间取「此刻」（不破现状路径）', async () => {
		const ctx = await getAnalysisTechniqueContextWithOptions(SOURCE, 'primarydirchart', {
			pdMethod: 'meridian',
		});
		expect(ctx).toBeTruthy();
		expect(ctx.content).toContain('[主限法盘设置]');
		expect(ctx.content).not.toContain('主限法表格快照(占位)');
	});

	it('盘 fetch 不带 includePrimaryDirection（盘快照纯文本算 arc，不需 predictives）', async () => {
		await getAnalysisTechniqueContextWithOptions(SOURCE, 'primarydirchart', { datetime: '2025-06-05 10:00' });
		// 盘走轻量 fetchChartResultForRecord(record)（无 includePrimaryDirection 标志）。
		const withPd = mockFetchChartCalls.find((v) => v && v.includePrimaryDirection === true);
		expect(withPd).toBeFalsy();
	});

	it('表格 primarydirect 改 pdYears → 仍走表格 builder（占位串），且 /chart 带 includePrimaryDirection', async () => {
		const ctx = await getAnalysisTechniqueContextWithOptions(SOURCE, 'primarydirect', { pdYears: 50 });
		expect(ctx).toBeTruthy();
		expect(ctx.content).toContain('主限法表格快照(占位)');
		const withPd = mockFetchChartCalls.find((v) => v && v.includePrimaryDirection === true);
		expect(withPd).toBeTruthy();
		expect(withPd.pdYears).toBe(50);
	});
});
