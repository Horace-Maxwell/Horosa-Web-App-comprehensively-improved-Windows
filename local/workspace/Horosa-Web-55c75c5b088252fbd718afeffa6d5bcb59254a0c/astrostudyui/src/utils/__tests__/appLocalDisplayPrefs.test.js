// 应用级显示项界面简繁经工作区桥读写(工具层不导入显示层)、亮色配色档直写;都进账本可撤销,不进 app/save。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests, undoAction } from '../aiTools/ledger';
import { setGlobalStore } from '../storageutil';
import { setAgentEnabled } from '../aiAgent/prefs';
import { currentLightFlavor } from '../appearance';

let script; let dispatch;
const ctx = ()=>({ origin: 'in-app', requestId: 'r9', dispatch });
beforeEach(()=>{
	window.localStorage.clear(); document.documentElement.removeAttribute('data-horosa-light-flavor');
	__resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	script = 'hans';
	dispatch = jest.fn();
	setGlobalStore({ app: {}, astro: { fields: {} } });
	registerWorkspaceBridge({ dispatch, changeCond: jest.fn(), scriptModeRead: ()=>script, scriptModeWrite: jest.fn(async (m)=>{ script = m; return { mode: m, persisted: true }; }) });
	setAgentEnabled(true);
	registerBuiltinTools();
});

test('简繁 + 配色档:写入走各自通道、不进 app/save;撤销还原', async ()=>{
	const r = await runTool('set_settings', { facet: 'app', values: { scriptMode: 'hant', lightFlavor: 'classic' } }, ctx());
	expect(r.ok).toBe(true);
	expect(script).toBe('hant');
	expect(currentLightFlavor()).toBe('classic');
	expect(dispatch.mock.calls.filter((c)=>c[0] && c[0].type === 'app/save')).toEqual([]);
	expect((await undoAction(r.undo.actionId)).ok).toBe(true);
	expect(script).toBe('hans');
	expect(currentLightFlavor()).toBe('paper');
});
test('describe 列出两项与当前值;坏值拒', async ()=>{
	const d = await runTool('describe_settings', { facet: 'app' }, ctx());
	const keys = (d.data.items || []).map((x)=>x.key);
	expect(keys).toEqual(expect.arrayContaining(['scriptMode', 'lightFlavor']));
	expect(d.data.items.find((x)=>x.key === 'scriptMode').current).toBe('hans');
	expect((await runTool('set_settings', { facet: 'app', values: { scriptMode: 'xx' } }, ctx())).ok).toBe(false);
});
