// AI 助手·设置五面:describe/get/set 原子写入 + 快照撤销 + 密钥类硬拒。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { setGlobalStore } from '../storageutil';
import { getMountTechniqueDefault } from '../techniqueMountSettings';
import { getClassicalChartGlobals } from '../classicalChartGlobals';
import { geoPairToRecordFields } from '../aiTools/normalize/geoCompass';
import { techniqueScopeNote } from '../aiTools/settingsFacets';

let dispatch;
let changeCond;
let store;
const ctx = ()=>({ origin: 'in-app', requestId: 'r1', dispatch });

beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests();
	__resetLedgerForTests();
	__resetWorkspaceBridgeForTests();
	store = {
		app: { appearanceMode: 'light', colorTheme: 0, chartDisplay: [1, 2], showPdBounds: 0 },
		astro: { fields: { hsys: { value: 1 }, zodiacal: { value: 0 }, pos: { value: '北京' }, lat: { value: '39n54' } } },
	};
	// 与真页面同口径:app/save 合并进全局仓,changeCond 把键写进盘面字段(撤销要核对「当前值 == 写后值」,假桥必须真落值)
	dispatch = jest.fn((a)=>{ if(a && a.type === 'app/save'){ store.app = { ...store.app, ...a.payload }; } });
	changeCond = jest.fn((patch)=>{ const f = { ...store.astro.fields }; Object.keys(patch || {}).forEach((k)=>{ if(k !== 'confirmed'){ f[k] = { value: patch[k] }; } }); store.astro = { ...store.astro, fields: f }; });
	registerWorkspaceBridge({ dispatch, changeCond });
	setGlobalStore(store);
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

describe('占星流派预设:读数按当前盘反查,不可改(改了不改盘)', ()=>{
	it('盘是整宫 + 回归黄道等全默认档 → 读出默认档;改了宫制 → 读出「自定」,不再读上次在下拉里选的记忆值', async ()=>{
		const { SCHOOL_PRESETS, SCHOOL_PRESET_DEFAULT } = require('../../components/astro/schoolPresets');
		const def = SCHOOL_PRESETS[SCHOOL_PRESET_DEFAULT];
		store.app = { ...store.app, schoolPreset: 'ptolemy_like_stale_memory' };
		store.astro = { fields: { hsys: { value: def.hsys }, zodiacal: { value: 0 }, termsVariant: { value: def.termsVariant }, triplicity: { value: def.tripSystem }, lotReversal: { value: def.lotReversal }, sectBuffer: { value: def.sectBuffer }, lotsDocReverse: { value: def.lotsDocReverse || 0 } } };
		const d = await runTool('describe_settings', { facet: 'app' }, ctx());
		const it = d.data.items.find((x)=>x.key === 'schoolPreset');
		expect(it.settable).toBe(false);
		expect(it.current).toBe(SCHOOL_PRESET_DEFAULT);
		const g = await runTool('get_settings', { facet: 'app' }, ctx());
		expect(g.data.values.schoolPreset).toBe(SCHOOL_PRESET_DEFAULT);
		const usedHsys = Object.keys(SCHOOL_PRESETS).map((k)=>Number(SCHOOL_PRESETS[k].hsys));
		const otherHsys = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((h)=>usedHsys.indexOf(h) < 0);
		store.astro = { fields: { ...store.astro.fields, hsys: { value: otherHsys } } };
		const d2 = await runTool('describe_settings', { facet: 'app' }, ctx());
		expect(d2.data.items.find((x)=>x.key === 'schoolPreset').current).toBe('custom');
	});
	it('没有当前盘(无头模式)→ 读数为空,不编出一个流派', async ()=>{
		store.astro = undefined;
		const d = await runTool('describe_settings', { facet: 'app' }, ctx());
		expect(d.data.items.find((x)=>x.key === 'schoolPreset').current).toBe(undefined);
		const g = await runTool('get_settings', { facet: 'app' }, ctx());
		expect(g.data.values.schoolPreset).toBe(undefined);
	});
	it('写它 → 拒(此前回「已修改」而盘面一项没动)', async ()=>{
		const r = await runTool('set_settings', { facet: 'app', values: { schoolPreset: 'brennan' } }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_SETTING_KEY_NOT_ALLOWED');
		expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'app/save' }));
	});
});

