// 🔴 [S4] 写失败诚实语义 · quota 故障注入金标 —— 本轮最重的静默丢数据修复的行为锁。
//
// 此前 writeRaw 全部失败分支 return true:upsert 的 throw 死代码、五处「保存失败」Modal
// 永不弹,配额写满时 UI 报成功、数据只在内存、重启即丢;且 quota 终败 enableMemoryFallback
// 把「储存满」永久误判「储存坏」。storageQuotaGuard 的注错从未打在 localcharts/localcases
// 写路径上 —— 正是该 bug 能长期存活的测试盲区,本文件补上。
//
// 注错范式:jest.spyOn(Storage.prototype,'setItem') 仅对目标键抛;jest.resetModules() 每例
// 取全新模块实例(复位内存降级标志/降级事件一次性标志)。
const CHARTS_KEY = 'horosa.localCharts.v1';

function quotaError(){
	const e = new Error('The quota has been exceeded.');
	e.name = 'QuotaExceededError';
	return e;
}

function freshCharts(){
	jest.resetModules();
	// eslint-disable-next-line global-require
	return require('../localcharts');
}

const REC = { cid: 'local-q-1', name: '注错甲', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true };

describe('[S4] quota 故障注入 · 写失败如实上报', ()=>{
	afterEach(()=>{
		jest.restoreAllMocks();
		window.localStorage.clear();
	});

	test('🔴 恒 quota:upsert 抛 saveErrorCode、列表不含该条(诚实)、解除后再存成功(不粘死)', ()=>{
		const mod = freshCharts();
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, val){
			if(key === CHARTS_KEY){ throw quotaError(); }
		});
		expect(()=>mod.upsertLocalChart({ ...REC })).toThrow('local.chart.save.failed');
		// 诚实:抛错当次记录不在列表(重读真储存;对照此前「弹成功但重启丢」)
		expect(mod.listLocalCharts().find((r)=>r.cid === 'local-q-1')).toBeUndefined();
		// 不粘死:「储存满」≠「储存坏」,解除注错后无需重启即可再存
		spy.mockRestore();
		expect(()=>mod.upsertLocalChart({ ...REC })).not.toThrow();
		expect(mod.listLocalCharts().find((r)=>r.cid === 'local-q-1')).toBeTruthy();
		expect(mod.getLocalChartsStoreHealth().mode).toBe('persistent');
	});

	test('quota 一次后放行:告急清理两档全清并重试成功,不抛', ()=>{
		const mod = freshCharts();
		window.localStorage.setItem('horosa.ai.snapshot.astro.v1', 'snap');
		window.localStorage.setItem('horosa.ai.snapshot.module.v1.ziwei', 's2');
		window.localStorage.setItem('horosa.localcalc.nongli.v1', 'calc');
		const real = Storage.prototype.setItem;
		let first = true;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, val){
			if(key === CHARTS_KEY && first){
				first = false;
				throw quotaError();
			}
			return real.call(this, key, val);
		});
		expect(()=>mod.upsertLocalChart({ ...REC })).not.toThrow();
		expect(window.localStorage.getItem('horosa.ai.snapshot.astro.v1')).toBe(null);
		expect(window.localStorage.getItem('horosa.ai.snapshot.module.v1.ziwei')).toBe(null);
		expect(window.localStorage.getItem('horosa.localcalc.nongli.v1')).toBe(null);
		expect(mod.listLocalCharts().find((r)=>r.cid === 'local-q-1')).toBeTruthy();
	});

	test('储存根坏(getItem 抛非 quota):不抛、降级事件恰一次、health.mode=memory、会话内可用', ()=>{
		const mod = freshCharts();
		const events = [];
		const handler = (e)=>events.push(e.detail);
		window.addEventListener('horosa.localRecordStore.degraded', handler);
		jest.spyOn(Storage.prototype, 'getItem').mockImplementation(()=>{ throw new Error('SecurityError'); });
		expect(()=>mod.upsertLocalChart({ ...REC })).not.toThrow();
		expect(()=>mod.upsertLocalChart({ ...REC, name: '注错甲2' })).not.toThrow();
		expect(mod.getLocalChartsStoreHealth().mode).toBe('memory');
		// 会话内内存可用
		expect(mod.listLocalCharts().find((r)=>r.cid === 'local-q-1')).toBeTruthy();
		expect(events.length).toBe(1);
		expect(events[0].storageKey).toBe(CHARTS_KEY);
		window.removeEventListener('horosa.localRecordStore.degraded', handler);
	});

	test('remove 恒 quota:永不抛(deleteChart 无 try/catch,开抛=dva 未捕获异常,留档纪律)', ()=>{
		const mod = freshCharts();
		mod.upsertLocalChart({ ...REC });
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key){
			if(key === CHARTS_KEY){ throw quotaError(); }
		});
		expect(()=>mod.removeLocalChart('local-q-1')).not.toThrow();
	});

	test('import 中途 quota:逐条隔离,{imported,failed} 如实、异常不外逸', ()=>{
		const mod = freshCharts();
		const real = Storage.prototype.setItem;
		let calls = 0;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, val){
			if(key === CHARTS_KEY){
				calls += 1;
				if(calls >= 2){ throw quotaError(); }
			}
			return real.call(this, key, val);
		});
		const result = mod.importLocalChartsBackup({
			format: 'horosa-local-charts',
			version: 1,
			charts: [
				{ cid: 'local-i-1', name: '导入甲', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00' },
				{ cid: 'local-i-2', name: '导入乙', birth: '1991-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-02 10:00:00' },
			],
		});
		expect(result.imported).toBe(1);
		expect(result.failed).toBe(1);
	});
});
