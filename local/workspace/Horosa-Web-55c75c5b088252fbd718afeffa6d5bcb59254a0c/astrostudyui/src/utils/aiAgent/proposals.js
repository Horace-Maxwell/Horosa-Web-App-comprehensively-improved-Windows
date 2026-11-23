// AI 助手·档案提案:AI 不能直接改或归档已存档案,只能「提议」—— 提案挂在任务中心待办,由用户逐条确认:
// 采纳才落库(走正常更新:刷新更新时间、存储层留一版历史),可撤销采纳(写后未被改过才还原);拒绝不动档案;
// 采纳时发现档案自提案后已被改过 = 冲突、不落库(请 AI 按新内容重新提议)。删除永远不在提案范围内。
// 类型:改字段 / 归档与取消归档 / 解除两张档案的关联(两边的关系边一起摘)/ 从回收站恢复(撤销采纳 = 重新移入回收站,回到提案前的样子)。
// 提案存本机(不随备份):待决最多 PROPOSALS_PENDING_MAX 条;总数封顶 PROPOSALS_MAX,超出只删最旧的已决条目,待决条目永不挤掉。
// 工具层(aiTools/*)只许新建与读提案;采纳 / 拒绝 / 撤销采纳只由界面调用(合同:工具目录零 import 这三个函数)。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../safeStorage';
import { getLocalChart, upsertLocalChart, flagLocalChart, listLocalChartsTrash, restoreLocalChartFromTrash, removeLocalChart } from '../localcharts';
import { getLocalCase, upsertLocalCase, flagLocalCase, listLocalCasesTrash, restoreLocalCaseFromTrash, removeLocalCase } from '../localcases';
import { writeFlag } from '../aiTools/recordFlags';
import { AI_ANALYSIS_STORES, putStoreRecord, getStoreRecord, deleteStoreRecord, deleteWhere, ensureTemplateVersion } from '../aiAnalysisStore';
import { readPersona, writePersona } from '../aiChat/persona';
import { emitRecordsChanged } from '../recordStoreNotice';

