import { isDesktopBridgeAvailable, saveDesktopFile } from './aiAnalysisDesktop';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun, ImageRun } from 'docx';
import { dataUrlToUint8Array } from './docxCommon';

// [Q-410 裁决 2026-09-18] 全站下载单源:桌面壳(Tauri)里 <a download> 被壳取消 / 落默认目录且用户选不了位置,
// 且各处「桌面桥失败(含用户取消)回落浏览器下载 + 报已导出」= 取消也报成功。现统一:
//   桌面壳 → 保存桥(系统保存框选目录);取消 = 不落文件、不回落、不报成功;失败 = 返回 error 由调用方如实提示;
//   浏览器 → 原 <a download>。返回 Promise<{ ok, via, path?, cancelled?, error? }>;不 await 的老调用方仍会触发保存。
function browserAnchorDownload(fileName, blob){
	const url = (window.URL || window.webkitURL).createObjectURL(blob);
	const link = document.createElement('a');
	link.style.display = 'none';
	link.href = url;
	link.setAttribute('download', fileName);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	(window.URL || window.webkitURL).revokeObjectURL(url);
}

export function isDesktopSaveBridge(){
	try{ return isDesktopBridgeAvailable(); }catch(e){ return false; }
}

export function isSaveCancelledError(err){
	const msg = `${(err && err.message) || err || ''}`;
	return /取消|cancel/i.test(msg);
}

export async function saveBlobSmart(fileName, blob){
	const name = `${fileName || 'download.bin'}`;
	if(isDesktopSaveBridge()){
		try{
			const base64Data = await blobToBase64(blob);
			const path = await saveDesktopFile({ defaultFileName: name, base64Data, mimeType: (blob && blob.type) || 'application/octet-stream' });
			return { ok: true, via: 'desktop', path: path || '' };
		}catch(e){
			if(isSaveCancelledError(e)){ return { ok: false, cancelled: true, via: 'desktop' }; }
			return { ok: false, via: 'desktop', error: `${(e && e.message) || e || 'desktop.save.failed'}` };
		}
	}
	try{
		browserAnchorDownload(name, blob);
		return { ok: true, via: 'browser' };
	}catch(e){
		return { ok: false, via: 'browser', error: `${(e && e.message) || e || 'download.failed'}` };
	}
}

// 调用方统一提示文案:ok → okText(桌面附路径);取消 → 「已取消保存」;失败 → 「保存失败:…」。
export function describeSaveResult(r, okText){
	if(!r){ return { type: 'error', text: '保存失败' }; }
	if(r.ok){ return { type: 'success', text: `${okText || '已导出'}${r.path ? `：${r.path}` : ''}` }; }
	if(r.cancelled){ return { type: 'info', text: '已取消保存' }; }
	return { type: 'error', text: `保存失败：${r.error || '未知错误'}` };
}

export function downloadBlob(fileName, blob){
	return saveBlobSmart(fileName, blob);
}

export function base64ToBlob(base64Data, mimeType = 'application/octet-stream'){
	const clean = `${base64Data || ''}`.split(',').pop();
	const binary = window.atob(clean);
	const bytes = new Uint8Array(binary.length);
	for(let i=0; i<binary.length; i++){
		bytes[i] = binary.charCodeAt(i);
	}
	return new Blob([bytes], { type: mimeType });
}

export function blobToBase64(blob){
	return new Promise((resolve, reject)=>{
		const reader = new FileReader();
		reader.onload = ()=>resolve(`${reader.result || ''}`.split(',').pop() || '');
		reader.onerror = ()=>reject(reader.error || new Error('blob.to.base64.failed'));
		reader.readAsDataURL(blob);
	});
}

