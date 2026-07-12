// 🛡 安全 localStorage 包装:WKWebView / 私有浏览模式下 localStorage 配额比常规浏览器小很多
// (有的实现仅 ~5MB,iOS 私有模式甚至 0),用户多次升级 / 累积工具状态后 setItem 会抛 QuotaExceededError → 整个组件崩。
//
// 此 util 保证:
//   1) setItem 抛 QuotaExceededError 时,先把白名单内的非关键键清掉再重试一次;再失败就静默返回 false,绝不上抛。
//   2) getItem 抛任何错时返回 null。
//   3) removeItem/clear 抛错时静默。
//   4) 所有 commtools 与 GuaSymDesc 等纯本地存储工具都改用这套 API,根治 prod app(WKWebView)QuotaExceededError → 组件崩页。

// 非关键键白名单(quota 满时可清理重试):工具类临时态,丢了用户重新填即可。
// ⚠ 不含案例/挂载/命盘等核心持久数据,避免误删用户的本命盘库。
const NON_CRITICAL_KEYS = [
	'CalculatorFormula',
	'baziInverse',
	'baziPattern',
	'guaData',
	'commtoolstab',
];

export function isQuotaError(e){
	if(!e) return false;
	if(e.name === 'QuotaExceededError') return true;
	if(e.code === 22) return true; // legacy DOMException code
	if(e.code === 1014) return true; // Firefox NS_ERROR_DOM_QUOTA_REACHED
	const msg = (e.message || '').toLowerCase();
	return msg.indexOf('quota') >= 0 || msg.indexOf('exceeded') >= 0;
}

// 可再生缓存前缀(配额满/自愈清理时可整体清除,清了只是重算,零用户数据损失)。
// ⚠ 绝不含 localCases/localCharts/挂载设置等用户数据前缀。
const RECOVERABLE_CACHE_PREFIXES = [
	'horosa.localcalc.',
	'horosa.reader.chapter.',
];

// 配额自愈单点:清 localStorage 里全部可再生缓存键 + 白名单非关键键。
// TechniqueErrorBoundary 的「一键清理缓存」与 quota 重试路径共用,返回清掉的键数。
export function clearRecoverableCaches(){
	let cleared = 0;
	try{
		if(typeof window === 'undefined' || !window.localStorage) return 0;
		const doomed = [];
		for(let i = 0; i < window.localStorage.length; i++){
			const k = window.localStorage.key(i);
			if(k && RECOVERABLE_CACHE_PREFIXES.some((p)=>k.indexOf(p) === 0)){
				doomed.push(k);
			}
		}
		NON_CRITICAL_KEYS.forEach((k)=>doomed.push(k));
		doomed.forEach((k)=>{
			try{ window.localStorage.removeItem(k); cleared++; }catch(e){ /* 单键失败继续 */ }
		});
	}catch(e){ /* 静默:自愈尽力而为 */ }
	return cleared;
}

export function safeLocalStorageGet(key){
	try{
		if(typeof window === 'undefined' || !window.localStorage) return null;
		return window.localStorage.getItem(key);
	}catch(e){
		return null;
	}
}

export function safeLocalStorageSet(key, value){
	try{
		if(typeof window === 'undefined' || !window.localStorage) return false;
		window.localStorage.setItem(key, value);
		return true;
	}catch(e){
		if(!isQuotaError(e)){
			return false;
		}
		// 配额满 → 清掉全部可再生缓存+白名单非关键键(除当前要写的 key)再重试一次
		try{
			clearRecoverableCaches();
			if(NON_CRITICAL_KEYS.indexOf(key) >= 0){
				// 当前 key 恰在白名单里被清了也没关系,下面立即重写。
			}
			window.localStorage.setItem(key, value);
			return true;
		}catch(e2){
			return false;
		}
	}
}

export function safeLocalStorageRemove(key){
	try{
		if(typeof window === 'undefined' || !window.localStorage) return;
		window.localStorage.removeItem(key);
	}catch(e){
		// 静默
	}
}

export function safeJsonParseFromStorage(key){
	const raw = safeLocalStorageGet(key);
	if(!raw){ return null; }
	try{
		return JSON.parse(raw);
	}catch(e){
		// JSON 损坏 → 自愈清除
		safeLocalStorageRemove(key);
		return null;
	}
}

export function safeJsonStringifyToStorage(key, obj){
	try{
		return safeLocalStorageSet(key, JSON.stringify(obj));
	}catch(e){
		// stringify 失败(循环引用等)→ 静默
		return false;
	}
}
