// 给已存命盘/事盘加星标(只增:标记为「星标」;撤销=恢复到写入前的值,写后被手工改过则拒撤)。
import { GUIDE, RECORD_ID_PATTERN } from './_shared';
import { findRecord, readFlag, writeFlag, flagUndo, withPersistNote } from '../recordFlags';

// 无变化(已有星标)的回包:无变化预检(审批前)与执行同一份
function unchanged(args, f){
	if(!f || !readFlag(f.store, f.rec, 'starred')){ return null; }
	return { ok: true, data: { cid: args.recordId, starred: true, changed: false }, summary: `${f.title} 已有星标`, message: '该记录已有星标,无需重复' };
}

export default {
	name: 'star_record',
	level: 'additive',
	category: 'records',
	// 输出结构(外部客户端据此校验 structuredContent)
	outputSchema: {
		type: 'object', required: ['cid', 'changed'],
		properties: { cid: { type: 'string' }, changed: { type: 'boolean' }, persisted: { type: 'boolean' } },
	},
	undoKind: 'restore-record-flag',
	origins: ['in-app', 'mcp'],
	description: `给一条已存命盘/事盘加星标(档案列表里可按星标筛选;不改其它字段,可撤销)。${GUIDE}:仅当用户说「把 X 加星/收藏/标星」时调用;记录 id 先用 list_records 取。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['recordId'], properties: { recordId: { type: 'string', pattern: RECORD_ID_PATTERN, description: '记录 id' } } },
	preview(args){
		const f = findRecord(args.recordId);
		if(!f){ return null; }
		const cur = readFlag(f.store, f.rec, 'starred');
		return { title: `星标:${f.title}`, before: `星标:${cur ? '是' : '无'}`, after: '星标:是' };
	},
	noChange(args){ return unchanged(args, findRecord(args.recordId)); },
	async run(args){
		const f = findRecord(args.recordId);
		if(!f){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.recordId}` }; }
		const nc = unchanged(args, f);
		if(nc){ return nc; }
		try{ writeFlag(f.store, args.recordId, 'starred', true); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
		return withPersistNote(f.store, { ok: true, data: { cid: args.recordId, starred: true, changed: true }, summary: `星标 ${f.title}`, message: `已给「${f.title}」加星标(可撤销)`, undo: flagUndo(f.store, args.recordId, 'starred', false, true) });
	},
};
