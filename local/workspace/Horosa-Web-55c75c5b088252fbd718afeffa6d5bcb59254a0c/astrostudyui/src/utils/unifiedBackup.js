// 统一全量备份 v2 —— 「所有信息跨会话滴水不漏」:注册表驱动全键面 + AI 工作区 + 回收站。
//
// 由来:v1 只点名 4 个 raw 键,而全站实际持久化 ~180 键(用户资产/设置大量不在备份面,
// 迁机即丢)。v2 改为 storageKeyRegistry 单一真值源推导备份面,三层防线:
//   ① 注册表逐键分类(user-data/settings 带走;cache/device-local 排除);
//   ② 运行时防呆:扫 localStorage 实际全键,**未登记键默认按用户资产带走**(宁多带不漏),
//      manifest.unknownKeys 留痕;
//   ③ 机械穷举哨兵(storageRegistryCompleteness.test)保证源码新增键必登记。
//
// v2 新段:trash(两回收站,恢复=按 cid 并集保本机) + aiWorkspace(AI 分析 IndexedDB 全
// store dump,恢复=同 id 保本机)。v1 包导入完全兼容(缺段跳过)。
//
// 边界纪律:
// - 🔴 人生事件不 import 它的业务模块:以裸键名+纯 JSON 结构经 safeStorage 操作,键名中性,该键缺席时恒空、自然退化。
// - 🔴 敏感剥离:aiWorkspace 段 providerProfiles 逐条剥 apiKey(listStoreRecords 读端自动
//   解密成明文——原样入包=备份文件泄明文密钥)。恢复端读到空 key 自然走「提示重填」语义。
// - raw 键整值直通(不解析不 normalize)——各键读端自迁移,恢复后首次读取即走既有迁移。
// - 恢复语义:命盘/事盘不删现有,同 cid 两版按更新时间较新的整条胜出(本机较新或一样新保留本机;替换时置顶 / 星标 / 归档等
//   列表状态留本机的;opts.sameCid='backup' 时一律用备份里的),本机在这份备份之后删掉的(还在回收站 / 删除日志里)不带回;
//   raw 设置键整值替换;人生事件按事件 id 并集同 id 保本机(本机删过的不带回);回收站按 cid 并集保本机;AI 工作区同 id 保本机;
//   安全开关(BACKUP_SECURITY_KEYS)缺省每项取本机与备份里较严的一档(不放宽本机,也不让新机停在最宽的缺省)。
// - 设置面完整标记 settingsComplete:导出时本机键面读全了才打。带它的包里没有的设置键 = 来源机
//   为默认 → 恢复时本机多出的同类键复位默认(删键),否则恢复完设置仍混着本机旧值(缺键即默认的
//   紫微设置、新盘种子、你的紫微设置等)。老包没有标记一律不动(分不清「来源为默认」与「老版本没带」)。
// - 导入侧按注册表再过滤:cache/device-local 键即使出现在包里也拒写(手改包防呆)。
// - zip 信封与 AI 工作区备份互为 format 防呆(此处验 format 不符即拒并指路)。
import { parseDateTimeMs } from './dateTimeParse';
import JSZip from 'jszip';
import { isSecretStore, redactSecretRecord } from './aiSecretStores';
import { exportLocalChartsBackup, importLocalChartsBackup, previewLocalChartsBackup, validateLocalChartsBackup, backfillLocalChartsMissingField, countLocalChartsMissingField, getLocalChart, getLocalChartsStoreHealth } from './localcharts';
import { exportLocalCasesBackup, importLocalCasesBackup, previewLocalCasesBackup, validateLocalCasesBackup, getLocalCase, getLocalCasesStoreHealth } from './localcases';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safeStorage';
import { planNewChartSeedsRestore, applyNewChartSeedsRestorePlan, NEW_CHART_SEEDS_RECORD_MISSING_KEY } from './newChartSeeds';
import { recordStorePersisted } from './recordStoreNotice';
import { backfillRevisionsMissingField } from './recordRevisions';
import { trashEntryLive, TRASH_CAP } from './localRecordStore';
import { mirrorZiweiCustomTable } from './ziweiCustomTablesPersist';
import { mirrorShadowWrite } from './shadowMirror';
import { classifyStorageKey, collectBackupKeys } from './storageKeyRegistry';
import { AI_ANALYSIS_STORES, AI_BACKUP_EXCLUDED_STORES, listStoreRecords, getStoreRecord, putStoreRecord, getAiStoreHealth, probeAiStoreHealth } from './aiAnalysisStore';
import { flushStorageWrites, dropPendingStorageWrite } from './deferredStorage';
import { settleBootChartSnapshotAfterRestore } from './bootChartRestore';
import { observeBackupHealth, storeHealthKind, settleBackupIncidentAfterRestore } from './backupIncident';
import { buildManifestChecksums, verifyManifestChecksums, sha256Hex } from './backupChecksum';

export const UNIFIED_BACKUP_FORMAT = 'horosa-unified-backup';
export const UNIFIED_BACKUP_VERSION = 2;
// 版本协商:能读本包所需的最低 reader 版本。minor 演进(只加可选段/reader 保留
// 未知字段)不动它;破坏性变更才升 —— 老 app 读到 minReaderVersion 高于自身时明确拒读
// 并指引升级,绝不静默丢段。
export const UNIFIED_BACKUP_MIN_READER = 1;
export const UNIFIED_MANIFEST_NAME = 'manifest.json';

const LIFE_EVENTS_KEY = 'horosa.lc.lifeEvents.v1';
// 人生事件删除记录 { 事件 id: 删除时刻毫秒 }:恢复备份时你删过的事件不再从备份带回;本键按条目并集合并
const LIFE_EVENTS_TOMBSTONE_KEY = 'horosa.lc.lifeEvents.deleted.v1';
const DELETED_LOG_KEY = 'horosa.deleted.log.v1';   // 删除日志:按条目并集合并(与回收站同为可找回的已删记录,不整值替换)
const DELETED_LOG_MAX = 500;
const TRASH_KEYS = {
	charts: 'horosa.localCharts.trash.v1',
	cases: 'horosa.localCases.trash.v1',
};

// 安全开关(AI 助手行动能力 / 审批档 / 外部客户端档 / 按名禁用 / 联网 / 私人内容可读 …):全量恢复缺省**每项取本机与备份里较严的一档** ——
// 备份里较宽的值不放宽本机(来源机开着的,恢复后本机不会直接全开);本机是最宽的缺省时(换新机 / 存储被清后从自动备份找回),
// 来源机收紧过的照样收紧(此前一律保留本机 = 停在全自动写入、外部客户端免确认、禁用名单清空)。
// 设置面完整的包里没有这项 = 来源机是缺省,按缺省比;老包里没有这项分不清来源,本机的不动。
// 无头导入要整值一并恢复(可放宽)显式 --include-security(opts.includeSecurity)。
export const BACKUP_SECURITY_KEYS = [
	'horosa.ai.agent.enabled', 'horosa.ai.agent.approval', 'horosa.ai.agent.approval.categories.v1', 'horosa.ai.agent.trust.records.v1',
	'horosa.ai.agent.toolPolicy.v1', 'horosa.ai.agent.external.policy.v1', 'horosa.ai.tools.external.enabled', 'horosa.ai.tools.webSearch.enabled',
	'horosa.ai.tools.webFetch.enabled', 'horosa.ai.tools.headless.enabled', 'horosa.ai.tools.privateRead.enabled', 'horosa.ai.tasks.goal.enabled',
	'horosa.ai.tasks.scheduler.enabled', 'horosa.ai.automation.enabled', 'horosa.ai.orchestrate.enabled',
	'horosa.ai.subjectFacts.v1',
];
// 与 AI 分析「进阶」页上的名字一致
const SECURITY_SHORT_NAMES = {
	'horosa.ai.agent.enabled': 'AI 助手行动能力',
	'horosa.ai.agent.approval': '写入动作审批',
	'horosa.ai.agent.approval.categories.v1': '按类别收紧审批',
	'horosa.ai.agent.trust.records.v1': '信任的档案',
	'horosa.ai.agent.toolPolicy.v1': '按工具名放行 / 禁用',
	'horosa.ai.agent.external.policy.v1': '外部客户端审批',
	'horosa.ai.tools.external.enabled': '接入外部 MCP 服务器',
	'horosa.ai.tools.webSearch.enabled': '联网检索',
	'horosa.ai.tools.webFetch.enabled': '网页读取',
	'horosa.ai.tools.headless.enabled': '无头分析出口',
	'horosa.ai.tools.privateRead.enabled': '私人内容可读',
	'horosa.ai.tasks.goal.enabled': '目标任务',
	'horosa.ai.tasks.scheduler.enabled': '定时任务',
	'horosa.ai.automation.enabled': '自动规则',
	'horosa.ai.orchestrate.enabled': '多技法并行分析',
	'horosa.ai.subjectFacts.v1': '命主实况按命盘发送',
};
export const SECURITY_ROW_LABEL = 'AI 助手权限类开关';
export const SECURITY_STRICTER_DETAIL = '每项取本机与备份里较严的一档，不会放宽本机';
// opts:{ includeSecurity }(显式要整值一并恢复安全开关)· { keepLocalKeys:[键…] }(另外要保留本机值的键)
function keptLocalKeySet(opts){
	const o = opts || {};
	const out = new Set(Array.isArray(o.keepLocalKeys) ? o.keepLocalKeys : []);
	if(!o.includeSecurity){ BACKUP_SECURITY_KEYS.forEach((k)=>out.add(k)); }
	return out;
}

