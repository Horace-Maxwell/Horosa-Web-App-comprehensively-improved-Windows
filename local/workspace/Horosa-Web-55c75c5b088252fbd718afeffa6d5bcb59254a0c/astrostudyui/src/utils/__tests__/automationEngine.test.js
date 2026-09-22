// 自动化规则(P4)合同:事件层零 import(静态判别);默认关零触发;匹配/冷却/每事件上限/深度守卫;动作抛错只留痕不反噬;
// 数据层与工具面的调用点确实在发事件(record.saved / tool.after)。
import fs from 'fs';
import path from 'path';
import { AUTOMATION_EVENTS, emitAutomationEvent, subscribeAutomationEvents, isAutomationEventName, __resetAutomationEventsForTests } from '../aiAgent/automation/events';
import { normalizeRule, saveRule, listRules, removeRule, RULE_COOLDOWN_DEFAULT_MS } from '../aiAgent/automation/ruleStore';
import { handleAutomationEvent, matchRule, isCoolingDown, bindAutomationEngine, __resetAutomationEngineForTests, MAX_RULES_PER_EVENT } from '../aiAgent/automation/engine';
import { setAutomationEnabled, isAutomationEnabled } from '../aiAgent/prefs';
import { AI_ANALYSIS_STORES, clearStore, listStoreRecords } from '../aiAnalysisStore';

const detail = (event, payload)=>({ event, payload: payload || {}, at: '2026-01-01T00:00:00.000Z' });

beforeEach(async ()=>{
	window.localStorage.clear();
	__resetAutomationEventsForTests(); __resetAutomationEngineForTests();
	await clearStore(AI_ANALYSIS_STORES.automationRules);
	await clearStore(AI_ANALYSIS_STORES.agentNotices);
});

it('🔴 事件层零 import(静态判别);事件名白名单;订阅可退订;emit 不抛', ()=>{
	const src = fs.readFileSync(path.resolve(__dirname, '..', 'aiAgent', 'automation', 'events.js'), 'utf8');
	expect(src.split('\n').filter((l)=>/^import\b/.test(l)).length).toBe(0);
	expect(AUTOMATION_EVENTS).toEqual(['app.start', 'record.saved', 'turn.end', 'tool.before', 'tool.after', 'task.done', 'report.done']);   // [批二④] +tool.before(可否决)
	expect(isAutomationEventName('record.saved')).toBe(true);
	expect(isAutomationEventName('nope')).toBe(false);
	const seen = [];
	const off = subscribeAutomationEvents((d)=>seen.push(d.event));
	expect(emitAutomationEvent('record.saved', { cid: 'local-1' })).toBe(true);
	expect(emitAutomationEvent('nope', {})).toBe(false);
	off();
	emitAutomationEvent('app.start', {});
	expect(seen).toEqual(['record.saved']);
	// 订阅者抛错不反噬发送方
	subscribeAutomationEvents(()=>{ throw new Error('boom'); });
	expect(()=>emitAutomationEvent('app.start', {})).not.toThrow();
});

it('🔴 默认关:引擎收到事件零动作(规则可先建好);打开后才跑', async ()=>{
	expect(isAutomationEnabled()).toBe(false);
	const ran = [];
	await saveRule({ id: 'r1', name: '设为当前源', event: 'record.saved', enabled: true, actions: [{ type: 'select-source' }], cooldownMs: 0 });
	const deps = { selectSource: async (cid)=>{ ran.push(cid); } };
	const off = await handleAutomationEvent(detail('record.saved', { cid: 'local-1' }), { deps });
	expect(off.off).toBe(true);
	expect(ran).toEqual([]);
	setAutomationEnabled(true);
	const on = await handleAutomationEvent(detail('record.saved', { cid: 'local-1' }), { deps });
	expect(on.fired).toEqual(['r1']);
	expect(ran).toEqual(['local-1']);
});

it('🔴 深度守卫:automation 触发的动作再发事件时不再触发(防自激)', async ()=>{
	setAutomationEnabled(true);
	const ran = [];
	await saveRule({ id: 'r1', name: 'x', event: 'tool.after', enabled: true, actions: [{ type: 'select-source', cid: 'local-9' }], cooldownMs: 0 });
	const deps = { selectSource: async (cid)=>{ ran.push(cid); } };
	const guarded = await handleAutomationEvent(detail('tool.after', { toolName: 'create_chart_record', origin: 'automation' }), { deps });
	expect(guarded.depthGuard).toBe(true);
	expect(ran).toEqual([]);
	const normal = await handleAutomationEvent(detail('tool.after', { toolName: 'create_chart_record', origin: 'in-app' }), { deps });
	expect(normal.fired).toEqual(['r1']);
});

