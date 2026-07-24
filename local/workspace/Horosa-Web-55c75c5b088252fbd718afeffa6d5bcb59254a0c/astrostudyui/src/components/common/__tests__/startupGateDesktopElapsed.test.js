// horosa_startupgate_desktop_elapsed_v1 契约守卫(Windows 桌面壳温启用时行):
// 1) 无 window.horosaDesktop(Mac/网页)= 死分支,渲染不含用时行 —— 零降级铁证;
// 2) 桌面壳 + startupUx → t=0 即显示「已用时 x.x 秒 ・ 以往约 y.y 秒」,且锚到壳层 runtimeStartedAtMs
//    (首帧就应显示 pre-nav 已消耗的秒数,而不是从 0.0 起跳);
// 3) startupUx:false(HOROSA_LOADING_UX=0 kill-switch)→ 整行退场;
// 4) 桥抛错 → 安全回退,渲染不炸。
// 改 StartupGate 桌面分支请连本测试一起改——契约即设计文档。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StartupGate from '../StartupGate';

const LINE = '已用时';

describe('StartupGate 桌面壳用时行契约', () => {
	afterEach(() => {
		try { delete window.horosaDesktop; } catch (e) { window.horosaDesktop = undefined; }
	});

	test('无桌面桥(Mac/网页)= 死分支:不渲染用时行', () => {
		const html = renderToStaticMarkup(<StartupGate />);
		expect(html).not.toContain(LINE);
	});

	test('桌面壳 + startupUx → 渲染用时行,并锚到壳层起点(首帧非 0.0)', () => {
		window.horosaDesktop = {
			getBootstrapConfig: () => ({
				startupUx: true,
				runtimeStartedAtMs: Date.now() - 3200,
				expectedTotalMs: 4200,
			}),
		};
		const html = renderToStaticMarkup(<StartupGate />);
		expect(html).toContain(LINE);
		expect(html).toContain('以往约 4.2 秒');
		const m = html.match(/已用时 (\d+\.\d) 秒/);
		expect(m).toBeTruthy();
		expect(parseFloat(m[1])).toBeGreaterThanOrEqual(3.0);
	});

	test('expectedTotalMs 缺失 → 只显示已用时,不显示「以往约」', () => {
		window.horosaDesktop = {
			getBootstrapConfig: () => ({ startupUx: true, runtimeStartedAtMs: Date.now() }),
		};
		const html = renderToStaticMarkup(<StartupGate />);
		expect(html).toContain(LINE);
		expect(html).not.toContain('以往约');
	});

	test('startupUx:false(HOROSA_LOADING_UX=0)→ 整行退场', () => {
		window.horosaDesktop = {
			getBootstrapConfig: () => ({ startupUx: false, runtimeStartedAtMs: Date.now(), expectedTotalMs: 4200 }),
		};
		const html = renderToStaticMarkup(<StartupGate />);
		expect(html).not.toContain(LINE);
	});

	test('桥抛错 → 安全回退为无行,渲染不炸', () => {
		window.horosaDesktop = { getBootstrapConfig: () => { throw new Error('boom'); } };
		expect(() => renderToStaticMarkup(<StartupGate />)).not.toThrow();
		expect(renderToStaticMarkup(<StartupGate />)).not.toContain(LINE);
	});
});
