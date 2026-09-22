// AI 助手·设置五面:describe/get/set 原子写入 + 快照撤销 + 密钥类硬拒。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { setGlobalStore } from '../storageutil';
import { getMountTechniqueDefault } from '../techniqueMountSettings';
import { getClassicalChartGlobals } from '../classicalChartGlobals';
import { geoPairToRecordFields } from '../aiTools/normalize/geoCompass';

let dispatch;
let changeCond;
const ctx = ()=>({ origin: 'in-app', requestId: 'r1', dispatch });

beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests();
	__resetLedgerForTests();
	__resetWorkspaceBridgeForTests();
	dispatch = jest.fn();
	changeCond = jest.fn();
	registerWorkspaceBridge({ dispatch, changeCond });
	setGlobalStore({
		app: { appearanceMode: 'light', colorTheme: 0, chartDisplay: [1, 2], showPdBounds: 0 },
		astro: { fields: { hsys: { value: 1 }, zodiacal: { value: 0 }, pos: { value: '北京' }, lat: { value: '39n54' } } },
	});
	registerBuiltinTools();
});

describe('describe_settings / get_settings', ()=>{
	it('app 面:可改项带 options/current,显示数组只读', async ()=>{
		const r = await runTool('describe_settings', { facet: 'app' }, ctx());
		expect(r.ok).toBe(true);
		const ap = r.data.items.find((it)=>it.key === 'appearanceMode');
		expect(ap.current).toBe('light');
		expect(ap.options.map((o)=>o.value)).toContain('dark');
		const ro = r.data.items.find((it)=>it.key === 'chartDisplay');
		expect(ro.settable).toBe(false);
		const g = await runTool('get_settings', { facet: 'app' }, ctx());
		expect(g.data.values.appearanceMode).toBe('light');
	});
	it('chart 面读 fields 现值;mount 面读技法 schema;technique 面非本地类拒', async ()=>{
		const c = await runTool('describe_settings', { facet: 'chart' }, ctx());
		expect(c.data.items.find((it)=>it.key === 'hsys').current).toBe(1);
		expect(c.data.items.find((it)=>it.key === 'place').current).toBe('北京');
		const m = await runTool('describe_settings', { facet: 'mount', technique: 'bazi' }, ctx());
		expect(m.ok).toBe(true);
		expect(m.data.items.find((it)=>it.key === 'phaseType').options.length).toBe(3);
		const t = await runTool('describe_settings', { facet: 'technique', technique: 'bazi' }, ctx());
		expect(t.ok).toBe(false);
		expect(t.code).toBe('E_SETTING_KEY_NOT_ALLOWED');
	});
});

