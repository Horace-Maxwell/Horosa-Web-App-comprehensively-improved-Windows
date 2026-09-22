// AI 助手·目标任务运行器(P2;借鉴 Codex /goal):一句话目标 → 自己一轮一轮做到「达成/卡住/预算用完」,
// 每轮=一个无头 Turn(与页面 streamReply 同一骨架:createAgentTurn → do{ beginRound; 流请求 }while(settleRound) → 落 assistant 消息),
// 轮末一次非流式 JSON 自检判官({status: done|continue|blocked});预算四维跨轮累计;暂停/继续/取消/纠偏经 taskRegistry 控制器。
// 纪律:每轮仍守 AGENT_LIMITS;写入审批档 on-request 时任务停在 waiting 等用户;所有写入进账本可撤;总开关+目标子开关都开才可起跑。
import { createAgentTurn } from './runtime';
import { requestApproval } from './approvals';
import { requestElicitation } from './elicitations';
import { createTask, getTask, patchTask, appendLog, registerRunning, unregisterRunning, pushNotice, heartbeatTask, runnerStamp, RUNNER_HEARTBEAT_MS, listTasks } from './tasks';
import { isAgentEnabled, isGoalEnabled, getGoalParallel } from './prefs';
import { requestAIAnalysisChat, requestAIAnalysisChatStream } from '../../services/aianalysis';
import { AI_ANALYSIS_STORES, putStoreRecord, getStoreRecord, listStoreRecords, saveConversationMessage, listConversationMessages, loadUiPrefs, ORPHAN_STREAMING_CONTENT } from '../aiAnalysisStore';
import { reportBackgroundFailure } from './bgSink';
import { readContextPolicy, windowChatMessages } from '../aiChatHistory';
import { getAnalysisSourceContext, getAnalysisTechniqueContexts, buildContextLayers, clipContextLayersDetailed, hashPromptText, AI_CONTEXT_MAX_CHARS, analysisTechniqueLabelMap } from '../aiAnalysisContext';
import { findAnalysisSourceById } from '../aiAnalysisSources';
import { parseModelSelection, applyThinkingLevel, getProviderProtocolFamily, mountCharBudgetFor, isOpenAiFamily } from '../aiAnalysisProviders';
import { deriveUsage } from '../aiChat/status';
import { readModelRoutes, hasAnyRoute, resolveRoute, providerOptionsForSlot } from '../aiModelRouting';

export const GOAL_TASK_CONV_PREFIX = '目标·';
export const GOAL_JUDGE_TAG = '【目标自检】';
export const GOAL_STEER_PREFIX = '[用户纠偏]';
export const GOAL_MAX_JUDGE_FAILS = 2;
export const GOAL_APPROVAL_TIMEOUT_MS = 30 * 60 * 1000;
// 与聊天同一缓存断点标记(Java 分家处理靠同一字面;各消费方 lockstep 由合同测试锁)
export const CACHE_BP = '[[__CACHE_BP__]]';

// ---- 档案/模型解析(无头:读 uiPrefs.modelSelection → provider_profiles;解密由 store 层完成) ----
// [D27] 审批通知按级别措辞(读级在非对话来源已由运行时自动放行,此处只可能是写入;保留级别分支防回潮)
export function approvalVerb(call){ return call && call.level === 'read' ? '请求执行' : '请求写入'; }

// [D38] 任务创建时快照 modelSelection(此前四条创建路径没有一条写它 ⇒ 后台任务永远用「当前」UI 选中的模型;
// 用户换模型后所有排期任务静默换模型)。旧任务无字段 ⇒ 仍读当前 UI(现状)。
import { snapshotModelSelection } from './tasks/modelSnapshot';
import { resolveEffectiveTechniqueOptions } from '../techniqueMountSettings';
import { readPersona, personaLayer } from '../aiChat/persona';
import { readPersonaLayers } from '../aiChat/personaLayers';
import { listMemories, memoryLayer } from '../aiChat/memory';
import { compactLayer } from '../aiChat/compact';
export { snapshotModelSelection };
export async function resolveHeadlessProfile(spec){
	const pinned = !!(spec && spec.modelSelection);
	const sel = pinned ? spec.modelSelection : ((loadUiPrefs() || {}).modelSelection || '');
	const parsed = parseModelSelection(sel);
	const profiles = (await listStoreRecords(AI_ANALYSIS_STORES.providerProfiles) || []).filter((p)=>p && p.enabled !== false);
	const byId = parsed.profileId ? profiles.find((p)=>p.id === parsed.profileId) : null;
	// 钉住的档案被删/停用 ⇒ 不再静默换到 profiles[0](可能换到别家),让任务以「档案不可用」失败并通知
	if(pinned && parsed.profileId && !byId){ return null; }
	const profile = byId || profiles[0] || null;
	if(!profile){ return null; }
	const model = parsed.model || (profile.chatModelIds && profile.chatModelIds[0]) || (profile.manualModels && profile.manualModels[0]) || '';
	return model ? { profile, model } : null;
}

