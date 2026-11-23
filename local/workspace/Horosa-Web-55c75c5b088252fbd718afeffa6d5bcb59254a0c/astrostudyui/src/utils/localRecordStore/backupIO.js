// 本地记录存储 · 备份导入导出:导出信封、信封校验、较新判定、本机删除索引、导入预览、重复判定(导入执行会改写工厂里的修订戳,留在主文件)
// 从 localRecordStore.js 按职责拆出的 createLocalRecordStore 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { parseLocalDateTimeMs } from '../dateTimeParse';
import { nowStr } from './recordShape';
import { sortByUpdateTimeDesc } from './listSerialize';
import { resolveSameCid, sameCidLabelOf } from './trashLog';

export function exportBackup({ readRaw, envelopeFormat, envelopeListField }){
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
export function validateBackupEnvelope({ envelopeListField, envelopeFormat }, payload){
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
export function incomingIsNewer(item, local){
	const ti = parseLocalDateTimeMs((item && item.updateTime) || '') || 0;
	const tl = parseLocalDateTimeMs((local && local.updateTime) || '') || 0;
	return ti > tl;
}

// 包里这一条在本机之后被删过(删除时刻晚于包里那版的更新时间)
export function deletedAfter(index, item){
	const t = index && item && item.cid ? index.get(`${item.cid}`) : undefined;
	return t !== undefined && t > (parseLocalDateTimeMs((item && item.updateTime) || '') || 0);
}

// opts.sameCid:'newer'(缺省)|'backup'|'merge',opts.mergeCids:只有这些按字段合并 —— 见 resolveSameCid。
// opts.respectLocalDeletions:本机库里没有、却在本机回收站 / 删除日志里且删除时刻晚于包里那版更新时间的 → 不带回(计 skippedDeleted)
export function previewImportBackup({
	validateBackupEnvelope, readRaw, localDeletionIndex, envelopeListField, importProblem, invalidEntry,
	incomingIsNewer, deletedAfter, isExactDuplicate,
}, payload, opts){
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
export function isExactDuplicate({ searchField }, item, existing){
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
