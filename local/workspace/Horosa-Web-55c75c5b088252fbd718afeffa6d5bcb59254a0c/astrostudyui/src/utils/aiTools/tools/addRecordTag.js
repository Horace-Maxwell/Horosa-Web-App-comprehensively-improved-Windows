// 给已存命盘/事盘追加一个标签,或 remove:true 摘掉一个标签(只动这一个标签;撤销=恢复写入前的标签列表,写后被手工改过则拒撤)。
import { GUIDE, RECORD_ID_PATTERN } from './_shared';
import { findRecord, readFlag, writeFlag, flagUndo, RECORD_TAG_MAX, withPersistNote } from '../recordFlags';

// 无变化(已有这个标签)的回包:无变化预检(审批前)与执行同一份
function unchanged(args, f){
	const tag = `${args.tag || ''}`.trim();
	if(!f || !tag){ return null; }
	const before = readFlag(f.store, f.rec, 'tags') || [];
	const has = before.indexOf(tag) >= 0;
	if(args.remove ? has : !has){ return null; }
	return { ok: true, data: { cid: args.recordId, tags: before, changed: false }, summary: `${f.title} ${args.remove ? '本来就没有' : '已有'}标签「${tag}」`, message: args.remove ? '该记录本来就没有这个标签' : '该记录已有这个标签,无需重复' };
}

export default {
	name: 'add_record_tag',
	level: 'additive',
	idempotent: true,   // 同参重复调用状态不再变(noChange 判过即回 changed:false)
	category: 'records',
	// 输出结构(外部客户端据此校验 structuredContent)
	outputSchema: {
		type: 'object', required: ['cid', 'changed'],
		properties: { cid: { type: 'string' }, changed: { type: 'boolean' }, persisted: { type: 'boolean' } },
	},
	undoKind: 'restore-record-flag',
	origins: ['in-app', 'mcp'],
	description: `给一条已存命盘/事盘追加一个标签,或 remove:true 摘掉一个标签(档案列表可按标签筛选;只动这一个标签,可撤销)。${GUIDE}:仅当用户说「给 X 打标签/归到某类」或「去掉 X 的某标签」时调用;记录 id 先用 list_records 取。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['recordId', 'tag'], properties: { recordId: { type: 'string', pattern: RECORD_ID_PATTERN, description: '记录 id' }, tag: { type: 'string', minLength: 1, maxLength: 20, description: '标签文字(≤20 字)' }, remove: { type: 'boolean', default: false, description: 'true = 摘掉这个标签(缺省 false = 追加)' } } },
	preview(args){
		const f = findRecord(args.recordId);
		if(!f){ return null; }
		const cur = readFlag(f.store, f.rec, 'tags') || [];
		return { title: `标签:${f.title}`, before: `标签:${cur.length ? cur.join('、') : '无'}`, after: `标签:${(args.remove ? cur.filter((t)=>t !== args.tag) : cur.concat(cur.indexOf(args.tag) >= 0 ? [] : [args.tag])).join('、') || '无'}` };
	},
	noChange(args){ return unchanged(args, findRecord(args.recordId)); },
	async run(args){
		const f = findRecord(args.recordId);
		if(!f){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.recordId}` }; }
		const tag = `${args.tag || ''}`.trim();
		if(!tag){ return { ok: false, code: 'E_ARGS_INVALID', message: '标签不能为空' }; }
		const before = readFlag(f.store, f.rec, 'tags') || [];
		const nc = unchanged(args, f);
		if(nc){ return nc; }
		if(!args.remove && before.length >= RECORD_TAG_MAX){ return { ok: false, code: 'E_ARGS_INVALID', message: `标签已达上限 ${RECORD_TAG_MAX} 个` }; }
		const after = args.remove ? before.filter((t)=>t !== tag) : before.concat([tag]);
		try{ writeFlag(f.store, args.recordId, 'tags', after); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
		return withPersistNote(f.store, { ok: true, data: { cid: args.recordId, tags: after, changed: true }, summary: args.remove ? `摘标签「${tag}」← ${f.title}` : `标签「${tag}」→ ${f.title}`, message: args.remove ? `已摘掉「${f.title}」的标签「${tag}」(可撤销)` : `已给「${f.title}」加标签「${tag}」(可撤销)`, undo: flagUndo(f.store, args.recordId, 'tags', before, after) });
	},
};
