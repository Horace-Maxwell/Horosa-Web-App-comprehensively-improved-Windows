// 🛡 安全 localStorage 包装:WKWebView / 私有浏览模式下 localStorage 配额比常规浏览器小很多
// (有的实现仅 ~5MB,iOS 私有模式甚至 0),用户多次升级 / 累积工具状态后 setItem 会抛 QuotaExceededError → 整个组件崩。
//
// 此 util 保证:
//   1) setItem 抛 QuotaExceededError 时,按注册表推导的两档清理面逐档清掉再重试;仍失败就静默返回 false,绝不上抛。
//   2) getItem 抛任何错时返回 null。
//   3) removeItem/clear 抛错时静默。
//   4) 所有 commtools 与 GuaSymDesc 等纯本地存储工具都改用这套 API,根治 prod app(WKWebView)QuotaExceededError → 组件崩页。
import { classifyStorageKey } from './storageKeyRegistry';

// 没能留档的坏用户数据键(本次运行;说明见 corruptRawWriteBlocked):键 → { fp: 原串指纹, gen: 那次尝试时的腾空间代次, at: 时刻 }
const corruptUnarchivedKeys = new Map();
// 「腾出了空间」代次:删键 / 告急清理清掉了东西 / 记录库写得比原来短时 +1。没能留档的坏原串只在代次变了
// (或隔了一段时间,覆盖别的窗口腾出的空间)才再试一次留档 —— 留档要和原串一样大的空闲,空间没变时必然失败。
let storageFreedGen = 0;
export function noteStorageSpaceFreed(){ storageFreedGen += 1; }
export const CORRUPT_ARCHIVE_RETRY_MIN_MS = 60 * 1000;

// 全仓 quota 判定唯一出处:localcharts/localcases 曾各抄一份(名判多 NS_ERROR、
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

// 存储空间告急时可清的两档 —— 由存储键注册表推导(单一真值源),不在这里另抄清单:
//   第一档(随时可清):注册表 kind 'cache' 的 localStorage 条目(标了 quotaClearable: false 的除外,
//     如多窗口租约 / 待落盘标记);写入撞配额先清它,错误边界「一键清理缓存并恢复」也清它。
//   第二档(只在告急时清):注册表标 quotaClearable: 'emergency' 的条目(AI 挂载快照:可再生、但正挂着;
//     工具箱表单态:设置类,丢了只要重填一次)。第一档清完仍写不进才清。
// 此前两档是手抄的前缀 / 键名表:注册表新登记的缓存(卦辞缓存)从没进过清单,写满后任何清理都腾不出它占的空间。
// sessionStorage 条目(storage: 'session')不在 localStorage 里,不参与。
export const QUOTA_TIER_RECOVERABLE = 'recoverable';
export const QUOTA_TIER_EMERGENCY = 'emergency';

// 一个注册表条目在告急清理里属哪一档(null = 不许清)。纯函数,合同测试据此逐条核对注册表。
export function quotaClearTier(entry){
	if(!entry || entry.storage === 'session' || entry.storage === 'event'){ return null; }
	if(entry.quotaClearable === false){ return null; }
	if(entry.quotaClearable === 'emergency'){ return QUOTA_TIER_EMERGENCY; }
	if(entry.kind === 'cache'){ return QUOTA_TIER_RECOVERABLE; }
	return null;
}

function clearKeysOfTiers(tiers){
	let cleared = 0;
	try{
		if(typeof window === 'undefined' || !window.localStorage) return 0;
		const doomed = [];
		for(let i = 0; i < window.localStorage.length; i++){
			const k = window.localStorage.key(i);
			// 按注册表的匹配规则逐键判(精确键优先于前缀:'ziweiSessionTables' 是缓存,同前缀的紫微设置不是)
			if(k && tiers.indexOf(quotaClearTier(classifyStorageKey(k))) >= 0){
				doomed.push(k);
			}
		}
		doomed.forEach((k)=>{
			try{ window.localStorage.removeItem(k); cleared++; }catch(e){ /* 单键失败继续 */ }
		});
	}catch(e){ /* 静默:自愈尽力而为 */ }
	if(cleared){ noteStorageSpaceFreed(); }
	return cleared;
}

