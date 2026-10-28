// 档案的断事日志与关系边:只增不删 —— 日志只往最前面追加一条(不改不删既有条目),关系只新增一条
// 双向边(两张档案任一方向已有边则拒、不覆盖类型;两侧恰好已是同一对互逆关系才回「无需重复」);都不刷新 updateTime,
// 撤销 = 写后值未被改过才还原(restore-record-flag)。
import { GUIDE, RECORD_ID_PATTERN } from './_shared';
import { findRecord, readFlag, writeFlag, flagUndo, flagUndoMulti, withPersistNote } from '../recordFlags';
import { RELATION_TYPES } from '../../recordRelations';
import { isPrivateReadEnabled } from '../../aiAgent/prefs';

export const JOURNAL_TEXT_MAX = 2000;
export const JOURNAL_ENTRIES_MAX = 500;
const RELATION_INVERSE = { parent: 'child', child: 'parent' };

function nowStamp(){
	const d = new Date();
	const p = (n)=>`${n}`.padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function relationLabel(type){
	const hit = RELATION_TYPES.find((r)=>r.value === type);
	return hit ? hit.label : `${type}`;
}

export const appendRecordJournalTool = {
	name: 'append_record_journal',
	level: 'additive',
	category: 'records',
	undoKind: 'restore-record-flag',
	origins: ['in-app', 'mcp'],
	outputSchema: {
		type: 'object', required: ['cid', 'entry', 'total'],
		properties: { cid: { type: 'string' }, entry: { type: 'object', required: ['at', 'text'], properties: { at: { type: 'string' }, text: { type: 'string' } } }, total: { type: 'integer' }, persisted: { type: 'boolean' } },
	},
	description: `给一张已存命盘 / 事盘的断事日志追加一条(带时间戳,新在前;只追加、不改不删既有条目,可撤销)。适合记下「断了什么 / 应验情况 / 回访反馈」。${GUIDE}:用户说「把这条记进 X 的日志 / 记一下应验了」时调用;记录 id 先用 list_records 取。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['recordId', 'text'],
		properties: {
			recordId: { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80, description: '记录 id' },
			text: { type: 'string', minLength: 1, maxLength: JOURNAL_TEXT_MAX, description: '日志正文(原样存,不加工)' },
		},
	},
	preview(args){
		const f = findRecord(args.recordId);
		if(!f){ return null; }
		const n = (readFlag(f.store, f.rec, 'journal') || []).length;
		return { title: `断事日志:${f.title}`, before: `现有 ${n} 条`, after: `追加一条:${`${args.text || ''}`.trim().slice(0, 200)}` };
	},
	async run(args){
		const f = findRecord(args.recordId);
		if(!f){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.recordId}` }; }
		const text = `${args.text || ''}`.trim();
		if(!text){ return { ok: false, code: 'E_ARGS_INVALID', message: '日志正文不能为空' }; }
		const before = readFlag(f.store, f.rec, 'journal') || [];
		if(before.length >= JOURNAL_ENTRIES_MAX){ return { ok: false, code: 'E_ARGS_INVALID', message: `这张档案的日志已达 ${JOURNAL_ENTRIES_MAX} 条上限` }; }
		const entry = { at: nowStamp(), text, by: 'ai' };
		const after = [entry].concat(before);
		try{ writeFlag(f.store, args.recordId, 'journal', after); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
		return withPersistNote(f.store, {
			ok: true,
			data: { cid: args.recordId, entry: { at: entry.at, text: entry.text }, total: after.length },
			summary: `日志 +1 → ${f.title}`,
			message: `已记入「${f.title}」的断事日志(可撤销)`,
			undo: flagUndo(f.store, args.recordId, 'journal', before, after),
		});
	},
};

// 无变化(两张已是这层关系)的回包:无变化预检(审批前)与执行同一份;外部 + 私人内容关着时不判(回包同一句拒绝,不借「已是」读出私人关系)
function linkUnchanged(args, ctx, a, b){
	if(!a || !b || args.recordId === args.otherRecordId || a.store !== b.store){ return null; }
	const inverse = RELATION_INVERSE[args.relation] || args.relation;
	const edgeA = (readFlag(a.store, a.rec, 'relations') || []).find((e)=>e && e.cid === args.otherRecordId);
	const edgeB = (readFlag(b.store, b.rec, 'relations') || []).find((e)=>e && e.cid === args.recordId);
	const hidePrivate = !!(ctx && ctx.origin === 'mcp') && !isPrivateReadEnabled();
	if(hidePrivate || !(edgeA && edgeB && edgeA.type === args.relation && edgeB.type === inverse)){ return null; }
	return { ok: true, data: { cid: args.recordId, otherCid: args.otherRecordId, relation: args.relation, inverse, changed: false }, summary: `${a.title} 与 ${b.title} 已是这层关系`, message: '这两张档案已经有这层关系,无需重复' };
}

