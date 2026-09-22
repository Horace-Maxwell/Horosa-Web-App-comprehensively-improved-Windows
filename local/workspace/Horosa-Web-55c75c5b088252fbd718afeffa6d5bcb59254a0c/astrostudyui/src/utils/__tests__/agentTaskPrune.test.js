// [压测二轮·D7·K3/K4] 任务表与通知表的规模面:
//  K3 agent_tasks 只增不减(建一条留一条),几千条终态任务后任务中心首屏与备份包一起变重 —— 需要 pruneTasks 只裁终态、活跃全留。
//  K4 listNotices 每次都整表 getAll + 全量 normalize + 全量排序;两千条通知时铃铛一响就是一次全表反序列化 —— 需要走 createdAt 索引游标。
// 🔴 jsdom 不实现 indexedDB:本文件用 fake-indexeddb + jest.isolateModules 取新模块实例(与 aiAnalysisStoreIndexes.test.js 同一套装卸法)。
if(typeof window.indexedDB !== 'undefined'){
	throw new Error('前提失效:jsdom 已定义 indexedDB,fake-indexeddb 的装载顺序需重审');
}
require('fake-indexeddb/auto');
const FIDB = require('fake-indexeddb');

// 同一个 isolateModules 作用域里一起 require:noticeStore / taskStore 必须绑到同一份新 store 实例
function loadAll(){
	let mods = null;
	jest.isolateModules(()=>{
		mods = {
			store: require('../aiAnalysisStore'),
			notices: require('../aiAgent/tasks/noticeStore'),
			tasks: require('../aiAgent/tasks/taskStore'),
		};
	});
	return mods;
}
async function withFreshIdb(fn){
	const factory = new FIDB.IDBFactory();
	window.indexedDB = factory;
	await fn(loadAll(), factory);
}

const iso = (base, i, step)=>new Date(Date.parse(base) + i * step).toISOString();

function taskRows(n, base, status, kind){
	return Array.from({ length: n }, (_, i)=>({
		id: `t-${status}-${i}`, kind: kind || 'goal', status, title: `${status} ${i}`, origin: 'in-app',
		progress: 100, spec: {}, log: [], result: null, notify: true, nextRunAt: null, lastRunAt: null,
		createdAt: iso(base, i, 1000), updatedAt: iso(base, i, 1000),
	}));
}
function noticeRows(n, base){
	return Array.from({ length: n }, (_, i)=>({
		id: `n-${i}`, level: 'info', title: `通知 ${i}`, body: `正文 ${i}`, taskId: null, link: null,
		read: false, desktopShown: false, seq: 1000000 + i, createdAt: iso(base, i, 1000),
	}));
}

beforeEach(()=>{ window.localStorage.clear(); });

