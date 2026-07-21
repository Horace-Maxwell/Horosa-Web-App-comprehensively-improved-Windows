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
	it('🔴 L1 是 LRU 而非 FIFO:命中会提升,后续淘汰不误伤热条目(horosa_dedupe_l1_lru_v1)', async () => {
		// 回归:L1 命中路径原本 return 时不重插,而 prune() 按 Map 插入序从头淘汰 = FIFO。
		// 后果是一串后台预取会把用户正在反复访问的那条挤出去,预取自己反而活着 —— 预取覆盖面
		// 从 1 个端点扩到十几个技法之后,这个方向是反的,会主动伤害命中率。
		window.localStorage.setItem('horosa.perf.techniqueCache', '0');  // 关 L2,隔离出 L1 行为
		const bodyOf = (i) => JSON.stringify({ i });
		const mk = (i) => () => Promise.resolve({ i });
		// PERF-R9 Ship 7:L1 上限 80 → 160,本用例的灌入量必须跟着抬到「真的填满」,
		// 否则不发生淘汰、判据退化成恒真(测不出 FIFO/LRU 的差别)。
		for(let i = 0; i < 160; i += 1){         // 填满 L1(MAX_ENTRIES=160)
			// eslint-disable-next-line no-await-in-loop
			await dedupedRequest(URL_ACG, { body: bodyOf(i) }, mk(i));
		}
		// 再访问 0 号 —— 它此刻成为「最近使用」。FIFO 实现下这一步不改变它的淘汰位次。
		await dedupedRequest(URL_ACG, { body: bodyOf(0) }, mk(-1));
		for(let i = 160; i < 175; i += 1){       // 灌 15 条,迫使淘汰
			// eslint-disable-next-line no-await-in-loop
			await dedupedRequest(URL_ACG, { body: bodyOf(i) }, mk(i));
		}
		let recomputed = false;
		const hot = await dedupedRequest(URL_ACG, { body: bodyOf(0) }, () => {
			recomputed = true;
			return Promise.resolve({ i: -2 });
		});
		expect(recomputed).toBe(false);   // 热条目仍在 L1(FIFO 下这里会是 true)
		expect(hot.i).toBe(0);
		window.localStorage.removeItem('horosa.perf.techniqueCache');
	});
	// PERF-R9 Ship 7:L2 上限 48 → 192(预取从「只有 /chart」扩到十几个技法端点后,
	// 48 条连一次完整技法巡览都装不下,预取会把上一个技法的结果挤掉)。此处是容量哨兵,
	// 改上限必须同步改这个数 —— 灌 200 条(> 上限)才验得出淘汰真的发生。
	it('L2 容量 192 上限:LRU 淘汰最旧', async () => {
		const runner = (i) => () => Promise.resolve({ i });
		for(let i = 0; i < 200; i += 1){
			// eslint-disable-next-line no-await-in-loop
			await dedupedRequest(URL_ACG, { body: JSON.stringify({ i }) }, runner(i));
		}
		expect(__dedupeStats().warm).toBeLessThanOrEqual(192);
		expect(__dedupeStats().warm).toBeGreaterThan(0);
	});
});
