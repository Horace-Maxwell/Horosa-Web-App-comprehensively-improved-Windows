// 档案写入「是否真落盘」:本机存储写不进(非配额错误)时内核退成「只在本次运行有效」,
// 回收站的进出必须与主库同进退;恢复不覆盖库里已有的同 cid 现档;各入口按同一判据提示。
const CHARTS_KEY = 'horosa.localCharts.v1';
const TRASH_KEY = 'horosa.localCharts.trash.v1';
const DELETED_LOG_KEY = 'horosa.deleted.log.v1';

function quotaError(){
	const e = new Error('The quota has been exceeded.');
	e.name = 'QuotaExceededError';
	return e;
}

function fresh(){
	jest.resetModules();
	return {
		charts: require('../localcharts'),
		notice: require('../recordStoreNotice'),
	};
}

// 只让主库键写不进(非配额错误 = 存储坏);回收站等其它键照常可写
function breakMainStore(){
	const real = Storage.prototype.setItem;
	return jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, val){
		if(key === CHARTS_KEY){ throw new Error('SecurityError'); }
		return real.call(this, key, val);
	});
}

const A = { cid: 'local-1700000000000-1', name: '甲', birth: '1990-01-01 08:00:00', zone: '+08:00' };

afterEach(()=>{
	jest.restoreAllMocks();
	window.localStorage.clear();
});

describe('回收站与主库同进退', ()=>{
	test('🔴 只在本次运行时删除:回收站也只记在内存,磁盘上主库与回收站都不变(重启后不会两边各一份)', ()=>{
		const { charts, notice } = fresh();
		charts.upsertLocalChart({ ...A });
		breakMainStore();
		const w = charts.removeLocalChart(A.cid);
		expect(w.persisted).toBe(false);
		expect(notice.recordStorePersisted('chart')).toBe(false);
		// 会话内:列表里没了,回收站里有
		expect(charts.listLocalCharts().find((r)=>r.cid === A.cid)).toBeUndefined();
		expect(charts.listLocalChartsTrash().map((r)=>r.cid)).toEqual([A.cid]);
		// 磁盘:主库仍有这条,回收站没写
		const disk = JSON.parse(window.localStorage.getItem(CHARTS_KEY));
		expect(disk.map((r)=>r.cid)).toEqual([A.cid]);
		expect(window.localStorage.getItem(TRASH_KEY)).toBe(null);
	});

	test('🔴 恢复时主库写不进:磁盘回收站那条保留(此前已被删掉 → 重启后两边都没有,记录丢失)', ()=>{
		const { charts } = fresh();
		charts.upsertLocalChart({ ...A });
		charts.removeLocalChart(A.cid);
		expect(JSON.parse(window.localStorage.getItem(TRASH_KEY)).map((r)=>r.cid)).toEqual([A.cid]);
		breakMainStore();
		const restored = charts.restoreLocalChartFromTrash(A.cid);
		expect(restored.cid).toBe(A.cid);
		// 会话内:回到列表、回收站里没了
		expect(charts.listLocalCharts().find((r)=>r.cid === A.cid)).toBeTruthy();
		expect(charts.listLocalChartsTrash()).toEqual([]);
		// 磁盘:回收站那条还在
		expect(JSON.parse(window.localStorage.getItem(TRASH_KEY)).map((r)=>r.cid)).toEqual([A.cid]);
	});

	test('只在本次运行时彻底删除:不写删除日志(重启后回收站原样还在)', ()=>{
		const { charts } = fresh();
		charts.upsertLocalChart({ ...A });
		charts.removeLocalChart(A.cid);
		breakMainStore();
		charts.upsertLocalChart({ cid: 'local-1700000000001-2', name: '乙', birth: '1991-01-01 08:00:00' });   // 进入只在本次运行
		charts.purgeLocalChartTrashItem(A.cid);
		expect(window.localStorage.getItem(DELETED_LOG_KEY)).toBe(null);
		expect(JSON.parse(window.localStorage.getItem(TRASH_KEY)).map((r)=>r.cid)).toEqual([A.cid]);
	});

	test('删除写不进(配额满):回值如实 quota,记录仍在、不进回收站', ()=>{
		const { charts } = fresh();
		charts.upsertLocalChart({ ...A });
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key){
			if(key === CHARTS_KEY){ throw quotaError(); }
		});
		const w = charts.removeLocalChart(A.cid);
		expect(w).toEqual(expect.objectContaining({ persisted: false, reason: 'quota' }));
		expect(charts.listLocalCharts().find((r)=>r.cid === A.cid)).toBeTruthy();
		expect(charts.listLocalChartsTrash()).toEqual([]);
	});
});