// 只为一次写入腾空间、写不进就原样放回:先记下两档里现有的键值,清掉、写;还写不进 → 把清掉的写回去。
// 留档这类「写不进也无所谓、但不该连带别的」的写入用它(此前留档失败照样清掉告急档,每读一次坏键就清一次 AI 挂载快照)。
function writeWithReversiblePurge(write){
	let ls = null;
	try{ ls = typeof window !== 'undefined' ? window.localStorage : null; }catch(e){ ls = null; }
	if(!ls){ return false; }
	const saved = [];
	try{
		for(let i = 0; i < ls.length; i++){
			const k = ls.key(i);
			if(k && quotaClearTier(classifyStorageKey(k))){ saved.push([k, ls.getItem(k)]); }
		}
	}catch(e){ return false; }
	saved.forEach(([k])=>{ try{ ls.removeItem(k); }catch(e){ /* 单键失败继续 */ } });
	try{
		write();
		if(saved.length){ noteStorageSpaceFreed(); }
		return true;
	}catch(e){
		saved.forEach(([k, v])=>{ try{ if(typeof v === 'string'){ ls.setItem(k, v); } }catch(e2){ /* 放不回:可再生内容,尽力而为 */ } });
		return false;
	}
}

// 第一档:清 localStorage 里全部可再生缓存。TechniqueErrorBoundary 的「一键清理缓存」与写入重试共用,返回清掉的键数。
export function clearRecoverableCaches(){
	return clearKeysOfTiers([QUOTA_TIER_RECOVERABLE]);
}

// 告急:两档全清(写入撞配额、第一档清完仍写不进时;记录库内核写满时直接用它)。
export function purgeQuotaEmergency(){
	return clearKeysOfTiers([QUOTA_TIER_RECOVERABLE, QUOTA_TIER_EMERGENCY]);
}

// 撞配额后的重试阶梯(单源;safeLocalStorageSet 与延迟落盘共用):先清第一档重试,还写不进再清第二档重试。
// write() 抛错 = 没写进。返回是否写成。
export function retryWriteAfterQuotaPurge(write){
	try{
		clearRecoverableCaches();
		write();
		return true;
	}catch(e){
		if(!isQuotaError(e)){ return false; }
	}
	try{
		purgeQuotaEmergency();
		write();
		return true;
	}catch(e2){
		return false;
	}
}

// 取 localStorage 句柄:无 window / 无存储 / 访问即抛(隐私模式)→ null。请求层与记录库内核共用这一份。
export function getLocalStorageSafe(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			return window.localStorage;
		}
		if(typeof localStorage !== 'undefined'){
			return localStorage;
		}
	}catch(e){
		return null;
	}
	return null;
}

export function safeLocalStorageGet(key){
	try{
		if(typeof window === 'undefined' || !window.localStorage) return null;
		return window.localStorage.getItem(key);
	}catch(e){
		return null;
	}
}

// 写入前置闸(Confluent「先登记后写入」范式):未登记键在 jest 环境直接 throw ——
// 新键写第一行代码、第一个测试就炸,比穷举哨兵的事后扫描更早一层;dev 醒目告警(不炸功能);
// prod 静默(绝不影响用户,运行时兜底=collectBackupKeys 未登记键默认带走)。
function guardRegisteredKey(key){
	if(classifyStorageKey(key)){
		return;
	}
	const env = typeof process !== 'undefined' && process.env ? process.env.NODE_ENV : '';
	if(env === 'test'){
		throw new Error(`[storageKeyRegistry] 未登记存储键:${key} —— 先到 storageKeyRegistry.js 分类登记。kind 决策树:用户亲手创建的内容→user-data;设置/偏好→settings;可再生缓存→cache;设备绑定(设备本身的迁移标志/窗口尺寸/性能旗标)→device-local(守着随备份走的数据的迁移标志→settings)。标错 cache=用户数据被排除备份外(丢数据),拿不准就标 settings(多带无害)。详见 docs/数据管理规范 §2`);
	}
	if(env === 'development'){
		console.error(`[storageKeyRegistry] 未登记存储键:${key}(不入备份面)——去 storageKeyRegistry.js 登记,kind 决策树见文件头`);
	}
}

export function safeLocalStorageSet(key, value){
	guardRegisteredKey(key);
	// 这把键里是一份没能留档的坏用户数据(唯一副本):先再试一次留档,留不成就不盖(见 corruptRawWriteBlocked)
	if(corruptRawWriteBlocked(key)){ return false; }
	try{
		if(typeof window === 'undefined' || !window.localStorage) return false;
		window.localStorage.setItem(key, value);
		return true;
	}catch(e){
		if(!isQuotaError(e)){
			return false;
		}
		// 配额满 → 先清第一档(可再生缓存)重试,仍写不进再清第二档(AI 挂载快照等)重试;
		// 当前 key 恰在清理面里被清了也没关系,重试立即重写。
		return retryWriteAfterQuotaPurge(()=>window.localStorage.setItem(key, value));
	}
}

