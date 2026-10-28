// 「来源出过事」的持久标记(本机):记录库主存坏了 / 只在内存、AI 工作区读不开 —— 出事那一刻起记下,
// 标记在场期间:自动备份一律标 -degraded(backupDegradedSections 并入标记里的段)、修剪另留标记时刻之前最近一份健康包、
// 存储横幅持续给「从出事之前的自动备份恢复」。
//
// 为什么要持久:此前健康态只在本次运行内有效,重启后归零 —— 之后写的空库心跳包都算「健康」,修剪保留的「最近一份健康包」
// 变成了出事后的空库包,出事当天早些时候的好包被按天顶掉;坏主存横幅也只在出事那次运行里出现,重启后就没有「取出事之前那份」的入口。
//
// 按段记「出事类型」(kinds),问题消失的那一刻自动清掉那一段(单源规则 INCIDENT_AUTO_CLEAR,observeBackupHealth 执行):
//   reset       —— 主存坏了、没有影子可救,已从空库开始并落盘:之后写的包确实缺了出事前的数据 → 只在成功恢复 / 用户点「已处理」时清;
//   corrupt     —— 主存坏了、本次运行只在内存等对账:同一次运行里影子写回(数据完好)、健康态恢复正常即清;换了一次运行才看到正常的
//                  分不清是影子写回还是对账后从空库开始落了盘(那次运行没来得及再观察)→ 不清(按 reset 一样等恢复 / 「已处理」);
//   memory      —— 存储不可用、记录只在内存:换了一次运行(重启 / 刷新)且存储正常即清(同一次运行里健康态可能还没来得及降级);
//   unavailable —— AI 工作区读不开(内存回退):之后组装备份时库读得开了即清;
//   legacy      —— 旧版写下的标记(没有类型,分不清是哪一种):按最保守的 reset 处理。
// 此前标记只增不减:AI 库读得开之后、只在内存的那次运行重启之后、影子写回之后,照样把之后所有自动备份标成 -degraded;
// 用户一直没点「已处理」,几周后另一件事触发的「从最近的自动备份恢复」(preferHealthy)跳过最近几周的完整备份、取出事前那份很旧的包。
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safeStorage';

export const BACKUP_INCIDENT_KEY = 'horosa.backup.incident.v1';
export const BACKUP_INCIDENT_EVENT = 'horosa:backup-incident-changed';
const KNOWN_SECTIONS = ['charts', 'cases', 'aiWorkspace'];
export const INCIDENT_KINDS = ['reset', 'corrupt', 'memory', 'unavailable', 'legacy'];
// 同一段先后观察到几种:取更严重的(legacy 视同 reset)
const KIND_RANK = { unavailable: 1, memory: 1, corrupt: 2, reset: 3, legacy: 3 };
// 哪几种问题消失即自动清(reset / legacy 不清:那段时间写的包确实不完整)
export const INCIDENT_AUTO_CLEAR = Object.freeze({ corrupt: 'healthy-same-run', memory: 'healthy-next-run', unavailable: 'healthy' });

// 本次运行的身份(每次页面加载一份):memory 类只在「换了一次运行」后才按健康清
let RUN_ID = '';
function runId(){
	if(!RUN_ID){ RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
	return RUN_ID;
}
export function __setIncidentRunIdForTests(id){ RUN_ID = id || ''; }

function emit(){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(BACKUP_INCIDENT_EVENT));
		}
	}catch(e){ /* 横幅下次挂载时读 */ }
}

// 记录库健康态(localRecordStore.getHealth)→ 这一段现在的状况:'reset' | 'corrupt' | 'memory' | 'ok'
export function storeHealthKind(h){
	if(!h || typeof h !== 'object'){ return 'ok'; }
	if(h.corrupt){ return h.corrupt.resetToEmpty ? 'reset' : 'corrupt'; }
	if(h.mode === 'memory'){ return 'memory'; }
	return 'ok';
}

// { at:number, sections:string[], kinds:{段:类型}, runs:{段:运行身份} } 或 null(没有 / 坏档)。永不抛
export function readBackupIncident(){
	const raw = safeLocalStorageGet(BACKUP_INCIDENT_KEY);
	if(!raw){ return null; }
	try{
		const o = JSON.parse(raw);
		if(!o || typeof o !== 'object' || !Number.isFinite(Number(o.at)) || Number(o.at) <= 0){ return null; }
		const sections = Array.isArray(o.sections) ? [...new Set(o.sections.filter((s)=>KNOWN_SECTIONS.indexOf(s) >= 0))] : [];
		if(!sections.length){ return null; }
		const kinds = {};
		const runs = {};
		sections.forEach((s)=>{
			const k = o.kinds && typeof o.kinds === 'object' ? o.kinds[s] : undefined;
			kinds[s] = INCIDENT_KINDS.indexOf(k) >= 0 ? k : 'legacy';
			const r = o.runs && typeof o.runs === 'object' ? o.runs[s] : undefined;
			if(typeof r === 'string' && r){ runs[s] = r; }
		});
		return { at: Number(o.at), sections, kinds, runs };
	}catch(e){
		return null;
	}
}

