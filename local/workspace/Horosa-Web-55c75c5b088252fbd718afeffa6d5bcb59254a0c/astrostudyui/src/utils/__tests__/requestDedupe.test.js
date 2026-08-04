// 计算请求去重层单测:白名单判定 / in-flight 共享 / TTL 命中 / 失败不缓存 / 深拷贝隔离。
import { dedupeEligible, dedupedRequest, __clearDedupe, __dedupeStats } from '../requestDedupe';

const URL_ACG = 'http://127.0.0.1:9999/location/acg';
const BODY_A = JSON.stringify({ date: '1990/06/22', mode: 'mundo' });

beforeEach(() => {
	__clearDedupe();
	window.localStorage.removeItem('horosa.perf.requestDedupe');
});

describe('dedupeEligible 白名单', () => {
	it('计算端点 + JSON body → 命中', () => {
		expect(dedupeEligible(URL_ACG, { body: BODY_A })).toBe(true);
		expect(dedupeEligible('http://x/chart', { body: BODY_A })).toBe(true);
		expect(dedupeEligible('http://x/predict/pd', { body: BODY_A })).toBe(true);
		expect(dedupeEligible('http://x/astroextra/analysis', { body: BODY_A })).toBe(true);
	});
	it('随机/写/流式/无 body/非 POST → 直通', () => {
		expect(dedupeEligible('http://x/predict/dice', { body: BODY_A })).toBe(false);
		expect(dedupeEligible('http://x/user/save', { body: BODY_A })).toBe(false);
		expect(dedupeEligible('http://x/aianalysis/stream', { body: BODY_A })).toBe(false);
		expect(dedupeEligible(URL_ACG, {})).toBe(false);
		expect(dedupeEligible(URL_ACG, { body: BODY_A, method: 'GET' })).toBe(false);
	});
	it('perfFlag=0 → 全部直通(kill-switch)', () => {
		window.localStorage.setItem('horosa.perf.requestDedupe', '0');
		expect(dedupeEligible(URL_ACG, { body: BODY_A })).toBe(false);
	});
});

describe('dedupedRequest 行为', () => {
	it('in-flight:并发同参只执行一次 runner,各自拿深拷贝', async () => {
		let calls = 0;
		let release;
		const gate = new Promise((r) => { release = r; });
		const runner = () => { calls += 1; return gate.then(() => ({ Result: { v: 1 } })); };
		const p1 = dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		const p2 = dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		expect(__dedupeStats().inflight).toBe(1);
		release();
		const [a, b] = await Promise.all([p1, p2]);
		expect(calls).toBe(1);
		expect(a).toEqual(b);
		expect(a).not.toBe(b);           // 深拷贝隔离
		a.Result.v = 999;
		expect(b.Result.v).toBe(1);      // 互不污染
	});
	it('TTL 命中:完成后同参不再执行 runner', async () => {
		let calls = 0;
		const runner = () => { calls += 1; return Promise.resolve({ Result: { v: calls } }); };
		const a = await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		const b = await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		expect(calls).toBe(1);
		expect(b.Result.v).toBe(1);
		expect(a).not.toBe(b);
	});
	it('不同参数各自执行', async () => {
		let calls = 0;
		const runner = () => { calls += 1; return Promise.resolve({ ok: calls }); };
		await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		await dedupedRequest(URL_ACG, { body: JSON.stringify({ date: 'x' }) }, runner);
		expect(calls).toBe(2);
	});
	it('失败不缓存:reject 后重试重新执行', async () => {
		let calls = 0;
		const runner = () => {
			calls += 1;
			return calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve({ ok: true });
		};
		await expect(dedupedRequest(URL_ACG, { body: BODY_A }, runner)).rejects.toThrow('boom');
		const b = await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		expect(calls).toBe(2);
		expect(b.ok).toBe(true);
	});
	it('🔴 吞错型失败(resolve undefined)不入 L1/L2 缓存:透传后下次重新执行(防投毒)', async () => {
		// request() 网络层失败会吞错 resolve undefined(非 reject);若存进 done(30s)/warm(10min),
		// 后端重启窗口内一次失败会把该参数组合投毒 10 分钟——同参请求全部秒回 undefined。
		let calls = 0;
		const runner = () => {
			calls += 1;
			return calls === 1 ? Promise.resolve(undefined) : Promise.resolve({ ok: true });
		};
		const a = await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		expect(a).toBeUndefined();                    // 原样透传,交调用方守卫
		expect(__dedupeStats().done).toBe(0);         // L1 未被投毒
		expect(__dedupeStats().warm).toBe(0);         // L2 未被投毒
		const b = await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		expect(calls).toBe(2);                        // 第二次真执行 = 未命中毒缓存
		expect(b.ok).toBe(true);
	});
});

