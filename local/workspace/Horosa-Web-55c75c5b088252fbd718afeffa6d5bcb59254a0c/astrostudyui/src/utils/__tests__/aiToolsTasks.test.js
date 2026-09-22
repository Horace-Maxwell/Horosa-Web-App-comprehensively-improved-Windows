// create_goal_task 工具(P2)合同:子开关关=不进 manifest、调用即 E_TOOL_DISABLED;开=建任务(autoStart false 只排队)并回 cancel-task 撤销支;
// 账本撤销:排队中可撤(→cancelled);已开始 → E_UNDO_TASK_STARTED;schema 顶层封闭且 techniques 枚举来自单源。
import def from '../aiTools/tools/createGoalTask';
import { registerBuiltinTools } from '../aiTools';
import { runTool, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { listActions, undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { bindTaskCenter, __resetTaskCenterForTests, getTask, patchTask } from '../aiAgent/tasks';
import { __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { setGoalEnabled, setAgentEnabled } from '../aiAgent/prefs';
import { clearStore, AI_ANALYSIS_STORES } from '../aiAnalysisStore';
import { ANALYSIS_CHART_TECHNIQUES } from '../aiAnalysisContext';

beforeEach(async ()=>{ window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetTaskCenterForTests(); __resetTaskCacheForTests(); await clearStore(AI_ANALYSIS_STORES.agentTasks); setAgentEnabled(true); });

describe('create_goal_task', ()=>{
	it('目录形状:additive/tasks/cancel-task;enabled 是函数;goal 必填;顶层封闭;techniques 枚举含图表技法单源', ()=>{
		expect(def.name).toBe('create_goal_task');
		expect(def.level).toBe('additive');
		expect(def.category).toBe('tasks');
		expect(def.undoKind).toBe('cancel-task');
		expect(typeof def.enabled).toBe('function');
		expect(def.inputSchema.required).toEqual(['goal']);
		expect(def.inputSchema.additionalProperties).toBe(false);
		expect(def.inputSchema.properties.budget.additionalProperties).toBe(false);
		ANALYSIS_CHART_TECHNIQUES.forEach((k)=>expect(def.inputSchema.properties.techniques.items.enum).toContain(k));
	});
	it('🔴 子开关关(缺省):不进 manifest;runTool → E_TOOL_DISABLED 不执行', async ()=>{
		registerBuiltinTools();
		expect(exportToolManifest().some((t)=>t.name === 'create_goal_task')).toBe(false);
		const r = await runTool('create_goal_task', { goal: 'G' }, { origin: 'in-app' });
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_TOOL_DISABLED');
	});
	it('🔴 开:建任务排队(autoStart false),账本记 cancel-task;排队中撤销 → cancelled;开始后撤销 → E_UNDO_TASK_STARTED', async ()=>{
		setGoalEnabled(true);
		bindTaskCenter();
		registerBuiltinTools();
		expect(exportToolManifest().some((t)=>t.name === 'create_goal_task')).toBe(true);
		const r = await runTool('create_goal_task', { goal: '把三个人建档', budget: { maxTurns: 2 }, autoStart: false }, { origin: 'in-app', requestId: 'req-1' });
		expect(r.ok).toBe(true);
		expect(r.data.status).toBe('queued');
		// registry 记账后把 undo 改写成账本形状 {actionId,kind,label};payload 留在账本行里
		expect(r.undo.kind).toBe('cancel-task');
		expect(typeof r.undo.actionId).toBe('string');
		const t = await getTask(r.data.taskId);
		expect(t.budget.maxTurns).toBe(2);
		expect(t.origin).toBe('in-app');
		const act = listActions().find((a)=>a.tool === 'create_goal_task');
		expect(act).toBeTruthy();
		expect(act.undo.kind).toBe('cancel-task');
		expect(act.undo.payload.taskId).toBe(r.data.taskId);
		expect(act.id).toBe(r.undo.actionId);
		const u = undoAction(act.id);
		expect(u.ok).toBe(true);
		await new Promise((res)=>setTimeout(res, 10));
		expect((await getTask(r.data.taskId)).status).toBe('cancelled');
		// 已开始的不能撤
		const r2 = await runTool('create_goal_task', { goal: 'G2', autoStart: false }, { origin: 'in-app' });
		await patchTask(r2.data.taskId, { status: 'running' });
		const act2 = listActions().find((a)=>a.tool === 'create_goal_task' && a.undo.payload.taskId === r2.data.taskId);
		const u2 = undoAction(act2.id);
		expect(u2.ok).toBe(false);
		expect(u2.code).toBe('E_UNDO_TASK_STARTED');
		expect((await getTask(r2.data.taskId)).status).toBe('running');
	});
});
