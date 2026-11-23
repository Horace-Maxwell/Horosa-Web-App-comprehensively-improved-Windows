// AI 助手·档案副本 / 历史版本 / 查重:与档案列表「另存副本」、编辑页「历史版本 → 恢复为副本」、「查重与合并」同一套单源函数
// (toRecordCopy 剥离表 / recordRevisions / findDuplicateGroups)。副本是纯新增(撤销 = 移入回收站);合并会间接删档,不在这里做。
import { GUIDE, RECORD_ID_PATTERN, aiOriginOf } from './_shared';
import { getLocalChart, upsertLocalChart, listLocalCharts } from '../../localcharts';
import { getLocalCase, upsertLocalCase, listLocalCases } from '../../localcases';
import { toRecordCopy } from '../../localRecordStore';
import { listRecordRevisions } from '../../recordRevisions';
import { findDuplicateGroups } from '../../recordRelations';

const RECORD_ID = { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80 };
function locate(cid){
	const chart = getLocalChart(cid);
	if(chart){ return { store: 'chart', rec: chart, titleKey: 'name' }; }
	const kase = getLocalCase(cid);
	if(kase){ return { store: 'case', rec: kase, titleKey: 'event' }; }
	return null;
}
// 版本摘要:标题 / 时间 / 与当前相比改了哪些字段(只列键名,不倒整条内容)
const SKIP_DIFF = ['updateTime', 'preserveUpdateTime', 'schemaVersion', 'lastOpenedAt', 'openCount'];
function changedKeys(a, b){
	const keys = new Set(Object.keys(a || {}).concat(Object.keys(b || {})));
	return [...keys].filter((k)=>SKIP_DIFF.indexOf(k) < 0 && JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k])).slice(0, 30);
}

export const listRecordRevisionsTool = {
	name: 'list_record_revisions',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	description: `列一张命盘 / 事盘的历史版本(每次修改自动留存最近 10 版,新在前):每版的时间、当时的标题与时间字段、与当前相比改了哪些字段。要恢复某一版就用 copy_record 带 revisionAt(恢复为副本,不覆盖原档)。${GUIDE}:用户问「之前改过什么 / 能不能找回原来那版」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['recordId'], properties: { recordId: { ...RECORD_ID, description: '命盘 / 事盘 id' } } },
	outputSchema: { type: 'object', required: ['revisions'], properties: { revisions: { type: 'array', items: { type: 'object', required: ['at'] } }, store: { type: 'string' } } },
	async run(args){
		const hit = locate(`${args.recordId}`);
		if(!hit){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `没有这张档案:${`${args.recordId}`.slice(0, 80)}` }; }
		const list = (await listRecordRevisions(hit.store, hit.rec.cid)) || [];
		const tf = hit.store === 'chart' ? 'birth' : 'divTime';
		const revisions = list.slice(0, 10).map((r)=>({ at: Number(r.at) || 0, atText: new Date(Number(r.at) || 0).toISOString(), title: `${(r.record && r.record[hit.titleKey]) || ''}`,
			time: `${(r.record && r.record[tf]) || ''}`, changedFromCurrent: changedKeys(r.record, hit.rec) }));
		return { ok: true, data: { store: hit.store, revisions }, summary: `历史版本 ${revisions.length} 版` };
	},
};

export const copyRecordTool = {
	name: 'copy_record',
	level: 'additive',
	category: 'records',
	undoKind: 'trash-record',
	origins: ['in-app', 'mcp'],
	description: `把一张命盘 / 事盘另存为副本(新 id,名字加「(副本)」;不带走置顶 / 星标 / 关系等列表状态);给 revisionAt(list_record_revisions 里某版的 at)= 把那一版恢复为副本(名字加「(历史版)」)。原档不动。${GUIDE}:用户明确要「复制一份 / 找回旧版」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['recordId'], properties: {
		recordId: { ...RECORD_ID, description: '命盘 / 事盘 id' },
		revisionAt: { type: 'integer', minimum: 0, description: '历史版本的 at(list_record_revisions 查);缺省 = 复制当前这一版' },
	} },
	outputSchema: { type: 'object', required: ['cid', 'store'], properties: { cid: { type: 'string' }, store: { type: 'string' }, title: { type: 'string' }, fromRevision: { type: 'boolean' } } },
	async run(args, ctx){
		const hit = locate(`${args.recordId}`);
		if(!hit){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `没有这张档案:${`${args.recordId}`.slice(0, 80)}` }; }
		let src = hit.rec; let suffix = '(副本)';
		if(args.revisionAt !== undefined){
			const list = (await listRecordRevisions(hit.store, hit.rec.cid)) || [];
			const rev = list.find((r)=>Number(r.at) === Number(args.revisionAt));
			if(!rev || !rev.record){ return { ok: false, code: 'E_ARGS_INVALID', message: '没有这一版(revisionAt 用 list_record_revisions 里的 at)' }; }
			src = rev.record; suffix = '(历史版)';
		}
		const dup = { ...toRecordCopy(src, { titleKey: hit.titleKey, suffix }), aiOrigin: aiOriginOf(ctx, 'copy_record') };
		let saved;
		try{ saved = hit.store === 'chart' ? upsertLocalChart(dup) : upsertLocalCase(dup); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: '本地存储空间不足,副本没存上' }; }
		if(!saved || !saved.cid){ return { ok: false, code: 'E_STORE_QUOTA', message: '副本没存上' }; }
		const title = `${saved[hit.titleKey] || ''}`;
		return { ok: true, data: { cid: saved.cid, store: hit.store, title, fromRevision: args.revisionAt !== undefined },
			undo: { kind: 'trash-record', payload: { store: hit.store, cid: saved.cid } }, summary: `已另存${args.revisionAt !== undefined ? '历史版' : '副本'}「${title}」` };
	},
};

export const findDuplicateRecordsTool = {
	name: 'find_duplicate_records',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	description: `查疑似重复的档案(与档案列表「查重与合并」同一判据):精确 = 同名 + 同生辰 / 起课时间(分钟级),近似 = 同名 + 相差 24 小时内。只列分组,不合并 —— 合并会把多余的移入回收站,要用户在档案列表里自己做。${GUIDE}:用户问「有没有重复的盘」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', enum: ['chart', 'case', 'all'], default: 'all' } } },
	outputSchema: { type: 'object', required: ['groups'], properties: { groups: { type: 'array', items: { type: 'object', required: ['store', 'records'] } }, total: { type: 'integer' } } },
	async run(args){
		const kind = args.kind || 'all';
		const out = [];
		// findDuplicateGroups 回分组数组(每组 ≥2 条记录)
		const pack = (store, groups, titleKey, tf)=>(groups || []).forEach((g)=>{
			if(!Array.isArray(g)){ return; }
			out.push({ store, records: g.map((r)=>({ cid: r.cid, title: `${r[titleKey] || ''}`, time: `${r[tf] || ''}` })) });
		});
		if(kind !== 'case'){ pack('chart', findDuplicateGroups(listLocalCharts() || [], 'birth'), 'name', 'birth'); }
		if(kind !== 'chart'){ pack('case', findDuplicateGroups(listLocalCases() || [], 'divTime'), 'event', 'divTime'); }
		return { ok: true, data: { groups: out.slice(0, 50), total: out.length }, summary: out.length ? `疑似重复 ${out.length} 组` : '没有疑似重复的档案' };
	},
};