// [D3] 无头槽位解析:「按任务用模型」的 judge 槽此前只被多模型对比读,目标任务自检从不看它(说明书承诺落空)。
// 六槽全空 → 原样返回(零 IO,缺省路径不变);设了 → 与页面同一 resolveRoute 从 provider_profiles 解析(解密由 store 层完成)。
export async function resolveHeadlessSlot(slot, resolved){
	if(!resolved || !resolved.profile){ return resolved; }
	const routes = readModelRoutes();
	if(!hasAnyRoute(routes)){ return resolved; }
	const profiles = (await listStoreRecords(AI_ANALYSIS_STORES.providerProfiles) || []).filter((p)=>p && p.enabled !== false);
	const r = resolveRoute(slot, { routes, providerProfiles: profiles, profile: resolved.profile, model: resolved.model });
	return r && r.profile && r.model ? { profile: r.profile, model: r.model } : resolved;
}

// [Q-285/M-100] 无头轮的稳定层附加项:口径 102 / 记忆 101 / 压缩摘要 88 —— 与对话页 useChatAssist.promptLayerExtras 同开关同形
//   (persona.enabled / persona.memoryInject / 会话记录的 compact);此前无头入口一层都不注入,口径卡却称「每次对话」。
export async function headlessLayerExtras({ source, techniqueKeys, conversation }){
	const out = [];
	try{
		const p = readPersona();
		const pl = personaLayer(p, { layers: readPersonaLayers(), subjectCid: source ? source.id : '', subjectTitle: source ? source.title : '', techniqueKeys: Array.isArray(techniqueKeys) ? techniqueKeys : [], techniqueLabels: analysisTechniqueLabelMap(techniqueKeys), sessionText: conversation ? conversation.persona : '' });
		if(pl){ out.push(pl); }
		if(p.memoryInject){
			const ml = memoryLayer(await listMemories(), { subjectCid: source ? source.id : '' });
			if(ml){ out.push(ml); }
		}
		const cl = conversation && conversation.compact ? compactLayer(conversation.compact) : null;
		if(cl){ out.push(cl); }
	}catch(e){ reportBackgroundFailure('headless.layerExtras', e); }
	return out;
}

// [#80] 整层被丢弃时给模型留痕(与对话页 AIAnalysisMain 同一句;此前无头轮丢层无声)。追加在缓存断点之后:被丢集合逐轮会变。
export function droppedLayersNote(dropped){
	const names = (Array.isArray(dropped) ? dropped : [])
		.map((item)=>`${(item && (item.title || item.key)) || ''}`.replace(/^使用技法：/, ''))
		.filter(Boolean);
	if(!names.length){ return ''; }
	return `[挂载预算不足：以下 ${names.length} 层整层未纳入 —— ${names.join('、')}。未列出的内容不代表不存在，请勿臆补；如需完整资料，请提示用户在「进阶 → 对话上下文策略 → 挂载字数预算」里调大，或减少挂载技法。]`;
}

// ---- 无头系统提示词:与页面同一套层/裁剪/缓存断点(不含资料检索与会话规则;目标任务只带挂载盘与技法) ----
// [Q-285/M-96] techniqueOptionOverrides = 任务创建时的会话覆盖快照;生效挂载设置 = 覆盖 ?? 同类默认(resolveEffectiveTechniqueOptions,
//   与对话页 effectiveTechniqueOptions 同一函数)。conversation = 本任务会话记录(取 persona / compact)。
export async function buildHeadlessSystemPrompt({ source, techniqueKeys, systemPrompt, profile, model, techniqueOptionOverrides, conversation }){
	const keys = Array.isArray(techniqueKeys) ? techniqueKeys.filter(Boolean) : [];
	const ctx = source && source.record ? await getAnalysisSourceContext(source, { mode: keys.length ? 'meta' : 'full' }) : null;
	const techniqueOptions = keys.length ? resolveEffectiveTechniqueOptions(keys, { record: source && source.record ? source.record : null, sessionOverrides: techniqueOptionOverrides }) : {};
	const techniqueContexts = source && keys.length
		? await getAnalysisTechniqueContexts(source, keys, { sourceContext: ctx, techniqueOptions: Object.keys(techniqueOptions).length ? techniqueOptions : null })
		: [];
	const extraLayers = await headlessLayerExtras({ source, techniqueKeys: keys, conversation });
	const layers = buildContextLayers({ sourceContext: ctx, techniqueContexts, materials: [], bundles: [], templates: [], retrievedChunks: [], conversationMessages: [], systemPrompt: systemPrompt || '', extraLayers });
	const numCtx = profile && profile.providerType === 'ollama' ? Number((profile.providerOptions || {}).num_ctx) || undefined : undefined;
	// [#80] 无头轮同样吃用户设的挂载字数预算(策略键是全局的,后台任务不该比对话页看得少)
	const clip = clipContextLayersDetailed(layers, { maxChars: mountCharBudgetFor(model, { numCtx, floorChars: AI_CONTEXT_MAX_CHARS, policy: readContextPolicy() }), fairShare: true });
	const join = (arr)=>arr.map((item)=>`${item.title}\n${item.content}`).join('\n\n').trim();
	const volatileKeys = { 'retrieved-context': 1, 'recent-history': 1 };
	const stable = clip.kept.filter((item)=>!volatileKeys[item.key]);
	const volatile = clip.kept.filter((item)=>volatileKeys[item.key]);
	const fam = getProviderProtocolFamily(profile && profile.providerType);
	const cacheFam = fam === 'anthropic' || fam === 'openai-compatible';
	let joined;
	if(cacheFam && stable.length && volatile.length){ joined = [join(stable), join(volatile)].filter(Boolean).join(`\n\n${CACHE_BP}\n\n`); }
	else if(cacheFam && stable.length){ joined = `${join(stable)}\n\n${CACHE_BP}`; }
	else{ joined = join(clip.kept); }
	const note = droppedLayersNote(clip.dropped);
	if(note){ joined = `${joined}\n\n${note}`; }
	return { systemPrompt: joined, meta: { stableHash: hashPromptText(join(stable)), stableChars: join(stable).length, volatileChars: join(volatile).length, layerKeys: clip.kept.map((i)=>i.key), droppedKeys: (clip.dropped || []).map((i)=>i.key) } };
}

