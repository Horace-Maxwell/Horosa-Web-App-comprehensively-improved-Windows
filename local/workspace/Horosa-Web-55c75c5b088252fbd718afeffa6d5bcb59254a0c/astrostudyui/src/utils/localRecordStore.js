// 本地记录存储内核 —— 命盘(localcharts)/事盘(localcases)共用的存储机械层单一实现。
//
// 两文件此前是逐函数镜像的孪生复制(getLocalStorage/quota 自救/读写/排序/
// 分页/信封导入导出 ~200 行 ×2,quota 判定另与 safeStorage 重复第三份),任何加固都要改两遍、
// 漂移已实际发生(如 NS_ERROR 名判定)。收编后两壳只保留域层(记录构造/类型表),机械层一处改
// 两面生效。**公开 API 由壳保持,本内核不直接对组件暴露。**
//
// 边界纪律:
// - buildRecord 由壳注入 —— buildLocalChartRecord 被 recordFieldsRestore 哨兵按源码切片
//   锁定(export function…return record; + 两 tab 键扫描),必须原文驻留 localcharts.js。
// - 行为承诺:S1 为逐字搬运,upsert 合并语义({...base,...values} 再重建、命中位 {...旧,...新})
//   与全部返回值/失败语义与搬运前逐字节一致(localRecordStoreParity 金标看守)。
// - quota 判定与告急清理收编 safeStorage 单源(消第三份复制):清理面从「仅 AI 快照」
//   放宽为 purgeQuotaEmergency(可再生缓存一档 + AI 快照二档)——释放更多空间,写成功率上升。
//
// 文件布局:工厂 createLocalRecordStore 的状态(各 let)、读写主干与导入执行(会改写工厂里的修订戳)留在本文件;
//   模块级的记录口径(recordShape)/ 排序与序列化(listSerialize)/ 回收站与删除日志助手(trashLog),以及工厂里
//   只依赖只读名字的内层函数(备份导入导出 backupIO · 回收站读写 trashOps · 列表与单条操作 recordOps)按职责拆在
//   ./localRecordStore/ 下,工厂里的同名包装在调用那一刻把依赖传进去。读源码的检查按全集读(scripts/source-sets.json)。
import { parseLocalDateTimeMs } from './dateTimeParse';
import { isQuotaError, purgeQuotaEmergency, archiveCorruptStorageValue, noteStorageSpaceFreed, getLocalStorageSafe as getLocalStorage } from './safeStorage';
// 影子副本:主存(localStorage)成功落盘后镜像到壳层文件(桌面环境;dev/jest no-op)。
// 恢复语义在 shadowMirror.reconcileShadowOnBoot(仅主存缺失时写回,绝不覆盖存在的主存)。
import { mirrorShadowWrite } from './shadowMirror';
// 版本历史:更新前旧版快照(独立 IDB 库;jest/无 IDB 环境自动内存回退)。
import { pushRecordRevision } from './recordRevisions';
// 写路径开关(默认开):逐记录序列化缓存/装饰排序/缓存对象身份保持;关=整库 stringify/parse 旧路径。
import { recordStoreFastWriteEnabled } from './perfFlags';
import { matchesUserQuery } from './scriptMode';
import { CORRUPT, safeParseJson, nowStr, LOCAL_RECORD_SCHEMA_VERSION, applyRecordMigrations } from './localRecordStore/recordShape';
import { effOrderKey, sortByUpdateTimeDesc, serializeList, canonicalizeRecord } from './localRecordStore/listSerialize';
import { TRASH_CAP, DELETED_LOG_KEY, DELETED_LOG_CAP, shadowCanRestore, resolveSameCid, withLocalManagementFields, trashEntryLive } from './localRecordStore/trashLog';
import { exportBackup as exportBackupImpl, validateBackupEnvelope as validateBackupEnvelopeImpl, incomingIsNewer as incomingIsNewerImpl, deletedAfter as deletedAfterImpl, previewImportBackup as previewImportBackupImpl, isExactDuplicate as isExactDuplicateImpl } from './localRecordStore/backupIO';
import { readTrashText as readTrashTextImpl, restoreTrashText as restoreTrashTextImpl, pruneTrash as pruneTrashImpl, listTrash as listTrashImpl, countLiveTrash as countLiveTrashImpl, restoreRecord as restoreRecordImpl, restoreFromTrash as restoreFromTrashImpl, undoDeletedLog as undoDeletedLogImpl } from './localRecordStore/trashOps';
import { listTags as listTagsImpl, getPaged as getPagedImpl, setFlag as setFlagImpl, setTags as setTagsImpl, touchRecord as touchRecordImpl, setPin as setPinImpl, moveRecord as moveRecordImpl } from './localRecordStore/recordOps';
export { safeParseJson, nowStr, parseGroupTags, normalizeGroup, normalizePayload, LOCAL_RECORD_SCHEMA_VERSION, RECORD_MANAGEMENT_KEYS, RECORD_DISPLAY_FIELDS, RECORD_BOOKKEEPING_KEYS, RECORD_LINK_KEYS, RECORD_NON_CAST_FIELDS, recordChangeAffectsCast, recordChangedFields, RECORD_COPY_STRIP_KEYS, toRecordCopy, applyRecordMigrations } from './localRecordStore/recordShape';
export { __serializeListForTests } from './localRecordStore/listSerialize';
export { TRASH_RETENTION_DAYS, TRASH_CAP, DELETED_LOG_KEY, DELETED_LOG_CAP, countDeletedLogEntries, trashEntryLive } from './localRecordStore/trashLog';

