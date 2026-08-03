// AI导出 v2 呈现层渲染器（真 docx + 样式化 PDF 的 DOM 构建）。
// ⚠️ 本文件静态 import docxCommon → 'docx'(较重):**只允许被动态 import**
//   (aiExport.exportDocx / exportPdf v2 路径 `await import('./aiExportDocRender')`,
//   与 exportPdf 动态 import html-to-image/jspdf 同款代码分包先例)。主链静态引 = 主包膨胀,哨兵看护。
// 输入恒为「既有导出纯文本」经 aiExportDocModel 解析出的 IR——纯文本仍是单一真值,这里只做派生视图。

import { Document, Packer, Paragraph, TextRun, ImageRun } from 'docx';
import { makeDocxTable, dataUrlToUint8Array, mdInlineToRuns, sniffImageSize } from './docxCommon';
import { parseAiExportDocument, mdInlineSegments } from './aiExportDocModel';

const HEADING = { 1: 'Heading1', 2: 'Heading2', 3: 'Heading3' }; // docx 枚举 jest 下不稳,改用字面量

const SENTINEL_LINE_RE = /^=+\s*内容(开始|结束)\s*=+$/;

function preambleLines(doc){
	return `${doc.preamble || ''}`.split('\n')
		.map((l)=>l.trim())
		.filter((l)=>l && !SENTINEL_LINE_RE.test(l));
}

// —— docx 派生视图 ——

