// AI导出 v2 呈现层渲染器（真 docx + 样式化 PDF 的 DOM 构建）。
// ⚠️ 本文件静态 import docxCommon → 'docx'(较重):**只允许被动态 import**
//   (aiExport.exportDocx / exportPdf v2 路径 `await import('./aiExportDocRender')`,
//   与 exportPdf 动态 import html-to-image/jspdf 同款代码分包先例)。主链静态引 = 主包膨胀,哨兵看护。
// 输入恒为「既有导出纯文本」经 aiExportDocModel 解析出的 IR——纯文本仍是单一真值,这里只做派生视图。

import { Document, Packer, Paragraph, TextRun, ImageRun } from 'docx';
import { makeDocxTable, dataUrlToUint8Array, mdInlineToRuns, sniffImageSize } from './docxCommon';
import { parseAiExportDocument } from './aiExportDocModel';

const HEADING = { 1: 'Heading1', 2: 'Heading2', 3: 'Heading3' }; // docx 枚举 jest 下不稳,字面量(reportExport 先例)

const SENTINEL_LINE_RE = /^=+\s*内容(开始|结束)\s*=+$/;

function preambleLines(doc){
	return `${doc.preamble || ''}`.split('\n')
		.map((l)=>l.trim())
		.filter((l)=>l && !SENTINEL_LINE_RE.test(l));
}

// —— docx 派生视图 ——

function kvParagraph(block){
	return new Paragraph({
		children: [
			new TextRun({ text: `${block.key}：`, bold: true }),
			new TextRun({ text: `${block.value || ''}` }),
		],
	});
}

function pParagraphs(block){
	// [A2] 正文/项目符号统一走 mdInlineToRuns:**粗**/*斜*/`码` 转真样式 run。
	// 此前只有表格单元格走(makeDocxTableCell),正文却裸 TextRun 原样输出星号——同文件自相矛盾。
	return `${block.text || ''}`.split('\n').map((line)=>{
		const t = line.trim();
		if(/^- /.test(t)){
			return new Paragraph({ bullet: { level: 0 }, children: mdInlineToRuns(t.replace(/^- /, '')) });
		}
		return new Paragraph({ children: mdInlineToRuns(t) });
	});
}

function blockToDocxChildren(block){
	if(block.type === 'table'){
		return [makeDocxTable(block.headers || [], block.rows || [], block.aligns || []), new Paragraph({ children: [new TextRun('')] })];
	}
	// [B2] 与 IR 解析器同步的五型:code/quote/list/image/hr。
	if(block.type === 'code'){
		return `${block.text || ''}`.split('\n').map((l)=>new Paragraph({
			shading: { type: 'clear', color: 'auto', fill: 'F4F4F6' },
			children: [new TextRun({ text: l, font: 'Courier New', size: 18, color: '333340' })],
		})).concat([new Paragraph({ children: [new TextRun('')] })]);
	}
	if(block.type === 'quote'){
		return `${block.text || ''}`.split('\n').map((l)=>new Paragraph({
			indent: { left: 360 },
			children: mdInlineToRuns(l, { italics: true, color: '666666' }),
		}));
	}
	if(block.type === 'list'){
		return (block.items || []).map((item)=>{
			const depth = Math.max(0, Math.min(4, Number(item.depth) || 0));
			if(item.ordered){
				// 有序:文本序标+缩进(docx numbering 配置重且与 bullet 混排易串号,文本序稳定)
				return new Paragraph({
					indent: { left: 240 + depth * 240 },
					children: [new TextRun({ text: `${item.marker && /\d/.test(item.marker) ? item.marker : '1.'} `, bold: false })].concat(mdInlineToRuns(item.text || '')),
				});
			}
			return new Paragraph({ bullet: { level: depth }, children: mdInlineToRuns(item.text || '') });
		});
	}
	if(block.type === 'image'){
		const u8 = /^data:image\//.test(`${block.src || ''}`) ? dataUrlToUint8Array(block.src) : null;
		if(u8){
			const nat = sniffImageSize(u8) || { width: 480, height: 360 };
			const maxW = 600;
			const scale = Math.min(1, maxW / nat.width);
			try{
				return [new Paragraph({ children: [new ImageRun({ data: u8, transformation: { width: Math.round(nat.width * scale), height: Math.round(nat.height * scale) } })] })];
			}catch(e){ /* 嵌图失败落占位 */ }
		}
		return [new Paragraph({ children: [new TextRun({ text: `[图]${block.alt || ''}`, color: '888888' })] })];
	}
	if(block.type === 'hr'){
		return [new Paragraph({ border: { bottom: { style: 'single', size: 6, color: 'CCCCCC', space: 4 } }, children: [new TextRun('')] })];
	}
	if(block.type === 'subhead'){
		return [new Paragraph({ heading: HEADING[3], children: [new TextRun({ text: block.text || '' })] })];
	}
	if(block.type === 'note'){
		return [new Paragraph({ children: [new TextRun({ text: block.text || '', italics: true, color: '777777' })] })];
	}
	if(block.type === 'kv'){
		return [kvParagraph(block)];
	}
	return pParagraphs(block);
}

