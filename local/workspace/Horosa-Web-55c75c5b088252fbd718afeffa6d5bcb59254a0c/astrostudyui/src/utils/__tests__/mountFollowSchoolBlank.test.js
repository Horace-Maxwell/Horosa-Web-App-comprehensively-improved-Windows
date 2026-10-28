// 卜卦「判读·…」/ 择日「流派口径·…」的空档「随流派（默认）」:存档在页面「判读参数」里改过这一项时,
// 齿轮选回随流派 = 去掉这一项的存档覆盖、按所选流派取值(此前重算跳过空串 → 仍按存档值,是个看着能选的死档)。
const cap = { horary: [], election: [], backend: [] };
jest.mock('../../services/astro', ()=>{
	const actual = jest.requireActual('../../services/astro');
	return { ...actual, fetchChart: jest.fn(async ()=>({ Result: { chart: { objects: [] } } })) };
});
jest.mock('../../divination/horary/horarySchools', ()=>{
	const actual = jest.requireActual('../../divination/horary/horarySchools');
	return { ...actual,
		horaryJudgeOpts: jest.fn((school, ov, layer)=>{ cap.horary.push(ov); return actual.horaryJudgeOpts(school, ov, layer); }),
		horaryBackendFields: jest.fn((school, ov)=>{ cap.backend.push(ov); return actual.horaryBackendFields(school, ov); }),
	};
});
jest.mock('../../divination/horary/horaryEngine', ()=>({ runHorary: jest.fn(()=>null) }));
jest.mock('../../divination/election/electionEngine', ()=>{
	const actual = jest.requireActual('../../divination/election/electionEngine');
	return { ...actual, runElection: jest.fn((c, t, a, b, opts)=>{ cap.election.push(opts.electionParams); return null; }) };
});
const ctx = require('../aiAnalysisContext');
const TMS = require('../techniqueMountSettings');

const REC = { cid: 'hz1', divTime: '2026-03-04 05:06:00', zone: '+08:00', lat: '39n54', lon: '116e23', gpsLat: 39.9, gpsLon: 116.4 };
async function regen(key, payload, gear){
	cap.horary.length = 0; cap.election.length = 0;
	const rec = { ...REC, payload: JSON.stringify(payload) };
	const pruned = TMS.pruneOptionsToNonDefault(key, gear, TMS.effectiveMountBaseline(key, rec));
	await ctx.regenerateCaseTechniqueSnapshot(rec, key, TMS.mergeOptionsIntoPayload(payload, key, pruned));
	return { pruned, horary: cap.horary[0], election: cap.election[0] };
}

describe('「随流派（默认）」去掉存档这一项的覆盖', ()=>{
	test('卜卦:存档 accidentalMode=classic,齿轮选回随流派 → 判读不再带这一项;不动齿轮 → 仍按存档', async ()=>{
		const payload = { questionCategory: 'general', extra: { horaryOverrides: { accidentalMode: 'classic', lotsSet: 'full' } } };
		const r = await regen('horary', payload, { hp_accidentalMode: '' });
		expect(r.pruned).toEqual({ hp_accidentalMode: '' });
		expect(r.horary).toEqual({ lotsSet: 'full' });
		const keep = await regen('horary', payload, {});
		expect(keep.horary).toEqual({ accidentalMode: 'classic', lotsSet: 'full' });
	});
	test('择日:存档 orbProfile=classic,齿轮选回随流派 → 流派口径不再带这一项;不动齿轮 → 仍按存档', async ()=>{
		const payload = { topicId: 'marriage', extra: { electionParams: { orbProfile: 'classic', tripSystem: 'ptolemaic' } } };
		const r = await regen('election', payload, { ep_orbProfile: '' });
		expect(r.pruned).toEqual({ ep_orbProfile: '' });
		expect(r.election).toEqual({ tripSystem: 'ptolemaic' });
		const keep = await regen('election', payload, {});
		expect(keep.election).toEqual({ orbProfile: 'classic', tripSystem: 'ptolemaic' });
	});
});

