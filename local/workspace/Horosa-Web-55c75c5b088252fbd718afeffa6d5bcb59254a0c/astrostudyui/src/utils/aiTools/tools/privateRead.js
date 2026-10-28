// AI 助手·私人内容读取(子开关「私人内容可读」缺省关,关 = 三件工具不进任何目录、直呼其名也拒):
// 与星阙 AI 的对话记录 / 档案的备注与断事日志 / 档案之间的关系 / 命盘的命主实况。只经本机 MCP 给外部客户端(origins:['mcp']),
// 页面内的 AI 本来就看得到挂载内容,不需要这条路。只读、零动作;正文按上限截断。
import { isPrivateReadEnabled } from '../../aiAgent/prefs';
import { ensureNeutralMatcher, containsNeutral } from '../../scriptNeutralMatch';
import { AI_ANALYSIS_STORES, listStoreRecords, getStoreRecord, listConversationMessages } from '../../aiAnalysisStore';
import { listLocalCharts } from '../../localcharts';
import { listLocalCases } from '../../localcases';
import { GUIDE, RECORD_ID_PATTERN } from './_shared';
import { buildSubjectFacts, clipText, isSubjectFactsEnabled } from '../../subjectFacts';

export const CONVERSATION_LIST_MAX = 100;
export const CONVERSATION_MESSAGES_MAX = 200;
const MEMO_SLOTS = { memoAstro: '星盘', memoBaZi: '八字', memoZiWei: '紫微', memo74: '七政', memoGua: '卦', memoLiuReng: '六壬', memoQiMeng: '奇门', memoSuZhan: '宿占' };
const clip = (s, n)=>clipText(s || '', n);   // 截断口径与命主实况同一份
const PRIVATE_GATE = ()=>isPrivateReadEnabled();

function findRecord(recordId){
	const id = `${recordId || ''}`;
	const chart = listLocalCharts({ includeArchived: true }).find((r)=>r && r.cid === id);
	if(chart){ return { kind: 'chart', rec: chart }; }
	const kase = listLocalCases({ includeArchived: true }).find((r)=>r && r.cid === id);
	return kase ? { kind: 'case', rec: kase } : null;
}
function titleOfRecord(recordId){
	const f = findRecord(recordId);
	if(!f){ return ''; }
	return f.kind === 'chart' ? `${f.rec.name || ''}` : `${f.rec.event || ''}`;
}

export const listConversationsTool = {
	name: 'list_conversations',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['mcp'],
	enabled: PRIVATE_GATE,
	description: `列出你与星阙 AI 的对话记录(标题、关联的命盘 / 事盘、合盘对方、最后一条消息时间),新的在前;query 按标题与案例名过滤。要看对话正文用 get_conversation。(需在「外部连接」里开「私人内容可读」)。${GUIDE}:用户要你参考以前与星阙 AI 的对话时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			query: { type: 'string', maxLength: 60 },
			includeArchived: { type: 'boolean', default: false },
			limit: { type: 'integer', minimum: 1, maximum: CONVERSATION_LIST_MAX, default: 20 },
			offset: { type: 'integer', minimum: 0, default: 0 },
		},
	},
	outputSchema: { type: 'object', required: ['items', 'total'], properties: { items: { type: 'array', items: { type: 'object', required: ['conversationId', 'title'] } }, total: { type: 'integer' }, nextOffset: { type: ['integer', 'null'] } } },
	async run(args){
		const q = `${args.query || ''}`.trim();
		await ensureNeutralMatcher();   // 繁简都认(与 list_records 同一 anyScript 口径;不随界面档位变)
		const all = ((await listStoreRecords(AI_ANALYSIS_STORES.conversations)) || [])
			.filter((c)=>c && c.id && (args.includeArchived || !c.archived))
			.filter((c)=>!q || containsNeutral(`${c.title || ''} ${(c.sourceRef && c.sourceRef.title) || ''} ${(c.partnerRef && c.partnerRef.title) || ''}`, q))
			.sort((a, b)=>`${b.lastMessageAt || b.updatedAt || ''}`.localeCompare(`${a.lastMessageAt || a.updatedAt || ''}`));
		const limit = args.limit || 20;
		const offset = args.offset || 0;
		const items = all.slice(offset, offset + limit).map((c)=>({
			conversationId: `${c.id}`, title: `${c.title || ''}`,
			source: c.sourceRef ? { recordId: c.sourceRef.id, kind: c.sourceRef.sourceType, title: c.sourceRef.title } : null,
			partner: c.partnerRef ? { recordId: c.partnerRef.id, title: c.partnerRef.title } : null,
			techniques: Array.isArray(c.techniqueKeys) ? c.techniqueKeys.slice(0, 12) : [],
			model: c.model || '', lastMessageAt: c.lastMessageAt || c.updatedAt || null, archived: !!c.archived, favorite: !!c.favorite,
		}));
		return { ok: true, data: { items, total: all.length, nextOffset: offset + limit < all.length ? offset + limit : null }, summary: `对话 ${items.length}/共 ${all.length}` };
	},
};

export const getConversationTool = {
	name: 'get_conversation',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['mcp'],
	enabled: PRIVATE_GATE,
	description: `读取一段与星阙 AI 的对话正文(用户与 AI 的消息,按时间先后;默认取最后 limit 条,每条按 maxCharsPerMessage 截断)。conversationId 来自 list_conversations。(需开「私人内容可读」)。${GUIDE}:用户要你参考某段具体对话时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['conversationId'],
		properties: {
			conversationId: { type: 'string', minLength: 1, maxLength: 80 },
			limit: { type: 'integer', minimum: 1, maximum: CONVERSATION_MESSAGES_MAX, default: 30 },
			maxCharsPerMessage: { type: 'integer', minimum: 200, maximum: 20000, default: 4000 },
		},
	},
	outputSchema: { type: 'object', required: ['conversationId', 'messages', 'total'], properties: { conversationId: { type: 'string' }, title: { type: 'string' }, messages: { type: 'array', items: { type: 'object', required: ['role', 'content'] } }, total: { type: 'integer' } } },
	async run(args){
		const id = `${args.conversationId}`;
		let conv = null;
		try{ conv = await getStoreRecord(AI_ANALYSIS_STORES.conversations, id); }catch(e){ conv = null; }
		if(!conv){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `没有这段对话:${id.slice(0, 80)}` }; }
		const msgs = ((await listConversationMessages(id)) || []).filter((m)=>m && (m.role === 'user' || m.role === 'assistant'));
		const limit = args.limit || 30;
		const per = args.maxCharsPerMessage || 4000;
		const messages = msgs.slice(-limit).map((m)=>({ role: m.role, content: clip(m.content, per), at: m.createdAt || null, ...(m.streamStatus && m.streamStatus !== 'done' ? { status: m.streamStatus } : {}) }));
		return { ok: true, data: { conversationId: id, title: `${conv.title || ''}`, messages, total: msgs.length }, summary: `对话 ${conv.title || id}:${messages.length}/${msgs.length} 条` };
	},
};

