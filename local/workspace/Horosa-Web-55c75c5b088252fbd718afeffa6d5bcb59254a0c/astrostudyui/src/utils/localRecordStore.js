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
import { parseLocalDateTimeMs } from './dateTimeParse';
import { isQuotaError, purgeQuotaEmergency, archiveCorruptStorageValue, noteStorageSpaceFreed, getLocalStorageSafe as getLocalStorage } from './safeStorage';
// 影子副本:主存(localStorage)成功落盘后镜像到壳层文件(桌面环境;dev/jest no-op)。
// 恢复语义在 shadowMirror.reconcileShadowOnBoot(仅主存缺失时写回,绝不覆盖存在的主存)。
import { mirrorShadowWrite, shadowMirrorEligible } from './shadowMirror';
// 版本历史:更新前旧版快照(独立 IDB 库;jest/无 IDB 环境自动内存回退)。
import { pushRecordRevision } from './recordRevisions';
// 写路径开关(默认开):逐记录序列化缓存/装饰排序/缓存对象身份保持;关=整库 stringify/parse 旧路径。
import { recordStoreFastWriteEnabled } from './perfFlags';
import { matchesUserQuery } from './scriptMode';

// 解析失败的哨兵值(区分「键里是坏串」与「键不在 / 空」)
const CORRUPT = { corrupt: true };

export function safeParseJson(txt, defVal){
	if(!txt){
		return defVal;
	}
	try{
		return JSON.parse(txt);
	}catch(e){
		return defVal;
	}
}

