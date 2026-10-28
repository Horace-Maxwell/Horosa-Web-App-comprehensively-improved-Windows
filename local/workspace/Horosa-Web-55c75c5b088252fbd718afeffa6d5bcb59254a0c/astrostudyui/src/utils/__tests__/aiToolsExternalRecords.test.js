// 档案写入合同:断事日志追加 / 档案关系边(只增落库、不刷新 updateTime、账本 restore-record-flag 撤销、
// 写后被改过拒撤、两张档案一起还原)· 对话挂载(缺桥 / 技法只认可挂键 / 合盘规则 / 界面轨迹回退)·
// AI 分析页页内页签(等对话桥登记、只认页签表、回退)。
// 对话挂载会跨会话保留:只增级、进账本(restore-chat-mount 撤销,撤销前比对此刻挂载 === 写后),只读档下不可用。
import Ajv from 'ajv';
import { registerBuiltinTools } from '../aiTools';
import { runTool, listTools, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, registerWorkspaceUi, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { listUiTrail, undoUiTrail, __resetUiTrailForTests } from '../aiAgent/uiTrail';
import { __setSpotlightToastForTests } from '../aiAgent/agentSpotlight';
import { setAgentEnabled, setAgentApprovalMode, setPrivateReadEnabled } from '../aiAgent/prefs';
import { getLocalChart, upsertLocalChart } from '../localcharts';
import { getLocalCase } from '../localcases';
import { RELATION_TYPES } from '../recordRelations';
import { findAnalysisSourceById } from '../aiAnalysisSources';
import { listAnalysisTechniqueOptions } from '../aiAnalysisContext';

const ajv = new Ajv({ allErrors: true, strict: false });
const ctx = (extra)=>({ origin: 'mcp', requestId: 'turnM:0:c1', dispatch: jest.fn(), ...(extra || {}) });
function okShaped(name, r){
	expect(r.ok).toBe(true);
	const def = listTools().find((d)=>d.name === name);
	const v = ajv.compile(def.outputSchema);
	if(!v(r.data)){ throw new Error(`${name} data 不合 outputSchema:${JSON.stringify(v.errors)}`); }
}
async function mkChart(name){
	const r = await runTool('create_chart_record', { name, birth: '1990-01-01 08:00', gender: 'male', place: '北京', selectAsAnalysisSource: false }, ctx({ origin: 'in-app' }));   // 不经桥选中(否则会换掉假对话桥里的本人)
	expect(r.ok).toBe(true);
	return r.data.cid;
}
async function mkCase(event){
	const r = await runTool('create_case_record', { caseType: 'liureng', event, divTime: '2026-01-01 10:00', place: '北京', selectAsAnalysisSource: false }, ctx({ origin: 'in-app' }));
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
	it('🔴 日志 / 关系两件 additive+records 带 restore-record-flag;挂载一件 additive+workspace 带 restore-chat-mount;三件都对 in-app 与 mcp 开放;关系枚举 = RELATION_TYPES', ()=>{
		const man = exportToolManifest({ origin: 'mcp' });
		['append_record_journal', 'link_records'].forEach((n)=>{ const t = man.find((x)=>x.name === n); expect(t.level).toBe('additive'); expect(t.category).toBe('records'); });
		const m = man.find((x)=>x.name === 'set_chat_mount'); expect(m.level).toBe('additive'); expect(m.category).toBe('workspace'); expect(m.annotations.readOnlyHint).toBe(false);
		expect(listTools().find((d)=>d.name === 'set_chat_mount').undoKind).toBe('restore-chat-mount');
		['append_record_journal', 'link_records', 'set_chat_mount'].forEach((n)=>expect(exportToolManifest({ origin: 'in-app' }).some((t)=>t.name === n)).toBe(true));
		['goal', 'scheduled', 'automation'].forEach((o)=>expect(exportToolManifest({ origin: o }).some((t)=>t.name === 'set_chat_mount')).toBe(false));
		const link = listTools().find((d)=>d.name === 'link_records');
		expect(link.inputSchema.properties.relation.enum).toEqual(RELATION_TYPES.map((r)=>r.value));
		expect(link.undoKind).toBe('restore-record-flag');
	});
});

