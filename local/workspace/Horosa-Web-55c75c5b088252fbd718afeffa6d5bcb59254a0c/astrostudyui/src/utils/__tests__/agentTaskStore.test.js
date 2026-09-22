// 任务实体(P1)合同:缺省归一/状态机迁移表/日志封顶/取消与撤销支/控制器登记。内存回退径(jsdom 无 indexedDB)。
import { createTask, getTask, listTasks, patchTask, appendLog, cancelTask, undoCreateTask, canTransition, TASK_STATUSES, TASK_TRANSITIONS, TASK_TERMINAL, DEFAULT_TASK_BUDGET, TASK_LOG_MAX, __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { registerRunning, controllerOf, __resetTaskRegistryForTests } from '../aiAgent/tasks/taskRegistry';
import { cancelTaskUndoHandler } from '../aiAgent/tasks';
import { appendAction, getAction, newActionId, registerUndoHandler, undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { clearStore, AI_ANALYSIS_STORES, putStoreRecord } from '../aiAnalysisStore';

beforeEach(async ()=>{ __resetTaskRegistryForTests(); await clearStore(AI_ANALYSIS_STORES.agentTasks); });

describe('taskStore', ()=>{
	it('createTask 缺省:status queued/kind goal/budget 合并缺省/spent 零/log 空/schemaVersion 1;标题按 kind 兜底', async ()=>{
		const t = await createTask({ kind: 'goal', spec: { goal: '建两个人' }, budget: { maxTurns: 3 } });
		expect(t.status).toBe('queued');
		expect(t.budget).toEqual({ ...DEFAULT_TASK_BUDGET, maxTurns: 3 });
		expect(t.spent).toEqual({ turns: 0, calls: 0, costUsd: 0, wallMs: 0 });
		expect(t.log).toEqual([]);
		expect(t.taskSchema).toBe(1);
		expect(t.title).toBe('目标任务');
		expect(t.origin).toBe('in-app');
		const s = await createTask({ kind: 'scheduled', title: 'x'.repeat(200) });
		expect(s.title.length).toBe(120);
		expect((await createTask({ kind: 'bogus' })).kind).toBe('goal');
	});
	it('🔴 状态机:迁移表穷举——合法迁移成功,非法迁移抛 E_TASK_TRANSITION 且记录不变;终态不可再迁', async ()=>{
		for(const from of TASK_STATUSES){
			for(const to of TASK_STATUSES){
				// eslint-disable-next-line no-await-in-loop
				const t = await createTask({ kind: 'goal' });
				// 直接落 from(绕过校验:内存态写入用 patch 允许的路径不一定可达,这里用 normalize 后 put)
				// eslint-disable-next-line no-await-in-loop
				const { putStoreRecord } = require('../aiAnalysisStore');
				// eslint-disable-next-line no-await-in-loop
				await putStoreRecord(AI_ANALYSIS_STORES.agentTasks, { ...t, status: from }, 'task');
				const legal = from === to || (TASK_TRANSITIONS[from] || []).indexOf(to) >= 0;
				expect(canTransition(from, to)).toBe(legal);
				if(legal){
					// eslint-disable-next-line no-await-in-loop
					expect((await patchTask(t.id, { status: to })).status).toBe(to);
				}else{
					// eslint-disable-next-line no-await-in-loop
					await expect(patchTask(t.id, { status: to })).rejects.toMatchObject({ code: 'E_TASK_TRANSITION' });
					// eslint-disable-next-line no-await-in-loop
					expect((await getTask(t.id)).status).toBe(from);
				}
			}
		}
		TASK_TERMINAL.forEach((s)=>expect(TASK_TRANSITIONS[s]).toEqual([]));
	});
	it('listTasks 过滤/排序/limit;appendLog 封顶 200;patch 不存在 → E_TASK_NOT_FOUND', async ()=>{
		const a = await createTask({ kind: 'goal', title: 'A' });
		await createTask({ kind: 'scheduled', title: 'B' });
		expect((await listTasks()).length).toBe(2);
		expect((await listTasks({ kind: 'scheduled' })).map((t)=>t.title)).toEqual(['B']);
		expect((await listTasks({ status: ['queued'], limit: 1 })).length).toBe(1);
		for(let i = 0; i < TASK_LOG_MAX + 5; i++){
			// eslint-disable-next-line no-await-in-loop
			await appendLog(a.id, `line ${i}`);
		}
		const t = await getTask(a.id);
		expect(t.log.length).toBe(TASK_LOG_MAX);
		expect(t.log[t.log.length - 1].text).toBe(`line ${TASK_LOG_MAX + 4}`);
		await expect(patchTask('nope', { progress: 1 })).rejects.toMatchObject({ code: 'E_TASK_NOT_FOUND' });
	});
	it('🔴 取消=用户按钮:运行中先调控制器 cancel 再落 cancelled 并注销控制器;终态拒 E_TASK_TERMINAL', async ()=>{
		const t = await createTask({ kind: 'goal' });
		await patchTask(t.id, { status: 'running' });
		const cancel = jest.fn();
		registerRunning(t.id, { cancel });
		const r = await cancelTask(t.id, 'user');
		expect(r.ok).toBe(true);
		expect(cancel).toHaveBeenCalledWith('user');
		expect(controllerOf(t.id)).toBe(null);
		expect((await getTask(t.id)).status).toBe('cancelled');
		expect((await cancelTask(t.id)).code).toBe('E_TASK_TERMINAL');
		expect((await cancelTask('nope')).code).toBe('E_TASK_NOT_FOUND');
	});
	it('🔴 撤销支(账本 cancel-task):只许 queued/scheduled/paused;已开始 → E_UNDO_TASK_STARTED', async ()=>{
		const q = await createTask({ kind: 'goal' });
		expect((await undoCreateTask(q.id)).ok).toBe(true);
		expect((await getTask(q.id)).status).toBe('cancelled');
		const r = await createTask({ kind: 'goal' });
		await patchTask(r.id, { status: 'running' });
		expect((await undoCreateTask(r.id))).toEqual(expect.objectContaining({ ok: false, code: 'E_UNDO_TASK_STARTED', status: 'running' }));
		expect((await getTask(r.id)).status).toBe('running');
	});
});

// [D8/T2·T3] 账本撤销支 cancel-task 的两处失真(先红)。合同/判别向量:
//   T2 撤销处理器(tasks/index.js:16)只看 taskStore 的同步镜像 peekTaskSync —— 冷启动/刷新后镜像是空的,
//      于是「库里明明有、状态也允许撤」的任务被一律报成 E_TASK_NOT_FOUND(计划批一 #8:启动 warmTaskCache)。
//   T3 处理器对 undoCreateTask 是 fire-and-forget(`undoCreateTask(taskId).catch(()=>{})` 后直接回 ok:true)
//      → 真撤销失败(任务其实已经在跑)时,账本照样被标成「已撤销」,用户看到的和事实相反
//      (计划批一 #8:await 结果,失败不标 undone 并 pushNotice)。
describe('T2/T3 · 撤销支与账本的一致性', ()=>{
	it('🔴 T2 冷启动(同步镜像为空)时不得把库里存在的任务报成 E_TASK_NOT_FOUND', async ()=>{
		const t = await createTask({ kind: 'goal' });
		expect((await getTask(t.id)).status).toBe('queued');   // 自证:库里确实有,且状态允许撤销
		__resetTaskCacheForTests();                            // 模拟刷新/冷启动:同步镜像空
		const store = require('../aiAgent/tasks/taskStore');
		if(typeof store.warmTaskCache === 'function'){ await store.warmTaskCache(); }   // 修复后的启动预热出口
		const r = cancelTaskUndoHandler({ id: 'act-cold' }, { kind: 'cancel-task', payload: { taskId: t.id } });
		expect(r.code).not.toBe('E_TASK_NOT_FOUND');
		expect(r.ok).toBe(true);
	});

	it('🔴 T3 撤销真失败(任务已开始)时账本不得被标 undone', async ()=>{
		__resetLedgerForTests();
		registerUndoHandler('cancel-task', cancelTaskUndoHandler);
		const t = await createTask({ kind: 'goal' });
		const snapshot = await getTask(t.id);                  // 同步镜像停在 queued
		// 库里其实已经开始跑了(另一个窗口/上一次会话起的跑);绕开 taskStore 直接写库,镜像不动 —— 正是线上形态
		await putStoreRecord(AI_ANALYSIS_STORES.agentTasks, { ...snapshot, status: 'running' }, 'task');
		const action = appendAction({ id: newActionId(), tool: 'create_goal_task', summary: '建目标任务', undo: { kind: 'cancel-task', payload: { taskId: t.id } } });
		const r = undoAction(action.id);
		await new Promise((res)=>setTimeout(res, 20));         // 放行 fire-and-forget 的那次异步撤销
		expect((await getTask(t.id)).status).toBe('running');  // 自证:撤销确实没生效
		expect(r.ok).toBe(false);
		expect(getAction(action.id).undone).toBe(false);
	});
});
