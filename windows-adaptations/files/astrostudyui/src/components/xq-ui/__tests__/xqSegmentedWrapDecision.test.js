/**
 * horosa_segmented_wrap_hysteresis_v1 —— XQSegmented 折行判据「与自身结果脱钩 + 滞回」的回归守卫(Windows-ahead;建议上游化 Mac)。
 *
 * ## 事故(GitHub issue #84,v3.11.1 风水页「三合水法左栏砂水栏内容不断闪现、无法选中」)
 * useSegmentedWrap 的 need = Σ(文字宽 + padding + 2),padding 读的是 getComputedStyle(**当前态**);
 * 而 `.is-wrapped` 自己就把 padding 从 10px 改成 6px。真机实抓「消砂取「我」」三项(以向为我 / 以坐山为我 / 赖公(人盘中针)):
 *   未折行态 need 285 > avail 264 → 判「折」→ padding 变 6 → need 261 < 264 → 判「不折」→ padding 回 10 → need 285 → 再判「折」…
 * 每帧翻一次(3 秒内 class 翻 176 次、滑块 span 增删 88 次),整列跟着重渲,任何点击都落不下去。
 *
 * ## 修(两刀,都不改「放得下时一字不变」)
 *   ① need 只按**未折行态**的 padding 算(首测必是未折行态,缓存在 ref;折行态用缓存)——判据与自身结果脱钩;
 *   ② 决策带滞回:折→不折要留 4px 余量(decideSegmentedWrap 导出,jsdom 量不到布局,只能钉判据函数 + 源码形)。
 */
import fs from 'fs';
import path from 'path';
import { decideSegmentedWrap } from '../index';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'index.js'), 'utf8');

describe('decideSegmentedWrap(need, avail, wrapped)', () => {
	test('真机事故向量:未折行态 need 285 vs avail 264 —— 无论当前折不折,结论都是「折」(判据不再随 padding 变小而反转)', () => {
		expect(decideSegmentedWrap(285, 264, false)).toBe(true);
		expect(decideSegmentedWrap(285, 264, true)).toBe(true);
	});
	test('滞回:已折行时 need 落在 (avail-4, avail] 仍保持折行;明显放得下才展开', () => {
		expect(decideSegmentedWrap(261, 264, true)).toBe(true);   // 264-4=260 < 261 → 保持
		expect(decideSegmentedWrap(260, 264, true)).toBe(false);  // 恰在余量边界外 → 展开
		expect(decideSegmentedWrap(200, 264, true)).toBe(false);
	});
	test('未折行时只在 need > avail 才折;相等不折(「放得下时一字不变」)', () => {
		expect(decideSegmentedWrap(264, 264, false)).toBe(false);
		expect(decideSegmentedWrap(265, 264, false)).toBe(true);
		expect(decideSegmentedWrap(108, 264, false)).toBe(false);
	});
	test('容器量不到(avail ≤ 0)恒不折(测量不可用时回到现状)', () => {
		expect(decideSegmentedWrap(999, 0, false)).toBe(false);
		expect(decideSegmentedWrap(999, -1, true)).toBe(false);
	});
	test('单调性:need 越大越倾向折,avail 越大越倾向不折(两个方向各扫一遍)', () => {
		for (let need = 100; need <= 400; need += 5) {
			const a = decideSegmentedWrap(need, 264, false);
			const b = decideSegmentedWrap(need + 5, 264, false);
			expect(!(a && !b)).toBe(true);
		}
		for (let avail = 100; avail <= 400; avail += 5) {
			const a = decideSegmentedWrap(264, avail, true);
			const b = decideSegmentedWrap(264, avail + 5, true);
			expect(!(!a && b)).toBe(true);
		}
	});
});

describe('源码形(hook 必须真的按未折行态 padding 算 need)', () => {
	test('useSegmentedWrap 缓存未折行态 padding 并交给 decideSegmentedWrap', () => {
		expect(SRC).toContain('const unwrappedPads = React.useRef(null)');
		expect(SRC).toContain("const isWrappedNow = el.classList.contains('is-wrapped')");
		expect(SRC).toContain('if(!isWrappedNow){ unwrappedPads.current = pads; }');
		expect(SRC).toContain('decideSegmentedWrap(need, avail, w)');
	});
	test('负锚:旧写法(need 直接累加当前态 padding)不得回潮', () => {
		expect(SRC).not.toContain('need += tw + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + 2;');
		expect(SRC).not.toContain('const next = avail > 0 && need > avail;');
	});
});
