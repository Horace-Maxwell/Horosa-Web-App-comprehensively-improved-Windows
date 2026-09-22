// AI 助手·list_actions 工具合同:只读;缺省不含已撤销;按来源过滤;limit;不暴露参数全文;撤销权不在工具。
import def, { ACTION_ORIGINS } from '../aiTools/tools/listActions';
import { appendAction, __resetLedgerForTests } from '../aiTools/ledger';

function seed(){
	appendAction({ id: 'a1', tool: 'create_chart_record', level: 'additive', summary: '建档 张三', origin: 'in-app', undo: { kind: 'trash-record', cid: 'local-1' }, args: { name: '张三', memo: '私密备注' } });
	appendAction({ id: 'a2', tool: 'create_case_record', level: 'additive', summary: '建事盘', origin: 'mcp', clientName: 'codex', undo: { kind: 'trash-record', cid: 'local-2' }, args: { title: 'x' } });
	appendAction({ id: 'a3', tool: 'set_settings', level: 'additive', summary: '改设置', origin: 'in-app', undone: true, undo: { kind: 'restore-settings' }, args: {} });
	appendAction({ id: 'a4', tool: 'load_record_into_workspace', level: 'additive', summary: '载入', origin: 'goal', undo: { kind: 'none' }, args: { cid: 'local-1' } });
}

beforeEach(()=>{ window.localStorage.clear(); __resetLedgerForTests(); seed(); });

describe('list_actions', ()=>{
	it('目录形状:read/query/none;origin 枚举 = ACTION_ORIGINS;描述明写撤销只能用户点', ()=>{
		expect(def.name).toBe('list_actions');
		expect(def.level).toBe('read');
		expect(def.category).toBe('query');
		expect(def.undoKind).toBe('none');
		expect(def.inputSchema.properties.origin.enum).toEqual(ACTION_ORIGINS);
		expect(def.description).toContain('撤销只能由用户');
	});
	it('缺省:最新在前、不含已撤销、每条形状固定且不带 args 全文;total 计全部', async ()=>{
		const r = await def.run({});
		expect(r.ok).toBe(true);
		expect(r.data.items.map((x)=>x.actionId)).toEqual(['a4', 'a2', 'a1']);
		expect(r.data.total).toBe(4);
		expect(r.data.shown).toBe(3);
		r.data.items.forEach((x)=>{ expect(Object.keys(x).sort()).toEqual(['actionId', 'at', 'clientName', 'level', 'origin', 'summary', 'tool', 'undoKind', 'undone'].sort()); expect(x.args).toBeUndefined(); });
		expect(JSON.stringify(r)).not.toContain('私密备注');
		expect(r.data.items.find((x)=>x.actionId === 'a2')).toEqual(expect.objectContaining({ origin: 'mcp', clientName: 'codex', undoKind: 'trash-record', undone: false }));
		expect(r.data.items.find((x)=>x.actionId === 'a4').undoKind).toBe('none');
	});
	it('includeUndone 才含已撤销;origin 过滤;limit 截断', async ()=>{
		expect((await def.run({ includeUndone: true })).data.items.map((x)=>x.actionId)).toEqual(['a4', 'a3', 'a2', 'a1']);
		expect((await def.run({ origin: 'mcp' })).data.items.map((x)=>x.actionId)).toEqual(['a2']);
		expect((await def.run({ origin: 'in-app', includeUndone: true })).data.items.map((x)=>x.actionId)).toEqual(['a3', 'a1']);
		expect((await def.run({ origin: 'goal' })).data.items.map((x)=>x.actionId)).toEqual(['a4']);
		const lim = await def.run({ limit: 1 });
		expect(lim.data.items.length).toBe(1);
		expect(lim.data.shown).toBe(1);
		expect(lim.summary).toContain('1');
	});
	it('账本为空 → ok 且 items=[](不是错误)', async ()=>{
		__resetLedgerForTests();
		const r = await def.run({});
		expect(r.ok).toBe(true);
		expect(r.data.items).toEqual([]);
		expect(r.data.total).toBe(0);
	});
});