describe('L2 技法结果缓存(horosa.perf.techniqueCache)', () => {
	const { __ageEntries } = require('../requestDedupe');
	beforeEach(() => {
		window.localStorage.removeItem('horosa.perf.techniqueCache');
	});
	it('L1 过期后 L2 命中(来回拨参数场景),并回填 L1', async () => {
		let calls = 0;
		const runner = () => { calls += 1; return Promise.resolve({ ok: calls }); };
		await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		__ageEntries(60 * 1000);            // L1(30s)过期,L2(10min)存续
		const b = await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		expect(calls).toBe(1);              // 未重发网络
		expect(b.ok).toBe(1);
		expect(__dedupeStats().done).toBe(1); // 回填 L1
	});
	it('L2 也过期(>10min)则重新执行', async () => {
		let calls = 0;
		const runner = () => { calls += 1; return Promise.resolve({ ok: calls }); };
		await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		__ageEntries(11 * 60 * 1000);
		const b = await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		expect(calls).toBe(2);
		expect(b.ok).toBe(2);
	});
	it('kill-switch:techniqueCache=0 时 L1 过期即重发', async () => {
		window.localStorage.setItem('horosa.perf.techniqueCache', '0');
		let calls = 0;
		const runner = () => { calls += 1; return Promise.resolve({ ok: calls }); };
		await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		__ageEntries(60 * 1000);
		await dedupedRequest(URL_ACG, { body: BODY_A }, runner);
		expect(calls).toBe(2);
		window.localStorage.removeItem('horosa.perf.techniqueCache');
	});
	// R4-B1 扩容(落账):48→192 —— 技法族全量接入预取后,48 条连一次完整技法巡览都装不下。
	it('L2 容量 192 上限:LRU 淘汰最旧', async () => {
		const runner = (i) => () => Promise.resolve({ i });
		for(let i = 0; i < 200; i += 1){
			// eslint-disable-next-line no-await-in-loop
			await dedupedRequest(URL_ACG, { body: JSON.stringify({ i }) }, runner(i));
		}
		expect(__dedupeStats().warm).toBeLessThanOrEqual(192);
	});
	// horosa_dedupe_l1_lru_v1(R4-B1):命中重插=真 LRU。热条目反复命中时,一串新写入
	// 不得把它挤出去(旧 FIFO 语义下热条目先死、预取自己活着 —— 方向反了)。
	it('🔴 L1 真 LRU:反复命中的热条目在容量满时存活,冷条目先淘汰', async () => {
		const runner = (v) => () => Promise.resolve({ v });
		const hotBody = JSON.stringify({ hot: 1 });
		let hotRuns = 0;
		await dedupedRequest(URL_ACG, { body: hotBody }, () => { hotRuns += 1; return Promise.resolve({ hot: 1 }); });
		// 写入 159 条冷条目,期间每 40 条访问一次热条目(命中即重插 → 永远在队尾侧)
		for(let i = 0; i < 159; i += 1){
			// eslint-disable-next-line no-await-in-loop
			await dedupedRequest(URL_ACG, { body: JSON.stringify({ cold: i }) }, runner(i));
			if(i % 40 === 0){
				// eslint-disable-next-line no-await-in-loop
				await dedupedRequest(URL_ACG, { body: hotBody }, () => { hotRuns += 1; return Promise.resolve({ hot: 1 }); });
			}
		}
		// 再访热条目:仍应命中(runner 不再执行)——旧 FIFO 语义下它早被 160 条写入挤出
		await dedupedRequest(URL_ACG, { body: hotBody }, () => { hotRuns += 1; return Promise.resolve({ hot: 1 }); });
		expect(hotRuns).toBe(1);
	});
});
