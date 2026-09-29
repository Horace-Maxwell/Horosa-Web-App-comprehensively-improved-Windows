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
import { RECORD_FIELDS_RESTORE_MANIFEST } from './recordFieldsRestore';
import { scheduleStorageWrite } from './deferredStorage';
import { bootChartRestoreEnabled } from './perfFlags';

const STORE_KEY = 'horosa.boot.lastChart.v1';
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

/** fields → fetchByChartData record(可 JSON 化;构不出合法 birth 返回 null = 不落快照)。 */
export function buildBootChartRecord(fields, currentTab, currentSubTab){
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
		RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key })=>{
			const v = fieldValue(fields, key);
			if(v !== undefined && v !== null){
				record[key] = v;
			}
		});
		return { at: Date.now(), currentTab: currentTab || null, currentSubTab: currentSubTab || null, record };
	}catch(e){
		return null;
	}
}

/** 出盘 settle 后调用(deferredStorage 空闲落盘,不占关键路径)。 */
export function saveBootChartSnapshot(fields, currentTab, currentSubTab){
	if(!bootChartRestoreEnabled()){
		return;
	}
	const snap = buildBootChartRecord(fields, currentTab, currentSubTab);
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
		return snap;
	}catch(e){
		return null;
	}
}

export function __bootChartStoreKeyForTest(){
	return STORE_KEY;
}
