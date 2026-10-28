// 自动备份体系:定时/风险操作前 打全量 zip 到用户可见目录,
// GFS 梯度保留,写前内存自验,内容指纹去重。
//
// 通道:仅桌面端(壳层命令写 ~/Documents/Horosa Backups/,用户可见、进 Time Machine 面、
// 可自行指向网盘目录);浏览器 dev = no-op。调度触发:壳层 Rust timer 每 30 分钟 emit
// (不依赖 WebView 定时器 —— 窗口最小化/节能会漂移);风险操作(恢复/导入/清空回收站)前
// 由调用点显式 runAutoBackupOnce({trigger:'pre-risk'}) 强制先备份。
// 第二实例不自动备份(与影子副本同理:独立数据集,不许覆盖主实例的备份序列)。
import { parseDateTimeMs } from './dateTimeParse';
import { invokeDesktopCommand } from './aiAnalysisDesktop';
import { shadowMirrorEligible } from './shadowMirror';
import { safeLocalStorageGet, safeLocalStorageSet } from './safeStorage';
import { readBackupIncident } from './backupIncident';
import {
	buildFullUnifiedManifest, manifestContentFingerprint, validateUnifiedBackup,
} from './unifiedBackup';

const LAST_RESULT_KEY = 'horosa.backup.lastResult';
const FILE_PREFIX = 'horosa-backup-';
// 来源不健康时写的备份(AI 工作区读不开 / 记录库只在内存或主存坏了):文件名带这个尾巴,修剪时永远另留最近一份健康的
const DEGRADED_SUFFIX = '-degraded';

// 只有主实例做(与影子副本同一判据、同一份实现):桌面桥在 + 不是独立的第二实例。
function eligible(){
	return shadowMirrorEligible();
}

// GFS 梯度保留(纯函数,输入=现存备份时间戳毫秒数组+now,输出=保留集合):
//   近 48 小时全保 · 近 14 天每天保最新一份 · 近 8 周每周保最新一份 · 近 12 月每月保最新一份。
// 纯函数便于表驱动测试;调用方拿保留集反推删除名单。
export function gfsRetain(timestamps, now){
	const keep = new Set();
	const sorted = timestamps.slice().sort((a, b)=>b - a);
	const DAY = 24 * 3600 * 1000;
	const buckets = new Set();
	sorted.forEach((t)=>{
		const age = now - t;
		if(age <= 2 * DAY){
			keep.add(t);
			return;
		}
		let bucket = null;
		if(age <= 14 * DAY){
			bucket = `d${Math.floor(t / DAY)}`;
		}else if(age <= 56 * DAY){
			bucket = `w${Math.floor(t / (7 * DAY))}`;
		}else if(age <= 365 * DAY){
			const d = new Date(parseDateTimeMs(t));
			bucket = `m${d.getUTCFullYear()}-${d.getUTCMonth()}`;
		}
		if(bucket && !buckets.has(bucket)){
			buckets.add(bucket);
			keep.add(t);
		}
	});
	return keep;
}

// 文件名 ↔ 时间戳:horosa-backup-YYYYMMDD-HHmmss.zip(ISO 派生,字典序=时间序);来源不健康的那份带 -degraded 尾巴。
export function backupFileName(atMs, opts){
	const d = new Date(atMs);
	const p = (n, w)=>`${n}`.padStart(w, '0');
	return `${FILE_PREFIX}${d.getFullYear()}${p(d.getMonth() + 1, 2)}${p(d.getDate(), 2)}-${p(d.getHours(), 2)}${p(d.getMinutes(), 2)}${p(d.getSeconds(), 2)}${opts && opts.degraded ? DEGRADED_SUFFIX : ''}.zip`;
}

