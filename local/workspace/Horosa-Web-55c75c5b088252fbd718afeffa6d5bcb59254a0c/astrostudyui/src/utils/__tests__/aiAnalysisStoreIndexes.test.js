// [P0-S1] AI 分析工作区库:消息按 conversationId 索引读 / deleteWhere 索引化 / IndexedDB v6 幂等补索引。
// 真径用 fake-indexeddb(纯内存 IndexedDB 实现,与浏览器同一套事务/游标/索引语义);
// 内存回退径直接跑模块自带的 MEMORY_DB。
// 🔴 jsdom 不实现 indexedDB:各用例按需装/卸 window.indexedDB,并用 jest.isolateModules 取新模块实例
//    (模块级 openDbPromise 缓存句柄,跨用例共用会串库)。
const fs = require('fs');
const path = require('path');

if(typeof window.indexedDB !== 'undefined'){
	throw new Error('前提失效:jsdom 已定义 indexedDB,fake-indexeddb 的装载顺序与本文件的装卸前提需重审');
}
require('fake-indexeddb/auto');   // 装 window.indexedDB / IDBKeyRange 等全局;各用例再换成独立 IDBFactory
const FIDB = require('fake-indexeddb');

const STORE_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'aiAnalysisStore.js'), 'utf8');
const DB_NAME = 'horosa.ai.analysis.v1';
const ALL_STORE_NAMES = [
	'provider_profiles', 'materials', 'material_folders', 'tag_groups', 'material_chunks', 'material_embeddings',
	'templates', 'template_versions', 'bundles', 'conversations', 'messages', 'context_cache', 'workspace_meta',
	'report_templates', 'report_instances',	'agent_tasks', 'agent_notices', 'automation_rules', 'integration_profiles',
];

function loadStore(){
	let mod = null;
	jest.isolateModules(()=>{ mod = require('../aiAnalysisStore'); });
	return mod;
}

// 内存回退径:卸掉 window.indexedDB 后取新模块实例
async function withMemoryStore(fn){
	const saved = window.indexedDB;
	window.indexedDB = undefined;
	try{
		await fn(loadStore());
	}finally{
		window.indexedDB = saved;
	}
}

// IDB 真径:每用例独立 IDBFactory(互不串库)+ 新模块实例
async function withFreshIdb(fn){
	const factory = new FIDB.IDBFactory();
	window.indexedDB = factory;
	await fn(loadStore(), factory);
}

function rawOpen(factory, version, onUpgrade){
	return new Promise((resolve, reject)=>{
		const req = factory.open(DB_NAME, version);
		req.onupgradeneeded = ()=>onUpgrade(req.result, req.transaction);
		req.onsuccess = ()=>resolve(req.result);
		req.onerror = ()=>reject(req.error);
	});
}

function rawPutAll(db, storeName, rows){
	return new Promise((resolve, reject)=>{
		const tx = db.transaction(storeName, 'readwrite');
		const st = tx.objectStore(storeName);
		rows.forEach((r)=>st.put(r));
		tx.oncomplete = ()=>resolve();
		tx.onerror = ()=>reject(tx.error);
	});
}

function fakeStore(name){
	const created = new Set();
	return {
		name,
		created,
		indexNames: { contains: (n)=>created.has(n) },
		createIndex: jest.fn((idx)=>{ created.add(idx); }),
	};
}

function messageRows(cid, n, baseIso, stepMs){
	const base = Date.parse(baseIso);
	const rows = [];
	for(let i = 0; i < n; i++){
		// createdAt 打乱顺序(i*37 mod n 在 n=100 时是置换),验证排序不是插入序
		rows.push({ id: `m-${cid}-${i}`, conversationId: cid, role: i % 2 ? 'assistant' : 'user', content: `${cid}${i}`, createdAt: new Date(base + ((i * 37) % n) * stepMs).toISOString() });
	}
	return rows;
}

afterEach(()=>{
	jest.restoreAllMocks();
});

