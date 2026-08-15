// 🛡 安全 localStorage 包装:WKWebView / 私有浏览模式下 localStorage 配额比常规浏览器小很多
// (有的实现仅 ~5MB,iOS 私有模式甚至 0),用户多次升级 / 累积工具状态后 setItem 会抛 QuotaExceededError → 整个组件崩。
//
// 此 util 保证:
//   1) setItem 抛 QuotaExceededError 时,先把白名单内的非关键键清掉再重试一次;再失败就静默返回 false,绝不上抛。
//   2) getItem 抛任何错时返回 null。
//   3) removeItem/clear 抛错时静默。
//   4) 所有 commtools 与 GuaSymDesc 等纯本地存储工具都改用这套 API,根治 prod app(WKWebView)QuotaExceededError → 组件崩页。
import { classifyStorageKey } from './storageKeyRegistry';

// 非关键键白名单(quota 满时可清理重试):工具类临时态,丢了用户重新填即可。
// ⚠ 不含案例/挂载/命盘等核心持久数据,避免误删用户的本命盘库。
const NON_CRITICAL_KEYS = [
	'CalculatorFormula',
	'baziInverse',
	'baziPattern',
	'guaData',
	'commtoolstab',
];

// [S2 单源化] 全仓 quota 判定唯一出处:localcharts/localcases 曾各抄一份(名判多 NS_ERROR、
// code 判带 Number 强转),三份漂移。此处取三家并集(严格超集,多判 quota 只多走一次清理重试,无害)。
export function isQuotaError(e){
	if(!e) return false;
	if(e.name === 'QuotaExceededError') return true;
	if(e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true; // Firefox 抛错名(twin 版曾有)
	const code = Number(e.code || 0); // twin 版曾 Number 强转:字符串 '22' 也认
	if(code === 22) return true; // legacy DOMException code
	if(code === 1014) return true; // Firefox NS_ERROR_DOM_QUOTA_REACHED
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

// [S3 两档清理面] 配额告急专用(仅「写入撞配额」的重试路径用):一档可再生缓存全清 +
// 二档 AI 快照(astro 单例 + module.* 前缀)。AI 快照重开对应技法页即可重建,属可牺牲缓存,
// 但**不并入 RECOVERABLE** —— TechniqueErrorBoundary「一键清理缓存并恢复」按钮走
// clearRecoverableCaches,不应顺手删掉当前挂载快照(两档语义:一档随时可清,二档仅告急清)。
// 🔴 字面量必须与 astroAiSnapshot.ASTRO_AI_SNAPSHOT_KEY / moduleAiSnapshot 的前缀逐字一致;
// safeStorage 是叶子 util 不可反向 import 重件快照模块,由 storageQuotaGuard 哨兵测试钉死。
const QUOTA_EMERGENCY_PREFIXES = [
	'horosa.ai.snapshot.astro.v1',
	'horosa.ai.snapshot.module.v1.',
];

export function purgeQuotaEmergency(){
	let cleared = clearRecoverableCaches();
	try{
		if(typeof window === 'undefined' || !window.localStorage) return cleared;
		const doomed = [];
		for(let i = 0; i < window.localStorage.length; i++){
			const k = window.localStorage.key(i);
			if(k && QUOTA_EMERGENCY_PREFIXES.some((p)=>k.indexOf(p) === 0)){
				doomed.push(k);
			}
		}
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

// [V5-C3] 写入前置闸(Confluent「先登记后写入」范式):未登记键在 jest 环境直接 throw ——
// 新键写第一行代码、第一个测试就炸,比穷举哨兵的事后扫描更早一层;dev 醒目告警(不炸功能);
// prod 静默(绝不影响用户,运行时兜底=collectBackupKeys 未登记键默认带走)。
function guardRegisteredKey(key){
	if(classifyStorageKey(key)){
		return;
	}
	const env = typeof process !== 'undefined' && process.env ? process.env.NODE_ENV : '';
	if(env === 'test'){
		throw new Error(`[storageKeyRegistry] 未登记存储键:${key} —— 先到 storageKeyRegistry.js 分类登记。kind 决策树:用户亲手创建的内容→user-data;设置/偏好→settings;可再生缓存→cache;设备绑定(迁移标志/窗口尺寸/性能旗标)→device-local。标错 cache=用户数据被排除备份外(丢数据),拿不准就标 settings(多带无害)。详见 docs/DATA_MANAGEMENT_PLAYBOOK.md §2`);
	}
	if(env === 'development' && typeof console !== 'undefined' && console.error){
		console.error(`[storageKeyRegistry] 未登记存储键:${key}(不入备份面)——去 storageKeyRegistry.js 登记,kind 决策树见文件头`);
	}
}

export function safeLocalStorageSet(key, value){
	guardRegisteredKey(key);
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
