// bootChartRestore —— 温启「直接显示上次的盘」(horosa_boot_chart_restore_v1)。
//
// 现状:启动后 chartObj:null、fields 默认「此刻」,首屏空白等用户手动出盘;而请求层 L3(IndexedDB)
// 里往往躺着上次同参的 /chart 结果。缺的只是入口:一条「启动时按上次快照重放 fetchByChartData」的链路。
//
// 快照 = fetchByChartData 消费的 record 形状(birth/ad/zone/lat/lon/name/pos + memo×8 +
// RECORD_FIELDS_RESTORE_MANIFEST 全部选项键)—— 键清单的**单一事实源**就是该 manifest,
// 未来加选项键自动随行;恢复走 fetchByChartData 原管线 ⇒ 与「用户手动载入命盘」同路径
// (选项条件还原 / memo 覆盖 / hook 全套),零平行实现。
//
// 安全网:
//   · 7 天窗:更久前的现场按无快照处理(用户预期已换);坏档 / 缺 birth 一律当无快照;
//   · 仅桌面壳(与 aiAnalysisDesktop.hasTauriInvoke 同判据:打包版只有 __TAURI_INTERNALS__)
//     + kill-switch horosa.perf.bootChartRestore(默认开);
//   · latest-wins:模型层在响应回来时若用户已先动手(fields / chartObj 已变)则丢弃恢复响应(bootRestore 标记);
//   · 落盘经 deferredStorage 空闲写,不占出盘关键路径。
import { parseLocalDateTimeMs } from './dateTimeParse';
import { RECORD_FIELDS_RESTORE_MANIFEST } from './recordFieldsRestore';
import { BAZI_CALIBRE_KEYS, recordPinsDayBoundary } from './baziCalibreScope';
import { getLocalChart, listLocalChartsTrash } from './localcharts';
import { scheduleStorageWrite, dropPendingStorageWrite } from './deferredStorage';
import { bootChartRestoreEnabled } from './perfFlags';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safeStorage';
import { ZIWEI_SESSION_TABLES_KEY } from './ziweiRecordSettings';

const STORE_KEY = 'horosa.boot.lastChart.v1';
// 「卜」组页签(导航 navigationPages 里 group '卜' 的 key;合同测试锁与导航一致):旧版快照 cid 空时据此分「事盘」与「此刻 / 新命盘」
export const DIVINATION_TAB_KEYS = ['sanshiunited', 'liureng', 'dunjia', 'guazhan', 'taiyi', 'jieqichart', 'fengshui', 'tarot', 'cnyibu'];
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MEMO_KEYS = ['memo74', 'memoBaZi', 'memoZiWei', 'memoAstro', 'memoGua', 'memoLiuReng', 'memoQiMeng', 'memoSuZhan'];

function inDesktopShell(){
	try{
		return !!(
			typeof window !== 'undefined'
			&& (
				(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)
				|| (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke)
			)
		);
	}catch(e){
		return false;
	}
}

function fieldValue(fields, key){
	const f = fields && fields[key];
	return f && f.value !== undefined ? f.value : undefined;
}

/** fields → fetchByChartData record(可 JSON 化;构不出合法 birth 返回 null = 不落快照)。
 *  opts.dayBoundaryPinned:当前盘的日界 / 晚子时 / 时间算法是否钉在记录口径上(载入了自带口径的记录)。没钉 = 跟随全局
 *  (此刻 / 新命盘)→ 快照不带这三键:载入时按「记录自带口径」判会把它钉死,重启后改全局日界 / 晚子时当前盘不再跟着变。 */
