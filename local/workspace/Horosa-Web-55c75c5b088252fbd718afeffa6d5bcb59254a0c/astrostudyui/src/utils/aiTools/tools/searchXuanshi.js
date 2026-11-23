// AI 助手·玄学史检索:事件(正史 / 方志等)/ 人物 / 术数 / 故事 的关键词检索与详情读取。
// 只读、零动作;取数单源 services/xuanshi(与「玄史」页同一接口、同一缓存);正文按上限截断。
import { fetchSearch, fetchFigures, fetchStories, fetchTechniques, fetchEvent, fetchFigure, fetchTechnique, fetchStory, fetchDynasty, fetchCelestialTerm,
	fetchEvents, fetchCelestial, fetchCelestialEvent, fetchSummary, fetchDynasties, fetchCelestialTerms, fetchFacets, fetchTimeline, fetchDecadeOmens, fetchMicrochronology, fetchDaily, fetchMap, fetchPersonsGraph } from '../../../services/xuanshi';
import { GUIDE } from './_shared';
import { ensureNeutralMatcher, containsNeutral } from '../../scriptNeutralMatch';

// celestial = 史书天象记录(日食 / 五星 / 彗孛 / 流星 …,两万七千余条;与「玄史」页星象大典同一接口)
export const XUANSHI_KINDS = ['events', 'figures', 'techniques', 'stories', 'celestial'];
export const XUANSHI_ITEM_KINDS = ['event', 'figure', 'technique', 'story', 'dynasty', 'term', 'celestial_event'];
// 浏览 / 统计视图(不带检索词):与「玄史」页各入口同一接口
export const XUANSHI_VIEWS = ['summary', 'dynasties', 'terms', 'facets', 'timeline', 'decade_omens', 'microchronology', 'daily', 'map', 'persons'];
// 地图视图可选的时期(与「玄史」页地图的朝代游历同一份;不给 = 全部时期)
export const XUANSHI_MAP_PERIODS = ['西周', '春秋', '战国', '秦', '西汉', '新莽', '东汉', '三国', '西晋', '东晋', '十六国', '南朝', '北朝', '隋', '唐', '五代', '北宋', '南宋', '辽', '金', '西夏', '元', '明'];

