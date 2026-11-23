// AI 助手·资料笔记与记忆候选
// · add_material_note:往资料库直写一条文字笔记(带来源标记 createdBy:'ai-assistant');撤销 = 删掉这条(只在建好后没被改过时)。
// · propose_memory:只往记忆候选队列投一条(与「从本会话提炼」同一队列,FIFO 50),确认 / 丢弃仍由用户在进阶页点 —— 不新开写入路径。
// · list_memories:读已确认记忆与候选(外部客户端、受「私人内容可读」门控;页面内 AI 本来就带着已确认记忆)。
import { AI_ANALYSIS_STORES, putStoreRecord, getStoreRecord, deleteStoreRecord, deleteWhere, buildMaterialSearchText } from '../../aiAnalysisStore';
import { normalizeTags } from '../../aiAnalysisSources';
import { addCandidates, listMemories, MEMORY_TEXT_MAX, MEMORY_SUBJECT_TYPES } from '../../aiChat/memory';
import { isPrivateReadEnabled } from '../../aiAgent/prefs';
import { registerUndoHandler } from '../ledger';
import { aiOriginOf, GUIDE, RECORD_ID_PATTERN } from './_shared';
import { switchHintText } from '../switchHints';

export const MATERIAL_NOTE_TEXT_MAX = 100000;
export const MATERIAL_NOTE_UNDO_KIND = 'discard-material-note';

