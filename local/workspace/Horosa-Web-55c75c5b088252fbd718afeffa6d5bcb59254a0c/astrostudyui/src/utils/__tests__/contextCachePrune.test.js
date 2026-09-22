// [P0-S4] AI 源上下文缓存(context_cache)条数上限 300 + 命中触摸。
// 内存径直接跑模块 MEMORY_DB;IDB 真径用 fake-indexeddb 的独立 IDBFactory + 新模块实例。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../../services/astro', ()=>({ fetchChart: jest.fn(async ()=>{ throw new Error('offline'); }) }));

const fs = require('fs');
const path = require('path');
const FIDB = require('fake-indexeddb');   // 只取类,不装全局:本文件默认跑内存径

const CTX_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'aiAnalysisContext.js'), 'utf8');
const strip = (s)=>s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const flush = async ()=>{
	for(let i = 0; i < 3; i++){
		// eslint-disable-next-line no-await-in-loop
		await new Promise((r)=>setTimeout(r, 0));
	}
};

function ctxRows(n, baseIso, stepMs){
	const base = Date.parse(baseIso);
	const rows = [];
	for(let i = 0; i < n; i++){
		const iso = new Date(base + i * stepMs).toISOString();
		rows.push({ id: `chart:c${i}:full`, sourceId: `c${i}`, sourceType: 'chart', content: `正文${i}`, sourceUpdatedAt: 'u', createdAt: iso, updatedAt: iso });
	}
	return rows;
}

function loadStore(){
	let mod = null;
	jest.isolateModules(()=>{ mod = require('../aiAnalysisStore'); });
	return mod;
}

beforeEach(()=>{
	window.localStorage.clear();
});

describe('① 内存径裁剪', ()=>{
	test('310 条递增 updatedAt → prune 后 300 条,最旧 10 个 id 消失;不超额时零删除', async ()=>{
		const mod = loadStore();
		const { AI_ANALYSIS_STORES, bulkPutStoreRecords, pruneContextCache, countStoreRecords, getStoreRecord, CONTEXT_CACHE_MAX_ENTRIES } = mod;
		expect(CONTEXT_CACHE_MAX_ENTRIES).toBe(300);
		await bulkPutStoreRecords(AI_ANALYSIS_STORES.contextCache, ctxRows(310, '2026-01-01T00:00:00.000Z', 60000), 'ctx');
		expect(await countStoreRecords(AI_ANALYSIS_STORES.contextCache)).toBe(310);
		expect(await pruneContextCache({ max: 300 })).toBe(10);
		expect(await countStoreRecords(AI_ANALYSIS_STORES.contextCache)).toBe(300);
		for(let i = 0; i < 10; i++){
			// eslint-disable-next-line no-await-in-loop
			expect(await getStoreRecord(AI_ANALYSIS_STORES.contextCache, `chart:c${i}:full`)).toBeNull();
		}
		expect(await getStoreRecord(AI_ANALYSIS_STORES.contextCache, 'chart:c10:full')).toBeTruthy();
		expect(await getStoreRecord(AI_ANALYSIS_STORES.contextCache, 'chart:c309:full')).toBeTruthy();
		expect(await pruneContextCache({ max: 300 })).toBe(0);
		expect(await countStoreRecords(AI_ANALYSIS_STORES.contextCache)).toBe(300);
	});

	test('单飞:在途期间并发调用共享同一 Promise', async ()=>{
		const mod = loadStore();
		const { AI_ANALYSIS_STORES, bulkPutStoreRecords, pruneContextCache, countStoreRecords } = mod;
		await bulkPutStoreRecords(AI_ANALYSIS_STORES.contextCache, ctxRows(305, '2026-01-01T00:00:00.000Z', 60000), 'ctx');
		const p1 = pruneContextCache({ max: 300 });
		const p2 = pruneContextCache({ max: 300 });
		expect(p2).toBe(p1);
		expect(await p1).toBe(5);
		expect(await countStoreRecords(AI_ANALYSIS_STORES.contextCache)).toBe(300);
	});
});

