// 帮助文档护栏:结构 + 保密 + 注册表完整性。
//
// 为什么需要:help/ 目录此前零专属测试 —— 手册可以写错、可以泄漏内部标识、
// 新增技法页可以忘记登记手册,全都没有任何自动判据。逐页补全手册的工程里
// 每轮都要人工 grep,漏一次就进产物。本文件把三类判据做成可执行护栏。
//
// 渲染口径:class 组件直调 render()(不挂 DOM)—— 手册是纯展示组件,无副作用、
// 无 props 依赖;避开 antd Tabs 的 DOM 依赖,jsdom 下也稳。
import React from 'react';
import fs from 'fs';
import path from 'path';

// 手册组件只 `import { Component } from 'react'`(webpack 自动 JSX runtime 下够用),
// 而 jest 走 classic runtime 需要作用域里有 React → 直调 render() 会 'React is not defined'。
// 纯文档任务不许改被测组件,故在测试侧补全局(不影响生产构建)。
global.React = React;

// eslint-disable-next-line import/first
const { TECHNIQUE_HELP_DOCS, getTechniqueHelpDoc } = require('../techniqueHelpRegistry');
// eslint-disable-next-line import/first
const { AUX_SUBTABS, CNYIBU_SUBTABS, CNTRADITION_SUBTABS } = require('../../../constants/SubTabRegistry');

/** 递归收集 React element 树里的全部文本(含 kv() 产出的键值行) */
function collectText(node, out){
	if(node === null || node === undefined || node === false || node === true){
		return out;
	}
	if(typeof node === 'string' || typeof node === 'number'){
		out.push(`${node}`);
		return out;
	}
	if(Array.isArray(node)){
		node.forEach((n)=>collectText(n, out));
		return out;
	}
	if(typeof node === 'object'){
		const props = node.props || {};
		// 帮助文档自家的纯展示部件(helpDocStyle 标 __helpPure):调用展开(选项表 / 步骤的字在 props 里)
		if(node.type && node.type.__helpPure){
			collectText(node.type(props), out);
			return out;
		}
		// 手册外壳(HelpBook):逐章调用 render 展开(界面只建当前章,护栏要扫全书)
		if(props.book && Array.isArray(props.book.groups)){
			if(typeof props.book.title === 'string'){ out.push(props.book.title); }
			props.book.groups.forEach((group)=>{
				if(!group){ return; }
				if(typeof group.label === 'string'){ out.push(group.label); }
				if(typeof group.hint === 'string'){ out.push(group.hint); }
				(group.chapters || []).forEach((c)=>{
					if(!c){ return; }
					if(typeof c.label === 'string'){ out.push(c.label); }
					collectText(typeof c.render === 'function' ? c.render() : null, out);
				});
			});
		}
		// title/tab 等文本型 prop 也要扫(tab 名与 tooltip 同样是用户可见文案)
		['tab', 'title', 'placeholder', 'alt'].forEach((k)=>{
			if(typeof props[k] === 'string'){ out.push(props[k]); }
		});
		if(props.children !== undefined){
			collectText(props.children, out);
		}
	}
	return out;
}

function renderDocText(Comp){
	// 函数组件与 class 组件都支持
	const isClass = Comp.prototype && typeof Comp.prototype.render === 'function';
	const el = isClass ? new Comp({}).render() : Comp({});
	return collectText(el, []).join('\n');
}

const KEYS = Object.keys(TECHNIQUE_HELP_DOCS);

