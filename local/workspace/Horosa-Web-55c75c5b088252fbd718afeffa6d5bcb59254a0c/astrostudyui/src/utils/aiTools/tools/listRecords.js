import { parseLocalDateTimeMs } from '../../dateTimeParse';
import { listLocalCharts } from '../../localcharts';
import { listLocalCases, CASE_TYPE_OPTIONS, getCaseTypeMeta } from '../../localcases';
import { GUIDE } from './_shared';
import { ensureNeutralMatcher } from '../../scriptNeutralMatch';   // 工具层不直接依赖显示层:经与界面档位无关的入口

function tags(group){
	try{ const v = typeof group === 'string' ? JSON.parse(group) : group; return Array.isArray(v) ? v : []; }catch(e){ return []; }
}

export default {
	name: 'list_records',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	cacheable: true,
	// 输出结构(外部客户端据此校验 structuredContent;brief 只回 cid/kind/title/time,其余字段可缺)
	outputSchema: {
		type: 'object', required: ['items', 'total', 'offset', 'limit', 'truncated'],
		properties: {
			items: { type: 'array', items: { type: 'object', required: ['cid', 'kind'], properties: { cid: { type: 'string' }, kind: { type: 'string', enum: ['chart', 'case'] }, title: { type: ['string', 'null'] }, time: { type: ['string', 'null'] } } } },
			total: { type: 'integer' }, offset: { type: 'integer' }, limit: { type: 'integer' }, nextOffset: { type: ['integer', 'null'] }, truncated: { type: 'boolean' },
		},
	},
	description: `列出/检索本地命盘与事盘的摘要(不含技法快照与备注正文),分页返回 items/total/offset/limit/nextOffset/truncated:结果超页时用 offset=nextOffset 翻页;只要 cid 用 fields:'brief'(每条仅 cid/kind/title/time)。${GUIDE}:仅当用户提到已有档案、或需要按姓名/事件找 cid 时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			kind: { type: 'string', enum: ['chart', 'case', 'all'], default: 'all' },
			query: { type: 'string', maxLength: 60, description: '姓名(命盘)/事件标题(事盘)子串' },
			tag: { type: 'string', maxLength: 20 },
			caseType: { type: 'string', enum: CASE_TYPE_OPTIONS.map((o)=>o.value) },
			includeArchived: { type: 'boolean', default: false },
			limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
			offset: { type: 'integer', minimum: 0, default: 0, description: '起始序号(0 起);翻页填上一页返回的 nextOffset' },
			fields: { type: 'string', enum: ['full', 'brief'], default: 'full', description: 'brief=每条只回 cid/kind/title/time' },
		},
	},
	async run(args){
		const items = [];
		// AI 不对着屏幕检索:检索词繁简都可能,不论界面当前简繁都两边归一(转换器先按需加载;没加载到就按原词比)
		const hasQuery = typeof args.query === 'string' && args.query.trim() !== '';
		if(hasQuery){ await ensureNeutralMatcher(); }
		const filt = { name: args.query, tag: args.tag, includeArchived: !!args.includeArchived, anyScript: hasQuery };
		if(args.kind !== 'case'){
			listLocalCharts(filt).forEach((r)=>items.push({ cid: r.cid, kind: 'chart', title: r.name, time: r.birth, zone: r.zone, pos: r.pos, gender: r.gender, tags: tags(r.group), updateTime: r.updateTime, archived: !!r.archived }));
		}
		if(args.kind !== 'chart'){
			listLocalCases(filt).filter((r)=>!args.caseType || getCaseTypeMeta(r.caseType).value === args.caseType)
				.forEach((r)=>items.push({ cid: r.cid, kind: 'case', title: r.event, time: r.divTime, zone: r.zone, pos: r.pos, gender: r.gender, caseType: getCaseTypeMeta(r.caseType).value, module: r.sourceModule, tags: tags(r.group), updateTime: r.updateTime, archived: !!r.archived }));
		}
		items.sort((a, b)=>(parseLocalDateTimeMs(b.updateTime || '') || 0) - (parseLocalDateTimeMs(a.updateTime || '') || 0));
		const limit = args.limit || 20;
		const offset = Number.isFinite(args.offset) && args.offset > 0 ? Math.floor(args.offset) : 0;
		const brief = args.fields === 'brief';
		const page = items.slice(offset, offset + limit).map((it)=>(brief ? { cid: it.cid, kind: it.kind, title: it.title, time: it.time } : it));
		const nextOffset = offset + limit < items.length ? offset + limit : null;
		const range = page.length ? `第 ${offset + 1}–${offset + page.length} 条` : `offset ${offset} 越界,本页为空`;
		return { ok: true, data: { items: page, total: items.length, offset, limit, nextOffset, truncated: nextOffset !== null }, summary: `记录 ${range}/共 ${items.length}` };
	},
};