// [E4] 文字类导出 BOM 政策单源:macOS TextEdit / Windows 记事本 / 旧版 Word 对无 BOM 的 UTF-8 文件
// 按本地默认编码(MacRoman/GBK)猜测 → 中文全乱(「技术」E6 8A 80… 被 MacRoman 解码成「ÊäÄ…」);
// BOM(EF BB BF)显式标记 UTF-8,各平台文本编辑器/Word 均正确识别。
// 仅给人读的 txt/Word(.doc html 壳)/markdown 加;JSON/CSV/docx(zip)/html 等机读或自带声明的格式
// 不加(BOM 会破坏 JSON.parse / 首列名)。幂等:已带 BOM 不重复。
export function withUtf8Bom(content, mime){
	if(typeof content === 'string' && /text\/plain|msword|text\/markdown/i.test(`${mime || ''}`) && content.charCodeAt(0) !== 0xFEFF){
		return String.fromCharCode(0xFEFF) + content;
	}
	return content;
}

export function downloadTextFile(fileName, content, type = 'text/plain;charset=utf-8'){
	return downloadBlob(fileName, new Blob([withUtf8Bom(content, type)], { type }));
}

// ── [Q-321/M-49] 会话 docx 的轻量 Markdown 渲染 ──────────────────────────────
// 只覆盖会话里真实出现的形态:标题 / 无序与有序列表 / 引用 / 表格行 / 分隔线 / **粗体** / `行内代码` / ``` 代码块。
// 不引第三方 Markdown 解析(导出链要稳、要能在 jest 里跑),未识别的一律按纯文本行输出——绝不吞内容。
const DOCX_HEADING_MAP = { 1: 'Heading2', 2: 'Heading3', 3: 'Heading4', 4: 'Heading4', 5: 'Heading4', 6: 'Heading4' };

/** 行内标记 → TextRun[];**粗体** 与 `代码` 两种(其余原样)。break=该 run 前插一个换行。 */
export function mdInlineRuns(text, opts){
	const o = opts || {};
	const out = [];
	const src = `${text == null ? '' : text}`;
	const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
	let last = 0; let m; let first = true;
	const push = (t, extra)=>{
		if(!t) { return; }
		const run = { text: t, ...(extra || {}) };
		if(first && o.break){ run.break = o.break; first = false; }
		out.push(new TextRun(run));
	};
	while((m = re.exec(src)) !== null){
		push(src.slice(last, m.index));
		if(m[2] !== undefined){ push(m[2], { bold: true }); }
		else{ push(m[3], { font: { ascii: 'Consolas', eastAsia: '宋体', hAnsi: 'Consolas' } }); }
		last = m.index + m[0].length;
	}
	push(src.slice(last));
	if(!out.length){ push(src || ' '); }
	return out;
}

