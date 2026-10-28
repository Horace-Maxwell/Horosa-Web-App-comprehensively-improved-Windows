// AI 导出 · 文件输出:文件名、下载、画布墨迹判定、PDF(平铺 / 版式 / 打印 / 分块)、TXT、Word、DOCX。
// 由 utils/aiExport.js 门面统一对外导出。
import { withUtf8Bom, saveBlobSmart } from '../aiAnalysisExport';
// v2 呈现层底座(纯函数/轻量,jest 安全);重件 docx 渲染器走动态 import(exportDocx/exportPdfStyled 内)。
import { packBlocksIntoChunks } from '../aiExportDocModel';
import { getAIExportFormatPreference } from './settingsModel';
import { withOriginalScript, SCRIPT_KEEP_CLASS } from '../scriptMode';

export function safeFileName(name){
	const val = (name || 'export')
		.replace(/[\\/:*?"<>|]/g, '_')
		.replace(/\s+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
	return val || 'export';
}

function escapeHtml(str){
	return (str || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function pad2(num){
	return `${num}`.padStart(2, '0');
}

export function formatDateTime(date){
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function formatStamp(date){
	return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

function downloadBlob(filename, content, mime){
	// 🔧 文字类导出补 UTF-8 BOM(政策单源 aiAnalysisExport.withUtf8Bom:仅人读的 txt/Word/markdown 加,
	//   json/csv/pdf 等机读或二进制不加;content 非字符串时原样透传,天然安全)。
	// 落盘走全站单源 saveBlobSmart(桌面壳=保存桥选目录;取消/失败如实返回,调用方据此报)。
	const payload = withUtf8Bom(content, mime);
	const blob = new Blob([payload], { type: mime });
	return saveBlobSmart(filename, blob);
}
// 三态:true=已落盘 / false=未产出(调用方可降级) / 'cancelled'=用户取消保存(绝不降级、绝不报成功)。
function saveTri(r){
	if(r && r.cancelled){ return 'cancelled'; }
	return !!(r && r.ok);
}

// 复制统一走共享件 clipboardText.copyTextSmart(三级降级;原私有 copyText 逐字平移过去)。

// v2.6.10:弃用 window.open 打印窗(桌面 webview 拦截 + 浏览器弹窗拦截)。
// 改为离屏 DOM → html-to-image → jsPDF 分页直接下载 .pdf:无窗口、CJK 安全(走系统字体渲染成图)、
// 浏览器与 Tauri 一致(downloadBlob 路径既有,TXT/Word 同款已验证可用)。
// 修「PDF 全空白」:html-to-image 是克隆节点(内联样式)→ SVG foreignObject 栅格化,宿主若用
//   大负值离屏偏移,克隆携带该定位 → 画到视口外全白(html2canvas 同坑另有先例修法:
//   靠 onclone 复位;机制不同不能照抄,这边靠 style 克隆覆盖)。三层防线:
//   ① toCanvas 的 style 选项把克隆定位归零(顺带绕 WebKit foreignObject 定位层老 bug);
//   ② 宿主 fixed(0,0)+z-index:-1+pointer-events:none(即使 ① 回归,克隆 fixed(0,0) 落 SVG 原点仍出图);
//   ③ 墨迹守卫 + blob 尺寸守卫:空白绝不落盘假成功(失败由调用方降级 TXT)。

// 位图导出墨迹守卫:从顶向下按块扫描,命中非白像素即停(payload 恒以标题/header 行开篇 →
// 正常路径首块即命中,~1ms)。阈值沿既有同款实战值;canvas 异常按无墨迹处理(保守降级)。
export function canvasHasInk(canvas){
	try{
		if(!canvas || !canvas.width || !canvas.height){ return false; }
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if(!ctx){ return false; }
		const step = 64;
		const maxScan = Math.min(canvas.height, 4000);
		for(let y = 0; y < maxScan; y += step){
			const h = Math.min(step, maxScan - y);
			const data = ctx.getImageData(0, y, canvas.width, h).data;
			for(let i = 0; i < data.length; i += 4){
				if(data[i + 3] > 8 && (data[i] < 244 || data[i + 1] < 244 || data[i + 2] < 244)){
					return true;
				}
			}
		}
		return false;
	}catch(e){
		return false;
	}
}

const PDF_HOST_WIDTH = 794;                 // A4 宽 @96dpi
const PDF_MAX_CANVAS_EDGE = 16000;          // 设备px;浏览器 canvas 单边硬上限 32767,留足余量防静默空白/截断
const PDF_CHUNK_HEIGHT = 8000;              // CSS px;超限时按行分块逐块渲染续页

// PDF 内容分块(纯逻辑,可测):把 text 按「物理行占实测总高 fullH 的比例」摊成多块,
// 每块目标 CSS 高 ≈ chunkHeight。title 只进第 0 块。fullH<=0 或 chunkHeight<=0 → 单块(不分)。
// 关键:比例摊法对「少数超长物理行折成很多视觉行」也稳健——总高大而物理行少时每块自动收到 1 行,
// 不会像固定行数那样把长折行塞成超上限的块(退回静默空白/截断)。
export function planPdfChunks(text, title, fullH, chunkHeight){
	const head = title ? `${title}\n\n` : '';
	const body = `${text == null ? '' : text}`;
	const lines = body.split('\n');
	if(!(fullH > 0) || !(chunkHeight > 0)){
		return [`${head}${body}`];
	}
	const linesPerChunk = Math.max(1, Math.floor((chunkHeight * lines.length) / fullH));
	const chunks = [];
	for(let i = 0; i < lines.length; i += linesPerChunk){
		chunks.push(lines.slice(i, i + linesPerChunk).join('\n'));
	}
	if(chunks.length){ chunks[0] = `${head}${chunks[0]}`; }
	else{ chunks.push(head); }
	return chunks;
}

// PDF 首页附「当前页面截图」(用户拍板:技法三栏整页,默认开):独立首页放整图,正文从次页起。
// 截图缺失/损坏一律静默跳过——附图绝不阻断导出。返回 true=第一页已被截图占用。
export function addScreenshotPageIfAny(pdf, payload, margin){
	const shot = payload && payload.screenshot;
	if(!shot || !shot.dataUrl){ return false; }
	try{
		const cwMm = pdf.internal.pageSize.getWidth() - margin * 2;
		const chMm = pdf.internal.pageSize.getHeight() - margin * 2;
		const w = Math.max(1, Number(shot.width) || 1);
		const h = Math.max(1, Number(shot.height) || 1);
		let wMm = cwMm;
		let hMm = wMm * (h / w);
		if(hMm > chMm){ hMm = chMm; wMm = hMm * (w / h); }
		pdf.addImage(shot.dataUrl, 'JPEG', margin + (cwMm - wMm) / 2, margin, wMm, hMm);
		return true;
	}catch(e){
		console.warn('[aiExport] PDF 附页面截图失败,跳过附图继续导出:', e && e.message);
		return false;
	}
}

// canvas 按 A4 页高切片入 pdf(plain/styled 两路共用;逻辑自原 exportPdf 逐字抽出)。返回更新后的 first。
function addCanvasSlicesToPdf(pdf, canvas, margin, first){
	const cwMm = pdf.internal.pageSize.getWidth() - margin * 2;     // 内容宽(mm)
	const chMm = pdf.internal.pageSize.getHeight() - margin * 2;    // 内容高(mm)
	const pxPerMm = canvas.width / cwMm;
	const pageHpx = Math.floor(chMm * pxPerMm);
	let y = 0;
	let isFirst = first;
	while(y < canvas.height){
		const sliceH = Math.min(pageHpx, canvas.height - y);
		const slice = document.createElement('canvas');
		slice.width = canvas.width; slice.height = sliceH;
		slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
		if(!isFirst) pdf.addPage();
		pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, cwMm, sliceH / pxPerMm);
		isFirst = false; y += sliceH;
	}
	return isFirst;
}

// v1 经典路径:纯文本栅格(行为与历史 exportPdf 逐字一致,仅切片循环抽为共用函数+截图首页)。
// 同时是 v2 样式化路径的防线④兜底——样式化任何环节失败都整体回退到这里。
// 栅格路径:导出内容永远是简体原文(界面繁体时也是;见 utils/scriptMode.withOriginalScript)
export function exportPdfPlain(payload){
	return withOriginalScript(()=>exportPdfPlainRaw(payload));
}

async function exportPdfPlainRaw(payload){
	const title = payload.tech || '';
	const text = payload.text || '';
	let host = null;
	try{
		const htiMod = await import('html-to-image');
		const toCanvas = htiMod.toCanvas || (htiMod.default && htiMod.default.toCanvas);
		const jspdfMod = await import('jspdf');
		const jsPDF = jspdfMod.jsPDF || jspdfMod.default || jspdfMod;
		if(!toCanvas || !jsPDF){ return false; }
		host = document.createElement('div');
		host.className = SCRIPT_KEEP_CLASS;
		host.style.cssText = `position:fixed;left:0;top:0;width:${PDF_HOST_WIDTH}px;padding:48px 56px;box-sizing:border-box;background:#ffffff;color:#111111;font:13px/1.7 "PingFang SC","Microsoft YaHei",Arial,sans-serif;white-space:pre-wrap;word-break:break-word;z-index:-1;pointer-events:none;`;
		host.textContent = `${title ? title + '\n\n' : ''}${text}`;
		document.body.appendChild(host);

		// 自适应清晰度 + 超长分块:canvas 高 = CSS 高 × pixelRatio,超上限即静默空白——先降 PR,再按行切块。
		const fullH = host.offsetHeight || 0;
		const pixelRatio = (fullH * 2 <= PDF_MAX_CANVAS_EDGE) ? 2 : 1;
		const contents = (fullH * pixelRatio > PDF_MAX_CANVAS_EDGE)
			? planPdfChunks(text, title, fullH, PDF_CHUNK_HEIGHT)
			: [`${title ? title + '\n\n' : ''}${text}`];

		const renderChunk = async (content)=>{
			host.textContent = content;
			// style 覆盖作用于「克隆节点」:定位归零到普通流(防线①);skipFonts:纯 textContent+系统字体,
			// 免 html-to-image 在 WKWebView 抓全文档 @font-face 失败/挂起一类问题。
			// 逐段各包一层原文持有(外层整次导出也包着):每段持有都很短,后半段永远按简体原文画字
			return withOriginalScript(()=>toCanvas(host, {
				pixelRatio,
				backgroundColor: '#ffffff',
				cacheBust: true,
				skipFonts: true,
				style: { position: 'static', left: '0', top: '0', margin: '0' },
			}));
		};

		const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
		const margin = 10;
		let first = true;
		if(addScreenshotPageIfAny(pdf, payload, margin)){ first = false; }
		for(let ci = 0; ci < contents.length; ci++){
			let canvas = await renderChunk(contents[ci]);
			// 墨迹守卫覆盖「每一块」(非仅首块):任何本应有内容的块渲染空白 → 重试一次 → 仍空白则整份放弃降级 TXT,
			// 绝不把空白页当正常页 addImage(续块在 WKWebView 大 canvas 内存压力/超上限 clamp 下也会偶发空白)。
			// 「本应有墨迹」= 该块去空白后非空(首块含 header 恒 true;尾部纯空行块合法空白,跳过墨迹校验只查尺寸)。
			const expectInk = `${contents[ci]}`.trim().length > 0;
			if(expectInk && !canvasHasInk(canvas)){
				canvas = await renderChunk(contents[ci]);
				if(!canvasHasInk(canvas)){
					console.error(`[aiExport] PDF 第 ${ci} 块渲染空白(重试后仍无墨迹),放弃落盘`);
					return false;
				}
			}
			if(!canvas || !canvas.width || !canvas.height){
				console.error('[aiExport] PDF 渲染 canvas 尺寸为 0,放弃落盘');
				return false;
			}
			first = addCanvasSlicesToPdf(pdf, canvas, margin, first);
		}
		const blob = pdf.output('blob');
		if(!blob || blob.size < 5000){
			console.error(`[aiExport] PDF blob 异常(size=${blob && blob.size}),放弃落盘`);
			return false;
		}
		return saveTri(await downloadBlob(`${payload.filenameBase}.pdf`, blob, 'application/pdf'));
	}catch(e){
		console.error('[aiExport] PDF 导出失败:', e);
		return false;
	}finally{
		if(host && host.parentNode){ try{ host.parentNode.removeChild(host); }catch(e){} }
	}
}

// 样式化 PDF:IR → 块级 DOM(段头条/真表格/键值/子题)→ 按块装箱分块栅格。
// 防线:①克隆定位归零+skipFonts(同 plain) ②逐块墨迹守卫+重试 ③blob 尺寸守卫
//      ④任何失败(含单块超限/装箱不适用)→ 返 false,由 exportPdf 包装层整体回退 plain 路径。
// 栅格路径:导出内容永远是简体原文(界面繁体时也是;见 utils/scriptMode.withOriginalScript)
export function exportPdfStyled(payload){
	return withOriginalScript(()=>exportPdfStyledRaw(payload));
}

async function exportPdfStyledRaw(payload){
	let host = null;
	try{
		const htiMod = await import('html-to-image');
		const toCanvas = htiMod.toCanvas || (htiMod.default && htiMod.default.toCanvas);
		const jspdfMod = await import('jspdf');
		const jsPDF = jspdfMod.jsPDF || jspdfMod.default || jspdfMod;
		const renderer = await import('../aiExportDocRender');
		if(!toCanvas || !jsPDF || !renderer || !renderer.renderExportDocToPdfNodes){ return false; }
		const nodes = renderer.renderExportDocToPdfNodes(payload);
		if(!nodes || !nodes.length){ return false; }
		host = document.createElement('div');
		host.className = SCRIPT_KEEP_CLASS;
		host.style.cssText = `position:fixed;left:0;top:0;width:${PDF_HOST_WIDTH}px;padding:40px 48px;box-sizing:border-box;background:#ffffff;color:#111111;z-index:-1;pointer-events:none;`;
		nodes.forEach((n)=>host.appendChild(n));
		document.body.appendChild(host);

		const heights = nodes.map((n)=>{
			const rect = n.getBoundingClientRect ? n.getBoundingClientRect() : { height: n.offsetHeight || 0 };
			let mt = 0; let mb = 0;
			try{
				const cs = window.getComputedStyle(n);
				mt = parseFloat(cs.marginTop) || 0;
				mb = parseFloat(cs.marginBottom) || 0;
			}catch(_){ /* jsdom/异常按 0 */ }
			return (rect.height || 0) + mt + mb;
		});
		const fullH = host.offsetHeight || 0;
		const pixelRatio = (fullH * 2 <= PDF_MAX_CANVAS_EDGE) ? 2 : 1;
		let chunkRanges;
		if(fullH * pixelRatio > PDF_MAX_CANVAS_EDGE){
			// packBlocksIntoChunks 已不再对超高单块返 null 整份降级:超高块独占一段并带
			// split 标记,下方按「降清晰度整块截取」处理(canvas 边长回到安全域,文字仍完整)。
			chunkRanges = packBlocksIntoChunks(heights, PDF_CHUNK_HEIGHT, Math.floor(PDF_MAX_CANVAS_EDGE / pixelRatio) - 96);
		}else{
			chunkRanges = [{ start: 0, end: nodes.length }];
		}

		const renderRange = async (range, ratioOverride)=>{
			while(host.firstChild){ host.removeChild(host.firstChild); }
			for(let k = range.start; k < range.end; k++){ host.appendChild(nodes[k]); }
			// 逐段各包一层原文持有(同上)
			return withOriginalScript(()=>toCanvas(host, {
				pixelRatio: ratioOverride || pixelRatio,
				backgroundColor: '#ffffff',
				cacheBust: true,
				skipFonts: true,
				style: { position: 'static', left: '0', top: '0', margin: '0' },
			}));
		};

		const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
		const margin = 10;
		let first = true;
		if(addScreenshotPageIfAny(pdf, payload, margin)){ first = false; }
		for(let ci = 0; ci < chunkRanges.length; ci++){
			// split 段=单个超高块:按块高反推清晰度让 canvas 边长落回安全域
			// (整块一次截取、页级切片照旧;该块清晰度略降,远优于整份退纯文本)。
			let segRatio = pixelRatio;
			const rg = chunkRanges[ci];
			if(rg && rg.split && rg.split > 1){
				const segH = heights.slice(rg.start, rg.end).reduce((a, b)=>a + b, 0) || 1;
				segRatio = Math.max(0.5, Math.min(pixelRatio, (PDF_MAX_CANVAS_EDGE - 96) / segH));
			}
			let canvas = await renderRange(rg, segRatio);
			if(!canvasHasInk(canvas)){
				canvas = await renderRange(rg, segRatio);
				if(!canvasHasInk(canvas)){
					console.error(`[aiExport] 样式化 PDF 第 ${ci} 块渲染空白(重试后仍无墨迹),回退纯文本路径`);
					return false;
				}
			}
			if(!canvas || !canvas.width || !canvas.height){
				console.error('[aiExport] 样式化 PDF canvas 尺寸为 0,回退纯文本路径');
				return false;
			}
			first = addCanvasSlicesToPdf(pdf, canvas, margin, first);
		}
		const blob = pdf.output('blob');
		if(!blob || blob.size < 5000){
			console.error(`[aiExport] 样式化 PDF blob 异常(size=${blob && blob.size}),回退纯文本路径`);
			return false;
		}
		return saveTri(await downloadBlob(`${payload.filenameBase}.pdf`, blob, 'application/pdf'));
	}catch(e){
		console.error('[aiExport] 样式化 PDF 失败,回退纯文本路径:', e);
		return false;
	}finally{
		if(host && host.parentNode){ try{ host.parentNode.removeChild(host); }catch(e){} }
	}
}

// [顶级方案] 可选中文字 PDF —— 复用样式化 DOM 节点(renderExportDocToPdfNodes),写入隐藏 iframe
// 打印文档 → window.print() → 系统『存储为 PDF』。相较栅格路径(html-to-image→addImage(JPEG))的根本优势:
//   ① 文字真可选可搜(非图片);② 原生分页(@page + page-break-inside:avoid 保表格行/段头完整),
//      永不像素级从行中间截断;③ CJK 走系统字体、无需内嵌大字体;④ 截图(若开)独占首页。
// 铁律:任何不可用/异常 → 返 false,由 exportPdf 回退栅格路径(绝不因新路径失败而无产物)。
const PDF_PRINT_FONT = '"PingFang SC","Microsoft YaHei","Heiti SC",Arial,sans-serif';
export let _pdfExportedViaPrint = false;
export let _pdfExportedViaVector = false;

async function exportPdfPrintable(payload){
	if(typeof window === 'undefined' || typeof document === 'undefined' || typeof window.print !== 'function'){
		return false;
	}
	let iframe = null;
	try{
		const renderer = await import('../aiExportDocRender');
		if(!renderer || !renderer.renderExportDocToPdfNodes){ return false; }
		const nodes = renderer.renderExportDocToPdfNodes(payload);
		if(!nodes || !nodes.length){ return false; }
		const wrap = document.createElement('div');
		nodes.forEach((n)=>wrap.appendChild(n));
		const bodyHtml = wrap.innerHTML;
		if(!bodyHtml || !bodyHtml.trim()){ return false; }

		const shot = payload && payload.screenshot;
		const shotPage = shot && shot.dataUrl
			? `<div class="exp-shotpage"><img src="${shot.dataUrl}" alt="页面截图" /></div>`
			: '';
		const title = escapeHtml((payload && payload.tech) || '导出');
		const css = `
			@page { size: A4; margin: 14mm 12mm; }
			* { box-sizing: border-box; }
			html, body { margin: 0; padding: 0; background: #ffffff; color: #111111;
				-webkit-print-color-adjust: exact; print-color-adjust: exact; }
			body { font: 13px/1.7 ${PDF_PRINT_FONT}; word-break: break-word; }
			.exp-sec, .exp-subhead { page-break-after: avoid; break-after: avoid-page; }
			table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
			thead { display: table-header-group; }
			tr, th, td { page-break-inside: avoid; }
			img { max-width: 100%; }
			.exp-shotpage { text-align: center; page-break-after: always; }
			.exp-shotpage img { max-width: 100%; max-height: 250mm; }
		`;
		const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${shotPage}${bodyHtml}</body></html>`;

		iframe = document.createElement('iframe');
		iframe.setAttribute('aria-hidden', 'true');
		iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
		document.body.appendChild(iframe);
		const idoc = iframe.contentWindow.document;
		idoc.open();
		idoc.write(html);
		idoc.close();

		// 等文档/字体/图片就绪(避免打印时截图或首屏未渲染)。
		await new Promise((resolve)=>{
			let settled = false;
			const go = ()=>{ if(!settled){ settled = true; resolve(); } };
			if(idoc.readyState === 'complete'){ setTimeout(go, 150); }
			else { iframe.onload = ()=>setTimeout(go, 150); }
			setTimeout(go, 1200);   // 兜底放行
		});
		const imgs = Array.from((idoc && idoc.images) || []);
		await Promise.all(imgs.map((im)=> (im.complete ? Promise.resolve() : new Promise((r)=>{ im.onload = r; im.onerror = r; setTimeout(r, 2000); }))));

		const iwin = iframe.contentWindow;
		const holdIframe = iframe;
		const cleanup = ()=>{ try{ if(holdIframe && holdIframe.parentNode){ holdIframe.parentNode.removeChild(holdIframe); } }catch(_){ /* noop */ } };
		try{ iwin.onafterprint = ()=>setTimeout(cleanup, 300); }catch(_){ /* noop */ }
		try{ iwin.focus(); }catch(_){ /* noop */ }
		iwin.print();
		setTimeout(cleanup, 60000);   // afterprint 未触发(部分 webview)的兜底清理
		return true;
	}catch(e){
		try{ if(iframe && iframe.parentNode){ iframe.parentNode.removeChild(iframe); } }catch(_){ /* noop */ }
		console.error('[aiExport] 可选中 PDF(打印)失败,回退栅格路径:', e && e.message);
		return false;
	}
}

// 包装层:优先可选中文字打印路径(opts.allowPrint 默认开);不可用/失败再走 v2 样式化栅格;
// 末路 v1 经典纯文本栅格(字节级不变)。_pdfExportedViaPrint 供调用方给准确 toast。
export async function exportPdf(payload, opts = {}){
	_pdfExportedViaPrint = false;
	_pdfExportedViaVector = false;
	// 首选[顶级方案]:矢量可选中文字 PDF(内嵌中文子集字体)→ downloadBlob 的 <a download>,
	// 桌面 webview 触发原生「另存为」(选位置+改名)、dev 触发下载,全程不弹系统打印窗。
	try{
		const vec = await import('../aiExportPdfVector');
		if(vec && vec.buildExportPdfVectorBlob){
			const blob = await vec.buildExportPdfVectorBlob(payload);
			if(blob && blob.size > 1200){
				const tri = saveTri(await downloadBlob(`${payload.filenameBase}.pdf`, blob, 'application/pdf'));
				if(tri === 'cancelled'){ return 'cancelled'; }   // 取消不回退打印/栅格
				if(tri){ _pdfExportedViaVector = true; return true; }
			}
		}
	}catch(e){ console.error('[aiExport] 矢量 PDF 失败,回退打印/栅格:', e && e.message); }
	// 回退①:打印式(文字可选但走系统打印窗;仅显式 pdf 动作允许弹窗)
	if(opts.allowPrint !== false){
		const printed = await exportPdfPrintable(payload);
		if(printed){ _pdfExportedViaPrint = true; return true; }
	}
	// 回退②/③:v2 样式化栅格 → v1 纯文本栅格(绝不无产物)
	if(getAIExportFormatPreference() === 'v2'){
		const styledOk = await exportPdfStyled(payload);
		if(styledOk){ return styledOk; }   // true 或 'cancelled'
	}
	return exportPdfPlain(payload);
}

export function exportTxt(payload){
	return downloadBlob(`${payload.filenameBase}.txt`, payload.text, 'text/plain;charset=utf-8');
}

// 经典 .doc(HTML 壳):v2 下降级兜底(docx 构建失败时),v1 下仍是「Word」主路径。
// 顶部按需内嵌页面截图(data URI;Word 2016+ 解析 HTML 内嵌 base64 图)。
export function exportWord(payload){
	const shot = payload && payload.screenshot;
	const shotImg = shot && shot.dataUrl
		? `<p><img src="${shot.dataUrl}" style="max-width:100%;" alt="当前页面截图" /></p>\n`
		: '';
	const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(payload.tech)}</title>
</head>
<body>
${shotImg}<pre style="white-space: pre-wrap; word-break: break-word; font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.5;">${escapeHtml(payload.text)}</pre>
</body>
</html>`;
	return downloadBlob(`${payload.filenameBase}.doc`, html, 'application/msword;charset=utf-8');
}

// 真 docx 导出(标题层级/真 Word 表/封面截图);失败返 false 由调用方降级 .doc 壳。
// docx 渲染器(含 'docx' 依赖)恒走动态 import——主包严禁静态引(代码分包,同 exportPdf 先例)。
export async function exportDocx(payload){
	try{
		const renderer = await import('../aiExportDocRender');
		if(!renderer || !renderer.buildExportDocxBlob){ return false; }
		const blob = await renderer.buildExportDocxBlob(payload, { screenshot: (payload && payload.screenshot) || null });
		if(!blob || blob.size < 2000){
			console.error(`[aiExport] DOCX blob 异常(size=${blob && blob.size}),降级 .doc`);
			return false;
		}
		return saveTri(await downloadBlob(`${payload.filenameBase}.docx`, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
	}catch(e){
		console.error('[aiExport] DOCX 导出失败,降级 .doc 壳:', e);
		return false;
	}
}
