// AI 分析挂载上下文 · 快照匹配:日期 / 时刻规范化、源签名、元数据兼容、载荷与缓存取快照、口径比对、重算结果缓存。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import { parseDateTimeMs } from '../dateTimeParse';
import { mountCalibreSignature } from '../mountCalibreSignature';
// 「列挂载源」及其纯函数助手抽至轻模块 aiAnalysisSources —— 个别页面只需
// 列源,曾因 import 本文件连带整座 AI 核(~50 技法构建器)进自己的 chunk(46/47 回灌案)。
// 此处 import 供本文件其余函数继续使用,listAnalysisSources 在文件尾 re-export 保旧路径兼容。
import { extractSnapshotText } from '../aiAnalysisSources';
import { loadModuleAISnapshot, MODULE_SNAPSHOT_PREFIX } from '../moduleAiSnapshot';
import { normalizeTechniqueKey, getTechniqueAliasList } from './techniqueKey';
import { hashPromptText } from './contextLayers';
import { toSlashDate } from '../dateStrSafe';
import { registerProcessCache } from '../processCacheRegistry';

function normalizeDateText(value){
	const raw = `${value || ''}`.trim();
	if(!raw){
		return '';
	}
	const matched = raw.match(/^(-?\d+)[-/](\d{1,2})[-/](\d{1,2})/);
	if(!matched){
		return toSlashDate(raw);
	}
	return `${matched[1]}/${matched[2].padStart(2, '0')}/${matched[3].padStart(2, '0')}`;
}

function normalizeMinuteTime(value){
	const raw = `${value || ''}`.trim();
	if(!raw){
		return '';
	}
	const matched = raw.match(/^(\d{1,2}):(\d{2})/);
	if(!matched){
		return raw;
	}
	return `${matched[1].padStart(2, '0')}:${matched[2]}`;
}

