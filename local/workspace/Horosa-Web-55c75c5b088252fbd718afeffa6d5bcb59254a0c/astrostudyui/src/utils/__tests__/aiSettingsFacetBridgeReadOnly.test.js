// 要工作区桥才写得了的设置面:桥缺(无头 / 页面未就绪)时,当前盘口径整面只读;全局显示偏好里纯界面项逐项只读(原因同写入拒绝),
// 起盘 / 快照会读的几项(APP_DIRECT_KEYS)直写全局设置单源、可撤销 —— 判据同一个 facetBridgeBlock;其余面不受桥影响。
import fs from 'fs';
import path from 'path';
import { registerBuiltinTools } from '../aiTools';
import { getTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge } from '../aiTools/workspaceBridge';
import { facetBridgeBlock, describeFacet, validateFacetValues, SETTING_FACETS, APP_DIRECT_KEYS } from '../aiTools/settingsFacets';
import { readStoredGlobalSetup, __resetGlobalSetupMirrorForTest } from '../globalSetupStore';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { setAgentEnabled } from '../aiAgent/prefs';

const SAMPLE = { chart: { hsys: 0 }, app: { wheelArt: 'hellenistic' } };
const BRIDGES = {
	none: { changeCond: undefined, dispatch: undefined },
	changeCondOnly: { changeCond: ()=>{}, dispatch: undefined },
	dispatchOnly: { changeCond: undefined, dispatch: ()=>{} },
	both: { changeCond: ()=>{}, dispatch: ()=>{} },
};

beforeEach(()=>{ window.localStorage.clear(); __resetGlobalSetupMirrorForTest(); __resetLedgerForTests(); __resetToolsForTests(); setAgentEnabled(true); registerBuiltinTools(); registerWorkspaceBridge(BRIDGES.none); });
afterEach(()=>setAgentEnabled(false));
afterAll(()=>{ registerWorkspaceBridge(BRIDGES.none); });

test('🔴 缺桥:当前盘整面只读;全局显示纯界面项逐项只读、起盘会读的几项照常可写;校验与写入同一句拒绝', async ()=>{
	const blk = facetBridgeBlock('chart');
	expect(blk && blk.code).toBe('E_BRIDGE_UNAVAILABLE');
	const d = describeFacet('chart');
	expect(d.readOnly).toEqual(blk);
	expect(d.items.every((it)=>it.settable === false && it.hint === blk.message)).toBe(true);
	const desc = await getTool('describe_settings').run({ facet: 'chart' });
	expect([desc.ok, desc.data.writable, desc.data.readOnlyReason]).toEqual([true, false, blk.message]);
	const v = validateFacetValues('chart', undefined, SAMPLE.chart);
	expect([v.ok, v.code, v.message]).toEqual([false, 'E_BRIDGE_UNAVAILABLE', blk.message]);
	expect(await getTool('set_settings').preview({ facet: 'chart', values: SAMPLE.chart })).toBe(null);

	const ablk = facetBridgeBlock('app');
	expect(ablk.message).toContain('无头');
	const a = describeFacet('app');
	expect(a.readOnly).toBeUndefined();
	const byKey = Object.fromEntries(a.items.map((it)=>[it.key, it]));
	APP_DIRECT_KEYS.forEach((k)=>expect([k, byKey[k] && byKey[k].settable]).toEqual([k, true]));
	expect([byKey.wheelArt.settable, byKey.wheelArt.hint]).toEqual([false, ablk.message]);
	const adesc = await getTool('describe_settings').run({ facet: 'app' });
	expect(adesc.data.writable).not.toBe(false);
	const w = await getTool('set_settings').run({ facet: 'app', values: SAMPLE.app });   // 纯界面项:如实拒
	expect([w.ok, w.code, w.message]).toEqual([false, 'E_BRIDGE_UNAVAILABLE', ablk.message]);
	const mixed = await getTool('set_settings').run({ facet: 'app', values: { dayBoundary: 'after24', wheelArt: 'hellenistic' } });   // 混写:整次拒,一键不写
	expect(mixed.code).toBe('E_BRIDGE_UNAVAILABLE');
	expect(readStoredGlobalSetup()).toBe(null);
});

test('🔴 缺桥时起盘会读的几项直写全局设置单源;撤销还原;之后读数一致', async ()=>{
	const ctx = { origin: 'mcp', requestId: 'direct-1' };
	const w = await getTool('set_settings').run({ facet: 'app', values: { voidClassical: 1, zeriSnapshotMaxRows: 30 } }, ctx);
	expect(w.ok).toBe(true);
	const stored = readStoredGlobalSetup();
	expect([stored.voidClassical, stored.zeriSnapshotMaxRows]).toEqual([1, 30]);
	const now = describeFacet('app').items.filter((it)=>it.key === 'voidClassical' || it.key === 'zeriSnapshotMaxRows').map((it)=>[it.key, it.current]);
	expect(now).toEqual([['voidClassical', 1], ['zeriSnapshotMaxRows', 30]]);
	const { runTool } = require('../aiTools/registry');
	const r = await runTool('set_settings', { facet: 'app', values: { dayBoundary: 'after24' } }, { origin: 'mcp', requestId: 'direct-2' });
	expect(r.ok).toBe(true);
	expect(readStoredGlobalSetup().dayBoundary).toBe('after24');
	const u = undoAction(r.undo.actionId);
	expect(u && u.ok).toBe(true);
	expect(readStoredGlobalSetup().dayBoundary).toBe(undefined);
});

test('🔴 同一判据:四种桥状态 —— 当前盘看 changeCond 整面;全局显示看 dispatch,缺时纯界面项拒、桥在时全可改', async ()=>{
	const rows = [];
	for(const [state, bridge] of Object.entries(BRIDGES)){
		registerWorkspaceBridge(bridge);
		for(const facet of ['chart', 'app']){
			const blocked = !!facetBridgeBlock(facet);
			const desc = await getTool('describe_settings').run({ facet });
			const w = await getTool('set_settings').run({ facet, values: SAMPLE[facet] });
			rows.push([state, facet, blocked]);
			expect([state, facet, w.code === 'E_BRIDGE_UNAVAILABLE']).toEqual([state, facet, blocked]);
			expect([state, facet, desc.data.writable !== false]).toEqual([state, facet, facet === 'app' || !blocked]);
			expect(describeFacet(facet).items.some((it)=>it.settable === true)).toBe(facet === 'app' || !blocked);
		}
	}
	expect(rows.filter((r)=>r[2]).map((r)=>`${r[0]}:${r[1]}`).sort()).toEqual(['changeCondOnly:app', 'dispatchOnly:chart', 'none:app', 'none:chart']);
	registerWorkspaceBridge(BRIDGES.none);
	SETTING_FACETS.filter((f)=>f !== 'chart' && f !== 'app').forEach((f)=>expect([f, facetBridgeBlock(f)]).toEqual([f, null]));
	expect(describeFacet('classical').readOnly).toBeUndefined();
});

test('源码锁:设置面里缺桥判断只走 facetBridgeBlock(不许再手写 typeof bridge.* 判据)', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', 'aiTools', 'settingsFacets.js'), 'utf8');
	expect(src).not.toMatch(/typeof\s+(bridge\.)?(changeCond|dispatch)\s*!==\s*'function'/);
	expect((src.match(/facetBridgeBlock\(/g) || []).length).toBeGreaterThanOrEqual(7);
});
