// 记录库内核的几条「不丢数据」合同:
//  ① 回收站满了被挤出的已删记录先进删除日志(此前直接消失,确认框却写「可恢复」)
//  ② 主存 / 回收站 / 删除日志的内容坏了:原串留档,不盖原内容(此前读成空库,下一次保存连影子副本一起盖掉);
//     有影子副本可等 → 本次运行只在内存、等对账;没有可用的影子(浏览器 / 独立实例 / 无头,或对账没救回)→ 从空库开始并落盘
//  ③ 存储写满时删除照样生效:先出主库、再进回收站;回收站写不进 → 记进删除日志;都写不进 → 删除照样生效、回值 unkept 并广播
//     (此前先进回收站、再出主库:写满后任何删除都被拒,用户在软件里腾不出空间);彻底删除 / 清空回收站写不进日志 → 回收站退回
//  ④ 导入同一 ID:更新时间较新的那一版整条胜出,不按字段混合(此前包盖本机、本机后加的键留着、更新时间倒退)
//  ⑤ 健康态带上「读到更新版本的记录」与「内容坏了」
// 每例取全新模块实例(内存降级 / 降级事件是每实例一次性的状态):与 localRecordStoreQuota 同一装卸法
let listLocalCharts; let upsertLocalChart; let removeLocalChart; let getLocalChart; let listLocalChartsTrash; let purgeLocalChartTrashItem;
let clearLocalChartsTrash; let importLocalChartsBackup; let previewLocalChartsBackup; let getLocalChartsStoreHealth; let countLocalChartsLiveTrash;
let LOCAL_CHARTS_TRASH_CAP; let upsertLocalCase; let removeLocalCase; let listLocalCasesTrash;

const CHARTS = 'horosa.localCharts.v1';
const TRASH = 'horosa.localCharts.trash.v1';
const LOG = 'horosa.deleted.log.v1';
const pad2 = (n)=>`${Math.floor(n)}`.padStart(2, '0');
const log = ()=>JSON.parse(window.localStorage.getItem(LOG) || '[]');
const corruptKeys = (key)=>Object.keys(window.localStorage).filter((k)=>k.indexOf(`horosa.corrupt.${key}.`) === 0);
const quotaErr = ()=>{ const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; return e; };

function resetStores(){
	window.localStorage.clear();
	jest.dontMock('../aiAnalysisDesktop');
	jest.resetModules();
	// eslint-disable-next-line global-require
	({ listLocalCharts, upsertLocalChart, removeLocalChart, getLocalChart, listLocalChartsTrash, purgeLocalChartTrashItem, clearLocalChartsTrash,
		importLocalChartsBackup, previewLocalChartsBackup, getLocalChartsStoreHealth, countLocalChartsLiveTrash, LOCAL_CHARTS_TRASH_CAP } = require('../localcharts'));
	// eslint-disable-next-line global-require
	({ upsertLocalCase, removeLocalCase, listLocalCasesTrash } = require('../localcases'));
}
// 桌面主窗口(有影子副本可等):桥可用、端口按主实例
function resetStoresWithShadow(){
	window.localStorage.clear();
	jest.resetModules();
	jest.doMock('../aiAnalysisDesktop', ()=>({ isDesktopBridgeAvailable: ()=>true, invokeDesktopCommand: jest.fn(()=>Promise.resolve()) }));
	// eslint-disable-next-line global-require
	({ listLocalCharts, upsertLocalChart, removeLocalChart, getLocalChart, listLocalChartsTrash, purgeLocalChartTrashItem, clearLocalChartsTrash,
		importLocalChartsBackup, previewLocalChartsBackup, getLocalChartsStoreHealth, countLocalChartsLiveTrash, LOCAL_CHARTS_TRASH_CAP } = require('../localcharts'));
}

