// AI 助手·智能体运行时(借鉴 Codex Thread→Turn→Item):一个 assistant 气泡 = 一个 Turn;
// 每轮 = 一次流式请求 + (若模型发起调用)执行工具 + 回喂;循环由页面 do/while 驱动:
//   do{ agent.beginRound(); stream(messages: agent.messagesForRound(base), tools: agent.toolDefs(), toolChoice: agent.toolChoice()) }while(await agent.settleRound())
// 总开关(prefs.isAgentEnabled)关 → NULL_AGENT:请求体无 tools/无规则块,消息与旧 map 逐字段等价 = 完全现状路径。
import { isAgentEnabled, getAgentApprovalMode, getAgentApprovalCategories, getTrustedRecords, getToolPolicy, normalizeToolPolicy } from './prefs';
import { resolveApprovalDecision, autoAllowReadLevel } from './approvalPolicy';
import { isToolSessionAllowed } from './sessionAllow';
import { getToolCapability, recordToolCapability, isUnsupportedToolsError } from './caps';
import { buildTextProtocolRules, parseActionBlockDetailed, protocolErrorCall } from './textProtocol';   // [Q-288] 围栏协议错要回喂
import { agentSystemRulesFor, plainMessages, expandHistory, expandTraceToMessages, injectSystemRules, formatToolResultContent, mergeUsageAcrossRounds } from './protocol';
import * as defaultRegistry from '../aiTools/registry';
import { registerBuiltinTools } from '../aiTools';
import { withTimeout } from './withTimeout';
import { steerLine } from './steer';
import { readContextPolicy } from '../aiChatHistory';

export const AGENT_LIMITS = Object.freeze({ MAX_ROUNDS: 6, MAX_CALLS_PER_TURN: 16, MAX_CALLS_PER_ROUND: 8, MAX_ADDITIVE_PER_TURN: 5, MAX_UI_PER_TURN: 2, RESULT_MAX_CHARS: 8000, TOOL_TIMEOUT_MS: 120000 });
export const AGENT_STOP_REASONS = ['stop', 'aborted', 'max_rounds', 'error'];

// 上下文策略(历史 trace 回放分级 / 折叠预算 / 同参去重):由聊天历史模块提供并可由用户设置;
// 模块缺席或读取抛错一律回缺省——缺省 = 最近 2 Turn 原样回放、不折叠、不去重 = 现状字节等价。
export const DEFAULT_AGENT_CONTEXT_POLICY = Object.freeze({ traceTurnsFull: 2, traceTurnsFolded: 0, foldedResultMaxChars: Object.freeze({ read: 1200, additive: 600 }), dedupSameCall: false });

