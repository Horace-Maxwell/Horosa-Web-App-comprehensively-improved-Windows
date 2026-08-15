// 本地记录存储内核 —— 命盘(localcharts)/事盘(localcases)共用的存储机械层单一实现。
//
// [S1 收编由来] 两文件此前是逐函数镜像的孪生复制(getLocalStorage/quota 自救/读写/排序/
// 分页/信封导入导出 ~200 行 ×2,quota 判定另与 safeStorage 重复第三份),任何加固都要改两遍、
// 漂移已实际发生(如 NS_ERROR 名判定)。收编后两壳只保留域层(记录构造/类型表),机械层一处改
// 两面生效。**公开 API 由壳保持,本内核不直接对组件暴露。**
//
// 边界纪律:
// - buildRecord 由壳注入 —— buildLocalChartRecord 被 recordFieldsRestore 哨兵按源码切片
//   锁定(export function…return record; + 两 tab 键扫描),必须原文驻留 localcharts.js。
// - 行为承诺:S1 为逐字搬运,upsert 合并语义({...base,...values} 再重建、命中位 {...旧,...新})
//   与全部返回值/失败语义与搬运前逐字节一致(localRecordStoreParity 金标看守)。
// - [S2/S3] quota 判定与告急清理收编 safeStorage 单源(消第三份复制):清理面从「仅 AI 快照」
//   放宽为 purgeQuotaEmergency(可再生缓存一档 + AI 快照二档)——释放更多空间,写成功率上升。
import { isQuotaError, purgeQuotaEmergency } from './safeStorage';
// [V5-A3] 影子副本:主存(localStorage)成功落盘后镜像到壳层文件(桌面环境;dev/jest no-op)。
// 恢复语义在 shadowMirror.reconcileShadowOnBoot(仅主存缺失时写回,绝不覆盖存在的主存)。
import { mirrorShadowWrite } from './shadowMirror';
// [V5-D11] 版本历史:更新前旧版快照(独立 IDB 库;jest/无 IDB 环境自动内存回退)。
import { pushRecordRevision } from './recordRevisions';

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

// [S7] 记录级 schema 版本 —— 命盘/事盘此前是全仓唯一「有用户数据、无版本、无迁移器」的存储
// (对照:AI 导出设置 v56 normalize 链/AI 工作区 v5)。
// v1 = 历史无 schemaVersion 字段的记录(隐式);v2 = 加盖版本字段,记录形状无其它变化。
// 盖章点在内核 upsert(buildRecord 之后)而非 buildRecord 字面量:①避开 recordFieldsRestore
// 哨兵的两 tab 键扫描面;②charts/cases 一处覆盖;③导入的未来版本记录被重盖为当前版 —— 该记录
// 已被当前版语义重写,盖当前版恰是正确语义。读端宽容(缺字段按 v1)、纯读不回写(零写放大),
// 记录随下次 upsert 触碰自然升版(lazy migration)。
export const LOCAL_RECORD_SCHEMA_VERSION = 2;

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

