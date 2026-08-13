// 卜·其他 帮助文档:两层页签结构 + 逐技法渲染冒烟 + 地占章内容锚点 + 禁词洁净。
//
// 🔴 三个坑决定了本文件的写法:
//   ① 帮助文档是**惰性挂载的抽屉**,JSX 写坏只在用户点开帮助那一刻才炸 —— 故须有渲染冒烟。
//   ② 改两层页签后,正文改由 groups[].items[].render **按需**构建:整篇 render() 只构造
//      当前所选那一项。旧写法「渲染整篇即等于构造了全部章节」**不再成立** —— 故本文件
//      改为逐技法各调一次 render 方法,把冒烟覆盖面显式补回来(否则十五章里十四章失守)。
//   ③ 内容锚点仍查源文而非渲染串:确定性高,且能同时守住「文案里不得混进 HTML 标签」。
import React from 'react';
import fs from 'fs';
import { renderToStaticMarkup } from 'react-dom/server';
import CnyibuHelpDoc from '../CnyibuHelpDoc';

const SRC = fs.readFileSync(require.resolve('../CnyibuHelpDoc'), 'utf8');
const GEO = (() => {
	const i = SRC.indexOf('\trenderGeomancy(){');
	const j = SRC.indexOf('\trenderGuice(){', i);
	return SRC.slice(i, j);
})();

// 十五子技法 + 总览,逐一对应一个 render 方法(顺序照 CNYIBU_SUBTABS 之外的可读顺序)
const CHAPTERS = ['Overview', 'Suzhan', 'Jinkou', 'Xiaoliuren', 'Wuzhao', 'Taixuan', 'Jingjue', 'Lingqi',
	'Tongshefa', 'Huangji', 'Guice', 'Xiaochengtu', 'Feigong', 'Shenyishu', 'Geomancy', 'Tarot'];

describe('卜·其他 帮助文档 · 结构与地占章', () => {
	test('整篇渲染不抛且非空(默认落在总览)', () => {
		let html = '';
		expect(() => { html = renderToStaticMarkup(<CnyibuHelpDoc />); }).not.toThrow();
		expect(html.length).toBeGreaterThan(2000);
		expect(html).toContain('其他术数 · 操作手册');
	});

	test('🔴 十六章逐一可渲染且非空壳(惰性构建后必须逐章冒烟)', () => {
		const inst = new CnyibuHelpDoc({});
		const thin = [];
		CHAPTERS.forEach((name) => {
			const fn = inst[`render${name}`];
			expect([name, typeof fn]).toEqual([name, 'function']);
			let html = '';
			expect(() => { html = renderToStaticMarkup(<div>{fn.call(inst)}</div>); }).not.toThrow();
			if (html.length < 600) { thin.push(`${name}:${html.length}`); }
		});
		expect(thin).toEqual([]);
	});

	test('两层页签配置齐备:四大类共十六项,键唯一且与 render 方法一一对应', () => {
		const inst = new CnyibuHelpDoc({});
		const groups = renderToStaticMarkup.length >= 0 ? inst.render().props.children[1].props.groups : null;
		expect(Array.isArray(groups)).toBe(true);
		expect(groups.length).toBe(4);
		const items = groups.reduce((acc, g) => acc.concat(g.items), []);
		expect(items.length).toBe(16);
		expect(new Set(items.map((it) => it.key)).size).toBe(16);
		items.forEach((it) => {
			expect([it.key, typeof it.render]).toEqual([it.key, 'function']);
			expect([it.key, typeof it.label === 'string' && it.label.length > 0]).toEqual([it.key, true]);
		});
	});

	test('地占章确已切出且体量合理(改动不至于把整章削掉)', () => {
		// 现况约 16.9k 字符 / 258 行;阈值留余量,只防「整章被削掉」这一类事故
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
		GEO.split('\n').forEach((line, i) => {
			const m = line.match(/'((?:[^'\\]|\\.)*)'/g) || [];
			m.forEach((s) => {
				if (/<\/?(?:td|tr|div|span|p|b|em|strong|ul|li)\b/.test(s)) { bad.push(`${i + 1}: ${s.slice(0, 60)}`); }
			});
		});
		expect(bad).toEqual([]);
	});

	// 🔴 禁词表本身写着一串来源人名/项目名 —— 这些字样即便出现在「断言其不出现」的位置,
	// 也仍然是把来源写进了仓库。故整段包进私有块:private 侧照常严格守,同步到公开仓时被剥离。


	test('React 已显式导入(否则抽屉一开即 ReferenceError)', () => {
		expect(/^import React,? ?\{? ?\{? ?Component/m.test(SRC) || /^import React from 'react'/m.test(SRC)).toBe(true);
	});
});
