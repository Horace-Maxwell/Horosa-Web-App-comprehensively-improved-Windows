import { extractMaterialContent } from '../services/aianalysis';

// [Q-002/M-02] txt/md 编码识别:此前 FileReader.readAsText 无编码参数恒 UTF-8 → GBK/GB18030 文稿入库即乱码
// (textHash/searchText/RAG 切块全量继承)。现:BOM 优先 → UTF-8 严格解码 → 失败回落 GB18030(浏览器 TextDecoder
// 支持;环境不支持时再退 UTF-8 宽松)。合法 UTF-8 文件字节不变(零回归)。
export function decodeTextSmart(arrayBuffer){
	const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer || new ArrayBuffer(0));
	const tryDecode = (label, fatal)=>{
		try{
			return new TextDecoder(label, { fatal: !!fatal }).decode(bytes);
		}catch(e){ return null; }
	};
	if(bytes.length >= 2){
		if(bytes[0] === 0xFF && bytes[1] === 0xFE){ const t = tryDecode('utf-16le', false); if(t !== null){ return { text: t, encoding: 'utf-16le' }; } }
		if(bytes[0] === 0xFE && bytes[1] === 0xFF){ const t = tryDecode('utf-16be', false); if(t !== null){ return { text: t, encoding: 'utf-16be' }; } }
	}
	const utf8 = tryDecode('utf-8', true);
	if(utf8 !== null){ return { text: utf8, encoding: 'utf-8' }; }
	const gb = tryDecode('gb18030', false);
	if(gb !== null){ return { text: gb, encoding: 'gb18030' }; }
	return { text: tryDecode('utf-8', false) || '', encoding: 'utf-8-lossy' };
}

function readFileAsArrayBuffer(file){
	return new Promise((resolve, reject)=>{
		const reader = new FileReader();
		reader.onload = ()=>resolve(reader.result);
		reader.onerror = ()=>reject(reader.error || new Error('file.read.failed'));
		reader.readAsArrayBuffer(file);
	});
}

function lowerName(file){
	return `${file && file.name ? file.name : ''}`.toLowerCase();
}

// [Q-060/AW-18] 可导入扩展名白名单 —— 与桌面壳层 `AI_ANALYSIS_IMPORT_EXTENSIONS` 逐字同集。
// 此前前端没有白名单:guessKind 对一切未知后缀一律当 txt、readAsText 直接读二进制入库
// (拖一张 PNG 进来就得到一份类型 txt、摘要乱码的资料);桌面「导入目录」在壳层过滤 →
// 同一个目录两条路径入库结果不同。现在两条路径同一张表。
export const MATERIAL_IMPORT_EXTENSIONS = ['txt', 'md', 'markdown', 'doc', 'docx', 'pdf'];
export const MATERIAL_ACCEPT_ATTR = MATERIAL_IMPORT_EXTENSIONS.map((e)=>`.${e}`).join(',');
// [Q-060/AW-23] 走后端抽取的类型(pdf/doc/docx)与后端的 30 MB 硬上限逐字对齐
// (Java AIAnalysisMaterialService.MAX_DECODED_BYTES = 30 MB,超限直接 580103 拒收)。
// 此前前端只有一个 50 MB「仍要上传」软提示:35 MB 的 PDF 一路送到后端才被拒,用户看到的是一句无解释的失败。
export const MATERIAL_BACKEND_EXTRACT_KINDS = ['pdf', 'doc', 'docx'];
export const MATERIAL_BACKEND_MAX_BYTES = 30 * 1024 * 1024;
export function needsBackendExtract(file){
	return MATERIAL_BACKEND_EXTRACT_KINDS.indexOf(guessKind(file)) >= 0;
}
export function oversizeForBackend(file){
	return needsBackendExtract(file) && Number((file && file.size) || 0) > MATERIAL_BACKEND_MAX_BYTES;
}
// extractMeta → 一句人话(没截断回空串)。后端两种截断各自有标记:
//   pagesTruncated + pageCap(PDF 只抽了前 N 页,pageCount 是原始总页数)· truncated + textCap(正文按字数封顶)
export function describeExtractTruncation(extractMeta){
	const m = extractMeta && typeof extractMeta === 'object' ? extractMeta : null;
	if(!m){ return ''; }
	const parts = [];
	if(m.pagesTruncated){
		const cap = Number(m.pageCap) > 0 ? Number(m.pageCap) : 0;
		const total = Number(m.pageCount) > 0 ? Number(m.pageCount) : 0;
		parts.push(cap ? `只抽了前 ${cap} 页${total ? `(原文 ${total} 页)` : ''}` : '只抽了前若干页');
	}
	if(m.truncated){
		const cap = Number(m.textCap) > 0 ? Number(m.textCap) : 0;
		parts.push(cap ? `正文按 ${cap.toLocaleString('en-US')} 字封顶` : '正文已按上限截断');
	}
	return parts.length ? `已截断:${parts.join(' · ')}` : '';
}

