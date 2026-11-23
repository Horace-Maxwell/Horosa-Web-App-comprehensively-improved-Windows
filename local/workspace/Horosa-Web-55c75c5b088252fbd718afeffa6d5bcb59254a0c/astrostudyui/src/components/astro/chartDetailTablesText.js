// 盘面细节「按表取全表」:直接用细节页 tableOf 的列定义(同一份 render),把页面上那张表原样转成 Markdown 表格。
// 页面与 AI 同一源:改了页面的列,AI 拿到的全表跟着变。默认 AI 快照仍是摘要(buildChartDetailsText),只有点名的表才出全表。
import React from 'react';
import AstroChartDetails from './AstroChartDetails';
import { SmallTable } from './AstroExtraCommon';
import { CHART_DETAIL_TABLES } from '../../utils/chartDetails';

const BLOCK = new Set(['div', 'p', 'li', 'tr', 'br', 'h1', 'h2', 'h3', 'h4', 'section']);

// React 元素 → 纯文本(行内拼接、块级换行;函数组件不展开,只取 children)
export function elementText(node){
	if(node === null || node === undefined || node === false || node === true){ return ''; }
	if(typeof node === 'string' || typeof node === 'number'){ return `${node}`; }
	if(Array.isArray(node)){ return node.map(elementText).join(''); }
	if(React.isValidElement(node)){
		const inner = elementText(node.props && node.props.children);
		return typeof node.type === 'string' && BLOCK.has(node.type) ? `${inner}\n` : inner;
	}
	return '';
}

const cell = (v)=>elementText(v).replace(/\s*\n\s*/g, ' / ').replace(/\|/g, '\\|').trim();

function smallTableMarkdown(props){
	const cols = (props.columns || []).filter(Boolean);
	const rows = props.rows || [];
	if(!cols.length){ return []; }
	const out = [`| ${cols.map((c)=>cell(c.title) || c.key).join(' | ')} |`, `| ${cols.map(()=>'---').join(' | ')} |`];
	rows.forEach((row, idx)=>{
		out.push(`| ${cols.map((c)=>cell(c.render ? c.render(row[c.key], row, idx) : row[c.key])).join(' | ')} |`);
	});
	return out;
}

// 页面那张表的整棵树 → 行:SmallTable 出 Markdown 表,其余块出文字行
function treeLines(node, out){
	if(node === null || node === undefined || node === false || node === true){ return; }
	if(Array.isArray(node)){ node.forEach((n)=>treeLines(n, out)); return; }
	if(typeof node === 'string' || typeof node === 'number'){ const t = `${node}`.trim(); if(t){ out.push(t); } return; }
	if(!React.isValidElement(node)){ return; }
	if(node.type === SmallTable){ if(out.length && out[out.length - 1] !== ''){ out.push(''); } out.push(...smallTableMarkdown(node.props || {}), ''); return; }
	const kids = node.props && node.props.children;
	const hasTable = (function find(n){
		if(Array.isArray(n)){ return n.some(find); }
		return React.isValidElement(n) && (n.type === SmallTable || find(n.props && n.props.children));
	})(kids);
	if(hasTable){ treeLines(kids, out); return; }
	const t = elementText(node).split('\n').map((s)=>s.trim()).filter(Boolean);
	out.push(...t);
}

export const CHART_DETAIL_TABLE_KEYS = CHART_DETAIL_TABLES.map((t)=>t.value);

// r = /astroextra/chartdetails 的结果;tables = 表键数组;settings = 细节页五项设置(只影响 tableOf 内按设置分支的表头文字)
export function buildChartDetailFullTables(r, tables, settings){
	if(!r || !Array.isArray(tables) || !tables.length){ return ''; }
	const parts = [];
	tables.forEach((key)=>{
		const def = CHART_DETAIL_TABLES.find((t)=>t.value === key);
		if(!def){ return; }
		let tree = null;
		try{ tree = AstroChartDetails.prototype.tableOf.call({ state: { ...(settings || {}), detailTable: key }, props: {} }, r); }catch(e){ tree = null; }
		const lines = [];
		treeLines(tree, lines);
		while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
		// 不另起段头:并在「盘面细节」段里(段勾选 / 导出预设只认段名),以「■ 全表·表名」小标题分开
		parts.push(`■ 全表·${def.label}`, ...(lines.length ? lines : ['(本盘这张表没有内容)']), '');
	});
	return parts.join('\n').trim();
}
