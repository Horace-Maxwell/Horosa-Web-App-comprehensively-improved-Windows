// list_models 只列已配置档案 × 模型(无密钥);chat_in_conversation 续问落库(带来源标记、不改已有消息),
// 受「无头分析」+「私人内容可读」门控;run_analysis / chat 的 model 只能在清单里选。
jest.mock('../aiAgent/goalRunner', ()=>({
	resolveHeadlessProfile: jest.fn(async (spec)=>({ profile: { id: 'p1', providerType: 'openai' }, model: spec && spec.modelSelection ? spec.modelSelection.split('::')[1] : 'gpt-a' })),
	runHeadlessTurn: jest.fn(async ({ conversationId, userText, deps })=>{
		await deps.saveConversationMessage({ conversationId, role: 'user', content: userText, streamStatus: 'done' });
		const a = await deps.saveConversationMessage({ conversationId, role: 'assistant', content: '', streamStatus: 'streaming' });
		await deps.saveConversationMessage({ ...a, content: '答复', streamStatus: 'done' });
		return { content: '答复', usage: { total: 3 } };
	}),
}));
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests, getTool } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { setAgentEnabled, setPrivateReadEnabled, setHeadlessEnabled } from '../aiAgent/prefs';
import { AI_ANALYSIS_STORES, putStoreRecord, listConversationMessages } from '../aiAnalysisStore';
import { checkModelSelection } from '../aiTools/tools/chatTools';

const ctx = ()=>({ origin: 'mcp', requestId: 'r6', clientName: 'codex' });
beforeEach(async ()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	setAgentEnabled(true);
	registerBuiltinTools();
	await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, { id: 'p1', name: '主力', providerType: 'openai', apiKey: 'sk-secret-should-not-leak', chatModelIds: ['gpt-a', 'gpt-b'], enabled: true }, 'provider');
});

test('list_models:档案 × 模型,无密钥;model 只能在清单里选', async ()=>{
	const r = await runTool('list_models', {}, ctx());
	expect(r.data.items.map((x)=>x.selection)).toEqual(expect.arrayContaining(['p1::gpt-a', 'p1::gpt-b']));
	expect(JSON.stringify(r.data)).not.toMatch(/sk-secret/);
	expect((await checkModelSelection('p1::gpt-b')).selection).toBe('p1::gpt-b');
	expect((await checkModelSelection('gpt-b')).selection).toBe('p1::gpt-b');
	expect((await checkModelSelection('nope')).ok).toBe(false);
});
test('续问:一问一答落进这段对话、带来源标记;已有消息不动;门控', async ()=>{
	const conv = await putStoreRecord(AI_ANALYSIS_STORES.conversations, { title: '问事业' }, 'conv');
	const old = await putStoreRecord(AI_ANALYSIS_STORES.messages, { conversationId: conv.id, role: 'user', content: '旧问题', streamStatus: 'done' }, 'msg');
	const def = getTool('chat_in_conversation');
	setHeadlessEnabled(true); setPrivateReadEnabled(false);
	expect(def.enabled()).toBe(false);
	setPrivateReadEnabled(true);
	expect(def.enabled()).toBe(true);
	const r = await runTool('chat_in_conversation', { conversationId: conv.id, question: '那下半年呢', model: 'p1::gpt-b' }, ctx());
	expect(r.ok).toBe(true);
	expect(r.data.model).toBe('gpt-b');
	const msgs = await listConversationMessages(conv.id);
	const added = msgs.filter((m)=>m.id !== old.id);
	expect(added.map((m)=>m.role).sort()).toEqual(['assistant', 'user']);
	added.forEach((m)=>expect([m.origin, m.client, m.createdBy]).toEqual(['mcp', 'codex', 'ai-assistant']));
	expect(msgs.find((m)=>m.id === old.id).content).toBe('旧问题');
	expect((await runTool('chat_in_conversation', { conversationId: 'nope', question: 'x' }, ctx())).code).toBe('E_RECORD_NOT_FOUND');
});
