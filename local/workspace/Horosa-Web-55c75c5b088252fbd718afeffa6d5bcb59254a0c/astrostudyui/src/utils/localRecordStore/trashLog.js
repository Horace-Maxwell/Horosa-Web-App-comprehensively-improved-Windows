// 本地记录存储 · 回收站与删除日志:保留期 / 容量、删除日志计数、影子副本可否恢复、同号冲突判定与说明、本机管理字段、回收站条目是否仍在保留期
// 从 localRecordStore.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { getLocalStorageSafe as getLocalStorage } from '../safeStorage';
import { shadowMirrorEligible } from '../shadowMirror';
import { parseLocalDateTimeMs } from '../dateTimeParse';
import { safeParseJson, RECORD_MANAGEMENT_KEYS } from './recordShape';

// config = {
//   storageKey        持久化键('horosa.localCharts.v1' | 'horosa.localCases.v1')
//   searchField       list({name}) 匹配的记录字段('name' | 'event')
//   envelopeFormat    备份信封 format 串
//   envelopeListField 备份信封里的清单字段名('charts' | 'cases')
//   buildRecord       域层记录构造器(壳注入;哨兵锁定其驻留壳文件)
//   saveErrorCode / deleteErrorCode  失败抛错的错误串(与既有调用方 catch 约定一致)
//   warnLabel         内存降级 console 文案里的域名('chart' | 'case')
// }
// 回收站保留期(命盘 / 事盘同):超期的条目打开回收站时惰性清掉。恢复备份合并回收站 / 删除日志时判「这条还在不在回收站里」
// 必须用同一判据(unifiedBackup),否则已过期、下次就被清掉的条目会被当成「还在」—— 两头都没了
export const TRASH_RETENTION_DAYS = 30;
// 回收站上限(命盘 / 事盘各一):超出时最早删的条目被挤出、先记进删除日志
export const TRASH_CAP = 200;
// 删除日志(命盘 / 事盘共用一把键,带 store 标):最多留 500 条,满了最早的那条被挤掉(永久删除)
export const DELETED_LOG_KEY = 'horosa.deleted.log.v1';
export const DELETED_LOG_CAP = 500;
// 删除日志现有条数(命盘 + 事盘合计;批量删除确认框据此算这次会不会挤掉日志里最早的条目)
export function countDeletedLogEntries(){
	const storage = getLocalStorage();
	if(!storage){ return 0; }
	try{
		const cur = safeParseJson(storage.getItem(DELETED_LOG_KEY), []);
		return cur instanceof Array ? cur.length : 0;
	}catch(e){
		return 0;
	}
}
// 本窗口有没有影子副本可等(主存坏了时据此决定:等启动对账写回,还是原串留档后直接从空库开始)
export function shadowCanRestore(){
	try{ return shadowMirrorEligible(); }catch(e){ return false; }
}
// 同 cid 的口径(导入 / 恢复):
//   'newer'(缺省)更新时间较新的那一版整条胜出(本机较新或一样新保留本机);整条替换时本机的管理字段(置顶 / 排序 / 归档 / 星标 / 使用足迹)保留
//   'backup'      一律用备份里的那一版(整条,含管理字段):回退到某份备份用(恢复确认框里勾选才走)
//   'merge'       按字段合并(包里的盖本机)
// opts.mergeCids:[cid…] 只有这些条目按字段合并(名人库 JSON 里「只刷新出生数据」的补丁),同一文件里其余条目按 'newer'(或 'backup')
export function resolveSameCid(opts, cid){
	const o = opts || {};
	if(Array.isArray(o.mergeCids)){
		if(cid && o.mergeCids.some((c)=>`${c}` === `${cid}`)){ return 'merge'; }
		return o.sameCid === 'backup' ? 'backup' : 'newer';
	}
	return o.sameCid === 'merge' || o.sameCid === 'backup' ? o.sameCid : 'newer';
}
export function sameCidLabelOf(opts){
	const o = opts || {};
	if(Array.isArray(o.mergeCids)){ return 'mixed'; }
	return o.sameCid === 'merge' || o.sameCid === 'backup' ? o.sameCid : 'newer';
}
// 'newer' 整条替换时:内容用包里的,管理字段留本机的
export function withLocalManagementFields(item, local){
	const out = { ...item };
	RECORD_MANAGEMENT_KEYS.forEach((k)=>{
		delete out[k];
		if(local && local[k] !== undefined){ out[k] = local[k]; }
	});
	return out;
}
export function trashEntryLive(it, now){
	const t = parseLocalDateTimeMs((it && it.deletedAt) || '') || 0;
	return t >= (now === undefined ? Date.now() : now) - TRASH_RETENTION_DAYS * 24 * 3600 * 1000;
}
