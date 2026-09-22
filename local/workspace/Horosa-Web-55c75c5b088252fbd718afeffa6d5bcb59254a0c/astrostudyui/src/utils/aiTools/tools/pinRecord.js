// [批五] 把已存命盘/事盘置顶或置底(只增:改一个排序标记;撤销=恢复写入前的层级,写后被手工改过则拒撤)。
import { GUIDE } from './_shared';
import { findRecord, readFlag, writeFlag, flagUndo } from '../recordFlags';

const POSITIONS = { top: 1, bottom: -1 };

export default {
	name: 'pin_record',
	level: 'additive',
	category: 'records',
	undoKind: 'restore-record-flag',
	origins: ['in-app', 'mcp'],
	description: `把一条已存命盘/事盘置顶(缺省)或置底(档案列表排序标记;不改其它字段,可撤销)。${GUIDE}:仅当用户说「把 X 置顶/放最前/放最后」时调用;记录 id 先用 list_records 取。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['recordId'], properties: { recordId: { type: 'string', pattern: '^local-', description: '记录 id' }, position: { type: 'string', enum: ['top', 'bottom'], description: 'top=置顶(缺省) / bottom=置底' } } },
	preview(args){
		const f = findRecord(args.recordId);
		if(!f){ return null; }
		const cur = readFlag(f.store, f.rec, 'pinTier');
		const txt = (t)=>(t === 1 ? '置顶' : (t === -1 ? '置底' : '未置顶'));
		return { title: `置顶:${f.title}`, before: `排序:${txt(cur)}`, after: `排序:${txt(POSITIONS[args.position || 'top'])}` };
	},
	async run(args){
		const f = findRecord(args.recordId);
		if(!f){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.recordId}` }; }
		const tier = POSITIONS[args.position || 'top'];
		const before = readFlag(f.store, f.rec, 'pinTier');
		if(before === tier){ return { ok: true, data: { cid: args.recordId, pinTier: tier, changed: false }, summary: `${f.title} 已${tier === 1 ? '置顶' : '置底'}`, message: '该记录已在该位置,无需重复', undo: { kind: 'none' } }; }
		try{ writeFlag(f.store, args.recordId, 'pinTier', tier); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
		return { ok: true, data: { cid: args.recordId, pinTier: tier, changed: true }, summary: `${tier === 1 ? '置顶' : '置底'} ${f.title}`, message: `已把「${f.title}」${tier === 1 ? '置顶' : '置底'}(可撤销)`, undo: flagUndo(f.store, args.recordId, 'pinTier', before, tier) };
	},
};