describe('set_settings · app 面', ()=>{
	it('🔴 密钥类硬拒且零派发;非白名单键整体拒(原子)', async ()=>{
		const r = await runTool('set_settings', { facet: 'app', values: { apiKey: 'sk-x' } }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_SETTING_KEY_NOT_ALLOWED');
		const r2 = await runTool('set_settings', { facet: 'app', values: { appearanceMode: 'dark', bogus: 1 } }, ctx());
		expect(r2.ok).toBe(false);
		const r3 = await runTool('set_settings', { facet: 'app', values: { appearanceMode: 'dark', colorTheme: 999 } }, ctx());
		expect(r3.ok).toBe(false);
		expect(r3.code).toBe('E_SETTING_VALUE_INVALID');
		expect(dispatch).not.toHaveBeenCalled();
	});
	it('合法值 → app/save 派发;快照=改前值;撤销回灌', async ()=>{
		const r = await runTool('set_settings', { facet: 'app', values: { appearanceMode: 'dark', showPdBounds: true } }, ctx());
		expect(r.ok).toBe(true);
		expect(dispatch).toHaveBeenCalledWith({ type: 'app/save', payload: { appearanceMode: 'dark', showPdBounds: 1 } });
		expect(r.undo.kind).toBe('restore-settings');
		expect(r.data.before).toEqual({ appearanceMode: 'light', showPdBounds: 0 });
		dispatch.mockClear();
		const u = undoAction(r.undo.actionId);
		expect(u.ok).toBe(true);
		expect(dispatch).toHaveBeenCalledWith({ type: 'app/save', payload: { appearanceMode: 'light', showPdBounds: 0 } });
	});
	it('日界点改动同时广播事件(与设置面同款)', async ()=>{
		const seen = [];
		const h = (e)=>seen.push(e.detail);
		window.addEventListener('horosa:day-boundary-changed', h);
		try{
			const r = await runTool('set_settings', { facet: 'app', values: { dayBoundary: '24 点换日' } }, ctx());
			expect(r.ok).toBe(true);
			expect(seen.length).toBe(1);
			expect(seen[0].after23NewDay).toBe(0);
		}finally{ window.removeEventListener('horosa:day-boundary-changed', h); }
	});
});

describe('set_settings · chart 面(走 changeCond 正门)', ()=>{
	it('宫制改整宫 → changeCond({hsys:0,confirmed:true});撤销回灌 hsys:1', async ()=>{
		const r = await runTool('set_settings', { facet: 'chart', values: { hsys: 0 } }, ctx());
		expect(r.ok).toBe(true);
		expect(changeCond).toHaveBeenCalledWith({ hsys: 0, confirmed: true });
		changeCond.mockClear();
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		const patch = changeCond.mock.calls[0][0];
		expect(patch.hsys).toBe(1);
		expect(patch.confirmed).toBe(true);
	});
	it('地名改动 → 经纬/罗盘串/pos 一并进 changeCond', async ()=>{
		const r = await runTool('set_settings', { facet: 'chart', values: { place: '上海' } }, ctx());
		expect(r.ok).toBe(true);
		const patch = changeCond.mock.calls[0][0];
		expect(patch.pos).toBe('上海');
		expect(typeof patch.gpsLat).toBe('number');
		expect(patch.lat).toBe(geoPairToRecordFields(patch.gpsLat, patch.gpsLon).lat);
		expect(patch.lon).toBe(geoPairToRecordFields(patch.gpsLat, patch.gpsLon).lon);
		expect(patch.lat).toMatch(/^31n1\d$/);
	});
	it('桥未注册 → E_BRIDGE_UNAVAILABLE 零写入', async ()=>{
		__resetWorkspaceBridgeForTests();
		const r = await runTool('set_settings', { facet: 'chart', values: { hsys: 0 } }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_BRIDGE_UNAVAILABLE');
	});
});

describe('set_settings · mount / classical 面', ()=>{
	it('mount:合法值合并写入;非法值整体拒且键不变;撤销回到 prior', async ()=>{
		const before = { ...(getMountTechniqueDefault('bazi') || {}) };
		const bad = await runTool('set_settings', { facet: 'mount', technique: 'bazi', values: { phaseType: 99 } }, ctx());
		expect(bad.ok).toBe(false);
		expect({ ...(getMountTechniqueDefault('bazi') || {}) }).toEqual(before);
		const r = await runTool('set_settings', { facet: 'mount', technique: 'bazi', values: { phaseType: 1 } }, ctx());
		expect(r.ok).toBe(true);
		expect(getMountTechniqueDefault('bazi').phaseType).toBe(1);
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect({ ...(getMountTechniqueDefault('bazi') || {}) }).toEqual(before);
	});
	it('classical:写入全局并可撤销', async ()=>{
		const d = await runTool('describe_settings', { facet: 'classical' }, ctx());
		const item = d.data.items.find((it)=>it.key === 'leoBoundFirst');
		expect(item).toBeTruthy();
		const prior = getClassicalChartGlobals().leoBoundFirst;
		const target = prior === 1 ? 0 : 1;
		const r = await runTool('set_settings', { facet: 'classical', values: { leoBoundFirst: target } }, ctx());
		expect(r.ok).toBe(true);
		expect(getClassicalChartGlobals().leoBoundFirst).toBe(target);
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(getClassicalChartGlobals().leoBoundFirst).toBe(prior);
	});
});
