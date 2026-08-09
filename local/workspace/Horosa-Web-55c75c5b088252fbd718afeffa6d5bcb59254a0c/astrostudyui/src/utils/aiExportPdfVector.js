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
// [E11] 真 Bold 字重(与 Regular 同源 Noto Sans CJK SC、同 upem、码位完全一致;
// 由 scripts/build_cjk_bold_subset.py 生成并硬校验)。取不到 → 回落下面的描边合成,绝不失败。
const BOLD_FONT_URLS = ['./fonts/HorosaCJK-Bold-subset.ttf', '/fonts/HorosaCJK-Bold-subset.ttf'];
// [E5] 描边合成粗体系数(×字号):**Bold 字体不可用时的降级路径**——用 Tr2(FillAndOutline)
//   描边增重。零字体资产、advance 宽度不变、文字提取不重复(双遍偏移法会让复制出重复词)。
const BOLD_STROKE = 0.028;
let _fontBytesPromise = null;
let _boldFontBytesPromise = null;

async function fetchFirstFont(urls){
	let lastErr = null;
	for(let i = 0; i < urls.length; i++){
		try{
			const res = await fetch(urls[i]);
			if(res && res.ok){
				const buf = await res.arrayBuffer();
				if(buf && buf.byteLength > 10000){ return buf; }
			}
			lastErr = new Error(`font ${urls[i]} status ${res && res.status}`);
		}catch(e){ lastErr = e; }
	}
	throw lastErr || new Error('font unavailable');
}

// 字体只取一次（模块级缓存）。相对 './fonts' 优先（桌面 file/hash 路由与 dev `/` 皆解析为 <root>/fonts）。
async function loadFontBytes(){
	if(_fontBytesPromise){ return _fontBytesPromise; }
	_fontBytesPromise = fetchFirstFont(FONT_URLS).catch((e)=>{ _fontBytesPromise = null; throw e; });
	return _fontBytesPromise;
}

