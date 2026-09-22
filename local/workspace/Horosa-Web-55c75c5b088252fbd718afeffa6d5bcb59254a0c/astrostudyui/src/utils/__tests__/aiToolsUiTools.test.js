// [批五] 操控软件五件工具合同:目录形状(ui 类别 read 级 / origins 只对 in-app+mcp / 外部注解 readOnlyHint=false)、
// navigate_to_technique(缺桥 / 非法键 / 同路由 no-op / 切换并记轨迹 / 回退)、compare_records(缺记录 / 同盘 / 等合盘页登记 / 配对与回退)、
// star_record / pin_record / add_record_tag(只增落库、账本 restore-record-flag 撤销、写后被改过拒撤、重复调用 no-op)、
// 运行时:ui 类调用排在只读之后执行且每 Turn ≤ MAX_UI_PER_TURN。
import { registerBuiltinTools } from '../aiTools';
import { runTool, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, registerWorkspaceUi, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { listActions, undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { listUiTrail, undoUiTrail, __resetUiTrailForTests } from '../aiAgent/uiTrail';
import { __setSpotlightToastForTests } from '../aiAgent/agentSpotlight';
import { createAgentTurn, AGENT_LIMITS } from '../aiAgent/runtime';
import { setAgentEnabled, setAgentApprovalMode } from '../aiAgent/prefs';
import { recordToolCapability } from '../aiAgent/caps';
import { getLocalChart, listLocalCharts, flagLocalChart } from '../localcharts';
import { parseGroupTags } from '../localRecordStore';

const UI_TOOLS = ['navigate_to_technique', 'compare_records'];
const FLAG_TOOLS = ['star_record', 'pin_record', 'add_record_tag'];
const ctx = (extra)=>({ origin: 'in-app', requestId: 'turnA:0:c1', dispatch: jest.fn(), ...(extra || {}) });
const ROUTES = [{ key: 'aianalysis', label: 'AI 分析' }, { key: 'bazi', label: '八字' }, { key: 'ziwei', label: '紫微' }, { key: 'relativechart', label: '合盘' }];
function fakeNav(start){
	const state = { tab: (start && start.tab) || 'aianalysis', subTab: (start && start.subTab) || null };
	const calls = [];
	return { state, calls, ui: { listRoutes: ()=>ROUTES, currentRoute: ()=>({ ...state }), navigate: (key, sub)=>{ calls.push([key, sub || null]); state.tab = key; state.subTab = sub || null; return { ok: true, tab: key, subTab: sub || null }; } } };
}
async function mkChart(name, extra){
	const r = await runTool('create_chart_record', { name, birth: '1990-01-01 08:00', gender: 'male', place: '北京', ...(extra || {}) }, ctx());
	expect(r.ok).toBe(true);
	return r.data.cid;
}

beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); __resetUiTrailForTests();
	__setSpotlightToastForTests(()=>{});
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	setAgentEnabled(true); setAgentApprovalMode('never');
});
afterEach(()=>{ setAgentEnabled(false); });

describe('目录形状', ()=>{
	it('🔴 五件在目录;界面两件 read+ui 且只对 in-app/mcp 开放,外部注解 readOnlyHint=false;旗标三件 additive/records 带 restore-record-flag', ()=>{
		const man = exportToolManifest();
		UI_TOOLS.concat(FLAG_TOOLS).forEach((n)=>expect(man.some((t)=>t.name === n)).toBe(true));
		UI_TOOLS.forEach((n)=>{ const t = man.find((x)=>x.name === n); expect(t.level).toBe('read'); expect(t.category).toBe('ui'); expect(t.annotations.readOnlyHint).toBe(false); expect(t.annotations.idempotentHint).toBe(true); });
		FLAG_TOOLS.forEach((n)=>{ const t = man.find((x)=>x.name === n); expect(t.level).toBe('additive'); expect(t.category).toBe('records'); });
		['goal', 'automation', 'scheduled'].forEach((o)=>{ const names = exportToolManifest({ origin: o }).map((t)=>t.name); UI_TOOLS.forEach((n)=>expect(names).not.toContain(n)); });
		expect(exportToolManifest({ origin: 'mcp' }).map((t)=>t.name)).toEqual(expect.arrayContaining(UI_TOOLS.concat(FLAG_TOOLS)));
	});
});

