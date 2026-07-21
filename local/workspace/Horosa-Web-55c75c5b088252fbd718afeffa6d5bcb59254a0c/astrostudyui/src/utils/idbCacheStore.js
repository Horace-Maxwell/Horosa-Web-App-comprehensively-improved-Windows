// idbCacheStore.js —— 派生缓存的 IndexedDB 后端(存储分层治理,FL 级事故后建)。
//
// 背景:localStorage 每 origin 仅 ~5MB 且配额是 origin 级——任何一个无上限缓存键写满后,
// 全 App 所有 setItem 一起抛 QuotaExceededError(黄历缓存 3.6MB 实爆,页页炸错误卡)。
// 治理原则:localStorage 只放微型同步 KV(设置/标志);一切「可再生的派生缓存」住这里
// (IndexedDB 配额为磁盘量级,异步不占主线程),并自带字节预算+LRU,防磁盘无限膨胀。
//
// 语义保证(调用方可依赖):
//   1) 所有 API 永不 throw、永不 reject——IndexedDB 不可用(私有模式/损坏/被禁)时自动降级
//      为纯内存(会话级),再失败=no-op;缓存 miss 只意味着多算一次,零正确性影响。
//   2) 写入合并节流(同 key 只落最后一次,空闲时段批量落盘),读路径由调用方自持内存镜像。
//   3) 字节预算(默认 8MB)按最近写入时间 LRU 逐出,预算元数据随行存储。

const DB_NAME = 'horosa-cache-v1';
const DB_VERSION = 1;
const STORE = 'kv';
// [A1] 8→32MB:L3 网络结果缓存(net. 前缀)入驻共享店;IndexedDB 是磁盘量级配额,
// 32MB 仍九牛一毛;LRU 逐出保护不变,既有住户(nongli/节气等)只多不少。
const TOTAL_BUDGET_BYTES = 32 * 1024 * 1024;

let dbPromise = null;
let idbBroken = false; // 一旦 open/事务连续失败,本会话降级纯内存,不再反复尝试

function idbSupported(){
	try{
		return typeof window !== 'undefined' && !!window.indexedDB;
	}catch(e){
		return false;
	}
}

function openDb(){
	if(idbBroken || !idbSupported()){
		return Promise.resolve(null);
	}
	if(dbPromise){
		return dbPromise;
	}
	dbPromise = new Promise((resolve)=>{
		let req;
		try{
			req = window.indexedDB.open(DB_NAME, DB_VERSION);
		}catch(e){
			idbBroken = true;
			resolve(null);
			return;
		}
		req.onupgradeneeded = ()=>{
			try{
				const db = req.result;
				if(!db.objectStoreNames.contains(STORE)){
					const store = db.createObjectStore(STORE, { keyPath: 'key' });
					store.createIndex('ts', 'ts');
				}
			}catch(e){ /* 建表失败走 onerror */ }
		};
		req.onsuccess = ()=>{
			const db = req.result;
			// 数据库被外部删除/版本冲突时自动失效,下次重开
			db.onversionchange = ()=>{ try{ db.close(); }catch(e){} dbPromise = null; };
			resolve(db);
		};
		req.onerror = ()=>{ idbBroken = true; resolve(null); };
		req.onblocked = ()=>{ resolve(null); };
	});
	return dbPromise;
}

function reqAsPromise(req){
	return new Promise((resolve)=>{
		req.onsuccess = ()=>resolve(req.result);
		req.onerror = ()=>resolve(undefined);
	});
}

// 读取指定前缀的全部条目 → Map<key, valueStr>。用于启动预载内存镜像;失败=空 Map。
export function idbGetAllByPrefix(prefix){
	return openDb().then((db)=>{
		if(!db){ return new Map(); }
		return new Promise((resolve)=>{
			const out = new Map();
			let tx;
			try{
				tx = db.transaction(STORE, 'readonly');
			}catch(e){
				resolve(out);
				return;
			}
			tx.onerror = ()=>resolve(out);
			const range = window.IDBKeyRange.bound(prefix, prefix + '￿');
			const cursorReq = tx.objectStore(STORE).openCursor(range);
			cursorReq.onsuccess = ()=>{
				const cursor = cursorReq.result;
				if(cursor){
					const rec = cursor.value;
					if(rec && typeof rec.v === 'string'){
						out.set(rec.key, rec.v);
					}
					cursor.continue();
				}else{
					resolve(out);
				}
			};
			cursorReq.onerror = ()=>resolve(out);
		});
	}).catch(()=>new Map());
}

// —— 写入合并节流(与 deferredStorage 同款语义,后端换 IndexedDB) ——
const pendingWrites = new Map(); // key -> () => string
let writeScheduled = false;
let flushBound = false;

