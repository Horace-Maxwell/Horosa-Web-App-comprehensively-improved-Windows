// AI 助手·设置撤销只管本次改的键:写前只记改到的键(写前值 + 写后值),撤销逐键核对「当前值 == 写后值」才还原、只还原这几个键。
// 判据全部是真实输入 → 真实输出:助手改 A → 用户手改同面 B → 撤销只还原 A、B 保留;助手改 A → 用户又改 A → 撤销被拒且一键不动;
// 两次助手改动按任意顺序撤销互不串改(mount 面删键例外:要求同类默认整张没再变过,之后同一技法又改过请倒序撤)。六面里 app / chart 经假桥(与真页面同口径落值),mount / page / technique / classical 走真存储。
// 另:数值项只收有限数字或纯数字串(null / '' / 数组 / 布尔不再被转成数字收下)、有上下限的必须校验、文本项限长;起卦输入键不可改。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { undoAction, listActions, __resetLedgerForTests } from '../aiTools/ledger';
import { describeFacet, preparePageFacet, __resetPageFacetCacheForTests, SETTING_TEXT_MAX } from '../aiTools/settingsFacets';
import { setGlobalStore } from '../storageutil';
import { getMountTechniqueDefault, saveMountTechniqueDefaults, getTechniqueSettingsSchema } from '../techniqueMountSettings';
import { getClassicalChartGlobals, setClassicalChartGlobal } from '../classicalChartGlobals';
import { CAST_INPUT_KEYS } from '../aiTools/castInputKeys';

let store;
let dispatch;
let changeCond;
const ctx = ()=>({ origin: 'mcp', requestId: 'r-undo', dispatch });
const set = (facet, values, technique)=>runTool('set_settings', { facet, values, ...(technique ? { technique } : {}) }, ctx());
const payloadOf = (actionId)=>listActions().find((a)=>a.id === actionId).undo.payload;

beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); __resetPageFacetCacheForTests();
	store = {
		app: { appearanceMode: 'light', chartStyle: 0, showPdBounds: 0, zeriSnapshotMaxRows: 50 },
		astro: { fields: { hsys: { value: 1 }, zodiacal: { value: 0 }, pos: { value: '北京' }, lat: { value: '39n54' }, lon: { value: '116e24' }, gpsLat: { value: 39.9 }, gpsLon: { value: 116.4 }, name: { value: '甲' } } },
		user: { currentChart: { cid: { value: 'local-A' } } },
	};
	dispatch = jest.fn((a)=>{ if(a && a.type === 'app/save'){ store.app = { ...store.app, ...a.payload }; } });
	changeCond = jest.fn((patch)=>{ const f = { ...store.astro.fields }; Object.keys(patch || {}).forEach((k)=>{ if(k !== 'confirmed'){ f[k] = { value: patch[k] }; } }); store.astro = { ...store.astro, fields: f }; });
	registerWorkspaceBridge({ dispatch, changeCond });
	setGlobalStore(store);
	registerBuiltinTools();
});

// 用户在设置面板里亲手改(不经助手、不进账本)
const userSetApp = (values)=>{ store.app = { ...store.app, ...values }; };
const optionsOf = (facet, technique, key)=>describeFacet(facet, technique).items.find((it)=>it.key === key).options.map((o)=>o.value);
const otherThan = (list, v)=>list.find((x)=>`${x}` !== `${v}`);

