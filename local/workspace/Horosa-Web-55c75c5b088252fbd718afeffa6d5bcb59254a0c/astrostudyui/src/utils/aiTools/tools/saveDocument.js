// AI 助手·存成文件把技法正文或一段对话存成 .md / .docx / .pdf / .txt(与应用内导出同一套排版),只写固定目录、文件名由软件定、绝不覆盖;调用方给不了路径。
// 落盘口由运行环境挂在工作区桥上:无头是数据目录下 headless/exports(0700,文件名白名单 + 原子写);没有落盘口的环境里这件工具不进目录。
// 技法正文与 cast_technique 同一份;对话属私人内容,外部客户端要「私人内容可读」开着。
import { getWorkspaceBridge } from '../workspaceBridge';
import { AI_ANALYSIS_STORES, getStoreRecord, listConversationMessages } from '../../aiAnalysisStore';
import { isPrivateReadEnabled, getToolPolicy } from '../../aiAgent/prefs';
import { isToolDenied } from '../../aiAgent/approvalPolicy';
import castTechniqueTool from './castTechnique';
import { GUIDE, SOURCE_SCHEMA } from './_shared';

// 写入类工具的参数里不许出现内核键 cid(只增不删·schema 层守卫):来源对象里改叫 recordId,调 cast_technique 前换回
const SOURCE_FOR_SAVE = (()=>{
	const props = { ...SOURCE_SCHEMA.properties };
	const cidSpec = props.cid; delete props.cid;
	return { ...SOURCE_SCHEMA, properties: { ...props, recordId: { ...cidSpec, description: 'kind=record 必填:已存命盘 / 事盘 id' } },
		allOf: (SOURCE_SCHEMA.allOf || []).map((r)=>JSON.parse(JSON.stringify(r).replace(/"cid"/g, '"recordId"'))) };
})();
const toCastSource = (src)=>{ if(!src || typeof src !== 'object'){ return src; } const { recordId, ...rest } = src; return recordId ? { ...rest, cid: recordId } : rest; };

