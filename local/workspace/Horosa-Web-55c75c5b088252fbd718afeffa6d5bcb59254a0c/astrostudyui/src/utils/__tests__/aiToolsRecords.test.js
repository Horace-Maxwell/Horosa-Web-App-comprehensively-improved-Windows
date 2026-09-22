// AI 助手·记录类工具(建命盘/建事盘/列表/载入)+账本撤销:真 upsert 落库后再断言(不 mock 内核)。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { listActions, undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import * as localcharts from '../localcharts';
import * as localcases from '../localcases';

const CHARTS_KEY = 'horosa.localCharts.v1';
const CASES_KEY = 'horosa.localCases.v1';

let dispatch;
let ui;
function ctx(extra){
	return { origin: 'in-app', requestId: 'r1', dispatch, ui, ...(extra || {}) };
}

beforeEach(()=>{
	window.localStorage.clear();
	jest.restoreAllMocks();
	__resetToolsForTests();
	__resetLedgerForTests();
	__resetWorkspaceBridgeForTests();
	dispatch = jest.fn();
	ui = { selectSource: jest.fn(), refreshSources: jest.fn() };
	registerWorkspaceBridge({ dispatch, changeCond: jest.fn() });
	registerBuiltinTools();
});

describe('create_chart_record', ()=>{
	it('🔴 口述建档:姓名/中文时间/地名/性别 → 真落库,字段与手工建档同形(zone/罗盘串/aiOrigin)', async ()=>{
		const r = await runTool('create_chart_record', { name: '张三', birth: '1990年1月1日早上8点', gender: 'male', place: '北京' }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.created).toBe(true);
		expect(r.data.cid).toMatch(/^local-/);
		expect(r.undo.kind).toBe('trash-record');
		expect(typeof r.undo.actionId).toBe('string');
		const rows = localcharts.listLocalCharts({});
		expect(rows.length).toBe(1);
		const row = rows[0];
		expect(row.name).toBe('张三');
		expect(row.birth).toBe('1990-01-01 08:00:00');
		expect(row.zone).toBe('+08:00');
		expect(row.lat).toBe('39n54');
		expect(row.lon).toBe('116e24');
		expect(row.gender).toBe(1);
		expect(row.pos).toBe('北京');
		expect(row.aiOrigin && row.aiOrigin.actionId).toBe(r.undo.actionId);
		expect(row.aiOrigin.tool).toBe('create_chart_record');
		// 落盘真判据:localStorage 里真的有
		expect(JSON.parse(window.localStorage.getItem(CHARTS_KEY)).length).toBe(1);
		expect(dispatch).toHaveBeenCalledWith({ type: 'user/fetchCharts', payload: {} });
		expect(ui.selectSource).toHaveBeenCalledWith(row.cid);
		expect(r.data.selected).toBe(true);
		expect(r.data.loaded).toBe(false);
	});
	it('同名同生辰第二次 → duplicate:true 且库不增;allowDuplicate 才再建', async ()=>{
		await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '北京' }, ctx());
		const r2 = await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '上海' }, ctx());
		expect(r2.ok).toBe(true);
		expect(r2.data.duplicate).toBe(true);
		expect(r2.data.created).toBe(false);
		expect(localcharts.listLocalCharts({}).length).toBe(1);
		const r3 = await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '上海', allowDuplicate: true }, ctx());
		expect(r3.data.created).toBe(true);
		expect(localcharts.listLocalCharts({}).length).toBe(2);
	});
	it('缺时辰 → E_BIRTH_TIME_MISSING 零写入;timeUnknown=true → 12:00 建档并 memo 注明', async ()=>{
		const r = await runTool('create_chart_record', { name: '李四', birth: '1990-01-01', place: '北京' }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_BIRTH_TIME_MISSING');
		expect(localcharts.listLocalCharts({}).length).toBe(0);
		const r2 = await runTool('create_chart_record', { name: '李四', birth: '1990-01-01', place: '北京', timeUnknown: true }, ctx());
		expect(r2.ok).toBe(true);
		const row = localcharts.listLocalCharts({})[0];
		expect(row.birth).toBe('1990-01-01 12:00:00');
		expect(`${row.memo}`).toMatch(/时辰未知/);
	});
	it('地名歧义/未找到 → 错误码 + 候选,零写入', async ()=>{
		const r = await runTool('create_chart_record', { name: '王五', birth: '1990-01-01 08:00', place: '不存在的地名XYZ' }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_PLACE_NOT_FOUND');
		expect(localcharts.listLocalCharts({}).length).toBe(0);
	});
	it('经纬度直给(无地名)也可建档;非法经纬度被 schema 拒', async ()=>{
		const r = await runTool('create_chart_record', { name: '赵六', birth: '1990-01-01 08:00', gpsLat: 26.0764, gpsLon: 119.3152 }, ctx());
		expect(r.ok).toBe(true);
		expect(localcharts.listLocalCharts({})[0].lat).toBe('26n04');
		const bad = await runTool('create_chart_record', { name: '赵七', birth: '1990-01-01 08:00', gpsLat: 999, gpsLon: 0 }, ctx());
		expect(bad.ok).toBe(false);
		expect(bad.code).toBe('E_ARGS_INVALID');
	});
	it('🔴 只增不删判别向量:带 cid → E_FORBIDDEN_KEY 且库字节不变', async ()=>{
		await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '北京' }, ctx());
		const before = window.localStorage.getItem(CHARTS_KEY);
		const cid = localcharts.listLocalCharts({})[0].cid;
		const r = await runTool('create_chart_record', { name: '张三改', birth: '1990-01-01 08:00', place: '北京', cid }, ctx());
		expect(r.ok).toBe(false);
		expect(['E_FORBIDDEN_KEY', 'E_ARGS_INVALID']).toContain(r.code);
		expect(window.localStorage.getItem(CHARTS_KEY)).toBe(before);
	});
	it('quota 抛 → E_STORE_QUOTA(不假成功)', async ()=>{
		jest.spyOn(localcharts, 'upsertLocalChart').mockImplementation(()=>{ throw new Error('QuotaExceededError'); });
		const r = await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '北京' }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_STORE_QUOTA');
	});
	it('loadIntoWorkspace → user/setCurrentChart 派发', async ()=>{
		const r = await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '北京', loadIntoWorkspace: true }, ctx());
		expect(r.data.loaded).toBe(true);
		expect(dispatch.mock.calls.some((c)=>c[0].type === 'user/setCurrentChart' && c[0].payload.cid === r.data.cid)).toBe(true);
	});
});

