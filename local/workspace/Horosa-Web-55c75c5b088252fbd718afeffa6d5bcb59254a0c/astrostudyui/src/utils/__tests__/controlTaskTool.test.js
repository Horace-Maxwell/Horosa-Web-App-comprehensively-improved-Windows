// control_task只做收紧 —— 暂停在跑的目标任务 / 排着的定时任务、取消未结束的任务;开始 / 继续不在此列。
jest.mock('../aiAgent/tasks/taskStore', ()=>{
	const db = {};
	return {
		__db: db, TASK_TERMINAL: ['done', 'failed', 'cancelled'],
		getTask: jest.fn(async (id)=>db[id] || null),
		cancelTask: jest.fn(async (id)=>{ if(!db[id]){ return { ok: false, code: 'E_TASK_NOT_FOUND' }; } db[id] = { ...db[id], status: 'cancelled' }; return { ok: true, task: db[id] }; }),
	};
});
jest.mock('../aiAgent/tasks/taskRegistry', ()=>({ controllerOf: jest.fn(()=>null) }));
jest.mock('../aiAgent/tasks/scheduler', ()=>({ pauseScheduledTask: jest.fn(async (id)=>({ id, status: 'paused' })) }));
import controlTask from '../aiTools/tools/controlTask';

const store = require('../aiAgent/tasks/taskStore');
const reg = require('../aiAgent/tasks/taskRegistry');
const sched = require('../aiAgent/tasks/scheduler');

beforeEach(()=>{ Object.keys(store.__db).forEach((k)=>delete store.__db[k]); jest.clearAllMocks(); });

test('暂停排着的定时任务走排期', async ()=>{
	store.__db.s1 = { id: 's1', kind: 'scheduled', status: 'scheduled', title: '每日' };
	const r = await controlTask.run({ taskId: 's1', action: 'pause' });
	expect(r.ok).toBe(true);
	expect(sched.pauseScheduledTask).toHaveBeenCalledWith('s1');
});
test('暂停在跑的目标任务走控制器;没控制器 / 不在跑 → 说清楚', async ()=>{
	const pause = jest.fn();
	store.__db.g1 = { id: 'g1', kind: 'goal', status: 'running', title: '目标' };
	reg.controllerOf.mockReturnValueOnce({ pause });
	expect((await controlTask.run({ taskId: 'g1', action: 'pause' })).ok).toBe(true);
	expect(pause).toHaveBeenCalled();
	store.__db.g2 = { id: 'g2', kind: 'goal', status: 'queued', title: '排队' };
	const no = await controlTask.run({ taskId: 'g2', action: 'pause' });
	expect(no.ok).toBe(false);
	expect(no.message).toMatch(/cancel/);
});
test('取消:未结束的都能取消;已结束 = 无变化;已暂停再暂停 = 无变化', async ()=>{
	store.__db.g3 = { id: 'g3', kind: 'goal', status: 'paused', title: 'x' };
	expect((await controlTask.run({ taskId: 'g3', action: 'pause' })).data.changed).toBe(false);
	const c = await controlTask.run({ taskId: 'g3', action: 'cancel' });
	expect([c.ok, c.data.status]).toEqual([true, 'cancelled']);
	expect((await controlTask.run({ taskId: 'g3', action: 'cancel' })).data.changed).toBe(false);
	expect((await controlTask.run({ taskId: 'nope', action: 'cancel' })).code).toBe('E_TASK_NOT_FOUND');
});