// 地图 / 人物关系图:页面画成地图与力导向图,这里出同一份数据的文字形态(按活动量 / 共现权重降序)
export function xuanshiMapText(r, period){
	const pts = ((r && r.points) || []).slice().sort((a, b)=>(b.count || 0) - (a.count || 0));
	return { period: period || '全部时期', total: (r && r.total) || 0, places: pts.map((p)=>{ const names = p.ancient_names || []; return { place: p.modern || '', events: p.count || 0, ancientNames: names.slice(0, 8), ...(names.length > 8 ? { ancientNameCount: names.length } : {}), lng: p.lng, lat: p.lat }; }) };   // 古地名一地可达上百条(寺观街巷),只列前 8 条并给总数
}
export function xuanshiPersonsText(r){
	const nodes = ((r && r.nodes) || []).slice().sort((a, b)=>(b.weight || 0) - (a.weight || 0));
	const edges = ((r && (r.edges || r.links)) || []).slice().sort((a, b)=>(b.weight || 0) - (a.weight || 0));
	const idOf = (x)=>(x && typeof x === 'object' ? x.id : x);
	return { persons: nodes.map((n)=>({ name: n.id, weight: n.weight || 0 })), relations: edges.map((e)=>({ a: idOf(e.source), b: idOf(e.target), coOccurrence: e.weight || 0 })) };
}
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
	if(kind === 'celestial'){ return { kind: 'celestial_event', id: `${x.event_id || ''}`, title: [x.omen, x.subject, x.action, x.target].filter(Boolean).join(' · ') || `${x.omen_raw || ''}`, period: x.modern_date_disp || (x.year !== undefined && x.year !== null ? `${x.year}` : ''), dynasty: x.dynasty || '', citation: x.citation || '', brief: brief(x.modern || x.original) }; }
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
	description: `检索 / 浏览中国玄学史资料库:events=史籍中的占验事件(正史 / 方志等,带出处)· figures=人物 · techniques=术数门类 · stories=故事 · celestial=史书天象记录(日食 / 五星 / 彗孛 / 流星等,两万七千余条)。返回 id 与摘要;要全文用 get_xuanshi_item。query 可不给:events 与 celestial 这时按 dynasty / technique / omen / yearFrom / yearTo 分面列出(如「列出唐代全部天象」);分面可取哪些值用 browse_xuanshi view=facets(事件)或 view=summary(天象)看。tradition 只对 events 有效(如 zhengshi 正史)。翻页用 offset(回包 nextOffset)。${GUIDE}:用户问到历史上的占验、人物、术数源流、天象记录时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			query: { type: 'string', maxLength: 60, description: '检索词;events / celestial 可不给(按分面列出),figures / stories / techniques 不给 = 列全部' },
			kind: { type: 'string', enum: XUANSHI_KINDS, default: 'events' },
			tradition: { type: 'string', maxLength: 30 },
			dynasty: { type: 'string', maxLength: 30, description: '朝代(events / celestial;如 唐、南北朝、西汉)' },
			technique: { type: 'string', maxLength: 30, description: '术数门类(events;如 相术、占梦)' },
			omen: { type: 'string', maxLength: 30, description: '天象类别(celestial;如 日食、五星、彗孛、流星)' },
			yearFrom: { type: 'integer', minimum: -3000, maximum: 3000, description: '起始年(celestial;公元前为负)' },
			yearTo: { type: 'integer', minimum: -3000, maximum: 3000, description: '结束年(celestial)' },
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
		const q = `${args.query === undefined || args.query === null ? '' : args.query}`.trim();
		// 天象 / 不带检索词的事件:接口按页给(page / page_size)并回总数 —— 取含 offset 的那一段(offset 不是 limit 的整数倍时从头取到 offset+limit 再切)
		if(kind === 'celestial' || (kind === 'events' && !q)){
			const aligned = offset % limit === 0;
			const pageReq = aligned ? { page: offset / limit + 1, page_size: limit } : { page: 1, page_size: offset + limit };
			let res;
			try{
				res = kind === 'celestial'
					? await fetchCelestial({ ...(q ? { q } : {}), ...(args.dynasty ? { dynasty: args.dynasty } : {}), ...(args.omen ? { omen: args.omen } : {}), ...(Number.isFinite(args.yearFrom) ? { year_from: args.yearFrom } : {}), ...(Number.isFinite(args.yearTo) ? { year_to: args.yearTo } : {}), ...pageReq })
					: await fetchEvents({ ...(args.tradition ? { tradition: args.tradition } : {}), ...(args.dynasty ? { dynasty: args.dynasty } : {}), ...(args.technique ? { technique: args.technique } : {}), ...pageReq });
			}catch(e){
				return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: `玄学史资料库没取到(${e && e.message ? e.message : e});需本机计算服务在线`, retryable: true };
			}
			const rows = (res && (res.events || res.items)) || [];
			const pageRows = aligned ? rows.slice(0, limit) : rows.slice(offset, offset + limit);
			const totalAll = Number.isFinite(res && res.total) ? res.total : offset + pageRows.length;
			const next = offset + pageRows.length < totalAll && pageRows.length ? offset + pageRows.length : null;
			return { ok: true, data: { kind, items: pageRows.map((x)=>cardOf(kind, x)), total: totalAll, totalExact: Number.isFinite(res && res.total), offset, nextOffset: next }, summary: `玄学史 ${kind} 命中 ${totalAll}` };
		}
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
	description: `读取玄学史资料库的一条全文:event / celestial_event(按 event_id)/ figure · technique · story · dynasty · term(按 slug)。id 来自 search_xuanshi。引用时写明出处(citation)。${GUIDE}:需要引用某条史料全文时调用。`,
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
		const fetchers = { event: fetchEvent, figure: fetchFigure, technique: fetchTechnique, story: fetchStory, dynasty: fetchDynasty, term: fetchCelestialTerm, celestial_event: fetchCelestialEvent };
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

// 浏览 / 统计视图:资料库总览、朝代表、天象术语表、事件分面(可取哪些朝代 / 术数 / 史书)、术数 × 朝代时间轴、天象逐十年统计、天象微年表、每日一条。
// 都是「玄史」页已有入口的同一接口;回 JSON 文本(按上限截断)。
const VIEW_FETCHERS = {
	summary: ()=>fetchSummary(),
	dynasties: ()=>fetchDynasties(),
	terms: ()=>fetchCelestialTerms(),
	facets: (a)=>fetchFacets(a.tradition ? { tradition: a.tradition } : {}),
	timeline: (a)=>fetchTimeline(a.macro ? { macro: a.macro, limit: a.limit || 80 } : {}),
	decade_omens: ()=>fetchDecadeOmens({}),
	microchronology: (a)=>fetchMicrochronology({ ...(a.history ? { history: a.history } : {}), ...(a.omen ? { omen_type: a.omen } : {}), ...(Number.isFinite(a.decade) ? { decade: a.decade } : {}), limit: a.limit || 80 }),
	daily: (a)=>fetchDaily(a.date || undefined),
	map: async (a)=>xuanshiMapText(await fetchMap(a.period || undefined), a.period),
	persons: async (a)=>xuanshiPersonsText(await fetchPersonsGraph({ top_n: a.limit || 100, min_weight: Number.isFinite(a.minWeight) ? a.minWeight : 3 })),
};
export const browseXuanshiTool = {
	name: 'browse_xuanshi',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	cacheable: true,
	timeoutMs: 30000,
	description: `浏览中国玄学史资料库的目录与统计(不带检索词):summary=各类条数与分布 · dynasties=朝代表 · terms=天象术语表 · facets=占验事件可按哪些朝代 / 术数 / 史书筛 · timeline=术数门类 × 朝代的事件分布(macro 给某一门类看明细)· decade_omens=各类天象逐十年条数 · microchronology=天象微年表(可按 history 史书 / omen 天象类别 / decade 十年起始年筛)· daily=每日一条 · map=占验事件的地点分布(古今地名与事件数,可按 period 时期筛)· persons=人物共现关系(人物按加权共现度、关系按共现次数,limit 取前几位,minWeight 是最小共现次数)。要按词检索或取全文用 search_xuanshi / get_xuanshi_item。${GUIDE}:用户想总览资料库、或要先知道有哪些分面可筛时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['view'],
		properties: {
			view: { type: 'string', enum: XUANSHI_VIEWS },
			tradition: { type: 'string', maxLength: 30, description: 'facets 用' },
			macro: { type: 'string', maxLength: 30, description: 'timeline 用:某一术数门类的明细' },
			history: { type: 'string', maxLength: 30, description: 'microchronology 用:史书名(如 宋史)' },
			omen: { type: 'string', maxLength: 30, description: 'microchronology 用:天象类别' },
			decade: { type: 'integer', minimum: -3000, maximum: 3000, description: 'microchronology 用:十年起始年(如 1080)' },
			date: { type: 'string', maxLength: 10, description: 'daily 用:YYYY-MM-DD,缺省今天' },
			period: { type: 'string', enum: XUANSHI_MAP_PERIODS, description: 'map 用:时期,缺省全部' },
			minWeight: { type: 'integer', minimum: 1, maximum: 50, default: 3, description: 'persons 用:两人至少共现几次才算一条关系' },
			limit: { type: 'integer', minimum: 1, maximum: 200, default: 80 },
			maxChars: { type: 'integer', minimum: 500, maximum: 60000, default: 12000 },
		},
	},
	outputSchema: { type: 'object', required: ['view', 'content', 'truncated'], properties: { view: { type: 'string' }, content: { type: 'string' }, truncated: { type: 'boolean' }, totalChars: { type: 'integer' } } },
	async run(args){
		let res;
		try{ res = await VIEW_FETCHERS[args.view](args); }
		catch(e){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: `玄学史资料库没取到(${e && e.message ? e.message : e});需本机计算服务在线`, retryable: true }; }
		// 页面渲染用的 HTML 正文与同内容的 Markdown 并存:只留 Markdown(省一半篇幅)
		const text = JSON.stringify(res, (k, v)=>(k === 'body_html' ? undefined : v), 1) || '';
		const max = args.maxChars || 12000;
		const truncated = text.length > max;
		return { ok: true, data: { view: args.view, content: truncated ? `${text.slice(0, max)}\n[truncated: 剩余 ${text.length - max} 字符;调大 maxChars 或加筛选条件]` : text, truncated, totalChars: text.length }, summary: `玄学史 ${args.view}` };
	},
};
