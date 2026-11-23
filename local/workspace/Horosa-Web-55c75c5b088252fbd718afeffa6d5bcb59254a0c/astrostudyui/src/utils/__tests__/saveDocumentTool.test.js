// save_document只写固定导出目录(经桥上的 exportWrite)、软件定名(ASCII + 时间戳 + 随机后缀)不覆盖;
// 对话属私人内容(外部要「私人内容可读」);没有可写导出口时工具不进目录。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests, listTools } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { setAgentEnabled, setPrivateReadEnabled, setToolPolicy } from '../aiAgent/prefs';
import { AI_ANALYSIS_STORES, putStoreRecord } from '../aiAnalysisStore';
import { exportFileName } from '../aiTools/tools/saveDocument';

let written;
const ctx = (origin)=>({ origin: origin || 'in-app', requestId: 'sd', dispatch: jest.fn() });
beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	written = [];
	registerWorkspaceBridge({ exportWrite: (name, b64)=>{ written.push({ name, b64 }); return { ok: true, path: `/exports/${name}` }; } });
	setAgentEnabled(true);
	registerBuiltinTools();
});

test('文件名:只含 ASCII、带后缀、两次不重名', ()=>{
	const a = exportFileName('horosa_八字bazi', 'md'); const b = exportFileName('horosa_八字bazi', 'md');
	expect(a).toMatch(/^horosa_bazi-\d{8}-\d{6}-[a-z0-9]{1,5}\.md$/);
	expect(a).not.toBe(b);
});
test('对话导出 md:内容是对话全文;外部且私人内容关着 → 拒', async ()=>{
	const conv = await putStoreRecord(AI_ANALYSIS_STORES.conversations, { title: '问事业', createdAt: '2026-11-15T00:00:00Z', updatedAt: '2026-11-15T00:00:00Z' }, 'conv');
	await putStoreRecord(AI_ANALYSIS_STORES.messages, { conversationId: conv.id, role: 'user', content: '今年事业如何', createdAt: '2026-11-15T00:00:01Z' }, 'msg');
	await putStoreRecord(AI_ANALYSIS_STORES.messages, { conversationId: conv.id, role: 'assistant', content: '上半年稳', createdAt: '2026-11-15T00:00:02Z', streamStatus: 'done' }, 'msg');
	setPrivateReadEnabled(false);
	expect((await runTool('save_document', { kind: 'conversation', format: 'md', conversationId: conv.id }, ctx('mcp'))).ok).toBe(false);
	const r = await runTool('save_document', { kind: 'conversation', format: 'md', conversationId: conv.id }, ctx());
	expect(r.ok).toBe(true);
	const text = Buffer.from(written[0].b64, 'base64').toString('utf8');
	expect(text).toContain('# 问事业');
	expect(text).toContain('今年事业如何');
	expect(text).toContain('上半年稳');
	expect(r.data.path).toBe(`/exports/${written[0].name}`);
});
test('落盘口拒(同名已存在等)→ 如实失败;没有导出口 → 不可用', async ()=>{
	registerWorkspaceBridge({ exportWrite: ()=>({ ok: false, message: '同名文件已存在,不覆盖' }) });
	const conv = await putStoreRecord(AI_ANALYSIS_STORES.conversations, { title: 'x' }, 'conv');
	await putStoreRecord(AI_ANALYSIS_STORES.messages, { conversationId: conv.id, role: 'user', content: 'y' }, 'msg');
	const r = await runTool('save_document', { kind: 'conversation', format: 'md', conversationId: conv.id }, ctx());
	expect([r.ok, /不覆盖/.test(r.message)]).toEqual([false, true]);
	registerWorkspaceBridge({ exportWrite: undefined });
	expect(listTools().find((d)=>d.name === 'save_document').enabled()).toBe(false);
});
test('txt:与 md 同一份正文、后缀 .txt;pdf:走应用内导出同一矢量引擎,产物是 PDF 字节', async ()=>{
	const conv = await putStoreRecord(AI_ANALYSIS_STORES.conversations, { title: '问财运' }, 'conv');
	await putStoreRecord(AI_ANALYSIS_STORES.messages, { conversationId: conv.id, role: 'user', content: '明年财运' }, 'msg');
	const t = await runTool('save_document', { kind: 'conversation', format: 'txt', conversationId: conv.id }, ctx());
	expect(t.ok).toBe(true);
	expect(written[0].name).toMatch(/\.txt$/);
	expect(Buffer.from(written[0].b64, 'base64').toString('utf8')).toContain('明年财运');
	jest.doMock('../aiExportPdfVector', ()=>({ buildExportPdfVectorBlob: async ({ tech })=>new Uint8Array(Buffer.from(`%PDF-1.7 ${tech}`)) }));
	const p = await runTool('save_document', { kind: 'conversation', format: 'pdf', conversationId: conv.id }, ctx());
	expect(p.ok).toBe(true);
	expect(p.data.mime).toBe('application/pdf');
	expect(written[1].name).toMatch(/\.pdf$/);
	expect(Buffer.from(written[1].b64, 'base64').toString('utf8')).toMatch(/^%PDF-1\.7 问财运/);
	expect((await runTool('save_document', { kind: 'conversation', format: 'html', conversationId: conv.id }, ctx())).code).toBe('E_ARGS_INVALID');
});

test('🔴 用户按工具名禁用了 cast_technique:save_document kind=technique 同样拿不到那份正文(不落盘)', async ()=>{
	setToolPolicy({ deny: ['cast_technique'] });
	const r = await runTool('save_document', { kind: 'technique', format: 'md', technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01 08:00', zone: '+08:00', gpsLat: 39.9, gpsLon: 116.4, gender: 'male' } }, ctx('mcp'));
	expect([r.ok, r.code]).toEqual([false, 'E_APPROVAL_DENIED']);
	expect(written).toEqual([]);
});
