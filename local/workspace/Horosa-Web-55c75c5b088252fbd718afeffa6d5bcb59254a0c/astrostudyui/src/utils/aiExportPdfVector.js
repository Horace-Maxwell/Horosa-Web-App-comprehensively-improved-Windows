// aiExportPdfVector.js — 可选中文字 PDF 矢量导出（pdf-lib + 内嵌中文子集字体 HorosaCJK-subset.ttf）。
// ★字体必须 TrueType(glyf) 且整嵌：OTF/CFF 经 pdf-lib 产出非法内嵌文件→Preview/poppler 拒渲=乱码;
//   见 buildExportPdfVectorBlob 内 embedFont 处「血泪根因」注释与 aiExportPdfVector.test.js 守卫。
//
// 为什么另起一路（相较打印式 exportPdfPrintable）：
//   用户要「文字可选 + 自己的另存为对话框(选位置+改名)，不弹系统打印页」。打印式虽文字可选但必走
//   系统打印窗；本路径在 App 内生成 PDF 字节 → 走既有 downloadBlob 的 <a download>（桌面 webview 触发
//   原生另存为对话框，dev 浏览器触发下载），全程不弹打印窗。中文可选文字须内嵌中文字体（打印式靠系统
//   字体渲染故无需内嵌，本路径必须内嵌）→ 打包一个 GB2312+繁+韩+符号 子集字体（TrueType ~2.7MB，OFL 可嵌入）。
//
// 铁律：任何缺依赖/取字体失败/异常 → 抛出，由 exportPdf 包装层回退打印式→栅格（绝不因新路径失败而无产物）。
import { parseAiExportDocument, mdInlineSegments } from './aiExportDocModel';

const FONT_URLS = ['./fonts/HorosaCJK-subset.ttf', '/fonts/HorosaCJK-subset.ttf'];
// [E5] 描边合成粗体系数(×字号):本字体无 Bold 字重,粗体段用 Tr2(FillAndOutline)描边增重——
//   零字体资产、advance 宽度不变(不影响排版度量)、文字提取不重复(双遍偏移法会让复制出重复词)。
const BOLD_STROKE = 0.028;
let _fontBytesPromise = null;

// 字体只取一次（模块级缓存）。相对 './fonts' 优先（桌面 file/hash 路由与 dev `/` 皆解析为 <root>/fonts）。
async function loadFontBytes(){
	if(_fontBytesPromise){ return _fontBytesPromise; }
	_fontBytesPromise = (async ()=>{
		let lastErr = null;
		for(let i = 0; i < FONT_URLS.length; i++){
			try{
				const res = await fetch(FONT_URLS[i]);
				if(res && res.ok){
					const buf = await res.arrayBuffer();
					if(buf && buf.byteLength > 10000){ return buf; }
				}
				lastErr = new Error(`font ${FONT_URLS[i]} status ${res && res.status}`);
			}catch(e){ lastErr = e; }
		}
		_fontBytesPromise = null;   // 允许下次重试
		throw lastErr || new Error('font unavailable');
	})();
	return _fontBytesPromise;
}

// CJK 感知换行：拉丁词/数字整体不断，CJK 与其它字符逐字可断；显式 \n 强制换行。
// atom = 一段拉丁数字(含内部 .-_/@% 连接)｜一段空格｜任意单字符。
function segmentAtoms(text){
	const re = /[A-Za-z0-9]+(?:[.\-_/@%:][A-Za-z0-9]+)*|[ \t]+|[\s\S]/g;
	const atoms = [];
	let m;
	while((m = re.exec(text)) !== null){ atoms.push(m[0]); }
	return atoms;
}

