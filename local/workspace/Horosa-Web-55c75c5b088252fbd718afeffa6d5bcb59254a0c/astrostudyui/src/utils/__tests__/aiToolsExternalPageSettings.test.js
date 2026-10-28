// 设置「页面」面合同:载入表与登记表逐页对齐、每页载得出设置件;describe / get 列出该页保存的设置(标量可改、覆盖层只读);
// set 走该页自己的校验(候选外 / 类型错 / 只读键整次拒,一项都不写)、字符串容错、写进该页存储键;撤销按整份原文还原(当时没存过 = 删键)。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { setAgentEnabled, setAgentApprovalMode } from '../aiAgent/prefs';
import { PAGE_SETTINGS_REGISTRY } from '../pageSettingsRegistry';
import { PAGE_FACET_LOADERS, PAGE_FACET_EXCLUDED, preparePageFacet, __resetPageFacetCacheForTests, SETTING_FACETS } from '../aiTools/settingsFacets';

const ctx = ()=>({ origin: 'in-app', requestId: 'turnP:0:c1', dispatch: jest.fn() });
const KEY = 'horosa.liureng.settings.v1';
const stored = ()=>{ const raw = window.localStorage.getItem(KEY); return raw ? JSON.parse(raw).values : null; };

beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); __resetPageFacetCacheForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	setAgentEnabled(true); setAgentApprovalMode('never');
});
afterEach(()=>{ setAgentEnabled(false); });

it('🔴 page 面在设置面表里;载入表与登记表逐页对齐;每页都载得出设置件(存储键与登记一致)', async ()=>{
	expect(SETTING_FACETS).toContain('page');
	// 载入表 ∪ 排除表 = 登记表,两表不相交;排除必写理由
	expect(Object.keys(PAGE_FACET_LOADERS).concat(Object.keys(PAGE_FACET_EXCLUDED)).sort()).toEqual(PAGE_SETTINGS_REGISTRY.map((p)=>p.page).sort());
	Object.keys(PAGE_FACET_EXCLUDED).forEach((k)=>{ expect(PAGE_FACET_LOADERS[k]).toBeUndefined(); expect(PAGE_FACET_EXCLUDED[k].length).toBeGreaterThan(10); });
	const live = PAGE_SETTINGS_REGISTRY.filter((p)=>!PAGE_FACET_EXCLUDED[p.page]);
	for(let i = 0; i < live.length; i++){
		const e = live[i];
		const api = await preparePageFacet(e.page);   // eslint-disable-line no-await-in-loop
		expect(`${e.page}:${api && api.key}`).toBe(`${e.page}:${e.storageKey}`);
		expect(api.fields.slice().sort()).toEqual(e.fields.slice().sort());   // 登记表按集合核对(顺序不论)
	}
	expect(await preparePageFacet('nope')).toBe(null);
});

