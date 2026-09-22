// AI 助手·对抗评审回归:出生文本九处误解 / 设置撤销三病 / 时区后缀 / 起盘串行 / 账本刷新。每条都是评审实抓。
import { parseBirthInput } from '../aiTools/normalize/birthText';
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { snapshotFacet, validateFacetValues, restoreSettingsSnapshot, describeFacet } from '../aiTools/settingsFacets';
import { setGlobalStore } from '../storageutil';
import { listLocalCharts } from '../localcharts';

function ok(text, opts){ const r = parseBirthInput(text, opts); expect(r.ok).toBe(true); return r; }

describe('出生文本(评审实抓)', ()=>{
	it('凌晨12点 = 00:00;AM/PM 生效;12 AM = 00:00', ()=>{
		expect(ok('1990-01-01 凌晨12点').birth).toBe('1990-01-01 00:00:00');
		expect(ok('1990-01-01 8:30 PM').birth).toBe('1990-01-01 20:30:00');
		expect(ok('1990-01-01 8:30pm').birth).toBe('1990-01-01 20:30:00');
		expect(ok('1990-01-01 12:00 AM').birth).toBe('1990-01-01 00:00:00');
		expect(ok('1990-01-01 12:00 PM').birth).toBe('1990-01-01 12:00:00');
	});
	it('「1990年5月 8点」的 8 不是日:无日 → 无法解析(timeUnknown 也不落错档)', ()=>{
		expect(parseBirthInput('1990年5月 8点', { timeUnknown: true }).ok).toBe(false);
		expect(parseBirthInput('1990年5月 8点').ok).toBe(false);
		expect(ok('1990年5月8日 8点').birth).toBe('1990-05-08 08:00:00');
	});
	it('DD/MM/YYYY 与 MM/DD/YYYY:可判别的判对,歧义的拒;两位年拒', ()=>{
		expect(ok('25/02/1990 08:00').birth).toBe('1990-02-25 08:00:00');
		expect(ok('02/25/1990 08:00').birth).toBe('1990-02-25 08:00:00');
		expect(ok('1.1.1990 08:00').birth).toBe('1990-01-01 08:00:00');
		const amb = parseBirthInput('01/02/1990 08:00');
		expect(amb.ok).toBe(false);
		expect(amb.assumptions.join('')).toMatch(/歧义/);
		expect(parseBirthInput('90年5月1日 08:00').ok).toBe(false);
	});
	it('公元前日期合法性;秒越界拒;显式时区后缀作 zoneHint;「下午时候三点」= 15:00', ()=>{
		expect(parseBirthInput('前100年2月30日 0:00').ok).toBe(false);
		expect(ok('前101年2月29日 0:00').birth).toBe('-0101-02-29 00:00:00');   // BC 101 闰(儒略)
		expect(parseBirthInput('前100年2月29日 0:00').ok).toBe(false);
		expect(parseBirthInput('1990-01-01 08:30:99').ok).toBe(false);
		expect(parseBirthInput('1990-01-01 08:30:99').code).toBe('E_BIRTH_UNPARSEABLE');
		const tz = ok('1990-01-01T08:30:00+09:00');
		expect(tz.birth).toBe('1990-01-01 08:30:00');
		expect(tz.zoneHint).toBe('+09:00');
		expect(ok('1990-01-01 08:30Z').zoneHint).toBe('+00:00');
		expect(ok('1990年1月1日下午时候三点').birth).toBe('1990-01-01 15:00:00');
		expect(ok('1990年1月1日午时').birth).toBe('1990-01-01 12:00:00');
		expect(ok('1990年1月1日 中午12点').birth).toBe('1990-01-01 12:00:00');
	});
	it('zoneHint 进建档:用户未明说时区时取串后缀', async ()=>{
		window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
		registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
		registerBuiltinTools();
		const r = await runTool('create_chart_record', { name: '甲', birth: '1990-01-01T08:30:00+09:00', place: '北京' }, { origin: 'in-app', dispatch: jest.fn(), ui: {} });
		expect(r.ok).toBe(true);
		expect(listLocalCharts({})[0].zone).toBe('+09:00');
		expect(r.assumptions.some((a)=>/后缀/.test(a))).toBe(true);
	});
});