function kvParagraph(block){
	// [E5] 键/值均走行内样式:键含 **引导词** 时记号由 mdInlineToRuns 消化(键整体仍加粗),
	// 此前裸 TextRun 会把 `**键**：` 的星号字面写进 docx(双重丑:又有星号又加粗)。
	return new Paragraph({
		children: mdInlineToRuns(`${block.key}：`, { bold: true }).concat(mdInlineToRuns(`${block.value || ''}`)),
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
		// [E5] 子题/说明两型此前裸 TextRun,`◆ **重点**` 的星号字面落 xml——补接行内样式(与正文/列表对齐)。
		return [new Paragraph({ heading: HEADING[3], children: mdInlineToRuns(block.text || '') })];
	}
	if(block.type === 'note'){
		return [new Paragraph({ children: mdInlineToRuns(block.text || '', { italics: true, color: '777777' }) })];
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

// [E5] 行内 markdown → DOM 片段:粗/斜/码转真样式(此前全块型走 textContent,`**` 字面进 PDF)。
// 换行由宿主块的 white-space:pre-wrap 保留(粗/斜段的正则不跨 \n,纯文本段的 \n 原样入文本节点)。
function appendInlineMd(node, text){
	mdInlineSegments(`${text == null ? '' : text}`).forEach((seg)=>{
		if(seg.bold){
			const b = document.createElement('b');
			b.style.fontWeight = '600';
			b.textContent = seg.text;
			node.appendChild(b);
		}else if(seg.em){
			const it = document.createElement('i');
			it.textContent = seg.text;
			node.appendChild(it);
		}else if(seg.code){
			const c = document.createElement('span');
			c.style.cssText = 'font-family:"SFMono-Regular",Menlo,Consolas,monospace;background:#f4f4f6;padding:0 3px;border-radius:2px;';
			c.textContent = seg.text;
			node.appendChild(c);
		}else{
			node.appendChild(document.createTextNode(seg.text));
		}
	});
	return node;
}

function tableNode(block){
	const table = el('table', `border-collapse:collapse;width:100%;margin:6px 0 10px;font:12px/1.55 ${PDF_FONT};table-layout:auto;`);
	const thead = document.createElement('thead');
	const trh = document.createElement('tr');
	(block.headers || []).forEach((h, k)=>{
		const th = appendInlineMd(el('th', `border:1px solid #bbbbbb;background:#eef1f6;color:#111111;padding:4px 8px;text-align:${(block.aligns || [])[k] || 'left'};font-weight:600;`), h);
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
			const td = appendInlineMd(el('td', `border:1px solid #cccccc;color:#111111;padding:3px 8px;text-align:${(block.aligns || [])[k] || 'left'};`), row[k] != null ? row[k] : '');
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
		const sh = appendInlineMd(el('div', `font:600 13.5px/1.6 ${PDF_FONT};color:#1a2a4a;margin:10px 0 4px;padding-left:8px;border-left:3px solid #4a6fa5;`), block.text || '');
		sh.className = 'exp-subhead';   // 打印路径:段头避免落在页脚成孤行(page-break-after:avoid)
		return sh;
	}
	if(block.type === 'note'){
		return appendInlineMd(el('div', `font:italic 12px/1.6 ${PDF_FONT};color:#777777;margin:2px 0;white-space:pre-wrap;word-break:break-word;`), block.text || '');
	}
	if(block.type === 'kv'){
		const wrap = el('div', `font:13px/1.7 ${PDF_FONT};color:#111111;margin:1px 0;white-space:pre-wrap;word-break:break-word;`);
		wrap.appendChild(appendInlineMd(el('span', 'font-weight:600;'), `${block.key}：`));
		wrap.appendChild(appendInlineMd(el('span', ''), `${block.value || ''}`));
		return wrap;
	}
	// 🔴 list/image/hr/code/quote 五型**没有 block.text**,曾一律落到下方兜底 → 生成空 div、
	// 正文静默消失且不报错。v1 经典格式把每行正文都写成「- xxx」全被解析成 list,
	// 于是打印 PDF 只剩标题与段头条,而墨迹检测/非空检测照旧通过、还提示「已打开打印窗口」。
	// docx 与矢量 PDF 两端本就齐全,此处补齐三端一致。
	if(block.type === 'list'){
		const items = Array.isArray(block.items) ? block.items : [];
		const wrap = el('div', 'margin:2px 0;');
		items.forEach((item)=>{
			const depth = Math.max(0, Math.min(4, Number(item.depth) || 0));
			const marker = item.ordered
				? `${item.marker && /\d/.test(item.marker) ? item.marker : '1.'} `
				: '· ';
			const row = el('div', `font:13px/1.7 ${PDF_FONT};color:#111111;margin:1px 0;padding-left:${12 + depth * 14}px;white-space:pre-wrap;word-break:break-word;`);
			row.appendChild(document.createTextNode(marker));
			appendInlineMd(row, item.text || '');
			wrap.appendChild(row);
		});
		return wrap;
	}
	if(block.type === 'code'){
		return el('div', `font:12px/1.6 "SFMono-Regular",Menlo,Consolas,monospace;color:#333340;background:#f4f4f6;margin:4px 0;padding:6px 8px;white-space:pre-wrap;word-break:break-word;`, block.text || '');
	}
	if(block.type === 'quote'){
		return appendInlineMd(el('div', `font:italic 13px/1.7 ${PDF_FONT};color:#666666;margin:2px 0;padding-left:12px;border-left:3px solid #dddddd;white-space:pre-wrap;word-break:break-word;`), block.text || '');
	}
	if(block.type === 'hr'){
		return el('div', 'margin:8px 0;border-top:1px solid #dddddd;height:0;');
	}
	if(block.type === 'image'){
		const box = el('div', 'margin:6px 0;');
		if(block.src){
			const img = el('img', 'max-width:100%;display:block;');
			img.setAttribute('src', block.src);
			if(block.alt){ img.setAttribute('alt', block.alt); }
			box.appendChild(img);
		}else if(block.alt){
			box.appendChild(el('div', `font:italic 12px/1.6 ${PDF_FONT};color:#777777;`, `[图] ${block.alt}`));
		}
		return box;
	}
	return appendInlineMd(el('div', `font:13px/1.7 ${PDF_FONT};color:#111111;margin:2px 0;white-space:pre-wrap;word-break:break-word;`), block.text || '');
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