describe('① 版本与索引声明(结构锁)', ()=>{
	test('AI_ANALYSIS_DB_VERSION === 7;messages.conversationId 索引在 EXTRA_INDEXES 声明并经 createIndex 建立', ()=>{
		const mod = loadStore();
		expect(mod.AI_ANALYSIS_DB_VERSION).toBe(7);
		expect(STORE_SRC.includes('const DB_VERSION = 7;')).toBe(true);
		expect(STORE_SRC.includes("['conversationId', 'conversationId']")).toBe(true);
		expect(STORE_SRC.includes('store.createIndex(name, keyPath, { unique: false })')).toBe(true);
		expect(mod.EXTRA_INDEXES.messages.map((x)=>x[0])).toEqual(['conversationId', 'conversationCreated']);
		expect(mod.EXTRA_INDEXES.material_chunks).toEqual([['materialId', 'materialId']]);
		expect(mod.EXTRA_INDEXES.material_embeddings).toEqual([['materialId', 'materialId']]);
		// [P1] 任务/通知/规则/集成档案 二级索引
		expect(mod.EXTRA_INDEXES.agent_tasks.map((x)=>x[0])).toEqual(['status', 'kind', 'nextRunAt']);
		expect(mod.EXTRA_INDEXES.agent_notices).toEqual([['createdAt', 'createdAt']]);
		expect(mod.EXTRA_INDEXES.automation_rules).toEqual([['event', 'event']]);
		expect(mod.EXTRA_INDEXES.integration_profiles).toEqual([['kind', 'kind']]);
		expect(mod.EXTRA_INDEXES.template_versions).toEqual([['templateId', 'templateId']]);
		// 消费点:listConversationMessages 走 readByIndex,replaceConversationMessages 的删除带 hint
		expect(STORE_SRC.includes("readByIndex(AI_ANALYSIS_STORES.messages, 'conversationId', conversationId)")).toBe(true);
		expect(STORE_SRC.includes("{ index: 'conversationId', value: conversationId }")).toBe(true);
		// 分批游标读的函数签名行不动(外部脚本按此字面量定位)
		expect(STORE_SRC.includes('export async function listStoreRecordsBatched')).toBe(true);
	});
});

describe('② ensureIndexes 幂等', ()=>{
	test('messages 得 conversationId + conversationCreated(复合 keyPath 原样);materials 只有基础三索引;二次调用零 createIndex', ()=>{
		const { ensureIndexes } = loadStore();
		const msg = fakeStore('messages');
		ensureIndexes(msg);
		expect([...msg.created]).toEqual(['updatedAt', 'createdAt', 'schemaVersion', 'conversationId', 'conversationCreated']);
		expect(msg.createIndex.mock.calls.find((c)=>c[0] === 'conversationCreated')[1]).toEqual(['conversationId', 'createdAt']);
		expect(msg.createIndex.mock.calls.find((c)=>c[0] === 'conversationId')[1]).toBe('conversationId');
		const n = msg.createIndex.mock.calls.length;
		ensureIndexes(msg);
		expect(msg.createIndex.mock.calls.length).toBe(n);
		const mat = fakeStore('materials');
		ensureIndexes(mat);
		expect([...mat.created]).toEqual(['updatedAt', 'createdAt', 'schemaVersion']);
		expect([...mat.created].includes('conversationId')).toBe(false);
	});
});

describe('③ 版本变更事务体 __applySchemaUpgradeForTests', ()=>{
	test('部分 store 已存在:不重建已存在的,缺的建表,每个 store 都过 ensureIndexes', ()=>{
		const { __applySchemaUpgradeForTests, AI_ANALYSIS_STORES } = loadStore();
		const names = Object.values(AI_ANALYSIS_STORES);
		const existing = new Set([AI_ANALYSIS_STORES.messages, AI_ANALYSIS_STORES.materials, AI_ANALYSIS_STORES.conversations]);
		const stores = new Map();
		existing.forEach((n)=>stores.set(n, fakeStore(n)));
		const db = {
			objectStoreNames: { contains: (n)=>existing.has(n) },
			createObjectStore: jest.fn((n, opts)=>{
				expect(opts).toEqual({ keyPath: 'id' });
				const s = fakeStore(n);
				stores.set(n, s);
				return s;
			}),
		};
		const tx = { objectStore: jest.fn((n)=>stores.get(n)) };
		__applySchemaUpgradeForTests(db, tx);
		expect(db.createObjectStore.mock.calls.map((c)=>c[0]).sort()).toEqual(names.filter((n)=>!existing.has(n)).sort());
		expect(tx.objectStore.mock.calls.map((c)=>c[0]).sort()).toEqual([...existing].sort());
		names.forEach((n)=>{
			const s = stores.get(n);
			expect(s).toBeTruthy();
			expect(s.created.has('updatedAt') && s.created.has('createdAt') && s.created.has('schemaVersion')).toBe(true);
		});
		expect(stores.get('messages').created.has('conversationId')).toBe(true);
		expect(stores.get('material_chunks').created.has('materialId')).toBe(true);
		expect(stores.get('material_embeddings').created.has('materialId')).toBe(true);
		expect(stores.get('template_versions').created.has('templateId')).toBe(true);
		expect(stores.get('materials').created.has('materialId')).toBe(false);
	});
});