describe('设置撤销(评审实抓)', ()=>{
	let dispatch; let changeCond;
	beforeEach(()=>{
		window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
		dispatch = jest.fn(); changeCond = jest.fn();
		registerWorkspaceBridge({ dispatch, changeCond });
		setGlobalStore({ app: { appearanceMode: 'light', termsVariant: 2, dayBoundary: '23 点换日' }, astro: { fields: { hsys: { value: 1 }, name: { value: '甲' } } }, user: { currentChart: { cid: { value: 'local-A' } } } });
		registerBuiltinTools();
	});
	it('写前不存在的键也能撤回:快照记有效值(全局值/规格默认),回灌显式写回', async ()=>{
		const r = await runTool('set_settings', { facet: 'chart', values: { termsVariant: '1' } }, { origin: 'in-app' });
		expect(r.ok).toBe(true);
		expect(r.undo.kind).toBe('restore-settings');
		changeCond.mockClear();
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		const patch = changeCond.mock.calls[0][0];
		expect(patch.termsVariant).toBe(2);   // 回到全局值,而不是保持 AI 写入的 1
		expect(JSON.parse(JSON.stringify(snapshotFacet('chart'))).snapshot.termsVariant).toBe(2);
	});
	it('工作区换了盘 → 回灌拒(E_UNDO_RECORD_CHANGED),不把 A 盘旧口径写进 B 盘', async ()=>{
		const r = await runTool('set_settings', { facet: 'chart', values: { hsys: 0 } }, { origin: 'in-app' });
		setGlobalStore({ app: {}, astro: { fields: { hsys: { value: 0 }, name: { value: '乙' } } }, user: { currentChart: { cid: { value: 'local-B' } } } });
		changeCond.mockClear();
		const u = undoAction(r.undo.actionId);
		expect(u.ok).toBe(false);
		expect(u.code).toBe('E_UNDO_RECORD_CHANGED');
		expect(changeCond).not.toHaveBeenCalled();
	});
	it('app 面撤销同样广播日界点/晚子时事件', async ()=>{
		const seen = [];
		const h = (e)=>seen.push(e.detail.after23NewDay);
		window.addEventListener('horosa:day-boundary-changed', h);
		try{
			const r = await runTool('set_settings', { facet: 'app', values: { dayBoundary: '24 点换日' } }, { origin: 'in-app' });
			expect(r.ok).toBe(true);
			expect(seen).toEqual([0]);
			expect(undoAction(r.undo.actionId).ok).toBe(true);
			expect(seen).toEqual([0, 1]);
		}finally{ window.removeEventListener('horosa:day-boundary-changed', h); }
	});
	it('只给一半经纬度 / 地名与经纬同给 → 整体拒,不再静默 no-op 报「已修改」', ()=>{
		expect(validateFacetValues('chart', undefined, { gpsLon: 116.4 }).ok).toBe(false);
		expect(validateFacetValues('chart', undefined, { gpsLat: 39.9, gpsLon: 116.4, place: '北京' }).ok).toBe(false);
		expect(validateFacetValues('chart', undefined, { gpsLat: 39.9, gpsLon: 116.4 }).ok).toBe(true);
	});
	it('describe:校验器不认的字段类型不标可改', ()=>{
		const d = describeFacet('mount', 'bazi');
		d.items.forEach((it)=>{ if(['multiselect', 'date', 'datetime', 'time'].indexOf(it.type) >= 0){ expect(it.settable).toBe(false); } });
	});
	it('restoreSettingsSnapshot 直接吃注册表兜底形状({facet,technique,snapshot})', ()=>{
		expect(restoreSettingsSnapshot({ facet: 'app', snapshot: { appearanceMode: 'light' } }).ok).toBe(true);
		expect(dispatch).toHaveBeenCalledWith({ type: 'app/save', payload: { appearanceMode: 'light' } });
	});
});

describe('账本撤销后刷新', ()=>{
	it('撤销建档 → 派发 user/fetchCharts 并调 bridge.ui.refreshSources', async ()=>{
		window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
		const dispatch = jest.fn(); const refreshSources = jest.fn();
		registerWorkspaceBridge({ dispatch, changeCond: jest.fn(), ui: { refreshSources } });
		registerBuiltinTools();
		const r = await runTool('create_chart_record', { name: '丙', birth: '1990-01-01 08:00', gpsLat: 30, gpsLon: 120 }, { origin: 'in-app', dispatch, ui: {} });
		dispatch.mockClear();
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(dispatch).toHaveBeenCalledWith({ type: 'user/fetchCharts', payload: {} });
		expect(refreshSources).toHaveBeenCalled();
	});
});