describe('set_settings · app 面', ()=>{
	it('🔴 密钥类硬拒且零派发;非白名单键整体拒(原子)', async ()=>{
		const r = await runTool('set_settings', { facet: 'app', values: { apiKey: 'sk-x' } }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_SETTING_KEY_NOT_ALLOWED');
		const r2 = await runTool('set_settings', { facet: 'app', values: { appearanceMode: 'dark', bogus: 1 } }, ctx());
		expect(r2.ok).toBe(false);
		// colorTheme 已下架为豁免键(走 E_SETTING_KEY_NOT_ALLOWED);「合法键 × 非法值」改用 chartStyle 触发
		const r3 = await runTool('set_settings', { facet: 'app', values: { appearanceMode: 'dark', chartStyle: 999 } }, ctx());
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
		expect(changeCond).toHaveBeenCalledWith({ hsys: 0, confirmed: true, fromAgent: true });   // AI 改的共用宫制不记「新盘种子」(seedsAtSharedFieldWrites 同锁)
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
	it('mount:传 null = 把同类默认里这一项删掉(回到不设);删完为空时拒;可撤销', async ()=>{
		const { saveMountTechniqueDefaults } = require('../techniqueMountSettings');
		saveMountTechniqueDefaults('horary', { hp_accidentalMode: 'lilly', topicId: 'love' });
		const r = await runTool('set_settings', { facet: 'mount', technique: 'horary', values: { hp_accidentalMode: null } }, ctx());
		expect(r.ok).toBe(true);
		expect(getMountTechniqueDefault('horary')).toEqual({ topicId: 'love' });
		const empty = await runTool('set_settings', { facet: 'mount', technique: 'horary', values: { topicId: null } }, ctx());
		expect(empty.ok).toBe(false);
		expect(getMountTechniqueDefault('horary')).toEqual({ topicId: 'love' });
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(getMountTechniqueDefault('horary')).toEqual({ hp_accidentalMode: 'lilly', topicId: 'love' });
		const d = await runTool('describe_settings', { facet: 'mount', technique: 'horary' }, ctx());
		expect(d.data.items.find((it)=>it.key === 'hp_accidentalMode').hint).toMatch(/传 null/);
	});
	it('mount 删键:同类默认之后又被整份重存(删掉的那项照样「没有」),撤销拒绝,不把旧那项塞进新模板;没动过照常撤销', async ()=>{
		const { saveMountTechniqueDefaults } = require('../techniqueMountSettings');
		saveMountTechniqueDefaults('horary', { hp_accidentalMode: 'lilly', topicId: 'love' });
		const r = await runTool('set_settings', { facet: 'mount', technique: 'horary', values: { hp_accidentalMode: null } }, ctx());
		expect(r.ok).toBe(true);
		saveMountTechniqueDefaults('horary', { topicId: 'money' });   // 用户在挂载设置里整份重存
		const u = undoAction(r.undo.actionId);
		expect(u.ok).toBe(false);
		expect(u.code).toBe('E_UNDO_RECORD_CHANGED');
		expect(getMountTechniqueDefault('horary')).toEqual({ topicId: 'money' });
		// 写值(非删键)的撤销口径不变:无关键被改不挡
		const w = await runTool('set_settings', { facet: 'mount', technique: 'horary', values: { hp_accidentalMode: 'lilly' } }, ctx());
		expect(w.ok).toBe(true);
		expect(undoAction(w.undo.actionId).ok).toBe(true);
		expect(getMountTechniqueDefault('horary')).toEqual({ topicId: 'money' });
	});
	it('mount 删键:同类默认里本来就没有这项 → 拒绝(什么也没删,不记一笔);此刻隐藏着的旧键也删得掉', async ()=>{
		const { saveMountTechniqueDefaults } = require('../techniqueMountSettings');
		saveMountTechniqueDefaults('ziwei', { lateZi: 'zi_chu', after23NewDay: 0 });
		const none = await runTool('set_settings', { facet: 'mount', technique: 'ziwei', values: { yearBoundary: null } }, ctx());
		expect(none.ok).toBe(false);
		expect(none.message || (none.error && none.error.message) || '').toMatch(/没有可删的/);
		expect(getMountTechniqueDefault('ziwei')).toEqual({ lateZi: 'zi_chu', after23NewDay: 0 });
		// 晚子时强制子初时日界项隐藏(抽屉里看不见),删它照样放行
		const d = await runTool('describe_settings', { facet: 'mount', technique: 'ziwei' }, ctx());
		expect(d.data.items.some((it)=>it.key === 'after23NewDay')).toBe(false);
		const del = await runTool('set_settings', { facet: 'mount', technique: 'ziwei', values: { after23NewDay: null } }, ctx());
		expect(del.ok).toBe(true);
		expect(getMountTechniqueDefault('ziwei')).toEqual({ lateZi: 'zi_chu' });
		// 不是这个技法的设置字段:照拒
		const bad = await runTool('set_settings', { facet: 'mount', technique: 'ziwei', values: { notAField: null } }, ctx());
		expect(bad.ok).toBe(false);
		expect(bad.code).toBe('E_SETTING_KEY_NOT_ALLOWED');
	});
	it('mount 显隐:本次要删的父项按删后实际生效的值(全局现值缺省)判子项显不显,不按 null', async ()=>{
		const { ZWEngineOptions } = require('../../components/ziwei/ziweiOptions');
		const { saveMountTechniqueDefaults } = require('../techniqueMountSettings');
		const prev = ZWEngineOptions.lateZi;
		ZWEngineOptions.lateZi = 'zi_chu';   // 全局晚子时 = 强制子初:删掉模板里的「跟随全局」后日界项不起作用
		try{
			saveMountTechniqueDefaults('ziwei', { lateZi: 'global' });
			const r = await runTool('set_settings', { facet: 'mount', technique: 'ziwei', values: { lateZi: null, after23NewDay: 0 } }, ctx());
			expect(r.ok).toBe(false);
			expect(r.code).toBe('E_SETTING_KEY_NOT_ALLOWED');
			expect(getMountTechniqueDefault('ziwei')).toEqual({ lateZi: 'global' });
		}finally{ ZWEngineOptions.lateZi = prev; }
		// 全局是「跟随全局」:删后日界项照常可设
		saveMountTechniqueDefaults('ziwei', { lateZi: 'zi_chu' });
		const ok = await runTool('set_settings', { facet: 'mount', technique: 'ziwei', values: { lateZi: null, after23NewDay: 0 } }, ctx());
		expect(ok.ok).toBe(true);
		expect(getMountTechniqueDefault('ziwei')).toEqual({ after23NewDay: 0 });
	});
	it('写前预览 / 工具说明:null 写成「删除,回到不设」;说明不再说「不会删除任何设置」', async ()=>{
		const { saveMountTechniqueDefaults } = require('../techniqueMountSettings');
		saveMountTechniqueDefaults('horary', { hp_accidentalMode: 'lilly', topicId: 'love' });
		const def = require('../aiTools/tools/setSettings').default;
		const pv = await def.preview({ facet: 'mount', technique: 'horary', values: { hp_accidentalMode: null } });
		expect(pv.before).toBe('判读·偶然尊贵计分: 1647 满分表（±38）');
		expect(pv.after).toBe('判读·偶然尊贵计分: (删除,回到不设)');
		expect(def.description).toContain('mount 面某个值传 null = 只把同类默认里的这一项删掉');
		expect(def.description).not.toContain('不会删除任何设置');
		expect(def.description).toContain('请倒序撤');
		// 本来就没有的键:预览写不改动;混合写入的回包只列真正变了的键
		const pv2 = await def.preview({ facet: 'mount', technique: 'horary', values: { hp_refranationAsDestruction: null, topicId: 'career' } });
		expect(pv2.after).toContain('判读·撤回作独立破坏: (本来就没有,不改动)');
		const w = await runTool('set_settings', { facet: 'mount', technique: 'horary', values: { hp_refranationAsDestruction: null, topicId: 'career' } }, ctx());
		expect(w.ok).toBe(true);
		expect(w.message).toBe('已修改「AI 挂载·卜卦盘」设置:问题类别[topicId]');   // 回包与审批卡同一套中文名(键名附在后面给模型)
		expect(w.summary).toBe('改设置 AI 挂载·卜卦盘:问题类别');
		// 写现值:回包写没有变化,不说「已修改」
		const same = await runTool('set_settings', { facet: 'mount', technique: 'horary', values: { topicId: 'career' } }, ctx());
		expect(same.ok).toBe(false);
		expect(same.code).toBe('E_SETTING_NO_CHANGE');   // 无变化 → 拒,不记账本
		expect(same.message).toBe('「AI 挂载·卜卦盘」设置没有变化(写的就是现值 / 删的项本来就没有),未写入');
		// 模板里手改出的 null:预览按「有这个键」判(执行时会删它),不写「本来就没有」。用没有归一的下拉(开关会把 null 归成空串,判别不了)
		const raw = JSON.parse(window.localStorage.getItem('horosa.ai.mount.techniqueDefaults.v1'));
		raw.techniques.horary = { ...raw.techniques.horary, hp_accidentalMode: null };
		window.localStorage.setItem('horosa.ai.mount.techniqueDefaults.v1', JSON.stringify(raw));
		const hasNullKey = Object.prototype.hasOwnProperty.call(getMountTechniqueDefault('horary'), 'hp_accidentalMode');
		expect(hasNullKey).toBe(true);
		const pv3 = await def.preview({ facet: 'mount', technique: 'horary', values: { hp_accidentalMode: null } });
		expect(pv3.after).toBe('判读·偶然尊贵计分: (删除,回到不设)');
	});
	it('「没有变化」按存储键判:chart 面按经纬度写同一地点会清地名 = 有变化;technique 面写现值(字段名与存储键不同名)= 没有变化', async ()=>{
		const g = geoPairToRecordFields(39.9, 116.4);
		store.astro = { ...store.astro, fields: { ...store.astro.fields, lat: { value: g.lat }, lon: { value: g.lon }, gpsLat: { value: g.gpsLat }, gpsLon: { value: g.gpsLon }, pos: { value: '北京' } } };
		const w1 = await runTool('set_settings', { facet: 'chart', values: { gpsLat: 39.9, gpsLon: 116.4 } }, ctx());
		expect(w1.ok).toBe(true);
		expect(store.astro.fields.pos.value).toBe('');
		expect(w1.message).toBe('已修改「当前盘」设置:纬度(十进制)[gpsLat]、经度(十进制)[gpsLon]');
		const w2 = await runTool('set_settings', { facet: 'chart', values: { gpsLat: 39.9, gpsLon: 116.4 } }, ctx());
		expect(w2.code).toBe('E_SETTING_NO_CHANGE');   // 无变化 → 拒,不记账本
		expect(w2.message).toBe('「当前盘」设置没有变化(写的就是现值 / 删的项本来就没有),未写入');
		const hs = await runTool('set_settings', { facet: 'chart', values: { hsys: 1 } }, ctx());
		expect(hs.code).toBe('E_SETTING_NO_CHANGE');   // 无变化 → 拒,不记账本
		expect(hs.message).toBe('「当前盘」设置没有变化(写的就是现值 / 删的项本来就没有),未写入');
		const d = await runTool('describe_settings', { facet: 'technique', technique: 'guolao' }, ctx());
		const it0 = d.data.items.find((it)=>it.key === 'lifeMode');
		expect(it0).toBeTruthy();
		const t1 = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { lifeMode: it0.current } }, ctx());
		expect(t1.ok).toBe(false);
		expect(t1.code).toBe('E_SETTING_NO_CHANGE');   // 无变化 → 拒,不记账本
		expect(t1.message).toBe('「技法本地·七政四余」设置没有变化(写的就是现值 / 删的项本来就没有),未写入');
		const other = (it0.options || []).find((o)=>`${o.value}` !== `${it0.current}`);
		expect(other).toBeTruthy();
		const t2 = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { lifeMode: other.value } }, ctx());
		expect(t2.message).toMatch(/^已修改「技法本地·七政四余」设置:命度\[lifeMode\]\(生效时机:本次打开软件后第一次进入七政页时/);
		expect(t2.summary).toBe('改设置 技法本地·七政四余:命度');   // 回包用户也看得到:用面向用户的那句
	});
	it('technique 面宿度制(存储键只是新盘种子镜像)标只读、写入即拒,拒绝回包带上该怎么改的提示;地点项写明时区随地点换', async ()=>{
		require('../newChartSeeds').newChartSeedValue('doubingSu28');   // 先让旧版镜像的一次性并入跑完(之后镜像键不再并入)
		window.localStorage.setItem('horosaGuolaoSu28Mode', '2');   // 本机镜像键与新盘缺省不同:现值应取新盘缺省
		const d = await runTool('describe_settings', { facet: 'technique', technique: 'guolao' }, ctx());
		window.localStorage.removeItem('horosaGuolaoSu28Mode');
		const su = d.data.items.find((it)=>it.key === 'su28Mode');
		expect([su.settable, /随盘/.test(su.hint || '')]).toEqual([false, true]);
		const w = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { su28Mode: 2 } }, ctx());
		expect([w.ok, w.code]).toEqual([false, 'E_SETTING_KEY_NOT_ALLOWED']);
		expect(w.message).toContain(su.hint);
		expect(window.localStorage.getItem('horosaGuolaoSu28Mode')).toBeNull();
		const lm = d.data.items.find((it)=>it.key === 'lifeMode');
		expect(lm.settable).toBe(true);
		expect(lm.hint).toMatch(/^只在本次运行头一次打开七政页时补一次\(打开时星盘样式若是「坚七政」,改为切到别的样式后、左栏头一次有变化时补到那时的盘上 —— 换盘、改时间地点或改左栏任一项都算\):那张盘未载入记录/);   // 可写项写明作用范围
		expect(su.current).toBe(0);   // 只读项的现值取新盘缺省(不是本机镜像键)
		const c0 = await runTool('describe_settings', { facet: 'chart' }, ctx());
		['gpsLat', 'gpsLon'].forEach((k)=>{ expect([k, /该地在盘上日期的时区/.test((c0.data.items.find((it)=>it.key === k) || {}).hint || '')]).toEqual([k, true]); });
		const dn = await runTool('set_settings', { facet: 'mount', technique: 'nanji', values: { nanjiPasswordCode: 'x' } }, ctx());
		expect([dn.ok, /技法页/.test(dn.message)]).toEqual([false, true]);   // 按密钥类字样拒的,回包同样带提示
		const c = await runTool('describe_settings', { facet: 'chart' }, ctx());
		const place = c.data.items.find((it)=>it.key === 'place');
		expect([place.label, /该地在盘上日期的时区\(夏令时按那一天\),钟面时刻不变/.test(place.hint || '')]).toEqual(['地点(地名,自动解析经纬与时区)', true]);
	});
	it('chart 面:盘上没有地名字段时按地名写、再撤销,地名一并还原成空', async ()=>{
		const g = geoPairToRecordFields(39.9, 116.4);
		const f = { ...store.astro.fields, lat: { value: g.lat }, lon: { value: g.lon }, gpsLat: { value: g.gpsLat }, gpsLon: { value: g.gpsLon } };
		delete f.pos;
		store.astro = { ...store.astro, fields: f };
		const w = await runTool('set_settings', { facet: 'chart', values: { place: '上海' } }, ctx());
		expect(w.ok).toBe(true);
		expect(store.astro.fields.pos.value).toBe('上海');
		const u = undoAction(w.undo.actionId);
		expect(u.ok).toBe(true);
		expect(store.astro.fields.pos.value).toBe('');
		expect(store.astro.fields.gpsLat.value).toBe(g.gpsLat);
	});
	it('technique 面没有存储键的字段(值存在技法页显示设置里)标只读、写入即拒(此前写了什么也不存、回包照报已修改)', async ()=>{
		const { getTechniqueSettingsSchema } = require('../techniqueMountSettings');
		const noStore = getTechniqueSettingsSchema('guolao').fields.filter((f)=>!f.storageKey).map((f)=>f.name);
		expect(noStore).toEqual(expect.arrayContaining(['guolaoLifeMasterMode', 'guolaoMinorLimitType', 'guolaoLimitChildBase']));
		const d = await runTool('describe_settings', { facet: 'technique', technique: 'guolao' }, ctx());
		d.data.items.filter((it)=>noStore.indexOf(it.key) >= 0).forEach((it)=>{
			expect([it.key, it.settable, /不在技法本地设置里/.test(it.hint || '')]).toEqual([it.key, false, true]);
		});
		const item = d.data.items.find((it)=>it.key === 'guolaoLifeMasterMode');
		const v = (item.options || []).find((o)=>`${o.value}` !== `${item.current}`);
		const w = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { guolaoLifeMasterMode: v ? v.value : 'gong' } }, ctx());
		expect([w.ok, w.code]).toEqual([false, 'E_SETTING_KEY_NOT_ALLOWED']);
	});
	it('chart 面:盘上地名为 null / 没有地名字段时按经纬度写同一地点 = 没有变化;预览写明地名会随之改', async ()=>{
		const g = geoPairToRecordFields(39.9, 116.4);
		const base = { ...store.astro.fields, lat: { value: g.lat }, lon: { value: g.lon }, gpsLat: { value: g.gpsLat }, gpsLon: { value: g.gpsLon } };
		store.astro = { ...store.astro, fields: { ...base, pos: { value: null } } };
		const w1 = await runTool('set_settings', { facet: 'chart', values: { gpsLat: 39.9, gpsLon: 116.4 } }, ctx());
		expect(w1.code).toBe('E_SETTING_NO_CHANGE');   // 无变化 → 拒,不记账本
		expect(w1.message).toBe('「当前盘」设置没有变化(写的就是现值 / 删的项本来就没有),未写入');
		const noPos = { ...base }; delete noPos.pos;
		store.astro = { ...store.astro, fields: noPos };
		const w2 = await runTool('set_settings', { facet: 'chart', values: { gpsLat: 39.9, gpsLon: 116.4 } }, ctx());
		expect(w2.code).toBe('E_SETTING_NO_CHANGE');   // 无变化 → 拒,不记账本
		expect(w2.message).toBe('「当前盘」设置没有变化(写的就是现值 / 删的项本来就没有),未写入');
		store.astro = { ...store.astro, fields: { ...base, pos: { value: '北京' } } };
		const def = require('../aiTools/tools/setSettings').default;
		const pv = await def.preview({ facet: 'chart', values: { gpsLat: 39.9, gpsLon: 116.4 } });
		expect(pv.before).toContain('地名: "北京"');
		expect(pv.after).toContain('地名: (无)(按经纬度写,地名清空)');
		const pv2 = await def.preview({ facet: 'chart', values: { place: '上海' } });
		expect(pv2.before).toBe('地名: "北京"\n经纬: 39.9, 116.4');
		expect(pv2.after).toMatch(/^地名: "上海"\n经纬: 31\.\d+, 121\.\d+\(盘上没有日期,时区不改\)$/);   // 盘上没有日期:时区无从按那一天换
		// 时区随地点换(与页面换地点一致):该地在盘上日期的时区与盘上不同 → 前后各写一行「时区」;盘上经纬是字符串也按数写
		const DT = require('../../components/comp/DateTime').default;
		const day = (d)=>{ const t = new DT(); t.setZone('+08:00'); return { value: t.parse(`${d} 12:00:00`, 'YYYY-MM-DD HH:mm:ss') }; };
		store.astro = { ...store.astro, fields: { ...store.astro.fields, date: day('1990-07-01'), zone: { value: '+08:00' }, gpsLat: { value: '39.9' }, gpsLon: { value: '116.4' } } };
		const pv5 = await def.preview({ facet: 'chart', values: { place: '纽约' } });
		expect(pv5.before).toContain('经纬: 39.9, 116.4\n时区: +08:00');
		expect(pv5.after).toMatch(/\n时区: -04:00\(该地在盘上日期 1990-07-01 的时区,夏令时按那一天;钟面时刻不变\)$/);
		const pv4 = await def.preview({ facet: 'chart', values: { place: '不存在的地名ZZZ' } });
		expect(pv4.after).toMatch(/找不到,执行会被拒|有歧义,执行会被拒/);
		// 北京 1990-07-01 在夏令时(+09:00),盘上 +08:00:按经纬写回同一地点也换时区(不是「无变化」),回包写明换成了什么
		const w3 = await runTool('set_settings', { facet: 'chart', values: { gpsLat: 39.9, gpsLon: 116.4 } }, ctx());
		expect(w3.message).toBe('已修改「当前盘」设置:纬度(十进制)[gpsLat]、经度(十进制)[gpsLon](时区随地点改为 +09:00(原 +08:00;该地在盘上日期 1990-07-01 的时区,钟面时刻不变))');
		// 时区按盘上那一天比(冬季出生的纽约盘写纽约 = 同一时区,不换);两边按分钟比(+8:00 与 +08:00 同一时区)
		const zoneOf = async (date, zone, values)=>{
			store.astro = { ...store.astro, fields: { ...store.astro.fields, date: day(date), zone: { value: zone }, gpsLat: { value: '39.9' }, gpsLon: { value: '116.4' } } };
			return def.preview({ facet: 'chart', values });
		};
		const SAME = '(时区不变:该地在盘上日期的时区与盘上相同)';
		expect((await zoneOf('1990-01-15', '-05:00', { place: '纽约' })).after.endsWith(SAME)).toBe(true);
		expect((await zoneOf('1990-01-15', '+8:00', { place: '北京' })).after.endsWith(SAME)).toBe(true);
		// 盘上时区为空 / 写法越界(+15:00 / +08:60):页面换地点照样写上该地时区,这里同样换
		expect((await zoneOf('1990-01-15', '', { place: '纽约' })).after).toMatch(/\n时区: -05:00\(该地在盘上日期 1990-01-15 的时区/);
		expect((await zoneOf('1990-07-01', '+15:00', { place: '纽约' })).after).toMatch(/\n时区: -04:00\(/);
		expect((await zoneOf('1990-07-01', '+08:60', { place: '纽约' })).after).toMatch(/\n时区: -04:00\(/);
		// 按经纬写同样换时区;改前经纬按数写
		const pv6 = await zoneOf('1990-07-01', '+08:00', { gpsLat: 40.71, gpsLon: -74.01 });
		expect(pv6.before).toContain('纬度(十进制): 39.9');
		expect(pv6.before).not.toContain('"39.9"');
		expect(pv6.before).toContain('地名: (无)\n时区: +08:00');   // 上面 w3 按经纬写过:地名已清空
		expect(pv6.after).toContain('地名: (无)(按经纬度写,地名清空)\n时区: -04:00(该地在盘上日期 1990-07-01 的时区,夏令时按那一天;钟面时刻不变)');
		expect((await zoneOf('1990-07-01', '+09:00', { gpsLat: 39.9, gpsLon: 116.4 })).reject).toEqual(expect.objectContaining({ code: 'E_SETTING_NO_CHANGE' }));   // 北京 1990 年夏令时 +09:00,与盘上相同:地点、时区都没变
		expect((await zoneOf('1990-07-01', '+09:00', { gpsLat: 39.91, gpsLon: 116.4 })).after).toContain(`地名: (无)(按经纬度写,地名清空)${SAME}`);
		// 盘上有时区、读不出日期:不换;按经纬写到推不出时区的地方:不换
		store.astro = { ...store.astro, fields: { ...store.astro.fields, date: { value: null }, zone: { value: '+08:00' } } };
		expect((await def.preview({ facet: 'chart', values: { place: '纽约' } })).after).toMatch(/\(盘上没有日期,时区不改\)$/);
		expect((await zoneOf('1990-07-01', '+09:00', { gpsLat: 0, gpsLon: 0 })).after).toContain('地名: (无)(按经纬度写,地名清空)(推不出该地时区,时区不改)');
		// 经纬只认严格十进制按数写,别的写法原样带引号(不拿 Number() 试探)
		store.astro = { ...store.astro, fields: { ...store.astro.fields, gpsLat: { value: '1E2' }, gpsLon: { value: ' ' } } };
		expect((await def.preview({ facet: 'chart', values: { place: '上海' } })).before).toContain('经纬: "1E2", " "');
		expect((await def.preview({ facet: 'chart', values: { gpsLat: 40.71, gpsLon: -74.01 } })).before).toBe('纬度(十进制): "1E2"\n经度(十进制): " "\n地名: (无)\n时区: +09:00');   // 该地(纽约)在盘上日期与盘上(+09:00)不同:改前写出时区
	});
	it('chart 面按地名写的预览:解析超过 1.5 秒照样出预览并写明执行时再解析;解析快时清掉限时定时器', async ()=>{
		const placeMod = require('../aiTools/normalize/place');
		const def = require('../aiTools/tools/setSettings').default;
		const st = jest.spyOn(global, 'setTimeout');
		const ct = jest.spyOn(global, 'clearTimeout');
		const fast = await def.preview({ facet: 'chart', values: { place: '上海' } });
		expect(fast.after).toContain('地名: "上海"');
		const idx = st.mock.calls.findIndex((c)=>c[1] === 1500);
		expect(idx).toBeGreaterThanOrEqual(0);
		expect(ct).toHaveBeenCalledWith(st.mock.results[idx].value);
		st.mockRestore();
		ct.mockRestore();
		const slow = jest.spyOn(placeMod, 'resolvePlaceOffline').mockImplementation(()=>new Promise(()=>{}));
		const t0 = Date.now();
		const pv = await def.preview({ facet: 'chart', values: { place: '上海' } });
		expect(Date.now() - t0).toBeGreaterThanOrEqual(1400);
		expect(pv.after).toBe('地名: "上海"(地名库还在载入,预览没解析出:执行时再解析,找不到 / 有歧义照拒;时区按该地在盘上日期的时区换,钟面时刻不变)');
		slow.mockRestore();
	});
	it('technique 面:作用范围如实(头一次打开补一次;恒星岁差另写;身宫法此面只收两档);预览改前取现值、改后附作用范围', async ()=>{
		const seeds = require('../newChartSeeds');
		seeds.newChartSeedValue('doubingSu28');
		seeds.recordNewChartSeed('doubingSu28', 4);
		window.localStorage.setItem('horosaGuolaoLifeMode', 'cotrans');
		const d = await runTool('describe_settings', { facet: 'technique', technique: 'guolao' }, ctx());
		const ay = d.data.items.find((it)=>it.key === 'guolaoAyanamsa');
		expect([!!ay, ay && ay.settable]).toEqual([true, true]);
		expect(ay.hint).toMatch(/^宿度制为恒星制、盘上没选恒星岁差的盘\(含已载入的命盘/);
		const bm = d.data.items.find((it)=>it.key === 'bodyMode');
		expect(bm.options.map((o)=>o.value)).toEqual(['taiyin', 'youjin']);
		expect(bm.hint).toMatch(/;自定身宫\(某个地支\)只随盘、此处不收/);
		const wb = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { bodyMode: '子' } }, ctx());
		expect([wb.ok, wb.code]).toEqual([false, 'E_SETTING_VALUE_INVALID']);
		expect(wb.message).toContain('自定身宫(某个地支)只随盘、此处不收');
		expect(window.localStorage.getItem('horosaGuolaoBodyMode')).toBeNull();
		const m = await runTool('describe_settings', { facet: 'mount', technique: 'guolao' }, ctx());
		expect(m.data.items.find((it)=>it.key === 'bodyMode').options.map((o)=>o.value)).toEqual(expect.arrayContaining(['taiyin', 'youjin', '子', '亥']));   // 挂载面照列全部档位
		const def = require('../aiTools/tools/setSettings').default;
		const pv = await def.preview({ facet: 'technique', technique: 'guolao', values: { lifeMode: 'yumao' } });
		expect(pv.before).toBe('命度: 赤黄转换');   // 改前是本机现值(不是「未设」)
		expect(pv.after).toMatch(/^命度: 日出安命\n\(生效时机:本次打开软件后第一次进入七政页时/);   // 审批卡给用户看:面向用户的那句
		expect(pv.after).not.toMatch(/facet=|出厂值|请用户/);
		const w = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { lifeMode: 'yumao', guolaoAyanamsa: 'lahiri' } }, ctx());
		expect(w.ok).toBe(true);
		expect(window.localStorage.getItem('horosaGuolaoAyanamsa')).toBe('lahiri');   // 恒星岁差真写进去(写入剪枝与 describe 同一份显隐)
		expect(w.message).toContain('(命度:生效时机:本次打开软件后第一次进入七政页时');   // 分组时写字段中文名
		expect(w.message).toContain(';恒星岁差（宿度制=恒星制）:宿度制为恒星制、盘上没选恒星岁差的盘(包括已载入的命盘');
		expect(w.message).not.toMatch(/facet=|出厂值|请用户/);
		// 新盘缺省不是恒星制:恒星岁差不列(显隐按新盘缺省,不按本机镜像键)
		seeds.recordNewChartSeed('doubingSu28', 0);
		window.localStorage.setItem('horosaGuolaoSu28Mode', '4');
		const d2 = await runTool('describe_settings', { facet: 'technique', technique: 'guolao' }, ctx());
		expect(d2.data.items.find((it)=>it.key === 'guolaoAyanamsa')).toBeUndefined();
		const wh = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { guolaoAyanamsa: 'raman' } }, ctx());
		expect([wh.ok, wh.code, /此项此刻不显示/.test(wh.message)]).toEqual([false, 'E_SETTING_KEY_NOT_ALLOWED', true]);   // 拒绝里说明是此刻不显示
		const wx = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { noSuchKey: 1 } }, ctx());
		expect([wx.ok, /此项此刻不显示/.test(wx.message)]).toEqual([false, false]);   // 不是设置字段的照旧只报不在白名单
		// 罗计 / 月孛取法:主盘、流年盘与天星择日样式的择时盘同读盘上的值 —— 作用范围就是缺省句,不再另补「择时盘直读本机值」(两项同一句,回包并成一组)
		const nt = d2.data.items.find((it)=>it.key === 'nodeType');
		expect(nt.hint).toMatch(/^只在本次运行头一次打开七政页时补一次/);
		expect(nt.hint).not.toMatch(/天星择日/);
		expect(nt.hint).toBe(techniqueScopeNote('guolao', ['lifeMode']));
		const w2 = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { nodeType: 'true', lilithType: 'true' } }, ctx());
		expect(w2.message).toBe(`已修改「技法本地·七政四余」设置:${nt.label}[nodeType]、${d2.data.items.find((it)=>it.key === 'lilithType').label}[lilithType](${techniqueScopeNote('guolao', ['nodeType'], { forUser: true })})`);
		expect(techniqueScopeNote('guolao', ['nodeType'], { forUser: true })).toMatch(/^生效时机:/);
		expect(techniqueScopeNote('guolao', ['nodeType'], { forUser: true })).not.toMatch(/天星择日/);
		expect(techniqueScopeNote('guolao', ['nodeType'])).toBe(nt.hint);   // 给模型的那句(describe)不变
		// 一次写两项、只有一项真变了:回包只列变了的那项,也只附它的那一句
		const w3 = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { nodeType: 'true', lifeMode: 'cotrans' } }, ctx());
		expect(w3.message).toBe(`已修改「技法本地·七政四余」设置:命度[lifeMode](${techniqueScopeNote('guolao', ['lifeMode'], { forUser: true })})`);
		// 身宫法现值是自定身宫地支:现值所在档照列,写现值 = 没有变化
		window.localStorage.setItem('horosaGuolaoBodyMode', '子');
		const d3 = await runTool('describe_settings', { facet: 'technique', technique: 'guolao' }, ctx());
		expect(d3.data.items.find((it)=>it.key === 'bodyMode').options.map((o)=>o.value)).toEqual(['taiyin', 'youjin', '子']);
		expect((await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { bodyMode: '子' } }, ctx())).code).toBe('E_SETTING_NO_CHANGE');
	});
	it('技法本地设置作用范围:给模型的那句保留参数名;给用户看的那句(审批卡 / 回包)不写参数名、出厂值与「请用户」', ()=>{
		const model = techniqueScopeNote('no-such-technique', ['x']);
		const user = techniqueScopeNote('no-such-technique', ['x'], { forUser: true });
		expect(model).toMatch(/facet=mount/);
		expect(user).toMatch(/^生效时机:本次打开软件后第一次进入该技法页时/);
		expect(user).toContain('只想改 AI 分析用的设置,请到 AI 分析的「挂载设置」');
		[user, techniqueScopeNote('guolao', ['lifeMode'], { forUser: true }), techniqueScopeNote('guolao', ['guolaoAyanamsa'], { forUser: true })].forEach((t)=>{
			expect(t).not.toMatch(/facet|出厂值|请用户/);
		});
		expect(techniqueScopeNote('guolao', ['lifeMode'])).toMatch(/AI 分析口径用 facet=mount\)$/);
	});
	it('mount 只读类型(日期 / 多选 / 时刻等):提示写明可传 null 删掉同类默认里已写的这一项', async ()=>{
		const { getTechniqueSettingsSchema } = require('../techniqueMountSettings');
		const tech = ['indiachart', 'prog', 'primarydirect'].find((t)=>{ const s = getTechniqueSettingsSchema(t); return s && s.fields.some((f)=>['date', 'multiselect', 'time', 'datetime'].indexOf(f.type) >= 0); });
		expect(tech).toBeTruthy();
		const d = await runTool('describe_settings', { facet: 'mount', technique: tech }, ctx());
		const ro = d.data.items.filter((it)=>it.settable === false && !/起卦输入|助手不能改,请用户/.test(it.hint || ''));
		expect(ro.length).toBeGreaterThan(0);
		ro.forEach((it)=>{ expect([it.key, it.hint]).toEqual([it.key, '只读(此类型助手写不了值);要删掉同类默认里已写的这一项(回到不设)传 null']); });
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

describe('设置字段显隐:与挂载抽屉同一份合成草稿、档名写上级项、隐藏时点名上级项', ()=>{
	it('mount:六爻同类默认选了关掉神煞的流派 → 神煞子项不列、写了拒(此前列成可改、回包已修改,生成时却被剪掉)', async ()=>{
		const w1 = await runTool('set_settings', { facet: 'mount', technique: 'sixyao', values: { school: 'zengshan' } }, ctx());
		expect(w1.ok).toBe(true);
		const d = await runTool('describe_settings', { facet: 'mount', technique: 'sixyao' }, ctx());
		expect(d.data.items.some((it)=>it.key === 'shenshaBase')).toBe(false);
		const w2 = await runTool('set_settings', { facet: 'mount', technique: 'sixyao', values: { shenshaBase: 'year' } }, ctx());
		expect(w2.ok).toBe(false);
		expect(w2.message).toMatch(/此项此刻不显示:上级项「[^」]+」\(shenshaOn\)取/);
		expect(getMountTechniqueDefault('sixyao')).toEqual({ school: 'zengshan' });
		// 同一次写入里先换流派再写它关掉的子项:按换派后的合成草稿判,照样拒;换回开神煞的流派则一起写进
		window.localStorage.clear();
		const both = await runTool('set_settings', { facet: 'mount', technique: 'sixyao', values: { school: 'zengshan', shenshaBase: 'year' } }, ctx());
		expect(both.ok).toBe(false);
		expect(both.message).toMatch(/此项此刻不显示/);
		expect(getMountTechniqueDefault('sixyao')).toEqual({});
	});
	it('mount:上级项按档名写、同一次写它带出的子项 → 按归一后的档值判显隐,一起写进', async ()=>{
		const r = await runTool('set_settings', { facet: 'mount', technique: 'qimen', values: { paiPanType: '年家奇门', yearJiaJu: 'yinian' } }, ctx());
		expect(r.ok).toBe(true);
		expect(getMountTechniqueDefault('qimen')).toEqual({ paiPanType: 0, yearJiaJu: 'yinian' });
	});
	it('mount:隐藏字段被拒时点名让它显示的上级项与档位(上级在本面可写,不接额外说明)', async ()=>{
		const { saveMountTechniqueDefaults } = require('../techniqueMountSettings');
		saveMountTechniqueDefaults('ziwei', { lateZi: 'zi_chu' });
		const r = await runTool('set_settings', { facet: 'mount', technique: 'ziwei', values: { after23NewDay: 0 } }, ctx());
		expect(r.ok).toBe(false);
		expect(r.message).toMatch(/此项此刻不显示:上级项「[^」]+」\(lateZi\)取「[^」]+」时才显示/);
		expect(r.message).not.toMatch(/上级项此面改不了/);
	});
	it('technique:上级项本面写不了(宿度制只随盘)→ 拒绝里接上它自己的说明', async ()=>{
		const seeds = require('../newChartSeeds');
		seeds.recordNewChartSeed('doubingSu28', 0);
		const r = await runTool('set_settings', { facet: 'technique', technique: 'guolao', values: { guolaoAyanamsa: 'raman' } }, ctx());
		expect(r.ok).toBe(false);
		expect(r.message).toMatch(/上级项「[^」]+」\(su28Mode\)取「[^」]+」时才显示;上级项此面改不了\(此项随盘/);
	});
	it('mount 删键写前预览:执行会被拒的两种情形如实写明', async ()=>{
		const { saveMountTechniqueDefaults } = require('../techniqueMountSettings');
		const def = require('../aiTools/tools/setSettings').default;
		saveMountTechniqueDefaults('horary', { topicId: 'love' });
		const none = await def.preview({ facet: 'mount', technique: 'horary', values: { hp_accidentalMode: null } });
		expect(none.after).toContain('执行会被拒:同类默认里没有 hp_accidentalMode 这一项,没有可删的');
		const empty = await def.preview({ facet: 'mount', technique: 'horary', values: { topicId: null } });
		expect(empty.after).toContain('执行会被拒:删掉这几项后同类默认就空了');
		const ok = await def.preview({ facet: 'mount', technique: 'horary', values: { topicId: null, hp_accidentalMode: 'lilly' } });
		expect(ok.after).not.toContain('执行会被拒');
	});
});

describe('无变化:审批前预检即拒(不弹审批卡、不记账本)', ()=>{
	test('mount 面只删本来就没有的键 / 写的就是现值 → 预览自报 reject;运行时见 reject 不进审批台', async ()=>{
		window.localStorage.clear();
		const def = (await import('../aiTools/tools/setSettings')).default;
		const pv = await def.preview({ facet: 'mount', technique: 'horary', values: { hp_accidentalMode: null } });
		expect(pv.reject && pv.reject.code).toBe('E_SETTING_NO_CHANGE');
		const fs = require('fs');
		const path = require('path');
		const rt = fs.readFileSync(path.join(__dirname, '../aiAgent/runtime.js'), 'utf8');
		const iReject = rt.indexOf('if(preview && preview.reject){');
		const iAsk = rt.indexOf('opts.requestApproval({ callId: call.id');
		expect(iReject).toBeGreaterThan(0);
		expect(iReject).toBeLessThan(iAsk);   // 先判 reject,再挂审批
		const br = fs.readFileSync(path.join(__dirname, '../aiAgent/mcpBridge.js'), 'utf8');
		expect(br.indexOf('if(preview && preview.reject){')).toBeGreaterThan(0);   // 外部桥同口径:不挂审批台
		expect(br.indexOf('if(preview && preview.reject){')).toBeLessThan(br.indexOf('const approvalP = requestApproval('));
	});
});

// 换地点时时区随之换(与页面左栏换地点同一口径:按新坐标 + 盘上日期求时区,夏令时按那一天;只改时区、钟面时刻不变),撤销一并还原。
// 假桥按真 changeCond 的口径落值:tm → 日期 / 时刻 / 时区三项(时区取 tm.zone),其余键原样写进盘面字段
describe('chart 面换地点:时区随地点换,撤销还原', ()=>{
	const DT = require('../../components/comp/DateTime').default;
	const at = (s, z)=>{ const t = new DT(); t.setZone(z); return t.parse(s, 'YYYY-MM-DD HH:mm:ss'); };
	const realishCond = (patch)=>{
		const f = { ...store.astro.fields };
		Object.keys(patch || {}).forEach((k)=>{
			if(k === 'confirmed' || k === 'fromAgent' || k === 'zone'){ return; }   // 真 changeCond 不认单独的 zone 键:时区只经 tm 改
			if(k === 'tm'){ f.date = { value: patch.tm.clone() }; f.time = { value: patch.tm.clone() }; f.zone = { value: patch.tm.zone }; return; }
			f[k] = { value: patch[k] };
		});
		store.astro = { ...store.astro, fields: f };
	};
	const seat = (dateStr, zone)=>{
		const g = geoPairToRecordFields(39.9, 116.4);
		store.astro = { ...store.astro, fields: { ...store.astro.fields, date: { value: at(dateStr, zone) }, zone: { value: zone }, lat: { value: g.lat }, lon: { value: g.lon }, gpsLat: { value: g.gpsLat }, gpsLon: { value: g.gpsLon }, pos: { value: '北京' } } };
	};
	beforeEach(()=>{ changeCond = jest.fn(realishCond); registerWorkspaceBridge({ dispatch, changeCond }); });
	it('按地名改到纽约(盘上 1990-07-01 夏令时):时区换成 -04:00、钟面时刻不变;下发经 tm;撤销后时区与地点都回原样', async ()=>{
		seat('1990-07-01 08:30:00', '+08:00');
		const w = await runTool('set_settings', { facet: 'chart', values: { place: '纽约' } }, ctx());
		expect(w.ok).toBe(true);
		const sent = changeCond.mock.calls[changeCond.mock.calls.length - 1][0];
		expect(sent.tm && sent.tm.zone).toBe('-04:00');
		expect(sent.tm.format('YYYY-MM-DD HH:mm:ss')).toBe('1990-07-01 08:30:00');   // 钟面时刻不变
		expect(store.astro.fields.zone.value).toBe('-04:00');
		expect(store.astro.fields.date.value.format('YYYY-MM-DD HH:mm:ss')).toBe('1990-07-01 08:30:00');
		expect(w.message).toContain('时区随地点改为 -04:00(原 +08:00;该地在盘上日期 1990-07-01 的时区,钟面时刻不变)');
		const u = undoAction(w.undo.actionId);
		expect(u.ok).toBe(true);
		expect(store.astro.fields.zone.value).toBe('+08:00');
		expect(store.astro.fields.date.value.zone).toBe('+08:00');
		expect(store.astro.fields.date.value.format('YYYY-MM-DD HH:mm:ss')).toBe('1990-07-01 08:30:00');
		expect(store.astro.fields.pos.value).toBe('北京');
	});
	it('夏令时按盘上那一天:同是纽约,冬天的盘换成 -05:00;按经纬写同一口径;推不出时区 / 该地时区与盘上相同时不换、写后值仍记现时区(撤销照常)', async ()=>{
		seat('1990-01-15 08:00:00', '+08:00');
		const w1 = await runTool('set_settings', { facet: 'chart', values: { gpsLat: 40.71, gpsLon: -74.01 } }, ctx());
		expect(w1.ok).toBe(true);
		expect(store.astro.fields.zone.value).toBe('-05:00');
		seat('1990-07-01 08:00:00', '+09:00');   // 北京 1990 年夏令时 = +09:00
		const w2 = await runTool('set_settings', { facet: 'chart', values: { gpsLat: 39.91, gpsLon: 116.41 } }, ctx());
		expect(w2.ok).toBe(true);
		expect(changeCond.mock.calls[changeCond.mock.calls.length - 1][0].tm).toBeUndefined();   // 时区不变:不下发 tm
		expect(w2.message).not.toContain('时区随地点');
		expect(undoAction(w2.undo.actionId).ok).toBe(true);   // 写后值记的是现时区:核对通过
		expect(store.astro.fields.zone.value).toBe('+09:00');
		seat('1990-07-01 08:00:00', '+08:00');
		const w3 = await runTool('set_settings', { facet: 'chart', values: { gpsLat: 0, gpsLon: 0 } }, ctx());
		expect(w3.ok).toBe(true);
		expect(store.astro.fields.zone.value).toBe('+08:00');   // 推不出时区:不改
		expect(undoAction(w3.undo.actionId).ok).toBe(true);
		expect(store.astro.fields.gpsLat.value).toBe(geoPairToRecordFields(39.9, 116.4).gpsLat);
	});
	it('写入后用户又改了时区:撤销整次拒,一键不动', async ()=>{
		seat('1990-07-01 08:00:00', '+08:00');
		const w = await runTool('set_settings', { facet: 'chart', values: { place: '纽约' } }, ctx());
		expect(store.astro.fields.zone.value).toBe('-04:00');
		store.astro = { ...store.astro, fields: { ...store.astro.fields, zone: { value: '-05:00' } } };
		const u = undoAction(w.undo.actionId);
		expect([u.ok, u.code]).toEqual([false, 'E_UNDO_RECORD_CHANGED']);
		expect(store.astro.fields.zone.value).toBe('-05:00');
	});
	it('预览与执行同一份计划:预览说换成什么,执行就换成什么(取样多地多日)', async ()=>{
		const def = require('../aiTools/tools/setSettings').default;
		const cases = [['1990-07-01 08:00:00', '+08:00', { place: '纽约' }], ['1990-01-15 08:00:00', '+08:00', { place: '伦敦' }], ['2020-07-01 08:00:00', '+08:00', { gpsLat: 51.5, gpsLon: -0.12 }], ['1990-07-01 08:00:00', '+08:00', { place: '上海' }]];
		for(const [d, z, values] of cases){
			seat(d, z);
			const pv = await def.preview({ facet: 'chart', values });
			const m = /\n时区: ([+-]\d{2}:\d{2})\(/.exec(pv.after);
			const w = await runTool('set_settings', { facet: 'chart', values }, ctx());
			expect([d, JSON.stringify(values), m ? m[1] : z]).toEqual([d, JSON.stringify(values), store.astro.fields.zone.value]);
			if(w.undo){ undoAction(w.undo.actionId); }
		}
	});
});
