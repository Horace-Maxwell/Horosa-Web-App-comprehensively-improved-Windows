// AI 助手·联网检索工具(P7;出站②):只读、默认关(子开关 horosa.ai.tools.webSearch.enabled 只认 '1')。
// 结果带来源 URL 并标「未经核实」;检索词与结果都不进账本(只读工具无 undo)。
import { GUIDE } from './_shared';
import { isWebSearchEnabled } from '../../aiAgent/prefs';
import { runWebSearch, WEB_SEARCH_MAX_RESULTS, WEB_SEARCH_UNVERIFIED } from '../../../integrations/webSearch';

export default {
	name: 'web_search',
	level: 'read',
	category: 'external',
	undoKind: 'none',
	cacheable: true,
	enabled: ()=>isWebSearchEnabled(),
	timeoutMs: 20000,
	description: `联网检索:按关键词查外部搜索引擎,返回 results[{title,url,snippet,publishedAt}]。用于时事、外部资料、地名核对等**排盘数据之外**的信息;命理判断本身不要依赖检索。${GUIDE}:用户明确要求查资料/查新闻,或缺少排盘之外的事实时。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['query'],
		properties: {
			query: { type: 'string', minLength: 1, maxLength: 300, description: '检索词' },
			maxResults: { type: 'integer', minimum: 1, maximum: WEB_SEARCH_MAX_RESULTS, default: 5 },
			freshness: { type: 'string', maxLength: 10, description: '时效:day/week/month/year 或天数(可选;只有 Tavily 引擎消费,其它引擎忽略此参数)' },   // [Q-294/M-109·AR-25] 如实标明生效范围
			site: { type: 'string', maxLength: 100, description: '限定站点域名(可选)' },
		},
	},
	async run(args, ctx){
		// [Q1] ctx.signal 下传:用户点停止 → 这次出站检索同样中止
		const r = await runWebSearch({ query: args.query, maxResults: args.maxResults, freshness: args.freshness, site: args.site, signal: ctx && ctx.signal });
		if(!r.ok){ return { ok: false, code: r.code, message: r.message }; }
		return {
			ok: true,
			data: r.data,
			summary: `联网检索「${args.query}」:${(r.data.results || []).length} 条(${r.data.engine})`,
			assumptions: [WEB_SEARCH_UNVERIFIED],
		};
	},
};
