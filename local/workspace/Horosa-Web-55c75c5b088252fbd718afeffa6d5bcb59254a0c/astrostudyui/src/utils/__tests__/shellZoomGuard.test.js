// 壳缩放链守卫:主限天球「时间轴被滚上去/底部露白」四层病理的防复发锁。
// 病理:①layouts 内联 100vh 与 clientHeight 域劈叉(缩放≠1 时差出可平移空间)
// ②direction 页 tabs 内容链无定高(子组件 maxHeight:100% 因包含块 auto 视作 none)
// ③时间轴 pointer capture 期 pointerleave 释放=WebKit autoscroll 复活
// ④缩放注入走 localStorage 跨 origin 断链(URL query 才是确定性通道)。
import fs from 'fs';
import path from 'path';
import { getShellZoom, getLayoutViewportHeight, SHELL_ZOOM_STORAGE_KEY } from '../shellZoom';

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('壳缩放链守卫', () => {
	afterEach(() => {
		try{ window.localStorage.removeItem(SHELL_ZOOM_STORAGE_KEY); }catch(e){ /* ignore */ }
	});

	it('①layouts/app.js 禁 100vh 内联(域劈叉源头;剥注释后断言,注释里的告诫不算)', () => {
		const t = read('layouts/app.js').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
		expect(t.includes('100vh')).toBe(false);
	});

	it('②app.less direction 页 tabs 内容链定高规则在位', () => {
		const t = read('layouts/app.less');
		expect(/\.horosa-direction-page\s*>\s*\.ant-tabs\s*>\s*\.ant-tabs-content-holder\s*>\s*\.ant-tabs-content/.test(t)).toBe(true);
	});

	it('③AstroPDSphere 捕获期忽略 pointerleave + guard 对偶分支在位', () => {
		const sphere = read('components/astro3d/AstroPDSphere.js');
		expect(sphere.includes('handleTimelineLeave')).toBe(true);
		expect(/handleTimelineLeave\(\)\s*\{[^}]*_tlCaptured[^}]*return;/s.test(sphere)).toBe(true);
		const direct = read('components/direction/AstroDirectMain.js');
		expect(direct.includes('this.rootEl.contains(t)')).toBe(true);
	});

	it('④global.js 双源读(URL query 优先)在位', () => {
		const t = read('global.js');
		expect(t.includes('shellZoom=')).toBe(true);
		expect(t.includes("localStorage.getItem('horosa.shell.zoom')")).toBe(true);
	});

	it('getShellZoom:无源缺省 1;键兜底;越界值拒收', () => {
		expect(getShellZoom()).toBe(1);
		window.localStorage.setItem(SHELL_ZOOM_STORAGE_KEY, '0.9');
		expect(getShellZoom()).toBe(0.9);
		window.localStorage.setItem(SHELL_ZOOM_STORAGE_KEY, '-3');
		expect(getShellZoom()).toBe(1);
		window.localStorage.setItem(SHELL_ZOOM_STORAGE_KEY, 'abc');
		expect(getShellZoom()).toBe(1);
	});

	it('getLayoutViewportHeight:1:1 恒等 innerHeight;0.9 时=innerHeight/0.9', () => {
		const ih = window.innerHeight;
		expect(getLayoutViewportHeight()).toBe(Math.round(ih));
		window.localStorage.setItem(SHELL_ZOOM_STORAGE_KEY, '0.9');
		expect(getLayoutViewportHeight()).toBe(Math.round(ih / 0.9));
	});
});
