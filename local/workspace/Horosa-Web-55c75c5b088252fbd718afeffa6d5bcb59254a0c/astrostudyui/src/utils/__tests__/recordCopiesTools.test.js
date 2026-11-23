// 另存副本 / 恢复为副本 / 历史版本 / 查重 —— 与档案列表、编辑页同一套单源函数;副本纯新增、撤销移入回收站;查重只列不合并。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { setAgentEnabled } from '../aiAgent/prefs';
import { upsertLocalChart, getLocalChart, listLocalCharts } from '../localcharts';
import { pushRecordRevision, __resetRevisionsForTests } from '../recordRevisions';

const ctx = ()=>({ origin: 'mcp', requestId: 'c20:0:c1', dispatch: jest.fn() });
beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); __resetRevisionsForTests();
	registerWorkspaceBridge({ dispatch: jest.fn() });
	setAgentEnabled(true); registerBuiltinTools();
});
afterEach(()=>setAgentEnabled(false));

const mk = (extra)=>upsertLocalChart({ name: '张三', birth: '1990-06-15 08:30:00', zone: '+08:00', lat: '39n54', lon: '116e23', gender: 1, ...(extra || {}) });

test('另存副本:新 id、名加「(副本)」、不带走星标 / 置顶 / 关系;原档不动;撤销 = 移入回收站', async ()=>{
	const a = mk({ starred: true, relations: [{ cid: 'local-x', type: 'family' }] });
	const r = await runTool('copy_record', { recordId: a.cid }, ctx());
	expect(r.ok).toBe(true);
	const dup = getLocalChart(r.data.cid);
	expect(dup.cid).not.toBe(a.cid);
	expect(dup.name).toBe('张三(副本)');
	expect(dup.starred).toBeFalsy();
	expect(dup.relations).toBeUndefined();
	expect(dup.aiOrigin && dup.aiOrigin.tool).toBe('copy_record');
	expect(getLocalChart(a.cid).name).toBe('张三');
	const u = undoAction(r.actionId || (r.undo && r.undo.actionId));
	expect(u && u.ok).toBe(true);
	expect(getLocalChart(r.data.cid)).toBeFalsy();
});

test('历史版本:列版本与改动键;copy_record 带 revisionAt = 恢复为副本(名加「(历史版)」);版本不存在报错', async ()=>{
	const a = mk();
	await pushRecordRevision('chart', { ...a }, { force: true });
	upsertLocalChart({ ...getLocalChart(a.cid), name: '张三改名' });
	const l = await runTool('list_record_revisions', { recordId: a.cid }, ctx());
	expect(l.ok).toBe(true);
	expect(l.data.revisions.length).toBeGreaterThan(0);
	const v = l.data.revisions[l.data.revisions.length - 1];
	expect(v.title).toBe('张三');
	expect(v.changedFromCurrent).toContain('name');
	const r = await runTool('copy_record', { recordId: a.cid, revisionAt: v.at }, ctx());
	expect(r.ok).toBe(true);
	expect(getLocalChart(r.data.cid).name).toBe('张三(历史版)');
	expect((await runTool('copy_record', { recordId: a.cid, revisionAt: 1 }, ctx())).code).toBe('E_ARGS_INVALID');
	expect((await runTool('copy_record', { recordId: 'local-none' }, ctx())).code).toBe('E_RECORD_NOT_FOUND');
});

test('查重:同名同生辰成组(只列不合并,不改任何档案)', async ()=>{
	const a = mk(); const b = mk(); mk({ name: '李四' });
	const before = listLocalCharts().length;
	const r = await runTool('find_duplicate_records', { kind: 'chart' }, ctx());
	expect(r.ok).toBe(true);
	const g = r.data.groups.find((x)=>x.records.some((y)=>y.cid === a.cid));
	expect(g.records.map((x)=>x.cid).sort()).toEqual([a.cid, b.cid].sort());
	expect(listLocalCharts().length).toBe(before);
});
