// 卜·其他 帮助文档:HelpBook 结构 + 逐章渲染冒烟 + 地占章内容锚点 + 禁词洁净。
//
// 🔴 三个坑决定了本文件的写法:
//   ① 帮助文档是**惰性挂载的抽屉**,JSX 写坏只在用户点开帮助那一刻才炸 —— 故须有渲染冒烟。
//   ② HelpBook 只构建当前那一章:整篇 render() 不等于构造了全部章节 —— 故本文件逐章各调一次 render,
//      把冒烟覆盖面显式补回来(否则十五章里十四章失守)。
//   ③ 内容锚点仍查源文而非渲染串:确定性高,且能同时守住「文案里不得混进 HTML 标签」。
//      地占章 = 源文里 `function chGeomancy(` 到下一个顶层 `function` 之间。
import React from 'react';
import fs from 'fs';
import { renderToStaticMarkup } from 'react-dom/server';
import CnyibuHelpDoc, { HELP_BOOK } from '../CnyibuHelpDoc';
import { bookChapters } from '../HelpBook';
import { CNYIBU_SUBTABS } from '../../../constants/SubTabRegistry';

const SRC = fs.readFileSync(require.resolve('../CnyibuHelpDoc'), 'utf8');
const GEO = (() => {
	const i = SRC.indexOf('\nfunction chGeomancy(');
	const j = SRC.indexOf('\nfunction ', i + 1);
	return SRC.slice(i, j);
})();

describe('卜·其他 帮助文档 · 结构与地占章', () => {
	test('整篇渲染不抛且非空(默认落在总览)', () => {
		let html = '';
		expect(() => { html = renderToStaticMarkup(<CnyibuHelpDoc />); }).not.toThrow();
		expect(html.length).toBeGreaterThan(2000);
		expect(html).toContain('其他术数 · 操作手册');
	});

	test('🔴 十五章逐一可渲染且非空壳(HelpBook 惰性构建后必须逐章冒烟;塔罗章已迁 TarotHelpDoc)', () => {
		const thin = [];
		bookChapters(HELP_BOOK).forEach((c) => {
			expect([c.key, typeof c.render]).toEqual([c.key, 'function']);
			let html = '';
			expect(() => { html = renderToStaticMarkup(<div>{c.render()}</div>); }).not.toThrow();
			if (html.length < 2000) { thin.push(`${c.key}:${html.length}`); }
		});
		expect(thin).toEqual([]);
	});

	test('章节齐备:总览 + 十四子技法,键唯一且与运行时子页签键一一对应(塔罗已升一级)', () => {
		const chapters = bookChapters(HELP_BOOK);
		expect(chapters.length).toBe(15);
		const keys = chapters.map((c) => c.key);
		expect(new Set(keys).size).toBe(15);
		expect(keys[0]).toBe('overview');
		expect(keys.filter((k) => k !== 'overview').sort()).toEqual([...CNYIBU_SUBTABS].sort());
		chapters.forEach((c) => {
			expect([c.key, typeof c.label === 'string' && c.label.length > 0]).toEqual([c.key, true]);
		});
	});

	test('地占章确已切出且体量合理(改动不至于把整章削掉)', () => {
		expect(GEO.length).toBeGreaterThan(14000);
		expect(GEO.split('\n').length).toBeGreaterThan(200);
	});

	test('传本对齐十四新章的标题逐条在册', () => {
		['基础：四元素与四品质', '十六图形的对应与关系', '起卦诸法', '占卜有效性五则',
			'法庭三角与时间流', '地占三角（四组）', '得地（卦与盾位的元素强弱）',
			'寻源法与元素法', '精准相位与成败（盘式）', '入宫三式与上升四取法',
			'行星地占盘', '希腊点（地占式）', '盾位十六宫含义', '解卦次第'].forEach((k) => {
			expect(GEO).toContain(k);
		});
	});

	test('两条结构性事实与三处边界警示已载明(免读者当 bug 报)', () => {
		expect(GEO).toContain('这是结构必然而非漏算');        // 吉吉吉 不可达
		expect(GEO).toContain('阴爻不可寻');                   // 法官阴爻非断路
		expect(GEO).toContain('不要与法庭三角、地占三角合用');  // 盾位十六宫边界
		expect(GEO).toContain('皆非吉凶判断');                 // 元素法非吉凶
		expect(GEO).toContain('与解卦无关');                   // 关系六式边界
	});

	test('🔴 文案里不得混进 HTML 标签(误写即原样显示给用户)', () => {
		const bad = [];
		SRC.split('\n').forEach((line, i) => {
			const m = line.match(/'((?:[^'\\]|\\.)*)'/g) || [];
			m.forEach((s) => {
				if (/<\/?(?:td|tr|div|span|p|b|em|strong|ul|li)\b/.test(s)) { bad.push(`${i + 1}: ${s.slice(0, 60)}`); }
			});
		});
		expect(bad).toEqual([]);
	});



	test('React 已显式导入(否则抽屉一开即 ReferenceError)', () => {
		expect(/^import React,? ?\{? ?\{? ?Component/m.test(SRC) || /^import React from 'react'/m.test(SRC)).toBe(true);
	});
});