const BACKUP_NAME_RE = /^horosa-backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(-degraded)?\.zip$/;
export function parseBackupFileName(name){
	const m = BACKUP_NAME_RE.exec(`${name}`);
	if(!m){
		return null;
	}
	return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

// 这份备份写的时候来源不健康吗(只认文件名;旧版本写的都没有尾巴 = 按健康算)
export function isDegradedBackupName(name){
	const m = BACKUP_NAME_RE.exec(`${name}`);
	return !!(m && m[7]);
}

// 修剪保留集:GFS 梯度 + 永远另留最近一份健康的备份。
// 来源出了问题(AI 工作区读不开 / 记录库坏了从空库开始)之后照常写的心跳备份会按天顶掉出事前的好包;
// 用户过几天才发现时,至少还有出事前最后一份完整的可恢复。entries:[{ ts, degraded }]
// opts.incidentAt:持久「出事」标记的时刻(backupIncident)—— 另留这一刻之前最近一份健康包(重启后健康态归零,
// 出事后写的包若当时没标出,最近一份「健康」的可能已是出事后的空库包;出事前那份必须留着)
export function retainBackupSet(entries, now, opts){
	const list = Array.isArray(entries) ? entries.filter((e)=>e && Number.isFinite(e.ts)) : [];
	const keep = gfsRetain(list.map((e)=>e.ts), now);
	const healthyAll = list.filter((e)=>!e.degraded).sort((a, b)=>b.ts - a.ts);
	if(healthyAll[0]){ keep.add(healthyAll[0].ts); }
	const incidentAt = opts && Number(opts.incidentAt);
	if(incidentAt > 0){
		const before = healthyAll.find((e)=>e.ts < incidentAt);
		if(before){ keep.add(before.ts); }
	}
	return keep;
}

function readLastResult(){
	try{
		const raw = safeLocalStorageGet(LAST_RESULT_KEY);
		return raw ? JSON.parse(raw) : null;
	}catch(_e){
		return null;
	}
}

function writeLastResult(r){
	try{
		safeLocalStorageSet(LAST_RESULT_KEY, JSON.stringify(r));
	}catch(_e){
		// 结果记录失败无害(下次备份照常)。
	}
}

export function getAutoBackupStatus(){
	return { enabled: eligible(), last: readLastResult() };
}

// 最近一次自动备份失败的原因,换成用户看得懂的一句(健康页用;原文另放 title / 诊断包)。
// 「没有访问权限」单独说清:macOS 首次写「文稿」文件夹会弹系统授权框,点了「不允许」之后自动备份一直写不进
export function describeAutoBackupFailure(reason){
	const r = `${reason || ''}`;
	if(!r){ return '没写成'; }
	if(/self-verify-failed/.test(r)){ return '备份内容自检没通过，这次没有写盘'; }
	if(/operation not permitted|permission denied|not permitted|access denied|os error 1\b|os error 13\b/i.test(r)){
		return '没有写入「文稿 › Horosa Backups」的权限（备份放在其中以本应用命名的子文件夹）：请到「系统设置 › 隐私与安全性 › 文件与文件夹」里允许星阙访问「文稿」文件夹';
	}
	if(/no space left|os error 28|disk full/i.test(r)){ return '磁盘空间不足，没写成'; }
	return '没写成（原始错误见诊断信息）';
}

// 执行一次自动备份:组装 manifest → 内存自验(格式闸+校验和自洽) → 指纹与上次
// 比对(数据没变则跳过) → base64 交壳层原子写 → GFS 修剪。全程绝不 throw(备份失败不
// 阻断业务;结果如实落 lastResult 供健康页/页脚)。
export async function runAutoBackupOnce(opts){
	const trigger = (opts && opts.trigger) || 'timer';
	if(!eligible()){
		return { ok: false, skipped: true, reason: 'not-desktop-primary' };
	}
	try{
		const manifest = await buildFullUnifiedManifest();
		const check = validateUnifiedBackup(manifest);
		if(!check.ok || (check.reasons || [check.reason]).indexOf('checksum-bad') >= 0){
			const r = { ok: false, at: Date.now(), trigger, reason: `self-verify-failed:${check.reason}` };
			writeLastResult(r);
			return r;
		}
		const fingerprint = manifestContentFingerprint(manifest);
		const last = readLastResult();
		const degraded = Array.isArray(manifest.degraded) && manifest.degraded.length ? manifest.degraded.slice() : null;
		if(trigger === 'timer' && last && last.ok && last.fingerprint === fingerprint && !!last.degraded === !!degraded){
			return { ok: true, skipped: true, reason: 'unchanged', fingerprint };
		}
		// 手动 zip 打包在壳层完成(送 manifest 文本,壳侧写入 zip 太重;直接送 JSON 文本入
		// zip 由前端 JSZip 完成,与手动备份同构):
		// eslint-disable-next-line global-require
		const JSZip = require('jszip');
		const zip = new JSZip();
		zip.file('manifest.json', JSON.stringify(manifest));
		const base64Data = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
		const at = Date.now();
		const fileName = backupFileName(at, { degraded: !!degraded });
		const path = await invokeDesktopCommand('auto_backup_write_command', { fileName, base64Data });
		const prevResult = readLastResult() || {};
		const result = { ok: true, at, trigger, fingerprint, path, verified: true };
		// 来源不健康:照写(总比不写强),但如实标出哪几段、连续第几份(健康页 / 诊断看得见),修剪永远另留最近一份健康的
		if(degraded){
			result.degraded = degraded;
			result.degradedCount = (Number(prevResult.degradedCount) || 0) + 1;
		}
		// 每周抽验**最老**一份(restic 范式:老备份才是恢复时真正要依赖的;坏了大声报)。
		result.lastDeepVerifyAt = prevResult.lastDeepVerifyAt || 0;
		result.oldestVerified = prevResult.oldestVerified;
		if(at - (result.lastDeepVerifyAt || 0) > 7 * 24 * 3600 * 1000){
			try{
				const names = await invokeDesktopCommand('auto_backup_list_command', {});
				if(Array.isArray(names) && names.length){
					const oldest = names.slice().sort()[0];
					const b64 = await invokeDesktopCommand('auto_backup_read_command', { fileName: oldest });
					const bin = typeof atob === 'function' ? Uint8Array.from(atob(b64), (c)=>c.charCodeAt(0)) : Buffer.from(b64, 'base64');
					// eslint-disable-next-line global-require
					const { parseUnifiedBackupBlob, validateUnifiedBackup: validate2 } = require('./unifiedBackup');
					const parsed = await parseUnifiedBackupBlob(bin);
					const check2 = parsed ? validate2(parsed) : { ok: false, reason: 'unreadable' };
					result.lastDeepVerifyAt = at;
					result.oldestVerified = { name: oldest, ok: !!check2.ok && (check2.reasons || [check2.reason]).indexOf('checksum-bad') < 0, reason: check2.reason || null };
				}
			}catch(_e){
				result.oldestVerified = { ok: false, reason: 'read-failed' };
			}
		}
		writeLastResult(result);
		await pruneBackups(at);
		return result;
	}catch(e){
		const r = { ok: false, at: Date.now(), trigger, reason: `${(e && e.message) || e}` };
		writeLastResult(r);
		return r;
	}
}

// 「有健康的就取健康的」的时间窗:最近一份是来源不健康的包时,只在它比最近一份健康包新得不多(出事之后这么久之内)才改取健康包;
// 降级包已经连着写了更久(出事标记一直没清,之后的数据都在这些包里)→ 取最近一份。此前不限时:几周前出过事、一直没点「已处理」,
// 另一件事触发的「从最近的自动备份恢复」跳过最近几周的完整备份、取出事前那份很旧的包,设置类整值回到几周前。
export const PREFER_HEALTHY_WINDOW_MS = 7 * 24 * 3600 * 1000;

// candidates:[{ at, degraded }] 已按时刻倒序。返回选中的那一项(纯函数,单测锁)
export function pickAutoBackupCandidate(candidates, opts){
	const list = Array.isArray(candidates) ? candidates : [];
	const latest = list[0] || null;
	if(!latest || !(opts && opts.preferHealthy) || !latest.degraded){ return latest; }
	const healthy = list.find((x)=>!x.degraded);
	if(!healthy){ return latest; }
	const windowMs = opts && Number(opts.windowMs) > 0 ? Number(opts.windowMs) : PREFER_HEALTHY_WINDOW_MS;
	return latest.at - healthy.at <= windowMs ? healthy : latest;
}

// 最近一份自动备份(存储被清空后「从最近的自动备份恢复全部数据」用):opts.before = 只取这个时刻之前写的
// (启动时发现存储被清空 → 取启动之前那份;之后心跳写的是清空后的残缺状态)。返回 { name, at, bytes } 或 null(没有 / 非桌面)。
export async function readLatestAutoBackup(opts){
	if(!eligible()){
		return null;
	}
	const before = opts && Number.isFinite(Number(opts.before)) ? Number(opts.before) : Infinity;
	try{
		const names = await invokeDesktopCommand('auto_backup_list_command', {});
		if(!Array.isArray(names)){
			return null;
		}
		const candidates = names
			.map((n)=>({ name: n, at: parseBackupFileName(n), degraded: isDegradedBackupName(n) }))
			.filter((x)=>x.at !== null && x.at < before)
			.sort((a, b)=>b.at - a.at);
		// opts.preferHealthy:有健康的就取最近一份健康的(记录库坏了从空库开始之后写的那几份是空库,不该先拿它),限时窗内(pickAutoBackupCandidate)
		const pick = pickAutoBackupCandidate(candidates, opts);
		if(!pick){
			return null;
		}
		const b64 = await invokeDesktopCommand('auto_backup_read_command', { fileName: pick.name });
		const bytes = typeof atob === 'function' ? Uint8Array.from(atob(b64), (c)=>c.charCodeAt(0)) : Buffer.from(b64, 'base64');
		return { name: pick.name, at: pick.at, bytes };
	}catch(_e){
		return null;
	}
}

// GFS 修剪:列目录 → 纯函数算保留集 → 删除名单交壳层(壳侧仅允许删本目录内
// horosa-backup-*.zip 模式文件,双侧防呆)。
export async function pruneBackups(now){
	try{
		const names = await invokeDesktopCommand('auto_backup_list_command', {});
		if(!Array.isArray(names) || names.length < 2){
			return { deleted: 0 };
		}
		const withTs = names
			.map((n)=>({ name: n, ts: parseBackupFileName(n), degraded: isDegradedBackupName(n) }))
			.filter((x)=>x.ts !== null);
		let incident = null;
		try{ incident = readBackupIncident(); }catch(_e){ incident = null; }
		const keep = retainBackupSet(withTs, now || Date.now(), { incidentAt: incident ? incident.at : 0 });
		const deleteNames = withTs.filter((x)=>!keep.has(x.ts)).map((x)=>x.name);
		if(!deleteNames.length){
			return { deleted: 0 };
		}
		await invokeDesktopCommand('auto_backup_prune_command', { deleteNames });
		return { deleted: deleteNames.length };
	}catch(_e){
		return { deleted: 0 };
	}
}

// 壳层 timer 接线(layouts 启动一次)。
// 旧写法 `window.__TAURI__.event.listen(...)` 在打包版从未挂上:withGlobalTauri 缺省 false
// → 没有 window.__TAURI__;且 capabilities 为空 → core:event:allow-listen 未授权,拿 __TAURI_INTERNALS__ 也 listen 不了。
// 改走壳→页面既有范式:壳侧 window.eval 调 `window.__horosaAutoBackupTick`,页面未就绪时进
// `__horosaPendingAutoBackupTicks` 队列,绑定时补跑一次(多条 pending 只跑一轮,内容指纹未变自动跳过)。
export function bindAutoBackupTicks(options){
	if(!eligible()){
		return;
	}
	// runner 可注入(测试用):接线正确性与备份本体解耦——备份本体另有 autoBackup.test.js 金标
	const runner = options && typeof options.runner === 'function' ? options.runner : runAutoBackupOnce;
	try{
		window.__horosaAutoBackupTick = (tick)=>{
			Promise.resolve().then(()=>runner({ trigger: 'timer', tick })).catch(()=>{});
		};
		const pending = Array.isArray(window.__horosaPendingAutoBackupTicks) ? window.__horosaPendingAutoBackupTicks.splice(0) : [];
		if(pending.length){
			Promise.resolve().then(()=>runner({ trigger: 'timer', tick: pending[pending.length - 1], pendingCount: pending.length })).catch(()=>{});
		}
	}catch(_e){
		// 桥不可用:风险前强制备份仍生效。
	}
}