describe('④ 内存回退径', ()=>{
	test('listConversationMessages 与旧 filter+sort 逐条同构;孤儿 streaming 修复仍回写;空 id 返 []', async ()=>{
		await withMemoryStore(async (mod)=>{
			const { AI_ANALYSIS_STORES, putStoreRecord, listStoreRecords, listConversationMessages, getStoreRecord, readByIndex, __resetInFlightMessagesForTests } = mod;
			__resetInFlightMessagesForTests();
			const rows = [
				...messageRows('A', 12, '2026-01-01T00:00:00.000Z', 60000),
				...messageRows('B', 12, '2026-01-02T00:00:00.000Z', 60000),
				...messageRows('C', 12, '2026-01-03T00:00:00.000Z', 60000),
			];
			rows.find((r)=>r.id === 'm-A-5').streamStatus = 'streaming';
			for(let i = 0; i < rows.length; i++){
				// eslint-disable-next-line no-await-in-loop
				await putStoreRecord(AI_ANALYSIS_STORES.messages, rows[i], 'msg');
			}
			// 旧算法:全量读 + filter + createdAt 升序
			const all = await listStoreRecords(AI_ANALYSIS_STORES.messages);
			expect(all.length).toBe(36);
			const legacy = all
				.filter((m)=>m.conversationId === 'A')
				.sort((a, b)=>(Date.parse(a.createdAt || '') || 0) - (Date.parse(b.createdAt || '') || 0));
			const out = await listConversationMessages('A');
			expect(out.length).toBe(12);
			expect(out.map((m)=>m.id)).toEqual(legacy.map((m)=>m.id));
			out.filter((m)=>m.id !== 'm-A-5').forEach((m)=>{
				expect(m).toEqual(legacy.find((l)=>l.id === m.id));
			});
			// 孤儿修复:本会话未登记在途的 streaming → aborted,并已回写库
			const orphan = out.find((m)=>m.id === 'm-A-5');
			expect(orphan.streamStatus).toBe('aborted');
			expect(orphan.content).toBe('A5');
			const persisted = await getStoreRecord(AI_ANALYSIS_STORES.messages, 'm-A-5');
			expect(persisted.streamStatus).toBe('aborted');
			// 内存径 readByIndex 按同一 keyPath 过滤(复合索引也按 keyPath 数组比对)
			expect((await readByIndex(AI_ANALYSIS_STORES.messages, 'conversationId', 'B')).length).toBe(12);
			const bRow = rows.find((r)=>r.id === 'm-B-3');
			const comp = await readByIndex(AI_ANALYSIS_STORES.messages, 'conversationCreated', ['B', bRow.createdAt]);
			expect(comp.map((m)=>m.id)).toEqual(['m-B-3']);
			expect(await listConversationMessages('')).toEqual([]);
			expect(await listConversationMessages(undefined)).toEqual([]);
			expect(await listConversationMessages(null)).toEqual([]);
		});
	});

	test('deleteWhere 带 hint 在内存径走原路径(predicate 判定),clearStore/countStoreRecords 可用', async ()=>{
		await withMemoryStore(async (mod)=>{
			const { AI_ANALYSIS_STORES, bulkPutStoreRecords, deleteWhere, countStoreRecords, clearStore, replaceConversationMessages, listConversationMessages } = mod;
			await bulkPutStoreRecords(AI_ANALYSIS_STORES.messages, [...messageRows('A', 5, '2026-01-01T00:00:00.000Z', 1000), ...messageRows('B', 5, '2026-01-01T00:00:00.000Z', 1000)], 'msg');
			expect(await countStoreRecords(AI_ANALYSIS_STORES.messages)).toBe(10);
			expect(await deleteWhere(AI_ANALYSIS_STORES.messages, (m)=>m.conversationId === 'A', { index: 'conversationId', value: 'A' })).toBe(5);
			expect(await countStoreRecords(AI_ANALYSIS_STORES.messages)).toBe(5);
			await replaceConversationMessages('B', [{ id: 'nb-1', role: 'user', content: 'x', createdAt: '2026-01-01T00:00:00.000Z' }]);
			expect((await listConversationMessages('B')).map((m)=>m.id)).toEqual(['nb-1']);
			expect(await countStoreRecords(AI_ANALYSIS_STORES.messages)).toBe(1);
			await clearStore(AI_ANALYSIS_STORES.messages);
			expect(await countStoreRecords(AI_ANALYSIS_STORES.messages)).toBe(0);
		});
	});
});

