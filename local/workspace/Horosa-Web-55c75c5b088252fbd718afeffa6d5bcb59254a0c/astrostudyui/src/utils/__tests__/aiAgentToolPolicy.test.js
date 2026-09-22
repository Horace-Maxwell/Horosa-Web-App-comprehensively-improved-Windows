// [批二②] 按工具名放行/禁用 + interactive 类别消分叉。
// 合同:deny > read-only > allow > 信任 > ask;deny 对只读工具同样生效且不进工具目录;类别单源 = 目录 TOOL_CATEGORIES(含 interactive)。
import { normalizeToolPolicy, getToolPolicy, setToolPolicy, AGENT_APPROVAL_CATEGORIES, AGENT_TOOL_POLICY_KEY, setAgentEnabled, setAgentApprovalMode } from '../aiAgent/prefs';
import { resolveApprovalDecision } from '../aiAgent/approvalPolicy';
import { TOOL_CATEGORIES } from '../aiTools/catalog';
import { createAgentTurn } from '../aiAgent/runtime';
import { __resetToolsForTests } from '../aiTools/registry';

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); });

it('类别单源:审批类别 = 目录类别(含 interactive,此前反问类在类别档上无处收紧)', ()=>{
	expect(AGENT_APPROVAL_CATEGORIES).toEqual(TOOL_CATEGORIES);
	expect(AGENT_APPROVAL_CATEGORIES).toContain('interactive');
});

it('归一:非法名/重复/超上限丢;同名同时出现禁用优先;缺省空 = 现状', ()=>{
	expect(getToolPolicy()).toEqual({ allow: [], deny: [] });
	const p = normalizeToolPolicy({ allow: ['set_settings', 'set_settings', 'Bad Name', 'x'.repeat(80), 'create_chart_record'], deny: ['create_chart_record', 'constructor', 'web_search'] });
	expect(p).toEqual({ allow: ['set_settings'], deny: ['create_chart_record', 'constructor', 'web_search'] });
	const saved = setToolPolicy({ deny: ['get_current_context'] });
	expect(saved.deny).toEqual(['get_current_context']);
	expect(JSON.parse(window.localStorage.getItem(AGENT_TOOL_POLICY_KEY)).deny).toEqual(['get_current_context']);
	expect(normalizeToolPolicy({ deny: Array.from({ length: 100 }, (_, i)=>`t_${i}`) }).deny.length).toBe(64);
});

describe('优先级:deny > read-only > allow > 信任 > ask', ()=>{
	const def = (name, category)=>({ name, category });
	it('deny 对任何级别、任何档位都拒(含只读工具与全自动档)', ()=>{
		const tp = { allow: [], deny: ['get_current_context', 'create_chart_record'] };
		expect(resolveApprovalDecision({ level: 'read', def: def('get_current_context', 'workspace'), args: {}, mode: 'never', categories: {}, trustedRecords: [], toolPolicy: tp })).toBe('deny');
		expect(resolveApprovalDecision({ level: 'additive', def: def('create_chart_record', 'records'), args: {}, mode: 'never', categories: {}, trustedRecords: [], toolPolicy: tp })).toBe('deny');
		expect(resolveApprovalDecision({ level: 'read', def: def('list_records', 'query'), args: {}, mode: 'never', categories: {}, trustedRecords: [], toolPolicy: tp })).toBe('auto');
	});
	it('allow 把每次确认变自动,但越不过只读档;不在名单的仍询问', ()=>{
		const tp = { allow: ['set_settings'], deny: [] };
		expect(resolveApprovalDecision({ level: 'additive', def: def('set_settings', 'settings'), args: {}, mode: 'on-request', categories: {}, trustedRecords: [], toolPolicy: tp })).toBe('auto');
		expect(resolveApprovalDecision({ level: 'additive', def: def('set_settings', 'settings'), args: {}, mode: 'read-only', categories: {}, trustedRecords: [], toolPolicy: tp })).toBe('deny');
		expect(resolveApprovalDecision({ level: 'additive', def: def('set_settings', 'settings'), args: {}, mode: 'on-request', categories: { settings: 'read-only' }, trustedRecords: [], toolPolicy: tp })).toBe('deny');
		expect(resolveApprovalDecision({ level: 'additive', def: def('create_chart_record', 'records'), args: {}, mode: 'on-request', categories: {}, trustedRecords: [], toolPolicy: tp })).toBe('ask');
	});
	it('无策略(缺省)与既有判定逐字相同', ()=>{
		expect(resolveApprovalDecision({ level: 'additive', def: def('create_chart_record', 'records'), args: {}, mode: 'on-request', categories: {}, trustedRecords: [] })).toBe('ask');
		expect(resolveApprovalDecision({ level: 'read', def: def('list_records', 'query'), args: {}, mode: 'read-only', categories: {}, trustedRecords: [] })).toBe('auto');
	});
});

describe('运行时', ()=>{
	it('deny 的工具不进本 Turn 工具目录;模型硬调 → E_APPROVAL_DENIED(skipped),只读工具同样', async ()=>{
		setAgentEnabled(true); setAgentApprovalMode('never');
		setToolPolicy({ deny: ['get_current_context'] });
		const agent = createAgentTurn({ profile: { id: 'p1' }, model: 'm' });
		expect(agent.enabled).toBe(true);
		const names = (agent.toolDefs() || []).map((t)=>t.name);
		expect(names).toContain('list_records');
		expect(names).not.toContain('get_current_context');
		agent.beginRound();
		agent.onEvent({ type: 'tool_call', json: { id: 'c1', name: 'get_current_context', arguments: '{}' } });
		agent.onEvent({ type: 'tool_call', json: { id: 'c2', name: 'list_records', arguments: '{"kind":"all"}' } });
		const more = await agent.settleRound();
		expect(more).toBe(true);
		const trace = agent.trace();
		const results = trace.rounds[0].results;
		const denied = results.find((r)=>r.name === 'get_current_context');
		const ok = results.find((r)=>r.name === 'list_records');
		expect(denied.code).toBe('E_APPROVAL_DENIED');
		expect(denied.status).toBe('skipped');
		expect(ok.ok).toBe(true);
	});
	it('缺省空策略:目录与判定与现状逐字相同(零回归锚)', ()=>{
		setAgentEnabled(true);
		const agent = createAgentTurn({ profile: { id: 'p1' }, model: 'm' });
		const names = (agent.toolDefs() || []).map((t)=>t.name);
		expect(names).toContain('get_current_context');
	});
});
