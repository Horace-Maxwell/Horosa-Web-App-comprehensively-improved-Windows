// AI 工作区 IndexedDB 读不开(装过更新版本又回退 = VersionError;或打不开)时的全量备份 / 恢复 / 自动备份:
//   · 导出:包里标 aiWorkspaceUnavailable + degraded(此前 aiWorkspace 静默为 null,看不出「没读到」与「没有数据」的区别);
//   · 恢复:AI 段不写、ok:false 并说明(此前写进内存回退、报「写入 N 条」,刷新就没了);
//   · 自动备份:照写但文件名标 -degraded、结果记 degraded / 连续第几份;修剪永远另留最近一份健康的(见 autoBackup 用例)。
// 真径用 fake-indexeddb:先用 v99 建库(= 更新版本建的),应用层再开当前版本即 VersionError。
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>true),
	invokeDesktopCommand: jest.fn(()=>Promise.resolve()),
}));

if(typeof window.indexedDB !== 'undefined'){
	throw new Error('前提失效:jsdom 已定义 indexedDB,fake-indexeddb 的装载顺序需重审');
}
require('fake-indexeddb/auto');
const FIDB = require('fake-indexeddb');

const DB_NAME = 'horosa.ai.analysis.v1';

function rawOpen(factory, version, onUpgrade){
	return new Promise((resolve, reject)=>{
		const req = factory.open(DB_NAME, version);
		req.onupgradeneeded = ()=>onUpgrade(req.result);
		req.onsuccess = ()=>resolve(req.result);
		req.onerror = ()=>reject(req.error);
	});
}
// 「更新版本」建的库:里面有 1 条真对话
async function seedNewerVersionDb(factory){
	const db = await rawOpen(factory, 99, (d)=>{ ['conversations', 'messages', 'workspace_meta', 'provider_profiles'].forEach((n)=>d.createObjectStore(n, { keyPath: 'id' })); });
	await new Promise((res)=>{ const tx = db.transaction('conversations', 'readwrite'); tx.objectStore('conversations').put({ id: 'real-1', title: '真对话' }); tx.oncomplete = res; });
	db.close();
}
function load(){
	const out = {};
	jest.isolateModules(()=>{
		out.ub = require('../unifiedBackup');
		out.st = require('../aiAnalysisStore');
		out.ab = require('../autoBackup');
		out.desk = require('../aiAnalysisDesktop');
	});
	return out;
}
const PKG_WITH_AI = (ub)=>({ format: ub.UNIFIED_BACKUP_FORMAT, version: 2, raw: { 'horosa.tz.cnUnified': '1' }, aiWorkspace: { stores: { conversations: [{ id: 'from-backup-1', title: '备份里的对话' }] } } });

beforeEach(()=>{
	window.localStorage.clear();
});

describe('AI 工作区读不开', ()=>{
	it('🔴 导出:包里标出 AI 段没读到(aiWorkspaceUnavailable + degraded),不是静默当「没有 AI 数据」', async ()=>{
		const factory = new FIDB.IDBFactory();
		window.indexedDB = factory;
		await seedNewerVersionDb(factory);
		const { ub, st } = load();
		const m = await ub.buildFullUnifiedManifest();
		expect(st.getAiStoreHealth()).toMatchObject({ degraded: true, reason: 'version' });
		expect(m.aiWorkspace).toBe(null);
		expect(m.aiWorkspaceUnavailable).toEqual({ reason: 'version' });
		expect(m.degraded).toEqual(['aiWorkspace']);
		expect(ub.aiWorkspaceUnavailableText('version')).toContain('更新版本');
	});

	it('🔴 恢复:AI 段不写进内存回退、行 ok:false 并说明;预览同样写明不会写入', async ()=>{
		const factory = new FIDB.IDBFactory();
		window.indexedDB = factory;
		await seedNewerVersionDb(factory);
		const { ub, st } = load();
		const res = await ub.restoreUnifiedBackup(PKG_WITH_AI(ub));
		const r = res.find((x)=>x.key === 'aiWorkspace');
		expect(r.ok).toBe(false);
		expect(r.detail).toContain('没有写入');
		expect(res.some((x)=>x.sessionOnly)).toBe(false);   // 没写 = 刷新也不丢什么,照常刷新
		const conv = await st.listStoreRecords('conversations');
		expect(conv.find((x)=>x.id === 'from-backup-1')).toBeUndefined();
		const rows = ub.previewUnifiedRestore(PKG_WITH_AI(ub));
		expect(rows.find((x)=>x.key === 'aiWorkspace').detail).toContain('不会写入');
	});

	it('🔴 自动备份:照写但文件名标 -degraded,结果记哪几段与连续第几份', async ()=>{
		const factory = new FIDB.IDBFactory();
		window.indexedDB = factory;
		await seedNewerVersionDb(factory);
		const { ab, desk } = load();
		const written = [];
		desk.invokeDesktopCommand.mockImplementation((cmd, args)=>{
			if(cmd === 'auto_backup_write_command'){ written.push(args.fileName); return Promise.resolve(`/x/${args.fileName}`); }
			if(cmd === 'auto_backup_list_command'){ return Promise.resolve(written.slice()); }
			return Promise.resolve();
		});
		const r1 = await ab.runAutoBackupOnce({ trigger: 'pre-risk' });
		expect(r1).toMatchObject({ ok: true, degraded: ['aiWorkspace'], degradedCount: 1 });
		expect(written[0]).toMatch(/^horosa-backup-\d{8}-\d{6}-degraded\.zip$/);
		expect(ab.isDegradedBackupName(written[0])).toBe(true);
		expect(ab.parseBackupFileName(written[0])).not.toBe(null);
		await new Promise((res)=>setTimeout(res, 1100));   // 文件名精确到秒
		const r2 = await ab.runAutoBackupOnce({ trigger: 'pre-risk' });
		expect(r2.degradedCount).toBe(2);
	});

	it('健康时:不标、AI 段照常写入', async ()=>{
		window.indexedDB = new FIDB.IDBFactory();
		const { ub, st } = load();
		const m = await ub.buildFullUnifiedManifest();
		expect(m.aiWorkspaceUnavailable).toBeUndefined();
		expect(m.degraded).toBeUndefined();
		const res = await ub.restoreUnifiedBackup(PKG_WITH_AI(ub));
		expect(res.find((x)=>x.key === 'aiWorkspace')).toMatchObject({ ok: true });
		const conv = await st.listStoreRecords('conversations');
		expect(conv.find((x)=>x.id === 'from-backup-1')).toBeTruthy();
	});
});
