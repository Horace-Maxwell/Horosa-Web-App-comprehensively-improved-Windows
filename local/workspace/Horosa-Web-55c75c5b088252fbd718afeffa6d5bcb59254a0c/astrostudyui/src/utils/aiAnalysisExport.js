import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export function downloadBlob(fileName, blob){
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
	downloadBlob(fileName, new Blob([withUtf8Bom(content, type)], { type }));
}

export async function exportConversationDocx(conversation, messages){
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
	(messages || []).forEach((item)=>{
		lines.push(new Paragraph({
			children: [
				new TextRun({
					text: `[${item.role}] `,
					bold: true,
				}),
				new TextRun({
					text: item.content || '',
				}),
			],
		}));
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

export async function exportConversationByFormat(conversation, messages, format){
	if(format === 'json'){
		return {
			fileName: `${conversation.title || 'conversation'}.json`,
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
			fileName: `${conversation.title || 'conversation'}.md`,
			blob: new Blob([withUtf8Bom(`# ${conversation.title || 'AI分析会话'}\n\n${body}`, 'text/markdown')], { type: 'text/markdown;charset=utf-8' }),
		};
	}
	if(format === 'docx'){
		return {
			fileName: `${conversation.title || 'conversation'}.docx`,
			blob: await exportConversationDocx(conversation, messages),
		};
	}
	return {
		fileName: `${conversation.title || 'conversation'}.txt`,
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
		zip.file(mdExport.fileName, mdExport.blob);
		zip.file(jsonExport.fileName, jsonExport.blob);
		manifest.push({
			id: conversation.id,
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
	return zip.generateAsync({ type: 'blob' });
}

export async function parseWorkspaceBackupBlob(blob){
	const zip = await JSZip.loadAsync(blob);
	const manifest = zip.file('manifest.json');
	if(!manifest){
		throw new Error('backup.manifest.missing');
	}
	const text = await manifest.async('string');
	return JSON.parse(text);
}

export function saveBlobToBrowser(fileName, blob){
	downloadBlob(fileName, blob);
}
