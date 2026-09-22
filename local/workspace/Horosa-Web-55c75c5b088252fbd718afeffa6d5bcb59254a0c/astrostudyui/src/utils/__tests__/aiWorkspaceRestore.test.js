// [D54] 恢复备份只替换包内存在的数据集;中途出错回滚;未来版拒;超限不解压。此前循环对每个店 clear+bulkPut(缺则 [])= 单店包清空全库。
import { planWorkspaceRestore, restoreWorkspaceStores, AI_BACKUP_MAX_ZIP_BYTES, RESTORE_HANDLE_ID, AI_BACKUP_SNAPSHOT_VERSION_MAX } from '../aiWorkspaceRestore';
import { AI_ANALYSIS_SCHEMA_VERSION } from '../aiAnalysisStore';
import { parseWorkspaceBackupBlob } from '../aiAnalysisExport';

const KEYS = ['conversations', 'messages', 'templates', 'provider_profiles'];

function memDeps(initial){
	const db = {};
	Object.keys(initial).forEach((k)=>{ db[k] = initial[k].map((r)=>({ ...r })); });
	const calls = { clear: [], put: [] };
	const meta = [];
	return {
		db, calls, meta,
		clearStore: async (n)=>{ calls.clear.push(n); db[n] = []; },
		bulkPutStoreRecords: async (n, rows)=>{ calls.put.push([n, rows.length]); db[n] = (db[n] || []).concat(rows.map((r)=>({ ...r }))); },
		listStoreRecords: async (n)=>(db[n] || []).map((r)=>({ ...r })),
		putStoreRecord: async (n, rec)=>{ meta.push({ store: n, ...rec }); },
		metaStore: 'workspace_meta',
	};
}
const snap = (db)=>JSON.stringify(Object.keys(db).sort().map((k)=>[k, db[k]]));

test('🔴 计划:只含 messages 的包 ⇒ present=[messages],其余三店 absent;缺 stores / 数组 payload / 未来版 ⇒ 拒', ()=>{
	const p = planWorkspaceRestore({ stores: { messages: [{ id: 'm1' }, { id: 'm2' }] } }, KEYS);
	expect(p.ok).toBe(true);
	expect(p.present).toEqual(['messages']);
	expect(p.absent.sort()).toEqual(['conversations', 'provider_profiles', 'templates']);
	expect(p.total).toBe(2);
	expect(planWorkspaceRestore({ meta: 1 }, KEYS)).toEqual(expect.objectContaining({ ok: false, error: 'backup.stores.missing' }));
	expect(planWorkspaceRestore([], KEYS).ok).toBe(false);
	expect(planWorkspaceRestore({ stores: { unknown_store: [] } }, KEYS)).toEqual(expect.objectContaining({ ok: false, error: 'backup.stores.empty' }));
	expect(planWorkspaceRestore({ snapshotVersion: 99, stores: { messages: [] } }, KEYS)).toEqual(expect.objectContaining({ ok: false, error: 'backup.version.future' }));
	expect(planWorkspaceRestore({ snapshotVersion: 1, stores: { messages: [] } }, KEYS).ok).toBe(true);
	// [Q-412/M-162] 全量备份包:aiWorkspace 段自动取用(unified=true);无 AI 段的全量包 → 专用错误码供界面指路
	const u = planWorkspaceRestore({ format: 'horosa-unified-backup', charts: [], aiWorkspace: { stores: { messages: [{ id: 'm9' }] } } }, KEYS);
	expect(u.ok).toBe(true);
	expect(u.unified).toBe(true);
	expect(u.present).toEqual(['messages']);
	expect(planWorkspaceRestore({ format: 'horosa-unified-backup', charts: [], aiWorkspace: null }, KEYS)).toEqual(expect.objectContaining({ ok: false, error: 'backup.unified.no.ai' }));
	// [Q-051/M-62] 真实导出 → 恢复必成(上限 = 本版 schema 版本);「当前值 + 1」必拒(负孪生);历史值 3/4 可恢复
	expect(AI_BACKUP_SNAPSHOT_VERSION_MAX).toBe(AI_ANALYSIS_SCHEMA_VERSION);
	expect(planWorkspaceRestore({ snapshotVersion: AI_ANALYSIS_SCHEMA_VERSION, stores: { messages: [] } }, KEYS).ok).toBe(true);
	expect(planWorkspaceRestore({ snapshotVersion: 4, stores: { messages: [] } }, KEYS).ok).toBe(true);
	expect(planWorkspaceRestore({ snapshotVersion: AI_ANALYSIS_SCHEMA_VERSION + 1, stores: { messages: [] } }, KEYS)).toEqual(expect.objectContaining({ ok: false, error: 'backup.version.future' }));
});