// ---- 一个无头 Turn:落 user → 组历史 → 窗口裁剪 → 运行时循环 → 落 assistant ----
export async function runHeadlessTurn({ profile, model, conversationId, userText, source, techniqueKeys, systemPrompt, origin = 'goal', taskId, signal, registry, requestApproval: reqApproval, requestElicitation: reqElicit, onTrace, thinkingLevel = 'off', techniqueOptionOverrides, deps }){
	const d = deps || {};
	const stream = d.requestAIAnalysisChatStream || requestAIAnalysisChatStream;
	const saveMsg = d.saveConversationMessage || saveConversationMessage;
	const listMsgs = d.listConversationMessages || listConversationMessages;
	const buildSys = d.buildHeadlessSystemPrompt || buildHeadlessSystemPrompt;
	const now = ()=>new Date().toISOString();
	await saveMsg({ conversationId, role: 'user', content: `${userText || ''}`, streamStatus: 'done', createdAt: now(), updatedAt: now(), taskId: taskId || undefined });
	const assistant = await saveMsg({ conversationId, role: 'assistant', content: '', streamStatus: 'streaming', createdAt: now(), updatedAt: now(), taskId: taskId || undefined });
	// [Q-285] 会话记录(口径 / 压缩摘要)与任务创建时的会话覆盖快照一并交给拼装;读失败 = 无层(与缺席同形)
	let conversation = null;
	// 读不到会话记录 = 少注入口径 / 压缩摘要两层(不影响本轮能否跑),留痕后按无层继续。
	try{ conversation = conversationId ? await (d.getStoreRecord || getStoreRecord)(AI_ANALYSIS_STORES.conversations, conversationId) : null; }
	catch(e){ conversation = null; reportBackgroundFailure('headless.readConversation', e); }
	const sys = await buildSys({ source, techniqueKeys, systemPrompt, profile, model, techniqueOptionOverrides, conversation });
	// [G11] 历史过滤:本轮占位、仍在流的、以及刷新遗留的孤儿(载入时被修成 aborted + 固定正文)都不进请求体——模型不该读到「已停止生成」
	const history = (await listMsgs(conversationId)).filter((m)=>m && m.id !== assistant.id && (m.role === 'user' || m.role === 'assistant') && m.streamStatus !== 'streaming' && `${m.content || ''}` !== ORPHAN_STREAMING_CONTENT)
		.map((m)=>({ role: m.role, content: `${m.content || ''}`, ...(m.agentTrace ? { agentTrace: m.agentTrace } : {}) }));
	const chatMessages = [{ role: 'system', content: sys.systemPrompt }].concat(history);
	const numCtx = profile && profile.providerType === 'ollama' ? Number((profile.providerOptions || {}).num_ctx) || undefined : undefined;
	const { messages: baseMessages, meta: historyMeta } = windowChatMessages(chatMessages, { model, numCtx, policy: readContextPolicy() });
	const ac = new AbortController();
	const onAbort = ()=>ac.abort();
	if(signal){ if(signal.aborted){ ac.abort(); }else{ signal.addEventListener('abort', onAbort, { once: true }); } }
	let trace = null;
	const agent = (d.createAgentTurn || createAgentTurn)({
		profile, model, signal: ac.signal, lastUserMessage: `${userText || ''}`, origin, taskId,
		...(registry ? { registry } : {}),   // [批三③] 无头出口传只读注册表视图;缺省=默认注册表(现状)
		onTrace: (t)=>{ trace = t; if(typeof onTrace === 'function'){ onTrace(t); } },
		requestApproval: reqApproval, requestElicitation: reqElicit,
	});
	const providerOptions = applyThinkingLevel({ ...(profile.providerOptions || {}) }, thinkingLevel, profile.providerType, model);
	let content = ''; let usage = null; let streamError = null; let error = null;
	try{
		do{
			agent.beginRound();
			if(agent.enabled){ content = ''; streamError = null; }
			try{
				// eslint-disable-next-line no-await-in-loop
				await stream({ providerType: profile.providerType, apiKey: profile.apiKey, baseUrl: profile.baseUrl, model, providerOptions, messages: agent.messagesForRound(baseMessages), tools: agent.toolDefs(), toolChoice: agent.toolChoice() }, {
					signal: ac.signal,
					onEvent: (event)=>{
						agent.onEvent(event);
						if(event.type === 'delta'){ const delta = event.json && event.json.delta ? `${event.json.delta}` : ''; if(delta && !ac.signal.aborted){ content += delta; } }
						else if(event.type === 'usage'){ if(event.json && typeof event.json === 'object'){ usage = event.json; } }
						else if(event.type === 'error'){ streamError = (event.json && event.json.message) ? `${event.json.message}` : (event.data || '上游服务返回错误'); }
					},
				});
			}catch(streamEx){ if(!agent.absorbStreamError(streamEx)){ throw streamEx; } }
		// eslint-disable-next-line no-await-in-loop
		}while(await agent.settleRound());
	}catch(e){
		error = e && e.name === 'AbortError' ? null : (streamError || (e && e.message ? `${e.message}` : '生成失败'));
		if(error && typeof agent.failRound === 'function'){ agent.failRound(error); }
	}finally{
		if(signal){ signal.removeEventListener('abort', onAbort); }
	}
	const aborted = ac.signal.aborted;
	const finalContent = `${content || ''}`.trim();
	const finalUsage = usage ? { ...(agent.mergeUsage ? agent.mergeUsage(usage) : usage), model, providerType: profile.providerType, prompt: sys.meta, history: historyMeta } : undefined;
	const status = aborted ? 'aborted' : ((!finalContent && (error || streamError)) ? 'error' : 'done');
	const saved = await saveMsg({ ...assistant, content: finalContent || (aborted ? '已停止。' : (status === 'error' ? '' : '模型未返回可用内容')), streamStatus: status, errorInfo: status === 'error' ? { message: error || streamError } : null, usage: finalUsage, agentTrace: agent.trace() || trace || undefined, updatedAt: now() });
	return { assistant: saved, trace: agent.trace() || trace, usage: finalUsage, aborted, error: status === 'error' ? (error || streamError) : null, content: finalContent };
}

