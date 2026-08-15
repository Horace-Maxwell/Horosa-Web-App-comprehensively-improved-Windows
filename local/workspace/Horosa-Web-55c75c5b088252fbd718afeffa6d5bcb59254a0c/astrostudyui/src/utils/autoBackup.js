// [V5-B1/B2/B3/B4/B6] 自动备份体系:定时/风险操作前 打全量 zip 到用户可见目录,
// GFS 梯度保留,写前内存自验,内容指纹去重。
//
// 通道:仅桌面端(壳层命令写 ~/Documents/Horosa Backups/,用户可见、进 Time Machine 面、
// 可自行指向网盘目录);浏览器 dev = no-op。调度触发:壳层 Rust timer 每 30 分钟 emit
// (不依赖 WebView 定时器 —— 窗口最小化/节能会漂移);风险操作(恢复/导入/清空回收站)前
// 由调用点显式 runAutoBackupOnce({trigger:'pre-risk'}) 强制先备份。
// 第二实例不自动备份(与影子副本同理:独立数据集,不许覆盖主实例的备份序列)。
import { isDesktopBridgeAvailable, invokeDesktopCommand } from './aiAnalysisDesktop';
import { isSecondaryInstancePort } from '../components/common/MultiInstanceNotice';
import { safeLocalStorageGet, safeLocalStorageSet } from './safeStorage';
import {
	buildFullUnifiedManifest, manifestContentFingerprint, validateUnifiedBackup,
} from './unifiedBackup';

const LAST_RESULT_KEY = 'horosa.backup.lastResult';
const FILE_PREFIX = 'horosa-backup-';

function eligible(){
	if(!isDesktopBridgeAvailable()){
		return false;
	}
	try{
		return !isSecondaryInstancePort(window.location.port);
	}catch(_e){
		return false;
	}
}

// [B3] GFS 梯度保留(纯函数,输入=现存备份时间戳毫秒数组+now,输出=保留集合):
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
			const d = new Date(t);
			bucket = `m${d.getUTCFullYear()}-${d.getUTCMonth()}`;
		}
		if(bucket && !buckets.has(bucket)){
			buckets.add(bucket);
			keep.add(t);
		}
	});
	return keep;
}

// 文件名 ↔ 时间戳:horosa-backup-YYYYMMDD-HHmmss.zip(ISO 派生,字典序=时间序)。
export function backupFileName(atMs){
	const d = new Date(atMs);
	const p = (n, w)=>`${n}`.padStart(w, '0');
	return `${FILE_PREFIX}${d.getFullYear()}${p(d.getMonth() + 1, 2)}${p(d.getDate(), 2)}-${p(d.getHours(), 2)}${p(d.getMinutes(), 2)}${p(d.getSeconds(), 2)}.zip`;
}

export function parseBackupFileName(name){
	const m = /^horosa-backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.zip$/.exec(`${name}`);
	if(!m){
		return null;
	}
	return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
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

// [B1/B6] 执行一次自动备份:组装 manifest → 内存自验(格式闸+校验和自洽) → 指纹与上次
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
		if(!check.ok || check.reason === 'checksum-bad'){
			const r = { ok: false, at: Date.now(), trigger, reason: `self-verify-failed:${check.reason}` };
			writeLastResult(r);
			return r;
		}
		const fingerprint = manifestContentFingerprint(manifest);
		const last = readLastResult();
		if(trigger === 'timer' && last && last.ok && last.fingerprint === fingerprint){
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
		const fileName = backupFileName(at);
		const path = await invokeDesktopCommand('auto_backup_write_command', { fileName, base64Data });
		const result = { ok: true, at, trigger, fingerprint, path, verified: true };
		// [B6] 每周抽验**最老**一份(restic 范式:老备份才是恢复时真正要依赖的;坏了大声报)。
		const prevResult = readLastResult() || {};
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
					result.oldestVerified = { name: oldest, ok: !!check2.ok && check2.reason !== 'checksum-bad', reason: check2.reason || null };
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

// [B3] GFS 修剪:列目录 → 纯函数算保留集 → 删除名单交壳层(壳侧仅允许删本目录内
// horosa-backup-*.zip 模式文件,双侧防呆)。
export async function pruneBackups(now){
	try{
		const names = await invokeDesktopCommand('auto_backup_list_command', {});
		if(!Array.isArray(names) || names.length < 2){
			return { deleted: 0 };
		}
		const withTs = names
			.map((n)=>({ name: n, ts: parseBackupFileName(n) }))
			.filter((x)=>x.ts !== null);
		const keep = gfsRetain(withTs.map((x)=>x.ts), now || Date.now());
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

// [B1] 壳层 timer 事件接线(layouts 启动一次):listen 壳侧 emit 的 tick 跑一轮。
export function bindAutoBackupTicks(){
	if(!eligible()){
		return;
	}
	try{
		const t = window.__TAURI__;
		if(t && t.event && typeof t.event.listen === 'function'){
			t.event.listen('horosa://auto-backup-tick', ()=>{
				runAutoBackupOnce({ trigger: 'timer' });
			});
		}
	}catch(_e){
		// 事件桥不可用:风险前强制备份仍生效。
	}
}
