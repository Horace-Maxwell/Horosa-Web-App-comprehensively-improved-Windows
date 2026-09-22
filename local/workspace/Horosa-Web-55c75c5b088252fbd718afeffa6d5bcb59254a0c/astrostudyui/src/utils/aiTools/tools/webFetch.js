// AI 助手·网页读取工具(批三①;出站③):只读、默认关(子开关 horosa.ai.tools.webFetch.enabled 只认 '1')。
// 读回来的是纯文本(后端转换、段落对齐截断),带「未经核实」标记;地址与正文都不进账本(只读工具无 undo)。
import { GUIDE } from './_shared';
import { isWebFetchEnabled } from '../../aiAgent/prefs';
import { runWebFetch, WEB_FETCH_MAX_CHARS, WEB_FETCH_DEFAULT_CHARS, WEB_FETCH_URL_MAX, WEB_FETCH_UNVERIFIED } from '../../../integrations/webFetch';

export default {
	name: 'web_fetch',
	level: 'read',
	category: 'external',
	undoKind: 'none',
	cacheable: true,
	enabled: ()=>isWebFetchEnabled(),
	timeoutMs: 35000,
	description: `读取一个公开网页的正文(纯文本,已去脚本样式;默认 ${WEB_FETCH_DEFAULT_CHARS} 字、最多 ${WEB_FETCH_MAX_CHARS} 字,按段落截断)。用于把检索结果里的某条链接读全、核对外部资料;只出 http/https 公开网址,本机与内网地址会被拒绝。${GUIDE},或用户给了链接要你读;不要用它读排盘数据(排盘一律用 cast_technique)。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['url'],
		properties: {
			url: { type: 'string', minLength: 8, maxLength: WEB_FETCH_URL_MAX, description: 'http/https 网址' },
			maxChars: { type: 'integer', minimum: 200, maximum: WEB_FETCH_MAX_CHARS, default: WEB_FETCH_DEFAULT_CHARS, description: '最多返回多少字(段落对齐截断)' },
		},
	},
	async run(args, ctx){
		const r = await runWebFetch({ url: args.url, maxChars: args.maxChars, signal: ctx && ctx.signal });
		if(!r.ok){ return { ok: false, code: r.code, message: r.message }; }
		return {
			ok: true,
			data: r.data,
			summary: `读取网页「${r.data.title || r.data.url}」:${r.data.text.length} 字${r.data.truncated ? `(已截,全文 ${r.data.totalChars} 字)` : ''}`,
			assumptions: [WEB_FETCH_UNVERIFIED],
		};
	},
};
