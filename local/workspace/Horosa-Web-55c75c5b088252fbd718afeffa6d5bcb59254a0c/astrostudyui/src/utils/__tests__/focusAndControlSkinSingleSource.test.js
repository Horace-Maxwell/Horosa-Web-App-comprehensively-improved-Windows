// 键盘焦点环与基础控件外观各只有一处定义:
//   · 焦点环 = 01-base 的令牌(主题金 2px、内收 2px)+ 一条全站 :focus-visible;各处显式的环只许引用令牌;
//     页签焦点不再用 12% 透明的金(看不见);竖排页签条每个页签只有一个 Tab 停靠点;
//   · 按钮 = xq-ui 统一件一张皮(实底 + 主题边线 + 控件圆角 + 尺寸档),各页不再各写一份带暗色字面量的 !important 覆盖;
//     危险按钮显危险色;两字按钮不自动插空格。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const fs = require('fs');
const path = require('path');
const { jsxElements } = require('./helpers/jsxProps');   // 按 AST 认元素属性

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
function walk(dir, out, re){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ if(e.name !== '__tests__' && !e.name.startsWith('.umi')){ walk(p, out, re); } }
		else if(re.test(e.name)){ out.push(p); }
	});
	return out;
}

describe('焦点环单一口径', ()=>{
	it('令牌 + 全站一条 :focus-visible;页签焦点令牌不再是 12% 透明的金', ()=>{
		const base = read('layouts/app/01-base.less');
		expect(base).toMatch(/--horosa-focus-ring: var\(--horosa-accent\);/);
		expect(base).toMatch(/--horosa-focus-outline: 2px solid var\(--horosa-focus-ring\);/);
		expect(base).toMatch(/--horosa-focus-offset: -2px;/);
		expect(base).toMatch(/:root :focus-visible \{\n\s*outline: var\(--horosa-focus-outline\);\n\s*outline-offset: var\(--horosa-focus-offset\);/);
		expect(base).not.toMatch(/--horosa-tab-focus-ring: var\(--horosa-cyan-soft\)/);
	});
	it('显式写环的地方都引用令牌(不再各写 2px solid 主题色 + 各自偏移)', ()=>{
		const bad = [];
		walk(SRC, [], /\.less$/).forEach((f)=>{
			const t = fs.readFileSync(f, 'utf8');
			const m = t.match(/:focus-visible[^{]*\{[^}]*outline:\s*2px solid var\(--horosa-(?:accent|tab-focus-ring)[^}]*\}/g);
			if(m){ bad.push(`${path.relative(SRC, f)} × ${m.length}`); }
		});
		expect(bad).toEqual([]);
	});
	it('竖排页签条:外层只收点击(role=presentation、不可聚焦),停靠点只有内层 role=tab', ()=>{
		const { XQTabs } = require('../../components/xq-ui');
		const { TabPane } = require('antd').Tabs;
		const html = renderToStaticMarkup(
			<XQTabs tabPosition="right" activeKey="a">
				<TabPane tab="甲" key="a">一</TabPane>
				<TabPane tab="乙" key="b">二</TabPane>
			</XQTabs>,
		);
		const tabs = html.match(/<div data-node-key="[ab]"[^>]*>/g) || [];
		expect(tabs.length).toBe(2);
		tabs.forEach((t)=>{
			expect(t).toMatch(/role="presentation"/);
			expect(t).not.toMatch(/tabindex/i);
		});
		expect((html.match(/role="tab"[^>]*tabindex="0"/g) || []).length).toBe(2);
	});
	it('地点选择:点击直接挂在触发按钮上,不再外包一层可聚焦的 span', ()=>{
		const GeoCoordModal = require('../../components/amap/GeoCoordModal').default;
		const html = renderToStaticMarkup(<GeoCoordModal onOk={()=>{}}><button type="button" className="t">地点</button></GeoCoordModal>);
		expect(html).toMatch(/^<span><button type="button" class="t">地点<\/button>/);
		expect(html).not.toMatch(/role="button"/);
	});
});

describe('按钮一张皮', ()=>{
	it('统一件:实底 + 控件圆角 + 尺寸档;危险按钮显危险色', ()=>{
		const c = read('components/xq-ui/styles/controls.less');
		const btn = /\.xq-button\.ant-btn,\n\s*\.xq-icon-button\.ant-btn \{([^}]*)\}/.exec(c);
		expect(btn).toBeTruthy();
		expect(btn[1]).toMatch(/border-radius: var\(--horosa-control-radius\);/);
		expect(btn[1]).toMatch(/background: var\(--horosa-surface-solid\);/);
		expect(btn[1]).toMatch(/height: var\(--horosa-control-height\);/);
		expect(c).toMatch(/\.ant-btn-dangerous:not\(\[disabled\]\):not\(\.ant-btn-primary\) \{\n\s*border-color: var\(--horosa-danger\);\n\s*color: var\(--horosa-danger\);/);
		const base = read('layouts/app/01-base.less');
		['--horosa-control-height-xs: 28px', '--horosa-control-height-sm: 30px', '--horosa-control-height-lg: 40px', '--horosa-control-radius: 6px'].forEach((t)=>expect(base).toContain(t));
	});
	it('各页不再各写一份带暗色字面量 / !important 的按钮皮', ()=>{
		const bad = [];
		walk(path.join(SRC, 'layouts'), [], /\.less$/).forEach((f)=>{
			const t = fs.readFileSync(f, 'utf8');
			const m = t.match(/redesign \.ant-btn \{\n\s*min-height: 34px;\n\s*border-color: rgba\(215, 173, 105, 0\.18\) !important;/g);
			if(m){ bad.push(path.relative(SRC, f)); }
			if(/\) \.ant-btn \{\n\s*border-color: rgba\(215, 173, 105, 0\.18\);\n\s*border-radius: 6px;\n\s*background: #090b0e;/.test(t)){ bad.push(`${path.relative(SRC, f)}(页面名单)`); }
		});
		expect(bad).toEqual([]);
	});
	it('两字按钮不自动插空格(全站 ConfigProvider)', ()=>{
		const providers = jsxElements(read('layouts/index.js'), 'ConfigProvider');
		expect(providers.length).toBe(1);
		expect([providers[0].locale, providers[0].autoInsertSpaceInButton]).toEqual(['zhCN', 'false']);
	});
});
