// [D38] 后台任务用「创建时」的模型:此前 spec.modelSelection 没有任何创建路径写它,resolveHeadlessProfile 一律回落到当前 UI 选择
// (用户换模型 ⇒ 所有排期任务静默换模型;profiles[0] 兜底还可能换到别家)。
import { createGoalTask, resolveHeadlessProfile } from '../aiAgent/goalRunner';
import { snapshotModelSelection } from '../aiAgent/tasks/modelSnapshot';
import { getTask, __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { __resetTaskRegistryForTests } from '../aiAgent/tasks/taskRegistry';
import { clearStore, putStoreRecord, AI_ANALYSIS_STORES, saveUiPrefs, loadUiPrefs } from '../aiAnalysisStore';
import { setAgentEnabled, setGoalEnabled } from '../aiAgent/prefs';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerBuiltinTools } from '../aiTools';
import { setSchedulerEnabled } from '../aiAgent/prefs';

const P1 = { id: 'p1', name: '甲', providerType: 'openai', protocolFamily: 'openai', baseUrl: 'http://x', apiKey: 'k', chatModelIds: ['m1'], enabled: true };
const P2 = { id: 'p2', name: '乙', providerType: 'anthropic', protocolFamily: 'anthropic', baseUrl: 'http://y', apiKey: 'k', chatModelIds: ['m2'], enabled: true };

beforeEach(async ()=>{
	window.localStorage.clear(); __resetTaskCacheForTests(); __resetTaskRegistryForTests(); __resetToolsForTests();
	await clearStore(AI_ANALYSIS_STORES.agentTasks); await clearStore(AI_ANALYSIS_STORES.providerProfiles);
	await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, P1, 'prof'); await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, P2, 'prof');
	setAgentEnabled(true); setGoalEnabled(true);
	saveUiPrefs({ ...(loadUiPrefs() || {}), modelSelection: 'p1::m1' });
});

it('快照:UI 当前选 p1::m1 时建目标任务 ⇒ spec.modelSelection 钉住;之后 UI 换到 p2::m2,解析仍是 p1/m1', async ()=>{
	const t = await createGoalTask({ goal: '看事业', successCriteria: '有结论', autoStart: false });
	expect((await getTask(t.id)).spec.modelSelection).toBe('p1::m1');
	saveUiPrefs({ ...(loadUiPrefs() || {}), modelSelection: 'p2::m2' });
	const r = await resolveHeadlessProfile((await getTask(t.id)).spec);
	expect(r.profile.id).toBe('p1'); expect(r.model).toBe('m1');
});
it('旧任务(无字段)⇒ 仍读当前 UI 选择(现状不变)', async ()=>{
	saveUiPrefs({ ...(loadUiPrefs() || {}), modelSelection: 'p2::m2' });
	const r = await resolveHeadlessProfile({ goal: 'x' });
	expect(r.profile.id).toBe('p2'); expect(r.model).toBe('m2');
});
it('钉住的档案被删 ⇒ 解析为 null(不再静默换到 profiles[0] 别家档案)', async ()=>{
	const t = await createGoalTask({ goal: '看事业', autoStart: false });
	await clearStore(AI_ANALYSIS_STORES.providerProfiles);
	await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, P2, 'prof');
	expect(await resolveHeadlessProfile((await getTask(t.id)).spec)).toBe(null);
	// 无字段的旧任务仍可回落到唯一可用档案(现状)
	expect((await resolveHeadlessProfile({ goal: 'x' })).profile.id).toBe('p2');
});
it('显式 modelSelection 优先;snapshotModelSelection 读不到 UI 时回空串', ()=>{
	expect(snapshotModelSelection('p9::m9')).toBe('p9::m9');
	saveUiPrefs({ ...(loadUiPrefs() || {}), modelSelection: '' });
	expect(snapshotModelSelection()).toBe('');
});
it('schedule_task 工具建的定时任务同样快照 modelSelection', async ()=>{
	registerBuiltinTools(); setSchedulerEnabled(true);
	const r = await runTool('schedule_task', { kind: 'custom-prompt', prompt: '每日一句', schedule: { type: 'daily', time: '09:00' } }, { origin: 'in-app', requestId: 'r1' });
	expect(r.ok).toBe(true);
	expect((await getTask(r.data.taskId)).spec.modelSelection).toBe('p1::m1');
});

// [D77] 运行时把本 Turn 的档案::模型注入 ctx.modelSelection;两件建任务工具都用它做创建时快照(此前 schedule_task 读的 ctx 键从不注入 = 死参数,
//   create_goal_task 根本不传 ⇒ 目标任务里再建任务会钉住 UI 当前模型而非任务自己的模型)
it('🔴 [D77] 工具收到 ctx.modelSelection ⇒ 目标 / 定时任务都钉住它(而非 UI 当前选择)', async ()=>{
	registerBuiltinTools(); setSchedulerEnabled(true);
	saveUiPrefs({ ...(loadUiPrefs() || {}), modelSelection: 'p1::m1' });
	const g = await runTool('create_goal_task', { goal: '看事业', autoStart: false }, { origin: 'goal', requestId: 'r2', modelSelection: 'p2::m2' });
	expect(g.ok).toBe(true);
	expect((await getTask(g.data.taskId)).spec.modelSelection).toBe('p2::m2');
	const s = await runTool('schedule_task', { kind: 'custom-prompt', prompt: '每日一句', schedule: { type: 'daily', time: '09:00' } }, { origin: 'goal', requestId: 'r3', modelSelection: 'p2::m2' });
	expect(s.ok).toBe(true);
	expect((await getTask(s.data.taskId)).spec.modelSelection).toBe('p2::m2');
});
it('[D77] 运行时源码锁:runTool ctx 带 modelSelection = profileId::model', ()=>{
	const fs = require('fs'); const path = require('path');
	const src = fs.readFileSync(path.resolve(__dirname, '..', 'aiAgent', 'runtime.js'), 'utf8').replace(/^\s*\/\/.*$/mg, '');
	expect(src).toContain('modelSelection: profileId && model ? `${profileId}::${model}` : undefined,');
});
