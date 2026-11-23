// 资料笔记直写可撤销(只撤自己建、没被改过的);记忆只投候选(确认仍由用户);读记忆受私人内容门控、只对外部。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests, listTools } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests, undoAction } from '../aiTools/ledger';
import { setAgentEnabled, setPrivateReadEnabled } from '../aiAgent/prefs';
import { AI_ANALYSIS_STORES, getStoreRecord, putStoreRecord } from '../aiAnalysisStore';
import { listMemories } from '../aiChat/memory';

const flush = ()=>new Promise((res)=>setTimeout(res, 0));
const ctx = (origin)=>({ origin: origin || 'in-app', requestId: 'r7', dispatch: jest.fn() });
beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	setAgentEnabled(true);
	registerBuiltinTools();
});

test('资料笔记:建成带来源标记;撤销删掉;建后被改过则拒撤', async ()=>{
	const r = await runTool('add_material_note', { title: '五行口诀', text: '金生水,水生木', tags: ['口诀'] }, ctx());
	expect(r.ok).toBe(true);
	const rec = await getStoreRecord(AI_ANALYSIS_STORES.materials, r.data.id);
	expect([rec.kind, rec.createdBy, rec.extractedText]).toEqual(['note', 'ai-assistant', '金生水,水生木']);
	const u0 = undoAction(r.undo.actionId);
	for(let i = 0; i < 50 && u0.pending; i++){ await flush(); }   // eslint-disable-line no-await-in-loop
	expect([u0.ok, !!u0.pending]).toEqual([true, false]);
	expect(await getStoreRecord(AI_ANALYSIS_STORES.materials, r.data.id)).toBeFalsy();
	const r2 = await runTool('add_material_note', { title: '二', text: '正文' }, ctx());
	const cur = await getStoreRecord(AI_ANALYSIS_STORES.materials, r2.data.id);
	await putStoreRecord(AI_ANALYSIS_STORES.materials, { ...cur, extractedText: '用户改了', updatedAt: new Date(Date.now() + 5000).toISOString() }, 'material');
	const u = undoAction(r2.undo.actionId);
	for(let i = 0; i < 50 && u.pending; i++){ await flush(); }   // eslint-disable-line no-await-in-loop
	expect([u.ok, u.code]).toEqual([false, 'E_UNDO_RECORD_CHANGED']);
	expect(await getStoreRecord(AI_ANALYSIS_STORES.materials, r2.data.id)).toBeTruthy();
});
test('记忆:只进候选;同文不重复;主体是命盘时要给 id', async ()=>{
	const r = await runTool('propose_memory', { text: '用户偏好用真太阳时' }, ctx());
	expect(r.data.status).toBe('candidate');
	const mems = await listMemories();
	expect(mems.map((m)=>m.status)).toEqual(['candidate']);
	expect((await runTool('propose_memory', { text: '用户偏好用真太阳时' }, ctx())).data.changed).toBe(false);
	expect((await runTool('propose_memory', { text: 'x', subjectType: 'chart' }, ctx())).ok).toBe(false);
});
test('读记忆:只对外部、私人内容可读关着时不在目录', async ()=>{
	const def = listTools().find((d)=>d.name === 'list_memories');
	expect(def.origins).toEqual(['mcp']);
	setPrivateReadEnabled(false);
	expect(def.enabled()).toBe(false);
	setPrivateReadEnabled(true);
	expect(def.enabled()).toBe(true);
	await runTool('propose_memory', { text: '命主怕冷' }, ctx());
	const r = await runTool('list_memories', {}, ctx('mcp'));
	expect(r.ok).toBe(true);
	expect(r.data.items.map((x)=>x.text)).toContain('命主怕冷');
});
