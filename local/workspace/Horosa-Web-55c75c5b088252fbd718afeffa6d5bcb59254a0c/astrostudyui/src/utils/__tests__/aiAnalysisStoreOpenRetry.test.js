// AI 工作区库打开失败不再整次会话钉死成内存模式(与全仓另外十二处同形缓存「失败不缓存、下次重试」同口径)。
// 此前 openDb 一次失败(WebKit IndexedDB 进程偶发 UnknownError / 磁盘瞬时满 / 开机抢锁)就把 null 缓存到本次运行结束:
// 之后新建的对话、报告、任务全部只在内存,退出就没了。
// 现在:版本问题(VersionError,库被更新版本升过)重试无益,照旧钉死;其它失败本次走内存回退并记健康态,
// 退避后下一次访问重新打开;打开成功先把内存回退期间新建的条目并回库里(只补库里没有的 id),再解除健康态。
if(typeof window.indexedDB !== 'undefined'){
	throw new Error('前提失效:jsdom 已定义 indexedDB,fake-indexeddb 的装载顺序需重审');
}
require('fake-indexeddb/auto');
const FIDB = require('fake-indexeddb');

function loadStore(){
	let mod = null;
	jest.isolateModules(()=>{ mod = require('../aiAnalysisStore'); });
	return mod;
}
// 前 n 次 open 失败(给定错误名),之后交给真的 fake-indexeddb
function flakyFactory(failTimes, errName){
	const real = new FIDB.IDBFactory();
	let calls = 0;
	return {
		real,
		get calls(){ return calls; },
		open(...args){
			calls += 1;
			if(calls <= failTimes){
				const req = {};
				setTimeout(()=>{
					const e = new Error(`${errName} (simulated)`);
					e.name = errName;
					req.error = e;
					if(typeof req.onerror === 'function'){ req.onerror(); }
				}, 0);
				return req;
			}
			return real.open(...args);
		},
		deleteDatabase(...args){ return real.deleteDatabase(...args); },
	};
}
let nowSpy = null;
let clock = 1700000000000;
beforeEach(()=>{ clock = 1700000000000; nowSpy = jest.spyOn(Date, 'now').mockImplementation(()=>clock); });
afterEach(()=>{ if(nowSpy){ nowSpy.mockRestore(); } window.indexedDB = undefined; });

describe('🔴 打开失败(非版本问题):退避后重试,内存期新建的并回库里', ()=>{
	test('第一次失败 → 内存回退 + 健康态可见;退避期内不反复打开;过了退避期重新打开成功 → 条目进库、健康态解除', async ()=>{
		const f = flakyFactory(1, 'UnknownError');
		window.indexedDB = f;
		const S = loadStore();
		const events = [];
		const h = (e)=>events.push(e.detail);
		window.addEventListener(S.AI_STORE_DEGRADED_EVENT, h);
		await S.putStoreRecord(S.AI_ANALYSIS_STORES.conversations, { id: 'conv-mem', title: '内存期新建' });
		expect(S.getAiStoreHealth()).toMatchObject({ degraded: true, reason: 'open-failed', retrying: true });
		expect(f.calls).toBe(1);
		// 退避期内:不再去开库(仍走内存),内存里的照样读得到
		expect((await S.listStoreRecords(S.AI_ANALYSIS_STORES.conversations)).map((x)=>x.id)).toEqual(['conv-mem']);
		expect(f.calls).toBe(1);
		// 过了退避期:下一次访问重新打开
		clock += 60 * 1000;
		const list = await S.listStoreRecords(S.AI_ANALYSIS_STORES.conversations);
		expect(f.calls).toBe(2);
		expect(list.map((x)=>x.id)).toEqual(['conv-mem']);
		expect(S.getAiStoreHealth()).toMatchObject({ degraded: false, retrying: false });
		window.removeEventListener(S.AI_STORE_DEGRADED_EVENT, h);
		expect(events.map((e)=>e.degraded)).toEqual([true, false]);   // 一次降级、一次恢复(不刷屏)
		// 真的进了库:换一个新模块实例直接读库
		window.indexedDB = f.real;
		const S2 = loadStore();
		expect((await S2.listStoreRecords(S2.AI_ANALYSIS_STORES.conversations)).map((x)=>x.id)).toEqual(['conv-mem']);
	});
	test('并回只补库里没有的 id:库里已有的同 id 不被内存期的缺省值盖掉', async ()=>{
		const f = flakyFactory(1, 'UnknownError');
		// 先在真库里放一条
		window.indexedDB = f.real;
		const S0 = loadStore();
		await S0.putStoreRecord(S0.AI_ANALYSIS_STORES.conversations, { id: 'conv-x', title: '库里的真数据' });
		window.indexedDB = f;
		const S = loadStore();
		await S.putStoreRecord(S.AI_ANALYSIS_STORES.conversations, { id: 'conv-x', title: '内存期重建的' });
		await S.putStoreRecord(S.AI_ANALYSIS_STORES.conversations, { id: 'conv-y', title: '内存期新建' });
		clock += 60 * 1000;
		const list = await S.listStoreRecords(S.AI_ANALYSIS_STORES.conversations);
		const byId = Object.fromEntries(list.map((x)=>[x.id, x.title]));
		expect(byId).toEqual({ 'conv-x': '库里的真数据', 'conv-y': '内存期新建' });
	});
	test('连续失败:退避加长,健康态一直可见、只派一次事件', async ()=>{
		const f = flakyFactory(3, 'UnknownError');
		window.indexedDB = f;
		const S = loadStore();
		let n = 0;
		const h = ()=>{ n += 1; };
		window.addEventListener(S.AI_STORE_DEGRADED_EVENT, h);
		await S.listStoreRecords(S.AI_ANALYSIS_STORES.conversations);
		clock += 600;    // 第一档退避 0.5s 已过
		await S.listStoreRecords(S.AI_ANALYSIS_STORES.conversations);
		expect(f.calls).toBe(2);
		clock += 600;    // 第二档退避 1s 还没过
		await S.listStoreRecords(S.AI_ANALYSIS_STORES.conversations);
		expect(f.calls).toBe(2);
		clock += 600;
		await S.listStoreRecords(S.AI_ANALYSIS_STORES.conversations);
		expect(f.calls).toBe(3);
		window.removeEventListener(S.AI_STORE_DEGRADED_EVENT, h);
		expect(S.getAiStoreHealth().degraded).toBe(true);
		expect(n).toBe(1);
	});
});

describe('版本问题照旧钉死(重试无益)', ()=>{
	test('VersionError → 之后一直内存模式,不再去开库', async ()=>{
		const f = flakyFactory(99, 'VersionError');
		window.indexedDB = f;
		const S = loadStore();
		await S.listStoreRecords(S.AI_ANALYSIS_STORES.conversations);
		clock += 10 * 60 * 1000;
		await S.listStoreRecords(S.AI_ANALYSIS_STORES.conversations);
		expect(f.calls).toBe(1);
		expect(S.getAiStoreHealth()).toMatchObject({ degraded: true, reason: 'version', retrying: false });
	});
});