export function nowStr(){
	const dt = new Date();
	const y = dt.getFullYear();
	const m = String(dt.getMonth() + 1).padStart(2, '0');
	const d = String(dt.getDate()).padStart(2, '0');
	const hh = String(dt.getHours()).padStart(2, '0');
	const mm = String(dt.getMinutes()).padStart(2, '0');
	const ss = String(dt.getSeconds()).padStart(2, '0');
	return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

// 标签(group 字段)解析:JSON 数组串 → 数组;裸字符串 → [它];空 → []。与 listTags 聚合同源口径。
export function parseGroupTags(group){
	if(group === undefined || group === null || group === ''){ return []; }
	if(group instanceof Array){ return group.map((t)=>`${t}`.trim()).filter(Boolean); }
	if(typeof group === 'string'){
		const parsed = safeParseJson(group, null);
		if(parsed instanceof Array){ return parsed.map((t)=>`${t}`.trim()).filter(Boolean); }
		return group.trim() ? [group.trim()] : [];
	}
	return [`${group}`];
}

export function normalizeGroup(group){
	if(group === undefined || group === null || group === ''){
		return null;
	}
	if(group instanceof Array){
		return JSON.stringify(group);
	}
	if(typeof group === 'string'){
		const parsed = safeParseJson(group, null);
		if(parsed instanceof Array){
			return JSON.stringify(parsed);
		}
		return group;
	}
	return JSON.stringify([group]);
}

export function normalizePayload(payload){
	if(payload === undefined || payload === null){
		return null;
	}
	if(typeof payload === 'string'){
		return payload;
	}
	try{
		return JSON.stringify(payload);
	}catch(e){
		return `${payload}`;
	}
}

// 记录级 schema 版本 —— 命盘/事盘此前是全仓唯一「有用户数据、无版本、无迁移器」的存储
// (对照:AI 导出设置 v56 normalize 链/AI 工作区 v5)。
// v1 = 历史无 schemaVersion 字段的记录(隐式);v2 = 加盖版本字段,记录形状无其它变化。
// 盖章点在内核 upsert(buildRecord 之后)而非 buildRecord 字面量:①避开 recordFieldsRestore
// 哨兵的两 tab 键扫描面;②charts/cases 一处覆盖;③版本号只升不降:更新版本来的记录保留原版号
// (未知键已原样保全,回到更新的应用时不该被当旧记录再迁移一遍)。读端宽容(缺字段按 v1)、纯读不回写(零写放大),
// 记录随下次 upsert 触碰自然升版(lazy migration)。
export const LOCAL_RECORD_SCHEMA_VERSION = 2;

// 记录的管理字段(置顶 / 排序 / 归档 / 星标 / 使用足迹):属于「这一条在列表里的状态」,不是记录内容。
// AI 工具禁键(aiTools/catalog FORBIDDEN_ARG_KEYS)须覆盖这一组(合同测试锁)。
export const RECORD_MANAGEMENT_KEYS = ['pinTier', 'pinAt', 'orderKey', 'archived', 'starred', 'lastOpenedAt', 'openCount'];

// 「改了不必重排 / 不必按存案重还原」的记录键(命盘与事盘共用这一份,单一出处):
//   展示字段(标题 / 地名 / 备注 / 分组标签 / 研究三字段)+ 管理字段(上表)+ 记账字段(更新时间 / 版本章 / 删除时刻)
//   + 关联字段(断事日志 / 关系边 / 名人库编号 / AI 来源)。
// 界面之外改了当前那条(AI 提案、别的窗口、导入…)只动这些 → 命盘只重设记录态、不重排;事盘不推进载入代次
// (技法页不按存案整页重还原,页上未存的改动、在途择日扫描、左栏亲手改过的日界都留着)。
// 其余任何键(时间 / 时区 / 经纬 / 性别 / 卦盘内容 / 随盘设置 / 进左栏的分技法批注 / 不认识的新键)一律当作影响起盘。
// 记录上的每个已知键都必须归入这两类之一(caseRestoreExplicitLoadOnly.test.js 分类合同,新键不分类即红)。
export const RECORD_DISPLAY_FIELDS = Object.freeze(['name', 'event', 'pos', 'memo', 'group', 'rodden', 'relation', 'sourceNote']);
export const RECORD_BOOKKEEPING_KEYS = Object.freeze(['updateTime', 'schemaVersion', 'deletedAt']);
export const RECORD_LINK_KEYS = Object.freeze(['journal', 'relations', 'celebrityId', 'aiOrigin']);
export const RECORD_NON_CAST_FIELDS = Object.freeze(Array.from(new Set([
	...RECORD_DISPLAY_FIELDS, ...RECORD_MANAGEMENT_KEYS, ...RECORD_BOOKKEEPING_KEYS, ...RECORD_LINK_KEYS,
])));
// fields = 改了哪些键;没给(整条替换 / 并回 / 恢复,拿不到逐键差异)→ 影响
export function recordChangeAffectsCast(fields){
	if(!Array.isArray(fields)){ return true; }
	return fields.some((k)=>RECORD_NON_CAST_FIELDS.indexOf(k) < 0);
}
// 同一条记录两版逐键比:值不同的键(两版键集并集;值按 JSON 文本比)。供跨窗口 / 整条替换的来源产出「改了哪些」
export function recordChangedFields(before, after){
	const a = before && typeof before === 'object' ? before : {};
	const b = after && typeof after === 'object' ? after : {};
	const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
	return keys.filter((k)=>JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
}
// 复制(另存副本 / 历史版本恢复为副本)时去掉的键 = 存储身份 + 管理字段 + 外部身份 / 来源 + 双向关系边。
// 代次标记(fieldsCaptureGen / ziweiSettingsGen)与全部随盘设置、批注、分组都保留:副本载入必须与原件一致。
export const RECORD_COPY_STRIP_KEYS = ['cid', 'schemaVersion', 'deletedAt', 'updateTime', 'preserveUpdateTime',
	...RECORD_MANAGEMENT_KEYS, 'celebrityId', 'aiOrigin', 'relations'];
// 单源复制:返回去掉上表键的浅拷贝;titleKey(命盘 name / 事盘 event)加后缀。
export function toRecordCopy(rec, { titleKey = 'name', suffix = '(副本)' } = {}){
	const dup = { ...(rec || {}) };
	RECORD_COPY_STRIP_KEYS.forEach((k)=>{ delete dup[k]; });
	if(suffix){ dup[titleKey] = `${(rec && rec[titleKey]) || ''}${suffix}`; }
	return dup;
}

// 迁移链(法定落点):未来字段改名/格式变更在此登记 { from, migrate }。
// 链空=恒等快路径(零分配零遍历);v1→v2 仅加盖字段、无内容迁移,故链暂空。
const RECORD_MIGRATIONS = [];

export function applyRecordMigrations(list){
	if(!(list instanceof Array) || !RECORD_MIGRATIONS.length){
		return list;
	}
	return list.map((rec)=>{
		let out = rec;
		let v = parseInt(out && out.schemaVersion, 10) || 1;
		RECORD_MIGRATIONS.forEach((m)=>{
			if(v === m.from){
				const migrated = m.migrate({ ...out });
				out = migrated || out;
				v = m.from + 1;
			}
		});
		return out;
	});
}

// [V 上移/下移] 有效排序键:显式 orderKey 优先,否则 -parseLocalDateTimeMs(updateTime)(时间越新键越小
// =越靠前)。手动序与时间序共用同一数轴 —— 无模式切换,新记录(最新)天然仍到顶。
function effOrderKey(r){
	if(r && r.orderKey !== undefined && r.orderKey !== null){
		return Number(r.orderKey);
	}
	return -(parseLocalDateTimeMs((r && r.updateTime) || '') || 0);
}

function sortByUpdateTimeDesc(list){
	if(!recordStoreFastWriteEnabled()){
		return list.sort((a, b)=>{
			const ta = parseLocalDateTimeMs(a.updateTime || '') || 0;
			const tb = parseLocalDateTimeMs(b.updateTime || '') || 0;
			return tb - ta;
		});
	}
	// 装饰-排序-去装饰:每记录只 Date.parse 一次(旧比较器每次比较各 parse 两次,共 N·logN 倍);
	// 排序键 (-t, 原索引) 与稳定排序下的旧比较器逐位同序(同键按原索引先后)。原地写回并返回同一数组,
	// 调用方语义(in-place + 返回值)不变。
	const n = list.length;
	const dec = new Array(n);
	for(let i = 0; i < n; i++){
		const r = list[i];
		dec[i] = { r, t: parseLocalDateTimeMs((r && r.updateTime) || '') || 0, i };
	}
	dec.sort((a, b)=>(b.t - a.t) || (a.i - b.i));
	for(let i = 0; i < n; i++){
		list[i] = dec[i].r;
	}
	return list;
}

// 逐记录序列化缓存:记录对象 → 其 JSON 串(WeakMap,随对象回收;跨 store 共用无碍——键是对象身份)。
// 成立前提=读缓存契约:缓存列表里的记录对象永不原地修改,故串与对象恒一致;新建/合并的记录在写成功后
// 经 JSON 往返为「规范对象」再入缓存列表(键=往返后的对象),调用方拿到的原对象不进缓存列表。
const recordJsonCache = new WeakMap();

// 数组元素口径:undefined/函数/symbol 在 JSON.stringify(list) 里落为 null,而顶层 JSON.stringify(el) 返回 undefined。
function stringifyElement(el){
	const s = JSON.stringify(el);
	return s === undefined ? 'null' : s;
}

// 与 JSON.stringify(list) 字节恒等(属性测试看守);对象元素命中缓存免重序列化。
function serializeList(list){
	const n = list.length;
	const parts = new Array(n);
	for(let i = 0; i < n; i++){
		const el = list[i];
		if(el !== null && typeof el === 'object'){
			let s = recordJsonCache.get(el);
			if(s === undefined){
				s = stringifyElement(el);
				recordJsonCache.set(el, s);
			}
			parts[i] = s;
		}else{
			parts[i] = stringifyElement(el);
		}
	}
	return '[' + parts.join(',') + ']';
}

// 规范化一条记录:按其序列化串 JSON 往返(与旧路径 JSON.parse(text) 对该元素的结果同构:显式 undefined 键消失、
// -0 归 0、NaN/Infinity 落 null 等),并把串挂到往返后的对象上(下次写直接命中)。
function canonicalizeRecord(el){
	const cached = (el !== null && typeof el === 'object') ? recordJsonCache.get(el) : undefined;
	const s = cached !== undefined ? cached : stringifyElement(el);
	const obj = JSON.parse(s);
	if(obj !== null && typeof obj === 'object'){
		recordJsonCache.set(obj, s);
	}
	return obj;
}

// 测试专用:序列化器直出口(属性测试与 JSON.stringify 对拍)。
export function __serializeListForTests(list){
	return serializeList(list);
}

// config = {
//   storageKey        持久化键('horosa.localCharts.v1' | 'horosa.localCases.v1')
//   searchField       list({name}) 匹配的记录字段('name' | 'event')
//   envelopeFormat    备份信封 format 串
//   envelopeListField 备份信封里的清单字段名('charts' | 'cases')
//   buildRecord       域层记录构造器(壳注入;哨兵锁定其驻留壳文件)
//   saveErrorCode / deleteErrorCode  失败抛错的错误串(与既有调用方 catch 约定一致)
//   warnLabel         内存降级 console 文案里的域名('chart' | 'case')
// }
// 回收站保留期(命盘 / 事盘同):超期的条目打开回收站时惰性清掉。恢复备份合并回收站 / 删除日志时判「这条还在不在回收站里」
// 必须用同一判据(unifiedBackup),否则已过期、下次就被清掉的条目会被当成「还在」—— 两头都没了
export const TRASH_RETENTION_DAYS = 30;
// 回收站上限(命盘 / 事盘各一):超出时最早删的条目被挤出、先记进删除日志
export const TRASH_CAP = 200;
// 删除日志(命盘 / 事盘共用一把键,带 store 标):最多留 500 条,满了最早的那条被挤掉(永久删除)
export const DELETED_LOG_KEY = 'horosa.deleted.log.v1';
export const DELETED_LOG_CAP = 500;
// 删除日志现有条数(命盘 + 事盘合计;批量删除确认框据此算这次会不会挤掉日志里最早的条目)
export function countDeletedLogEntries(){
	const storage = getLocalStorage();
	if(!storage){ return 0; }
	try{
		const cur = safeParseJson(storage.getItem(DELETED_LOG_KEY), []);
		return cur instanceof Array ? cur.length : 0;
	}catch(e){
		return 0;
	}
}
// 本窗口有没有影子副本可等(主存坏了时据此决定:等启动对账写回,还是原串留档后直接从空库开始)
function shadowCanRestore(){
	try{ return shadowMirrorEligible(); }catch(e){ return false; }
}
// 同 cid 的口径(导入 / 恢复):
//   'newer'(缺省)更新时间较新的那一版整条胜出(本机较新或一样新保留本机);整条替换时本机的管理字段(置顶 / 排序 / 归档 / 星标 / 使用足迹)保留
//   'backup'      一律用备份里的那一版(整条,含管理字段):回退到某份备份用(恢复确认框里勾选才走)
//   'merge'       按字段合并(包里的盖本机)
// opts.mergeCids:[cid…] 只有这些条目按字段合并(名人库 JSON 里「只刷新出生数据」的补丁),同一文件里其余条目按 'newer'(或 'backup')
function resolveSameCid(opts, cid){
	const o = opts || {};
	if(Array.isArray(o.mergeCids)){
		if(cid && o.mergeCids.some((c)=>`${c}` === `${cid}`)){ return 'merge'; }
		return o.sameCid === 'backup' ? 'backup' : 'newer';
	}
	return o.sameCid === 'merge' || o.sameCid === 'backup' ? o.sameCid : 'newer';
}
function sameCidLabelOf(opts){
	const o = opts || {};
	if(Array.isArray(o.mergeCids)){ return 'mixed'; }
	return o.sameCid === 'merge' || o.sameCid === 'backup' ? o.sameCid : 'newer';
}
// 'newer' 整条替换时:内容用包里的,管理字段留本机的
function withLocalManagementFields(item, local){
	const out = { ...item };
	RECORD_MANAGEMENT_KEYS.forEach((k)=>{
		delete out[k];
		if(local && local[k] !== undefined){ out[k] = local[k]; }
	});
	return out;
}
export function trashEntryLive(it, now){
	const t = parseLocalDateTimeMs((it && it.deletedAt) || '') || 0;
	return t >= (now === undefined ? Date.now() : now) - TRASH_RETENTION_DAYS * 24 * 3600 * 1000;
}

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

	// 标签筛选下拉的选项源:全量聚合去重(首次出现序),与 list 的 tag 筛选判据同源。
	function listTags(){
		const seen = new Set();
		const tags = [];
		readRaw().forEach((item)=>{
			const raw = item && item.group;
			const grp = raw instanceof Array ? raw : safeParseJson(raw, null);
			if(grp instanceof Array){
				grp.forEach((t)=>{
					const s = t === undefined || t === null ? '' : `${t}`;
					if(s && !seen.has(s)){
						seen.add(s);
						tags.push(s);
					}
				});
			}
		});
		return tags;
	}

	function getPaged(params){
		const pidx = params && params.PageIndex ? parseInt(params.PageIndex + '', 10) : 1;
		const psz = params && params.PageSize ? parseInt(params.PageSize + '', 10) : 30;
		const all = list(params || {});
		const start = (pidx - 1) * psz;
		const end = start + psz;
		return {
			List: all.slice(start, end),
			Total: all.length,
			PageIndex: pidx,
			PageSize: psz,
		};
	}

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

	// [V 置顶/置底] tier: 1=置顶 | -1=置底 | 0/null=取消。内核直写(不经 buildRecord),
	// 不刷新 updateTime(置顶不该改变「最近更新」语义);quota 拒写如实抛错。
	// 归档/星标:布尔管理字段(true 落键/false 删键=零体积语义;不刷新 updateTime;
	// 未知键保全 → 导出/导入/副本/回收站全链自动保真,零额外接线)。
	function setFlag(cid, field, on){
		if(field !== 'archived' && field !== 'starred'){
			return null;
		}
		const all = readRaw();
		const idx = all.findIndex((r)=>r && r.cid === cid);
		if(idx < 0){
			return null;
		}
		const rec = { ...all[idx] };
		if(on){
			rec[field] = true;
		}else{
			delete rec[field];
		}
		all[idx] = rec;
		const saved = writeRaw(all);
		if(!saved.persisted && saved.reason === 'quota'){
			throw new Error(saveErrorCode);
		}
		return rec;
	}

	// 使用足迹:载入记录时悄悄记 lastOpenedAt/openCount —— 不刷新 updateTime、
	// 不动排序数轴(effOrderKey 只认 orderKey/updateTime);写失败静默(足迹丢了无害)。
	// 整体改写标签列表(只增工具用:追加一个 / 撤销时回到写前列表);内核直写不经 buildRecord,不刷新 updateTime。
	function setTags(cid, tags){
		const all = readRaw();
		const idx = all.findIndex((r)=>r && r.cid === cid);
		if(idx < 0){
			return null;
		}
		const rec = { ...all[idx] };
		const list = (tags instanceof Array ? tags : []).map((t)=>`${t}`.trim()).filter(Boolean);
		if(list.length){
			rec.group = JSON.stringify(list);
		}else{
			delete rec.group;
		}
		all[idx] = rec;
		const saved = writeRaw(all);
		if(!saved.persisted && saved.reason === 'quota'){
			throw new Error(saveErrorCode);
		}
		return rec;
	}

	function touchRecord(cid){
		const all = readRaw();
		const idx = all.findIndex((r)=>r && r.cid === cid);
		if(idx < 0){
			return null;
		}
		const rec = { ...all[idx] };
		rec.lastOpenedAt = nowStr();
		rec.openCount = (parseInt(rec.openCount, 10) || 0) + 1;
		all[idx] = rec;
		try{
			writeRaw(all);
		}catch(_e){
			// 足迹写失败无害。
		}
		return rec;
	}

	function setPin(cid, tier){
		const all = readRaw();
		const idx = all.findIndex((r)=>r && r.cid === cid);
		if(idx < 0){
			return null;
		}
		const rec = { ...all[idx] };
		if(tier === 1 || tier === -1){
			rec.pinTier = tier;
			rec.pinAt = nowStr();
		}else{
			delete rec.pinTier;
			delete rec.pinAt;
		}
		all[idx] = rec;
		const saved = writeRaw(all);
		if(!saved.persisted && saved.reason === 'quota'){
			throw new Error(saveErrorCode);
		}
		return rec;
	}

	// [V 上移/下移] 与同层相邻记录交换有效排序键(dir: -1 上移 | 1 下移)。
	// 无显式 orderKey 的一方当场固化为其时间戳负值 → 交换后两条都进显式数轴,其余记录零扰动。
	// 仅默认序语义(表头字段排序激活时 UI 禁用);边界(已最前/最后)原样返回。
	// 🔴 禁原地改共享引用(S9 缓存契约):map 重建两条。
	function moveRecord(cid, dir){
		const all = readRaw();
		const rec = all.find((r)=>r && r.cid === cid);
		if(!rec){
			return null;
		}
		const tierOf = (r)=>(r && r.pinTier === 1 ? 1 : (r && r.pinTier === -1 ? -1 : 0));
		const tier = tierOf(rec);
		const layer = all.filter((r)=>tierOf(r) === tier).sort((a, b)=>effOrderKey(a) - effOrderKey(b));
		const idx = layer.findIndex((r)=>r.cid === cid);
		const j = idx + (dir < 0 ? -1 : 1);
		if(j < 0 || j >= layer.length){
			return rec;
		}
		const nb = layer[j];
		const ka = effOrderKey(rec);
		const kb = effOrderKey(nb);
		const next = all.map((r)=>{
			if(r && r.cid === rec.cid){
				return { ...r, orderKey: kb };
			}
			if(r && r.cid === nb.cid){
				return { ...r, orderKey: ka };
			}
			return r;
		});
		const saved = writeRaw(next);
		if(!saved.persisted && saved.reason === 'quota'){
			throw new Error(saveErrorCode);
		}
		return true;
	}

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

	function readTrashText(){
		const storage = getLocalStorage();
		if(!trashKey || !storage){ return null; }
		try{ return storage.getItem(trashKey); }catch(e){ return null; }
	}

	// 退回到之前读到的原串(回滚用;null = 原来没有这把键)
	function restoreTrashText(text){
		const storage = getLocalStorage();
		if(!trashKey || !storage){ return; }
		try{
			if(text === null || text === undefined){
				storage.removeItem(trashKey);
			}else{
				storage.setItem(trashKey, text);
				mirrorShadowWrite(trashKey, text);
			}
		}catch(e){ /* 退不回:最坏是这条在回收站与主库各一份(健康体检会报重影,可在回收站彻底删除) */ }
	}

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

	// 30 天惰性清理 + 上限(新删在前,超限挤掉最旧)。返回 { kept, evicted }:evicted = 没过期、只因上限被挤出的条目 ——
	// 它们等同永久删除,调用方先记进删除日志(与彻底删除同一口径),此前直接消失、哪里都找不回。
	function pruneTrash(list){
		const now = Date.now();
		const live = list.filter((it)=>trashEntryLive(it, now));
		return { kept: live.slice(0, TRASH_MAX), evicted: live.slice(TRASH_MAX) };
	}

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

	function listTrash(){
		const raw = readTrashRaw();
		const { kept, evicted } = pruneTrash(raw);
		if(kept.length !== raw.length){
			// 惰性清理:有过期才回写(零写放大);超出上限的先记进删除日志,记不进就先不清
			const logRes = evicted.length ? appendDeletedLog(evicted) : null;
			if(!logRes || logRes.ok){
				writeTrashRaw(kept);
				return kept;
			}
			return raw.filter((it)=>trashEntryLive(it, Date.now()));
		}
		return kept;
	}

	// 回收站现有(没过期的)条数:批量删除的确认框据此写明「超出上限的几条转入删除日志」
	function countLiveTrash(){
		const now = Date.now();
		return readTrashRaw().filter((it)=>trashEntryLive(it, now)).length;
	}

	// 恢复一条已删的记录(回收站出栈 / 删除日志找回共用):库里已有同 cid 的现档(删除后又从备份导入过等)→
	// 按副本恢复(新 cid、名字加「(恢复)」),不拿旧版盖掉现档;否则按原 cid 原样恢复。
	function restoreRecord(rec){
		if(!rec || typeof rec !== 'object'){
			return null;
		}
		const record = { ...rec };
		delete record.deletedAt;
		if(record.cid && getByCid(record.cid)){
			return upsert(toRecordCopy(record, { titleKey: searchField || 'name', suffix: '(恢复)' }));
		}
		return upsert(record);
	}

	// 先恢复后出栈:upsert 抛错(quota)时 trash 原样保留,零丢失;主库只进了内存时出栈也只在内存(见 memoryTrash)。
	// 恢复走 upsert 常规路径 → updateTime 刷新=浮到列表最前,用户立刻看到回来了。
	function restoreFromTrash(cid){
		const trash = readTrashRaw();
		const found = trash.find((it)=> it && it.cid === cid) || null;
		if(!found){
			return null;
		}
		const restored = restoreRecord(found);
		writeTrashRaw(readTrashRaw().filter((it)=> !(it && it.cid === cid)));
		// 动作时去重:删除日志里同 (库, cid)、删除时刻不晚于这条回收站条目的旧条目一并摘掉(这条已回到库里;
		// 不摘则日后再从日志找回只多一张副本)。全量恢复合并删除日志因此不必再拿「回收站里有」拦条目
		const backAsSelf = !!restored && `${restored.cid || (restored.record && restored.record.cid) || ''}` === `${cid}`;
		if(backAsSelf){ dropDeletedLogEntries((e)=>`${e.record.cid}` === `${cid}` && `${e.purgedAt || ''}` <= `${found.deletedAt || '9999'}`); }
		return restored;
	}

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

	function undoDeletedLog(res){
		if(!res || !res.ok || !Object.prototype.hasOwnProperty.call(res, 'prev')){
			return;
		}
		const storage = getLocalStorage();
		if(!storage){ return; }
		try{
			if(res.prev === null){ storage.removeItem(DELETED_LOG_KEY); }else{ storage.setItem(DELETED_LOG_KEY, res.prev); }
		}catch(e){ /* 退不回:日志里多一条可找回的记录,无害 */ }
	}

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

	function exportBackup(){
		const items = sortByUpdateTimeDesc(readRaw().slice());
		const envelope = {
			format: envelopeFormat,
			version: 1,
			exportedAt: nowStr(),
			total: items.length,
		};
		envelope[envelopeListField] = items;
		return envelope;
	}

	// 信封校验:format 存在且不匹配=硬拒(把事盘备份选进命盘口此前是静默 imported:0);
	// 缺 format 容忍(手工老文件);version>1 软闸(ok 但 reason='newer-version',UI 附告警确认)。
	function validateBackupEnvelope(payload){
		if(!payload || typeof payload !== 'object'){
			return { ok: false, reason: 'not-object', format: null, version: 0, count: 0 };
		}
		const format = payload.format === undefined || payload.format === null ? null : `${payload.format}`;
		const version = parseInt(payload.version, 10) || 0;
		const incoming = payload[envelopeListField];
		const count = incoming instanceof Array ? incoming.length : 0;
		if(format && format !== envelopeFormat){
			return { ok: false, reason: 'format-mismatch', format, version, count };
		}
		if(!(incoming instanceof Array)){
			return { ok: false, reason: 'missing-list', format, version, count: 0 };
		}
		if(version > 1){
			return { ok: true, reason: 'newer-version', format, version, count };
		}
		return { ok: true, reason: null, format, version, count };
	}

	// 导入预览:在 upsert 合并语义下逐条判 新增/覆盖合并/非法。
	// seen 集模拟顺序语义(同一备份内重复 cid:首条=新增、后续=覆盖),保证与真实导入逐条一致
	// (恒等式 imported === adds+updates 有属性测试)。纯函数零副作用。
	// 同 cid 两版谁胜(恢复备份的缺省口径):更新时间较新的那一版整条胜出,不按字段混合;一样新 / 分不出时保留本机。
	// 此前按字段合并(包盖本机)—— 恢复较早的备份会把本机之后改过的盘改回旧值、本机后加的键却留着,更新时间也倒退。
	function incomingIsNewer(item, local){
		const ti = parseLocalDateTimeMs((item && item.updateTime) || '') || 0;
		const tl = parseLocalDateTimeMs((local && local.updateTime) || '') || 0;
		return ti > tl;
	}

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
	// 包里这一条在本机之后被删过(删除时刻晚于包里那版的更新时间)
	function deletedAfter(index, item){
		const t = index && item && item.cid ? index.get(`${item.cid}`) : undefined;
		return t !== undefined && t > (parseLocalDateTimeMs((item && item.updateTime) || '') || 0);
	}

	// opts.sameCid:'newer'(缺省)|'backup'|'merge',opts.mergeCids:只有这些按字段合并 —— 见 resolveSameCid。
	// opts.respectLocalDeletions:本机库里没有、却在本机回收站 / 删除日志里且删除时刻晚于包里那版更新时间的 → 不带回(计 skippedDeleted)
	function previewImportBackup(payload, opts){
		const v = validateBackupEnvelope(payload);
		if(!v.ok){
			return { ok: false, reason: v.reason, adds: 0, updates: 0, merges: 0, keptLocal: 0, skippedDeleted: 0, invalid: 0, invalidItems: [], total: v.count || 0, version: v.version };
		}
		const invalidItems = [];
		const before = readRaw();
		const existing = new Set(before.map((r)=>(r && r.cid ? `${r.cid}` : null)).filter(Boolean));
		const deletions = opts && opts.respectLocalDeletions ? localDeletionIndex() : null;
		const label = sameCidLabelOf(opts);
		const seen = new Set();
		let adds = 0;
		let updates = 0;
		let merges = 0;
		let keptLocal = 0;
		let skippedDeleted = 0;
		let invalid = 0;
		let dupSkips = 0;
		// 与导入同口径模拟「导入到这一条时的库」:带 cid 的只对照导入前的库;不带 cid 的对照当时的库
		// (含本批已导入的带 cid / 不带 cid 条目、同 cid 合并后的样子)—— 此前只放了本批不带 cid 的,混合批预览多算新增
		const sim = before.slice();
		const importedCids = [];   // 导入后会在库里的 cid(合并的 + 新增的;同名同时刻跳过的不算)—— 全量恢复预览据此模拟回收站 / 删除日志合并
		payload[envelopeListField].forEach((item)=>{
			if(!item || typeof item !== 'object'){
				invalid += 1;
				return;
			}
			const problem = importProblem(item, opts);
			if(problem){
				invalid += 1;
				invalidItems.push(invalidEntry(item, problem));
				return;
			}
			const cid = item.cid ? `${item.cid}` : null;
			if(cid && (existing.has(cid) || seen.has(cid))){
				importedCids.push(cid);
				const i = sim.findIndex((r)=>r && `${r.cid}` === cid);
				const mode = resolveSameCid(opts, cid);
				if(mode === 'merge'){
					// 只有 'merge' 一种口径时沿用旧计数(合并计进 updates);与其它口径混在一份文件里时单独计 merges
					if(label === 'mixed'){ merges += 1; }else{ updates += 1; }
					if(i >= 0){ sim[i] = { ...sim[i], ...item }; }
				}else if(mode === 'backup' || i < 0 || incomingIsNewer(item, sim[i])){
					updates += 1;
					if(i >= 0){ sim[i] = item; }
				}else{
					keptLocal += 1;
				}
			}else if(cid && deletions && deletedAfter(deletions, item)){
				skippedDeleted += 1;
			}else if((cid ? before : sim).some((r)=>isExactDuplicate(item, r))){
				// 与本机已有记录同名同时刻(新 cid)→ 按缺省策略会跳过;预览如实算出来
				dupSkips += 1;
			}else{
				adds += 1;
				if(cid){
					seen.add(cid);
					importedCids.push(cid);
				}
				sim.push(item);
			}
		});
		return { ok: true, reason: v.reason, adds, updates, merges, keptLocal, skippedDeleted, dupSkips, invalid, invalidItems, total: payload[envelopeListField].length, version: v.version, importedCids, sameCid: label };
	}

	// 精确重复判据:cid 不同但「主检索字段+主时间字段」完全一致 —— 导入第四闸的
	// 识别面(默认跳过防重复灌库;Joplin「不查重全新 ID 追加」是社区长期抱怨的反面教材)。
	function isExactDuplicate(item, existing){
		if(!item || !existing){
			return false;
		}
		const nameA = `${item[searchField] || ''}`.trim();
		const nameB = `${existing[searchField] || ''}`.trim();
		if(!nameA || nameA !== nameB){
			return false;
		}
		const timeA = `${item.birth || item.divTime || ''}`.slice(0, 16);
		const timeB = `${existing.birth || existing.divTime || ''}`.slice(0, 16);
		return !!timeA && timeA === timeB;
	}

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