export const linkRecordsTool = {
	name: 'link_records',
	level: 'additive',
	category: 'records',
	undoKind: 'restore-record-flag',
	origins: ['in-app', 'mcp'],
	outputSchema: {
		type: 'object', required: ['cid', 'otherCid', 'relation', 'changed'],
		properties: { cid: { type: 'string' }, otherCid: { type: 'string' }, relation: { type: 'string' }, inverse: { type: 'string' }, changed: { type: 'boolean' }, persisted: { type: 'boolean' } },
	},
	description: `在两张同类档案(都是命盘或都是事盘)之间建一条双向关系(配偶 / 父母 / 子女 / 兄弟姐妹 / 客户 / 朋友 / 其他;父母与子女自动互逆)。只新增:两张之间任一方向已有关系就不建、不改;可撤销。${GUIDE}:用户说「A 是 B 的妻子 / 把这两张关联起来」时调用;记录 id 先用 list_records 取。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['recordId', 'otherRecordId', 'relation'],
		properties: {
			recordId: { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80, description: '本人记录 id' },
			otherRecordId: { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80, description: '对方记录 id' },
			relation: { type: 'string', enum: RELATION_TYPES.map((r)=>r.value), description: '对方相对本人的关系(parent = 对方是本人的父母)' },
		},
	},
	preview(args){
		const a = findRecord(args.recordId);
		const b = findRecord(args.otherRecordId);
		if(!a || !b){ return null; }
		return { title: `关联:${a.title} ↔ ${b.title}`, before: '无关系', after: `${b.title} 是 ${a.title} 的${relationLabel(args.relation)}` };
	},
	noChange(args, ctx){ return linkUnchanged(args, ctx, findRecord(args.recordId), findRecord(args.otherRecordId)); },
	async run(args, ctx){
		const a = findRecord(args.recordId);
		const b = findRecord(args.otherRecordId);
		if(!a){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.recordId}` }; }
		if(!b){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.otherRecordId}` }; }
		if(args.recordId === args.otherRecordId){ return { ok: false, code: 'E_ARGS_INVALID', message: '不能把一张档案和它自己关联' }; }
		if(a.store !== b.store){ return { ok: false, code: 'E_ARGS_INVALID', message: '关系只在同类档案之间建立(两张都是命盘,或两张都是事盘)' }; }
		// 存储里的边 { cid: 对端, type: 对端相对本人的关系 }(与档案管理里的「关联两条记录」同一形状)
		const inverse = RELATION_INVERSE[args.relation] || args.relation;
		const beforeA = readFlag(a.store, a.rec, 'relations') || [];
		const beforeB = readFlag(b.store, b.rec, 'relations') || [];
		// 两侧都查:任一方向已有边(哪怕只有一侧、另一侧缺)都不新建,也绝不改写已有那条的类型。
		// 拒绝文案不带已有关系的类型(关系属私人内容,「私人内容可读」关着时不能借报错读出来)。
		const edgeA = beforeA.find((e)=>e && e.cid === args.otherRecordId);
		const edgeB = beforeB.find((e)=>e && e.cid === args.recordId);
		if(edgeA || edgeB){
			// 外部客户端 + 私人内容关着:「恰好已是这层关系」与「已有别的关系」回同一句、不点明是哪种 ——
			// 否则逐个关系类型试一遍,哪个回「已是这层关系」就把私人关系读出来了(关系属私人内容)
			const nc = linkUnchanged(args, ctx, a, b);
			if(nc){ return nc; }
			return { ok: false, code: 'E_ARGS_INVALID', message: '这两张档案之间已有关系记录,不新建也不改动;改关系请用户在档案管理的「关联两条记录」里操作' };
		}
		const afterA = beforeA.concat([{ cid: args.otherRecordId, type: args.relation }]);
		const afterB = beforeB.concat([{ cid: args.recordId, type: inverse }]);
		try{ writeFlag(a.store, args.recordId, 'relations', afterA); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
		try{ writeFlag(b.store, args.otherRecordId, 'relations', afterB); }catch(e){
			// 第二笔没写进去:第一笔回滚,不留单向边
			try{ writeFlag(a.store, args.recordId, 'relations', beforeA); }catch(_){ /* 回滚失败只能如实报 */ }
			return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` };
		}
		return withPersistNote(a.store, {
			ok: true,
			data: { cid: args.recordId, otherCid: args.otherRecordId, relation: args.relation, inverse, changed: true },
			summary: `关联 ${a.title} ↔ ${b.title}(${relationLabel(args.relation)})`,
			message: `已记下「${b.title}」是「${a.title}」的${relationLabel(args.relation)}(双向,可撤销)`,
			undo: flagUndoMulti([
				{ store: a.store, cid: args.recordId, field: 'relations', before: beforeA, after: afterA },
				{ store: b.store, cid: args.otherRecordId, field: 'relations', before: beforeB, after: afterB },
			]),
		});
	},
};
