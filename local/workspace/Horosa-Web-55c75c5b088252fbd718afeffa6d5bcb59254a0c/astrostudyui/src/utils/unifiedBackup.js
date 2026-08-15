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
// - 🔴 本文件绝不 import 非共享模块(引它=部分构建断链):
//   人生事件以裸键名+纯 JSON 结构经 safeStorage 操作,键名中性,Public 侧该键恒空自然退化。
// - 🔴 敏感剥离:aiWorkspace 段 providerProfiles 逐条剥 apiKey(listStoreRecords 读端自动
//   解密成明文——原样入包=备份文件泄明文密钥)。恢复端读到空 key 自然走「提示重填」语义。
// - raw 键整值直通(不解析不 normalize)——各键读端自迁移,恢复后首次读取即走既有迁移。
// - 恢复语义:命盘/事盘按 cid 合并不删现有;raw 设置键整值替换;人生事件按事件 id 并集
//   同 id 保本机;回收站按 cid 并集保本机;AI 工作区同 id 保本机。
// - 导入侧按注册表再过滤:cache/device-local 键即使出现在包里也拒写(手改包防呆)。
// - zip 信封与 AI 工作区备份互为 format 防呆(此处验 format 不符即拒并指路)。
import JSZip from 'jszip';
import { exportLocalChartsBackup, importLocalChartsBackup, previewLocalChartsBackup } from './localcharts';
import { exportLocalCasesBackup, importLocalCasesBackup, previewLocalCasesBackup } from './localcases';
import { safeLocalStorageGet, safeLocalStorageSet } from './safeStorage';
import { classifyStorageKey, collectBackupKeys } from './storageKeyRegistry';
import { AI_ANALYSIS_STORES, listStoreRecords, getStoreRecord, putStoreRecord } from './aiAnalysisStore';
import { buildManifestChecksums, verifyManifestChecksums, sha256Hex } from './backupChecksum';

export const UNIFIED_BACKUP_FORMAT = 'horosa-unified-backup';
export const UNIFIED_BACKUP_VERSION = 2;
// [V5-B7] 版本协商:能读本包所需的最低 reader 版本。minor 演进(只加可选段/reader 保留
// 未知字段)不动它;破坏性变更才升 —— 老 app 读到 minReaderVersion 高于自身时明确拒读
// 并指引升级,绝不静默丢段。
export const UNIFIED_BACKUP_MIN_READER = 1;
export const UNIFIED_MANIFEST_NAME = 'manifest.json';

const LIFE_EVENTS_KEY = 'horosa.lc.lifeEvents.v1';
const TRASH_KEYS = {
	charts: 'horosa.localCharts.trash.v1',
	cases: 'horosa.localCases.trash.v1',
};
const TRASH_CAP = 200;

function rawLabel(k){
	const e = classifyStorageKey(k);
	if(e && e.label){
		return e.label;
	}
	return `${k}(未登记键,按用户资产带走)`;
}

