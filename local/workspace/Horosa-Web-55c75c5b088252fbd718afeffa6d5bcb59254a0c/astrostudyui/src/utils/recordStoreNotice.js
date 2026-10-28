// 记录写入「是否真落盘」的单源判据与提示文案(命盘库 / 事盘库共用):
// 本机存储不可用时内核退成「仅本次会话」(不抛错),此前各入口照常提示成功 → 重启后记录丢失。
// 已落盘 → 照常;仅本次会话 → 提示要导出;配额满时内核抛错,由各入口的 catch 报错。
// 判据只看存储模式:配额满的那次写入已经抛错;「最近一次写失败」标志会被足迹类静默写入留下,
// 拿它判断一次没有写入的去重命中会误报。
import { getLocalChartsStoreHealth } from './localcharts';
import { getLocalCasesStoreHealth } from './localcases';

export const RECORD_NOT_PERSISTED_NOTE = '(但本机存储不可用,只在本次运行有效,重启前请先导出)';
// AI 建档类工具在「只在本次运行有效」时写进 assumptions 的一句(各工具同一口径)
export const STORE_SESSION_ONLY_ASSUMPTION = '本机存储不可用,这条记录只在本次运行有效,重启前请导出';
export const STORE_SESSION_ONLY_CHANGE_ASSUMPTION = '本机存储不可用,这次改动只在本次运行有效,重启前请导出';

function persistedBy(health){
	const h = health || {};
	if(h.mode === 'memory'){ return false; }
	// 宿主提供「立刻落盘」(无头运行时的文件存储):同步落一次,落不进 = 只写进了本次运行(磁盘满 / 权限 / 只读盘)
	try{
		const flushNow = typeof globalThis !== 'undefined' ? globalThis.__horosaDurableFlush : undefined;
		if(typeof flushNow === 'function' && flushNow() === false){ return false; }
	}catch(e){ return false; }
	return true;
}

export function localChartsPersisted(){
	try{ return persistedBy(getLocalChartsStoreHealth()); }catch(e){ return true; }
}

export function localCasesPersisted(){
	try{ return persistedBy(getLocalCasesStoreHealth()); }catch(e){ return true; }
}

export const RECORD_DELETE_NOT_PERSISTED_NOTE = '(但本机存储不可用,删除只在本次运行有效,重启后这条还会在)';
// 批量删除 / 彻底删除 / 清空回收站:只在本次运行有效时同一口径(重启后这些还会回来)
export const RECORD_BATCH_DELETE_NOT_PERSISTED_NOTE = '(但本机存储不可用,删除只在本次运行有效,重启后这些记录还会在)';
export const TRASH_PURGE_NOT_PERSISTED_NOTE = '(但本机存储不可用,只在本次运行有效,重启后这些记录还会回到回收站)';

// 回收站彻底删除 / 清空之后的提示:已落盘 → 成功;只在本次运行有效 → 警告
export function toastTrashPurge(msgApi, kind, okText){
	return toastRecordWrite(msgApi, kind, okText, { note: TRASH_PURGE_NOT_PERSISTED_NOTE });
}

export function recordStorePersisted(kind){
	return kind === 'case' ? localCasesPersisted() : localChartsPersisted();
}

// 一次写入之后的提示(单源):已落盘 → 成功;只在本次运行有效 → 警告并说明。返回是否落盘。
// 配额满时内核抛错,由各入口的 catch 报错,不走这里。
export function toastRecordWrite(msgApi, kind, okText, { note = RECORD_NOT_PERSISTED_NOTE } = {}){
	const persisted = recordStorePersisted(kind);
	if(msgApi){
		if(persisted){
			msgApi.success(okText);
		}else{
			msgApi.warning(`${okText}${note}`);
		}
	}
	return persisted;
}

// 批量写(置顶 / 加标签 / 归档 / 星标):逐条做,配额满的那条计失败、继续后面的;返回成功与失败条数。
export function runRecordBatch(items, fn){
	let ok = 0;
	let failed = 0;
	(items || []).forEach((it)=>{
		try{
			fn(it);
			ok += 1;
		}catch(e){
			failed += 1;
		}
	});
	return { ok, failed };
}