export function createLocalRecordStore(config){
	const storageKey = config.storageKey;
	const searchField = config.searchField;
	const envelopeFormat = config.envelopeFormat;
	const envelopeListField = config.envelopeListField;
	const buildRecord = config.buildRecord;
	const saveErrorCode = config.saveErrorCode;
	const deleteErrorCode = config.deleteErrorCode;
	const warnLabel = config.warnLabel;
	// 独立 trash 键(读端零波及:主 list 天然不含已删):删除=主库移出+trash 追加
	// (带 deletedAt);30 天惰性清理+上限 FIFO;trash 写失败绝不阻断删除主流程。
	const trashKey = config.trashKey || null;
	const TRASH_MAX = TRASH_CAP;
	// 导入时的坏条目判据(域层给;返回理由串 = 坏,假值 = 好)。只在调用方传 opts.rejectInvalid 时用(从文件导入);
	// 全量恢复不传 —— 自己备份里的旧条目照旧带回,不在恢复时丢数据
	const validateItem = typeof config.validateItem === 'function' ? config.validateItem : null;
	const importProblem = (item, opts)=>{
		if(!validateItem || !(opts && opts.rejectInvalid)){ return null; }
		try{ return validateItem(item) || null; }catch(e){ return null; }
	};
	const invalidEntry = (item, reason)=>({ name: `${(item && item[searchField]) || ''}`.trim(), reason });

	let fallbackToMemoryStore = false;
	let fallbackWarned = false;
	let memoryList = [];
	let lastWriteFailed = false;
	let lastFailureReason = null;
	let degradedEventFired = false;
	// 读缓存:以 raw 原串比对为缓存键(≠dirty 标志 —— 测试/外部直改 localStorage 后
	// 首读 raw 不等必 miss,失效性天然正确,无需 test hook)。本模块写路径是这两个键的全仓
	// 唯一写者;跨窗口本无同步(多实例=多 origin),缓存不会比现状更陈旧。
	// 🔴 契约:命中路径返回的**记录对象跨次共享引用,禁止原地修改**(8 处全表扫描消费点
	// 已逐点审计只读;freeze 审计测试看守)。数组本身每次新切,外部原地 sort 不扰缓存。
	let lastRawText = null;
	let lastParsedList = null;
	let newerSchemaNotified = false;   // 超版记录提示,每会话一次
	let newerSchemaFound = null;   // 健康态里的同一条(事件可能早于横幅挂载,横幅挂载时补查 getHealth)
	// cid → 记录 索引(惰性建;以 lastParsedList 换代为失效信号——它与 lastRawText 同步换代)。
	let cidIndex = null;
	let cidIndexOf = null;
	// 仅本次会话模式下的回收站:主库写不进磁盘时,回收站的进出也只记在内存(进入该模式时从磁盘读一份做底)。
	// 此前主库只在内存、回收站照写磁盘 → 内存里删的,重启后主库和回收站各一份;内存里恢复的,重启后两边都没有。
	let memoryTrash = null;
	// 主存键内容坏了时原串的留档键(健康态 / 横幅据此提示;null = 没坏或没留成)
	let corruptArchiveKey = null;
	let corruptDetected = false;
	let corruptResetToEmpty = false;   // 坏主存原串已留档、已从空库开始并落盘(没有影子副本可救时)
	let corruptAt = 0;   // 发现主存内容坏了的时刻(横幅「从最近的自动备份恢复」取这之前写的那份:之后写的是空库)
	let memoryDirty = false;   // 「只在内存」期间写过(之后不能再无损退回磁盘)
	let forceRevision = false;   // 导入 / 恢复整条替换或按字段合并期间:替换前的本机版本一律留历史(不受 5 分钟去抖限制)

	// 主存坏了被转为「只在内存」后,启动对账用完好的影子副本写回了主存:本次运行还没在内存里改过东西 → 退出内存模式重读。
	// 对账读过影子、却没能救回这把键(没有影子 / 影子也坏了 / 从没镜像成功过),而原串已经留档 → 退出内存模式,把内存里的
	// (空库,或本次运行新存的)落盘:此前永久卡在「只在内存」,从备份恢复的、新建的,重启后全没了
	try{
		if(typeof window !== 'undefined' && typeof window.addEventListener === 'function'){
			window.addEventListener('horosa.shadowMirror.reconciled', (evt)=>{
				const d = evt && evt.detail;
				if(!d){ return; }
				if(Array.isArray(d.restored) && d.restored.indexOf(storageKey) >= 0){
					if(corruptDetected && fallbackToMemoryStore && !memoryDirty){
						fallbackToMemoryStore = false;
						corruptDetected = false;
						lastRawText = null;
						lastParsedList = null;
						memoryTrash = null;
					}
					return;
				}
				// 影子里有完好的一份只是没写回去(空间不足)/ 原串留不成档 → 不落盘:落盘会连带把那份影子盖掉
				const blocked = (list)=>Array.isArray(list) && list.indexOf(storageKey) >= 0;
				if(d.checked === true && corruptDetected && fallbackToMemoryStore && corruptArchiveKey
					&& !blocked(d.restoreFailed) && !blocked(d.corruptUnarchived)){
					persistAfterCorrupt();
				}
			});
		}
	}catch(_e){ /* 监听不上:下次启动照常读到写回的主存 */ }

	function fireCorruptReset(){
		try{
			if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
				window.dispatchEvent(new CustomEvent('horosa:record-store-corrupt-reset', { detail: { storageKey, archiveKey: corruptArchiveKey } }));
			}
		}catch(e){ /* 横幅挂载时会补查健康态 */ }
	}

	// 坏主存原串已留档、又没有影子副本可救:退出「只在内存」,把内存里的记录(空库,或本次运行新存的)写回磁盘;
	// 内存里的回收站一并写回。写不进(空间不足)就照旧只在内存
	function persistAfterCorrupt(){
		const keep = memoryList.slice();
		const keepTrash = memoryTrash ? memoryTrash.slice() : null;
		const trashDirty = memoryDirty;
		fallbackToMemoryStore = false;
		lastRawText = null;
		lastParsedList = null;
		memoryTrash = null;
		const r = writeRaw(keep);
		if(!r.persisted){
			fallbackToMemoryStore = true;
			memoryList = keep;
			memoryTrash = keepTrash;
			return false;
		}
		if(keepTrash && trashDirty){ writeTrashRaw(keepTrash); }
		memoryDirty = false;
		corruptResetToEmpty = true;
		fireCorruptReset();
		return true;
	}

	function warnMemoryFallback(){
		if(fallbackWarned){
			return;
		}
		fallbackWarned = true;
		console.warn(`[horosa] localStorage unavailable, ${warnLabel} data falls back to memory for this session.`);
	}

	// 存储降级如实上报:每实例每会话至多一次,横幅(LocalStoreHealthBanner)据此提示
	// 「最新保存仅暂存内存、重启丢失、请立即导出」。事件失败绝不阻断存储本体。
	function fireDegradedEvent(reason){
		if(degradedEventFired){
			return;
		}
		degradedEventFired = true;
		try{
			if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
				window.dispatchEvent(new CustomEvent('horosa.localRecordStore.degraded', { detail: { storageKey, reason } }));
			}
		}catch(e){
			// ignore
		}
	}

	function enableMemoryFallback(reason){
		fallbackToMemoryStore = true;
		warnMemoryFallback();
		fireDegradedEvent(reason || 'storage-error');
	}

	function readRaw(){
		if(fallbackToMemoryStore){
			return memoryList.slice();
		}
		const storage = getLocalStorage();
		if(!storage){
			enableMemoryFallback();
			return memoryList.slice();
		}
		let raw = null;
		try{
			raw = storage.getItem(storageKey);
		}catch(e){
			enableMemoryFallback();
			return memoryList.slice();
		}
		// 命中:免整库 JSON.parse(库大时为主开销;8 处全表扫描消费点零改码受益)。
		if(raw !== null && raw === lastRawText && lastParsedList){
			return lastParsedList.slice();
		}
		noteRawSeenForVersion(raw);
		const ary = safeParseJson(raw, CORRUPT);
		if(!(ary instanceof Array)){
			// 键在、内容却解析不出 / 不是数组(截断、手改、外部工具误写):不能当空库 —— 当空,下一次保存就把原内容
			// 连同影子副本一起盖掉。原串留档,本次运行转为只在内存(主存与影子副本都不再写),亮降级横幅;
			// 下次启动影子副本对账把这种主存当「缺失」,有完好的影子就写回。null / 空白串里本来没有数据,照旧当空库。
			if(raw !== null && `${raw}`.trim() !== '' && `${raw}`.trim() !== 'null'){
				corruptDetected = true;
				if(!corruptAt){ corruptAt = Date.now(); }
				corruptArchiveKey = archiveCorruptStorageValue(storageKey, raw);
				if(corruptArchiveKey && !shadowCanRestore()){
					// 原串已留档、本窗口又没有影子副本可等(独立实例 / 无头 / 浏览器):直接从空库开始并落盘
					try{
						storage.setItem(storageKey, '[]');
						lastRawText = '[]';
						lastParsedList = [];
						memoryList = [];
						corruptResetToEmpty = true;
						fireCorruptReset();
						return [];
					}catch(e){ /* 连空库都写不进:照旧只在内存 */ }
				}
				enableMemoryFallback('corrupt');
				return memoryList.slice();
			}
			return [];
		}
		// 迁移链挂点(链空=恒等零开销);未来结构变更在 RECORD_MIGRATIONS 登记即全读端生效。
		const migrated = applyRecordMigrations(ary);
		// 降级保护:读到比本 app 更高 schemaVersion 的记录(用户降级/多机不同版) ——
		// 未知键保全已保证宽容读不丢字段,此处只补「让用户知道」:每会话一次事件供横幅/健康页,
		// 绝不静默;配合「迁移前强制备份」=降级永远有回头路。
		if(!newerSchemaNotified){
			for(let i = 0; i < migrated.length; i++){
				const sv = parseInt(migrated[i] && migrated[i].schemaVersion, 10) || 1;
				if(sv > LOCAL_RECORD_SCHEMA_VERSION){
					newerSchemaNotified = true;
					newerSchemaFound = { storageKey, found: sv, current: LOCAL_RECORD_SCHEMA_VERSION };
					try{
						if(typeof window !== 'undefined' && window.dispatchEvent){
							window.dispatchEvent(new CustomEvent('horosa.localRecordStore.newerSchema', { detail: { storageKey, found: sv, current: LOCAL_RECORD_SCHEMA_VERSION } }));
						}
					}catch(_e){
						// 事件派发失败无害(健康页仍可经 getHealth 读到)。
					}
					break;
				}
			}
		}
		lastRawText = raw;
		lastParsedList = migrated.slice();
		memoryList = migrated.slice();
		return migrated;
	}

	// 单条查找:读缓存命中时经惰性建的 cid 索引 O(1) 取到**共享只读引用**(契约同款,禁原地改);
	// 未命中走 readRaw 常规路径(冷读/内存模式皆由它兜住)后线性查找。首个匹配优先(与 findIndex 语义一致);
	// 不过滤归档(等价 includeArchived)。索引随 lastParsedList 换代自动失效。
	function buildCidIndex(){
		if(cidIndex && cidIndexOf === lastParsedList){
			return cidIndex;
		}
		const m = new Map();
		const src = lastParsedList || [];
		for(let i = 0; i < src.length; i++){
			const r = src[i];
			if(r && r.cid !== undefined && r.cid !== null && !m.has(r.cid)){
				m.set(r.cid, r);
			}
		}
		cidIndex = m;
		cidIndexOf = lastParsedList;
		return m;
	}

	function getByCid(cid){
		if(cid === undefined || cid === null){
			return null;
		}
		if(!fallbackToMemoryStore){
			const storage = getLocalStorage();
			if(storage){
				let raw = null;
				try{
					raw = storage.getItem(storageKey);
				}catch(e){
					raw = undefined;   // 读失败交给 readRaw 走既有降级路径
				}
				if(raw !== undefined && raw !== null && raw === lastRawText && lastParsedList){
					const hit = buildCidIndex().get(cid);
					return hit === undefined ? null : hit;
				}
			}
		}
		const found = readRaw().find((r)=>r && r.cid === cid);
		return found || null;
	}

	// 🔴 此前所有失败分支一律 return true:upsert 的 throw 是死代码、五处
	// 「保存失败」Modal 永不弹,配额写满时 UI 报成功、数据只在内存、重启即丢;且 quota 终败
	// 还 enableMemoryFallback 把「储存满」永久误判「储存坏」,此后一切写永不再试真储存。
	// 改为如实返回 { persisted, reason:'ok'|'memory-mode'|'quota'|'storage-error' }:
	// - quota 终败**不再粘死内存模式**(用户删几条/清缓存后下一次写自动重试真储存);
	// - memory-mode / storage-error 走降级事件+横幅(会话内数据仍可用,不逐次弹错)。
	// horosa_aux_render_slice_v1(Windows-ahead;v3.9.2 收编重构后随写盘口迁入内核):
	// 库写版本号 —— writeRaw 是内核唯一写盘口(upsert/remove/setPin/move/trash/import 全走它),
	// 每写一次自增(**含内存回退写**:memoryList 变了读侧结果就变,签名必须跟着变)。
	// 消费方:localcharts.js 的 localChartsVersion()(90°中点盘叠盘人清单把它编进签名键 →
	// 库一有增删改签名即变、缓存即失效:写驱动失效,零轮询零事件面)。仅内存计数不落盘
	// (重载后从 0 起,读侧首键必 miss,安全)。
	let writeVersion = 0;
	function getWriteVersion(){
		return writeVersion;
	}
	// 读侧补位:主存键也会不经 writeRaw 变内容 —— 别的窗口写库、影子副本对账写回、坏主存从空库重来(readRaw 内直写 '[]')。
	// readRaw 未命中读缓存、拿到与上次所见不同的原串时同样自增;首次读只记底不自增(冷启首键不白失效)。
	// 只在未命中路径比对,不加轮询;原串不变则不自增(主存键缺失时每次都走未命中,也不会反复自增)。
	let versionSeenRaw = null;
	let versionSeenInit = false;
	function noteRawSeenForVersion(raw){
		if(!versionSeenInit){
			versionSeenInit = true;
			versionSeenRaw = raw;
			return;
		}
		if(raw !== versionSeenRaw){
			versionSeenRaw = raw;
			writeVersion += 1;
		}
	}
	function writeRaw(list){
		writeVersion += 1; // 所有写路径(含内存回退)都经此,先自增再落盘
		const next = list instanceof Array ? list.slice() : [];
		memoryList = next;
		if(fallbackToMemoryStore){
			memoryDirty = true;
			return { persisted: false, reason: 'memory-mode' };
		}
		const storage = getLocalStorage();
		if(!storage){
			enableMemoryFallback('storage-error');
			return { persisted: false, reason: 'memory-mode' };
		}
		// 快路径:逐记录序列化缓存拼串(与 JSON.stringify(next) 字节恒等);关=整库 stringify 旧路径。
		const fastWrite = recordStoreFastWriteEnabled();
		const text = fastWrite ? serializeList(next) : JSON.stringify(next);
		// 写得比原来短(删了记录)= 腾出了空间:没能留档的坏用户数据据此再试一次留档(safeStorage.noteStorageSpaceFreed)
		const shrunk = typeof lastRawText === 'string' && lastRawText.length > text.length;
		try{
			storage.setItem(storageKey, text);
			if(shrunk){ noteStorageSpaceFreed(); }
			lastWriteFailed = false;
			lastFailureReason = null;
			// 写者即缓存者;失败路径不动缓存(储存上仍是旧串,缓存与之一致)。
			// 🔴 缓存必须存「text 再解析」的对象而非内存对象:buildRecord 的显式 undefined 键
			// (present 才落的技法键/gender)在 JSON 往返中消失、在内存对象里却是 own key ——
			// 直接缓存内存对象会让 `'key' in rec`/Object.keys 判据与储存字节分叉(闭环测试实锤)。
			// 写频=用户动作级,一次 parse 代价可忽略;换来 缓存 ≡ 储存字节 恒等。
			lastRawText = text;
			if(fastWrite){
				// 身份保持:已在缓存列表里的记录对象原样保留(其串已在 WeakMap,与 text 中该段同源),
				// 只对新建/合并的 1-2 条做 JSON 往返 —— 结果与 JSON.parse(text) 逐元素同构,未触碰记录跨写同一引用。
				const prevSet = lastParsedList ? new Set(lastParsedList) : null;
				lastParsedList = next.map((r)=>(prevSet && prevSet.has(r) ? r : canonicalizeRecord(r)));
			}else{
				lastParsedList = JSON.parse(text);
			}
			mirrorShadowWrite(storageKey, text);
			return { persisted: true, reason: 'ok' };
		}catch(e){
			if(isQuotaError(e)){
				purgeQuotaEmergency();
				try{
					storage.setItem(storageKey, text);
					lastWriteFailed = false;
					lastFailureReason = null;
					lastRawText = text;
					lastParsedList = JSON.parse(text);
					mirrorShadowWrite(storageKey, text);
					return { persisted: true, reason: 'ok', purged: true };
				}catch(e2){
					lastWriteFailed = true;
					lastFailureReason = 'quota';
					return { persisted: false, reason: 'quota' };
				}
			}
			lastWriteFailed = true;
			lastFailureReason = 'storage-error';
			enableMemoryFallback('storage-error');
			return { persisted: false, reason: 'storage-error' };
		}
	}

	function list(filter){
		let out = readRaw();
		// 归档三态:默认列表不含已归档(archivedOnly 只看归档;includeArchived 全含);
		// starredOnly=星标筛选维度(与置顶排序位语义分离)。
		if(filter && filter.archivedOnly){
			out = out.filter((r)=>r && r.archived === true);
		}else if(!(filter && filter.includeArchived)){
			out = out.filter((r)=>!(r && r.archived === true));
		}
		if(filter && filter.starredOnly){
			out = out.filter((r)=>r && r.starred === true);
		}
		// 按名字检索:两边都经 matchesUserQuery 归一(界面繁体时照屏幕输入繁体、直接输入简体都能命中,
		// 记录名本身存的是繁体也一样 —— 归一键对记录名与查询词走同一条路);简体模式与原先逐字节等价。
		// filter.anyScript:不对着屏幕检索的调用方(AI 工具 / 无头)不论界面简繁都归一(转换器须已加载)。
		if(filter && filter.name){
			const name = (filter.name + '').trim();
			if(name !== ''){
				const anyScript = !!filter.anyScript;
				out = out.filter((item)=>{
					const txt = item && item[searchField] ? (item[searchField] + '') : '';
					return matchesUserQuery(txt, name, { anyScript });
				});
			}
		}
		if(filter && filter.tag){
			const tag = filter.tag + '';
			if(tag !== ''){
				out = out.filter((item)=>{
					const grp = safeParseJson(item.group, []);
					return grp instanceof Array && grp.indexOf(tag) >= 0;
				});
			}
		}
		// 事盘类型筛选(精确匹配;命盘记录无 caseType 字段,调用方不会传)。
		if(filter && filter.caseType){
			const ct = filter.caseType + '';
			if(ct !== ''){
				out = out.filter((item)=> item && `${item.caseType || ''}` === ct);
			}
		}
		// 表头排序:orderBy 缺省=updateTime 倒序(既有全部调用方零变);
		// 字段排序按中文 locale 比较,orderDir 'asc'|'desc'(缺省 desc)。
		const sortCore = (arr)=>{
			if(filter && filter.orderBy && filter.orderBy !== 'updateTime'){
				const key = `${filter.orderBy}`;
				const dir = filter.orderDir === 'asc' ? 1 : -1;
				return arr.sort((a, b)=>{
					const va = `${(a && a[key] !== undefined && a[key] !== null ? a[key] : '')}`;
					const vb = `${(b && b[key] !== undefined && b[key] !== null ? b[key] : '')}`;
					return va.localeCompare(vb, 'zh-Hans-CN') * dir;
				});
			}
			if(filter && filter.orderBy === 'updateTime' && filter.orderDir === 'asc'){
				return sortByUpdateTimeDesc(arr).reverse();
			}
			// [V 上移/下移] 默认序 = effOrderKey 升序:无 orderKey 时 ≡ updateTime 倒序(数学等价,
			// 既有行为零变);手动上移/下移把相邻两条的有效键交换并固化 → 与时间序同一数轴无缝插队。
			return arr.sort((a, b)=>effOrderKey(a) - effOrderKey(b));
		};
		// [V 排序定谳] 表头升序/降序激活 = **完全覆盖**用户自定义序(置顶/置底/手动移动全部让位,
		// 纯按字段规则);默认状态才按用户自定义:三层分区(置顶恒先/置底恒后)+层内 effOrderKey
		// (时间序与手动移动同一数轴)。无 pin 无 orderKey 时 = 既有行为逐字节不变。
		if(filter && filter.orderBy){
			return sortCore(out);
		}
		const top = out.filter((r)=>r && r.pinTier === 1);
		const bottom = out.filter((r)=>r && r.pinTier === -1);
		if(!top.length && !bottom.length){
			return sortCore(out);
		}
		const mid = out.filter((r)=>!(r && (r.pinTier === 1 || r.pinTier === -1)));
		return [...sortCore(top), ...sortCore(mid), ...sortCore(bottom)];
	}

	function listTags(...args){ return listTagsImpl({ readRaw }, ...args); }   // 实现在 ./localRecordStore/recordOps.js

	function getPaged(...args){ return getPagedImpl({ list }, ...args); }   // 实现在 ./localRecordStore/recordOps.js

	function upsert(values){
		const all = readRaw();
		const cid = values && values.cid ? values.cid : null;
		const idx = cid ? all.findIndex((item)=> item.cid === cid) : -1;
		// replaceRecord(调用控制标志,导入用):同 cid 整条替换,不与本机那条按字段合并 —— 恢复备份时「较新的那一版整条胜出」
		const replace = !!(values && values.replaceRecord === true);
		const base = idx >= 0 && !replace ? all[idx] : {};
		// 更新已有记录:values 里值为 undefined 的键 = 「没提供」,不盖掉旧值(要清空请显式传 null / 空串)。
		// 此前编辑表单把没读进来的随盘键(日界 / 时间算法 / 容许度等)以 undefined 提交,合并后旧值被抹掉 ——
		// 只改名字保存,这张盘的日柱 / 时柱口径就变了。
		const merged = { ...base };
		Object.keys(values || {}).forEach((k)=>{
			if(values[k] !== undefined){ merged[k] = values[k]; }
		});
		const next = buildRecord(merged);
		// 版本盖章:每次 upsert 重写即按当前版语义盖章(lazy migration 的升版点)。
		// 只升不降:从更新版本来的记录(原值更高)保留原版号 —— 盖回当前版,回到更新的应用时会被当旧记录再迁移一遍
		const prevVersion = parseInt(merged.schemaVersion, 10) || 0;
		next.schemaVersion = Math.max(prevVersion, LOCAL_RECORD_SCHEMA_VERSION);
		// 🔴 buildRecord 是**域层归一器,不是白名单过滤器**:凡 values 携带、
		// buildRecord 未枚举的键(内核管理字段 pinTier/pinAt/orderKey、未来版本新字段、外部工具附加
		// 字段)一律原样保全追加 —— 域层枚举键以 buildRecord 归一结果为准(键序在前,金标零变),
		// 未知键按 values 出现序缀尾。杜绝「新增字段忘枚举 → 导入/副本/恢复即丢」整类事故;
		// 全字段往返闸(recordFieldFidelity)以「未来未知键」属性级看守本语义。
		// preserveUpdateTime 是调用控制标志,非记录数据,唯一剔除项。
		Object.keys(values || {}).forEach((k)=>{
			if(k === 'preserveUpdateTime' || k === 'captureCurrentGlobals' || k === 'replaceRecord'){
				return;
			}
			if(!(k in next) && values[k] !== undefined){
				next[k] = values[k];
			}
		});
		if(idx >= 0){
			// 版本历史:更新覆盖前把旧版快照推入独立 IDB 库(fire-and-forget,失败绝不
			// 阻断保存;回收站救「删错」,这里救「改错」)。仅真实内容变更才留版(导入 preserveUpdateTime
			// 的等值覆盖跳过 —— 全量恢复/导入不该刷出一排相同版本)。
			try{
				if(JSON.stringify(all[idx]) !== JSON.stringify(replace ? next : { ...all[idx], ...next })){
					if(forceRevision){
						pushRecordRevision(warnLabel, all[idx], { force: true });
					}else{
						pushRecordRevision(warnLabel, all[idx]);
					}
				}
			}catch(_e){
				// 快照失败无害。
			}
			all[idx] = replace ? next : {
				...all[idx],
				...next,
			};
		}else{
			all.push(next);
		}
		const saved = writeRaw(sortByUpdateTimeDesc(all));
		// 仅 quota 时抛 —— 既有五处 Modal(models/user.js add/update/saveMemo/addCase/updateCase)
		// 原样点亮,文案「空间不足,请导出清理后重试」与实情吻合;quota 后未粘死,清理即可再存。
		// 抛错当次记录只在内存镜像,下一次 list 重读真储存该条消失 —— 与「保存失败」一致(诚实化,
		// 对照此前「弹成功但重启丢」)。memory-mode/storage-error 不抛:会话内可用,横幅提示,
		// 逐次抛错=保存功能整体瘫痪。
		if(!saved.persisted && saved.reason === 'quota'){
			throw new Error(saveErrorCode);
		}
		return next;
	}

	function setFlag(...args){ return setFlagImpl({ readRaw, writeRaw, saveErrorCode }, ...args); }   // 实现在 ./localRecordStore/recordOps.js

	function setTags(...args){ return setTagsImpl({ readRaw, writeRaw, saveErrorCode }, ...args); }   // 实现在 ./localRecordStore/recordOps.js

	function touchRecord(...args){ return touchRecordImpl({ readRaw, writeRaw }, ...args); }   // 实现在 ./localRecordStore/recordOps.js

	function setPin(...args){ return setPinImpl({ readRaw, writeRaw, saveErrorCode }, ...args); }   // 实现在 ./localRecordStore/recordOps.js

	function moveRecord(...args){ return moveRecordImpl({ readRaw, writeRaw, saveErrorCode }, ...args); }   // 实现在 ./localRecordStore/recordOps.js

	// 删掉了、却没能留进回收站或删除日志的记录(存储写满):广播给横幅,当场给「导出这些记录」的出路
	function fireUnkept(records){
		try{
			if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
				window.dispatchEvent(new CustomEvent('horosa:record-store-unkept', { detail: { storageKey, store: warnLabel, records } }));
			}
		}catch(e){ /* 广播失败:回值里照样带 unkept */ }
	}

	function remove(cid){
		const all = readRaw();
		const found = all.find((item)=> item && item.cid === cid) || null;
		const next = all.filter((item)=> item.cid !== cid);
		// remove 维持永不抛:models/user.js deleteChart 无 try/catch,开抛=dva 未捕获
		// effect 异常。(deleteErrorCode 保留在 config 仅作语义占位。)
		// 先出主库(主库变小,存储写满时也写得进)、再进回收站:回收站写不进 → 这条直接记进删除日志(仍可找回);
		// 删除日志也写不进 → 删除照样生效,回值带 unkept、横幅当场给「导出这些记录」。
		// 此前先进回收站、再出主库:存储写满后回收站长不出一整条记录,任何删除都被拒,用户在软件里腾不出空间。
		const result = writeRaw(next);
		if(!found || !(result.persisted || fallbackToMemoryStore)){
			// 主库没写成(配额满,主库磁盘上这条还在):什么都不动
			return result;
		}
		const moved = moveToTrash(found);
		if(moved.ok || fallbackToMemoryStore || !trashKey){
			return result;
		}
		if(appendDeletedLog([found]).ok){
			return { ...result, trashFailure: moved.reason, keptIn: 'log' };
		}
		fireUnkept([found]);
		return { ...result, trashFailure: moved.reason, unkept: true };
	}

	// ---------- 回收站(独立 trash 键) ----------
	// 回收站键内容坏了(解析不出 / 不是数组):原串先留档再当空;留不成档就锁住不写(写 = 把坏串连同里面的记录盖掉)
	let trashWriteLocked = false;
	let lastTrashFailure = 'quota';   // 最近一次回收站 / 删除日志写不进的原因:'quota'(空间不足)| 'storage-error'
	function readTrashRaw(){
		if(!trashKey){
			return [];
		}
		if(fallbackToMemoryStore && memoryTrash){
			return memoryTrash.slice();
		}
		const storage = getLocalStorage();
		let ary = [];
		if(storage){
			let raw = null;
			try{
				raw = storage.getItem(trashKey);
			}catch(e){
				raw = null;
			}
			const parsed = safeParseJson(raw, CORRUPT);
			if(parsed instanceof Array){
				ary = parsed;
				trashWriteLocked = false;
			}else if(raw !== null && `${raw}`.trim() !== '' && `${raw}`.trim() !== 'null'){
				trashWriteLocked = !archiveCorruptStorageValue(trashKey, raw);
			}
		}
		if(fallbackToMemoryStore){
			memoryTrash = ary.slice();
		}
		return ary;
	}

	function readTrashText(...args){ return readTrashTextImpl({ trashKey }, ...args); }   // 实现在 ./localRecordStore/trashOps.js

	function restoreTrashText(...args){ return restoreTrashTextImpl({ trashKey }, ...args); }   // 实现在 ./localRecordStore/trashOps.js

	function writeTrashRaw(list){
		if(!trashKey){
			return false;
		}
		if(fallbackToMemoryStore){
			memoryTrash = (list instanceof Array ? list : []).slice();
			memoryDirty = true;
			return false;
		}
		if(trashWriteLocked){
			lastTrashFailure = 'storage-error';
			return false;
		}
		const storage = getLocalStorage();
		if(!storage){
			lastTrashFailure = 'storage-error';
			return false;
		}
		const text = JSON.stringify(list instanceof Array ? list : []);
		try{
			storage.setItem(trashKey, text);
			mirrorShadowWrite(trashKey, text);
			return true;
		}catch(e){
			lastTrashFailure = isQuotaError(e) ? 'quota' : 'storage-error';
			if(isQuotaError(e)){
				purgeQuotaEmergency();
				try{
					storage.setItem(trashKey, text);
					mirrorShadowWrite(trashKey, text);
					return true;
				}catch(e2){
					// ignore
				}
			}
			return false;
		}
	}

	function pruneTrash(...args){ return pruneTrashImpl({ TRASH_MAX }, ...args); }   // 实现在 ./localRecordStore/trashOps.js

	// 移入回收站:返回 { ok, undo }。ok = 回收站(与被挤出条目的删除日志)写成了;undo() 把两者退回到这次之前。
	// 被挤出的条目记不进删除日志时整次不做(ok:false),不让它们无声消失。
	function moveToTrash(record){
		const noop = { ok: true, undo: ()=>{} };
		if(!trashKey || !record){
			return noop;
		}
		const prevTrash = fallbackToMemoryStore ? null : readTrashText();
		const rest = readTrashRaw().filter((it)=> !(it && it.cid === record.cid));
		const { kept, evicted } = pruneTrash([{ ...record, deletedAt: nowStr() }, ...rest]);
		let logRes = null;
		if(evicted.length){
			logRes = appendDeletedLog(evicted);
			if(!logRes.ok){
				return { ok: false, reason: lastTrashFailure, undo: ()=>{} };
			}
		}
		if(!writeTrashRaw(kept) && !fallbackToMemoryStore){
			undoDeletedLog(logRes);
			return { ok: false, reason: lastTrashFailure, undo: ()=>{} };
		}
		if(fallbackToMemoryStore){
			return noop;
		}
		return { ok: true, undo: ()=>{ restoreTrashText(prevTrash); undoDeletedLog(logRes); } };
	}

	function listTrash(...args){ return listTrashImpl({ readTrashRaw, pruneTrash, appendDeletedLog, writeTrashRaw }, ...args); }   // 实现在 ./localRecordStore/trashOps.js

	function countLiveTrash(...args){ return countLiveTrashImpl({ readTrashRaw }, ...args); }   // 实现在 ./localRecordStore/trashOps.js

	function restoreRecord(...args){ return restoreRecordImpl({ getByCid, upsert, searchField }, ...args); }   // 实现在 ./localRecordStore/trashOps.js

	function restoreFromTrash(...args){ return restoreFromTrashImpl({ readTrashRaw, restoreRecord, writeTrashRaw, dropDeletedLogEntries }, ...args); }   // 实现在 ./localRecordStore/trashOps.js

	// 摘掉删除日志里本库、满足 pred 的条目(摘不掉无害:最坏是再找回一次多一条副本)
	function dropDeletedLogEntries(pred){
		const storage = getLocalStorage();
		if(!storage || fallbackToMemoryStore){ return; }
		try{
			const cur = safeParseJson(storage.getItem(DELETED_LOG_KEY), []);
			if(!(cur instanceof Array)){ return; }
			const next = cur.filter((e)=>!(e && e.store === warnLabel && e.record && e.record.cid !== undefined && pred(e)));
			if(next.length !== cur.length){ storage.setItem(DELETED_LOG_KEY, JSON.stringify(next)); }
		}catch(_e){ /* 摘不掉无害 */ }
	}

	// 删除日志(Anki deleted.txt 模型):永久删除(彻底删除 / 清空回收站 / 回收站满了挤出去的 / 回收站写不进时的删除)前把记录 JSON
	// 追加进滚动日志 —— 回收站之后的第二道防线,「从删除日志找回」按 upsert 回灌即可。
	// 上限 DELETED_LOG_CAP 条,满了挤掉最早的。共用键(DELETED_LOG_KEY),charts/cases 混录带 store 标。

	// 返回 { ok, prev }:ok = 写成了(或这次不必写);prev = 写之前的原串(undoDeletedLog 退回用)。
	// 日志内容坏了:原串先留档再从空开始;留不成档就不写(ok:false)。
	function appendDeletedLog(records){
		if(!(records instanceof Array) || !records.length || fallbackToMemoryStore){
			return { ok: true };   // 仅本次会话模式下的彻底删除不落盘,重启后回收站原样还在,不必记
		}
		const storage = getLocalStorage();
		if(!storage){
			lastTrashFailure = 'storage-error';
			return { ok: false };
		}
		let prev = null;
		let text = null;
		try{
			prev = storage.getItem(DELETED_LOG_KEY);
			const cur = safeParseJson(prev, CORRUPT);
			let log = [];
			if(cur instanceof Array){
				log = cur.slice();
			}else if(prev !== null && `${prev}`.trim() !== '' && `${prev}`.trim() !== 'null'){
				if(!archiveCorruptStorageValue(DELETED_LOG_KEY, prev)){
					lastTrashFailure = 'quota';
					return { ok: false };
				}
			}
			records.forEach((r)=>{
				if(r && r.cid){
					log.unshift({ store: warnLabel, purgedAt: nowStr(), record: r });
				}
			});
			text = JSON.stringify(log.slice(0, DELETED_LOG_CAP));
			storage.setItem(DELETED_LOG_KEY, text);
			return { ok: true, prev };
		}catch(e){
			lastTrashFailure = isQuotaError(e) ? 'quota' : 'storage-error';
			if(text !== null && isQuotaError(e)){
				purgeQuotaEmergency();
				try{
					storage.setItem(DELETED_LOG_KEY, text);
					return { ok: true, prev };
				}catch(e2){
					// 写不进:如实返回
				}
			}
			return { ok: false };
		}
	}

	function undoDeletedLog(...args){ return undoDeletedLogImpl(...args); }   // 实现在 ./localRecordStore/trashOps.js

	// 从删除日志找回一条:恢复成功后把这条从日志里摘掉(此前日志条目留着,点一次多一条副本)。
	// 恢复抛错(配额满)时日志原样保留。entry = 日志里的那一项 { store, purgedAt, record }
	function restoreFromDeletedLog(entry){
		if(!entry || !entry.record){
			return null;
		}
		const restored = restoreRecord(entry.record);
		const storage = getLocalStorage();
		if(restored && storage && !fallbackToMemoryStore){
			try{
				const cur = safeParseJson(storage.getItem(DELETED_LOG_KEY), []);
				const log = cur instanceof Array ? cur : [];
				const idx = log.findIndex((e)=>e && e.store === entry.store && e.purgedAt === entry.purgedAt
					&& e.record && entry.record && e.record.cid === entry.record.cid);
				if(idx >= 0){
					log.splice(idx, 1);
					storage.setItem(DELETED_LOG_KEY, JSON.stringify(log));
				}
			}catch(_e){
				// 摘不掉无害:最坏是再点一次多一条副本(与此前同)
			}
		}
		// 动作时去重:回收站里同 cid 的条目一并摘掉(这条已按原 cid 回到库里;不摘则再从回收站恢复只多一张副本)
		const rcid = entry.record.cid;
		if(restored && rcid !== undefined && rcid !== null && `${restored.cid || (restored.record && restored.record.cid) || ''}` === `${rcid}`){
			try{
				const trash = readTrashRaw();
				const next = trash.filter((it)=>!(it && `${it.cid}` === `${rcid}`));
				if(next.length !== trash.length){ writeTrashRaw(next); }
			}catch(_e){ /* 摘不掉无害 */ }
		}
		return restored;
	}

	// 彻底删除一条:先出回收站(腾出空间)、再记删除日志;日志写不进 → 回收站退回原样,返回 false(界面如实报,记录仍在回收站)。
	// 此前先写日志(变大)再删回收站条目,日志没写进也照删 —— 这条从此任何地方都找不回。
	function purgeTrashItem(cid){
		const all = readTrashRaw();
		const hit = all.filter((it)=>it && it.cid === cid);
		const rest = all.filter((it)=> !(it && it.cid === cid));
		if(fallbackToMemoryStore){
			writeTrashRaw(rest);
			return true;
		}
		if(!hit.length){
			return true;
		}
		const prevTrash = readTrashText();
		if(!writeTrashRaw(rest)){
			return false;
		}
		if(!appendDeletedLog(hit).ok){
			restoreTrashText(prevTrash);
			return false;
		}
		return true;
	}

	// 清空回收站:同上次序;返回清掉的条数,删除日志写不进时回收站退回原样、返回 -1。
	function clearTrash(){
		const all = readTrashRaw();
		if(fallbackToMemoryStore){
			writeTrashRaw([]);
			return all.length;
		}
		if(!all.length){
			return 0;
		}
		const prevTrash = readTrashText();
		if(!writeTrashRaw([])){
			return -1;
		}
		if(!appendDeletedLog(all).ok){
			restoreTrashText(prevTrash);
			return -1;
		}
		return all.length;
	}

	function exportBackup(...args){ return exportBackupImpl({ readRaw, envelopeFormat, envelopeListField }, ...args); }   // 实现在 ./localRecordStore/backupIO.js

	function validateBackupEnvelope(...args){ return validateBackupEnvelopeImpl({ envelopeListField, envelopeFormat }, ...args); }   // 实现在 ./localRecordStore/backupIO.js

	function incomingIsNewer(...args){ return incomingIsNewerImpl(...args); }   // 实现在 ./localRecordStore/backupIO.js

	// 本机对各 cid 最晚一次删除的时刻(毫秒):回收站的 deletedAt、删除日志里本库的 purgedAt(恢复备份时据此不带回本机之后删掉的记录)
	function localDeletionIndex(){
		const m = new Map();
		const put = (cid, at)=>{
			if(!cid){ return; }
			const k = `${cid}`;
			const t = parseLocalDateTimeMs(at || '') || 0;
			if(t > (m.get(k) || 0)){ m.set(k, t); }
		};
		readTrashRaw().forEach((it)=>{ if(it && it.cid){ put(it.cid, it.deletedAt); } });
		const storage = fallbackToMemoryStore ? null : getLocalStorage();
		if(storage){
			try{
				const cur = safeParseJson(storage.getItem(DELETED_LOG_KEY), []);
				if(cur instanceof Array){
					cur.forEach((e)=>{ if(e && e.store === warnLabel && e.record && e.record.cid){ put(e.record.cid, e.purgedAt); } });
				}
			}catch(_e){ /* 读不到日志:只看回收站 */ }
		}
		return m;
	}
	function deletedAfter(...args){ return deletedAfterImpl(...args); }   // 实现在 ./localRecordStore/backupIO.js

	function previewImportBackup(...args){ return previewImportBackupImpl({
		validateBackupEnvelope, readRaw, localDeletionIndex, envelopeListField, importProblem, invalidEntry,
		incomingIsNewer, deletedAfter, isExactDuplicate,
	}, ...args); }   // 实现在 ./localRecordStore/backupIO.js

	function isExactDuplicate(...args){ return isExactDuplicateImpl({ searchField }, ...args); }   // 实现在 ./localRecordStore/backupIO.js

	// opts.dupStrategy: 'skip'(默认,同名同时刻的新 cid 记录不灌)|'keep-both'(照旧全收)。
	// opts.sameCid / opts.mergeCids / opts.respectLocalDeletions:同 previewImportBackup(缺省 'newer':较新者整条胜出)。
	function importBackup(payload, opts){
		if(!payload || typeof payload !== 'object'){
			return { imported: 0, total: readRaw().length };
		}
		const incoming = payload[envelopeListField];
		if(!(incoming instanceof Array)){
			return { imported: 0, total: readRaw().length };
		}
		const dupStrategy = (opts && opts.dupStrategy) || 'skip';
		let imported = 0;
		let merged = 0;
		let failed = 0;
		let dupSkipped = 0;
		let keptLocal = 0;
		let skippedDeleted = 0;
		let invalid = 0;
		const invalidItems = [];
		// 本机已有、被整条替换 / 按字段合并的 cid:界面据此把当前载入的那条按库里的新版重设(否则一保存就把导入改回去)
		const changedCids = [];
		// 查重只对照导入开始前本机已有的记录:同一份备份 / 文件里同名同生辰的两条(双胞胎、重录)都是合法记录,
		// 此前拿刚导入的那条去比,第二条被悄悄丢掉、结果还报成功
		const before = readRaw();
		const deletions = opts && opts.respectLocalDeletions ? localDeletionIndex() : null;
		incoming.forEach((item)=>{
			if(!item || typeof item !== 'object'){
				return;
			}
			// 坏条目(域层判据,如事盘没有起课时间):跳过并在结果里列出
			const problem = importProblem(item, opts);
			if(problem){
				invalid += 1;
				invalidItems.push(invalidEntry(item, problem));
				return;
			}
			const local = item.cid ? getByCid(item.cid) : null;
			// 本机库里没有、却是本机在这份备份之后删掉的(还在回收站 / 删除日志里):不带回
			if(!local && deletions && deletedAfter(deletions, item)){
				skippedDeleted += 1;
				return;
			}
			// 没有 cid 的条目(从其他软件导入的 CSV / QCK / AAF)同样按「同名同时刻」去重 —— 此前要求 item.cid,
			// 这类导入的去重从不生效,界面却承诺「同名同生辰自动跳过」
			if(dupStrategy === 'skip'){
				const cur = readRaw();
				const sameCid = !!item.cid && cur.some((r)=>r && r.cid === item.cid);
				// 带记录号的(本软件备份)只对照导入前已有的 —— 同一份备份里的双胞胎 / 重录都收;
				// 不带记录号的(其它软件导出的文件)同一批内也互相查重 —— 文件里重复的行只进一条
				const pool = item.cid ? before : cur;
				if(!sameCid && pool.some((r)=>isExactDuplicate(item, r))){
					dupSkipped += 1;
					return;
				}
			}
			// 同 cid:'newer' 较新的那一版整条胜出(本机较新或一样新 → 保留本机,不动;替换时管理字段留本机的);
			// 'backup' 一律整条用包里的;'merge' 按字段合并
			const mode = resolveSameCid(opts, item.cid);
			let values = item;
			let replaceRecord = false;
			if(local && mode !== 'merge'){
				if(mode === 'newer'){
					if(!incomingIsNewer(item, local)){
						keptLocal += 1;
						return;
					}
					values = withLocalManagementFields(item, local);
				}
				replaceRecord = true;
			}
			// 逐条隔离:单条 quota 抛错计入 failed 继续后续条目(后面更小的记录可能仍成),
			// 不让一条失败把整批导入吃成「文件解析失败」。
			// 被替换 / 合并之前的本机版本一律留一版历史(不受去抖限制:5 分钟内亲手改的那版也留得住)
			forceRevision = true;
			try{
				upsert({
					...values,
					preserveUpdateTime: true,
					...(replaceRecord ? { replaceRecord: true } : {}),
				});
				imported += 1;
				if(local && mode === 'merge'){ merged += 1; }
				if(local){ changedCids.push(`${item.cid}`); }
			}catch(e){
				failed += 1;
			}finally{
				forceRevision = false;
			}
		});
		const total = readRaw().length;
		return { imported, merged, failed, dupSkipped, keptLocal, skippedDeleted, invalid, invalidItems, total, changedCids };
	}

	// 一次性补字段(迁移用):库里与回收站里缺 key 的记录补上 value —— 不动更新时间、不留版本,各一次写回。
	// 返回补了几条;库没写成返回 -1(调用方据此不当已补);库补成了、回收站或删除日志没写进返回 -2(如实上报)。
	function backfillMissingField(key, value){
		const missing = (rec)=>rec && typeof rec === 'object' && (rec[key] === undefined || rec[key] === null);
		let n = 0;
		const all = readRaw();
		if(all.some(missing)){
			const next = all.map((rec)=>{
				if(!missing(rec)){ return rec; }
				n += 1;
				return { ...rec, [key]: value };
			});
			const saved = writeRaw(next);
			// 与删除同口径:存储刚坏、已转入内存(writeRaw 先切内存再报 storage-error)不算失败
			if(!saved.persisted && !fallbackToMemoryStore){ return -1; }
		}
		let partial = false;
		const trash = readTrashRaw();
		// 回收站缺键的条目全补(过期的补了也无妨,打开回收站照样清掉;只补没过期的反倒在 30 天线上 / 时钟回拨时留下没补的盘);
		// 计数(countMissingField)只数没过期的,写不进也只在有没过期的要补时才算部分失败
		const nowTs = Date.now();
		if(trash.some(missing)){
			// 内存模式(存储根坏)下写进的是内存,与主库同口径不算失败
			if(!writeTrashRaw(trash.map((rec)=>(missing(rec) ? { ...rec, [key]: value } : rec))) && !fallbackToMemoryStore && trash.some((rec)=>trashEntryLive(rec, nowTs) && missing(rec))){ partial = true; }
		}
		// 删除日志里本库的记录同样补:从日志「找回」的旧盘也按本机原来的口径(此前只补主库与回收站)
		const storage = fallbackToMemoryStore ? null : getLocalStorage();
		if(storage){
			try{
				const cur = safeParseJson(storage.getItem(DELETED_LOG_KEY), []);
				const hit = (e)=>e && e.store === warnLabel && missing(e.record);
				if(cur instanceof Array && cur.some(hit)){
					storage.setItem(DELETED_LOG_KEY, JSON.stringify(cur.map((e)=>(hit(e) ? { ...e, record: { ...e.record, [key]: value } } : e))));
				}
			}catch(_e){ partial = true; }   // 日志补不进:只影响从日志找回的那几条,但如实上报
		}
		return partial ? -2 : n;
	}

	// 本机(主库 + 回收站 + 删除日志里本库的)缺这个键的记录数:恢复预览据此决定列不列「先补记」一行
	function countMissingField(key){
		const missing = (rec)=>rec && typeof rec === 'object' && (rec[key] === undefined || rec[key] === null);
		const now = Date.now();
		let n = readRaw().filter(missing).length + readTrashRaw().filter((it)=>trashEntryLive(it, now) && missing(it)).length;   // 回收站只数没过期的(过期的打开回收站就被清掉)
		const storage = fallbackToMemoryStore ? null : getLocalStorage();
		if(storage){
			try{
				const cur = safeParseJson(storage.getItem(DELETED_LOG_KEY), []);
				if(cur instanceof Array){ n += cur.filter((e)=>e && e.store === warnLabel && missing(e.record)).length; }
			}catch(_e){ /* 读不到日志:只数主库与回收站 */ }
		}
		return n;
	}

	// 健康态:横幅/诊断消费。mode='memory' 仅在储存根坏(getItem/setItem 非 quota 异常);
	// quota 只置 lastWriteFailed,不降级模式。
	// corrupt:主存键内容坏了(archiveKey = 原串留档键,null = 没留成;resetToEmpty = 已从空库开始并落盘,否则本次运行只在内存)。
	// newerSchema:读到比本应用更新版本的记录。
	function getHealth(){
		return {
			mode: fallbackToMemoryStore ? 'memory' : 'persistent',
			lastWriteFailed,
			lastFailureReason,
			...(corruptDetected ? { corrupt: { storageKey, archiveKey: corruptArchiveKey, resetToEmpty: corruptResetToEmpty, at: corruptAt } } : {}),
			...(newerSchemaFound ? { newerSchema: newerSchemaFound } : {}),
		};
	}

	// 测试专用:重置实例态(内存降级标志/镜像/健康态),供 quota 故障注入用例在 case 间复位。
	function __resetForTests(){
		fallbackToMemoryStore = false;
		fallbackWarned = false;
		memoryList = [];
		lastWriteFailed = false;
		lastFailureReason = null;
		degradedEventFired = false;
		lastRawText = null;
		lastParsedList = null;
		newerSchemaNotified = false;
		newerSchemaFound = null;
		corruptDetected = false;
		corruptArchiveKey = null;
		corruptResetToEmpty = false;
		corruptAt = 0;
		memoryDirty = false;
		forceRevision = false;
		cidIndex = null;
		cidIndexOf = null;
		memoryTrash = null;
		trashWriteLocked = false;
	}

	return { list, listTags, getPaged, getByCid, upsert, remove, setPin, moveRecord, setFlag, setTags, touchRecord, exportBackup, importBackup, validateBackupEnvelope, previewImportBackup, getHealth, listTrash, countLiveTrash, restoreFromTrash, restoreRecord, restoreFromDeletedLog, purgeTrashItem, clearTrash, backfillMissingField, countMissingField, __resetForTests, getWriteVersion };
}
