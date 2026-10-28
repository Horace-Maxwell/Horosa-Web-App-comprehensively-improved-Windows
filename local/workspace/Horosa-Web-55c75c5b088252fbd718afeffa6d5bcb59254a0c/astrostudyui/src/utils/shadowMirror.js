// 影子副本前端侧:本地记录库四键(两库+两回收站)每次落盘后镜像到壳层文件。
//
// 为什么:WebView 数据目录由系统派生、app 不可控、用户不可见,存在被清理工具/磁盘压力
// 驱逐/文件损坏/写后立即退出未落盘 四类丢失路径;镜像住壳层 app 数据目录(原子写,
// invoke 返回即已 fsync 在盘),四种死法同一张保险单。
//
// 恢复语义(与紫微自定义表 IDB 镜像自愈同款,仓内既有先例):
//   🔴 主存(localStorage)键**完全缺失**、或在却解析不出(坏了,原串先留档)时把影子写回 —— 完好的主存永远优先,绝不覆盖
//   (主存可能比影子新:极端退出时最后一写可能只到主存未及镜像)。两边不同而影子里有主存没有 / 更新的条目时
//   (写后立即退出、主存没落盘),暂停镜像这把键、请用户决定(见 reconcileShadowOnBoot)。
// 非桌面环境(浏览器 dev / jest)全部 no-op,零依赖零影响。
import { parseLocalDateTimeMs } from './dateTimeParse';
import { isDesktopBridgeAvailable, invokeDesktopCommand } from './aiAnalysisDesktop';
import { safeLocalStorageGet, safeLocalStorageSet, archiveCorruptStorageValue } from './safeStorage';
import { currentWindowIsIndependent } from '../components/common/MultiInstanceNotice';
import { pushRecordRevision } from './recordRevisions';

// horosa_shadow_mirror_electron_v1(Windows 对位;建议上游知悉):上游把「双保险副本」的
// 壳侧文件镜像走 Tauri invoke —— Electron 壳没有 __TAURI__,不对位则该特性在 Windows
// **静默不存在**(发布说明承诺的数据保险死件)。对位=同语义三件套:壳层 IPC 原子写
// (tmp+fsync+rename,与 Rust 端同款)+ preload 桥 + 本适配层;白名单/恢复规则逐字对齐。
// jest/浏览器无 horosaDesktop ⇒ 返回 null 走原 Tauri 判定,上游测试与 Mac 行为零改变。
function electronShadowBridge(){
	try{
		const d = typeof window !== 'undefined' ? window.horosaDesktop : null;
		return (d && typeof d.shadowStoreWrite === 'function' && typeof d.shadowStoreReadAll === 'function') ? d : null;
	}catch(_e){
		return null;
	}
}

// 🔴 只有主实例(首选端口)做影子镜像与对账:第二实例(阶梯口 38992+)是**独立数据集**
// (localStorage 按 origin=端口分区,R3 定谳互不相通),若也写同一 shadow/ 文件会把主实例
// 的影子覆盖成第二实例的数据 —— 恢复时数据混串。第二实例:不镜像、不对账。
function shadowEligible(){
	if(!isDesktopBridgeAvailable() && !electronShadowBridge()){
		return false;
	}
	try{
		// 只有主实例做:壳层告诉了身份就以它为准;没告诉时只认首选口(阶梯后继口与阶梯外的随机兜底口都是独立实例,不碰主实例的影子 / 备份)
		return !currentWindowIsIndependent(true);
	}catch(_e){
		return false;
	}
}

// 本窗口做不做影子副本(记录库内核据此判断:主存坏了时有没有影子可等)
export function shadowMirrorEligible(){
	return shadowEligible();
}

// 与壳层 SHADOW_ALLOWED_KEYS 白名单一致(壳侧还会再验一遍,双保险)。
export const SHADOW_MIRROR_KEYS = [
	'horosa.localCharts.v1',
	'horosa.localCases.v1',
	'horosa.localCharts.trash.v1',
	'horosa.localCases.trash.v1',
];

let lastMirrorError = null;
let lastReconcile = null;
// 启动对账发现「影子副本里有主存没有 / 比主存新的记录」的键:本次运行暂停镜像这几把键 —— 下一次保存不再拿主存
// 覆盖影子,影子里那份(上次退出前最后的保存,主存没来得及落盘)留着等用户决定并回还是以本机为准
const heldKeys = new Set();
const aheadByKey = {};