describe('① 回收站满了挤出去的先进删除日志', ()=>{
	beforeEach(resetStores);
	afterEach(()=>{ jest.restoreAllMocks(); });

	it('连删 230 条:回收站留 200 条,挤出去的 30 条在删除日志里,哪里都找不到的 0 条', ()=>{
		for(let i = 0; i < 230; i += 1){ upsertLocalChart({ cid: `bulk-${i}`, name: `批量${i}`, birth: `1990-01-01 ${pad2(i % 24)}:00:00` }); }
		for(let i = 0; i < 230; i += 1){ removeLocalChart(`bulk-${i}`); }
		const inTrash = new Set(listLocalChartsTrash().map((r)=>r.cid));
		const inLog = new Set(log().map((e)=>e.record && e.record.cid));
		const lost = [];
		for(let i = 0; i < 230; i += 1){ const c = `bulk-${i}`; if(!inTrash.has(c) && !inLog.has(c)){ lost.push(c); } }
		expect(inTrash.size).toBe(LOCAL_CHARTS_TRASH_CAP);
		expect(inLog.size).toBe(30);
		expect(lost).toEqual([]);
		// 挤出去的是最早删的那批
		expect(inLog.has('bulk-0')).toBe(true);
		expect(inLog.has('bulk-229')).toBe(false);
		expect(countLocalChartsLiveTrash()).toBe(200);
	});

	it('事盘回收站同一内核同一口径', ()=>{
		for(let i = 0; i < 202; i += 1){ upsertLocalCase({ cid: `cs-${i}`, event: `课${i}`, caseType: 'liuyao', divTime: '2026-01-01 10:00:00' }); }
		for(let i = 0; i < 202; i += 1){ removeLocalCase(`cs-${i}`); }
		expect(listLocalCasesTrash().length).toBe(200);
		expect(log().filter((e)=>e.store === 'case').map((e)=>e.record.cid).sort()).toEqual(['cs-0', 'cs-1']);
	});

	it('挤出去的记不进删除日志(写不进)时:回收站不动,删除照样生效,回值 unkept 并把这条广播出去(横幅给「导出这些记录」)', ()=>{
		const ago = (d)=>{ const t = new Date(Date.now() - d * 60000); return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())} ${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}`; };
		window.localStorage.setItem(TRASH, JSON.stringify(Array.from({ length: 200 }, (_, i)=>({ cid: `old-${i}`, name: `旧${i}`, deletedAt: ago(i + 1) }))));
		upsertLocalChart({ cid: 'keep-me', name: '留着', birth: '1990-01-01 08:00:00' });
		const real = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(k === LOG){ throw quotaErr(); }
			return real.call(this, k, v);
		});
		const got = [];
		const h = (e)=>{ got.push(e.detail); };
		window.addEventListener('horosa:record-store-unkept', h);
		const r = removeLocalChart('keep-me');
		window.removeEventListener('horosa:record-store-unkept', h);
		expect(r).toMatchObject({ persisted: true, unkept: true });
		expect(getLocalChart('keep-me')).toBe(null);
		expect(JSON.parse(window.localStorage.getItem(TRASH)).length).toBe(200);
		expect(JSON.parse(window.localStorage.getItem(TRASH)).some((x)=>x.cid === 'keep-me')).toBe(false);
		expect(got.length).toBe(1);
		expect(got[0]).toMatchObject({ store: 'chart', storageKey: CHARTS });
		expect(got[0].records.map((x)=>x.cid)).toEqual(['keep-me']);
	});
});

describe('② 内容坏了:原串留档,不当空库盖掉', ()=>{
	beforeEach(resetStores);

	it('没有影子副本可等(浏览器 / 独立实例 / 无头):原串留档后从空库开始并落盘,之后新存的照常落盘', ()=>{
		const original = '{"charts":[{"cid":"a"},{"cid":"b"}]}';
		window.localStorage.setItem(CHARTS, original);
		let reset = 0;
		const h = ()=>{ reset += 1; };
		window.addEventListener('horosa:record-store-corrupt-reset', h);
		expect(listLocalCharts().length).toBe(0);
		upsertLocalChart({ cid: 'after', name: '之后新存的', birth: '2000-01-01 08:00:00' });
		window.removeEventListener('horosa:record-store-corrupt-reset', h);
		const arch = corruptKeys(CHARTS);
		expect(arch.length).toBe(1);
		expect(window.localStorage.getItem(arch[0])).toBe(original);   // 原内容在留档里
		expect(JSON.parse(window.localStorage.getItem(CHARTS)).map((x)=>x.cid)).toEqual(['after']);   // 落盘了(重启还在)
		const health = getLocalChartsStoreHealth();
		expect(health.mode).toBe('persistent');
		expect(health.corrupt).toMatchObject({ storageKey: CHARTS, archiveKey: arch[0], resetToEmpty: true });
		expect(reset).toBe(1);
	});

	it('原串留不成档(空间不足):不从空库开始,照旧只在内存、不盖原内容', ()=>{
		const original = '{"bad":1}';
		window.localStorage.setItem(CHARTS, original);
		const real = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(`${k}`.indexOf('horosa.corrupt.') === 0){ throw quotaErr(); }
			return real.call(this, k, v);
		});
		try{
			expect(listLocalCharts().length).toBe(0);
			upsertLocalChart({ name: '新存的', birth: '2000-01-01 08:00:00' });
			expect(window.localStorage.getItem(CHARTS)).toBe(original);
			expect(getLocalChartsStoreHealth()).toMatchObject({ mode: 'memory', corrupt: { archiveKey: null } });
		}finally{ jest.restoreAllMocks(); }
	});

	it('有影子副本可等:命盘库主键不是数组 → 留档 + 只在内存 + 降级事件;之后保存不碰原内容', ()=>{
		resetStoresWithShadow();
		const original = '{"charts":[{"cid":"a"},{"cid":"b"}]}';
		window.localStorage.setItem(CHARTS, original);
		let degraded = 0;
		const h = ()=>{ degraded += 1; };
		window.addEventListener('horosa.localRecordStore.degraded', h);
		expect(listLocalCharts().length).toBe(0);
		upsertLocalChart({ name: '新存的', birth: '2000-01-01 08:00:00' });
		window.removeEventListener('horosa.localRecordStore.degraded', h);
		expect(window.localStorage.getItem(CHARTS)).toBe(original);   // 主存原内容没被盖
		const arch = corruptKeys(CHARTS);
		expect(arch.length).toBe(1);
		expect(window.localStorage.getItem(arch[0])).toBe(original);
		expect(degraded).toBe(1);
		const health = getLocalChartsStoreHealth();
		expect(health.mode).toBe('memory');
		expect(health.corrupt).toMatchObject({ storageKey: CHARTS, archiveKey: arch[0] });
	});

	it('影子副本对账写回了坏掉的主存、本次运行还没在内存里存过 → 退出内存模式读到写回的数据', ()=>{
		resetStoresWithShadow();
		window.localStorage.setItem(CHARTS, '[{"cid":"x"');   // 截断
		expect(listLocalCharts().length).toBe(0);
		expect(getLocalChartsStoreHealth().mode).toBe('memory');
		window.localStorage.setItem(CHARTS, JSON.stringify([{ cid: 'from-shadow', name: '影子里的', birth: '1990-01-01 08:00:00', updateTime: '2026-01-01 10:00:00' }]));
		window.dispatchEvent(new CustomEvent('horosa.shadowMirror.reconciled', { detail: { restored: [CHARTS], corrupt: [CHARTS] } }));
		expect(getLocalChartsStoreHealth().mode).toBe('persistent');
		expect(listLocalCharts().map((r)=>r.cid)).toEqual(['from-shadow']);
	});

	it('对账读过影子却没救回这把键(没有影子 / 影子也坏了):退出内存模式,把本次运行新存的 / 从备份恢复的落盘 —— 重启后还在', ()=>{
		resetStoresWithShadow();
		const original = '[{"cid":"x"';
		window.localStorage.setItem(CHARTS, original);
		expect(listLocalCharts().length).toBe(0);
		expect(getLocalChartsStoreHealth().mode).toBe('memory');
		importLocalChartsBackup({ format: 'horosa-local-charts', version: 1, charts: [{ cid: 'from-backup', name: '备份里的', birth: '1990-01-01 08:00:00', updateTime: '2026-01-01 10:00:00' }] });
		window.dispatchEvent(new CustomEvent('horosa.shadowMirror.reconciled', { detail: { checked: true, restored: [], diverged: [CHARTS], corrupt: [] } }));
		expect(getLocalChartsStoreHealth()).toMatchObject({ mode: 'persistent', corrupt: { resetToEmpty: true } });
		expect(JSON.parse(window.localStorage.getItem(CHARTS)).map((x)=>x.cid)).toEqual(['from-backup']);
		expect(window.localStorage.getItem(corruptKeys(CHARTS)[0])).toBe(original);
		upsertLocalChart({ cid: 'later', name: '之后', birth: '1991-01-01 08:00:00' });
		expect(JSON.parse(window.localStorage.getItem(CHARTS)).map((x)=>x.cid).sort()).toEqual(['from-backup', 'later']);
	});

	it('影子里有完好的一份却没写回主存(restoreFailed)/ 原串留不成档(corruptUnarchived):不落盘,照旧只在内存(不把那份影子盖掉)', ()=>{
		resetStoresWithShadow();
		window.localStorage.setItem(CHARTS, '{"y":1}');
		listLocalCharts();
		window.dispatchEvent(new CustomEvent('horosa.shadowMirror.reconciled', { detail: { checked: true, restored: [], restoreFailed: [CHARTS] } }));
		expect(getLocalChartsStoreHealth().mode).toBe('memory');
		window.dispatchEvent(new CustomEvent('horosa.shadowMirror.reconciled', { detail: { checked: true, restored: [], corruptUnarchived: [CHARTS] } }));
		expect(getLocalChartsStoreHealth().mode).toBe('memory');
		expect(window.localStorage.getItem(CHARTS)).toBe('{"y":1}');
	});

	it('对账没读到影子(读失败,checked=false):不擅自落盘,照旧只在内存', ()=>{
		resetStoresWithShadow();
		window.localStorage.setItem(CHARTS, '{"x":1}');
		listLocalCharts();
		window.dispatchEvent(new CustomEvent('horosa.shadowMirror.reconciled', { detail: { checked: false, restored: [] } }));
		expect(getLocalChartsStoreHealth().mode).toBe('memory');
		expect(window.localStorage.getItem(CHARTS)).toBe('{"x":1}');
	});

	it('null / 空白串里本来没有数据:照旧当空库、不留档、不降级', ()=>{
		window.localStorage.setItem(CHARTS, 'null');
		expect(listLocalCharts().length).toBe(0);
		upsertLocalChart({ cid: 'n1', name: '甲', birth: '1990-01-01 08:00:00' });
		expect(getLocalChartsStoreHealth().mode).toBe('persistent');
		expect(corruptKeys(CHARTS)).toEqual([]);
		expect(getLocalChart('n1')).toBeTruthy();
	});

	it('回收站内容坏了:删除照常,原串先留档(里面的条目找得回)', ()=>{
		const bad = '[{"cid":"t1","deletedAt":"2026-10-01 10:00:00"}';   // 截断
		window.localStorage.setItem(TRASH, bad);
		upsertLocalChart({ cid: 'd1', name: '删一张', birth: '2001-01-01 08:00:00' });
		removeLocalChart('d1');
		const arch = corruptKeys(TRASH);
		expect(arch.length).toBe(1);
		expect(window.localStorage.getItem(arch[0])).toBe(bad);
		expect(listLocalChartsTrash().map((r)=>r.cid)).toEqual(['d1']);
	});

	it('回收站内容坏了又留不成档(空间不足):回收站不写(坏串原样),删除照样生效、这条记进删除日志', ()=>{
		window.localStorage.setItem(TRASH, '{oops');
		upsertLocalChart({ cid: 'd2', name: '删一张', birth: '2001-01-01 08:00:00' });
		const real = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(`${k}`.indexOf('horosa.corrupt.') === 0){ throw quotaErr(); }
			return real.call(this, k, v);
		});
		try{
			const r = removeLocalChart('d2');
			expect(r).toMatchObject({ persisted: true, keptIn: 'log' });
			expect(window.localStorage.getItem(TRASH)).toBe('{oops');
			expect(getLocalChart('d2')).toBe(null);
			expect(log().map((e)=>e.record.cid)).toEqual(['d2']);
		}finally{ jest.restoreAllMocks(); }
	});

	it('删除日志内容坏了:彻底删除前原串先留档', ()=>{
		window.localStorage.setItem(LOG, '[{"store":"chart","record":{"cid":"z"}}');   // 截断
		upsertLocalChart({ cid: 'p1', name: '彻底删', birth: '2001-01-01 08:00:00' });
		removeLocalChart('p1');
		expect(purgeLocalChartTrashItem('p1')).toBe(true);
		expect(corruptKeys(LOG).length).toBe(1);
		expect(log().map((e)=>e.record.cid)).toEqual(['p1']);
	});
});

describe('③ 存储将满时的删除 / 彻底删除', ()=>{
	beforeEach(resetStores);
	afterEach(()=>{ jest.restoreAllMocks(); });

	it('回收站写不进(配额满):删除照样生效(主库变小),这条直接记进删除日志、仍可找回', ()=>{
		upsertLocalChart({ cid: 'q1', name: '满了', birth: '1990-01-01 08:00:00' });
		const real = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(k === TRASH){ throw quotaErr(); }
			return real.call(this, k, v);
		});
		expect(removeLocalChart('q1')).toMatchObject({ persisted: true, trashFailure: 'quota', keptIn: 'log' });
		expect(getLocalChart('q1')).toBe(null);
		expect(log().map((e)=>e.record.cid)).toEqual(['q1']);
	});

	it('存储写满(主库以外的键一律写不进):连删 38 条全部生效,主库清空;留不进回收站 / 删除日志的逐条广播', ()=>{
		for(let i = 0; i < 38; i += 1){ upsertLocalChart({ cid: `full-${i}`, name: `满${i}`, birth: `1990-01-01 ${pad2(i % 24)}:00:00` }); }
		const real = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(k !== CHARTS){ throw quotaErr(); }
			return real.call(this, k, v);
		});
		const got = [];
		const h = (e)=>{ got.push(...e.detail.records.map((x)=>x.cid)); };
		window.addEventListener('horosa:record-store-unkept', h);
		let refused = 0;
		for(let i = 0; i < 38; i += 1){ const r = removeLocalChart(`full-${i}`); if(!r.persisted){ refused += 1; } }
		window.removeEventListener('horosa:record-store-unkept', h);
		expect(refused).toBe(0);
		expect(listLocalCharts().length).toBe(0);
		expect(got.length).toBe(38);
	});

	it('主库写不进(配额满):回收站退回删除前,不留两份', ()=>{
		upsertLocalChart({ cid: 'q2', name: '主库满', birth: '1990-01-01 08:00:00' });
		const real = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(k === CHARTS){ throw quotaErr(); }
			return real.call(this, k, v);
		});
		expect(removeLocalChart('q2')).toMatchObject({ persisted: false, reason: 'quota' });
		jest.restoreAllMocks();
		expect(getLocalChart('q2')).toBeTruthy();
		expect(listLocalChartsTrash().map((r)=>r.cid)).not.toContain('q2');
	});

	it('彻底删除时删除日志写不进:回收站条目留着、返回 false;清空回收站返回 -1 且回收站原样', ()=>{
		upsertLocalChart({ cid: 'q3', name: '彻底删不了', birth: '1990-01-01 08:00:00' });
		upsertLocalChart({ cid: 'q4', name: '清空不了', birth: '1990-01-01 08:00:00' });
		removeLocalChart('q3');
		removeLocalChart('q4');
		const real = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(k === LOG){ throw quotaErr(); }
			return real.call(this, k, v);
		});
		expect(purgeLocalChartTrashItem('q3')).toBe(false);
		expect(listLocalChartsTrash().map((r)=>r.cid).sort()).toEqual(['q3', 'q4']);
		expect(clearLocalChartsTrash()).toBe(-1);
		expect(listLocalChartsTrash().map((r)=>r.cid).sort()).toEqual(['q3', 'q4']);
		jest.restoreAllMocks();
		expect(purgeLocalChartTrashItem('q3')).toBe(true);
		expect(log().map((e)=>e.record.cid)).toEqual(['q3']);
	});
});

describe('④ 导入同一 ID:较新的整条胜出', ()=>{
	beforeEach(resetStores);
	const env = (charts)=>({ format: 'horosa-local-charts', version: 1, charts });

	it('本机较新:整条保留本机(不改回旧名,本机后加的键在,更新时间不倒退);预览写「保留本机」', ()=>{
		upsertLocalChart({ cid: 's1', name: '新名', birth: '1990-01-01 09:30:00', pdMethod: 'placidus', memo: '本机备注', updateTime: '2026-10-19 12:00:00', preserveUpdateTime: true });
		const pkg = env([{ cid: 's1', name: '旧名', birth: '1990-01-01 08:00:00', updateTime: '2026-08-01 10:00:00' }]);
		expect(previewLocalChartsBackup(pkg)).toMatchObject({ adds: 0, updates: 0, keptLocal: 1 });
		const r = importLocalChartsBackup(pkg);
		expect(r).toMatchObject({ imported: 0, keptLocal: 1 });
		expect(getLocalChart('s1')).toMatchObject({ name: '新名', birth: '1990-01-01 09:30:00', pdMethod: 'placidus', memo: '本机备注', updateTime: '2026-10-19 12:00:00' });
	});

	it('备份较新:整条替换(本机独有的键不混进来)', ()=>{
		upsertLocalChart({ cid: 's2', name: '本机旧', birth: '1990-01-01 08:00:00', memo: '本机独有', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		const pkg = env([{ cid: 's2', name: '备份新', birth: '1990-01-01 10:00:00', updateTime: '2026-10-01 10:00:00' }]);
		expect(previewLocalChartsBackup(pkg)).toMatchObject({ adds: 0, updates: 1, keptLocal: 0 });
		importLocalChartsBackup(pkg);
		const rec = getLocalChart('s2');
		expect(rec).toMatchObject({ name: '备份新', birth: '1990-01-01 10:00:00', updateTime: '2026-10-01 10:00:00' });
		expect(rec.memo === undefined || rec.memo === null || rec.memo === '').toBe(true);
	});

	it('一样新:保留本机;sameCid=merge 照旧按字段合并(名人库刷新出生数据这类补丁用)', ()=>{
		upsertLocalChart({ cid: 's3', name: '本机', birth: '1990-01-01 08:00:00', memo: 'm', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		importLocalChartsBackup(env([{ cid: 's3', name: '包', birth: '1990-01-01 08:00:00', updateTime: '2026-08-01 10:00:00' }]));
		expect(getLocalChart('s3').name).toBe('本机');
		const patch = env([{ cid: 's3', birth: '1990-01-01 09:00:00', updateTime: '2026-10-19 10:00:00' }]);
		expect(previewLocalChartsBackup(patch, { sameCid: 'merge' })).toMatchObject({ updates: 1 });
		importLocalChartsBackup(patch, { sameCid: 'merge' });
		expect(getLocalChart('s3')).toMatchObject({ name: '本机', memo: 'm', birth: '1990-01-01 09:00:00' });
	});
});

describe('⑤ 健康态', ()=>{
	beforeEach(resetStores);

	it('读到更新版本写的记录:健康态带 newerSchema(事件可能早于横幅挂载)', ()=>{
		window.localStorage.setItem(CHARTS, JSON.stringify([{ cid: 'v9', name: '未来', birth: '1990-01-01 08:00:00', schemaVersion: 9 }]));
		listLocalCharts();
		expect(getLocalChartsStoreHealth().newerSchema).toMatchObject({ found: 9 });
	});
});