/** 一条消息 → Paragraph[](首段带 [role] 前缀)。 */
export function conversationMessageParagraphs(item){
	const role = (item && item.role) || 'assistant';
	const body = `${(item && item.content) || ''}`.replace(/\r\n?/g, '\n');
	const paras = [];
	const blocks = body.split(/\n{2,}/);
	let inCode = false;
	let head = true;
	const prefixRuns = ()=>(head ? (head = false, [new TextRun({ text: `[${role}] `, bold: true })]) : []);
	blocks.forEach((block)=>{
		const blockLines = block.split('\n');
		const runs = [];
		let bullet = null; let heading = null; let quote = false;
		blockLines.forEach((raw, i)=>{
			let line = raw;
			if(/^\s*```/.test(line)){ inCode = !inCode; return; }   // 代码围栏本身不输出
			if(inCode){
				runs.push(...mdInlineRuns(line || ' ', { break: runs.length ? 1 : 0 }));
				return;
			}
			if(i === 0){
				const h = /^(#{1,6})\s+(.*)$/.exec(line);
				if(h){ heading = h[1].length; line = h[2]; }
			}
			if(/^\s*>\s?/.test(line)){ quote = true; line = line.replace(/^\s*>\s?/, ''); }
			const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
			const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
			if(ul && i === 0){ bullet = '•'; line = ul[1]; }
			else if(ol && i === 0){ bullet = `${ol[1]}.`; line = ol[2]; }
			else if(ul){ line = `• ${ul[1]}`; }
			else if(ol){ line = `${ol[1]}. ${ol[2]}`; }
			if(/^\s*\|?\s*:?-{3,}/.test(line) && !/\|/.test(line)){ line = '────────'; }   // 分隔线
			runs.push(...mdInlineRuns(line, { break: runs.length ? 1 : 0 }));
		});
		if(!runs.length){ return; }
		const children = prefixRuns().concat(bullet ? [new TextRun({ text: `${bullet} ` })] : []).concat(runs);
		const cfg = { children };
		if(heading){ cfg.heading = DOCX_HEADING_MAP[heading] || 'Heading4'; }
		if(quote){ cfg.indent = { left: 480 }; }
		if(bullet){ cfg.indent = { left: 360 }; }
		paras.push(new Paragraph(cfg));
	});
	if(!paras.length){ paras.push(new Paragraph({ children: [new TextRun({ text: `[${role}] `, bold: true })] })); }
	return paras;
}

// [WP-C] opts.pageScreenshot={dataUrl,width,height}:文档头附「当前页面截图」。
// 截图由调用方(AIAnalysisMain)按「AI导出设置·附页面截图」开关抓取后传入——本文件被 aiExport 引用,
// 不能反向 import aiExport 读设置(防循环);图缺失/损坏一律跳过,绝不阻断导出。
export async function exportConversationDocx(conversation, messages, opts){
	const title = conversation && conversation.title ? conversation.title : 'AI分析会话';
	const lines = [];
	lines.push(new Paragraph({
		children: [
			new TextRun({
				text: title,
				bold: true,
				size: 30,
			}),
		],
	}));
	const pageShot = opts && opts.pageScreenshot;
	if(pageShot && pageShot.dataUrl){
		const shotU8 = dataUrlToUint8Array(pageShot.dataUrl);
		if(shotU8){
			const shotW = Math.min(600, pageShot.width || 600);
			const shotH = Math.max(1, Math.round((pageShot.height || shotW) * (shotW / Math.max(1, pageShot.width || shotW))));
			try{
				lines.push(new Paragraph({ children: [new ImageRun({ data: shotU8, transformation: { width: shotW, height: shotH } })] }));
			}catch(_){ /* 图损坏忽略 */ }
		}
	}
	// [Q-321/M-49] 此前整条消息塞进一个 TextRun:换行与分段全丢、Markdown 标记原样 —— 长回复导出后是一坨。
	//   现按轻量规则渲染(空行分段 / 段内单换行插 w:br / 标题 / 列表 / 引用 / 表格行 / **粗体** / `代码`)。
	(messages || []).forEach((item)=>{
		conversationMessageParagraphs(item).forEach((para)=>lines.push(para));
	});
	const doc = new Document({
		sections: [
			{
				children: lines,
			},
		],
	});
	return Packer.toBlob(doc);
}

// [Q-060/AW-13] 导出文件名的安全基名:标题里的路径分隔符与控制字符会在 zip 里生成子目录/坏条目,
// 也会让浏览器下载改名。只清危险字符,不动中文与空格(单文件导出的名字对用户可见,保持原样最好认)。
export function safeExportBaseName(conversation){
	const raw = `${(conversation && conversation.title) || ''}`.trim();
	// eslint-disable-next-line no-control-regex
	const cleaned = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
	return cleaned || 'conversation';
}
// [Q-060/AW-13] zip 内基名再挂 id 短码:同名会话(同案例同问题前缀 / 两个「（副本）」/ 空标题统一成
// conversation)此前后写覆盖前写 —— 包里的会话少于勾选数,manifest 却列全,零提示。
export function bundleEntryBaseName(conversation){
	const id = `${(conversation && conversation.id) || ''}`.replace(/[^A-Za-z0-9_-]/g, '');
	const code = id ? id.slice(-6) : '';
	return code ? `${safeExportBaseName(conversation)}-${code}` : safeExportBaseName(conversation);
}

export async function exportConversationByFormat(conversation, messages, format, opts){
	if(format === 'json'){
		return {
			fileName: `${safeExportBaseName(conversation)}.json`,
			blob: new Blob([
				JSON.stringify({
					conversation,
					messages,
				}, null, 2),
			], { type: 'application/json;charset=utf-8' }),
		};
	}
	if(format === 'md'){
		const body = (messages || []).map((item)=>`## ${item.role}\n\n${item.content || ''}`).join('\n\n');
		return {
			fileName: `${safeExportBaseName(conversation)}.md`,
			blob: new Blob([withUtf8Bom(`# ${conversation.title || 'AI分析会话'}\n\n${body}`, 'text/markdown')], { type: 'text/markdown;charset=utf-8' }),
		};
	}
	if(format === 'docx'){
		return {
			fileName: `${safeExportBaseName(conversation)}.docx`,
			blob: await exportConversationDocx(conversation, messages, opts),
		};
	}
	return {
		fileName: `${safeExportBaseName(conversation)}.txt`,
		blob: new Blob([withUtf8Bom((messages || []).map((item)=>`[${item.role}] ${item.content || ''}`).join('\n\n'), 'text/plain')], { type: 'text/plain;charset=utf-8' }),
	};
}

export async function exportConversationBundle(conversations, getMessages){
	const zip = new JSZip();
	const manifest = [];
	for(let i=0; i<(conversations || []).length; i++){
		const conversation = conversations[i];
		const messages = await getMessages(conversation);
		const mdExport = await exportConversationByFormat(conversation, messages, 'md');
		const jsonExport = await exportConversationByFormat(conversation, messages, 'json');
		// [Q-060/AW-13] 包内一律用带 id 短码的基名(单文件导出仍用原标题名,对用户更好认)
		const base = bundleEntryBaseName(conversation);
		zip.file(`${base}.md`, mdExport.blob);
		zip.file(`${base}.json`, jsonExport.blob);
		manifest.push({
			id: conversation.id,
			files: [`${base}.md`, `${base}.json`],   // [Q-060/AW-13] manifest 直接指到包内文件,条数与文件一一对上
			title: conversation.title,
			model: conversation.model,
			providerName: conversation.providerName,
			lastMessageAt: conversation.lastMessageAt,
		});
	}
	zip.file('manifest.json', JSON.stringify({ conversations: manifest }, null, 2));
	return zip.generateAsync({ type: 'blob' });
}

export async function exportWorkspaceBackupBlob(workspace){
	const zip = new JSZip();
	zip.file('manifest.json', JSON.stringify(workspace || {}, null, 2));
	// [Q-060/AW-20] 此前 STORE(不压缩):备份就是一份巨大的 JSON(资料正文 + base64 原件 + 向量),
	// 原样打包后体积常常越过恢复端 200MB 上限 —— 导得出、恢复不回来。DEFLATE 对这种文本是数量级压缩。
	return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// [D54] opts.maxBytes:超限先拒(不解压;zip 炸弹/误选大文件);缺省不限 = 旧行为
export async function parseWorkspaceBackupBlob(blob, opts){
	const maxBytes = opts && Number(opts.maxBytes) > 0 ? Number(opts.maxBytes) : 0;
	if(maxBytes && blob && Number(blob.size) > maxBytes){
		throw new Error('backup.too.large');
	}
	const zip = await JSZip.loadAsync(blob);
	const manifest = zip.file('manifest.json');
	if(!manifest){
		throw new Error('backup.manifest.missing');
	}
	const text = await manifest.async('string');
	return JSON.parse(text);
}

// [Q-410] 名字保留(老调用方),语义已统一为「智能保存」:桌面壳走保存桥,浏览器走 <a download>。
export function saveBlobToBrowser(fileName, blob){
	return downloadBlob(fileName, blob);
}
