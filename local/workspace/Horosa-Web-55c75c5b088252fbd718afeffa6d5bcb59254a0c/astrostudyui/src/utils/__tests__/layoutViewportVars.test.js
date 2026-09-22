/**
 * 布局视口 CSS 变量(--horosa-lvw / --horosa-lvh)发布器 —— 全站 vh/vw 替身的行为闸。
 *
 * 病理(2026-09-17 用户在新机 Tahoe APP 实报):标准化 zoom 引擎下 vh/vw 按物理视口解析再被缩放,
 * 缩小留白 / 放大溢出。修法 = 用 fixed 探针实测布局视口,发布成 CSS 变量;样式写 calc(N * var(--horosa-lvh, 1vh))。
 * 本测试锁三件事:① 量得到就写 1% 的 px 值;② 量不到就撤变量(样式回落 vh/vw);③ 安装幂等、resize 与
 * 声明缩放变化都会重发布,且自身 setProperty 不自激。
 */
jest.mock('../zoomDomain', () => {
	const real = jest.requireActual('../zoomDomain');
	return {
		...real,
		measureLayoutViewport: jest.fn(),
		getDeclaredZoom: jest.fn(() => 1),
	};
});

const zd = require('../zoomDomain');
const mod = require('../layoutViewportVars');

function rootVar(name){
	return document.documentElement.style.getPropertyValue(name);
}

beforeEach(() => {
	mod.__resetLayoutViewportVarsForTests();
	document.documentElement.style.removeProperty(mod.LAYOUT_VW_VAR);
	document.documentElement.style.removeProperty(mod.LAYOUT_VH_VAR);
	zd.measureLayoutViewport.mockReset();
	zd.getDeclaredZoom.mockReset();
	zd.getDeclaredZoom.mockReturnValue(1);
});

test('量得到布局视口 → 发布 1% 的 px 值(1750×1125 → 17.5px / 11.25px)', () => {
	zd.measureLayoutViewport.mockReturnValue({ width: 1750, height: 1125 });
	const vp = mod.publishLayoutViewportVars();
	expect(vp).toEqual({ width: 1750, height: 1125 });
	expect(rootVar(mod.LAYOUT_VW_VAR)).toBe('17.5px');
	expect(rootVar(mod.LAYOUT_VH_VAR)).toBe('11.25px');
});

test('量不到(null / 0)→ 撤下变量,样式回落 var() 的 1vh/1vw 兜底', () => {
	zd.measureLayoutViewport.mockReturnValue({ width: 1400, height: 900 });
	mod.publishLayoutViewportVars();
	expect(rootVar(mod.LAYOUT_VH_VAR)).toBe('9px');
	zd.measureLayoutViewport.mockReturnValue(null);
	expect(mod.publishLayoutViewportVars()).toBeNull();
	expect(rootVar(mod.LAYOUT_VW_VAR)).toBe('');
	expect(rootVar(mod.LAYOUT_VH_VAR)).toBe('');
	zd.measureLayoutViewport.mockReturnValue({ width: 0, height: 0 });
	expect(mod.publishLayoutViewportVars()).toEqual({ width: 0, height: 0 });
	expect(rootVar(mod.LAYOUT_VW_VAR)).toBe('');
});

test('安装幂等:两次 install 只挂一套监听;resize 触发重发布(rAF 合帧)', () => {
	zd.measureLayoutViewport.mockReturnValue({ width: 1400, height: 900 });
	const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(); return 1; });
	const addSpy = jest.spyOn(window, 'addEventListener');
	const off = mod.installLayoutViewportVars();
	const off2 = mod.installLayoutViewportVars();
	const resizeListeners = addSpy.mock.calls.filter((c) => c[0] === 'resize').length;
	expect(resizeListeners).toBe(1);
	expect(rootVar(mod.LAYOUT_VW_VAR)).toBe('14px');
	zd.measureLayoutViewport.mockReturnValue({ width: 1750, height: 1125 });
	window.dispatchEvent(new Event('resize'));
	expect(rootVar(mod.LAYOUT_VW_VAR)).toBe('17.5px');
	expect(rootVar(mod.LAYOUT_VH_VAR)).toBe('11.25px');
	off(); off2();
	addSpy.mockRestore();
	rafSpy.mockRestore();
});

test('声明缩放变了(documentElement style 变更)→ 重发布;自身 setProperty 不自激', async () => {
	zd.measureLayoutViewport.mockReturnValue({ width: 1400, height: 900 });
	const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(); return 1; });
	const off = mod.installLayoutViewportVars();
	expect(zd.measureLayoutViewport).toHaveBeenCalled();
	// jsdom 会在测试进行中补发一次 window load(readyState 已 complete)→ 发布器按设计重量一次;先让它落定再计数。
	await new Promise((r) => setTimeout(r, 0));
	zd.measureLayoutViewport.mockClear();
	// style 属性变了但声明缩放未变(自身 setProperty / 其它样式写入)→ 不重量(防自激)
	document.documentElement.style.color = 'red';
	await new Promise((r) => setTimeout(r, 0));
	expect(zd.measureLayoutViewport).toHaveBeenCalledTimes(0);
	// 壳改了 zoom(声明缩放变了)→ 重量并发布新值
	zd.getDeclaredZoom.mockReturnValue(0.8);
	zd.measureLayoutViewport.mockReturnValue({ width: 1750, height: 1125 });
	document.documentElement.style.color = 'blue';
	await new Promise((r) => setTimeout(r, 0));
	expect(zd.measureLayoutViewport).toHaveBeenCalledTimes(1);
	expect(rootVar(mod.LAYOUT_VH_VAR)).toBe('11.25px');
	document.documentElement.style.color = '';
	off();
	rafSpy.mockRestore();
});
