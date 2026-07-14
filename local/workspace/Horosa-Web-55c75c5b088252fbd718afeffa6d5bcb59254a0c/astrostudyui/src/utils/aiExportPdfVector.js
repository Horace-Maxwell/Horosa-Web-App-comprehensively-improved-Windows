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
import { parseAiExportDocument } from './aiExportDocModel';

const FONT_URLS = ['./fonts/HorosaCJK-subset.ttf', '/fonts/HorosaCJK-subset.ttf'];
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
export async function buildExportPdfVectorBlob(payload){
	const pdfLib = await import('pdf-lib');
	const fontkitMod = await import('@pdf-lib/fontkit');
	const fontkit = fontkitMod.default || fontkitMod;
	const { PDFDocument, rgb } = pdfLib;
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

	const drawTable = (block)=>{
		const cols = (block.headers && block.headers.length) || (block.rows && block.rows[0] ? block.rows[0].length : 0);
		if(!cols){ return; }
		const colW = contentW / cols;
		const size = 8.5;
		const pad = 3;
		const cellMaxW = colW - 2 * pad;
		const lh = size * 1.35;
		const drawRow = (cells, isHeader)=>{
			const wrapped = [];
			let maxLines = 1;
			for(let c = 0; c < cols; c++){
				const raw = cells && cells[c] != null ? `${cells[c]}` : '';
				const ls = wrapText(raw, font, size, cellMaxW);
				wrapped.push(ls);
				if(ls.length > maxLines){ maxLines = ls.length; }
			}
			const rowH = maxLines * lh + 2 * pad;
			ensure(rowH);
			const top = y;
			if(isHeader){ page.drawRectangle({ x: M, y: top - rowH, width: contentW, height: rowH, color: rgb(0.93, 0.945, 0.965) }); }
			for(let c = 0; c < cols; c++){
				const cx = M + c * colW;
				page.drawRectangle({ x: cx, y: top - rowH, width: colW, height: rowH, borderColor: rgb(0.72, 0.72, 0.72), borderWidth: 0.5 });
				let ty = top - pad - size;
				const ls = wrapped[c];
				for(let li = 0; li < ls.length; li++){
					if(ls[li] !== ''){ page.drawText(ls[li], { x: cx + pad, y: ty, size, font, color: INK }); }
					ty -= lh;
				}
			}
			y -= rowH;
		};
		if(block.headers && block.headers.length){ drawRow(block.headers, true); }
		(block.rows || []).forEach((r)=> drawRow(r, false));
		y -= 5;
	};

	const drawBlock = (block)=>{
		if(!block){ return; }
		if(block.type === 'table'){ drawTable(block); return; }
		if(block.type === 'subhead'){
			ensure(16);
			page.drawRectangle({ x: M, y: y - 13, width: 3, height: 13, color: rgb(0.29, 0.44, 0.65) });
			drawLines(block.text || '', 11.5, SUBINK, { x: M + 8, maxW: contentW - 8, lh: 1.4 });
			y -= 2;
			return;
		}
		if(block.type === 'note'){ drawLines(block.text || '', 9.5, MUTED, { lh: 1.5 }); return; }
		if(block.type === 'kv'){ drawLines(`${block.key}：${block.value || ''}`, 10.5, INK, { lh: 1.55 }); return; }
		drawLines(block.text || '', 10.5, INK, { lh: 1.6 });
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
	drawLines(`${(payload && payload.tech) || '导出'} · AI 导出`, 18, INK, { lh: 1.4 });
	y -= 4;
	const doc = parseAiExportDocument(payload && payload.text);
	if(doc.preamble){ drawLines(doc.preamble, 9.5, MUTED, { lh: 1.55 }); y -= 6; }

	// —— 分区 + 段块 ——
	(doc.sections || []).forEach((sec)=>{
		ensure(22);
		const barH = 18;
		page.drawRectangle({ x: M, y: y - barH + 3, width: contentW, height: barH, color: SECBG });
		page.drawText(`${sec.title || ''}`, { x: M + 7, y: y - barH + 8, size: 11, font, color: rgb(1, 1, 1) });
		y -= barH + 7;
		(sec.blocks || []).forEach((b)=> drawBlock(b));
		y -= 5;
	});

	// —— 页码 ——
	const pages = pdf.getPages();
	const total = pages.length;
	for(let i = 0; i < total; i++){
		const label = `${i + 1} / ${total}`;
		let lw = 0;
		try{ lw = font.widthOfTextAtSize(label, 9); }catch(e){ lw = 24; }
		pages[i].drawText(label, { x: (PAGE_W - lw) / 2, y: 18, size: 9, font, color: rgb(0.6, 0.6, 0.6) });
	}

	const bytes = await pdf.save();
	return new Blob([bytes], { type: 'application/pdf' });
}

export default buildExportPdfVectorBlob;