// ── 安全开关「较严的一档」 ─────────────────────────────────────────────────────
// 各键的取值与缺省与 aiAgent/prefs.js 一致(这里只做纯比较,不 import 设置模块):
//   开关类:'1' 才算开,其余 / 缺省 = 关;关比开严
//   写入动作审批:never < on-request < read-only(缺省 never)
//   按类别收紧审批:每类 inherit / never 都不收紧,on-request < read-only(缺省全 inherit)
//   信任的档案:列表越短越严 → 取两边都信任的(交集)
//   按工具名放行 / 禁用:禁用取并集,放行取交集(且不含禁用的)
//   外部客户端审批:auto < on-request < read-only;每分钟调用上限 / 每小时写入上限取小的;「界面类也要确认」任一边开就开
//   命主实况发送(按命盘):哪张盘发越少越严 → 只留两边都开着的命盘(交集;缺省 = 一张都不发)
const SECURITY_ON_OFF_KEYS = [
	'horosa.ai.agent.enabled', 'horosa.ai.tools.external.enabled', 'horosa.ai.tools.webSearch.enabled', 'horosa.ai.tools.webFetch.enabled',
	'horosa.ai.tools.headless.enabled', 'horosa.ai.tools.privateRead.enabled', 'horosa.ai.tasks.goal.enabled', 'horosa.ai.tasks.scheduler.enabled',
	'horosa.ai.automation.enabled', 'horosa.ai.orchestrate.enabled',
];
const APPROVAL_RANK = { never: 0, 'on-request': 1, 'read-only': 2 };
const CATEGORY_RANK = { inherit: 0, never: 0, 'on-request': 1, 'read-only': 2 };
const EXTERNAL_RANK = { auto: 0, 'on-request': 1, 'read-only': 2 };
const EXTERNAL_DEFAULTS = { approval: 'auto', maxCallsPerMinute: 60, maxAdditivePerHour: 100, uiConfirm: false };
const TOOL_POLICY_MAX = 64;
function parseJsonLoose(text){
	if(text === null || text === undefined){ return null; }
	try{ return JSON.parse(`${text}`); }catch(e){ return null; }
}
function clampNum(v, min, max, d){
	const n = Number(v);
	if(!Number.isFinite(n)){ return d; }
	return Math.min(max, Math.max(min, Math.round(n)));
}
function normExternal(text){
	const r = parseJsonLoose(text);
	const o = r && typeof r === 'object' && !Array.isArray(r) ? r : {};
	return {
		approval: EXTERNAL_RANK[o.approval] !== undefined ? o.approval : EXTERNAL_DEFAULTS.approval,
		maxCallsPerMinute: clampNum(o.maxCallsPerMinute, 1, 600, EXTERNAL_DEFAULTS.maxCallsPerMinute),
		maxAdditivePerHour: clampNum(o.maxAdditivePerHour, 0, 10000, EXTERNAL_DEFAULTS.maxAdditivePerHour),
		uiConfirm: o.uiConfirm === true,
	};
}
function normNameList(list){
	const out = [];
	(Array.isArray(list) ? list : []).forEach((x)=>{ const n = `${x === null || x === undefined ? '' : x}`.trim(); if(n && out.indexOf(n) < 0){ out.push(n); } });
	return out;
}
function normToolPolicy(text){
	const r = parseJsonLoose(text);
	const o = r && typeof r === 'object' && !Array.isArray(r) ? r : {};
	const deny = normNameList(o.deny);
	return { allow: normNameList(o.allow).filter((n)=>deny.indexOf(n) < 0), deny };
}
function normCategories(text){
	const r = parseJsonLoose(text);
	const o = r && typeof r === 'object' && !Array.isArray(r) ? r : {};
	const out = {};
	Object.keys(o).forEach((c)=>{ if(CATEGORY_RANK[o[c]] !== undefined){ out[c] = o[c]; } });
	return out;
}
const sameJson = (a, b)=>JSON.stringify(a) === JSON.stringify(b);

// 本机与备份里较严的那一档(原始串;null = 缺省、不留这把键)。与本机等严时原样返回本机的串(不写盘、不改格式)。
// localRaw / backupRaw:null = 这一边是缺省
export function stricterSecurityValue(key, localRaw, backupRaw){
	if(SECURITY_ON_OFF_KEYS.indexOf(key) >= 0){
		if(localRaw !== '1' || backupRaw === '1'){ return localRaw; }
		return '0';
	}
	if(key === 'horosa.ai.agent.approval'){
		const rl = APPROVAL_RANK[localRaw] !== undefined ? APPROVAL_RANK[localRaw] : 0;
		const rb = APPROVAL_RANK[backupRaw] !== undefined ? APPROVAL_RANK[backupRaw] : 0;
		return rb > rl ? backupRaw : localRaw;
	}
	if(key === 'horosa.ai.agent.approval.categories.v1'){
		const l = normCategories(localRaw);
		const b = normCategories(backupRaw);
		const out = { ...l };
		let changed = false;
		Object.keys(b).forEach((c)=>{
			if(CATEGORY_RANK[b[c]] > (CATEGORY_RANK[l[c]] !== undefined ? CATEGORY_RANK[l[c]] : 0)){ out[c] = b[c]; changed = true; }
		});
		return changed ? JSON.stringify(out) : localRaw;
	}
	if(key === 'horosa.ai.agent.trust.records.v1'){
		const l = parseJsonLoose(localRaw);
		const b = parseJsonLoose(backupRaw);
		const ll = normNameList(l);
		const bl = Array.isArray(b) ? normNameList(b) : [];
		const both = ll.filter((c)=>bl.indexOf(c) >= 0);
		return both.length === ll.length ? localRaw : JSON.stringify(both);
	}
	if(key === 'horosa.ai.agent.toolPolicy.v1'){
		const l = normToolPolicy(localRaw);
		const b = normToolPolicy(backupRaw);
		const deny = normNameList([...l.deny, ...b.deny]).slice(0, TOOL_POLICY_MAX);
		const allow = l.allow.filter((n)=>b.allow.indexOf(n) >= 0 && deny.indexOf(n) < 0);
		return sameJson({ allow, deny }, l) ? localRaw : JSON.stringify({ allow, deny });
	}
	if(key === 'horosa.ai.subjectFacts.v1'){
		const pick = (raw)=>{
			const r = parseJsonLoose(raw);
			const by = r && typeof r === 'object' && !Array.isArray(r) && r.bySubject && typeof r.bySubject === 'object' && !Array.isArray(r.bySubject) ? r.bySubject : {};
			return Object.keys(by).filter((c)=>by[c] === true);
		};
		const l = pick(localRaw);
		const b = pick(backupRaw);
		const both = l.filter((c)=>b.indexOf(c) >= 0);
		if(both.length === l.length){ return localRaw; }
		if(!both.length){ return null; }
		const bySubject = {};
		both.forEach((c)=>{ bySubject[c] = true; });
		return JSON.stringify({ bySubject });
	}
	if(key === 'horosa.ai.agent.external.policy.v1'){
		const l = normExternal(localRaw);
		const b = normExternal(backupRaw);
		const out = {
			approval: EXTERNAL_RANK[b.approval] > EXTERNAL_RANK[l.approval] ? b.approval : l.approval,
			maxCallsPerMinute: Math.min(l.maxCallsPerMinute, b.maxCallsPerMinute),
			maxAdditivePerHour: Math.min(l.maxAdditivePerHour, b.maxAdditivePerHour),
			uiConfirm: l.uiConfirm || b.uiConfirm,
		};
		return sameJson(out, l) ? localRaw : JSON.stringify(out);
	}
	return localRaw;
}

// 安全开关逐项计划:{ considered:[键…](参与比较的),changes:[{key,value}](要按备份收紧的;value null = 删键) }
// 备份里有这项 → 与本机比;设置面完整的包里没有 → 来源机为缺省,按缺省比;老包里没有 / 校验和不符 → 分不清,本机不动;
// keepLocal(opts.keepLocalKeys)里的键调用方要原样保留本机的,也不比
function securityPlan(manifest, untrusted, keepLocal){
	const raw = manifest && manifest.raw && typeof manifest.raw === 'object' ? manifest.raw : {};
	const complete = !!(manifest && manifest.settingsComplete === true);
	const bad = new Set([...(untrusted || []), ...(Array.isArray(keepLocal) ? keepLocal : [])]);
	const considered = [];
	const changes = [];
	BACKUP_SECURITY_KEYS.forEach((k)=>{
		if(bad.has(k)){ return; }
		const has = Object.prototype.hasOwnProperty.call(raw, k) && raw[k] !== null && raw[k] !== undefined;
		if(!has && !complete){ return; }
		const localRaw = safeLocalStorageGet(k);
		const v = stricterSecurityValue(k, localRaw, has ? `${raw[k]}` : null);
		if(has || localRaw !== null || v !== localRaw){ considered.push(k); }
		if(v !== localRaw){ changes.push({ key: k, value: v }); }
	});
	return { considered, changes };
}

// 安全开关那一行(预览 / 结果同一句):哪几项按备份收紧、哪几项保留本机的。failed = 写不进的键(结果侧)
function securityRow(plan, done, failed){
	if(!plan || !plan.considered.length){ return null; }
	const name = (k)=>SECURITY_SHORT_NAMES[k] || rawLabel(k);
	const changedKeys = plan.changes.map((c)=>c.key);
	const tightened = changedKeys.filter((k)=>!(failed || []).includes(k));
	const keptKeys = plan.considered.filter((k)=>changedKeys.indexOf(k) < 0);
	const parts = [];
	if(tightened.length){ parts.push(`${tightened.map(name).join('、')}${done ? '已' : ''}按备份收紧`); }
	if(keptKeys.length){ parts.push(`${keptKeys.map(name).join('、')}保留本机的`); }
	if(failed && failed.length){ parts.push(`${failed.map(name).join('、')}没能保存（可能是存储空间不足），仍是本机原来的`); }
	return { key: 'security', label: SECURITY_ROW_LABEL, detail: `${SECURITY_STRICTER_DETAIL}：${parts.join('；')}`, keys: plan.considered.slice(), ok: !(failed && failed.length) };
}

// 已发布的旧版本导出的包:紫微晚子时的「已升级」记号当时不随备份走(包里没有「设置面完整」这一字段的都是那时的包)。
// 包里晚子时是「子初换日(强制)」、又是在晚子时默认值改为「跟随全局」那一版发布之后导出的 → 那是你亲手选的,恢复时补上记号,
// 不让下次打开紫微时被当旧默认改成跟随全局。代价:来源机升级后从没打开过紫微页的,旧默认会被当成亲手选的。
const ZIWEI_LATE_ZI_KEY = 'ziweiLateZi';
const ZIWEI_LATE_ZI_FLAG = 'ziweiLateZiMigrated';
const LATE_ZI_DEFAULT_CHANGED_AT = parseDateTimeMs('2026-08-09T06:17:42Z');
export function lateZiFlagNeeded(manifest, raw){
	const r = raw || (manifest && manifest.raw) || {};
	if(!manifest || manifest.settingsComplete !== undefined){ return false; }
	if(!Object.prototype.hasOwnProperty.call(r, ZIWEI_LATE_ZI_KEY) || `${r[ZIWEI_LATE_ZI_KEY]}` !== 'zi_chu'){ return false; }
	if(Object.prototype.hasOwnProperty.call(r, ZIWEI_LATE_ZI_FLAG)){ return false; }
	const at = parseDateTimeMs(manifest.exportedAt || '');
	return Number.isFinite(at) && at >= LATE_ZI_DEFAULT_CHANGED_AT;
}
const LATE_ZI_FLAG_DETAIL = '备份来自旧版本：保留你在备份里选的紫微晚子时「子初换日（强制）」';

// 预览 / 结果行的中文名(结果行补 label:失败提示列中文名,不露内部键名)
export function restoreRowLabel(key){
	const k = `${key || ''}`;
	const fixed = { charts: '命盘', cases: '事盘', 'trash.charts': '命盘回收站', 'trash.cases': '事盘回收站', trash: '回收站', aiWorkspace: 'AI 分析工作区', security: '安全开关', 'newChartSeeds.remerge': '新命盘默认设置' };
	if(fixed[k]){ return fixed[k]; }
	if(k.indexOf('newChartSeeds.backfill.') === 0){ return '本机旧命盘'; }
	if(k.indexOf('raw.') === 0){ return rawLabel(k.slice(4)); }
	return rawLabel(k);
}

