// 各流派择日搜索合同:条件目录(各家注册表)· 黄历 / 八字 / 奇门 / 紫微 / 六壬 / 太乙真引擎搜索 → 命中区间的 pick 经判读必成立 · 本命解析 · 跨度上限 ·
// 缺地点 · 不开放的流派说清原因 · 后端两家(七政 / 印度)请求体与择日页同形、区间整理(以桩模拟本机服务)· 奇门口径 = 奇门页的排盘设置。
jest.mock('../../services/electionScan', ()=>{
	const actual = jest.requireActual('../../services/electionScan');
	return { __esModule: true, ...actual, fetchQizhengElectionScan: jest.fn(), fetchQizhengElectionExplain: jest.fn(), fetchIndiaElectionScan: jest.fn(), fetchIndiaElectionExplain: jest.fn() };
});
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { setAgentEnabled } from '../aiAgent/prefs';
import { fetchQizhengElectionScan, fetchQizhengElectionExplain, fetchIndiaElectionScan, fetchIndiaElectionExplain } from '../../services/electionScan';
import { ZERI_SCHOOLS, ZERI_AI_MAX_SPAN_DAYS } from '../aiTools/zeriSchools';

const ctx = ()=>({ origin: 'mcp', requestId: 'turnZ:0:c1', dispatch: jest.fn() });

beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	setAgentEnabled(true);
	jest.clearAllMocks();
});

describe('条件目录', ()=>{
	it('🔴 八家各有注册表;单类查询;不开放的三式说清原因', async ()=>{
		for(let i = 0; i < ZERI_SCHOOLS.length; i++){
			const r = await runTool('list_zeri_conditions', { school: ZERI_SCHOOLS[i] }, ctx());   // eslint-disable-line no-await-in-loop
			expect(`${ZERI_SCHOOLS[i]}:${r.ok}`).toBe(`${ZERI_SCHOOLS[i]}:true`);
			expect(r.data.types.length).toBeGreaterThan(5);
			expect(r.data.maxSpanDays).toBe(ZERI_AI_MAX_SPAN_DAYS[ZERI_SCHOOLS[i]]);
		}
		const one = await runTool('list_zeri_conditions', { school: 'huangli', type: 'jianchu' }, ctx());
		expect(one.data.types.map((t)=>t.type)).toEqual(['jianchu']);
		expect(one.data.types[0].fields[0].values).toContain('成');
		const q = await runTool('list_zeri_conditions', { school: 'sanshi' }, ctx());
		expect(q.code).toBe('E_ARGS_INVALID'); expect(q.message).toContain('择日页');
	});
});

