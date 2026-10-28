// AI 助手·玄学史检索:事件(正史 / 方志等)/ 人物 / 术数 / 故事 的关键词检索与详情读取。
// 只读、零动作;取数单源 services/xuanshi(与「玄史」页同一接口、同一缓存);正文按上限截断。
import { fetchSearch, fetchFigures, fetchStories, fetchTechniques, fetchEvent, fetchFigure, fetchTechnique, fetchStory, fetchDynasty, fetchCelestialTerm } from '../../../services/xuanshi';
import { GUIDE } from './_shared';
import { ensureNeutralMatcher, containsNeutral } from '../../scriptNeutralMatch';

export const XUANSHI_KINDS = ['events', 'figures', 'techniques', 'stories'];
export const XUANSHI_ITEM_KINDS = ['event', 'figure', 'technique', 'story', 'dynasty', 'term'];
export const XUANSHI_LIMIT_MAX = 50;
export const XUANSHI_OFFSET_MAX = 1000;
const BRIEF_MAX = 160;

const brief = (s)=>{ const t = `${s || ''}`.replace(/\s+/g, ' ').trim(); return t.length > BRIEF_MAX ? `${t.slice(0, BRIEF_MAX)}…` : t; };
const listOf = (res)=>(Array.isArray(res) ? res : ((res && (res.items || res.list || res.stories || res.techniques)) || []));
// 本地兜底过滤:繁简都认(与 list_records 同一 anyScript 口径;不随界面档位变)。调用前 run 已 await ensureNeutralMatcher
const matches = (item, q)=>(!q ? true : containsNeutral(JSON.stringify(item || {}), q));

function cardOf(kind, x){
	if(kind === 'events'){ return { kind: 'event', id: `${x.event_id || ''}`, title: x.title || '', period: x.period || '', dynasty: x.dynasty || '', citation: x.citation || '', brief: brief(x.modern_text || x.outcome || x.procedure || x.original_text) }; }
	if(kind === 'figures'){ return { kind: 'figure', id: `${x.slug || ''}`, title: x.name || x.title || x.slug || '', dynasty: x.dynasty || '', brief: brief(x.summary || x.brief || x.intro) }; }
	if(kind === 'techniques'){ return { kind: 'technique', id: `${x.slug || ''}`, title: x.name || x.title || x.slug || '', category: x.category || '', brief: brief(x.summary || x.brief || x.intro) }; }
	return { kind: 'story', id: `${x.slug || ''}`, title: x.title || x.slug || '', dynasty: x.dynasty || '', brief: brief(x.summary || x.brief || x.dek || x.body) };
}

