// 设定 AI 对话的挂载 —— 本人档案 / 合盘对方 / 挂载哪些技法(与挂载抽屉同一组状态)。
// 只增级(additive)+ 工作区类别:它改的挂载勾选会落进 AI 分析页的界面偏好、跨会话保留,所以按写入走审批、记入动作账本,
// 外部客户端开「只读档」时不可用;撤销 = 复原本人 / 合盘对方 / 挂载技法(撤销前比对此刻挂载 === 写后,被改过不自动撤)。
// 不改任何档案。只在 AI 分析页挂载着时可用(挂载状态归那一页管);技法只认该档案类型可挂的键。
import { ctxUi, GUIDE, RECORD_ID_PATTERN } from './_shared';
import { spotlight } from '../../aiAgent/agentSpotlight';
import { registerUndoHandler, undoAction } from '../ledger';
import { getWorkspaceUi } from '../workspaceBridge';
import { findAnalysisSourceById } from '../../aiAnalysisSources';
import { listAnalysisTechniqueOptions } from '../../aiAnalysisContext';

export const CHAT_MOUNT_TECHNIQUES_MAX = 12;

function sameList(a, b){ return JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort()); }
function sameMount(a, b){
	return `${(a && a.sourceId) || ''}` === `${(b && b.sourceId) || ''}` && `${(a && a.partnerId) || ''}` === `${(b && b.partnerId) || ''}` && sameList(a && a.techniques, b && b.techniques);
}
function applyMount(ui, from, to){
	if(`${(from && from.sourceId) || ''}` !== `${to.sourceId || ''}`){ ui.selectSource(to.sourceId || ''); }   // 原来没挂本人 = 回到不挂
	ui.setChatPartner(to.partnerId || '');
	ui.setChatTechniques(Array.isArray(to.techniques) ? to.techniques : []);
}

export const CHAT_MOUNT_UNDO_KIND = 'restore-chat-mount';
// 账本撤销:AI 分析页在场 → 比对此刻挂载 === 写后,一致才复原写前;页不在场 / 被改过 → 如实拒
export function undoChatMount(action, undo){
	const p = (undo && undo.payload) || {};
	const ui = getWorkspaceUi() || {};
	if(typeof ui.getChatMount !== 'function' || typeof ui.setChatTechniques !== 'function' || typeof ui.setChatPartner !== 'function' || typeof ui.selectSource !== 'function'){
		return { ok: false, code: 'E_BRIDGE_UNAVAILABLE', message: 'AI 分析页没有打开:打开 AI 分析页后再撤销' };
	}
	const now = ui.getChatMount() || {};
	if(!sameMount(now, p.after)){ return { ok: false, code: 'E_UNDO_RECORD_CHANGED', message: '对话挂载在助手改动后已被改过,不自动撤销' }; }
	applyMount(ui, p.after, p.before || {});
	return { ok: true, data: { restoredTo: p.before || {} } };
}
let undoRegistered = false;
export function ensureChatMountUndo(){
	if(undoRegistered){ return; }
	undoRegistered = true;
	registerUndoHandler(CHAT_MOUNT_UNDO_KIND, undoChatMount);
}
ensureChatMountUndo();

// 写入计划(纯读):写前预览、无变化预检与执行同一份 —— 回 { result }(执行必拒的回包)或 { ui, before, after, source, changed }
function planChatMount(args, ctx){
	const ui = ctxUi(ctx);
	if(typeof ui.getChatMount !== 'function' || typeof ui.setChatTechniques !== 'function' || typeof ui.setChatPartner !== 'function' || typeof ui.selectSource !== 'function'){
		return { result: { ok: false, code: 'E_BRIDGE_UNAVAILABLE', message: 'AI 分析页没有打开(对话挂载归那一页管);可先用 navigate_to_technique 切到 aianalysis' } };
	}
	if(args.recordId === undefined && args.partnerRecordId === undefined && args.techniques === undefined){
		return { result: { ok: false, code: 'E_ARGS_INVALID', message: 'recordId / partnerRecordId / techniques 至少给一个' } };
	}
	const before = ui.getChatMount() || { sourceId: '', partnerId: '', techniques: [] };
	const sourceId = args.recordId !== undefined ? `${args.recordId}` : `${before.sourceId || ''}`;
	const source = sourceId ? findAnalysisSourceById(sourceId) : null;
	if(args.recordId !== undefined && !source){ return { result: { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到档案 ${sourceId.slice(0, 80)}` } }; }
	// 合盘对方:给了才动;本人换了而对方没给 → 对方若与新本人冲突则清掉(与页面同一规则)
	let partnerId = args.partnerRecordId !== undefined ? `${args.partnerRecordId || ''}` : `${before.partnerId || ''}`;
	let partner = null;
	if(partnerId){
		partner = findAnalysisSourceById(partnerId);
		if(!partner){ return { result: { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到合盘对方 ${partnerId.slice(0, 80)}` } }; }
		if(!source || source.sourceType !== 'chart' || partner.sourceType !== 'chart'){ return { result: { ok: false, code: 'E_TECHNIQUE_NOT_ALLOWED', message: '合盘需要本人与对方都是命盘' } }; }
		if(partner.id === source.id){
			if(args.partnerRecordId !== undefined){ return { result: { ok: false, code: 'E_ARGS_INVALID', message: '合盘对方不能是本人' } }; }
			partnerId = '';
			partner = null;
		}
	}
	// 技法:只认该档案类型可挂的键;一个认不出就整次拒(不悄悄丢)
	let techniques = Array.isArray(before.techniques) ? before.techniques.slice() : [];
	const options = source ? (listAnalysisTechniqueOptions(source) || []) : [];
	if(args.techniques !== undefined){
		if(!source){ return { result: { ok: false, code: 'E_ARGS_INVALID', message: '还没有挂载本人档案,先给 recordId' } }; }
		const allowed = options.map((o)=>o && o.value).filter(Boolean);
		const want = [];
		args.techniques.forEach((k)=>{ const t = `${k || ''}`.trim(); if(t && want.indexOf(t) < 0){ want.push(t); } });
		const bad = want.filter((k)=>allowed.indexOf(k) < 0);
		if(bad.length){ return { result: { ok: false, code: 'E_TECHNIQUE_NOT_ALLOWED', message: `这张档案挂不了:${bad.join('、')};可挂:${allowed.join(' ')}` } }; }
		techniques = want;
	}
	const after = { sourceId, partnerId, techniques };
	const changed = after.sourceId !== `${before.sourceId || ''}` || after.partnerId !== `${before.partnerId || ''}` || !sameList(after.techniques, before.techniques);
	return { ui, before, after, source, partner, options, changed };
}
// 无变化的回包(data.changed:false = 注册表的「无变化」约定:不弹审批、不进账本)
function unchangedOf(plan){ return { ok: true, data: { ...plan.after, changed: false }, summary: '挂载未变', message: '挂载已经是这样,无需改动' }; }
// 审批卡上的挂载(中文:档案标题 / 合盘对方 / 技法名)
function mountText(m, options){
	const title = (id)=>{ if(!id){ return '无'; } const s = findAnalysisSourceById(id); return s && s.title ? `${s.title}` : `${id}`.slice(0, 40); };
	const techLabel = (k)=>{ const o = (options || []).find((x)=>x && x.value === k); return o && o.label ? `${o.label}` : `${k}`; };
	const list = Array.isArray(m && m.techniques) ? m.techniques : [];
	return `本人:${title(m && m.sourceId)}\n合盘对方:${m && m.partnerId ? title(m.partnerId) : '无'}\n挂载技法:${list.length ? list.map(techLabel).join('、') : '(一个都不挂)'}`;
}