describe('本机引擎', ()=>{
	it('🔴 黄历:一个月里「建除 = 成」的日子;每个区间的 pick 经 explain_zeri 判读成立', async ()=>{
		const conditions = { type: 'jianchu', params: { values: ['成'] } };
		const r = await runTool('search_zeri', { school: 'huangli', start: '2026-03-01', end: '2026-03-31', conditions }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.total).toBeGreaterThan(0);
		for(let i = 0; i < Math.min(3, r.data.intervals.length); i++){
			const iv = r.data.intervals[i];
			const e = await runTool('explain_zeri', { school: 'huangli', time: iv.pick || `${iv.start}`.slice(0, 10), conditions }, ctx());   // eslint-disable-line no-await-in-loop
			expect(e.ok).toBe(true); expect(e.data.pass).toBe(true);
			expect(e.data.lines.join('\n')).toContain('成');
		}
	});
	it('🔴 八字:半个月里日干为「甲」的时段(按时扫描、北京);pick 判读成立;带本命 → 回本命标签', async ()=>{
		const conditions = { type: 'day_ganzhi', params: { values: ['甲'] } };
		const r = await runTool('search_zeri', { school: 'bazi', start: '2026-03-01', end: '2026-03-15', place: '北京', conditions, natalBirth: '1990-01-01 08:00', natalGender: 'male' }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.total).toBeGreaterThan(0);
		expect(r.data.zone).toBe('+08:00');
		expect(r.data.natal).toBeTruthy();
		const iv = r.data.intervals[0];
		expect(iv.durationMin).toBeGreaterThan(60);
		const e = await runTool('explain_zeri', { school: 'bazi', time: iv.pick, place: '北京', conditions }, ctx());
		expect(e.ok).toBe(true); expect(e.data.pass).toBe(true);
	});
	it('🔴 奇门:一个月里「开门落离九宫」的时段(按时扫描、北京);pick 判读成立;口径取奇门页的排盘设置', async ()=>{
		const conditions = { type: 'door', params: { values: ['开'], palaces: [2] } };
		const r = await runTool('search_zeri', { school: 'qimen', start: '2026-04-01', end: '2026-04-30', place: '北京', conditions }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.total).toBeGreaterThan(0);
		const e = await runTool('explain_zeri', { school: 'qimen', time: r.data.intervals[0].pick, place: '北京', conditions }, ctx());
		expect(e.ok).toBe(true); expect(e.data.pass).toBe(true);
		expect(e.data.lines.join('\n')).toContain('开门@离9宫');
		const { dunjiaZeriOptions } = require('../../components/dunjia/DunJiaMain');
		const { loadZeriSchool } = require('../aiTools/zeriSchools');
		const sch = await loadZeriSchool('qimen');
		expect(sch.defaults()).toEqual(dunjiaZeriOptions());
	});
	// 紫微 / 六壬 / 太乙:与择日页同一引擎真扫,命中区间的 pick 经 explain_zeri 判读必成立(判读与扫描同口径)
	it.each([
		['ziwei', { type: 'wuxing_ju', params: { values: ['2', '3', '4', '5', '6'] } }, '2026-03-01', '2026-03-03'],
		['liureng', { type: 'ke_name', params: { values: ['元首课', '重审课', '知一课', '涉害课', '昴星课', '别责课', '八专课', '伏吟课', '返吟课'] } }, '2026-03-01', '2026-03-02'],
		['taiyi', { type: 'yinyang_ju', params: { value: '阳' } }, '2026-03-01', '2026-03-01'],
	])('🔴 %s:真引擎搜索有命中,pick 判读成立', async (school, conditions, start, end)=>{
		const r = await runTool('search_zeri', { school, start, end, place: '北京', conditions }, ctx());
		expect(`${school}:${r.ok}:${r.message || ''}`).toBe(`${school}:true:`);
		expect(r.data.total).toBeGreaterThan(0);
		expect(r.data.zone).toBe('+08:00');
		for(let i = 0; i < Math.min(2, r.data.intervals.length); i++){
			const iv = r.data.intervals[i];
			const e = await runTool('explain_zeri', { school, time: iv.pick, place: '北京', conditions }, ctx());   // eslint-disable-line no-await-in-loop
			expect(`${school}@${iv.pick}:${e.ok}:${e.data && e.data.pass}`).toBe(`${school}@${iv.pick}:true:true`);
		}
	});
	it('🔴 紫微 / 六壬:条件里写了不存在的选项 → 说清哪一项失效,不静默恒不命中', async ()=>{
		const a = await runTool('search_zeri', { school: 'ziwei', start: '2026-03-01', end: '2026-03-01', place: '北京', conditions: { type: 'wuxing_ju', params: { values: ['9'] } } }, ctx());
		expect(a.ok).toBe(false); expect(a.message).toContain('失效');
		const b = await runTool('search_zeri', { school: 'liureng', start: '2026-03-01', end: '2026-03-01', place: '北京', conditions: { type: 'ke_name', params: { values: ['遥克课'] } } }, ctx());
		expect(b.ok).toBe(false); expect(b.message).toContain('遥克课');
	});
	it('跨度超上限 / 缺地点 / 坏时间 / 未知条件类 / 本命解析失败 → 各自说清', async ()=>{
		const c = { type: 'day_ganzhi', params: { values: ['甲'] } };
		expect((await runTool('search_zeri', { school: 'bazi', start: '2026-01-01', end: '2027-03-01', place: '北京', conditions: c }, ctx())).message).toContain('上限');
		expect((await runTool('search_zeri', { school: 'bazi', start: '2026-03-01', end: '2026-03-02', conditions: c }, ctx())).message).toContain('地点');
		expect((await runTool('search_zeri', { school: 'bazi', start: '2026/3', end: '2026-03-02', place: '北京', conditions: c }, ctx())).code).toBe('E_ARGS_INVALID');
		expect((await runTool('search_zeri', { school: 'bazi', start: '2026-03-01', end: '2026-03-02', place: '北京', conditions: { type: 'nope' } }, ctx())).message).toContain('list_zeri_conditions');
		expect((await runTool('search_zeri', { school: 'bazi', start: '2026-03-01', end: '2026-03-02', place: '北京', conditions: c, natalBirth: '一九九零年' }, ctx())).message).toContain('本命');
		expect((await runTool('search_zeri', { school: 'sanshi', start: '2026-03-01', end: '2026-03-02', place: '北京', conditions: c }, ctx())).message).toContain('择日页');
	});
});

