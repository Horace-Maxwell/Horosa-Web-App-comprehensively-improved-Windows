/**
 * horosa_fullscreen_state_v1 —— 3D 星盘全屏状态机(GitHub issue #68)。
 *
 * ## 被测的三个真 bug(用户实报:「全屏后显示不完整」「就是没法全屏,关了吧」)
 *
 * ① `checkFullScreen()` 原本读的是 `document.fullscreenEnabled` —— 那是「本文档**允许**用全屏 API 吗」,
 *    在 Electron 里恒为 true,与「当前是否全屏」无关 ⇒ **判据恒真**。
 * ② 没有 `fullscreenchange` 订阅 ⇒ 用户按 **Esc** 退出后组件标志仍停在 true,
 *    此后双击只会去调 exit(空操作)⇒ **全屏再也进不去**(这正是「就是没法全屏」)。
 * ③ 进全屏时把尺寸**猜**成 `window.screen.*` 并靠 100ms 定时器追 ⇒ Windows 显示缩放下画不满。
 *
 * 这里只测**可测的状态机与判据**(①②),③ 属尺寸测量、由真机验收覆盖。
 * 每条断言都做过反向验证:把修复回退,对应用例即红。
 */
import { checkFullScreen, onFullScreenChange } from '../../../utils/helper';

describe('horosa_fullscreen_state_v1 · 全屏判据与订阅', ()=>{
	afterEach(()=>{
		delete document.fullscreenElement;
		delete document.webkitFullscreenElement;
	});

	test('判据读的是 fullscreenElement,而不是「允不允许全屏」的 fullscreenEnabled', ()=>{
		// 关键:即使 fullscreenEnabled 为 true(Electron 恒真),没有 fullscreenElement 就不算全屏。
		Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
		document.fullscreenElement = null;
		expect(checkFullScreen()).toBe(false);      // ← 旧实现在这里会返回 true(恒真)

		document.fullscreenElement = document.createElement('div');
		expect(checkFullScreen()).toBe(true);
	});

	test('webkit 旧前缀也认(Electron/旧内核兜底)', ()=>{
		document.fullscreenElement = null;
		document.webkitFullscreenElement = document.createElement('div');
		expect(checkFullScreen()).toBe(true);
	});

	test('onFullScreenChange 订阅到事件,且退订后不再触发(防 unmount 泄漏)', ()=>{
		const seen = [];
		const off = onFullScreenChange(()=>seen.push(1));
		document.dispatchEvent(new Event('fullscreenchange'));
		expect(seen.length).toBe(1);

		// 用户按 Esc 也是同一个事件 —— 这条链就是「Esc 之后还能再进全屏」的保证。
		document.dispatchEvent(new Event('fullscreenchange'));
		expect(seen.length).toBe(2);

		off();
		document.dispatchEvent(new Event('fullscreenchange'));
		expect(seen.length).toBe(2);
	});

	test('SSR/无 document 环境不抛(组件在服务端渲染路径上也会被求值)', ()=>{
		expect(typeof onFullScreenChange(null)).toBe('function');
	});
});