export const PROPOSALS_KEY = 'horosa.ai.agent.proposals.v1';
export const PROPOSALS_MAX = 200;
export const PROPOSALS_PENDING_MAX = 50;
export const PROPOSAL_EVENT = 'horosa:agent-proposals-changed';
export const PROPOSAL_KINDS = ['record-edit', 'record-archive', 'record-unlink', 'record-restore', 'template-new', 'skill-new', 'persona-text'];
// 内容类提案:模版 / 技能包 / 个人口径是系统指令的一部分,外部写入一律过人;不挂在某张档案上(store:'ai')。
// 采纳 / 撤销采纳要写 IndexedDB,返回承诺(档案类照旧同步)
export const PROPOSAL_CONTENT_KINDS = ['template-new', 'skill-new', 'persona-text'];
const isContent = (k)=>PROPOSAL_CONTENT_KINDS.indexOf(k) >= 0;
export const PROPOSAL_STATUSES = ['pending', 'accepted', 'rejected', 'conflict', 'reverted'];
// 可提议修改的字段(命盘 / 事盘各一张白名单;身份、生命周期、内核与盘面载荷字段一律不在)
export const PROPOSAL_EDIT_FIELDS = Object.freeze({
	chart: ['name', 'birth', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon', 'pos', 'gender', 'memo', 'rodden', 'relation', 'sourceNote'],
	case: ['event', 'divTime', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon', 'pos', 'gender', 'memo'],
});
// 私人字段:外部客户端在「私人内容可读」关着时,提案回包与通知里只给「已修改 / 字数」,不回显原文
export const PROPOSAL_PRIVATE_FIELDS = Object.freeze(['memo']);
// 不是档案字段、只在提案里表示状态的伪字段(在不在回收站)
export const PROPOSAL_STATE_LABELS = Object.freeze({ inTrash: '在回收站' });
const labelOf = (k)=>PROPOSAL_FIELD_LABELS[k] || PROPOSAL_STATE_LABELS[k] || k;
export const PROPOSAL_FIELD_LABELS = Object.freeze({
	name: '姓名', event: '标题', birth: '出生时间', divTime: '起课时间', zone: '时区', lat: '纬度', lon: '经度',
	gpsLat: '纬度(十进制)', gpsLon: '经度(十进制)', pos: '地点', gender: '性别', memo: '备注', archived: '归档', relations: '关联',
	rodden: '生辰可信度', relation: '关系', sourceNote: '资料出处',
});

function emit(){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
			window.dispatchEvent(new CustomEvent(PROPOSAL_EVENT, { detail: { pending: pendingProposalCount() } }));
		}
	}catch(e){ /* 旧环境无 CustomEvent:读端仍可 listProposals */ }
}
function readAll(){
	const raw = safeJsonParseFromStorage(PROPOSALS_KEY);
	return Array.isArray(raw) ? raw.filter((p)=>p && p.id && PROPOSAL_KINDS.indexOf(p.kind) >= 0) : [];
}
// 落盘前封顶:待决全留;已决按决定 / 创建时间新在前留到总数上限
function writeAll(list){
	const pending = list.filter((p)=>p.status === 'pending');
	const decided = list.filter((p)=>p.status !== 'pending').sort((a, b)=>`${b.decidedAt || b.createdAt || ''}`.localeCompare(`${a.decidedAt || a.createdAt || ''}`));
	const keep = pending.concat(decided.slice(0, Math.max(0, PROPOSALS_MAX - pending.length)));
	keep.sort((a, b)=>`${b.createdAt || ''}`.localeCompare(`${a.createdAt || ''}`));
	safeJsonStringifyToStorage(PROPOSALS_KEY, keep);
	emit();
	return keep;
}
function recordOf(store, cid){ return store === 'case' ? getLocalCase(cid) : getLocalChart(cid); }
function norm(v){ return v === undefined ? null : v; }
function same(a, b){ return JSON.stringify(norm(a)) === JSON.stringify(norm(b)); }
function nowIso(){ return new Date().toISOString(); }

