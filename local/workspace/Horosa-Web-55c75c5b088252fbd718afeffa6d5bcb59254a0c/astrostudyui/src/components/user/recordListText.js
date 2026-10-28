import { invalidItemsText } from '../../utils/recordStoreNotice';
// 命盘 / 事盘列表共用的几句提示(两列表同一口径)。

// 批量删除确认:回收站有上限,这次删除会超出时写明超出几条、转去哪里(此前一律写「可恢复」,超出的条目却无声消失);
// 删除日志也有上限(命盘、事盘合计 logCap 条,满了挤掉最早的):这次转进去的会把日志顶出上限时,如实写出会有几条被永久删除。
// logCount / logCap 不传 = 不判删除日志容量(旧调用口径)
export function batchRemoveConfirmTitle(selected, trashLive, cap, logCount, logCap){
	const n = Number(selected) || 0;
	const base = `将选中 ${n} 条移入回收站？（可恢复）`;
	const over = n + (Number(trashLive) || 0) - (Number(cap) || 0);
	if(!(Number(cap) > 0) || !(over > 0)){ return base; }
	// 转进删除日志的就是超出的这 over 条;日志满了挤掉的是日志里最早的(可能是之前删的,也可能是这次转进去的)
	const lost = Number(logCap) > 0 ? (Number(logCount) || 0) + over - Number(logCap) : 0;
	if(lost > 0){
		return `${base} 回收站最多留 ${cap} 条，这次删除后会超出 ${over} 条，转入删除日志；删除日志最多留 ${logCap} 条，会有 ${lost} 条最早删的记录被永久删除、无法找回。建议先「导出选中」再删。`;
	}
	return `${base} 回收站最多留 ${cap} 条，这次删除后会超出 ${over} 条：最早删的 ${over} 条将转入删除日志，仍可从回收站下方的「删除日志」找回。`;
}

// 彻底删除 / 清空回收站没做成(删除日志写不进):记录仍在回收站
export function trashPurgeFailedText(n){
	return `${n === 1 ? '彻底删除' : '清空回收站'}没有完成：删除日志写不进（可能是存储空间不足），记录仍在回收站，请先导出清理后重试`;
}

// 单库 JSON 导入确认:同一 ID 两版谁胜写清楚。opts.extra:追加在条数后的一句;opts.total:备份共几条
export function recordImportConfirmText(preview, opts = {}){
	const p = preview || {};
	const parts = [`将新增 ${p.adds || 0} 条`];
	if(p.sameCid === 'merge'){
		if(p.updates){ parts.push(`同一 ID 的 ${p.updates} 条按字段合并`); }
	}else{
		if(p.merges){ parts.push(`名人库里已有的 ${p.merges} 条只刷新出生数据（按字段合并）`); }
		if(p.updates){
			parts.push(p.sameCid === 'backup'
				? `同一 ID 的 ${p.updates} 条一律用备份里的（整条替换本机的）`
				: `同一 ID 备份里较新的 ${p.updates} 条整条替换本机的（置顶、星标、归档等列表状态留本机的）`);
		}
		if(p.keptLocal){ parts.push(`同一 ID 本机较新或一样新的 ${p.keptLocal} 条保留本机的`); }
	}
	if(p.skippedDeleted){ parts.push(`本机在这份备份之后删掉的 ${p.skippedDeleted} 条不带回（仍在回收站或删除日志里）`); }
	if(p.dupSkips){ parts.push(`与本机已有记录同名同生辰跳过 ${p.dupSkips} 条`); }
	const bad = invalidItemsText(p.invalidItems);
	if(bad){ parts.push(bad); }
	const total = opts.total !== undefined ? opts.total : p.total;
	return `${parts.join('、')}${opts.extra || ''}（备份共 ${total || 0} 条）。现有记录不会被删除。`;
}

// 批量删除之后:有几条删掉了、却因存储写满没能留进回收站或删除日志(横幅里可以当场导出它们)
export function batchRemoveUnkeptNote(unkept){
	const n = Number(unkept) || 0;
	return n > 0 ? `；其中 ${n} 条因本地存储空间不足没能留进回收站或删除日志，请用顶部提示里的「导出这些记录」留一份` : '';
}