export const searchXuanshiTool = {
	name: 'search_xuanshi',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	cacheable: true,
	timeoutMs: 30000,
	description: `检索中国玄学史资料库:events=史籍中的占验事件(正史 / 方志等,带出处)· figures=人物 · techniques=术数门类 · stories=故事。返回 id 与摘要;要全文用 get_xuanshi_item。tradition 只对 events 有效(如 zhengshi 正史)。翻页用 offset(回包 nextOffset 为下一页起点,null = 没有了;totalExact=false 时 total 只是已知下限)。${GUIDE}:用户问历史上的占验案例、人物或术数源流时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['query'],
		properties: {
			query: { type: 'string', minLength: 1, maxLength: 60 },
			kind: { type: 'string', enum: XUANSHI_KINDS, default: 'events' },
			tradition: { type: 'string', maxLength: 30 },
			limit: { type: 'integer', minimum: 1, maximum: XUANSHI_LIMIT_MAX, default: 20 },
			offset: { type: 'integer', minimum: 0, maximum: XUANSHI_OFFSET_MAX, default: 0 },
		},
	},
	outputSchema: { type: 'object', required: ['items', 'kind'], properties: { kind: { type: 'string' }, items: { type: 'array', items: { type: 'object', required: ['kind', 'id', 'title'] } }, total: { type: 'integer' }, totalExact: { type: 'boolean' }, offset: { type: 'integer' }, nextOffset: { type: ['integer', 'null'] } } },
	async run(args){
		await ensureNeutralMatcher();
		const kind = args.kind || 'events';
		const limit = args.limit || 20;
		const offset = args.offset || 0;
		const q = `${args.query}`.trim();
		let raw;
		try{
			// 事件检索接口不收 offset、也不回总数:从头多取一条(offset+limit+1)本地切页,多出的那条说明还有下一页;
			// 人物 / 故事接口收 offset(人物另回总数),同样多取一条判下一页;术数门类是整表,本地过滤后切页
			if(kind === 'events'){ raw = await fetchSearch({ q, limit: offset + limit + 1, ...(args.tradition ? { tradition: args.tradition } : {}) }); }
			else if(kind === 'figures'){ raw = await fetchFigures({ q, limit: limit + 1, offset }); }
			else if(kind === 'stories'){ raw = await fetchStories({ q, limit: limit + 1, offset }); }
			else{ raw = await fetchTechniques({}); }
		}catch(e){
			return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: `玄学史资料库没取到(${e && e.message ? e.message : e});需本机计算服务在线`, retryable: true };
		}
		let items = listOf(raw);
		const serverPaged = kind === 'figures' || kind === 'stories';
		if(kind === 'techniques'){ items = items.filter((x)=>matches(x, q)); }
		// 统一成「从 0 起的命中序列」里的位置:接口已按 offset 切过的,本页就是返回的前 limit 条
		const page = serverPaged ? items.slice(0, limit) : items.slice(offset, offset + limit);
		const seenEnd = serverPaged ? offset + items.length : items.length;   // 已见到的命中条数(含多取的那一条)
		const hasMore = seenEnd > offset + page.length;
		const knownTotal = Number.isFinite(raw && raw.total) ? raw.total : null;
		// 总数:接口给了用接口的;没给且已见到末尾 = 精确;否则只是已知下限(totalExact=false)
		const totalExact = knownTotal !== null || !hasMore;
		const total = knownTotal !== null ? knownTotal : seenEnd;
		const nextOffset = page.length && hasMore ? offset + page.length : null;
		return { ok: true, data: { kind, items: page.map((x)=>cardOf(kind, x)), total, totalExact, offset, nextOffset }, summary: `玄学史 ${kind} 命中 ${total}${totalExact ? '' : '+'}` };
	},
};

export const getXuanshiItemTool = {
	name: 'get_xuanshi_item',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	cacheable: true,
	timeoutMs: 30000,
	description: `读取玄学史资料库的一条全文:event(按 event_id)/ figure · technique · story · dynasty · term(按 slug)。id 来自 search_xuanshi。引用时写明出处(citation)。${GUIDE}:需要引用某条史料全文时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['kind', 'id'],
		properties: {
			kind: { type: 'string', enum: XUANSHI_ITEM_KINDS },
			id: { type: 'string', minLength: 1, maxLength: 120 },
			maxChars: { type: 'integer', minimum: 500, maximum: 60000, default: 12000 },
		},
	},
	outputSchema: { type: 'object', required: ['kind', 'id', 'content', 'truncated'], properties: { kind: { type: 'string' }, id: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' }, truncated: { type: 'boolean' } } },
	async run(args){
		const id = `${args.id}`.trim();
		const fetchers = { event: fetchEvent, figure: fetchFigure, technique: fetchTechnique, story: fetchStory, dynasty: fetchDynasty, term: fetchCelestialTerm };
		let item;
		try{ item = await fetchers[args.kind](id); }
		catch(e){
			const msg = e && e.message ? `${e.message}` : `${e}`;
			if(/not.?found|不存在|unknown/i.test(msg)){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `玄学史资料库没有这条:${args.kind} ${id.slice(0, 60)}` }; }
			return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: `玄学史资料库没取到(${msg});需本机计算服务在线`, retryable: true };
		}
		if(!item || (typeof item === 'object' && !Object.keys(item).length)){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `玄学史资料库没有这条:${args.kind} ${id.slice(0, 60)}` }; }
		const text = JSON.stringify(item, null, 1);
		const max = args.maxChars || 12000;
		const truncated = text.length > max;
		const title = `${(item && (item.title || item.name)) || ''}`;
		return { ok: true, data: { kind: args.kind, id, title, content: truncated ? `${text.slice(0, max)}\n[truncated: 剩余 ${text.length - max} 字符]` : text, truncated }, summary: `玄学史 ${args.kind} ${title || id}` };
	},
};