export function listProposals(opts){
	const o = opts || {};
	let rows = readAll();
	if(o.status){ rows = rows.filter((p)=>p.status === o.status); }
	if(o.recordId){ rows = rows.filter((p)=>p.recordId === `${o.recordId}`); }
	rows.sort((a, b)=>`${b.createdAt || ''}`.localeCompare(`${a.createdAt || ''}`));
	const limit = Number(o.limit) > 0 ? Number(o.limit) : 0;
	return limit ? rows.slice(0, limit) : rows;
}
export function getProposal(id){ return readAll().find((p)=>p.id === `${id || ''}`) || null; }
export function pendingProposalCount(){ return readAll().filter((p)=>p.status === 'pending').length; }
export function subscribeProposals(fn){
	if(typeof window === 'undefined' || typeof window.addEventListener !== 'function' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>{ try{ fn(); }catch(e){ /* noop */ } };
	const onStorage = (e)=>{ if(e && e.key === PROPOSALS_KEY){ h(); } };   // 跨窗口
	window.addEventListener(PROPOSAL_EVENT, h);
	window.addEventListener('storage', onStorage);
	return ()=>{ window.removeEventListener(PROPOSAL_EVENT, h); window.removeEventListener('storage', onStorage); };
}

// 新建提案(工具层用)。p = { kind, store, recordId, title, changes, before, reason, origin, client }
// 回 { ok, proposal } | { ok:false, code, message }
export function addProposal(p){
	const x = p && typeof p === 'object' ? p : {};
	if(PROPOSAL_KINDS.indexOf(x.kind) < 0 || (!isContent(x.kind) && ((x.store !== 'chart' && x.store !== 'case') || !x.recordId))){ return { ok: false, code: 'E_ARGS_INVALID', message: '提案缺类型 / 档案' }; }
	const all = readAll();
	if(all.filter((r)=>r.status === 'pending').length >= PROPOSALS_PENDING_MAX){ return { ok: false, code: 'E_PROPOSAL_LIMIT', message: `待确认的提案已达 ${PROPOSALS_PENDING_MAX} 条,请用户先处理一些` }; }
	const allowed = PROPOSAL_EDIT_FIELDS[x.store];
	const changes = {};
	const before = {};
	if(x.kind === 'record-edit'){
		Object.keys(x.changes || {}).forEach((k)=>{ if(allowed.indexOf(k) >= 0){ changes[k] = x.changes[k]; before[k] = norm((x.before || {})[k]); } });
		if(!Object.keys(changes).length){ return { ok: false, code: 'E_ARGS_INVALID', message: '没有可提议修改的字段' }; }
	}else if(x.kind === 'record-archive'){
		// archived:false = 取消归档提案
		changes.archived = x.archived !== false; before.archived = !!(x.before && x.before.archived);
	}else if(x.kind === 'record-unlink'){
		const o = x.other || {};
		if((o.store !== 'chart' && o.store !== 'case') || !o.recordId){ return { ok: false, code: 'E_ARGS_INVALID', message: '解除关联要给另一张档案' }; }
		before.relations = norm((x.before || {}).relations) || [];
		changes.relations = before.relations.filter((e)=>!(e && e.cid === `${o.recordId}`));
		x.otherEdge = { store: o.store, recordId: `${o.recordId}`, before: o.before || [], after: (o.before || []).filter((e)=>!(e && e.cid === `${x.recordId}`)) };
	}else if(x.kind === 'record-restore'){
		before.inTrash = true; changes.inTrash = false;
	}else{
		// 内容类:changes 原样带(工具层已规整),个人口径另记提议时的原文
		Object.assign(changes, x.changes || {});
		if(x.kind === 'persona-text'){ before.text = `${(x.before && x.before.text) || ''}`; }
	}
	const rec = {
		id: `prop-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
		kind: x.kind, store: isContent(x.kind) ? 'ai' : x.store, recordId: `${x.recordId || ''}`, title: `${x.title || ''}`.slice(0, 120),
		changes, before, reason: `${x.reason || ''}`.slice(0, 500),
		origin: `${x.origin || 'in-app'}`, client: x.client ? `${x.client}`.slice(0, 60) : '',
		status: 'pending', createdAt: nowIso(),
		...(x.otherEdge ? { other: x.otherEdge } : {}),
	};
	writeAll([rec].concat(all));
	return { ok: true, proposal: rec };
}

function patch(id, fields){
	const all = readAll();
	const i = all.findIndex((p)=>p.id === id);
	if(i < 0){ return null; }
	all[i] = { ...all[i], ...fields };
	writeAll(all);
	return all[i];
}

function trashOf(store, cid){ return (store === 'case' ? listLocalCasesTrash() : listLocalChartsTrash()).find((r)=>r && r.cid === cid) || null; }
// 提案前后各字段的「现值」:归档按真假、关联按整组边、回收站按在不在
function currentOf(p, rec, k){
	if(k === 'archived'){ return !!(rec && rec.archived); }
	if(k === 'inTrash'){ return !rec && !!trashOf(p.store, p.recordId); }
	if(k === 'relations'){ return norm(rec && rec.relations) || []; }
	return rec ? rec[k] : undefined;
}
function sameField(k, a, b){ return k === 'archived' || k === 'inTrash' ? !!a === !!b : same(a, b); }
function otherRelations(p){ const r = recordOf(p.other.store, p.other.recordId); return r ? (norm(r.relations) || []) : null; }

// 把档案写成 target(采纳 = changes,撤销采纳 = before);关联提案另写对方那张的关系边
function applyProposal(p, target, otherTarget){
	if(p.kind === 'record-archive'){
		if(p.store === 'case'){ flagLocalCase(p.recordId, 'archived', !!target.archived); }else{ flagLocalChart(p.recordId, 'archived', !!target.archived); }
	}else if(p.kind === 'record-unlink'){
		writeFlag(p.store, p.recordId, 'relations', target.relations || []);
		if(p.other && otherTarget){ writeFlag(p.other.store, p.other.recordId, 'relations', otherTarget); }
	}else if(p.kind === 'record-restore'){
		if(target.inTrash){ if(p.store === 'case'){ removeLocalCase(p.recordId); }else{ removeLocalChart(p.recordId); } }
		else if(p.store === 'case'){ restoreLocalCaseFromTrash(p.recordId); }else{ restoreLocalChartFromTrash(p.recordId); }
	}else{
		const upsert = p.store === 'case' ? upsertLocalCase : upsertLocalChart;
		upsert({ cid: p.recordId, ...target });
	}
}

// 内容类采纳:新模版(连带首个版本)/ 新技能包(组合记录 + skill)/ 个人口径整段替换(提议后口径又被改过 = 冲突)
async function acceptContentProposal(p){
	const now = new Date().toISOString();
	try{
		if(p.kind === 'persona-text'){
			if(`${readPersona().text || ''}` !== `${(p.before || {}).text || ''}`){
				patch(p.id, { status: 'conflict', decidedAt: nowIso(), conflictFields: ['text'] });
				return { ok: false, code: 'E_PROPOSAL_CONFLICT', message: '个人口径在提议后已被改过,未采纳' };
			}
			writePersona({ text: p.changes.text });
			return { ok: true, proposal: patch(p.id, { status: 'accepted', decidedAt: nowIso() }) };
		}
		if(p.kind === 'template-new'){
			const text = `${p.changes.instructionText || ''}`;
			const saved = await putStoreRecord(AI_ANALYSIS_STORES.templates, { name: p.changes.name, format: 'text', instructionText: text, content: text, jsonSchema: '', exampleInput: '', exampleOutput: '', createdBy: 'ai-proposal', createdAt: now, updatedAt: now }, 'template');
			const { template } = await ensureTemplateVersion(saved);
			return { ok: true, proposal: patch(p.id, { status: 'accepted', decidedAt: nowIso(), createdId: template.id, createdUpdatedAt: template.updatedAt }) };
		}
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.bundles, { name: p.changes.name, skill: p.changes.skill, defaultTechniqueKeys: (p.changes.skill && p.changes.skill.techniqueKeys) || [], createdBy: 'ai-proposal', createdAt: now, updatedAt: now }, 'bundle');
		return { ok: true, proposal: patch(p.id, { status: 'accepted', decidedAt: nowIso(), createdId: saved.id, createdUpdatedAt: saved.updatedAt }) };
	}catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
}
// 内容类撤销采纳:新建的那条还是采纳时的样子才删(连版本);口径还是提议的那段才换回原文
async function revertContentProposal(p){
	try{
		if(p.kind === 'persona-text'){
			if(`${readPersona().text || ''}` !== `${p.changes.text || ''}`){ return { ok: false, code: 'E_UNDO_RECORD_CHANGED', message: '采纳后个人口径又被改过,不自动撤销' }; }
			writePersona({ text: (p.before || {}).text || '' });
			return { ok: true, proposal: patch(p.id, { status: 'reverted', revertedAt: nowIso() }) };
		}
		const store = p.kind === 'template-new' ? AI_ANALYSIS_STORES.templates : AI_ANALYSIS_STORES.bundles;
		const cur = p.createdId ? await getStoreRecord(store, p.createdId) : null;
		if(!cur){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: '采纳时新建的那条已不在' }; }
		if(p.createdUpdatedAt && `${cur.updatedAt || ''}` !== `${p.createdUpdatedAt}`){ return { ok: false, code: 'E_UNDO_RECORD_CHANGED', message: '采纳后这条又被改过,不自动撤销' }; }
		await deleteStoreRecord(store, p.createdId);
		if(p.kind === 'template-new'){ await deleteWhere(AI_ANALYSIS_STORES.templateVersions, (it)=>it.templateId === p.createdId); }
		return { ok: true, proposal: patch(p.id, { status: 'reverted', revertedAt: nowIso() }) };
	}catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
}

// ── 以下三个只由界面调用(任务中心「采纳 / 拒绝 / 撤销采纳」)

// 采纳:档案自提案后被改过(任一 before 字段与现值不同)→ 冲突、不落库;否则走正常更新(留一版历史)
export function acceptProposal(id){
	const p = getProposal(id);
	if(!p || p.status !== 'pending'){ return { ok: false, code: 'E_PROPOSAL_NOT_PENDING', message: '该提案已处理过或不存在' }; }
	if(isContent(p.kind)){ return acceptContentProposal(p); }
	const rec = recordOf(p.store, p.recordId);
	const gone = p.kind === 'record-restore' ? (!rec && !trashOf(p.store, p.recordId)) : !rec;
	if(gone){ patch(p.id, { status: 'conflict', decidedAt: nowIso(), conflictFields: [] }); return { ok: false, code: 'E_RECORD_NOT_FOUND', message: '档案已不存在' }; }
	const conflictFields = Object.keys(p.before).filter((k)=>!sameField(k, currentOf(p, rec, k), p.before[k]));
	if(p.kind === 'record-unlink' && !same(otherRelations(p), p.other.before)){ conflictFields.push('relations'); }
	if(conflictFields.length){
		patch(p.id, { status: 'conflict', decidedAt: nowIso(), conflictFields });
		return { ok: false, code: 'E_PROPOSAL_CONFLICT', message: `档案在提案后已被改过(${conflictFields.map(labelOf).join('、')}),未采纳`, fields: conflictFields };
	}
	try{
		applyProposal(p, p.changes, p.other ? p.other.after : null);
	}catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
	const updated = patch(p.id, { status: 'accepted', decidedAt: nowIso() });
	emitRecordsChanged({ store: p.store, cid: p.recordId, fields: Object.keys(p.changes || {}) });
	return { ok: true, proposal: updated };
}

export function rejectProposal(id, note){
	const p = getProposal(id);
	if(!p || p.status !== 'pending'){ return { ok: false, code: 'E_PROPOSAL_NOT_PENDING', message: '该提案已处理过或不存在' }; }
	return { ok: true, proposal: patch(p.id, { status: 'rejected', decidedAt: nowIso(), note: `${note || ''}`.slice(0, 200) }) };
}

// 撤销采纳:档案现值须仍等于提案写入的值(采纳后用户又改过 → 不覆盖用户的改动)
export function revertProposal(id){
	const p = getProposal(id);
	if(!p || p.status !== 'accepted'){ return { ok: false, code: 'E_PROPOSAL_NOT_PENDING', message: '只有已采纳的提案可以撤销' }; }
	if(isContent(p.kind)){ return revertContentProposal(p); }
	const rec = recordOf(p.store, p.recordId);
	if(!rec){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: '档案已不存在' }; }
	const moved = Object.keys(p.changes).filter((k)=>!sameField(k, currentOf(p, rec, k), p.changes[k]));
	if(p.kind === 'record-unlink' && !same(otherRelations(p), p.other.after)){ moved.push('relations'); }
	if(moved.length){ return { ok: false, code: 'E_UNDO_RECORD_CHANGED', message: `采纳后档案又被改过(${moved.map(labelOf).join('、')}),不自动撤销` }; }
	try{
		applyProposal(p, p.before, p.other ? p.other.before : null);
	}catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: e && e.message ? e.message : `${e}` }; }
	const reverted = patch(p.id, { status: 'reverted', revertedAt: nowIso() });
	emitRecordsChanged({ store: p.store, cid: p.recordId, fields: Object.keys(p.changes || {}) });
	return { ok: true, proposal: reverted };
}

// 给工具与界面看的精简形状
export function summarizeProposal(p){
	if(!p){ return null; }
	return {
		proposalId: p.id, kind: p.kind, recordId: p.recordId, title: p.title, status: p.status,
		fields: Object.keys(p.changes || {}), reason: p.reason, createdAt: p.createdAt, decidedAt: p.decidedAt || null,
		...(Array.isArray(p.conflictFields) && p.conflictFields.length ? { conflictFields: p.conflictFields } : {}),
	};
}
