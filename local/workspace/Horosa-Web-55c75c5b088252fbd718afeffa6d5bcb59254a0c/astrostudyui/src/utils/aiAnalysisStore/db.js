// 开库(退避重试、内存回退合并)与存储健康(降级 / 恢复事件)
// 从 aiAnalysisStore.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { clonePlain, nowIso, canUseIndexedDb } from './records';
import { migrateRecord, applySchemaUpgrade } from './migrate';
import { MEMORY_DB, DB_NAME, AI_ANALYSIS_DB_VERSION } from './schema';   // 库版本取对外常量(DB_VERSION 只在 schema 里定)

let openDbPromise = null;
let upgradeBlockedWarned = false;

// 打开失败(非版本问题)后的退避状态:这次及退避期内的访问走内存回退,过了退避期的下一次访问重新打开;
// 失败次数越多退避越长(0.5s 起翻倍,封顶 30s)。重新打开成功 → 先把内存回退期间新建的条目并回库里,再交出句柄。
const OPEN_DB_BACKOFF = { failures: 0, until: 0 };
const OPEN_DB_RETRY_BASE_MS = 500;
const OPEN_DB_RETRY_MAX_MS = 30000;

// 内存回退期间经 mergeStoreRecord 写下的单例文档:记下合并函数,库重开并回时对库里现存那份重放(见 mergeStoreRecord)。
// storeName -> Map(id -> [merger…]);只在「有 IndexedDB、只是这次没打开」时记(没有 IndexedDB 的环境内存就是唯一存储)
const PENDING_MERGES = new Map();
const PENDING_MERGES_PER_ID_MAX = 32;
export function rememberPendingMerge(storeName, id, merger){
	if(!PENDING_MERGES.has(storeName)){ PENDING_MERGES.set(storeName, new Map()); }
	const byId = PENDING_MERGES.get(storeName);
	const list = byId.get(id) || [];
	list.push(merger);
	while(list.length > PENDING_MERGES_PER_ID_MAX){ list.shift(); }
	byId.set(id, list);
}
function pendingMergesOf(storeName, id){
	const byId = PENDING_MERGES.get(storeName);
	return byId ? (byId.get(id) || null) : null;
}
export function dropPendingMerges(storeName, id){
	const byId = PENDING_MERGES.get(storeName);
	if(!byId){ return; }
	if(id === undefined){ PENDING_MERGES.delete(storeName); return; }
	byId.delete(id);
}
// 把一串合并函数依次作用在 cur 上(cur 为 null = 库里没有),回最终版本;某个回 null = 这一步不写
export function applyMergers(storeName, id, cur, mergers){
	let out = cur;
	mergers.forEach((merger)=>{
		const next = merger(out ? clonePlain(out) : null);
		if(next && typeof next === 'object'){
			out = migrateRecord(storeName, { ...next, id, updatedAt: next.updatedAt || nowIso() });
		}
	});
	return out;
}

// 内存回退期间写下的条目并回刚打开的库:普通写入只补库里没有的 id(库里那份是之前真落盘的;回退期看不到库里的内容,
// 同 id 的多半是读不到库时重建的缺省值,不拿它盖真数据);经 mergeStoreRecord 写的单例文档按记下的合并函数
// 对库里现存那份重放(回退期改的那几项进库、库里回退期没读到的照样留着)。并回成功的店清掉内存那份;并不进的留在内存、不报错
function settleMemoryFallbackInto(db){
	const names = Array.from(MEMORY_DB.keys()).filter((n)=>{
		const m = MEMORY_DB.get(n);
		return m && m.size && db.objectStoreNames.contains(n);
	});
	return Promise.all(names.map((storeName)=>new Promise((resolve)=>{
		const mem = MEMORY_DB.get(storeName);
		const items = Array.from(mem.values());
		let tx = null;
		try{ tx = db.transaction(storeName, 'readwrite'); }catch(e){ resolve(); return; }
		const store = tx.objectStore(storeName);
		const swallow = (evt)=>{ if(evt && typeof evt.preventDefault === 'function'){ evt.preventDefault(); } if(evt && typeof evt.stopPropagation === 'function'){ evt.stopPropagation(); } };
		items.forEach((item)=>{
			try{
				const mergers = item && item.id !== undefined ? pendingMergesOf(storeName, item.id) : null;
				if(mergers && mergers.length){
					const getReq = store.get(item.id);
					getReq.onsuccess = ()=>{
						let rec = null;
						try{ rec = applyMergers(storeName, item.id, getReq.result ? migrateRecord(storeName, getReq.result) : null, mergers); }catch(e){ rec = null; }
						if(rec){
							try{ const putReq = store.put(rec); putReq.onerror = swallow; }catch(e){ /* 形状不对:跳过 */ }
						}
					};
					getReq.onerror = swallow;
					return;
				}
				const req = store.add(item);
				req.onerror = swallow;
			}catch(e){ /* 这一条形状不对:跳过 */ }
		});
		tx.oncomplete = ()=>{
			mem.clear();
			dropPendingMerges(storeName);
			try{ notifyStoreChanged(storeName, null, 'bulk', { ids: items.map((x)=>x && x.id), count: items.length }); }catch(e){ /* noop */ }
			resolve();
		};
		tx.onerror = ()=>resolve();
		tx.onabort = ()=>resolve();
	})));
}