describe('create_case_record', ()=>{
	it('🔴 奇门·现在·福州 → 事盘落库:payload 为 JSON 串且含 fieldSnapshot,sourceModule=qimen,zone/罗盘串', async ()=>{
		const r = await runTool('create_case_record', { caseType: 'qimen', place: '福州', question: '今天出行是否顺利' }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.created).toBe(true);
		const rows = localcases.listLocalCases({});
		expect(rows.length).toBe(1);
		const row = rows[0];
		expect(row.caseType).toBe('qimen');
		expect(row.sourceModule).toBe('qimen');
		expect(row.zone).toBe('+08:00');
		expect(row.lat).toBe('26n04');
		expect(row.pos).toBe('福州');
		expect(row.memo).toBe('今天出行是否顺利');
		expect(typeof row.payload).toBe('string');
		const payload = JSON.parse(row.payload);
		expect(payload.module).toBe('qimen');
		expect(payload.fieldSnapshot && typeof payload.fieldSnapshot).toBe('object');
		expect(payload.createdBy).toBe('ai-assistant');
		expect(row.divTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
		expect(row.aiOrigin.actionId).toBe(r.undo.actionId);
		expect(r.assumptions.some((a)=>/起课时间取当前/.test(a))).toBe(true);
		expect(dispatch).toHaveBeenCalledWith({ type: 'user/fetchCases', payload: {} });
	});
	it('卜卦盘(horary)payload 对齐占卜存盘形状(settings/extra/questionCategory)', async ()=>{
		const r = await runTool('create_case_record', { caseType: 'horary', divTime: '2026-05-01 10:00', place: '北京', event: '问事' }, ctx());
		expect(r.ok).toBe(true);
		const payload = JSON.parse(localcases.listLocalCases({})[0].payload);
		expect(payload.settings).toEqual({ zodiacal: 0, siderealAyanamsa: '', hsys: 0, tradition: 1 });
		expect(payload.extra).toEqual({});
		expect(payload.questionCategory).toBe(null);
		expect(payload.fieldSnapshot).toBeTruthy();
	});
	it('🔴 六爻等随机起卦类 → E_NEEDS_MANUAL_CAST 并指路,零新记录', async ()=>{
		const r = await runTool('create_case_record', { caseType: 'liuyao' }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_NEEDS_MANUAL_CAST');
		expect(r.data.tab).toBeTruthy();
		expect(localcases.listLocalCases({}).length).toBe(0);
	});
	it('未知类型被 schema 枚举拒(E_ARGS_INVALID),零新记录', async ()=>{
		const r = await runTool('create_case_record', { caseType: 'nonexistent_type' }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_ARGS_INVALID');
		expect(localcases.listLocalCases({}).length).toBe(0);
	});
	it('同题同时刻同类型 → duplicate,不重复建', async ()=>{
		await runTool('create_case_record', { caseType: 'liureng', divTime: '2026-05-01 10:00', event: '问财' }, ctx());
		const r = await runTool('create_case_record', { caseType: 'liureng', divTime: '2026-05-01 10:00', event: '问财' }, ctx());
		expect(r.data.duplicate).toBe(true);
		expect(localcases.listLocalCases({}).length).toBe(1);
	});
	it('gender=unknown 事盘不写 gender 键(与手工存盘同形)', async ()=>{
		await runTool('create_case_record', { caseType: 'taiyi', gender: 'unknown' }, ctx());
		const row = JSON.parse(window.localStorage.getItem(CASES_KEY))[0];
		expect(Object.prototype.hasOwnProperty.call(row, 'gender') ? row.gender : undefined).toBeUndefined();
	});
});

describe('list_records / load_record_into_workspace', ()=>{
	it('列表两库合并、按类型过滤、摘要不带 payload/memo', async ()=>{
		await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '北京' }, ctx());
		await runTool('create_case_record', { caseType: 'qimen', place: '福州', question: '秘密正文' }, ctx());
		const all = await runTool('list_records', {}, ctx());
		expect(all.data.items.length).toBe(2);
		expect(all.data.items.every((it)=>it.payload === undefined && it.memo === undefined)).toBe(true);
		const cases = await runTool('list_records', { kind: 'case', caseType: 'qimen' }, ctx());
		expect(cases.data.items.length).toBe(1);
		expect(cases.data.items[0].module).toBe('qimen');
		const byName = await runTool('list_records', { kind: 'chart', query: '张' }, ctx());
		expect(byName.data.items.length).toBe(1);
	});
	it('载入命盘/事盘各走正门派发;未知 cid → E_RECORD_NOT_FOUND', async ()=>{
		const c = await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '北京' }, ctx());
		const k = await runTool('create_case_record', { caseType: 'qimen' }, ctx());
		dispatch.mockClear();
		const r1 = await runTool('load_record_into_workspace', { cid: c.data.cid }, ctx());
		expect(r1.ok).toBe(true);
		expect(dispatch.mock.calls[0][0].type).toBe('user/setCurrentChart');
		dispatch.mockClear();
		const r2 = await runTool('load_record_into_workspace', { cid: k.data.cid }, ctx());
		expect(r2.ok).toBe(true);
		expect(dispatch.mock.calls.map((x)=>x[0].type)).toEqual(['user/applyCase', 'astro/closeDrawer']);
		const r3 = await runTool('load_record_into_workspace', { cid: 'local-none' }, ctx());
		expect(r3.code).toBe('E_RECORD_NOT_FOUND');
		// 账本:载入留痕但 undo.kind=none
		const acts = listActions(10);
		expect(acts.find((a)=>a.tool === 'load_record_into_workspace').undo.kind).toBe('none');
	});
});