function rawLabel(k){
	const e = classifyStorageKey(k);
	if(e && e.label){
		return e.label;
	}
	return '其它数据';   // 存储键名不进界面文字(预览行把它放在悬停提示里)
}

// 基础段(同步,localStorage 面):raw 面 = 注册表 backup:true 全键 + 未登记键(防呆带走)。
export function buildUnifiedBackupManifest(){
	// 还在空闲队列里的延迟写(各页视图状态、AI 快照等)先落盘:导出读的是存储,刚改完立刻导出时最近一次改动要进包
	try{ flushStorageWrites(); }catch(e){ /* 刷盘失败:按存储现值导出 */ }
	const { rawKeys, unknownKeys, complete } = collectBackupKeys();
	const raw = {};
	let readMiss = false;
	[...rawKeys, ...unknownKeys].forEach((k)=>{
		const v = safeLocalStorageGet(k);
		if(v !== null && v !== undefined){
			raw[k] = v;
		}else{
			readMiss = true;
		}
	});
	const trash = {};
	Object.keys(TRASH_KEYS).forEach((slot)=>{
		const v = safeLocalStorageGet(TRASH_KEYS[slot]);
		if(v !== null && v !== undefined){
			trash[slot] = v;
		}
	});
	return {
		format: UNIFIED_BACKUP_FORMAT,
		version: UNIFIED_BACKUP_VERSION,
		minReaderVersion: UNIFIED_BACKUP_MIN_READER,
		exportedAt: new Date().toISOString(),
		charts: exportLocalChartsBackup(),
		cases: exportLocalCasesBackup(),
		raw,
		unknownKeys,
		trash,
		settingsComplete: complete === true && !readMiss,
	};
}

// AI 工作区段(async,IndexedDB 面):全 store dump;providerProfiles 剥明文 apiKey。
// IDB 整体不可用/单 store 失败 → 尽力而为(缺 store 不阻断其余;全空返回 null 段)。
export async function collectAiWorkspaceDump(){
	const stores = {};
	let any = false;
	// 派生缓存不入包(体积大且恢复后按 sourceUpdatedAt 立刻失效)。
	const names = Object.values(AI_ANALYSIS_STORES).filter((n)=>AI_BACKUP_EXCLUDED_STORES.indexOf(n) < 0);
	for(let i=0; i<names.length; i++){
		const name = names[i];
		try{
			// eslint-disable-next-line no-await-in-loop
			let list = await listStoreRecords(name);
			if(!Array.isArray(list)){
				list = [];
			}
			// 带密钥的店按单源 AI_SECRET_STORES 穷举剥密(此前硬写两个店名;新增带密钥店会原样进包)
			if(isSecretStore(name)){
				list = list.map((rec)=>redactSecretRecord(rec));
			}
			stores[name] = list;
			if(list.length){
				any = true;
			}
		}catch(e){
			// 单 store 读失败:跳过,不阻断其余。
		}
	}
	return any ? { stores } : null;
}

