// AI 助手·技法帮助文档 → 纯文本(资源 horosa://help/<页签键>,给外部 AI 先学会每个功能怎么用)。
// 帮助文档是类组件(*HelpDoc);这里不渲染 DOM,而是遍历 React 元素树取文字:类组件实例化后取 render() 产物,
// antd 外壳(Tabs / TabPane 等带 hooks 的函数组件)不调用、只走 children,页签标题 tab 成节;两层页签外壳
// (HelpDocTwoLevel)的各项是惰性 render 函数 —— 全部展开(界面上只渲染当前项,这里要全文)。内容单源 = 帮助弹窗同一份组件。
import React from 'react';
import HelpDocTwoLevel from '../../components/help/HelpDocTwoLevel';
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
	if(type === HelpDocTwoLevel){
		(props.groups || []).forEach((g)=>{
			const items = (g && g.items) || [];
			if(!items.length){ return; }
			out.push(`\n\n## ${g.label || g.key}\n`);
			if(g.hint){ out.push(`${g.hint}\n`); }
			items.forEach((it)=>{
				if(items.length > 1){ out.push(`\n\n### ${it.label || it.key}\n`); }
				let content = null;
				try{ content = typeof it.render === 'function' ? it.render() : (it.content || null); }catch(e){ content = null; }
				walk(content, out, depth + 1);
			});
		});
		return;
	}
	if(typeof type === 'function'){
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
	const block = typeof type === 'string' && BLOCK_TAGS[type];
	if(block){ out.push('\n'); }
	if(type === 'li'){ out.push('· '); }
	if(type === 'br'){ out.push('\n'); return; }
	walk(props.children, out, depth + 1);
	if(block){ out.push('\n'); }
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
	try{ text = helpElementToText(React.createElement(Doc, {})); }catch(e){ text = ''; }
	if(text){ CACHE.set(key, text); }
	return text;
}
// 标题 = 正文第一行(各帮助文档首行恒是「XX · 操作手册」)
export function helpTitleOf(tab){
	const t = helpTextOf(tab);
	return t ? t.split('\n')[0].slice(0, 60) : `${tab}`;
}
export function __resetHelpTextCacheForTests(){ CACHE.clear(); }
