import { isQuotaError, retryWriteAfterQuotaPurge, corruptRawWriteBlocked, noteStorageSpaceFreed } from './safeStorage';
// deferredStorage.js —— localStorage 延迟落盘(流畅度优化)。
//
// 痛点:排盘完成后同步 JSON.stringify(整盘 1-5MB)+setItem 阻塞主线程 100-300ms,
// 用户此刻的点击/拖拽无响应 = 「卡一下」的主要来源之一。
// 方案:写入移到空闲时段(requestIdleCallback,降级 setTimeout);同 key 合并只落最后一次;
// 序列化也延迟到落盘时执行。调用方必须自带内存态(本仓三处快照/缓存均有),
// 同会话读取走内存,落盘只影响「下次启动」的持久性 —— beforeunload 兜底强制刷盘,
// 正常退出零丢失;强杀进程最多丢最近 ~1s 的缓存写(缓存类数据,可接受)。

const pending = new Map(); // key -> () => string (延迟序列化)
const pendingSnapshot = new Map(); // key -> 内存态快照(可选;落盘即清)
const pendingOnDrop = new Map(); // key -> 这份待落盘被丢弃时的回调(可选;调用方据此撤掉自己的「待落盘」内存态)
let scheduled = false;
let flushBound = false;

function flushAll(){
	scheduled = false;
	if(!pending.size){
		return;
	}
	const entries = Array.from(pending.entries());
	pending.clear();
	pendingSnapshot.clear();
	pendingOnDrop.clear();
	entries.forEach(([key, factory])=>{
		try{
			const text = factory();
			// 没能留档的坏原串(唯一副本)不盖:与同步写同一判据(safeStorage.corruptRawWriteBlocked)
			if(typeof text === 'string' && typeof window !== 'undefined' && window.localStorage && !corruptRawWriteBlocked(key)){
				try{
					window.localStorage.setItem(key, text);
				}catch(e){
					// 配额满 → 与同步写同一阶梯(先清可再生缓存、再清告急面)重试;仍失败静默(内存态仍可用)。
					if(isQuotaError(e)){
						retryWriteAfterQuotaPurge(()=>window.localStorage.setItem(key, text));
					}
				}
			}
		}catch(e){
			// 序列化失败静默:内存态仍可用,与原同步写的容错一致。
		}
	});
}

function schedule(){
	if(scheduled){
		return;
	}
	scheduled = true;
	if(typeof window !== 'undefined'){
		if(!flushBound){
			flushBound = true;
			// 退出前强制刷盘,保证正常关闭零丢失。
			window.addEventListener('beforeunload', flushAll);
			document.addEventListener('visibilitychange', ()=>{
				if(document.visibilityState === 'hidden'){ flushAll(); }
			});
		}
		if(typeof window.requestIdleCallback === 'function'){
			window.requestIdleCallback(flushAll, { timeout: 800 });
			return;
		}
	}
	setTimeout(flushAll, 200);
}

// 延迟写:valueFactory 在空闲时段才被调用(序列化也移出关键路径)。同 key 后写覆盖先写。
// snapshot(可选):本次写入对应的内存态(未序列化对象),供同 key 的「读合并」在落盘前同步读回——
// 调用方「先读 localStorage 再并补丁」时若前一次写尚在 pending,读到的是旧 blob,后写会把先写的键打回旧值。
// opts.onDrop(可选):这份写在落盘前被 dropPendingStorageWrite 丢弃时调用(调用方撤掉自己另记的待落盘态)。
export function scheduleStorageWrite(key, valueFactory, snapshot, opts){
	if(!key || typeof valueFactory !== 'function'){
		return;
	}
	pending.set(key, valueFactory);
	if(snapshot !== undefined){ pendingSnapshot.set(key, snapshot); } else { pendingSnapshot.delete(key); }
	if(opts && typeof opts.onDrop === 'function'){ pendingOnDrop.set(key, opts.onDrop); } else { pendingOnDrop.delete(key); }
	schedule();
}

// 读合并接口:同 key 尚未落盘且写入方给了 snapshot → 返回它(即将落盘的内存态);否则 undefined(按存储为准)。
export function peekPendingStorageValue(key){
	return pendingSnapshot.has(key) ? pendingSnapshot.get(key) : undefined;
}

// 立即刷盘(全量备份导出前 / 测试用):导出读的是存储,还在空闲队列里的最近一次改动要先落盘才进得了包。
export function flushStorageWrites(){
	flushAll();
}

// 丢掉某把键还没落盘的写(全量恢复写这把键之前调):恢复把备份里的值直写进存储,
// 队列里那份是恢复前的内存态 —— 不丢,空闲时 / 关窗前的刷盘会把它写回去、盖掉恢复值。返回是否丢掉了一份。
export function dropPendingStorageWrite(key){
	const had = pending.has(key);
	const onDrop = pendingOnDrop.get(key);
	pending.delete(key);
	pendingSnapshot.delete(key);
	pendingOnDrop.delete(key);
	if(had && onDrop){ try{ onDrop(); }catch(e){ /* 回调失败不影响丢弃 */ } }
	return had;
}

// 是否有这把键还没落盘的写(测试 / 诊断用)
export function hasPendingStorageWrite(key){
	return pending.has(key);
}

// 立即删键:先丢掉这把键还没落盘的写,再从存储删掉。凡对延迟写过的键删键,一律走这里 ——
// 只 removeItem 不丢待写,空闲刷盘 / 关窗前的刷盘会把刚清掉的旧值写回去。返回是否删成(存储不可用 / 抛错 → false)。
export function removeStorageNow(key){
	if(!key){ return false; }
	dropPendingStorageWrite(key);
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			const had = window.localStorage.getItem(key) !== null;
			window.localStorage.removeItem(key);
			if(had){ noteStorageSpaceFreed(); }
			return true;
		}
	}catch(e){ /* 存储不可用:待写已丢,内存态由调用方自清 */ }
	return false;
}