// 写进调用方给的存储(组件里注入的 storage / sessionStorage / 测试替身):是本机 localStorage 就走 safeLocalStorageSet
// (先登记后写入 + 配额两档阶梯),否则只做 try/catch。全仓 \`.setItem(\` 只许出现在存储单源文件里(源码合同
// storageSetItemSingleSource),各处本地包装一律经这里 —— 此前五处 try{ setItem }catch{} 撞配额不清缓存、静默写不进。
// 返回是否写进去了。
export function safeStorageSetOn(storage, key, value){
	if(!storage || typeof storage.setItem !== 'function'){ return false; }
	let ls = null;
	try{ ls = typeof window !== 'undefined' ? window.localStorage : null; }catch(e){ ls = null; }
	if(ls && storage === ls){ return safeLocalStorageSet(key, value); }
	try{
		return storage.setItem(key, value) !== false;
	}catch(e){
		return false;
	}
}

export function safeLocalStorageRemove(key){
	try{
		if(typeof window === 'undefined' || !window.localStorage) return;
		const had = window.localStorage.getItem(key) !== null;
		window.localStorage.removeItem(key);
		if(had){ noteStorageSpaceFreed(); }
	}catch(e){
		// 静默
	}
}

// 损坏留档:某个数据键的内容解析不出 / 形状不对时,先把原串原样另存一份再处理(之后清掉或覆盖原键也不丢)。
// 留档键 = 'horosa.corrupt.' + 原键 + '.' + 时刻(注册表登记为用户数据,随备份走;存储健康页列出,可导出为文件或删除)。
// 同一份内容已经留过档就不再存第二份。返回留档键;没写进(空间不足等)返回 null。
// 空间不足时只为这一次留档腾空间,写不进就把腾掉的原样放回(留档失败不连带清别的键);opts.noPurge = 只直写一次。
export const CORRUPT_ARCHIVE_PREFIX = 'horosa.corrupt.';
export function archiveCorruptStorageValue(key, raw, opts = {}){
	if(typeof raw !== 'string' || !raw){ return null; }
	try{
		if(typeof window === 'undefined' || !window.localStorage) return null;
		const head = `${CORRUPT_ARCHIVE_PREFIX}${key}.`;
		for(let i = 0; i < window.localStorage.length; i++){
			const k = window.localStorage.key(i);
			if(k && k.indexOf(head) === 0 && window.localStorage.getItem(k) === raw){ return k; }
		}
		const d = new Date();
		const p = (n, w = 2)=>`${n}`.padStart(w, '0');
		const archiveKey = `${head}${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}`;
		guardRegisteredKey(archiveKey);
		const write = ()=>window.localStorage.setItem(archiveKey, raw);
		try{
			write();
			return archiveKey;
		}catch(e){
			if(!isQuotaError(e) || (opts && opts.noPurge)){ return null; }
		}
		return writeWithReversiblePurge(write) ? archiveKey : null;
	}catch(e){
		return null;
	}
}

// 用户数据键期望的值形状(由注册表 restoreMerge.shape 推导:array = 数组;map / fields = 纯对象;没声明 = 不判)
function expectedShapeOf(key){
	const e = classifyStorageKey(key);
	const sh = e && e.restoreMerge && e.restoreMerge.shape;
	if(sh === 'array'){ return 'array'; }
	if(sh === 'map' || sh === 'fields'){ return 'object'; }
	return '';
}
function shapeMatches(shape, v){
	if(shape === 'array'){ return Array.isArray(v); }
	if(shape === 'object'){ return !!v && typeof v === 'object' && !Array.isArray(v); }
	return true;
}
// 原串还算不算坏的:解析不出,或解析得出却不是注册表声明的形状
function rawStillCorrupt(key, raw){
	let v;
	try{ v = JSON.parse(raw); }catch(e){ return true; }
	return !shapeMatches(expectedShapeOf(key), v);
}

