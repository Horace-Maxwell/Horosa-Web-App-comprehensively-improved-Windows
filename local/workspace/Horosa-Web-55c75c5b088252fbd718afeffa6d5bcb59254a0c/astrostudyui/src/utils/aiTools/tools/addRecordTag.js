// [批五] 给已存命盘/事盘追加一个标签(只增:只往标签列表里加,不删不改既有标签;撤销=只摘掉这一次加的标签,写后被手工改过则拒撤)。
import { GUIDE } from './_shared';
import { findRecord, readFlag, writeFlag, flagUndo, RECORD_TAG_MAX } from '../recordFlags';

export default {
	name: 'add_record_tag',
	level: 'additive',
	category: 'records',
	undoKind: 'restore-record-flag',
	origins: ['in-app', 'mcp'],
	description: `给一条已存命盘/事盘追加一个标签(档案列表可按标签筛选;只追加、不动既有标签,可撤销)。${GUIDE}:仅当用户说「给 X 打标签/归到某类」时调用;记录 id 先用 list_records 取。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['recordId', 'tag'], properties: { recordId: { type: 'string', pattern: '^local-', description: '记录 id' }, tag: { type: 'string', minLength: 1, maxLength: 20, description: '标签文字(≤20 字)' } } },
	preview(args){
		const f = findRecord(args.recordId);
		if(!f){ return null; }
		const cur = readFlag(f.store, f.rec, 'tags') || [];
		return { title: `标签:${f.title}`, before: `标签:${cur.length ? cur.join('、') : '无'}`, after: `标签:${cur.concat(cur.indexOf(args.tag) >= 0 ? [] : [args.tag]).join('、')}` };
	},
	async run(args){
		const f = findRecord(args.recordId);
		if(!f){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.recordId}` }; }
		const tag = `${args.tag || ''}`.trim();
		if(!tag){ return { ok: false, code: 'E_ARGS_INVALID', message: '标签不能为空' }; }
		const before = readFlag(f.store, f.rec, 'tags') || [];
		if(before.indexOf(tag) >= 0){ return { ok: true, data: { cid: args.recordId, tags: before, changed: false }, summary: `${f.title} 已有标签「${tag}」`, message: '该记录已有这个标签,无需重复', undo: { kind: 'none' } }; }
		if(before.length >= RECORD_TAG_MAX){ return { ok: false, code: 'E_ARGS_INVALID', message: `标签已达上限 ${RECORD_TAG_MAX} 个` }; }
		const after = before.concat([tag]);
		try{ writeFlag(f.store, args.recordId, 'tags', after); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
		return { ok: true, data: { cid: args.recordId, tags: after, changed: true }, summary: `标签「${tag}」→ ${f.title}`, message: `已给「${f.title}」加标签「${tag}」(可撤销)`, undo: flagUndo(f.store, args.recordId, 'tags', before, after) };
	},
};