// [E5] 富文本换行:runs(mdInlineSegments 产物)→ 行数组;原子级装箱(与 wrapText 同款贪心),
// 行内相邻同样式原子合并回 run(减少 drawText 次数)。空 runs → 单空行(与 wrapText 空段行为一致)。
function wrapRuns(runs, font, size, maxWidth){
	const atoms = [];
	(runs || []).forEach((r)=>{
		segmentAtoms(`${r.text == null ? '' : r.text}`).forEach((t)=>{ atoms.push({ t, bold: !!r.bold, code: !!r.code }); });
	});
	const lines = [];
	let cur = [];
	let curW = 0;
	for(let i = 0; i < atoms.length; i++){
		const atom = atoms[i];
		let w = 0;
		try{ w = font.widthOfTextAtSize(atom.t, size); }catch(e){ w = size * atom.t.length; }
		if(cur.length && curW + w > maxWidth && atom.t.trim() !== ''){
			lines.push(cur);
			cur = [atom]; curW = w;
		}else{
			cur.push(atom); curW += w;
		}
	}
	lines.push(cur);
	return lines.map((atomLine)=>{
		const merged = [];
		atomLine.forEach((a)=>{
			const prev = merged[merged.length - 1];
			if(prev && prev.bold === a.bold && prev.code === a.code){ prev.text += a.t; }
			else{ merged.push({ text: a.t, bold: a.bold, code: a.code }); }
		});
		return merged;
	});
}
function runsLineText(runsLine){
	return (runsLine || []).map((r)=>r.text).join('');
}

function wrapText(text, font, size, maxWidth){
	const lines = [];
	const src = `${text == null ? '' : text}`;
	const paras = src.split('\n');
	for(let p = 0; p < paras.length; p++){
		const para = paras[p];
		if(para === ''){ lines.push(''); continue; }
		const atoms = segmentAtoms(para);
		let cur = '';
		let curW = 0;
		for(let a = 0; a < atoms.length; a++){
			const atom = atoms[a];
			let w = 0;
			try{ w = font.widthOfTextAtSize(atom, size); }catch(e){ w = size * atom.length; }
			if(cur !== '' && curW + w > maxWidth && atom.trim() !== ''){
				lines.push(cur);
				cur = atom; curW = w;
			}else{
				cur += atom; curW += w;
			}
		}
		lines.push(cur);
	}
	return lines;
}

