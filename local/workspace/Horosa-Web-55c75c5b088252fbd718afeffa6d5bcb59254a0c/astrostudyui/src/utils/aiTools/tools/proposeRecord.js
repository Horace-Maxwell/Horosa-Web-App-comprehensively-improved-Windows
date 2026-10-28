// 档案提案:AI 不能直接改 / 归档已存档案,只能提议 —— 提案挂到任务中心待办,用户逐条采纳 / 拒绝;
// 采纳走正常更新(留一版历史)、可撤销采纳;档案在提案后被改过 = 冲突、不落库。删除永远不在其列。
// 工具只新建与读提案(不 import 采纳 / 拒绝 / 撤销三个落库函数);时间与地点在提议时就规整成具体字段值,只留真正有变化的字段。
import { GUIDE, RECORD_ID_PATTERN } from './_shared';
import { findRecord } from '../recordFlags';
import { parseBirthInput } from '../normalize/birthText';
import { resolvePlaceOffline } from '../normalize/place';
import { resolveZone } from '../normalize/zone';
import { normalizeGender } from '../normalize/gender';
import { geoPairToRecordFields } from '../normalize/geoCompass';
import { addProposal, listProposals, getProposal, summarizeProposal, PROPOSAL_FIELD_LABELS, PROPOSAL_STATUSES, PROPOSALS_PENDING_MAX, PROPOSAL_PRIVATE_FIELDS } from '../../aiAgent/proposals';
import { isPrivateReadEnabled } from '../../aiAgent/prefs';
import { datePartOf } from '../../dateStrSafe';

export const PROPOSAL_LIST_MAX = 50;

function same(a, b){ return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }
function fmtVal(v){ return v === undefined || v === null || v === '' ? '(空)' : `${v}`; }
// 外部客户端且「私人内容可读」关着:备注这类私人字段的原文不出现在回包与通知里(只说有无改、多少字)
export function shouldRedactPrivate(ctx){ return !!(ctx && ctx.origin === 'mcp') && !isPrivateReadEnabled(); }
function charCount(v){ return v === undefined || v === null ? 0 : `${v}`.length; }
function redactedDiffItem(k, before, after){
	return { field: k, label: PROPOSAL_FIELD_LABELS[k] || k, before: charCount(before) ? `(原有 ${charCount(before)} 字,未显示)` : '(空)', after: `已修改(${charCount(after)} 字)`, redacted: true };
}
async function notifyUser(title, body){
	try{ const { pushNotice } = await import('../../aiAgent/tasks/noticeStore'); await pushNotice({ level: 'action', title, body }); }catch(e){ /* 通知失败不影响提案本身 */ }
}

// 把 AI 给的修改意图规整成档案字段值:{ ok, changes, assumptions } | { ok:false, code, message }
// opts.keepPrivate:私人字段即使与现值相同也留在提案里(私人内容不可读时,「无需修改」本身就会泄露原文是否等于所给内容)
export async function normalizeEditIntent(store, rec, ch, opts){
	const c = ch || {};
	const out = {};
	const assumptions = [];
	const titleKey = store === 'case' ? 'event' : 'name';
	const timeKey = store === 'case' ? 'divTime' : 'birth';
	if(c.title !== undefined){ const t = `${c.title || ''}`.trim(); if(!t){ return { ok: false, code: 'E_ARGS_INVALID', message: '标题 / 姓名不能改成空' }; } out[titleKey] = t; }
	let zoneHint;
	if(c.time !== undefined){
		const b = parseBirthInput(`${c.time}`, { calendar: c.calendar || 'solar' });
		if(!b.ok){ return { ok: false, code: b.code || 'E_ARGS_INVALID', message: `时间无法解析:${c.time}` }; }
		out[timeKey] = b.birth; zoneHint = b.zoneHint; assumptions.push(...(b.assumptions || []));
	}
	let geo = null;
	if(c.place !== undefined){
		const r = await resolvePlaceOffline(`${c.place}`, { dateStr: datePartOf(`${out[timeKey] || rec[timeKey] || ''}`) });
		if(!r.resolved){ return { ok: false, code: 'E_PLACE_NOT_FOUND', message: r.candidates && r.candidates.length ? `地名「${c.place}」有歧义:${r.candidates.map((x)=>`${x.name}/${x.region}`).join('、')}` : `未找到地名「${c.place}」` }; }
		geo = geoPairToRecordFields(r.place.gpsLat, r.place.gpsLon); out.pos = r.place.name;
	}else if(c.gpsLat !== undefined || c.gpsLon !== undefined){
		if(!Number.isFinite(Number(c.gpsLat)) || !Number.isFinite(Number(c.gpsLon))){ return { ok: false, code: 'E_ARGS_INVALID', message: 'gpsLat 与 gpsLon 必须同时给出' }; }
		geo = geoPairToRecordFields(c.gpsLat, c.gpsLon);
	}
	if(geo){ out.lat = geo.lat; out.lon = geo.lon; out.gpsLat = geo.gpsLat; out.gpsLon = geo.gpsLon; }
	if(c.zone !== undefined){ out.zone = `${c.zone}`; }
	else if(geo || out[timeKey]){
		// 时间或地点变了而没给时区:按新地点 / 日期重算一次,与现值不同才进提案
		const z = resolveZone({ userZone: zoneHint, gpsLat: geo ? geo.gpsLat : rec.gpsLat, gpsLon: geo ? geo.gpsLon : rec.gpsLon, dateStr: datePartOf(`${out[timeKey] || rec[timeKey] || ''}`) });
		if(z && z.zone && z.source !== 'fallback'){ out.zone = z.zone; }
	}
	if(c.gender !== undefined){ const g = normalizeGender(c.gender, { forCase: store === 'case' }); if(g !== undefined){ out.gender = g; } }
	if(c.memo !== undefined){ out.memo = `${c.memo || ''}`; }
	// 只留真正有变化的字段
	const keepPrivate = !!(opts && opts.keepPrivate);
	Object.keys(out).forEach((k)=>{ if(keepPrivate && PROPOSAL_PRIVATE_FIELDS.indexOf(k) >= 0){ return; } if(same(out[k], rec[k])){ delete out[k]; } });
	return { ok: true, changes: out, assumptions };
}