describe('app 面', ()=>{
	it('🔴 助手改 A → 用户手改同面 B → 撤销只还原 A、B 保留(回灌载荷只含 A)', async ()=>{
		const r = await set('app', { appearanceMode: 'dark' });
		expect(r.ok).toBe(true);
		expect(payloadOf(r.undo.actionId).keys).toEqual(['appearanceMode']);
		userSetApp({ chartStyle: 1 });
		dispatch.mockClear();
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch).toHaveBeenCalledWith({ type: 'app/save', payload: { appearanceMode: 'light' } });
		expect(store.app.appearanceMode).toBe('light');
		expect(store.app.chartStyle).toBe(1);
	});
	it('🔴 助手改 A → 用户又改 A → 撤销被拒(E_UNDO_RECORD_CHANGED)、一键不动、动作仍可见未撤销', async ()=>{
		const r = await set('app', { appearanceMode: 'dark' });
		userSetApp({ appearanceMode: 'system' });
		dispatch.mockClear();
		const u = undoAction(r.undo.actionId);
		expect(u.ok).toBe(false);
		expect(u.code).toBe('E_UNDO_RECORD_CHANGED');
		expect(dispatch).not.toHaveBeenCalled();
		expect(store.app.appearanceMode).toBe('system');
		expect(listActions().find((a)=>a.id === r.undo.actionId).undone).toBe(false);
	});
	it('🔴 两次助手改动(A 再 B)按任意顺序撤销互不串改', async ()=>{
		for(const order of [['a', 'b'], ['b', 'a']]){
			userSetApp({ appearanceMode: 'light', showPdBounds: 0 });
			const ra = await set('app', { appearanceMode: 'dark' });   // eslint-disable-line no-await-in-loop
			const rb = await set('app', { showPdBounds: 1 });   // eslint-disable-line no-await-in-loop
			expect(store.app).toEqual(expect.objectContaining({ appearanceMode: 'dark', showPdBounds: 1 }));
			const ids = { a: ra.undo.actionId, b: rb.undo.actionId };
			expect(undoAction(ids[order[0]]).ok).toBe(true);
			// 撤第一次只动它自己的键
			expect(store.app.appearanceMode).toBe(order[0] === 'a' ? 'light' : 'dark');
			expect(store.app.showPdBounds).toBe(order[0] === 'b' ? 0 : 1);
			expect(undoAction(ids[order[1]]).ok).toBe(true);
			expect(store.app).toEqual(expect.objectContaining({ appearanceMode: 'light', showPdBounds: 0 }));
		}
	});
	it('同一键被两次改动:先撤后一次再撤前一次 → 都回到原值;先撤前一次 → 拒(后一次的写后值盖着它)', async ()=>{
		const r1 = await set('app', { appearanceMode: 'dark' });
		const r2 = await set('app', { appearanceMode: 'system' });
		expect(undoAction(r1.undo.actionId).code).toBe('E_UNDO_RECORD_CHANGED');
		expect(store.app.appearanceMode).toBe('system');
		expect(undoAction(r2.undo.actionId).ok).toBe(true);
		expect(store.app.appearanceMode).toBe('dark');
		expect(undoAction(r1.undo.actionId).ok).toBe(true);
		expect(store.app.appearanceMode).toBe('light');
	});
});

describe('chart 面', ()=>{
	it('🔴 快照只记本次改的键(不再整张记 14 键含地点);助手改宫制 → 用户改黄道 → 撤销只回灌宫制', async ()=>{
		const r = await set('chart', { hsys: 0 });
		const p = payloadOf(r.undo.actionId);
		expect(p.keys).toEqual(['hsys']);
		expect(Object.keys(p.snapshot)).toEqual(['hsys']);
		changeCond({ zodiacal: 1, lat: '31n14', pos: '上海', confirmed: true });   // 用户自己改了黄道与地点
		changeCond.mockClear();
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(changeCond).toHaveBeenCalledWith({ hsys: 1, confirmed: true, fromAgent: true });   // 撤销 AI 改动同样不记新盘缺省
		expect(store.astro.fields.zodiacal.value).toBe(1);
		expect(store.astro.fields.pos.value).toBe('上海');
	});
	it('地点改动只记经纬四键 + pos + 时区(时区随地点换);用户之后又改了地点 → 撤销被拒', async ()=>{
		const r = await set('chart', { gpsLat: 30, gpsLon: 120 });
		expect(payloadOf(r.undo.actionId).keys.slice().sort()).toEqual(['gpsLat', 'gpsLon', 'lat', 'lon', 'pos', 'zone']);
		changeCond({ gpsLat: 22.5, confirmed: true });
		changeCond.mockClear();
		expect(undoAction(r.undo.actionId).code).toBe('E_UNDO_RECORD_CHANGED');
		expect(changeCond).not.toHaveBeenCalled();
	});
});

