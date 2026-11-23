// 系统提示条宿主:整站一个固定定位的列,几条提示按语气层级自上而下排(服务中断 → 本地存储 → 多实例),各自不再自带
// 固定定位外壳(此前三条各自 fixed + 写死离顶距离,条高一变就互相压住);宿主层级低于弹窗遮罩。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SystemNoticeHost, SystemNotice, SystemNoticeButton } from '../SystemNotice';

const fs = require('fs');
const path = require('path');
const { jsxNodes } = require('../../../utils/__tests__/helpers/jsxProps');   // 按 AST 认元素与外层

describe('系统提示条宿主', ()=>{
	it('宿主里的提示条只渲染条本身(不再各自一层 fixed 外壳),按层级排次序,警告语气报 alert', ()=>{
		const html = renderToStaticMarkup(
			<SystemNoticeHost>
				<SystemNotice tone="info" layer="under"><span>多实例</span><SystemNoticeButton>知道了</SystemNoticeButton></SystemNotice>
				<SystemNotice tone="warn" layer="notice"><span>服务中断</span></SystemNotice>
			</SystemNoticeHost>,
		);
		expect((html.match(/horosa-notice-host/g) || []).length).toBe(1);
		expect(html).toMatch(/class="horosa-notice-bar is-info" style="order:3" role="status"/);
		expect(html).toMatch(/class="horosa-notice-bar is-warn" style="order:1" role="alert"/);
		expect(html).not.toMatch(/margin-top/);
	});
	it('不在宿主里(单独渲染)时自带外壳,照样能显示', ()=>{
		const html = renderToStaticMarkup(<SystemNotice tone="info"><span>x</span></SystemNotice>);
		expect(html).toMatch(/horosa-notice-host is-standalone/);
	});
	it('宿主层级低于 antd 弹窗遮罩(1000);三条横幅都挂在宿主里;横幅文案不再用 emoji 当图标', ()=>{
		const SRC = path.resolve(__dirname, '..', '..', '..');
		const base = fs.readFileSync(path.join(SRC, 'layouts/app/01-base.less'), 'utf8');
		const z = Number((/--horosa-z-notice:\s*(\d+)/.exec(base) || [])[1]);
		expect(z).toBeGreaterThan(0);
		expect(z).toBeLessThan(1000);
		const app = fs.readFileSync(path.join(SRC, 'layouts/app.js'), 'utf8');
		expect(jsxNodes(app, 'SystemNoticeHost').length).toBe(1);
		['ServiceStatusBanner', 'LocalStoreHealthBanner', 'MultiInstanceNotice'].forEach((name)=>{
			const nodes = jsxNodes(app, name);
			expect([name, nodes.length, nodes[0] && nodes[0].ancestors[0]]).toEqual([name, 1, 'SystemNoticeHost']);
		});
		['ServiceStatusBanner.js', 'LocalStoreHealthBanner.js', 'MultiInstanceNotice.js'].forEach((f)=>{
			const t = fs.readFileSync(path.join(SRC, 'components/common', f), 'utf8');
			expect([f, /[ℹ⚠💾🔧🔍]/u.test(t)]).toEqual([f, false]);
			expect([f, /offsetTop=/.test(t)]).toEqual([f, false]);
		});
	});
});