// 内容指纹(长度 + FNV-1a):同一份坏原串只尝试留档一次,内容变了才算新的一份
function contentFingerprint(raw){
	let h = 0x811c9dc5;
	for(let i = 0; i < raw.length; i++){
		h ^= raw.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return `${raw.length}:${h.toString(16)}`;
}
// 这份坏原串(fp)现在要不要试留档:没试过这份内容 → 试(可腾空间,写不进放回);
// 试过的:写这把键之前一律直写重试一次(不腾空间、没有副作用 —— 用户腾出空间后的第一次保存就能留档并写进);
// 读这把键(渲染 / 组上下文,频繁)只在腾空间代次变了或隔了足够久时才直写重试
function corruptArchiveAttemptDue(key, fp, forWrite){
	const st = corruptUnarchivedKeys.get(key);
	if(!st || st.fp !== fp){ return { due: true, noPurge: false }; }
	const due = !!forWrite || st.gen !== storageFreedGen || (Date.now() - st.at) >= CORRUPT_ARCHIVE_RETRY_MIN_MS;
	return { due, noPurge: true };
}
function tryArchiveUnarchived(key, raw, forWrite){
	const fp = contentFingerprint(raw);
	const plan = corruptArchiveAttemptDue(key, fp, forWrite);
	if(!plan.due){ return false; }
	if(archiveCorruptStorageValue(key, raw, { noPurge: plan.noPurge })){ corruptUnarchivedKeys.delete(key); return true; }
	noteCorruptUnarchived(key, fp);
	return false;
}

// 没能留档的坏用户数据键(本次运行):JSON 坏了、留档又写不进(空间不足)时,原串原样留在原键里(它是唯一副本),
// 本次读当空;之后任何写这把键(safeLocalStorageSet / 延迟落盘)先再试一次留档 —— 腾出空间后留档成功就照常写,
// 仍留不成就拒写(回 false,调用方按写失败处理),不拿新值盖掉唯一的原串。存储健康页列出这些键,可导出原内容。
// 原串已不在 / 已能解析(别处修好、用户清掉)→ 自动解除。(集合本身在文件头声明:写入单源在它之前定义)
export const CORRUPT_UNARCHIVED_EVENT = 'horosa:storage-corrupt-unarchived';
function noteCorruptUnarchived(key, fp){
	const known = corruptUnarchivedKeys.has(key);
	corruptUnarchivedKeys.set(key, { fp, gen: storageFreedGen, at: Date.now() });
	if(known){ return; }
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(CORRUPT_UNARCHIVED_EVENT, { detail: { key } }));
		}
	}catch(e){ /* 广播失败不影响保护本身 */ }
}
// 这把键现在不许写(是没能留档的坏原串、且这次仍留不成档)。纯判定 + 顺手解除 / 重试留档;两条写入通道共用。
// 重试只做一次直写,绝不进告急清理(此前每次写都重试留档 + 清两档)
export function corruptRawWriteBlocked(key){
	if(!corruptUnarchivedKeys.size || !corruptUnarchivedKeys.has(key)){ return false; }
	let raw = null;
	try{ raw = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null; }catch(e){ raw = null; }
	if(typeof raw !== 'string' || !raw){ corruptUnarchivedKeys.delete(key); return false; }
	if(!rawStillCorrupt(key, raw)){ corruptUnarchivedKeys.delete(key); return false; }
	return !tryArchiveUnarchived(key, raw, true);
}
// 存储健康页「已导出,放弃本机这份」:删掉没能留档的坏原串并解除写入封锁(只认清单里的键)。返回是否放弃成了
export function abandonCorruptUnarchived(key){
	if(!corruptUnarchivedKeys.has(key)){ return false; }
	safeLocalStorageRemove(key);
	if(safeLocalStorageGet(key) !== null){ return false; }
	corruptUnarchivedKeys.delete(key);
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(CORRUPT_UNARCHIVED_EVENT, { detail: { key, abandoned: true } }));
		}
	}catch(e){ /* noop */ }
	return true;
}
// 存储健康页:[{ key, size }](size = 原串字符数;已不再是坏串的顺手解除)
export function listCorruptUnarchivedKeys(){
	const out = [];
	Array.from(corruptUnarchivedKeys.keys()).forEach((key)=>{
		let raw = null;
		try{ raw = window.localStorage.getItem(key); }catch(e){ raw = null; }
		if(typeof raw !== 'string' || !raw){ corruptUnarchivedKeys.delete(key); return; }
		if(!rawStillCorrupt(key, raw)){ corruptUnarchivedKeys.delete(key); return; }
		out.push({ key, size: raw.length });
	});
	return out;
}
export function __resetCorruptUnarchivedForTests(){ corruptUnarchivedKeys.clear(); storageFreedGen = 0; }