describe('mount 面(真存储)', ()=>{
	it('🔴 按键合并还原:助手改 A → 用户在挂载卡改同技法的 B → 撤销只还原 A、B 保留;写前没有的键撤销即删键', async ()=>{
		const phase = optionsOf('mount', 'bazi', 'phaseType');
		const god = optionsOf('mount', 'bazi', 'godKeyPos');
		const r = await set('mount', { phaseType: phase[1] }, 'bazi');
		expect(r.ok).toBe(true);
		expect(payloadOf(r.undo.actionId).keys).toEqual(['phaseType']);
		saveMountTechniqueDefaults('bazi', { ...getMountTechniqueDefault('bazi'), godKeyPos: god[1] });   // 用户亲手改
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		const after = getMountTechniqueDefault('bazi');
		expect(Object.prototype.hasOwnProperty.call(after, 'phaseType')).toBe(false);
		expect(after.godKeyPos).toBe(god[1]);
	});
	it('🔴 助手改 A → 用户又改 A → 撤销被拒,用户的值不动', async ()=>{
		const phase = optionsOf('mount', 'bazi', 'phaseType');
		const r = await set('mount', { phaseType: phase[1] }, 'bazi');
		saveMountTechniqueDefaults('bazi', { ...getMountTechniqueDefault('bazi'), phaseType: phase[2] });
		const u = undoAction(r.undo.actionId);
		expect(u.ok).toBe(false); expect(u.code).toBe('E_UNDO_RECORD_CHANGED');
		expect(getMountTechniqueDefault('bazi').phaseType).toBe(phase[2]);
	});
	it('两次助手改动(不同键)按任意顺序撤销互不串改', async ()=>{
		const phase = optionsOf('mount', 'bazi', 'phaseType');
		const god = optionsOf('mount', 'bazi', 'godKeyPos');
		for(const first of ['a', 'b']){
			saveMountTechniqueDefaults('bazi', {});
			const ra = await set('mount', { phaseType: phase[1] }, 'bazi');   // eslint-disable-line no-await-in-loop
			const rb = await set('mount', { godKeyPos: god[1] }, 'bazi');   // eslint-disable-line no-await-in-loop
			const [x, y] = first === 'a' ? [ra, rb] : [rb, ra];
			expect(undoAction(x.undo.actionId).ok).toBe(true);
			const mid = getMountTechniqueDefault('bazi');
			expect(Object.prototype.hasOwnProperty.call(mid, first === 'a' ? 'phaseType' : 'godKeyPos')).toBe(false);
			expect(mid[first === 'a' ? 'godKeyPos' : 'phaseType']).toBe(first === 'a' ? god[1] : phase[1]);
			expect(undoAction(y.undo.actionId).ok).toBe(true);
			expect(getMountTechniqueDefault('bazi')).toEqual({});
		}
	});
});

describe('page 面(真存储,只动该页存储键里本次改到的字段)', ()=>{
	const KEY = 'horosa.liureng.settings.v1';
	const stored = ()=>{ const raw = window.localStorage.getItem(KEY); return raw ? JSON.parse(raw).values : null; };
	it('🔴 助手改 guireng → 用户在页面改起课法 → 撤销只还原 guireng,起课法保留', async ()=>{
		const api = await preparePageFacet('liureng');
		const casts = api.schema.castMethod.oneOf || ['zheng'];
		const r = await set('page', { guireng: 3 }, 'liureng');
		expect(r.ok).toBe(true);
		expect(payloadOf(r.undo.actionId).keys).toEqual(['guireng']);
		const userCast = otherThan(casts, api.defaults().castMethod) || api.defaults().castMethod;
		api.save({ castMethod: userCast });   // 用户亲手改
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(stored()).toEqual({ castMethod: userCast });   // guireng 写前没存过 → 删该字段;起课法原样
	});
	it('助手改 guireng → 用户又改 guireng → 撤销被拒', async ()=>{
		const api = await preparePageFacet('liureng');
		const r = await set('page', { guireng: 3 }, 'liureng');
		api.save({ guireng: 2 });
		expect(undoAction(r.undo.actionId).code).toBe('E_UNDO_RECORD_CHANGED');
		expect(stored().guireng).toBe(2);
	});
});