export function buildSourceSignature(source){
	const record = source && source.record ? source.record : null;
	if(!record){
		return {
			date: '',
			time: '',
			zone: '',
			lon: '',
			lat: '',
		};
	}
	const rawTime = source.sourceType === 'chart' ? record.birth : (record.divTime || record.updateTime || '');
	const matched = `${rawTime || ''}`.trim().match(/^(-?\d+)-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
	if(!matched){
		return {
			date: normalizeDateText(rawTime),
			time: normalizeMinuteTime(rawTime),
			zone: `${record.zone || ''}`.trim(),
			lon: `${record.lon || ''}`.trim(),
			lat: `${record.lat || ''}`.trim(),
		};
	}
	return {
		date: `${matched[1]}/${matched[2]}/${matched[3]}`,
		time: normalizeMinuteTime(`${matched[4] || '00'}:${matched[5] || '00'}:${matched[6] || '00'}`),
		zone: `${record.zone || ''}`.trim(),
		lon: `${record.lon || ''}`.trim(),
		lat: `${record.lat || ''}`.trim(),
	};
}

function isSnapshotMetaCompatible(snapshotMeta, source){
	if(!snapshotMeta || typeof snapshotMeta !== 'object'){
		return true;
	}
	const current = buildSourceSignature(source);
	const snapDate = normalizeDateText(snapshotMeta.date || snapshotMeta.birth || '');
	if(current.date && snapDate && current.date !== snapDate){
		return false;
	}
	const snapTime = normalizeMinuteTime(snapshotMeta.time || '');
	if(current.time && snapTime && current.time !== snapTime){
		return false;
	}
	const snapZone = `${snapshotMeta.zone || ''}`.trim();
	if(current.zone && snapZone && current.zone !== snapZone){
		return false;
	}
	const snapLon = `${snapshotMeta.lon || ''}`.trim();
	if(current.lon && snapLon && current.lon !== snapLon){
		return false;
	}
	const snapLat = `${snapshotMeta.lat || ''}`.trim();
	if(current.lat && snapLat && current.lat !== snapLat){
		return false;
	}
	return true;
}

// (extractSnapshotText 已迁 aiAnalysisSources.js —— 顶部 import)

export function pickSnapshotCandidate(candidates){
	// 拒绝与当前案例出生/起盘签名明确不匹配的候选，避免挂载到「上次看过的那张盘」。
	// generated 候选恒为 compatible:true；payload/cache 候选由 isSnapshotMetaCompatible 判定（源签名为空时为 true，不误伤）。
	const valid = (candidates || []).filter((item)=>item && item.content && item.compatible !== false);
	if(!valid.length){
		return null;
	}
	valid.sort((a, b)=>{
		const sa = a.specificity || 0;
		const sb = b.specificity || 0;
		if(sa !== sb){
			return sb - sa;
		}
		if(Boolean(a.compatible) !== Boolean(b.compatible)){
			return a.compatible ? -1 : 1;
		}
		if(Boolean(a.fromPayload) !== Boolean(b.fromPayload)){
			return a.fromPayload ? -1 : 1;
		}
		const ta = parseDateTimeMs(a.createdAt || '') || 0;
		const tb = parseDateTimeMs(b.createdAt || '') || 0;
		if(ta !== tb){
			return tb - ta;
		}
		return `${b.content || ''}`.length - `${a.content || ''}`.length;
	});
	return valid[0];
}

export function getTechniqueSnapshotFromPayload(payload, moduleName, source){
	if(!payload || typeof payload !== 'object'){
		return null;
	}
	const aliases = getTechniqueAliasList(moduleName);
	const aliasSet = new Set(aliases);
	const record = source && source.record ? source.record : null;
	const primaryPayloadKey = normalizeTechniqueKey(
		payload.module
		|| payload.moduleName
		|| payload.sourceModule
		|| (record && (record.sourceModule || record.caseType || record.chartType))
		|| ''
	);
	const genericSnapshotMatchesRequest = !primaryPayloadKey || aliasSet.has(primaryPayloadKey);
	const candidates = [];
	const pushCandidate = (raw, extra = {})=>{
		const content = extractSnapshotText(raw);
		if(!content){
			return;
		}
		candidates.push({
			content,
			createdAt: extra.createdAt || '',
			meta: extra.meta || {},
			compatible: isSnapshotMetaCompatible(extra.meta, source),
			fromPayload: true,
			specificity: extra.specificity || 0,
		});
	};
	if(genericSnapshotMatchesRequest){
		pushCandidate(payload.snapshot, {
			meta: payload.meta || {},
			createdAt: payload.createdAt || '',
			specificity: 0,
		});
	}
	if(payload.module && aliasSet.has(normalizeTechniqueKey(payload.module))){
		pushCandidate(payload.snapshot, {
			meta: payload.meta || {},
			createdAt: payload.createdAt || '',
			specificity: 1,
		});
	}
	aliases.forEach((alias, idx)=>{
		const aliasSpecificity = Math.max(2, 40 - idx);
		const moduleSpecificity = Math.max(3, 60 - idx);
		if(payload[alias] !== undefined){
			pushCandidate(payload[alias], {
				meta: payload.meta || {},
				createdAt: payload.createdAt || '',
				specificity: aliasSpecificity,
			});
		}
		const moduleSnapshots = payload.moduleSnapshots && typeof payload.moduleSnapshots === 'object' ? payload.moduleSnapshots : null;
		if(moduleSnapshots && moduleSnapshots[alias] !== undefined){
			pushCandidate(moduleSnapshots[alias], {
				meta: moduleSnapshots[alias] && moduleSnapshots[alias].meta ? moduleSnapshots[alias].meta : payload.meta || {},
				createdAt: moduleSnapshots[alias] && moduleSnapshots[alias].createdAt ? moduleSnapshots[alias].createdAt : payload.createdAt || '',
				specificity: moduleSpecificity,
			});
		}
		const modules = payload.modules && typeof payload.modules === 'object' ? payload.modules : null;
		if(modules && modules[alias] !== undefined){
			pushCandidate(modules[alias], {
				meta: modules[alias] && modules[alias].meta ? modules[alias].meta : payload.meta || {},
				createdAt: modules[alias] && modules[alias].createdAt ? modules[alias].createdAt : payload.createdAt || '',
				specificity: moduleSpecificity,
			});
		}
	});
	const snapshots = payload.snapshots && typeof payload.snapshots === 'object' ? payload.snapshots : null;
	if(snapshots){
		Object.keys(snapshots).forEach((rawKey)=>{
			const key = `${rawKey || ''}`.trim();
			if(!key){
				return;
			}
			const suffix = key.indexOf(MODULE_SNAPSHOT_PREFIX) === 0 ? key.substring(MODULE_SNAPSHOT_PREFIX.length) : key;
			if(!aliasSet.has(normalizeTechniqueKey(suffix))){
				return;
			}
			pushCandidate(snapshots[rawKey], {
				meta: snapshots[rawKey] && snapshots[rawKey].meta ? snapshots[rawKey].meta : payload.meta || {},
				createdAt: snapshots[rawKey] && snapshots[rawKey].createdAt ? snapshots[rawKey].createdAt : payload.createdAt || '',
				specificity: 3,
			});
		});
	}
	return pickSnapshotCandidate(candidates);
}

// 全局模块缓存 `horosa.ai.snapshot.module.v1.<module>` 本质是「上次算过的某一张盘/卦」（key 不含出生时间）。
// 复用它【只能在签名确凿匹配当前源时】，否则宁可回退按本盘出生数据重算，也绝不挂错盘。
// 与宽松的 isSnapshotMetaCompatible 不同：这里要求 date 双方都有且相等（date 是最强身份位）；
// 缺签名 / 单边为空一律判不确凿（false），交由 buildTechniqueContext 走重算分支。
export function isCacheSnapshotConfidentMatch(snapshotMeta, source){
	if(!snapshotMeta || typeof snapshotMeta !== 'object'){
		return false;
	}
	const current = buildSourceSignature(source);
	const snapDate = normalizeDateText(snapshotMeta.date || snapshotMeta.birth || '');
	if(!current.date || !snapDate || current.date !== snapDate){
		return false;
	}
	const snapTime = normalizeMinuteTime(snapshotMeta.time || '');
	if(current.time && snapTime && current.time !== snapTime){
		return false;
	}
	const snapZone = `${snapshotMeta.zone || ''}`.trim();
	if(current.zone && snapZone && current.zone !== snapZone){
		return false;
	}
	const snapLon = `${snapshotMeta.lon || ''}`.trim();
	if(current.lon && snapLon && current.lon !== snapLon){
		return false;
	}
	const snapLat = `${snapshotMeta.lat || ''}`.trim();
	if(current.lat && snapLat && current.lat !== snapLat){
		return false;
	}
	return true;
}

export function getTechniqueSnapshotFromCache(moduleName, source){
	const aliases = getTechniqueAliasList(moduleName);
	const candidates = aliases.map((alias, idx)=>{
		const snapshot = loadModuleAISnapshot(alias);
		if(!snapshot || !snapshot.content){
			return null;
		}
		return {
			content: snapshot.content,
			createdAt: snapshot.createdAt || '',
			meta: snapshot.meta || {},
			// 出生签名之外再比全局口径签名:改过「星盘设置」全局口径/日界偏好后,带旧签名的模块快照不再直喂;
			// 无签名的旧存量(升级前写的)不拦(部分技法只有页面能产快照,拦了会退化为 missing),其后页面一重算即带签。
			compatible: isCacheSnapshotConfidentMatch(snapshot.meta, source) && isModuleSnapshotCalibreCurrent(snapshot),
			fromPayload: false,
			specificity: Math.max(2, 40 - idx),
		};
	}).filter(Boolean);
	return pickSnapshotCandidate(candidates);
}

function isModuleSnapshotCalibreCurrent(snapshot){
	if(!snapshot || !snapshot.calibreSig){ return true; }   // 无签名的旧存量不拦
	return snapshot.calibreSig === mountCalibreSignature();
}

// 重算结果内存小缓存(见 buildTechniqueContext):键 = 技法 + 整份记录指纹 + 星盘口径签名(比页面槽的命中条件「出生签名 + 口径签名」更严);32 条、10 分钟
export const REGENERATED_SNAPSHOT_CACHE = new Map();
export const REGENERATED_SNAPSHOT_MAX = 32;
export const REGENERATED_SNAPSHOT_TTL_MS = 10 * 60 * 1000;
export function regeneratedSnapshotKey(key, record){
	let body = '';
	try{ body = JSON.stringify(record || null); }catch(e){ return ''; }
	const calibre = mountCalibreSignature();
	return `${key}#${hashPromptText(body)}#${calibre}`;
}
export function __resetRegeneratedSnapshotCacheForTests(){ REGENERATED_SNAPSHOT_CACHE.clear(); }
registerProcessCache('aiAnalysis.regeneratedSnapshot', ()=>REGENERATED_SNAPSHOT_CACHE.clear());