export const SHADOW_RECONCILED_EVENT = 'horosa.shadowMirror.reconciled';

// 写镜像:fire-and-forget(失败静默记录状态供健康页;主存已成功,镜像失败不阻断业务)。
export function mirrorShadowWrite(key, text){
	if(SHADOW_MIRROR_KEYS.indexOf(key) < 0){
		return;
	}
	if(heldKeys.has(key)){
		return;
	}
	if(!shadowEligible()){
		return;
	}
	if(typeof text !== 'string'){
		return;
	}
	const eb = electronShadowBridge();
	(eb ? eb.shadowStoreWrite(key, text) : invokeDesktopCommand('shadow_store_write_command', { key, text }))
		.then(()=>{ lastMirrorError = null; })
		.catch((e)=>{ lastMirrorError = `${(e && e.message) || e}`; });
}

// 解析成记录数组;解析不出 / 不是数组 → null
function parseList(text){
	if(typeof text !== 'string' || !text){ return null; }
	try{
		const v = JSON.parse(text);
		return Array.isArray(v) ? v : null;
	}catch(e){
		return null;
	}
}

const TRASH_OF = {
	'horosa.localCharts.v1': 'horosa.localCharts.trash.v1',
	'horosa.localCases.v1': 'horosa.localCases.trash.v1',
};
const LIBRARY_OF = {
	'horosa.localCharts.trash.v1': 'horosa.localCharts.v1',
	'horosa.localCases.trash.v1': 'horosa.localCases.v1',
};
const timeOf = (r, field)=>parseLocalDateTimeMs((r && r[field]) || '') || 0;
// 删除日志(彻底删除 / 回收站挤出的记录):键名与记录库内核同一个;store 标 'chart' | 'case'
const DELETED_LOG_KEY = 'horosa.deleted.log.v1';
const STORE_OF = {
	'horosa.localCharts.v1': 'chart',
	'horosa.localCharts.trash.v1': 'chart',
	'horosa.localCases.v1': 'case',
	'horosa.localCases.trash.v1': 'case',
};
// 本机删除日志里这个库每个 cid 最晚一次彻底删除的时刻(毫秒)
function purgedAtByCid(store){
	const out = new Map();
	(parseList(safeLocalStorageGet(DELETED_LOG_KEY)) || []).forEach((e)=>{
		if(!e || e.store !== store || !e.record || !e.record.cid){ return; }
		const k = `${e.record.cid}`;
		const t = timeOf(e, 'purgedAt');
		if(!out.has(k) || t > out.get(k)){ out.set(k, t); }
	});
	return out;
}

// 影子里比主存「多出来 / 更新」的条目(按 cid + 时间比):
//   记录库:主存没有这个 cid(且不在本机回收站里 —— 那是删掉了)、或影子那版更新时间更晚;
//   回收站:主存回收站没有这个 cid,且这条也不在主库里(已恢复)。
// 两边都排除本机删除日志里、在影子那版之后彻底删过的 cid:影子暂停镜像期间彻底删掉的记录还留在影子里,
// 不排除的话下次启动会被列成「本机没有」,一点「并回」就复活了。
export function shadowAheadEntries(key, localList, shadowList){
	const local = Array.isArray(localList) ? localList : [];
	const shadow = Array.isArray(shadowList) ? shadowList : [];
	const byCid = new Map();
	local.forEach((r)=>{ if(r && r.cid){ byCid.set(`${r.cid}`, r); } });
	const purged = purgedAtByCid(STORE_OF[key]);
	const purgedSince = (r, field)=>{ const t = purged.get(`${r.cid}`); return t !== undefined && t >= timeOf(r, field); };
	if(TRASH_OF[key]){
		const trash = parseList(safeLocalStorageGet(TRASH_OF[key])) || [];
		const inTrash = new Set(trash.map((r)=>(r && r.cid ? `${r.cid}` : '')).filter(Boolean));
		return shadow.filter((r)=>{
			if(!r || !r.cid){ return false; }
			const mine = byCid.get(`${r.cid}`);
			if(!mine){ return !inTrash.has(`${r.cid}`) && !purgedSince(r, 'updateTime'); }
			return timeOf(r, 'updateTime') > timeOf(mine, 'updateTime');
		});
	}
	const lib = parseList(safeLocalStorageGet(LIBRARY_OF[key])) || [];
	const inLib = new Set(lib.map((r)=>(r && r.cid ? `${r.cid}` : '')).filter(Boolean));
	return shadow.filter((r)=>r && r.cid && !byCid.has(`${r.cid}`) && !inLib.has(`${r.cid}`) && !purgedSince(r, 'deletedAt'));
}