describe('append_record_journal', ()=>{
	it('🔴 追加到最前、旧条目原样、updateTime 不变;撤销回到追加前;用户随后又记一条 → 拒撤;空 / 不存在各自报码', async ()=>{
		const cid = await mkChart('日志甲');
		upsertLocalChart({ cid, journal: [{ at: '2026-01-01 09:00', text: '旧的一条', extra: 'keep' }], preserveUpdateTime: true, updateTime: getLocalChart(cid).updateTime });
		const t0 = getLocalChart(cid).updateTime;
		const r = await runTool('append_record_journal', { recordId: cid, text: '  应验:三月动土  ' }, ctx());
		okShaped('append_record_journal', r);
		const j = getLocalChart(cid).journal;
		expect(j.length).toBe(2);
		expect(j[0].text).toBe('应验:三月动土'); expect(j[0].by).toBe('ai'); expect(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(j[0].at)).toBe(true);
		expect(j[1]).toEqual({ at: '2026-01-01 09:00', text: '旧的一条', extra: 'keep' });
		expect(getLocalChart(cid).updateTime).toBe(t0);
		expect(r.undo.kind).toBe('restore-record-flag');
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(getLocalChart(cid).journal).toEqual([{ at: '2026-01-01 09:00', text: '旧的一条', extra: 'keep' }]);
		const r2 = await runTool('append_record_journal', { recordId: cid, text: '第二条' }, ctx());
		upsertLocalChart({ cid, journal: [{ at: '2026-02-02 10:00', text: '用户手记' }].concat(getLocalChart(cid).journal), preserveUpdateTime: true, updateTime: getLocalChart(cid).updateTime });
		const u = undoAction(r2.undo.actionId);
		expect(u.ok).toBe(false); expect(u.code).toBe('E_UNDO_RECORD_CHANGED');
		expect(getLocalChart(cid).journal.length).toBe(3);
		expect((await runTool('append_record_journal', { recordId: cid, text: '   ' }, ctx())).code).toBe('E_ARGS_INVALID');
		expect((await runTool('append_record_journal', { recordId: 'local-none', text: 'x' }, ctx())).code).toBe('E_RECORD_NOT_FOUND');
	});
	it('事盘同样可记;preview 说清现有条数与要追加的内容', async ()=>{
		const cid = await mkCase('问事甲');
		const def = listTools().find((d)=>d.name === 'append_record_journal');
		const pv = def.preview({ recordId: cid, text: '回访:已成' });
		expect(pv.before).toBe('现有 0 条'); expect(pv.after).toContain('回访:已成');
		const r = await runTool('append_record_journal', { recordId: cid, text: '回访:已成' }, ctx());
		expect(r.ok).toBe(true);
		expect(getLocalCase(cid).journal[0].text).toBe('回访:已成');
	});
});