// 撤销 AI 建的笔记:只在笔记还是建好时的样子(更新时间没变)才删;切块 / 向量一并清。
// 账本的撤销入口是同步的:存储读写是异步,按约定回 { ok:true, settle },落定才标已撤销(失败时调用方拿到的同一对象翻成失败)
async function settleMaterialNoteUndo(p){
	const cur = await getStoreRecord(AI_ANALYSIS_STORES.materials, p.id);
	if(!cur){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE', message: '笔记已不在资料库' }; }
	if(`${cur.updatedAt || ''}` !== `${p.updatedAt || ''}`){ return { ok: false, code: 'E_UNDO_RECORD_CHANGED', message: '笔记建好后被改过,不自动撤销' }; }
	await deleteStoreRecord(AI_ANALYSIS_STORES.materials, p.id);
	await deleteWhere(AI_ANALYSIS_STORES.materialChunks, (it)=>it.materialId === p.id, { index: 'materialId', value: p.id });
	await deleteWhere(AI_ANALYSIS_STORES.materialEmbeddings, (it)=>it.materialId === p.id, { index: 'materialId', value: p.id });
	return { ok: true };
}
function undoMaterialNote(action, undo){
	const p = (undo && undo.payload) || {};
	return { ok: true, data: { id: p.id }, settle: settleMaterialNoteUndo(p) };
}
try{ registerUndoHandler(MATERIAL_NOTE_UNDO_KIND, undoMaterialNote); }catch(e){ /* 重复注册(热更新)忽略 */ }

export const addMaterialNoteTool = {
	name: 'add_material_note',
	level: 'additive',
	category: 'records',
	undoKind: MATERIAL_NOTE_UNDO_KIND,
	origins: ['in-app', 'mcp'],
	outputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, name: { type: 'string' }, chars: { type: 'integer' } } },
	description: `往资料库新建一条文字笔记(标题 + 正文,可带标签 / 流派);笔记带「AI 助手建」来源标记,之后可被对话检索引用。可撤销。${GUIDE}:用户说「把这段记到资料库 / 存成笔记」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['title', 'text'], properties: {
		title: { type: 'string', minLength: 1, maxLength: 120 },
		text: { type: 'string', minLength: 1, maxLength: MATERIAL_NOTE_TEXT_MAX },
		tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 20 } },
		schools: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 30 }, description: '流派标注(可选)' },
	} },
	preview(args){ return { title: `新建资料笔记:${args.title}`, before: '', after: `${`${args.text || ''}`.slice(0, 200)}${`${args.text || ''}`.length > 200 ? '…' : ''}` }; },
	async run(args, ctx){
		const text = `${args.text || ''}`.trim();
		if(!text){ return { ok: false, code: 'E_ARGS_INVALID', message: '正文不能为空' }; }
		const tags = normalizeTags(args.tags || []);
		const now = new Date().toISOString();
		const rec = { name: `${args.title}`.trim(), fileName: `${args.title}`.trim(), kind: 'note', folderId: null, tags,
			schools: (args.schools || []).map((x)=>`${x || ''}`.trim()).filter(Boolean), extractedText: text,
			createdBy: 'ai-assistant', aiOrigin: aiOriginOf(ctx, 'add_material_note', {}), createdAt: now, updatedAt: now };
		rec.searchText = buildMaterialSearchText(rec);
		let saved;
		try{ saved = await putStoreRecord(AI_ANALYSIS_STORES.materials, rec, 'material'); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: '本地存储写不进,笔记没建成' }; }
		return { ok: true, data: { id: saved.id, name: saved.name, chars: text.length }, summary: `资料笔记 ${saved.name}`, message: `已新建资料笔记「${saved.name}」(可撤销)`,
			undo: { kind: MATERIAL_NOTE_UNDO_KIND, payload: { id: saved.id, updatedAt: saved.updatedAt } } };
	},
};

function memoryUnchanged(){ return { ok: true, data: { status: 'unchanged', id: null, changed: false }, summary: '记忆候选已有同文', message: '同一条记忆已在候选或已确认里,没有重复投' }; }

export const proposeMemoryTool = {
	name: 'propose_memory',
	level: 'additive',
	category: 'records',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: { type: 'object', required: ['status'], properties: { status: { type: 'string' }, id: { type: ['string', 'null'] } } },
	description: `提议一条记忆(用户的偏好、命主的事实等,每条不超过 ${MEMORY_TEXT_MAX} 字):只进记忆候选队列,用户在进阶页「记忆」里确认后才会进入之后的对话;同文同主体不重复。${GUIDE}:用户说「记住 X」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['text'], properties: {
		text: { type: 'string', minLength: 1, maxLength: MEMORY_TEXT_MAX },
		subjectType: { type: 'string', enum: MEMORY_SUBJECT_TYPES, default: 'global', description: 'user 用户本人 / chart 某张命盘 / case 某张事盘 / global 通用' },
		subjectRecordId: { type: 'string', pattern: RECORD_ID_PATTERN, description: 'subjectType 为 chart / case 时必给' },
	} },
	// 无变化预检:同文同主体已在候选或已确认里(与 addCandidates 的去重同一判据)
	async noChange(args){
		const type = args.subjectType || 'global';
		const text = `${args.text || ''}`.replace(/\s+/g, ' ').trim().slice(0, MEMORY_TEXT_MAX);
		const cid = type === 'chart' || type === 'case' ? `${args.subjectRecordId || ''}` : '';
		const dup = (await listMemories()).find((m)=>m.text === text && m.subject.type === type && m.subject.cid === cid);
		return dup ? memoryUnchanged() : null;
	},
	async run(args, ctx){
		const type = args.subjectType || 'global';
		if((type === 'chart' || type === 'case') && !args.subjectRecordId){ return { ok: false, code: 'E_ARGS_INVALID', message: '主体是命盘 / 事盘时要给 subjectRecordId' }; }
		const out = await addCandidates([{ text: args.text, subject: { type, cid: args.subjectRecordId || '' } }], `ai-tool:${(ctx && ctx.origin) || 'in-app'}`);
		if(!out.length){ return memoryUnchanged(); }
		return { ok: true, data: { status: 'candidate', id: out[0].id }, summary: '记忆候选 +1', message: '已投入记忆候选,等用户在进阶页「记忆」里确认' };
	},
};

export const listMemoriesTool = {
	name: 'list_memories',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['mcp'],
	enabled: ()=>isPrivateReadEnabled(),
	disabledHint: ()=>switchHintText('privateRead'),
	outputSchema: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object' } }, confirmed: { type: 'integer' }, candidates: { type: 'integer' } } },
	description: `读星阙的记忆(已确认的与待确认的候选;私人内容,只在用户开了「私人内容可读」时可用)。${GUIDE}:要知道用户让星阙记住了什么时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, properties: {
		status: { type: 'string', enum: ['confirmed', 'candidate'] },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
	} },
	async run(args){
		const all = await listMemories();
		const rows = all.filter((m)=>!args.status || m.status === args.status).slice(0, args.limit || 50)
			.map((m)=>({ id: m.id, text: m.text, status: m.status, enabled: m.enabled, subject: m.subject, source: m.source, updatedAt: m.updatedAt }));
		return { ok: true, data: { items: rows, confirmed: all.filter((m)=>m.status === 'confirmed').length, candidates: all.filter((m)=>m.status === 'candidate').length }, summary: `记忆 ${rows.length} 条` };
	},
};
