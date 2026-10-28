// 「新盘种子」收在写共用字段的口子上:主页 changeCond / 合盘子盘 onChange 把这次真写进去的种子键(宫制 / 黄道 / 岁差 …)
// 记作新命盘缺省 —— 此前合盘子盘、希腊 · 十二分盘流派预设、3D、汉堡中点改了共用字段却不记,重开又回到旧种子。
// AI 助手改当前盘口径 / 撤销(fromAgent)与程序回写(programmatic)不记。
const seeds = require('../newChartSeeds');

beforeEach(()=>{ window.localStorage.clear(); seeds.__resetNewChartSeedsForTest(); });

const F = (o)=>Object.fromEntries(Object.entries(o).map(([k, v])=>[k, { name: [k], value: v }]));

test('只记真写进去的种子键;值等于内建默认 = 撤掉;非种子键不记', ()=>{
	const prev = F({ hsys: 1, zodiacal: 0, termsVariant: 0 });
	const next = { ...prev, hsys: { name: ['hsys'], value: 0 }, termsVariant: { name: ['termsVariant'], value: 2 } };
	expect(seeds.recordSeedsForFieldWrite(prev, next, {})).toEqual(['hsys']);
	expect(seeds.newChartSeedValue('hsys')).toBe(0);
	expect(seeds.recordSeedsForFieldWrite(next, { ...next, hsys: { name: ['hsys'], value: 1 } }, {})).toEqual(['hsys']);
	expect(seeds.newChartSeedOverrides()).toEqual({});
	expect(seeds.recordSeedsForFieldWrite(prev, prev, {})).toEqual([]);   // 同一 entry = 没写
});

test('🔴 AI 改动 / 程序回写不记', ()=>{
	const prev = F({ hsys: 1 });
	const next = { hsys: { name: ['hsys'], value: 0 } };
	expect(seeds.recordSeedsForFieldWrite(prev, next, { fromAgent: true })).toEqual([]);
	expect(seeds.recordSeedsForFieldWrite(prev, next, { programmatic: true })).toEqual([]);
	expect(seeds.newChartSeedOverrides()).toEqual({});
});

test('🔴 合盘子盘改宫制:记作新命盘缺省', ()=>{
	const AstroRelative = require('../../components/astro/AstroRelative').default;
	const dispatched = [];
	const ctx = { props: { fields: F({ hsys: 1, zodiacal: 0, date: 'x', time: 'y', lat: '31n14', lon: '121e28' }), dispatch: (a)=>dispatched.push(a) } };
	AstroRelative.prototype.handleRelativeOnChange.call(ctx, { hsys: 0 });
	expect(dispatched[0].type).toBe('astro/saveUserFields');
	expect(seeds.newChartSeedValue('hsys')).toBe(0);
});

test('🔴 AI 改当前盘口径经桥时带 fromAgent(不记新盘缺省)', async ()=>{
	const bridge = require('../aiTools/workspaceBridge');
	const calls = [];
	bridge.registerWorkspaceBridge({ changeCond: (v)=>calls.push(v), dispatch: ()=>{} });
	const { applyFacetValues } = require('../aiTools/settingsFacets');
	await applyFacetValues('chart', null, { hsys: 0 });
	expect(calls.length).toBe(1);
	expect(calls[0]).toEqual(expect.objectContaining({ hsys: 0, fromAgent: true }));
});