// ---- 自检判官:非流式 JSON,坏 JSON 视为 blocked(调用方累计两次即停 waiting) ----
export function buildJudgePrompt(spec){
	const goal = `${spec.goal || ''}`.slice(0, 2000);
	const criteria = `${spec.successCriteria || ''}`.slice(0, 1000);
	return `${GOAL_JUDGE_TAG}你是目标任务的自检员。目标:${goal}${criteria ? `\n完成判据:${criteria}` : ''}\n根据到目前为止的对话(尤其最近一轮助手的回复与已执行的动作),只输出一个 JSON 对象:{"status":"done"|"continue"|"blocked","reason":"一句话","nextStep":"若 continue,下一步做什么"}。done=目标已达成;continue=还没完但能继续;blocked=缺信息/权限或反复失败需要用户介入。不要输出其它文字。`;
}

export function parseJudge(text){
	try{
		const m = `${text || ''}`.match(/\{[\s\S]*\}/);
		if(!m){ return null; }
		const j = JSON.parse(m[0]);
		if(['done', 'continue', 'blocked'].indexOf(j.status) < 0){ return null; }
		return { status: j.status, reason: `${j.reason || ''}`.slice(0, 300), nextStep: `${j.nextStep || ''}`.slice(0, 300) };
	}catch(e){ return null; }
}