describe('technique 面(本地设置类,真存储)与 classical 面', ()=>{
	it('technique:助手改 A → 用户改同技法 B 的存储键 → 撤销只还原 A 的存储键', async ()=>{
		const d = describeFacet('technique', 'guolao');
		const items = d.items.filter((it)=>it.settable && Array.isArray(it.options) && it.options.length >= 2);
		expect(items.length).toBeGreaterThanOrEqual(2);
		const [a, b] = items;
		const r = await set('technique', { [a.key]: otherThan(a.options.map((o)=>o.value), a.current) }, 'guolao');
		expect(r.ok).toBe(true);
		const pa = payloadOf(r.undo.actionId);
		expect(pa.keys.length).toBe(1);
		const storageKeyB = getTechniqueSettingsSchema('guolao').fields.find((f)=>f.name === b.key).storageKey;
		window.localStorage.setItem(storageKeyB, `${otherThan(b.options.map((o)=>o.value), b.current)}`);   // 用户亲手改 B
		const userB = window.localStorage.getItem(storageKeyB);
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(window.localStorage.getItem(pa.keys[0])).toBe(pa.snapshot[pa.keys[0]]);
		expect(window.localStorage.getItem(storageKeyB)).toBe(userB);
	});
	it('classical:助手改 A → 用户又改 A → 撤销被拒', async ()=>{
		const prior = getClassicalChartGlobals().leoBoundFirst;
		const target = prior === 1 ? 0 : 1;
		const r = await set('classical', { leoBoundFirst: target });
		setClassicalChartGlobal('leoBoundFirst', prior);
		expect(undoAction(r.undo.actionId).code).toBe('E_UNDO_RECORD_CHANGED');
		setClassicalChartGlobal('leoBoundFirst', target);   // 用户又改回助手写的值 → 可以撤
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(getClassicalChartGlobals().leoBoundFirst).toBe(prior);
	});
});

