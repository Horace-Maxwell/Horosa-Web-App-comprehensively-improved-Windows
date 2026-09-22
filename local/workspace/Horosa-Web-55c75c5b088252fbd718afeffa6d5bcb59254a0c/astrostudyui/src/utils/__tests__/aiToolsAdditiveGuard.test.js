// AI 助手·只增不删判别向量(判别力自证先行):禁键必拒且库字节不变 / 删改类工具名拒注册 /
// restore-settings 无快照拒注册 / 账本撤销只认自己建的记录 / 外来 cid 撤销必拒。
import { registerTool, runTool, getTool, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { guardAdditive } from '../aiTools/guardAdditive';
import { AGENT_TOOL_LEVELS, FORBIDDEN_ARG_KEYS } from '../aiTools/catalog';
import { appendAction, undoAction, listActions, __resetLedgerForTests, LEDGER_KEY } from '../aiTools/ledger';
import { upsertLocalChart, listLocalCharts, listLocalChartsTrash } from '../localcharts';

const CHARTS_KEY = 'horosa.localCharts.v1';
const okTool = (over = {})=>({
	name: 'probe_add', description: '测试', level: 'additive', undoKind: 'none',
	inputSchema: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, cid: { type: 'string' } } },
	run: async (args)=>({ ok: true, summary: `ran ${args.name}` }),
	...over,
});

describe('注册层', ()=>{
	beforeEach(()=>{ __resetToolsForTests(); __resetLedgerForTests(); window.localStorage.clear(); });
	test('🔴 level 正向集合=read/additive;其它 level 抛', ()=>{
		expect(AGENT_TOOL_LEVELS).toEqual(['read', 'additive']);
		expect(()=>registerTool(okTool({ level: 'destructive' }))).toThrow();
		expect(()=>registerTool(okTool({ level: 'read' }))).not.toThrow();
	});
	test('🔴 删改类工具名一律拒注册(delete/remove/update/undo…)', ()=>{
		['delete_chart', 'remove_case', 'update_record', 'undo_action', 'clear_trash', 'restore_backup'].forEach((n)=>{
			expect(()=>registerTool(okTool({ name: n }))).toThrow();
		});
		expect(getTool('delete_chart')).toBeNull();
	});
	test('restore-settings 无 snapshot() 拒注册;有则可注册', ()=>{
		expect(()=>registerTool(okTool({ name: 'set_probe', undoKind: 'restore-settings' }))).toThrow();
		expect(()=>registerTool(okTool({ name: 'set_probe', undoKind: 'restore-settings', snapshot: ()=>({ a: 1 }) }))).not.toThrow();
	});
	test('manifest 纯 JSON 且带 annotations', ()=>{
		registerTool(okTool());
		const m = exportToolManifest();
		expect(JSON.parse(JSON.stringify(m))).toEqual(m);
		expect(m[0].annotations.destructiveHint).toBe(false);
		expect(m[0].annotations.readOnlyHint).toBe(false);
	});
});