it('🔴 匹配/冷却/每事件上限:条件不符不触发;冷却内跳过;同事件最多三条', async ()=>{
	setAutomationEnabled(true);
	expect(matchRule({ enabled: true, event: 'record.saved', match: { kind: 'chart' } }, detail('record.saved', { kind: 'case' }))).toBe(false);
	expect(matchRule({ enabled: true, event: 'record.saved', match: { kind: 'chart' } }, detail('record.saved', { kind: 'chart' }))).toBe(true);
	expect(matchRule({ enabled: false, event: 'record.saved', match: {} }, detail('record.saved', {}))).toBe(false);
	expect(matchRule({ enabled: true, event: 'record.saved', match: { contains: 'local-7' } }, detail('record.saved', { cid: 'local-7' }))).toBe(true);
	const now = Date.parse('2026-01-01T00:00:30.000Z');
	expect(isCoolingDown({ lastFiredAt: '2026-01-01T00:00:00.000Z', cooldownMs: 60000 }, now)).toBe(true);
	expect(isCoolingDown({ lastFiredAt: '2026-01-01T00:00:00.000Z', cooldownMs: 10000 }, now)).toBe(false);
	expect(isCoolingDown({ cooldownMs: 60000 }, now)).toBe(false);
	const ran = [];
	const deps = { selectSource: async (cid)=>{ ran.push(cid); } };
	for(let i = 0; i < 5; i++){
		// eslint-disable-next-line no-await-in-loop
		await saveRule({ id: `r${i}`, name: `r${i}`, event: 'record.saved', enabled: true, actions: [{ type: 'select-source' }], cooldownMs: 0 });
	}
	const out = await handleAutomationEvent(detail('record.saved', { cid: 'local-1' }), { deps });
	expect(out.fired.length).toBe(MAX_RULES_PER_EVENT);
	expect(out.skipped.filter((s)=>s.reason === 'max-per-event').length).toBe(2);
	// 冷却:刚跑过的规则第二次事件被跳过
	const again = await handleAutomationEvent(detail('record.saved', { cid: 'local-2' }), { deps, now: Date.now() });
	expect(again.skipped.some((s)=>s.reason === 'cooldown')).toBe(false);   // cooldownMs=0 → 不冷却
	await saveRule({ id: 'rc', name: '带冷却', event: 'task.done', enabled: true, actions: [{ type: 'select-source', cid: 'local-3' }], cooldownMs: 60000 });
	const first = await handleAutomationEvent(detail('task.done', {}), { deps });
	expect(first.fired).toEqual(['rc']);
	const second = await handleAutomationEvent(detail('task.done', {}), { deps });
	expect(second.skipped).toEqual([{ ruleId: 'rc', reason: 'cooldown' }]);
});

// [压测二轮·A3] 合同改为「尝试即计冷却」:动作恒失败的规则同样写 lastFiredAt(否则每来一条事件重试一次+刷一条通知;见 aiAgentAutomationStress A3)
it('🔴 动作抛错 / 未知动作:只留痕(通知)不反噬;规则按「尝试」计冷却(fired 仍为空)', async ()=>{
	setAutomationEnabled(true);
	await saveRule({ id: 'r1', name: '会炸的', event: 'app.start', enabled: true, actions: [{ type: 'select-source' }, { type: 'nope' }], cooldownMs: 0 });
	const deps = { selectSource: async ()=>{ throw new Error('炸了'); } };
	const out = await handleAutomationEvent(detail('app.start', {}), { deps });
	expect(out.fired).toEqual([]);
	expect(out.skipped).toEqual([{ ruleId: 'r1', reason: 'all-actions-failed' }]);
	const notices = await listStoreRecords(AI_ANALYSIS_STORES.agentNotices);
	expect(notices.length).toBeGreaterThanOrEqual(2);
	expect(notices.every((n)=>n.level === 'warn')).toBe(true);
	const rules = await listRules();
	expect(rules[0].lastFiredAt).not.toBe('');   // 尝试即计冷却(A3):失败也写 lastFiredAt,冷却期内不再重试刷屏
});

it('规则存储:归一(未知事件丢/动作封顶三条/冷却夹在范围内);增删查', async ()=>{
	const n = normalizeRule({ name: 'x'.repeat(200), event: 'nope', actions: [1, 2, { type: 'a' }, { type: 'b' }, { type: 'c' }, { type: 'd' }], cooldownMs: -5 });
	expect(n.event).toBe('');
	expect(n.enabled).toBe(false);
	expect(n.actions.length).toBe(3);
	expect(n.cooldownMs).toBe(0);
	expect(n.name.length).toBe(60);
	expect(normalizeRule({}).cooldownMs).toBe(RULE_COOLDOWN_DEFAULT_MS);
	await saveRule({ id: 'k1', name: 'a', event: 'app.start', enabled: true, actions: [{ type: 'select-source' }] });
	expect((await listRules()).map((r)=>r.id)).toEqual(['k1']);
	await removeRule('k1');
	expect(await listRules()).toEqual([]);
	await expect(saveRule({ name: 'bad', event: 'nope', actions: [] })).rejects.toThrow();
});

it('🔴 调用点确实在发事件:数据层两处 record.saved、工具面 tool.after、任务层 task.done、应用启动 app.start', ()=>{
	const root = path.resolve(__dirname, '..', '..');
	const grab = (rel)=>fs.readFileSync(path.join(root, rel), 'utf8').replace(/\/\/.*$/gm, '');
	expect((grab('utils/localcharts.js').match(/emitAutomationEvent\('record\.saved'/g) || []).length).toBe(1);
	expect((grab('utils/localcases.js').match(/emitAutomationEvent\('record\.saved'/g) || []).length).toBe(1);
	expect((grab('utils/aiTools/registry.js').match(/emitAutomationEvent\('tool\.after'/g) || []).length).toBe(1);
	expect((grab('utils/aiAgent/tasks/taskStore.js').match(/emitAutomationEvent\('task\.done'/g) || []).length).toBe(1);
	expect((grab('layouts/app.js').match(/emitAutomationEvent\('app\.start'/g) || []).length).toBe(1);
	// 引擎绑定幂等
	const off1 = bindAutomationEngine({});
	const off2 = bindAutomationEngine({});
	expect(off1).toBe(off2);
});