describe('数值 / 文本值域', ()=>{
	it('🔴 数值项:null / 空串 / 数组 / 布尔 / 非数字串一律拒(此前被 Number() 收成 0 / 1 / 首元素);纯数字串收;越界拒', async ()=>{
		for(const bad of [null, '', [100], true, false, 'abc', '12abc', 'Infinity']){
			const r = await set('app', { zeriSnapshotMaxRows: bad });   // eslint-disable-line no-await-in-loop
			expect(`${JSON.stringify(bad)}:${r.code}`).toBe(`${JSON.stringify(bad)}:E_SETTING_VALUE_INVALID`);
		}
		expect(dispatch).not.toHaveBeenCalled();
		expect((await set('app', { zeriSnapshotMaxRows: 9 })).code).toBe('E_SETTING_VALUE_INVALID');
		expect((await set('app', { zeriSnapshotMaxRows: 501 })).code).toBe('E_SETTING_VALUE_INVALID');
		const ok = await set('app', { zeriSnapshotMaxRows: ' 120 ' });
		expect(ok.ok).toBe(true);
		expect(store.app.zeriSnapshotMaxRows).toBe(120);
	});
	it('挂载面数值项带上下限的必须校验;缺省为空(留空 = 自出)的字段可传空串回到自出,但不收布尔 / 数组', async ()=>{
		expect((await set('mount', { startAge: 121 }, 'tieban')).code).toBe('E_SETTING_VALUE_INVALID');
		expect((await set('mount', { startAge: -1 }, 'tieban')).code).toBe('E_SETTING_VALUE_INVALID');
		expect((await set('mount', { startAge: true }, 'tieban')).code).toBe('E_SETTING_VALUE_INVALID');
		expect((await set('mount', { startAge: [30] }, 'tieban')).code).toBe('E_SETTING_VALUE_INVALID');
		const r = await set('mount', { startAge: '30' }, 'tieban');
		expect(r.ok).toBe(true);
		expect(getMountTechniqueDefault('tieban').startAge).toBe(30);
		const back = await set('mount', { startAge: '' }, 'tieban');
		expect(back.ok).toBe(true);
		expect(getMountTechniqueDefault('tieban').startAge).toBe('');
	});
	it('文本项限长:超过上限整体拒、零写入;上限内照收', async ()=>{
		const before = JSON.stringify(getMountTechniqueDefault('shaozi'));
		const long = await set('mount', { ke: '刻'.repeat(SETTING_TEXT_MAX + 1) }, 'shaozi');
		expect(long.code).toBe('E_SETTING_VALUE_INVALID');
		expect(JSON.stringify(getMountTechniqueDefault('shaozi'))).toBe(before);
		expect((await set('mount', { ke: 7 }, 'shaozi')).code).toBe('E_SETTING_VALUE_INVALID');
		expect((await set('mount', { ke: '初刻' }, 'shaozi')).ok).toBe(true);
	});
});

describe('起卦输入键不可经挂载设置改', ()=>{
	it('🔴 太玄 / 荆诀种子、五兆起例模式与五兆数:describe 标只读;set_settings 整体拒(E_SETTING_KEY_NOT_ALLOWED)且说明原因、零写入', async ()=>{
		for(const [tech, values] of [['taixuan', { seed: 42 }], ['jingjue', { seed: 7 }], ['wuzhao', { mode: 'zhushu' }], ['wuzhao', { number: 5 }], ['wuzhao', { xingshenMonth: 'jieqi', mode: 'tang' }]]){
			const r = await set('mount', values, tech);   // eslint-disable-line no-await-in-loop
			expect(`${tech}:${r.code}`).toBe(`${tech}:E_SETTING_KEY_NOT_ALLOWED`);
			expect(r.message).toContain('起卦输入');
			expect(getMountTechniqueDefault(tech)).toEqual({});
		}
		['taixuan', 'jingjue', 'wuzhao'].forEach((tech)=>{
			describeFacet('mount', tech).items.filter((it)=>CAST_INPUT_KEYS[tech].indexOf(it.key) >= 0).forEach((it)=>{ expect(`${tech}.${it.key}:${it.settable}`).toBe(`${tech}.${it.key}:false`); });
		});
		// 判读口径照常可改(判别向量:不是整技法一刀切)
		const ok = await set('mount', { xingshenMonth: 'jieqi' }, 'wuzhao');
		expect(ok.ok).toBe(true);
		expect(getMountTechniqueDefault('wuzhao').xingshenMonth).toBe('jieqi');
	});
});

describe('旧版本整面快照', ()=>{
	it('没有写后值的旧载荷不自动恢复(E_UNDO_NOT_APPLICABLE),不碰任何设置', async ()=>{
		const { appendAction } = require('../aiTools/ledger');
		appendAction({ id: 'act-legacy', tool: 'set_settings', level: 'additive', args: {}, summary: 's', result: { ok: true }, undo: { kind: 'restore-settings', payload: { facet: 'app', snapshot: { appearanceMode: 'dark', chartStyle: 3 } } } });
		const u = undoAction('act-legacy');
		expect(u.ok).toBe(false); expect(u.code).toBe('E_UNDO_NOT_APPLICABLE');
		expect(dispatch).not.toHaveBeenCalled();
		expect(store.app.appearanceMode).toBe('light');
	});
});