describe('账本撤销(仅用户按钮路径)', ()=>{
	it('🔴 undoAction(建档) → 主库消失、回收站有;二次撤销拒;非本助手建的记录不可撤', async ()=>{
		const r = await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '北京' }, ctx());
		const u = undoAction(r.undo.actionId);
		expect(u.ok).toBe(true);
		expect(localcharts.listLocalCharts({}).length).toBe(0);
		expect(localcharts.listLocalChartsTrash().length).toBe(1);
		expect(localcharts.listLocalChartsTrash()[0].cid).toBe(r.data.cid);
		expect(listActions(5)[0].undone).toBe(true);
		const again = undoAction(r.undo.actionId);
		expect(again.ok).toBe(false);
		// 非助手建的(无 aiOrigin)同 cid 也不可撤
		localcharts.upsertLocalChart({ name: '手工', birth: '1991-01-01 08:00:00', zone: '+08:00' });
		const manual = localcharts.listLocalCharts({})[0];
		const k = await runTool('create_case_record', { caseType: 'qimen' }, ctx());
		expect(listActions(1)[0].tool).toBe('create_case_record');
		const u2 = undoAction(k.undo.actionId);
		expect(u2.ok).toBe(true);
		expect(localcases.listLocalCases({}).length).toBe(0);
		expect(localcharts.listLocalCharts({}).find((x)=>x.cid === manual.cid)).toBeTruthy();
	});
});