describe('⑤ IndexedDB 真径(fake-indexeddb)', ()=>{
	test('3 会话各 100 条:读 A 走 index.getAll 1 次/store.getAll 0 次,100 条 createdAt 升序;deleteWhere 带 hint 只删 A 返回 100,B/C 不动', async ()=>{
		await withFreshIdb(async (mod)=>{
			const { AI_ANALYSIS_STORES, bulkPutStoreRecords, listConversationMessages, deleteWhere, countStoreRecords, readByIndex, getIdbStatsForDebug, __resetIdbStatsForTests, __resetInFlightMessagesForTests } = mod;
			__resetInFlightMessagesForTests();
			const rows = [
				...messageRows('A', 100, '2026-02-01T00:00:00.000Z', 1000),
				...messageRows('B', 100, '2026-02-02T00:00:00.000Z', 1000),
				...messageRows('C', 100, '2026-02-03T00:00:00.000Z', 1000),
			];
			await bulkPutStoreRecords(AI_ANALYSIS_STORES.messages, rows, 'msg');
			expect(await countStoreRecords(AI_ANALYSIS_STORES.messages)).toBe(300);

			const idxGetAll = jest.spyOn(FIDB.IDBIndex.prototype, 'getAll');
			const storeGetAll = jest.spyOn(FIDB.IDBObjectStore.prototype, 'getAll');
			__resetIdbStatsForTests();
			const out = await listConversationMessages('A');
			expect(idxGetAll).toHaveBeenCalledTimes(1);
			expect(storeGetAll).toHaveBeenCalledTimes(0);
			expect(out.length).toBe(100);
			expect(out.every((m)=>m.conversationId === 'A')).toBe(true);
			for(let i = 1; i < out.length; i++){
				expect(Date.parse(out[i].createdAt) >= Date.parse(out[i - 1].createdAt)).toBe(true);
			}
			expect(out[0].id).toBe('m-A-0');   // (0*37)%100 = 0 → 最早
			expect(getIdbStatsForDebug()).toEqual(expect.objectContaining({ indexGetAll: 1, getAll: 0, fallback: 0 }));
			idxGetAll.mockRestore();
			storeGetAll.mockRestore();

			// deleteWhere 带 hint:单事务游标删,零 getAll;只删 A
			const storeGetAll2 = jest.spyOn(FIDB.IDBObjectStore.prototype, 'getAll');
			const idxGetAll2 = jest.spyOn(FIDB.IDBIndex.prototype, 'getAll');
			const openCursor = jest.spyOn(FIDB.IDBIndex.prototype, 'openCursor');
			const n = await deleteWhere(AI_ANALYSIS_STORES.messages, (m)=>m.conversationId === 'A', { index: 'conversationId', value: 'A' });
			expect(n).toBe(100);
			expect(storeGetAll2).toHaveBeenCalledTimes(0);
			expect(idxGetAll2).toHaveBeenCalledTimes(0);
			expect(openCursor).toHaveBeenCalledTimes(1);
			storeGetAll2.mockRestore();
			idxGetAll2.mockRestore();
			openCursor.mockRestore();
			expect(await countStoreRecords(AI_ANALYSIS_STORES.messages)).toBe(200);
			expect((await readByIndex(AI_ANALYSIS_STORES.messages, 'conversationId', 'A')).length).toBe(0);
			expect((await readByIndex(AI_ANALYSIS_STORES.messages, 'conversationId', 'B')).length).toBe(100);
			expect((await readByIndex(AI_ANALYSIS_STORES.messages, 'conversationId', 'C')).length).toBe(100);
			expect(getIdbStatsForDebug().cursorDelete).toBe(100);
			// predicate 仍有否决权:hint 命中但 predicate 假 → 零删
			expect(await deleteWhere(AI_ANALYSIS_STORES.messages, ()=>false, { index: 'conversationId', value: 'B' })).toBe(0);
			expect(await countStoreRecords(AI_ANALYSIS_STORES.messages)).toBe(200);
			// 复合索引真径可用
			const bRow = rows.find((r)=>r.id === 'm-B-7');
			expect((await readByIndex(AI_ANALYSIS_STORES.messages, 'conversationCreated', ['B', bRow.createdAt])).map((m)=>m.id)).toEqual(['m-B-7']);
		});
	});

	test('索引缺席的库(v10 但无二级索引)→ readByIndex 回退 getAll+filter 结果不变且 stats.fallback===1;deleteWhere 带 hint 同样回退', async ()=>{
		await withFreshIdb(async (mod, factory)=>{
			const { AI_ANALYSIS_STORES, readByIndex, deleteWhere, countStoreRecords, getIdbStatsForDebug, __resetIdbStatsForTests } = mod;
			const raw = await rawOpen(factory, mod.AI_ANALYSIS_DB_VERSION, (db)=>{
				ALL_STORE_NAMES.forEach((n)=>db.createObjectStore(n, { keyPath: 'id' }));
			});
			await rawPutAll(raw, 'messages', [
				{ id: 'a1', conversationId: 'A', createdAt: '2026-03-01T00:00:03.000Z' },
				{ id: 'a2', conversationId: 'A', createdAt: '2026-03-01T00:00:01.000Z' },
				{ id: 'a3', conversationId: 'A', createdAt: '2026-03-01T00:00:02.000Z' },
				{ id: 'b1', conversationId: 'B', createdAt: '2026-03-01T00:00:01.000Z' },
				{ id: 'b2', conversationId: 'B', createdAt: '2026-03-01T00:00:02.000Z' },
			]);
			raw.close();
			__resetIdbStatsForTests();
			const idxGetAll = jest.spyOn(FIDB.IDBIndex.prototype, 'getAll');
			const out = await readByIndex(AI_ANALYSIS_STORES.messages, 'conversationId', 'A');
			expect(out.map((m)=>m.id).sort()).toEqual(['a1', 'a2', 'a3']);
			expect(idxGetAll).toHaveBeenCalledTimes(0);
			expect(getIdbStatsForDebug().fallback).toBe(1);
			expect(getIdbStatsForDebug().getAll).toBe(1);
			expect(getIdbStatsForDebug().indexGetAll).toBe(0);
			idxGetAll.mockRestore();
			expect(await deleteWhere(AI_ANALYSIS_STORES.messages, (m)=>m.conversationId === 'A', { index: 'conversationId', value: 'A' })).toBe(3);
			expect(await countStoreRecords(AI_ANALYSIS_STORES.messages)).toBe(2);
			expect(getIdbStatsForDebug().cursorDelete).toBe(0);
		});
	});
});