// [G10] signal:任务取消/暂停后判官这次短调用同样中止(不再停了之后请求还在飞)
// [Q-402① 裁决 2026-09-18] onSpend({ wallMs, usage, calls:1 }):判官短调用的时长 / usage 回报给目标循环计入预算(此前判官不入账)。
export async function judgeGoal({ profile, model, spec, lastReply, deps, signal, onSpend }){
	const chat = (deps && deps.requestAIAnalysisChat) || requestAIAnalysisChat;
	const t0 = Date.now();
	// [D1] 判官槽的思考档/推理档/温度/输出上限经单源施加(槽空=今日字节)
	const opts = providerOptionsForSlot('judge', profile, model, { applyThinkingLevel });
	if(isOpenAiFamily(profile.protocolFamily || getProviderProtocolFamily(profile.providerType))){ opts.response_format = { type: 'json_object' }; }
	const rsp = await chat({ providerType: profile.providerType, apiKey: profile.apiKey, baseUrl: profile.baseUrl, model, providerOptions: { ...opts, requestTimeoutMs: 60000 },
		messages: [{ role: 'system', content: buildJudgePrompt(spec) }, { role: 'user', content: `最近一轮助手回复:\n${`${lastReply || ''}`.slice(0, 6000)}\n\n请给出 JSON 判定。` }] }, { signal });
	const text = rsp && rsp.Result && rsp.Result.content ? `${rsp.Result.content}` : '';
	if(typeof onSpend === 'function'){ try{ onSpend({ wallMs: Date.now() - t0, usage: rsp && rsp.Result && rsp.Result.usage ? rsp.Result.usage : null, calls: 1 }); }catch(e){ /* noop: 记账失败不影响判定 */ } }
	return parseJudge(text);
}

export function buildGoalPrompt(spec){
	const parts = [`目标:${`${spec.goal || ''}`.slice(0, 2000)}`];
	if(spec.successCriteria){ parts.push(`完成判据:${`${spec.successCriteria}`.slice(0, 1000)}`); }
	parts.push('请先列出计划,然后立即执行第一步;需要写入(建档/改设置)时直接调用工具;每步说明做了什么、下一步是什么。');
	return parts.join('\n');
}

// ---- 目标循环 ----
const runningLoops = new Map();   // taskId → { ac, state }

function budgetExceeded(task){
	const b = task.budget || {}; const s = task.spent || {};
	if(b.maxTurns && s.turns >= b.maxTurns){ return `预算:轮数(${s.turns}/${b.maxTurns})`; }
	if(b.maxCalls && s.calls >= b.maxCalls){ return `预算:调用次数(${s.calls}/${b.maxCalls})`; }
	if(b.maxCostUsd && s.costUsd >= b.maxCostUsd){ return `预算:费用($${s.costUsd.toFixed(3)}/$${b.maxCostUsd})`; }
	if(b.maxWallMinutes && s.wallMs >= b.maxWallMinutes * 60000){ return `预算:时长(${Math.round(s.wallMs / 60000)}/${b.maxWallMinutes} 分钟)`; }
	return null;
}

export async function ensureGoalConversation(task, resolved, deps){
	const put = (deps && deps.putStoreRecord) || putStoreRecord;
	const get = (deps && deps.getStoreRecord) || getStoreRecord;
	if(task.conversationId){
		const c = await get(AI_ANALYSIS_STORES.conversations, task.conversationId);
		if(c){ return c; }
	}
	const now = new Date().toISOString();
	const source = task.spec && task.spec.sourceCid ? findAnalysisSourceById(task.spec.sourceCid) : null;
	const conv = await put(AI_ANALYSIS_STORES.conversations, {
		title: `${GOAL_TASK_CONV_PREFIX}${`${task.spec.goal || task.title || ''}`.slice(0, 24)}`,
		sourceRef: source ? { id: source.id, sourceType: source.sourceType, title: source.title, module: source.module } : null,
		providerProfileId: resolved.profile.id, providerName: resolved.profile.name, providerType: resolved.profile.providerType, model: resolved.model,
		referenceIds: [], techniqueKeys: Array.isArray(task.spec.techniques) ? task.spec.techniques.slice(0) : [], systemPrompt: '',
		meta: { taskId: task.id, kind: 'goal' }, lastMessageAt: now, updatedAt: now, createdAt: now, archived: false, favorite: false,
	}, 'conv');
	await patchTask(task.id, { conversationId: conv.id });
	return conv;
}