// 无变化的回包(data.changed:false = 注册表的「无变化」约定:不挂提案、不进账本、不弹审批):预检与执行同一份
function editUnchanged(f, n){ return { ok: true, data: { proposalId: null, status: 'unchanged', fields: [], changed: false }, summary: `${f.title} 无需修改`, message: '给的内容与档案现值一致,没有产生提案', assumptions: n.assumptions }; }
function archiveUnchanged(f){ return { ok: true, data: { proposalId: null, status: 'unchanged', changed: false }, summary: `${f.title} 已归档`, message: '这张档案已经归档,没有产生提案' }; }

export const proposeRecordEditTool = {
	name: 'propose_record_edit',
	level: 'additive',
	category: 'records',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: {
		type: 'object', required: ['proposalId', 'status', 'fields'],
		properties: { proposalId: { type: ['string', 'null'] }, status: { type: 'string' }, fields: { type: 'array', items: { type: 'string' } }, diff: { type: 'array' } },
	},
	description: `提议修改一张已存命盘 / 事盘(标题或姓名、时间、地点或经纬度、时区、性别、备注):不直接改,而是挂到任务中心等用户逐条采纳;采纳走正常更新(留一版历史),可撤销。档案在提议后被改过则采纳时判冲突、不落库。永远不能删除档案。${GUIDE}:用户说「把 X 的出生时间改成… / 地点写错了」时调用;之后可用 list_proposals 查结果。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['recordId', 'changes'],
		properties: {
			recordId: { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80, description: '记录 id(先用 list_records 取)' },
			changes: {
				type: 'object', additionalProperties: false, minProperties: 1,
				properties: {
					title: { type: 'string', maxLength: 120, description: '命盘 = 姓名;事盘 = 标题' },
					time: { type: 'string', maxLength: 60, description: '命盘 = 出生时间;事盘 = 起课时间' },
					calendar: { type: 'string', enum: ['solar', 'lunar'] },
					place: { type: 'string', maxLength: 80, description: '地名(离线解析出经纬度与时区)' },
					gpsLat: { type: 'number', minimum: -90, maximum: 90 },
					gpsLon: { type: 'number', minimum: -180, maximum: 180 },
					zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$' },
					gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
					memo: { type: 'string', maxLength: 2000 },
				},
			},
			reason: { type: 'string', maxLength: 500, description: '为什么要改(给用户看)' },
		},
	},
	// 无变化预检(审批前):与执行同一份归一(normalizeEditIntent),给的内容与现值一致 = 不挂提案、不弹审批
	async noChange(args, ctx){
		const f = findRecord(args.recordId);
		if(!f){ return null; }
		const n = await normalizeEditIntent(f.store, f.rec, args.changes, { keepPrivate: shouldRedactPrivate(ctx) });
		return n.ok && !Object.keys(n.changes).length ? editUnchanged(f, n) : null;
	},
	preview(args){
		const f = findRecord(args.recordId);
		return f ? { title: `提议修改:${f.title}`, before: '', after: `${JSON.stringify(args.changes || {}).slice(0, 300)}${args.reason ? `\n理由:${args.reason}` : ''}\n(只挂提案,采纳前不改档案)` } : null;
	},
	async run(args, ctx){
		const f = findRecord(args.recordId);
		if(!f){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.recordId}` }; }
		const redact = shouldRedactPrivate(ctx);
		const n = await normalizeEditIntent(f.store, f.rec, args.changes, { keepPrivate: redact });
		if(!n.ok){ return { ok: false, code: n.code, message: n.message }; }
		const keys = Object.keys(n.changes);
		if(!keys.length){ return editUnchanged(f, n); }
		const before = {};
		keys.forEach((k)=>{ before[k] = f.rec[k] === undefined ? null : f.rec[k]; });
		const r = addProposal({ kind: 'record-edit', store: f.store, recordId: args.recordId, title: f.title, changes: n.changes, before, reason: args.reason || '', origin: (ctx && ctx.origin) || 'in-app', client: ctx && ctx.clientName });
		if(!r.ok){ return { ok: false, code: r.code, message: r.message }; }
		const diff = keys.map((k)=>(redact && PROPOSAL_PRIVATE_FIELDS.indexOf(k) >= 0
			? redactedDiffItem(k, before[k], n.changes[k])
			: { field: k, label: PROPOSAL_FIELD_LABELS[k] || k, before: before[k], after: n.changes[k] }));
		// 通知正文与回包同口径:私人字段只写「已修改 / 字数」(全文在任务中心的提案卡里由用户自己看)
		await notifyUser('有一条档案修改提案待你确认', `「${f.title}」:${diff.map((d)=>(d.redacted ? `${d.label} ${d.after}` : `${d.label} ${fmtVal(d.before)} → ${fmtVal(d.after)}`)).join(';').slice(0, 160)}`);
		return {
			ok: true,
			data: { proposalId: r.proposal.id, status: 'pending', fields: keys, diff },
			summary: `提案 · 改 ${f.title} 的 ${diff.map((d)=>d.label).join('、')}`,
			message: `已提交修改提案,等待用户在星阙任务中心采纳(提案 ${r.proposal.id};用 list_proposals 查结果)`,
			assumptions: n.assumptions,
			undo: { kind: 'none' },
		};
	},
};

