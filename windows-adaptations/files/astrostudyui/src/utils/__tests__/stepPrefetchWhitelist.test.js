// horosa_prefetch_runtime_whitelist_v1 金标(PERF-R9 Ship 7)——「白名单是运行时闸,不是注释」。
//
// 病根(本轮之前):任务契约是 {name, run},run 是不可内省的闭包 —— PREFETCH_ALLOWED_PATHS /
// PREFETCH_FORBIDDEN_MARKERS 只是文档 + 一个 jest 快照,submitStepPrefetch 从不看 URL。
// 于是任何登记方都能把【随机起卦 / 取现时 / 流式】端点塞进预取队列而无人察觉;而预取这些
// 端点 = 把随机结果或「此刻」钉死进缓存 = 功能性降级(比慢更糟)。
//
// 本文件钉两层:
//   ① 提交层:声明 path 不在白名单(或命中禁词)的任务【丢弃】,零执行;
//   ② 运行层(纵深防御,因为 path 是自述的):预取作用域内,request.js / chartFetch.js
//      对不合格 URL 直接拒发 —— 「任务谎报 path」也漏不出去。
// 两层的拒绝都累加进 prefetchRefusalCount,故「零泄漏」可被机械断言。
import {
	submitStepPrefetch, __resetStepPrefetch, prefetchRefusalCount,
	isPrefetchPathAllowed, guardPrefetchUrl, isInPrefetchScope, normalizePrefetchPath,
} from '../stepPrefetch';
import request from '../request';
import { fetchChartWithRetry } from '../chartFetch';

// 题面点名的七类:随机骰子 / 地占 / 五兆 / 荆诀 / AI 流式 / 天文馆(取现时) / moira 禁词变体。
// (G6 起 '/qizheng/moira' 精确路径入 PREFETCH_FORBIDDEN_EXEMPT_EXACT —— 物化预取豁免;
//  这里改钉一个非豁免变体,证明禁词对「类」仍然生效、豁免不放大。)
const FORBIDDEN_TASK_PATHS = [
	'/predict/dice',
	'/geomancy/reading',
	'/wuzhao/pan',
	'/jingjue/pan',
	'/aianalysis/stream',
	'/planetarium/state',
	'/qizheng/moirascan',
];

const ROOT = 'http://127.0.0.1:8899';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
	__resetStepPrefetch();
	window.localStorage.removeItem('horosa.perf.stepPrefetch');
});

describe('🔴 第①层:提交即拦 —— 随机/取现时/流式端点零执行', () => {
	test('七类禁入任务全部被丢弃,一个都没跑;拒绝计数 = 任务数', async () => {
		const ran = [];
		const before = prefetchRefusalCount();
		submitStepPrefetch(FORBIDDEN_TASK_PATHS.map((p, i) => ({
			name: `bad${i}`,
			path: p,
			run: () => { ran.push(p); return Promise.resolve(); },
		})));
		await wait(1200);
		expect(ran).toEqual([]);                                   // 零执行
		expect(prefetchRefusalCount() - before).toBe(FORBIDDEN_TASK_PATHS.length);
	});

	test('允许的 /qimen/pan 照跑(闸不是把预取一起关掉)', async () => {
		const ran = [];
		submitStepPrefetch([{
			name: 'qimen',
			path: '/qimen/pan',
			run: () => { ran.push('qimen'); return Promise.resolve(); },
		}]);
		await wait(1200);
		expect(ran).toEqual(['qimen']);
	});

	test('混装一队:合格的跑、不合格的丢(丢弃不影响同队其余任务)', async () => {
		const ran = [];
		const mk = (name, path) => ({ name, path, run: () => { ran.push(name); return Promise.resolve(); } });
		submitStepPrefetch([
			mk('dice', '/predict/dice'),
			mk('qimen', '/qimen/pan'),
			mk('geo', '/geomancy/pan'),
			mk('chart', '/chart'),
		]);
		await wait(1600);
		expect(ran.sort()).toEqual(['chart', 'qimen']);
	});

	test('缺 path / 缺 run 的任务同样丢弃(不抛错 —— 预取是优化不是功能)', async () => {
		const ran = [];
		expect(() => submitStepPrefetch([
			{ name: 'nopath', run: () => { ran.push('nopath'); return Promise.resolve(); } },
			{ name: 'norun', path: '/chart' },
		])).not.toThrow();
		await wait(800);
		expect(ran).toEqual([]);
	});
});