// 起跑(queued/scheduled/paused/interrupted → running);返回终态任务。deps 可注入(测试:假流/假判官)。
export async function startGoalTask(taskId, deps){
	const d = deps || {};
	let task = await getTask(taskId);
	if(!task){ return null; }
	// [G7] 幂等闸:循环已在跑(含等审批/等回答的 waiting)→ 不起第二个循环;waiting 只有循环已退出(判官两次失败停住)时才允许「继续」重新起跑
	if(runningLoops.has(taskId)){ return task; }
	if(['queued', 'scheduled', 'paused', 'interrupted', 'waiting'].indexOf(task.status) < 0){ return task; }
	if(!(d.skipGates) && !(isAgentEnabled() && isGoalEnabled())){ return patchTask(taskId, { status: 'failed', result: { reason: '行动能力或目标任务开关未开' } }); }
	// [批三⑤] 并行上限:0=现状(不限);≥1 且已有同样多的循环在跑 → 保持现状态排队(不改状态、不起循环),前一条结束时自动起下一条
	const parallelLimit = d.parallelLimit !== undefined ? Number(d.parallelLimit) || 0 : getGoalParallel();
	if(parallelLimit > 0 && runningLoops.size >= parallelLimit){
		if(!(task.log || []).some((l)=>l && `${l.text || ''}`.indexOf('排队:并行上限') === 0)){ await appendLog(taskId, `排队:并行上限 ${parallelLimit} 已满,等前面的结束`); }
		return getTask(taskId);
	}
	// 过闸即同步占位:连发两条 start 都在 await(解析档案/建会话)期间就会越过上限;占位失败路径必须删回
	const loop = { ac: new AbortController(), state: 'run' };
	runningLoops.set(taskId, loop);
	let resolved; let conv;
	try{
		resolved = d.resolved || await resolveHeadlessProfile(task.spec);
		if(!resolved){ runningLoops.delete(taskId); return patchTask(taskId, { status: 'failed', result: { reason: '没有可用的接口配置/模型' } }); }
		conv = await ensureGoalConversation(task, resolved, d);
	}catch(e){ runningLoops.delete(taskId); throw e; }
	// [D3] 判官目标按 judge 槽解析一次(一任务一读;槽空=任务自身档案与模型)
	const judgeTarget = d.judgeTarget || await resolveHeadlessSlot('judge', resolved).catch((e)=>{ reportBackgroundFailure('goal.judge-slot', e); return resolved; });
	const source = task.spec && task.spec.sourceCid ? findAnalysisSourceById(task.spec.sourceCid) : null;
	registerRunning(taskId, { cancel: ()=>{ loop.state = 'cancel'; loop.ac.abort(); }, pause: ()=>{ loop.state = 'pause'; loop.ac.abort(); }, resume: ()=>startGoalTask(taskId, deps) });
	task = await patchTask(taskId, { status: 'running', runner: runnerStamp() });
	await appendLog(taskId, `开始(第 ${task.spent.turns + 1} 轮起)`);
	// [S46] 循环心跳:另一窗口启动对账时据此分辨「活的」与「刷新前留下的死循环」
	const beat = setInterval(()=>{ heartbeatTask(taskId).catch((e)=>reportBackgroundFailure('goal.heartbeat', e)); }, RUNNER_HEARTBEAT_MS);
	let judgeFails = 0; let consecutiveErrors = 0;
	const t0 = Date.now();
	const approve = async (call)=>{
		await patchTask(taskId, { status: 'waiting' });
		await pushNotice({ level: 'action', title: '目标任务等你批准', body: `${task.title}:${call.name} ${approvalVerb(call)}`, taskId }, { desktop: true });
		let ok = false;
		// [G8] 超时由等待台自己收口(到点撤台),不再 race 一个外部定时器把待审条目永远留在台上
		try{ ok = await requestApproval(`task:${taskId}`, call, { timeoutMs: GOAL_APPROVAL_TIMEOUT_MS }); }catch(e){ ok = false; reportBackgroundFailure('goal.approval', e); }
		const cur = await getTask(taskId);
		if(cur && cur.status === 'waiting'){ await patchTask(taskId, { status: 'running' }); }
		return ok;
	};
	const elicit = async (q)=>{
		await patchTask(taskId, { status: 'waiting' });
		await pushNotice({ level: 'action', title: '目标任务向你提问', body: `${task.title}:${q.question}`, taskId }, { desktop: true });
		const r = await requestElicitation(`task:${taskId}`, q);
		const cur = await getTask(taskId);
		if(cur && cur.status === 'waiting'){ await patchTask(taskId, { status: 'running' }); }
		return r;
	};
	try{
		for(;;){
			task = await getTask(taskId);
			const over = budgetExceeded(task);
			if(over){ await appendLog(taskId, `停止:${over}`); task = await patchTask(taskId, { status: 'failed', result: { reason: over } }); await pushNotice({ level: 'warn', title: '目标任务停止', body: `${task.title}:${over}`, taskId }); break; }
			const steer = (task.instructions || []).filter((i)=>i && !i.consumed);
			const steerLine = steer.length ? `${GOAL_STEER_PREFIX} ${steer.map((i)=>i.text).join(';')}` : '';
			// 首轮:目标 prompt(+起跑前记录的纠偏附在末尾);后续轮:有纠偏就用纠偏替代「继续」;用到的纠偏才标已消费
			const userText = task.spent.turns === 0 ? `${buildGoalPrompt(task.spec)}${steerLine ? `\n${steerLine}` : ''}` : (steerLine || '继续:按目标推进下一步;若已达成,只回复「已达成」并总结结果。');
			if(steer.length){ await patchTask(taskId, { instructions: (task.instructions || []).map((i)=>({ ...i, consumed: true })) }); }
			const turnStart = Date.now();
			// eslint-disable-next-line no-await-in-loop
			const r = await runHeadlessTurn({ profile: resolved.profile, model: resolved.model, conversationId: conv.id, userText, source, techniqueKeys: task.spec.techniques, systemPrompt: '', origin: 'goal', taskId, signal: loop.ac.signal, requestApproval: approve, requestElicitation: elicit, techniqueOptionOverrides: task.spec.techniqueOptionOverrides, deps: d });
			const calls = r.trace && Array.isArray(r.trace.rounds) ? r.trace.rounds.reduce((n, rd)=>n + ((rd.results || []).length), 0) : 0;
			// [Q-294/M-109·AR-10] 计价表无此模型时 cost 为 null:记 costUnpriced(任务行标「费用预算不可用」),不再按 0 累计伪装成「$0.000/上限」
			const _du = r.usage ? deriveUsage(r.usage) : null;
			const cost = _du && _du.cost != null ? _du.cost : 0;
			const costUnpriced = !!(r.usage && (!_du || _du.cost == null));
			task = await getTask(taskId);
			// eslint-disable-next-line no-await-in-loop
			task = await patchTask(taskId, { spent: { turns: task.spent.turns + 1, calls: task.spent.calls + calls, costUsd: task.spent.costUsd + cost, costUnpriced: !!(task.spent.costUnpriced || costUnpriced), wallMs: task.spent.wallMs + (Date.now() - turnStart) }, progress: Math.min(95, Math.round(((task.spent.turns + 1) / (task.budget.maxTurns || 8)) * 100)) });
			if(r.aborted){
				if(loop.state === 'pause'){ task = await patchTask(taskId, { status: 'paused' }); await appendLog(taskId, '已暂停'); }
				else if(loop.state === 'cancel'){ /* cancelTask 已落 cancelled */ }
				break;
			}
			if(r.error){
				consecutiveErrors += 1; await appendLog(taskId, `第 ${task.spent.turns} 轮出错:${r.error}`);
				if(consecutiveErrors >= 2){ await appendLog(taskId, `停止:连续出错 ${consecutiveErrors} 次`); task = await patchTask(taskId, { status: 'failed', result: { reason: `连续出错:${r.error}` } }); await pushNotice({ level: 'error', title: '目标任务失败', body: `${task.title}:${r.error}`, taskId }); break; }
				continue;
			}
			consecutiveErrors = 0;
			// eslint-disable-next-line no-await-in-loop
			let judgeSpend = null;
			const verdict = await judgeGoal({ profile: judgeTarget.profile, model: judgeTarget.model, spec: task.spec, lastReply: r.content, deps: d, signal: loop.ac.signal, onSpend: (sp)=>{ judgeSpend = sp; } }).catch((e)=>{ reportBackgroundFailure('goal.judge', e); return null; });
			// [Q-402① 裁决] 判官调用计入预算四维:调用数 +1、时长累加、usage 可计价时费用累加(计价表无此模型 → costUnpriced)
			if(judgeSpend){
				const _jd = judgeSpend.usage ? deriveUsage(judgeSpend.usage) : null;
				const jCost = _jd && _jd.cost != null ? _jd.cost : 0;
				const jUnpriced = !!(judgeSpend.usage && (!_jd || _jd.cost == null));
				task = await getTask(taskId);
				task = await patchTask(taskId, { spent: { ...task.spent, calls: task.spent.calls + 1, costUsd: task.spent.costUsd + jCost, costUnpriced: !!(task.spent.costUnpriced || jUnpriced), wallMs: (task.spent.wallMs || 0) + (judgeSpend.wallMs || 0) } });
			}
			if(!verdict){ judgeFails += 1; await appendLog(taskId, `自检未返回合法 JSON(${judgeFails}/${GOAL_MAX_JUDGE_FAILS})`); if(judgeFails >= GOAL_MAX_JUDGE_FAILS){ task = await patchTask(taskId, { status: 'waiting', result: { reason: '自检连续失败,需要你看一下' } }); await pushNotice({ level: 'action', title: '目标任务需要你', body: `${task.title}:自检连续失败`, taskId }); break; } continue; }
			await appendLog(taskId, `自检:${verdict.status}${verdict.reason ? ` · ${verdict.reason}` : ''}${verdict.nextStep ? ` · 下一步 ${verdict.nextStep}` : ''}`);
			if(verdict.status === 'done'){ task = await patchTask(taskId, { status: 'done', progress: 100, result: { reason: verdict.reason, summary: `${r.content || ''}`.slice(0, 2000) } }); await pushNotice({ level: 'success', title: '目标任务完成', body: `${task.title}:${verdict.reason || '已达成'}`, taskId }); break; }
			if(verdict.status === 'blocked'){ judgeFails += 1; if(judgeFails >= GOAL_MAX_JUDGE_FAILS){ task = await patchTask(taskId, { status: 'waiting', result: { reason: verdict.reason || '需要你介入' } }); await pushNotice({ level: 'action', title: '目标任务需要你', body: `${task.title}:${verdict.reason || '卡住了'}`, taskId }); break; } continue; }
		}
	}catch(e){
		reportBackgroundFailure('goal.loop', e);
		try{ task = await patchTask(taskId, { status: 'failed', result: { reason: e && e.message ? `${e.message}` : `${e}` } }); }catch(_e){ reportBackgroundFailure('goal.fail-patch', _e); }
	}finally{
		clearInterval(beat);
		runningLoops.delete(taskId);
		unregisterRunning(taskId);
		// [批三⑤] 并行上限开着:起下一条排队的目标(最早建的先);失败只留痕
		const lim = d.parallelLimit !== undefined ? Number(d.parallelLimit) || 0 : getGoalParallel();
		if(lim > 0){ startNextQueuedGoal(deps).catch((e)=>reportBackgroundFailure('goal.next', e)); }
	}
	return getTask(taskId);
}

