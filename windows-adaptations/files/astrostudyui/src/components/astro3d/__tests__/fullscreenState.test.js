/**
 * horosa_fullscreen_state_v1 —— 3D 星盘/阅读器全屏状态机回归钉(GitHub issue #68)。
 *
 * ## 版本史(为什么这个测试长这样)
 * v3.9.1(Windows 先行):我方修了三处硬伤 —— ①checkFullScreen 误读 `fullscreenEnabled`
 * (能力位,Electron 恒真)而非状态位;②无 fullscreenchange 订阅 ⇒ Esc 退出后标志卡 true,
 * 全屏再也进不去;③尺寸按 `window.screen.*` 猜。当时以 helper/AstroChart3D 两补丁承载。
 * v3.9.4(上游收编,#49 退役):Mac 以**自有符号形**重实现同三处修(注释直接引用 Issue#68),
 * 并扩到古籍阅读器 BookReader —— 两补丁退役,本测试改写为**钉上游实现形**:
 * 行为面(checkFullScreen 状态位语义,仍是导出函数)+ 源扫描面(订阅数组/实测盒子)。
 * 任何一针红 = 上游把这套修回退/改坏了,Windows 用户将复现 issue #68。
 */
import fs from 'fs';
import path from 'path';
import { checkFullScreen } from '../../../utils/helper';

const UI = path.join(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(UI, rel), 'utf8');

describe('horosa_fullscreen_state_v1 · 全屏判据(行为面,issue #68 ①)', () => {
	afterEach(() => {
		delete document.fullscreenElement;
		delete document.webkitFullscreenElement;
		delete document.webkitIsFullScreen;
		delete document.fullscreenEnabled;
	});

	it('非全屏时必须返回 false —— 即使能力位 fullscreenEnabled 为 true(原 bug:恒真)', () => {
		Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
		expect(checkFullScreen()).toBe(false);
	});

	it('fullscreenElement 在 ⇒ true(标准状态位)', () => {
		Object.defineProperty(document, 'fullscreenElement', { value: {}, configurable: true });
		expect(checkFullScreen()).toBe(true);
	});

	it('webkitFullscreenElement 在 ⇒ true(旧 WebKit 状态位)', () => {
		Object.defineProperty(document, 'webkitFullscreenElement', { value: {}, configurable: true });
		expect(checkFullScreen()).toBe(true);
	});
});

describe('horosa_fullscreen_state_v1 · 订阅与实测(源扫描面,issue #68 ②③)', () => {
	const EVTS = "['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']";

	it('AstroChart3D:四事件订阅成对(挂载 add / 卸载 remove)—— 缺订阅 = Esc 后全屏永进不去', () => {
		const src = read('components/astro3d/AstroChart3D.js');
		const n = src.split(EVTS).length - 1;
		expect(n).toBeGreaterThanOrEqual(2);   // add 一处 + remove 一处
		expect(src.includes('getBoundingClientRect')).toBe(true);   // 实测盒子,不再 screen.* 猜
	});

	it('BookReader:同款订阅成对(上游 v3.9.4 扩展面,一并钉住)', () => {
		const src = read('components/reader/BookReader.js');
		const n = src.split(EVTS).length - 1;
		expect(n).toBeGreaterThanOrEqual(2);
	});

	it('checkFullScreen 函数体内不得回潮能力位判据(负锚:只认真代码形态)', () => {
		const src = read('utils/helper.js');
		const i = src.indexOf('export function checkFullScreen()');
		expect(i).toBeGreaterThan(0);
		const body = src.slice(i, src.indexOf('\n}', i));
		expect(body.includes('fullscreenEnabled')).toBe(false);
		expect(body.includes('fullscreenElement')).toBe(true);
	});
});
