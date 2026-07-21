/**
 * 盘面「隐藏期数据更新 → 切回 tab 不重画(表新盘旧)」根治的两道防线金标(FL-20260712-5):
 * 1) watchChartSvgResize:svg 尺寸变化(含 0→非0)必触发 redraw(rAF 合并),detach 后不再触发;
 *    无 ResizeObserver 环境静默 no-op(退化为现状,绝不 throw)。
 * 2) 失败泊车 parkLoadFailure/loadParked:load 失败绝不把 key 记成「已完成」;同 key 窗口期内
 *    不自动重试(防 didUpdate→load→catch 死循环),新 key 立即放行,成功后 clear。
 * 这两条是「每一个盘的表格显示数据和盘中数据严格吻合」的结构性保障,回归=用户可见事故。
 */
import { watchChartSvgResize } from '../chartDrawGuard';
import { parkLoadFailure, clearLoadFailure, loadParked, LOAD_RETRY_PARK_MS } from '../../components/astro/AstroExtraCommon';

describe('watchChartSvgResize(可见性感知重画)', () => {
	const origRO = global.ResizeObserver;
	const origRaf = global.requestAnimationFrame;
	let observed;
	let lastInstance;

	class FakeResizeObserver {
		constructor(cb){
			this.cb = cb;
			this.targets = [];
			lastInstance = this;
		}
		observe(t){ this.targets.push(t); observed.push(t); }
		disconnect(){ this.targets = []; this.disconnected = true; }
	}

	beforeEach(() => {
		observed = [];
		lastInstance = null;
		global.ResizeObserver = FakeResizeObserver;
		// rAF 同步执行,便于断言合并语义
		global.requestAnimationFrame = (cb) => { cb(); return 1; };
	});
	afterEach(() => {
		global.ResizeObserver = origRO;
		global.requestAnimationFrame = origRaf;
		document.body.innerHTML = '';
	});

	test('svg 尺寸变化触发 redraw;detach 后不再触发', () => {
		document.body.innerHTML = '<svg id="svgTestA"></svg>';
		const calls = [];
		const detach = watchChartSvgResize('svgTestA', () => calls.push(1));
		expect(observed.length).toBe(1);
		// 模拟 tab 隐藏→显示(0→非0)那次 RO 回调
		lastInstance.cb([]);
		expect(calls.length).toBe(1);
		lastInstance.cb([]);
		expect(calls.length).toBe(2);
		detach();
		expect(lastInstance.disconnected).toBe(true);
	});

	test('redraw throw 不上抛(下一次真实更新仍可画)', () => {
		document.body.innerHTML = '<svg id="svgTestB"></svg>';
		watchChartSvgResize('svgTestB', () => { throw new Error('draw boom'); });
		expect(() => lastInstance.cb([])).not.toThrow();
	});

	test('无 ResizeObserver / 无节点 → no-op 且绝不 throw', () => {
		delete global.ResizeObserver;
		expect(() => watchChartSvgResize('svgTestC', () => {})()).not.toThrow();
		global.ResizeObserver = FakeResizeObserver;
		// 节点不存在
		expect(() => watchChartSvgResize('svgNotExist', () => {})()).not.toThrow();
		// 参数残缺
		expect(() => watchChartSvgResize(null, null)()).not.toThrow();
	});
});

describe('失败泊车(load 失败绝不记 key 为已完成)', () => {
	test('同 key 窗口期内泊车,新 key 放行,clear 复位', () => {
		const inst = {};
		expect(loadParked(inst, 'k1')).toBe(false);
		parkLoadFailure(inst, 'k1');
		expect(loadParked(inst, 'k1')).toBe(true);          // 同 key:窗口期内不自动重试
		expect(loadParked(inst, 'k2')).toBe(false);         // 新 key(改日期/换盘):立即放行
		clearLoadFailure(inst);
		expect(loadParked(inst, 'k1')).toBe(false);         // 成功后清除
	});

	test('窗口期过后自动放行(重试语义)', () => {
		const inst = {};
		parkLoadFailure(inst, 'k1');
		inst._loadFailAt = Date.now() - LOAD_RETRY_PARK_MS - 1;
		expect(loadParked(inst, 'k1')).toBe(false);
	});

	test('空 key 恒不泊车', () => {
		const inst = {};
		parkLoadFailure(inst, '');
		expect(loadParked(inst, '')).toBe(false);
	});
});