// [批三⑤] 起下一条排队中的目标(queued 且循环未在跑,按创建时间最早);没有=false
export async function startNextQueuedGoal(deps){
	const list = (await listTasks({ kind: 'goal', status: 'queued' })).filter((t)=>t && !runningLoops.has(t.id)).sort((a, b)=>`${a.createdAt || ''}`.localeCompare(`${b.createdAt || ''}`));
	if(!list.length){ return false; }
	startGoalTask(list[0].id, deps).catch((e)=>reportBackgroundFailure('goal.next', e));
	return true;
}
// 「全部开始」:把所有 queued 的目标逐条起跑(受并行上限约束:超出的保持 queued,由前一条结束时接力)
export async function startAllQueuedGoals(deps){
	const list = (await listTasks({ kind: 'goal', status: 'queued' })).sort((a, b)=>`${a.createdAt || ''}`.localeCompare(`${b.createdAt || ''}`));
	let started = 0;
	for(let i = 0; i < list.length; i++){
		const p = startGoalTask(list[i].id, deps).catch((e)=>reportBackgroundFailure('goal.startAll', e));
		// 等到它要么占了位(过闸)要么已回(排队/失败);最多等 200ms 让 getTask 的一次 await 落定
		// eslint-disable-next-line no-await-in-loop
		await Promise.race([p, new Promise((r)=>setTimeout(r, 200))]);
		if(runningLoops.has(list[i].id)){ started += 1; }
	}
	return { total: list.length, started };
}