describe('恢复不覆盖已有的同 cid 现档', ()=>{
	test('🔴 回收站恢复:库里已有同 cid(删除后又从备份导入过)→ 按副本恢复,现档不动', ()=>{
		const { charts } = fresh();
		charts.upsertLocalChart({ ...A, memo: '旧版' });
		charts.removeLocalChart(A.cid);
		charts.importLocalChartsBackup({ format: 'horosa-local-charts', version: 1, charts: [{ ...A, memo: '新版' }] });
		const restored = charts.restoreLocalChartFromTrash(A.cid);
		expect(restored.cid).not.toBe(A.cid);
		expect(restored.name).toBe('甲(恢复)');
		expect(restored.memo).toBe('旧版');
		expect(restored.deletedAt).toBeUndefined();
		expect(charts.getLocalChart(A.cid).memo).toBe('新版');
		expect(charts.listLocalChartsTrash()).toEqual([]);
	});

	test('删除日志找回:同 cid 已存在 → 副本;不存在 → 原 cid;都不带 deletedAt', ()=>{
		const { charts } = fresh();
		const logged = { ...A, memo: '日志里的', deletedAt: '2026-10-01 10:00:00' };
		const r1 = charts.restoreLocalChartRecord(logged);
		expect(r1.cid).toBe(A.cid);
		expect(r1.deletedAt).toBeUndefined();
		expect(charts.getLocalChart(A.cid).deletedAt).toBeUndefined();
		charts.upsertLocalChart({ cid: A.cid, memo: '我后来改的' });
		const r2 = charts.restoreLocalChartRecord(logged);
		expect(r2.cid).not.toBe(A.cid);
		expect(charts.getLocalChart(A.cid).memo).toBe('我后来改的');
	});
});

describe('提示单源', ()=>{
	const msgApi = ()=>{ const calls = []; return { calls, success: (t)=>calls.push(['success', t]), warning: (t)=>calls.push(['warning', t]), error: (t)=>calls.push(['error', t]) }; };

	test('写入提示:已落盘 = 成功;只在本次运行 = 警告并写明', ()=>{
		const { charts, notice } = fresh();
		const m1 = msgApi();
		charts.upsertLocalChart({ ...A });
		expect(notice.toastRecordWrite(m1, 'chart', '已保存')).toBe(true);
		expect(m1.calls).toEqual([['success', '已保存']]);
		breakMainStore();
		charts.upsertLocalChart({ ...A, name: '甲2' });
		const m2 = msgApi();
		expect(notice.toastRecordWrite(m2, 'chart', '已保存')).toBe(false);
		expect(m2.calls).toEqual([['warning', `已保存${notice.RECORD_NOT_PERSISTED_NOTE}`]]);
	});

	test('批量提示:部分配额失败 = 警告并写明条数;全部失败 = 报错;没有一律报成功', ()=>{
		const { notice } = fresh();
		const r = notice.runRecordBatch([1, 2, 3], (n)=>{ if(n === 2){ throw quotaError(); } });
		expect(r).toEqual({ ok: 2, failed: 1 });
		const m1 = msgApi();
		notice.toastRecordBatch(m1, 'chart', r, (n)=>`已置顶 ${n} 条`);
		expect(m1.calls[0][0]).toBe('warning');
		expect(m1.calls[0][1]).toContain('已置顶 2 条');
		expect(m1.calls[0][1]).toContain('另有 1 条');
		const m2 = msgApi();
		notice.toastRecordBatch(m2, 'chart', { ok: 0, failed: 3 }, (n)=>`已置顶 ${n} 条`);
		expect(m2.calls[0][0]).toBe('error');
		const m3 = msgApi();
		notice.toastRecordBatch(m3, 'chart', { ok: 3, failed: 0 }, (n)=>`已置顶 ${n} 条`);
		expect(m3.calls).toEqual([['success', '已置顶 3 条']]);
	});

	test('导入提示:一条没进 = 报错;有失败 / 只在本次运行 = 警告;去重跳过如实写', ()=>{
		const { notice } = fresh();
		const m1 = msgApi();
		notice.toastRecordImport(m1, 'chart', { imported: 0, failed: 2 }, { label: '导入' });
		expect(m1.calls[0][0]).toBe('error');
		const m2 = msgApi();
		notice.toastRecordImport(m2, 'chart', { imported: 3, failed: 0, dupSkipped: 1, total: 9 }, { label: '导入' });
		expect(m2.calls).toEqual([['success', '导入完成：新增或替换 3 条，重复跳过 1 条，当前共 9 条']]);
		// 名人库补丁按字段合并的另计;本机之后删掉的没带回如实写
		const m3 = msgApi();
		notice.toastRecordImport(m3, 'chart', { imported: 3, merged: 1, skippedDeleted: 2, failed: 0, total: 9 }, { label: '导入' });
		expect(m3.calls).toEqual([['success', '导入完成：新增或替换 2 条，刷新已有记录的出生数据 1 条，本机在这份备份之后删掉的 2 条没有带回，当前共 9 条']]);
	});

	test('判据只看存储模式:足迹类静默写失败留下的「最近写失败」不让一次没写入的去重命中误报', ()=>{
		const { charts, notice } = fresh();
		charts.upsertLocalChart({ ...A });
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key){
			if(key === CHARTS_KEY){ throw quotaError(); }
		});
		charts.touchLocalChart(A.cid);   // 足迹写失败(静默)
		expect(charts.getLocalChartsStoreHealth().lastWriteFailed).toBe(true);
		expect(notice.recordStorePersisted('chart')).toBe(true);
	});
});