// 换流派像页面一样:HoraryMain 换派连同 horaryOverrides:{} 一起落,盘面键(宫制等)也随新派 —— 挂载重算与齿轮抽屉同此
describe('卜卦换流派清空逐项判读覆盖(与页面同)', ()=>{
	const PAYLOAD = { questionCategory: 'general', extra: { horarySchool: 'classical', horaryOverrides: { accidentalMode: 'classic', hsys: 0 } } };
	const recOf = (payload)=>({ ...REC, payload: JSON.stringify(payload) });
	const drawerBase = (rec)=>({ ...TMS.getTechniqueSettingsDefaults('horary'), ...TMS.effectiveMountBaseline('horary', rec) });
	// 整张草稿的剪枝会求显隐(其中一项的显示条件调判读参数表),捕获在剪枝之后清零,只看重算那一次
	async function regenDraft(payload, draft){
		const rec = recOf(payload);
		const pruned = TMS.pruneOptionsToNonDefault('horary', draft, TMS.effectiveMountBaseline('horary', rec));
		const merged = TMS.mergeOptionsIntoPayload(payload, 'horary', pruned);
		cap.horary.length = 0; cap.backend.length = 0;
		await ctx.regenerateCaseTechniqueSnapshot(rec, 'horary', merged);
		return { pruned, horary: cap.horary[0], backend: cap.backend[0] };
	}
	test('抽屉只换流派:逐项判读参数回「随流派」,剪枝恰为 { horarySchool },重算不带存档的逐项覆盖、盘面键随新派', async ()=>{
		const rec = recOf(PAYLOAD);
		const base = drawerBase(rec);
		expect(base.hp_accidentalMode).toBe('classic');
		const draft = TMS.applyTechniqueDraftChange('horary', base, 'horarySchool', 'strict');
		expect(draft.hp_accidentalMode).toBe('');
		const r = await regenDraft(PAYLOAD, draft);
		expect(r.pruned).toEqual({ horarySchool: 'strict' });
		expect(r.horary).toBeNull();
		expect(r.backend).toBeNull();
	});
	test('换派 + 某项恰等于存档值:这一项留为覆盖(存档那一项已随换派作废)', async ()=>{
		const rec = recOf(PAYLOAD);
		const draft = { ...TMS.applyTechniqueDraftChange('horary', drawerBase(rec), 'horarySchool', 'strict'), hp_accidentalMode: 'classic' };
		const r = await regenDraft(PAYLOAD, draft);
		expect(r.pruned).toEqual({ horarySchool: 'strict', hp_accidentalMode: 'classic' });
		expect(r.horary).toEqual({ accidentalMode: 'classic' });
	});
	test('不换派:存档逐项覆盖照旧随档(判读与盘面两边)', async ()=>{
		const r = await regenDraft(PAYLOAD, drawerBase(recOf(PAYLOAD)));
		expect(r.pruned).toEqual({});
		expect(r.horary).toEqual({ accidentalMode: 'classic', hsys: 0 });
		expect(r.backend).toEqual({ accidentalMode: 'classic', hsys: 0 });
	});
	test('存档没写流派(= 经典主流):选经典主流不算换派,存档覆盖照旧', async ()=>{
		const p = { questionCategory: 'general', extra: { horaryOverrides: { accidentalMode: 'classic' } } };
		const r = await regenDraft(p, { ...drawerBase(recOf(p)), horarySchool: 'classical' });
		expect(r.pruned).toEqual({});
		expect(r.horary).toEqual({ accidentalMode: 'classic' });
	});
	test('重开抽屉(会话覆盖 / 同类默认 / 沿用覆盖叠到底稿上):按联动合成,再剪恒等于覆盖(应用幂等)', ()=>{
		const rec = recOf(PAYLOAD);
		const base = drawerBase(rec);
		[{ horarySchool: 'strict' }, { horarySchool: 'strict', hp_accidentalMode: 'classic' }, { hp_accidentalMode: '' }].forEach((ov)=>{
			const draft = TMS.composeTechniqueDraft('horary', base, ov);
			expect([ov, TMS.pruneOptionsToNonDefault('horary', draft, TMS.effectiveMountBaseline('horary', rec))]).toEqual([ov, ov]);
		});
		// 反向:直接摊在存档旧细项上(旧做法)→ 存档的逐项值成了覆盖,再点应用结果就变了
		const naive = { ...base, horarySchool: 'strict' };
		expect(TMS.pruneOptionsToNonDefault('horary', naive, TMS.effectiveMountBaseline('horary', rec))).not.toEqual({ horarySchool: 'strict' });
	});
});