function getLocalStorage(){
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

// [V 上移/下移] 有效排序键:显式 orderKey 优先,否则 -Date.parse(updateTime)(时间越新键越小
// =越靠前)。手动序与时间序共用同一数轴 —— 无模式切换,新记录(最新)天然仍到顶。
function effOrderKey(r){
	if(r && r.orderKey !== undefined && r.orderKey !== null){
		return Number(r.orderKey);
	}
	return -(Date.parse((r && r.updateTime) || '') || 0);
}

function sortByUpdateTimeDesc(list){
	return list.sort((a, b)=>{
		const ta = Date.parse(a.updateTime || '') || 0;
		const tb = Date.parse(b.updateTime || '') || 0;
		return tb - ta;
	});
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
export function createLocalRecordStore(config){
	const storageKey = config.storageKey;
	const searchField = config.searchField;
	const envelopeFormat = config.envelopeFormat;
	const envelopeListField = config.envelopeListField;
	const buildRecord = config.buildRecord;
	const saveErrorCode = config.saveErrorCode;
	const deleteErrorCode = config.deleteErrorCode;
	const warnLabel = config.warnLabel;
	// [R3 回收站] 独立 trash 键(读端零波及:主 list 天然不含已删):删除=主库移出+trash 追加
	// (带 deletedAt);30 天惰性清理+上限 FIFO;trash 写失败绝不阻断删除主流程。
	const trashKey = config.trashKey || null;
	const TRASH_RETENTION_DAYS = 30;
	const TRASH_MAX = 200;

	let fallbackToMemoryStore = false;
	let fallbackWarned = false;
	let memoryList = [];
	let lastWriteFailed = false;
	let lastFailureReason = null;
	let degradedEventFired = false;
	// [S9] 读缓存:以 raw 原串比对为缓存键(≠dirty 标志 —— 测试/外部直改 localStorage 后
	// 首读 raw 不等必 miss,失效性天然正确,无需 test hook)。本模块写路径是这两个键的全仓
	// 唯一写者;跨窗口本无同步(多实例=多 origin),缓存不会比现状更陈旧。
	// 🔴 契约:命中路径返回的**记录对象跨次共享引用,禁止原地修改**(8 处全表扫描消费点
	// 已逐点审计只读;freeze 审计测试看守)。数组本身每次新切,外部原地 sort 不扰缓存。
	let lastRawText = null;
	let lastParsedList = null;
	let newerSchemaNotified = false;   // [V5-C10] 超版记录提示,每会话一次

	function warnMemoryFallback(){
		if(fallbackWarned){
			return;
		}
		fallbackWarned = true;
		if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
			console.warn(`[horosa] localStorage unavailable, ${warnLabel} data falls back to memory for this session.`);
		}
	}

	// [S4] 存储降级如实上报:每实例每会话至多一次,横幅(LocalStoreHealthBanner)据此提示
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
		// [S9] 命中:免整库 JSON.parse(库大时为主开销;8 处全表扫描消费点零改码受益)。
		if(raw !== null && raw === lastRawText && lastParsedList){
			return lastParsedList.slice();
		}
		const ary = safeParseJson(raw, []);
		if(!(ary instanceof Array)){
			return [];
		}
		// [S7] 迁移链挂点(链空=恒等零开销);未来结构变更在 RECORD_MIGRATIONS 登记即全读端生效。
		const migrated = applyRecordMigrations(ary);
		// [V5-C10] 降级保护:读到比本 app 更高 schemaVersion 的记录(用户降级/多机不同版) ——
		// 未知键保全已保证宽容读不丢字段,此处只补「让用户知道」:每会话一次事件供横幅/健康页,
		// 绝不静默;配合「迁移前强制备份」=降级永远有回头路。
		if(!newerSchemaNotified){
			for(let i = 0; i < migrated.length; i++){
				const sv = parseInt(migrated[i] && migrated[i].schemaVersion, 10) || 1;
				if(sv > LOCAL_RECORD_SCHEMA_VERSION){
					newerSchemaNotified = true;
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

	// [S4 诚实语义] 🔴 此前所有失败分支一律 return true:upsert 的 throw 是死代码、五处
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
	function writeRaw(list){
		writeVersion += 1; // 所有写路径(含内存回退)都经此,先自增再落盘
		const next = list instanceof Array ? list.slice() : [];
		memoryList = next;
		if(fallbackToMemoryStore){
			return { persisted: false, reason: 'memory-mode' };
		}
		const storage = getLocalStorage();
		if(!storage){
			enableMemoryFallback('storage-error');
			return { persisted: false, reason: 'memory-mode' };
		}
		const text = JSON.stringify(next);
		try{
			storage.setItem(storageKey, text);
			lastWriteFailed = false;
			lastFailureReason = null;
			// [S9] 写者即缓存者;失败路径不动缓存(储存上仍是旧串,缓存与之一致)。
			// 🔴 缓存必须存「text 再解析」的对象而非内存对象:buildRecord 的显式 undefined 键
			// (present 才落的技法键/gender)在 JSON 往返中消失、在内存对象里却是 own key ——
			// 直接缓存内存对象会让 `'key' in rec`/Object.keys 判据与储存字节分叉(闭环测试实锤)。
			// 写频=用户动作级,一次 parse 代价可忽略;换来 缓存 ≡ 储存字节 恒等。
			lastRawText = text;
			lastParsedList = JSON.parse(text);
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
		// [V5-D1/D2] 归档三态:默认列表不含已归档(archivedOnly 只看归档;includeArchived 全含);
		// starredOnly=星标筛选维度(与置顶排序位语义分离)。
		if(filter && filter.archivedOnly){
			out = out.filter((r)=>r && r.archived === true);
		}else if(!(filter && filter.includeArchived)){
			out = out.filter((r)=>!(r && r.archived === true));
		}
		if(filter && filter.starredOnly){
			out = out.filter((r)=>r && r.starred === true);
		}
		if(filter && filter.name){
			const name = (filter.name + '').trim().toLowerCase();
			if(name !== ''){
				out = out.filter((item)=>{
					const txt = item && item[searchField] ? (item[searchField] + '').toLowerCase() : '';
					return txt.indexOf(name) >= 0;
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
		// [R4] 事盘类型筛选(精确匹配;命盘记录无 caseType 字段,调用方不会传)。
		if(filter && filter.caseType){
			const ct = filter.caseType + '';
			if(ct !== ''){
				out = out.filter((item)=> item && `${item.caseType || ''}` === ct);
			}
		}
		// [R4] 表头排序:orderBy 缺省=updateTime 倒序(既有全部调用方零变);
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
		const base = idx >= 0 ? all[idx] : {};
		const next = buildRecord({
			...base,
			...(values || {}),
		});
		// [S7] 版本盖章:每次 upsert 重写即按当前版语义盖章(lazy migration 的升版点)。
		next.schemaVersion = LOCAL_RECORD_SCHEMA_VERSION;
		// [V3 制度化·字段保全] 🔴 buildRecord 是**域层归一器,不是白名单过滤器**:凡 values 携带、
		// buildRecord 未枚举的键(内核管理字段 pinTier/pinAt/orderKey、未来版本新字段、外部工具附加
		// 字段)一律原样保全追加 —— 域层枚举键以 buildRecord 归一结果为准(键序在前,金标零变),
		// 未知键按 values 出现序缀尾。杜绝「新增字段忘枚举 → 导入/副本/恢复即丢」整类事故;
		// 全字段往返闸(recordFieldFidelity)以「未来未知键」属性级看守本语义。
		// preserveUpdateTime 是调用控制标志,非记录数据,唯一剔除项。
		Object.keys(values || {}).forEach((k)=>{
			if(k === 'preserveUpdateTime'){
				return;
			}
			if(!(k in next) && values[k] !== undefined){
				next[k] = values[k];
			}
		});
		if(idx >= 0){
			// [V5-D11] 版本历史:更新覆盖前把旧版快照推入独立 IDB 库(fire-and-forget,失败绝不
			// 阻断保存;回收站救「删错」,这里救「改错」)。仅真实内容变更才留版(导入 preserveUpdateTime
			// 的等值覆盖跳过 —— 全量恢复/导入不该刷出一排相同版本)。
			try{
				if(JSON.stringify(all[idx]) !== JSON.stringify({ ...all[idx], ...next })){
					pushRecordRevision(warnLabel, all[idx]);
				}
			}catch(_e){
				// 快照失败无害。
			}
			all[idx] = {
				...all[idx],
				...next,
			};
		}else{
			all.push(next);
		}
		const saved = writeRaw(sortByUpdateTimeDesc(all));
		// [S4] 仅 quota 时抛 —— 既有五处 Modal(models/user.js add/update/saveMemo/addCase/updateCase)
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
	// [V5-D1/D2] 归档/星标:布尔管理字段(true 落键/false 删键=零体积语义;不刷新 updateTime;
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

	// [V5-D3] 使用足迹:载入记录时悄悄记 lastOpenedAt/openCount —— 不刷新 updateTime、
	// 不动排序数轴(effOrderKey 只认 orderKey/updateTime);写失败静默(足迹丢了无害)。
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

	function remove(cid){
		const all = readRaw();
		const found = all.find((item)=> item && item.cid === cid) || null;
		const next = all.filter((item)=> item.cid !== cid);
		const result = writeRaw(next);
		// [S4 留档] remove 维持永不抛:models/user.js deleteChart 无 try/catch,开抛=dva 未捕获
		// effect 异常;删除通常缩体积,quota 失败几无可能,真失败=储存根坏,由降级事件/横幅兜底。
		// (deleteErrorCode 保留在 config 仅作语义占位。)
		// [R3] 主库删除生效(持久化成功或已入内存模式)才移入回收站 —— quota 拒写时主库磁盘
		// 未变,不入 trash 免双份。
		if(found && (result.persisted || result.reason === 'memory-mode')){
			moveToTrash(found);
		}
	}

	// ---------- [R3] 回收站(独立 trash 键;全部 best-effort,绝不阻断主流程) ----------
	function readTrashRaw(){
		if(!trashKey){
			return [];
		}
		const storage = getLocalStorage();
		if(!storage){
			return [];
		}
		try{
			const ary = safeParseJson(storage.getItem(trashKey), []);
			return ary instanceof Array ? ary : [];
		}catch(e){
			return [];
		}
	}

	function writeTrashRaw(list){
		if(!trashKey){
			return false;
		}
		const storage = getLocalStorage();
		if(!storage){
			return false;
		}
		const text = JSON.stringify(list instanceof Array ? list : []);
		try{
			storage.setItem(trashKey, text);
			mirrorShadowWrite(trashKey, text);
			return true;
		}catch(e){
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

	// 30 天惰性清理 + 上限 FIFO(新删在前,超限挤掉最旧)。
	function pruneTrash(list){
		const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 3600 * 1000;
		return list
			.filter((it)=>{
				const t = Date.parse((it && it.deletedAt) || '') || 0;
				return t >= cutoff;
			})
			.slice(0, TRASH_MAX);
	}

	function moveToTrash(record){
		if(!trashKey || !record){
			return;
		}
		const rest = readTrashRaw().filter((it)=> !(it && it.cid === record.cid));
		writeTrashRaw(pruneTrash([{ ...record, deletedAt: nowStr() }, ...rest]));
	}

	function listTrash(){
		const raw = readTrashRaw();
		const pruned = pruneTrash(raw);
		if(pruned.length !== raw.length){
			writeTrashRaw(pruned);   // 惰性清理:有过期才回写(零写放大)
		}
		return pruned;
	}

	// 先恢复后出栈:upsert 抛错(quota)时 trash 原样保留,零丢失。
	// 恢复走 upsert 常规路径 → updateTime 刷新=浮到列表最前,用户立刻看到回来了。
	function restoreFromTrash(cid){
		const trash = readTrashRaw();
		const found = trash.find((it)=> it && it.cid === cid) || null;
		if(!found){
			return null;
		}
		const record = { ...found };
		delete record.deletedAt;
		const restored = upsert(record);
		writeTrashRaw(trash.filter((it)=> !(it && it.cid === cid)));
		return restored;
	}

	// [V5-D5] 删除日志(Anki deleted.txt 模型):永久删除(彻底删除/清空回收站)前把记录 JSON
	// 追加进滚动日志 —— 回收站之后的第二道防线,「从删除日志找回」按 upsert 回灌即可。
	// 上限 500 条 FIFO;写失败静默(日志是防线不是主链)。共用键,charts/cases 混录带 store 标。
	const DELETED_LOG_KEY = 'horosa.deleted.log.v1';

	function appendDeletedLog(records){
		if(!(records instanceof Array) || !records.length){
			return;
		}
		const storage = getLocalStorage();
		if(!storage){
			return;
		}
		try{
			const cur = safeParseJson(storage.getItem(DELETED_LOG_KEY), []);
			const log = (cur instanceof Array ? cur : []);
			records.forEach((r)=>{
				if(r && r.cid){
					log.unshift({ store: warnLabel, purgedAt: nowStr(), record: r });
				}
			});
			storage.setItem(DELETED_LOG_KEY, JSON.stringify(log.slice(0, 500)));
		}catch(_e){
			// 日志写失败无害(quota 紧张时不让防线拖垮主删除动作)。
		}
	}

	function purgeTrashItem(cid){
		const all = readTrashRaw();
		appendDeletedLog(all.filter((it)=>it && it.cid === cid));
		writeTrashRaw(all.filter((it)=> !(it && it.cid === cid)));
	}

	function clearTrash(){
		const all = readTrashRaw();
		appendDeletedLog(all);
		writeTrashRaw([]);
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

	// [S8 闸①] 信封校验:format 存在且不匹配=硬拒(把事盘备份选进命盘口此前是静默 imported:0);
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

	// [S8 闸②] 导入预览:在 upsert 合并语义下逐条判 新增/覆盖合并/非法。
	// seen 集模拟顺序语义(同一备份内重复 cid:首条=新增、后续=覆盖),保证与真实导入逐条一致
	// (恒等式 imported === adds+updates 有属性测试)。纯函数零副作用。
	function previewImportBackup(payload){
		const v = validateBackupEnvelope(payload);
		if(!v.ok){
			return { ok: false, reason: v.reason, adds: 0, updates: 0, invalid: 0, total: v.count || 0, version: v.version };
		}
		const existing = new Set(readRaw().map((r)=>(r && r.cid ? `${r.cid}` : null)).filter(Boolean));
		const seen = new Set();
		let adds = 0;
		let updates = 0;
		let invalid = 0;
		payload[envelopeListField].forEach((item)=>{
			if(!item || typeof item !== 'object'){
				invalid += 1;
				return;
			}
			const cid = item.cid ? `${item.cid}` : null;
			if(cid && (existing.has(cid) || seen.has(cid))){
				updates += 1;
			}else{
				adds += 1;
				if(cid){
					seen.add(cid);
				}
			}
		});
		return { ok: true, reason: v.reason, adds, updates, invalid, total: payload[envelopeListField].length, version: v.version };
	}

	// [V5-D6] 精确重复判据:cid 不同但「主检索字段+主时间字段」完全一致 —— 导入第四闸的
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
	// 同 cid 永远走合并覆盖(既有语义,不受此策略影响)。
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
		let failed = 0;
		let dupSkipped = 0;
		incoming.forEach((item)=>{
			if(!item || typeof item !== 'object'){
				return;
			}
			if(dupStrategy === 'skip' && item.cid){
				const cur = readRaw();
				const sameCid = cur.some((r)=>r && r.cid === item.cid);
				if(!sameCid && cur.some((r)=>isExactDuplicate(item, r))){
					dupSkipped += 1;
					return;
				}
			}
			// [S5] 逐条隔离:单条 quota 抛错计入 failed 继续后续条目(后面更小的记录可能仍成),
			// 不让一条失败把整批导入吃成「文件解析失败」。
			try{
				upsert({
					...item,
					preserveUpdateTime: true,
				});
				imported += 1;
			}catch(e){
				failed += 1;
			}
		});
		const total = readRaw().length;
		return { imported, failed, dupSkipped, total };
	}

	// [S4] 健康态:横幅/诊断消费。mode='memory' 仅在储存根坏(getItem/setItem 非 quota 异常);
	// quota 只置 lastWriteFailed,不降级模式。
	function getHealth(){
		return {
			mode: fallbackToMemoryStore ? 'memory' : 'persistent',
			lastWriteFailed,
			lastFailureReason,
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
	}

	return { list, listTags, getPaged, upsert, remove, setPin, moveRecord, setFlag, touchRecord, exportBackup, importBackup, validateBackupEnvelope, previewImportBackup, getHealth, listTrash, restoreFromTrash, purgeTrashItem, clearTrash, getWriteVersion, __resetForTests };
}