function flushPendingToIdb(){
	writeScheduled = false;
	if(!pendingWrites.size){
		return;
	}
	const entries = Array.from(pendingWrites.entries());
	pendingWrites.clear();
	openDb().then((db)=>{
		if(!db){ return; }
		let tx;
		try{
			tx = db.transaction(STORE, 'readwrite');
		}catch(e){
			return;
		}
		tx.onerror = ()=>{};
		const store = tx.objectStore(STORE);
		const now = Date.now();
		entries.forEach(([key, factory])=>{
			try{
				const text = factory();
				if(typeof text !== 'string'){ return; }
				store.put({ key, v: text, ts: now, bytes: text.length });
			}catch(e){ /* 序列化失败静默,内存态仍可用 */ }
		});
		tx.oncomplete = ()=>{ enforceBudget(db); };
	}).catch(()=>{});
}

function scheduleFlush(){
	if(writeScheduled){
		return;
	}
	writeScheduled = true;
	if(typeof window !== 'undefined'){
		if(!flushBound){
			flushBound = true;
			window.addEventListener('beforeunload', flushPendingToIdb);
			document.addEventListener('visibilitychange', ()=>{
				if(document.visibilityState === 'hidden'){ flushPendingToIdb(); }
			});
		}
		if(typeof window.requestIdleCallback === 'function'){
			window.requestIdleCallback(flushPendingToIdb, { timeout: 800 });
			return;
		}
	}
	setTimeout(flushPendingToIdb, 200);
}

// 延迟写(valueFactory 空闲时段才执行,同 key 后写覆盖先写)。
export function idbScheduleWrite(key, valueFactory){
	if(!key || typeof valueFactory !== 'function'){
		return;
	}
	pendingWrites.set(key, valueFactory);
	scheduleFlush();
}

// 字节预算:总量超预算时按 ts 从最旧开始逐出(缓存类数据,丢=重算)。
let budgetCheckRunning = false;
function enforceBudget(db){
	if(budgetCheckRunning || !db){
		return;
	}
	budgetCheckRunning = true;
	try{
		const tx = db.transaction(STORE, 'readonly');
		const rows = [];
		const cur = tx.objectStore(STORE).openCursor();
		cur.onsuccess = ()=>{
			const c = cur.result;
			if(c){
				rows.push({ key: c.value.key, ts: c.value.ts || 0, bytes: c.value.bytes || 0 });
				c.continue();
				return;
			}
			let total = rows.reduce((s, r)=>s + r.bytes, 0);
			if(total <= TOTAL_BUDGET_BYTES){
				budgetCheckRunning = false;
				return;
			}
			rows.sort((a, b)=>a.ts - b.ts);
			const doomed = [];
			for(let i = 0; i < rows.length && total > TOTAL_BUDGET_BYTES; i++){
				doomed.push(rows[i].key);
				total -= rows[i].bytes;
			}
			try{
				const dtx = db.transaction(STORE, 'readwrite');
				const st = dtx.objectStore(STORE);
				doomed.forEach((k)=>{ try{ st.delete(k); }catch(e){} });
				dtx.oncomplete = ()=>{ budgetCheckRunning = false; };
				dtx.onerror = ()=>{ budgetCheckRunning = false; };
			}catch(e){
				budgetCheckRunning = false;
			}
		};
		cur.onerror = ()=>{ budgetCheckRunning = false; };
		tx.onerror = ()=>{ budgetCheckRunning = false; };
	}catch(e){
		budgetCheckRunning = false;
	}
}

// 按前缀清空(错误卡「一键清理缓存」用)。resolve 恒 true/false,永不 reject。
export function idbClearByPrefix(prefix){
	return openDb().then((db)=>{
		if(!db){ return false; }
		return new Promise((resolve)=>{
			let tx;
			try{
				tx = db.transaction(STORE, 'readwrite');
			}catch(e){
				resolve(false);
				return;
			}
			tx.onerror = ()=>resolve(false);
			tx.oncomplete = ()=>resolve(true);
			const range = window.IDBKeyRange.bound(prefix, prefix + '￿');
			try{
				tx.objectStore(STORE).delete(range);
			}catch(e){
				resolve(false);
			}
		});
	}).catch(()=>false);
}

// 单键读(BookReader 等按需读场景)。miss/失败=null。
export function idbGet(key){
	return openDb().then((db)=>{
		if(!db){ return null; }
		let tx;
		try{
			tx = db.transaction(STORE, 'readonly');
		}catch(e){
			return null;
		}
		return reqAsPromise(tx.objectStore(STORE).get(key)).then((rec)=>{
			return rec && typeof rec.v === 'string' ? rec.v : null;
		});
	}).catch(()=>null);
}

// 测试钩子:等待所有挂起写入落盘(jest 用)。
export function idbFlushForTest(){
	flushPendingToIdb();
	return openDb().then(()=>{});
}
