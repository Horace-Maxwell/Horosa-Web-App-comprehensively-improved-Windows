import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun, ImageRun } from 'docx';
import { dataUrlToUint8Array } from './docxCommon';

// 全站文件保存单源在 ./fileSave(只依赖桌面桥);这里原样转出,老调用方不用改。
import { withUtf8Bom } from './fileSave';
export { isDesktopSaveBridge, isSaveCancelledError, saveBlobSmart, describeSaveResult, downloadBlob, base64ToBlob, blobToBase64, withUtf8Bom, downloadTextFile, saveBlobToBrowser } from './fileSave';

// ── 会话 docx 的轻量 Markdown 渲染 ──────────────────────────────
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

// opts.pageScreenshot={dataUrl,width,height}:文档头附「当前页面截图」。
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
	// 此前整条消息塞进一个 TextRun:换行与分段全丢、Markdown 标记原样 —— 长回复导出后是一坨。
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

// 导出文件名的安全基名:标题里的路径分隔符与控制字符会在 zip 里生成子目录/坏条目,
// 也会让浏览器下载改名。只清危险字符,不动中文与空格(单文件导出的名字对用户可见,保持原样最好认)。
export function safeExportBaseName(conversation){
	const raw = `${(conversation && conversation.title) || ''}`.trim();
	// eslint-disable-next-line no-control-regex
	const cleaned = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
	return cleaned || 'conversation';
}
// zip 内基名再挂 id 短码:同名会话(同案例同问题前缀 / 两个「（副本）」/ 空标题统一成
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
		// 包内一律用带 id 短码的基名(单文件导出仍用原标题名,对用户更好认)
		const base = bundleEntryBaseName(conversation);
		zip.file(`${base}.md`, mdExport.blob);
		zip.file(`${base}.json`, jsonExport.blob);
		manifest.push({
			id: conversation.id,
			files: [`${base}.md`, `${base}.json`],   // manifest 直接指到包内文件,条数与文件一一对上
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
	// 此前 STORE(不压缩):备份就是一份巨大的 JSON(资料正文 + base64 原件 + 向量),
	// 原样打包后体积常常越过恢复端 200MB 上限 —— 导得出、恢复不回来。DEFLATE 对这种文本是数量级压缩。
	return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// opts.maxBytes:超限先拒(不解压;zip 炸弹/误选大文件);缺省不限 = 旧行为
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