describe('navigate_to_technique', ()=>{
	it('缺导航桥 → E_BRIDGE_UNAVAILABLE;目标任务来源直呼 → E_TOOL_DISABLED', async ()=>{
		expect((await runTool('navigate_to_technique', { technique: 'bazi' }, ctx())).code).toBe('E_BRIDGE_UNAVAILABLE');
		expect((await runTool('navigate_to_technique', { technique: 'bazi' }, ctx({ origin: 'goal' }))).code).toBe('E_TOOL_DISABLED');
	});
	it('🔴 非法键 → E_ARGS_INVALID 且列出可用键;同路由 → changed:false 不记轨迹;切换 → 走桥、记轨迹(带 turnId)、回退回上一页', async ()=>{
		const nav = fakeNav({ tab: 'aianalysis' });
		registerWorkspaceUi(nav.ui);
		const bad = await runTool('navigate_to_technique', { technique: 'nope' }, ctx());
		expect(bad.code).toBe('E_ARGS_INVALID');
		expect(bad.message).toContain('bazi');
		const same = await runTool('navigate_to_technique', { technique: 'aianalysis' }, ctx());
		expect(same.ok).toBe(true); expect(same.data.changed).toBe(false); expect(listUiTrail().length).toBe(0);
		const r = await runTool('navigate_to_technique', { technique: 'bazi' }, ctx());
		expect(r.ok).toBe(true); expect(r.data.changed).toBe(true);
		expect(nav.calls).toEqual([['bazi', null]]);
		expect(nav.state.tab).toBe('bazi');
		const trail = listUiTrail({ turnId: 'turnA' });
		expect(trail.length).toBe(1); expect(trail[0].kind).toBe('route'); expect(trail[0].canUndo).toBe(true); expect(trail[0].after).toEqual({ tab: 'bazi', subTab: null });
		expect(listUiTrail({ turnId: 'other' }).length).toBe(0);
		expect(undoUiTrail(r.data.trailId).ok).toBe(true);
		expect(nav.state.tab).toBe('aianalysis');
		expect(listUiTrail()[0].undone).toBe(true);
		expect(undoUiTrail(r.data.trailId).code).toBe('E_ACTION_NOT_FOUND');
		expect(listActions().length).toBe(0);   // 界面动作不进持久账本
	});
});

describe('compare_records', ()=>{
	it('缺记录 → E_RECORD_NOT_FOUND;同一张 → E_ARGS_INVALID;合盘页迟迟不登记 → E_BRIDGE_UNAVAILABLE', async ()=>{
		const a = await mkChart('合盘甲'); const b = await mkChart('合盘乙');
		expect((await runTool('compare_records', { recordA: a, recordB: 'local-none' }, ctx())).code).toBe('E_RECORD_NOT_FOUND');
		expect((await runTool('compare_records', { recordA: a, recordB: a }, ctx())).code).toBe('E_ARGS_INVALID');
		const nav = fakeNav(); registerWorkspaceUi(nav.ui);
		const r = await runTool('compare_records', { recordA: a, recordB: b }, ctx());
		expect(r.code).toBe('E_BRIDGE_UNAVAILABLE');
		expect(nav.calls).toEqual([['relativechart', null]]);
	}, 10000);
	it('🔴 先导航再等合盘页登记 → setPair 收到两张盘的拷贝与子页;回退恢复上一对', async ()=>{
		const a = await mkChart('合盘丙'); const b = await mkChart('合盘丁', { birth: '1991-02-02 09:00' });
		const nav = fakeNav(); registerWorkspaceUi(nav.ui);
		const pairs = []; let cur = { a: null, b: null, mode: 'Comp' };
		setTimeout(()=>registerWorkspaceUi({ relative: { getPair: ()=>({ ...cur }), setPair: (x, y, mode)=>{ pairs.push([x.name, y.name, mode || null]); cur = { a: x, b: y, mode: mode || cur.mode }; return { ok: true }; }, clearPair: ()=>{ cur = { a: null, b: null, mode: cur.mode }; } } }), 30);
		const r = await runTool('compare_records', { recordA: a, recordB: b, mode: 'Synastry' }, ctx());
		expect(r.ok).toBe(true);
		expect(pairs).toEqual([['合盘丙', '合盘丁', 'Synastry']]);
		expect(cur.a).not.toBe(getLocalChart(a));   // 传的是拷贝,不动内核共享引用
		const trail = listUiTrail({ turnId: 'turnA' });
		expect(trail.length).toBe(1); expect(trail[0].kind).toBe('pair');
		expect(undoUiTrail(r.data.trailId).ok).toBe(true);
		expect(cur.a).toBe(null);   // 之前没有配对 → 清空
		expect(nav.state.tab).toBe('aianalysis');   // 回到导航前的页
	});
});

