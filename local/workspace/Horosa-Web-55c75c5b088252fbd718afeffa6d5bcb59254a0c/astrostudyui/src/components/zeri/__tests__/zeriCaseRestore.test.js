// [Q-270/T-264] 择日宿主载入存案还原工作台态(共享件):payload.zeri → state 补丁;存档负载补 geo/options/natal/pickText。
import { zeriPayloadToStatePatch, buildZeriCasePayload } from '../zeriCaseRestore';

describe('zeriPayloadToStatePatch', ()=>{
	test('cfg/geo/options/natal/pickText/tree/results 全还原;缺键不写', ()=>{
		const state = { cfg: { startDate: '2026/01/01', startTime: '00:00' }, geo: { zone: '+08:00' }, options: { timeAlg: 1 } };
		const zeri = {
			cfg: { startDate: '2026/09/01', endDate: '2026/09/03' },
			geo: { zone: '+09:00', gpsLon: 139.7 },
			options: { timeAlg: 0 },
			natal: { yearGZ: '庚午' },
			pickText: '2026-09-02 13:00:00',
			tree: { children: [{ type: 'x' }] },
			results: [{ start: '2026-09-02 12:00' }],
			truncated: true,
		};
		const next = zeriPayloadToStatePatch(zeri, state);
		expect(next.cfg).toEqual({ startDate: '2026/09/01', startTime: '00:00', endDate: '2026/09/03' });
		expect(next.geo).toEqual({ zone: '+09:00', gpsLon: 139.7 });
		expect(next.options).toEqual({ timeAlg: 0 });
		expect(next.natal).toEqual({ yearGZ: '庚午' });
		expect(next.pickText).toBe('2026-09-02 13:00:00');
		expect(next.tree.children.length).toBe(1);
		expect(next.results.length).toBe(1);
		expect(next.truncated).toBe(true);
	});

	test('旧存档(只有 cfg/tree/results)也可还原;空负载返回 null', ()=>{
		const next = zeriPayloadToStatePatch({ cfg: { startDate: '2026/09/01' }, tree: { children: [] }, results: [] }, {});
		expect(Object.keys(next).sort()).toEqual(['cfg', 'results', 'tree', 'truncated']);
		expect(zeriPayloadToStatePatch(null, {})).toBe(null);
		expect(zeriPayloadToStatePatch({}, {})).toBe(null);
	});
});

describe('buildZeriCasePayload', ()=>{
	test('冻结扫描态优先,补 geo/options/natal/pickText', ()=>{
		const host = {
			state: { cfg: { startDate: 'live' }, tree: { children: ['live'] }, results: [1], truncated: false, geo: { zone: '+08:00' }, options: { timeAlg: 1 }, natal: { a: 1 }, pickText: '2026-09-02 13:00:00' },
			_scanCfg: { startDate: 'frozen' }, _scanUiTree: { children: ['frozen'] }, _scanGeo: { zone: '+00:00' }, _scanOptions: { timeAlg: 0 },
		};
		const p = buildZeriCasePayload(host);
		expect(p.cfg.startDate).toBe('frozen');
		expect(p.tree.children[0]).toBe('frozen');
		expect(p.geo.zone).toBe('+00:00');
		expect(p.options.timeAlg).toBe(0);
		expect(p.natal).toEqual({ a: 1 });
		expect(p.pickText).toBe('2026-09-02 13:00:00');
		expect(p.results).toEqual([1]);
	});
	test('无 geo/options 的宿主(黄历)不产该键', ()=>{
		const p = buildZeriCasePayload({ state: { cfg: { startDate: 'x' }, tree: { children: [] }, results: null } });
		expect(p).not.toHaveProperty('geo');
		expect(p).not.toHaveProperty('options');
		expect(p).not.toHaveProperty('pickText');
	});
});
