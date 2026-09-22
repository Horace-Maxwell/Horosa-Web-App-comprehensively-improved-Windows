// [批二⑥] 进度清单合同:note_progress 只读零落库;≤20 条整份替换;运行时把最近一份落到 trace.todos;守则第 8 条在位;标签在位。
import { registerBuiltinTools, listTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { createAgentTurn } from '../aiAgent/runtime';
import { setAgentEnabled, setAgentApprovalMode } from '../aiAgent/prefs';
import { AGENT_SYSTEM_RULES } from '../aiAgent/protocol';
import { AGENT_TOOL_LABELS } from '../aiTools/labels';
import { listActions, __resetLedgerForTests } from '../aiTools/ledger';
import { PROGRESS_MAX_ITEMS } from '../aiTools/tools/noteProgress';

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); registerBuiltinTools(); setAgentEnabled(true); setAgentApprovalMode('never'); });

it('目录里有 note_progress(read/interactive),有中文标签,守则第 8 条提到它', ()=>{
	const def = listTools().find((d)=>d.name === 'note_progress');
	expect(def).toBeTruthy();
	expect(def.level).toBe('read');
	expect(def.category).toBe('interactive');
	expect(AGENT_TOOL_LABELS.note_progress).toBe('记录进度');
	expect(AGENT_SYSTEM_RULES).toContain('note_progress');
});

it('runTool:归一状态、封顶 20 条、不进账本、summary 带 进度 x/y', async ()=>{
	const r = await runTool('note_progress', { items: [{ text: '先看八字', status: 'done' }, { text: '再看紫微', status: 'doing' }, { text: '综合' }] }, { origin: 'in-app' });
	expect(r.ok).toBe(true);
	expect(r.data.items).toEqual([{ text: '先看八字', status: 'done' }, { text: '再看紫微', status: 'doing' }, { text: '综合', status: 'todo' }]);
	expect(r.summary).toBe('进度 1/3:再看紫微');
	expect(listActions().length).toBe(0);
	const big = await runTool('note_progress', { items: Array.from({ length: PROGRESS_MAX_ITEMS + 5 }, (_, i)=>({ text: `第 ${i} 步` })) }, { origin: 'in-app' });
	expect(big.ok).toBe(false);   // schema maxItems:超出即 E_ARGS_INVALID,不悄悄截
	expect(big.code).toBe('E_ARGS_INVALID');
	const bad = await runTool('note_progress', { items: [{ text: 'x', status: 'nope' }] }, { origin: 'in-app' });
	expect(bad.ok).toBe(false);
});

it('运行时:每次调用整份替换 trace.todos;未调用时 todos 为空(零回归)', async ()=>{
	const agent = createAgentTurn({ profile: { id: 'p1' }, model: 'm' });
	agent.beginRound();
	expect(agent.trace().todos).toEqual([]);
	agent.onEvent({ type: 'tool_call', json: { id: 'c1', name: 'note_progress', arguments: JSON.stringify({ items: [{ text: 'A', status: 'doing' }, { text: 'B' }] }) } });
	await agent.settleRound();
	expect(agent.trace().todos).toEqual([{ text: 'A', status: 'doing' }, { text: 'B', status: 'todo' }]);
	agent.beginRound();
	agent.onEvent({ type: 'tool_call', json: { id: 'c2', name: 'note_progress', arguments: JSON.stringify({ items: [{ text: 'A', status: 'done' }, { text: 'B', status: 'doing' }] }) } });
	await agent.settleRound();
	expect(agent.trace().todos).toEqual([{ text: 'A', status: 'done' }, { text: 'B', status: 'doing' }]);
});
