// 给已存命盘/事盘加星标或取消星标(cancel:true);撤销=恢复到写入前的值,写后被手工改过则拒撤。
import { GUIDE, RECORD_ID_PATTERN } from './_shared';
import { findRecord, readFlag, writeFlag, flagUndo, withPersistNote } from '../recordFlags';

// 无变化(已有星标)的回包:无变化预检(审批前)与执行同一份
const want = (args)=>args.cancel !== true;
function unchanged(args, f){
	if(!f || readFlag(f.store, f.rec, 'starred') !== want(args)){ return null; }
	return { ok: true, data: { cid: args.recordId, starred: want(args), changed: false }, summary: `${f.title} ${want(args) ? '已有星标' : '本来就没有星标'}`, message: want(args) ? '该记录已有星标,无需重复' : '该记录本来就没有星标' };
}

export default {
	name: 'star_record',
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
	description: `给一条已存命盘/事盘加星标,或 cancel:true 取消星标(档案列表里可按星标筛选;不改其它字段,可撤销)。${GUIDE}:仅当用户说「把 X 加星/收藏/标星」或「去掉星标 / 取消收藏」时调用;记录 id 先用 list_records 取。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['recordId'], properties: { recordId: { type: 'string', pattern: RECORD_ID_PATTERN, description: '记录 id' }, cancel: { type: 'boolean', default: false, description: 'true = 取消星标(缺省 false = 加星标)' } } },
	preview(args){
		const f = findRecord(args.recordId);
		if(!f){ return null; }
		const cur = readFlag(f.store, f.rec, 'starred');
		return { title: `星标:${f.title}`, before: `星标:${cur ? '是' : '无'}`, after: `星标:${want(args) ? '是' : '无'}` };
	},
	noChange(args){ return unchanged(args, findRecord(args.recordId)); },
	async run(args){
		const f = findRecord(args.recordId);
		if(!f){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.recordId}` }; }
		const nc = unchanged(args, f);
		if(nc){ return nc; }
		const before = readFlag(f.store, f.rec, 'starred');
		try{ writeFlag(f.store, args.recordId, 'starred', want(args)); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
		return withPersistNote(f.store, { ok: true, data: { cid: args.recordId, starred: want(args), changed: true }, summary: `${want(args) ? '星标' : '取消星标'} ${f.title}`, message: want(args) ? `已给「${f.title}」加星标(可撤销)` : `已取消「${f.title}」的星标(可撤销)`, undo: flagUndo(f.store, args.recordId, 'starred', before, want(args)) });
	},
};
