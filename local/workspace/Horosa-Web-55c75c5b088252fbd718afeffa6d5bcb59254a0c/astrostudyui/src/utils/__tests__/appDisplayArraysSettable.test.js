// 星盘三个显示数组(盘面显示项 / 显示星体 / 显示希腊点)经 set_settings facet=app 整组替换:每个值须在星盘设置面板同一张可选表里
// (按值或中文名认),去重按档序;盘面显示项里面板不列的位(3D / 盘内信息)原样保留;可撤销;没有界面时如实只读(纯显示项)。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { setGlobalStore } from '../storageutil';
import { setAgentEnabled } from '../aiAgent/prefs';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';

let store;
let dispatch;
const ctx = ()=>({ origin: 'mcp', requestId: 'arr-1' });
beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	store = { app: { chartDisplay: [AstroConst.CHART_PLANETS, AstroConst.CHART_INFOINCIRCLE], planetDisplay: [AstroConst.SUN, AstroConst.MOON], lotsDisplay: [] } };
	dispatch = jest.fn((a)=>{ if(a && a.type === 'app/save'){ store.app = { ...store.app, ...a.payload }; } });
	registerWorkspaceBridge({ dispatch, changeCond: ()=>{} });
	setGlobalStore(store);
	setAgentEnabled(true); registerBuiltinTools();
});
afterEach(()=>setAgentEnabled(false));

test('整组替换:按中文名或值认、去重按档序;不认的值整次拒;撤销回到写前', async ()=>{
	const moonLabel = AstroText.AstroTxtMsg[AstroConst.MOON];
	const r = await runTool('set_settings', { facet: 'app', values: { planetDisplay: [AstroConst.MARS, moonLabel, AstroConst.SUN, AstroConst.SUN] } }, ctx());
	expect(r.ok).toBe(true);
	expect(store.app.planetDisplay).toEqual([AstroConst.SUN, AstroConst.MOON, AstroConst.MARS]);
	const bad = await runTool('set_settings', { facet: 'app', values: { planetDisplay: ['NotAPlanet'] } }, ctx());
	expect(bad.ok).toBe(false);
	expect(store.app.planetDisplay).toEqual([AstroConst.SUN, AstroConst.MOON, AstroConst.MARS]);
	expect(undoAction(r.undo.actionId).ok).toBe(true);
	expect(store.app.planetDisplay).toEqual([AstroConst.SUN, AstroConst.MOON]);
});

test('盘面显示项:面板不列的位(盘内信息 / 3D)整组替换时原样保留,且写它本身被拒', async ()=>{
	const r = await runTool('set_settings', { facet: 'app', values: { chartDisplay: [AstroConst.CHART_ASP_LINES] } }, ctx());
	expect(r.ok).toBe(true);
	expect(store.app.chartDisplay).toEqual([AstroConst.CHART_ASP_LINES, AstroConst.CHART_INFOINCIRCLE]);
	const hidden = await runTool('set_settings', { facet: 'app', values: { chartDisplay: [AstroConst.CHART_3D_EARTH] } }, ctx());
	expect(hidden.ok).toBe(false);
	const lots = await runTool('set_settings', { facet: 'app', values: { lotsDisplay: [AstroConst.PARS_SPIRIT] } }, ctx());
	expect(lots.ok).toBe(true);
	expect(store.app.lotsDisplay).toEqual([AstroConst.PARS_SPIRIT]);
});

test('没有界面:三个数组是纯显示项,如实只读(原因同写入拒绝)', async ()=>{
	__resetWorkspaceBridgeForTests();
	setGlobalStore(null);
	const d = await runTool('describe_settings', { facet: 'app' }, ctx());
	const it = d.data.items.find((x)=>x.key === 'planetDisplay');
	expect(it.settable).toBe(false);
	const w = await runTool('set_settings', { facet: 'app', values: { planetDisplay: [AstroConst.SUN] } }, ctx());
	expect([w.ok, w.code, w.message]).toEqual([false, 'E_BRIDGE_UNAVAILABLE', it.hint]);
});
