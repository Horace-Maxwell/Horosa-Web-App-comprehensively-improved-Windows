// 检查点/回退(A5)合同:buildCheckpoint 九字段快照(深拷贝);planRewind 目标须是用户消息,删它及其后所有,撤销动作只取 completed 且带 undo.actionId 且未撤销、新→旧;
// restore=目标的 checkpoint;压缩点落在被删区 → clearCompact;applyCheckpoint 只调存在的 setter。本文件零工具注册(负锚在 preflight)。
import { buildCheckpoint, planRewind, collectUndoActions, applyCheckpoint, CHECKPOINT_FIELDS } from '../aiChat/checkpoint';

const cp = { v: 1, sourceId: 'local-1', referenceIds: ['material:m1'], techniqueKeys: ['bazi'], sessionSystemPrompt: 'sys', techniqueOptionOverrides: {}, modelSelection: 'p::m', thinkingLevel: 'off', chatTemperature: 0.7, chatTopP: null };
const trace = (results)=>({ rounds: [{ results }] });
const msgs = [
	{ id: 'u1', role: 'user', content: 'a', createdAt: '2026-09-05T01:00:00Z', checkpoint: { ...cp, sourceId: 'local-0' } },
	{ id: 'a1', role: 'assistant', content: 'b', createdAt: '2026-09-05T01:00:05Z', agentTrace: trace([{ name: 'create_chart_record', status: 'completed', undo: { actionId: 'act-1' }, summary: '建档甲' }]) },
	{ id: 'u2', role: 'user', content: 'c', createdAt: '2026-09-05T01:01:00Z', checkpoint: cp },
	{ id: 'a2', role: 'assistant', content: 'd', createdAt: '2026-09-05T01:01:05Z', agentTrace: trace([{ name: 'create_chart_record', status: 'completed', undo: { actionId: 'act-2' }, summary: '建档乙' }, { name: 'list_records', status: 'completed' }, { name: 'set_settings', status: 'failed', undo: { actionId: 'act-x' } }]) },
	{ id: 'u3', role: 'user', content: 'e', createdAt: '2026-09-05T01:02:00Z' },
	{ id: 'a3', role: 'assistant', content: 'f', createdAt: '2026-09-05T01:02:05Z', agentTrace: trace([{ name: 'create_case_record', status: 'completed', undo: { actionId: 'act-3' }, undone: true }]) },
];

describe('buildCheckpoint', ()=>{
	it('九字段;数组/对象深拷贝不共享引用;缺省值合法', ()=>{
		const deps = { selectedSourceId: 'local-1', referenceIds: ['x'], selectedTechniqueKeys: ['bazi'], sessionSystemPrompt: 's', techniqueOptionOverrides: { bazi: { a: 1 } }, modelSelection: 'p::m', thinkingLevel: 'low', chatTemperature: 0.5, chatTopP: 0.9 };
		const c = buildCheckpoint(deps);
		expect(Object.keys(c).sort()).toEqual(['v'].concat(CHECKPOINT_FIELDS).sort());
		expect(c.referenceIds).not.toBe(deps.referenceIds);
		expect(c.techniqueOptionOverrides).not.toBe(deps.techniqueOptionOverrides);
		expect(c.techniqueOptionOverrides).toEqual({ bazi: { a: 1 } });
		expect(buildCheckpoint({ activeSource: { id: 'local-9' } }).sourceId).toBe('local-9');
		expect(buildCheckpoint({}).chatTemperature).toBe(null);
	});
});

describe('planRewind / applyCheckpoint', ()=>{
	it('🔴 回退到 u2:删 u2 及其后 4 条;撤销动作只取 completed+actionId+未撤销、新→旧(act-2);restore=u2 的检查点;压缩点在被删区 → clearCompact', ()=>{
		const plan = planRewind(msgs.slice().reverse(), 'u2', { summary: 's', uptoCreatedAt: '2026-09-05T01:01:05Z' });
		expect(plan.remove).toEqual(['u2', 'a2', 'u3', 'a3']);
		expect(plan.removeCount).toBe(4);
		expect(plan.undoActions.map((a)=>a.actionId)).toEqual(['act-2']);
		expect(plan.restore).toBe(cp);
		expect(plan.clearCompact).toBe(true);
		expect(planRewind(msgs, 'u1', { summary: 's', uptoCreatedAt: '2026-09-05T00:59:00Z' }).clearCompact).toBe(false);
		expect(planRewind(msgs, 'u1', null).undoActions.map((a)=>a.actionId)).toEqual(['act-2', 'act-1']);
		expect(planRewind(msgs, 'a1', null)).toBe(null);
		expect(planRewind(msgs, 'nope', null)).toBe(null);
		expect(planRewind(msgs, 'u3', null).restore).toBe(null);
		expect(collectUndoActions([])).toEqual([]);
	});
	it('applyCheckpoint 只调存在的 setter,返回恢复字段;空检查点零调用', ()=>{
		const setters = { setSelectedSourceId: jest.fn(), setReferenceIds: jest.fn(), setSelectedTechniqueKeys: jest.fn(), setSessionSystemPrompt: jest.fn(), setModelSelection: jest.fn() };
		const done = applyCheckpoint(cp, setters);
		expect(setters.setSelectedSourceId).toHaveBeenCalledWith('local-1');
		expect(setters.setReferenceIds).toHaveBeenCalledWith(['material:m1']);
		expect(setters.setSelectedTechniqueKeys).toHaveBeenCalledWith(['bazi']);
		expect(setters.setModelSelection).toHaveBeenCalledWith('p::m');
		expect(done).toEqual(['sourceId', 'referenceIds', 'techniqueKeys', 'sessionSystemPrompt', 'modelSelection']);
		expect(applyCheckpoint(null, setters).length).toBe(0);
	});
	it('🔴 [Q-032/M-47] 温度 / top_p 也恢复(此前 CHECKPOINT_FIELDS 声明了却只写不读);null=默认档要能恢复回去', ()=>{
		const setters = { setChatTemperature: jest.fn(), setChatTopP: jest.fn() };
		const done = applyCheckpoint({ ...cp, chatTemperature: 0.3, chatTopP: 0.8 }, setters);
		expect(setters.setChatTemperature).toHaveBeenCalledWith(0.3);
		expect(setters.setChatTopP).toHaveBeenCalledWith(0.8);
		expect(done).toEqual(expect.arrayContaining(['chatTemperature', 'chatTopP']));
		// null(=默认,不下发)是合法值:必须照样恢复,不能被真值判吞掉
		const s2 = { setChatTemperature: jest.fn(), setChatTopP: jest.fn() };
		applyCheckpoint({ chatTemperature: null, chatTopP: null }, s2);
		expect(s2.setChatTemperature).toHaveBeenCalledWith(null);
		expect(s2.setChatTopP).toHaveBeenCalledWith(null);
		// 字段缺席(旧检查点)→ 不调 setter
		const s3 = { setChatTemperature: jest.fn(), setChatTopP: jest.fn() };
		applyCheckpoint({ sourceId: 'x' }, s3);
		expect(s3.setChatTemperature).not.toHaveBeenCalled();
	});
});