export function buildBootChartRecord(fields, currentTab, currentSubTab, opts){
	try{
		const dt = fieldValue(fields, 'date');
		if(!dt || typeof dt.format !== 'function'){
			return null;
		}
		const cid = fieldValue(fields, 'cid');
		const record = {
			cid: cid === undefined ? null : cid,   // 保留与命盘库记录的关联:恢复后「保存/更新」仍指向同一记录,不生副本
			birth: dt.format('YYYY-MM-DD HH:mm:ss'),
			ad: dt.ad !== undefined ? dt.ad : 1,
			zone: dt.zone,
			lat: fieldValue(fields, 'lat'),
			lon: fieldValue(fields, 'lon'),
			name: fieldValue(fields, 'name'),
			pos: fieldValue(fields, 'pos'),
		};
		MEMO_KEYS.forEach((k)=>{
			const v = fieldValue(fields, k);
			record[k] = v === undefined || v === null ? '' : v;
		});
		const pinned = !!(opts && opts.dayBoundaryPinned);
		// 没钉住、但左栏亲手改过日界 / 晚子时(左栏最高权限):快照带上改过的那一键并记下「亲手改过」,重启后照样不被全局冲掉
		// (时间算法仍按不钉住走 unpinnedTimeAlg)。此前只看记录口径,左栏改的日界重启后丢了
		const uo = opts && opts.dayBoundaryUserOverride && typeof opts.dayBoundaryUserOverride === 'object' ? opts.dayBoundaryUserOverride : {};
		const userKeys = pinned ? [] : [uo.after23 ? 'after23NewDay' : null, uo.lateZi ? 'lateZiHourUseNextDay' : null].filter(Boolean);
		RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key })=>{
			if(!pinned && BAZI_CALIBRE_KEYS.indexOf(key) >= 0 && userKeys.indexOf(key) < 0){ return; }
			const v = fieldValue(fields, key);
			if(v !== undefined && v !== null){
				record[key] = v;
			}
		});
		// pinned 显式写进快照:新快照里钉住的与旧版快照(恒带三键、没有这个标志)同形,载入端靠它分得出
		const out = { at: Date.now(), currentTab: currentTab || null, currentSubTab: currentSubTab || null, record, pinned };
		if(userKeys.length){ out.dayBoundaryUserOverride = { after23: userKeys.indexOf('after23NewDay') >= 0, lateZi: userKeys.indexOf('lateZiHourUseNextDay') >= 0 }; }
		// 关联了命盘库:记下此刻库里那条的更新时间(指纹)。载入时库里那条已不是这一版(恢复 / 导入整条替换、
		// 界面外改了档案)→ 改用库里那条重放,不拿快照里的旧版盖回去
		const lib = libraryRecordOf(record.cid, opts && opts.lookup);
		if(lib){ out.libUpdateTime = lib.updateTime === undefined || lib.updateTime === null ? '' : `${lib.updateTime}`; }
		// 没钉住时时间算法另记在 record 之外:它是新盘种子键,载入缺键会复位成内建默认(不像日界 / 晚子时那样跟随全局),
		// 温启分支用它回填 —— 重开后与退出前同一张盘,且仍不钉住
		if(!pinned){
			const ta = fieldValue(fields, 'timeAlg');
			if(ta !== undefined && ta !== null){ out.unpinnedTimeAlg = ta; }
		}
		return out;
	}catch(e){
		return null;
	}
}

function libraryRecordOf(cid, lookup){
	if(cid === undefined || cid === null || `${cid}` === ''){ return null; }
	try{
		const rec = (typeof lookup === 'function' ? lookup : getLocalChart)(cid);
		return rec && typeof rec === 'object' ? rec : null;
	}catch(e){
		return null;
	}
}

/** 出盘 settle 后调用(deferredStorage 空闲落盘,不占关键路径)。 */
export function saveBootChartSnapshot(fields, currentTab, currentSubTab, opts){
	if(!bootChartRestoreEnabled()){
		return;
	}
	const snap = buildBootChartRecord(fields, currentTab, currentSubTab, opts);
	if(!snap){
		return;
	}
	scheduleStorageWrite(STORE_KEY, ()=>{
		try{
			return JSON.stringify(snap);
		}catch(e){
			return null;
		}
	});
}