describe('⑦ 调试计数钩子', ()=>{
	test("localStorage['horosa.debug.idbStats']='1' 时模块初始化挂 window.__horosaIdbStats(实时对象);getIdbStatsForDebug 返回副本", async ()=>{
		delete window.__horosaIdbStats;
		window.localStorage.setItem('horosa.debug.idbStats', '1');
		try{
			await withFreshIdb(async (mod)=>{
				const { AI_ANALYSIS_STORES, putStoreRecord, getIdbStatsForDebug } = mod;
				expect(window.__horosaIdbStats).toBeTruthy();
				const snap = getIdbStatsForDebug();
				expect(snap).toEqual({ getAll: 0, indexGetAll: 0, indexCursor: 0, cursorDelete: 0, put: 0, delete: 0, fallback: 0 });
				await putStoreRecord(AI_ANALYSIS_STORES.messages, { id: 'dbg-1', conversationId: 'D', createdAt: '2026-01-01T00:00:00.000Z' }, 'msg');
				expect(window.__horosaIdbStats.put).toBe(1);   // 实时对象随操作更新
				expect(snap.put).toBe(0);                      // 副本不受影响
			});
		}finally{
			window.localStorage.removeItem('horosa.debug.idbStats');
			delete window.__horosaIdbStats;
		}
		// 未开旗标 → 不挂钩子
		await withFreshIdb(async ()=>{
			expect(window.__horosaIdbStats).toBeUndefined();
		});
	});
});