export const getRecordDetailTool = {
	name: 'get_record_detail',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['mcp'],
	enabled: PRIVATE_GATE,
	description: `读取一张命盘 / 事盘的私人内容:通用备注、各技法批注、断事日志(新在前)、与其它档案的关系、标签;命盘另附命主实况(用户本人填写的命主真实情况,与星阙对话里发给 AI 的同一段;只有用户在星阙里对这张命盘打开了「发送」才附,否则为 null)。recordId 用 list_records 取。(需开「私人内容可读」)。${GUIDE}:用户要你参考某张档案的备注、断事日志或命主实况时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['recordId'],
		properties: {
			recordId: { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80 },
			maxChars: { type: 'integer', minimum: 500, maximum: 60000, default: 12000, description: '每段备注 / 日志条目的上限' },
		},
	},
	outputSchema: { type: 'object', required: ['recordId', 'kind', 'title', 'journal', 'relations', 'subjectFacts'], properties: { recordId: { type: 'string' }, kind: { type: 'string' }, title: { type: 'string' }, memo: { type: 'string' }, notes: { type: 'object' }, journal: { type: 'array' }, relations: { type: 'array' }, tags: { type: 'array' }, subjectFacts: { type: ['object', 'null'], required: ['count', 'groups', 'text'], properties: { count: { type: 'integer' }, groups: { type: 'array' }, text: { type: 'string' } } } } },
	async run(args){
		const f = findRecord(args.recordId);
		if(!f){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `没有这张档案:${`${args.recordId}`.slice(0, 80)}` }; }
		const r = f.rec;
		const max = args.maxChars || 12000;
		const notes = {};
		if(f.kind === 'chart'){ Object.keys(MEMO_SLOTS).forEach((k)=>{ if(r[k]){ notes[MEMO_SLOTS[k]] = clip(typeof r[k] === 'string' ? r[k] : JSON.stringify(r[k]), max); } }); }
		let tags = [];
		try{ const g = typeof r.group === 'string' ? JSON.parse(r.group) : r.group; tags = Array.isArray(g) ? g : []; }catch(e){ tags = []; }
		const data = {
			recordId: r.cid, kind: f.kind, title: f.kind === 'chart' ? `${r.name || ''}` : `${r.event || ''}`,
			time: f.kind === 'chart' ? (r.birth || '') : (r.divTime || ''), pos: r.pos || '',
			memo: clip(r.memo || '', max), notes,
			journal: (Array.isArray(r.journal) ? r.journal : []).map((j)=>({ at: (j && j.at) || '', text: clip(j && j.text, max) })),
			relations: (Array.isArray(r.relations) ? r.relations : []).map((x)=>({ recordId: x && x.cid, type: x && x.type, title: titleOfRecord(x && x.cid) })),
			tags, archived: !!r.archived,
			subjectFacts: null,
		};
		// 命主实况:只有命盘有;口径与对话页的「命主实况」层同一份。两道门:「私人内容可读」(本工具的门)+ 这张命盘的发送开关(缺省不发)
		if(f.kind === 'chart' && isSubjectFactsEnabled(r.cid)){
			const sf = buildSubjectFacts(r);
			if(sf.count){ data.subjectFacts = { count: sf.count, groups: sf.items.map((g)=>({ title: g.title, total: g.total, entries: g.entries })), text: sf.text }; }
		}
		return { ok: true, data, summary: `档案详情 ${data.title}` };
	},
};
