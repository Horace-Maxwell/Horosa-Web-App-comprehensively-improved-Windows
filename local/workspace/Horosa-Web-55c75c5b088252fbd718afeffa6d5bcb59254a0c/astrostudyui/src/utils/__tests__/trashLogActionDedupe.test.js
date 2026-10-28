// 回收站与删除日志的去重改在「找回」动作时做:全量恢复合并删除日志不再拿「回收站里有同一条」拦条目(日志寿命不被回收站 30 天截短);
// 从回收站恢复摘掉删除日志里同 (库, cid) 的旧条目,从日志找回摘掉回收站里同 cid 的条目 —— 三步序列下每个 cid 恰一份。
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import { restoreUnifiedBackup, UNIFIED_BACKUP_FORMAT } from '../unifiedBackup';
import { upsertLocalChart, removeLocalChart, listLocalCharts, listLocalChartsTrash, restoreLocalChartFromTrash, restoreLocalChartFromDeletedLog } from '../localcharts';
import { DELETED_LOG_KEY } from '../localRecordStore';

const log = ()=>JSON.parse(window.localStorage.getItem(DELETED_LOG_KEY) || '[]');
const copies = (cid)=>listLocalCharts({ includeArchived: true }).filter((r)=>r.cid === cid || `${r.name}`.indexOf('(恢复)') >= 0).length
	+ listLocalChartsTrash().filter((r)=>r.cid === cid).length
	+ log().filter((e)=>e.record && e.record.cid === cid).length;
const pkgWithLog = (entries)=>({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { [DELETED_LOG_KEY]: JSON.stringify(entries) } });
const old = { store: 'chart', purgedAt: '2026-01-01 00:00:00', record: { cid: 'X', name: '甲', birth: '1990-01-01 00:00:00' } };

beforeEach(()=>{ window.localStorage.clear(); });

test('🔴 本机回收站里有 X、备份日志里也有 X:恢复后日志收下;从回收站恢复 → 日志里的 X 摘掉;再恢复备份 → 不再带回', async ()=>{
	upsertLocalChart({ cid: 'X', name: '甲', birth: '1990-01-01 00:00:00', zone: '+08:00' });
	removeLocalChart('X');
	expect(listLocalChartsTrash().some((r)=>r.cid === 'X')).toBe(true);
	await restoreUnifiedBackup(pkgWithLog([old]));
	expect(log().some((e)=>e.record.cid === 'X')).toBe(true);   // 不再被回收站拦下
	restoreLocalChartFromTrash('X');
	expect(listLocalCharts().some((r)=>r.cid === 'X')).toBe(true);
	expect(log().some((e)=>e.record.cid === 'X')).toBe(false);
	await restoreUnifiedBackup(pkgWithLog([old]));
	expect(log().some((e)=>e.record.cid === 'X')).toBe(false);   // 已在库里
	expect(copies('X')).toBe(1);
});

test('从日志找回 → 回收站里同 cid 的条目摘掉', async ()=>{
	upsertLocalChart({ cid: 'X', name: '甲', birth: '1990-01-01 00:00:00', zone: '+08:00' });
	removeLocalChart('X');
	await restoreUnifiedBackup(pkgWithLog([old]));
	const entry = log().find((e)=>e.record.cid === 'X');
	restoreLocalChartFromDeletedLog(entry);
	expect(listLocalCharts().some((r)=>r.cid === 'X')).toBe(true);
	expect(listLocalChartsTrash().some((r)=>r.cid === 'X')).toBe(false);
	expect(copies('X')).toBe(1);
});