describe('运行层守卫(判别力自证)', ()=>{
	beforeEach(()=>{ __resetToolsForTests(); __resetLedgerForTests(); window.localStorage.clear(); });
	test('guardAdditive 对 FORBIDDEN_ARG_KEYS 每键必红', ()=>{
		FORBIDDEN_ARG_KEYS.forEach((k)=>{
			expect(guardAdditive('probe_add', { [k]: 'x' }).ok).toBe(false);
		});
		expect(guardAdditive('probe_add', { name: 'x' }).ok).toBe(true);
		expect(FORBIDDEN_ARG_KEYS).toContain('cid');
	});
	test('🔴 带 cid 的调用 → E_FORBIDDEN_KEY 且 run 未执行、命盘库字节不变', async ()=>{
		upsertLocalChart({ cid: 'local-user-1', name: '用户自建', birth: '1990-01-01 08:00:00' });
		const before = window.localStorage.getItem(CHARTS_KEY);
		let ran = false;
		registerTool(okTool({ run: async ()=>{ ran = true; return { ok: true }; } }));
		// schema 层 removeAdditional 只剥未声明键;这里 cid 在 schema 里声明,靠运行层守卫拦
		const r = await runTool('probe_add', { name: 'x', cid: 'local-user-1' });
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_FORBIDDEN_KEY');
		expect(ran).toBe(false);
		expect(window.localStorage.getItem(CHARTS_KEY)).toBe(before);
	});
	test('未知工具 → E_TOOL_NOT_FOUND;参数不合规 → E_ARGS_INVALID', async ()=>{
		expect((await runTool('delete_chart', {})).code).toBe('E_TOOL_NOT_FOUND');
		registerTool(okTool({ inputSchema: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 1 } } } }));
		expect((await runTool('probe_add', {})).code).toBe('E_ARGS_INVALID');
	});
	test('additive 成功 → 账本一条含 undo;read 不进账本', async ()=>{
		registerTool(okTool());
		registerTool(okTool({ name: 'probe_read', level: 'read' }));
		const r = await runTool('probe_add', { name: 'a' }, { origin: 'mcp', clientName: 'codex' });
		expect(r.undo && r.undo.actionId).toMatch(/^act-/);
		await runTool('probe_read', { name: 'b' });
		const acts = listActions();
		expect(acts.length).toBe(1);
		expect(acts[0].origin).toBe('mcp');
		expect(acts[0].clientName).toBe('codex');
		expect(JSON.parse(window.localStorage.getItem(LEDGER_KEY)).length).toBe(1);
	});
});

describe('账本撤销', ()=>{
	beforeEach(()=>{ __resetToolsForTests(); __resetLedgerForTests(); window.localStorage.clear(); });
	test('🔴 撤销只认自己建的记录(aiOrigin.actionId 匹配):软删进回收站;外来 cid 必拒且记录仍在', ()=>{
		const rec = upsertLocalChart({ name: '助手建', birth: '1990-01-01 08:00:00', aiOrigin: { actionId: 'act-1', tool: 'create_chart_record' } });
		appendAction({ id: 'act-1', tool: 'create_chart_record', level: 'additive', args: {}, summary: 's', result: { ok: true }, undo: { kind: 'trash-record', payload: { store: 'chart', cid: rec.cid } } });
		const foreign = upsertLocalChart({ name: '用户自建', birth: '1991-01-01 08:00:00' });
		appendAction({ id: 'act-2', tool: 'create_chart_record', level: 'additive', args: {}, summary: 's', result: { ok: true }, undo: { kind: 'trash-record', payload: { store: 'chart', cid: foreign.cid } } });
		const bad = undoAction('act-2');
		expect(bad.ok).toBe(false); expect(bad.code).toBe('E_UNDO_NOT_APPLICABLE');
		expect(listLocalCharts().some((r)=>r.cid === foreign.cid)).toBe(true);
		const good = undoAction('act-1');
		expect(good.ok).toBe(true);
		expect(listLocalCharts().some((r)=>r.cid === rec.cid)).toBe(false);
		expect(listLocalChartsTrash().some((r)=>r.cid === rec.cid)).toBe(true);
		expect(listActions()[1].undone).toBe(true);
		expect(undoAction('act-1').code).toBe('E_ACTION_NOT_FOUND');
	});
	test('restore-settings 撤销经注入的 restoreSettings 回调;none 类不可撤', ()=>{
		appendAction({ id: 'act-s', tool: 'set_settings', level: 'additive', args: {}, summary: 's', result: { ok: true }, undo: { kind: 'restore-settings', payload: { facet: 'app', snapshot: { chartStyle: 'classic' } } } });
		const seen = [];
		expect(undoAction('act-s', { restoreSettings: (p)=>{ seen.push(p); return { ok: true }; } }).ok).toBe(true);
		expect(seen[0].snapshot.chartStyle).toBe('classic');
		appendAction({ id: 'act-n', tool: 'load_record_into_workspace', level: 'additive', args: {}, summary: 's', result: { ok: true }, undo: { kind: 'none' } });
		expect(undoAction('act-n').code).toBe('E_UNDO_NOT_APPLICABLE');
	});
});