// 现有的损坏留档(存储健康页列出,可导出 / 删除):[{ key, sourceKey, at, size }],新的在前。
// sourceKey = 原来那把键;at = 留档时刻串(YYYYMMDD-HHmmss-SSS);size = 字符数
export function listCorruptArchives(){
	const out = [];
	try{
		if(typeof window === 'undefined' || !window.localStorage) return out;
		for(let i = 0; i < window.localStorage.length; i++){
			const k = window.localStorage.key(i);
			if(!k || k.indexOf(CORRUPT_ARCHIVE_PREFIX) !== 0){ continue; }
			const rest = k.slice(CORRUPT_ARCHIVE_PREFIX.length);
			const m = /^(.*)\.(\d{8}-\d{6}-\d{3})$/.exec(rest);
			let size = 0;
			try{ size = `${window.localStorage.getItem(k) || ''}`.length; }catch(e){ size = 0; }
			out.push({ key: k, sourceKey: m ? m[1] : rest, at: m ? m[2] : '', size });
		}
	}catch(e){ /* 读不了:当没有 */ }
	return out.sort((a, b)=>(a.at < b.at ? 1 : (a.at > b.at ? -1 : 0)));
}

// 删掉一份损坏留档(用户在存储健康页确认后;只认留档前缀的键,别的键一概不动)。返回是否删掉了
export function removeCorruptArchive(key){
	if(typeof key !== 'string' || key.indexOf(CORRUPT_ARCHIVE_PREFIX) !== 0){ return false; }
	safeLocalStorageRemove(key);
	return safeLocalStorageGet(key) === null;
}

export function safeJsonParseFromStorage(key){
	const raw = safeLocalStorageGet(key);
	if(!raw){ return null; }
	try{
		return JSON.parse(raw);
	}catch(e){
		// JSON 损坏 → 用户数据键(人生事件 / 择日方案 / 书签 / 塔罗日志等)原串先留档,不随清除一起没了;再自愈清除。
		// 留档没成功(空间不足)→ 原串不删(它是唯一副本),本次读当空,记下这把键:之后的写先再试留档、留不成就拒写
		// 同一份坏原串已经试过、空间也没变 → 直接当空,不再重试(此前每读一次就重试一次留档、清一次告急档)
		const entry = classifyStorageKey(key);
		if(entry && entry.kind === 'user-data'){
			if(!tryArchiveUnarchived(key, raw)){ return null; }
		}
		safeLocalStorageRemove(key);
		return null;
	}
}

// 设置没写进(存储满 / 坏原串封锁):写入方按存储里实际的值广播与返回(不拿内存里那份冒充已保存),并派这个事件,
// 界面提示一次「没能保存」。此前写入方丢掉写入回值、照样广播内存值:界面显示「已开」,真正读的时候读到的是旧值。
export const SETTING_NOT_SAVED_EVENT = 'horosa:setting-not-saved';
export function noteSettingNotSaved(key){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(SETTING_NOT_SAVED_EVENT, { detail: { key } }));
		}
	}catch(e){ /* noop */ }
}

// 用户数据键「读 → 改 → 整份写回」的读端单源:没有 → fallback;JSON 坏了 → 同 safeJsonParseFromStorage(先留档,
// 留不成就不删原串、之后的写先再试留档、留不成拒写);解析得出却不是注册表声明的形状(数组 / 纯对象)→ 同样先留档再当空。
// 此前这类键各自 JSON.parse + catch → 空,下一次写入就把唯一的原串整份盖掉,有空间也一份留档都不留(合同 userDataParseSingleSource)。
export function readUserDataJson(key, fallback){
	const v = safeJsonParseFromStorage(key);
	if(v === null || v === undefined){ return fallback; }
	if(shapeMatches(expectedShapeOf(key), v)){ return v; }
	const entry = classifyStorageKey(key);
	const raw = safeLocalStorageGet(key);
	if(entry && entry.kind === 'user-data' && typeof raw === 'string' && raw){
		if(tryArchiveUnarchived(key, raw, false)){ safeLocalStorageRemove(key); }
	}
	return fallback;
}

export function safeJsonStringifyToStorage(key, obj){
	try{
		return safeLocalStorageSet(key, JSON.stringify(obj));
	}catch(e){
		// stringify 失败(循环引用等)→ 静默
		return false;
	}
}