// 批量写之后的提示:全部失败 → 报错;部分失败 / 只在本次运行有效 → 警告并写明;其余 → 成功。okText(n) 生成成功句。
export function toastRecordBatch(msgApi, kind, result, okText, { note = RECORD_NOT_PERSISTED_NOTE } = {}){
	const ok = (result && result.ok) || 0;
	const failed = (result && result.failed) || 0;
	const persisted = recordStorePersisted(kind);
	if(!msgApi){
		return persisted && !failed;
	}
	if(!ok && failed){
		msgApi.error(`操作失败：本地存储空间不足，${failed} 条没有改成，请先导出清理后重试`);
		return false;
	}
	let text = okText(ok);
	if(failed){
		text += `；另有 ${failed} 条因本地存储空间不足没有改成`;
	}
	if(!persisted){
		text += note;
	}
	if(failed || !persisted){
		msgApi.warning(text);
	}else{
		msgApi.success(text);
	}
	return persisted && !failed;
}

// 坏条目(导入时按域层判据跳过的,如事盘没有起课时间):按理由分组,列出前几条的名字
export function invalidItemsText(items){
	const list = Array.isArray(items) ? items : [];
	if(!list.length){ return ''; }
	const byReason = {};
	list.forEach((x)=>{ const r = (x && x.reason) || '坏条目'; (byReason[r] = byReason[r] || []).push((x && x.name) || '(无名)'); });
	return Object.keys(byReason).map((r)=>{
		const names = byReason[r];
		const shown = names.slice(0, 5).join('、');
		return `${r}的 ${names.length} 条跳过（${shown}${names.length > 5 ? ' 等' : ''}）`;
	}).join('、');
}

// 导入之后的提示(备份 JSON / 其它软件 / CSV 共用):imported / merged / keptLocal / skippedDeleted / failed / dupSkipped 如实写;一条没进 → 报错。
export function toastRecordImport(msgApi, kind, result, { label = '导入' } = {}){
	const r = result || {};
	const imported = r.imported || 0;
	const failed = r.failed || 0;
	const persisted = recordStorePersisted(kind);
	if(!msgApi){
		return persisted && !failed;
	}
	if(!imported && failed){
		msgApi.error(`${label}失败：${failed} 条因本地存储空间不足没有导入，请先导出清理后重试`);
		return false;
	}
	// 同一 ID 较新的整条替换本机的,不是「合并」;名人库补丁按字段合并的另计
	const merged = Math.min(imported, r.merged || 0);
	let text = `${label}完成：新增或替换 ${imported - merged} 条`;
	if(merged){ text += `，刷新已有记录的出生数据 ${merged} 条`; }
	if(r.keptLocal){ text += `，同一 ID 本机较新或一样新的 ${r.keptLocal} 条保留本机的`; }
	if(r.skippedDeleted){ text += `，本机在这份备份之后删掉的 ${r.skippedDeleted} 条没有带回`; }
	if(r.dupSkipped){ text += `，重复跳过 ${r.dupSkipped} 条`; }
	// 坏条目(如事盘没有起课时间):跳过并列出名字(前五条)
	const bad = invalidItemsText(r.invalidItems);
	if(bad){ text += `，${bad}`; }
	if(failed){ text += `，${failed} 条因本地存储空间不足没有导入`; }
	if(r.total !== undefined && r.total !== null){ text += `，当前共 ${r.total} 条`; }
	if(!persisted){ text += RECORD_NOT_PERSISTED_NOTE; }
	if(failed || !persisted){
		msgApi.warning(text);
	}else{
		msgApi.success(text);
	}
	return persisted && !failed;
}

// 界面之外写了档案(任务中心采纳 / 撤销 AI 提案等):广播一次,由应用外壳刷新列表,
// 若当前载入的正是这条,再按库里的完整记录重设(否则编辑表单仍是旧值,一保存就把刚采纳的改动写回去)。
export const RECORDS_CHANGED_EVENT = 'horosa:records-changed';
export function emitRecordsChanged(detail){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(RECORDS_CHANGED_EVENT, { detail: detail || {} }));
		}
	}catch(e){ /* 广播失败不影响已完成的写入 */ }
}