export const proposeRecordArchiveTool = {
	name: 'propose_record_archive',
	level: 'additive',
	category: 'records',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: {
		type: 'object', required: ['proposalId', 'status'],
		properties: { proposalId: { type: ['string', 'null'] }, status: { type: 'string' } },
	},
	description: `提议归档一张已存命盘 / 事盘(归档 = 从默认列表收起,随时可在档案管理里取消归档;不是删除):挂到任务中心等用户采纳,采纳后可撤销。永远不能删除档案。${GUIDE}:用户说「把 X 收起来 / 归档」时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['recordId'],
		properties: {
			recordId: { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80, description: '记录 id' },
			reason: { type: 'string', maxLength: 500 },
		},
	},
	noChange(args){ const f = findRecord(args.recordId); return f && f.rec.archived === true ? archiveUnchanged(f) : null; },
	preview(args){
		const f = findRecord(args.recordId);
		return f ? { title: `提议归档:${f.title}`, before: '', after: `${args.reason ? `理由:${args.reason}\n` : ''}(只挂提案,采纳前不动档案)` } : null;
	},
	async run(args, ctx){
		const f = findRecord(args.recordId);
		if(!f){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.recordId}` }; }
		if(f.rec.archived === true){ return archiveUnchanged(f); }
		const r = addProposal({ kind: 'record-archive', store: f.store, recordId: args.recordId, title: f.title, before: { archived: false }, reason: args.reason || '', origin: (ctx && ctx.origin) || 'in-app', client: ctx && ctx.clientName });
		if(!r.ok){ return { ok: false, code: r.code, message: r.message }; }
		await notifyUser('有一条档案归档提案待你确认', `「${f.title}」${args.reason ? `:${`${args.reason}`.slice(0, 120)}` : ''}`);
		return { ok: true, data: { proposalId: r.proposal.id, status: 'pending' }, summary: `提案 · 归档 ${f.title}`, message: `已提交归档提案,等待用户在星阙任务中心采纳(提案 ${r.proposal.id})`, undo: { kind: 'none' } };
	},
};

export const listProposalsTool = {
	name: 'list_proposals',
	level: 'read',
	category: 'records',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: {
		type: 'object', required: ['items', 'pending'],
		properties: { items: { type: 'array', items: { type: 'object', required: ['proposalId', 'status'] } }, pending: { type: 'integer' } },
	},
	description: `查档案提案的处理结果(待采纳 / 已采纳 / 已拒绝 / 冲突 / 已撤销采纳),新的在前;可按 proposalId、状态或档案过滤。${GUIDE}:提交提案后要知道用户是否采纳时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			proposalId: { type: 'string', maxLength: 80 },
			status: { type: 'string', enum: PROPOSAL_STATUSES },
			recordId: { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80 },
			limit: { type: 'integer', minimum: 1, maximum: PROPOSAL_LIST_MAX, default: 20 },
		},
	},
	async run(args){
		if(args.proposalId){
			const p = getProposal(args.proposalId);
			if(!p){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `没有这条提案:${`${args.proposalId}`.slice(0, 80)}` }; }
			return { ok: true, data: { items: [summarizeProposal(p)], pending: listProposals({ status: 'pending' }).length }, summary: `提案 ${p.id}:${p.status}` };
		}
		const items = listProposals({ status: args.status, recordId: args.recordId, limit: args.limit || 20 }).map(summarizeProposal);
		const pending = listProposals({ status: 'pending' }).length;
		return { ok: true, data: { items, pending }, summary: `提案 ${items.length} 条(待采纳 ${pending}/${PROPOSALS_PENDING_MAX})` };
	},
};