describe('帮助文档护栏', ()=>{
	it('注册表非空且每项都是可渲染组件', ()=>{
		expect(KEYS.length).toBeGreaterThan(20);
		KEYS.forEach((k)=>{
			const Comp = TECHNIQUE_HELP_DOCS[k];
			expect([k, typeof Comp === 'function' || typeof Comp === 'object']).toEqual([k, true]);
		});
	});

	it('每份手册都能渲染出非空文案(不抛、不空壳)', ()=>{
		KEYS.forEach((k)=>{
			let text = '';
			expect(()=>{ text = renderDocText(TECHNIQUE_HELP_DOCS[k]); }).not.toThrow();
			// 空壳手册(只有标题没有内容)同样算不合格
			expect([k, text.length > 400]).toEqual([k, true]);
		});
	});

	// 🔴 各手册本地把 kv 定义成 `(k,v)=><div>…{v}</div>` —— v 走 JSX 插值,
	// 所以字符串里写 <b>重点</b> 不会加粗,而是把「<b>」原样显示给用户。
	// 传 JSX 元素(kv('k', <b>x</b>))是合法的,只有**字符串里的标签**才是 bug,
	// 故判据落在「渲染出来的文本」上:文本里出现标签字面量即红。
	it('🔴 渲染文案里零 HTML 标签字面量(kv 值写 <b> 会原样显示)', ()=>{
		const TAGS = /<\/?(?:b|strong|i|em|code|br|span|div|u|small)\b[^>]*>/i;
		const bad = [];
		KEYS.forEach((k)=>{
			const text = renderDocText(TECHNIQUE_HELP_DOCS[k]);
			text.split('\n').forEach((line)=>{
				const m = TAGS.exec(line);
				if(m){ bad.push(`${k}: ${m[0]} … ${line.trim().slice(0, 48)}`); }
			});
		});
		expect(bad).toEqual([]);
	});

	it('🔴 保密:手册文案零章节号、零竞品名、零内部标识', ()=>{
		// 章节号(§12 / § 3.4)、外部软件名、内部文件/函数标识
		const SECTION = /§\s*\d/;
		const INTERNAL = /\b[A-Za-z][A-Za-z0-9_]*\.(js|jsx|py|java)\b|\bperpredict\b|\bperchart\b|astrostudy(boot|cn|srv)?\b/;
		const bad = [];
		KEYS.forEach((k)=>{
			const text = renderDocText(TECHNIQUE_HELP_DOCS[k]);
			if(SECTION.test(text)){ bad.push(`${k}:章节号 ${(text.match(SECTION) || [])[0]}`); }
			if(INTERNAL.test(text)){ bad.push(`${k}:内部标识 ${(text.match(INTERNAL) || [])[0]}`); }
		});
		expect(bad).toEqual([]);
	});

	it('注册表完整性:导航页每个 tab 都有手册(新增页忘登记即红)', ()=>{
		const idx = fs.readFileSync(path.join(__dirname, '../../../pages/index.js'), 'utf8');
		// 导航配置里的 tab key(形如 key: 'xxx' 且同段含 icon/label 的技法项)
		const keys = new Set();
		const re = /key:\s*'([A-Za-z0-9_]+)'/g;
		let m = re.exec(idx);
		while(m){
			keys.add(m[1]);
			m = re.exec(idx);
		}
		// 与注册表求交:凡是注册表里有的,必须是真实 tab(防手册挂到不存在的 key 上成死文档);
		// 子技法级手册(挂在别的 tab 下打开)豁免登记于此白名单。
		const SUBTECHNIQUE_DOCS = new Set(['germanytech', 'yanqin', 'dongya', 'zhufang', 'yizhangjing']);
		const orphan = KEYS.filter((k)=>!keys.has(k) && !SUBTECHNIQUE_DOCS.has(k));
		expect(orphan).toEqual([]);
	});

	// 子技法手册此前打不开:帮助弹窗只按主 tab 取,在量化盘子页会拿到「辅盘」总手册。
	it('一页一本手册:辅盘 / 命·其他各子技法都取本页那本,书按当前子技法停到对应章;合盘里的量化盘单给量化盘那本', ()=>{
		const { resolveChapterKey } = require('../HelpBook');
		expect(getTechniqueHelpDoc('auxchart', 'germanytech')).toBe(TECHNIQUE_HELP_DOCS.auxchart);
		expect(getTechniqueHelpDoc('auxchart', 'hellenastro')).toBe(TECHNIQUE_HELP_DOCS.auxchart);
		expect(getTechniqueHelpDoc('auxchart')).toBe(TECHNIQUE_HELP_DOCS.auxchart);
		expect(getTechniqueHelpDoc('relativechart', 'germanytech')).toBe(TECHNIQUE_HELP_DOCS.germanytech);
		expect(getTechniqueHelpDoc('nope-not-a-tab')).toBe(null);
		['xianqin', 'yizhangjing', 'cetian', 'dongya', 'zhufang'].forEach((k)=>{
			expect(getTechniqueHelpDoc('mingother', undefined, k)).toBe(TECHNIQUE_HELP_DOCS.mingother);
		});
		// 当前技法取自页内技法条写入的运行时口径
		const { currentHostTechnique } = require('../techniqueHelpRegistry');
		window.__horosaKinAstroCurrent = { mingother: 'xianqin', technique: 'xianqin' };
		expect(currentHostTechnique('mingother')).toBe('xianqin');
		expect(currentHostTechnique('shusuan')).toBe('');
		window.__horosaKinAstroCurrent = undefined;
		expect(currentHostTechnique('mingother')).toBe('');
		const book = TECHNIQUE_HELP_DOCS.mingother.book;
		expect(resolveChapterKey(book, { currentTab: 'mingother', hostTechnique: 'xianqin' })).not.toBe(resolveChapterKey(book, { currentTab: 'mingother', hostTechnique: 'cetian' }));
		const header = fs.readFileSync(path.resolve(__dirname, '../../homepage/PageHeader.js'), 'utf8');
		expect(header).toContain('getTechniqueHelpDoc(props.currentTab, props.currentSubTab, currentHostTechnique(props.currentTab))');
		expect(header).toContain('hostTechnique: currentHostTechnique(props.currentTab)');
	});

	// 「停在某子技法上切走再切回来被打回首档」的根因是导航层与各技法 Main 各写一份合法集。
	// 归一到 SubTabRegistry 后,这里锁住「导航层用的就是真值源」且真值源覆盖真实子页签。
	it('子页签合法集是单一真值源且不缺项', ()=>{
		const idx = fs.readFileSync(path.join(__dirname, '../../../pages/index.js'), 'utf8');
		// 导航层必须直接引用真值源,不许再出现手写数组字面量
		expect(idx).toContain('const auxChartTabs = AUX_SUBTABS;');
		expect(idx).toContain('const cnYiBuTabs = CNYIBU_SUBTABS;');
		expect(idx).toContain('const cnTraditionTabs = CNTRADITION_SUBTABS;');
		// 真值源与各技法 Main 的 TabPane key 集合一致(Main 加了 tab 却忘了改真值源即红)
		const auxSrc = fs.readFileSync(path.join(__dirname, '../../auxchart/AuxChartMain.js'), 'utf8');
		const cnyibuSrc = fs.readFileSync(path.join(__dirname, '../../cnyibu/CnYiBuMain.js'), 'utf8');
		const paneKeys = (src)=>{
			const out = new Set();
			const re = /<TabPane[^>]*\skey=(?:"([A-Za-z0-9_]+)"|\{'([A-Za-z0-9_]+)'\})/g;
			let m = re.exec(src);
			while(m){ out.add(m[1] || m[2]); m = re.exec(src); }
			return out;
		};
		[[auxSrc, AUX_SUBTABS, 'auxchart'], [cnyibuSrc, CNYIBU_SUBTABS, 'cnyibu']].forEach(([src, list, name])=>{
			const panes = paneKeys(src);
			if(panes.size === 0){ return; }	// 该 Main 用 map 生成 TabPane 时跳过(无字面量可比)
			const missing = [...panes].filter((k)=>list.indexOf(k) < 0);
			expect([name, missing]).toEqual([name, []]);
		});
	});
});