it('🔴 describe / get:列出该页保存的设置(当前值 = 缺省 / 已存值);覆盖层(map)只读;未登记的页报码', async ()=>{
	const d = await runTool('describe_settings', { facet: 'page', technique: 'liureng' }, ctx());
	expect(d.ok).toBe(true);
	const keys = d.data.items.map((it)=>it.key);
	expect(keys.slice().sort()).toEqual(PAGE_SETTINGS_REGISTRY.find((p)=>p.page === 'liureng').fields.slice().sort());
	const guireng = d.data.items.find((it)=>it.key === 'guireng');
	expect(guireng.settable).toBe(true); expect(guireng.options.map((o)=>o.value)).toEqual([0, 1, 2, 3, 4]); expect(guireng.current).toBe(guireng.default);
	const shiRuKe = d.data.items.find((it)=>it.key === 'shiRuKe');
	expect(shiRuKe.type).toBe('boolean'); expect(shiRuKe.settable).toBe(true);
	// 任一页里的 map 字段一律只读
	let sawMap = false;
	const live = PAGE_SETTINGS_REGISTRY.filter((p)=>!PAGE_FACET_EXCLUDED[p.page]);
	for(let i = 0; i < live.length; i++){
		const page = live[i].page;
		const r = await runTool('describe_settings', { facet: 'page', technique: page }, ctx());   // eslint-disable-line no-await-in-loop
		expect(`${page}:${r.ok}:${r.code || ''}:${r.message || ''}`).toBe(`${page}:true::`);
		r.data.items.filter((it)=>it.type === 'map').forEach((it)=>{ sawMap = true; expect(it.settable).toBe(false); });
	}
	expect(sawMap).toBe(true);
	const g = await runTool('get_settings', { facet: 'page', technique: 'liureng' }, ctx());
	expect(g.data.values.guireng).toBe(guireng.default);
	expect((await runTool('describe_settings', { facet: 'page', technique: 'nope' }, ctx())).code).toBe('E_SETTING_KEY_NOT_ALLOWED');
	expect((await runTool('describe_settings', { facet: 'page', technique: 'planetarium' }, ctx())).code).toBe('E_SETTING_KEY_NOT_ALLOWED');
});

it('🔴 set:候选内写进该页存储键;候选外 / 类型错 / 只读或未知键 → 整次拒、一项都不写;字符串容错', async ()=>{
	expect((await runTool('set_settings', { facet: 'page', technique: 'liureng', values: { guireng: 9 } }, ctx())).code).toBe('E_SETTING_VALUE_INVALID');
	expect((await runTool('set_settings', { facet: 'page', technique: 'liureng', values: { guireng: 3, nope: 1 } }, ctx())).code).toBe('E_SETTING_KEY_NOT_ALLOWED');
	expect((await runTool('set_settings', { facet: 'page', technique: 'liureng', values: { shiRuKe: 'maybe' } }, ctx())).code).toBe('E_SETTING_VALUE_INVALID');
	expect(stored()).toBe(null);
	const r = await runTool('set_settings', { facet: 'page', technique: 'liureng', values: { guireng: '3', shiRuKe: 'true' } }, ctx());
	expect(r.ok).toBe(true);
	expect(stored()).toEqual(expect.objectContaining({ guireng: 3, shiRuKe: true }));
	expect(r.message).toContain('下次载入');
	const g = await runTool('get_settings', { facet: 'page', technique: 'liureng' }, ctx());
	expect(g.data.values.guireng).toBe(3);
});

it('🔴 撤销:按整份原文还原 —— 写前没存过 → 删键;写前存过 → 回到那份原文(其它键不受影响)', async ()=>{
	const r1 = await runTool('set_settings', { facet: 'page', technique: 'liureng', values: { guireng: 1 } }, ctx());
	expect(r1.ok).toBe(true);
	expect(undoAction(r1.undo.actionId, { restoreSettings: true }).ok).toBe(true);
	expect(window.localStorage.getItem(KEY)).toBe(null);
	window.localStorage.setItem(KEY, JSON.stringify({ v: 1, values: { guireng: 4, castMethod: 'zheng' } }));
	const before = window.localStorage.getItem(KEY);
	const r2 = await runTool('set_settings', { facet: 'page', technique: 'liureng', values: { guireng: 0 } }, ctx());
	expect(stored()).toEqual(expect.objectContaining({ guireng: 0, castMethod: 'zheng' }));
	expect(undoAction(r2.undo.actionId, { restoreSettings: true }).ok).toBe(true);
	expect(window.localStorage.getItem(KEY)).toBe(before);
});

it('预览:逐键「当前值 → 改后值」', async ()=>{
	const def = (await import('../aiTools/tools/setSettings')).default;
	const pv = await def.preview({ facet: 'page', technique: 'liureng', values: { guireng: 1 } });
	expect(pv.before).toMatch(/^贵人体系: \d/); expect(pv.after).toBe('贵人体系: 1');   // 审批卡写中文名,不写键名
});
