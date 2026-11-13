// 操作手册合同:带右侧技法栏的页,每个技法一章、一份详细手册;打开帮助停在当前技法;
// 全部手册统一用 HelpBook 外壳(左栏父级菜单 + 右栏单技法)。
// 判据:① 注册表里每份手册都是 HelpBook(Doc.book 存在);② 每个技法栏页签都能按运行时键解析到「它自己的那一章」
// (章节键 = 运行时键,或别名里有它,或「父键.子键」);③ 技法栏的每章正文不少于 MIN_CHARS 字(详细,不是一句话)。
import React from 'react';
import fs from 'fs';

// 手册文件只 import { Component }(生产构建是自动 JSX runtime);jest 走 classic runtime,章节渲染要作用域里有 React —— 与 helpDocsGuard 同法在测试侧补全局
global.React = React;
import path from 'path';
import { AUX_SUBTABS, CNYIBU_SUBTABS, ZERI_SUBTABS, CNTRADITION_SUBTABS } from '../../../constants/SubTabRegistry';
import { EAST_ASIA_TABS } from '../../../utils/eastAsiaSnapshot';
import { ZHUFANG_TABS } from '../../../utils/zhufangArts';
import { XUANSHI_SUBPAGES } from '../../../utils/xuanshiState';
import { TECHNIQUE_HELP_DOCS } from '../techniqueHelpRegistry';
import { bookChapters, resolveChapterKey } from '../HelpBook';
import { helpElementToText } from '../../../utils/aiTools/helpText';

const helpChapterToText = (chapter)=>helpElementToText(chapter.render());   // 单章纯文本(按章量篇幅)

const SRC = path.resolve(__dirname, '..', '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
const MIN_CHARS = 700;

const tabPaneKeys = (rel)=>[...read(rel).matchAll(/TabPane[^>]*key="([A-Za-z0-9]+)"/g)].map((m)=>m[1]);
const shusuanKeys = ()=>{
	const src = read('components/kinastro/KinAstroMain.js');
	const blk = src.slice(src.indexOf("moduleKey === 'shusuan'"), src.indexOf("moduleKey === 'shusuan'") + 900);
	return [...blk.matchAll(/key: '([a-z]+)'/g)].map((m)=>m[1]);
};
const optionalTabKeys = (list)=>(list || []).map((t)=>(typeof t === 'string' ? t : t.key));

// 技法栏:页签键 → 打开帮助时的上下文(ctx)。innerTab 是页内二级技法(东亚 / 诸方 / 玄史这类自管页签)。
const RAILS = [
	{ tab: 'direction', keys: ()=>tabPaneKeys('components/direction/AstroDirectMain.js'), ctx: (k)=>({ currentTab: 'direction', currentSubTab: k }) },
	{ tab: 'auxchart', keys: ()=>optionalTabKeys(AUX_SUBTABS), ctx: (k)=>({ currentTab: 'auxchart', currentSubTab: k }) },
	{ tab: 'cnyibu', keys: ()=>optionalTabKeys(CNYIBU_SUBTABS), ctx: (k)=>({ currentTab: 'cnyibu', currentSubTab: k }) },
	{ tab: 'zeri', keys: ()=>optionalTabKeys(ZERI_SUBTABS), ctx: (k)=>({ currentTab: 'zeri', currentSubTab: k }) },
	{ tab: 'cntradition', keys: ()=>optionalTabKeys(CNTRADITION_SUBTABS), ctx: (k)=>({ currentTab: 'cntradition', currentSubTab: k }) },
	{ tab: 'calendar', keys: ()=>tabPaneKeys('components/calendar/CalendarMain.js'), ctx: (k)=>({ currentTab: 'calendar', currentSubTab: k }) },
	{ tab: 'shusuan', keys: shusuanKeys, ctx: (k)=>({ currentTab: 'shusuan', hostTechnique: k }) },
	{ tab: 'mingother', keys: ()=>['cetian', 'xianqin', 'yizhangjing'], ctx: (k)=>({ currentTab: 'mingother', hostTechnique: k }) },
	{ tab: 'mingother', label: 'mingother/东亚', keys: ()=>optionalTabKeys(EAST_ASIA_TABS), ctx: (k)=>({ currentTab: 'mingother', hostTechnique: 'dongya', innerTab: k }) },
	{ tab: 'mingother', label: 'mingother/诸方', keys: ()=>optionalTabKeys(ZHUFANG_TABS), ctx: (k)=>({ currentTab: 'mingother', hostTechnique: 'zhufang', innerTab: k }) },
	{ tab: 'xuanshi', keys: ()=>optionalTabKeys(XUANSHI_SUBPAGES).filter((k)=>k !== 'overview'), ctx: (k)=>({ currentTab: 'xuanshi', innerTab: k }) },
];

const matches = (chapter, k)=>!!chapter && (chapter.key === k || (chapter.aliases || []).indexOf(k) >= 0 || `${chapter.key}`.endsWith(`.${k}`));

describe('全部手册统一用 HelpBook 外壳', ()=>{
	Object.keys(TECHNIQUE_HELP_DOCS).forEach((tab)=>{
		it(`${tab}`, ()=>{
			const Doc = TECHNIQUE_HELP_DOCS[tab];
			expect(Doc && Doc.book && bookChapters(Doc.book).length > 0).toBe(true);
			expect(`${Doc.book.title}`).toMatch(/ · 操作手册$/);
		});
	});
});

describe('技法栏:每个技法有自己那一章,打开帮助停在它,正文够详细', ()=>{
	RAILS.forEach((rail)=>{
		describe(rail.label || rail.tab, ()=>{
			rail.keys().forEach((k)=>{
				it(`${k}`, ()=>{
					const Doc = TECHNIQUE_HELP_DOCS[rail.tab];
					expect(Doc && Doc.book ? 'book' : 'no-book').toBe('book');
					const key = resolveChapterKey(Doc.book, rail.ctx(k));
					const chapter = bookChapters(Doc.book).find((c)=>c.key === key);
					expect([k, matches(chapter, k)]).toEqual([k, true]);
					const text = helpChapterToText(chapter);
					expect([k, text.length >= MIN_CHARS]).toEqual([k, true]);
				});
			});
		});
	});
});
