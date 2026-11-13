// 3D 星盘「全屏」:桌面端的网页视图不开放元素全屏接口,只调那个接口 = 桌面端双击画布没有任何反应。
// 这里锁住「页内全屏」这条在浏览器与桌面端都成立的路:宿主页收右栏与标题行、画布铺满本页。
const path = require('path');
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');
const { jsxElements } = require('../../../utils/__tests__/helpers/jsxProps');

const SRC = path.resolve(__dirname, '../../..');
const chart = readSource(path.join(SRC, 'components/astro3d/AstroChart3D.js'));
const main = readSource(path.join(SRC, 'components/astro3d/AstroChartMain3D.js'));
const icons = readSource(path.join(SRC, 'components/xq-icons/index.js'));
const less = readSource(path.join(SRC, 'layouts/app.less'));

const block = (sel) => {
	const at = less.indexOf(`${sel} {`);
	return at < 0 ? '' : less.slice(at, less.indexOf('}', at));
};

describe('3D 星盘页内全屏', () => {
	test('双击画布:宿主给了回调就走宿主,且先于元素全屏接口', () => {
		const at = chart.indexOf('doubleClick(');
		const body = chart.slice(at, chart.indexOf('\n\t}\n', at));
		const host = body.indexOf('this.props.onToggleFullscreen()');
		const native = body.indexOf('checkFullScreen()');
		expect(host).toBeGreaterThan(-1);
		expect(native).toBeGreaterThan(host);
		expect(body.slice(host, native)).toMatch(/return;/);
	});

	test('宿主页:回调接给画布、页根带全屏态类、Esc 监听挂卸成对', () => {
		expect(main).toMatch(/onToggleFullscreen=\{this\.toggleImmersive\}/);
		expect(main).toMatch(/this\.state\.immersive \? ' is-immersive' : ''/);
		expect(main).toMatch(/window\.addEventListener\('keydown', this\.onImmersiveKeyDown\)/);
		expect(main).toMatch(/window\.removeEventListener\('keydown', this\.onImmersiveKeyDown\)/);
		// 切换后要让画布按新尺寸重排(宿主尺寸观察之外的兜底)
		const at = main.indexOf('toggleImmersive(){');
		expect(main.slice(at, main.indexOf('\n\t}\n', at))).toMatch(/handleResize\(\)/);
	});

	test('进出入口都在:标题行按钮 + 全屏态右上退出钮(带 Esc 提示)', () => {
		expect(main).toMatch(/iconName="fullscreen"[^>]*onClick=\{this\.toggleImmersive\}/);
		expect(main).toMatch(/className="horosa-3d-immersive-exit"[^>]*onClick=\{this\.toggleImmersive\}/);
		expect(jsxElements(main, 'XQIcon').filter((a) => a.name === 'fullscreenExit').length).toBe(1);
		expect(main).toMatch(/<kbd>Esc<\/kbd>/);
		// 图标必须真实存在(未知名会静默回退成别的图标)
		expect(icons).toMatch(/\n\tfullscreen: \(/);
		expect(icons).toMatch(/\n\tfullscreenExit: \(/);
	});

	test('样式:全屏态收右栏与标题行、单列铺满;退出钮浮在画布右上且高于悬浮信息卡', () => {
		expect(block('.horosa-workspace-shell .horosa-3d-page.is-immersive')).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/);
		expect(less).toMatch(/\.horosa-3d-page\.is-immersive > \.horosa-3d-side,\s*\.horosa-workspace-shell \.horosa-3d-page\.is-immersive \.horosa-3d-stage-title \{\s*display: none;/);
		const exit = block('.horosa-workspace-shell .horosa-3d-immersive-exit');
		expect(exit).toMatch(/position:\s*absolute;/);
		expect(Number((exit.match(/z-index:\s*(\d+)/) || [])[1])).toBeGreaterThan(6);
		// 不靠滚动栏里的 fixed 铺满(桌面端合成层会把它裁在栏内)
		expect(block('.horosa-workspace-shell .horosa-3d-page.is-immersive')).not.toMatch(/position:\s*fixed/);
	});
});