describe('link_records', ()=>{
	it('🔴 双向边(父母 ↔ 子女互逆)、两张都不刷新 updateTime;同关系再调 no-op;撤销两张一起还原;任一张写后被改过 → 一张都不还原', async ()=>{
		const a = await mkChart('关系甲');
		const b = await mkChart('关系乙');
		const ta = getLocalChart(a).updateTime; const tb = getLocalChart(b).updateTime;
		const r = await runTool('link_records', { recordId: a, otherRecordId: b, relation: 'parent' }, ctx());
		okShaped('link_records', r);
		expect(r.data.inverse).toBe('child');
		expect(getLocalChart(a).relations).toEqual([{ cid: b, type: 'parent' }]);
		expect(getLocalChart(b).relations).toEqual([{ cid: a, type: 'child' }]);
		expect(getLocalChart(a).updateTime).toBe(ta); expect(getLocalChart(b).updateTime).toBe(tb);
		const again = await runTool('link_records', { recordId: a, otherRecordId: b, relation: 'parent' }, ctx({ origin: 'in-app' }));
		expect(again.data.changed).toBe(false); expect(again.noChange).toBe(true); expect(again.undo).toBeUndefined();
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(getLocalChart(a).relations).toEqual([]); expect(getLocalChart(b).relations).toEqual([]);
		const r2 = await runTool('link_records', { recordId: a, otherRecordId: b, relation: 'spouse' }, ctx());
		expect(getLocalChart(b).relations).toEqual([{ cid: a, type: 'spouse' }]);
		upsertLocalChart({ cid: b, relations: [], preserveUpdateTime: true, updateTime: getLocalChart(b).updateTime });   // 用户在乙那边解除了
		const u = undoAction(r2.undo.actionId);
		expect(u.ok).toBe(false); expect(u.code).toBe('E_UNDO_RECORD_CHANGED');
		expect(getLocalChart(a).relations).toEqual([{ cid: b, type: 'spouse' }]);   // 甲侧没被动
	});
	it('已有不同关系 → 不覆盖;自己连自己 / 命盘连事盘 / 不存在 → 各自报码', async ()=>{
		const a = await mkChart('关系丙');
		const b = await mkChart('关系丁');
		const k = await mkCase('问事乙');
		expect((await runTool('link_records', { recordId: a, otherRecordId: b, relation: 'friend' }, ctx())).ok).toBe(true);
		const clash = await runTool('link_records', { recordId: a, otherRecordId: b, relation: 'client' }, ctx());
		expect(clash.code).toBe('E_ARGS_INVALID'); expect(getLocalChart(a).relations).toEqual([{ cid: b, type: 'friend' }]);
		expect((await runTool('link_records', { recordId: a, otherRecordId: a, relation: 'friend' }, ctx())).code).toBe('E_ARGS_INVALID');
		expect((await runTool('link_records', { recordId: a, otherRecordId: k, relation: 'friend' }, ctx())).code).toBe('E_ARGS_INVALID');
		expect((await runTool('link_records', { recordId: a, otherRecordId: 'local-none', relation: 'friend' }, ctx())).code).toBe('E_RECORD_NOT_FOUND');
		expect((await runTool('link_records', { recordId: a, otherRecordId: b, relation: 'enemy' }, ctx())).code).toBe('E_ARGS_INVALID');
	});
	it('🔴 两侧都查:对方已有指向本人的边而本人没有 → 拒、对方那条类型不被改写、本人侧不新增;报错文案不带已有关系的类型', async ()=>{
		const a = await mkChart('单向甲');
		const b = await mkChart('单向乙');
		// 只有乙侧有一条指向甲的边(用户在档案管理里建过一半 / 旧数据)
		upsertLocalChart({ cid: b, relations: [{ cid: a, type: 'friend' }], preserveUpdateTime: true, updateTime: getLocalChart(b).updateTime });
		const r = await runTool('link_records', { recordId: a, otherRecordId: b, relation: 'spouse' }, ctx());
		expect(r.ok).toBe(false); expect(r.code).toBe('E_ARGS_INVALID');
		expect(getLocalChart(b).relations).toEqual([{ cid: a, type: 'friend' }]);
		expect(getLocalChart(a).relations || []).toEqual([]);
		RELATION_TYPES.forEach((t)=>{ expect(r.message.indexOf(t.label)).toBe(-1); expect(r.message.indexOf(t.value)).toBe(-1); });
		// 恰好同一类型的单侧边也不当「已是这层关系」:不补另一侧,如实拒
		const r2 = await runTool('link_records', { recordId: b, otherRecordId: a, relation: 'friend' }, ctx());
		expect(r2.ok).toBe(false); expect(r2.code).toBe('E_ARGS_INVALID');
		expect(getLocalChart(a).relations || []).toEqual([]);
		// 反方向(本人侧有、对方侧没有)同样拒
		const c = await mkChart('单向丙');
		upsertLocalChart({ cid: c, relations: [{ cid: b, type: 'client' }], preserveUpdateTime: true, updateTime: getLocalChart(c).updateTime });
		const r3 = await runTool('link_records', { recordId: c, otherRecordId: b, relation: 'friend' }, ctx());
		expect(r3.code).toBe('E_ARGS_INVALID');
		expect(getLocalChart(c).relations).toEqual([{ cid: b, type: 'client' }]);
		expect(getLocalChart(b).relations).toEqual([{ cid: a, type: 'friend' }]);
		expect(r3.message.indexOf('客户')).toBe(-1);
	});
	it('🔴 外部客户端 + 私人内容关着:「恰好已是这层关系」与「已有别的关系」回包同形,逐个类型试探读不出关系;私人内容开着才说「已是这层关系」', async ()=>{
		const a = await mkChart('探测甲');
		const b = await mkChart('探测乙');
		expect((await runTool('link_records', { recordId: a, otherRecordId: b, relation: 'spouse' }, ctx({ origin: 'in-app' }))).ok).toBe(true);
		setPrivateReadEnabled(false);
		const shape = (r)=>JSON.stringify({ ok: r.ok, code: r.code, message: r.message, data: r.data, summary: r.summary });
		const answers = [];
		for(const t of RELATION_TYPES){ answers.push(shape(await runTool('link_records', { recordId: a, otherRecordId: b, relation: t.value }, ctx()))); }
		expect(new Set(answers).size).toBe(1);   // 每个类型回同一包 → 看不出是 spouse
		RELATION_TYPES.forEach((t)=>{ expect(answers[0].indexOf(t.label)).toBe(-1); });
		expect(getLocalChart(a).relations).toEqual([{ cid: b, type: 'spouse' }]);
		setPrivateReadEnabled(true);
		const same = await runTool('link_records', { recordId: a, otherRecordId: b, relation: 'spouse' }, ctx());
		expect(same.ok).toBe(true); expect(same.data.changed).toBe(false);
		setPrivateReadEnabled(false);
	});
});