function fireReconciled(result){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(SHADOW_RECONCILED_EVENT, { detail: result }));
		}
	}catch(e){ /* 广播失败不影响对账本身 */ }
}

// 启动对账:返回 { restored:[key...], diverged:[key...], ahead:{key:条数}, corrupt:[key...], corruptUnarchived:[key...], restoreFailed:[key...], checked }。
// restoreFailed = 影子里有完好的一份、却没写回主存(空间不足):记录库内核据此不拿本次运行的内存数据去盖它
// · 主存缺失 → 影子写回(restored);
// · 主存在、内容却解析不出(坏了)而影子完好 → 主存原串先留档、再用影子写回(restored + corrupt);
//   留不成档(多半是空间不足)就先不动主存(corruptUnarchived):写回 = 把坏串连同里面可能还能救的内容盖掉,与回收站同口径;
// · 两边都在但不同(diverged):主存优先、不动;若影子里有主存没有 / 比主存新的条目(上次保存后立刻退出、主存没落盘),
//   本次运行暂停镜像这把键(不让下一次保存把影子里那份盖掉),ahead 记条数,由横幅请用户决定并回还是以本机为准。
export async function reconcileShadowOnBoot(){
	const result = { restored: [], diverged: [], ahead: {}, corrupt: [], corruptUnarchived: [], restoreFailed: [], checked: false, at: Date.now() };
	if(!shadowEligible()){
		lastReconcile = result;
		return result;
	}
	let mirror = null;
	try{
		const eb = electronShadowBridge();
		mirror = eb ? await eb.shadowStoreReadAll() : await invokeDesktopCommand('shadow_store_read_all_command', {});
	}catch(e){
		lastMirrorError = `${(e && e.message) || e}`;
		lastReconcile = result;
		return result;
	}
	result.checked = true;
	if(!mirror || typeof mirror !== 'object'){
		lastReconcile = result;
		return result;
	}
	SHADOW_MIRROR_KEYS.forEach((key)=>{
		const shadowText = mirror[key];
		if(typeof shadowText !== 'string' || !shadowText){
			return;
		}
		const localText = safeLocalStorageGet(key);
		if(localText === null || localText === undefined || localText === ''){
			if(safeLocalStorageSet(key, shadowText)){
				result.restored.push(key);
			}else{
				result.restoreFailed.push(key);   // 影子里有、写不回去(空间不足):这份影子不能被之后的写盖掉
			}
			return;
		}
		if(localText === shadowText){
			return;
		}
		const localList = parseList(localText);
		const shadowList = parseList(shadowText);
		if(!localList && shadowList){
			// 主存坏了:原串留档后按缺失处理(此前只记 diverged,下一次保存就把完好的影子一起盖掉)
			if(!archiveCorruptStorageValue(key, localText)){
				result.corruptUnarchived.push(key);
				return;
			}
			if(safeLocalStorageSet(key, shadowText)){
				result.restored.push(key);
				result.corrupt.push(key);
			}else{
				result.restoreFailed.push(key);
			}
			return;
		}
		result.diverged.push(key);
		Promise.resolve(invokeDesktopCommand('shadow_store_keep_diverged_command', { key })).catch(()=>{});   // 先请壳层把影子这份另存为 shadow/<键>.diverged-<时刻>.json,之后谁再写影子都还留着
		const ahead = localList && shadowList ? shadowAheadEntries(key, localList, shadowList) : [];
		if(ahead.length){
			heldKeys.add(key);
			aheadByKey[key] = ahead;
			result.ahead[key] = ahead.length;
		}
	});
	// 主存键缺失(不是坏了)而影子在 = 本机存储被整体清掉过(清理工具 / 系统驱逐 / 目录换址):影子只救得回这四把键,
	// 其余设置、删除日志、人生事件、AI 对话等要从自动备份恢复 —— 横幅据此给出入口
	result.storageCleared = result.restored.some((k)=>result.corrupt.indexOf(k) < 0);
	lastReconcile = result;
	fireReconciled(result);
	return result;
}

