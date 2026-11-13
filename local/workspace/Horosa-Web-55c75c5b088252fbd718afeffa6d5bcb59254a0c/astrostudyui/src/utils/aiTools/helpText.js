// AI 助手·技法帮助文档 → 纯文本(资源 horosa://help/<页签键>,给外部 AI 先学会每个功能怎么用)。
// 帮助文档是类组件(*HelpDoc);这里不渲染 DOM,而是遍历 React 元素树取文字:类组件实例化后取 render() 产物,
// antd 外壳(Tabs / TabPane 等带 hooks 的函数组件)不调用、只走 children,页签标题 tab 成节;手册外壳
// (HelpBook)的各章是惰性 render 函数 —— 全部展开(界面上只渲染当前章,这里要全文)。内容单源 = 帮助弹窗同一份组件。
import React from 'react';
import HelpBook, { bookChapters } from '../../components/help/HelpBook';
import { TECHNIQUE_HELP_DOCS } from '../../components/help/techniqueHelpRegistry';

const BLOCK_TAGS = { div: 1, p: 1, li: 1, ul: 1, ol: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, table: 1, tr: 1, section: 1, blockquote: 1, pre: 1 };
export const HELP_TEXT_MAX_DEPTH = 60;

function walk(node, out, depth){
	if(node === null || node === undefined || typeof node === 'boolean'){ return; }
	if(depth > HELP_TEXT_MAX_DEPTH){ return; }
	if(typeof node === 'string' || typeof node === 'number'){ out.push(`${node}`); return; }
	if(Array.isArray(node)){ node.forEach((n)=>walk(n, out, depth + 1)); return; }
	if(!React.isValidElement(node)){ return; }
	const type = node.type;
	const props = node.props || {};
	if(type === HelpBook){
		bookToText(props.book, out, depth);
		return;
	}
	if(typeof type === 'function'){
		// 帮助文档自家的纯展示部件(helpDocStyle 标了 __helpPure):直接调用取文字(选项表 / 步骤的字在 props 里)
		if(type.__helpPure){
			let rendered = null;
			try{ rendered = type(props); }catch(e){ rendered = props.children; }
			walk(rendered, out, depth + 1);
			return;
		}
		if(type.prototype && type.prototype.isReactComponent){
			let rendered = null;
			try{
				// eslint-disable-next-line new-cap
				const inst = new type(props);
				inst.props = props;
				if(!inst.state){ inst.state = {}; }
				rendered = inst.render();
			}catch(e){ rendered = props.children; }
			walk(rendered, out, depth + 1);
			return;
		}
		// 函数组件(antd 外壳等,多半带 hooks):不调用;页签 / 折叠面板 / 卡片的标题单独成节
		const heading = props.tab !== undefined ? props.tab : (props.header !== undefined ? props.header : (props.title !== undefined && typeof props.title !== 'string' ? null : props.title));
		if(heading !== undefined && heading !== null && heading !== ''){ out.push('\n\n## '); walk(heading, out, depth + 1); out.push('\n'); }
		walk(props.children, out, depth + 1);
		return;
	}
	// 帮助部件的文字分隔(界面上靠栅格 / 表格线分开,纯文本里要补上,否则「键值」「表格各格」「步骤号与正文」黏成一串):
	// 键值行 = 键:值;表格每格后补「 | 」;步骤号后补「. 」(「1」+「90 天内」不能读成「190 天内」)
	const cls = typeof props.className === 'string' ? props.className : '';
	if(type === 'div' && /(^|\s)horosa-help-kv(\s|$)/.test(cls)){
		out.push('\n');
		React.Children.toArray(props.children).forEach((child, i)=>{ if(i > 0){ out.push(':'); } walk(child, out, depth + 1); });
		out.push('\n');
		return;
	}
	if(/(^|\s)horosa-help-step-no(\s|$)/.test(cls)){
		walk(props.children, out, depth + 1);
		out.push('. ');
		return;
	}
	if(type === 'td' || type === 'th'){
		walk(props.children, out, depth + 1);
		out.push(' | ');
		return;
	}
	const block = typeof type === 'string' && BLOCK_TAGS[type];
	if(block){ out.push('\n'); }
	if(type === 'li'){ out.push('· '); }
	if(type === 'br'){ out.push('\n'); return; }
	walk(props.children, out, depth + 1);
	if(block){ out.push('\n'); }
}

// 手册(HelpBook)全书:书名 → 每组 → 每章逐章展开(界面上只渲染当前章,给 AI 要全文)
function bookToText(book, out, depth){
	if(!book){ return; }
	if(book.title){ out.push(`${book.title}\n`); }
	let lastGroup = null;
	bookChapters(book).forEach((c)=>{
		if(c.groupLabel && c.groupKey !== lastGroup){ out.push(`\n\n## ${c.groupLabel}\n`); if(c.groupHint){ out.push(`${c.groupHint}\n`); } lastGroup = c.groupKey; }
		out.push(`\n\n### ${c.label}\n`);
		let content = null;
		try{ content = typeof c.render === 'function' ? c.render() : null; }catch(e){ content = null; }
		walk(content, out, depth + 1);
	});
}

// 一本手册的纯文本(覆盖测试与 AI 资源同口径)
export function helpBookToText(book){
	const out = [];
	bookToText(book, out, 0);
	return tidy(out.join(''));
}

function tidy(text){
	return text
		.replace(/[ \t ]+\n/g, '\n')
		.replace(/\n[ \t ]+/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function helpElementToText(element){
	const out = [];
	walk(element, out, 0);
	return out.join('')
		.replace(/[ \t ]+\n/g, '\n')
		.replace(/\n[ \t ]+/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

const CACHE = new Map();
export function listHelpTabs(){
	return Object.keys(TECHNIQUE_HELP_DOCS).filter((k)=>typeof TECHNIQUE_HELP_DOCS[k] === 'function');
}
// 某页签的帮助全文(按页签键缓存;帮助内容随版本变,进程内缓存足够)。未知页签 → ''
export function helpTextOf(tab){
	const key = `${tab || ''}`;
	if(!Object.prototype.hasOwnProperty.call(TECHNIQUE_HELP_DOCS, key)){ return ''; }
	if(CACHE.has(key)){ return CACHE.get(key); }
	const Doc = TECHNIQUE_HELP_DOCS[key];
	let text = '';
	try{ text = Doc && Doc.book ? helpBookToText(Doc.book) : helpElementToText(React.createElement(Doc, {})); }catch(e){ text = ''; }
	if(text){ CACHE.set(key, text); }
	return text;
}
// 标题 = 正文第一行(各帮助文档首行恒是「XX · 操作手册」)
export function helpTitleOf(tab){
	const t = helpTextOf(tab);
	return t ? t.split('\n')[0].slice(0, 60) : `${tab}`;
}
export function __resetHelpTextCacheForTests(){ CACHE.clear(); }
