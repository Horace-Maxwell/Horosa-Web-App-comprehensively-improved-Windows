// schedule_task 工具(P3)合同:子开关关=不进 manifest、调用即 E_TOOL_DISABLED;开=排期无下次 → E_SCHEDULE_INVALID 不建任务、custom-prompt 缺 prompt → E_ARGS_INVALID、
// 合法 → 建「已排期」任务(nextRunAt 在未来、每月 31 钳 28)并回 cancel-task 撤销支;账本撤销 → cancelled;schema 顶层与 schedule 封闭。
import def from '../aiTools/tools/scheduleTask';
import { registerBuiltinTools } from '../aiTools';
import { runTool, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { listActions, undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { bindTaskCenter, __resetTaskCenterForTests, getTask, listTasks } from '../aiAgent/tasks';
import { __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { setSchedulerEnabled, setAgentEnabled } from '../aiAgent/prefs';
import { clearStore, AI_ANALYSIS_STORES } from '../aiAnalysisStore';
import { SCHEDULED_KINDS } from '../aiAgent/tasks/schedule';

beforeEach(async ()=>{ window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetTaskCenterForTests(); __resetTaskCacheForTests(); await clearStore(AI_ANALYSIS_STORES.agentTasks); setAgentEnabled(true); });

describe('schedule_task', ()=>{
	it('目录形状:additive/tasks/cancel-task;enabled 是函数;kind+schedule 必填;顶层与 schedule 封闭;kind 枚举=四类', ()=>{
		expect(def.name).toBe('schedule_task');
		expect(def.level).toBe('additive');
		expect(def.category).toBe('tasks');
		expect(def.undoKind).toBe('cancel-task');
		expect(typeof def.enabled).toBe('function');
		expect(def.inputSchema.required).toEqual(['kind', 'schedule']);
		expect(def.inputSchema.additionalProperties).toBe(false);
		expect(def.inputSchema.properties.schedule.additionalProperties).toBe(false);
		expect(def.inputSchema.properties.kind.enum).toEqual(SCHEDULED_KINDS);
	});
	it('🔴 子开关关(缺省):不进 manifest;runTool → E_TOOL_DISABLED 不建任务', async ()=>{
		registerBuiltinTools();
		expect(exportToolManifest().some((t)=>t.name === 'schedule_task')).toBe(false);
		const r = await runTool('schedule_task', { kind: 'daily-brief', schedule: { type: 'daily', time: '08:00' } }, { origin: 'in-app' });
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_TOOL_DISABLED');
		expect((await listTasks()).length).toBe(0);
	});
	it('🔴 开:仅一次已过期 → E_SCHEDULE_INVALID 不建任务;custom-prompt 缺 prompt → E_ARGS_INVALID;合法 → 已排期+撤销支;撤销 → cancelled', async ()=>{
		setSchedulerEnabled(true);
		bindTaskCenter();
		registerBuiltinTools();
		expect(exportToolManifest().some((t)=>t.name === 'schedule_task')).toBe(true);
		const past = await runTool('schedule_task', { kind: 'custom-prompt', prompt: 'x', schedule: { type: 'once', at: '2020-01-01T00:00:00.000Z' } }, { origin: 'in-app' });
		expect(past.ok).toBe(false);
		expect(past.code).toBe('E_SCHEDULE_INVALID');
		const noPrompt = await runTool('schedule_task', { kind: 'custom-prompt', schedule: { type: 'daily', time: '08:00' } }, { origin: 'in-app' });
		expect(noPrompt.ok).toBe(false);
		expect(noPrompt.code).toBe('E_ARGS_INVALID');
		expect((await listTasks()).length).toBe(0);
		const r = await runTool('schedule_task', { kind: 'monthly-fortune', title: '月运', schedule: { type: 'monthly', day: 31, time: '08:00' }, missedPolicy: 'catch-up' }, { origin: 'in-app', requestId: 'req-1' });
		expect(r.ok).toBe(true);
		expect(r.data.status).toBe('scheduled');
		expect(r.data.schedule).toBe('每月 28 日 08:00');
		expect(Date.parse(r.data.nextRunAt)).toBeGreaterThan(Date.now());
		expect(r.undo.kind).toBe('cancel-task');
		const t = await getTask(r.data.taskId);
		expect(t.kind).toBe('scheduled');
		expect(t.status).toBe('scheduled');
		expect(t.missedPolicy).toBe('catch-up');
		expect(t.spec.kind).toBe('monthly-fortune');
		expect(t.spec.schedule).toEqual({ type: 'monthly', time: '08:00', day: 28 });
		expect(t.origin).toBe('in-app');
		const act = listActions().find((a)=>a.tool === 'schedule_task');
		expect(act.undo.payload.taskId).toBe(r.data.taskId);
		expect(undoAction(act.id).ok).toBe(true);
		await new Promise((res)=>setTimeout(res, 10));
		expect((await getTask(r.data.taskId)).status).toBe('cancelled');
	});
});
