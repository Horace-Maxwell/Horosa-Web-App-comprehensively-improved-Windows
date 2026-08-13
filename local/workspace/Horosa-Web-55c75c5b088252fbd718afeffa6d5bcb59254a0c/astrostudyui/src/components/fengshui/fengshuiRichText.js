import React from 'react';

// 风水文案的**行内加粗**渲染。
//
// 🔴 为什么需要:风水各派的条文数据(罗盘用法/立向向导/化煞/断语等)
// 都按 Markdown 习惯用 `**要点**` 标重点,而右栏是直出 JSX({v}/{note}),React 会把星号
// 当普通字符原样画出来 —— 用户看到的是「绝不能勉强理气上的旺向」这种带星号的脏文案
// (用户实报「风水的加粗格式全部没正常显示」)。
//
// 选择在**渲染层**解析而非把数据里的星号删掉:重点标记是条文语义的一部分(哪句是禁忌、
// 哪个数是硬门槛),删掉等于丢信息;而且数据文件还要供 AI 快照/导出复用,那两条链吃
// Markdown 正合适。
//
// 只做加粗一种:数据里只用到 `**`,不引 Markdown 全解析器(体积与 XSS 面都不划算)。
// 落单的星号(如「三**」这种没配对的)按普通文本原样留下,绝不吞字。
const BOLD_RE = /\*\*([^*]+)\*\*/g;

export function renderInlineBold(node, keyPrefix){
	if(typeof node !== 'string' || node.indexOf('**') < 0){ return node; }
	const out = [];
	let last = 0;
	let i = 0;
	let m = null;
	BOLD_RE.lastIndex = 0;
	while((m = BOLD_RE.exec(node)) !== null){
		if(m.index > last){ out.push(node.slice(last, m.index)); }
		out.push(React.createElement('strong', { key: `${keyPrefix || 'b'}-${i}`, className: 'horosa-md-strong' }, m[1]));
		last = m.index + m[0].length;
		i += 1;
	}
	if(last < node.length){ out.push(node.slice(last)); }
	return out.length ? out : node;
}

// 纯文本口径(AI 快照/导出/纯文本对比用):把标记摘掉但保留字面内容。
export function stripInlineBold(text){
	return typeof text === 'string' ? text.replace(BOLD_RE, '$1') : text;
}

// 递归版:对整棵 children 子树里的字符串做行内加粗。
// 🔴 为什么要递归而不是逐个出口改:右栏 `horosa-fengshui-liqi-note` 一类直出 div 数量众多,
// 形态各异(模板串/表达式/JSX 混排),逐个接必漏、且新增一处就再漏一次;而它们统统落在
// card(title, children) 之内 —— 在 card 一处递归,右栏所有卡片内容一次覆盖,以后新写的条文自动生效。
// 只重建"带 children 的元素",输入类/函数式 children 原样透传(不碰受控组件)。
export function deepInlineBold(node, keyPrefix){
	const kp = keyPrefix || 'db';
	if(typeof node === 'string'){ return renderInlineBold(node, kp); }
	if(Array.isArray(node)){ return node.map((n, i)=>deepInlineBold(n, `${kp}-${i}`)); }
	if(React.isValidElement(node)){
		const kids = node.props ? node.props.children : undefined;
		if(kids === undefined || kids === null || typeof kids === 'function'){ return node; }
		return React.cloneElement(node, undefined, deepInlineBold(kids, `${kp}-c`));
	}
	return node;
}
