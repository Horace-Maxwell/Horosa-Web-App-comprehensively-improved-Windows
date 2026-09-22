// AI 助手·定时任务四类的执行体(P3):每日简报 / 每月流年·月运 / 自定义提示词 → 一次无头 Turn 落到新会话「自动·<标题>·YYYY-MM-DD」;
// 择日到期提醒 → 读十家择日方案键,窗口起始日落在 [今天, 今天+N 天] 的方案推通知(不用 AI)。
// 写入按审批档:on-request 时任务停 waiting 等用户(30 分钟不理=跳过);反问无人作答时 5 分钟后按拒绝处理(模型自行假设继续)。
import { reportBackgroundFailure } from '../bgSink';
import { resolveHeadlessProfile, runHeadlessTurn, GOAL_APPROVAL_TIMEOUT_MS, approvalVerb } from '../goalRunner';
import { requestApproval } from '../approvals';
import { requestElicitation } from '../elicitations';
import { findAnalysisSourceById } from '../../aiAnalysisSources';
import { AI_ANALYSIS_STORES, putStoreRecord } from '../../aiAnalysisStore';
import { safeJsonParseFromStorage } from '../../safeStorage';
import { getTask, patchTask } from './taskStore';
import { pushNotice } from './noticeStore';
import { buildScheduledPrompt, dateStamp, DAYS_AHEAD_DEFAULT } from './schedule';

export const SCHEDULED_CONV_PREFIX = '自动·';
export const ZERI_REMINDER_MAX = 20;
// 十家择日「已存方案」键(镜像 storageKeyRegistry 的 horosa.zeri.*.schemes.v1 条目;合同测试锁两边同构)
export const ZERI_SCHEME_KEYS = [
	['天星', 'horosa.zeri.schemes.v1'], ['奇门', 'horosa.zeri.qimen.schemes.v1'], ['黄历', 'horosa.zeri.huangli.schemes.v1'], ['八字', 'horosa.zeri.bazi.schemes.v1'],
	['太乙', 'horosa.zeri.taiyi.schemes.v1'], ['紫微', 'horosa.zeri.ziwei.schemes.v1'], ['六壬', 'horosa.zeri.liureng.schemes.v1'], ['三式', 'horosa.zeri.sanshi.schemes.v1'],
	['七政', 'horosa.zeri.qizheng.schemes.v1'], ['印度', 'horosa.zeri.india.schemes.v1'],
];

// 方案的窗口起始日(YYYY-MM-DD;各家 config.cfg.startDate 同形);缺=不提醒
export function schemeStartDate(scheme){
	const cfg = scheme && scheme.config && scheme.config.cfg;
	const s = cfg && typeof cfg.startDate === 'string' ? cfg.startDate.slice(0, 10) : '';
	return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

// 未来 N 天内(含今天)窗口起始的方案;纯读 localStorage,无副作用
export function zeriRemindersDue({ now, daysAhead, keys, read }){
	const base = now instanceof Date ? now : new Date(now || Date.now());
	const from = dateStamp(base);
	const to = dateStamp(new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.max(0, Number(daysAhead) || DAYS_AHEAD_DEFAULT)));
	const rd = typeof read === 'function' ? read : safeJsonParseFromStorage;
	const out = [];
	(keys || ZERI_SCHEME_KEYS).forEach(([family, key])=>{
		const data = rd(key);
		const schemes = data && Array.isArray(data.schemes) ? data.schemes : [];
		schemes.forEach((s)=>{
			const start = schemeStartDate(s);
			if(start && start >= from && start <= to){ out.push({ family, key, id: s.id, name: `${s.name || ''}`, startDate: start }); }
		});
	});
	out.sort((a, b)=>(a.startDate < b.startDate ? -1 : (a.startDate > b.startDate ? 1 : 0)));
	return out.slice(0, ZERI_REMINDER_MAX);
}