/** 旧版快照(没有 pinned 标志:不论当时钉没钉住都无条件带日界 / 晚子时 / 时间算法三键)按「当时其实钉没钉住」归一:
 *  · 不关联命盘库(cid 空):命类页签 = 此刻 / 新命盘,本就跟随全局 → 按不钉住还原;卜类页签 = 看的是事盘、三键是事盘自己的 → 维持原样;
 *  · 关联了命盘库:看库里那条记录自己带不带这三键(载入它时就按这个判钉不钉住)—— 不带、且快照的出生时刻与它一致 = 当时没钉住,
 *    同样按不钉住还原;带 / 库里已没有这条 / 出生时刻对不上(事盘叠在命盘之上,三键是事盘自己的)→ 维持原样。
 *  不钉住 = 去掉三键、时间算法另记 unpinnedTimeAlg(与新快照不钉住同形)。此前温启一律按「记录自带口径」把它钉死,
 *  之后每份快照都带着钉住标志一路延续,改全局日界 / 晚子时当前盘不再跟着变。lookup 可注入(测试),缺省读命盘库 */
export function normalizeLegacyBootSnapshot(snap, lookup){
	if(!snap || typeof snap !== 'object' || !snap.record || typeof snap.record !== 'object'){ return snap; }
	if(snap.pinned !== undefined){ return snap; }
	const cid = snap.record.cid;
	// 不关联命盘库:停在卜类页签 = 看的是事盘,三键是事盘自己的口径 → 维持原样(钉住);命类页签 = 此刻 / 新命盘 → 不钉住
	if((cid === undefined || cid === null || `${cid}` === '') && DIVINATION_TAB_KEYS.indexOf(`${snap.currentTab || ''}`) >= 0){ return snap; }
	if(cid !== undefined && cid !== null && `${cid}` !== ''){
		let lib = null;
		try{ lib = (typeof lookup === 'function' ? lookup : getLocalChart)(cid); }catch(e){ lib = null; }
		if(!lib || recordPinsDayBoundary(lib)){ return snap; }
		// 出生时刻要与库里那条对得上才去钉:事盘叠在命盘之上时快照的 cid 仍是之前那张命盘,三键却是事盘自己的口径
		const sameBirth = `${lib.birth || ''}`.slice(0, 16) === `${snap.record.birth || ''}`.slice(0, 16);
		if(!sameBirth){ return snap; }
	}
	const record = { ...snap.record };
	const ta = record.timeAlg;
	BAZI_CALIBRE_KEYS.forEach((k)=>{ delete record[k]; });
	const out = { ...snap, record, pinned: false };
	if(out.unpinnedTimeAlg === undefined && ta !== undefined && ta !== null && `${ta}` !== ''){ out.unpinnedTimeAlg = ta; }
	return out;
}

/** 快照关联的那条命盘在库里已不是快照时那一版 → 改用库里那条重放(页签照旧)。
 *  判据:新快照比对指纹(快照时库里那条的更新时间,不等 = 库里换过;整条替换会带回备份里较旧的更新时间,所以比「不等」不比先后);
 *  没有指纹的旧快照退回比先后(库里那条更新时间晚于快照时刻)。库里没有这条 / 读不出 → 原样。lookup 可注入(测试) */
export function reconcileBootSnapshotWithLibrary(snap, lookup){
	if(!snap || typeof snap !== 'object' || !snap.record || typeof snap.record !== 'object'){ return snap; }
	const lib = libraryRecordOf(snap.record.cid, lookup);
	if(!lib){
		// 库里已没有、却正躺在回收站里(快照之后删掉 / 合并掉了):盘照旧重放,但脱离记录 —— 否则之后「保存」写出一条同 cid 的
		let trashed = false;
		try{ trashed = typeof lookup !== 'function' && (listLocalChartsTrash() || []).some((r)=>r && `${r.cid}` === `${snap.record.cid}`); }catch(e){ trashed = false; }
		return trashed ? { ...snap, record: { ...snap.record, cid: null } } : snap;
	}
	if(!lib.birth){ return snap; }
	const libTime = lib.updateTime === undefined || lib.updateTime === null ? '' : `${lib.updateTime}`;
	let changed;
	if(snap.libUpdateTime !== undefined){
		changed = libTime !== `${snap.libUpdateTime}`;
	}else{
		const t = parseLocalDateTimeMs(libTime) || 0;
		changed = t > 0 && typeof snap.at === 'number' && t > snap.at;
	}
	if(!changed){ return snap; }
	let record = null;
	try{ record = JSON.parse(JSON.stringify(lib)); }catch(e){ record = null; }
	if(!record){ return snap; }
	const out = { at: snap.at, currentTab: snap.currentTab || null, currentSubTab: snap.currentSubTab || null, record, pinned: !!recordPinsDayBoundary(record), fromLibrary: true, libUpdateTime: libTime };
	return out;
}