describe('K3 agent_tasks 裁剪', ()=>{
	it('🔴 K3 5000 条终态 + 10 条活跃 → pruneTasks({keep:1000}) 只删终态里最旧的,活跃一条不动;createTask 触发异步裁剪且单飞', async ()=>{
		// 当前代码为何红:taskStore.js 只有 createTask / patchTask / appendLog / cancelTask / undoCreateTask,
		// **没有任何裁剪口**(agent_tasks 只增不减);createTask(taskStore.js:78-83)也不触发任何回收。
		// 于是 agent_tasks 无限增长:listTasks(taskStore.js:91-97)每次整表 getAll+normalize+sort,
		// 备份包 aiWorkspace 段也跟着一起变大。
		await withFreshIdb(async ({ store, tasks })=>{
			expect(typeof tasks.pruneTasks).toBe('function');
			expect(tasks.TASK_KEEP_MAX).toBe(1000);
			const S = store.AI_ANALYSIS_STORES;
			const terminal = [].concat(
				taskRows(2000, '2026-01-01T00:00:00.000Z', 'done'),
				taskRows(2000, '2026-02-01T00:00:00.000Z', 'failed'),
				taskRows(1000, '2026-03-01T00:00:00.000Z', 'cancelled'),
			);
			const active = [].concat(
				taskRows(4, '2026-04-01T00:00:00.000Z', 'running'),
				taskRows(3, '2026-04-02T00:00:00.000Z', 'scheduled', 'scheduled'),
				taskRows(3, '2026-04-03T00:00:00.000Z', 'waiting'),
			);
			await store.bulkPutStoreRecords(S.agentTasks, terminal.concat(active), 'task');
			expect(await store.countStoreRecords(S.agentTasks)).toBe(5010);

			const removed = await tasks.pruneTasks({ keep: 1000 });
			expect(removed).toBe(4000);
			expect(await store.countStoreRecords(S.agentTasks)).toBe(1010);
			// 活跃任务一条不少
			const left = await tasks.listTasks({});
			const leftIds = new Set(left.map((t)=>t.id));
			active.forEach((t)=>{ expect(leftIds.has(t.id)).toBe(true); });
			// 留下的终态是最新的 1000 条(最旧的先删)
			const leftTerminal = left.filter((t)=>['done', 'failed', 'cancelled'].indexOf(t.status) >= 0);
			expect(leftTerminal.length).toBe(1000);
			const oldestLeft = leftTerminal.map((t)=>t.updatedAt).sort()[0];
			const newestGone = terminal.map((t)=>t.updatedAt).sort().slice(0, 4000).pop();
			expect(oldestLeft > newestGone).toBe(true);

			// createTask 触发异步裁剪:再灌 500 条终态后建一条,表长自动收敛(且并发建档只跑一趟裁剪)
			await store.bulkPutStoreRecords(S.agentTasks, taskRows(500, '2026-05-01T00:00:00.000Z', 'done', 'report'), 'task');
			await Promise.all([tasks.createTask({ kind: 'goal', title: '新任务甲' }), tasks.createTask({ kind: 'goal', title: '新任务乙' })]);
			for(let i = 0; i < 60; i++){
				// eslint-disable-next-line no-await-in-loop
				await new Promise((r)=>setTimeout(r, 0));
				// eslint-disable-next-line no-await-in-loop
				if(await store.countStoreRecords(S.agentTasks) <= 1012){ break; }
			}
			expect(await store.countStoreRecords(S.agentTasks)).toBeLessThanOrEqual(1012);
			const after = await tasks.listTasks({});
			active.forEach((t)=>{ expect(after.some((x)=>x.id === t.id)).toBe(true); });
		});
	}, 180000);
});

describe('K4 listNotices 走索引游标', ()=>{
	it('🔴 K4 2000 条通知下 listNotices({limit:20}):零 store.getAll(走 createdAt 索引游标倒序取 20 条)', async ()=>{
		// 当前代码为何红:noticeStore.js:62-68 的 listNotices 无条件 `listStoreRecords(agent_notices)`
		// —— 整表 getAll + 2000 次 normalizeNotice + 全表排序,只为取最新 20 条;
		// unreadCount(noticeStore.js:70-72)与 trimNotices(:85-94)也各走一遍同样的整表读。
		// 索引早就建好了(aiAnalysisStore.js:75 agent_notices → createdAt),只是从没被用上。
		await withFreshIdb(async ({ store, notices })=>{
			const S = store.AI_ANALYSIS_STORES;
			await store.bulkPutStoreRecords(S.agentNotices, noticeRows(2000, '2026-01-01T00:00:00.000Z'), 'notice');
			expect(await store.countStoreRecords(S.agentNotices)).toBe(2000);
			store.__resetIdbStatsForTests();
			const storeGetAll = jest.spyOn(FIDB.IDBObjectStore.prototype, 'getAll');
			const out = await notices.listNotices({ limit: 20 });
			expect(out.length).toBe(20);
			expect(out[0].id).toBe('n-1999');                       // 新在前
			expect(out[19].id).toBe('n-1980');
			expect(store.getIdbStatsForDebug().getAll).toBe(0);
			expect(storeGetAll).toHaveBeenCalledTimes(0);
			storeGetAll.mockRestore();
		});
	}, 120000);

	it('K4b 判别力:同一份数据下 listNotices 的排序/裁剪语义不变(新在前、limit 生效、unreadOnly 生效)', async ()=>{
		await withFreshIdb(async ({ store, notices })=>{
			const S = store.AI_ANALYSIS_STORES;
			const rows = noticeRows(50, '2026-06-01T00:00:00.000Z').map((n, i)=>({ ...n, read: i % 2 === 0 }));
			await store.bulkPutStoreRecords(S.agentNotices, rows, 'notice');
			const all = await notices.listNotices();
			expect(all.length).toBe(50);
			expect(all[0].id).toBe('n-49');
			expect(all[49].id).toBe('n-0');
			expect((await notices.listNotices({ limit: 5 })).map((n)=>n.id)).toEqual(['n-49', 'n-48', 'n-47', 'n-46', 'n-45']);
			expect((await notices.listNotices({ unreadOnly: true })).every((n)=>!n.read)).toBe(true);
			expect(await notices.unreadCount()).toBe(25);
		});
	}, 60000);
});