// 基础段(同步,localStorage 面):raw 面 = 注册表 backup:true 全键 + 未登记键(防呆带走)。
export function buildUnifiedBackupManifest(){
	const { rawKeys, unknownKeys } = collectBackupKeys();
	const raw = {};
	[...rawKeys, ...unknownKeys].forEach((k)=>{
		const v = safeLocalStorageGet(k);
		if(v !== null && v !== undefined){
			raw[k] = v;
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
	};
}

// AI 工作区段(async,IndexedDB 面):全 store dump;providerProfiles 剥明文 apiKey。
// IDB 整体不可用/单 store 失败 → 尽力而为(缺 store 不阻断其余;全空返回 null 段)。
export async function collectAiWorkspaceDump(){
	const stores = {};
	let any = false;
	const names = Object.values(AI_ANALYSIS_STORES);
	for(let i=0; i<names.length; i++){
		const name = names[i];
		try{
			// eslint-disable-next-line no-await-in-loop
			let list = await listStoreRecords(name);
			if(!Array.isArray(list)){
				list = [];
			}
			if(name === AI_ANALYSIS_STORES.providerProfiles){
				list = list.map((rec)=>{
					if(!rec || typeof rec !== 'object'){
						return rec;
					}
					const { apiKey, apiKeyDecryptFailed, ...rest } = rec;
					return { ...rest, apiKey: '', apiKeyRedacted: true };
				});
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

export async function buildUnifiedBackupBlob(){
	const manifest = await buildFullUnifiedManifest();
	const zip = new JSZip();
	zip.file(UNIFIED_MANIFEST_NAME, JSON.stringify(manifest));
	return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// 完整 manifest(含 aiWorkspace 段与分段校验和)。checksums 在全部数据段就绪后计算,
// 覆盖 charts/cases/trash/raw 逐键/aiWorkspace —— 恢复端逐段复核,坏段指认而非整包拒收。
export async function buildFullUnifiedManifest(){
	const manifest = buildUnifiedBackupManifest();
	try{
		manifest.aiWorkspace = await collectAiWorkspaceDump();
	}catch(e){
		manifest.aiWorkspace = null;
	}
	manifest.checksums = buildManifestChecksums(manifest);
	return manifest;
}

// [V5-B1] 内容指纹:同上次备份内容全等则跳过写盘(去重)。基于 checksums 段整体哈希
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
	// [V5-B7] 版本协商硬闸:包声明的最低 reader 版本高于本 app 能力 → 明确拒读并指引升级,
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
	// [V5-B5] 分段校验和复核:坏段列名(恢复端逐段隔离,好段照常恢复);无 checksums 的
	// 老包宽容(legacy)。
	const integrity = verifyManifestChecksums(manifest);
	if(!integrity.ok){
		return { ok: true, reason: 'checksum-bad', version, badSections: integrity.badSections };
	}
	if(version > UNIFIED_BACKUP_VERSION){
		return { ok: true, reason: 'newer-version', version };
	}
	return { ok: true, reason: null, version };
}

// 导入侧 raw 键三态:'merge'(lifeEvents 特判)/'replace'(登记 backup:true 或未登记=防呆收下)/
// 'reject'(cache/device-local——正常包不含,手改包防呆拒写)。
function rawImportMode(k){
	if(k === LIFE_EVENTS_KEY){
		return 'merge';
	}
	const e = classifyStorageKey(k);
	if(!e){
		return 'replace';
	}
	return e.backup === true ? 'replace' : 'reject';
}

// 逐 store 预览行 [{key,label,detail}] —— 确认框内容,与真实恢复逐项一致。
export function previewUnifiedRestore(manifest){
	const rows = [];
	if(manifest.charts){
		const p = previewLocalChartsBackup(manifest.charts);
		rows.push({ key: 'charts', label: '命盘', detail: p.ok ? `新增 ${p.adds} 条、按 ID 合并覆盖 ${p.updates} 条` : '信封无效，将跳过' });
	}
	if(manifest.cases){
		const p = previewLocalCasesBackup(manifest.cases);
		rows.push({ key: 'cases', label: '事盘', detail: p.ok ? `新增 ${p.adds} 条、按 ID 合并覆盖 ${p.updates} 条` : '信封无效，将跳过' });
	}
	const trash = manifest.trash && typeof manifest.trash === 'object' ? manifest.trash : {};
	Object.keys(TRASH_KEYS).forEach((slot)=>{
		if(trash[slot] === undefined){
			return;
		}
		rows.push({ key: `trash.${slot}`, label: slot === 'charts' ? '命盘回收站' : '事盘回收站', detail: '按 ID 并集合并，本机已有条目保留' });
	});
	const raw = manifest.raw && typeof manifest.raw === 'object' ? manifest.raw : {};
	Object.keys(raw).sort().forEach((k)=>{
		const mode = rawImportMode(k);
		if(mode === 'reject'){
			rows.push({ key: k, label: rawLabel(k), detail: '缓存/设备本地键，将跳过不写入' });
			return;
		}
		const localVal = safeLocalStorageGet(k);
		if(mode === 'merge'){
			rows.push({ key: k, label: rawLabel(k), detail: '按事件并集合并，同 ID 保本机' });
			return;
		}
		// [V5-B8] 恢复前 diff:与本机逐键比对,恢复从赌博变知情决策。
		if(localVal === null){
			rows.push({ key: k, label: rawLabel(k), detail: '本机无此数据，直接写入' });
		}else if(`${localVal}` === `${raw[k]}`){
			rows.push({ key: k, label: rawLabel(k), detail: '与本机完全相同，恢复无变化' });
		}else{
			rows.push({ key: k, label: rawLabel(k), detail: '与本机不同，整值替换本机现值' });
		}
	});
	if(manifest.aiWorkspace && manifest.aiWorkspace.stores && typeof manifest.aiWorkspace.stores === 'object'){
		const total = Object.keys(manifest.aiWorkspace.stores)
			.reduce((acc, s)=>acc + (Array.isArray(manifest.aiWorkspace.stores[s]) ? manifest.aiWorkspace.stores[s].length : 0), 0);
		rows.push({ key: 'aiWorkspace', label: 'AI 分析工作区（对话/消息/配置）', detail: `${total} 条记录，同 ID 保本机；密钥不随备份，恢复后需重填` });
	}
	return rows;
}

// 人生事件 per-出生签名 id-并集(同 id 保本机);坏形状跳过不写(诚实上报)。
function mergeLifeEventsRaw(incomingRaw){
	let incoming = null;
	try{
		incoming = JSON.parse(incomingRaw);
	}catch(e){
		return false;
	}
	if(!incoming || typeof incoming !== 'object' || Array.isArray(incoming)){
		return false;
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
	Object.keys(incoming).forEach((sig)=>{
		const inList = Array.isArray(incoming[sig]) ? incoming[sig] : [];
		const curList = Array.isArray(local[sig]) ? local[sig] : [];
		const seen = new Set(curList.map((e)=>(e && e.id) || null).filter(Boolean));
		const merged = curList.slice();
		inList.forEach((e)=>{
			if(e && e.id && !seen.has(e.id)){
				merged.push(e);
				seen.add(e.id);
			}
		});
		local[sig] = merged;
	});
	return safeLocalStorageSet(LIFE_EVENTS_KEY, JSON.stringify(local));
}

// 回收站并集:按 cid 保本机;合并后按 deletedAt 降序裁到容量上限(与 trash FIFO 语义一致)。
function mergeTrashRaw(trashKey, incomingRaw){
	let incoming = null;
	try{
		incoming = JSON.parse(incomingRaw);
	}catch(e){
		return false;
	}
	if(!Array.isArray(incoming)){
		return false;
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
	const seen = new Set(local.map((r)=>(r && r.cid) || null).filter(Boolean));
	const merged = local.slice();
	incoming.forEach((r)=>{
		if(r && r.cid && !seen.has(r.cid)){
			merged.push(r);
			seen.add(r.cid);
		}
	});
	merged.sort((a, b)=>`${(b && b.deletedAt) || ''}`.localeCompare(`${(a && a.deletedAt) || ''}`));
	return safeLocalStorageSet(trashKey, JSON.stringify(merged.slice(0, TRASH_CAP)));
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
		if(!valid.has(name)){
			continue;
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
export async function restoreUnifiedBackup(manifest){
	const results = [];
	// [V5-B5] 坏段隔离:校验和不符的段跳过并如实上报,好段照常恢复(绝不静默导入坏数据)。
	const integrity = verifyManifestChecksums(manifest);
	const badSet = new Set(integrity.badSections || []);
	badSet.forEach((s)=>{
		results.push({ key: s, ok: false, detail: '校验和不符（文件该段已损坏），已跳过保护本机数据' });
	});
	if(badSet.has('charts')){
		manifest = { ...manifest, charts: null };
	}
	if(badSet.has('cases')){
		manifest = { ...manifest, cases: null };
	}
	if(badSet.has('trash')){
		manifest = { ...manifest, trash: null };
	}
	if(badSet.has('aiWorkspace')){
		manifest = { ...manifest, aiWorkspace: null };
	}
	if(manifest.raw && typeof manifest.raw === 'object'){
		const cleanRaw = {};
		Object.keys(manifest.raw).forEach((k)=>{
			if(!badSet.has(`raw.${k}`)){
				cleanRaw[k] = manifest.raw[k];
			}
		});
		manifest = { ...manifest, raw: cleanRaw };
	}
	if(manifest.charts){
		try{
			const r = importLocalChartsBackup(manifest.charts);
			results.push({ key: 'charts', ok: true, detail: `导入 ${r.imported} 条${r.failed ? `，失败 ${r.failed} 条` : ''}` });
		}catch(e){
			results.push({ key: 'charts', ok: false, detail: '导入失败' });
		}
	}
	if(manifest.cases){
		try{
			const r = importLocalCasesBackup(manifest.cases);
			results.push({ key: 'cases', ok: true, detail: `导入 ${r.imported} 条${r.failed ? `，失败 ${r.failed} 条` : ''}` });
		}catch(e){
			results.push({ key: 'cases', ok: false, detail: '导入失败' });
		}
	}
	const trash = manifest.trash && typeof manifest.trash === 'object' ? manifest.trash : {};
	Object.keys(TRASH_KEYS).forEach((slot)=>{
		if(trash[slot] === undefined){
			return;
		}
		try{
			const ok = mergeTrashRaw(TRASH_KEYS[slot], trash[slot]);
			results.push({ key: `trash.${slot}`, ok, detail: ok ? '已按 ID 并集合并' : '数据形状异常，已跳过' });
		}catch(e){
			results.push({ key: `trash.${slot}`, ok: false, detail: '合并异常' });
		}
	});
	const raw = manifest.raw && typeof manifest.raw === 'object' ? manifest.raw : {};
	Object.keys(raw).sort().forEach((k)=>{
		try{
			const mode = rawImportMode(k);
			if(mode === 'reject'){
				results.push({ key: k, ok: true, detail: '缓存/设备本地键，已跳过' });
				return;
			}
			if(mode === 'merge'){
				const ok = mergeLifeEventsRaw(raw[k]);
				results.push({ key: k, ok, detail: ok ? '已按事件并集合并' : '数据形状异常，已跳过' });
				return;
			}
			const ok = safeLocalStorageSet(k, `${raw[k]}`);
			results.push({ key: k, ok, detail: ok ? '已写入' : '写入失败（空间不足？）' });
		}catch(e){
			results.push({ key: k, ok: false, detail: '写入异常' });
		}
	});
	if(manifest.aiWorkspace && typeof manifest.aiWorkspace === 'object'){
		try{
			const r = await restoreAiWorkspace(manifest.aiWorkspace);
			results.push({ key: 'aiWorkspace', ok: true, detail: `写入 ${r.put} 条、本机已有保留 ${r.kept} 条${r.failed ? `，失败 ${r.failed} 条` : ''}` });
		}catch(e){
			results.push({ key: 'aiWorkspace', ok: false, detail: '工作区恢复异常' });
		}
	}
	return results;
}