describe('⑥ v5 → v6 升版', ()=>{
	test('v5 旧库(仅基础三索引,含旧记录)以 v6 打开 → onupgradeneeded 补二级索引,旧记录可按索引查到', async ()=>{
		await withFreshIdb(async (mod, factory)=>{
			const { AI_ANALYSIS_STORES, listConversationMessages, readByIndex, getIdbStatsForDebug, __resetIdbStatsForTests, __resetInFlightMessagesForTests } = mod;
			__resetInFlightMessagesForTests();
			const db9 = await rawOpen(factory, 5, (db)=>{
				ALL_STORE_NAMES.forEach((n)=>{
					const s = db.createObjectStore(n, { keyPath: 'id' });
					s.createIndex('updatedAt', 'updatedAt', { unique: false });
					s.createIndex('createdAt', 'createdAt', { unique: false });
					s.createIndex('schemaVersion', 'schemaVersion', { unique: false });
				});
			});
			expect(db9.version).toBe(5);
			await rawPutAll(db9, 'messages', [
				{ id: 'old-2', conversationId: 'legacy-A', role: 'assistant', content: '二', createdAt: '2025-12-01T00:00:02.000Z', updatedAt: '2025-12-01T00:00:02.000Z', schemaVersion: 4 },
				{ id: 'old-1', conversationId: 'legacy-A', role: 'user', content: '一', createdAt: '2025-12-01T00:00:01.000Z', updatedAt: '2025-12-01T00:00:01.000Z', schemaVersion: 4 },
				{ id: 'old-x', conversationId: 'legacy-B', role: 'user', content: '乙', createdAt: '2025-12-01T00:00:01.000Z', updatedAt: '2025-12-01T00:00:01.000Z', schemaVersion: 4 },
			]);
			await rawPutAll(db9, 'material_chunks', [{ id: 'ch1', materialId: 'mat1', chunkIndex: 0, content: 'x', createdAt: '2025-12-01T00:00:00.000Z', updatedAt: '2025-12-01T00:00:00.000Z' }]);
			await rawPutAll(db9, 'template_versions', [{ id: 'tv1', templateId: 'tpl1', versionNumber: 1, snapshot: {}, createdAt: '2025-12-01T00:00:00.000Z', updatedAt: '2025-12-01T00:00:00.000Z' }]);
			db9.close();

			__resetIdbStatsForTests();
			const idxGetAll = jest.spyOn(FIDB.IDBIndex.prototype, 'getAll');
			const out = await listConversationMessages('legacy-A');
			expect(out.map((m)=>m.id)).toEqual(['old-1', 'old-2']);
			expect(out[0].content).toBe('一');
			expect(idxGetAll).toHaveBeenCalledTimes(1);
			expect(getIdbStatsForDebug().fallback).toBe(0);
			idxGetAll.mockRestore();
			expect((await readByIndex(AI_ANALYSIS_STORES.materialChunks, 'materialId', 'mat1')).map((r)=>r.id)).toEqual(['ch1']);
			expect((await readByIndex(AI_ANALYSIS_STORES.templateVersions, 'templateId', 'tpl1')).map((r)=>r.id)).toEqual(['tv1']);

			// 索引确实在位:另开一条同版本连接直接看 indexNames(不触发升版)
			const db10 = await rawOpen(factory, mod.AI_ANALYSIS_DB_VERSION, ()=>{ throw new Error('不该再升版'); });
			expect(db10.version).toBe(7);
			const msgIdx = Array.from(db10.transaction('messages', 'readonly').objectStore('messages').indexNames);
			['updatedAt', 'createdAt', 'schemaVersion', 'conversationId', 'conversationCreated'].forEach((n)=>expect(msgIdx).toContain(n));
			expect(Array.from(db10.transaction('material_chunks', 'readonly').objectStore('material_chunks').indexNames)).toContain('materialId');
			expect(Array.from(db10.transaction('material_embeddings', 'readonly').objectStore('material_embeddings').indexNames)).toContain('materialId');
			expect(Array.from(db10.transaction('template_versions', 'readonly').objectStore('template_versions').indexNames)).toContain('templateId');
			expect(Array.from(db10.transaction('materials', 'readonly').objectStore('materials').indexNames)).toEqual(['createdAt', 'schemaVersion', 'updatedAt']);
			db10.close();
		});
	});
});