export default {
	name: 'set_chat_mount',
	level: 'additive',
	category: 'workspace',
	undoKind: CHAT_MOUNT_UNDO_KIND,
	origins: ['in-app', 'mcp'],
	outputSchema: {
		type: 'object', required: ['sourceId', 'partnerId', 'techniques', 'changed'],
		properties: { sourceId: { type: 'string' }, partnerId: { type: 'string' }, techniques: { type: 'array', items: { type: 'string' } }, changed: { type: 'boolean' } },
	},
	description: `设定 AI 对话的挂载:本人档案(recordId)、合盘对方(partnerRecordId;空串 = 取消合盘)、挂载哪些技法(techniques,整组替换)。挂载会跨会话保留,按写入记入动作账本,可一键撤销回改之前的挂载;不改任何档案;只在 AI 分析页打开时可用。${GUIDE}:用户说「挂上八字和紫微 / 和 B 合盘 / 换成看 A 的盘」时调用;技法键见 cast_technique 的说明或 get_current_context。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			recordId: { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80, description: '本人档案 id(可选;不给 = 不换本人)' },
			partnerRecordId: { type: 'string', maxLength: 80, description: '合盘对方命盘 id(可选;空串 = 取消合盘;本人与对方都须是命盘)' },
			techniques: { type: 'array', maxItems: CHAT_MOUNT_TECHNIQUES_MAX, items: { type: 'string', minLength: 1, maxLength: 32 }, description: '挂载技法键(整组替换;空数组 = 一个都不挂)' },
		},
	},
	// 写前预览:改前 / 改后挂载(中文名)
	preview(args, ctx){
		const plan = planChatMount(args, ctx);
		if(plan.result){ return null; }
		return { title: '设定 AI 对话挂载', before: mountText(plan.before, plan.options), after: mountText(plan.after, plan.options) };
	},
	// 无变化预检(审批前与执行同一份计划):挂载已经是这样 → 不弹审批、不进账本
	noChange(args, ctx){
		const plan = planChatMount(args, ctx);
		return !plan.result && !plan.changed ? unchangedOf(plan) : null;
	},
	async run(args, ctx){
		const plan = planChatMount(args, ctx);
		if(plan.result){ return plan.result; }
		const { ui, before, after, source } = plan;
		if(!plan.changed){ return unchangedOf(plan); }
		if(after.sourceId !== `${before.sourceId || ''}`){ ui.selectSource(after.sourceId); }
		if(after.partnerId !== `${before.partnerId || ''}`){ ui.setChatPartner(after.partnerId); }
		if(!sameList(after.techniques, before.techniques)){ ui.setChatTechniques(after.techniques); }
		const label = `${source ? source.title : '无'}${after.partnerId ? ' × 对方' : ''} · ${after.techniques.length} 项技法`;
		const actionId = ctx && ctx.actionId;
		if(actionId){ spotlight({ label: `AI 已设挂载 ${label}`, undo: ()=>undoAction(actionId) }); }   // 提示条的「撤销」走同一笔账本撤销
		return { ok: true, data: { ...after, changed: true }, summary: `挂载 ${label}`, message: `已设对话挂载:${label}(可在动作条撤销)`,
			undo: { kind: CHAT_MOUNT_UNDO_KIND, payload: { before: { sourceId: `${before.sourceId || ''}`, partnerId: `${before.partnerId || ''}`, techniques: Array.isArray(before.techniques) ? before.techniques.slice() : [] }, after } } };
	},
};
