// 把已存命盘/事盘置顶或置底(只增:改一个排序标记;撤销=恢复写入前的层级,写后被手工改过则拒撤)。
import { GUIDE, RECORD_ID_PATTERN } from './_shared';
import { findRecord, readFlag, writeFlag, flagUndo, withPersistNote } from '../recordFlags';

const POSITIONS = { top: 1, bottom: -1 };

// 无变化(已在该位置)的回包:无变化预检(审批前)与执行同一份
function unchanged(args, f){
	if(!f){ return null; }
	const tier = POSITIONS[args.position || 'top'];
	if(readFlag(f.store, f.rec, 'pinTier') !== tier){ return null; }
	return { ok: true, data: { cid: args.recordId, pinTier: tier, changed: false }, summary: `${f.title} 已${tier === 1 ? '置顶' : '置底'}`, message: '该记录已在该位置,无需重复' };
}

export default {
	name: 'pin_record',
	level: 'additive',
	category: 'records',
	// 输出结构(外部客户端据此校验 structuredContent)
	outputSchema: {
		type: 'object', required: ['cid', 'changed'],
		properties: { cid: { type: 'string' }, changed: { type: 'boolean' }, persisted: { type: 'boolean' } },
	},
	undoKind: 'restore-record-flag',
	origins: ['in-app', 'mcp'],
	description: `把一条已存命盘/事盘置顶(缺省)或置底(档案列表排序标记;不改其它字段,可撤销)。${GUIDE}:仅当用户说「把 X 置顶/放最前/放最后」时调用;记录 id 先用 list_records 取。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['recordId'], properties: { recordId: { type: 'string', pattern: RECORD_ID_PATTERN, description: '记录 id' }, position: { type: 'string', enum: ['top', 'bottom'], description: 'top=置顶(缺省) / bottom=置底' } } },
	preview(args){
		const f = findRecord(args.recordId);
		if(!f){ return null; }
		const cur = readFlag(f.store, f.rec, 'pinTier');
		const txt = (t)=>(t === 1 ? '置顶' : (t === -1 ? '置底' : '未置顶'));
		return { title: `置顶:${f.title}`, before: `排序:${txt(cur)}`, after: `排序:${txt(POSITIONS[args.position || 'top'])}` };
	},
	noChange(args){ return unchanged(args, findRecord(args.recordId)); },
	async run(args){
		const f = findRecord(args.recordId);
		if(!f){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.recordId}` }; }
		const tier = POSITIONS[args.position || 'top'];
		const before = readFlag(f.store, f.rec, 'pinTier');
		const nc = unchanged(args, f);
		if(nc){ return nc; }
		try{ writeFlag(f.store, args.recordId, 'pinTier', tier); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
		return withPersistNote(f.store, { ok: true, data: { cid: args.recordId, pinTier: tier, changed: true }, summary: `${tier === 1 ? '置顶' : '置底'} ${f.title}`, message: `已把「${f.title}」${tier === 1 ? '置顶' : '置底'}(可撤销)`, undo: flagUndo(f.store, args.recordId, 'pinTier', before, tier) });
	},
};