// 用户选「并回」:把影子里多出来 / 更新的条目并进主存(记录库按 cid 整条替换或新增;回收站追加),然后恢复镜像。
// 返回并回的条数;写不进(空间不足)返回 -1、键仍暂停镜像(影子里那份留着)。
// 并回前按**当前**主存 / 回收站 / 删除日志重新比一遍(启动那一刻算的清单可能已过时):本次运行里亲手改过的那条(本机那版更新)保留本机,
// 删进回收站或彻底删掉的不再补回;被替换的本机记录先留一版历史。
export function mergeShadowAhead(key){
	const ahead0 = aheadByKey[key];
	if(!ahead0 || !ahead0.length){
		releaseShadowHold(key);
		return 0;
	}
	const localText = safeLocalStorageGet(key);
	const local = localText ? parseList(localText) : [];
	if(!local){
		return -1;   // 主存此刻解析不出:不拿影子盖它(影子里那份留着)
	}
	const ahead = shadowAheadEntries(key, local, ahead0);
	if(!ahead.length){
		releaseShadowHold(key);
		return 0;
	}
	const byCid = new Map(ahead.map((r)=>[`${r.cid}`, r]));
	if(TRASH_OF[key]){
		// 记录库:被替换的本机那版留一版历史(回收站键不留:回收站里的是删掉的记录)
		local.forEach((r)=>{
			if(r && r.cid && byCid.has(`${r.cid}`)){
				try{ pushRecordRevision(STORE_OF[key], r, { force: true }); }catch(_e){ /* 留不成历史不阻断并回 */ }
			}
		});
	}
	const merged = local.map((r)=>(r && r.cid && byCid.has(`${r.cid}`) ? byCid.get(`${r.cid}`) : r));
	const have = new Set(local.map((r)=>(r && r.cid ? `${r.cid}` : '')).filter(Boolean));
	ahead.forEach((r)=>{ if(!have.has(`${r.cid}`)){ merged.unshift(r); } });
	const text = JSON.stringify(merged);
	if(!safeLocalStorageSet(key, text)){
		return -1;
	}
	delete aheadByKey[key];
	heldKeys.delete(key);
	mirrorShadowWrite(key, text);
	return ahead.length;
}

// 恢复镜像并立刻用主存刷新影子
export function releaseShadowHold(key){
	delete aheadByKey[key];
	if(!heldKeys.has(key)){ return; }
	heldKeys.delete(key);
	const text = safeLocalStorageGet(key);
	if(typeof text === 'string' && text){ mirrorShadowWrite(key, text); }
}

// 用户选「以本机为准」:恢复镜像、用主存刷新影子,并请壳层删掉这把键另存的不一致副本(里面是你决定不要的那几条,
// 可能有已经彻底删除的记录;壳层没有这条命令的旧版本就留着,不影响其余)
export function discardShadowAhead(key){
	releaseShadowHold(key);
	if(!shadowEligible()){ return; }
	try{
		Promise.resolve(invokeDesktopCommand('shadow_store_drop_diverged_command', { key })).catch(()=>{});
	}catch(_e){ /* 删不掉副本无害 */ }
}

// 影子里多出来 / 更新的条目(横幅列出名字用;只读副本)
export function getShadowAhead(){
	const out = {};
	Object.keys(aheadByKey).forEach((k)=>{ out[k] = aheadByKey[k].slice(); });
	return out;
}

// 影子里多出来 / 更新的条目的记录号(并回前取:并回后广播「档案变了」带上它,当前载入的正是其中一条就按库里新版重设)
export function shadowAheadCids(){
	const out = [];
	Object.keys(aheadByKey).forEach((k)=>{
		(aheadByKey[k] || []).forEach((r)=>{ if(r && r.cid && out.indexOf(`${r.cid}`) < 0){ out.push(`${r.cid}`); } });
	});
	return out;
}

// 健康页状态出口。
export function getShadowMirrorStatus(){
	return {
		enabled: shadowEligible(),
		keys: SHADOW_MIRROR_KEYS.slice(),
		lastMirrorError,
		lastReconcile,
		held: Array.from(heldKeys),
	};
}

export function __resetShadowMirrorForTests(){
	lastMirrorError = null;
	lastReconcile = null;
	heldKeys.clear();
	Object.keys(aheadByKey).forEach((k)=>{ delete aheadByKey[k]; });
}