describe('star_record / pin_record / add_record_tag', ()=>{
	it('🔴 星标:落库 → 账本 restore-record-flag → 撤销回到无;重复加星 no-op 不进账本;写后被手工改过拒撤', async ()=>{
		const cid = await mkChart('星标甲');
		const n0 = listActions().length;
		const r = await runTool('star_record', { recordId: cid }, ctx());
		expect(r.ok).toBe(true); expect(getLocalChart(cid).starred).toBe(true); expect(r.undo.kind).toBe('restore-record-flag');
		expect(listActions().length).toBe(n0 + 1);
		const again = await runTool('star_record', { recordId: cid }, ctx());
		// 重复加星 no-op:additive 调用照例记一条账(与载入工作区同款),但撤销类型为 none(没有可撤的东西)
		expect(again.data.changed).toBe(false); expect(again.undo.kind).toBe('none'); expect(listActions().length).toBe(n0 + 2);
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(!!getLocalChart(cid).starred).toBe(false);
		const r2 = await runTool('star_record', { recordId: cid }, ctx());
		flagLocalChart(cid, 'starred', false);   // 用户随后手工取消星标
		const u = undoAction(r2.undo.actionId);
		expect(u.ok).toBe(false); expect(u.code).toBe('E_UNDO_RECORD_CHANGED');
		expect((await runTool('star_record', { recordId: 'local-none' }, ctx())).code).toBe('E_RECORD_NOT_FOUND');
	});
	it('置顶/置底:pinTier 落库、preview 前后文案、撤销回到原层', async ()=>{
		const cid = await mkChart('置顶甲');
		const def = (await import('../aiTools/tools/pinRecord')).default;
		expect(def.preview({ recordId: cid })).toEqual({ title: '置顶:置顶甲', before: '排序:未置顶', after: '排序:置顶' });
		const r = await runTool('pin_record', { recordId: cid, position: 'bottom' }, ctx());
		expect(r.ok).toBe(true); expect(getLocalChart(cid).pinTier).toBe(-1);
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(getLocalChart(cid).pinTier).toBe(undefined);
	});
	it('🔴 加标签:只追加不动既有标签;撤销只摘掉这一次加的;重复 no-op;上限 20', async ()=>{
		const cid = await mkChart('标签甲');
		const r1 = await runTool('add_record_tag', { recordId: cid, tag: '客户' }, ctx());
		expect(r1.ok).toBe(true); expect(parseGroupTags(getLocalChart(cid).group)).toEqual(['客户']);
		const r2 = await runTool('add_record_tag', { recordId: cid, tag: '朋友' }, ctx());
		expect(parseGroupTags(getLocalChart(cid).group)).toEqual(['客户', '朋友']);
		expect((await runTool('add_record_tag', { recordId: cid, tag: '朋友' }, ctx())).data.changed).toBe(false);
		expect(undoAction(r2.undo.actionId).ok).toBe(true);
		expect(parseGroupTags(getLocalChart(cid).group)).toEqual(['客户']);
		expect(undoAction(r1.undo.actionId).ok).toBe(true);
		expect(parseGroupTags(getLocalChart(cid).group)).toEqual([]);
		for(let i = 0; i < 20; i++){ expect((await runTool('add_record_tag', { recordId: cid, tag: `t${i}` }, ctx())).ok).toBe(true); }   // eslint-disable-line no-await-in-loop
		expect((await runTool('add_record_tag', { recordId: cid, tag: 't20' }, ctx())).code).toBe('E_ARGS_INVALID');
		expect(listLocalCharts({}).length).toBe(1);
	});
});

describe('运行时:界面动作排在只读之后、每 Turn 封顶', ()=>{
	const MAN = [
		{ name: 'probe_read', level: 'read', category: 'query', description: 'r', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false } },
		{ name: 'navigate_to_technique', level: 'read', category: 'ui', description: 'n', inputSchema: { type: 'object', additionalProperties: false, properties: { technique: { type: 'string' } } }, annotations: { readOnlyHint: false, destructiveHint: false } },
	];
	const tc = (id, name, args)=>[{ type: 'tool_call_start', json: { id, name, index: 0 } }, { type: 'tool_call', json: { id, name, index: 0, arguments: JSON.stringify(args) } }];
	it('🔴 一轮里 navigate ×3 + read ×1:read 先执行、导航后执行、第三个导航 E_LIMIT', async ()=>{
		recordToolCapability('p1', 'm', true);
		const order = [];
		const registry = { exportToolManifest: ()=>MAN, getTool: (n)=>MAN.find((m)=>m.name === n), runTool: jest.fn(async (name, args)=>{ order.push(name === 'navigate_to_technique' ? `nav:${args.technique}` : name); await new Promise((r)=>setTimeout(r, name === 'probe_read' ? 15 : 0)); return { ok: true, data: {} }; }) };
		const agent = createAgentTurn({ profile: { id: 'p1', providerType: 'openai' }, model: 'm', registry, lastUserMessage: '切到八字页' });
		const scripts = [[...tc('c1', 'navigate_to_technique', { technique: 'bazi' }), ...tc('c2', 'probe_read', {}), ...tc('c3', 'navigate_to_technique', { technique: 'ziwei' }), ...tc('c4', 'navigate_to_technique', { technique: 'astrochart' }), { type: 'done', json: { finish_reason: 'tool_calls' } }], [{ type: 'delta', json: { delta: '好了' } }, { type: 'done', json: { finish_reason: 'stop' } }]];
		let i = 0;
		do{ agent.beginRound(); const evs = scripts[i++] || [{ type: 'done', json: { finish_reason: 'stop' } }]; evs.forEach((e)=>agent.onEvent(e)); }while(await agent.settleRound());   // eslint-disable-line no-await-in-loop
		expect(order).toEqual(['probe_read', 'nav:bazi', 'nav:ziwei']);
		const results = agent.trace().rounds[0].results;
		const c4 = results.find((r)=>r.callId === 'c4');
		expect(c4.code).toBe('E_LIMIT'); expect(c4.status).toBe('skipped');
		expect(AGENT_LIMITS.MAX_UI_PER_TURN).toBe(2);
	});
});
