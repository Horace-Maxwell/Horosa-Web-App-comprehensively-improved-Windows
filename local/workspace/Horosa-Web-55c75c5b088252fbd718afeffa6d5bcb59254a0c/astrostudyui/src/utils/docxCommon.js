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

// [B2] dataURL 图片尺寸嗅探(PNG IHDR / JPEG SOF0-2):docx ImageRun 必须显式宽高,
// 盲设会拉伸变形。解析失败返回 null → 调用方用保守默认。
export function sniffImageSize(u8){
	try{
		if(!u8 || u8.length < 24){ return null; }
		// PNG: 89 50 4E 47 … IHDR 宽高在 16..24
		if(u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47){
			const w = (u8[16] << 24) | (u8[17] << 16) | (u8[18] << 8) | u8[19];
			const h = (u8[20] << 24) | (u8[21] << 16) | (u8[22] << 8) | u8[23];
			return (w > 0 && h > 0) ? { width: w, height: h } : null;
		}
		// JPEG: FF D8 … 扫段找 SOF0/1/2(C0/C1/C2),高宽在段内 3..7
		if(u8[0] === 0xFF && u8[1] === 0xD8){
			let i = 2;
			while(i + 9 < u8.length){
				if(u8[i] !== 0xFF){ i++; continue; }
				const marker = u8[i + 1];
				if(marker === 0xC0 || marker === 0xC1 || marker === 0xC2){
					const h = (u8[i + 5] << 8) | u8[i + 6];
					const w = (u8[i + 7] << 8) | u8[i + 8];
					return (w > 0 && h > 0) ? { width: w, height: h } : null;
				}
				const len = (u8[i + 2] << 8) | u8[i + 3];
				i += 2 + (len > 0 ? len : 1);
			}
		}
	}catch(e){ /* 嗅探失败走默认 */ }
	return null;
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