// [Q-290/PP-21③] 改名 normalizeAgentTracePolicy:与 aiChatHistory 的同名归一函数同名异义(此处只取 trace 回放四键、不设上限),避免混用
function normalizeAgentTracePolicy(raw){
	const p = raw && typeof raw === 'object' ? raw : {};
	// 只认真数字(null/字符串一律走缺省;Number(null)=0 会把「未设」当成 0)
	const nonNeg = (v, d)=>(typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
	const pos = (v, d)=>(typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : d);
	const dm = DEFAULT_AGENT_CONTEXT_POLICY.foldedResultMaxChars;
	let fold = { read: dm.read, additive: dm.additive };
	if(typeof p.foldedResultMaxChars === 'number'){ fold = pos(p.foldedResultMaxChars, dm.read); }
	else if(p.foldedResultMaxChars && typeof p.foldedResultMaxChars === 'object'){ fold = { read: pos(p.foldedResultMaxChars.read, dm.read), additive: pos(p.foldedResultMaxChars.additive, dm.additive) }; }
	return {
		traceTurnsFull: nonNeg(p.traceTurnsFull, DEFAULT_AGENT_CONTEXT_POLICY.traceTurnsFull),
		traceTurnsFolded: nonNeg(p.traceTurnsFolded, DEFAULT_AGENT_CONTEXT_POLICY.traceTurnsFolded),
		foldedResultMaxChars: fold,
		dedupSameCall: p.dedupSameCall === true,
	};
}

// 容错读取:策略键由聊天历史模块(aiChatHistory)负责持久化与钳制,这里只消费;读取抛错一律回缺省(一个 Turn 不能因策略读取而失败)
export function readAgentContextPolicy(){
	let policy = null;
	try{ policy = readContextPolicy(); }catch(e){ policy = null; }
	return normalizeAgentTracePolicy(policy);
}

// 同参判定用的稳定序列化:对象键排序、undefined 略过(与 JSON 一致)、数组保序
export function stableStringify(v){
	if(v === undefined){ return 'null'; }
	if(v === null || typeof v !== 'object'){ return JSON.stringify(v); }
	if(Array.isArray(v)){ return `[${v.map((x)=>stableStringify(x)).join(',')}]`; }
	return `{${Object.keys(v).sort().filter((k)=>v[k] !== undefined).map((k)=>`${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

export const NULL_AGENT = Object.freeze({
	enabled: false,
	mode: 'off',
	beginRound(){},
	toolDefs(){ return undefined; },
	toolChoice(){ return undefined; },
	messagesForRound(base){ return plainMessages(base); },
	onEvent(){},
	absorbStreamError(){ return false; },
	async settleRound(){ return false; },
	failRound(){},
	trace(){ return null; },
	mergeUsage(u){ return u; },
	hasActivity(){ return false; },
	// [C4] 模型路由钩:总开关关时页面仍会调,一律空实现(单轮、无收口)
	setRoundModel(){},
	requestClose(){},
	isClosing(){ return false; },
	currentCallCount(){ return 0; },
});

export const PREVIEW_TIMEOUT_MS = 3000;
export const PREVIEW_MAX_CHARS = 20000;

function newTurnId(){
	return `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAgentTurn(opts = {}){
	const enabled = opts.enabled !== undefined ? !!opts.enabled : isAgentEnabled();
	if(!enabled){ return NULL_AGENT; }
	const registry = opts.registry || defaultRegistry;
	if(!opts.registry){ try{ registerBuiltinTools(); }catch(e){ /* 幂等 */ } }
	const limits = { ...AGENT_LIMITS, ...(opts.limits || {}) };
	const profileId = opts.profile && opts.profile.id ? opts.profile.id : (opts.profileId || '');
	const model = opts.model || '';
	const approvalMode = opts.approvalMode || getAgentApprovalMode();
	// 类别档/信任档案/来源也在 Turn 创建时读一次(与策略同纪律:一个 Turn 内判定面不变)
	const approvalCategories = opts.approvalCategories || getAgentApprovalCategories();
	const trustedRecords = Array.isArray(opts.trustedRecords) ? opts.trustedRecords : getTrustedRecords();
	// [批二②] 按工具名放行/禁用:同样一 Turn 一读;deny 的工具不进本 Turn 的工具目录,模型硬调也拒
	const toolPolicy = normalizeToolPolicy(opts.toolPolicy || getToolPolicy());
	const origin = opts.origin ? `${opts.origin}` : 'in-app';
	const taskId = opts.taskId ? `${opts.taskId}` : undefined;
	const cap = getToolCapability(profileId, model);
	// 策略创建时读一次,Turn 内不变(中途改设置不改变本 Turn 已发出请求的前缀形状)
	const policy = normalizeAgentTracePolicy(opts.contextPolicy || readAgentContextPolicy());
	const state = {
		turnId: newTurnId(),
		mode: cap === 'text' ? 'text' : 'native',
		rounds: [],
		cur: null,
		closing: false,
		closingBy: null,   // [PP-14] 'limit'(轮数上限)| 'route'(终稿槽收口)
		stopReason: null,
		fallbackTried: false,
		resend: false,
		totalCalls: 0,
		additiveCalls: 0, uiCalls: 0,
		readCache: new Map(),   // 同参去重:key=工具名|writeEpoch|稳定序列化参数 → { callId, promise }
		writeEpoch: 0,          // 任一 additive 成功即 +1,此前的只读结果全部失效
		closeRequested: false,  // [C4] 页面在「本轮无调用但终稿模型≠工具轮模型」时请求再收口一轮(只生效一次)
		roundModel: '',         // [C4] 页面每轮 setRoundModel:本轮实际用的模型(进 trace,动作条按轮显示)
		todos: [],              // [批二⑥] note_progress 最近一次报的进度清单(整份替换;进 trace,动作条头部显示)
		pendingSteer: '',       // [批二⑤] 本轮要附在请求末尾的用户插话(beginRound 从 opts.steer 取一次,取即清)
		steers: [],             // [批二⑤] 本 Turn 消费过的插话(进 trace,动作条可显示)
	};
	// [进阶复查 D14·2026-09-08] 目录按调用来源列:目标/定时/自动规则轮不再向模型宣告 origins 合同外的工具(此前宣告了、一调即 E_TOOL_DISABLED)
	const manifest = ()=>(registry.exportToolManifest({ origin }) || []).filter((t)=>t && toolPolicy.deny.indexOf(t.name) < 0);
	const signal = opts.signal;
	const aborted = ()=>!!(signal && signal.aborted);

	function freshRound(){
		return { index: state.rounds.length, text: '', reasoning: '', usage: null, providerMeta: null, finishReason: null, error: null, toolCalls: [], results: [], startedAt: new Date().toISOString(), model: state.roundModel || model || undefined };
	}
	function emitTrace(){
		if(typeof opts.onTrace === 'function'){ try{ opts.onTrace(trace()); }catch(e){ /* UI 回调不反噬 */ } }
	}
	function trace(){
		const rounds = state.rounds.concat(state.cur && (state.cur.text || state.cur.toolCalls.length || state.cur.results.length) ? [state.cur] : []);
		return {
			version: 1, mode: state.mode, turnId: state.turnId, stopReason: state.stopReason,
			steers: state.steers.slice(),   // [批二⑤] 本 Turn 消费过的用户插话
			todos: state.todos.slice(),     // [批二⑥] 进度清单(最近一次 note_progress)
			rounds: rounds.map((r)=>({
				index: r.index, text: r.text, reasoning: r.reasoning || undefined, usage: r.usage || undefined, providerMeta: r.providerMeta || undefined, finishReason: r.finishReason || undefined, model: r.model || undefined,
				toolCalls: r.toolCalls.map((c)=>({ id: c.id, name: c.name, args: c.args, parseError: c.parseError || undefined })),
				results: r.results.map((x)=>({ ...x })),
			})),
		};
	}
	function ensureCall(json){
		const id = json && json.id ? `${json.id}` : `call_${state.cur.toolCalls.length + 1}`;
		let c = state.cur.toolCalls.find((x)=>x.id === id);
		if(!c){
			c = { id, name: json && json.name ? `${json.name}` : '', index: json && Number.isFinite(json.index) ? json.index : state.cur.toolCalls.length, argumentsText: '', args: {}, parseError: null };
			state.cur.toolCalls.push(c);
		}
		if(json && json.name && !c.name){ c.name = `${json.name}`; }
		// 同一 call id 先后带**不同**工具名=协议违规(网关拼接错/上游复用 id):不能静默合并成先到的那个工具
		// (参数却是后到的),标记后按失败回喂、绝不执行。同名重复 id(上游重发)照旧收成一次。
		if(json && json.name && c.name && `${json.name}` !== c.name){ c.protocolError = `同一调用 id 先后声明了不同工具: ${c.name} / ${json.name}`; }
		return c;
	}
	// 归档前为没有结果的调用补一条 skipped 结果(abort/error/收口轮):历史回放必须调用与结果成对,
	// 否则 OpenAI「must be followed by tool messages」/Anthropic「tool_use without tool_result」/Gemini 直接 400,
	// 且 OpenAI 的报错文案含 "tool" 会被误判成「不支持 tools」把模型永久降级。
	function finalizeUnresolved(code, message){
		if(!state.cur){ return; }
		const have = new Set(state.cur.results.map((x)=>x.callId));
		currentCalls().forEach((c)=>{
			if(have.has(c.id)){ return; }
			const now = new Date().toISOString();
			state.cur.results.push({ callId: c.id, name: c.name, level: null, args: c.args, ok: false, code, content: JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: false, code, message }), summary: message, status: 'skipped', isError: true, startedAt: now, endedAt: now });
		});
	}
	function currentCalls(){
		if(state.mode === 'text'){
			// [Q-288] 协议错(坏 JSON / 多块 / 重复 id)不再静默丢:变成一条伪调用,由 executeCalls 落成
			// 结构化失败结果回喂给模型 —— 此前模型只看到「什么也没发生」,只能反复重试同一个坏块。
			const parsed = parseActionBlockDetailed(state.cur.text);
			if(parsed.error){ const pc = protocolErrorCall(parsed.error); return pc ? [pc] : []; }
			return parsed.hit ? parsed.hit.calls : [];
		}
		return state.cur.toolCalls.filter((c)=>c.name).map((c)=>({ id: c.id, name: c.name, args: c.args, parseError: c.parseError, protocolError: c.protocolError }));
	}
	// 同参去重键:策略开 + read 级 + 工具声明 cacheable;cacheKey(args) 可自定义参数归一,否则键排序序列化
	function dedupKeyFor(call, level, def){
		if(!policy.dedupSameCall || level !== 'read' || !def || !def.cacheable){ return null; }
		try{
			const argKey = typeof def.cacheKey === 'function' ? `${def.cacheKey(call.args)}` : stableStringify(call.args);
			return `${call.name}|${state.writeEpoch}|${argKey}`;
		}catch(e){ return null; }
	}
	async function execOne(call, level, ctxExtra){
		const startedAt = new Date().toISOString();
		const entry = { callId: call.id, name: call.name, level, args: call.args, ok: false, code: undefined, content: '', summary: '', status: 'running', undo: undefined, dedupOf: undefined, startedAt, endedAt: null, isError: false, truncated: false };
		state.cur.results.push(entry);
		emitTrace();
		let result;
		if(call.protocolError){
			result = { ok: false, code: 'E_PROTOCOL_DUP_ID', message: call.protocolError };
			entry.status = 'failed';
		}else if(call.parseError){
			result = { ok: false, code: 'E_ARGS_INVALID', message: `参数不是合法 JSON: ${call.parseError}` };
		}else{
			// 审批三档(never 全自动/on-request 每次确认/read-only 只读)× 类别收紧 × 信任档案 × [批二②] 工具名策略:纯函数判定,全级别计算
			// (只读工具此前不进判定;deny 名单要对只读工具同样生效)
			const def0 = typeof registry.getTool === 'function' ? registry.getTool(call.name) : null;
			// [D65] 「本会话不再问」的放行集只对对话来源生效:此前对所有来源缺省读它,对话里点过一次后,之后创建的目标/定时任务同名写入不再询问
			const sessionAllow = typeof opts.sessionAllow === 'function' ? opts.sessionAllow : (origin === 'in-app' ? isToolSessionAllowed : ()=>false);
			let decision = resolveApprovalDecision({ level, def: def0, args: call.args, mode: approvalMode, categories: approvalCategories, trustedRecords, toolPolicy, sessionAllow });
			if(decision === 'ask' && autoAllowReadLevel(origin, level)){ decision = 'auto'; entry.autoApproved = 'no-channel'; }
			if(decision === 'deny'){
				// [D12] 读级工具被拒只可能来自显式类别档「只读」(外部不出网 / 反问不弹 / 界面不动);写入类来自总档或类别档只读
				const deniedCat = def0 && def0.category ? `${def0.category}` : 'query';
				// [D36] 禁用名的分支不可达(manifest 已剥、executeCalls 先拒),不再在此重复判
				result = { ok: false, code: 'E_APPROVAL_DENIED', message: level === 'read' ? `类别「${deniedCat}」已被用户设为只读(不出网/不反问/不动界面),${call.name} 未执行` : '当前审批档为只读,写入动作未执行' };
				entry.status = 'skipped';
			}else if(decision === 'ask' && typeof opts.requestApproval !== 'function'){
				// [进阶复查 D15·2026-09-08] 判「询问」却没有审批通道 = fail-closed 拒绝;此前这里静默放行执行(今日活调用方都带通道,属潜在陷阱)
				result = { ok: false, code: 'E_APPROVAL_DENIED', message: `${call.name} 需要你确认,但本调用路径没有审批通道,未执行`, data: { reason: 'no-approval-channel' } };
				entry.status = 'skipped';
			}else if(decision === 'ask'){
				let allowed = false;
				// [批二③] 写前预览:工具自报 before/after(3s 超时;失败/超时 = 无预览,审批照常),随待审条目一起交给审批台
				let preview = null;
				if(def0 && typeof def0.preview === 'function'){
					try{
						const p = await withTimeout(Promise.resolve().then(()=>def0.preview(call.args, { origin, taskId })), PREVIEW_TIMEOUT_MS, { code: 'E_TOOL_TIMEOUT', message: '预览超时' });
						if(p && typeof p === 'object'){ preview = { title: `${p.title || ''}`.slice(0, 120), before: `${p.before || ''}`.slice(0, PREVIEW_MAX_CHARS), after: `${p.after || ''}`.slice(0, PREVIEW_MAX_CHARS) }; }
					}catch(e){ preview = null; }
				}
				// 等审批时用户点「停止」:abort 信号必须能解开等待(否则 settleRound 永不返回,气泡永远 streaming)
				try{
					allowed = await new Promise((resolve)=>{
						let settled = false;
						const done = (v)=>{ if(!settled){ settled = true; resolve(!!v); } };
						if(aborted()){ done(false); return; }
						const onAbort = ()=>done(false);
						if(signal && typeof signal.addEventListener === 'function'){ signal.addEventListener('abort', onAbort, { once: true }); }
						// 带上 abort 信号:审批台据此在用户点「停止」时清掉待审条目(否则动作条残留「允许/跳过」死按钮)
						Promise.resolve().then(()=>opts.requestApproval({ callId: call.id, name: call.name, args: call.args, level, signal, preview })).then(done, ()=>done(false));
					});
				}catch(e){ allowed = false; }
				if(!allowed){
					result = { ok: false, code: 'E_USER_SKIPPED', message: '用户跳过了该动作' };
					entry.status = 'skipped';
				}
			}
		}
		if(!result){
			const def = typeof registry.getTool === 'function' ? registry.getTool(call.name) : null;
			const ms = def && def.timeoutMs ? def.timeoutMs : limits.TOOL_TIMEOUT_MS;
			// 同参去重(策略 dedupSameCall,缺省关):本 Turn 内同名同参且期间无写入成功的只读调用不再执行,
			// 结果指向原调用(回喂不重复 data 正文,否则去重零收益;result.data 仍持原 data 引用),仍计入调用限额。
			// 缓存的是在途 promise:同轮并行的两条同参读调用也只执行一次。原调用失败(ok:false)不作命中,照常执行。
			const key = dedupKeyFor(call, level, def);
			const hit = key ? state.readCache.get(key) : null;
			if(hit){
				let prior = null;
				try{ prior = await hit.promise; }catch(e){ prior = null; }
				if(prior && prior.ok){
					entry.dedupOf = hit.callId;
					result = { ok: true, dedupOf: hit.callId, message: `与调用 ${hit.callId} 参数相同且期间无写入,未重复执行;原文见该调用结果`, data: prior.data, summary: `同参去重(同 ${hit.callId})` };
				}
			}
			if(!result){
				const run = (async ()=>{
					try{
						return await withTimeout(registry.runTool(call.name, call.args, {
							origin, taskId, requestId: `${state.turnId}:${state.cur.index}:${call.id}`, dispatch: opts.dispatch, getStore: opts.getStore, ui: opts.ui, signal, lastUserMessage: opts.lastUserMessage,
								// [D77] 本 Turn 的档案::模型交给建任务类工具做创建时快照(schedule_task 此前读 ctx.modelSelection 而运行时从不注入 = 死参数;目标任务里再建任务会钉住 UI 当前模型而非任务自己的模型)
								modelSelection: profileId && model ? `${profileId}::${model}` : undefined,
								// [Q-285/M-96] 本 Turn 的每技法会话覆盖交给建任务类工具做创建时快照(目标任务后台轮按「快照 ?? 同类默认」拼挂载)
								techniqueOptionOverrides: opts.techniqueOptionOverrides && typeof opts.techniqueOptionOverrides === 'object' ? opts.techniqueOptionOverrides : undefined,
							// 反问通道(ask_user):页面/任务中心提供 requestElicitation;缺席时工具回 E_ELICIT_UNAVAILABLE
							elicit: typeof opts.requestElicitation === 'function' ? (q)=>opts.requestElicitation({ ...(q || {}), callId: call.id, name: call.name, signal }) : undefined,
							...(ctxExtra || {}),
						}), ms);
					}catch(e){
						return { ok: false, code: e && e.code ? e.code : 'E_TOOL_THREW', message: e && e.message ? e.message : `${e}` };
					}
				})();
				if(key){ state.readCache.set(key, { callId: call.id, promise: run }); }
				result = await run;
				// [批二⑥] 进度清单:每次调用整份替换(工具本身零落库;清单只活在 trace 里)
				if(call.name === 'note_progress' && result && result.ok && result.data && Array.isArray(result.data.items)){ state.todos = result.data.items.slice(0, 20); }
			}
		}
		const fmt = entry.dedupOf
			? { content: JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: true, dedupOf: entry.dedupOf, message: result.message }), truncated: false }
			: formatToolResultContent(result, { maxChars: limits.RESULT_MAX_CHARS });
		entry.ok = !!(result && result.ok);
		// 任一写入成功即换代:此前缓存的只读结果全部失效(键含 writeEpoch,顺手清空释放引用)
		if(level === 'additive' && entry.ok){ state.writeEpoch += 1; state.readCache.clear(); }
		entry.code = result ? result.code : undefined;
		entry.content = fmt.content;
		entry.truncated = fmt.truncated;
		entry.isError = !entry.ok;
		entry.summary = result && (result.summary || result.message) ? `${result.summary || result.message}` : (entry.ok ? '完成' : '失败');
		entry.undo = result && result.undo && result.undo.actionId ? { actionId: result.undo.actionId, kind: result.undo.kind, label: result.undo.label } : undefined;
		// [进阶复查 D17·2026-09-08] 预留成功而账本提交失败 → 动作已落地却不可撤销:进 trace 让动作条与通知中心告诉用户(此前全仓无人消费)
		entry.ledgerLost = result && result.ledgerLost === true ? true : undefined;
		if(entry.status !== 'skipped'){ entry.status = entry.ok ? 'completed' : 'failed'; }
		entry.endedAt = new Date().toISOString();
		emitTrace();
		return entry;
	}
	async function executeCalls(calls){
		const man = manifest();
		const levelOf = (name)=>{ const t = man.find((x)=>x.name === name); return t ? t.level : null; };
		const categoryOf = (name)=>{ const t = man.find((x)=>x.name === name); return t && t.category ? `${t.category}` : 'query'; };
		const accepted = [];
		calls.forEach((c, i)=>{
			// [Q-288] 协议错先于一切判定(否则空工具名会被报成「未知工具」,把真因盖掉)
			if(c.protocolError){
				const code = c.protocolCode || 'E_PROTOCOL_DUP_ID';
				state.cur.results.push({ callId: c.id, name: c.name || '(协议)', level: null, args: c.args || {}, ok: false, code, content: JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: false, code, message: c.protocolError }), summary: '协议错', status: 'failed', isError: true, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() });
				return;
			}
			const level = levelOf(c.name);
			if(i >= limits.MAX_CALLS_PER_ROUND || state.totalCalls >= limits.MAX_CALLS_PER_TURN){
				state.cur.results.push({ callId: c.id, name: c.name, level, args: c.args, ok: false, code: 'E_LIMIT', content: JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: false, code: 'E_LIMIT', message: '本轮调用数超限,已跳过' }), summary: '超限跳过', status: 'skipped', isError: true, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() });
				return;
			}
			// [进阶复查 D16·2026-09-08] 过了每 Turn 总额判定的每一次尝试都计额(含被禁用/未知名/超类别上限):此前被拒不计 → 模型可硬调禁用工具 ~48 次/Turn
			state.totalCalls += 1;
			if(!level && toolPolicy.deny.indexOf(c.name) >= 0){
				// [批二②] 用户禁用的工具不在本 Turn 目录里;模型硬调 → 明确回「已被禁用」而不是「未知工具」(否则模型会去猜名字)
				const dmsg = `工具 ${c.name} 已被用户禁用,未执行`;
				state.cur.results.push({ callId: c.id, name: c.name, level: null, args: c.args, ok: false, code: 'E_APPROVAL_DENIED', content: JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: false, code: 'E_APPROVAL_DENIED', message: dmsg }), summary: dmsg, status: 'skipped', isError: true, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() });
				return;
			}
			if(!level){
				state.cur.results.push({ callId: c.id, name: c.name, level: null, args: c.args, ok: false, code: 'E_TOOL_NOT_FOUND', content: JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: false, code: 'E_TOOL_NOT_FOUND', message: `未知工具: ${c.name}` }), summary: '未知工具', status: 'failed', isError: true, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() });
				return;
			}
			if(level === 'additive' && state.additiveCalls >= limits.MAX_ADDITIVE_PER_TURN){
				state.cur.results.push({ callId: c.id, name: c.name, level, args: c.args, ok: false, code: 'E_LIMIT', content: JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: false, code: 'E_LIMIT', message: '本次对话写入动作已达上限,请用户确认后再继续' }), summary: '写入超限', status: 'skipped', isError: true, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() });
				return;
			}
			// [批五] 界面动作(导航/合盘配对)每 Turn 封顶:切来切去用户看不过来;超出回 E_LIMIT 不执行
			const isUi = categoryOf(c.name) === 'ui';
			if(isUi && state.uiCalls >= limits.MAX_UI_PER_TURN){
				state.cur.results.push({ callId: c.id, name: c.name, level, args: c.args, ok: false, code: 'E_LIMIT', content: JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: false, code: 'E_LIMIT', message: `本轮界面动作已达上限 ${limits.MAX_UI_PER_TURN} 次,未执行` }), status: 'skipped', summary: '界面动作超限', startedAt: new Date().toISOString(), endedAt: new Date().toISOString() });
				return;
			}
			if(level === 'additive'){ state.additiveCalls += 1; }
			if(isUi){ state.uiCalls += 1; }
			accepted.push({ call: c, level, ui: isUi });
		});
		// read 并行 / additive 串行(写入顺序=模型给出顺序;并发写同库无意义且难撤销)/ [批五] ui 类界面动作最后串行(先读后动,切页放在本轮末尾)
		await Promise.all(accepted.filter((a)=>a.level === 'read' && !a.ui).map((a)=>execOne(a.call, 'read')));
		// 批量建档抑制:同批多条建档不逐条选中分析源(焦点逐条跳动),建档工具经 ctx.deferSelect 只登记 cid,
		// 批尾对最后一条成功建档 refreshSources+selectSource 一次;单条(batch.total===1)由工具侧照旧立即选中。
		const additive = accepted.filter((x)=>x.level === 'additive');
		let deferredCid = null;
		const deferSelect = (cid)=>{ deferredCid = cid; };
		for(let i = 0; i < additive.length; i++){
			if(aborted()){ break; }
			// eslint-disable-next-line no-await-in-loop
			await execOne(additive[i].call, 'additive', { batch: { index: i, total: additive.length, isLast: i === additive.length - 1 }, deferSelect });
		}
		if(!aborted() && deferredCid && opts.ui){
			try{ opts.ui.refreshSources && opts.ui.refreshSources(); opts.ui.selectSource && opts.ui.selectSource(deferredCid); }catch(e){ /* UI 回调不反噬 */ }
		}
		const uiCalls = accepted.filter((x)=>x.ui);
		for(let i = 0; i < uiCalls.length; i++){
			if(aborted()){ break; }
			// eslint-disable-next-line no-await-in-loop
			await execOne(uiCalls[i].call, 'read');
		}
		// 回喂顺序按模型给出顺序(而非完成顺序),Anthropic/Gemini 要求 tool_result 与 tool_use 同序
		const order = new Map(calls.map((c, i)=>[c.id, i]));
		state.cur.results.sort((a, b)=>(order.get(a.callId) ?? 999) - (order.get(b.callId) ?? 999));
	}

	const agent = {
		enabled: true,
		get mode(){ return state.mode; },
		turnId: state.turnId,
		beginRound(){
			if(!state.resend && state.cur && (state.cur.results.length || state.cur.text || state.cur.toolCalls.length)){ state.rounds.push(state.cur); }
			state.resend = false;
			state.cur = freshRound();
			// [批二⑤] 插话:每轮开始时问一次页面队列(取即清);首轮之前用户还没机会插话,自然为空
			state.pendingSteer = '';
			if(typeof opts.steer === 'function'){
				let s = '';
				try{ s = `${opts.steer() || ''}`.trim(); }catch(e){ s = ''; }
				if(s){ state.pendingSteer = s; state.steers.push({ round: state.rounds.length, text: s, at: new Date().toISOString() }); }
			}
		},
		toolDefs(){
			if(state.mode !== 'native'){ return undefined; }
			return manifest().map((t)=>({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
		},
		toolChoice(){
			if(state.mode !== 'native'){ return undefined; }
			return state.closing ? 'none' : 'auto';
		},
		// [C4] 模型路由:页面每轮开始前告知本轮模型(进 trace);流结束后若「无调用且终稿≠本轮」请求再收口一轮
		setRoundModel(m){ state.roundModel = `${m || ''}`; if(state.cur){ state.cur.model = state.roundModel || model || undefined; } },
		requestClose(){ if(!state.closing){ state.closeRequested = true; } },
		isClosing(){ return !!state.closing; },
		currentCallCount(){ return state.cur ? currentCalls().length : 0; },
		messagesForRound(base){
			// [Q-290/PP-22] 守则按当次目录生成(界面动作条目随两件界面工具是否在目录中出现)
			const _man = manifest();
			const _baseRules = agentSystemRulesFor(_man.map((t)=>t.name));
			const rules = state.mode === 'text' ? `${_baseRules}\n\n${buildTextProtocolRules(_man)}` : _baseRules;
			// 围栏模式下历史里的原生调用一并压平(不支持 tools 的上游不认 tool_calls/role:tool 历史)
			// 历史 Turn 回放分级(策略):最近 traceTurnsFull 个原样、再往前 traceTurnsFolded 个折叠(只留结论与 data 摘要)、更早只留正文
			const history = injectSystemRules(expandHistory(base, {
				traceTurnsFull: opts.traceTurns || policy.traceTurnsFull, traceTurnsFolded: policy.traceTurnsFolded, foldMaxChars: policy.foldedResultMaxChars,
				mode: state.mode === 'text' ? 'text' : undefined,
			}), rules);
			// 本 Turn 已完成的各轮(assistant 调用 + 工具结果)追加在末尾,明确不折叠:同 Turn 各轮请求互为前缀,
			// 折叠会改写已发出的前缀、反而打断上游前缀缓存;且本 Turn 的结果正是模型下一轮要读的原文。
			const soFar = expandTraceToMessages({ mode: state.mode, rounds: state.rounds });
			// [批二⑤] 用户插话附在最末(最近消息位):模型下一轮工具回合先读到它;插话只进本轮请求,不进历史不进账本
			const tail = [];
			if(state.pendingSteer){ tail.push({ role: 'user', content: steerLine(state.pendingSteer) }); }
			// [Q-290/M-105·PP-14] 围栏(text)模式收口轮:原生模式发 tool_choice:'none',围栏模式无此机制,模型照常输出动作块
			//   → settleRound 以「已达上限,未执行」跳过,终稿常只剩「我先查一下……」。收口轮末尾追加一条 user 提示。
			if(state.closing && state.mode === 'text'){ tail.push({ role: 'user', content: '【收口】本轮不要再输出任何动作块,直接根据已有工具结果给出最终结论。' }); }
			return tail.length ? history.concat(soFar, tail) : history.concat(soFar);
		},
		onEvent(event){
			if(!state.cur || !event){ return; }
			const j = event.json || {};
			switch(event.type){
			case 'delta': state.cur.text += j.delta ? `${j.delta}` : ''; break;
			case 'reasoning': state.cur.reasoning += j.reasoning ? `${j.reasoning}` : ''; break;
			case 'usage': if(j && typeof j === 'object'){ state.cur.usage = j; } break;
			case 'tool_call_start': ensureCall(j); break;
			case 'tool_call': {
				const c = ensureCall(j);
				c.argumentsText = j.arguments === undefined || j.arguments === null ? '' : `${j.arguments}`;
				if(j.parseError){ c.parseError = `${j.parseError}`; c.args = {}; break; }
				try{ const parsed = c.argumentsText.trim() ? JSON.parse(c.argumentsText) : {}; c.args = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; c.parseError = null; }
				catch(e){ c.parseError = e && e.message ? e.message : 'bad json'; c.args = {}; }
				break;
			}
			// providerMeta 打上模型名:Anthropic 思考块签名与模型绑定,后端只对同模型回放
			case 'done': state.cur.finishReason = j.finish_reason || null; if(j.providerMeta){ state.cur.providerMeta = { ...j.providerMeta, model }; } break;
			case 'error': state.cur.error = j && j.message ? `${j.message}` : (event.data || '上游错误'); break;
			default: break;
			}
		},
		// 流层抛错:仅「原生模式 + 上游明确不支持 tools + 未降级过」吸收并安排同轮降级重发;其它一律不吸收(照旧上抛)。
		absorbStreamError(err){
			if(aborted() || !err || err.name === 'AbortError'){ return false; }
			if(state.mode === 'native' && !state.fallbackTried && isUnsupportedToolsError(err.message)){
				state.fallbackTried = true;
				state.mode = 'text';
				recordToolCapability(profileId, model, false);
				state.resend = true;
				return true;
			}
			return false;
		},
		async settleRound(){
			if(!state.cur){ return false; }
			if(aborted()){ finalizeUnresolved('E_ABORTED', '用户已停止,未执行'); state.stopReason = 'aborted'; state.rounds.push(state.cur); state.cur = null; emitTrace(); return false; }
			if(state.resend){ emitTrace(); return true; }
			if(state.cur.error && state.mode === 'native' && !state.fallbackTried && isUnsupportedToolsError(state.cur.error)){
				state.fallbackTried = true; state.mode = 'text'; recordToolCapability(profileId, model, false); state.resend = true; emitTrace();
				return true;
			}
			if(state.cur.error){ finalizeUnresolved('E_STREAM_ERROR', '上游出错,未执行'); state.stopReason = 'error'; state.rounds.push(state.cur); state.cur = null; emitTrace(); return false; }
			const calls = currentCalls();
			if(state.mode === 'text'){ state.cur.toolCalls = calls.map((c)=>({ id: c.id, name: c.name, index: 0, argumentsText: '', args: c.args, parseError: null })); }
			if(state.mode === 'native' && state.rounds.length === 0 && cap === 'unknown' && !state.cur.error){ recordToolCapability(profileId, model, true); }
			// [C4] 无调用但页面请求收口(终稿模型≠工具轮模型):本轮正文作废,再跑恰一轮 toolChoice=none 由终稿模型作答
			if(!calls.length && state.closeRequested && !state.closing){
				state.closeRequested = false; state.closing = true; state.closingBy = 'route';   // [PP-14] 路由收口(终稿槽≠工具槽)单独记
				state.rounds.push(state.cur); state.cur = null; emitTrace();
				return true;
			}
			if(!calls.length || state.closing){
				if(calls.length){ finalizeUnresolved('E_LIMIT', state.closingBy === 'route' ? '终稿收口轮不执行工具调用,未执行' : '本次对话调用轮数已达上限,未执行'); }
				// [Q-290/M-105·PP-14] 路由收口记 route_close,不再误记成轮数上限
				state.stopReason = state.closing && calls.length ? (state.closingBy === 'route' ? 'route_close' : 'max_rounds') : 'stop';
				state.rounds.push(state.cur); state.cur = null; emitTrace();
				return false;
			}
			await executeCalls(calls);
			if(aborted()){ finalizeUnresolved('E_ABORTED', '用户已停止,未执行'); state.stopReason = 'aborted'; state.rounds.push(state.cur); state.cur = null; emitTrace(); return false; }
			// 本轮序号 k=rounds.length+1;下一轮 k+1 达到上限即以 toolChoice=none 收口(总请求数 ≤ MAX_ROUNDS)
			if(state.rounds.length + 2 >= limits.MAX_ROUNDS){ state.closing = true; state.closingBy = 'limit'; }
			emitTrace();
			return true;   // 页面 beginRound 会把 cur 归档并开新轮
		},
		// 失败收口:流层抛错(上游停流被看门狗掐 / HTTP 5xx)时页面 catch 调用——settleRound 那条正常路径
		// 走不到,当前轮(含已执行完的建档等结果)本来会整个丢掉、stopReason 停在 null,回放与账本都看不出错在哪。
		// 已完成结果原样保留;未解析的调用记 E_STREAM_ERROR。幂等:cur 已归档时二次调用无副作用。
		failRound(message){
			if(!state.cur){ return; }
			state.cur.error = `${message || ''}` || '上游出错';
			finalizeUnresolved('E_STREAM_ERROR', '上游出错,未执行');
			state.stopReason = 'error';
			state.rounds.push(state.cur);
			state.cur = null;
			emitTrace();
		},
		trace,
		mergeUsage(u){ return mergeUsageAcrossRounds(state.rounds, u); },
		hasActivity(){ return state.rounds.some((r)=>r.toolCalls.length || r.results.length) || (state.cur ? (state.cur.toolCalls.length > 0 || state.cur.results.length > 0) : false); },
	};
	return agent;
}
