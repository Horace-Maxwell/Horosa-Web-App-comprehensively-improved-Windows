// 命盘 / 事盘列表的几句提示:批量删除超出回收站上限时写明超出几条、转去删除日志;导入确认写明同一 ID 谁胜;
// 全量恢复失败列「中文名:说明」不露内部键名
import { batchRemoveConfirmTitle, trashPurgeFailedText, recordImportConfirmText } from '../../components/user/recordListText';
import { restoreFailureLine, restoreNoteText } from '../../components/user/unifiedRestoreFlow';
import * as ub from '../unifiedBackup';

test('批量删除:不超上限照旧;超上限写明超出几条、转入删除日志', ()=>{
	expect(batchRemoveConfirmTitle(5, 10, 200)).toBe('将选中 5 条移入回收站？（可恢复）');
	const t = batchRemoveConfirmTitle(100, 150, 200);
	expect(t).toContain('超出 50 条');
	expect(t).toContain('删除日志');
	expect(batchRemoveConfirmTitle(100, undefined, 200)).toBe('将选中 100 条移入回收站？（可恢复）');
});

test('导入确认:同一 ID 两版谁胜写清楚;名人库补丁按字段合并', ()=>{
	const t = recordImportConfirmText({ adds: 2, updates: 1, keptLocal: 3, dupSkips: 0, total: 6 });
	expect(t).toContain('同一 ID 备份里较新的 1 条整条替换本机的');
	expect(t).toContain('同一 ID 本机较新或一样新的 3 条保留本机的');
	expect(t).not.toContain('合并覆盖');
	expect(recordImportConfirmText({ adds: 0, updates: 2, sameCid: 'merge', total: 2 })).toContain('按字段合并');
	expect(trashPurgeFailedText(1)).toContain('记录仍在回收站');
});

test('恢复失败行:「中文名:说明」;说明文字含谁胜与安全开关口径', ()=>{
	expect(restoreFailureLine(ub, { key: 'newChartSeeds.backfill.houseStartMode', ok: false, detail: '没写进' })).toBe('本机旧命盘：没写进');
	expect(restoreFailureLine(ub, { key: 'horosa.chart.newChartSeeds.recordMissing.v1', ok: false, detail: 'x' })).not.toMatch(/horosa\./);
	expect(restoreNoteText({ settingsComplete: true })).toContain('AI 助手权限类开关每项取本机与备份里较严的一档');
	expect(restoreNoteText({})).toContain('更新时间较新的那份整条保留');
	expect(restoreNoteText({})).toContain('本机在这份备份之后删掉的不带回');
	// 不再暗示「先导出一份当前备份再恢复」就能回退(较新者胜之下那份导出永远较旧、改不回来);改为指向「一律用备份里的」
	expect(restoreNoteText({})).not.toContain('建议先导出一份当前全量备份再恢复');
	expect(restoreNoteText({})).toContain('同一 ID 的命盘 / 事盘一律用备份里的');
	expect(restoreNoteText({}, { sameCid: 'backup' })).toContain('一律用备份里的那一版');
});
