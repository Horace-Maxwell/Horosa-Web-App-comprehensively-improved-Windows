// chartCloneLite(WP-H 拷贝减层)金标 —— 守两条命门:
// ① miss 发起方拿网络【原件】(省一次全盘深拷贝),但缓存存的是独立克隆 —— 发起方
//    随后的就地改写(fetchByFields 会写 Result.chartId/params.name)绝不能渗进缓存;
// ② 命中方各拿私有克隆,改自己的不脏别人的。
// ⚠️ 本优化绝不可改成「冻结共享引用」:fetchByFields 就地写 Result,冻结即炸。
jest.mock('../../utils/request');
import request from '../../utils/request';
import { fetchChart } from '../astro';

const mkRsp = () => ({ Result: { params: { name: '' }, chart: { deep: { n: 1 } } } });

beforeEach(() => {
	jest.resetAllMocks();
	window.localStorage.removeItem('horosa.perf.chartCloneLite');
});

describe('🔴 miss 路径:发起方拿原件,缓存是独立克隆', () => {
	test('发起方引用 === 网络原件(零额外拷贝)', async () => {
		const rsp = mkRsp();
		request.mockResolvedValue(rsp);
		const got = await fetchChart({ t: `miss-${Date.now()}-1` });
		expect(got).toBe(rsp);            // 原件直达 —— 这就是省掉的那次全盘深拷贝
	});

	test('🔴 发起方就地改写(chartId/params.name 契约)不脏缓存:二次命中拿到的是干净盘', async () => {
		const key = { t: `miss-${Date.now()}-2` };
		request.mockResolvedValue(mkRsp());
		const first = await fetchChart(key);
		first.Result.chartId = 'DIRTY';                 // 模拟 fetchByFields 的就地写
		first.Result.params.name = '张三';
		const second = await fetchChart(key);           // 命中 chartMem
		expect(second.Result.chartId).toBeUndefined();  // 缓存没被脏写
		expect(second.Result.params.name).toBe('');
		expect(request).toHaveBeenCalledTimes(1);       // 确实是缓存命中,非重取
	});

	test('命中方之间互不串写', async () => {
		const key = { t: `miss-${Date.now()}-3` };
		request.mockResolvedValue(mkRsp());
		await fetchChart(key);
		const a = await fetchChart(key);
		const b = await fetchChart(key);
		a.Result.chart.deep.n = 999;
		expect(b.Result.chart.deep.n).toBe(1);
	});
});

describe('kill-switch:关 = 旧行为(发起方也拿克隆)', () => {
	test('flag=0 时发起方引用 ≠ 网络原件,内容 deep-equal', async () => {
		window.localStorage.setItem('horosa.perf.chartCloneLite', '0');
		const rsp = mkRsp();
		request.mockResolvedValue(rsp);
		const got = await fetchChart({ t: `off-${Date.now()}` });
		expect(got).not.toBe(rsp);
		expect(got).toEqual(rsp);
	});
});

describe('克隆等价性:structuredClone 与 JSON 往返对 /chart 形状同果', () => {
	// ⚠️ jsdom 测试环境没有 structuredClone(真浏览器 WKWebView/Chrome 都有)——
	//    故源码必须带 typeof 守卫(此处静态断言钉死),等价性仅在环境可用时验。
	test('源码带 typeof structuredClone 守卫(jsdom/老环境安全落回 JSON)', () => {
		const fs = require('fs');
		const path = require('path');
		const src = fs.readFileSync(path.join(__dirname, '..', 'astro.js'), 'utf8');
		expect(src).toMatch(/typeof structuredClone === 'function'/);
	});

	(typeof structuredClone === 'function' ? test : test.skip)('嵌套对象/数组/数值/字符串/null 逐值相等', () => {
		const sample = { a: [1, 'x', null, { b: { c: [2.5, false] } }], d: null };
		const viaJson = JSON.parse(JSON.stringify(sample));
		const viaSC = structuredClone(sample);
		expect(viaSC).toEqual(viaJson);
	});
});