function fakeChat(start){
	const st = { sourceId: (start && start.sourceId) || '', partnerId: (start && start.partnerId) || '', techniques: (start && start.techniques) || [] };
	const ui = {
		getChatMount: ()=>({ ...st, techniques: st.techniques.slice() }),
		selectSource: (cid)=>{ st.sourceId = `${cid || ''}`; },
		setChatPartner: (cid)=>{ st.partnerId = `${cid || ''}`; },
		setChatTechniques: (keys)=>{ st.techniques = keys.slice(); },
	};
	return { st, ui };
}

describe('set_chat_mount', ()=>{
	it('缺对话桥 → E_BRIDGE_UNAVAILABLE;三个参数都不给 → E_ARGS_INVALID', async ()=>{
		expect((await runTool('set_chat_mount', { techniques: ['bazi'] }, ctx())).code).toBe('E_BRIDGE_UNAVAILABLE');
		registerWorkspaceUi(fakeChat().ui);
		expect((await runTool('set_chat_mount', {}, ctx())).code).toBe('E_ARGS_INVALID');
	});
	it('🔴 换本人 + 挂技法(只认该档案可挂的键,一个认不出整次拒)+ 合盘对方;账本撤销回到改之前', async ()=>{
		const a = await mkChart('挂载甲');
		const b = await mkChart('挂载乙');
		const allowed = listAnalysisTechniqueOptions(findAnalysisSourceById(a)).map((o)=>o.value);
		const two = allowed.slice(0, 2);
		expect(two.length).toBe(2);
		const chat = fakeChat({ techniques: [] });
		registerWorkspaceUi(chat.ui);
		const bad = await runTool('set_chat_mount', { recordId: a, techniques: [two[0], 'no_such_tech'] }, ctx());
		expect(bad.code).toBe('E_TECHNIQUE_NOT_ALLOWED'); expect(chat.st.sourceId).toBe('');
		const r = await runTool('set_chat_mount', { recordId: a, partnerRecordId: b, techniques: two }, ctx());
		okShaped('set_chat_mount', r);
		expect(chat.st).toEqual({ sourceId: a, partnerId: b, techniques: two });
		const same = await runTool('set_chat_mount', { techniques: two.slice().reverse() }, ctx());
		expect(same.data.changed).toBe(false);
		expect(listUiTrail({ turnId: 'turnM' }).length).toBe(0);   // 不再走会话内界面轨迹(刷新即清),改进账本
		expect(r.undo.kind).toBe('restore-chat-mount');
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(chat.st).toEqual({ sourceId: '', partnerId: '', techniques: [] });
		expect(undoAction(r.undo.actionId).code).toBe('E_UNDO_ALREADY');
	});
	it('🔴 撤销前比对:助手改完后用户又改了挂载 → 不自动撤;AI 分析页不在场 → 如实拒', async ()=>{
		const a = await mkChart('挂载戊');
		const allowed = listAnalysisTechniqueOptions(findAnalysisSourceById(a)).map((o)=>o.value);
		const chat = fakeChat({ techniques: [] });
		registerWorkspaceUi(chat.ui);
		const r = await runTool('set_chat_mount', { recordId: a, techniques: allowed.slice(0, 1) }, ctx());
		expect(r.ok).toBe(true);
		chat.ui.setChatTechniques(allowed.slice(0, 2));   // 用户亲手又加了一项
		expect(undoAction(r.undo.actionId).code).toBe('E_UNDO_RECORD_CHANGED');
		expect(chat.st.techniques).toEqual(allowed.slice(0, 2));
		const r2 = await runTool('set_chat_mount', { techniques: [] }, ctx());
		__resetWorkspaceBridgeForTests();
		expect(undoAction(r2.undo.actionId).code).toBe('E_BRIDGE_UNAVAILABLE');
	});
	it('🔴 只读档:改挂载按写入拒(零改动)', async ()=>{
		const a = await mkChart('挂载己');
		const chat = fakeChat({ techniques: [] });
		registerWorkspaceUi(chat.ui);
		const { resolveApprovalDecision } = require('../aiAgent/approvalPolicy');
		const def = listTools().find((d)=>d.name === 'set_chat_mount');
		expect(resolveApprovalDecision({ level: def.level, def, args: { recordId: a }, mode: 'read-only', categories: {}, trustedRecords: [], toolPolicy: {} })).toBe('deny');
		expect(chat.st.sourceId).toBe('');
	});
	it('合盘规则:对方须是命盘、不能是本人;取消合盘用空串', async ()=>{
		const a = await mkChart('挂载丙');
		const k = await mkCase('问事丙');
		const chat = fakeChat({ sourceId: a, partnerId: '', techniques: [] });
		registerWorkspaceUi(chat.ui);
		expect((await runTool('set_chat_mount', { partnerRecordId: a }, ctx())).code).toBe('E_ARGS_INVALID');
		expect((await runTool('set_chat_mount', { partnerRecordId: k }, ctx())).code).toBe('E_TECHNIQUE_NOT_ALLOWED');
		const b = await mkChart('挂载丁');
		expect((await runTool('set_chat_mount', { partnerRecordId: b }, ctx())).ok).toBe(true);
		expect(chat.st.partnerId).toBe(b);
		expect((await runTool('set_chat_mount', { partnerRecordId: '' }, ctx())).ok).toBe(true);
		expect(chat.st.partnerId).toBe('');
	});
});

