// [批二④] hooks 否决合同(借鉴 Claude Code PreToolUse):tool.before 规则可在工具执行前同步否决 → E_HOOK_DENIED 零写入;
// 自动化总开关关 / 规则停用 / 工具名不匹配 / 事件不是 tool.before → 一律不否决(缺省=现状)。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { listLocalCharts } from '../localcharts';
import { emitAutomationEventSync, subscribeAutomationVeto, __resetAutomationEventsForTests, AUTOMATION_EVENTS } from '../aiAgent/automation/events';
import { bindAutomationEngine, refreshRulesCache, vetoDecision, __resetAutomationEngineForTests } from '../aiAgent/automation/engine';
import { saveRule, removeRule } from '../aiAgent/automation/ruleStore';
import { AUTOMATION_ACTION_TYPES } from '../aiAgent/automation/actions';
import { setAutomationEnabled } from '../aiAgent/prefs';
import { AI_ANALYSIS_STORES, clearStore } from '../aiAnalysisStore';

const NEW_CHART = { name: '张三', birth: '1990-01-01 08:00', place: '北京', gender: 'male' };
const ctx = ()=>({ origin: 'in-app', requestId: 'r1', dispatch: jest.fn(), ui: { selectSource: jest.fn(), refreshSources: jest.fn() } });

beforeEach(async ()=>{
	window.localStorage.clear();
	__resetToolsForTests(); __resetWorkspaceBridgeForTests(); __resetAutomationEventsForTests(); __resetAutomationEngineForTests();
	await clearStore(AI_ANALYSIS_STORES.automationRules);
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
});
afterEach(()=>{ __resetAutomationEngineForTests(); __resetAutomationEventsForTests(); });

it('事件层:tool.before 在白名单;同步通道任一订阅者 veto 即否决,抛错的订阅者不否决;事件层仍零 import', ()=>{
	expect(AUTOMATION_EVENTS).toContain('tool.before');
	expect(emitAutomationEventSync('tool.before', { toolName: 'x' })).toEqual({ vetoed: false });
	const off1 = subscribeAutomationVeto(()=>{ throw new Error('boom'); });
	const off2 = subscribeAutomationVeto((d)=>(d.payload.toolName === 'x' ? { veto: true, reason: '不许', ruleId: 'r' } : null));
	expect(emitAutomationEventSync('tool.before', { toolName: 'x' })).toEqual({ vetoed: true, reason: '不许', ruleId: 'r' });
	expect(emitAutomationEventSync('tool.before', { toolName: 'y' })).toEqual({ vetoed: false });
	expect(emitAutomationEventSync('nope', {})).toEqual({ vetoed: false });
	off1(); off2();
	expect(emitAutomationEventSync('tool.before', { toolName: 'x' })).toEqual({ vetoed: false });
});

it('规则 deny + 自动化开:create_chart_record 在执行前被否决 → E_HOOK_DENIED,命盘库零写入', async ()=>{
	setAutomationEnabled(true);
	await saveRule({ id: 'r-deny', name: '禁建档', event: 'tool.before', enabled: true, match: { toolName: 'create_chart_record' }, actions: [{ type: 'deny' }], cooldownMs: 0 });
	bindAutomationEngine({});
	await refreshRulesCache();
	const r = await runTool('create_chart_record', NEW_CHART, ctx());
	expect(r.ok).toBe(false);
	expect(r.code).toBe('E_HOOK_DENIED');
	expect(r.message).toContain('禁建档');
	expect(listLocalCharts({}).length).toBe(0);
	// 只读工具同样可被规则拒(工具名不匹配则放行)
	const ok = await runTool('list_records', { kind: 'all' }, ctx());
	expect(ok.ok).toBe(true);
});

it('判别力:自动化关 / 规则停用 / 事件不是 tool.before / 删除规则 → 都不否决', async ()=>{
	await saveRule({ id: 'r-deny', name: '禁建档', event: 'tool.before', enabled: true, match: { toolName: 'create_chart_record' }, actions: [{ type: 'deny' }], cooldownMs: 0 });
	bindAutomationEngine({});
	await refreshRulesCache();
	setAutomationEnabled(false);
	expect(vetoDecision({ event: 'tool.before', payload: { toolName: 'create_chart_record' } })).toBe(null);
	setAutomationEnabled(true);
	expect(vetoDecision({ event: 'tool.before', payload: { toolName: 'create_chart_record' } })).toBeTruthy();
	await saveRule({ id: 'r-deny', name: '禁建档', event: 'tool.before', enabled: false, match: { toolName: 'create_chart_record' }, actions: [{ type: 'deny' }], cooldownMs: 0 });
	await refreshRulesCache();
	expect(vetoDecision({ event: 'tool.before', payload: { toolName: 'create_chart_record' } })).toBe(null);
	// [Q-294/M-109·AR-21] deny × 非 tool.before 是永不执行的硬组合 → 保存即拒(此前存得进去、否决器也不认)
	await expect(saveRule({ id: 'r-after', name: '事后', event: 'tool.after', enabled: true, match: { toolName: 'create_chart_record' }, actions: [{ type: 'deny' }], cooldownMs: 0 })).rejects.toThrow(/拒绝执行/);
	await expect(saveRule({ id: 'r-before-sel', name: '前置选源', event: 'tool.before', enabled: true, match: {}, actions: [{ type: 'select-source' }], cooldownMs: 0 })).rejects.toThrow(/工具执行前/);
	await refreshRulesCache();
	expect(vetoDecision({ event: 'tool.before', payload: { toolName: 'create_chart_record' } })).toBe(null);
	await removeRule('r-deny'); await removeRule('r-after');
	await refreshRulesCache();
	const r = await runTool('create_chart_record', NEW_CHART, ctx());
	expect(r.ok).toBe(true);
	expect(listLocalCharts({}).length).toBe(1);
});

it('规则变更事件让引擎缓存自动刷新(面板存规则后不用重启);deny 在动作表里,异步路径对它静默', async ()=>{
	setAutomationEnabled(true);
	bindAutomationEngine({});
	await refreshRulesCache();
	expect(vetoDecision({ event: 'tool.before', payload: { toolName: 'set_settings' } })).toBe(null);
	await saveRule({ id: 'r2', name: '禁改设置', event: 'tool.before', enabled: true, match: { toolName: 'set_settings' }, actions: [{ type: 'deny' }], cooldownMs: 0 });
	await new Promise((r)=>setTimeout(r, 30));   // saveRule 广播 → 引擎异步 refresh
	expect(vetoDecision({ event: 'tool.before', payload: { toolName: 'set_settings' } })).toBeTruthy();
	expect(AUTOMATION_ACTION_TYPES).toContain('deny');
});