// 「库里那条已被换掉」的指纹:与任何更新时间都不相等 → 载入时一定按库里那条重放
export const BOOT_SNAPSHOT_REPLACED_FINGERPRINT = '\u0000replaced-by-restore';

/** 全量恢复写完(刷新之前):先丢掉还没落盘的那份(那是恢复前的内存态,关窗 / 刷新前的刷盘会把它写回),已落盘的快照留着 ——
 *  库里那条换过,载入时指纹不等、自动按库里那条重放(reconcileBootSnapshotWithLibrary);快照那张盘正是这次恢复换掉的
 *  (changedChartCids 含它)→ 把指纹记成必不相等的值(没有指纹的旧快照、或同一更新时间的替换也照样按库重放),
 *  连记录号的紫微临时表(ziweiSessionTables)属于那条才作废。快照与恢复无关时原样留着:刷新后仍温启同一张盘。 */
export function settleBootChartSnapshotAfterRestore(changedChartCids){
	try{ dropPendingStorageWrite(STORE_KEY); }catch(e){ /* ignore */ }
	const changed = new Set((Array.isArray(changedChartCids) ? changedChartCids : []).map((c)=>`${c}`));
	if(!changed.size){ return { replaced: false }; }
	let snap = null;
	try{ const raw = safeLocalStorageGet(STORE_KEY); snap = raw ? JSON.parse(raw) : null; }catch(e){ snap = null; }
	const cid = snap && snap.record ? snap.record.cid : null;
	let replaced = false;
	if(cid !== null && cid !== undefined && `${cid}` !== '' && changed.has(`${cid}`)){
		replaced = true;
		try{ safeLocalStorageSet(STORE_KEY, JSON.stringify({ ...snap, libUpdateTime: BOOT_SNAPSHOT_REPLACED_FINGERPRINT })); }catch(e){ safeLocalStorageRemove(STORE_KEY); }
	}
	let tablesCid = '';
	try{ const t = JSON.parse(safeLocalStorageGet(ZIWEI_SESSION_TABLES_KEY) || 'null'); tablesCid = t && t.cid ? `${t.cid}` : ''; }catch(e){ tablesCid = ''; }
	if(tablesCid && changed.has(tablesCid)){ safeLocalStorageRemove(ZIWEI_SESSION_TABLES_KEY); }
	return { replaced };
}

/** 启动恢复读取:开关关 / 非桌面壳 / 无快照 / 超 7 天 / 坏档 一律 null。 */
export function loadBootChartSnapshot(){
	if(!bootChartRestoreEnabled()){
		return null;
	}
	try{
		if(!inDesktopShell()){
			return null;
		}
		const raw = window.localStorage ? window.localStorage.getItem(STORE_KEY) : null;
		if(!raw){
			return null;
		}
		const snap = JSON.parse(raw);
		if(!snap || !snap.record || !snap.record.birth || typeof snap.at !== 'number'){
			return null;
		}
		if(Date.now() - snap.at > MAX_AGE_MS){
			return null;
		}
		return normalizeLegacyBootSnapshot(reconcileBootSnapshotWithLibrary(snap));
	}catch(e){
		return null;
	}
}

export function __bootChartStoreKeyForTest(){
	return STORE_KEY;
}
