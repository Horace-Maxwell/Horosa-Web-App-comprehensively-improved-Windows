// 一次动作改两张档案(关系边双向)/ 合并 / AI 撤销:中途写不进(配额满)不留一半;
// AI 建档与旗标类工具在「只在本次运行有效」时回 ok + persisted:false 并写明,去重命中按存储模式如实报。
const CHARTS_KEY = 'horosa.localCharts.v1';

function quotaError(){
	const e = new Error('The quota has been exceeded.');
	e.name = 'QuotaExceededError';
	return e;
}

// 只让第 n 笔主库写入写不进:前 n-1 笔各一次 setItem 成功;内核遇配额会清缓存后重试一次,
// 所以第 n 笔的首写与重试(第 n、n+1 次 setItem)都抛;之后的写入(回滚)照常
function quotaOnNthWrite(n){
	const real = Storage.prototype.setItem;
	let calls = 0;
	return jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, val){
		if(key === CHARTS_KEY){
			calls += 1;
			if(calls === n || calls === n + 1){ throw quotaError(); }
		}
		return real.call(this, key, val);
	});
}

function breakMainStore(){
	const real = Storage.prototype.setItem;
	return jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, val){
		if(key === CHARTS_KEY){ throw new Error('SecurityError'); }
		return real.call(this, key, val);
	});
}

const A = { cid: 'local-1700000000000-1', name: '甲', birth: '1990-01-01 08:00:00', zone: '+08:00' };
const B = { cid: 'local-1700000000001-2', name: '乙', birth: '1991-01-01 08:00:00', zone: '+08:00' };

let charts;
let rel;
beforeEach(()=>{
	window.localStorage.clear();
	jest.resetModules();
	charts = require('../localcharts');
	rel = require('../recordRelations');
	charts.upsertLocalChart({ ...A });
	charts.upsertLocalChart({ ...B });
});
afterEach(()=>{
	jest.restoreAllMocks();
});

test('🔴 界面「关联两条记录」第二笔写不进:第一笔回滚,不留单向边,错误照抛给界面', ()=>{
	quotaOnNthWrite(2);
	expect(()=>rel.linkRecords('chart', A.cid, B.cid, 'parent')).toThrow();
	jest.restoreAllMocks();
	expect(charts.getLocalChart(A.cid).relations || []).toEqual([]);
	expect(charts.getLocalChart(B.cid).relations || []).toEqual([]);
});

test('解除关联只解了一侧:回滚已解的那侧', ()=>{
	rel.linkRecords('chart', A.cid, B.cid, 'parent');
	quotaOnNthWrite(2);
	expect(()=>rel.unlinkRecords('chart', A.cid, B.cid)).toThrow();
	jest.restoreAllMocks();
	expect(charts.getLocalChart(A.cid).relations).toEqual([{ cid: B.cid, type: 'parent' }]);
	expect(charts.getLocalChart(B.cid).relations).toEqual([{ cid: A.cid, type: 'child' }]);
});

test('合并:副本没能移入回收站(配额满)→ 抛 partial,主记录已并好、两条都还在', ()=>{
	charts.upsertLocalChart({ cid: B.cid, name: '甲', birth: A.birth, memo: '副本备注' });
	quotaOnNthWrite(2);
	let err = null;
	try{ rel.mergeRecords('chart', A.cid, B.cid); }catch(e){ err = e; }
	jest.restoreAllMocks();
	expect(err && err.partial).toBe(true);
	expect(charts.getLocalChart(A.cid).memo).toBe('副本备注');
	expect(charts.getLocalChart(B.cid)).toBeTruthy();
});

test('🔴 AI 撤销关联(两张档案)中途写不进:已还原的回到写后值,不留单向边', ()=>{
	const { writeFlag, flagUndoMulti, ensureRecordFlagUndo } = require('../aiTools/recordFlags');
	ensureRecordFlagUndo();
	const afterA = [{ cid: B.cid, type: 'parent' }];
	const afterB = [{ cid: A.cid, type: 'child' }];
	writeFlag('chart', A.cid, 'relations', afterA);
	writeFlag('chart', B.cid, 'relations', afterB);
	const undo = flagUndoMulti([
		{ store: 'chart', cid: A.cid, field: 'relations', before: [], after: afterA },
		{ store: 'chart', cid: B.cid, field: 'relations', before: [], after: afterB },
	]);
	const ledger = require('../aiTools/ledger');
	const act = ledger.appendAction({ id: 'act-rb-1', tool: 'link_records', undo });
	expect(act).toBeTruthy();
	quotaOnNthWrite(2);
	const r = ledger.undoAction('act-rb-1');
	jest.restoreAllMocks();
	expect(r.ok).toBe(false);
	expect(r.code).toBe('E_STORE_QUOTA');
	expect(charts.getLocalChart(A.cid).relations).toEqual(afterA);
	expect(charts.getLocalChart(B.cid).relations).toEqual(afterB);
});

test('🔴 AI 建档在只在本次运行时:回 ok + persisted:false 并写明;重试命中去重也如实报 persisted:false', async ()=>{
	breakMainStore();
	const tool = require('../aiTools/tools/createChartRecord').default;
	const r = await tool.run({ name: '丙', birth: '1992-05-18 10:00', gpsLat: 31.63, gpsLon: 118.45, selectAsAnalysisSource: false }, { actionId: 'a1' });
	expect(r.ok).toBe(true);
	expect(r.data.persisted).toBe(false);
	const { STORE_SESSION_ONLY_ASSUMPTION } = require('../recordStoreNotice');
	expect(r.assumptions).toContain(STORE_SESSION_ONLY_ASSUMPTION);
	const again = await tool.run({ name: '丙', birth: '1992-05-18 10:00', gpsLat: 31.63, gpsLon: 118.45, selectAsAnalysisSource: false }, { actionId: 'a2' });
	expect(again.data.duplicate).toBe(true);
	expect(again.data.persisted).toBe(false);
});

test('AI 星标在只在本次运行时:回 persisted:false 并写明;已落盘时回包不带该键', async ()=>{
	const star = require('../aiTools/tools/starRecord').default;
	const ok = await star.run({ recordId: A.cid }, { actionId: 's1' });
	expect(ok.ok).toBe(true);
	expect(ok.data.persisted).toBeUndefined();
	breakMainStore();
	const r = await star.run({ recordId: B.cid }, { actionId: 's2' });
	expect(r.ok).toBe(true);
	expect(r.data.persisted).toBe(false);
	const { STORE_SESSION_ONLY_CHANGE_ASSUMPTION } = require('../recordStoreNotice');
	expect(r.assumptions).toContain(STORE_SESSION_ONLY_CHANGE_ASSUMPTION);
});