// manifest 可传入已组好的(导出前要先看它的降级标记再提示用户);不传则现组一份
export async function buildUnifiedBackupBlob(prebuilt){
	const manifest = prebuilt && typeof prebuilt === 'object' ? prebuilt : await buildFullUnifiedManifest();
	const zip = new JSZip();
	zip.file(UNIFIED_MANIFEST_NAME, JSON.stringify(manifest));
	return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// 完整 manifest(含 aiWorkspace 段与分段校验和)。checksums 在全部数据段就绪后计算,
// 覆盖 charts/cases/trash/raw 逐键/aiWorkspace —— 恢复端逐段复核,坏段指认而非整包拒收。
export async function buildFullUnifiedManifest(){
	const manifest = buildUnifiedBackupManifest();
	let aiRead = false;
	try{
		manifest.aiWorkspace = await collectAiWorkspaceDump();
		aiRead = true;
	}catch(e){
		manifest.aiWorkspace = null;
	}
	// AI 工作区读不开(装过更新版本又回退 = 库版本更高;或数据库打不开)时,上面读到的是内存里的空库:
	// 包里如实标出「这一段没读到」,而不是静默当「没有 AI 数据」(此前看不出区别,自动备份照常轮转、出事前的好包被挤掉)
	const aiHealth = getAiStoreHealth();
	if(aiHealth && aiHealth.degraded){
		manifest.aiWorkspaceUnavailable = { reason: aiHealth.reason || 'open-failed' };
	}
	const degraded = backupDegradedSections(manifest, { aiObserved: aiRead && !!aiHealth });
	if(degraded.length){ manifest.degraded = degraded; }
	manifest.checksums = buildManifestChecksums(manifest);
	return manifest;
}

// 这份备份打包时哪些段的来源不健康(自动备份据此在文件名标出、GFS 修剪永远留最近一份健康的):
//   aiWorkspace —— AI 工作区读不开(内存回退);charts / cases —— 记录库只在内存(存储不可用)或主存内容坏了(含已从空库开始)。
// 本次运行查到的不健康段记进持久的「出事」标记(backupIncident,按段记类型);重启后健康态归零,标记里还在的段照样标出。
// 问题消失即自动清那一段(backupIncident.INCIDENT_AUTO_CLEAR:影子写回 / AI 库读得开 / 换了一次运行存储正常);
// 从空库开始过的(reset)要成功恢复或点「已处理」才清。opts.aiObserved:这次确实试开过 AI 库(没标不可用 = 读得开)。
export function backupDegradedSections(manifest, opts){
	const out = [];
	const observed = {};
	let at = 0;
	if(manifest && manifest.aiWorkspaceUnavailable){ out.push('aiWorkspace'); observed.aiWorkspace = 'unavailable'; }
	else if(opts && opts.aiObserved){ observed.aiWorkspace = 'ok'; }
	[['charts', getLocalChartsStoreHealth], ['cases', getLocalCasesStoreHealth]].forEach(([name, fn])=>{
		try{
			const h = fn();
			const kind = storeHealthKind(h);
			observed[name] = kind;
			if(kind !== 'ok'){
				out.push(name);
				const t = h.corrupt && Number(h.corrupt.at);
				if(t > 0 && (!at || t < at)){ at = t; }
			}
		}catch(e){ /* 查不到健康态:不标、也不算观察到 */ }
	});
	let incident = null;
	try{ incident = observeBackupHealth(observed, at || undefined); }catch(e){ incident = null; }
	if(incident && Array.isArray(incident.sections)){
		incident.sections.forEach((s)=>{ if(out.indexOf(s) < 0){ out.push(s); } });
	}
	return out;
}

// AI 工作区读不开时的说明(导出提示 / 恢复结果行共用)
export function aiWorkspaceUnavailableText(reason){
	return reason === 'version'
		? '本机的 AI 分析工作区是更新版本的软件建的，当前版本打不开（只在内存里临时用）'
		: 'AI 分析工作区的数据库打不开（只在内存里临时用；可能是磁盘或权限问题）';
}

// 内容指纹:同上次备份内容全等则跳过写盘(去重)。基于 checksums 段整体哈希
// (exportedAt 不参与 —— 只看数据本体是否变化)。
export function manifestContentFingerprint(manifest){
	return sha256Hex(JSON.stringify(manifest.checksums || {}));
}

// input: Blob | ArrayBuffer | Uint8Array(JSZip.loadAsync 均支持)。解析失败/缺 manifest → null。
export async function parseUnifiedBackupBlob(input){
	let zip = null;
	try{
		zip = await JSZip.loadAsync(input);
	}catch(e){
		return null;
	}
	const entry = zip.file(UNIFIED_MANIFEST_NAME);
	if(!entry){
		return null;
	}
	try{
		return JSON.parse(await entry.async('string'));
	}catch(e){
		return null;
	}
}

export function validateUnifiedBackup(manifest){
	if(!manifest || typeof manifest !== 'object'){
		return { ok: false, reason: 'not-object', version: 0 };
	}
	const format = manifest.format === undefined || manifest.format === null ? null : `${manifest.format}`;
	if(format !== UNIFIED_BACKUP_FORMAT){
		return { ok: false, reason: 'format-mismatch', format, version: 0 };
	}
	const version = parseInt(manifest.version, 10) || 0;
	// 版本协商硬闸:包声明的最低 reader 版本高于本 app 能力 → 明确拒读并指引升级,
	// 绝不部分导入静默丢段。
	const minReader = parseInt(manifest.minReaderVersion, 10) || 0;
	if(minReader > UNIFIED_BACKUP_VERSION){
		return { ok: false, reason: 'reader-too-old', version, minReader };
	}
	const hasAny = !!(manifest.charts || manifest.cases
		|| (manifest.raw && typeof manifest.raw === 'object' && Object.keys(manifest.raw).length)
		|| (manifest.trash && typeof manifest.trash === 'object' && Object.keys(manifest.trash).length)
		|| (manifest.aiWorkspace && typeof manifest.aiWorkspace === 'object'));
	if(!hasAny){
		return { ok: false, reason: 'empty', version };
	}
	// 版本在前、校验和在后,两条可同时成立 → reasons 全列(界面两条都提示;reason = 第一条,旧调用方照用)。
	// 分段校验和复核:坏段列名(恢复端逐段隔离,好段照常恢复);无 checksums 的老包宽容(legacy)。
	// 此前先判校验和就返回:更新版本写的包同时有坏段时,「来自更新版本」的提示丢了
	const reasons = [];
	if(version > UNIFIED_BACKUP_VERSION){ reasons.push('newer-version'); }
	const integrity = verifyManifestChecksums(manifest);
	if(!integrity.ok){ reasons.push('checksum-bad'); }
	return { ok: true, reason: reasons[0] || null, reasons, version, ...(integrity.ok ? {} : { badSections: integrity.badSections }) };
}

// 导入侧 raw 键三态:'merge'(lifeEvents 特判)/'replace'(登记 backup:true 或未登记=防呆收下)/
// 'reject'(cache/device-local——正常包不含,手改包防呆拒写)。
function rawImportMode(k){
	if(k === LIFE_EVENTS_KEY){
		return 'merge';
	}
	if(k === DELETED_LOG_KEY){
		return 'merge-log';
	}
	if(k === LIFE_EVENTS_TOMBSTONE_KEY){
		return 'merge-tomb';
	}
	const e = classifyStorageKey(k);
	if(!e){
		return 'replace';
	}
	if(e.backup === true && e.restoreMerge && typeof e.restoreMerge === 'object'){
		return 'merge-list';
	}
	return e.backup === true ? 'replace' : 'reject';
}

// 用户资产列表 / 映射的通用并集(注册表 restoreMerge 声明形状):本机条目全留、同一条保本机;包里本机没有的条目补进来;
// 有上限的本机先占容量、剩余按时间取包里较新的;最后按声明的顺序排。坏形状跳过不写(本机不动)。
// 预览与执行同一个函数(opts.dryRun)。此前整值替换:恢复较早的包把之后新增的择日方案 / 塔罗日志 / 书签整批冲掉
const LIST_MERGE_DETAIL = '与本机合并：本机已有的保留，备份里本机没有的补进来';
// 规格的身份:id 为字段名数组 = 一组身份字段;为数组的数组 = 几组身份任一组相同即「同一条」
// (择日方案:id 相同(改过名)或名字相同(同名再存换了新 id)都算同一条)。身份值去首尾空白再比(各 store 写入时同样 trim)
export function restoreMergeIdentities(spec){
	const id = spec && spec.id;
	if(!Array.isArray(id) || !id.length){ return []; }
	return Array.isArray(id[0]) ? id.filter((t)=>Array.isArray(t) && t.length) : [id];
}
function mergeArrayLists(localList, incomingList, spec){
	const tuples = restoreMergeIdentities(spec);
	const idsOf = (x)=>{
		if(!x || typeof x !== 'object'){ return null; }
		if(!tuples.length){ return [JSON.stringify(x)]; }
		const out = [];
		tuples.forEach((fields, ti)=>{
			const parts = fields.map((f)=>(x[f] === undefined || x[f] === null ? '' : `${x[f]}`.trim()));
			if(!parts.every((v)=>v === '')){ out.push(`${ti}\u0002${parts.join('\u0001')}`); }
		});
		return out.length ? out : [JSON.stringify(x)];
	};
	const local = localList.filter((x)=>x !== undefined && x !== null);
	const seen = new Set();
	local.forEach((x)=>{ (idsOf(x) || []).forEach((v)=>seen.add(v)); });
	const added = [];
	incomingList.forEach((x)=>{
		const ids = idsOf(x);
		if(ids === null || ids.some((v)=>seen.has(v))){ return; }
		ids.forEach((v)=>seen.add(v));
		added.push(x);
	});
	const timeOf = (x)=>{
		const v = spec && spec.time && x && typeof x === 'object' ? x[spec.time] : undefined;
		if(typeof v === 'number'){ return v; }
		const t = parseDateTimeMs(`${v || ''}`);
		return Number.isFinite(t) ? t : `${v || ''}`;
	};
	const cmpDesc = (a, b)=>{ const ta = timeOf(a); const tb = timeOf(b); return ta === tb ? 0 : (ta < tb ? 1 : -1); };
	const all = [...local, ...added];
	let dropped = 0;
	let kept = all;
	const cap = Number(spec && spec.cap) > 0 ? Number(spec.cap) : 0;
	if(cap){
		const byTime = spec && spec.time ? all.map((x, i)=>({ x, i })).sort((a, b)=>cmpDesc(a.x, b.x) || a.i - b.i).map((o)=>o.x) : all;
		const capped = capLocalFirst(byTime, local, cap);
		const keepSet = new Set(capped.list);
		kept = all.filter((x)=>keepSet.has(x));
		dropped = capped.dropped;
	}
	if(spec && spec.time && spec.order === 'newest-first'){
		kept = kept.map((x, i)=>({ x, i })).sort((a, b)=>cmpDesc(a.x, b.x) || a.i - b.i).map((o)=>o.x);
	}else if(spec && spec.time && spec.order === 'oldest-first'){
		kept = kept.map((x, i)=>({ x, i })).sort((a, b)=>cmpDesc(b.x, a.x) || a.i - b.i).map((o)=>o.x);
	}
	return { list: kept, added: added.length - dropped, dropped };
}
export function mergeListRaw(key, incomingRaw, opts){
	const e = classifyStorageKey(key);
	const spec = e && e.restoreMerge;
	if(!spec || typeof spec !== 'object'){ return mergeStatus(MERGE_SHAPE); }
	let incoming;
	try{ incoming = JSON.parse(`${incomingRaw}`); }catch(err){ return mergeStatus(MERGE_SHAPE); }
	let local;
	const localText = safeLocalStorageGet(key);
	try{ local = localText ? JSON.parse(localText) : null; }catch(err){ local = null; }
	let out;
	let dropped = 0;
	if(spec.shape === 'array'){
		if(!Array.isArray(incoming)){ return mergeStatus(MERGE_SHAPE); }
		const r = mergeArrayLists(Array.isArray(local) ? local : [], incoming, spec);
		out = r.list;
		dropped = r.dropped;
	}else if(spec.shape === 'map'){
		if(!incoming || typeof incoming !== 'object' || Array.isArray(incoming)){ return mergeStatus(MERGE_SHAPE); }
		const base = local && typeof local === 'object' && !Array.isArray(local) ? local : {};
		out = { ...incoming, ...base };
	}else if(spec.shape === 'fields'){
		if(!incoming || typeof incoming !== 'object' || Array.isArray(incoming)){ return mergeStatus(MERGE_SHAPE); }
		const base = local && typeof local === 'object' && !Array.isArray(local) ? local : null;
		out = base ? { ...incoming, ...base } : { ...incoming };
		Object.keys(spec.fields || {}).forEach((f)=>{
			const inList = Array.isArray(incoming[f]) ? incoming[f] : [];
			const locList = base && Array.isArray(base[f]) ? base[f] : [];
			const r = mergeArrayLists(locList, inList, spec.fields[f]);
			out[f] = r.list;
			dropped += r.dropped;
		});
	}else{
		return mergeStatus(MERGE_SHAPE);
	}
	if(opts && opts.dryRun){ return mergeStatus(MERGE_OK, dropped); }
	dropPendingStorageWrite(key);
	return safeLocalStorageSet(key, JSON.stringify(out)) ? mergeStatus(MERGE_OK, dropped) : mergeStatus(MERGE_QUOTA);
}

// raw 值形状:必须是字符串(存储里只有字符串;对象 / 数字 / null 整值写进去会变成 "[object Object]" / "42" / "null",
// 等于把这项设置清成乱值);注册表标 format: 'json' 的键还要解析得出。手改 / 别的程序生成的半坏包才会有这种值。
// 运行时兜底(注册表声明为 text、或没登记的键):本机现值是 JSON 对象 / 数组、备份里的值却解析不出 → 同样算格式不对 ——
// 声明错了也不把本机一份有效的结构化数据整值换成坏串(随备份走的设置 / 用户数据键 format 必须显式声明,合同测试锁)。
export function rawValueShapeOk(k, v){
	if(typeof v !== 'string'){ return false; }
	const e = classifyStorageKey(k);
	if(e && e.format === 'json'){
		try{ JSON.parse(v); }catch(err){ return false; }
		return true;
	}
	let local = null;
	try{ local = safeLocalStorageGet(k); }catch(err){ local = null; }
	if(typeof local === 'string' && /^\s*[[{]/.test(local)){
		let structured = false;
		try{ const o = JSON.parse(local); structured = !!o && typeof o === 'object'; }catch(err){ structured = false; }
		if(structured){
			try{ JSON.parse(v); }catch(err){ return false; }
		}
	}
	return true;
}
const RAW_SHAPE_PREVIEW = '备份里这一项的格式不对，将跳过（本机数据不动）';
const RAW_SHAPE_DETAIL = '备份里这一项的格式不对，已跳过，本机数据不动';

// 本机多出的设置键(包带设置面完整标记时):登记为 settings 且随备份、本机有而包里没有 → 恢复时复位默认。
// 按原始 raw 键集判(校验和不符被跳过的键也算「包里有」,不复位)。
export function localSettingsKeysToReset(manifest){
	if(!manifest || manifest.settingsComplete !== true || !manifest.raw || typeof manifest.raw !== 'object'){
		return [];
	}
	const out = [];
	try{
		const n = window.localStorage.length;
		for(let i=0; i<n; i++){
			const k = window.localStorage.key(i);
			if(!k || Object.prototype.hasOwnProperty.call(manifest.raw, k)){
				continue;
			}
			const e = classifyStorageKey(k);
			if(e && e.kind === 'settings' && e.backup === true && e.keepOnRestore !== true){
				out.push(k);
			}
		}
	}catch(e){
		return [];
	}
	return out.sort();
}

const SETTINGS_RESET_PREVIEW = '备份里没有这项（来源为默认），恢复后本机复位默认';
const SEED_REMERGE_PREVIEW = '备份来自旧版本：恢复后把备份里的七政宿度制、宿占人事十二宫起宫、主限设置合并进新命盘默认设置（已有的不动）';
// 命盘 / 事盘导入预览行:同一 ID 两版谁胜写清楚(较新的整条胜出,本机较新或一样新保留本机;或一律用备份里的)
function recordImportPreviewDetail(p){
	const parts = [`新增 ${p.adds} 条`];
	if(p.updates){
		parts.push(p.sameCid === 'backup'
			? `同一 ID 的 ${p.updates} 条一律用备份里的（整条替换本机的）`
			: `同一 ID 备份里较新的 ${p.updates} 条整条替换本机的（置顶、星标、归档等列表状态留本机的）`);
	}
	if(p.keptLocal){ parts.push(`同一 ID 本机较新或一样新的 ${p.keptLocal} 条保留本机的`); }
	if(p.skippedDeleted){ parts.push(`本机在这份备份之后删掉的 ${p.skippedDeleted} 条不带回（仍在回收站或删除日志里）`); }
	if(p.dupSkips){ parts.push(`与本机已有记录同名同生辰跳过 ${p.dupSkips} 条`); }
	return parts.join('、');
}
// 恢复时命盘 / 事盘导入的选项:本机之后删掉的不带回;opts.sameCid === 'backup'(确认框里勾了「同一 ID 一律用备份里的」)整条用备份里的
function recordRestoreOpts(opts){
	const o = { respectLocalDeletions: true };
	if(opts && opts.sameCid === 'backup'){ o.sameCid = 'backup'; }
	return o;
}
const SEED_BACKFILL_LABELS = { houseStartMode: '宿占人事十二宫起宫' };

// 逐 store 预览行 [{key,label,detail}] —— 确认框内容,与真实恢复逐项一致。
export function previewUnifiedRestore(pkgManifest, opts){
	const rows = [];
	// 与执行同一个计划:坏段 / 坏键先列「将跳过」,其余各行按去掉坏段之后的那份包算(导入预览 / 校验和各只算一次,行与模拟共用)
	const plan = planUnifiedRestore(pkgManifest, opts);
	const { kept, integrity, recOpts } = plan;
	const manifest = plan.effective;
	plan.badSet.forEach((sec)=>{
		const isRaw = `${sec}`.indexOf('raw.') === 0;
		const k = isRaw ? `${sec}`.slice(4) : sec;
		rows.push({ key: sec, ...(isRaw ? { title: k } : {}), label: isRaw ? rawLabel(k) : restoreRowLabel(sec), detail: BAD_SECTION_PREVIEW });
	});
	const chartsPreview = manifest.charts ? previewLocalChartsBackup(manifest.charts, recOpts) : null;
	const casesPreview = manifest.cases ? previewLocalCasesBackup(manifest.cases, recOpts) : null;
	if(chartsPreview){
		const p = chartsPreview;
		rows.push({ key: 'charts', label: '命盘', detail: p.ok ? recordImportPreviewDetail(p) : '备份里这一部分格式不对，将跳过' });
	}
	if(casesPreview){
		const p = casesPreview;
		rows.push({ key: 'cases', label: '事盘', detail: p.ok ? recordImportPreviewDetail(p) : '备份里这一部分格式不对，将跳过' });
	}
	const trash = manifest.trash && typeof manifest.trash === 'object' ? manifest.trash : {};
	// 预览在导入之前:随本包导入的记录与回收站按恢复时的次序模拟进去,被上限挡下的条数与真实恢复一致
	const sim = previewMergeSim(manifest, { integrity, chartsPreview, casesPreview, recOpts });
	Object.keys(TRASH_KEYS).forEach((slot)=>{
		if(trash[slot] === undefined){
			return;
		}
		const r = sim.trashDry[slot];
		rows.push({ key: `trash.${slot}`, label: slot === 'charts' ? '命盘回收站' : '事盘回收站', detail: r && r.status !== MERGE_OK ? '数据格式不对，将跳过' : mergeResultDetail(r || mergeStatus(MERGE_OK), TRASH_MERGE_DETAIL) });
	});
	const raw = manifest.raw && typeof manifest.raw === 'object' ? manifest.raw : {};
	Object.keys(raw).sort().forEach((k)=>{
		if(kept.has(k)){ return; }   // 安全开关等保留本机的键:下面合成一行
		const mode = rawImportMode(k);
		// title:存储键名只放悬停提示,不进行文字
		if(mode === 'reject'){
			rows.push({ key: k, title: k, label: rawLabel(k), detail: '缓存或只属于原来那台机器的数据，将跳过不写入' });
			return;
		}
		const localVal = safeLocalStorageGet(k);
		if(mode === 'merge'){
			rows.push({ key: k, title: k, label: rawLabel(k), detail: '按事件合并，同一事件保留本机的；你在本机删过的事件不再带回' });
			return;
		}
		if(mode === 'merge-tomb'){
			rows.push({ key: k, title: k, label: rawLabel(k), detail: '与本机的删除记录合并' });
			return;
		}
		if(mode === 'merge-log'){
			let r = null;
			try{ r = mergeDeletedLogRaw(raw[k], { dryRun: true, sim }); }catch(e){ r = null; }
			rows.push({ key: k, title: k, label: rawLabel(k), detail: r && r.status !== MERGE_OK ? '数据格式不对，将跳过' : mergeResultDetail(r || mergeStatus(MERGE_OK), DELETED_LOG_MERGE_DETAIL) });
			return;
		}
		if(mode === 'merge-list'){
			let r = null;
			try{ r = mergeListRaw(k, raw[k], { dryRun: true }); }catch(e){ r = null; }
			rows.push({ key: k, title: k, label: rawLabel(k), detail: r && r.status !== MERGE_OK ? '数据格式不对，将跳过' : mergeResultDetail(r || mergeStatus(MERGE_OK), LIST_MERGE_DETAIL) });
			return;
		}
		if(!rawValueShapeOk(k, raw[k])){
			rows.push({ key: k, title: k, label: rawLabel(k), detail: RAW_SHAPE_PREVIEW });
			return;
		}
		// 恢复前 diff:与本机逐键比对,恢复从赌博变知情决策。
		if(localVal === null){
			rows.push({ key: k, title: k, label: rawLabel(k), detail: '本机无此数据，直接写入' });
		}else if(`${localVal}` === `${raw[k]}`){
			rows.push({ key: k, title: k, label: rawLabel(k), detail: '与本机完全相同，恢复无变化' });
		}else{
			rows.push({ key: k, title: k, label: rawLabel(k), detail: '与本机不同，整值替换本机现值' });
		}
	});
	plan.resetKeys.forEach((k)=>{
		rows.push({ key: k, title: k, label: rawLabel(k), detail: SETTINGS_RESET_PREVIEW });
	});
	if(!(opts && opts.includeSecurity)){
		const secRow = securityRow(securityPlan(pkgManifest, seedPlanOpts(pkgManifest, integrity).untrustedKeys, opts && opts.keepLocalKeys), false);
		if(secRow){ delete secRow.ok; rows.push(secRow); }
	}
	if(lateZiFlagNeeded(pkgManifest, raw)){
		rows.push({ key: ZIWEI_LATE_ZI_FLAG, label: rawLabel(ZIWEI_LATE_ZI_FLAG), detail: LATE_ZI_FLAG_DETAIL });
	}
	const seedPlan = plan.seedPlan;
	relabelFrozenSeedRow(rows, seedPlan, true);
	Object.keys(seedPlan.backfill).forEach((k)=>{
		// 本机确有缺这个键的旧盘才列(此前计划里有就列,本机一张也没有时结果里却没有这一行)
		let n = 0;
		try{ n = countLocalChartsMissingField(k); }catch(e){ n = 0; }
		if(!(n > 0)){ return; }
		rows.push({ key: `newChartSeeds.backfill.${k}`, label: '本机旧命盘', detail: `先补记「${SEED_BACKFILL_LABELS[k] || k}」(按本机原来的设置),恢复后这些旧盘不变` });
	});
	if(seedPlan.clearFlag){
		rows.push({ key: 'newChartSeeds.remerge', label: '新命盘默认设置', detail: SEED_REMERGE_PREVIEW });
	}
	if(manifest.aiWorkspace && manifest.aiWorkspace.stores && typeof manifest.aiWorkspace.stores === 'object'){
		const total = Object.keys(manifest.aiWorkspace.stores)
			.reduce((acc, s)=>acc + (Array.isArray(manifest.aiWorkspace.stores[s]) ? manifest.aiWorkspace.stores[s].length : 0), 0);
		const aiHealth = getAiStoreHealth();
		rows.push({ key: 'aiWorkspace', label: 'AI 分析工作区（对话/消息/配置）', detail: aiHealth && aiHealth.degraded
			? `${total} 条记录；${aiWorkspaceUnavailableText(aiHealth.reason)}，这一部分不会写入（写进去刷新就没了）`
			: `${total} 条记录，同 ID 保本机；密钥不随备份，恢复后需重填` });
	}
	return rows;
}

// 包里缺「旧记录缺键取值」类键的命盘,按包的口径显式补上 —— 只在补了才改变结果时补:冻结值会因恢复而变(backfill 有这个键),
// 或本机有同 cid 的那张且显式带了不同的值(合并时包里缺的键不盖本机值 → 不补则这张盘其余字段按包、唯独这一项按本机)。
// 其余情况(口径相同的导入盘)不补:恢复后靠冻结值显示,结果相同;补了反而与本机内容不同,每张旧盘多出一条历史版本。
// 校验在此之前做完,这里只加工副本。
function fillPackageChartsMissing(env, caliber, backfill){
	const keys = caliber && typeof caliber === 'object' ? Object.keys(caliber) : [];
	if(!keys.length || !env || typeof env !== 'object' || !Array.isArray(env.charts)){ return env; }
	const missing = (rec, k)=>rec && typeof rec === 'object' && (rec[k] === undefined || rec[k] === null);
	const needs = (rec, k)=>{
		if(backfill && Object.prototype.hasOwnProperty.call(backfill, k)){ return true; }
		let local = null;
		try{ local = rec && rec.cid ? getLocalChart(rec.cid) : null; }catch(e){ local = null; }
		return !!(local && local[k] !== undefined && local[k] !== null && `${local[k]}` !== `${caliber[k]}`);
	};
	return { ...env, charts: env.charts.map((rec)=>{
		let out = rec;
		keys.forEach((k)=>{ if(missing(out, k) && needs(out, k)){ out = { ...out, [k]: caliber[k] }; } });
		return out;
	}) };
}

// 冻结值键那一行按终态写:计划在写回 / 复位之后又写定了冻结值,行里再写「整值替换 / 复位默认」就与结果不符。
// 冻结值里有几个键时逐键写(有的保留本机、有的按备份推出);applied(结果侧)= 执行回报,写定没写进的照实写失败
export function relabelFrozenSeedRow(rows, plan, preview, applied){
	const keys = plan && plan.freeze ? Object.keys(plan.freeze) : [];
	if(!keys.length){ return; }
	const done = preview ? '' : '已';
	const failed = !preview && applied && Array.isArray(applied.freezeFailed) ? applied.freezeFailed.filter((k)=>keys.indexOf(k) >= 0) : [];
	const keptLegal = applied && Array.isArray(applied.freezeKeptLegal) ? applied.freezeKeptLegal : [];
	const keepKeys = keys.filter((k)=>plan.keepLocal && plan.keepLocal[k]);
	const name = (ks)=>ks.map((k)=>`「${SEED_BACKFILL_LABELS[k] || k}」`).join('、');
	// 写定失败后旧盘按什么显示:现存冻结值仍合法 = 还是本机原来的取值;否则读时按新盘缺省重冻
	const who = keys.length > 1 ? name(failed) : '这一项';
	const failTail = failed.length && failed.every((k)=>keptLegal.indexOf(k) >= 0)
		? `缺${who}的旧命盘仍按本机原来的取值显示` : `本机缺${who}的旧命盘可能改按新盘缺省显示`;
	let detail;
	if(failed.length){ detail = `没能保存（可能是存储空间不足），${failTail}`; }
	else if(keepKeys.length === keys.length){ detail = `备份里这项不可用，${done}保留本机原来的取值`; }
	else if(!keepKeys.length){ detail = `${done}按备份里的设置定下来`; }
	else{ detail = `${name(keepKeys)}备份里不可用，${done}保留本机原来的取值；${name(keys.filter((k)=>keepKeys.indexOf(k) < 0))}${done}按备份里的设置定下来`; }
	// 这一键的行只改一条:整值写回已失败的行(ok 为否)不另起一行,写定也失败时在原句后补半句
	let hit = false;
	rows.forEach((r)=>{
		if(!r || r.key !== NEW_CHART_SEEDS_RECORD_MISSING_KEY){ return; }
		hit = true;
		if(r.ok !== false){ r.detail = detail; if(failed.length){ r.ok = false; } }
		else if(failed.length){ r.detail = `${r.detail}；这一项也没能保存，${failTail}`; }
	});
	// 结果里没有冻结值这一行(如本机原本没有冻结值、按旧版包推出口径)而写定没写进:补一行失败,不静默
	if(failed.length && !hit){ rows.push({ key: NEW_CHART_SEEDS_RECORD_MISSING_KEY, ok: false, detail }); }
}

// 种子计划的选项:设置面完整标记 + 校验和不符的原始键(不当包的口径用)
function seedPlanOpts(manifest, integrity){
	const bad = (integrity && integrity.badSections) || [];
	return {
		settingsComplete: manifest ? manifest.settingsComplete : undefined,
		untrustedKeys: bad.filter((s)=>`${s}`.indexOf('raw.') === 0).map((s)=>`${s}`.slice(4)),
	};
}

// 预览时模拟恢复次序(命盘 / 事盘导入 → 回收站合并 → 删除日志合并):随本包导入的记录算「已在库里」,包里没过期的回收站条目算「在回收站里」
// 与真实恢复同口径:校验和不符的段不算;命盘 / 事盘按导入预览实际会落进库的 cid(同名同时刻跳过的不算);
// 回收站按合并后真正并进来的条目(被容量挡下 / 已在库里 / 本机之后彻底删过的不算)
// pre(可选):预览已算好的 { integrity, chartsPreview, casesPreview },复用不重算。返回的 trashDry[slot] = 该槽回收站合并的 dryRun 结果(预览行用)
function previewMergeSim(manifest, pre){
	const integrity = pre && pre.integrity ? pre.integrity : verifyManifestChecksums(manifest);
	const bad = new Set((integrity && integrity.badSections) || []);
	const imported = (env, given, preview)=>{
		if(!env){ return new Set(); }
		let p = given || null;
		if(!p){ try{ p = preview(env); }catch(e){ p = null; } }
		return new Set(p && p.ok && Array.isArray(p.importedCids) ? p.importedCids.map((c)=>`${c}`) : []);
	};
	const recOpts = pre && pre.recOpts ? pre.recOpts : recordRestoreOpts();
	const library = {
		chart: bad.has('charts') ? new Set() : imported(manifest && manifest.charts, pre && pre.chartsPreview, (env)=>previewLocalChartsBackup(env, recOpts)),
		case: bad.has('cases') ? new Set() : imported(manifest && manifest.cases, pre && pre.casesPreview, (env)=>previewLocalCasesBackup(env, recOpts)),
	};
	const trashObj = manifest && manifest.trash && typeof manifest.trash === 'object' ? manifest.trash : {};
	const trashDry = {};
	Object.keys(TRASH_KEYS).forEach((slot)=>{
		if(trashObj[slot] === undefined){ return; }
		let r = null;
		try{ r = mergeTrashRaw(TRASH_KEYS[slot], trashObj[slot], { dryRun: true, sim: { library } }); }catch(e){ r = null; }
		trashDry[slot] = r;
	});
	// 校验和不符的回收站段恢复时整段跳过:不算并进来
	const kept = (slot)=>(!bad.has('trash') && trashDry[slot] && Array.isArray(trashDry[slot].kept) ? trashDry[slot].kept : []);
	return { library, trash: { chart: kept('charts'), case: kept('cases') }, trashDry };
}

const DELETED_LOG_MERGE_DETAIL = '与本机合并，本机已有的保留；已在库里或本机之后又删过的记录不再带回';
const TRASH_MERGE_DETAIL = '与本机合并，本机已有的保留；已在库里或本机之后彻底删过的不再带回，已过期的不计';

// 并集合并的结果 { status, dropped }:status 'ok' = 已写;MERGE_SHAPE = 包里这一项形状不对(跳过,本机不动);
// MERGE_QUOTA = 合并好了却写不进(空间不足)。dropped = 备份里被容量上限挡下、没并进来的条数(结果行如实写出)
const MERGE_OK = 'ok';
const MERGE_SHAPE = 'shape';
const MERGE_QUOTA = 'quota';
const mergeStatus = (status, dropped)=>({ status, dropped: dropped || 0 });
const WRITE_FAILED_DETAIL = '没能保存（可能是存储空间不足）';
function mergeResultDetail(r, okDetail){
	if(r && r.status === MERGE_OK){ return r.dropped ? `${okDetail}；备份里 ${r.dropped} 条超出上限未并入` : okDetail; }
	return r && r.status === MERGE_QUOTA ? WRITE_FAILED_DETAIL : '数据格式不对，已跳过';
}

// 有容量上限的并集:本机条目全留(本来就不超上限),剩余容量按时间倒序放包里的条目,最后按时间倒序排(时间相同保原序)。
// 此前整体按时间截断:包里较新的条目多时,本机较早的条目被挤掉,与「本机条目保留」不符
function capLocalFirst(sortedAll, localList, cap){
	const localSet = new Set(localList);
	const keepLocal = new Set(sortedAll.filter((x)=>localSet.has(x)).slice(0, cap));
	const room = Math.max(0, cap - keepLocal.size);
	const incoming = sortedAll.filter((x)=>!localSet.has(x));
	const keepIn = new Set(incoming.slice(0, room));
	return { list: sortedAll.filter((x)=>(localSet.has(x) ? keepLocal.has(x) : keepIn.has(x))), dropped: Math.max(0, incoming.length - keepIn.size) };
}

// 本机库 / 回收站 / 删除日志里「这条记录的去向」(合并回收站与删除日志共用)。sim:预览时模拟随本包导入的记录与回收站
// (预览发生在导入之前,不模拟则预览与结果的条数对不上)
function recordWhereabouts(sim){
	const extraLib = (sim && sim.library) || { chart: new Set(), case: new Set() };
	const inLibrary = (store, cid)=>{
		if((store === 'case' ? extraLib.case : extraLib.chart).has(`${cid}`)){ return true; }
		try{ return store === 'case' ? !!getLocalCase(cid) : !!getLocalChart(cid); }catch(err){ return false; }
	};
	const now = Date.now();
	const liveTrashCids = (key, extra)=>{
		let t = [];
		try{ const cur = JSON.parse(safeLocalStorageGet(key) || '[]'); t = cur instanceof Array ? cur : []; }catch(err){ t = []; }
		return new Set([...t, ...(extra || [])].filter((r)=>r && r.cid && trashEntryLive(r, now)).map((r)=>`${r.cid}`));
	};
	const simTrash = (sim && sim.trash) || {};
	const inTrash = { chart: liveTrashCids(TRASH_KEYS.charts, simTrash.chart), case: liveTrashCids(TRASH_KEYS.cases, simTrash.case) };
	let log = [];
	try{ const cur = JSON.parse(safeLocalStorageGet(DELETED_LOG_KEY) || '[]'); log = cur instanceof Array ? cur : []; }catch(err){ log = []; }
	const latestPurge = {};
	log.forEach((e)=>{
		if(!e || !e.record || !e.record.cid){ return; }
		const k = `${e.store}|${e.record.cid}`;
		const t = `${e.purgedAt || ''}`;
		if(latestPurge[k] === undefined || t > latestPurge[k]){ latestPurge[k] = t; }
	});
	return {
		inLibrary,
		// 回收站只认没过期的(与回收站清理同一判据 trashEntryLive):已过期的下次打开回收站就被清掉,不算「还在」
		inLiveTrash: (store, cid)=>(store === 'case' ? inTrash.case : inTrash.chart).has(`${cid}`),
		purgedAfter: (store, cid, when)=>{ const t = latestPurge[`${store}|${cid}`]; return t !== undefined && t > `${when || ''}`; },
	};
}

// 删除日志并集:本机条目全留、优先;包里的条目按 (库, 删除时刻, cid) 去重,且本机对这个 cid 已有更权威去向的不带回 ——
// 已在对应库里(已找回 / 随本包导入)、正躺在本机回收站里、本机日志里同 (库, cid) 有更晚的删除(找回过又删了)。
// 此前整值替换:本机彻底删除过的记录从此找不回,包里已找回过的条目又回来、再点只多一条副本。上限 500 条,本机条目先占。
function mergeDeletedLogRaw(incomingRaw, opts){
	let incoming;
	try{ incoming = JSON.parse(`${incomingRaw}`); }catch(e){ return mergeStatus(MERGE_SHAPE); }
	if(!(incoming instanceof Array)){ return mergeStatus(MERGE_SHAPE); }
	let local = [];
	try{ const cur = JSON.parse(safeLocalStorageGet(DELETED_LOG_KEY) || '[]'); local = cur instanceof Array ? cur : []; }catch(e){ local = []; }
	const valid = (e)=>e && typeof e === 'object' && e.record && typeof e.record === 'object' && e.record.cid;
	const idOf = (e)=>`${e.store}|${e.purgedAt}|${e.record.cid}`;
	const where = recordWhereabouts(opts && opts.sim);
	const seen = new Set(local.filter(valid).map(idOf));
	// 判过就记进 seen:包里自带的重复条目也只进一条
	const added = incoming.filter((e)=>{
		if(!valid(e) || seen.has(idOf(e))){ return false; }
		const cid = e.record.cid;
		// 回收站里有同一条不再拦(否则日志条目的寿命被回收站 30 天截短);两边同一条的去重在找回动作时做(回收站恢复摘日志、日志找回摘回收站)
		if(where.inLibrary(e.store, cid) || where.purgedAfter(e.store, cid, e.purgedAt)){ return false; }
		seen.add(idOf(e));
		return true;
	});
	const merged = [...local, ...added]
		.map((e, i)=>({ e, i }))
		.sort((a, b)=>{
			const ta = `${(a.e && a.e.purgedAt) || ''}`; const tb = `${(b.e && b.e.purgedAt) || ''}`;
			return ta === tb ? a.i - b.i : (ta < tb ? 1 : -1);
		})
		.map((x)=>x.e);
	const capped = capLocalFirst(merged, local, DELETED_LOG_MAX);
	if(opts && opts.dryRun){ return mergeStatus(MERGE_OK, capped.dropped); }
	return safeLocalStorageSet(DELETED_LOG_KEY, JSON.stringify(capped.list)) ? mergeStatus(MERGE_OK, capped.dropped) : mergeStatus(MERGE_QUOTA);
}

// 人生事件删除记录 { id: 删除时刻 }(本机的 + 包里的):包里这些 id 的事件不带回
function lifeEventTombstones(extraRaw){
	const out = {};
	const add = (txt)=>{
		try{
			const o = JSON.parse(txt || '{}');
			if(o && typeof o === 'object' && !Array.isArray(o)){
				Object.keys(o).forEach((id)=>{ const t = Number(o[id]) || 0; if(!(id in out) || t > out[id]){ out[id] = t; } });
			}
		}catch(e){ /* 坏了当没有 */ }
	};
	add(safeLocalStorageGet(LIFE_EVENTS_TOMBSTONE_KEY));
	if(extraRaw !== undefined){ add(extraRaw); }
	return out;
}

// 删除记录并集(同 id 取较晚的删除时刻);坏形状跳过不写
function mergeLifeEventTombstonesRaw(incomingRaw){
	let incoming = null;
	try{ incoming = JSON.parse(incomingRaw); }catch(e){ return mergeStatus(MERGE_SHAPE); }
	if(!incoming || typeof incoming !== 'object' || Array.isArray(incoming)){ return mergeStatus(MERGE_SHAPE); }
	const merged = lifeEventTombstones(incomingRaw);
	return safeLocalStorageSet(LIFE_EVENTS_TOMBSTONE_KEY, JSON.stringify(merged)) ? mergeStatus(MERGE_OK) : mergeStatus(MERGE_QUOTA);
}

// 人生事件 per-出生签名 id-并集(同 id 保本机);本机删过的事件(删除记录里有)不再从备份带回;坏形状跳过不写(诚实上报)。
// tombRaw:包里的删除记录原串(与本机的合并后一起判)
function mergeLifeEventsRaw(incomingRaw, tombRaw){
	let incoming = null;
	try{
		incoming = JSON.parse(incomingRaw);
	}catch(e){
		return mergeStatus(MERGE_SHAPE);
	}
	if(!incoming || typeof incoming !== 'object' || Array.isArray(incoming)){
		return mergeStatus(MERGE_SHAPE);
	}
	let local = {};
	try{
		const cur = safeLocalStorageGet(LIFE_EVENTS_KEY);
		local = cur ? JSON.parse(cur) : {};
	}catch(e){
		local = {};
	}
	if(!local || typeof local !== 'object' || Array.isArray(local)){
		local = {};
	}
	const tomb = lifeEventTombstones(tombRaw);
	Object.keys(incoming).forEach((sig)=>{
		const inList = Array.isArray(incoming[sig]) ? incoming[sig] : [];
		const curList = Array.isArray(local[sig]) ? local[sig] : [];
		const seen = new Set(curList.map((e)=>(e && e.id) || null).filter(Boolean));
		const merged = curList.slice();
		inList.forEach((e)=>{
			if(e && e.id && !seen.has(e.id) && !Object.prototype.hasOwnProperty.call(tomb, e.id)){
				merged.push(e);
				seen.add(e.id);
			}
		});
		local[sig] = merged;
	});
	return safeLocalStorageSet(LIFE_EVENTS_KEY, JSON.stringify(local)) ? mergeStatus(MERGE_OK) : mergeStatus(MERGE_QUOTA);
}

// 回收站并集:按 cid 保本机;两边都只算没过期的(与回收站清理同一判据);备份里的条目,这条记录已在对应库里(已找回 / 随本包导入)、
// 或本机删除日志里之后又彻底删过的不带回(此前带回 → 点「恢复」只多一张副本);合并后按 deletedAt 降序,本机条目先占容量
function mergeTrashRaw(trashKey, incomingRaw, opts){
	let incoming = null;
	try{
		incoming = JSON.parse(incomingRaw);
	}catch(e){
		return mergeStatus(MERGE_SHAPE);
	}
	if(!Array.isArray(incoming)){
		return mergeStatus(MERGE_SHAPE);
	}
	let local = [];
	try{
		const cur = safeLocalStorageGet(trashKey);
		local = cur ? JSON.parse(cur) : [];
	}catch(e){
		local = [];
	}
	if(!Array.isArray(local)){
		local = [];
	}
	const store = trashKey === TRASH_KEYS.cases ? 'case' : 'chart';
	const now = Date.now();
	const where = recordWhereabouts(opts && opts.sim);
	// 本机条目与回收站清理(pruneTrash)同一判据:按保留期判,缺删除时刻 / 坏时刻 / null 一律算过期 —— 不占容量、不挡包里同 cid 的条目
	// (打开回收站时它们本来就被清掉;没 cid 但删除时刻还在期内的条目清理也留着,这里同样留着、同样占位)
	const localLive = local.filter((r)=>trashEntryLive(r, now));
	// cid 一律按字符串比(与 recordWhereabouts 的 inLibrary / inLiveTrash 同一个键;手改包里 12 与 '12' 是同一条)
	const cidKey = (r)=>(r && r.cid !== undefined && r.cid !== null && `${r.cid}` !== '' ? `${r.cid}` : null);
	const seen = new Set(localLive.map(cidKey).filter(Boolean));
	const merged = localLive.slice();
	incoming.forEach((r)=>{
		const ck = cidKey(r);
		if(!ck || seen.has(ck) || !trashEntryLive(r, now)){ return; }
		if(where.inLibrary(store, r.cid) || where.purgedAfter(store, r.cid, r.deletedAt)){ return; }
		merged.push(r);
		seen.add(ck);
	});
	merged.sort((a, b)=>`${(b && b.deletedAt) || ''}`.localeCompare(`${(a && a.deletedAt) || ''}`));
	const capped = capLocalFirst(merged, localLive, TRASH_CAP);
	if(opts && opts.dryRun){
		const localSet = new Set(localLive);
		return { ...mergeStatus(MERGE_OK, capped.dropped), kept: capped.list.filter((r)=>!localSet.has(r)) };
	}
	const text = JSON.stringify(capped.list);
	if(!safeLocalStorageSet(trashKey, text)){ return mergeStatus(MERGE_QUOTA); }
	try{ mirrorShadowWrite(trashKey, text); }catch(e){ /* 影子副本写不进:主键已写成,下次回收站写入再补 */ }
	return mergeStatus(MERGE_OK, capped.dropped);
}

// AI 工作区恢复:逐 store 逐条,同 id 保本机(先查有则跳);单条失败不拖垮其余。
async function restoreAiWorkspace(section){
	const stores = section && section.stores && typeof section.stores === 'object' ? section.stores : {};
	const valid = new Set(Object.values(AI_ANALYSIS_STORES));
	let put = 0;
	let kept = 0;
	let failed = 0;
	const names = Object.keys(stores);
	for(let i=0; i<names.length; i++){
		const name = names[i];
		if(!valid.has(name) || AI_BACKUP_EXCLUDED_STORES.indexOf(name) >= 0){
			continue;   // 旧包里的派生缓存一律忽略(不覆盖本机缓存)
		}
		const list = Array.isArray(stores[name]) ? stores[name] : [];
		for(let j=0; j<list.length; j++){
			const rec = list[j];
			if(!rec || typeof rec !== 'object' || !rec.id){
				continue;
			}
			try{
				// eslint-disable-next-line no-await-in-loop
				const cur = await getStoreRecord(name, rec.id);
				if(cur){
					kept += 1;
					continue;
				}
				// eslint-disable-next-line no-await-in-loop
				await putStoreRecord(name, rec, name);
				put += 1;
			}catch(e){
				failed += 1;
			}
		}
	}
	return { put, kept, failed };
}

// 逐 store 独立 try:一项失败不拖垮其余;返回分项成败清单(与预览行同 key)。async(AI 工作区段)。
// 恢复计划(预览与执行共用的同一个函数 —— 两边对「哪些段 / 键会被跳过、哪些设置会复位、新盘种子怎么并」的判断从根上一致):
//   integrity / badSet:校验和不符的段(charts / cases / trash / aiWorkspace / raw.<键>),恢复时整段跳过;
//   effective:去掉坏段之后真正会用的那份包(预览按它出行,执行按它写);
//   resetKeys:按**原始**包算的要复位的本机设置键(坏段过滤会改写 raw,不能拿过滤后的判「包里有没有」;保留本机的键不复位);
//   seedPlan:新盘种子的再并入 / 旧记录缺键取值的重冻,同样按原始包键集定。
// 此前预览与执行各算一遍:预览把校验和不符的命盘段照常列「新增 N 条」,执行却整段跳过。
export function planUnifiedRestore(manifest, opts){
	const kept = keptLocalKeySet(opts);
	const resetCandidates = localSettingsKeysToReset(manifest);
	const resetKeys = resetCandidates.filter((k)=>!kept.has(k));
	const integrity = verifyManifestChecksums(manifest);
	const seedPlan = planNewChartSeedsRestore(manifest && manifest.raw, seedPlanOpts(manifest, integrity));
	const badSet = new Set(integrity.badSections || []);
	let effective = manifest;
	['charts', 'cases', 'trash', 'aiWorkspace'].forEach((sec)=>{
		if(badSet.has(sec)){ effective = { ...effective, [sec]: null }; }
	});
	if(effective && effective.raw && typeof effective.raw === 'object'){
		const cleanRaw = {};
		Object.keys(effective.raw).forEach((k)=>{
			if(!badSet.has(`raw.${k}`)){ cleanRaw[k] = effective.raw[k]; }
		});
		effective = { ...effective, raw: cleanRaw };
	}
	return { kept, resetCandidates, resetKeys, integrity, seedPlan, badSet, effective, recOpts: recordRestoreOpts(opts) };
}
const BAD_SECTION_PREVIEW = '这一部分在备份文件里已损坏（校验和不符），将跳过，本机数据不动';
const BAD_SECTION_DETAIL = '这一部分在备份文件里已损坏（校验和不符），已跳过，本机数据不动';

export async function restoreUnifiedBackup(manifest, opts){
	const results = [];
	const pkgManifest = manifest;
	const plan = planUnifiedRestore(manifest, opts);
	const { kept, resetKeys, integrity, seedPlan, badSet } = plan;
	badSet.forEach((s)=>{
		results.push({ key: s, ok: false, detail: BAD_SECTION_DETAIL });
	});
	manifest = plan.effective;
	// 命盘 / 事盘:有条目没写进(配额满)或存储只在本次运行有效 → 该项记失败并标 sessionOnly;
	// 调用方据此不刷新页面(刷新 = 只在内存里的导入结果当场全丢)。
	const recOpts = plan.recOpts;
	const importRecords = (key, kind, fn, payload)=>{
		try{
			const r = fn(payload, recOpts);
			const persisted = recordStorePersisted(kind);
			const detail = `导入 ${r.imported} 条${r.keptLocal ? `，同一 ID 本机较新或一样新的 ${r.keptLocal} 条保留本机的` : ''}${r.skippedDeleted ? `，本机在这份备份之后删掉的 ${r.skippedDeleted} 条没有带回` : ''}${r.dupSkipped ? `，${r.dupSkipped} 条与本机已有记录同名同生辰，已跳过` : ''}${r.failed ? `，${r.failed} 条因存储空间不足没有导入` : ''}${persisted ? '' : '（本机存储不可用，只在本次运行有效，请先导出）'}`;
			// changedCids:本机原有、被这次恢复整条替换 / 按字段合并的记录号(温启快照与「当前载入的那条」据此按库里新版重设)
			const changedCids = Array.isArray(r.changedCids) ? r.changedCids.map((c)=>`${c}`) : [];
			results.push({ key, ok: persisted && !r.failed, detail, changedCids, ...(persisted ? {} : { sessionOnly: true }) });
		}catch(e){
			results.push({ key, ok: false, detail: '导入失败' });
		}
	};
	// 冻结值会因恢复而变:先把本机缺这个键的命盘补成本机原来的取值,再导入包里的记录(包里的旧盘按包的口径)。
	// 条数与预览同一判据:主库 + 回收站 + 删除日志里缺这个键的合计(补记前数;预览列了这一行,结果就有这一行)
	const backfillPre = {};
	Object.keys(seedPlan.backfill).forEach((k)=>{
		try{ backfillPre[k] = countLocalChartsMissingField(k); }catch(e){ backfillPre[k] = 0; }
	});
	for(const k of Object.keys(seedPlan.backfill)){
		// 历史版本里的旧盘同样补(「恢复为副本」出来的旧版也按本机原来的口径)
		try{ await backfillRevisionsMissingField('chart', k, seedPlan.backfill[k]); }catch(e){ /* 版本历史补不进无害 */ }
	}
	Object.keys(seedPlan.backfill).forEach((k)=>{
		try{
			const pre = backfillPre[k] > 0 ? backfillPre[k] : 0;
			// 计数为 0 也调:回收站里已过期 / 卡在 30 天线上的缺键条目同样补上(计数只数没过期的;不补则时钟回拨后它又看得见、口径翻转)。
			// pre 为 0 时主库 / 日志 / 没过期的回收站条目都不缺键,不会写出失败行;结果行只在 pre > 0 时列
			const n = backfillLocalChartsMissingField(k, seedPlan.backfill[k]);
			if(!pre){ return; }
			if(n === -2){ results.push({ key: `newChartSeeds.backfill.${k}`, ok: false, detail: `本机旧命盘补记「${SEED_BACKFILL_LABELS[k] || k}」:主库已补,回收站或删除日志里的没写进(空间不足?),从那里找回的旧盘可能改按备份的口径显示` }); }
			else if(n < 0){ results.push({ key: `newChartSeeds.backfill.${k}`, ok: false, detail: `本机旧命盘补记「${SEED_BACKFILL_LABELS[k] || k}」没写进(空间不足),恢复后这些旧盘可能改按备份的口径显示` }); }
			else{ results.push({ key: `newChartSeeds.backfill.${k}`, ok: true, detail: `本机 ${pre} 张旧命盘(含回收站、删除日志里的)补记「${SEED_BACKFILL_LABELS[k] || k}」(按本机原来的口径,恢复后不变)` }); }
		}catch(e){ /* 补记失败不阻断恢复 */ }
	});
	// 信封与预览同一判据(validateBackupEnvelope):预览写了「信封无效，将跳过」的段这里同样跳过(此前内核只看清单是不是数组照导)
	const envelopeOk = (validate, env)=>{ try{ const v = validate(env); return !!(v && v.ok); }catch(e){ return false; } };
	if(manifest.charts){
		if(envelopeOk(validateLocalChartsBackup, manifest.charts)){
			importRecords('charts', 'chart', importLocalChartsBackup, fillPackageChartsMissing(manifest.charts, seedPlan.pkgCaliber, seedPlan.backfill));
		}else{ results.push({ key: 'charts', ok: false, detail: '备份里这一部分格式不对，已跳过' }); }
	}
	if(manifest.cases){
		if(envelopeOk(validateLocalCasesBackup, manifest.cases)){
			importRecords('cases', 'case', importLocalCasesBackup, manifest.cases);
		}else{ results.push({ key: 'cases', ok: false, detail: '备份里这一部分格式不对，已跳过' }); }
	}
	const trash = manifest.trash && typeof manifest.trash === 'object' ? manifest.trash : {};
	Object.keys(TRASH_KEYS).forEach((slot)=>{
		if(trash[slot] === undefined){
			return;
		}
		try{
			const r = mergeTrashRaw(TRASH_KEYS[slot], trash[slot]);
			results.push({ key: `trash.${slot}`, ok: r.status === MERGE_OK, detail: mergeResultDetail(r, TRASH_MERGE_DETAIL) });
		}catch(e){
			results.push({ key: `trash.${slot}`, ok: false, detail: '合并异常' });
		}
	});
	const raw = manifest.raw && typeof manifest.raw === 'object' ? manifest.raw : {};
	Object.keys(raw).sort().forEach((k)=>{
		if(kept.has(k)){ return; }   // 安全开关等:保留本机设置,下面合成一行
		try{
			const mode = rawImportMode(k);
			if(mode === 'reject'){
				results.push({ key: k, ok: true, detail: '缓存或只属于原来那台机器的数据，已跳过' });
				return;
			}
			if(mode === 'merge'){
				const r = mergeLifeEventsRaw(raw[k], raw[LIFE_EVENTS_TOMBSTONE_KEY]);
				results.push({ key: k, ok: r.status === MERGE_OK, detail: mergeResultDetail(r, '已按事件合并（本机删过的事件不再带回）') });
				return;
			}
			if(mode === 'merge-tomb'){
				const r = mergeLifeEventTombstonesRaw(raw[k]);
				results.push({ key: k, ok: r.status === MERGE_OK, detail: mergeResultDetail(r, '已与本机的删除记录合并') });
				return;
			}
			if(mode === 'merge-log'){
				const r = mergeDeletedLogRaw(raw[k]);
				results.push({ key: k, ok: r.status === MERGE_OK, detail: mergeResultDetail(r, DELETED_LOG_MERGE_DETAIL) });
				return;
			}
			if(mode === 'merge-list'){
				const r = mergeListRaw(k, raw[k]);
				results.push({ key: k, ok: r.status === MERGE_OK, detail: mergeResultDetail(r, LIST_MERGE_DETAIL) });
				return;
			}
			if(!rawValueShapeOk(k, raw[k])){
				results.push({ key: k, ok: false, detail: RAW_SHAPE_DETAIL });
				return;
			}
			// 这把键还在延迟落盘队列里的那份是恢复前的内存态:先丢掉,否则空闲时 / 关窗前刷盘会把它写回、盖掉恢复值
			dropPendingStorageWrite(k);
			const ok = safeLocalStorageSet(k, raw[k]);
			// 紫微自定义表:主存整值替换后同步 IDB 镜像(否则镜像仍是恢复前的旧表,主存再丢时启动自愈会把旧表写回)
			if(ok && ZIWEI_CUSTOM_TABLE_KIND[k]){ try{ mirrorZiweiCustomTable(ZIWEI_CUSTOM_TABLE_KIND[k], `${raw[k]}`); }catch(e){ /* 镜像尽力而为 */ } }
			results.push({ key: k, ok, detail: ok ? '已写入' : WRITE_FAILED_DETAIL });
		}catch(e){
			results.push({ key: k, ok: false, detail: '写入异常' });
		}
	});
	// 复位集在这里按原始包再算一次并入:恢复途中读种子等会补写包里没有的设置键(如新盘种子的并入记号),
	// 只按开头那一刻算,同一份包恢复两次结果就一次有、一次无
	const resetFinal = Array.from(new Set([...resetKeys, ...localSettingsKeysToReset(pkgManifest).filter((k)=>!kept.has(k))])).sort();
	resetFinal.forEach((k)=>{
		dropPendingStorageWrite(k);
		safeLocalStorageRemove(k);
		const ok = safeLocalStorageGet(k) === null;
		results.push({ key: k, ok, detail: ok ? '已复位默认（备份里为默认）' : '复位失败' });
	});
	// 安全开关:每项取本机与备份里较严的一档(includeSecurity 时上面已整值写入 / 复位)
	if(!(opts && opts.includeSecurity)){
		const plan = securityPlan(pkgManifest, seedPlanOpts(pkgManifest, integrity).untrustedKeys, opts && opts.keepLocalKeys);
		const failed = [];
		plan.changes.forEach((c)=>{
			if(c.value === null){
				safeLocalStorageRemove(c.key);
				if(safeLocalStorageGet(c.key) !== null){ failed.push(c.key); }
			}else if(!safeLocalStorageSet(c.key, c.value)){
				failed.push(c.key);
			}
		});
		const secRow = securityRow(plan, true, failed);
		if(secRow){ results.push(secRow); }
		if(plan.changes.length){ notifyAgentPrefsChanged(); }
	}
	if(lateZiFlagNeeded(pkgManifest, raw)){
		const ok = safeLocalStorageSet(ZIWEI_LATE_ZI_FLAG, '1');
		results.push({ key: ZIWEI_LATE_ZI_FLAG, ok, detail: ok ? LATE_ZI_FLAG_DETAIL : '紫微晚子时的升级记号没能保存（可能是存储空间不足）' });
	}
	// 包里有旧版同义存储(七政宿度制 / 宿占起宫 / 全局设置里的主限两项)却没有新盘种子的并入标志(旧版导出的包):
	// 清掉本机标志,恢复回来的这些值再并入一次(种子已有的不动);旧记录缺键时的取值按恢复回来的旧偏好重冻。
	// 此前本机标志留着,这些值永远并不进来
	const seedApplied = applyNewChartSeedsRestorePlan(seedPlan);
	relabelFrozenSeedRow(results, seedPlan, false, seedApplied);
	if(seedPlan.clearFlag){ results.push({ key: 'newChartSeeds.remerge', ok: true, detail: SEED_REMERGE_PREVIEW }); }
	if(manifest.aiWorkspace && typeof manifest.aiWorkspace === 'object'){
		// AI 工作区读不开(内存回退)时不写:写进去只进了内存、刷新就没了,却会报「写入 N 条」
		let aiHealth = null;
		try{ aiHealth = await probeAiStoreHealth(); }catch(e){ aiHealth = null; }
		if(aiHealth && aiHealth.degraded){
			results.push({ key: 'aiWorkspace', ok: false, detail: `${aiWorkspaceUnavailableText(aiHealth.reason)}，这一部分没有写入；请先排查（装过更新版本的就装回更新版本）再恢复` });
		}else{
			try{
				const r = await restoreAiWorkspace(manifest.aiWorkspace);
				results.push({ key: 'aiWorkspace', ok: true, detail: `写入 ${r.put} 条、本机已有保留 ${r.kept} 条${r.failed ? `，失败 ${r.failed} 条` : ''}` });
			}catch(e){
				results.push({ key: 'aiWorkspace', ok: false, detail: '工作区恢复异常' });
			}
		}
	}
	// 温启快照:丢掉恢复前内存态的待落盘写,已落盘的快照留着交给指纹判定(库里那条换过就按库重放);
	// 快照那张盘正是被这次恢复换掉的 → 强制按库里那条重放、连记录号的紫微临时表一并作废。
	// 此前一律删快照:哪怕当前盘根本不在包里,刷新后也回到「此刻」盘,上次停留的盘与页签丢了
	try{
		const chartRow = results.find((r)=>r && r.key === 'charts');
		settleBootChartSnapshotAfterRestore(chartRow && Array.isArray(chartRow.changedCids) ? chartRow.changedCids : []);
	}catch(e){ /* 快照只是优化:处理不了照旧走指纹判定 */ }
	// 出事的那几部分都成功写回磁盘了 → 清掉「出事」标记(之后的自动备份不再标 -degraded)
	try{ settleBackupIncidentAfterRestore(results); }catch(e){ /* 标记留着无害 */ }
	// 每行补中文名:失败提示列「中文名:说明」,不露内部键名
	results.forEach((r)=>{ if(r && !r.label){ r.label = restoreRowLabel(r.key); } });
	return results;
}

const ZIWEI_CUSTOM_TABLE_KIND = { ziweiBrightnessCustom: 'brightness', ziweiSihuaCustom: 'sihua' };

// 安全开关按备份收紧后:通知已挂载的 AI 设置面重读(事件名与 aiAgent/prefs.js 的 AGENT_PREFS_EVENT 一致;不带 detail = 订阅方按存储重读;
// 恢复完整页还会刷新一次)
function notifyAgentPrefsChanged(){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent('horosa:agent-prefs-changed'));
		}
	}catch(e){ /* 页面刷新时照样重读 */ }
}