export function openDb(){
	if(!canUseIndexedDb()){
		return Promise.resolve(null);
	}
	if(openDbPromise){
		return openDbPromise;
	}
	if(Date.now() < OPEN_DB_BACKOFF.until){
		return Promise.resolve(null);   // 刚打开失败、还在退避期:本次走内存回退
	}
	openDbPromise = new Promise((resolve, reject)=>{
		const req = window.indexedDB.open(DB_NAME, AI_ANALYSIS_DB_VERSION);
		req.onupgradeneeded = ()=>{
			applySchemaUpgrade(req.result, req.transaction);
		};
		req.onblocked = ()=>{
			// 另一实例/页签仍握着旧版本连接,升版事务在等它关闭;只提示一次,不刷屏
			if(!upgradeBlockedWarned){
				upgradeBlockedWarned = true;
				console.warn('[aiAnalysisStore] IndexedDB 升版被旧连接阻塞,等待其关闭后继续');
			}
		};
		req.onsuccess = ()=>{
			const db = req.result;
			// 别处发起更高版本升级时本连接主动让位并清掉缓存句柄,下次访问重新 open(失败则落内存回退)
			db.onversionchange = ()=>{
				db.close();
				openDbPromise = null;
			};
			resolve(db);
		};
		req.onerror = ()=>{
			reject(req.error);
		};
	});
	openDbPromise = openDbPromise.then(async (db)=>{
		if(OPEN_DB_BACKOFF.failures > 0){
			// 之前打开失败、这次打开成功:内存回退期间新建的先并回库里,再解除健康态
			try{ await settleMemoryFallbackInto(db); }catch(e){ /* 并不回:留在内存 */ }
			OPEN_DB_BACKOFF.failures = 0;
			OPEN_DB_BACKOFF.until = 0;
			markStoreRecovered();
		}
		return db;
	}, (err)=>{
		// 打不开 IndexedDB:记健康态 + 派 DOM 事件,主页顶部横幅告知。
		// 库被更新版本升过(VersionError)→ 重试无益,本次运行钉死在内存模式;
		// 其它失败(进程偶发 UnknownError / 磁盘瞬时满 / 开机抢锁)→ 不钉死:本次走内存回退,退避后下一次访问重新打开
		// (此前一次失败就整次会话锁成内存模式,新建的对话 / 报告退出即丢)。
		markStoreDegraded(err);
		if(err && err.name === 'VersionError'){
			openDbPromise = Promise.resolve(null);
			return null;
		}
		OPEN_DB_BACKOFF.failures += 1;
		OPEN_DB_BACKOFF.until = Date.now() + Math.min(OPEN_DB_RETRY_MAX_MS, OPEN_DB_RETRY_BASE_MS * (2 ** (OPEN_DB_BACKOFF.failures - 1)));
		openDbPromise = null;
		return null;
	});
	return openDbPromise;
}