describe('② IDB 真径裁剪(fake-indexeddb)', ()=>{
	test('用 index(updatedAt).openKeyCursor 取最旧主键删除,不 getAll;结果 300 条且最旧 10 个消失', async ()=>{
		const savedIdb = window.indexedDB;
		const savedRange = window.IDBKeyRange;
		window.indexedDB = new FIDB.IDBFactory();
		window.IDBKeyRange = FIDB.IDBKeyRange;
		try{
			const mod = loadStore();
			const { AI_ANALYSIS_STORES, bulkPutStoreRecords, pruneContextCache, countStoreRecords, getStoreRecord, getIdbStatsForDebug, __resetIdbStatsForTests } = mod;
			await bulkPutStoreRecords(AI_ANALYSIS_STORES.contextCache, ctxRows(310, '2026-02-01T00:00:00.000Z', 60000), 'ctx');
			expect(await countStoreRecords(AI_ANALYSIS_STORES.contextCache)).toBe(310);
			__resetIdbStatsForTests();
			const openKeyCursor = jest.spyOn(FIDB.IDBIndex.prototype, 'openKeyCursor');
			const idxGetAll = jest.spyOn(FIDB.IDBIndex.prototype, 'getAll');
			const storeGetAll = jest.spyOn(FIDB.IDBObjectStore.prototype, 'getAll');
			const idxOpenCursor = jest.spyOn(FIDB.IDBIndex.prototype, 'openCursor');
			expect(await pruneContextCache({ max: 300 })).toBe(10);
			expect(openKeyCursor).toHaveBeenCalledTimes(1);
			expect(idxGetAll).toHaveBeenCalledTimes(0);
			expect(storeGetAll).toHaveBeenCalledTimes(0);
			expect(idxOpenCursor).toHaveBeenCalledTimes(0);
			openKeyCursor.mockRestore();
			idxGetAll.mockRestore();
			storeGetAll.mockRestore();
			idxOpenCursor.mockRestore();
			expect(await countStoreRecords(AI_ANALYSIS_STORES.contextCache)).toBe(300);
			for(let i = 0; i < 10; i++){
				// eslint-disable-next-line no-await-in-loop
				expect(await getStoreRecord(AI_ANALYSIS_STORES.contextCache, `chart:c${i}:full`)).toBeNull();
			}
			expect(await getStoreRecord(AI_ANALYSIS_STORES.contextCache, 'chart:c10:full')).toBeTruthy();
			expect(getIdbStatsForDebug()).toEqual(expect.objectContaining({ getAll: 0, fallback: 0, delete: 10 }));
		}finally{
			window.indexedDB = savedIdb;
			window.IDBKeyRange = savedRange;
		}
	});
});

describe('③ 结构锁(剥注释)', ()=>{
	test('getAnalysisSourceContext:putStoreRecord(contextCache) 之后调 schedulePruneContextCache();命中分支触摸', ()=>{
		const src = strip(CTX_SRC);
		const start = src.indexOf('export async function getAnalysisSourceContext(');
		expect(start).toBeGreaterThan(-1);
		const end = src.indexOf('\nexport ', start + 10);
		const body = src.slice(start, end > -1 ? end : undefined);
		const put = body.indexOf('putStoreRecord(AI_ANALYSIS_STORES.contextCache');
		const sched = body.indexOf('schedulePruneContextCache()');
		expect(put).toBeGreaterThan(-1);
		expect(sched).toBeGreaterThan(put);
		// 命中分支:先触摸再返回
		const hit = body.indexOf('touchContextCacheRecord(cached)');
		expect(hit).toBeGreaterThan(-1);
		expect(hit).toBeLessThan(put);
		expect(src.includes("import { AI_ANALYSIS_STORES, getStoreRecord, putStoreRecord, schedulePruneContextCache } from './aiAnalysisStore'")).toBe(true);
	});
});

