// docx 构造助手 · 单源（v2 底座:自 reportExport.js 逐字平移,行为零变化）。
// 供 reportExport(AI 报告 docx) 与 aiExportDocRender(技法导出 docx) 共用。
// ⚠️ 本文件静态 import 'docx'(较重):aiExport 主链严禁静态 import 本文件——
//   必须经 aiExportDocRender 动态 import(代码分包),否则 docx 进主包(哨兵看护)。
// docx 的对齐/边框等枚举在 jest 下偶尔解构为 undefined,沿用字符串字面量(reportExport 先例)。

import { TextRun, Paragraph, Table, TableRow, TableCell } from 'docx';

// 行内 markdown(**粗** / *斜* / `码`)→ docx TextRun[];段落与表格单元格共用。
export function mdInlineToRuns(text, baseOpts){
	const base = baseOpts || {};
	const src = `${text == null ? '' : text}`;
	if(!src) return [new TextRun({ ...base, text: '' })];
	const runs = [];
	const re = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g;
	let last = 0; let m;
	while((m = re.exec(src))){
		if(m.index > last){ runs.push(new TextRun({ ...base, text: src.slice(last, m.index) })); }
		if(m[1] != null){ runs.push(new TextRun({ ...base, text: m[1], bold: true })); }
		else if(m[2] != null){ runs.push(new TextRun({ ...base, text: m[2], italics: true })); }
		else if(m[3] != null){ runs.push(new TextRun({ ...base, text: m[3], font: 'Courier New' })); }
		last = re.lastIndex;
	}
	if(last < src.length){ runs.push(new TextRun({ ...base, text: src.slice(last) })); }
	return runs.length ? runs : [new TextRun({ ...base, text: '' })];
}

const DOCX_CELL_BORDER = { style: 'single', size: 4, color: 'BBBBBB' };

export function makeDocxTableCell(text, opts){
	const o = opts || {};
	return new TableCell({
		borders: { top: DOCX_CELL_BORDER, bottom: DOCX_CELL_BORDER, left: DOCX_CELL_BORDER, right: DOCX_CELL_BORDER },
		shading: o.header ? { type: 'clear', color: 'auto', fill: 'F0F0F0' } : undefined,
		children: [new Paragraph({ alignment: o.align || 'left', children: mdInlineToRuns(text, o.header ? { bold: true } : {}) })],
	});
}

export function makeDocxTable(headers, bodyRows, aligns){
	const cols = headers.length || 1;
	const alignList = aligns || [];
	const headRow = new TableRow({ tableHeader: true, children: headers.map((h, k)=> makeDocxTableCell(h, { header: true, align: alignList[k] || 'left' })) });
	const rows = [headRow].concat((bodyRows || []).map((r)=> new TableRow({
		children: Array.from({ length: cols }, (_, k)=> makeDocxTableCell(r[k] != null ? r[k] : '', { align: alignList[k] || 'left' })),
	})));
	return new Table({ rows });
}

// dataURL → Uint8Array(docx ImageRun 输入;自 reportExport 平移)。
export function dataUrlToUint8Array(dataUrl){
	if(!dataUrl || typeof dataUrl !== 'string') return null;
	const idx = dataUrl.indexOf(',');
	if(idx < 0) return null;
	const b64 = dataUrl.slice(idx + 1);
	try{
		const bin = atob(b64);
		const arr = new Uint8Array(bin.length);
		for(let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
		return arr;
	}catch(_){ return null; }
}