export const AI_STORE_DEGRADED_EVENT = 'horosa:ai-store-degraded';
// retrying = 打开失败但还会重试(不是版本问题);恢复后 degraded 回 false 并同样派事件(横幅据此收起)
const STORE_HEALTH = { degraded: false, reason: '', message: '', at: '', retrying: false };
function fireStoreHealth(){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(AI_STORE_DEGRADED_EVENT, { detail: { ...STORE_HEALTH } }));
		}
	}catch(_e){ /* noop */ }
}
function markStoreDegraded(err){
	const name = err && err.name ? `${err.name}` : '';
	const wasDegraded = STORE_HEALTH.degraded;
	const prevReason = STORE_HEALTH.reason;
	STORE_HEALTH.degraded = true;
	STORE_HEALTH.reason = name === 'VersionError' ? 'version' : 'open-failed';
	STORE_HEALTH.retrying = STORE_HEALTH.reason !== 'version';
	STORE_HEALTH.message = err && err.message ? `${err.message}` : name || 'IndexedDB open failed';
	STORE_HEALTH.at = nowIso();
	if(!wasDegraded || prevReason !== STORE_HEALTH.reason){ fireStoreHealth(); }   // 退避重试一再失败不刷屏
}
// 库在内存回退之后重新打开(内存期的条目已并回):页面在回退期读到的列表 / 单例是空的、不是库里的真值,
// 收到这个事件要重读一遍(并把内存态按各自的合并规则并进去),不能拿回退期读到的那份当底版整份写回
export const AI_STORE_RECOVERED_EVENT = 'horosa:ai-store-recovered';
function markStoreRecovered(){
	STORE_HEALTH.degraded = false;
	STORE_HEALTH.reason = '';
	STORE_HEALTH.message = '';
	STORE_HEALTH.retrying = false;
	STORE_HEALTH.at = nowIso();
	fireStoreHealth();
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(AI_STORE_RECOVERED_EVENT, { detail: { at: STORE_HEALTH.at } }));
		}
	}catch(_e){ /* noop */ }
}
// 有破坏性语义的整体操作(恢复工作区 / 整店清空)在库读不开时不许落到内存里冒充成功:
// 内存里清空、写入只在这次运行有效,库里的旧数据原样留着,重开后以为恢复了、其实没有。
export const AI_STORE_UNAVAILABLE_ERROR = 'ai-store.unavailable';
export const AI_STORE_UNAVAILABLE_MESSAGE = 'AI 数据库暂时打不开,稍后再试 —— 现有数据未改动';
function storeUnavailableError(){
	const e = new Error(AI_STORE_UNAVAILABLE_ERROR);
	e.code = AI_STORE_UNAVAILABLE_ERROR;
	return e;
}
// 先试开一次库(过了退避期会真去开);仍是内存回退(健康态 degraded)→ 抛 ai-store.unavailable
export async function assertAiStoreDurable(){
	if(!canUseIndexedDb()){ return true; }   // 没有 IndexedDB 的环境:内存就是唯一存储,不算降级
	const h = await probeAiStoreHealth();
	if(h && h.degraded){ throw storeUnavailableError(); }
	return true;
}
export function getAiStoreHealth(){ return { ...STORE_HEALTH }; }
// 先试开一次库再报健康态(备份 / 恢复写入前用:健康态只在第一次真访问库时才定下来,没访问过时读到的总是「健康」)
export async function probeAiStoreHealth(){
	try{ await openDb(); }catch(_e){ /* openDb 失败已记健康态 */ }
	return getAiStoreHealth();
}
export function __resetStoreHealthForTests(){ PENDING_MERGES.clear(); STORE_HEALTH.degraded = false; STORE_HEALTH.reason = ''; STORE_HEALTH.message = ''; STORE_HEALTH.at = ''; STORE_HEALTH.retrying = false; OPEN_DB_BACKOFF.failures = 0; OPEN_DB_BACKOFF.until = 0; }

// 库写入后的 DOM 事件(零 import 消费:本机 MCP 桥据 templates 变更推 prompts/list_changed);派发永不抛、无 DOM 环境静默
export const AI_STORE_CHANGED_EVENT = 'horosa:ai-store-changed';
// 批量写(bulkPut)/整店清空(clear)/批量删(deleteMany)/条件删(deleteWhere)各派**一次**带 ids/count 的事件:
// 此前 bulkPut 与 clear 不派(工作区恢复 = clear+bulkPut ⇒ 外部客户端 prompts 列表陈旧)、deleteMany 逐 id 派 N 次。
export function notifyStoreChanged(store, id, op, extra){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(AI_STORE_CHANGED_EVENT, { detail: { store: `${store}`, id, op, ...(extra && typeof extra === 'object' ? extra : {}) } }));
		}
	}catch(e){ /* noop */ }
}
