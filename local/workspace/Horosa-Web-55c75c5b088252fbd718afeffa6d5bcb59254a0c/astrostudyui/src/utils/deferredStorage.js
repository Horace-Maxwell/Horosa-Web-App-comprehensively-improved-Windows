import { isQuotaError, clearRecoverableCaches } from './safeStorage';
// deferredStorage.js —— localStorage 延迟落盘(流畅度优化)。
//
// 痛点:排盘完成后同步 JSON.stringify(整盘 1-5MB)+setItem 阻塞主线程 100-300ms,
// 用户此刻的点击/拖拽无响应 = 「卡一下」的主要来源之一。
// 方案:写入移到空闲时段(requestIdleCallback,降级 setTimeout);同 key 合并只落最后一次;
// 序列化也延迟到落盘时执行。调用方必须自带内存态(本仓三处快照/缓存均有),
// 同会话读取走内存,落盘只影响「下次启动」的持久性 —— beforeunload 兜底强制刷盘,
// 正常退出零丢失;强杀进程最多丢最近 ~1s 的缓存写(缓存类数据,可接受)。

const pending = new Map(); // key -> () => string (延迟序列化)
let scheduled = false;
let flushBound = false;

function flushAll(){
	scheduled = false;
	if(!pending.size){
		return;
	}
	const entries = Array.from(pending.entries());
	pending.clear();
	entries.forEach(([key, factory])=>{
		try{
			const text = factory();
			if(typeof text === 'string' && typeof window !== 'undefined' && window.localStorage){
				try{
					window.localStorage.setItem(key, text);
				}catch(e){
					// 配额满 → 清可再生缓存后重试一次;仍失败静默(内存态仍可用)。
					if(isQuotaError(e)){
						try{ clearRecoverableCaches(); window.localStorage.setItem(key, text); }catch(e2){ /* 静默 */ }
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
export function scheduleStorageWrite(key, valueFactory){
	if(!key || typeof valueFactory !== 'function'){
		return;
	}
	pending.set(key, valueFactory);
	schedule();
}

// 立即刷盘(测试/特殊场景用)。
export function flushStorageWrites(){
	flushAll();
}