export const SAVE_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;
const MIME = { md: 'text/markdown', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf', txt: 'text/plain' };
export const SAVE_DOCUMENT_FORMATS = ['md', 'docx', 'pdf', 'txt'];

// 文件名:只用 ASCII(壳白名单),前缀 + 时间戳 + 随机后缀 = 不会与已有文件同名(不覆盖)
export function exportFileName(prefix, format){
	const p = `${prefix || 'horosa'}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'horosa';
	const d = new Date();
	const pad = (n)=>`${n}`.padStart(2, '0');
	const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
	return `${p}-${stamp}-${Math.random().toString(36).slice(2, 7)}.${format}`;
}

function toBase64(bytes){
	if(typeof Buffer !== 'undefined'){ return Buffer.from(bytes).toString('base64'); }
	let bin = ''; const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	for(let i = 0; i < u8.length; i += 1){ bin += String.fromCharCode(u8[i]); }
	return btoa(bin);
}
// Blob → 字节:浏览器有 arrayBuffer;无头(jsdom)的 Blob 可能没有,回退 FileReader;已经是字节就原样
async function blobBytes(blob){
	if(!blob){ return new Uint8Array(0); }
	if(blob instanceof Uint8Array){ return blob; }
	if(typeof blob.arrayBuffer === 'function'){ try{ return new Uint8Array(await blob.arrayBuffer()); }catch(e){ /* 落到下面 */ } }
	if(typeof FileReader !== 'undefined'){
		try{
			const buf = await new Promise((res, rej)=>{ const fr = new FileReader(); fr.onerror = ()=>rej(fr.error); fr.onload = ()=>res(fr.result); fr.readAsArrayBuffer(blob); });
			return new Uint8Array(buf);
		}catch(e){ /* 落到下面 */ }
	}
	return new Uint8Array(0);
}

// 落盘通道:挂在桥上的 exportWrite;没有 = 不可用
export function exportWriterAvailable(){
	const b = getWorkspaceBridge() || {};
	if(typeof b.exportWrite === 'function'){ return true; }
	return false;
}
async function writeExport(fileName, b64){
	const b = getWorkspaceBridge() || {};
	if(typeof b.exportWrite === 'function'){ return b.exportWrite(fileName, b64); }
	// eslint-disable-next-line no-unreachable
	return { ok: false, message: '这个环境没有可写的导出目录' };
}

const KINDS = ['technique', 'conversation'];
const KIND_DESC = ['技法正文(kind=technique,与 cast_technique 同一份)', '一段对话(kind=conversation)'];

async function conversationMarkdown(id){
	const conv = await getStoreRecord(AI_ANALYSIS_STORES.conversations, id);
	if(!conv){ return null; }
	const msgs = ((await listConversationMessages(id)) || []).filter((m)=>m && (m.role === 'user' || m.role === 'assistant'));
	const lines = [`# ${conv.title || '对话'}`, ''];
	msgs.forEach((m)=>{ lines.push(`## ${m.role === 'user' ? '用户' : '星阙 AI'}${m.createdAt ? `(${m.createdAt})` : ''}`, '', `${m.content || ''}`, ''); });
	return { title: conv.title || '对话', text: lines.join('\n') };
}

export const saveDocumentTool = {
	name: 'save_document',
	level: 'additive',
	category: 'workspace',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 120000,
	enabled: ()=>exportWriterAvailable(),
	outputSchema: { type: 'object', required: ['path', 'fileName', 'bytes'], properties: { path: { type: 'string' }, fileName: { type: 'string' }, bytes: { type: 'integer' }, format: { type: 'string' }, truncated: { type: 'boolean' } } },
	description: `把${KIND_DESC.join('、')}存成文件(md / docx / pdf / txt,与应用内导出同一套排版)。只写固定的导出目录、文件名由软件定、绝不覆盖已有文件;回绝对路径。${GUIDE}:用户说「导出成文件 / 存成 Word」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['kind', 'format'], properties: {
		kind: { type: 'string', enum: KINDS },
		format: { type: 'string', enum: SAVE_DOCUMENT_FORMATS },
		technique: { type: 'string', maxLength: 40, description: 'kind=technique 必给' },
		source: { ...SOURCE_FOR_SAVE, description: 'kind=technique 必给(与 cast_technique 同,只是已存档案的 id 字段叫 recordId)' },
		conversationId: { type: 'string', maxLength: 80, description: 'kind=conversation 必给(list_conversations 查)' },
		options: { type: 'object', additionalProperties: true, description: 'kind=technique:与 cast_technique 的 options 同' },
	} },
	async run(args, ctx){
		let title = ''; let text = ''; let prefix = 'horosa'; let ready = null; let truncated = false;
		if(!KINDS.includes(args.kind)){ return { ok: false, code: 'E_ARGS_INVALID', message: `kind 只能是 ${KINDS.join(' / ')}` }; }
		if(args.kind === 'technique'){
			if(!args.technique || !args.source){ return { ok: false, code: 'E_ARGS_INVALID', message: 'kind=technique 要给 technique 与 source' }; }
			// 这里直接调起盘工具的本体(不经注册表):用户按工具名禁用了 cast_technique 时,同一份正文不该换个名字照样拿得到
			if(isToolDenied('cast_technique', getToolPolicy())){ return { ok: false, code: 'E_APPROVAL_DENIED', message: '工具 cast_technique 已被用户禁用,技法正文不导出' }; }
			const r = await castTechniqueTool.run({ technique: args.technique, source: toCastSource(args.source), options: args.options, maxChars: 60000 }, ctx);
			if(!r || !r.ok){ return r || { ok: false, code: 'E_CAST_FAILED', message: '技法正文没取到' }; }
			text = `${(r.data && r.data.content) || ''}`;
			truncated = !!(r.data && r.data.truncated);
			title = `${(r.data && r.data.title) || args.technique}`;   // 文件标题用中文技法名(八字),不是键名(bazi)
			prefix = `horosa_${args.technique}`;
		}else{
			if(ctx && ctx.origin === 'mcp' && !isPrivateReadEnabled()){ return { ok: false, code: 'E_TOOL_DISABLED', message: '对话属私人内容:用户打开「私人内容可读」后才能导出' }; }
			if(!args.conversationId){ return { ok: false, code: 'E_ARGS_INVALID', message: 'kind=conversation 要给 conversationId' }; }
			const c = await conversationMarkdown(args.conversationId);
			if(!c){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `没有这段对话:${`${args.conversationId}`.slice(0, 80)}` }; }
			title = c.title; text = c.text; prefix = 'horosa_conversation';
		}
		if(!ready && !text.trim()){ return { ok: false, code: 'E_SNAPSHOT_MISSING', message: '没有可导出的正文' }; }
		let bytes = ready;
		if(bytes){ /* 已是成品字节 */ }else if(args.format === 'md' || args.format === 'txt'){
			bytes = new TextEncoder().encode(text);
		}else if(args.format === 'pdf'){
			// 与应用内「导出 PDF」同一矢量引擎(文字可选可搜、内嵌中文字体)
			try{
				const { buildExportPdfVectorBlob } = await import('../../aiExportPdfVector');
				bytes = await blobBytes(await buildExportPdfVectorBlob({ tech: title, text }));
			}catch(e){
				return { ok: false, code: 'E_CAST_FAILED', message: `PDF 没生成出来:${(e && e.message) || e}` };
			}
		}else{
			const { buildExportDocxBlob } = await import('../../aiExportDocRender');
			bytes = await blobBytes(await buildExportDocxBlob({ tech: title, text }));
		}
		if(!bytes || !bytes.length){ return { ok: false, code: 'E_CAST_FAILED', message: '文件没生成出来' }; }
		if(bytes.length > SAVE_DOCUMENT_MAX_BYTES){ return { ok: false, code: 'E_ARGS_INVALID', message: `文件超过 ${SAVE_DOCUMENT_MAX_BYTES / 1024 / 1024} MB 上限` }; }
		const fileName = exportFileName(prefix, args.format);
		let w;
		try{ w = await writeExport(fileName, toBase64(bytes)); }catch(e){ w = { ok: false, message: e && e.message ? e.message : `${e}` }; }
		if(!w || !w.ok){ return { ok: false, code: 'E_STORE_QUOTA', message: (w && w.message) || '落盘失败' }; }
		// 正文超过上限被截断时如实说(文件末尾是截断标记,不是全文)
		return { ok: true, data: { path: w.path || '', fileName, bytes: bytes.length, format: args.format, mime: MIME[args.format], ...(truncated ? { truncated: true } : {}) }, summary: `存成文件 ${fileName}${truncated ? '(正文超过 6 万字,已截断)' : ''}`, message: `已存成 ${fileName}${w.path ? `(${w.path})` : ''}${truncated ? ';正文超过 6 万字上限,文件里是截断后的内容' : ''}` };
	},
};

export default saveDocumentTool;