describe('全量恢复', ()=>{
	test('🔴 命盘只进了内存:该项记失败并标 sessionOnly(调用方据此不刷新页面)', async ()=>{
		jest.resetModules();
		const ub = require('../unifiedBackup');
		breakMainStore();
		const results = await ub.restoreUnifiedBackup({ format: 'horosa-unified-backup', version: 1, charts: { format: 'horosa-local-charts', version: 1, charts: [{ ...A }] } });
		const charts = results.find((r)=>r.key === 'charts');
		expect(charts).toEqual(expect.objectContaining({ ok: false, sessionOnly: true }));
		expect(charts.detail).toContain('只在本次运行有效');
	});
});

describe('删除日志找回 / 完整恢复同名同生辰 / 批注写已删的盘 / AI 撤销建档', ()=>{
	test('🔴 删除日志找回后把这条从日志里摘掉:再点不会每次多一条副本', ()=>{
		const { charts } = fresh();
		charts.upsertLocalChart({ ...A });
		charts.removeLocalChart(A.cid);
		charts.purgeLocalChartTrashItem(A.cid);
		const log = JSON.parse(window.localStorage.getItem(DELETED_LOG_KEY));
		expect(log.length).toBe(1);
		const r = charts.restoreLocalChartFromDeletedLog(log[0]);
		expect(r.cid).toBe(A.cid);
		expect(JSON.parse(window.localStorage.getItem(DELETED_LOG_KEY))).toEqual([]);
		expect(charts.restoreLocalChartFromDeletedLog(log[0]).name).toBe('甲(恢复)');   // 手里的旧条目再用:库里已有 → 副本(不覆盖)
		expect(charts.listLocalCharts().length).toBe(2);
		// 事盘同一套:彻底删除进删除日志,事盘列表能找回(此前只有命盘列表有入口)
		const cases = require('../localcases');
		cases.upsertLocalCase({ cid: 'case-del-1', event: '问事', divTime: '2026-01-01 10:00:00', zone: '+08:00' });
		cases.removeLocalCase('case-del-1');
		cases.purgeLocalCaseTrashItem('case-del-1');
		const clog = JSON.parse(window.localStorage.getItem(DELETED_LOG_KEY)).filter((e)=>e.store === 'case');
		expect(clog.length).toBe(1);
		expect(cases.restoreLocalCaseFromDeletedLog(clog[0]).cid).toBe('case-del-1');
		expect(JSON.parse(window.localStorage.getItem(DELETED_LOG_KEY)).filter((e)=>e.store === 'case')).toEqual([]);
		const caseListSrc = require('fs').readFileSync(require('path').join(__dirname, '../../components/user/CaseList.js'), 'utf8');
		expect(caseListSrc).toContain('restoreLocalCaseFromDeletedLog(e)');
	});
	test('🔴 完整恢复:同一份备份里同名同生辰的两条(双胞胎 / 重录)都恢复;只跳过与导入前本机已有记录重复的,预览如实算', ()=>{
		const { charts } = fresh();
		charts.upsertLocalChart({ cid: 'local-old', name: '丙', birth: '1980-01-01 08:00:00', zone: '+08:00' });
		const backup = { format: 'horosa-local-charts', version: 1, charts: [
			{ cid: 'local-t1', name: '甲', birth: '1990-01-01 08:00:00', zone: '+08:00', memo: '哥哥' },
			{ cid: 'local-t2', name: '甲', birth: '1990-01-01 08:00:00', zone: '+08:00', memo: '弟弟' },
			{ cid: 'local-dup', name: '丙', birth: '1980-01-01 08:00:00', zone: '+08:00' },
		] };
		const pv = charts.previewLocalChartsBackup(backup);
		expect([pv.adds, pv.updates, pv.dupSkips]).toEqual([2, 0, 1]);
		const r = charts.importLocalChartsBackup(backup);
		expect([r.imported, r.dupSkipped]).toEqual([2, 1]);
		expect(charts.listLocalCharts().filter((c)=>c.name === '甲').map((c)=>c.memo).sort()).toEqual(['哥哥', '弟弟']);
		// 不带记录号的(其它软件导出的文件):同一批里重复的行只进一条,预览与结果一致
		const ext = { format: 'horosa-local-charts', version: 1, charts: [
			{ name: '丁', birth: '1970-01-01 08:00:00', zone: '+08:00' },
			{ name: '丁', birth: '1970-01-01 08:00:00', zone: '+08:00' },
			{ name: '戊', birth: '1971-01-01 08:00:00', zone: '+08:00' },
		] };
		const pv2 = charts.previewLocalChartsBackup(ext);
		expect([pv2.adds, pv2.dupSkips]).toEqual([2, 1]);
		const r2 = charts.importLocalChartsBackup(ext);
		expect([r2.imported, r2.dupSkipped]).toEqual([2, 1]);
		expect(charts.listLocalCharts().filter((c)=>c.name === '丁').length).toBe(1);
	});
	test('🔴 删掉当前盘后再存批注:拒存提示,不落一条没名字、生辰是此刻的残缺记录', ()=>{
		const { charts } = fresh();
		const userModel = require('../../models/user').default;
		const antd = require('antd');
		const warn = jest.spyOn(antd.Modal, 'warning').mockImplementation(()=>{});
		const memo = (v)=>({ value: v });
		const currentChart = { memoAstro: memo(''), memoBaZi: memo(''), memoZiWei: memo(''), memo74: memo(''), memoGua: memo(''), memoLiuReng: memo(''), memoQiMeng: memo(''), memoSuZhan: memo('') };
		const gen = userModel.effects.saveMemo({ payload: { cid: 'local-gone', type: 0, orgMemo: '批注' } }, { call: jest.fn(), put: (a)=>a, select: (fn)=>fn({ user: { currentChart } }) });
		let step = gen.next();
		while(!step.done){ step = gen.next(step.value && step.value.user ? step.value : currentChart); }
		expect(warn).toHaveBeenCalled();
		expect(charts.listLocalCharts()).toEqual([]);
	});
	test('AI 撤销建档:删除没写进(配额满)→ 不记已撤销、回 E_STORE_QUOTA;写进了照常', ()=>{
		const { charts } = fresh();
		const ledger = require('../aiTools/ledger');
		const saved = charts.upsertLocalChart({ ...A, aiOrigin: { actionId: 'act-1' } });
		if(typeof ledger.__resetLedgerForTests === 'function'){ ledger.__resetLedgerForTests(); }
		ledger.appendAction({ id: 'act-1', tool: 'create_chart_record', at: new Date(Date.now() + 60000).toISOString(), undo: { kind: 'trash-record', payload: { store: 'chart', cid: saved.cid } } });
		const real = Storage.prototype.setItem;
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, val){
			if(key === CHARTS_KEY){ throw quotaError(); }
			return real.call(this, key, val);
		});
		const r1 = ledger.undoAction('act-1');
		expect(r1.ok).toBe(false);
		expect(r1.code).toBe('E_STORE_QUOTA');
		spy.mockRestore();
		const r2 = ledger.undoAction('act-1');
		expect(r2.ok).toBe(true);
		expect(r2.data.keptIn).toBe('trash');
		expect(charts.listLocalCharts()).toEqual([]);
	});
	test('AI 撤销建档:回收站写不进时照样撤销,回包写明这条进了删除日志', ()=>{
		const { charts } = fresh();
		const ledger = require('../aiTools/ledger');
		const saved = charts.upsertLocalChart({ ...A, aiOrigin: { actionId: 'act-2' } });
		if(typeof ledger.__resetLedgerForTests === 'function'){ ledger.__resetLedgerForTests(); }
		ledger.appendAction({ id: 'act-2', tool: 'create_chart_record', at: new Date(Date.now() + 60000).toISOString(), undo: { kind: 'trash-record', payload: { store: 'chart', cid: saved.cid } } });
		const real = Storage.prototype.setItem;
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, val){
			if(key === 'horosa.localCharts.trash.v1'){ throw quotaError(); }
			return real.call(this, key, val);
		});
		const r = ledger.undoAction('act-2');
		spy.mockRestore();
		expect(r.ok).toBe(true);
		expect(r.data.keptIn).toBe('log');
		expect(r.message).toMatch(/删除日志/);
		expect(charts.listLocalCharts()).toEqual([]);
	});
});
