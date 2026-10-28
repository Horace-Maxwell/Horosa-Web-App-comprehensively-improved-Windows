// AI 助手·读取当前页正文 read_current_page:你眼前这一页(当前技法页)的「AI 导出」正文。
// 与页面「AI导出」按钮同一份内容(同一导出设置、同一过滤链、同一导出头),只取文本:不落盘、不进剪贴板、不截图。
// 只经本机 MCP 给外部客户端(页面内的 AI 本来就有挂载内容)。
import { splitContentSections } from '../../aiExport';
import { GUIDE } from './_shared';

export default {
	name: 'read_current_page',
	level: 'read',
	category: 'workspace',
	undoKind: 'none',
	origins: ['mcp'],
	timeoutMs: 60000,
	description: `读取用户眼前这一页(当前打开的技法页)的「AI 导出」正文,与页面「AI导出」按钮同一份内容(按用户的导出设置过滤),不落盘、不进剪贴板。${GUIDE}:用户说「看看我现在这张盘 / 这一页」时调用;要指定档案的某技法快照用 cast_technique。内容长时先按 sections 只取需要的段`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			maxChars: { type: 'integer', minimum: 500, maximum: 60000, default: 12000 },
			sections: { type: 'array', items: { type: 'string', maxLength: 40 }, maxItems: 12, description: '只取这些段(段名子串匹配);不传 = 全文按 maxChars 截断' },
		},
	},
	outputSchema: {
		type: 'object', required: ['technique', 'content', 'truncated', 'totalChars'],
		properties: { technique: { type: 'string' }, exportKey: { type: 'string' }, content: { type: 'string' }, truncated: { type: 'boolean' }, totalChars: { type: 'integer' }, availableSections: { type: 'array', items: { type: 'string' } } },
	},
	async run(args){
		const mod = await import('../../aiExport');
		let p;
		try{ p = await mod.buildCurrentPageExportForTool(); }
		catch(e){ return { ok: false, code: 'E_TOOL_FAILED', message: `当前页正文没取到:${e && e.message ? e.message : e}` }; }
		const full = `${(p && p.text) || ''}`;
		if(!`${(p && p.content) || ''}`.trim()){
			return p && p.clearedByUser
				? { ok: false, code: 'E_SNAPSHOT_MISSING', message: `「${p.technique}」的导出分段已在「AI导出设置」里全部取消勾选,所以没有正文;请用户去设置里勾回需要的段` }
				: { ok: false, code: 'E_SNAPSHOT_MISSING', message: '当前页面没有可导出的正文(可能还没起盘,或这一页不是技法页)' };
		}
		const wanted = Array.isArray(args.sections) ? args.sections.map((x)=>`${x || ''}`.trim()).filter(Boolean) : [];
		const all = splitContentSections(full);
		let picked = full;
		if(wanted.length){
			const hit = all.filter((sec)=>sec.title && wanted.some((w)=>`${sec.title}`.indexOf(w) >= 0));
			if(!hit.length){ return { ok: false, code: 'E_SECTION_NOT_FOUND', message: '一段都没匹配上', data: { availableSections: all.map((s)=>s.title).filter(Boolean).slice(0, 40) } }; }
			picked = hit.map((sec)=>sec.lines.join('\n')).join('\n');
		}
		const max = args.maxChars || 12000;
		const truncated = picked.length > max;
		return {
			ok: true,
			data: { technique: `${p.technique || ''}`, exportKey: `${p.exportKey || ''}`, content: truncated ? `${picked.slice(0, max)}\n[truncated: 剩余 ${picked.length - max} 字符]` : picked, truncated, totalChars: picked.length, availableSections: all.map((s)=>s.title).filter(Boolean).slice(0, 40) },
			summary: `当前页 ${p.technique || ''}`,
		};
	},
};