test('[Q-058/M-78] 带密钥的店恢复时按 id 保留本机 Key(剥密包不清空本机 Key)', async ()=>{
	const deps = memDeps({ provider_profiles: [{ id: 'p1', name: '本机', apiKey: 'local-key' }, { id: 'p2', apiKey: 'k2' }], messages: [] });
	const plan = planWorkspaceRestore({ stores: { provider_profiles: [{ id: 'p1', name: '包内', apiKey: '', apiKeyRedacted: true }, { id: 'p3', apiKey: '', apiKeyRedacted: true }] } }, KEYS);
	await restoreWorkspaceStores(plan, deps);
	const byId = Object.fromEntries(deps.db.provider_profiles.map((r)=>[r.id, r]));
	expect(byId.p1.apiKey).toBe('local-key');       // 同 id:保留本机 Key
	expect(byId.p1.name).toBe('包内');               // 其余字段以包内为准
	expect(byId.p1.apiKeyRedacted).toBeUndefined();
	expect(byId.p3.apiKey).toBe('');                 // 本机没有的档:照包内(空 Key,提示重填)
	expect(byId.p2).toBeUndefined();                 // 包内没有的档:被替换掉(店级替换语义不变)
});

test('🔴 执行:单店包只替换该店,其余店逐条不变;句柄落 ok', async ()=>{
	const deps = memDeps({ conversations: [{ id: 'c1' }], messages: [{ id: 'old' }], templates: [{ id: 't1' }, { id: 't2' }], provider_profiles: [{ id: 'p1', apiKey: 'k' }] });
	const before = snap(deps.db);
	const plan = planWorkspaceRestore({ stores: { messages: [{ id: 'new1' }, { id: 'new2' }] } }, KEYS);
	const out = await restoreWorkspaceStores(plan, deps);
	expect(out).toEqual({ present: ['messages'], absent: expect.any(Array), total: 2 });
	expect(deps.db.messages.map((r)=>r.id)).toEqual(['new1', 'new2']);
	expect(deps.db.conversations).toEqual([{ id: 'c1' }]);
	expect(deps.db.templates).toEqual([{ id: 't1' }, { id: 't2' }]);
	expect(deps.db.provider_profiles).toEqual([{ id: 'p1', apiKey: 'k' }]);
	expect(deps.calls.clear).toEqual(['messages']);   // 缺席店零 clear
	expect(deps.meta.map((m)=>m.status)).toEqual(['in-progress', 'ok']);
	expect(deps.meta[1].id).toBe(RESTORE_HANDLE_ID);
	// 只有 messages 变了
	const after = JSON.parse(snap(deps.db)); const b4 = JSON.parse(before);
	expect(after.filter(([k])=>k !== 'messages')).toEqual(b4.filter(([k])=>k !== 'messages'));
});

test('🔴 中途抛错:第二店写入失败 ⇒ 已动过的店按快照回滚,三店哈希恒等;句柄 rolled-back;错误上抛', async ()=>{
	const deps = memDeps({ conversations: [{ id: 'c1' }], messages: [{ id: 'm1' }], templates: [{ id: 't1' }], provider_profiles: [] });
	const before = snap(deps.db);
	let n = 0;
	const put = deps.bulkPutStoreRecords;
	deps.bulkPutStoreRecords = async (name, rows, prefix)=>{ n++; if(n === 2){ throw new Error('disk full'); } return put(name, rows, prefix); };
	const plan = planWorkspaceRestore({ stores: { conversations: [{ id: 'cx' }], messages: [{ id: 'mx' }], templates: [{ id: 'tx' }] } }, KEYS);
	await expect(restoreWorkspaceStores(plan, deps)).rejects.toThrow('disk full');
	expect(snap(deps.db)).toBe(before);
	expect(deps.meta.map((m)=>m.status)).toEqual(['in-progress', 'rolled-back']);
});

test('未来版拒:执行前就抛,零 clear;超限 blob 不进解压', async ()=>{
	const deps = memDeps({ messages: [{ id: 'm1' }] });
	await expect(restoreWorkspaceStores(planWorkspaceRestore({ snapshotVersion: 7, stores: { messages: [] } }, KEYS), deps)).rejects.toThrow('backup.version.future');
	expect(deps.calls.clear).toEqual([]);
	const big = { size: AI_BACKUP_MAX_ZIP_BYTES + 1 };
	await expect(parseWorkspaceBackupBlob(big, { maxBytes: AI_BACKUP_MAX_ZIP_BYTES })).rejects.toThrow('backup.too.large');
});