describe('navigate_to_technique · AI 分析页页内页签', ()=>{
	const ROUTES = [{ key: 'aianalysis', label: 'AI 分析' }, { key: 'bazi', label: '八字' }];
	function fakeNav(start){
		const state = { tab: start || 'bazi', subTab: null };
		return { state, ui: { listRoutes: ()=>ROUTES, currentRoute: ()=>({ ...state }), navigate: (key, sub)=>{ state.tab = key; state.subTab = sub || null; return { ok: true, tab: key }; } } };
	}
	const TABS = [{ key: 'analysis', label: '分析' }, { key: 'history', label: '历史' }, { key: 'materials', label: '资料' }];
	it('🔴 从别的页过去:先切主路由、等对话桥登记页签表再切;未知页签拒并列出可用;回退回到原页', async ()=>{
		const nav = fakeNav('bazi');
		registerWorkspaceUi(nav.ui);
		let inner = 'analysis';
		setTimeout(()=>registerWorkspaceUi({ setInnerTab: (t)=>{ inner = t; }, listInnerTabs: ()=>TABS, currentInnerTab: ()=>inner }), 30);
		const r = await runTool('navigate_to_technique', { technique: 'aianalysis', subTab: 'history' }, ctx());
		expect(r.ok).toBe(true); expect(r.data.subTab).toBe('history');
		expect(nav.state.tab).toBe('aianalysis'); expect(inner).toBe('history');
		const bad = await runTool('navigate_to_technique', { technique: 'aianalysis', subTab: 'nope' }, ctx());
		expect(bad.code).toBe('E_ARGS_INVALID'); expect(bad.message).toContain('materials');
		const same = await runTool('navigate_to_technique', { technique: 'aianalysis', subTab: 'history' }, ctx());
		expect(same.data.changed).toBe(false);
		const t = listUiTrail({ turnId: 'turnM' });
		expect(undoUiTrail(t[t.length - 1].id).ok).toBe(true);
		expect(nav.state.tab).toBe('bazi');
	});
	it('已在 AI 分析页:只切页签,回退回到原页签', async ()=>{
		const nav = fakeNav('aianalysis');
		let inner = 'analysis';
		registerWorkspaceUi({ ...nav.ui, setInnerTab: (t)=>{ inner = t; }, listInnerTabs: ()=>TABS, currentInnerTab: ()=>inner });
		const r = await runTool('navigate_to_technique', { technique: 'aianalysis', subTab: 'materials' }, ctx());
		expect(r.ok).toBe(true); expect(inner).toBe('materials');
		const t = listUiTrail({ turnId: 'turnM' });
		expect(undoUiTrail(t[t.length - 1].id).ok).toBe(true);
		expect(inner).toBe('analysis');
	});
});