export function isSupportedMaterialFile(file){
	const name = lowerName(file);
	const dot = name.lastIndexOf('.');
	if(dot < 0){ return false; }
	return MATERIAL_IMPORT_EXTENSIONS.indexOf(name.slice(dot + 1)) >= 0;
}

export function guessKind(file){
	const name = lowerName(file);
	if(name.endsWith('.pdf')){
		return 'pdf';
	}
	if(name.endsWith('.docx')){
		return 'docx';
	}
	if(name.endsWith('.doc')){
		return 'doc';
	}
	if(name.endsWith('.md') || name.endsWith('.markdown')){
		return 'md';
	}
	return 'txt';
}

export async function arrayBufferToBase64(buffer){
	const bytes = new Uint8Array(buffer);
	const chunkSize = 0x8000;
	let binary = '';
	for(let i=0; i<bytes.length; i += chunkSize){
		const chunk = bytes.subarray(i, i + chunkSize);
		binary += String.fromCharCode.apply(null, Array.from(chunk));
	}
	return window.btoa(binary);
}

export async function sha256Hex(buffer){
	const digest = await window.crypto.subtle.digest('SHA-256', buffer);
	return Array.from(new Uint8Array(digest)).map((item)=>item.toString(16).padStart(2, '0')).join('');
}

export async function parseMaterialFile(file){
	if(!file){
		throw new Error('material.file.required');
	}
	const kind = guessKind(file);
	const arrayBuffer = await readFileAsArrayBuffer(file);
	const base64Data = await arrayBufferToBase64(arrayBuffer);
	const fileHash = await sha256Hex(arrayBuffer);
	let extracted = null;
	if(kind === 'txt' || kind === 'md'){
		const decoded = decodeTextSmart(arrayBuffer);   // [Q-002/M-02] 复用已读字节,按编码识别解码
		const text = decoded.text.replace(/^\uFEFF/, '');
		extracted = {
			fileName: file.name || '未命名资料',
			fileExt: kind === 'md' ? '.md' : '.txt',
			mimeType: file.type || (kind === 'md' ? 'text/markdown' : 'text/plain'),
			size: file.size || 0,
			fileHash,
			extractedText: `${text || ''}`.trim(),
			textHash: await sha256Hex(new TextEncoder().encode(`${text || ''}`.trim())),
			extractMeta: {
				extractor: 'browser-text',
				encoding: decoded.encoding,
			},
		};
	}else{
		const rsp = await extractMaterialContent({
			fileName: file.name || '未命名资料',
			mimeType: file.type || '',
			base64Data,
		});
		extracted = rsp && rsp.Result ? rsp.Result : null;
	}
	if(!extracted){
		throw new Error('material.extract.failed');
	}
	return {
		name: extracted.fileName || file.name || '未命名资料',
		fileName: extracted.fileName || file.name || '未命名资料',
		fileExt: extracted.fileExt || `.${kind}`,
		kind,
		size: extracted.size || file.size || 0,
		mimeType: extracted.mimeType || file.type || '',
		fileHash: extracted.fileHash || fileHash,
		textHash: extracted.textHash || '',
		originBlob: base64Data,
		extractedText: `${extracted.extractedText || ''}`.trim(),
		extractMeta: extracted.extractMeta || {},
	};
}