// 主入口：payload → PDF Blob（可选中文字）。失败抛出由上层回退。
export async function buildExportPdfVectorBlob(payload, hooks){
	const pdfLib = await import('pdf-lib');
	const fontkitMod = await import('@pdf-lib/fontkit');
	const fontkit = fontkitMod.default || fontkitMod;
	const { PDFDocument, rgb, degrees, setTextRenderingMode, setLineWidth, setStrokingColor, TextRenderingMode } = pdfLib;
	const fontBytes = await loadFontBytes();

	const pdf = await PDFDocument.create();
	pdf.registerFontkit(fontkit);
	// 字体必须是 TrueType(glyf) + 整嵌(subset:false)。血泪根因(2026-07-14 实证 pdffonts/poppler/Node):
	//   ① CFF/OTF 经 pdf-lib 产出的内嵌字体文件结构非法 → strict 渲染器(macOS Preview/poppler)拒绝
	//      渲染 → 整份中文乱码(pdffonts 报 "Embedded font file may be invalid" ×N;旧 .otf 正是此坑);
	//   ② 即便换 TrueType,subset:true 时 @pdf-lib/fontkit 会「静默丢字形」(不抛错)→ 大量缺字+字距错乱。
	//   唯 TrueType(glyf) + subset:false 同时满足「字体文件有效」与「全字形在位」(三向实证:poppler 0 错、
	//   pdftext 全文可提、pdftoppm 渲染逐字正确)。字体已是 GB2312+繁+韩 子集(~2.7MB)非全字库,整嵌可控。
	const font = await pdf.embedFont(fontBytes, { subset: false });

	const PAGE_W = 595.28;   // A4 pt
	const PAGE_H = 841.89;
	const M = 42;            // 页边距
	const FOOT = 26;         // 页脚（页码）预留
	const contentW = PAGE_W - 2 * M;
	const INK = rgb(0.07, 0.07, 0.07);
	const MUTED = rgb(0.42, 0.42, 0.42);
	const SECBG = rgb(0.24, 0.33, 0.47);
	const SUBINK = rgb(0.10, 0.16, 0.29);

	let page = pdf.addPage([PAGE_W, PAGE_H]);
	let y = PAGE_H - M;
	const newPage = ()=>{ page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; };
	const ensure = (h)=>{ if(y - h < M + FOOT){ newPage(); } };

	// 画一段（自动换行 + 跨页），返回消耗高度。
	const drawLines = (text, size, color, opts = {})=>{
		const x = opts.x != null ? opts.x : M;
		const maxW = opts.maxW != null ? opts.maxW : contentW;
		const lh = size * (opts.lh || 1.5);
		const lines = wrapText(text, font, size, maxW);
		for(let i = 0; i < lines.length; i++){
			ensure(lh);
			if(lines[i] !== ''){ page.drawText(lines[i], { x, y: y - size, size, font, color }); }
			y -= lh;
		}
	};

	// [E5] 单行富文本落笔(不动全局 y):粗体段以 Tr2(填充+描边)合成粗。drawText 内部 q…Q 包裹,
	// 在其之前置的 Tr/线宽/描边色被继承进文本绘制,绘后显式复位 Tr0(状态在 Q 后仍持续,必须复位)。
	const drawRunsLineAt = (runsLine, x, baselineY, size, color)=>{
		let cx = x;
		for(let i = 0; i < runsLine.length; i++){
			const r = runsLine[i];
			if(r.text === ''){ continue; }
			let w = 0;
			try{ w = font.widthOfTextAtSize(r.text, size); }catch(e){ w = size * r.text.length; }
			if(r.bold){
				page.pushOperators(setTextRenderingMode(TextRenderingMode.FillAndOutline), setLineWidth(size * BOLD_STROKE), setStrokingColor(color));
				page.drawText(r.text, { x: cx, y: baselineY, size, font, color });
				page.pushOperators(setTextRenderingMode(TextRenderingMode.Fill));
			}else{
				page.drawText(r.text, { x: cx, y: baselineY, size, font, color });
			}
			cx += w;
		}
	};
	// [E5] 富 runs 流式绘制(自动换行+跨页;对应纯文本版 drawLines 的 runs 版)。
	const drawRuns = (runs, size, color, opts = {})=>{
		const x = opts.x != null ? opts.x : M;
		const maxW = opts.maxW != null ? opts.maxW : contentW;
		const lh = size * (opts.lh || 1.5);
		const lines = wrapRuns(runs, font, size, maxW);
		for(let i = 0; i < lines.length; i++){
			ensure(lh);
			if(lines[i].length){ drawRunsLineAt(lines[i], x, y - size, size, color); }
			y -= lh;
		}
	};
	// [E5] 富文本段绘制:逐段(\n)消化行内记号(**粗**/*斜*/`码` 剥记号,粗体真加粗)。
	const drawRichText = (text, size, color, opts = {})=>{
		const paras = `${text == null ? '' : text}`.split('\n');
		for(let p = 0; p < paras.length; p++){ drawRuns(mdInlineSegments(paras[p]), size, color, opts); }
	};

	const drawTable = (block)=>{
		const cols = (block.headers && block.headers.length) || (block.rows && block.rows[0] ? block.rows[0].length : 0);
		if(!cols){ return; }
		const colW = contentW / cols;
		const size = 8.5;
		const pad = 3;
		const cellMaxW = colW - 2 * pad;
		const lh = size * 1.35;
		const measureRow = (cells)=>{
			// [E5] 单元格走富文本分段(记号消化;Tr2 描边不改 advance 宽度,量宽无需区分粗细)。
			const wrapped = [];
			let maxLines = 1;
			for(let c = 0; c < cols; c++){
				const raw = cells && cells[c] != null ? `${cells[c]}` : '';
				const ls = wrapRuns(mdInlineSegments(raw), font, size, cellMaxW);
				wrapped.push(ls);
				if(ls.length > maxLines){ maxLines = ls.length; }
			}
			return { wrapped, rowH: maxLines * lh + 2 * pad };
		};
		const paintRow = (measured, isHeader)=>{
			const { wrapped, rowH } = measured;
			const top = y;
			if(isHeader){ page.drawRectangle({ x: M, y: top - rowH, width: contentW, height: rowH, color: rgb(0.93, 0.945, 0.965) }); }
			for(let c = 0; c < cols; c++){
				const cx = M + c * colW;
				page.drawRectangle({ x: cx, y: top - rowH, width: colW, height: rowH, borderColor: rgb(0.72, 0.72, 0.72), borderWidth: 0.5 });
				let ty = top - pad - size;
				const ls = wrapped[c];
				for(let li = 0; li < ls.length; li++){
					if(ls[li].length){
						// 表头整行加粗(Tr2 不改宽度,量宽无需重算)
						drawRunsLineAt(isHeader ? ls[li].map((r)=>({ ...r, bold: true })) : ls[li], cx + pad, ty, size, INK);
					}
					ty -= lh;
				}
			}
			y -= rowH;
			if(hooks && typeof hooks.onTableRow === 'function'){
				hooks.onTableRow({ pageIndex: pdf.getPageCount() - 1, isHeader, firstCell: runsLineText((measured.wrapped[0] || [])[0]) });
			}
		};
		const headerMeasured = (block.headers && block.headers.length) ? measureRow(block.headers) : null;
		// [A3] 跨页表头重绘:长表 body 行触底换页后,新页首行必须先重画表头(与打印路径
		// `<thead>` 每页重复的行为对齐)。旧式表头只画一次,第二页起裸行无表头。
		const ensureRowWithHeader = (rowH)=>{
			if(y - rowH < M + FOOT){
				newPage();
				if(headerMeasured){ paintRow(headerMeasured, true); }
			}
		};
		if(headerMeasured){
			ensure(headerMeasured.rowH + lh);   // 表头至少带上一行 body 的空间,防「页底孤表头」
			paintRow(headerMeasured, true);
		}
		(block.rows || []).forEach((r)=>{
			const measured = measureRow(r);
			ensureRowWithHeader(measured.rowH);
			paintRow(measured, false);
		});
		y -= 5;
	};

	// [B2] 新块型渲染:code/quote/list(有序·嵌套)/image/hr —— 与 IR 解析器同步扩面。
	const drawCode = (block)=>{
		const size = 8.5;
		const lh = size * 1.5;
		const pad = 6;
		const srcLines = `${block.text || ''}`.split('\n');
		const wrapped = [];
		srcLines.forEach((l)=>{ wrapText(l, font, size, contentW - 2 * pad).forEach((w)=>wrapped.push(w)); });
		if(!wrapped.length){ wrapped.push(''); }
		let idx = 0;
		while(idx < wrapped.length){
			// 每页一段:量可容行数,画底色矩形再落行(跨页各自有底色,零裁字)
			ensure(lh + 2 * pad);
			const avail = Math.floor((y - (M + FOOT) - 2 * pad) / lh);
			const take = Math.max(1, Math.min(avail, wrapped.length - idx));
			const boxH = take * lh + 2 * pad;
			page.drawRectangle({ x: M, y: y - boxH, width: contentW, height: boxH, color: rgb(0.955, 0.955, 0.96) });
			let ty = y - pad - size;
			for(let k = 0; k < take; k++){
				if(wrapped[idx + k] !== ''){ page.drawText(wrapped[idx + k], { x: M + pad, y: ty, size, font, color: rgb(0.2, 0.2, 0.25) }); }
				ty -= lh;
			}
			y -= boxH;
			idx += take;
			if(idx < wrapped.length){ newPage(); }
		}
		y -= 5;
	};
	const drawQuote = (block)=>{
		const startY = y;
		drawRichText(block.text || '', 9.8, MUTED, { x: M + 10, maxW: contentW - 10, lh: 1.55 });
		// 左侧引用条(同页段内;跨页段的条只画首页段——视觉可接受,文字完整优先)
		const barH = Math.max(0, startY - y - 2);
		if(barH > 0){ page.drawRectangle({ x: M + 2, y: y + 2, width: 2.4, height: barH, color: rgb(0.72, 0.72, 0.76) }); }
		y -= 4;
	};
	const drawList = (block)=>{
		const size = 10.5;
		const counters = [0, 0, 0, 0, 0];
		(block.items || []).forEach((item)=>{
			const depth = Math.max(0, Math.min(4, Number(item.depth) || 0));
			for(let d = depth + 1; d < counters.length; d++){ counters[d] = 0; }
			let marker = '•';
			if(item.ordered){ counters[depth] += 1; marker = `${counters[depth]}.`; }
			const indent = M + depth * 14;
			const markerW = font.widthOfTextAtSize(`${marker} `, size);
			const textX = indent + markerW;
			const lines = wrapRuns(mdInlineSegments(`${item.text || ''}`), font, size, contentW - (textX - M));
			ensure(size * 1.6);
			page.drawText(marker, { x: indent, y: y - size, size, font, color: INK });
			for(let li = 0; li < lines.length; li++){
				if(li > 0){ ensure(size * 1.6); }
				if(lines[li].length){ drawRunsLineAt(lines[li], textX, y - size, size, INK); }
				y -= size * 1.6;
			}
		});
		y -= 4;
	};
	const drawImageBlock = async (block)=>{
		const src = `${block.src || ''}`;
		if(!/^data:image\//.test(src)){ drawLines(`[图]${block.alt || src}`, 9.5, MUTED, {}); return; }
		try{
			const img = /^data:image\/png/i.test(src) ? await pdf.embedPng(src) : await pdf.embedJpg(src);
			const maxW = contentW;
			const maxH = PAGE_H - 2 * M - FOOT - 20;
			const scale = Math.min(maxW / img.width, maxH / img.height, 1);
			const w = img.width * scale;
			const h = img.height * scale;
			ensure(h + 6);
			page.drawImage(img, { x: M + (contentW - w) / 2, y: y - h, width: w, height: h });
			y -= h + 8;
		}catch(e){ drawLines(`[图未嵌入]${block.alt || ''}`, 9.5, MUTED, {}); }
	};
	const drawHr = ()=>{
		ensure(12);
		page.drawRectangle({ x: M, y: y - 6, width: contentW, height: 0.7, color: rgb(0.8, 0.8, 0.82) });
		y -= 14;
	};

	const drawBlock = async (block)=>{
		if(!block){ return; }
		if(block.type === 'table'){ drawTable(block); return; }
		if(block.type === 'code'){ drawCode(block); return; }
		if(block.type === 'quote'){ drawQuote(block); return; }
		if(block.type === 'list'){ drawList(block); return; }
		if(block.type === 'image'){ await drawImageBlock(block); return; }
		if(block.type === 'hr'){ drawHr(); return; }
		if(block.type === 'subhead'){
			ensure(16);
			page.drawRectangle({ x: M, y: y - 13, width: 3, height: 13, color: rgb(0.29, 0.44, 0.65) });
			drawRichText(block.text || '', 11.5, SUBINK, { x: M + 8, maxW: contentW - 8, lh: 1.4 });
			y -= 2;
			return;
		}
		if(block.type === 'note'){ drawRichText(block.text || '', 9.5, MUTED, { lh: 1.5 }); return; }
		if(block.type === 'kv'){
			// [E5] 键整体加粗(键内 **引导词** 记号一并消化),值走行内分段。kv 键值均为单行(解析约定)。
			const kvRuns = mdInlineSegments(`${block.key}：`).map((s)=>({ ...s, bold: true })).concat(mdInlineSegments(`${block.value || ''}`));
			drawRuns(kvRuns, 10.5, INK, { lh: 1.55 });
			return;
		}
		drawRichText(block.text || '', 10.5, INK, { lh: 1.6 });
	};

	// —— 截图（若开）：独占首页，居中缩放 ——
	const shot = payload && payload.screenshot;
	if(shot && shot.dataUrl){
		try{
			const jpg = await pdf.embedJpg(shot.dataUrl);
			const availW = contentW;
			const availH = PAGE_H - 2 * M;
			const scale = Math.min(availW / jpg.width, availH / jpg.height);
			const w = jpg.width * scale;
			const h = jpg.height * scale;
			page.drawImage(jpg, { x: M + (availW - w) / 2, y: PAGE_H - M - h, width: w, height: h });
			newPage();
		}catch(e){ /* 截图嵌入失败：跳过，仍出正文 */ }
	}

	// —— 标题 + 头部 ——
	// [B1] 报告链直供 IR(__docOverride):跳过纯文本反推,标题不再带「· AI 导出」尾缀。
	const docOverride = payload && payload.__docOverride;
	drawLines(docOverride ? `${(payload && payload.tech) || '报告'}` : `${(payload && payload.tech) || '导出'} · AI 导出`, 18, INK, { lh: 1.4 });
	y -= 4;
	const doc = docOverride || parseAiExportDocument(payload && payload.text);
	if(doc.preamble){ drawLines(doc.preamble, 9.5, MUTED, { lh: 1.55 }); y -= 6; }

	// —— 分区 + 段块 ——
	for(const sec of (doc.sections || [])){
		ensure(22);
		const barH = 18;
		page.drawRectangle({ x: M, y: y - barH + 3, width: contentW, height: barH, color: SECBG });
		page.drawText(`${sec.title || ''}`, { x: M + 7, y: y - barH + 8, size: 11, font, color: rgb(1, 1, 1) });
		y -= barH + 7;
		for(const b of (sec.blocks || [])){ await drawBlock(b); }   // [B2] image 块 embed 为异步
		y -= 5;
	}

	// —— 页码 + [B3] 导出主题(水印/页眉/页脚,每页绘制;theme 缺省=只画页码,零变)——
	const theme = (hooks && hooks.theme) || null;
	const pages = pdf.getPages();
	const total = pages.length;
	for(let i = 0; i < total; i++){
		const label = `${i + 1} / ${total}`;
		let lw = 0;
		try{ lw = font.widthOfTextAtSize(label, 9); }catch(e){ lw = 24; }
		pages[i].drawText(label, { x: (PAGE_W - lw) / 2, y: 18, size: 9, font, color: rgb(0.6, 0.6, 0.6) });
		if(theme && theme.headerText){
			let hw = 0;
			try{ hw = font.widthOfTextAtSize(`${theme.headerText}`, 8.5); }catch(e){ hw = 40; }
			pages[i].drawText(`${theme.headerText}`, { x: (PAGE_W - hw) / 2, y: PAGE_H - 22, size: 8.5, font, color: rgb(0.62, 0.62, 0.66) });
		}
		if(theme && theme.footerText){
			pages[i].drawText(`${theme.footerText}`, { x: M, y: 18, size: 8, font, color: rgb(0.65, 0.65, 0.68) });
		}
		if(theme && theme.watermarkText){
			const wm = `${theme.watermarkText}`;
			let ww = 0;
			try{ ww = font.widthOfTextAtSize(wm, 42); }catch(e){ ww = 200; }
			pages[i].drawText(wm, {
				x: (PAGE_W - ww * 0.72) / 2,
				y: PAGE_H / 2 - 20,
				size: 42,
				font,
				color: rgb(0.55, 0.55, 0.58),
				opacity: 0.12,
				rotate: degrees(28),
			});
		}
	}

	const bytes = await pdf.save();
	return new Blob([bytes], { type: 'application/pdf' });
}

export default buildExportPdfVectorBlob;