describe('🔴 第②层:纵深防御 —— 任务谎报 path 也漏不出去', () => {
	test('request.js:声明 /qimen/pan 却去发 /predict/dice → 拒发,返回 undefined', async () => {
		const before = prefetchRefusalCount();
		let settled = 'unset';
		submitStepPrefetch([{
			name: 'liar-request',
			path: '/qimen/pan',
			run: () => request(`${ROOT}/predict/dice`, { body: '{}', silent: true })
				.then((v) => { settled = v; }),
		}]);
		await wait(1200);
		expect(settled).toBeUndefined();                     // 没发出去,也没抛给调用方
		expect(prefetchRefusalCount()).toBeGreaterThan(before);
	});

	test('chartFetch.js(kentang 全族的裸 fetch 路径):谎报 path 去发 /wuzhao/pan → 拒发', async () => {
		const before = prefetchRefusalCount();
		let err = null;
		submitStepPrefetch([{
			name: 'liar-chartfetch',
			path: '/qimen/pan',
			run: () => fetchChartWithRetry(`${ROOT}/wuzhao/pan`, { method: 'POST', body: '{}' })
				.catch((e) => { err = e; }),
		}]);
		await wait(1200);
		expect(err).toBeTruthy();
		expect(`${err.message}`).toBe('prefetch.blocked');
		expect(prefetchRefusalCount()).toBeGreaterThan(before);
	});

	test('🔴 零误伤:非预取作用域内,同样的 URL 一律放行且不计数', () => {
		expect(isInPrefetchScope()).toBe(false);
		const before = prefetchRefusalCount();
		FORBIDDEN_TASK_PATHS.forEach((p) => {
			expect(guardPrefetchUrl(`${ROOT}${p}`)).toBe(true);
		});
		expect(prefetchRefusalCount()).toBe(before);
	});
});

describe('🔴 白名单判定本身', () => {
	test('禁词优先于允许前缀;G6 精确豁免只放 /qizheng/moira 本尊,变体仍拦', () => {
		expect(isPrefetchPathAllowed('/qizheng/pan')).toBe(true);
		// G6(horosa_guolao_render_slice_v1):物化预取豁免 —— 归一化后全路径精确等值才放行。
		expect(isPrefetchPathAllowed('/qizheng/moira')).toBe(true);
		expect(isPrefetchPathAllowed(`${ROOT}/qizheng/moira?x=1`)).toBe(true);   // host/query 归一后=本尊
		// 豁免不放大类:任何 moira 变体照旧被禁词拦。
		expect(isPrefetchPathAllowed('/qizheng/moira/extra')).toBe(false);
		expect(isPrefetchPathAllowed('/qizheng/moirascan')).toBe(false);
		expect(isPrefetchPathAllowed('/qizheng/moira2')).toBe(false);
		expect(isPrefetchPathAllowed('/aimoira/pan')).toBe(false);
	});

	test('kentang pan 逐条枚举:允许的在、随机族的不在', () => {
		['/qimen/pan', '/taiyi/pan', '/jinkou/pan', '/shaozi/pan', '/tieban/pan',
			'/fendjing/pan', '/beiji/pan', '/nanji/pan', '/chunzi/pan', '/xianqin/pan',
			'/cetian/pan', '/qizhengkin/pan', '/taixuan/pan', '/shenyishu/pan', '/wangji/pan',
		].forEach((p) => expect(isPrefetchPathAllowed(p)).toBe(true));
		['/geomancy/pan', '/wuzhao/pan', '/jingjue/pan', '/xiaoliuren/pan'].forEach(
			(p) => expect(isPrefetchPathAllowed(p)).toBe(false)
		);
	});

	test('本轮新接线的端点都在白名单内(接了线却被自己的闸拦住=白接)', () => {
		[
			'/ziwei/birth', '/india/chart', '/predict/pd', '/germany/midpoint',
			'/nongli/time', '/jieqi/year', '/liureng/gods', '/chart',
		].forEach((p) => expect(isPrefetchPathAllowed(p)).toBe(true));
	});

	test('带 host / query 的完整 URL 与裸 path 判定一致', () => {
		expect(normalizePrefetchPath(`${ROOT}/qimen/pan?x=1#y`)).toBe('/qimen/pan');
		expect(isPrefetchPathAllowed(`${ROOT}/qimen/pan?x=1`)).toBe(true);
		expect(isPrefetchPathAllowed(`${ROOT}/predict/dice?x=1`)).toBe(false);
	});

	test('空/畸形输入一律不放行(fail-closed)', () => {
		[undefined, null, '', '/', 'nonsense'].forEach(
			(v) => expect(isPrefetchPathAllowed(v)).toBe(false)
		);
	});
});