// Bold 是**增强项**:取不到不抛,返回 null 让调用方降级到描边合成(正文一定要出得来)。
async function loadBoldFontBytes(){
	if(_boldFontBytesPromise){ return _boldFontBytesPromise; }
	_boldFontBytesPromise = fetchFirstFont(BOLD_FONT_URLS).catch(()=>{ _boldFontBytesPromise = null; return null; });
	return _boldFontBytesPromise;
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
// [E11] 🔴 fontOf(bold) 取代原来的单一 font 参数:真 Bold 字重的 advance **与 Regular 不同**
// (旧注释「Tr2 不改宽度、量宽无需区分粗细」自此失效)—— 量宽与落笔必须用同一副字体,
// 否则整份 PDF 断行错位、表格串列。atom.bf = 本原子是否真用 Bold 字面(false 且 bold=true
// 时走描边合成降级)。
function wrapRuns(runs, fontOf, size, maxWidth, opts){
	const forceBold = !!(opts && opts.forceBold);
	const boldOk = (opts && opts.boldOk) || (()=>true);
	const atoms = [];
	(runs || []).forEach((r)=>{
		const bold = forceBold || !!r.bold;
		segmentAtoms(`${r.text == null ? '' : r.text}`).forEach((t)=>{
			// em/del 也必须随原子带下去 —— 否则 drawRunsLineAt 里的斜体弱化色与删除线永远不触发
			atoms.push({ t, bold, bf: bold && boldOk(t), code: !!r.code, em: !!r.em, del: !!r.del });
		});
	});
	const lines = [];
	let cur = [];
	let curW = 0;
	for(let i = 0; i < atoms.length; i++){
		const atom = atoms[i];
		let w = 0;
		try{ w = fontOf(atom.bf).widthOfTextAtSize(atom.t, size); }catch(e){ w = size * atom.t.length; }
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
			if(prev && prev.bold === a.bold && prev.bf === a.bf && prev.code === a.code && prev.em === a.em && prev.del === a.del){ prev.text += a.t; }
			else{ merged.push({ text: a.t, bold: a.bold, bf: a.bf, code: a.code, em: a.em, del: a.del }); }
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
	// [E11] 真 Bold 字重:同源同覆盖的 Bold 子集(build_cjk_bold_subset.py 硬校验码位一致)。
	// 取不到 / 内嵌失败 → boldFont=null,粗体段自动回落到 Tr2 描边合成(旧路径完整保留)。
	let boldFont = null;
	let boldCharSet = null;
	try{
		const boldBytes = await loadBoldFontBytes();
		if(boldBytes){
			boldFont = await pdf.embedFont(boldBytes, { subset: false });
			// 兜底:万一 Bold 少字形,PDF 里会静默出 .notdef 空白方块 —— 逐原子查覆盖,
			// 未覆盖的原子退回「Regular + 描边」,宁可假粗也不能空白。
			try{ boldCharSet = new Set(boldFont.getCharacterSet()); }catch(_){ boldCharSet = null; }
		}
	}catch(_){ boldFont = null; boldCharSet = null; }
	const boldOk = (t)=>{
		if(!boldFont){ return false; }
		if(!boldCharSet){ return true; }
		const s = `${t == null ? '' : t}`;
		for(const ch of s){ if(!boldCharSet.has(ch.codePointAt(0))){ return false; } }
		return true;
	};
	const fontOf = (useBoldFace)=> (useBoldFace && boldFont) ? boldFont : font;

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
			const f = fontOf(r.bf);
			let w = 0;
			try{ w = f.widthOfTextAtSize(r.text, size); }catch(e){ w = size * r.text.length; }
			// [E11] 行内码:补一块浅底(与应用内 .xq-md-v2 的 code 底色同一视觉语言)。
			// 本引擎只内嵌一副 CJK 字族,没有等宽/斜体字面 —— 用底色/字色区分,不硬造字形。
			if(r.code){
				page.drawRectangle({ x: cx - 1, y: baselineY - size * 0.22, width: w + 2, height: size * 1.18, color: rgb(0.955, 0.955, 0.965) });
			}
			// 纯斜体段:无斜体字面,退而用弱化字色表示语气(与应用内 em 的 text-soft 一致)
			const runColor = (r.em && !r.bold && !r.code) ? rgb(0.42, 0.42, 0.46) : color;
			if(r.bf){
				// [E11] 真 Bold 字面:直接用 Bold 字体落笔,不再描边
				page.drawText(r.text, { x: cx, y: baselineY, size, font: f, color });
			}else if(r.bold){
				// 降级:Bold 字体不可用(或该字未被覆盖)→ Tr2 描边合成
				page.pushOperators(setTextRenderingMode(TextRenderingMode.FillAndOutline), setLineWidth(size * BOLD_STROKE), setStrokingColor(color));
				page.drawText(r.text, { x: cx, y: baselineY, size, font: f, color });
				page.pushOperators(setTextRenderingMode(TextRenderingMode.Fill));
			}else{
				page.drawText(r.text, { x: cx, y: baselineY, size, font: f, color: runColor });
			}
			if(r.del){
				// [E11] 删除线:tokenizer 现在会产 del 段,PDF 端补一条细横线(此前 ~~ 记号被吃掉、无表现)
				page.drawRectangle({ x: cx, y: baselineY + size * 0.28, width: w, height: Math.max(0.4, size * 0.045), color });
			}
			cx += w;
		}
	};
	// [E5] 富 runs 流式绘制(自动换行+跨页;对应纯文本版 drawLines 的 runs 版)。
	const drawRuns = (runs, size, color, opts = {})=>{
		const x = opts.x != null ? opts.x : M;
		const maxW = opts.maxW != null ? opts.maxW : contentW;
		const lh = size * (opts.lh || 1.5);
		const lines = wrapRuns(runs, fontOf, size, maxW, { boldOk });
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
		// [E11] 🔴 forceBold 必须在**量宽时**就传进去:表头整行加粗,而真 Bold 的 advance 比
		// Regular 宽——沿用旧的「画的时候再 map bold:true」会按细体的宽度排版、表头串列。
		const measureRow = (cells, forceBold)=>{
			const wrapped = [];
			let maxLines = 1;
			for(let c = 0; c < cols; c++){
				const raw = cells && cells[c] != null ? `${cells[c]}` : '';
				const ls = wrapRuns(mdInlineSegments(raw), fontOf, size, cellMaxW, { boldOk, forceBold });
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
					// 表头的加粗已在 measureRow(cells, true) 阶段落进 run(量宽/落笔同一副字体)
					if(ls[li].length){ drawRunsLineAt(ls[li], cx + pad, ty, size, INK); }
					ty -= lh;
				}
			}
			y -= rowH;
			if(hooks && typeof hooks.onTableRow === 'function'){
				hooks.onTableRow({ pageIndex: pdf.getPageCount() - 1, isHeader, firstCell: runsLineText((measured.wrapped[0] || [])[0]) });
			}
		};
		const headerMeasured = (block.headers && block.headers.length) ? measureRow(block.headers, true) : null;
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
			const lines = wrapRuns(mdInlineSegments(`${item.text || ''}`), fontOf, size, contentW - (textX - M), { boldOk });
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
	const doc = docOverride || parseAiExportDocument(payload && payload.text);
	// [E11] 封面 + 目录页:仅报告链(hooks.cover)启用 —— 技法 AI 导出走原路径,产物字节不变。
	const cover = (hooks && hooks.cover) || null;
	const docTitle = docOverride ? `${(payload && payload.tech) || '报告'}` : `${(payload && payload.tech) || '导出'} · AI 导出`;
	const tocPages = [];
	const sectionPageAt = [];   // 各节起始页 index(渲染完才知道 → 事后回填目录页码)
	if(cover){
		// 封面:细金线 + 大标题 + 一句话结论 + 元信息两列
		const cy0 = PAGE_H * 0.62;
		page.drawRectangle({ x: M, y: cy0 + 26, width: 46, height: 2.4, color: SECBG });
		y = cy0;
		drawLines(`${cover.title || docTitle}`, 24, INK, { lh: 1.32, maxW: contentW - 40 });
		y -= 10;
		if(cover.lead){ drawLines(`${cover.lead}`, 10.5, MUTED, { lh: 1.6, maxW: contentW - 60 }); y -= 12; }
		page.drawRectangle({ x: M, y: y - 2, width: contentW, height: 0.6, color: rgb(0.86, 0.86, 0.88) });
		y -= 16;
		(cover.meta || []).filter((m)=>m && m.v).forEach((m)=>{
			page.drawText(`${m.k}`, { x: M, y: y - 9, size: 8.5, font, color: rgb(0.62, 0.62, 0.66) });
			page.drawText(`${m.v}`, { x: M + 58, y: y - 9, size: 9, font, color: INK });
			y -= 15;
		});
		newPage();
		// 目录页按节数预留(每页 30 条),不足/超出都不会把正文挤走
		const tocPageCount = Math.max(1, Math.ceil(((doc.sections || []).length || 1) / 30));
		for(let i = 0; i < tocPageCount; i++){
			tocPages.push(page);
			if(i < tocPageCount - 1){ newPage(); }
		}
		newPage();
	}else{
		drawLines(docTitle, 18, INK, { lh: 1.4 });
		y -= 4;
	}
	if(doc.preamble){ drawLines(doc.preamble, 9.5, MUTED, { lh: 1.55 }); y -= 6; }

	// —— 分区 + 段块 ——
	for(const sec of (doc.sections || [])){
		ensure(22);
		sectionPageAt.push(pdf.getPageCount() - 1);
		const barH = 18;
		page.drawRectangle({ x: M, y: y - barH + 3, width: contentW, height: barH, color: SECBG });
		page.drawText(`${sec.title || ''}`, { x: M + 7, y: y - barH + 8, size: 11, font: fontOf(true), color: rgb(1, 1, 1) });
		y -= barH + 7;
		for(const b of (sec.blocks || [])){ await drawBlock(b); }   // [B2] image 块 embed 为异步
		y -= 5;
	}

	// [E11] 目录回填:此时才知道每节落在第几页 —— 点线引导 + 右对齐页码。
	if(cover && tocPages.length){
		const secs = doc.sections || [];
		let tp = 0;
		let ty = PAGE_H - M;
		const drawTocHead = ()=>{
			tocPages[tp].drawText(`${cover.tocLabel || '目录'}`, { x: M, y: ty - 14, size: 15, font: fontOf(true), color: INK });
			tocPages[tp].drawRectangle({ x: M, y: ty - 22, width: contentW, height: 0.6, color: rgb(0.86, 0.86, 0.88) });
			ty -= 38;
		};
		drawTocHead();
		for(let i = 0; i < secs.length; i++){
			if(ty < M + FOOT + 16 && tp < tocPages.length - 1){ tp++; ty = PAGE_H - M; drawTocHead(); }
			const label = `${i + 1}. ${secs[i].title || ''}`;
			const pageNo = `${(sectionPageAt[i] != null ? sectionPageAt[i] : 0) + 1}`;
			let lw = 0; let nw = 0;
			try{ lw = font.widthOfTextAtSize(label, 9.5); }catch(e){ lw = 9.5 * label.length; }
			try{ nw = font.widthOfTextAtSize(pageNo, 9.5); }catch(e){ nw = 9.5 * pageNo.length; }
			tocPages[tp].drawText(label, { x: M, y: ty, size: 9.5, font, color: INK });
			tocPages[tp].drawText(pageNo, { x: M + contentW - nw, y: ty, size: 9.5, font, color: MUTED });
			const dotX0 = M + lw + 6;
			const dotX1 = M + contentW - nw - 6;
			if(dotX1 > dotX0){
				tocPages[tp].drawRectangle({ x: dotX0, y: ty + 2.6, width: dotX1 - dotX0, height: 0.4, color: rgb(0.84, 0.84, 0.86) });
			}
			ty -= 17;
		}
	}

	// —— 页码 + [B3] 导出主题(水印/页眉/页脚,每页绘制;theme 缺省=只画页码,零变)——
	const theme = (hooks && hooks.theme) || null;
	const pages = pdf.getPages();
	const total = pages.length;
	for(let i = 0; i < total; i++){
		// [E11] 有封面时:封面页不画页码/页眉(通行的书籍排版口径),其余页加一条细页眉线 + 报告名。
		const isCoverPage = !!cover && i === 0;
		if(!isCoverPage){
			const label = `${i + 1} / ${total}`;
			let lw = 0;
			try{ lw = font.widthOfTextAtSize(label, 9); }catch(e){ lw = 24; }
			pages[i].drawText(label, { x: (PAGE_W - lw) / 2, y: 18, size: 9, font, color: rgb(0.6, 0.6, 0.6) });
		}
		if(cover && !isCoverPage && !(theme && theme.headerText)){
			const rh = `${cover.title || docTitle}`.slice(0, 46);
			pages[i].drawText(rh, { x: M, y: PAGE_H - 24, size: 8, font, color: rgb(0.68, 0.68, 0.72) });
			pages[i].drawRectangle({ x: M, y: PAGE_H - 29, width: contentW, height: 0.4, color: rgb(0.88, 0.88, 0.9) });
		}
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