export async function steerGoalTask(taskId, text){
	const t = await getTask(taskId);
	if(!t || !`${text || ''}`.trim()){ return null; }
	return patchTask(taskId, { instructions: (t.instructions || []).concat({ at: new Date().toISOString(), text: `${text}`.trim().slice(0, 500), consumed: false }) });
}
export function isGoalLoopRunning(taskId){ return runningLoops.has(taskId); }
export function __resetGoalRunnerForTests(){ runningLoops.clear(); }

// 建目标任务(UI/工具共用):返回任务;autoStart 用 setTimeout(0) 脱离当前调用栈(工具执行中不得再起 Turn)
// [Q-285/M-96] 创建时快照会话覆盖(只留本任务技法、只留对象值、JSON ≤ 20k):后台轮按「快照 ?? 同类默认」拼挂载,与对话页同口径
export function snapshotTechniqueOptionOverrides(overrides, techniques){
	if(!overrides || typeof overrides !== 'object'){ return undefined; }
	const keys = Array.isArray(techniques) ? techniques : [];
	const out = {};
	keys.forEach((k)=>{ const v = overrides[k]; if(k && v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length){ out[k] = v; } });
	if(!Object.keys(out).length){ return undefined; }
	try{ return JSON.stringify(out).length <= 20000 ? JSON.parse(JSON.stringify(out)) : undefined; }catch(e){ return undefined; }
}

export async function createGoalTask({ goal, successCriteria, budget, sourceCid, techniques, autoStart, origin, aiOrigin, modelSelection, techniqueOptionOverrides }){
	const techs = Array.isArray(techniques) ? techniques.slice(0, 6) : [];
	const task = await createTask({ kind: 'goal', title: `${goal || ''}`.slice(0, 40) || '目标任务', origin: origin || 'in-app', aiOrigin: aiOrigin || null,
		spec: { goal: `${goal || ''}`.slice(0, 2000), successCriteria: `${successCriteria || ''}`.slice(0, 1000), sourceCid: sourceCid || null, techniques: techs, modelSelection: snapshotModelSelection(modelSelection) || undefined, techniqueOptionOverrides: snapshotTechniqueOptionOverrides(techniqueOptionOverrides, techs) },
		budget: budget && typeof budget === 'object' ? budget : undefined });
	if(autoStart){ setTimeout(()=>{ startGoalTask(task.id).catch((e)=>reportBackgroundFailure('goal.autoStart', e)); }, 0); }
	return task;
}