export async function ensureScheduledConversation(task, resolved, now, deps){
	const put = (deps && deps.putStoreRecord) || putStoreRecord;
	const at = (now instanceof Date ? now : new Date()).toISOString();
	const source = task.spec && task.spec.sourceCid ? findAnalysisSourceById(task.spec.sourceCid) : null;
	return put(AI_ANALYSIS_STORES.conversations, {
		title: `${SCHEDULED_CONV_PREFIX}${`${task.title || ''}`.slice(0, 20)}·${dateStamp(now)}`,
		sourceRef: source ? { id: source.id, sourceType: source.sourceType, title: source.title, module: source.module } : null,
		providerProfileId: resolved.profile.id, providerName: resolved.profile.name, providerType: resolved.profile.providerType, model: resolved.model,
		referenceIds: [], techniqueKeys: Array.isArray(task.spec && task.spec.techniques) ? task.spec.techniques.slice(0) : [], systemPrompt: '',
		meta: { taskId: task.id, kind: 'scheduled', scheduledKind: task.spec && task.spec.kind }, lastMessageAt: at, updatedAt: at, createdAt: at, archived: false, favorite: false,
	}, 'conv');
}

// 执行体:返回 { ok, summary | error, conversationId? }(调度器据此落 result/通知/下次)
export async function runScheduledTask(task, ctx){
	const c = ctx || {};
	const deps = c.deps || {};
	const now = c.now instanceof Date ? c.now : new Date();
	const spec = task.spec || {};
	if(spec.kind === 'zeri-reminder'){
		const hits = (deps.zeriRemindersDue || zeriRemindersDue)({ now, daysAhead: spec.daysAhead || DAYS_AHEAD_DEFAULT, read: deps.readStorage });
		if(!hits.length){ return { ok: true, summary: `未来 ${spec.daysAhead || DAYS_AHEAD_DEFAULT} 天内没有到期的择日方案` }; }
		for(let i = 0; i < hits.length; i++){
			const h = hits[i];
			// eslint-disable-next-line no-await-in-loop
			await (deps.pushNotice || pushNotice)({ level: 'info', title: '择日方案到期提醒', body: `${h.family}择日「${h.name}」${h.startDate} 起`, taskId: task.id }, { desktop: true });
		}
		return { ok: true, summary: `${hits.length} 个方案即将到期:${hits.map((h)=>`${h.name}(${h.startDate})`).join('、')}`.slice(0, 400) };
	}
	const resolved = deps.resolved || await (deps.resolveHeadlessProfile || resolveHeadlessProfile)(spec);
	if(!resolved){ return { ok: false, error: '没有可用的接口配置/模型' }; }
	const conv = await ensureScheduledConversation(task, resolved, now, deps);
	const source = spec.sourceCid ? findAnalysisSourceById(spec.sourceCid) : null;
	const approve = typeof c.requestApproval === 'function' ? c.requestApproval : async (call)=>{
		await patchTask(task.id, { status: 'waiting' });
		await (deps.pushNotice || pushNotice)({ level: 'action', title: '定时任务等你批准', body: `${task.title}:${call.name} ${approvalVerb(call)}`, taskId: task.id }, { desktop: true });
		let ok = false;
		try{ ok = await (deps.requestApproval || requestApproval)(`task:${task.id}`, call, { timeoutMs: GOAL_APPROVAL_TIMEOUT_MS }); }catch(e){ ok = false; reportBackgroundFailure('scheduled.approval', e); }
		const cur = await getTask(task.id);
		if(cur && cur.status === 'waiting'){ await patchTask(task.id, { status: 'running' }); }
		return ok;
	};
	const elicit = typeof c.requestElicitation === 'function' ? c.requestElicitation : async (q)=>{
		await (deps.pushNotice || pushNotice)({ level: 'action', title: '定时任务向你提问', body: `${task.title}:${q.question}`, taskId: task.id }, { desktop: true });
		return (deps.requestElicitation || requestElicitation)(`task:${task.id}`, q);
	};
	const r = await (deps.runHeadlessTurn || runHeadlessTurn)({
		profile: resolved.profile, model: resolved.model, conversationId: conv.id, userText: buildScheduledPrompt(spec, now, { hasSource: !!source }), source,   // [Q-400/M-145] 无挂载 / 档案已删 → 无命盘文案 techniqueKeys: Array.isArray(spec.techniques) ? spec.techniques : [],
		systemPrompt: '', origin: 'scheduled', taskId: task.id, signal: c.signal, requestApproval: approve, requestElicitation: elicit, deps,
		techniqueOptionOverrides: spec.techniqueOptionOverrides,   // [Q-285] 定时任务有快照就用(无=同类默认)
	});
	if(!r || r.error){ return { ok: false, error: (r && r.error) || '生成失败', conversationId: conv.id }; }
	return { ok: true, summary: `${r.content || ''}`.slice(0, 400), conversationId: conv.id };
}