describe('撤销合同:手工改过的记录不自动撤(压测实抓 R9)', ()=>{
	it('🔴 AI 建档 → 用户手工修改(内核 updateTime 晚于动作时间)→ 撤销拒 E_UNDO_RECORD_EDITED,记录仍在主库', async ()=>{
		const r = await runTool('create_chart_record', { name: '手改者', birth: '1990-01-01 08:00', gender: 'male', place: '北京' }, ctx());
		expect(r.ok).toBe(true);
		const action = listActions().find((a)=>a.id === r.undo.actionId);
		expect(action && action.at).toBeTruthy();
		// 模拟用户在档案管理里改名保存:内核会刷新 updateTime(载入/置顶/星标不会)
		const list = JSON.parse(window.localStorage.getItem(CHARTS_KEY));
		const rec = list.find((c)=>c.cid === r.data.cid);
		rec.name = '手改者-改';
		rec.updateTime = new Date(Date.parse(action.at) + 10000).toISOString();
		window.localStorage.setItem(CHARTS_KEY, JSON.stringify(list));
		const u = undoAction(r.undo.actionId);
		expect(u.ok).toBe(false);
		expect(u.code).toBe('E_UNDO_RECORD_EDITED');
		expect(localcharts.listLocalCharts({}).some((c)=>c.cid === r.data.cid)).toBe(true);
		expect(listActions().find((a)=>a.id === r.undo.actionId).undone).toBeFalsy();
		// 2 秒容差内的 updateTime(建档写入本身)不算手改 → 可撤
		rec.updateTime = new Date(Date.parse(action.at) + 500).toISOString();
		window.localStorage.setItem(CHARTS_KEY, JSON.stringify(list));
		expect(undoAction(r.undo.actionId).ok).toBe(true);
	});
});

describe('list_records 分页与精简(offset / fields:brief)', ()=>{
	function seed(n){
		for(let i = 0; i < n; i++){ localcharts.upsertLocalChart({ name: `分页${i}`, birth: `19${String(50 + (i % 50)).padStart(2, '0')}-01-01 08:00:00`, zone: '+08:00' }); }
	}
	it('🔴 60 条 limit 50 → 第一页 50 条 nextOffset 50;offset=50 第二页 10 条 nextOffset null;两页 cid 并集恰 60 无重叠', async ()=>{
		seed(60);
		const p1 = await runTool('list_records', { kind: 'chart', limit: 50 }, ctx());
		expect(p1.ok).toBe(true);
		expect(p1.data).toEqual(expect.objectContaining({ total: 60, offset: 0, limit: 50, nextOffset: 50, truncated: true }));
		expect(p1.data.items.length).toBe(50);
		expect(p1.summary).toContain('第 1–50 条/共 60');
		const p2 = await runTool('list_records', { kind: 'chart', limit: 50, offset: p1.data.nextOffset }, ctx());
		expect(p2.ok).toBe(true);
		expect(p2.data).toEqual(expect.objectContaining({ total: 60, offset: 50, limit: 50, nextOffset: null, truncated: false }));
		expect(p2.data.items.length).toBe(10);
		expect(p2.summary).toContain('第 51–60 条/共 60');
		const cids = new Set(p1.data.items.concat(p2.data.items).map((it)=>it.cid));
		expect(cids.size).toBe(60);
		// 字符串 offset 经 Ajv 转型;limit 上限 50 不变(超出被拒)
		const p3 = await runTool('list_records', { kind: 'chart', limit: 50, offset: '50' }, ctx());
		expect(p3.data.items.length).toBe(10);
		const bad = await runTool('list_records', { limit: 51 }, ctx());
		expect(bad.ok).toBe(false);
		expect(bad.code).toBe('E_ARGS_INVALID');
	});
	it('offset 越界 → ok 且 items:[]、nextOffset null、truncated false;负数被 schema 拒', async ()=>{
		seed(3);
		const r = await runTool('list_records', { offset: 999 }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data).toEqual({ items: [], total: 3, offset: 999, limit: 20, nextOffset: null, truncated: false });
		expect(r.summary).toContain('共 3');
		const neg = await runTool('list_records', { offset: -1 }, ctx());
		expect(neg.ok).toBe(false);
		expect(neg.code).toBe('E_ARGS_INVALID');
	});
	it('fields:brief → 每条键集恰 cid/kind/title/time;缺省 full 含 zone/pos 等摘要键;事盘同样精简', async ()=>{
		seed(2);
		await runTool('create_case_record', { caseType: 'qimen', place: '福州', question: '正文不该出现' }, ctx());
		const brief = await runTool('list_records', { fields: 'brief' }, ctx());
		expect(brief.ok).toBe(true);
		expect(brief.data.items.length).toBe(3);
		brief.data.items.forEach((it)=>{ expect(Object.keys(it).sort()).toEqual(['cid', 'kind', 'time', 'title']); expect(it.cid).toMatch(/^local-/); });
		expect(brief.data.items.map((it)=>it.kind).sort()).toEqual(['case', 'chart', 'chart']);
		const full = await runTool('list_records', {}, ctx());
		expect(full.data.items.every((it)=>Object.keys(it).length > 4 && it.payload === undefined && it.memo === undefined)).toBe(true);
		expect(full.data.items.find((it)=>it.kind === 'case').module).toBe('qimen');
		const bogus = await runTool('list_records', { fields: 'everything' }, ctx());
		expect(bogus.ok).toBe(false);
		expect(bogus.code).toBe('E_ARGS_INVALID');
	});
});