describe('后端两家(七政)', ()=>{
	it('🔴 请求体与择日页同形(时刻带秒 / 地点 / 缺省口径 / 条件);区间整理出 pickEnd 与分钟数;判读带时刻 t', async ()=>{
		fetchQizhengElectionScan.mockImplementation(async (values)=>({ intervals: [{ start: `${values.startDate} 10:00`, end: `${values.startDate} 12:30`, pick: `${values.startDate} 10:03` }], truncated: false, evalPoints: 10 }));
		fetchQizhengElectionExplain.mockResolvedValue({ t: '2026-03-01 10:03', pass: true, tree: { kind: 'group', op: 'all', pass: true, children: [{ kind: 'leaf', type: 'body_in_gong', pass: true, actual: '日在子宫' }] } });
		const conditions = { type: 'body_in_gong', params: {} };
		const r = await runTool('search_zeri', { school: 'qizheng', start: '2026-03-01', end: '2026-03-02', place: '北京', conditions }, ctx());
		expect(r.ok).toBe(true);
		const payload = fetchQizhengElectionScan.mock.calls[0][0];
		expect(payload.startTime).toMatch(/^\d{2}:\d{2}:00$/); expect(payload.endTime).toMatch(/^\d{2}:\d{2}:59$/);
		expect(payload).toEqual(expect.objectContaining({ zone: '+08:00', su28Mode: 2, nodeType: 'mean', lilithType: 'mean' }));
		expect(Number.isFinite(payload.gpsLat)).toBe(true);
		expect(Array.isArray(payload.conditions) || typeof payload.conditions === 'object').toBe(true);
		expect(r.data.intervals[0]).toEqual(expect.objectContaining({ durationMin: 150, pickEnd: '2026-03-01 12:29' }));
		const e = await runTool('explain_zeri', { school: 'qizheng', time: '2026-03-01 10:03', place: '北京', conditions }, ctx());
		expect(e.ok).toBe(true); expect(e.data.pass).toBe(true);
		expect(fetchQizhengElectionExplain.mock.calls[0][0].t).toBe('2026-03-01 10:03');
	});
	it('🔴 印度:请求体与择日页同形(时刻带秒 / 地点 / 缺省口径 / 本命月宿与月座按后端口径换算);区间整理;判读带时刻 t', async ()=>{
		fetchIndiaElectionScan.mockImplementation(async (values)=>({ intervals: [{ start: `${values.startDate} 06:00`, end: `${values.startDate} 07:00`, pick: `${values.startDate} 06:10` }], truncated: false, evalPoints: 10 }));
		fetchIndiaElectionExplain.mockResolvedValue({ t: '2026-03-01 06:10', pass: true, tree: { kind: 'group', op: 'all', pass: true, children: [{ kind: 'leaf', type: 'tithi', pass: true, actual: 'Tithi 3' }] } });
		const conditions = { type: 'tithi', params: { values: [3] } };
		const r = await runTool('search_zeri', { school: 'india', start: '2026-03-01', end: '2026-03-02', place: '北京', conditions, indiaNatal: { moonNak: 5, moonSign: 3 } }, ctx());
		expect(r.ok).toBe(true);
		const payload = fetchIndiaElectionScan.mock.calls[0][0];
		expect(payload.startTime).toMatch(/^\d{2}:\d{2}:00$/); expect(payload.endTime).toMatch(/^\d{2}:\d{2}:59$/);
		expect(payload).toEqual(expect.objectContaining({ zone: '+08:00', ayanamsa: 'lahiri', nodeType: 'mean', natal: { moonNak: 5, moonSign: 2 } }));
		expect(Number.isFinite(payload.gpsLat) && Number.isFinite(payload.gpsLon)).toBe(true);
		expect(r.data.intervals[0]).toEqual(expect.objectContaining({ durationMin: 60, pickEnd: '2026-03-01 06:59' }));
		const e = await runTool('explain_zeri', { school: 'india', time: '2026-03-01 06:10', place: '北京', conditions, indiaNatal: { moonNak: 5, moonSign: 3 } }, ctx());
		expect(e.ok).toBe(true); expect(e.data.pass).toBe(true);
		expect(fetchIndiaElectionExplain.mock.calls[0][0]).toEqual(expect.objectContaining({ t: '2026-03-01 06:10', natal: { moonNak: 5, moonSign: 2 } }));
	});
	it('本机服务没回 → 可重试的后端码', async ()=>{
		fetchQizhengElectionScan.mockRejectedValue(new Error('Failed to fetch'));
		const r = await runTool('search_zeri', { school: 'qizheng', start: '2026-03-01', end: '2026-03-02', place: '北京', conditions: { type: 'body_in_gong', params: {} } }, ctx());
		expect(r.code).toBe('E_CAST_BACKEND_FAILED');
	});
});