describe('④ 命中触摸(真 store 内存径 + 真 getAnalysisSourceContext)', ()=>{
	test('3 天前的缓存命中后 updatedAt 前进;1 小时前的命中不写', async ()=>{
		const store = require('../aiAnalysisStore');
		const { getAnalysisSourceContext, sourceContextCacheStamp } = require('../aiAnalysisContext');
		const { AI_ANALYSIS_STORES, putStoreRecord, getStoreRecord, clearStore } = store;
		await clearStore(AI_ANALYSIS_STORES.contextCache);
		const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
		const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
		const stamp = sourceContextCacheStamp();   // [Q-020/M-25] 命中维度含格式版本+口径签名:种子记录带同戳才算命中
		await putStoreRecord(AI_ANALYSIS_STORES.contextCache, { id: 'chart:old:full', sourceId: 'old', sourceType: 'chart', title: '旧', module: 'zz-test', content: '旧正文', meta: {}, sourceUpdatedAt: 'u-old', ...stamp, createdAt: threeDaysAgo, updatedAt: threeDaysAgo }, 'ctx');
		await putStoreRecord(AI_ANALYSIS_STORES.contextCache, { id: 'chart:fresh:full', sourceId: 'fresh', sourceType: 'chart', title: '新', module: 'zz-test', content: '新正文', meta: {}, sourceUpdatedAt: 'u-fresh', ...stamp, createdAt: oneHourAgo, updatedAt: oneHourAgo }, 'ctx');
		const before = Date.now();
		const hitOld = await getAnalysisSourceContext({ id: 'old', sourceType: 'chart', title: '旧', updatedAt: 'u-old', record: {} });
		expect(hitOld.content).toBe('旧正文');   // 命中:返回缓存正文,不重建
		const hitFresh = await getAnalysisSourceContext({ id: 'fresh', sourceType: 'chart', title: '新', updatedAt: 'u-fresh', record: {} });
		expect(hitFresh.content).toBe('新正文');
		await flush();
		const oldRec = await getStoreRecord(AI_ANALYSIS_STORES.contextCache, 'chart:old:full');
		expect(Date.parse(oldRec.updatedAt)).toBeGreaterThanOrEqual(before);
		expect(oldRec.content).toBe('旧正文');   // 触摸只动 updatedAt
		expect(oldRec.sourceUpdatedAt).toBe('u-old');
		const freshRec = await getStoreRecord(AI_ANALYSIS_STORES.contextCache, 'chart:fresh:full');
		expect(freshRec.updatedAt).toBe(oneHourAgo);
		// 再次命中 3 天前那条:刚触摸过(<24h)→ 不再写
		const touched = oldRec.updatedAt;
		await getAnalysisSourceContext({ id: 'old', sourceType: 'chart', title: '旧', updatedAt: 'u-old', record: {} });
		await flush();
		expect((await getStoreRecord(AI_ANALYSIS_STORES.contextCache, 'chart:old:full')).updatedAt).toBe(touched);
		await clearStore(AI_ANALYSIS_STORES.contextCache);
	});

	test('未命中(meta 模式纯本地构建)写入后 schedulePruneContextCache 被调用', async ()=>{
		const store = require('../aiAnalysisStore');
		const { getAnalysisSourceContext } = require('../aiAnalysisContext');
		const spy = jest.spyOn(store, 'schedulePruneContextCache');
		await store.clearStore(store.AI_ANALYSIS_STORES.contextCache);
		const ctx = await getAnalysisSourceContext({ id: 'meta-1', sourceType: 'chart', title: '甲', updatedAt: 'u1', record: { name: '甲', birth: '1990-01-01 08:00:00', gender: 1 } }, { mode: 'meta', preferCache: false });
		expect(ctx && typeof ctx.content).toBe('string');
		expect(spy).toHaveBeenCalledTimes(1);
		expect(await store.countStoreRecords(store.AI_ANALYSIS_STORES.contextCache)).toBe(1);
		spy.mockRestore();
		await store.clearStore(store.AI_ANALYSIS_STORES.contextCache);
	});
});

describe('⑤ 开关与调度节律', ()=>{
	test("horosa.perf.contextCachePrune='0' → 不裁(返回 null,310 条原样);开关恢复后首次写与每 8 次写触发", async ()=>{
		const mod = loadStore();
		const { AI_ANALYSIS_STORES, bulkPutStoreRecords, schedulePruneContextCache, countStoreRecords, __resetContextCachePruneForTests } = mod;
		__resetContextCachePruneForTests();
		await bulkPutStoreRecords(AI_ANALYSIS_STORES.contextCache, ctxRows(310, '2026-03-01T00:00:00.000Z', 60000), 'ctx');
		window.localStorage.setItem('horosa.perf.contextCachePrune', '0');
		for(let i = 0; i < 20; i++){
			expect(schedulePruneContextCache()).toBeNull();
		}
		await flush();
		expect(await countStoreRecords(AI_ANALYSIS_STORES.contextCache)).toBe(310);

		window.localStorage.removeItem('horosa.perf.contextCachePrune');
		__resetContextCachePruneForTests();
		const first = schedulePruneContextCache();   // 第 1 次写
		expect(first).toBeTruthy();
		expect(await first).toBe(10);
		expect(await countStoreRecords(AI_ANALYSIS_STORES.contextCache)).toBe(300);
		const fired = [];
		for(let i = 2; i <= 24; i++){
			const r = schedulePruneContextCache();
			if(r){ fired.push(i); }
		}
		expect(fired).toEqual([8, 16, 24]);
		await flush();
		expect(await countStoreRecords(AI_ANALYSIS_STORES.contextCache)).toBe(300);
	});
});
