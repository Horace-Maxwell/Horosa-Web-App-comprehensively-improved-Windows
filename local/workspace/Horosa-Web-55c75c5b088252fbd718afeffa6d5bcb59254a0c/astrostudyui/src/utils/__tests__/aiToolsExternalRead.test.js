// 外部智能体只读能力合同:后台任务 / 无头合盘取数 / 天星择日(条件类 · 搜索 · 判读)/ 玄学史 / 私人内容(子开关缺省关)/ 当前页正文。
// 每件:目录形状(只读、来源合同)· 成功路径的 data 合自己声明的 outputSchema · 失败路径出对应错误码。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../../services/astro', ()=>({ fetchChart: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../../divination/zeri/scanOrchestrator', ()=>{
	const actual = jest.requireActual('../../divination/zeri/scanOrchestrator');
	return { __esModule: true, ...actual, runScan: jest.fn() };
});
jest.mock('../../services/electionScan', ()=>({ __esModule: true, fetchElectionExplain: jest.fn() }));
jest.mock('../../services/xuanshi', ()=>({
	__esModule: true,
	fetchSearch: jest.fn(), fetchFigures: jest.fn(), fetchStories: jest.fn(), fetchTechniques: jest.fn(),
	fetchEvent: jest.fn(), fetchFigure: jest.fn(), fetchTechnique: jest.fn(), fetchStory: jest.fn(), fetchDynasty: jest.fn(), fetchCelestialTerm: jest.fn(),
}));
jest.mock('../aiExport', ()=>{
	const actual = jest.requireActual('../aiExport');
	return { __esModule: true, ...actual, buildCurrentPageExportForTool: jest.fn() };
});
import Ajv from 'ajv';
import { registerBuiltinTools } from '../aiTools';
import { runTool, listTools, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { createTask, __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { clearStore, putStoreRecord, AI_ANALYSIS_STORES } from '../aiAnalysisStore';
import { setPrivateReadEnabled, setAgentEnabled } from '../aiAgent/prefs';
import { upsertLocalChart } from '../localcharts';
import { upsertLocalCase } from '../localcases';
import { buildDefaultFateEvents, saveLocalFateEvents } from '../localdeeplearn';
import { buildSubjectFacts, setSubjectFactsEnabled } from '../subjectFacts';
import { runScan } from '../../divination/zeri/scanOrchestrator';
import { fetchElectionExplain } from '../../services/electionScan';
import * as xs from '../../services/xuanshi';
import { buildCurrentPageExportForTool } from '../aiExport';
import { compileAgentTree } from '../aiTools/tools/searchElection';
import { CONDITION_TYPES } from '../../divination/zeri/conditionTypes';

const ajv = new Ajv({ allErrors: true, strict: false });
const ctx = (extra)=>({ origin: 'mcp', requestId: 'r1', dispatch: jest.fn(), ...(extra || {}) });
function okShaped(name, r){
	expect(r.ok).toBe(true);
	const def = listTools().find((d)=>d.name === name);
	const v = ajv.compile(def.outputSchema);
	if(!v(r.data)){ throw new Error(`${name} data 不合 outputSchema:${JSON.stringify(v.errors)}`); }
}
const chart = (name, birth)=>upsertLocalChart({ name, birth, zone: '+08:00', lat: '39n54', lon: '116e24', gpsLat: 39.9, gpsLon: 116.4, gender: 1 });

beforeEach(async ()=>{
	window.localStorage.clear();
	__resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); __resetTaskCacheForTests();
	await clearStore(AI_ANALYSIS_STORES.agentTasks);
	await clearStore(AI_ANALYSIS_STORES.conversations);
	await clearStore(AI_ANALYSIS_STORES.messages);
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	setAgentEnabled(true);
	registerBuiltinTools();
	jest.clearAllMocks();
});

describe('后台任务', ()=>{
	it('🔴 list_tasks 过滤(状态 / 类型 / active / terminal)+ get_task 日志尾与结果截断 + 不存在', async ()=>{
		const a = await createTask({ kind: 'goal', title: '看流年', status: 'running', log: Array.from({ length: 30 }, (_, i)=>({ at: `t${i}`, text: `第 ${i} 步` })), result: { content: 'x'.repeat(9000) } });
		await createTask({ kind: 'scheduled', title: '每周简报', status: 'done' });
		const all = await runTool('list_tasks', {}, ctx());
		okShaped('list_tasks', all);
		expect(all.data.total).toBe(2);
		expect((await runTool('list_tasks', { status: 'active' }, ctx())).data.items.map((t)=>t.title)).toEqual(['看流年']);
		expect((await runTool('list_tasks', { status: 'terminal' }, ctx())).data.items.map((t)=>t.title)).toEqual(['每周简报']);
		expect((await runTool('list_tasks', { kind: 'scheduled' }, ctx())).data.items.length).toBe(1);
		const d = await runTool('get_task', { taskId: a.id, logLines: 5, resultChars: 1000 }, ctx());
		okShaped('get_task', d);
		expect(d.data.log).toEqual(['t25 第 25 步', 't26 第 26 步', 't27 第 27 步', 't28 第 28 步', 't29 第 29 步']);
		expect(d.data.resultTruncated).toBe(true);
		expect(d.data.result.length).toBeLessThan(1100);
		expect((await runTool('get_task', { taskId: 'nope' }, ctx())).code).toBe('E_TASK_NOT_FOUND');
	});
	it('🔴 list_tasks 翻页:offset + nextOffset,total = 过滤后条数;对外投影的 kind 枚举只列 goal / scheduled / scan', async ()=>{
		for(let i = 0; i < 5; i++){ await createTask({ kind: 'goal', title: `目标${i}`, status: 'queued' }); }   // eslint-disable-line no-await-in-loop
		await createTask({ kind: 'scheduled', title: '定时', status: 'scheduled' });
		const p1 = await runTool('list_tasks', { kind: 'goal', limit: 2 }, ctx());
		okShaped('list_tasks', p1);
		expect(p1.data.total).toBe(5); expect(p1.data.items.length).toBe(2); expect(p1.data.offset).toBe(0); expect(p1.data.nextOffset).toBe(2);
		const p3 = await runTool('list_tasks', { kind: 'goal', limit: 2, offset: 4 }, ctx());
		okShaped('list_tasks', p3);
		expect(p3.data.items.length).toBe(1); expect(p3.data.nextOffset).toBe(null);
		const seen = new Set();
		let off = 0;
		while(off !== null){ const pg = await runTool('list_tasks', { kind: 'goal', limit: 2, offset: off }, ctx()); pg.data.items.forEach((t)=>seen.add(t.taskId)); off = pg.data.nextOffset; }   // eslint-disable-line no-await-in-loop
		expect(seen.size).toBe(5);
		const def = listTools().find((d)=>d.name === 'list_tasks');
		expect(def.inputSchema.properties.kind.enum).not.toContain('report');
		expect(def.inputSchema.properties.kind.enum).toEqual(expect.arrayContaining(['goal', 'scheduled', 'scan']));
		expect(def.description).not.toMatch(/报告/);
		const man = exportToolManifest({ includeExternal: false, origin: 'mcp' }).find((t)=>t.name === 'list_tasks');
		expect(JSON.stringify(man)).not.toMatch(/报告|"report"/);
		expect((await runTool('list_tasks', { kind: 'report' }, ctx())).code).toBe('E_ARGS_INVALID');
	});
});

describe('无头合盘取数', ()=>{
	it('🔴 八字 + 紫微对照纯前端算出;西洋要后端,离线时如实列 missing;只要西洋且离线 ⇒ 可重试的后端码;事盘拒', async ()=>{
		const A = chart('张三', '1990-05-18 10:00:00');
		const B = chart('李四', '1992-03-07 08:30:00');
		const r = await runTool('cast_relative', { a: { kind: 'record', cid: A.cid }, b: { kind: 'record', cid: B.cid }, modes: ['western', 'bazi', 'ziwei'] }, ctx());
		okShaped('cast_relative', r);
		expect(r.data.sections.map((s)=>s.mode)).toEqual(['bazi', 'ziwei']);
		expect(r.data.missing).toEqual(['western']);
		expect(r.data.content).toContain('八字合婚对照');
		expect(r.data.content).toContain('张三');
		const w = await runTool('cast_relative', { a: { kind: 'record', cid: A.cid }, b: { kind: 'record', cid: B.cid } }, ctx());
		expect(w.code).toBe('E_CAST_BACKEND_FAILED');
		const natal = await runTool('cast_relative', { a: { kind: 'natal', birth: '1990-05-18 10:00', place: '北京' }, b: { kind: 'record', cid: B.cid }, modes: ['bazi'] }, ctx());
		okShaped('cast_relative', natal);
	});
});

describe('天星择日', ()=>{
	it('条件类目录 = 注册表全集(参数值域取 options 的 value);单类查询;未知类拒', async ()=>{
		const r = await runTool('list_election_conditions', {}, ctx());
		okShaped('list_election_conditions', r);
		expect(r.data.types.map((t)=>t.type).sort()).toEqual(Object.keys(CONDITION_TYPES).sort());
		const aspect = r.data.types.find((t)=>t.type === 'aspect');
		expect(aspect.fields.find((f)=>f.key === 'angle').values).toContain(90);
		expect((await runTool('list_election_conditions', { type: 'aspect' }, ctx())).data.types.length).toBe(1);
		expect((await runTool('list_election_conditions', { type: 'nope' }, ctx())).code).toBe('E_ARGS_INVALID');
	});
	it('🔴 条件树编译:叶参数盖在缺省上 / negate → not / 嵌套组 / 单叶自动包组 / 未知类与空组报错', ()=>{
		const { compiled } = compileAgentTree({ op: 'all', conditions: [{ type: 'aspect', params: { angle: 120 } }, { op: 'any', negate: true, conditions: [{ type: 'in_sign', params: { planet: 'Moon', signs: [3] } }] }] });
		expect(compiled.type).toBe('all');
		expect(compiled.conditions[0]).toEqual(expect.objectContaining({ type: 'aspect', params: expect.objectContaining({ angle: 120, orb: CONDITION_TYPES.aspect.defaults.orb }) }));
		expect(compiled.conditions[1].type).toBe('not');
		expect(compileAgentTree({ type: 'aspect' }).compiled.type).toBe('aspect');
		expect(()=>compileAgentTree({ type: 'nope' })).toThrow(/未知条件类型/);
		expect(()=>compileAgentTree({ op: 'all', conditions: [] })).toThrow(/空的条件分组/);
	});
	it('🔴 search_election:请求口径(斜杠日期 / 时区 / 经纬 / 缺省宫制)、进度逐段回报、limit 截断、停止 = E_ABORTED', async ()=>{
		runScan.mockImplementation(async ({ base, tree, onProgress })=>{
			onProgress({ done: 1, total: 2, hits: 1 }); onProgress({ done: 2, total: 2, hits: 3 });
			return { intervals: [{ start: '2026-11-01 10:00', end: '2026-11-01 11:00', pick: '2026-11-01 10:30:00' }, { start: '2026-11-02 10:00', end: '2026-11-02 11:00' }, { start: '2026-11-03 10:00', end: '2026-11-03 11:00' }], truncated: false, base, tree };
		});
		const report = jest.fn();
		const r = await runTool('search_election', { start: '2026-11-01', end: '2026-12-31 18:00', place: '北京', conditions: { type: 'aspect' }, limit: 2 }, ctx({ progress: report }));
		okShaped('search_election', r);
		expect(r.data.intervals.length).toBe(2);
		expect(r.data.total).toBe(3);
		expect(r.data.truncated).toBe(true);
		const { base } = runScan.mock.calls[0][0];
		expect(base).toEqual(expect.objectContaining({ startDate: '2026/11/01', startTime: '00:00:00', endDate: '2026/12/31', endTime: '18:00:00', zone: '+08:00', hsys: 0, ad: 1, precision: 'minute' }));
		expect(Number.isFinite(base.gpsLat) && Number.isFinite(base.gpsLon)).toBe(true);
		expect(report).toHaveBeenCalledWith(2, 2, expect.stringContaining('命中 3'));
		runScan.mockImplementation(async ()=>{ const e = new Error('scan aborted'); e.name = 'AbortError'; throw e; });
		expect((await runTool('search_election', { start: '2026-11-01', end: '2026-11-02', place: '北京', conditions: { type: 'aspect' } }, ctx())).code).toBe('E_ABORTED');
		expect((await runTool('search_election', { start: 'x', end: '2026-11-02', place: '北京', conditions: { type: 'aspect' } }, ctx())).code).toBe('E_ARGS_INVALID');
		expect((await runTool('search_election', { start: '2026-11-01', end: '2026-11-02', conditions: { type: 'aspect' } }, ctx())).code).toBe('E_ARGS_INVALID');
	});
	it('explain_election:逐条判读行 + 总成立位;时刻按斜杠格式投后端', async ()=>{
		fetchElectionExplain.mockResolvedValue({ tree: { kind: 'group', op: 'all', pass: true, children: [{ kind: 'leaf', type: 'aspect', actual: '月日 89.6°', pass: true }] } });
		const r = await runTool('explain_election', { time: '2026-11-01 10:30', place: '北京', conditions: { type: 'aspect' } }, ctx());
		okShaped('explain_election', r);
		expect(r.data.pass).toBe(true);
		expect(r.data.lines.join('\n')).toContain('月日 89.6°');
		expect(fetchElectionExplain.mock.calls[0][0].t).toBe('2026/11/01 10:30:00');
	});
});

describe('玄学史', ()=>{
	it('🔴 事件 / 人物 / 术数检索归一成 {kind,id,title,brief};术数按关键词本地过滤;详情截断;后端不在 ⇒ 可重试', async ()=>{
		xs.fetchSearch.mockResolvedValue([{ event_id: 'e1', title: '荧惑守心', period: '秦', citation: '《史记》', modern_text: '火星停留心宿' }]);
		const ev = await runTool('search_xuanshi', { query: '荧惑' }, ctx());
		okShaped('search_xuanshi', ev);
		expect(ev.data.items[0]).toEqual(expect.objectContaining({ kind: 'event', id: 'e1', title: '荧惑守心' }));
		xs.fetchTechniques.mockResolvedValue([{ slug: 'liuren', name: '六壬' }, { slug: 'qimen', name: '奇门' }]);
		const tq = await runTool('search_xuanshi', { query: '六壬', kind: 'techniques' }, ctx());
		expect(tq.data.items.map((x)=>x.id)).toEqual(['liuren']);
		xs.fetchEvent.mockResolvedValue({ event_id: 'e1', title: '荧惑守心', original_text: '甲'.repeat(3000) });
		const it1 = await runTool('get_xuanshi_item', { kind: 'event', id: 'e1', maxChars: 500 }, ctx());
		okShaped('get_xuanshi_item', it1);
		expect(it1.data.truncated).toBe(true);
		xs.fetchSearch.mockRejectedValue(new Error('xuanshi.fetch.failed'));
		expect((await runTool('search_xuanshi', { query: '荧惑' }, ctx())).code).toBe('E_CAST_BACKEND_FAILED');
	});
	it('🔴 翻页:事件(接口不收 offset)本地切页、多取一条判下一页;人物接口收 offset 并回总数;术数本地过滤后切页', async ()=>{
		const events = Array.from({ length: 7 }, (_, i)=>({ event_id: `e${i}`, title: `事${i}` }));
		xs.fetchSearch.mockImplementation(async ({ limit })=>events.slice(0, limit));
		const p1 = await runTool('search_xuanshi', { query: '事', limit: 3 }, ctx());
		okShaped('search_xuanshi', p1);
		expect(p1.data.items.map((x)=>x.id)).toEqual(['e0', 'e1', 'e2']);
		expect(p1.data.nextOffset).toBe(3); expect(p1.data.totalExact).toBe(false);
		expect(xs.fetchSearch.mock.calls[0][0].limit).toBe(4);
		const p3 = await runTool('search_xuanshi', { query: '事', limit: 3, offset: 6 }, ctx());
		expect(p3.data.items.map((x)=>x.id)).toEqual(['e6']);
		expect(p3.data.nextOffset).toBe(null); expect(p3.data.total).toBe(7); expect(p3.data.totalExact).toBe(true);
		xs.fetchFigures.mockImplementation(async ({ limit, offset })=>({ items: Array.from({ length: 12 }, (_, i)=>({ slug: `f${i}`, name: `人${i}` })).slice(offset, offset + limit), total: 12 }));
		const f = await runTool('search_xuanshi', { query: '人', kind: 'figures', limit: 5, offset: 5 }, ctx());
		okShaped('search_xuanshi', f);
		expect(f.data.items.map((x)=>x.id)).toEqual(['f5', 'f6', 'f7', 'f8', 'f9']);
		expect(f.data.total).toBe(12); expect(f.data.nextOffset).toBe(10);
		expect(xs.fetchFigures.mock.calls[0][0]).toEqual(expect.objectContaining({ offset: 5 }));
		const fl = await runTool('search_xuanshi', { query: '人', kind: 'figures', limit: 5, offset: 10 }, ctx());
		expect(fl.data.items.map((x)=>x.id)).toEqual(['f10', 'f11']); expect(fl.data.nextOffset).toBe(null);
		xs.fetchTechniques.mockResolvedValue(Array.from({ length: 5 }, (_, i)=>({ slug: `t${i}`, name: `六壬${i}` })).concat([{ slug: 'qm', name: '奇门' }]));
		const t = await runTool('search_xuanshi', { query: '六壬', kind: 'techniques', limit: 2, offset: 2 }, ctx());
		expect(t.data.items.map((x)=>x.id)).toEqual(['t2', 't3']);
		expect(t.data.total).toBe(5); expect(t.data.nextOffset).toBe(4);
	});
});

describe('私人内容(子开关缺省关)', ()=>{
	it('🔴 关 ⇒ 三件不进 MCP 目录、直呼其名 E_TOOL_DISABLED;只对 mcp 来源开放', async ()=>{
		const man = exportToolManifest({ includeExternal: false, origin: 'mcp' }).map((t)=>t.name);
		['list_conversations', 'get_conversation', 'get_record_detail'].forEach((n)=>expect(man).not.toContain(n));
		expect((await runTool('list_conversations', {}, ctx())).code).toBe('E_TOOL_DISABLED');
		setPrivateReadEnabled(true);
		expect(window.localStorage.getItem('horosa.ai.tools.privateRead.enabled')).toBe('1');   // 进阶页开关 data-private-read-switch 写的就是这把键
		const man2 = exportToolManifest({ includeExternal: false, origin: 'mcp' }).map((t)=>t.name);
		['list_conversations', 'get_conversation', 'get_record_detail'].forEach((n)=>expect(man2).toContain(n));
		const inApp = exportToolManifest({ includeExternal: false, origin: 'in-app' }).map((t)=>t.name);
		['list_conversations', 'get_conversation', 'get_record_detail'].forEach((n)=>expect(inApp).not.toContain(n));
	});
	it('开 ⇒ 对话列表 / 正文(截断)/ 档案备注 + 断事日志 + 关系', async ()=>{
		setPrivateReadEnabled(true);
		await putStoreRecord(AI_ANALYSIS_STORES.conversations, { id: 'c1', title: '张三 · 流年 2027', sourceRef: { id: 'local-a', sourceType: 'chart', title: '张三' }, lastMessageAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }, 'conv');
		await putStoreRecord(AI_ANALYSIS_STORES.messages, { id: 'm1', conversationId: 'c1', role: 'user', content: '2027 年怎么样', createdAt: '2026-10-01T00:00:00Z', streamStatus: 'done' }, 'msg');
		await putStoreRecord(AI_ANALYSIS_STORES.messages, { id: 'm2', conversationId: 'c1', role: 'assistant', content: '乙'.repeat(5000), createdAt: '2026-10-01T00:00:01Z', streamStatus: 'done' }, 'msg');
		const l = await runTool('list_conversations', { query: '张三' }, ctx());
		okShaped('list_conversations', l);
		expect(l.data.items[0]).toEqual(expect.objectContaining({ conversationId: 'c1', source: expect.objectContaining({ title: '张三' }) }));
		const g = await runTool('get_conversation', { conversationId: 'c1', maxCharsPerMessage: 300 }, ctx());
		okShaped('get_conversation', g);
		expect(g.data.messages.map((m)=>m.role)).toEqual(['user', 'assistant']);
		expect(g.data.messages[1].content).toContain('截断');
		const A = chart('张三', '1990-05-18 10:00:00');
		const B = chart('李四', '1992-03-07 08:30:00');
		upsertLocalChart({ cid: A.cid, memo: '客户', memoBaZi: '身弱', journal: [{ at: '2026-10-01 10:00', text: '应期已验' }], relations: [{ cid: B.cid, type: 'spouse' }] });
		const d = await runTool('get_record_detail', { recordId: A.cid }, ctx());
		okShaped('get_record_detail', d);
		expect(d.data.memo).toBe('客户');
		expect(d.data.notes['八字']).toBe('身弱');
		expect(d.data.journal[0].text).toBe('应期已验');
		expect(d.data.relations[0]).toEqual(expect.objectContaining({ recordId: B.cid, type: 'spouse', title: '李四' }));
		// 命主实况:这张命盘没开发送 → null(即便有断事日志);开了才附与对话页同一段(问卷 + 断事日志);没有 = null;事盘恒 null
		expect(d.data.subjectFacts).toBeNull();
		setSubjectFactsEnabled(A.cid, true);
		setSubjectFactsEnabled(B.cid, true);
		const dOn = await runTool('get_record_detail', { recordId: A.cid }, ctx());
		okShaped('get_record_detail', dOn);
		expect(dOn.data.subjectFacts).toEqual(expect.objectContaining({ count: 1, text: buildSubjectFacts(A).text }));
		expect(dOn.data.subjectFacts.text).toContain('2026-10-01 10:00：应期已验');
		const fe = buildDefaultFateEvents(A.cid); fe.Val10000['10003'] = 1; saveLocalFateEvents(fe);
		const d2 = await runTool('get_record_detail', { recordId: A.cid }, ctx());
		okShaped('get_record_detail', d2);
		expect(d2.data.subjectFacts.count).toBe(2);
		expect(d2.data.subjectFacts.groups.map((g)=>g.title)).toEqual(['六亲', '断事日志']);
		expect(d2.data.subjectFacts.text).toContain('父亲寿元超七十：是');
		const dB = await runTool('get_record_detail', { recordId: B.cid }, ctx());
		okShaped('get_record_detail', dB);
		expect(dB.data.subjectFacts).toBeNull();
		const K = upsertLocalCase({ event: '问事', divTime: '2026-10-01 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', caseType: 'liureng' });
		const dK = await runTool('get_record_detail', { recordId: K.cid }, ctx());
		okShaped('get_record_detail', dK);
		expect(dK.data.subjectFacts).toBeNull();
		expect((await runTool('get_record_detail', { recordId: 'local-nope' }, ctx())).code).toBe('E_RECORD_NOT_FOUND');
	});
});

describe('当前页正文', ()=>{
	it('🔴 与「AI导出」同一份内容;按段取;导出分段全清 / 没内容 各自说清', async ()=>{
		buildCurrentPageExportForTool.mockResolvedValue({ technique: '八字', exportKey: 'bazi', content: '[四柱]\n甲子\n[大运]\n乙丑', text: '技术: 八字\n[四柱]\n甲子\n[大运]\n乙丑\n========== 内容结束 ==========' });
		const r = await runTool('read_current_page', {}, ctx());
		okShaped('read_current_page', r);
		expect(r.data.content).toContain('甲子');
		const s = await runTool('read_current_page', { sections: ['大运'] }, ctx());
		expect(s.data.content).toContain('乙丑');
		expect(s.data.content).not.toContain('甲子');
		buildCurrentPageExportForTool.mockResolvedValue({ technique: '八字', content: '', text: '', clearedByUser: true });
		expect((await runTool('read_current_page', {}, ctx())).message).toContain('AI导出设置');
		buildCurrentPageExportForTool.mockResolvedValue({ technique: '', content: '', text: '' });
		expect((await runTool('read_current_page', {}, ctx())).code).toBe('E_SNAPSHOT_MISSING');
	});
});