function writeIncident(next, cur){
	const same = cur && next && cur.at === next.at && JSON.stringify(cur.sections) === JSON.stringify(next.sections)
		&& JSON.stringify(cur.kinds) === JSON.stringify(next.kinds) && JSON.stringify(cur.runs) === JSON.stringify(next.runs);
	if(same){ return cur; }
	if(!next || !next.sections.length){
		if(safeLocalStorageGet(BACKUP_INCIDENT_KEY) !== null){ safeLocalStorageRemove(BACKUP_INCIDENT_KEY); emit(); }
		return null;
	}
	safeLocalStorageSet(BACKUP_INCIDENT_KEY, JSON.stringify(next));
	emit();
	return next;
}

// 记下出事:已有标记 → 段取并集、时刻取较早的、类型取更严重的。kinds 缺 = 按段的默认类型(aiWorkspace = unavailable,
// 记录库 = corrupt)。at 缺省 = 现在。返回写后的标记
export function recordBackupIncident(sections, at, kinds){
	const add = [...new Set((Array.isArray(sections) ? sections : []).filter((s)=>KNOWN_SECTIONS.indexOf(s) >= 0))];
	const cur = readBackupIncident();
	if(!add.length){ return cur; }
	const when = Number.isFinite(Number(at)) && Number(at) > 0 ? Number(at) : Date.now();
	const nextKinds = { ...(cur ? cur.kinds : {}) };
	const nextRuns = { ...(cur ? cur.runs : {}) };
	add.forEach((s)=>{
		const given = kinds && typeof kinds === 'object' ? kinds[s] : undefined;
		const k = INCIDENT_KINDS.indexOf(given) >= 0 && given !== 'legacy' ? given : (s === 'aiWorkspace' ? 'unavailable' : 'corrupt');
		const old = nextKinds[s];
		if(!old || KIND_RANK[k] > KIND_RANK[old]){ nextKinds[s] = k; }
		nextRuns[s] = runId();
	});
	const next = {
		at: cur ? Math.min(cur.at, when) : when,
		sections: cur ? [...new Set([...cur.sections, ...add])] : add,
		kinds: nextKinds,
		runs: nextRuns,
	};
	return writeIncident(next, cur);
}

// 一次观察(横幅挂载 / 每次组装备份):observed = { charts?, cases?, aiWorkspace? },取值 'ok' | 'reset' | 'corrupt' | 'memory' |
// 'unavailable'(没观察到的段不给)。不健康的段记下(类型取更严重的),健康的段按 INCIDENT_AUTO_CLEAR 清掉。at = 最早发现的时刻。
// 返回观察之后的标记(可能为 null)
export function observeBackupHealth(observed, at){
	const obs = observed && typeof observed === 'object' ? observed : {};
	const bad = Object.keys(obs).filter((s)=>KNOWN_SECTIONS.indexOf(s) >= 0 && obs[s] && obs[s] !== 'ok');
	let cur = bad.length ? recordBackupIncident(bad, at, obs) : readBackupIncident();
	if(!cur){ return null; }
	const clear = cur.sections.filter((s)=>{
		if(obs[s] !== 'ok'){ return false; }
		const rule = INCIDENT_AUTO_CLEAR[cur.kinds[s]];
		if(rule === 'healthy'){ return true; }
		if(rule === 'healthy-next-run'){ return !!cur.runs[s] && cur.runs[s] !== runId(); }
		if(rule === 'healthy-same-run'){ return cur.runs[s] === runId(); }
		return false;
	});
	if(!clear.length){ return cur; }
	const sections = cur.sections.filter((s)=>clear.indexOf(s) < 0);
	const kinds = {};
	const runs = {};
	sections.forEach((s)=>{ kinds[s] = cur.kinds[s]; if(cur.runs[s]){ runs[s] = cur.runs[s]; } });
	cur = writeIncident({ at: cur.at, sections, kinds, runs }, cur);
	return cur;
}

// 标记里还在的段是不是都已恢复正常、只差用户确认(reset / 旧版标记)—— 横幅据此给不同的说法
export function incidentNeedsAcknowledge(incident){
	const i = incident || {};
	const k = i.kinds || {};
	const r = i.runs || {};
	return Array.isArray(i.sections) && i.sections.length > 0 && i.sections.every((s)=>!INCIDENT_AUTO_CLEAR[k[s]] || (k[s] === 'corrupt' && r[s] !== runId()));
}

export function clearBackupIncident(){
	if(safeLocalStorageGet(BACKUP_INCIDENT_KEY) === null){ return; }
	safeLocalStorageRemove(BACKUP_INCIDENT_KEY);
	emit();
}

// 全量恢复之后:出事的那几部分都成功写回磁盘了(对应结果行 ok、记录库不是只进了内存)→ 清掉标记。results 为恢复结果行
export function settleBackupIncidentAfterRestore(results){
	const cur = readBackupIncident();
	if(!cur){ return false; }
	const rows = Array.isArray(results) ? results : [];
	const fine = cur.sections.every((s)=>{
		const row = rows.find((r)=>r && r.key === s);
		return !!(row && row.ok && !row.sessionOnly);
	});
	if(fine){ clearBackupIncident(); }
	return fine;
}