// ---- [压测二轮·D6·X1] 建档 → 压缩 → 撤销 三方一致 ----
// 压缩只改「主线视图」,不该改「这一 Turn 做过哪些可撤销动作」:回退计划、账本、真实记录三边必须对得上。
describe('X1 压缩 × 检查点 × 账本', ()=>{
	const { registerBuiltinTools } = require('../aiTools');
	const { runTool, __resetToolsForTests } = require('../aiTools/registry');
	const { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } = require('../aiTools/workspaceBridge');
	const { listActions, getAction, undoAction, __resetLedgerForTests } = require('../aiTools/ledger');
	const { listLocalCharts } = require('../localcharts');
	const { applyCompact } = require('../aiChat/compact');

	beforeEach(()=>{
		window.localStorage.clear();
		jest.restoreAllMocks();
		jest.spyOn(console, 'warn').mockImplementation(()=>{});
		__resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
		registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
		registerBuiltinTools();
	});

	it('X1 真建档一条 → 压缩点盖住那一轮 → 回退计划/账本/记录三边一致;撤销后三边同时收敛', async ()=>{
		const created = await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '北京' }, { origin: 'in-app', ui: { selectSource: jest.fn(), refreshSources: jest.fn() }, dispatch: jest.fn() });
		expect(created.ok).toBe(true);
		const actionId = created.undo.actionId;
		const list = [
			{ id: 'x-u1', role: 'user', content: '把张三记下来', createdAt: '2026-09-05T02:00:00Z', checkpoint: cp },
			{ id: 'x-a1', role: 'assistant', content: '已建档', createdAt: '2026-09-05T02:00:05Z', agentTrace: { rounds: [{ results: [{ name: 'create_chart_record', status: 'completed', undo: { actionId, kind: 'trash-record' }, summary: '建档张三' }] }] } },
			{ id: 'x-u2', role: 'user', content: '再看看流年', createdAt: '2026-09-05T02:01:00Z', checkpoint: cp },
			{ id: 'x-a2', role: 'assistant', content: '流年平稳', createdAt: '2026-09-05T02:01:05Z' },
		];
		const compact = { summary: '已为张三建档', uptoCreatedAt: '2026-09-05T02:00:05Z', coveredCount: 2 };
		// ① 压缩视图:建档那一轮不再进请求主线
		expect(applyCompact(list, compact).map((m)=>m.id)).toEqual(['x-u2', 'x-a2']);
		// ② 回退计划:仍然看得见那条可撤销动作(压缩不吞动作)
		const plan = planRewind(list, 'x-u1', compact);
		expect(plan.remove).toEqual(['x-u1', 'x-a1', 'x-u2', 'x-a2']);
		expect(plan.undoActions.map((a)=>a.actionId)).toEqual([actionId]);
		expect(plan.clearCompact).toBe(true);
		// ③ 账本:未撤销条目与回退计划逐条对齐
		expect(listActions().filter((a)=>!a.undone).map((a)=>a.id)).toEqual(plan.undoActions.map((a)=>a.actionId));
		expect(listLocalCharts({}).length).toBe(1);
		// 执行撤销 → 三边同时收敛
		const undone = undoAction(actionId);
		expect(undone.ok).toBe(true);
		expect(getAction(actionId).undone).toBe(true);
		expect(listActions().filter((a)=>!a.undone).length).toBe(0);
		expect(listLocalCharts({}).length).toBe(0);
		expect(listLocalCharts({ includeArchived: true }).length).toBe(0);
		// 压缩视图不因撤销而变形(摘要仍在,主线仍是压缩点之后)
		expect(applyCompact(list, compact).map((m)=>m.id)).toEqual(['x-u2', 'x-a2']);
	});
});