// payload{tech,text} + 可选截图 → docx Blob。截图放封面(标题与元数据之后、正文之前)。
export async function buildExportDocxBlob(payload, options = {}){
	const doc = parseAiExportDocument(payload && payload.text);
	const children = [];
	children.push(new Paragraph({ heading: HEADING[1], children: [new TextRun({ text: `${(payload && payload.tech) || '导出'} · AI 导出` })] }));
	preambleLines(doc).forEach((line)=>{
		children.push(new Paragraph({ children: [new TextRun({ text: line, color: '666666', size: 18 })] }));
	});
	const shot = options.screenshot;
	if(shot && shot.dataUrl){
		const u8 = dataUrlToUint8Array(shot.dataUrl);
		if(u8){
			// 版心 ~600px 等比缩放(docx transformation 单位=px)。
			const w = Math.min(600, shot.width || 600);
			const h = Math.max(1, Math.round((shot.height || w) * (w / Math.max(1, shot.width || w))));
			try{
				children.push(new Paragraph({ children: [new ImageRun({ data: u8, transformation: { width: w, height: h } })] }));
			}catch(_){ /* 图损坏忽略,文档继续(截图绝不阻断导出) */ }
		}
	}
	children.push(new Paragraph({ children: [new TextRun('')] }));
	(doc.sections || []).forEach((section)=>{
		children.push(new Paragraph({ heading: HEADING[2], children: [new TextRun({ text: section.title })] }));
		(section.blocks || []).forEach((block)=>{
			blockToDocxChildren(block).forEach((c)=>children.push(c));
		});
	});
	const document = new Document({ sections: [{ children }] });
	return Packer.toBlob(document);
}

// —— 样式化 PDF 的 DOM 构建(块级节点数组,供 exportPdf v2 测高/装箱/分块栅格) ——

const PDF_FONT = '"PingFang SC","Microsoft YaHei",Arial,sans-serif';

function el(tag, cssText, text){
	const node = document.createElement(tag);
	if(cssText){ node.style.cssText = cssText; }
	if(text != null){ node.textContent = text; }
	return node;
}

function tableNode(block){
	const table = el('table', `border-collapse:collapse;width:100%;margin:6px 0 10px;font:12px/1.55 ${PDF_FONT};table-layout:auto;`);
	const thead = document.createElement('thead');
	const trh = document.createElement('tr');
	(block.headers || []).forEach((h, k)=>{
		const th = el('th', `border:1px solid #bbbbbb;background:#eef1f6;color:#111111;padding:4px 8px;text-align:${(block.aligns || [])[k] || 'left'};font-weight:600;`, h);
		trh.appendChild(th);
	});
	thead.appendChild(trh);
	table.appendChild(thead);
	const tbody = document.createElement('tbody');
	(block.rows || []).forEach((row, ri)=>{
		const tr = document.createElement('tr');
		if(ri % 2 === 1){ tr.style.background = '#f7f8fa'; }
		const cols = (block.headers || []).length || row.length;
		for(let k = 0; k < cols; k++){
			const td = el('td', `border:1px solid #cccccc;color:#111111;padding:3px 8px;text-align:${(block.aligns || [])[k] || 'left'};`, row[k] != null ? row[k] : '');
			tr.appendChild(td);
		}
		tbody.appendChild(tr);
	});
	table.appendChild(tbody);
	return table;
}

function blockToPdfNode(block){
	if(block.type === 'table'){
		return tableNode(block);
	}
	if(block.type === 'subhead'){
		const sh = el('div', `font:600 13.5px/1.6 ${PDF_FONT};color:#1a2a4a;margin:10px 0 4px;padding-left:8px;border-left:3px solid #4a6fa5;`, block.text || '');
		sh.className = 'exp-subhead';   // 打印路径:段头避免落在页脚成孤行(page-break-after:avoid)
		return sh;
	}
	if(block.type === 'note'){
		return el('div', `font:italic 12px/1.6 ${PDF_FONT};color:#777777;margin:2px 0;white-space:pre-wrap;word-break:break-word;`, block.text || '');
	}
	if(block.type === 'kv'){
		const wrap = el('div', `font:13px/1.7 ${PDF_FONT};color:#111111;margin:1px 0;white-space:pre-wrap;word-break:break-word;`);
		wrap.appendChild(el('span', 'font-weight:600;', `${block.key}：`));
		wrap.appendChild(el('span', '', `${block.value || ''}`));
		return wrap;
	}
	return el('div', `font:13px/1.7 ${PDF_FONT};color:#111111;margin:2px 0;white-space:pre-wrap;word-break:break-word;`, block.text || '');
}

// 整份导出文本 → 块级 DOM 节点数组(标题/元数据头/段头条/正文块)。调用方负责挂宿主、测高、装箱。
export function renderExportDocToPdfNodes(payload){
	const doc = parseAiExportDocument(payload && payload.text);
	const nodes = [];
	nodes.push(el('div', `font:700 18px/1.5 ${PDF_FONT};color:#111111;margin:0 0 6px;`, `${(payload && payload.tech) || '导出'} · AI 导出`));
	const pre = preambleLines(doc);
	if(pre.length){
		nodes.push(el('div', `font:11.5px/1.6 ${PDF_FONT};color:#666666;margin:0 0 10px;white-space:pre-wrap;word-break:break-word;`, pre.join('\n')));
	}
	(doc.sections || []).forEach((section)=>{
		const secTitle = el('div', `font:600 14px/1.7 ${PDF_FONT};color:#ffffff;background:#3d5578;margin:12px 0 6px;padding:3px 10px;border-radius:3px;`, section.title);
		secTitle.className = 'exp-sec';   // 打印路径:段头避免落在页脚成孤行(page-break-after:avoid)
		nodes.push(secTitle);
		(section.blocks || []).forEach((block)=>{
			nodes.push(blockToPdfNode(block));
		});
	});
	return nodes;
}
