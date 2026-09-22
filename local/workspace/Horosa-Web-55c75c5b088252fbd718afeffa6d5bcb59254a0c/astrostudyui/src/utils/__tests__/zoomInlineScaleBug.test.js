/**
 * 「内联盒按内容宽×缩放」引擎缺陷探针:jsdom 没这个缺陷(探针恒 false);这里测的是判定与挂 class 的逻辑本身。
 */
import { syncZoomTextBugClass, probeZoomInlineScaleBug, ZOOM_TEXT_BUG_CLASS, __resetZoomTextBugForTests } from '../zoomInlineScaleBug';

describe('zoomInlineScaleBug · 探针 + class 挂载', () => {
	beforeEach(() => { __resetZoomTextBugForTests(); document.documentElement.style.zoom = ''; });
	afterEach(() => { __resetZoomTextBugForTests(); document.documentElement.style.zoom = ''; });

	test('jsdom 探针无信号(不误伤正确引擎)', () => {
		expect(probeZoomInlineScaleBug()).toBe(false);
		expect(syncZoomTextBugClass()).toBe(false);
		expect(document.documentElement.classList.contains(ZOOM_TEXT_BUG_CLASS)).toBe(false);
	});

	test('z=1 时即使探针命中也不挂 class(缺省档零改动)', () => {
		document.documentElement.style.zoom = '1';
		expect(syncZoomTextBugClass(() => true)).toBe(false);
		expect(document.documentElement.classList.contains(ZOOM_TEXT_BUG_CLASS)).toBe(false);
	});

	test('z≠1 且探针命中 → 挂 class;换回 z=1 → 摘掉;同档位不重测', () => {
		document.documentElement.style.zoom = '1.8';
		expect(syncZoomTextBugClass(() => true)).toBe(true);
		expect(document.documentElement.classList.contains(ZOOM_TEXT_BUG_CLASS)).toBe(true);
		// 同档位第二次:不重测(探针返回 false 也保持已挂)
		expect(syncZoomTextBugClass(() => false)).toBe(true);
		document.documentElement.style.zoom = '1';
		expect(syncZoomTextBugClass(() => true)).toBe(false);
		expect(document.documentElement.classList.contains(ZOOM_TEXT_BUG_CLASS)).toBe(false);
	});
});
